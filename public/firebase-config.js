// Firebase configuration and authentication
let currentUser = null;

// Firebase configuration - will be loaded from config
let firebaseConfig = {};

// Initialize Firebase when config is loaded
async function initializeFirebase() {
    let retries = 0;
    const maxRetries = 50; // Wait up to 5 seconds
    
    while (!window.CONFIG && retries < maxRetries) {
        console.log(`Waiting for config to load... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }

    if (!window.CONFIG) {
        console.error('Config failed to load after 5 seconds');
        showError('Configuration failed to load. Please refresh the page.');
        return;
    }

    if (!window.CONFIG.FIREBASE_API_KEY) {
        console.warn('Firebase not configured - authentication disabled');
        showError('Firebase authentication is not configured. Please add Firebase credentials to your secrets.');
        return;
    }

    console.log('🔧 Using Firebase authentication (Anonymous only)');
    // Using anonymous authentication only - no Google OAuth needed

    firebaseConfig = {
        apiKey: window.CONFIG.FIREBASE_API_KEY,
        authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN,
        projectId: window.CONFIG.FIREBASE_PROJECT_ID,
        appId: window.CONFIG.FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
    };

    // Add current domain to authorized domains list for development
    const currentDomain = window.location.hostname;
    console.log(`🔧  Current domain: ${currentDomain}`);

    try {
        // Wait for Firebase SDK to load
        let firebaseRetries = 0;
        while (typeof firebase === 'undefined' && firebaseRetries < 50) {
            console.log(`Waiting for Firebase SDK... (${firebaseRetries + 1}/50)`);
            await new Promise(resolve => setTimeout(resolve, 200));
            firebaseRetries++;
        }

        if (typeof firebase !== 'undefined') {
            console.log('✅ Firebase SDK loaded successfully');
            
            // Check if already initialized
            if (firebase.apps.length === 0) {
                const app = firebase.initializeApp(firebaseConfig);
                console.log('✅ Firebase initialized', app.name);
            } else {
                console.log('✅ Firebase already initialized');
            }
            
            // Initialize Firestore
            if (firebase.firestore) {
                window.db = firebase.firestore();
                console.log('✅ Firestore initialized');
            } else {
                console.warn('Firestore not available');
            }

            // Configure auth for development domain
            if (currentDomain.includes('replit.dev')) {
                console.log('🔧 Development environment detected - configuring auth');
            }

            setupAuthListener();
        } else {
            console.error('❌ Firebase SDK failed to load after 10 seconds');
            showError('Authentication service failed to load. Please refresh the page and ensure you have a stable internet connection.');
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
        if (error.code === 'auth/invalid-api-key') {
            showError('Invalid Firebase API key. Please check your Firebase configuration in secrets.');
        } else if (error.code === 'auth/app-already-exists') {
            console.log('Firebase app already exists, continuing...');
            setupAuthListener();
        } else {
            showError('Authentication initialization failed: ' + error.message);
        }
    }
}

function setupAuthListener() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase Auth not available - authentication required');
        showError('Authentication service not available. Please refresh the page.');
        return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = {
                uid: user.uid,
                displayName: user.displayName || `User_${user.uid.slice(-6)}`,
                email: user.email || 'anonymous@example.com',
                photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random`,
                usageCount: 0,
                maxUsage: 4,
                subscriptionStatus: 'free',
                isAnonymous: user.isAnonymous
            };

            console.log('✅ User signed in:', currentUser.email);
            try {
                await loadUserDataFromServer(user.uid);
                updateAuthUI();
            } catch (error) {
                console.error('Failed to load user data:', error);
                showError('Failed to load user data. Please try signing in again.');
                await signOut();
            }
        } else {
            currentUser = null;
            console.log('User signed out');
            updateAuthUI();
            // Clear any cached data when user signs out
            document.getElementById('results')?.innerHTML = '';
        }
    });
}

