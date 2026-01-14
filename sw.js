const CACHE_NAME = 'mnrfoodbill-v3.0.6'; // Change version to force update
const BASE_PATH = '/MNRFoodBill/';

// Assets to cache - Minimal set for iOS compatibility
const ASSETS_TO_CACHE = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'dashboard.html',
  BASE_PATH + 'billing.html',
  BASE_PATH + 'products.html',
  BASE_PATH + 'orders.html',
  BASE_PATH + 'settings.html',
  BASE_PATH + 'staff.html',
  
  // CSS - Only critical
  BASE_PATH + 'css/styles.css',
  
  // JS - Core only
  BASE_PATH + 'js/auth.js',
  BASE_PATH + 'js/layout.js',
  BASE_PATH + 'js/firebase-config.js',
];

// Assets to NEVER cache (Firebase and external resources)
const NO_CACHE_URLS = [
  'firestore.googleapis.com',
  'firebaseapp.com',
  'googleapis.com',
  'imgbb.com',
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  '/MNRFoodBill/api/'
];

// Client ID to strategy mapping
const clientStrategies = new Map();

// Install Event - Lightweight install
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    // Skip waiting immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching critical app shell');
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

// Fetch Event - Simplified with no caching for dynamic content
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
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
  
  // Special handling for root/index
  if (url.pathname === BASE_PATH || url.pathname === BASE_PATH + 'index.html') {
    event.respondWith(handleRootRequest(event));
    return;
  }
  
  // For API calls and data - Always network only
  if (url.pathname.includes('/api/') || 
      url.pathname.includes('/data/') ||
      event.request.headers.get('Accept')?.includes('application/json')) {
    event.respondWith(networkOnly(event.request));
    return;
  }
  
  // For HTML pages - Network first, VERY minimal caching
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(htmlStrategy(event));
    return;
  }
  
  // For static assets - Cache first but with short lifespan
  if (url.pathname.includes('.css') || 
      url.pathname.includes('.js') || 
      url.pathname.includes('.json')) {
    event.respondWith(staticAssetStrategy(event));
    return;
  }
  
  // Default: Network only for everything else (images, fonts, etc.)
  event.respondWith(networkOnly(event.request));
});

// Strategy handlers
async function handleRootRequest(event) {
  try {
    // Check auth status without caching
    const authResponse = await fetch('/MNRFoodBill/api/auth-status', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (authResponse.ok) {
      const data = await authResponse.json();
      if (data.isAuthenticated && data.user) {
        // User is logged in, redirect to dashboard
        return Response.redirect(BASE_PATH + 'dashboard.html', 302);
      }
    }
    
    // Serve index.html fresh from network
    return networkOnly(event.request);
  } catch (error) {
    console.log('[Service Worker] Auth check failed:', error);
    // Fall back to cache if network fails
    const cached = await caches.match(event.request);
    if (cached) return cached;
    
    // Ultimate fallback
    return new Response('<h1>Please check your connection</h1>', {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

async function htmlStrategy(event) {
  const request = event.request;
  
  // Always try network first for HTML
  try {
    const networkResponse = await fetch(request);
    
    // If it's a 200 OK response from our domain, cache it briefly
    if (networkResponse.ok && networkResponse.url.includes(self.location.origin)) {
      // Clone the response to cache it
      const responseToCache = networkResponse.clone();
      
      // Open cache and store response
      caches.open(CACHE_NAME).then(cache => {
        // Only cache HTML for 5 minutes maximum
        setTimeout(() => {
          cache.delete(request);
        }, 5 * 60 * 1000); // 5 minutes
        cache.put(request, responseToCache);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed for HTML:', error);
    
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check if cached response is stale (more than 5 minutes old)
      const cacheDate = cachedResponse.headers.get('date');
      if (cacheDate) {
        const cacheTime = new Date(cacheDate).getTime();
        const now = Date.now();
        if (now - cacheTime < 5 * 60 * 1000) { // 5 minutes
          return cachedResponse;
        }
      } else {
        return cachedResponse;
      }
    }
    
    // If navigating to a page and we have dashboard cached, use it
    if (request.mode === 'navigate') {
      const dashboardCached = await caches.match(BASE_PATH + 'dashboard.html');
      if (dashboardCached) return dashboardCached;
    }
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #666; }
          </style>
        </head>
        <body>
          <h1>Network Connection Required</h1>
          <p>Please check your internet connection and try again.</p>
          <button onclick="location.reload()">Retry</button>
        </body>
      </html>
    `, {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

async function staticAssetStrategy(event) {
  const request = event.request;
  
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Update cache in background (stale-while-revalidate)
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, response);
          });
        }
      })
      .catch(() => {
        // Keep existing cache if network fails
      });
    
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    // Cache static assets if successful
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed for static asset:', error);
    return new Response('', { 
      status: 503, 
      statusText: 'Offline' 
    });
  }
}

async function networkOnly(request) {
  // Add cache busting headers for API calls
  const newHeaders = new Headers(request.headers);
  newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  newHeaders.set('Pragma', 'no-cache');
  newHeaders.set('Expires', '0');
  
  const newRequest = new Request(request, {
    headers: newHeaders,
    cache: 'no-store'
  });
  
  try {
    return await fetch(newRequest);
  } catch (error) {
    console.log('[Service Worker] Network-only request failed:', error);
    
    // For API calls, return a proper error
    if (request.url.includes('/api/')) {
      return new Response(JSON.stringify({
        error: 'Network error',
        message: 'Please check your internet connection'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Network connection required', { 
      status: 503, 
      statusText: 'Service Unavailable'
    });
  }
}

// Handle messages from the client
self.addEventListener('message', event => {
  const client = event.source;
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    client.postMessage({
      type: 'VERSION_INFO',
      version: CACHE_NAME,
      timestamp: new Date().toISOString()
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        client.postMessage({
          type: 'CACHE_CLEARED',
          success: true
        });
      })
      .catch(error => {
        client.postMessage({
          type: 'CACHE_CLEAR_ERROR',
          error: error.message
        });
      });
  }
  
  if (event.data && event.data.type === 'SET_STRATEGY') {
    // Client can request a specific strategy (for debugging)
    clientStrategies.set(client.id, event.data.strategy);
  }
});

// Handle errors
self.addEventListener('error', event => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});
