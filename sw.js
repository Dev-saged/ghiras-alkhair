const V='ghiras-1.3.0',FONTS='ghiras-fonts',PAGE='./ghiras-alkhair.html';
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(['./',PAGE])).catch(()=>{}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('ghiras-')&&k!==V&&k!==FONTS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||r.cache==='no-store'||r.headers.has('authorization'))return;const u=new URL(r.url);
if(u.hostname==='raw.githubusercontent.com')return;
if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(caches.open(FONTS).then(async c=>{const hit=await c.match(r);const net=fetch(r).then(res=>{if(res.ok||res.type==='opaque')c.put(r,res.clone());return res}).catch(()=>hit);return hit||net}));return}
if(u.origin!==location.origin)return;
if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(PAGE,cp))}return res}).catch(()=>caches.match(PAGE).then(h=>h||caches.match('./'))));return}
e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res})))});
