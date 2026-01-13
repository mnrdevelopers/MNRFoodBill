// firebase-config.js - UPDATED VERSION
const firebaseConfig = {
  apiKey: "AIzaSyBFL6RkTZIkFsr1PsYa5oVsOdP3orjdRKc",
  authDomain: "mnrfoodbill-a8cf6.firebaseapp.com",
  projectId: "mnrfoodbill-a8cf6",
  storageBucket: "mnrfoodbill-a8cf6.firebasestorage.app",
  messagingSenderId: "122551470168",
  appId: "1:122551470168:web:e519681f82e03f4d66a22d",
  measurementId: "G-7H0JS12B7Z"
};

// Initialize Firebase only if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}

const auth = firebase.auth();
const db = firebase.firestore();

// IMPORTANT: iOS/macOS specific settings
const isIOS = /iPad|iPhone|iPod|Mac/.test(navigator.userAgent) && !window.MSStream;

// iOS/macOS specific persistence settings
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  // iOS specific: enable force persistence
  experimentalForceLongPolling: isIOS, // Force long polling for iOS
  merge: true // Enable field merge for better iOS compatibility
});

// Enable offline persistence with better error handling for iOS
if (!isIOS || (isIOS && navigator.standalone)) {
  // Only enable persistence for iOS standalone apps or non-iOS devices
  db.enablePersistence()
    .then(() => {
      console.log("Offline persistence enabled");
    })
    .catch(err => {
      console.warn("Persistence error:", err.code, err.message);
      if (err.code === 'failed-precondition') {
        console.log("Multiple tabs open, persistence disabled");
      } else if (err.code === 'unimplemented') {
        console.log("Browser doesn't support persistence");
      }
    });
} else {
  console.log("Persistence disabled for iOS Safari (not standalone)");
}

// Initialize Firebase Remote Config
const remoteConfig = firebase.remoteConfig();

// Set minimum fetch interval
remoteConfig.settings = {
    minimumFetchIntervalMillis: 3600000,
    fetchTimeoutMillis: 60000
};

// Set default values
remoteConfig.defaultConfig = {
    'imgbb_api_key': ''
};

// iOS specific: Disable indexing for privacy
if ('connection' in navigator && navigator.connection) {
  if (navigator.connection.saveData) {
    console.log("Data saver mode enabled");
  }
}

// Export for iOS debugging
window.firebaseDebug = {
  isIOS: isIOS,
  isStandalone: navigator.standalone,
  userAgent: navigator.userAgent
};

window.remoteConfig = remoteConfig;
