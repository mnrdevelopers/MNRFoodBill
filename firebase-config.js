// Your Firebase configuration
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

// IMPORTANT: iOS/Safari specific settings
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Configure Firestore with iOS compatibility
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: isIOS || isSafari, // Force long polling for iOS/Safari
  merge: true
});

// Enable offline persistence with iOS-specific handling
if (isIOS || isSafari) {
  // iOS/Safari requires special handling
  console.log("iOS/Safari detected - using compatible persistence settings");
  
  // Try to enable persistence but don't block on errors
  db.enablePersistence({ synchronizeTabs: false })
    .then(() => {
      console.log("Offline persistence enabled for iOS/Safari");
    })
    .catch(err => {
      console.warn("iOS/Safari persistence warning:", err.code, err.message);
      // Continue without persistence if it fails
    });
} else {
  // Normal persistence for other browsers
  db.enablePersistence()
    .then(() => {
      console.log("Offline persistence enabled");
    })
    .catch(err => {
      console.warn("Persistence warning:", err.code);
    });
}

// Initialize Firebase Remote Config
const remoteConfig = firebase.remoteConfig();

// Set minimum fetch interval (in seconds) for development/production
remoteConfig.settings = {
    minimumFetchIntervalMillis: 3600000, // 1 hour for production
    fetchTimeoutMillis: 60000 // 60 seconds timeout
};

// Set default values
remoteConfig.defaultConfig = {
    'imgbb_api_key': '' // Empty by default, will be fetched from server
};

// Export remoteConfig
window.remoteConfig = remoteConfig;

// iOS/Safari specific timeout fix
if (isIOS || isSafari) {
  // Increase timeout for slow connections
  db.settings({ 
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false
  });
  
  // Add connection state listener for debugging
  db.enableNetwork()
    .then(() => console.log("Firestore network enabled"))
    .catch(err => console.error("Network enable failed:", err));
}
