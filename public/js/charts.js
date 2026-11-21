import { FLAVOR_TREE, FLAVOR_ITEMS, ATTRS, flavorCentroid } from './flavors.js';

const C = 220;                  // 中心
const R = { hole: 62, cat: 104, group: 140, item: 200 };

const pt = (r, deg) => { const a = deg * Math.PI / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
const f = n => n.toFixed(2);

function sector(r0, r1, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${large} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
}

function radialText(text, r, deg, size, fill, weight = 400) {
  const [x, y] = pt(r, deg);
  const rot = deg <= 180 ? deg - 90 : deg + 90;
  return `<text x="${f(x)}" y="${f(y)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" text-anchor="middle" dominant-baseline="central" font-size="${size}" fill="${fill}" font-weight="${weight}">${text}</text>`;
}

// 風味の円。selected: Set<id>。photoUrl があれば中心に写真を入れる。
export function wheelSVG(selected, { photoUrl = null, interactive = false, suggested = [] } = {}) {
  const sel = selected instanceof Set ? selected : new Set(selected || []);
  const sug = new Set(suggested);
  const any = sel.size > 0 || sug.size > 0;
  let out = `<svg class="wheel" viewBox="0 0 440 440" role="img" aria-label="風味の円">`;
  out += `<defs><clipPath id="holeClip"><circle cx="${C}" cy="${C}" r="${R.hole - 3}"/></clipPath></defs>`;

  // カテゴリ・グループの範囲を計算
  FLAVOR_TREE.forEach(cat => {
    const items = FLAVOR_ITEMS.filter(i => i.cat === cat);
    const a0 = items[0].a0, a1 = items[items.length - 1].a1;
    const catOn = items.some(i => sel.has(i.id) || sug.has(i.id));
    const op = !any || catOn ? 1 : 0.28;
    out += `<path d="${sector(R.hole, R.cat, a0, a1)}" fill="${cat.color}" opacity="${op}" stroke="#fff" stroke-width="1.5" data-cat="${cat.id}"/>`;
    out += radialText(cat.short, (R.hole + R.cat) / 2, (a0 + a1) / 2, cat.short.length > 3 ? 10 : 12, '#fff', 600);

    cat.groups.forEach(g => {
      const gi = items.filter(i => i.group === g.name);
      const ga0 = gi[0].a0, ga1 = gi[gi.length - 1].a1;
      const gOn = gi.some(i => sel.has(i.id) || sug.has(i.id));
      out += `<path d="${sector(R.cat, R.group, ga0, ga1)}" fill="${cat.color}" opacity="${!any || gOn ? 0.78 : 0.2}" stroke="#fff" stroke-width="1.2"/>`;
      out += radialText(g.name, (R.cat + R.group) / 2, (ga0 + ga1) / 2, g.name.length > 3 ? 8 : 9, '#fff', 500);
    });

    items.forEach(it => {
      const on = sel.has(it.id), maybe = !on && sug.has(it.id);
      out += `<g class="seg${on ? ' on' : ''}${maybe ? ' maybe' : ''}" data-id="${it.id}"${interactive ? ' tabindex="0" role="button" aria-pressed="' + on + '" aria-label="' + it.name + (maybe ? '（提案）' : '') + '"' : ''}>`;
      out += `<path d="${sector(R.group, R.item, it.a0, it.a1)}" fill="${cat.color}" opacity="${on ? 1 : maybe ? 0.42 : 0.16}" stroke="#fff" stroke-width="1"/>`;
      if (maybe) out += `<path d="${sector(R.group + 2.5, R.item - 2.5, it.a0 + 0.6, it.a1 - 0.6)}" fill="none" stroke="#1F1A17" stroke-width="1.3" stroke-dasharray="3 2.5"/>`;
      out += radialText(it.name, (R.group + R.item) / 2, it.mid, it.name.length > 6 ? 7 : 8, on ? '#fff' : '#3a2f29', on || maybe ? 600 : 400);
      out += `</g>`;
    });
  });

  // 中心：写真またはカップの形
  if (photoUrl) {
    out += `<image href="${photoUrl}" x="${C - R.hole}" y="${C - R.hole}" width="${R.hole * 2}" height="${R.hole * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#holeClip)"/>`;
  } else {
    out += `<circle cx="${C}" cy="${C}" r="${R.hole - 3}" fill="#3B2A20"/><circle cx="${C}" cy="${C}" r="${R.hole - 14}" fill="#5A3E2E"/>`;
  }

  // 重心の印
  const c = flavorCentroid([...sel]);
  if (c) {
    const r = R.hole + 6 + c.strength * (R.item - R.hole - 12);
    const [x, y] = pt(r, c.angle);
    const [mx, my] = pt(R.item + 9, c.angle);
    const [lx, ly] = pt(R.item + 3, c.angle - 4), [rx, ry] = pt(R.item + 3, c.angle + 4);
    out += `<line x1="${C}" y1="${C}" x2="${f(x)}" y2="${f(y)}" stroke="#1F1A17" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7"/>`;
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="8" fill="#1F1A17" stroke="#fff" stroke-width="2.5"/>`;
    out += `<path d="M${f(mx)} ${f(my)}L${f(lx)} ${f(ly)}L${f(rx)} ${f(ry)}Z" fill="#1F1A17"/>`;
  }
  out += `</svg>`;
  return out;
}

// 7軸のレーダー
export function radarSVG(scores, { size = 300, compare = null } = {}) {
  const cx = 160, cy = 150, rMax = 105, n = ATTRS.length;
  const p = (i, v) => { const a = (i / n) * Math.PI * 2; return [cx + rMax * (v / 5) * Math.sin(a), cy - rMax * (v / 5) * Math.cos(a)]; };
  let out = `<svg class="radar" viewBox="0 0 320 300" width="100%" style="max-width:${size}px" role="img" aria-label="味のバランス">`;
  for (let lv = 1; lv <= 5; lv++) {
    const pts = ATTRS.map((_, i) => p(i, lv).map(f).join(',')).join(' ');
    out += `<polygon points="${pts}" fill="none" stroke="#D9D4CC" stroke-width="${lv === 5 ? 1.2 : .7}"/>`;
  }
  ATTRS.forEach((a, i) => {
    const [x, y] = p(i, 5);
    out += `<line x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}" stroke="#D9D4CC" stroke-width=".7"/>`;
    const [tx, ty] = p(i, 6.1);
    out += `<text x="${f(tx)}" y="${f(ty)}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#3a2f29">${a.name}</text>`;
  });
  const poly = (s, color, op) => {
    const pts = ATTRS.map((a, i) => p(i, s?.[a.id] ?? 0).map(f).join(',')).join(' ');
    return `<polygon points="${pts}" fill="${color}" fill-opacity="${op}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  };
  if (compare) out += poly(compare, '#8A9A6B', .12);
  out += poly(scores, '#9E2A3A', .22);
  ATTRS.forEach((a, i) => { const v = scores?.[a.id]; if (v) { const [x, y] = p(i, v); out += `<circle cx="${f(x)}" cy="${f(y)}" r="3.5" fill="#9E2A3A"/>`; } });
  out += `</svg>`;
  return out;
}

// 味の地図：横 = 明るい（酸）↔ 深い（苦）、縦 = 軽い ↔ 重い（コク）
export function tasteMapSVG(records, { highlight = null } = {}) {
  const W = 340, H = 340, pad = 34;
  const X = v => pad + ((v + 4.6) / 9.2) * (W - pad * 2);  // 酸味−苦味：-4〜4（端に余白）
  const Y = v => H - pad - ((v - 0.6) / 4.8) * (H - pad * 2);  // コク：1〜5（端に余白）
  let out = `<svg class="tastemap" viewBox="0 0 ${W} ${H}" role="img" aria-label="味の地図">`;
  out += `<rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" fill="#fff" stroke="#D9D4CC"/>`;
  out += `<line x1="${W / 2}" y1="${pad}" x2="${W / 2}" y2="${H - pad}" stroke="#D9D4CC"/><line x1="${pad}" y1="${H / 2}" x2="${W - pad}" y2="${H / 2}" stroke="#D9D4CC"/>`;
  const q = (x, y, t, a) => `<text x="${x}" y="${y}" font-size="11" fill="#9b928a" text-anchor="${a}">${t}</text>`;
  out += q(pad + 8, pad + 18, '深く重厚', 'start') + q(W - pad - 8, pad + 18, '明るく重厚', 'end');
  out += q(pad + 8, H - pad - 10, '深く軽やか', 'start') + q(W - pad - 8, H - pad - 10, '明るく軽やか', 'end');
  out += `<text x="${pad}" y="${H - 10}" font-size="11" fill="#3a2f29">← 苦味が主役</text><text x="${W - pad}" y="${H - 10}" font-size="11" fill="#3a2f29" text-anchor="end">酸味が主役 →</text>`;
  out += `<text x="14" y="${H / 2}" font-size="11" fill="#3a2f29" text-anchor="middle" transform="rotate(-90 14 ${H / 2})">軽い ← コク → 重い</text>`;
  records.forEach(r => {
    const s = r.scores || {};
    if (!s.acidity || !s.bitterness || !s.body) return;
    const x = X(s.acidity - s.bitterness), y = Y(s.body);
    const jitter = (parseInt(r.id.slice(-3), 36) % 9 - 4) * 1.2;
    const hl = highlight && r.id === highlight;
    const col = r.type === 'cafe' ? '#9E2A3A' : '#5F7A3A';
    out += `<a href="#/r/${r.id}"><circle cx="${f(x + jitter)}" cy="${f(y - jitter)}" r="${hl ? 9 : 6.5}" fill="${col}" fill-opacity="${hl ? 1 : .75}" stroke="#fff" stroke-width="2"><title>${escapeXml(r.title || '')}</title></circle></a>`;
  });
  out += `</svg>`;
  return out;
}

export function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
