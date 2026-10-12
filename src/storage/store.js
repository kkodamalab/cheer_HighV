import {VARIABLES} from '../evaluation/angles.js';
import {presets} from '../evaluation/pose-presets.js';
export function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
export function write(key,value){localStorage.setItem(key,JSON.stringify(value));}
export const loadPoses=()=>{const p=read('cml-poses',null);try{return p?validatePoses(p):presets();}catch{return presets();}};
export function validatePoses(data){
 if(!Array.isArray(data)||!data.length||data.length>100)throw Error('ポーズ配列が必要です（1〜100件）');
 const ids=new Set();for(const p of data){if(!p||typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Array.isArray(p.customVariables)||!p.metrics)throw Error('ポーズ形式が不正です');ids.add(p.id);
 if(!Number.isInteger(p.countdown)||p.countdown<0||p.countdown>10||!['OFF','VOICE','DRUM','METRONOME'].includes(p.rhythm)||p.bpm<60||p.bpm>180||p.bpm%5||!Number.isFinite(p.volume)||p.volume<0||p.volume>1)throw Error('時間・音設定が不正です');
 for(const v of [...VARIABLES,...p.customVariables]){const m=p.metrics[v.id];if(!m||m.target<v.min||m.target>v.max)throw Error('目標値または必須指標が不正です');}
 for(const m of Object.values(p.metrics))if(typeof m.enabled!=='boolean'||!Number.isFinite(m.target)||!Number.isFinite(m.tolerance)||m.tolerance<=0||!Number.isFinite(m.weight)||m.weight<0)throw Error('評価設定が不正です');
 for(const v of p.customVariables)if(!/^custom-[A-Za-z0-9_-]+$/.test(v.id)||v.min!==0||v.max!==180||typeof v.label!=='string'||v.indices?.length!==3||new Set(v.indices).size!==3||v.indices.some(i=>!Number.isInteger(i)||i<0||i>32))throw Error('ランドマーク設定が不正です');
 if(p.reference&&(!Array.isArray(p.reference.landmarks)||p.reference.landmarks.length!==33||p.reference.landmarks.some(a=>!Number.isFinite(a.x)||!Number.isFinite(a.y))))throw Error('基準姿勢が不正です');
 }return data;
}
export function csv(records){const cells=x=>'"'+String(x??'').replaceAll('"','""')+'"';const rows=[['日時','ポーズ','総合','指標','実測','目標','誤差','スコア','重み','検出']];for(const r of records)for(const m of r.evaluation.rows)rows.push([r.date,r.pose.name,r.evaluation.score,m.label,m.value,m.target,m.error,m.score,m.weight,m.value===null?'測定不可':'検出']);return '\ufeff'+rows.map(r=>r.map(cells).join(',')).join('\r\n');}
export function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