async function signIn() {
    console.log('🔑 Sign in function called');
    
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not available');
        showError('Authentication service is not loaded. Please wait and try again.');
        return;
    }

    if (!firebase.auth) {
        console.error('Firebase Auth not available');
        showError('Authentication service is not available. Please refresh the page.');
        return;
    }

    try {
        // For demo purposes, sign in anonymously or prompt for email/password
        console.log('🔑 Starting anonymous sign in...');
        const result = await firebase.auth().signInAnonymously();
        
        // Set a display name for anonymous users
        await result.user.updateProfile({
            displayName: `User_${Date.now().toString().slice(-6)}`
        });
        
        console.log('✅ Anonymous sign in successful:', result.user.uid);
        
        // Close any login modal that might be open
        const loginModal = document.getElementById('loginRequiredModal');
        if (loginModal) {
            loginModal.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Sign in error:', error);
        if (error.code === 'auth/operation-not-allowed') {
            showError('Anonymous authentication is not enabled. Please enable it in Firebase Console.');
        } else if (error.code === 'auth/network-request-failed') {
            showError('Network error. Please check your internet connection and try again.');
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
                <span>${currentUser.displayName}${currentUser.isAnonymous ? ' (Guest)' : ''}</span>
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

// User data management - Firebase Firestore based
async function loadUserDataFromServer(uid) {
    try {
        if (!window.db) {
            console.error('Firestore not initialized, cannot load user data');
            throw new Error('Database not available');
        }

        const userDoc = await window.db.collection('users').doc(uid).get();
        
        if (userDoc.exists) {
            const serverData = userDoc.data();
            currentUser = { ...currentUser, ...serverData };
            console.log('✅ User data loaded from Firestore:', currentUser);
        } else {
            // New user - create default data
            console.log('📝 New user detected, creating default data');
            currentUser.createdAt = new Date().toISOString();
            currentUser.lastLoginAt = new Date().toISOString();
            await saveUserDataToServer(currentUser);
        }
        
        updateAuthUI();
        updateUsageDisplay();
    } catch (error) {
        console.error('Failed to load user data from Firestore:', error);
        throw error;
    }
}

async function saveUserDataToServer(userData) {
    try {
        if (!window.db) {
            console.warn('Firestore not initialized, cannot save user data');
            return;
        }

        // Update lastLoginAt
        userData.lastLoginAt = new Date().toISOString();
        
        await window.db.collection('users').doc(userData.uid).set(userData, { merge: true });
        console.log('✅ User data saved to Firestore:', userData);
        return userData;
    } catch (error) {
        console.error('Failed to save user data to Firestore:', error);
        throw error;
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

// Saved ads management - Firebase Firestore
async function saveAd(adData, imageUrl) {
    if (!currentUser || !window.db) {
        console.error('Cannot save ad: user not authenticated or database not available');
        return;
    }

    const adToSave = {
        id: Date.now().toString(),
        userId: currentUser.uid,
        ...adData,
        imageUrl,
        createdAt: new Date().toISOString()
    };

    try {
        // Save to Firestore only
        await window.db.collection('ads').doc(adToSave.id).set(adToSave);
        console.log('✅ Ad saved to Firestore:', adToSave.id);
    } catch (error) {
        console.error('Failed to save ad to Firestore:', error);
        throw error;
    }
}

async function loadUserAds(uid) {
    if (!window.db) return [];
    
    try {
        const adsSnapshot = await window.db.collection('ads')
            .where('userId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
            
        const ads = [];
        adsSnapshot.forEach(doc => {
            ads.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`✅ Loaded ${ads.length} ads from Firestore`);
        return ads;
    } catch (error) {
        console.error('Failed to load ads from Firestore:', error);
        return [];
    }
}

// Make functions globally available immediately
window.currentUser = () => currentUser;
window.signIn = signIn;
window.signOut = signOut;
window.canGenerateAd = canGenerateAd;
window.incrementAdUsage = incrementAdUsage;
window.saveUserData = saveUserData;
window.showLoginModal = showLoginModal;

console.log('✅ Firebase functions made globally available');

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing Firebase...');
    initializeFirebase();
});