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
            if (!firebase.apps || firebase.apps.length === 0) {
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
                hideLoginScreen();
            } catch (error) {
                console.error('Failed to load user data:', error);
                showError('Failed to load user data. Please try signing in again.');
                await signOut();
            }
        } else {
            currentUser = null;
            console.log('User signed out');
            showLoginScreen();
            updateAuthUI();
            // Clear any cached data when user signs out
            document.getElementById('results')?.innerHTML = '';
        }
    });
}

function showLoginScreen() {
    console.log('🔑 Showing login screen');

    // Hide main content
    const mainContent = document.querySelector('.main-content');
    const examplesSection = document.querySelector('.examples-section');
    const testimonialsSection = document.querySelector('.testimonials-section');

    if (mainContent) mainContent.style.display = 'none';
    if (examplesSection) examplesSection.style.display = 'none';
    if (testimonialsSection) testimonialsSection.style.display = 'none';

    // Show login modal
    showLoginRequiredModal();
}

function hideLoginScreen() {
    console.log('✅ Hiding login screen, showing main content');

    // Show main content
    const mainContent = document.querySelector('.main-content');
    const examplesSection = document.querySelector('.examples-section');
    const testimonialsSection = document.querySelector('.testimonials-section');

    if (mainContent) mainContent.style.display = 'block';
    if (examplesSection) examplesSection.style.display = 'block';
    if (testimonialsSection) testimonialsSection.style.display = 'block';

    // Hide login modal
    const loginModal = document.getElementById('loginRequiredModal');
    if (loginModal) {
        loginModal.style.display = 'none';
    }
}

function showLoginRequiredModal() {
    console.log('🔑 Showing login required modal');

    let modal = document.getElementById('loginRequiredModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'loginRequiredModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 50px;
                border-radius: 20px;
                text-align: center;
                max-width: 600px;
                margin: 20px;
                box-shadow: 0 25px 70px rgba(0,0,0,0.4);
                transform: scale(0.9);
                animation: modalSlideIn 0.3s ease-out forwards;
            ">
                <div style="font-size: 5rem; margin-bottom: 30px; animation: bounce 2s infinite;">🚀</div>
                <h1 style="color: #333; margin-bottom: 20px; font-size: 2.5rem; font-weight: 800;">Welcome to Facebook Ad Generator!</h1>
                <p style="color: #666; font-size: 1.3rem; margin-bottom: 40px; line-height: 1.6;">
                    Create professional Facebook ads in Hindi or English using AI. Get started by signing in as a guest - no registration required!
                </p>
                <div style="background: #f8f9ff; padding: 25px; border-radius: 15px; margin-bottom: 35px;">
                    <h3 style="color: #667eea; margin-bottom: 15px; font-size: 1.4rem;">🎯 What You Get:</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                        <div>✅ 4 FREE professional ads</div>
                        <div>✅ AI-generated copy & images</div>
                        <div>✅ Hindi & English support</div>
                        <div>✅ Multiple ad formats</div>
                    </div>
                </div>
                <button onclick="signIn()" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 20px 50px;
                    border-radius: 15px;
                    font-size: 1.3rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
                    margin-bottom: 20px;
                " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 35px rgba(102, 126, 234, 0.6)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 25px rgba(102, 126, 234, 0.4)'">🔑 Start Creating Ads (Sign In as Guest)</button>
                <p style="color: #999; font-size: 1rem; margin-top: 15px;">
                    ⚡ No registration required • Start in 5 seconds
                </p>
            </div>
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalSlideIn {
                    from { transform: scale(0.9) translateY(-30px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-15px); }
                    60% { transform: translateY(-8px); }
                }
            </style>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
}

async function signIn() {
    console.log('🔑 Sign in function called');

    // Wait for Firebase to be ready
    let retries = 0;
    while (typeof firebase === 'undefined' && retries < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }

    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not available after waiting');
        showError('Authentication service is not loaded. Please refresh the page.');
        return;
    }

    if (!firebase.auth) {
        console.error('Firebase Auth not available');
        showError('Authentication service is not available. Please refresh the page.');
        return;
    }

    try {
        // For demo purposes, sign in anonymously
        console.log('🔑 Starting anonymous sign in...');
        const result = await firebase.auth().signInAnonymously();

        // Set a display name for anonymous users
        if (result.user) {
            await result.user.updateProfile({
                displayName: `User_${Date.now().toString().slice(-6)}`
            });

            console.log('✅ Anonymous sign in successful:', result.user.uid);
        }

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
        } else if (error.code === 'app/no-app') {
            showError('Firebase app not initialized. Please refresh the page.');
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
        throw new Error('User not authenticated or database not available');
    }

    const adToSave = {
        id: Date.now().toString(),
        userId: currentUser.uid,
        productName: adData.productName || '',
        productDescription: adData.productDescription || '',
        targetAudience: adData.targetAudience || '',
        specialOffer: adData.specialOffer || '',
        language: adData.language || 'English',
        tone: adData.tone || 'professional',
        adFormat: adData.adFormat || 'facebook-feed',
        businessType: adData.businessType || '',
        adCopy: adData.adCopy || '',
        imageUrl: imageUrl || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Save to Firestore ads collection
        await window.db.collection('ads').doc(adToSave.id).set(adToSave);
        console.log('✅ Ad saved to Firestore:', adToSave.id);
        return adToSave;
    } catch (error) {
        console.error('Failed to save ad to Firestore:', error);
        throw error;
    }
}

