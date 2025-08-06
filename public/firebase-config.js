
let currentUser = null;
let firebaseConfig = {};

window.signIn = signIn;
window.signOut = signOut;
window.currentUser = () => currentUser;

async function initializeFirebase() {
  if (window.firebaseInitialized) return;
  window.firebaseInitialized = true;
  
  console.log("🚀 Initializing Firebase...");

  // Wait for config with shorter timeout
  let retries = 0;
  while (!window.CONFIG && retries < 20) {
    await new Promise(res => setTimeout(res, 50));
    retries++;
  }

  if (!window.CONFIG) {
    console.error("❌ Config load failed");
    return;
  }

  firebaseConfig = {
    apiKey: window.CONFIG.FIREBASE_API_KEY,
    authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN || `${window.CONFIG.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: window.CONFIG.FIREBASE_PROJECT_ID,
    appId: window.CONFIG.FIREBASE_APP_ID
  };

  try {
    // Wait for Firebase SDK with shorter timeout
    let sdkRetries = 0;
    while (typeof firebase === "undefined" && sdkRetries < 20) {
      await new Promise(res => setTimeout(res, 100));
      sdkRetries++;
    }

    if (!firebase) {
      console.error("❌ Firebase SDK not loaded");
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    if (firebase.auth) {
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    }
    
    if (firebase.firestore) {
      window.db = firebase.firestore();
    }

    setupAuthListener();
    console.log("✅ Firebase initialized successfully");
  } catch (err) {
    console.error("❌ Firebase Init Error:", err);
  }
}

function setupAuthListener() {
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      console.log('✅ User authenticated:', user.displayName);

      // Set current user immediately for faster UI updates
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

      // Load user data from Firestore in background (non-blocking)
      loadUserFromFirestore(user.uid, user).then(userData => {
        currentUser = userData;
        window.user = userData;
        console.log('✅ User data loaded:', userData);
        updateUsageDisplay();
      }).catch(error => {
        console.error('❌ Failed to load user data:', error);
      });
    } else {
      console.log('👤 User not authenticated');
      currentUser = null;
      window.user = null;
      updateUIForUnauthenticatedUser();
    }
  });
}

async function loadUserFromFirestore(uid, firebaseUser) {
  if (!db) {
    console.warn('⚠️ Firestore not available, using basic user data');
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

  try {
    const userDoc = await db.collection('users').doc(uid).get();

    let userData;
    if (userDoc.exists) {
      userData = { uid, ...userDoc.data() };
      console.log('📊 Existing user data loaded from Firestore');
    } else {
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

      await db.collection('users').doc(uid).set(userData);
      console.log('👤 New user created in Firestore');
    }

    // Update last login time (non-blocking)
    db.collection('users').doc(uid).update({
      lastLoginAt: new Date().toISOString()
    }).catch(error => console.error('❌ Failed to update last login time:', error));

    return userData;
  } catch (error) {
    console.error('❌ Error loading user from Firestore:', error);
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
  if (!firebase?.auth) {
    console.error('❌ Firebase Auth not available');
    return;
  }

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
    window.location.href = "/";
  } catch (err) {
    console.error("❌ Sign-out error:", err);
  }
}

function updateUIForAuthenticatedUser(user) {
  console.log('🔄 Updating UI for authenticated user');

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

function updateUsageDisplay() {
  updateUsageCounter();
}

window.incrementAdUsage = async function() {
  if (!currentUser) {
    console.warn('⚠️ No current user available for incrementing usage');
    return false;
  }

  const oldUsage = currentUser.usageCount || 0;
  currentUser.usageCount = oldUsage + 1;
  const newUsage = currentUser.usageCount;
  const maxUsage = currentUser.maxUsage || 4;
  const subscriptionStatus = currentUser.subscriptionStatus || 'free';

  console.log(`📊 Usage incremented: ${oldUsage} → ${newUsage} (max: ${maxUsage}, plan: ${subscriptionStatus})`);

  if (db && currentUser.uid) {
    try {
      await db.collection('users').doc(currentUser.uid).update({
        usageCount: newUsage,
        lastAdGeneratedAt: new Date().toISOString()
      });
      console.log('✅ Usage count updated in Firebase');
    } catch (error) {
      console.error('❌ Failed to update usage count in Firebase:', error);
    }
  }

  updateUsageCounter();

  const limitReached = (subscriptionStatus === 'free' && newUsage >= maxUsage);
  console.log(`🔍 Limit check: ${newUsage}/${maxUsage} (${subscriptionStatus}) → limit reached: ${limitReached}`);

  return limitReached;
};

// Initialize Firebase when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
  initializeFirebase();
}
