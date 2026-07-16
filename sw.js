/* ============================================================
   sw.js — 오프라인 지원 (Service Worker)
   ------------------------------------------------------------
   서가 구석이나 와이파이가 안 터지는 곳에서도 앱이 열리게 해줍니다.
   원리: 최초 방문 때 파일들을 폰에 저장해두고, 다음부터는 그걸 씁니다.

   ⚠️ 파일을 새로 추가하면 아래 FILES 목록에도 꼭 추가하세요!
      (안 그러면 "오프라인에서만 안 되는" 이상한 증상이 생겨요)
   ============================================================ */

const CACHE = 'library-explorer-v2';   // 내용을 크게 바꿨으면 v3, v4... 으로 올리세요

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
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './images/bookcart.png'
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

/* 요청 가로채기 — "인터넷을 먼저 보고, 안 되면 저장된 걸 쓰기" 방식
   (network-first, 2초 안에 응답 없으면 캐시)

   ⚠️ 예전에는 "저장된 걸 먼저 보여주기(stale-while-revalidate)" 였는데
      내용을 고쳐도 새로고침 한 번으로는 반영되지 않아서
      "왜 안 바뀌지?" 하고 헤매게 만들었습니다. 그래서 바꿨어요.

   지금 방식이면:
     - 인터넷이 되면  → 항상 최신 내용 (data.js 고치면 새로고침 한 번에 반영)
     - 인터넷이 안 되면 → 2초 뒤 저장된 내용 (서가 구석에서도 열림)             */
const TIMEOUT = 2000;

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;   // 외부 요청은 그대로

  e.respondWith((async () => {
    const cached = await caches.match(e.request);

    try {
      // 인터넷에서 받아오기 (단, 2초까지만 기다림)
      const res = await Promise.race([
        fetch(e.request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('느림')), TIMEOUT))
      ]);
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));   // 다음 오프라인을 위해 저장
      }
      return res;
    } catch (err) {
      // 인터넷이 없거나 너무 느리면 저장해둔 걸로
      if (cached) return cached;
      throw err;
    }
  })());
});
