// Deterministic synthetic fixture. It is never used as evidence of real-photo accuracy.
export function createSample() {
  const c=document.createElement('canvas');c.width=960;c.height=720;const x=c.getContext('2d');
  x.fillStyle='#203f4b';x.fillRect(0,0,960,720);
  for(let i=0;i<12;i++){
    x.save();x.translate(150+(i%4)*220,140+Math.floor(i/4)*220);x.rotate((i%3-1)*.4);
    x.fillStyle=i%3===0?'#f1d298':i%3===1?'#f0f3ed':'#d8eaf1';x.beginPath();x.ellipse(0,0,43,i%2?27:40,0,0,Math.PI*2);x.fill();
    x.strokeStyle='#aaaaa0';x.lineWidth=2;x.beginPath();x.moveTo(-24,0);x.lineTo(24,0);x.stroke();x.restore();
  }
  return c;
}
