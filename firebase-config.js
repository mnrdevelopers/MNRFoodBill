// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBp1yyC1IF_rmOWwFdZRcbcsCHNbJ3Sdro",
  authDomain: "mnr-devops-2e97d.firebaseapp.com",
  projectId: "mnr-devops-2e97d",
  storageBucket: "mnr-devops-2e97d.firebasestorage.app",
  messagingSenderId: "464172080556",
  appId: "1:464172080556:web:cca3dcb8265265a17aee09",
  measurementId: "G-J5SRFCBCCL"
};

// Initialize Firebase only if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that one
}

const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
firebase.firestore().enablePersistence()
  .then(() => {
    console.log("Offline persistence enabled");
  })
  .catch(err => {
    if (err.code == 'failed-precondition') {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
        console.warn("The current browser doesn't support all of the features required to enable persistence");
    }
  });

// Set cache size
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});
