// Firebase configuration and authentication
let currentUser = null;

// Firebase configuration - will be loaded from config
let firebaseConfig = {};

// Initialize Firebase when config is loaded
async function initializeFirebase() {
    if (!window.CONFIG) {
        console.log('Waiting for config to load...');
        setTimeout(initializeFirebase, 100);
        return;
    }

    if (!window.CONFIG.FIREBASE_API_KEY) {
        console.warn('Firebase not configured - authentication disabled');
        return;
    }

    firebaseConfig = {
        apiKey: window.CONFIG.FIREBASE_API_KEY,
        authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN,
        projectId: window.CONFIG.FIREBASE_PROJECT_ID
    };

    // Add current domain to authorized domains list for development
    const currentDomain = window.location.hostname;
    console.log(`🔧  Current domain: ${currentDomain}`);

    try {
        // Initialize Firebase (assuming Firebase SDK is loaded)
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialized');
            setupAuthListener();
        } else {
            console.warn('Firebase SDK not loaded');
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

function setupAuthListener() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.warn('Firebase Auth not available');
        return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                usageCount: 0,
                maxUsage: 4,
                subscriptionStatus: 'free'
            };

            console.log('✅ User signed in:', currentUser.email);
            await loadUserDataFromServer(user.uid);
            updateAuthUI();
        } else {
            currentUser = null;
            console.log('User signed out');
            updateAuthUI();
        }
    });
}

async function signIn() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase Auth not available');
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        console.log('✅ Sign in successful:', result.user.email);
    } catch (error) {
        console.error('Sign in error:', error);
        if (error.code === 'auth/unauthorized-domain') {
            showError('Authentication domain not authorized. Please contact support.');
        } else {
            showError('Sign in failed: ' + error.message);
        }
    }
}

async function signOut() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase Auth not available');
        return;
    }

    try {
        await firebase.auth().signOut();
        console.log('✅ Sign out successful');
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

function updateAuthUI() {
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const userInfo = document.getElementById('userInfo');

    if (currentUser) {
        if (signInBtn) signInBtn.style.display = 'none';
        if (signOutBtn) signOutBtn.style.display = 'block';
        if (userInfo) {
            userInfo.innerHTML = `
                <img src="${currentUser.photoURL}" alt="User" style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                <span>${currentUser.displayName}</span>
            `;
            userInfo.style.display = 'flex';
        }
    } else {
        if (signInBtn) signInBtn.style.display = 'block';
        if (signOutBtn) signOutBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
    }

    updateUsageDisplay();
}

function canGenerateAd() {
    if (!currentUser) return false;

    if (currentUser.subscriptionStatus === 'premium') return true;

    return currentUser.usageCount < currentUser.maxUsage;
}

function incrementAdUsage() {
    if (!currentUser) return false;

    if (currentUser.subscriptionStatus === 'premium') return false;

    currentUser.usageCount++;
    saveUserDataToServer(currentUser);
    updateUsageDisplay();

    return currentUser.usageCount >= currentUser.maxUsage;
}

function updateUsageDisplay() {
    if (!currentUser) return;

    const usageEl = document.getElementById('usageCount');
    if (usageEl) {
        if (currentUser.subscriptionStatus === 'premium') {
            usageEl.textContent = 'Unlimited ads (Premium)';
        } else {
            const remaining = currentUser.maxUsage - currentUser.usageCount;
            usageEl.textContent = `${remaining} ads remaining`;
        }
    }

    // Update usage info in header
    const usageInfo = document.querySelector('.usage-info');
    if (usageInfo) {
        const usageCount = usageInfo.querySelector('.usage-count');
        if (usageCount) {
            if (currentUser.subscriptionStatus === 'premium') {
                usageCount.textContent = 'Unlimited ads used';
            } else {
                usageCount.textContent = `${currentUser.usageCount}/${currentUser.maxUsage} ads used`;
            }
        }
    }
}

// User data management - Firebase-based
async function loadUserDataFromServer(uid) {
    try {
        const response = await fetch(`/get-user-data/${uid}`);
        if (response.ok) {
            const serverData = await response.json();
            currentUser = { ...currentUser, ...serverData };
            console.log('✅ User data loaded from server:', currentUser);
            updateAuthUI();
            updateUsageDisplay();
        } else {
            // New user - save default data to server
            await saveUserDataToServer(currentUser);
        }
    } catch (error) {
        console.error('Failed to load user data:', error);
        // Use default values on error
        updateAuthUI();
        updateUsageDisplay();
    }
}

async function saveUserDataToServer(userData) {
    try {
        const response = await fetch('/save-user-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ User data saved to server:', result);
            return result;
        }
    } catch (error) {
        console.error('Failed to save user data:', error);
    }
}

function saveUserData(userData) {
    currentUser = { ...currentUser, ...userData };
    saveUserDataToServer(currentUser);
    updateUsageDisplay();
}

function showError(message) {
    let errorDiv = document.getElementById('auth-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'auth-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 300px;
        `;
        document.body.appendChild(errorDiv);
    }

    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }, 5000);
}

function showLoginModal() {
    const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!user) {
        signIn();
    }
}

// Saved ads management
function saveAd(adData, imageUrl) {
    if (!currentUser) return;

    const savedAds = JSON.parse(localStorage.getItem('savedAds') || '[]');
    const adToSave = {
        id: Date.now(),
        userId: currentUser.uid,
        ...adData,
        imageUrl,
        createdAt: new Date().toISOString()
    };

    savedAds.unshift(adToSave);
    localStorage.setItem('savedAds', JSON.stringify(savedAds.slice(0, 50)));
}

async function syncAdWithServer(adData) {
    try {
        await fetch('/save-ad', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adData)
        });
    } catch (error) {
        console.error('Failed to sync ad with server:', error);
    }
}

// Make functions globally available
window.currentUser = () => currentUser;
window.signIn = signIn;
window.signOut = signOut;
window.canGenerateAd = canGenerateAd;
window.incrementAdUsage = incrementAdUsage;
window.saveUserData = saveUserData;
window.showLoginModal = showLoginModal;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeFirebase);