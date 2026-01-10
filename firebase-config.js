// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCnGD6qAtzrM1Nc2zV6NIHG2EQ13K9EspE",
  authDomain: "mnrfoodbill.firebaseapp.com",
  projectId: "mnrfoodbill",
  storageBucket: "mnrfoodbill.firebasestorage.app",
  messagingSenderId: "1051424912016",
  appId: "1:1051424912016:web:725c04807f5a3a5cf2de15",
  measurementId: "G-390MRC610E"
};

// Initialize Firebase only if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}

const auth = firebase.auth();
const db = firebase.firestore();

// IMPORTANT: Set settings BEFORE calling any other Firestore methods (like enablePersistence)
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// Enable offline persistence after settings are applied
db.enablePersistence()
  .then(() => {
    console.log("Offline persistence enabled");
  })
  .catch(err => {
    if (err.code == 'failed-precondition') {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
        console.warn("Browser doesn't support persistence.");
    }
  });

