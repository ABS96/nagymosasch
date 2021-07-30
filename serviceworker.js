var cacheName = 'nagymosasch-v7';
var contentToCache = [
  './index.html',
  './microcontroller.js',
  './normalize.css',
  './washwithstyle.css',
  './manifest.json',
  './icons/yellow-icon.svg',
  './icons/favicon.ico',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './icons/launch-icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
  console.log('[Service Worker] Install');
  e.waitUntil(
    caches.open(cacheName).then((cache) => {
      console.log('[Service Worker] Caching all: app shell and content');
      return cache.addAll(contentToCache);
    }),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
  console.log('[Service Worker] Activation');
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (cacheName.indexOf(key) === -1) {
            return caches.delete(key);
          }
        }),
      );
    }),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => {
      console.log('[Service Worker] Fetching resource: ' + e.request.url);
      return (
        r ||
        fetch(e.request).then((response) => {
          return caches.open(cacheName).then((cache) => {
            console.log(
              '[Service Worker] Caching new resource: ' + e.request.url,
            );
            cache.put(e.request, response.clone());
            return response;
          });
        })
      );
    }),
  );
});

self.addEventListener('message', (e) => {
  switch (e.data.command) {
    case 'showNotification':
      let options = {
        body: `${e.data.delta} perc múlva lejár a mosás a ${e.data.level}. szinten`,
        icon: './icons/app-icon-512.png',
        badge: './icons/favicon.ico',
        actions: [{ action: 'pick', title: 'Megyek!' }],
      };
      registration.showNotification('NagymosáSCH', options);
      break;
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  clients.openWindow('https://antokben.hu/nagymosasch/');
});
