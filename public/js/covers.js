// 表紙（3案）。設定で切り替えられる。
import { FLAVOR_TREE, categoryMix } from './flavors.js';

export const COVERS = [
  { id: 'techo', name: '手帳', desc: '布張りの手帳に、縦書きの題' },
  { id: 'cup', name: '一杯', desc: '真上から見たカップと、風味の色の輪' },
  { id: 'rings', name: '年輪', desc: '記録が増えるほど育つ表紙' },
];
export const coverStyle = () => { try { return localStorage.getItem('cover-style') || 'techo'; } catch { return 'techo'; } };

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

export function coverHTML(style, records) {
  const n = records.length;
  if (style === 'cup') {
    return `<div class="cover cover-cup">
      <svg class="cup-art" viewBox="0 0 400 400" aria-hidden="true">
        <circle cx="200" cy="208" r="168" fill="#E9E6E0"/>
        <circle cx="200" cy="200" r="168" fill="#fff"/>
        <g class="cup-ring">${colorRing(200, 200, 150, 9, 2.2, 'pathLength="100"')}</g>
        <circle cx="200" cy="200" r="122" fill="#fff" stroke="#E2DED8"/>
        <circle cx="200" cy="200" r="104" fill="#3B2A20"/>
        <circle cx="200" cy="200" r="86" fill="#5A3E2E"/>
        <ellipse cx="172" cy="170" rx="30" ry="14" fill="#7A5641" opacity=".5" transform="rotate(-30 172 170)"/>
      </svg>
      <h1 class="cover-title">珈琲テイスティングノート</h1>
      <p class="cover-sub">お店の一杯と、家の一杯。</p>
      <button type="button" class="cover-open">ひらく</button>
    </div>`;
  }
  if (style === 'rings') {
    const list = [...records].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt)).slice(-26);
    const cx = 200, cy = 200, r0 = 30, slots = 13, step = list.length > slots ? 160 / list.length : 12;
    let rings = '';
    // これから増える分の輪（うすい点線）
    for (let i = list.length; i < slots; i++) rings += `<circle cx="${cx}" cy="${cy}" r="${r0 + 12 * (i + .5)}" fill="none" stroke="#D9D4CC" stroke-width="1" stroke-dasharray="2 5"/>`;
    if (list.length) {
      list.forEach((r, i) => {
        const rad = r0 + step * (i + 0.5), w = step * 0.62;
        const mix = categoryMix(r.flavors?.length ? r.flavors : []);
        if (!mix.length) { rings += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="#CFC7BE" stroke-width="${w}"/>`; return; }
        const total = mix.reduce((a, m) => a + m.n, 0); let acc = (i * 37) % 360;
        mix.forEach(m => { const span = m.n / total * 360; rings += `<path d="${arc(cx, cy, rad, acc + 1, acc + Math.max(span - 1, 2))}" stroke="${m.cat.color}" stroke-width="${w}" fill="none"/>`; acc += span; });
      });
    }
    return `<div class="cover cover-rings">
      <h1 class="cover-title">珈琲<br>テイスティング<br>ノート</h1>
      <svg class="rings-art" viewBox="0 0 400 400" aria-hidden="true">${rings}<circle cx="${cx}" cy="${cy}" r="${r0 - 6}" fill="#3B2A20"/></svg>
      <p class="cover-sub">${n ? `${n}杯の記録でできた年輪` : '一杯記録するたびに、年輪がひとつ増えます'}</p>
      <button type="button" class="cover-open">ひらく</button>
    </div>`;
  }
  // 手帳
  return `<div class="cover cover-techo">
    <div class="techo-spine" aria-hidden="true"></div>
    <div class="techo-face">
      <h1 class="techo-title"><span class="big">珈琲</span><span>テイスティングノート</span></h1>
      <svg class="techo-mark" viewBox="0 0 120 120" aria-hidden="true">${colorRing(60, 60, 48, 7, 3, 'opacity=".9"')}<circle cx="60" cy="60" r="34" fill="none" stroke="#C9A96A" stroke-width="1.2"/><circle cx="60" cy="60" r="24" fill="#2E2119"/></svg>
      <p class="techo-count">${n ? `${n}杯` : ''}</p>
    </div>
    <button type="button" class="cover-open">ひらく</button>
  </div>`;
}
