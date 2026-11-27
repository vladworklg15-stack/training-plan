import {exerciseVideos} from './videos.js';
import {exerciseIllustrations} from './illustrations.js?v=9';

const name='training-week-v16';
const scope=self.registration.scope;
const absolute=path=>new URL(path,scope).href;
const shell=['./index.html','./app.js?v=16','./videos.js','./illustrations.js?v=9','./kettlebells.js','./exercises.js?v=9','./schedule.js?v=9','./workout.js?v=16','./style.css?v=13','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const assets=new Set(shell.map(absolute));
const media=new Set([
  ...Object.values(exerciseVideos).filter(clip=>clip.file).map(clip=>clip.file),
  './timer-core-sport-12.m4a'
].map(absolute));
const illustrations=new Set(Object.values(exerciseIllustrations).map(drawing=>absolute(drawing.file)));

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(name).then(async cache=>{
    await cache.addAll([...assets]);
    await self.skipWaiting();
    await Promise.allSettled([...media,...illustrations].map(asset=>cache.add(asset)));
  }));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('training-week-')&&key!==name).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

async function cachedMedia(request){
  const cached=await caches.match(request.url);
  if(!cached)return fetch(request);
  const range=request.headers.get('Range');
  if(!range)return cached;
  const match=range.match(/^bytes=(\d*)-(\d*)$/);
  if(!match||(!match[1]&&!match[2]))return fetch(request);
  const body=await cached.blob();
  const total=body.size;
  const start=match[1]?Number(match[1]):Math.max(0,total-Number(match[2]));
  const end=match[1]&&match[2]?Math.min(total-1,Number(match[2])):total-1;
  if(start>=total||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${total}`}});
  const part=body.slice(start,end+1);
  return new Response(part,{status:206,headers:{
    'Content-Type':request.url.endsWith('.m4a')?'audio/mp4':cached.headers.get('Content-Type')||'video/mp4',
    'Content-Length':String(part.size),
    'Content-Range':`bytes ${start}-${end}/${total}`,
    'Accept-Ranges':'bytes'
  }});
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==location.origin)return;
  if(media.has(request.url)){
    event.respondWith(cachedMedia(request));
  }else if(request.mode==='navigate'&&new URL(request.url).pathname===new URL(scope).pathname){
    event.respondWith(fetch(request).catch(()=>caches.match(absolute('./index.html'))));
  }else if(assets.has(request.url)||illustrations.has(request.url)){
    event.respondWith(caches.match(request).then(response=>response||fetch(request)));
  }
});
