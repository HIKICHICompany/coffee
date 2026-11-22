import { FLAVOR_TREE, FLAVOR_ITEMS, ITEM_BY_ID, TERM_GROUPS, TERM_BY_ID, ATTRS, BREW_METHODS, ROAST_LEVELS, PROCESSES, GRINDS, DRINK_STYLES, flavorCentroid, centroidLabel, categoryMix, catLabel, catColor, suggestFlavors, summarySentence } from './flavors.js';
import { wheelSVG, radarSVG, tasteMapSVG, escapeXml as esc } from './charts.js';
import { db, uid, shrinkImage, blobToDataURL, dataURLToBlob } from './db.js';
import { coverHTML } from './covers.js';
import { initBgm, syncButtons } from './bgm.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');

// 写真の入れ物（古い記録の枠もそのまま読める）
const PHOTO_KEYS = ['cup', 'place', 'food', 'menu', 'beans', 'brew'];
const allPhotos = r => PHOTO_KEYS.flatMap(k => r.photos?.[k] || []);
const firstPhoto = r => r.photos?.cup?.[0] || allPhotos(r)[0] || null;

const urlCache = new Map();
async function photoURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await db.getPhoto(id);
  if (!blob) return null;
  const u = URL.createObjectURL(blob); urlCache.set(id, u); return u;
}

// ---------- 小物 ----------
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = s => { if (!s) return ''; const [, m, d] = s.split('-'); return `${+m}月${+d}日`; };
const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const set = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };
const stars = n => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));

function titleOf(r) {
  if (r.type === 'cafe') return r.cafe?.menuName || r.cafe?.shop || 'お店の一杯';
  return r.home?.bean || '家の一杯';
}
function subOf(r) {
  const where = r.type === 'cafe' ? (r.cafe?.menuName ? r.cafe?.shop : '') || 'お店で' : '家で';
  return [where, fmtDate(r.date)].filter(Boolean).join('・');
}
function ringStyle(r) {
  const mix = categoryMix(r.flavors || []);
  if (!mix.length) return 'background:#E4DED6';
  const total = mix.reduce((a, m) => a + m.n, 0);
  let acc = 0;
  return `background:conic-gradient(${mix.map(m => { const a = acc / total * 360, b = (acc += m.n) / total * 360; return `${m.cat.color} ${a}deg ${b}deg`; }).join(',')})`;
}
const BGM_BTN = '<button type="button" class="icon-btn" data-bgm-toggle aria-pressed="true"><span class="bgm-ico" aria-hidden="true"></span></button>';

