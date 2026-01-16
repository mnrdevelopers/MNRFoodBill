// sw.js - Service Worker
const CACHE_NAME = 'mnr-foodbill-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/billing.html',
  '/tables.html',
  '/orders.html',
  '/products.html',
  '/staff.html',
  '/settings.html',
  '/css/styles.css',
  '/js/layout.js',
  '/js/auth.js',
  '/js/billing.js',
  '/js/print.js',
  '/components/header.html',
  '/components/sidebar.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
