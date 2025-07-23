
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD76bzmFM8ScCq7FCEDzaDPTPSFv3GKPlM",
    authDomain: "adgenie-59adb.firebaseapp.com",
    projectId: "adgenie-59adb",
    storageBucket: "adgenie-59adb.firebasestorage.app",
    messagingSenderId: "775764972429",
    appId: "1:775764972429:web:2921b91eea1614a05863c4",
    measurementId: "G-922RPB06J3"
};

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup, firebaseSignOut, onAuthStateChanged };
