// 表紙（3案）。設定で切り替えられる。
import { FLAVOR_TREE, categoryMix } from './flavors.js';

export const COVERS = [
  { id: 'cup', name: '一杯', desc: '茶色の布地に、真上から見たカップと風味の色の輪' },
  { id: 'techo', name: '手帳', desc: '布張りの手帳に、縦書きの題' },
  { id: 'rings', name: '年輪', desc: '記録が増えるほど育つ表紙' },
];
export const coverStyle = () => { try { return localStorage.getItem('cover-style') || 'cup'; } catch { return 'cup'; } };

const pt = (cx, cy, r, deg) => { const a = deg * Math.PI / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
// 9色の輪（風味の分類の色）
function colorRing(cx, cy, r, w, gap, extra = '') {
  const n = FLAVOR_TREE.length;
  return FLAVOR_TREE.map((c, i) => `<path d="${arc(cx, cy, r, i * 360 / n + gap, (i + 1) * 360 / n - gap)}" stroke="${c.color}" stroke-width="${w}" fill="none" ${extra}/>`).join('');
}

export function coverHTML() {
  return `<div class="cover cover-cup">
    <svg class="cup-art" viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="200" cy="206" r="168" fill="#1E1611" opacity=".55"/>
      <circle cx="200" cy="200" r="168" fill="#fff"/>
      <g class="cup-ring">${colorRing(200, 200, 150, 9, 2.2, 'pathLength="100"')}</g>
      <circle cx="200" cy="200" r="122" fill="#fff" stroke="#E2DED8"/>
      <circle cx="200" cy="200" r="104" fill="#3B2A20"/>
      <circle cx="200" cy="200" r="86" fill="#5A3E2E"/>
      <ellipse cx="172" cy="170" rx="30" ry="14" fill="#7A5641" opacity=".5" transform="rotate(-30 172 170)"/>
    </svg>
    <h1 class="cover-title" aria-label="珈琲テイスティングノート"><span>珈琲</span><small>テイスティングノート</small></h1>
  </div>`;
}
