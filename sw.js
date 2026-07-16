/* ============================================================
   sw.js — 오프라인 지원 (Service Worker)
   ------------------------------------------------------------
   서가 구석이나 와이파이가 안 터지는 곳에서도 앱이 열리게 해줍니다.
   원리: 최초 방문 때 파일들을 폰에 저장해두고, 다음부터는 그걸 씁니다.

   ⚠️ 파일을 새로 추가하면 아래 FILES 목록에도 꼭 추가하세요!
      (안 그러면 "오프라인에서만 안 되는" 이상한 증상이 생겨요)
   ============================================================ */

const CACHE = 'library-explorer-v1';   // 내용을 크게 바꿨으면 v2, v3... 으로 올리세요

const FILES = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './storage.js',
  './barcode.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* 설치: 파일들을 폰에 저장 */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())     // 새 버전을 바로 적용
  );
});

/* 활성화: 옛날 버전 캐시 청소 */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* 요청 가로채기 — "일단 저장된 걸 보여주고, 몰래 새 걸 받아두기" 방식
   (stale-while-revalidate)

   이 방식을 고른 이유: 화면은 항상 즉시 뜨면서(오프라인 OK),
   data.js 를 고치면 다음번에 열 때 반영됩니다.
   순수 캐시 방식이면 파일을 고쳐도 영영 옛날 게 나와서 초보자가 크게 헤매요. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;   // 외부 요청은 그대로

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);       // 오프라인이면 저장된 걸로

      return cached || fresh;       // 저장된 게 있으면 즉시, 없으면 받아서
    })
  );
});
