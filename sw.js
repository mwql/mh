const CACHE_NAME = 'mahdawi-weather-v1';
const ASSETS = [
  'index.html',
  'other.html',
  'style.css',
  'script.js',
  'favicon.jpg',
  'img/Mahdawi_Weather.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
