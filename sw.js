/* ================================
   MNRFoodBill Service Worker
   Stable • Fast • Offline Safe
================================ */

const CACHE_VERSION = 'v3.1.0';
const CACHE_NAME = `mnrfoodbill-${CACHE_VERSION}`;
const BASE_PATH = '/MNRFoodBill/';

/* -------- App Shell -------- */
const APP_SHELL = [
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
  BASE_PATH + 'js/layout.js',
  BASE_PATH + 'js/firebase-config.js',
  BASE_PATH + 'js/print.js',
  BASE_PATH + 'js/pwa-install.js',

  BASE_PATH + 'manifest.json'
];

/* -------- Never Cache -------- */
const NO_CACHE = [
  'firestore.googleapis.com',
  'firebaseapp.com',
  'googleapis.com',
  'imgbb.com',
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com'
];

/* ================================
   Install
================================ */
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );
});

/* ================================
   Activate
================================ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* ================================
   Fetch
================================ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (NO_CACHE.some(domain => url.href.includes(domain))) return;
  if (url.protocol === 'chrome-extension:') return;

  // HTML → Network First
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets → Cache First
  event.respondWith(cacheFirst(request));
});

/* ================================
   Strategies
================================ */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request) || offlineResponse();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return offlineResponse();
  }
}

function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

/* ================================
   Messages
================================ */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});
