/* ============================================================
   sw.js — 서비스워커 제거용 (kill switch)
   ------------------------------------------------------------
   예전에 설치된 서비스워커가 옛 화면을 계속 붙잡아서
   "새 버전을 올려도 안 바뀌는" 문제가 반복됐습니다.
   그래서 오프라인 기능(서비스워커)을 완전히 빼기로 했습니다.

   이 파일은 스스로를 없애는 역할만 합니다:
     1) 저장된 캐시를 모두 지우고
     2) 자기 자신을 등록 해제한 뒤
     3) 열려 있는 화면을 새로고침해서 네트워크에서 최신을 받게 합니다.

   옛 서비스워커가 깔린 기기는 앱을 열 때 이 파일을 자동으로 받아
   한 번에 깨끗해집니다. 그 뒤로는 항상 최신이 바로 뜹니다.
   ============================================================ */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1) 모든 캐시 삭제
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}

    // 2) 자기 자신 등록 해제
    try { await self.registration.unregister(); } catch (e) {}

    // 3) 열려 있는 모든 탭을 새로고침 (네트워크에서 새로 받도록)
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch (e) {}
  })());
});

/* 제거되기 전까지 들어오는 요청은 그냥 네트워크로 (캐시 안 씀) */
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 504 })));
});
