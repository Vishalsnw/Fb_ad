let currentUser = null;
let firebaseConfig = {};
let initializationAttempted = false;

window.signIn = signIn;
window.signOut = signOut;
window.currentUser = () => currentUser;

async function initializeFirebase() {
  if (initializationAttempted || window.firebaseInitialized) return;

  initializationAttempted = true;
  window.firebaseInitialized = true;
  console.log("🚀 Initializing Firebase...");

  let retries = 0;
  while (!window.CONFIG && retries < 50) {
    await new Promise(res => setTimeout(res, 100));
    retries++;
  }

  if (!window.CONFIG) return console.error("❌ Config load failed");

  firebaseConfig = {
    apiKey: window.CONFIG.FIREBASE_API_KEY,
    authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN || `${window.CONFIG.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: window.CONFIG.FIREBASE_PROJECT_ID,
    appId: window.CONFIG.FIREBASE_APP_ID
  };

  try {
    let sdkRetries = 0;
    while (typeof firebase === "undefined" && sdkRetries < 50) {
      await new Promise(res => setTimeout(res, 200));
      sdkRetries++;
    }

    if (!firebase) return console.error("❌ Firebase SDK not loaded");

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    if (firebase.auth) await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    if (firebase.firestore) window.db = firebase.firestore();

    setupAuthListener();
  } catch (err) {
    console.error("❌ Firebase Init Error:", err);
  }
}

function setupAuthListener() {
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random`,
        isAnonymous: user.isAnonymous,
        provider: 'google'
      };

      sessionStorage.setItem('firebase_auth_user', JSON.stringify(currentUser));

      updateAuthUI();
      hideLoginScreen();

      // 🔄 Automatically redirect logged in user from login page to dashboard
      if (window.location.pathname.includes('index.html') || window.location.pathname === "/") {
        window.location.href = "/dashboard.html";
      }

    } else {
      currentUser = null;
      sessionStorage.removeItem('firebase_auth_user');
      updateAuthUI();
      showLoginScreen();

      // 🚫 User not logged in, redirect from protected pages
      if (window.location.pathname.includes('dashboard.html')) {
        window.location.href = "/index.html";
      }
    }
  });
}

async function signIn() {
  if (!firebase.auth) return;

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebase.auth().signInWithPopup(provider);
  } catch (err) {
    if (err.code === 'auth/popup-blocked') {
      try {
        await firebase.auth().signInWithRedirect(provider);
      } catch (redirectErr) {
        console.error("❌ Redirect sign-in error:", redirectErr);
      }
    } else if (err.code === 'auth/popup-closed-by-user') {
      console.log("👤 User cancelled sign-in");
    } else {
      console.error("❌ Sign-in error:", err);
    }
  }
}

async function signOut() {
  try {
    await firebase.auth().signOut();
    console.log("👋 Signed out");
    window.location.href = "/index.html";
  } catch (err) {
    console.error("❌ Sign-out error:", err);
  }
}

function showLoginScreen() {
  const sections = ['.main-content', '.examples-section', '.testimonials-section'];
  sections.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  });
  const loginModal = document.getElementById('loginRequiredModal');
  if (loginModal) loginModal.style.display = 'block';
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

function updateAuthUI() {
  if (typeof window.updateAuthUI === 'function') window.updateAuthUI();
}

// 🔃 Auto run Firebase init
document.addEventListener("DOMContentLoaded", () => {
  console.log("📄 DOM loaded → Init Firebase");
  initializeFirebase();
});
if (document.readyState !== "loading") {
  console.log("📄 DOM already ready → Init Firebase");
  initializeFirebase();
  }
