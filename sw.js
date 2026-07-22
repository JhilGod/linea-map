const CACHE_NAME = 'lineamap-v1';
const urlsToCache = [
  './',
  './index.html',
  './mapa.css',
  './mapa.js',
  './Logo.jpg'
];

// Instala el Service Worker y guarda los archivos base en la memoria del celular
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercepta las peticiones: Si no hay internet, busca en la memoria
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Devuelve el archivo de la memoria (Caché)
        }
        return fetch(event.request); // Si no está en memoria, usa internet
      })
  );
});