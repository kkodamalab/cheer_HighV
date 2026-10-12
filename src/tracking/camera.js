import { FaceTracker } from './face.js';
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/';
export class Camera {
  constructor(video, onFrame, onStatus) {
    Object.assign(this, { video, onFrame, onStatus });
    this.generation = 0;
    this.faceTracker = new FaceTracker();
    this.poseState = 'not-loaded';
  }
  async files() {
    if (!this.filesPromise) this.filesPromise = (async () => {
      this.vision = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
      this.fileset = await this.vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    })().catch(e => { this.filesPromise = null; throw e; });
    await this.filesPromise;
  }
  async retryFace() {
    return this.faceTracker.initialize(async () => {
      await this.files();
      return this.vision.FaceLandmarker.createFromOptions(this.fileset, {
        baseOptions: { modelAssetPath: `${MODEL}face_landmarker/face_landmarker/float16/1/face_landmarker.task` },
        // IMAGE mode: crop/full input sizes and coordinates vary between attempts.
        runningMode: 'IMAGE', numFaces: 1, outputFaceBlendshapes: true,
        minFaceDetectionConfidence: .5, minFacePresenceConfidence: .5
      });
    });
  }
  async models() {
    if (!this.modelPromise) this.modelPromise = (async () => {
      this.poseState = 'loading';
      this.facePromise = this.retryFace();
      try {
        await this.files();
        this.pose = await this.vision.PoseLandmarker.createFromOptions(this.fileset, {
          baseOptions: { modelAssetPath: `${MODEL}pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task` },
          runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .5,
          minPosePresenceConfidence: .5, minTrackingConfidence: .5
        });
        this.poseState = 'ready';
      } catch (e) {
        this.poseState = 'init-error';
        this.poseError = String(e.message || e).slice(0, 300);
        // Face can continue even if Pose initialization fails.
        await this.facePromise;
      }
    })();
    await this.modelPromise;
  }
  async start() {
    if (this.starting || this.running) return;
    this.starting = true;
    const generation = ++this.generation;
    try {
      this.onStatus('モデルとカメラを準備中…');
      await this.models();
      if (generation !== this.generation) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }, audio: false
      });
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (generation !== this.generation) return;
      this.running = true;
      this.lastVideo = -1;
      this.faceTracker.reset();
      this.loop();
    } catch (e) { this.stop(); throw e; }
    finally { this.starting = false; }
  }
  infer(image, time, forceFace = false) {
    let landmarks = null, poseError = this.poseError ?? null;
    let poseDetection = this.poseState === 'init-error' ? 'init-error' : 'not-detected';
    if (this.pose) {
      try { landmarks = this.pose.detectForVideo(image, time).landmarks?.[0] ?? null; poseDetection = landmarks ? 'detected' : 'not-detected'; }
      catch (e) { poseDetection = 'inference-error'; poseError = String(e.message || e).slice(0, 300); }
    }
    const face = this.faceTracker.infer(image, landmarks, time, forceFace, this.debugFace);
    return { landmarks, smile: face.smile, faceStatus: face.diagnostic.modelState,
      faceDiagnostic: face.diagnostic, poseDiagnostic: { modelState: this.poseState, detection: poseDetection, error: poseError },
      timestamp: time, width: image.videoWidth || image.width, height: image.videoHeight || image.height };
  }
  loop() {
    if (!this.running) return;
    if (this.video.readyState >= 2 && this.lastVideo !== this.video.currentTime) {
      this.lastVideo = this.video.currentTime;
      this.latest = this.infer(this.video, performance.now());
      this.onFrame(this.latest);
    }
    this.raf = requestAnimationFrame(() => this.loop());
  }
  capture() {
    const image = document.createElement('canvas');
    image.width = this.video.videoWidth;
    image.height = this.video.videoHeight;
    image.getContext('2d').drawImage(this.video, 0, 0);
    const frame = this.infer(image, performance.now(), true);
    this.stop();
    return { image, frame };
  }
  stop() {
    this.generation++;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.latest = null;
    this.faceTracker.reset();
  }
  async dispose() {
    this.disposed = true;
    this.stop();
    this.faceTracker.close();
    await this.modelPromise?.catch(() => {});
    this.pose?.close();
  }
}
