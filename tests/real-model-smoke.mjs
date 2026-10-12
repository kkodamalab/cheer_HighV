// Optional real-model image validation, separate from mock/virtual-camera browser tests.
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const assets = process.env.CML_MODEL_ASSETS_DIR || '/tmp/cml-real-models';
await mkdir(assets, { recursive: true });
const cdn = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const files = [
 ['vision_bundle.mjs', `${cdn}/vision_bundle.mjs`],
 ...['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'].map(f=>[f,`${cdn}/wasm/${f}`]),
 ['pose_landmarker_lite.task','https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'],
 ['face_landmarker.task','https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'],
 ...['pose.jpg','portrait.jpg'].map(f=>[f,`https://storage.googleapis.com/mediapipe-assets/${f}`])
];
for (const [name,url] of files) {
 // curl uses the environment's supported CA trust and proxy. Never disable TLS verification.
 execFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','45','--dump-header',resolve(assets,name+'.headers'),'--output',resolve(assets,name),url]);
 if (name.endsWith('.task')) {
  const headers=await readFile(resolve(assets,name+'.headers'),'utf8');
  const expected=headers.match(/x-goog-hash:.*md5=([^\r\n]+)/i)?.[1];
  const actual=createHash('md5').update(await readFile(resolve(assets,name))).digest('base64');
  if (!expected || expected!==actual) throw Error(`${name}: official MD5 verification failed`);
 }
}
const browser=await chromium.launch({...(process.env.CML_CHROMIUM?{executablePath:process.env.CML_CHROMIUM}:{}),args:['--no-sandbox']});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Serve TLS-verified artifacts locally to avoid changing the cloud Chromium trust store.
 for(const domain of ['cdn.jsdelivr.net','storage.googleapis.com']) await page.route(`https://${domain}/**`,async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1);
  await route.fulfill({body:await readFile(resolve(assets,name)),contentType:name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')||name.endsWith('.mjs')?'application/javascript':'application/octet-stream'});
 });
 await page.route('**/fixtures/*.jpg',async route=>route.fulfill({body:await readFile(resolve(assets,new URL(route.request().url()).pathname.split('/').at(-1))),contentType:'image/jpeg'}));
 await page.goto(process.env.CML_TEST_BASE_URL || 'http://127.0.0.1:5173');
 const results=await page.evaluate(async()=>{
  const {Camera}=await import('./src/tracking/camera.js');
  const camera=new Camera(document.createElement('video'),()=>{},()=>{});
  await camera.models();await camera.facePromise;
  const output=[];
  for(const name of ['pose.jpg','portrait.jpg']){
   const image=new Image();image.src=new URL('fixtures/'+name,location.href);await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);
   const frame=camera.infer(canvas,performance.now(),true),d=frame.faceDiagnostic;
   output.push({name,width:frame.width,height:frame.height,poseDetected:!!frame.landmarks,
    faceModel:d.modelState,selected:d.selected,roi:d.roi,roiStatus:d.roiAttempt.status,fullStatus:d.fullAttempt.status,
    roiScore:d.roiAttempt.smile?.score??null,fullScore:d.fullAttempt.smile?.score??null,smile:frame.smile,
    roiMs:d.roiAttempt.durationMs,fullMs:d.fullAttempt.durationMs});
  }
  await camera.dispose();return output;
 });
 await mkdir('test-results',{recursive:true});
 await writeFile('test-results/real-model-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 if(errors.length||!results[0].poseDetected||!results[1].smile)throw Error('Real-model prerequisite checks failed: '+errors.join('; '));
 console.log('Full-body face outcome is reported above; a null smile is NOT a successful full-body smile check. No physical camera was used.');
} finally { await browser.close(); }
