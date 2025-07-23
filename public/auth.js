
// Authentication and User Management
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
}

// Google Sign-In
function initGoogleAuth() {
    gapi.load('auth2', function() {
        gapi.auth2.init({
            client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
        }).then(function() {
            const authInstance = gapi.auth2.getAuthInstance();
            
            // Check if user is already signed in
            if (authInstance.isSignedIn.get()) {
                handleGoogleSignIn(authInstance.currentUser.get());
            }
        });
    });
}

function signInWithGoogle() {
    const authInstance = gapi.auth2.getAuthInstance();
    authInstance.signIn().then(function(googleUser) {
        handleGoogleSignIn(googleUser);
    }).catch(function(error) {
        console.error('Google sign-in error:', error);
        showError('Google sign-in failed. Please try again.');
    });
}

function handleGoogleSignIn(googleUser) {
    const profile = googleUser.getBasicProfile();
    const userData = {
        id: profile.getId(),
        name: profile.getName(),
        email: profile.getEmail(),
        picture: profile.getImageUrl(),
        provider: 'google',
        loginTime: new Date().toISOString(),
        adsGenerated: 0,
        subscriptionStatus: 'free',
        usageCount: 0,
        maxUsage: 3
    };
    
    saveUserData(userData);
    updateUIForLoggedInUser();
}

// Facebook Sign-In
function initFacebookAuth() {
    window.fbAsyncInit = function() {
        FB.init({
            appId: 'YOUR_FACEBOOK_APP_ID',
            cookie: true,
            xfbml: true,
            version: 'v18.0'
        });
        
        FB.getLoginStatus(function(response) {
            if (response.status === 'connected') {
                handleFacebookSignIn(response);
            }
        });
    };
}

function signInWithFacebook() {
    FB.login(function(response) {
        if (response.authResponse) {
            handleFacebookSignIn(response);
        } else {
            console.error('Facebook sign-in failed');
            showError('Facebook sign-in failed. Please try again.');
        }
    }, {scope: 'email,public_profile'});
}

function handleFacebookSignIn(response) {
    FB.api('/me', {fields: 'name,email,picture'}, function(profile) {
        const userData = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            picture: profile.picture.data.url,
            provider: 'facebook',
            loginTime: new Date().toISOString(),
            adsGenerated: 0,
            subscriptionStatus: 'free',
            usageCount: 0,
            maxUsage: 3
        };
        
        saveUserData(userData);
        updateUIForLoggedInUser();
    });
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
                    <button onclick="signInWithFacebook()" class="auth-btn facebook-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Continue with Facebook
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

function signOut() {
    if (currentUser?.provider === 'google') {
        const authInstance = gapi.auth2.getAuthInstance();
        authInstance.signOut();
    } else if (currentUser?.provider === 'facebook') {
        FB.logout();
    }
    
    currentUser = null;
    localStorage.removeItem('userData');
    localStorage.removeItem('savedAds');
    
    // Reset UI
    location.reload();
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

// Initialize authentication libraries
function loadAuthLibraries() {
    // Load Google API
    const googleScript = document.createElement('script');
    googleScript.src = 'https://apis.google.com/js/api.js';
    googleScript.onload = initGoogleAuth;
    document.head.appendChild(googleScript);
    
    // Load Facebook SDK
    const facebookScript = document.createElement('script');
    facebookScript.src = 'https://connect.facebook.net/en_US/sdk.js';
    facebookScript.onload = initFacebookAuth;
    document.head.appendChild(facebookScript);
}

// Load auth libraries when page loads
loadAuthLibraries();
