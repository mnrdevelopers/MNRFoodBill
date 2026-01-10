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

