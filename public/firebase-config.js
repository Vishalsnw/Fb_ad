// firebase-config-fixed.js

let currentUser = null;
let firebaseConfig = {};

async function initializeFirebase() {
  let retries = 0;
  const maxRetries = 50;

  while (!window.CONFIG && retries < maxRetries) {
    console.log(`Waiting for config to load... (${retries + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  if (!window.CONFIG) {
    console.error('❌ Config failed to load after timeout');
    showError('Configuration failed to load. Please refresh the page.');
    return;
  }

  if (!window.CONFIG.FIREBASE_API_KEY) {
    console.warn('⚠️ Firebase config missing');
    showError('Firebase not configured. Please set up credentials.');
    return;
  }

  firebaseConfig = {
    apiKey: window.CONFIG.FIREBASE_API_KEY,
    authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN,
    projectId: window.CONFIG.FIREBASE_PROJECT_ID,
    appId: window.CONFIG.FIREBASE_APP_ID || '1:123456789:web:abcdef123456'
  };

  try {
    let firebaseRetries = 0;
    while (typeof firebase === 'undefined' && firebaseRetries < 50) {
      console.log(`Waiting for Firebase SDK... (${firebaseRetries + 1}/50)`);
      await new Promise(resolve => setTimeout(resolve, 200));
      firebaseRetries++;
    }

    if (typeof firebase !== 'undefined') {
      console.log('✅ Firebase SDK loaded');

      if (!firebase.apps?.length) {
        const app = firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase initialized:', app.name);
      } else {
        console.log('ℹ️ Firebase already initialized');
      }

      if (firebase.firestore) {
        window.db = firebase.firestore();
        console.log('✅ Firestore initialized');
      } else {
        console.warn('❌ Firestore not available');
      }

      setupAuthListener();
    } else {
      console.error('❌ Firebase SDK not found');
      showError('Firebase failed to load. Check connection or try again.');
    }
  } catch (error) {
    console.error('🔥 Firebase init error:', error.message);
    showError(`Firebase Error: ${error.message}`);
  }
}

function setupAuthListener() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.error('Firebase Auth not available - authentication required');
    showError('Authentication service not available. Please refresh the page.');
    return;
  }

  firebase.auth().onAuthStateChanged(async user => {
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
      const resultsEl = document.getElementById('results');
      if (resultsEl) resultsEl.innerHTML = '';
    }
  });
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

function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  firebase.auth().signInWithPopup(provider)
    .then(result => {
      if (result.user) {
        console.log('✅ Google sign in successful:', result.user.email);
        const loginModal = document.getElementById('loginRequiredModal');
        if (loginModal) loginModal.style.display = 'none';
      }
    })
    .catch(async error => {
      if (error.code === 'auth/popup-blocked') {
        console.log('Popup blocked, using redirect');
        await firebase.auth().signInWithRedirect(provider);
      } else {
        console.error('Google sign in error:', error);
        showError('Sign in failed: ' + error.message);
      }
    });
}

async function signOut() {
  try {
    await firebase.auth().signOut();
    console.log('✅ Sign out successful');
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

function showError(message) {
  let errorDiv = document.getElementById('auth-error');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'auth-error';
    errorDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#f44336;color:#fff;padding:15px;border-radius:5px;z-index:10000;max-width:300px';
    document.body.appendChild(errorDiv);
  }
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM loaded, initializing Firebase...');
  initializeFirebase();
});
