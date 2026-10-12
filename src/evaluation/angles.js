export const point = (p,w,h) => ({x:p.x*w,y:p.y*h});
export function angle(a,b,c) {
 const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y],den=Math.hypot(...u)*Math.hypot(...v);
 return den<1e-8?null:Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/den)))*180/Math.PI;
}
export function elevation(a,b){return Math.hypot(b.x-a.x,b.y-a.y)<1e-8?null:Math.atan2(a.y-b.y,Math.abs(b.x-a.x))*180/Math.PI;}
export const tilt=(a,b)=>Math.atan2(b.y-a.y,Math.abs(b.x-a.x))*180/Math.PI;
export const VARIABLES=[
 ['leftArm','左腕の挙上角度',-90,90,[11,15]],['rightArm','右腕の挙上角度',-90,90,[12,16]],
 ['leftElbow','左肘の伸展角度',0,180,[11,13,15]],['rightElbow','右肘の伸展角度',0,180,[12,14,16]],
 ['armSymmetry','左右腕の対称性',0,180,[11,12,15,16]],['shoulderTilt','肩の水平傾斜',0,90,[11,12]],
 ['torsoTilt','体幹の傾斜角度',0,90,[11,12,23,24]],['headTilt','頭部の傾き',0,90,[7,8]],
 ['leftHip','左股関節角度',0,180,[11,23,25]],['rightHip','右股関節角度',0,180,[12,24,26]],
 ['leftKnee','左膝関節角度',0,180,[23,25,27]],['rightKnee','右膝関節角度',0,180,[24,26,28]],
 ['legSymmetry','左右脚の対称性',0,180,[23,24,25,26,27,28]],['smile','笑顔スコア',0,100,[]]
].map(([id,label,min,max,indices])=>({id,label,min,max,indices}));
export function smileScore(categories){
 if(!categories?.length)return null;
 const c=Object.fromEntries(categories.map(x=>[x.categoryName,x.score]));
 if(!['mouthSmileLeft','mouthSmileRight','cheekSquintLeft','cheekSquintRight'].every(k=>Number.isFinite(c[k])))return null;
 return {score:100*(.4*c.mouthSmileLeft+.4*c.mouthSmileRight+.1*c.cheekSquintLeft+.1*c.cheekSquintRight),asymmetry:100*Math.abs(c.mouthSmileLeft-c.mouthSmileRight)};
}
export function measure(lm,w,h,smile,custom=[]){
 const p=lm?.map(x=>point(x,w,h)); const out={smile:smile?.score??null};
 for(const v of [...VARIABLES.filter(x=>x.id!=='smile'),...custom]){
 if(!p||v.indices.some(i=>!lm[i]||(lm[i].visibility??1)<.5)){out[v.id]=null;continue;}
 const q=v.indices.map(i=>p[i]);let n;
 if(v.id.endsWith('Arm'))n=elevation(...q);
 else if(v.id==='armSymmetry'){const a=elevation(p[11],p[15]),b=elevation(p[12],p[16]);n=a===null||b===null?null:Math.abs(a-b);}
 else if(v.id==='legSymmetry'){const a=angle(p[23],p[25],p[27]),b=angle(p[24],p[26],p[28]);n=a===null||b===null?null:Math.abs(a-b);}
 else if(v.id==='shoulderTilt'||v.id==='headTilt')n=Math.abs(tilt(...q));
 else if(v.id==='torsoTilt'){const a={x:(q[0].x+q[1].x)/2,y:(q[0].y+q[1].y)/2},b={x:(q[2].x+q[3].x)/2,y:(q[2].y+q[3].y)/2};n=Math.atan2(Math.abs(a.x-b.x),Math.abs(a.y-b.y))*180/Math.PI;}
 else n=angle(...q);
 out[v.id]=Number.isFinite(n)?n:null;
 }return out;
}
