import {OpenCVDetector} from '../src/detector.js';
import {createSample} from '../src/sample.js';
import {saveSample,readSamples} from '../src/storage.js';
import {reflectionFixture} from './reflection-fixture.js';
const out=document.getElementById('results');
document.getElementById('run').onclick=async()=>{
 const results=[],id='test-'+crypto.randomUUID();
 const check=(ok,name)=>{if(!ok)throw Error(name);results.push('PASS '+name);out.textContent=results.join('\n');};
 document.getElementById('run').disabled=true;
 try{
  const detector=new OpenCVDetector(),c=createSample();
  let r=await detector.analyze(c.getContext('2d').getImageData(0,0,c.width,c.height),{sensitivity:.8});
  check(r.objects.length===12,'OpenCV worker: synthetic 12 objects');
  c.getContext('2d').fillStyle='#f7f7f7';c.getContext('2d').fillRect(0,0,c.width,c.height);
  r=await detector.analyze(c.getContext('2d').getImageData(0,0,c.width,c.height),{sensitivity:1});
  check(r.objects.length===0&&r.warnings.length>0,'Blank image: 0 objects + warning');
  const x=c.getContext('2d');x.fillStyle='#234956';for(let i=0;i<6;i++){x.beginPath();x.ellipse(120+i%3*300,160+Math.floor(i/3)*300,38,26,0,0,7);x.fill();}
  r=await detector.analyze(x.getImageData(0,0,c.width,c.height),{sensitivity:1});
  check(r.objects.length===6,'Light background, dark objects: 6 objects');
  const reflections=reflectionFixture(),rx=reflections.getContext('2d');
  const without=await detector.analyze(rx.getImageData(0,0,960,720),{sensitivity:.8,suppressReflections:false});
  const withFilter=await detector.analyze(rx.getImageData(0,0,960,720),{sensitivity:.8,suppressReflections:true});
  check(without.objects.length>withFilter.objects.length&&withFilter.objects.length===3&&withFilter.objects.every(o=>Math.abs(o.x-160)<5),'Reflection fixture: '+without.objects.length+' → '+withFilter.objects.length+'; 3 crisp pills retained');
  await saveSample({sampleId:id,isPractice:true,automaticCount:12,finalCount:12},null);
  const open=indexedDB.open('PharmacyPillCounter',1);const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
  const image=()=>new Promise((resolve,reject)=>{const q=db.transaction('images').objectStore('images').get(id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  check((await image())===undefined,'Default image OFF: no blob persisted');
  const png=await new Promise(resolve=>createSample().toBlob(resolve));
  await saveSample({sampleId:id,isPractice:true,automaticCount:12,finalCount:13},png);
  check((await image())?.size===png.size,'Opt-in image blob persists');
  check((await readSamples()).filter(s=>s.sampleId===id).length===1,'Same session overwrites; no duplicate');
  await saveSample({sampleId:id,isPractice:true,automaticCount:12,finalCount:12},null);
  check((await image())===undefined,'Opt-out removes previously saved image');
  const tx=db.transaction(['samples','images'],'readwrite');tx.objectStore('samples').delete(id);tx.objectStore('images').delete(id);
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  results.push('8 checks passed. Temporary test record removed.');
 }catch(error){results.push('FAIL '+error.message);}
 finally{out.textContent=results.join('\n');document.getElementById('run').disabled=false;}
};
