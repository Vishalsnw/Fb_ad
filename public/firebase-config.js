// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged,signInWithPopup, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase configuration - loaded from environment
let firebaseConfig = {};

// Load Firebase config from environment with retry mechanism
async function loadFirebaseConfig(retryCount = 0) {
    let loadedFirebaseConfig = {};
    const maxRetries = 3;
    
    try {
        const response = await fetch('/config.js?t=' + Date.now());
        
        if (!response.ok) {
            throw new Error(`Config fetch failed: ${response.status}`);
        }
        
        const configScript = await response.text();

        // Execute config script safely
        const scriptElement = document.createElement('script');
        scriptElement.textContent = configScript;
        document.head.appendChild(scriptElement);
        document.head.removeChild(scriptElement);

        if (window.CONFIG && Object.keys(window.CONFIG).length > 0) {
            console.log('✅ Firebase config loaded from server');

            // Make config values available globally if not already set
            if (!window.GOOGLE_CLIENT_ID) {
                window.GOOGLE_CLIENT_ID = window.CONFIG.GOOGLE_CLIENT_ID;
            }
            if (!window.RAZORPAY_KEY_ID) {
                window.RAZORPAY_KEY_ID = window.CONFIG.RAZORPAY_KEY_ID;
            }
            if (!window.RAZORPAY_KEY_SECRET) {
                window.RAZORPAY_KEY_SECRET = window.CONFIG.RAZORPAY_KEY_SECRET;
            }

            console.log('RAZORPAY_KEY_ID loaded:', !!window.RAZORPAY_KEY_ID);

            if (window.RAZORPAY_KEY_ID && window.RAZORPAY_KEY_SECRET) {
                console.log('✅ Razorpay keys loaded successfully');
            } else {
                console.warn('⚠️ Razorpay keys missing from config');
            }

            // Firebase configuration
            loadedFirebaseConfig = {
                apiKey: window.CONFIG.FIREBASE_API_KEY || "AIzaSyD76bzmFM8ScCq7FCEDzaDPTPSFv3GKPlM",
                authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN || "adgenie-59adb.firebaseapp.com",
                projectId: window.CONFIG.FIREBASE_PROJECT_ID || "adgenie-59adb",
                storageBucket: "adgenie-59adb.firebasestorage.app",
                messagingSenderId: "775764972429",
                appId: "1:775764972429:web:2921b91eea1614a05863c4",
                measurementId: "G-922RPB06J3"
            };

            firebaseConfig = loadedFirebaseConfig;
            return true;
        } else {
            console.error('❌ CONFIG not available or empty from server');
            
            // Retry if we haven't exceeded max retries
            if (retryCount < maxRetries) {
                console.log(`🔄 Retrying config load (${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                return await loadFirebaseConfig(retryCount + 1);
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ Error loading config:', error);
        
        // Retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
            console.log(`🔄 Retrying config load after error (${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return await loadFirebaseConfig(retryCount + 1);
        }
        
        console.warn('Using default Firebase config after all retries failed');
        loadedFirebaseConfig = {
            apiKey: "AIzaSyD76bzmFM8ScCq7FCEDzaDPTPSFv3GKPlM",
            authDomain: "adgenie-59adb.firebaseapp.com",
            projectId: "adgenie-59adb",
            storageBucket: "adgenie-59adb.firebasestorage.app",
            messagingSenderId: "775764972429",
            appId: "1:775764972429:web:2921b91eea1614a05863c4",
            measurementId: "G-922RPB06J3"
        };
        
        firebaseConfig = loadedFirebaseConfig;
        return true;
    }
}

// Initialize Firebase after config loads
let app, auth, provider;

async function initializeFirebase() {
    await loadFirebaseConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
}

// Global variables
let currentUser = null;

// Initialize auth system
function initAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                usageCount: 0,
                maxUsage: 10,
                adsGenerated: 0,
                subscriptionStatus: 'free'
            };

            // Load existing user data from localStorage
            const savedUser = localStorage.getItem('userData');
            if (savedUser) {
                try {
                    const userData = JSON.parse(savedUser);
                    if (userData.uid === user.uid) {
                        currentUser = { ...currentUser, ...userData };
                    }
                } catch (error) {
                    console.error('Error loading saved user data:', error);
                }
            }

            localStorage.setItem('userData', JSON.stringify(currentUser));
            
            // Hide anonymous usage display when user logs in
            const anonymousDisplay = document.getElementById('anonymousUsageDisplay');
            if (anonymousDisplay) {
                anonymousDisplay.style.display = 'none';
            }
            
            // Close login modal if open
            const loginModal = document.getElementById('loginRequiredModal');
            if (loginModal) {
                loginModal.style.display = 'none';
            }
            
            updateAuthUI();
            syncUserData(currentUser);
            
            // Show upgrade prompt for new users
            if (typeof window.checkAndShowUpgradePrompt === 'function') {
                window.checkAndShowUpgradePrompt();
            }
            
            console.log('✅ User signed in:', user.email);
        } else {
            currentUser = null;
            localStorage.removeItem('userData');
            localStorage.removeItem('savedAds');
            
            // Show anonymous usage display when user logs out
            if (typeof window.updateAnonymousUsageDisplay === 'function') {
                window.updateAnonymousUsageDisplay();
            }
            
            updateAuthUI();
            console.log('👋 User signed out');
        }
    });
}

