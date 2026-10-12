import {smileScore} from '../evaluation/angles.js';
const CDN='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const MODEL='https://storage.googleapis.com/mediapipe-models/';
export class Camera{
 constructor(video,onFrame,onStatus){Object.assign(this,{video,onFrame,onStatus});this.generation=0;}
 async models(){
 if(!this.modelPromise)this.modelPromise=(async()=>{const {FilesetResolver,PoseLandmarker,FaceLandmarker}=await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);const files=await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
 this.pose=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:`${MODEL}pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});
 this.facePromise=FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:`${MODEL}face_landmarker/float16/1/face_landmarker.task`},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true}).then(face=>{if(this.disposed)face.close();else this.face=face;}).catch(()=>{this.onStatus('顔モデルを読み込めません。姿勢評価は利用できます');});})();
 try{await this.modelPromise;}catch(e){this.modelPromise=null;throw e;}
 }
 async start(){if(this.starting||this.running)return;this.starting=true;const generation=++this.generation;
 try{this.onStatus('モデルとカメラを準備中…');await this.models();if(generation!==this.generation)return;
 const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:720}},audio:false});if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;this.video.srcObject=stream;await this.video.play();if(generation!==this.generation)return;this.running=true;this.lastVideo=-1;this.lastFace=-Infinity;this.loop();
 }catch(e){this.stop();throw e;}finally{this.starting=false;}}
 infer(image,time,forceFace=false){const pose=this.pose.detectForVideo(image,time);if(this.face&&(forceFace||time-this.lastFace>200)){try{this.smile=smileScore(this.face.detectForVideo(image,time).faceBlendshapes?.[0]?.categories);this.lastFace=time;}catch{this.smile=null;}}
 return {landmarks:pose.landmarks?.[0]??null,smile:this.face&&time-this.lastFace<600?this.smile:null,faceStatus:this.face?'available':'unavailable',timestamp:time,width:image.videoWidth||image.width,height:image.videoHeight||image.height};}
 loop(){if(!this.running)return;try{if(this.video.readyState>=2&&this.lastVideo!==this.video.currentTime){this.lastVideo=this.video.currentTime;this.latest=this.infer(this.video,performance.now());this.onFrame(this.latest);}}catch(e){this.onStatus('推論に失敗しました。カメラを再起動してください');this.stop();return;}this.raf=requestAnimationFrame(()=>this.loop());}
 capture(){const image=document.createElement('canvas');image.width=this.video.videoWidth;image.height=this.video.videoHeight;image.getContext('2d').drawImage(this.video,0,0);const frame=this.infer(image,performance.now(),true);this.stop();return {image,frame};}
 stop(){this.generation++;this.running=false;cancelAnimationFrame(this.raf);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.latest=null;this.smile=null;}
 async dispose(){this.disposed=true;this.stop();await this.modelPromise?.catch(()=>{});this.pose?.close();this.face?.close();}
}
