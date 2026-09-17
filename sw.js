const CACHE='pill-counter-v4';
const LOCAL=['localhost','127.0.0.1'].includes(self.location.hostname);
const FILES=['./','./index.html','./style.css','./icon.svg','./manifest.webmanifest','./src/app.js','./src/detector.js','./src/detector-worker.js','./src/history.js','./src/storage.js','./src/sample.js','./vendor/opencv.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>LOCAL?self.skipWaiting():undefined));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pill-counter-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>LOCAL?self.clients.claim():undefined));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(LOCAL||event.request.method!=='GET'||url.origin!==self.location.origin)return;
  // Only app resources are cached. Photos and records never pass through fetch.
  event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
});
