import {VARIABLES} from './angles.js';
export function evaluate(pose,values){
 const rows=[...VARIABLES,...pose.customVariables].filter(v=>pose.metrics[v.id]?.enabled&&(v.id!=='smile'||pose.smileEnabled)).map(v=>{
 const m=pose.metrics[v.id],value=values[v.id],valid=Number.isFinite(value),error=valid?Math.abs(value-m.target):null;
 return {...v,...m,value:valid?value:null,error,score:valid?Math.max(0,100*(1-error/Math.max(m.tolerance,.1))):null};
 });
 const measured=rows.filter(r=>r.score!==null&&r.weight>0),weight=measured.reduce((a,r)=>a+r.weight,0);
 return {rows,score:weight?measured.reduce((a,r)=>a+r.score*r.weight,0)/weight:null,coverage:rows.length?rows.filter(r=>r.score!==null).length/rows.length:0,advice:rows.filter(r=>r.error>r.tolerance*.5).map(r=>r.id.endsWith('Arm')?`${r.id==='leftArm'?'左':'右'}腕をもう少し${r.value<r.target?'上げ':'下げ'}ましょう`:/Elbow/.test(r.id)?'肘を目標角度に近づけましょう':r.id==='armSymmetry'?'左右の腕の高さを合わせましょう':`${r.label}を目標値に近づけましょう`)};
}
