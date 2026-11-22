// シェア用の正方形レポート（1080×1080）を作る
import { ITEM_BY_ID, summarySentence } from './flavors.js';
import { wheelSVG, rateColor } from './charts.js';

const S = 1080, INK = '#1D1A17', SUB = '#8A847C', BEAN = '#3B2A20', LINE = '#E4E0DA', PAPER = '#FBFAF8';
const MIN = '"Zen Old Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif';
const SANS = '-apple-system, "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", sans-serif';

const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
function wrap(ctx, text, maxW, maxLines) {
  const lines = []; let cur = '';
  for (const ch of text) { if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; }
  return lines;
}

export function shareText(r, title, url) {
  const sent = summarySentence(r).join('');
  const names = (r.flavors || []).map(id => ITEM_BY_ID[id]?.name).filter(Boolean).slice(0, 3).map(n => '#' + n).join(' ');
  return [`${title}${r.rating ? '　' + '★'.repeat(r.rating) : ''}`, sent, '', '一杯を、4つの問いで残す「珈琲テイスティングノート」', url, ['#珈琲テイスティングノート', '#コーヒー', names].filter(Boolean).join(' ')].filter((l, i) => l || i === 2).join('\n');
}

export async function makeCard({ r, title, sub, photoUrl, all, url }) {
  try { await Promise.all([document.fonts.load(`700 56px ${MIN}`, title + '珈琲'), document.fonts.load(`500 36px ${MIN}`, '明')]); } catch {}
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.fillStyle = PAPER; c.fillRect(0, 0, S, S);

  // 写真（丸）
  const px = 170, py = 190, pr = 118;
  c.save(); c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.closePath();
  c.fillStyle = BEAN; c.fill(); c.clip();
  if (photoUrl) { try { const im = await loadImg(photoUrl); const k = Math.max(2 * pr / im.width, 2 * pr / im.height); c.drawImage(im, px - im.width * k / 2, py - im.height * k / 2, im.width * k, im.height * k); } catch {} }
  else { c.fillStyle = '#5A3E2E'; c.beginPath(); c.arc(px, py, pr - 22, 0, Math.PI * 2); c.fill(); }
  c.restore();
  c.strokeStyle = '#fff'; c.lineWidth = 8; c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = LINE; c.lineWidth = 2; c.beginPath(); c.arc(px, py, pr + 5, 0, Math.PI * 2); c.stroke();

  // 名前・場所・星
  const tx = 330; c.textBaseline = 'alphabetic'; c.fillStyle = INK;
  c.font = `700 54px ${MIN}`;
  const tl = wrap(c, title, S - tx - 60, 2);
  let y = tl.length === 1 ? 170 : 140;
  tl.forEach(l => { c.fillText(l, tx, y); y += 68; });
  c.font = `400 28px ${SANS}`; c.fillStyle = SUB; c.fillText(sub, tx, y - 14);
  if (r.rating) { c.font = `400 34px ${SANS}`; c.fillStyle = BEAN; c.fillText('★'.repeat(r.rating) + '☆'.repeat(5 - r.rating), tx, y + 36); }

  // 短評
  const sent = summarySentence(r);
  c.fillStyle = INK; c.font = `500 38px ${MIN}`;
  let sy = 400;
  sent.forEach(s => wrap(c, s, S - 140, 2).forEach(l => { c.fillText(l, 70, sy); sy += 58; }));
  if (!sent.length && r.memo) wrap(c, r.memo, S - 140, 2).forEach(l => { c.fillText(l, 70, sy); sy += 58; });

  // 風味の円
  const svg = wheelSVG(new Set(r.flavors || [])).replace('<svg class="wheel"', `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="880" font-family='${SANS.replace(/"/g, '')}'`);
  try { const wim = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)); c.drawImage(wim, 40, 520, 500, 500); } catch {}

  // マップ（色は星の数。この一杯は大きく、輪で囲む）
  const mx = 610, my = 560, ms = 400;
  c.fillStyle = '#fff'; c.strokeStyle = LINE; c.lineWidth = 2;
  c.beginPath(); c.roundRect(mx, my, ms, ms, 24); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(mx + ms / 2, my + 30); c.lineTo(mx + ms / 2, my + ms - 30); c.moveTo(mx + 30, my + ms / 2); c.lineTo(mx + ms - 30, my + ms / 2); c.stroke();
  c.font = `400 20px ${SANS}`; c.fillStyle = SUB; c.textAlign = 'center';
  c.fillText('重い', mx + ms / 2, my + 26); c.fillText('軽い', mx + ms / 2, my + ms - 10);
  c.textAlign = 'left'; c.fillText('苦味', mx + 12, my + ms / 2 - 10); c.textAlign = 'right'; c.fillText('酸味', mx + ms - 12, my + ms / 2 - 10);
  const pos = q => { const s = q.scores || {}; if (!s.acidity || !s.bitterness || !s.body) return null; const t = q.taste || { x: (s.acidity - s.bitterness) / 4, y: (s.body - 3) / 2 }; return [mx + 40 + (t.x + 1) / 2 * (ms - 80), my + 40 + (1 - t.y) / 2 * (ms - 80)]; };
  (all || []).forEach(q => { if (q.id === r.id) return; const p = pos(q); if (!p) return; c.fillStyle = rateColor(q.rating); c.strokeStyle = q.rating ? '#fff' : '#B9B2A8'; c.lineWidth = 2.5; c.beginPath(); c.arc(p[0], p[1], 10, 0, Math.PI * 2); c.fill(); c.stroke(); });
  const me = pos(r);
  if (me) { c.fillStyle = rateColor(r.rating); c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(me[0], me[1], 17, 0, Math.PI * 2); c.fill(); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.arc(me[0], me[1], 23, 0, Math.PI * 2); c.stroke(); }
  c.textAlign = 'left'; c.fillStyle = SUB; c.font = `400 20px ${SANS}`;
  c.fillText(`テイスティングマップ（${(all || []).filter(pos).length}杯）　色＝★の数`, mx + 4, my - 14);
  c.fillText('風味の円', 70, 520);

  // 下の帯
  c.fillStyle = BEAN; c.font = `700 26px ${MIN}`; c.textAlign = 'left'; c.fillText('珈琲テイスティングノート', 70, S - 30);
  c.fillStyle = SUB; c.font = `400 20px ${SANS}`; c.textAlign = 'right'; c.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), S - 60, S - 32);
  c.textAlign = 'left';
  return new Promise(res => cv.toBlob(res, 'image/png'));
}
