// Controlled regression fixture: 3 crisp pills, 1 diffuse highlight, 1 thin reflection.
export function reflectionFixture(){
  const c=document.createElement('canvas');c.width=960;c.height=720;const x=c.getContext('2d');
  x.fillStyle='rgb(100,100,100)';x.fillRect(0,0,960,720);
  x.save();x.filter='blur(16px)';x.fillStyle='rgb(185,185,185)';x.beginPath();x.ellipse(680,320,110,85,0,0,Math.PI*2);x.fill();x.restore();
  x.fillStyle='rgb(210,210,210)';x.fillRect(560,570,170,25);
  x.fillStyle='rgb(242,231,180)';for(let i=0;i<3;i++){x.beginPath();x.ellipse(160,140+i*190,38,28,0,0,Math.PI*2);x.fill();}
  return c;
}
