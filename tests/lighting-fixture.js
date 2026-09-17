export function lightingFixture(){
  const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');
  const gradient=x.createLinearGradient(0,0,800,600);gradient.addColorStop(0,'#626262');gradient.addColorStop(1,'#bbbbbb');x.fillStyle=gradient;x.fillRect(0,0,800,600);
  // Small pills spread over different local backgrounds.
  x.fillStyle='#f2f2ee';for(const [a,b]of [[120,100],[660,140],[140,480],[650,500]]){x.beginPath();x.ellipse(a,b,12,5,.3,0,Math.PI*2);x.fill();}
  return c;
}
export function touchingFixture(){
  const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#707070';x.fillRect(0,0,800,600);x.fillStyle='#f5f5ef';
  for(const [a,b]of [[160,180],[194,180],[228,180],[500,340],[500,355],[500,370]]){x.beginPath();x.ellipse(a,b,18,8,0,0,Math.PI*2);x.fill();}
  return c;
}
