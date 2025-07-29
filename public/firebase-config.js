
// Firebase configuration and authentication
let currentUser = null;
let firebaseConfig = {};

// Initialize Firebase when config is loaded
async function initializeFirebase() {
    let retries = 0;
    const maxRetries = 50;

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

    console.log('🔧 Using Firebase authentication with Google OAuth');

    const currentDomain = window.location.hostname;
    console.log(`🔧 Current domain: ${currentDomain}`);

    firebaseConfig = {
        apiKey: window.CONFIG.FIREBASE_API_KEY,
        authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN,
        projectId: window.CONFIG.FIREBASE_PROJECT_ID,
        appId: window.CONFIG.FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
    };

    // For development domains
    if (currentDomain.includes('replit.dev') || currentDomain.includes('replit.co')) {
        console.log('🔧 Development domain detected, configuring for Replit');
        if (!firebaseConfig.authDomain.includes('firebaseapp.com')) {
            firebaseConfig.authDomain = firebaseConfig.authDomain || `${firebaseConfig.projectId}.firebaseapp.com`;
        }
    }

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

            if (!firebase.apps || firebase.apps.length === 0) {
                const app = firebase.initializeApp(firebaseConfig);
                console.log('✅ Firebase initialized', app.name);
            } else {
                console.log('✅ Firebase already initialized');
            }

            if (firebase.firestore) {
                window.db = firebase.firestore();
                console.log('✅ Firestore initialized');
            } else {
                console.warn('Firestore not available');
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
                displayName: user.displayName || user.email?.split('@')[0] || `User_${user.uid.slice(-6)}`,
                email: user.email || 'no-email@example.com',
                photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email?.split('@')[0] || 'User')}&background=random`,
                usageCount: 0,
                maxUsage: 4,
                subscriptionStatus: 'free',
                isAnonymous: false,
                provider: 'google'
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
            document.getElementById('results')?.innerHTML = '';
        }
    });
}

function showLoginScreen() {
    console.log('🔑 Showing login screen');

    const mainContent = document.querySelector('.main-content');
    const examplesSection = document.querySelector('.examples-section');
    const testimonialsSection = document.querySelector('.testimonials-section');

    if (mainContent) mainContent.style.display = 'none';
    if (examplesSection) examplesSection.style.display = 'none';
    if (testimonialsSection) testimonialsSection.style.display = 'none';

    showLoginRequiredModal();
}

function hideLoginScreen() {
    console.log('✅ Hiding login screen, showing main content');

    const mainContent = document.querySelector('.main-content');
    const examplesSection = document.querySelector('.examples-section');
    const testimonialsSection = document.querySelector('.testimonials-section');

    if (mainContent) mainContent.style.display = 'block';
    if (examplesSection) examplesSection.style.display = 'block';
    if (testimonialsSection) testimonialsSection.style.display = 'block';

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
                    background: white;
                    color: #333;
                    border: 2px solid #dadce0;
                    padding: 18px 30px;
                    border-radius: 12px;
                    font-size: 1.2rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    min-width: 280px;
                " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.15)'; this.style.borderColor='#4285f4'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.1)'; this.style.borderColor='#dadce0'">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                </button>
                <p style="color: #999; font-size: 1rem; margin-top: 15px;">
                    🔒 Secure Google authentication • Your data is protected
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
    console.log('🔑 Google sign in function called');

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
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        console.log('🔑 Starting Google OAuth sign in...');

        const result = await firebase.auth().signInWithPopup(provider);

        if (result.user) {
            console.log('✅ Google sign in successful:', {
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName
            });
        }

        const loginModal = document.getElementById('loginRequiredModal');
        if (loginModal) {
            loginModal.style.display = 'none';
        }

    } catch (error) {
        console.error('Google sign in error:', error);

        if (error.code === 'auth/popup-blocked') {
            try {
                console.log('Popup blocked, trying redirect method...');
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('email');
                provider.addScope('profile');
                await firebase.auth().signInWithRedirect(provider);
            } catch (redirectError) {
                console.error('Redirect sign-in also failed:', redirectError);
                showError('Sign-in popup was blocked. Please allow popups for this site or try again.');
            }
        } else if (error.code === 'auth/popup-closed-by-user') {
            console.log('User cancelled Google sign in');
        } else if (error.code === 'auth/network-request-failed') {
            showError('Network error. Please check your internet connection and try again.');
        } else if (error.code === 'auth/operation-not-allowed') {
            showError('Google authentication is not enabled. Please enable it in Firebase Console.');
        } else if (error.code === 'app/no-app') {
            showError('Firebase app not initialized. Please refresh the page.');
        } else {
            showError('Google sign in failed: ' + error.message);
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

makeGloballyAvailable();

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing Firebase...');
    initializeFirebase();
});
