var cacheName = 'nagymosasch-v5';
var contentToCache = [
  './index.html',
  './integratedcircuit.js',
  './normalize.css',
  './washwithstyle.css',
  './manifest.json',
  './icons/yellow-icon.svg',
  './icons/favicon.ico',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './icons/launch-icon-512.png'
];

self.addEventListener('install', e => {
  console.log('[Service Worker] Install');
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log('[Service Worker] Caching all: app shell and content');
      return cache.addAll(contentToCache);
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (cacheName.indexOf(key) === -1) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => {
      console.log('[Service Worker] Fetching resource: ' + e.request.url);
      return (
        r ||
        fetch(e.request).then(response => {
          return caches.open(cacheName).then(cache => {
            console.log(
              '[Service Worker] Caching new resource: ' + e.request.url
            );
            cache.put(e.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});
