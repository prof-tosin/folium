// ============================================================================
// FOLIUM — Firebase configuration
// Replace the values below with your own Firebase project's config.
// Firebase Console → Project settings → General → "Your apps" → SDK setup
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDwDFgsb8TTkWo2WmZkDML-Xfx9wFGYUxY",
  authDomain: "folium-c4b2c.firebaseapp.com",
  projectId: "folium-c4b2c",
  storageBucket: "folium-c4b2c.firebasestorage.app",
  messagingSenderId: "280634061425",
  appId: "1:280634061425:web:e6af123c05dfa9a7eda1d0"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence so the feed still loads with a flaky connection
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
