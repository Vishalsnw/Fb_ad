// Firebase Authentication and User Management
import { auth, googleProvider, signInWithPopup, firebaseSignOut, onAuthStateChanged } from './firebase-config.js';

let currentUser = null;

// Initialize authentication when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    loadUserData();
});

function initializeAuth() {
    // Check if user is already logged in
    const userData = localStorage.getItem('userData');
    if (userData) {
        currentUser = JSON.parse(userData);
        updateUIForLoggedInUser();
    }

    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('User signed in:', user);
            handleFirebaseUser(user);
        } else {
            console.log('User signed out');
            currentUser = null;
            localStorage.removeItem('userData');
        }
    });
}

// Handle Firebase user data
function handleFirebaseUser(user) {
    const userData = {
        id: user.uid,
        name: user.displayName || 'User',
        email: user.email,
        picture: user.photoURL || '',
        provider: 'firebase-google',
        loginTime: new Date().toISOString(),
        adsGenerated: 0,
        subscriptionStatus: 'free',
        usageCount: 0,
        maxUsage: 3
    };

    saveUserData(userData);
    updateUIForLoggedInUser();
    closeAuthModal();
}

// Sign in with Google using Firebase
async function signInWithGoogle() {
    console.log('Firebase Google sign-in clicked');

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        console.log('Firebase sign-in successful:', user);

        // Firebase will automatically trigger onAuthStateChanged
        // which will handle the user data

    } catch (error) {
        console.error('Firebase sign-in error:', error);

        // Handle specific error cases
        if (error.code === 'auth/popup-closed-by-user') {
            showError('Sign-in was cancelled. Please try again.');
        } else if (error.code === 'auth/popup-blocked') {
            showError('Popup was blocked by your browser. Please allow popups and try again.');
        } else {
            showError('Sign-in failed. Please try again.');
        }
    }
}

// Sign out function
async function signOut() {
    try {
        await firebaseSignOut(auth);

        currentUser = null;
        localStorage.removeItem('userData');
        localStorage.removeItem('savedAds');

        // Reset UI
        location.reload();

    } catch (error) {
        console.error('Sign-out error:', error);
        showError('Failed to sign out. Please try again.');
    }
}

// User Data Management
function saveUserData(userData) {
    currentUser = userData;
    localStorage.setItem('userData', JSON.stringify(userData));

    // Also sync with server
    syncUserDataWithServer(userData);
}

function loadUserData() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        currentUser = JSON.parse(userData);
        return currentUser;
    }
    return null;
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
            // Update local data with server data
            currentUser = { ...currentUser, ...serverData };
            localStorage.setItem('userData', JSON.stringify(currentUser));
        }
    } catch (error) {
        console.error('Failed to sync user data:', error);
    }
}

// Usage Tracking
function canGenerateAd() {
    if (!currentUser) {
        return false; // Must be logged in
    }

    if (currentUser.subscriptionStatus === 'premium') {
        return true; // Unlimited for premium users
    }

    return currentUser.usageCount < currentUser.maxUsage;
}

function incrementAdUsage() {
    if (!currentUser) return;

    currentUser.usageCount += 1;
    currentUser.adsGenerated += 1;
    saveUserData(currentUser);
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

// UI Updates
function updateUIForLoggedInUser() {
    if (!currentUser) return;

    // Update user profile display
    const userProfile = document.getElementById('userProfile');
    if (userProfile) {
        userProfile.innerHTML = `
            <div class="user-info">
                <img src="${currentUser.picture}" alt="Profile" class="profile-pic">
                <div class="user-details">
                    <span class="user-name">${currentUser.name}</span>
                    <span class="user-email">${currentUser.email}</span>
                    <span class="subscription-badge ${currentUser.subscriptionStatus}">${currentUser.subscriptionStatus}</span>
                </div>
                <button onclick="signOut()" class="sign-out-btn">Sign Out</button>
            </div>
        `;
        userProfile.style.display = 'block';
    }

    // Hide login buttons
    const loginSection = document.getElementById('loginSection');
    if (loginSection) {
        loginSection.style.display = 'none';
    }

    // Show saved ads section
    loadSavedAds();
    updateUsageDisplay();
}

function showPaymentModal() {
    if (!currentUser) {
        showLoginModal();
        return;
    }

    // Your existing payment modal code
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function showLoginModal() {
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.innerHTML = `
        <div class="auth-modal-content">
            <div class="auth-modal-header">
                <h2>Sign In to Continue</h2>
                <button class="close-modal" onclick="closeAuthModal()">&times;</button>
            </div>
            <div class="auth-modal-body">
                <p>Please sign in to generate ads and track your usage.</p>
                <div class="auth-buttons">
                    <button onclick="signInWithGoogle()" class="auth-btn google-btn">
                        <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google">
                        Continue with Google
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';
}

function closeAuthModal() {
    const modal = document.querySelector('.auth-modal');
    if (modal) {
        modal.remove();
    }
}

function showError(message) {
    // Create or update error display
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

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }, 5000);
}

// Saved Ads Management
function saveAd(adData, imageUrl) {
    if (!currentUser) return;

    const savedAds = JSON.parse(localStorage.getItem('savedAds') || '[]');
    const adToSave = {
        id: Date.now(),
        userId: currentUser.id,
        ...adData,
        imageUrl,
        createdAt: new Date().toISOString()
    };

    savedAds.unshift(adToSave);
    localStorage.setItem('savedAds', JSON.stringify(savedAds.slice(0, 50))); // Keep last 50 ads

    // Sync with server
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

function loadSavedAds() {
    if (!currentUser) return;

    const savedAds = JSON.parse(localStorage.getItem('savedAds') || '[]');
    const userAds = savedAds.filter(ad => ad.userId === currentUser.id);

    const savedAdsContainer = document.getElementById('savedAdsContainer');
    if (savedAdsContainer && userAds.length > 0) {
        savedAdsContainer.innerHTML = `
            <h3>Your Saved Ads (${userAds.length})</h3>
            <div class="saved-ads-grid">
                ${userAds.slice(0, 10).map(ad => `
                    <div class="saved-ad-card">
                        <h4>${ad.headline || 'Untitled Ad'}</h4>
                        <p>${(ad.adText || '').substring(0, 100)}...</p>
                        <div class="ad-meta">
                            <span>${new Date(ad.createdAt).toLocaleDateString()}</span>
                            <button onclick="loadSavedAd('${ad.id}')" class="load-ad-btn">Load</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        savedAdsContainer.style.display = 'block';
    }
}

function loadSavedAd(adId) {
    const savedAds = JSON.parse(localStorage.getItem('savedAds') || '[]');
    const ad = savedAds.find(a => a.id == adId);

    if (ad) {
        // Load the ad data into the current preview
        currentAdData = {
            headline: ad.headline,
            adText: ad.adText,
            cta: ad.cta
        };
        currentImageUrl = ad.imageUrl;

        const formData = getFormData();
        updateAdPreview(currentAdData, currentImageUrl, formData.adFormat);

        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
    }
}

// Make functions available globally
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.showLoginModal = showLoginModal;
window.closeAuthModal = closeAuthModal;
window.saveAd = saveAd;
window.loadSavedAd = loadSavedAd;
window.canGenerateAd = canGenerateAd;
window.incrementAdUsage = incrementAdUsage;