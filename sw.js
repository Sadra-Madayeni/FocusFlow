// 1. تغییر ورژن (خیلی مهم برای اینکه مرورگر بفهمه تغییری کرده)
const CACHE_NAME = 'FocusFlow-v1.0';

// 2. آدرس‌دهی دقیق بر اساس پوشه‌ها
const ASSETS = [
  './',                 // صفحه اصلی
  './index.html',       // فایل ایندکس
  './manifest.json',    // مانیفست
  
  // فایل‌های داخل پوشه styles
  './styles/style.css', 
  
  // فایل‌های داخل پوشه scripts (یا js - چک کن اسم پوشه چیه)
  './scripts/script.js', 

  // آیکون‌ها
  './icons/favicon.ico', 

  // عکس‌های رنک (داخل پوشه images)
  './images/rank-1.jpg',
  './images/rank-2.jpg',
  './images/rank-3.jpg',
  './images/rank-4.jpg',
  './images/rank-5.jpg',
  './images/rank-6.jpg'
];

 
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('🚧 شروع بررسی فایل‌ها برای کش...');
      
      for (const asset of ASSETS) {
        try {
          const response = await fetch(asset);
          if (!response.ok) {
            throw new Error(`وضعیت فایل خراب: ${response.status}`);
          }
          await cache.put(asset, response);
          console.log(`✅ فایل پیدا شد و کش شد: ${asset}`);
        } catch (error) {
          console.error(`❌❌❌ فایل پیدا نشد! مشکل همینجاست: ${asset}`, error);
 
        }
      }
      console.log('🏁 تمام شد.');
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('پاک کردن کش قدیمی:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});