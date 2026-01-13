const CACHE_NAME = 'mnrfoodbill-v3.0.5'; // Change version to force update
const BASE_PATH = '/MNRFoodBill/';
const AUTH_CHECK_URL = '/MNRFoodBill/auth-check.html';

// Assets to cache - Updated
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
  
  // External resources
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Assets to NEVER cache (Firebase)
const NO_CACHE_URLS = [
  'firestore.googleapis.com',
  'firebaseapp.com',
  'googleapis.com',
  'imgbb.com'  // Image upload API
];

// Install Event
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    // Skip waiting immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                // Don't cache index.html in install - cache it on first access
                const assetsToCache = ASSETS_TO_CACHE.filter(
                    asset => !asset.includes('index.html')
                );
                return cache.addAll(assetsToCache);
            })
            .catch(err => {
                console.warn('[Service Worker] Cache addAll failed:', err);
            })
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch Event
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Special handling for root URL when user might be logged in
  if (url.pathname === BASE_PATH || url.pathname === BASE_PATH + 'index.html') {
    event.respondWith(
      // Try to get auth status first
      fetch('/MNRFoodBill/api/auth-status', { 
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Auth check failed');
      })
      .then(data => {
        if (data.isAuthenticated && data.user) {
          // User is logged in, serve dashboard directly
          return caches.match(BASE_PATH + 'dashboard.html')
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return fetch(BASE_PATH + 'dashboard.html');
            });
        }
        // User not logged in, serve index.html
        return fetch(event.request)
          .then(response => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(() => {
            return caches.match(event.request);
          });
      })
      .catch(() => {
        // Auth check failed, serve normal index.html
        return fetch(event.request)
          .catch(() => caches.match(event.request));
      })
    );
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip Firebase/Google APIs and image uploads
  if (NO_CACHE_URLS.some(noCache => url.href.includes(noCache))) {
    return;
  }
  
  // Skip browser extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // For HTML pages, always try network first
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Fallback to dashboard.html for navigation requests
              if (event.request.mode === 'navigate') {
                return caches.match(BASE_PATH + 'dashboard.html');
              }
              return new Response('Offline', { 
                status: 503, 
                statusText: 'Service Unavailable' 
              });
            });
        })
    );
    return;
  }
  
  // For CSS, JS, images: Cache First, Network Fallback
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          // Update cache in background
          fetch(event.request)
            .then(response => {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            })
            .catch(() => {
              // Network failed, keep cached version
            });
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache if not successful
            if (!response.ok) {
              return response;
            }
            
            // Cache the response
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            
            return response;
          })
          .catch(() => {
            // Network failed and not in cache
            return new Response('', { 
              status: 503, 
              statusText: 'Offline' 
            });
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({
      type: 'VERSION_INFO',
      version: CACHE_NAME,
      timestamp: new Date().toISOString()
    });
  }
});
