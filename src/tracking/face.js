import { smileScore } from '../evaluation/angles.js';

// Pose顔点は表示反転前の画像座標。原画像の画素を余白付きで切り出し、拡大はしない。
export function faceRegion(landmarks, width, height) {
  if (!landmarks || width < 1 || height < 1) return null;
  const points = landmarks.slice(0, 11).filter(p =>
    p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && (p.visibility ?? 1) >= .45
  );
  if (points.length < 4) return null;
  const xs = points.map(p => p.x * width), ys = points.map(p => p.y * height);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const side = Math.ceil(Math.max((maxX - minX) * 1.8, (maxY - minY) * 3.5));
  if (side < 16) return null;
  const size = Math.min(side, width, height);
  const x = Math.max(0, Math.min(width - size, Math.round((minX + maxX - size) / 2)));
  const y = Math.max(0, Math.min(height - size, Math.round((minY + maxY - size) / 2 - size * .03)));
  return { x, y, width: size, height: size, pixels: size * size, small: size < 96 };
}

const emptyAttempt = () => ({ status: 'not-run', durationMs: null, smile: null, blendshapes: null, error: null, timestamp: null });
const errorMessage = e => String(e?.message || e || '不明なエラー').slice(0, 300);

export class FaceTracker {
  constructor({ now = () => performance.now(), canvas = () => document.createElement('canvas') } = {}) {
    this.now = now;
    this.makeCanvas = canvas;
    this.modelState = 'not-loaded';
    this.lastInference = -Infinity;
    this.lastFull = -Infinity;
    this.epoch = 0;
    this.diagnostic = this.snapshot();
  }
  snapshot(extra = {}) {
    return { modelState: this.modelState, modelError: this.modelError ?? null,
      detection: 'not-run', roi: null, roiAttempt: emptyAttempt(), fullAttempt: emptyAttempt(),
      selected: null, durationMs: null, timestamp: null, ...extra };
  }
  async initialize(factory) {
    if (this.disposed) return false;
    if (this.promise) return this.promise;
    const epoch = ++this.epoch;
    this.model?.close();
    this.model = null;
    this.reset();
    this.modelState = 'loading';
    this.modelError = null;
    this.diagnostic = this.snapshot();
    this.promise = (async () => {
      try {
        const model = await Promise.resolve().then(factory);
        if (this.disposed || epoch !== this.epoch) { model.close(); return false; }
        this.model = model;
        this.modelState = 'ready';
        this.diagnostic = this.snapshot();
        return true;
      } catch (e) {
        if (epoch === this.epoch && !this.disposed) {
          this.modelState = 'init-error';
          this.modelError = errorMessage(e);
          this.diagnostic = this.snapshot();
        }
        return false;
      } finally { if (epoch === this.epoch) this.promise = null; }
    })();
    return this.promise;
  }
  attempt(image, time) {
    const start = this.now();
    try {
      const result = this.model.detect(image);
      const categories = result.faceBlendshapes?.[0]?.categories;
      const smile = smileScore(categories);
      const detected = !!result.faceLandmarks?.length || !!categories?.length;
      return { status: smile ? 'detected' : detected ? 'blendshapes-unavailable' : 'not-detected',
        durationMs: this.now() - start, smile,
        blendshapes: categories ? Object.fromEntries(categories.map(c => [c.categoryName, c.score])) : null,
        error: null, timestamp: time };
    } catch (e) {
      return { ...emptyAttempt(), status: 'inference-error', durationMs: this.now() - start,
        error: errorMessage(e), timestamp: time };
    }
  }
  infer(image, landmarks, time, force = false, compare = false) {
    if (!this.model) {
      this.smile = null;
      this.diagnostic = this.snapshot();
      return this.result(time);
    }
    if (!force && time - this.lastInference < 200) return this.result(time);
    this.lastInference = time;
    const started = this.now();
    const width = image.videoWidth || image.width, height = image.videoHeight || image.height;
    const roi = faceRegion(landmarks, width, height);
    let roiAttempt = emptyAttempt();
    if (roi) {
      try {
        this.crop ??= this.makeCanvas();
        this.crop.width = roi.width;
        this.crop.height = roi.height;
        this.crop.getContext('2d').drawImage(image, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);
        roiAttempt = this.attempt(this.crop, time);
      } catch (e) { roiAttempt = { ...emptyAttempt(), status: 'inference-error', error: errorMessage(e), timestamp: time }; }
    }
    // 同じフレームで失敗時は必ず元画像へ。成功時も1秒ごと（DEBUG中は毎回）比較する。
    let fullAttempt = this.diagnostic.fullAttempt ?? emptyAttempt();
    if (!roiAttempt.smile || force || compare || time - this.lastFull >= 1000) {
      fullAttempt = this.attempt(image, time);
      this.lastFull = time;
    }
    const freshFull = fullAttempt.timestamp === time;
    const chosen = roiAttempt.smile ? roiAttempt : freshFull && fullAttempt.smile ? fullAttempt : null;
    this.smile = chosen?.smile ?? null;
    this.diagnostic = this.snapshot({ roi, roiAttempt, fullAttempt,
      detection: chosen ? 'detected' : roiAttempt.status === 'inference-error' || freshFull && fullAttempt.status === 'inference-error' ? 'inference-error' : freshFull && fullAttempt.status === 'blendshapes-unavailable' || roiAttempt.status === 'blendshapes-unavailable' ? 'blendshapes-unavailable' : 'not-detected',
      selected: chosen ? chosen === roiAttempt ? 'roi' : 'full' : null,
      durationMs: this.now() - started, timestamp: time });
    return this.result(time);
  }
  result(time) {
    const fresh = time - this.lastInference < 600;
    return { smile: fresh ? this.smile ?? null : null,
      diagnostic: { ...this.diagnostic, modelState: this.modelState, modelError: this.modelError ?? null, stale: !fresh } };
  }
  reset() {
    this.smile = null;
    this.lastInference = -Infinity;
    this.lastFull = -Infinity;
    this.diagnostic = this.snapshot();
  }
  close() {
    this.disposed = true;
    this.epoch++;
    this.model?.close();
    this.model = null;
    this.modelState = 'not-loaded';
    this.reset();
  }
}
