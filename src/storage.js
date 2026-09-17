const DB='PharmacyPillCounter';
let opening;
function open() {
  return opening ||= new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('samples',{keyPath:'sampleId'});req.result.createObjectStore('images');};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>{opening=null;reject(req.error);};
  });
}
export async function saveSample(sample,image) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['samples','images'],'readwrite');
    tx.objectStore('samples').put(sample);
    image?tx.objectStore('images').put(image,sample.sampleId):tx.objectStore('images').delete(sample.sampleId);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('저장이 취소되었습니다.'));
  });
}
export async function readSamples() {
  const db=await open();
  return new Promise((resolve,reject)=>{const r=db.transaction('samples').objectStore('samples').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export async function clearSamples() {
  const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(['samples','images'],'readwrite');tx.objectStore('samples').clear();tx.objectStore('images').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
export function summarize(samples) {
  const real=samples.filter(s=>!s.isPractice&&s.verifiedByUser&&s.automaticCount!==null);
  const exact=real.filter(s=>s.automaticCount===s.groundTruthCount).length;
  return {samples:real.length,exact,exactCountAccuracy:real.length?exact/real.length:null,practice:samples.filter(s=>s.isPractice).length,excluded:samples.length-real.length};
}