// ---------- 通信 ----------
const token = () => localStorage.getItem('ippai-token') || '';
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', 'x-app-token': token(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `通信に失敗しました（${res.status}）`);
  return data;
}
function getPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('この端末では位置情報が使えません'));
    navigator.geolocation.getCurrentPosition(p => res(p.coords), e => {
      rej(new Error(e.code === 1 ? '位置情報の利用が許可されていません。設定で許可してください' : '現在地を取得できませんでした'));
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
}

// ---------- 一覧 ----------
async function renderList() {
  const all = await db.allRecords();
  view.innerHTML = `
    <header class="nav"><a class="nav-link" href="#/settings">設定</a>${BGM_BTN}</header>
    <h1 class="big"><a href="#/cover">ノート</a></h1>
    ${all.length ? `<ul class="cups">${all.map(r => `
      <li><a href="#/r/${r.id}" class="cup-row">
        <span class="ring" style="${ringStyle(r)}"><span class="thumb" data-photo="${firstPhoto(r) || ''}">${firstPhoto(r) ? '' : '<span class="nophoto"></span>'}</span></span>
        <span class="cup-text"><strong>${esc(titleOf(r))}</strong><small>${esc(subOf(r))}</small></span>
        <span class="cup-rate">${r.rating ? '★' + r.rating : ''}</span>
      </a></li>`).join('')}</ul>`
      : `<div class="empty"><div class="empty-cup"></div><p>最初の一杯を、下の「＋」から。</p></div>`}`;
  $$('.thumb[data-photo]').forEach(async el => { const u = await photoURL(el.dataset.photo); if (u) el.style.backgroundImage = `url(${u})`; });
}

// ---------- 記録する（4つの問い） ----------
let F = null, step = 0, isEdit = false, proposal = null;
let newPhotos = [], removedPhotos = [];
let activeCat = FLAVOR_TREE[0].id;
const STEPS = ['どの一杯ですか', 'どんな味でしたか', '風味はこのあたり', '好きでしたか'];
const SWEET_WORDS = ['', 'ほのか', '控えめ', 'ほどよい', 'しっかり', 'とても甘い'];
const AFTER_WORDS = ['', 'すっと消える', '短め', 'ほどよい', '長い', 'とても長い'];

function blankRecord(type) {
  return { id: uid(), type, date: today(), createdAt: new Date().toISOString(),
    cafe: type === 'cafe' ? {} : undefined, home: type === 'home' ? {} : undefined,
    flavors: [], terms: {}, scores: {}, rating: 0, memo: '', photos: { cup: [] } };
}
const chips = (field, options, multi = false) => {
  const cur = get(F, field);
  return `<div class="chips" data-chips="${field}" data-multi="${multi}">${options.map(o => `<button type="button" class="chip" aria-pressed="${multi ? (cur || []).includes(o) : cur === o}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
};
const input = (field, label, { type = 'text', ph = '', unit = '', mode = '' } = {}) =>
  `<label class="field"><span>${label}</span><span class="in"><input type="${type}" data-field="${field}" value="${esc(get(F, field) ?? '')}" placeholder="${ph}" ${mode ? `inputmode="${mode}"` : ''}>${unit ? `<em>${unit}</em>` : ''}</span></label>`;
const group = (label, body) => `<div class="field"><span>${label}</span>${body}</div>`;
const termGroup = id => group(TERM_BY_ID[id].title, chips('terms.' + id, TERM_BY_ID[id].terms, true));

function pasteBox(kind) {
  return `<details class="more" id="pasteBox"><summary>うまく読めないときは、文字を貼り付ける</summary>
    <p class="hint">写真の文字を長押しして「コピー」し、ここに貼り付けます。</p>
    <textarea id="pasteText" rows="3"></textarea>
    <button type="button" class="act" id="pasteRead" data-kind="${kind}">貼り付けた文から入れる</button></details>`;
}

function stepWhich() {
  const cafe = F.type === 'cafe';
  return cafe ? `
    <label class="act primary"><input type="file" accept="image/*" id="menuShot" hidden>メニューを撮って読み取る</label>
    <div id="menuList"></div>
    ${input('cafe.menuName', '飲んだコーヒー', { ph: '例：エチオピア ゲデオ' })}
    <button type="button" class="act" id="findShop">現在地からお店を探す</button>
    <div id="shopList"></div>
    ${input('cafe.shop', 'お店', { ph: '店名' })}
    ${group('写真', '<div id="photos"></div>')}
    <details class="more"><summary>くわしく書く</summary>
      ${input('date', '日付', { type: 'date' })}
      ${input('cafe.address', '場所')}
      ${input('cafe.origin', '産地')}
      ${group('精製', chips('cafe.process', PROCESSES))}
      ${group('焙煎度', chips('cafe.roast', ROAST_LEVELS))}
      ${group('淹れ方', chips('cafe.method', BREW_METHODS))}
      ${group('温度', chips('cafe.style', DRINK_STYLES))}
      ${input('cafe.price', '値段', { mode: 'numeric', unit: '円' })}
      ${input('cafe.menuNotes', 'メニューにあった味の説明')}
      ${input('cafe.dessert', '一緒に食べたもの')}
      ${pasteBox('menu')}
    </details>` : `
    <label class="act primary"><input type="file" accept="image/*" id="bagShot" hidden>豆の袋を撮って読み取る</label>
    <div id="menuList"></div>
    ${input('home.bean', '豆', { ph: '例：グアテマラ ウエウエテナンゴ' })}
    ${group('淹れ方', chips('home.method', BREW_METHODS))}
    ${group('写真', '<div id="photos"></div>')}
    <details class="more"><summary>くわしく書く</summary>
      ${input('date', '日付', { type: 'date' })}
      <div class="chips solo"><button type="button" class="chip" id="selfRoast" aria-pressed="${!!F.home.selfRoast}">自家焙煎</button></div>
      <div id="roasterBox" ${F.home.selfRoast ? 'hidden' : ''}>${input('home.roaster', '焙煎したお店')}</div>
      ${input('home.roastDate', '焙煎日', { type: 'date' })}
      ${input('home.origin', '産地')}
      ${input('home.variety', '品種')}
      ${group('精製', chips('home.process', PROCESSES))}
      ${group('焙煎度', chips('home.roast', ROAST_LEVELS))}
      ${group('温度', chips('home.style', DRINK_STYLES))}
      <div class="recipe">
        ${input('home.dose', '豆', { mode: 'decimal', unit: 'g' })}
        ${input('home.water', '湯', { mode: 'decimal', unit: 'g' })}
        ${input('home.temp', '湯温', { mode: 'decimal', unit: '℃' })}
        ${input('home.time', '時間', { ph: '2:30' })}
      </div>
      <p class="ratio" id="ratio"></p>
      ${group('挽き目', chips('home.grind', GRINDS))}
      ${input('home.bagNotes', '袋にあった味の説明')}
      ${input('home.food', '一緒に食べたもの')}
      ${pasteBox('bag')}
    </details>`;
}

function slider(id, label, words) {
  const v = F.scores[id];
  return `<div class="sl${v ? '' : ' unset'}"><label><span>${label}</span><em data-word="${id}">${v ? words[v] : ''}</em></label>
    <input type="range" min="1" max="5" step="1" value="${v || 3}" data-range="${id}" aria-label="${label}"></div>`;
}
function stepTaste() {
  return `
    <p class="hint">点を動かすと、酸味・苦味・コクが記録されます。</p>
    <div class="pad" id="pad" role="application" aria-label="味の位置">
      <span class="t">重い</span><span class="b">軽い</span><span class="l">苦味</span><span class="r">酸味</span>
      <div class="knob" id="knob" hidden></div>
    </div>
    ${slider('sweetness', '甘さ', SWEET_WORDS)}
    ${slider('aftertaste', '余韻', AFTER_WORDS)}
    <details class="more"><summary>くわしく書く</summary>
      ${termGroup('acidity')}${termGroup('mouthfeel')}${termGroup('finish')}${termGroup('cooling')}
    </details>`;
}
function stepFlavor() {
  return `
    <p class="hint">合うものに触れてください。円からも選べます。</p>
    <div id="proposal" class="sugg"></div>
    <div class="wheel-wrap" id="wheelBox"></div>
    <details class="more" id="moreWords"><summary>言葉の一覧から選ぶ</summary>
      <div class="cat-tabs">${FLAVOR_TREE.map(c => `<button type="button" data-cat="${c.id}" aria-selected="${c.id === activeCat}" style="--c:${c.color}">${c.name}</button>`).join('')}</div>
      <div id="flavorChips"></div>
    </details>`;
}
function stepLike() {
  return `
    <div class="stars big-stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" aria-label="${n}" aria-pressed="${F.rating >= n}">★</button>`).join('')}</div>
    <p class="sent" id="sentence"></p>
    <label class="field"><span>メモ</span><textarea data-field="memo" rows="4" placeholder="気づいたこと、次に試すこと">${esc(F.memo || '')}</textarea></label>`;
}

async function renderForm(type, base, edit = false) {
  F = base ? structuredClone(base) : blankRecord(type);
  F.photos ??= {}; F.photos.cup ??= []; F.flavors ??= []; F.terms ??= {}; F.scores ??= {};
  if (!F.taste && F.scores.acidity && F.scores.bitterness && F.scores.body) F.taste = { x: (F.scores.acidity - F.scores.bitterness) / 4, y: (F.scores.body - 3) / 2 };
  isEdit = edit; step = 0; proposal = null; newPhotos = []; removedPhotos = [];
  const bodies = [stepWhich(), stepTaste(), stepFlavor(), stepLike()];
  view.innerHTML = `
    <header class="nav form-nav"><button type="button" class="nav-link" id="back">戻る</button><span class="dots" id="dots">${STEPS.map(() => '<i></i>').join('')}</span><span class="nav-link ghost">戻る</span></header>
    <form id="form" autocomplete="off">${bodies.map((b, i) => `<section class="step" data-step="${i}" hidden><h1 class="q">${STEPS[i]}</h1>${b}</section>`).join('')}</form>
    <div class="savebar"><button type="button" class="save" id="next">次へ</button></div>`;
  bindForm(); renderFlavorChips(); refreshPhotos(); refreshRatio(); placeKnob(); showStep(0);
}

function showStep(n) {
  step = n;
  $$('.step').forEach(s => { s.hidden = +s.dataset.step !== n; });
  $$('#dots i').forEach((d, i) => d.classList.toggle('on', i <= n));
  $('#next').textContent = n === STEPS.length - 1 ? '保存する' : '次へ';
  if (n === 2) { if (!proposal) proposal = suggestFlavors(F); refreshFlavor(); }
  if (n === 3) $('#sentence').innerHTML = summarySentence(F).join('<br>');
  window.scrollTo(0, 0);
}

// 味の点：横＝酸味↔苦味、縦＝コク
function placeKnob() {
  const k = $('#knob'); if (!k || !F.taste) return;
  k.hidden = false; k.style.left = (F.taste.x + 1) / 2 * 100 + '%'; k.style.top = (1 - F.taste.y) / 2 * 100 + '%';
}
function padMove(e) {
  const r = $('#pad').getBoundingClientRect(), c = v => Math.max(-1, Math.min(1, v));
  const x = c(((e.clientX - r.left) / r.width) * 2 - 1), y = c(1 - ((e.clientY - r.top) / r.height) * 2);
  F.taste = { x, y };
  const five = v => Math.max(1, Math.min(5, Math.round(v)));
  Object.assign(F.scores, { acidity: five(3 + 2 * x), bitterness: five(3 - 2 * x), body: five(3 + 2 * y) });
  placeKnob();
}

function renderFlavorChips() {
  const cat = FLAVOR_TREE.find(c => c.id === activeCat);
  $('#flavorChips').innerHTML = cat.groups.map(g => `<div class="fgroup"><span class="fgroup-name">${g.name}</span><div class="chips">${g.items.map(n => { const id = `${cat.id}:${n}`; return `<button type="button" class="chip flavor" style="--c:${cat.color}" aria-pressed="${F.flavors.includes(id)}" data-flavor="${id}">${n}</button>`; }).join('')}</div></div>`).join('');
  $$('.cat-tabs [data-cat]').forEach(b => b.setAttribute('aria-selected', b.dataset.cat === activeCat));
}
function refreshFlavor() {
  const ids = [...new Set([...(proposal || []).map(p => p.id), ...F.flavors])];
  $('#proposal').innerHTML = ids.length
    ? ids.map(id => { const it = ITEM_BY_ID[id]; return it ? `<button type="button" class="sg" aria-pressed="${F.flavors.includes(id)}" data-flavor="${id}" style="--c:${it.cat.color}">${it.name}</button>` : ''; }).join('')
    : '<p class="hint">円に触れて選んでください。</p>';
  $('#wheelBox').innerHTML = wheelSVG(new Set(F.flavors), { interactive: true, suggested: (proposal || []).map(p => p.id) });
  $$('#flavorChips [data-flavor]').forEach(b => b.setAttribute('aria-pressed', F.flavors.includes(b.dataset.flavor)));
}
function toggleFlavor(id) {
  F.flavors = F.flavors.includes(id) ? F.flavors.filter(x => x !== id) : [...F.flavors, id];
  if (navigator.vibrate) navigator.vibrate(8);
  refreshFlavor();
}

function refreshRatio() {
  const el = $('#ratio'); if (!el) return;
  const d = parseFloat(F.home.dose), w = parseFloat(F.home.water);
  el.textContent = d > 0 && w > 0 ? `比率 1 : ${(w / d).toFixed(1)}` : '';
}
async function refreshPhotos() {
  const ids = allPhotos(F);
  $('#photos').innerHTML = `<div class="strip">${ids.map(id => `<button type="button" class="ph" data-ph="${id}" aria-label="写真を外す"><span class="x">×</span></button>`).join('')}<label class="add-ph"><input type="file" accept="image/*" multiple id="addPhoto" hidden><span>＋</span></label></div>`;
  $$('#photos .ph').forEach(async el => { const u = await photoURL(el.dataset.ph); if (u) el.style.backgroundImage = `url(${u})`; });
}
async function addPhotos(files, slot = 'cup') {
  for (const file of files) {
    const blob = await shrinkImage(file); const id = uid();
    await db.putPhoto(id, blob); newPhotos.push(id); (F.photos[slot] ??= []).push(id);
  }
  refreshPhotos();
}

function bindForm() {
  const form = $('#form');
  form.addEventListener('input', e => {
    const rg = e.target.dataset.range;
    if (rg) { const v = +e.target.value; F.scores[rg] = v; e.target.closest('.sl').classList.remove('unset'); $(`[data-word="${rg}"]`).textContent = (rg === 'sweetness' ? SWEET_WORDS : AFTER_WORDS)[v]; return; }
    const f = e.target.dataset.field; if (!f) return;
    set(F, f, e.target.value);
    if (f === 'home.dose' || f === 'home.water') refreshRatio();
  });
  form.addEventListener('click', e => {
    const fl = e.target.closest('[data-flavor]'); if (fl) return toggleFlavor(fl.dataset.flavor);
    const seg = e.target.closest('.wheel .seg'); if (seg) return toggleFlavor(seg.dataset.id);
    const tab = e.target.closest('.cat-tabs [data-cat]'); if (tab) { activeCat = tab.dataset.cat; return renderFlavorChips(); }
    const chip = e.target.closest('.chip');
    if (chip?.id === 'selfRoast') { F.home.selfRoast = !F.home.selfRoast; chip.setAttribute('aria-pressed', F.home.selfRoast); $('#roasterBox').hidden = F.home.selfRoast; return; }
    if (chip) {
      const box = chip.closest('[data-chips]'), field = box.dataset.chips, v = chip.dataset.v;
      if (box.dataset.multi === 'true') { const cur = get(F, field) || []; const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]; set(F, field, next); chip.setAttribute('aria-pressed', next.includes(v)); }
      else { const now = get(F, field) === v ? '' : v; set(F, field, now); $$('.chip', box).forEach(c => c.setAttribute('aria-pressed', c.dataset.v === now)); }
      return;
    }
    const st = e.target.closest('[data-star]');
    if (st) { const n = +st.dataset.star; F.rating = F.rating === n ? n - 1 : n; $$('#stars button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.star <= F.rating)); return; }
    const ph = e.target.closest('.ph');
    if (ph) {
      const id = ph.dataset.ph; if (!confirm('この写真を外しますか？')) return;
      PHOTO_KEYS.forEach(k => { if (F.photos[k]) F.photos[k] = F.photos[k].filter(x => x !== id); });
      if (newPhotos.includes(id)) { newPhotos = newPhotos.filter(x => x !== id); db.deletePhoto(id); } else removedPhotos.push(id);
      return refreshPhotos();
    }
    if (e.target.closest('#findShop')) return findShops();
    if (e.target.closest('#pasteRead')) {
      const text = $('#pasteText').value.trim(); if (!text) return toast('先に文字を貼り付けてください');
      const item = parseLocal(text); F.type === 'home' ? applyBag(item) : applyMenu(item);
      return toast('入れました。違う所は直してください');
    }
  });
  form.addEventListener('keydown', e => { const seg = e.target.closest('.wheel .seg'); if (seg && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleFlavor(seg.dataset.id); } });
  form.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (!f) return;
    if (e.target.id === 'addPhoto') addPhotos([...e.target.files]);
    if (e.target.id === 'menuShot') readPhoto('menu', f);
    if (e.target.id === 'bagShot') readPhoto('bag', f);
  });
  const pad = $('#pad'); let drag = false;
  pad.addEventListener('pointerdown', e => { drag = true; pad.setPointerCapture(e.pointerId); padMove(e); });
  pad.addEventListener('pointermove', e => { if (drag) padMove(e); });
  pad.addEventListener('pointerup', () => { drag = false; });
  pad.addEventListener('pointercancel', () => { drag = false; });
  $('#back').onclick = () => step > 0 ? showStep(step - 1) : cancelForm();
  $('#next').onclick = () => step < STEPS.length - 1 ? showStep(step + 1) : saveForm();
}

async function findShops() {
  const box = $('#shopList');
  box.innerHTML = '<p class="busy">近くのお店を探しています…</p>';
  try {
    const p = await getPosition();
    F.cafe.lat = p.latitude; F.cafe.lon = p.longitude;
    const { shops } = await api(`/api/nearby?lat=${p.latitude}&lon=${p.longitude}`);
    if (!shops.length) { box.innerHTML = '<p class="busy">近くに見つかりませんでした。店名を入力してください。</p>'; return; }
    box.innerHTML = `<ul class="picklist">${shops.map((s, i) => `<li><button type="button" data-shop="${i}"><strong>${esc(s.name)}</strong><small>${s.distance}m</small></button></li>`).join('')}</ul>`;
    $$('[data-shop]', box).forEach(b => b.onclick = () => {
      const s = shops[+b.dataset.shop];
      Object.assign(F.cafe, { shop: s.name, address: s.address || F.cafe.address || '', lat: s.lat, lon: s.lon });
      syncFields(); box.innerHTML = '';
    });
  } catch (err) { box.innerHTML = `<p class="busy">${esc(err.message)}</p>`; }
}

async function readPhoto(kind, file) {
  const box = $('#menuList');
  box.innerHTML = '<p class="busy">読み取っています…（30秒ほど）</p>';
  const blob = await shrinkImage(file, 1568, 0.85);
  const id = uid(); await db.putPhoto(id, blob); newPhotos.push(id);
  (F.photos[kind === 'menu' ? 'menu' : 'beans'] ??= []).push(id); refreshPhotos();
  try {
    const dataUrl = await blobToDataURL(blob);
    const res = await api('/api/read', { method: 'POST', body: JSON.stringify({ kind, image: dataUrl.split(',')[1], mediaType: 'image/jpeg', shop: F.cafe?.shop || '' }) });
    const items = res.items || [];
    if (!items.length) { box.innerHTML = '<p class="busy">読み取れませんでした。写真は残したので、手で入力してください。</p>'; return; }
    if (kind === 'bag') { applyBag(items[0]); box.innerHTML = ''; return toast('袋の内容を入れました'); }
    if (items.length === 1) { applyMenu(items[0]); box.innerHTML = ''; return toast('メニューの内容を入れました'); }
    box.innerHTML = `<p class="hint">飲んだものを選んでください。</p><ul class="picklist">${items.map((m, i) => `<li><button type="button" data-menu="${i}"><strong>${esc(m.name)}</strong><small>${esc([m.roast, m.price ? m.price + '円' : ''].filter(Boolean).join('・'))}</small></button></li>`).join('')}</ul>`;
    $$('[data-menu]', box).forEach(b => b.onclick = () => { applyMenu(items[+b.dataset.menu]); box.innerHTML = ''; });
  } catch (err) { box.innerHTML = `<p class="busy">${esc(err.message)}<br>写真は残したので、手で入力してください。</p>`; }
}

const ORIGIN_WORDS = ['エチオピア', 'ケニア', 'タンザニア', 'ルワンダ', 'ブルンジ', 'ウガンダ', 'イエメン', 'ブラジル', 'コロンビア', 'グアテマラ', 'コスタリカ', 'パナマ', 'ホンジュラス', 'エルサルバドル', 'ニカラグア', 'メキシコ', 'ペルー', 'ボリビア', 'エクアドル', 'ジャマイカ', 'ハワイ', 'インドネシア', 'スマトラ', 'マンデリン', 'スラウェシ', 'トラジャ', 'パプアニューギニア', '東ティモール', 'ベトナム', 'タイ', 'ミャンマー', '中国', '雲南', 'インド'];
const ROAST_WORDS = [[/極深煎り/, 'イタリアン'], [/中深煎り/, 'フルシティ'], [/深煎り/, 'フレンチ'], [/中浅煎り/, 'ミディアム'], [/浅煎り/, 'ライト'], [/中煎り/, 'ハイ']];
const PROCESS_WORDS = [[/嫌気|アナエロ/, 'アナエロビック'], [/パルプド|ハニー/, 'ハニー'], [/非水洗|ナチュラル|天日/, 'ナチュラル'], [/水洗|ウォッシュ/, 'ウォッシュト'], [/スマトラ式/, 'スマトラ式']];
export function parseLocal(text) {
  const t = text.replace(/\r/g, '');
  const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const origin = ORIGIN_WORDS.filter(w => t.includes(w));
  const roast = ROAST_LEVELS.find(r => t.includes(r + 'ロースト')) || ROAST_WORDS.find(([re]) => re.test(t))?.[1] || ROAST_LEVELS.find(r => t.includes(r)) || '';
  const process = PROCESS_WORDS.find(([re]) => re.test(t))?.[1] || '';
  const method = BREW_METHODS.find(m => t.includes(m)) || (/ドリップ/.test(t) ? 'ハンドドリップ' : '');
  const price = (t.match(/(\d[\d,]{2,})\s*円/) || t.match(/[¥￥]\s*(\d[\d,]*)/) || [])[1]?.replace(/,/g, '') || '';
  const date = t.match(/(20\d\d)[./年-](\d{1,2})[./月-](\d{1,2})/) || [];
  const hits0 = FLAVOR_ITEMS.map(i => i.name).filter(n => t.includes(n));
  const flavorHits = hits0.filter(n => !hits0.some(o => o !== n && o.includes(n)));
  const noteLine = lines.find(l => /フレーバー|テイスト|味わい|ノート|香り/.test(l));
  const variety = ['ゲイシャ', 'ゲシャ', 'ブルボン', 'ティピカ', 'カトゥーラ', 'カトゥアイ', 'パカマラ', 'SL28', 'SL34', 'エアルーム', '在来種'].filter(v => t.includes(v)).join('・');
  const name = (lines.find(l => origin.some(o => l.includes(o))) || lines[0] || '').replace(/[¥￥]?\s*\d[\d,]*\s*円?$/, '').slice(0, 40).trim();
  return { name, origin: origin.join(' '), roast, process, method, price, variety,
    roastDate: date.length ? `${date[1]}-${String(date[2]).padStart(2, '0')}-${String(date[3]).padStart(2, '0')}` : '',
    notes: noteLine ? noteLine.replace(/^.*?(フレーバー|テイスト|味わい|ノート|香り)[：:\s]*/, '') : flavorHits.join('、') };
}
const pickOption = (v, list) => !v ? '' : list.find(o => v.includes(o) || o.includes(v)) || '';
function applyMenu(m) {
  Object.assign(F.cafe, {
    menuName: m.name || F.cafe.menuName, origin: m.origin || parseLocal(m.name || '').origin || F.cafe.origin,
    process: pickOption(m.process, PROCESSES) || F.cafe.process, roast: pickOption(m.roast, ROAST_LEVELS) || F.cafe.roast,
    method: pickOption(m.method, BREW_METHODS) || F.cafe.method, price: m.price ? String(m.price) : F.cafe.price, menuNotes: m.notes || F.cafe.menuNotes });
  proposal = null; syncFields();
}
function applyBag(b) {
  Object.assign(F.home, {
    bean: b.name || F.home.bean, roaster: b.roaster || F.home.roaster, origin: b.origin || parseLocal(b.name || '').origin || F.home.origin,
    variety: b.variety || F.home.variety, process: pickOption(b.process, PROCESSES) || F.home.process,
    roast: pickOption(b.roast, ROAST_LEVELS) || F.home.roast, roastDate: b.roastDate || F.home.roastDate, bagNotes: b.notes || F.home.bagNotes });
  proposal = null; syncFields();
}
function syncFields() {
  $$('[data-field]').forEach(el => { el.value = get(F, el.dataset.field) ?? ''; });
  $$('[data-chips]').forEach(box => { if (box.dataset.multi === 'true') return; const v = get(F, box.dataset.chips); $$('.chip[data-v]', box).forEach(c => c.setAttribute('aria-pressed', c.dataset.v === v)); });
}
async function cancelForm() {
  for (const id of newPhotos) await db.deletePhoto(id);
  newPhotos = [];
  history.length > 1 ? history.back() : (location.hash = '#/');
}
async function saveForm() {
  F.title = titleOf(F); F.updatedAt = new Date().toISOString();
  await db.putRecord(F);
  for (const id of removedPhotos) await db.deletePhoto(id);
  newPhotos = []; removedPhotos = [];
  toast('保存しました');
  location.replace(`#/r/${F.id}`);
}

