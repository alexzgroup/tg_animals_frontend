const CACHE_NAME = 'tg-animals-v1';
const STATIC_CACHE_NAME = 'tg-animals-static-v1';
const IMAGE_CACHE_NAME = 'tg-animals-images-v1';

// Статические ресурсы для кеширования
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Расширения файлов для кеширования
const CACHEABLE_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Удаляем старые кеши
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== IMAGE_CACHE_NAME && 
                cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Пропускаем не-GET запросы
  if (request.method !== 'GET') {
    return;
  }
  
  // Пропускаем запросы к API
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    return;
  }
  
  // Стратегия кеширования для изображений
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
    return;
  }
  
  // Стратегия кеширования для статических ресурсов
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAssetRequest(request));
    return;
  }
  
  // Стратегия кеширования для HTML страниц
  if (request.destination === 'document') {
    event.respondWith(handleDocumentRequest(request));
    return;
  }
});

// Проверка, является ли запрос изображением
function isImageRequest(request) {
  return request.destination === 'image' || 
         /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(request.url);
}

// Проверка, является ли запрос статическим ресурсом
function isStaticAsset(request) {
  return request.destination === 'script' ||
         request.destination === 'style' ||
         request.destination === 'font' ||
         /\.(js|css|woff|woff2|ttf|eot)$/i.test(request.url);
}

// Обработка запросов изображений
async function handleImageRequest(request) {
  try {
    // Сначала проверяем кеш
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Image served from cache:', request.url);
      return cachedResponse;
    }
    
    // Если нет в кеше, загружаем с сети
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Кешируем успешный ответ
      await cache.put(request, networkResponse.clone());
      console.log('Image cached:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Error handling image request:', error);
    return new Response('Image not available', { status: 404 });
  }
}

// Обработка запросов статических ресурсов
async function handleStaticAssetRequest(request) {
  try {
    // Сначала проверяем кеш
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Если нет в кеше, загружаем с сети
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Кешируем успешный ответ
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Error handling static asset request:', error);
    return new Response('Asset not available', { status: 404 });
  }
}

// Обработка запросов HTML документов
async function handleDocumentRequest(request) {
  try {
    // Сначала пробуем сеть
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Кешируем успешный ответ
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Если сеть недоступна, пробуем кеш
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback на index.html для SPA
    return cache.match('/index.html');
  }
}

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
}); 