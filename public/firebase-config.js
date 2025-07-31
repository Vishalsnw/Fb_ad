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
      // User is signed in
      console.log('✅ User authenticated:', user.displayName);

      // Set current user immediately
      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random`,
        isAnonymous: user.isAnonymous,
        usageCount: 0,
        maxUsage: 4,
        subscriptionStatus: 'free'
      };

      updateUIForAuthenticatedUser(user);

      // Load user data from Firestore in background
      try {
        const userData = await loadUserFromFirestore(user.uid, user);
        currentUser = userData;
        window.user = userData;
        console.log('✅ User data loaded:', userData);

        // Update usage display
        if (typeof updateUsageDisplay === 'function') {
          updateUsageDisplay();
        }
      } catch (error) {
        console.error('❌ Failed to load user data:', error);
        // Continue with basic user data if Firestore fails
      }
    } else {
      // User is signed out
      console.log('👤 User not authenticated');
      currentUser = null;
      window.user = null;
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

function updateUIForAuthenticatedUser(user) {
  console.log('🔄 Updating UI for authenticated user');

  // Update sign in/out buttons
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const userInfo = document.getElementById('userInfo');

  if (signInBtn) signInBtn.style.display = 'none';
  if (signOutBtn) signOutBtn.style.display = 'inline-block';

  if (userInfo) {
    userInfo.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User')}" 
             style="width: 32px; height: 32px; border-radius: 50%;" alt="Profile">
        <span style="color: white;">${user.displayName || user.email}</span>
      </div>
    `;
    userInfo.style.display = 'block';
  }

  // Update usage counter
  updateUsageCounter();
}

function updateUIForUnauthenticatedUser() {
  console.log('🔄 Updating UI for unauthenticated user');

  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const userInfo = document.getElementById('userInfo');
  const usageCount = document.getElementById('usageCount');

  if (signInBtn) signInBtn.style.display = 'inline-block';
  if (signOutBtn) signOutBtn.style.display = 'none';
  if (userInfo) userInfo.style.display = 'none';
  if (usageCount) usageCount.textContent = 'Sign in to see usage';
}

function updateUsageCounter() {
  const usageCount = document.getElementById('usageCount');
  if (usageCount && currentUser) {
    const used = currentUser.usageCount || 0;
    const max = currentUser.maxUsage || 4;
    const remaining = Math.max(0, max - used);

    if (currentUser.subscriptionStatus === 'unlimited') {
      usageCount.innerHTML = '✨ Unlimited ads available';
    } else if (currentUser.subscriptionStatus === 'pro') {
      usageCount.innerHTML = `📊 Pro Plan: ${remaining}/100 ads remaining`;
    } else {
      usageCount.innerHTML = `📊 Free Plan: ${remaining}/${max} ads remaining`;
    }
  }
}

function updateAuthUI() {
  if (currentUser) {
    updateUIForAuthenticatedUser(currentUser);
  } else {
    updateUIForUnauthenticatedUser();
  }
}

// Increment ad usage count
        window.incrementAdUsage = async function() {
            if (!currentUserData) {
                console.warn('⚠️ No user data available for incrementing usage');
                return false;
            }

            const oldUsage = currentUserData.usageCount || 0;
            currentUserData.usageCount = oldUsage + 1;
            const newUsage = currentUserData.usageCount;
            const maxUsage = currentUserData.maxUsage || 4;
            const subscriptionStatus = currentUserData.subscriptionStatus || 'free';

            console.log(`📊 Usage incremented: ${oldUsage} → ${newUsage} (max: ${maxUsage}, plan: ${subscriptionStatus})`);

            // Save to Firebase and wait for completion
            if (db && currentUserData.uid) {
                try {
                    await db.collection('users').doc(currentUserData.uid).update({
                        usageCount: newUsage,
                        lastAdGeneratedAt: new Date().toISOString()
                    });
                    console.log('✅ Usage count updated in Firebase');
                } catch (error) {
                    console.error('❌ Failed to update usage count in Firebase:', error);
                    // Don't return error, just log it
                }
            }

            // Check if limit reached (for free users)
            const limitReached = (subscriptionStatus === 'free' && newUsage >= maxUsage);
            console.log(`🔍 Limit check: ${newUsage}/${maxUsage} (${subscriptionStatus}) → limit reached: ${limitReached}`);

            return limitReached;
        };

// 🔃 Auto run Firebase init
document.addEventListener("DOMContentLoaded", () => {
  console.log("📄 DOM loaded → Init Firebase");
  initializeFirebase();
});
if (document.readyState !== "loading") {
  console.log("📄 DOM already ready → Init Firebase");
  initializeFirebase();
  }