// ---------- 一杯のページ ----------
let pendingDraft = null;
function recipeText(h) {
  const d = parseFloat(h.dose), w = parseFloat(h.water);
  return [h.dose && `豆${h.dose}g`, h.water && `湯${h.water}g`, d > 0 && w > 0 && `1:${(w / d).toFixed(1)}`, h.temp && `${h.temp}℃`, h.time].filter(Boolean).join('　');
}
async function renderDetail(id) {
  const r = await db.getRecord(id);
  if (!r) { view.innerHTML = '<div class="empty"><p>この記録は見つかりませんでした。</p><a class="act" href="#/">ノートへ戻る</a></div>'; return; }
  const cupUrl = await photoURL(firstPhoto(r));
  const c = r.type === 'cafe' ? r.cafe : r.home;
  const info = (r.type === 'cafe'
    ? [['お店', c.shop], ['場所', c.address], ['産地', c.origin], ['精製', c.process], ['焙煎度', c.roast], ['淹れ方', [c.method, c.style].filter(Boolean).join('・')], ['値段', c.price ? c.price + '円' : ''], ['お店の説明', c.menuNotes], ['一緒に', c.dessert]]
    : [['焙煎', c.selfRoast ? '自家焙煎' : c.roaster], ['焙煎日', fmtDate(c.roastDate)], ['産地', c.origin], ['品種', c.variety], ['精製', c.process], ['焙煎度', c.roast], ['淹れ方', [c.method, c.style].filter(Boolean).join('・')], ['レシピ', recipeText(c)], ['挽き目', c.grind], ['袋の説明', c.bagNotes], ['一緒に', c.food]]).filter(([, v]) => v);
  const tags = l => (l || []).join('、');
  const fine = [...TERM_GROUPS.map(g => [g.title, tags(r.terms?.[g.id])]), ['主な味', tags(r.mainTastes)], ['香り', tags((r.aromaCats || []).map(catLabel))]].filter(([, v]) => v);
  const photos = allPhotos(r), hasScores = ATTRS.some(a => r.scores?.[a.id]);
  const sent = summarySentence(r);
  const dl = rows => `<dl class="info">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  view.innerHTML = `
    <header class="nav"><a class="nav-link" href="#/">ノート</a><a class="nav-link" href="#/edit/${r.id}">編集</a></header>
    <article class="detail">
      <div class="wheel-wrap hero">${wheelSVG(new Set(r.flavors || []), { photoUrl: cupUrl })}</div>
      <h1>${esc(titleOf(r))}</h1>
      <p class="d-sub">${esc(subOf(r))}</p>
      ${sent.length ? `<p class="sent">${sent.join('<br>')}</p>` : ''}
      ${r.rating ? `<p class="rate">${stars(r.rating)}</p>` : ''}
      ${r.memo ? `<p class="memo">${esc(r.memo).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="disc">
        ${photos.length ? `<details><summary>写真<span>${photos.length}枚</span></summary><div class="gallery">${photos.map(p => `<button type="button" class="gph" data-full="${p}" aria-label="写真を大きく見る"></button>`).join('')}</div></details>` : ''}
        ${info.length ? `<details><summary>${r.type === 'cafe' ? 'お店とコーヒー' : '豆と淹れ方'}<span>${esc([c.process, c.roast].filter(Boolean).join('・'))}</span></summary>${dl(info)}${r.type === 'cafe' && c.lat ? `<a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}" target="_blank" rel="noopener">地図で開く</a>` : ''}</details>` : ''}
        ${hasScores || fine.length ? `<details><summary>くわしい記録</summary>${hasScores ? `<div class="radar-box">${radarSVG(r.scores)}</div>` : ''}${fine.length ? dl(fine) : ''}</details>` : ''}
      </div>
      <div class="detail-actions">
        <button type="button" class="act" id="again">${r.type === 'home' ? '同じ豆でもう一杯' : 'このお店でもう一杯'}</button>
        <button type="button" class="danger" id="del">この記録を消す</button>
      </div>
    </article>`;
  $$('.gph').forEach(async el => { const u = await photoURL(el.dataset.full); if (u) el.style.backgroundImage = `url(${u})`; el.onclick = () => { const o = $('#full'); o.innerHTML = `<img src="${u}" alt="">`; o.hidden = false; o.onclick = () => { o.hidden = true; o.innerHTML = ''; }; }; });
  $('#del').onclick = async () => {
    if (!confirm('この記録と写真を消します。元に戻せません。消しますか？')) return;
    for (const pid of allPhotos(r)) await db.deletePhoto(pid);
    await db.deleteRecord(r.id); toast('消しました'); location.hash = '#/';
  };
  $('#again').onclick = () => {
    const n = blankRecord(r.type);
    if (r.type === 'home') n.home = { ...r.home }; else n.cafe = { shop: r.cafe.shop, address: r.cafe.address, lat: r.cafe.lat, lon: r.cafe.lon };
    pendingDraft = n; location.hash = `#/new/${r.type}`;
  };
}

// ---------- 味の地図 ----------
async function renderMap() {
  const all = await db.allRecords();
  const freq = {}; all.forEach(r => (r.flavors || []).forEach(id => { if (ITEM_BY_ID[id]) freq[id] = (freq[id] || 0) + 1; }));
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6), max = top[0]?.[1] || 1;
  const liked = all.filter(r => (r.rating || 0) >= 4).flatMap(r => r.flavors || []);
  view.innerHTML = `
    <header class="nav"><span></span>${BGM_BTN}</header>
    <h1 class="big">味の地図</h1>
    <div class="map-box">${tasteMapSVG(all)}</div>
    ${liked.length ? `<h2 class="sec">好きな一杯は、このあたり</h2><div class="wheel-wrap">${wheelSVG(new Set(liked))}</div><p class="centroid">${centroidLabel(flavorCentroid(liked))}</p>` : '<p class="hint center">★4以上の一杯が増えると、好みの傾向がここに出ます。</p>'}
    ${top.length ? `<h2 class="sec">よく感じる風味</h2><ul class="bars">${top.map(([id, n]) => { const it = ITEM_BY_ID[id]; return `<li><span>${it.name}</span><span class="bar"><span style="width:${n / max * 100}%;background:${it.cat.color}"></span></span><em>${n}</em></li>`; }).join('')}</ul>` : ''}`;
}

