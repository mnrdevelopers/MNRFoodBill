const CACHE_NAME = 'mnrfoodbill-v1.0.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/billing.html',
  '/products.html',
  '/orders.html',
  '/settings.html',
  '/staff.html',
  '/css/styles.css',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/billing.js',
  '/js/products.js',
  '/js/orders.js',
  '/js/settings.js',
  '/js/layout.js',
  '/js/print.js',
  '/js/staff.js',
  '/js/product-images.js',
  '/firebase-config.js',
  '/manifest.json',
  '/sw.js'
];

// Install Event - Cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell and assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
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
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch Event - Network First, then Cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests and Firebase API calls
  if (event.request.method !== 'GET' || 
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebaseapp.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the new version
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, serve from cache
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            // If not in cache, return offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Listen for messages to skip waiting
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