// Sign in with Google
async function signIn() {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log('User signed in:', result.user);
    } catch (error) {
        console.error('Sign-in error:', error);
        showError('Failed to sign in. Please try again.');
    }
}

// Sign out user
async function signOut() {
    try {
        await firebaseSignOut(auth);
        console.log('User signed out');
    } catch (error) {
        console.error('Sign-out error:', error);
        showError('Failed to sign out. Please try again.');
    }
}

// Update UI based on auth state
function updateAuthUI() {
    const authButton = document.getElementById('authButton');
    const userInfo = document.getElementById('userInfo');

    if (currentUser) {
        if (authButton) {
            authButton.textContent = 'Sign Out';
            authButton.onclick = signOut;
        }
        if (userInfo) {
            userInfo.style.display = 'block';
            userInfo.innerHTML = `
                <div class="user-profile">
                    <img src="${currentUser.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23667eea"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="16">${(currentUser.displayName || currentUser.email).charAt(0).toUpperCase()}</text></svg>'}" alt="Profile" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">
                    <span>Welcome, ${currentUser.displayName || currentUser.email}!</span>
                </div>
            `;
        }
        updateUsageDisplay();
    } else {
        if (authButton) {
            authButton.textContent = 'Sign In with Google';
            authButton.onclick = signIn;
        }
        if (userInfo) {
            userInfo.style.display = 'none';
        }
    }
}

// Usage tracking functions
function canGenerateAd() {
    if (!currentUser) {
        return false;
    }
    if (currentUser.subscriptionStatus === 'premium') {
        return true;
    }
    return currentUser.usageCount < currentUser.maxUsage;
}

function incrementAdUsage() {
    if (!currentUser) return;

    currentUser.usageCount += 1;
    currentUser.adsGenerated += 1;

    if (currentUser) {
        saveUserData(currentUser);
    }
    updateUsageDisplay();
}

function updateUsageDisplay() {
    const usageEl = document.getElementById('usageCount');
    if (usageEl && currentUser) {
        if (currentUser.subscriptionStatus === 'premium') {
            usageEl.textContent = 'Unlimited ads (Premium)';
        } else {
            const remaining = currentUser.maxUsage - currentUser.usageCount;
            usageEl.textContent = `${remaining} ads remaining`;
        }
    }
}

// User data management
function saveUserData(userData) {
    currentUser = userData;
    localStorage.setItem('userData', JSON.stringify(userData));
    syncUserDataWithServer(userData);
}

async function syncUserData(userData) {
    try {
        const response = await fetch('/sync-user-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('User data synced:', result);
        }
    } catch (error) {
        console.error('Failed to sync user data:', error);
    }
}

async function syncUserDataWithServer(userData) {
    try {
        const response = await fetch('/sync-user-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const serverData = await response.json();
            currentUser = { ...currentUser, ...serverData };
            localStorage.setItem('userData', JSON.stringify(currentUser));
        }
    } catch (error) {
        console.error('Failed to sync user data:', error);
    }
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
    syncAdWithServer(adToSave);
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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    await initializeFirebase();
    initAuth();
});

// Export for global access
window.currentUser = () => currentUser;
window.signIn = signIn;
window.signOut = signOut;
window.updateAuthUI = updateAuthUI;
window.canGenerateAd = canGenerateAd;
window.incrementAdUsage = incrementAdUsage;
window.saveAd = saveAd;
window.showLoginModal = showLoginModal;