// ---------- 設定 ----------
async function renderSettings() {
  const all = await db.allRecords();
  view.innerHTML = `
    <header class="nav"><a class="nav-link" href="#/">ノート</a><span></span></header>
    <h1 class="big">設定</h1>
    <div class="disc open">
      <button type="button" class="line" data-bgm-toggle aria-pressed="true">BGM<span class="bgm-label"></span></button>
      <button type="button" class="line" id="exp">控えを書き出す<span>${all.length}杯</span></button>
      <label class="line"><input type="file" accept="application/json,.json" id="imp" hidden>控えを読み込む<span></span></label>
      <details><summary>そのほか</summary>
        <label class="field"><span>読み取りの合言葉（Cloudflare に登録した場合だけ）</span><span class="in"><input type="password" id="tok" value="${esc(token())}" autocomplete="off"></span></label>
        <button type="button" class="act" id="saveTok">合言葉を保存する</button>
        <p class="hint">記録はこの端末の中にあります。機種変更に備えて、ときどき控えを書き出してください。近くのお店は OpenStreetMap、写真の読み取りは Cloudflare の AI を使います。BGM はオリジナル曲です（ピアノの音色：FluidR3 GM、Frank Wen、CC BY 3.0）。</p>
      </details>
    </div>`;
  if (navigator.storage?.persist) navigator.storage.persist();
  $('#saveTok').onclick = () => { localStorage.setItem('ippai-token', $('#tok').value.trim()); toast('保存しました'); };
  $('#exp').onclick = exportAll;
  $('#imp').onchange = e => e.target.files[0] && importAll(e.target.files[0]);
}
async function exportAll() {
  toast('控えを作っています…');
  const records = await db.allRecords(); const photos = {};
  for (const p of await db.allPhotos()) photos[p.id] = await blobToDataURL(p.blob);
  const blob = new Blob([JSON.stringify({ app: 'ippai-kirokucho', version: 1, exportedAt: new Date().toISOString(), records, photos })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `珈琲テイスティングノート_${today()}.json`; a.click();
  toast('控えを書き出しました');
}
async function importAll(file) {
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== 'ippai-kirokucho') throw new Error('このアプリの控えではありません');
    for (const [id, url] of Object.entries(j.photos || {})) await db.putPhoto(id, await dataURLToBlob(url));
    for (const r of j.records || []) await db.putRecord(r);
    toast(`${(j.records || []).length}杯を読み込みました`); location.hash = '#/';
  } catch (e) { toast('読み込めませんでした：' + e.message, 4000); }
}

