/* global cv */
let ready;
function loadCV() {
  return ready ||= new Promise((resolve, reject) => {
    self.Module = {onRuntimeInitialized: () => resolve({cv:self.cv}), onAbort: reject};
    try {
      importScripts('../vendor/opencv.js');
      // Emscripten 4.9 exposes a self-resolving thenable: wrap it, never resolve it directly.
      if (self.cv?.then) self.cv.then(module => resolve({cv:module}), reject);
      else if (self.cv?.Mat) resolve({cv:self.cv});
    } catch (error) { reject(error); }
  });
}
self.onmessage = async ({data: {imageData, parameters}}) => {
  const mats = []; const keep = x => (mats.push(x), x);
  try {
    const {cv} = await loadCV(); const start = performance.now();
    const {width:w, height:h, data:pixels} = imageData;
    // Robust border background estimate. Keep pills away from the image border.
    const channels = [[], [], []];
    for (let y=0;y<h;y+=5) for (let x=0;x<w;x+=5) {
      if (x>w*.04 && x<w*.96 && y>h*.04 && y<h*.96) continue;
      const i=(y*w+x)*4; channels.forEach((a,c)=>a.push(pixels[i+c]));
    }
    const background=channels.map(a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)]);
    const diff=keep(new cv.Mat(h,w,cv.CV_8UC1)); let brightness=0, gradient=0;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const i=(y*w+x)*4;
      diff.data[y*w+x]=Math.min(255,Math.hypot(pixels[i]-background[0],pixels[i+1]-background[1],pixels[i+2]-background[2])/Math.sqrt(3));
      brightness+=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
      if(x>0) gradient+=Math.abs(pixels[i]-pixels[i-4]);
    }
    const smooth=keep(new cv.Mat()), mask=keep(new cv.Mat());
    cv.GaussianBlur(diff,smooth,new cv.Size(5,5),0);
    const otsu=cv.threshold(smooth,mask,0,255,cv.THRESH_BINARY|cv.THRESH_OTSU);
    const threshold=Math.max(12,otsu/parameters.sensitivity);
    cv.threshold(smooth,mask,threshold,255,cv.THRESH_BINARY);
    const kernel=keep(cv.getStructuringElement(cv.MORPH_ELLIPSE,new cv.Size(3,3)));
    cv.morphologyEx(mask,mask,cv.MORPH_CLOSE,kernel);
    cv.morphologyEx(mask,mask,cv.MORPH_OPEN,kernel);
    const contours=keep(new cv.MatVector()), hierarchy=keep(new cv.Mat());
    cv.findContours(mask,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
    const objects=[]; let edgeCount=0;
    for(let i=0;i<contours.size();i++) {
      const contour=contours.get(i);
      try {
        const area=cv.contourArea(contour), rect=cv.boundingRect(contour), perimeter=cv.arcLength(contour,true);
        if(area<Math.max(28,w*h*.00007)||area>w*h*.12) continue;
        if(rect.x<2||rect.y<2||rect.x+rect.width>=w-2||rect.y+rect.height>=h-2){edgeCount++;continue;}
        const circularity=4*Math.PI*area/(perimeter*perimeter);
        if(circularity<.12||area/(rect.width*rect.height)<.25)continue;
        const moments=cv.moments(contour);
        const points=[]; for(let j=0;j<contour.data32S.length;j+=2)points.push([contour.data32S[j],contour.data32S[j+1]]);
        objects.push({id:`auto-${i}`,x:moments.m10/moments.m00,y:moments.m01/moments.m00,r:Math.sqrt(area/Math.PI),area,contour:points,source:'auto'});
      } finally {contour.delete();}
    }
    objects.sort((a,b)=>a.y-b.y||a.x-b.x);
    const areas=objects.map(o=>o.area).sort((a,b)=>a-b), median=areas[Math.floor(areas.length/2)]||0;
    const warnings=[];
    if(!objects.length)warnings.push('검출된 알약이 없습니다. 배경 대비를 높이거나 누락 추가로 직접 표시하세요.');
    if(edgeCount)warnings.push('화면 가장자리에 걸친 물체가 제외되었습니다. 전체 알약이 보이도록 다시 촬영하세요.');
    if(objects.some(o=>o.area>median*2.1))warnings.push('큰 윤곽이 있습니다. 붙어 있는 알약이 하나로 계산되지 않았는지 확인하세요.');
    if(brightness/(w*h)<35)warnings.push('사진이 어둡습니다. 조명을 밝게 하고 다시 촬영하세요.');
    if(otsu<18)warnings.push('배경과 알약의 대비가 낮습니다. 다른 색의 무광 배경을 권장합니다.');
    self.postMessage({objects,processingTimeMs:Math.round(performance.now()-start),detector:{type:'opencv',version:'4.9.0',pipelineVersion:'1.0.0',parameters:{...parameters,threshold,minArea:Math.max(28,w*h*.00007)}},quality:{brightness:Math.round(brightness/(w*h)),edgeEnergy:Math.round(gradient/(w*h)*100)/100,background,otsu},warnings});
  } catch(error) {self.postMessage({error:'자동 분석에 실패했습니다. 재분석하거나 수동으로 표시해주세요. '+(error.message||'')});}
  finally {mats.reverse().forEach(m=>m.delete());}
};
