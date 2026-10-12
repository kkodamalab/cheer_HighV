const labels = {
  'not-loaded': '未初期化', loading: '初期化中', ready: '初期化済み', 'init-error': '初期化エラー',
  'not-run': '未実行', detected: '検出成功', 'not-detected': '顔未検出',
  'inference-error': '推論エラー', 'blendshapes-unavailable': '顔検出・表情特徴量なし'
};
export const faceLabel = value => labels[value] || value || '未実行';
export function faceMessage(d) {
  if (!d) return '顔モデル：未初期化';
  if (d.modelState !== 'ready') return `顔モデル：${faceLabel(d.modelState)}`;
  if (d.detection === 'not-run') return '顔モデル：初期化済み · 検出待ち';
  if (d.stale) return '顔評価の更新待ち（測定不可）';
  if (d.detection === 'not-detected') return '顔未検出：明るさ・顔の向き・画素数を確認してください';
  return `${faceLabel(d.detection)}${d.selected ? ` · ${d.selected === 'roi' ? '顔切り出し' : '元画像'}` : ''}`;
}
export function debugText(frame) {
  const d = frame?.faceDiagnostic;
  if (!d) return 'カメラ開始後に表示します';
  const ms = n => Number.isFinite(n) ? `${n.toFixed(1)} ms` : '—';
  const attempt = (name, a) => `${name}：${faceLabel(a?.status)} / ${ms(a?.durationMs)} / Smile ${a?.smile ? a.smile.score.toFixed(1) : '測定不可'} / ${a?.timestamp != null ? `測定時刻 ${a.timestamp.toFixed(0)} ms` : '未実行'}${a?.error ? '\n  エラー：' + a.error : ''}`;
  const blend = a => a?.blendshapes ? ['mouthSmileLeft', 'mouthSmileRight', 'cheekSquintLeft', 'cheekSquintRight'].map(k => `${k}: ${Number.isFinite(a.blendshapes[k]) ? a.blendshapes[k].toFixed(4) : 'なし'}`).join('\n') : 'なし';
  return [
    `カメラ入力：${frame.width} × ${frame.height} px`,
    `Pose：${faceLabel(frame.poseDiagnostic?.modelState)} / ${frame.poseDiagnostic?.detection === 'detected' ? '人物検出' : faceLabel(frame.poseDiagnostic?.detection)}${frame.poseDiagnostic?.error ? '\n  ' + frame.poseDiagnostic.error : ''}`,
    `Faceモデル：${faceLabel(d.modelState)}${d.modelError ? '\n  ' + d.modelError : ''}`,
    `顔検出：${faceLabel(d.detection)} / 採用：${d.selected || 'なし'}`,
    `顔領域：${d.roi ? `${d.roi.width} × ${d.roi.height} px (${d.roi.pixels.toLocaleString()}画素) / x=${d.roi.x}, y=${d.roi.y}${d.roi.small ? ' / 小さい顔領域' : ''}` : '抽出不可（Pose顔点なし・低信頼度・領域が小さすぎる）'}`,
    `Face全処理：${ms(d.durationMs)}`,
    attempt('切り出し', d.roiAttempt), attempt('元画像', d.fullAttempt),
    'Blendshape（切り出し）\n' + blend(d.roiAttempt), 'Blendshape（元画像）\n' + blend(d.fullAttempt)
  ].join('\n');
}
