/**
 * Service Worker - Xiang 个人网站 PWA 离线支持
 *
 * 缓存策略：缓存优先（Cache First）
 * - 首次访问时缓存核心资源，后续访问优先从缓存读取
 * - 缓存未命中时回退到网络请求，并将成功响应写入缓存
 * - 网络请求失败时回退到首页，保证离线可用性
 *
 * 生命周期：install（预缓存）→ activate（清理旧缓存）→ fetch（拦截请求）
 */

// 缓存版本号（与网站版本对齐，便于发布新版本时清理旧缓存）
const CACHE_NAME = 'xiang-v1.8.3-v1';

// 核心资源列表（首页、子页面、样式、脚本、图标）
// 这些资源在 install 阶段预缓存，确保离线时可访问
const CORE_ASSETS = [
  './index.html',
  './page2/about.html',
  './page2/ai.html',
  './page2/project-details.html',
  './css/styles.css',
  './css/project-page.css',
  './css/about-page.css',
  './js/main.js',
  './js/galaxy.js',
  './js/now-stars.js',
  './js/skills-smoke.js',
  './js/cam-info.js',
  './js/sub-page.js',
  './js/project-galaxy.js',
  './images/head-icon.webp'
];

// install 事件：预缓存核心资源，跳过等待立即激活
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 逐个缓存以避免单条资源失败导致整体 reject
      // 使用 Promise.all + catch 实现容错：单个资源失败不影响其他资源
      return Promise.all(
        CORE_ASSETS.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn('[SW] 缓存失败：', url, err);
          });
        })
      );
    }).then(() => {
      // 跳过等待，新 SW 立即接管（无需等待旧 SW 释放）
      return self.skipWaiting();
    })
  );
});

// activate 事件：清理旧版本缓存并接管所有客户端
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // 删除所有不等于当前 CACHE_NAME 的旧缓存
      // 通过版本号变更触发旧缓存清理，确保用户获取最新资源
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] 删除旧缓存：', key);
            return caches.delete(key);
          }
          return undefined;
        })
      );
    }).then(() => {
      // 立即接管所有未受控制的客户端（包括旧标签页）
      return self.clients.claim();
    })
  );
});

// fetch 事件：缓存优先策略
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 仅处理同源 GET 请求（跳过 POST/PUT 等非安全请求和跨域资源）
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 缓存命中：直接返回缓存响应（最快路径）
      if (cachedResponse) {
        return cachedResponse;
      }

      // 未命中：发起网络请求
      return fetch(request)
        .then((networkResponse) => {
          // 网络成功：缓存响应副本后返回
          // 仅缓存有效响应（status 200 且 type basic），避免缓存错误页或重定向
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch((err) => {
                console.warn('[SW] 写入缓存失败：', request.url, err);
              });
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          // 网络失败：回退到首页（离线兜底，保证用户至少能看到首页）
          console.warn('[SW] 网络请求失败，回退首页：', request.url, err);
          return caches.match('./index.html');
        });
    })
  );
});