// ---------- 表紙・切り替え ----------
function renderCover() {
  view.innerHTML = coverHTML();
  $('.cover').onclick = () => { try { sessionStorage.setItem('opened', '1'); } catch {} if (location.hash === '#/' || !location.hash) route(); else location.hash = '#/'; };
}
async function route() {
  const h = location.hash || '#/';
  $('#sheet').hidden = true;
  $$('.tabbar a').forEach(a => a.setAttribute('aria-current', h === a.getAttribute('href') ? 'page' : 'false'));
  let opened = true; try { opened = !!sessionStorage.getItem('opened'); } catch {}
  const showCover = h === '#/cover' || (!opened && h === '#/');
  $('meta[name=theme-color]')?.setAttribute('content', showCover ? '#3B2A20' : '#FBFAF8');
  document.body.dataset.mode = showCover ? 'cover' : /^#\/(new|edit)/.test(h) ? 'form' : /^#\/(r\/|settings)/.test(h) ? 'page' : 'view';
  window.scrollTo(0, 0);
  if (showCover) return renderCover();
  let m;
  if ((m = h.match(/^#\/new\/(cafe|home)/))) { const d = pendingDraft; pendingDraft = null; return renderForm(m[1], d && d.type === m[1] ? d : null); }
  if ((m = h.match(/^#\/edit\/(\w+)/))) { const r = await db.getRecord(m[1]); return r ? renderForm(r.type, r, true) : renderList(); }
  if ((m = h.match(/^#\/r\/(\w+)/))) return renderDetail(m[1]);
  if (h === '#/map') return renderMap();
  if (h === '#/settings') return renderSettings();
  return renderList();
}

window.addEventListener('hashchange', route);
new MutationObserver(() => syncButtons()).observe(view, { childList: true });
initBgm();
$('#newBtn').onclick = () => { const s = $('#sheet'); s.hidden = false; s.onclick = e => { if (e.target === s || e.target.closest('a')) s.hidden = true; }; };
route();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
