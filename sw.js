const CACHE_NAME = 'mnrfoodbill-v2.0.4';
const BASE_PATH = '/MNRFoodBill/';

// Assets to cache
const ASSETS_TO_CACHE = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'dashboard.html',
  BASE_PATH + 'billing.html',
  BASE_PATH + 'products.html',
  BASE_PATH + 'orders.html',
  BASE_PATH + 'settings.html',
  BASE_PATH + 'staff.html',
  BASE_PATH + 'css/styles.css',
  BASE_PATH + 'js/auth.js',
  BASE_PATH + 'js/dashboard.js',
  BASE_PATH + 'js/billing.js',
  BASE_PATH + 'js/products.js',
  BASE_PATH + 'js/orders.js',
  BASE_PATH + 'js/settings.js',
  BASE_PATH + 'js/layout.js',
  BASE_PATH + 'js/print.js',
  BASE_PATH + 'js/staff.js',
  BASE_PATH + 'js/pwa-install.js',
  BASE_PATH + 'js/image-upload.js',
  BASE_PATH + 'js/table-responsive.js',
  BASE_PATH + 'firebase-config.js',
  BASE_PATH + 'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Event
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch Event - Network First Strategy
self.addEventListener('fetch', event => {
  // Skip non-GET requests and Firebase/Google APIs
  if (event.request.method !== 'GET' || 
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebaseapp.com') ||
      event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Don't cache if not a success response
        if (!response.ok) {
          return response;
        }

        // Clone the response for caching
        const responseClone = response.clone();
        
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then(response => {
            // Return cached response or fallback
            if (response) {
              return response;
            }
            
            // For navigation requests, return the index page
            if (event.request.mode === 'navigate') {
              return caches.match(BASE_PATH + 'index.html');
            }
            
            // Return offline page or null
            return null;
          });
      })
  );
});

// Listen for skipWaiting message
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
