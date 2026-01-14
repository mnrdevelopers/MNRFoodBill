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

// Assets to NEVER cache (Firebase and external resources)
const NO_CACHE_URLS = [
  'firestore.googleapis.com',
  'firebaseapp.com',
  'googleapis.com',
  'imgbb.com',  // Image upload API
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com/ajax/libs/font-awesome'
];

// Install Event - Simplified for iOS compatibility
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    // Skip waiting immediately
    self.skipWaiting();
    
    // Don't cache anything during install for iOS
    if (isIOS) {
        console.log('[Service Worker] iOS detected - skipping cache during install');
        return;
    }
    
    // For non-iOS devices, cache app shell
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch(err => {
                console.warn('[Service Worker] Cache addAll failed:', err);
            })
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  // For iOS, just claim clients without cache cleanup
  if (isIOS) {
    console.log('[Service Worker] iOS detected - skipping cache cleanup');
    event.waitUntil(self.clients.claim());
    return;
  }
  
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

// Fetch Event - Network only for iOS, with fallback for non-iOS
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Special handling for root URL when user might be logged in
  if (url.pathname === BASE_PATH || url.pathname === BASE_PATH + 'index.html') {
    event.respondWith(handleRootRequest(event.request));
    return;
  }
  
  // For iOS: Always go to network, no caching
  if (isIOS) {
    event.respondWith(networkOnly(event.request));
    return;
  }
  
  // For non-iOS devices: Use normal caching strategy
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip Firebase/Google APIs and external resources
  if (NO_CACHE_URLS.some(noCache => url.href.includes(noCache))) {
    return;
  }
  
  // Skip browser extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // For HTML pages: Network first, then cache
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstThenCache(event.request));
    return;
  }
  
  // For CSS, JS, images: Cache first, then network
  event.respondWith(cacheFirstThenNetwork(event.request));
});

// Request handlers
async function handleRootRequest(request) {
  try {
    // Try to get auth status first
    const authResponse = await fetch('/MNRFoodBill/api/auth-status', { 
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (authResponse.ok) {
      const data = await authResponse.json();
      if (data.isAuthenticated && data.user) {
        // User is logged in, serve dashboard directly
        if (isIOS) {
          return fetch(BASE_PATH + 'dashboard.html');
        }
        return serveFromCacheOrNetwork(BASE_PATH + 'dashboard.html');
      }
    }
    
    // User not logged in or auth failed
    return networkOnly(request);
  } catch (error) {
    console.log('[Service Worker] Auth check failed:', error);
    return networkOnly(request);
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.log('[Service Worker] Network request failed:', error);
    // For iOS, we don't want offline fallback
    return new Response('Network connection required', { 
      status: 503, 
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function networkFirstThenCache(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache the fresh version (for non-iOS only)
    if (!isIOS && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed:', error);
    
    // For iOS, no cache fallback
    if (isIOS) {
      return new Response('Network connection required', { 
        status: 503, 
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // For non-iOS, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to dashboard.html for navigation requests
    if (request.mode === 'navigate') {
      const dashboardResponse = await caches.match(BASE_PATH + 'dashboard.html');
      if (dashboardResponse) {
        return dashboardResponse;
      }
    }
    
    return new Response('Offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

async function cacheFirstThenNetwork(request) {
  // For iOS, always go to network
  if (isIOS) {
    return networkOnly(request);
  }
  
  // Try cache first for non-iOS
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Update cache in background
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, response);
          });
        }
      })
      .catch(() => {
        // Network failed, keep cached version
      });
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    // Cache the response if successful
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network request failed:', error);
    return new Response('', { 
      status: 503, 
      statusText: 'Offline' 
    });
  }
}

async function serveFromCacheOrNetwork(url) {
  if (isIOS) {
    return fetch(url);
  }
  
  try {
    // Try cache first
    const cachedResponse = await caches.match(url);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    return await fetch(url);
  } catch (error) {
    console.log('[Service Worker] Failed to serve:', url, error);
    return new Response('Resource not available', { 
      status: 404, 
      statusText: 'Not Found' 
    });
  }
}

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({
      type: 'VERSION_INFO',
      version: CACHE_NAME,
      timestamp: new Date().toISOString(),
      isIOS: isIOS
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        event.source.postMessage({
          type: 'CACHE_CLEARED',
          success: true
        });
      })
      .catch(error => {
        event.source.postMessage({
          type: 'CACHE_CLEARED',
          success: false,
          error: error.message
        });
      });
  }
});