async function loadUserAds(uid) {
    if (!window.db) {
        console.warn('Firestore not available');
        return [];
    }

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

        console.log(`✅ Loaded ${ads.length} ads from Firestore for user ${uid}`);
        return ads;
    } catch (error) {
        console.error('Failed to load ads from Firestore:', error);
        return [];
    }
}

// Enhanced user settings management
async function saveUserSettings(uid, settings) {
    if (!window.db) {
        console.error('Firestore not available');
        return false;
    }

    try {
        await window.db.collection('user_settings').doc(uid).set({
            ...settings,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('✅ User settings saved to Firestore');
        return true;
    } catch (error) {
        console.error('Failed to save user settings:', error);
        return false;
    }
}

async function loadUserSettings(uid) {
    if (!window.db) {
        console.warn('Firestore not available');
        return {};
    }

    try {
        const settingsDoc = await window.db.collection('user_settings').doc(uid).get();
        if (settingsDoc.exists) {
            console.log('✅ User settings loaded from Firestore');
            return settingsDoc.data();
        } else {
            console.log('📝 No existing settings for user, returning defaults');
            return {};
        }
    } catch (error) {
        console.error('Failed to load user settings:', error);
        return {};
    }
}

// Payment history management
async function savePaymentRecord(uid, paymentData) {
    if (!window.db) {
        console.error('Firestore not available');
        return false;
    }

    try {
        const paymentRecord = {
            userId: uid,
            ...paymentData,
            createdAt: new Date().toISOString()
        };

        await window.db.collection('payments').add(paymentRecord);
        console.log('✅ Payment record saved to Firestore');
        return true;
    } catch (error) {
        console.error('Failed to save payment record:', error);
        return false;
    }
}

async function loadPaymentHistory(uid) {
    if (!window.db) {
        console.warn('Firestore not available');
        return [];
    }

    try {
        const paymentsSnapshot = await window.db.collection('payments')
            .where('userId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const payments = [];
        paymentsSnapshot.forEach(doc => {
            payments.push({ id: doc.id, ...doc.data() });
        });

        console.log(`✅ Loaded ${payments.length} payment records from Firestore`);
        return payments;
    } catch (error) {
        console.error('Failed to load payment history:', error);
        return [];
    }
}

// Make functions globally available
function makeGloballyAvailable() {
    window.currentUser = () => currentUser;
    window.signIn = signIn;
    window.signOut = signOut;
    window.canGenerateAd = canGenerateAd;
    window.incrementAdUsage = incrementAdUsage;
    window.saveUserData = saveUserData;
    window.showLoginModal = showLoginModal;
    window.saveAd = saveAd;
    window.loadUserAds = loadUserAds;
    window.saveUserSettings = saveUserSettings;
    window.loadUserSettings = loadUserSettings;
    window.savePaymentRecord = savePaymentRecord;
    window.loadPaymentHistory = loadPaymentHistory;

    console.log('✅ Firebase functions made globally available');
}

// Call the function to make them available
makeGloballyAvailable();

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing Firebase...');
    initializeFirebase();
});