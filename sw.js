const CACHE_NAME = 'mnrfoodbill-v3.0.7'; // Change version to force update
const BASE_PATH = '/MNRFoodBill/';
const AUTH_CHECK_URL = '/MNRFoodBill/index.html';

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Assets to cache - Updated (Only for non-iOS devices)
const ASSETS_TO_CACHE = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'dashboard.html',
  BASE_PATH + 'billing.html',
  BASE_PATH + 'products.html',
  BASE_PATH + 'orders.html',
  BASE_PATH + 'settings.html',
  BASE_PATH + 'staff.html',
  
  // CSS
  BASE_PATH + 'css/styles.css',
  
  // JS - Core
  BASE_PATH + 'js/auth.js',
  BASE_PATH + 'js/layout.js',
  BASE_PATH + 'js/firebase-config.js',
  
  // JS - Pages (load selectively)
  BASE_PATH + 'js/dashboard.js',
  BASE_PATH + 'js/billing.js',
  BASE_PATH + 'js/products.js',
  BASE_PATH + 'js/orders.js',
  BASE_PATH + 'js/settings.js',
  BASE_PATH + 'js/staff.js',
  
  // JS - Utilities
  BASE_PATH + 'js/print.js',
  BASE_PATH + 'js/pwa-install.js',
  BASE_PATH + 'js/image-upload.js',
  BASE_PATH + 'js/product-images.js',
  BASE_PATH + 'js/table-responsive.js',
  
  // Config
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'firebase-config.js',
];

// Install event: caching app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate event: cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Fetch event: serve cached content
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request)
    )
  );
});

// Optional: Listen for sync messages (for offline sync)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SYNCDATA') {
    // Add your custom sync logic here if needed
  }
});
