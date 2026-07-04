const CACHE_NAME = 'notepad-pwa-v3';  // 更新版本号
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/peerjs.min.js',
    './js/app.js',
    './js/p2p.js',
    './js/sync.js',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// 安装Service Worker - 立即激活
self.addEventListener('install', event => {
    self.skipWaiting();  // 跳过等待，立即激活
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('新缓存已创建');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('缓存失败:', err);
            })
    );
});

// 激活Service Worker - 清理旧缓存并控制所有页面
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('删除旧缓存:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 立即控制所有客户端页面
            return self.clients.claim();
        })
    );
});

// 拦截请求 - 网络优先策略
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // 网络请求成功，更新缓存
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // 网络失败，使用缓存
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // 如果是HTML请求，返回缓存的index.html
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// 接收消息（可用于手动触发更新）
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
