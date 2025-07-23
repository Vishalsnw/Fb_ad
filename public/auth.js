// Simple authentication system without Firebase
let currentUser = null;

// Mock user data structure
function createMockUser(email, name) {
    return {
        uid: 'user_' + Date.now(),
        email: email,
        displayName: name,
        photoURL: null
    };
}

// Initialize auth system
function initAuth() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('userData');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateAuthUI();
        } catch (error) {
            console.error('Error loading saved user:', error);
            localStorage.removeItem('userData');
        }
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
                    <span>Welcome, ${currentUser.displayName || currentUser.email}!</span>
                </div>
            `;
        }
    } else {
        if (authButton) {
            authButton.textContent = 'Sign In';
            authButton.onclick = showSignInForm;
        }
        if (userInfo) {
            userInfo.style.display = 'none';
        }
    }
}

// Show sign in form
function showSignInForm() {
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.innerHTML = `
        <div class="auth-modal-content">
            <h2>Sign In</h2>
            <form id="signInForm">
                <input type="email" id="email" placeholder="Email" required>
                <input type="text" id="name" placeholder="Your Name" required>
                <button type="submit">Sign In</button>
                <button type="button" onclick="closeAuthModal()">Cancel</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('signInForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const name = document.getElementById('name').value;

        if (email && name) {
            signIn(email, name);
            closeAuthModal();
        }
    });
}

// Close auth modal
function closeAuthModal() {
    const modal = document.querySelector('.auth-modal');
    if (modal) {
        modal.remove();
    }
}

// Sign in user
async function signIn(email, name) {
    try {
        currentUser = createMockUser(email, name);
        localStorage.setItem('userData', JSON.stringify(currentUser));
        updateAuthUI();

        // Sync user data with server
        await syncUserData(currentUser);

        console.log('User signed in:', currentUser);
    } catch (error) {
        console.error('Sign-in error:', error);
        alert('Failed to sign in. Please try again.');
    }
}

// Sign out user
async function signOut() {
    try {
        currentUser = null;
        localStorage.removeItem('userData');
        localStorage.removeItem('savedAds');
        updateAuthUI();
        console.log('User signed out');
    } catch (error) {
        console.error('Sign-out error:', error);
        alert('Failed to sign out. Please try again.');
    }
}

// Sync user data with server
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

// Initialize auth when page loads
document.addEventListener('DOMContentLoaded', function() {
    initAuth();
});

// Export for global access
window.currentUser = currentUser;
window.signIn = signIn;
window.signOut = signOut;
window.updateAuthUI = updateAuthUI;

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

	//check if currentUser exists before saving
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

// UI Updates
function updateUIForLoggedInUser() {
	// This function is replaced by updateAuthUI
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
                    <button onclick="showSignInForm()" class="auth-btn google-btn">
                        Continue with Mock Sign In
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';
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
        userId: currentUser.uid,
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
    const userAds = savedAds.filter(ad => ad.userId === currentUser.uid);

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
window.showSignInForm = showSignInForm;
window.closeAuthModal = closeAuthModal;
window.saveAd = saveAd;
window.loadSavedAd = loadSavedAd;
window.canGenerateAd = canGenerateAd;
window.incrementAdUsage = incrementAdUsage;
window.showLoginModal = showLoginModal;