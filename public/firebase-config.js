
// Firebase Configuration and Authentication

let currentUser = null;
let firebaseConfig = {};
let initializationAttempted = false;

// Make functions globally available immediately
window.signIn = signIn;
window.signOut = signOut;
window.currentUser = () => currentUser;

async function initializeFirebase() {
  if (initializationAttempted || window.firebaseInitialized) {
    console.log('🔄 Firebase initialization already attempted, skipping...');
    return;
  }
  
  initializationAttempted = true;
  window.firebaseInitialized = true;
  console.log('🚀 Starting Firebase initialization...');
  
  // Wait for config to load
  let retries = 0;
  const maxRetries = 50;

  while (!window.CONFIG && retries < maxRetries) {
    console.log(`⏳ Waiting for config... (${retries + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  if (!window.CONFIG) {
    console.error('❌ Config failed to load after timeout');
    showError('Configuration failed to load. Please refresh the page.');
    return;
  }

  console.log('✅ Config loaded, checking Firebase keys...');

  if (!window.CONFIG.FIREBASE_API_KEY) {
    console.error('❌ Firebase API key missing');
    showError('Firebase not configured. Please set up credentials.');
    return;
  }

  // Set up Firebase config
  firebaseConfig = {
    apiKey: window.CONFIG.FIREBASE_API_KEY,
    authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN || `${window.CONFIG.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: window.CONFIG.FIREBASE_PROJECT_ID,
    appId: window.CONFIG.FIREBASE_APP_ID || '1:123456789:web:abcdef123456'
  };

  console.log('🔧 Firebase config prepared:', {
    hasApiKey: !!firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId
  });

  try {
    // Wait for Firebase SDK to be available
    let firebaseRetries = 0;
    while (typeof firebase === 'undefined' && firebaseRetries < 50) {
      console.log(`⏳ Waiting for Firebase SDK... (${firebaseRetries + 1}/50)`);
      await new Promise(resolve => setTimeout(resolve, 200));
      firebaseRetries++;
    }

    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK failed to load');
      showError('Firebase SDK failed to load. Please refresh the page.');
      return;
    }

    console.log('✅ Firebase SDK loaded successfully');

    // Initialize Firebase
    if (!firebase.apps || firebase.apps.length === 0) {
      const app = firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase app initialized:', app.name);
    } else {
      console.log('ℹ️ Firebase already initialized');
    }

    // Set authentication persistence to LOCAL (persist across browser sessions)
    if (firebase.auth) {
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      console.log('✅ Authentication persistence set to LOCAL');
    }

    // Initialize Firestore
    if (firebase.firestore) {
      window.db = firebase.firestore();
      console.log('✅ Firestore initialized');
    } else {
      console.warn('⚠️ Firestore not available');
    }

    // Set up authentication
    setupAuthListener();
    
    console.log('✅ Firebase initialization complete');

  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    showError(`Firebase Error: ${error.message}`);
  }
}

function setupAuthListener() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.error('❌ Firebase Auth not available');
    showError('Authentication service not available. Please refresh the page.');
    return;
  }

  console.log('🔐 Setting up authentication listener...');

  firebase.auth().onAuthStateChanged(async user => {
    console.log('🔄 Auth state changed:', !!user);
    
    if (user) {
      console.log('✅ User authenticated:', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified
      });

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
        
        // Store auth state in sessionStorage as backup
        sessionStorage.setItem('firebase_auth_user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        }));
        
      } catch (error) {
        console.error('❌ Failed to load user data:', error);
        showError('Failed to load user data. Please try signing in again.');
        await signOut();
      }
    } else {
      currentUser = null;
      console.log('ℹ️ User signed out');
      
      // Clear backup auth state
      sessionStorage.removeItem('firebase_auth_user');
      
      showLoginScreen();
      updateAuthUI();
      const resultsEl = document.getElementById('results');
      if (resultsEl) resultsEl.innerHTML = '';
    }
  });
}

async function signIn() {
  console.log('🔑 Google sign in function called');
  
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.error('❌ Firebase not ready for sign in');
    showError('Authentication service is loading. Please wait and try again.');
    return;
  }

  try {
    console.log('🔑 Starting Google OAuth sign in...');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await firebase.auth().signInWithPopup(provider);
    
    if (result.user) {
      console.log('✅ Google sign in successful:', result.user.email);
      const loginModal = document.getElementById('loginRequiredModal');
      if (loginModal) loginModal.style.display = 'none';
    }
  } catch (error) {
    console.error('❌ Google sign in error:', error);
    
    if (error.code === 'auth/popup-blocked') {
      console.log('🔄 Popup blocked, trying redirect...');
      try {
        await firebase.auth().signInWithRedirect(provider);
      } catch (redirectError) {
        console.error('❌ Redirect sign in also failed:', redirectError);
        showError('Sign in failed. Please allow popups or try again.');
      }
    } else {
      showError(`Sign in failed: ${error.message}`);
    }
  }
}

async function signOut() {
  try {
    if (firebase.auth) {
      await firebase.auth().signOut();
      console.log('✅ Sign out successful');
    }
  } catch (error) {
    console.error('❌ Sign out error:', error);
  }
}

function showLoginScreen() {
  const sections = ['.main-content', '.examples-section', '.testimonials-section'];
  sections.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  });
  showLoginRequiredModal();
}

function hideLoginScreen() {
  const sections = ['.main-content', '.examples-section', '.testimonials-section'];
  sections.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'block';
  });
  const loginModal = document.getElementById('loginRequiredModal');
  if (loginModal) loginModal.style.display = 'none';
}

function showError(message) {
  console.error('🚨 Error:', message);
  
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
      font-family: Arial, sans-serif;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(errorDiv);
  }
  
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  setTimeout(() => {
    if (errorDiv) errorDiv.style.display = 'none';
  }, 5000);
}

// Stub functions for compatibility
function updateAuthUI() {
  // This function should be implemented in the main script
  if (typeof window.updateAuthUI === 'function') {
    window.updateAuthUI();
  }
}

function showLoginRequiredModal() {
  // This function should be implemented in the main script
  if (typeof window.showLoginRequiredModal === 'function') {
    window.showLoginRequiredModal();
  }
}

async function loadUserDataFromServer(uid) {
  // This function should be implemented in the main script
  if (typeof window.loadUserDataFromServer === 'function') {
    return await window.loadUserDataFromServer(uid);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM loaded, initializing Firebase...');
  initializeFirebase();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
  console.log('📄 DOM still loading, waiting...');
} else {
  console.log('📄 DOM already loaded, initializing Firebase immediately...');
  initializeFirebase();
}

console.log('✅ Firebase functions made globally available');
