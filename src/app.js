import {OpenCVDetector} from './detector.js';
import {History,getCorrections} from './history.js';
import {saveSample,readSamples,clearSamples,summarize} from './storage.js';
import {createSample} from './sample.js';

const $=id=>document.getElementById(id), canvas=$('canvas'), ctx=canvas.getContext('2d');
const base=document.createElement('canvas'), detector=new OpenCVDetector(), history=new History();
let hasPhoto=false,busy=false,automatic=[],analysis=null,mode='inspect',sourceBlob=null,sessionId=null,isPractice=false,stream=null,cameraGeneration=0;
let started=0,revision=0,confirmedRevision=-1,operation=0,saving=false,originalWidth=0,originalHeight=0;
const status=message=>$('status').textContent=message;
const total=()=>history.current.objects.length+history.current.offset;
const validCount=value=>value!==''&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=9999;
function invalidate(){revision++;$('reviewed').checked=false;confirmedRevision=-1;}
function draw(){
  if(!hasPhoto)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base,0,0);
  const scale=canvas.width/Math.max(1,canvas.getBoundingClientRect().width), font=Math.max(12,12*scale);
  history.current.objects.forEach((o,i)=>{
    ctx.strokeStyle=o.source==='manual'?'#ffc861':'#5dffbe';ctx.lineWidth=Math.max(2,2*scale);ctx.beginPath();
    if(o.contour?.length){o.contour.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}else ctx.arc(o.x,o.y,o.r,0,Math.PI*2);
    ctx.stroke();
    if($('numbers').checked){const label=String(i+1);ctx.font=`bold ${font}px system-ui`;const w=ctx.measureText(label).width+10*scale;ctx.fillStyle='#063f35e8';ctx.fillRect(o.x-w/2,o.y-font*.65,w,font*1.35);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,o.x,o.y+font*.03);}
  });
}
function render(){
  const n=total(), targetValue=$('target').value, target=Number(targetValue), valid=validCount(targetValue)&&target>0;
  $('count').textContent=hasPhoto?n:'—';$('auto-count').textContent=hasPhoto?(analysis?automatic.length:'미완료'):'—';
  $('offset').textContent=history.current.offset>0?`+${history.current.offset}`:history.current.offset;
  const diff=n-target,comparison=$('comparison');comparison.className='comparison';
  if(!hasPhoto)comparison.textContent='사진을 준비해주세요';
  else if(busy)comparison.textContent='사진 분석 중…';
  else if(!valid)comparison.textContent='목표를 1~9999정으로 입력하세요';
  else{comparison.textContent=diff===0?`목표 ${target}정과 일치`:`목표 ${target}정 · ${Math.abs(diff)}정 ${diff<0?'부족':'초과'}`;comparison.classList.add(diff===0?'match':diff<0?'short':'over');}
  $('mobile-summary').hidden=!hasPhoto;$('mobile-count').textContent=`${n}정`;$('mobile-comparison').textContent=comparison.textContent;
  document.querySelectorAll('[data-target]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.target)===target)));
  document.querySelectorAll('[data-mode]').forEach(b=>{b.disabled=!hasPhoto||busy||saving;b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  $('undo').disabled=busy||saving||history.index===0;$('redo').disabled=busy||saving||history.index===history.states.length-1;
  for(const id of ['plus','minus','reanalyze','zoom','fit','reviewed'])$(id).disabled=!hasPhoto||busy||saving;
  $('minus').disabled||=n<=0;$('plus').disabled||=n>=9999;
  for(const id of ['camera','upload','sample'])$(id).disabled=busy||saving;
  $('confirm').disabled=!hasPhoto||busy||saving||!valid||!$('reviewed').checked||confirmedRevision===revision;
  $('confirm').textContent=saving?'저장 중…':confirmedRevision===revision?'✓ 확인 완료':'확인 완료';
  $('edit-hint').textContent=mode==='add'?'놓친 알약의 중심을 터치하면 번호가 추가됩니다.':mode==='delete'?'삭제할 윤곽 또는 번호를 터치하세요.':hasPhoto?'확대 후 화면을 밀어 검수하세요. 수정할 때는 추가·삭제 모드를 선택하세요.':'사진을 불러오면 각 알약에 번호와 윤곽이 표시됩니다.';
  if(analysis){const c=getCorrections(automatic,history.current);$('diagnostics').textContent=JSON.stringify({automaticCount:automatic.length,finalCount:n,FP:c.falsePositives.length,FN:c.falseNegatives.length,countAdjustment:c.countAdjustment,objectGroundTruthComplete:c.objectGroundTruthComplete,processingTimeMs:analysis.processingTimeMs,quality:analysis.quality},null,2);}
  draw();
}
function modify(state){history.commit(state);invalidate();render();}
async function ask(title,message){
  $('action-title').textContent=title;$('action-message').textContent=message;
  return new Promise(resolve=>{const dialog=$('action-dialog');dialog.returnValue='cancel';dialog.onclose=()=>resolve(dialog.returnValue==='ok');$('action-ok').onclick=()=>dialog.close('ok');$('action-cancel').onclick=()=>dialog.close('cancel');dialog.showModal();});
}
async function canReplace(){return !hasPhoto||confirmedRevision===revision||history.index===0||await ask('새 사진으로 시작할까요?','현재 사진의 저장하지 않은 수정은 사라집니다.');}
async function acceptBlob(blob,practice=false){
  if(!blob)return;
  if(blob.size>35*1024*1024){status('35MB 이하의 사진을 선택해주세요.');return;}
  if(!await canReplace())return;
  let bitmap;
  try{
    bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'});
    stopCamera();detector.cancel();operation++;
    originalWidth=bitmap.width;originalHeight=bitmap.height;
    const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
    base.width=Math.max(1,Math.round(bitmap.width*ratio));base.height=Math.max(1,Math.round(bitmap.height*ratio));
    const bctx=base.getContext('2d');bctx.fillStyle='#fff';bctx.fillRect(0,0,base.width,base.height);bctx.drawImage(bitmap,0,0,base.width,base.height);bitmap.close();bitmap=null;
    canvas.width=base.width;canvas.height=base.height;sourceBlob=blob;sessionId=crypto.randomUUID();isPractice=practice;started=Date.now();
    hasPhoto=true;automatic=[];analysis=null;history.reset({objects:[],offset:0});mode='inspect';invalidate();
    $('empty').hidden=true;$('stage').hidden=false;$('zoom').value=1;setZoom();$('ground-truth').value='';
    $('save-image').checked=false;
    await analyze();
  }catch(error){bitmap?.close();status('사진을 열지 못했습니다. JPG, PNG, WebP 사진으로 다시 시도해주세요.');}
}
async function analyze(){
  const token=++operation;busy=true;invalidate();status('기기에서 사진을 분석하고 있습니다…');$('quality').hidden=true;render();
  try{
    const result=await detector.analyze(base.getContext('2d').getImageData(0,0,base.width,base.height),{sensitivity:Number($('sensitivity').value)});
    if(token!==operation)return;
    analysis=result;automatic=structuredClone(result.objects);history.reset({objects:result.objects,offset:0});
    status(`${automatic.length}개를 자동 감지했습니다. 번호와 실제 알약을 대조해주세요.${isPractice?' 연습용 합성 이미지입니다.':''}`);
    $('quality').textContent=result.warnings.join(' ');$('quality').hidden=!result.warnings.length;
  }catch(error){if(token===operation)status(error.message);}
  finally{if(token===operation){busy=false;render();}}
}
function setZoom(){const zoom=Number($('zoom').value),viewer=$('viewer');const fit=hasPhoto?Math.min(viewer.clientWidth,viewer.clientHeight*canvas.width/canvas.height):viewer.clientWidth;$('stage').style.width=`${fit*zoom}px`;$('zoom-label').textContent=`${Math.round(zoom*100)}%`;requestAnimationFrame(draw);}
function stopCamera(){cameraGeneration++;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;if($('camera-dialog').open)$('camera-dialog').close();}
async function openCamera(){
  if(!window.isSecureContext){status('카메라는 HTTPS에서 사용할 수 있습니다. 사진 불러오기를 이용해주세요.');return;}
  if(!navigator.mediaDevices?.getUserMedia){$('camera-file').click();return;}
  stopCamera();const generation=cameraGeneration;
  $('shutter').disabled=true;$('camera-dialog').showModal();
  try{
    const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}}});
    if(generation!==cameraGeneration){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;$('video').srcObject=stream;await $('video').play();$('shutter').disabled=false;
  }catch(error){if(generation!==cameraGeneration)return;stopCamera();status(error.name==='NotAllowedError'?'카메라 권한이 거부되었습니다. 주소창의 사이트 권한에서 카메라를 허용하거나 사진을 불러오세요.':'카메라를 사용할 수 없습니다. 다른 앱에서 카메라를 닫거나 사진 불러오기를 이용해주세요.');}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function refreshStats(){try{const s=summarize(await readSamples());$('stats').textContent=s.samples?`확인 기록 ${s.samples}건 · Exact Count Accuracy ${(s.exactCountAccuracy*100).toFixed(1)}% (${s.exact}/${s.samples}) · 연습 ${s.practice}건 제외`:`실제 사진의 저장 기록이 없습니다.${s.practice?` 연습 기록 ${s.practice}건은 통계에서 제외됩니다.`:''}`;}catch{$('stats').textContent='이 브라우저에서 로컬 저장소를 열 수 없습니다. 저장 없이 검수할 수 있습니다.';}}

$('upload').onclick=()=>$('file').click();
for(const id of ['file','camera-file'])$(id).onchange=e=>{const file=e.target.files[0];e.target.value='';acceptBlob(file);};
$('sample').onclick=()=>createSample().toBlob(blob=>acceptBlob(blob,true),'image/png');
$('download-sample').onclick=()=>createSample().toBlob(blob=>download(blob,'pill-counter-practice-12.png'),'image/png');
$('camera').onclick=openCamera;$('camera-close').onclick=stopCamera;
$('camera-dialog').addEventListener('cancel',stopCamera);
$('native-camera').onclick=()=>{stopCamera();$('camera-file').click();};
$('shutter').onclick=()=>{const video=$('video');if(!video.videoWidth)return;const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);stopCamera();c.toBlob(blob=>acceptBlob(blob),'image/jpeg',.95);};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});window.addEventListener('pagehide',stopCamera);
document.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>{$('target').value=b.dataset.target;invalidate();render();});
$('target').oninput=()=>{invalidate();render();};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render();});
$('zoom').oninput=setZoom;$('fit').onclick=()=>{$('zoom').value=1;setZoom();$('viewer').scrollTo(0,0);};$('numbers').onchange=draw;
new ResizeObserver(()=>setZoom()).observe($('viewer'));
let pointerStart=null;
canvas.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointercancel',()=>{pointerStart=null;});
canvas.addEventListener('pointerup',e=>{
  if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>8)return;
  pointerStart=null;if(busy||saving||mode==='inspect')return;
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height;
  const state=structuredClone(history.current),hit=state.objects.map((o,i)=>({i,d:Math.hypot(o.x-x,o.y-y),r:Math.max(o.r,18*canvas.width/rect.width)})).filter(o=>o.d<o.r).sort((a,b)=>a.d-b.d)[0];
  if(mode==='delete'){if(!hit){status('삭제할 번호 가까이를 터치해주세요.');return;}if(total()<=0)return;state.objects.splice(hit.i,1);}
  else{if(total()>=9999)return;if(hit&&hit.d<8*canvas.width/rect.width){status('이미 번호가 있는 위치입니다.');return;}state.objects.push({id:crypto.randomUUID(),x,y,r:Math.max(10,canvas.width*.016),source:'manual'});}
  modify(state);
});
$('plus').onclick=()=>modify({...history.current,offset:history.current.offset+1});$('minus').onclick=()=>modify({...history.current,offset:history.current.offset-1});
$('undo').onclick=()=>{history.undo();invalidate();render();};$('redo').onclick=()=>{history.redo();invalidate();render();};
$('reanalyze').onclick=async()=>{if(history.index>0&&!await ask('다시 분석할까요?','번호 추가·삭제와 수량 보정이 초기화됩니다.'))return;await analyze();};
$('sensitivity').oninput=()=>$('sensitivity-label').textContent=Number($('sensitivity').value).toFixed(2);
$('reviewed').onchange=render;
$('save-stats').onchange=()=>{$('save-image').disabled=!$('save-stats').checked;if(!$('save-stats').checked)$('save-image').checked=false;confirmedRevision=-1;render();};
$('save-image').onchange=()=>{confirmedRevision=-1;render();};
$('test-mode').onchange=()=>{$('test-panel').hidden=!$('test-mode').checked;};
$('ground-truth').oninput=()=>{confirmedRevision=-1;render();};
$('confirm').onclick=async()=>{
  const gtRaw=$('test-mode').checked?$('ground-truth').value:'';
  if(gtRaw!==''&&!validCount(gtRaw)){status('정답 수량을 0~9999의 정수로 입력해주세요.');return;}
  if(!$('reviewed').checked)return;
  if(!$('save-stats').checked){confirmedRevision=revision;status(`${total()}정 검수를 완료했습니다. 사진·기록을 저장하지 않았습니다.`);render();return;}
  const savedRevision=revision;saving=true;render();
  try{
    const corrections=getCorrections(automatic,history.current);
    const gt=gtRaw===''?total():Number(gtRaw);
    const sample={schemaVersion:1,sampleId:sessionId,createdAt:new Date(started).toISOString(),confirmedAt:new Date().toISOString(),verifiedByUser:true,isPractice,groundTruthSource:gtRaw===''?'user-confirmed-final-count':'independent-manual-count',groundTruthCount:gt,automaticCount:analysis?automatic.length:null,finalCount:total(),targetCount:Number($('target').value),automaticObjects:automatic,finalObjects:history.current.objects,corrections,falsePositiveCount:corrections.falsePositives.length,falseNegativeCount:corrections.falseNegatives.length,objectGroundTruthComplete:corrections.objectGroundTruthComplete&&gt===total(),imageWidth:base.width,imageHeight:base.height,imageSaved:$('save-image').checked,detector:analysis?.detector||null,processingTimeMs:analysis?.processingTimeMs||null,imageQuality:analysis?.quality||null,confidence:null};
    sample.originalImageWidth=originalWidth;sample.originalImageHeight=originalHeight;sample.coordinateSpace='analysis-pixels';
    await saveSample(sample,$('save-image').checked?sourceBlob:null);confirmedRevision=savedRevision;
    status(`${sample.finalCount}정 검수 기록을 이 기기에 저장했습니다.${sample.imageSaved?' 사진 포함.':' 사진은 저장하지 않았습니다.'}`);await refreshStats();
  }catch{status('저장하지 못했습니다. 저장 공간 또는 브라우저 권한을 확인하고 다시 시도해주세요.');}
  finally{saving=false;render();}
};
$('export').onclick=async()=>{try{const samples=await readSamples();download(new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),note:'이미지 파일은 포함되지 않음. 사용자 검수 데이터이며 임상 검증 자료가 아닙니다.',summary:summarize(samples),samples},null,2)],{type:'application/json'}),'pill-counter-records.json');}catch{status('기록을 내보내지 못했습니다.');}};
$('clear').onclick=async()=>{if(!await ask('저장 기록을 삭제할까요?','이 기기에 저장한 모든 검수 기록과 사진이 삭제됩니다. 복구할 수 없습니다.'))return;try{await clearSamples();await refreshStats();status('이 기기의 저장 기록과 사진을 삭제했습니다.');}catch{status('기록을 삭제하지 못했습니다.');}};
if(new URLSearchParams(location.search).has('test')){$('test-mode').checked=true;$('test-panel').hidden=false;$('records').open=true;}
refreshStats();render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
