// 頭頂10〜足首122 / 頭径16 ≒ 7頭身。左右の肩・肘・手首・股関節・膝・足首を明示。
export function figurePoints(id) {
  const elevation = id === 'touchdown' ? 90 : id === 'low-v' ? -45 : id === 't-motion' ? 0 : 45;
  const a = elevation * Math.PI / 180;
  const limbs = [-1, 1].map(side => {
    const shoulder = { x: 70 + side * 14, y: 40 };
    return { shoulder,
      elbow: { x: shoulder.x + side * 15 * Math.cos(a), y: shoulder.y - 15 * Math.sin(a) },
      wrist: { x: shoulder.x + side * 28 * Math.cos(a), y: shoulder.y - 28 * Math.sin(a) },
      hip: { x: 70 + side * 6, y: 70 },
      knee: { x: 70 + side * 14, y: 96 },
      ankle: { x: 70 + side * 22, y: 122 } };
  });
  return { head: { x: 70, y: 18, radius: 8 }, limbs };
}
export function poseFigure(id) {
  const { head, limbs } = figurePoints(id);
  const point = p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  const paths = limbs.map(l => `M${point(l.shoulder)}L${point(l.elbow)}L${point(l.wrist)}M${point(l.shoulder)}L${point(l.hip)}L${point(l.knee)}L${point(l.ankle)}`).join('');
  return `<svg viewBox="0 0 140 140" aria-hidden="true" class="pose-figure"><circle cx="${head.x}" cy="${head.y}" r="${head.radius}" fill="currentColor"/><path d="M70 29V38M56 40H84M64 70H76${paths}" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>${limbs.map(l => `<circle cx="${l.wrist.x}" cy="${l.wrist.y}" r="4" fill="currentColor"/>`).join('')}</svg>`;
}
