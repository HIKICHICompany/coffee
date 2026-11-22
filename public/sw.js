// 電波がない場所でも開けるように、画面の部品を控えておく。
// 中身を変えたら VERSION を上げる。
const VERSION = 'coffee-note-v11';
const SHELL = ['/', '/index.html', '/style.css', '/js/app.js', '/js/flavors.js', '/js/charts.js', '/js/db.js', '/js/covers.js', '/js/bgm.js', '/js/share.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 新しい版を優先し、つながらないときだけ控えを使う
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/audio/')) return;   // 音声は途中から読むので控えない
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.status === 200) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
