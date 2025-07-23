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
    // Get Google Client ID from config
    if (!window.CONFIG || !window.CONFIG.GOOGLE_CLIENT_ID) {
        console.error('Google Client ID not configured');
        return;
    }

    console.log('Initializing Google Auth with Client ID:', window.CONFIG.GOOGLE_CLIENT_ID.substring(0, 20) + '...');

    // Use Google Identity Services for popup-based sign-in
    if (window.google && window.google.accounts) {
        console.log('Using Google Identity Services');
        try {
            // Initialize for popup-based sign-in
            window.google.accounts.id.initialize({
                client_id: window.CONFIG.GOOGLE_CLIENT_ID,
                callback: handleGoogleResponse,
                auto_select: false,
                cancel_on_tap_outside: false
            });

            console.log('Google Identity Services initialized successfully');

        } catch (error) {
            console.error('Google Identity Services initialization failed:', error);
        }
    } else {
        console.error('Google Identity Services not available');
        setTimeout(initGoogleAuth, 1000); // Retry after 1 second
    }
}

function fallbackToLegacyAuth() {
    gapi.load('auth2', function() {
        gapi.auth2.init({
            client_id: window.CONFIG.GOOGLE_CLIENT_ID
        }).then(function() {
            console.log('Legacy Google Auth initialized');
            const authInstance = gapi.auth2.getAuthInstance();

            // Check if user is already signed in
            if (authInstance.isSignedIn.get()) {
                handleGoogleSignIn(authInstance.currentUser.get());
            }
        }).catch(function(error) {
            console.error('Google Auth initialization failed:', error);
        });
    });
}

// Handle new Google Identity Services response
function handleGoogleResponse(response) {
    try {
        const responsePayload = decodeJwtResponse(response.credential);

        const userData = {
            id: responsePayload.sub,
            name: responsePayload.name,
            email: responsePayload.email,
            picture: responsePayload.picture,
            provider: 'google',
            loginTime: new Date().toISOString(),
            adsGenerated: 0,
            subscriptionStatus: 'free',
            usageCount: 0,
            maxUsage: 3
        };

        saveUserData(userData);
        updateUIForLoggedInUser();
        closeAuthModal();

    } catch (error) {
        console.error('Error handling Google response:', error);
        showError('Google sign-in failed. Please try again.');
    }
}

// Decode JWT response from Google Identity Services
function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function signInWithGoogle() {
    console.log('Sign in with Google clicked');

    if (!window.CONFIG || !window.CONFIG.GOOGLE_CLIENT_ID) {
        console.error('Google Client ID not configured');
        showError('Google sign-in is not configured properly.');
        return;
    }

    // Use Google Identity Services with popup
    if (window.google && window.google.accounts) {
        try {
            // Create a temporary callback for this sign-in attempt
            const tempCallback = (response) => {
                console.log('Google sign-in successful');
                handleGoogleResponse(response);
            };

            // Re-initialize with the callback for this session
            window.google.accounts.id.initialize({
                client_id: window.CONFIG.GOOGLE_CLIENT_ID,
                callback: tempCallback,
                auto_select: false
            });

            // Show the popup
            window.google.accounts.id.prompt((notification) => {
                console.log('Prompt notification:', notification);
                if (notification.isNotDisplayed()) {
                    console.log('Prompt not displayed, showing manual sign-in');
                    showError('Please allow popups for this site and try again.');
                }
                if (notification.isSkippedMoment()) {
                    console.log('User skipped the prompt');
                }
            });

        } catch (error) {
            console.error('Google sign-in error:', error);
            showError('Google sign-in failed. Please try again.');
        }
    } else {
        console.error('Google authentication not available');
        showError('Google sign-in is not available. Please refresh the page and try again.');
    }
}

function fallbackSignIn() {
    try {
        const authInstance = gapi.auth2.getAuthInstance();
        if (authInstance) {
            authInstance.signIn().then(function(googleUser) {
                handleGoogleSignIn(googleUser);
                closeAuthModal();
            }).catch(function(error) {
                console.error('Google sign-in error:', error);
                showError('Google sign-in failed. Please try again.');
            });
        } else {
            console.error('Google Auth instance not available');
            showError('Google sign-in is not ready. Please refresh the page and try again.');
        }
    } catch (error) {
        console.error('Fallback sign-in error:', error);
        showError('Google sign-in failed. Please try again.');
    }
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

function signOut() {
    if (currentUser?.provider === 'google') {
        const authInstance = gapi.auth2.getAuthInstance();
        if (authInstance) {
            authInstance.signOut();
        }
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

// Load auth libraries when page loads
function loadAuthLibraries() {
    // Wait for config to load before initializing Google Auth
    const checkConfig = () => {
        if (window.CONFIG && window.CONFIG.GOOGLE_CLIENT_ID) {
            console.log('Loading Google Auth libraries...');

            // Load Google Identity Services only (modern approach)
            const gisScript = document.createElement('script');
            gisScript.src = 'https://accounts.google.com/gsi/client';
            gisScript.async = true;
            gisScript.defer = true;
            gisScript.onload = () => {
                console.log('Google Identity Services loaded');
                // Wait longer for the library to fully initialize on Vercel
                setTimeout(() => {
                    // Check if the library is properly loaded
                    if (window.google && window.google.accounts && window.google.accounts.id) {
                        initGoogleAuth();
                    } else {
                        console.log('Google library not ready, retrying...');
                        setTimeout(initGoogleAuth, 1000);
                    }
                }, 1000);
            };
            gisScript.onerror = (error) => {
                console.error('Failed to load Google Identity Services:', error);
                showError('Failed to load Google authentication. Please refresh the page.');
            };
            document.head.appendChild(gisScript);
        } else {
            console.log('Waiting for config to load...');
            setTimeout(checkConfig, 200);
        }
    };
    checkConfig();
}

// Load auth libraries when page loads
loadAuthLibraries();