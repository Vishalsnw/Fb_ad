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
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      // User is signed in
      console.log('✅ User authenticated:', user.displayName);
      updateUIForAuthenticatedUser(user);

      // Load user data from Firestore
      loadUserFromFirestore(user.uid, user).then(userData => {
        window.user = userData;
        console.log('✅ User data loaded:', userData);

        // Update usage display
        if (typeof updateUsageDisplay === 'function') {
          updateUsageDisplay();
        }
      }).catch(error => {
        console.error('❌ Failed to load user data:', error);
      });
    } else {
      // User is signed out
      console.log('👤 User not authenticated');
      updateUIForUnauthenticatedUser();
    }
  });
}

async function loadUserFromFirestore(uid, firebaseUser) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();

    let userData;
    if (userDoc.exists) {
      userData = { uid, ...userDoc.data() };
      console.log('📊 Existing user data loaded from Firestore');
    } else {
      // Create new user document
      userData = {
        uid: uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        usageCount: 0,
        maxUsage: 4,
        subscriptionStatus: 'free',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      try {
        await db.collection('users').doc(uid).set(userData);
        console.log('👤 New user created in Firestore');
      } catch (setError) {
        console.error('❌ Failed to create user in Firestore:', setError);
      }
    }

    // Update last login time
    try {
      await db.collection('users').doc(uid).update({
        lastLoginAt: new Date().toISOString()
      });
    } catch (updateError) {
      console.error('❌ Failed to update last login time:', updateError);
    }

    return userData;
  } catch (error) {
    console.error('❌ Error loading user from Firestore:', error);
    // Return basic user data if Firestore fails
    return {
      uid: uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      usageCount: 0,
      maxUsage: 4,
      subscriptionStatus: 'free'
    };
  }
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