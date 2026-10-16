// Service worker：讓網站可加到主畫面，並在離線時顯示最後一次載入的資料。
// 改了快取策略請把 VERSION 加一，舊快取會在啟用時清掉。
const VERSION = 'v2';
const STATIC = `static-${VERSION}`; // 檔名含雜湊的靜態檔：快取優先
const PAGES = `pages-${VERSION}`; // 頁面：網路優先，離線用快取
const DATA = `data-${VERSION}`; // 事件與宮廟資料：網路優先，離線用快取
const TILES = `tiles-${VERSION}`; // 地圖底圖：先給快取再背景更新，上限 600 筆
const TILE_LIMIT = 600;
const PRECACHE = ['/', '/api/incidents', '/api/temples'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES).then((c) => c.add('/')).catch(() => {})
      .then(() => caches.open(DATA))
      .then((c) => c.addAll(PRECACHE.slice(1)))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC, PAGES, DATA, TILES]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(request, { ignoreSearch: cacheName === PAGES })) || (fallbackUrl && (await cache.match(fallbackUrl)));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((k) => cache.delete(k)));
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(event.request);
  const update = fetch(event.request)
    .then((res) => {
      if (res.ok) {
        cache.put(event.request, res.clone()).then(() => trim(TILES, TILE_LIMIT));
      }
      return res;
    })
    .catch(() => hit);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/maplibre/') || url.pathname.startsWith('/icons/')) {
      event.respondWith(cacheFirst(request));
    } else if (url.pathname.startsWith('/data/') || url.pathname === '/api/incidents' || url.pathname === '/api/temples') {
      event.respondWith(networkFirst(request, DATA));
    } else if (request.mode === 'navigate' && !url.pathname.startsWith('/admin')) {
      event.respondWith(networkFirst(request, PAGES, '/'));
    }
    return;
  }

  if (url.hostname === 'tiles.openfreemap.org') event.respondWith(staleWhileRevalidate(event));
});
