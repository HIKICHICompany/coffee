import { FLAVOR_TREE, FLAVOR_ITEMS, ITEM_BY_ID, TERM_GROUPS, ATTRS, BREW_METHODS, ROAST_LEVELS, PROCESSES, GRINDS, DRINK_STYLES, flavorCentroid, centroidLabel, categoryMix } from './flavors.js';
import { wheelSVG, radarSVG, tasteMapSVG, escapeXml as esc } from './charts.js';
import { db, uid, shrinkImage, blobToDataURL, dataURLToBlob } from './db.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');

const PHOTO_SLOTS = {
  cafe: [['cup', 'カップ'], ['place', '店の雰囲気'], ['food', 'デザート・料理'], ['menu', 'メニュー']],
  home: [['cup', 'カップ'], ['beans', '豆・袋'], ['brew', '淹れている様子'], ['food', 'お菓子・料理']],
};

// ---------- 写真のURL ----------
const urlCache = new Map();
async function photoURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await db.getPhoto(id);
  if (!blob) return null;
  const u = URL.createObjectURL(blob); urlCache.set(id, u); return u;
}
const firstPhoto = r => (r.photos?.cup?.[0]) || Object.values(r.photos || {}).flat()[0] || null;

// ---------- 小物 ----------
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${y}年${+m}月${+d}日`; };
const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const set = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };
const stars = n => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));

function titleOf(r) {
  if (r.type === 'cafe') return r.cafe?.menuName || r.cafe?.shop || 'お店の一杯';
  return r.home?.bean || '家の一杯';
}
function subOf(r) {
  if (r.type === 'cafe') return [r.cafe?.menuName ? r.cafe?.shop : '', fmtDate(r.date)].filter(Boolean).join('　');
  const h = r.home || {};
  return [h.selfRoast ? '自家焙煎' : h.roaster, h.method, fmtDate(r.date)].filter(Boolean).join('　');
}

// 円形サムネイル：外周に選んだ風味の色の輪
function ringStyle(r) {
  const mix = categoryMix(r.flavors || []);
  if (!mix.length) return 'background:#E4DED6';
  const total = mix.reduce((a, m) => a + m.n, 0);
  let acc = 0;
  const stops = mix.map(m => { const a = acc / total * 360, b = (acc += m.n) / total * 360; return `${m.cat.color} ${a}deg ${b}deg`; });
  return `background:conic-gradient(${stops.join(',')})`;
}

// ---------- API ----------
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

// Worker が使えないとき用：端末から直接 OpenStreetMap を検索
async function nearbyDirect(lat, lon) {
  const q = `[out:json][timeout:15];(nwr(around:600,${lat},${lon})[amenity=cafe];nwr(around:600,${lat},${lon})[shop=coffee];nwr(around:600,${lat},${lon})[cuisine~"coffee"];);out center tags 40;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const j = await res.json();
  return shapeShops(j.elements || [], lat, lon);
}
export function shapeShops(elements, lat, lon) {
  const seen = new Set();
  return elements.map(e => {
    const t = e.tags || {}; const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    const name = t['name:ja'] || t.name; if (!name || la == null) return null;
    const addr = [t['addr:province'], t['addr:city'], t['addr:suburb'], t['addr:quarter'], t['addr:neighbourhood'], t['addr:block_number'], t['addr:housenumber']].filter(Boolean).join('') || t['addr:full'] || '';
    const d = distance(lat, lon, la, lo);
    return { name, address: addr, lat: la, lon: lo, distance: Math.round(d) };
  }).filter(Boolean).filter(s => { const k = s.name + Math.round(s.lat * 1e4); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.distance - b.distance).slice(0, 12);
}
function distance(a, b, c, d) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- 一覧 ----------
let listFilter = 'all';
async function renderList() {
  const all = await db.allRecords();
  const list = all.filter(r => listFilter === 'all' || r.type === listFilter);
  const counts = { all: all.length, cafe: all.filter(r => r.type === 'cafe').length, home: all.filter(r => r.type === 'home').length };
  view.innerHTML = `
    <header class="top">
      <h1 class="brand">一杯の記録帳</h1>
      <div class="seg" role="tablist">
        ${[['all', 'すべて'], ['cafe', 'お店'], ['home', '家']].map(([k, l]) => `<button role="tab" aria-selected="${listFilter === k}" data-filter="${k}">${l}<span>${counts[k]}</span></button>`).join('')}
      </div>
    </header>
    ${list.length ? `<ul class="cups">${list.map(r => `
      <li><a href="#/r/${r.id}" class="cup-row">
        <span class="ring" style="${ringStyle(r)}"><span class="thumb" data-photo="${firstPhoto(r) || ''}">${firstPhoto(r) ? '' : `<span class="nophoto"></span>`}</span></span>
        <span class="cup-text">
          <span class="cup-kind ${r.type}">${r.type === 'cafe' ? 'お店' : '家'}</span>
          <strong>${esc(titleOf(r))}</strong>
          <small>${esc(subOf(r))}</small>
          <small class="notes">${(r.flavors || []).slice(0, 4).map(id => esc(ITEM_BY_ID[id]?.name || '')).join('、')}</small>
        </span>
        <span class="cup-rate" aria-label="総合 ${r.rating || 0}">${r.rating ? '★' + r.rating : ''}</span>
      </a></li>`).join('')}</ul>`
      : `<div class="empty">
          <div class="empty-cup"></div>
          <p>${all.length ? 'この条件の記録はまだありません。' : 'まだ一杯も記録がありません。<br>右下の「＋」から、最初の一杯を残しましょう。'}</p>
        </div>`}
  `;
  $$('[data-filter]').forEach(b => b.onclick = () => { listFilter = b.dataset.filter; renderList(); });
  $$('.thumb[data-photo]').forEach(async el => { const u = await photoURL(el.dataset.photo); if (u) el.style.backgroundImage = `url(${u})`; });
}

// ---------- 入力フォーム ----------
let F = null;            // 編集中の記録
let newPhotos = [];      // この編集で追加した写真（取り消し時に消す）
let removedPhotos = [];  // この編集で外した写真（保存時に消す）
let activeCat = FLAVOR_TREE[0].id;

function blankRecord(type) {
  return {
    id: uid(), type, date: today(), createdAt: new Date().toISOString(),
    cafe: type === 'cafe' ? {} : undefined, home: type === 'home' ? {} : undefined,
    flavors: [], terms: {}, scores: {}, rating: 0, memo: '',
    photos: Object.fromEntries(PHOTO_SLOTS[type].map(([k]) => [k, []])),
  };
}

const chips = (field, options, { multi = false } = {}) => {
  const cur = get(F, field);
  return `<div class="chips" data-chips="${field}" data-multi="${multi}">${options.map(o => {
    const on = multi ? (cur || []).includes(o) : cur === o;
    return `<button type="button" class="chip" aria-pressed="${on}" data-v="${esc(o)}">${esc(o)}</button>`;
  }).join('')}</div>`;
};
const input = (field, label, { type = 'text', ph = '', unit = '', mode = '' } = {}) =>
  `<label class="field"><span>${label}</span><span class="in"><input type="${type}" data-field="${field}" value="${esc(get(F, field) ?? '')}" placeholder="${ph}" ${mode ? `inputmode="${mode}"` : ''}>${unit ? `<em>${unit}</em>` : ''}</span></label>`;

function photoSlots() {
  return `<div class="photo-grid">${PHOTO_SLOTS[F.type].map(([k, l]) => `
    <div class="slot" data-slot="${k}">
      <div class="slot-head">${l}</div>
      <div class="slot-body">
        ${(F.photos[k] || []).map(id => `<button type="button" class="ph" data-ph="${id}" aria-label="${l}の写真を外す"><span class="x">×</span></button>`).join('')}
        <label class="add-ph"><input type="file" accept="image/*" multiple data-add="${k}" hidden><span>＋</span></label>
      </div>
    </div>`).join('')}</div>`;
}

function tastingBlock() {
  return `
    <section class="block">
      <h2>風味<small>フレーバー</small></h2>
      <p class="hint">感じた香りや味を選びます。円を直接タップしても選べます。</p>
      <div class="wheel-wrap" id="wheelBox">${wheelSVG(new Set(F.flavors), { interactive: true })}</div>
      <p class="centroid" id="centroid"></p>
      <div class="cat-tabs" role="tablist">${FLAVOR_TREE.map(c => `<button type="button" role="tab" data-cat="${c.id}" aria-selected="${c.id === activeCat}" style="--c:${c.color}">${c.name}</button>`).join('')}</div>
      <div id="flavorChips"></div>
      <p class="picked" id="picked"></p>
    </section>
    <section class="block">
      <h2>質感と印象</h2>
      ${TERM_GROUPS.map(g => `<div class="term"><h3>${g.title}<small>${g.sub}</small></h3>${chips('terms.' + g.id, g.terms, { multi: true })}</div>`).join('')}
    </section>
    <section class="block">
      <h2>味のバランス</h2>
      <p class="hint">1（弱い）〜 5（強い）でタップ。</p>
      <div class="scores">${ATTRS.map(a => `
        <div class="score-row"><span class="score-name">${a.name}<small>${a.sub}</small></span>
          <span class="dots" data-score="${a.id}">${[1, 2, 3, 4, 5].map(n => `<button type="button" aria-label="${a.name} ${n}" aria-pressed="${(F.scores[a.id] || 0) >= n}" data-n="${n}"></button>`).join('')}</span>
        </div>`).join('')}</div>
      <div id="radarBox" class="radar-box">${radarSVG(F.scores)}</div>
    </section>`;
}

function renderFlavorChips() {
  const cat = FLAVOR_TREE.find(c => c.id === activeCat);
  $('#flavorChips').innerHTML = cat.groups.map(g => `
    <div class="fgroup"><span class="fgroup-name">${g.name}</span>
      <div class="chips">${g.items.map(n => { const id = `${cat.id}:${n}`; return `<button type="button" class="chip flavor" style="--c:${cat.color}" aria-pressed="${F.flavors.includes(id)}" data-flavor="${id}">${n}</button>`; }).join('')}</div>
    </div>`).join('');
  $$('.cat-tabs [data-cat]').forEach(b => b.setAttribute('aria-selected', b.dataset.cat === activeCat));
}

function refreshTasting() {
  $('#wheelBox').innerHTML = wheelSVG(new Set(F.flavors), { interactive: true });
  const c = flavorCentroid(F.flavors);
  $('#centroid').innerHTML = c ? `味の重心：<strong>${centroidLabel(c)}</strong>` : '';
  $('#picked').textContent = F.flavors.length ? '選んだ風味：' + F.flavors.map(id => ITEM_BY_ID[id]?.name).join('、') : '';
  $$('[data-flavor]').forEach(b => b.setAttribute('aria-pressed', F.flavors.includes(b.dataset.flavor)));
}

function toggleFlavor(id) {
  F.flavors = F.flavors.includes(id) ? F.flavors.filter(x => x !== id) : [...F.flavors, id];
  if (navigator.vibrate) navigator.vibrate(8);
  refreshTasting();
}

async function renderForm(type, base, isEdit = false) {
  F = base ? structuredClone(base) : blankRecord(type);
  type = F.type;
  F.photos ??= {}; PHOTO_SLOTS[type].forEach(([k]) => F.photos[k] ??= []);
  newPhotos = []; removedPhotos = [];
  const isCafe = type === 'cafe';
  view.innerHTML = `
    <header class="form-top">
      <button type="button" class="back" id="cancel">戻る</button>
      <h1>${isEdit ? '記録を直す' : isCafe ? 'お店の一杯' : '家の一杯'}</h1>
      <span></span>
    </header>
    <form id="form" autocomplete="off">
    ${isCafe ? `
      <section class="block">
        <h2>お店</h2>
        <button type="button" class="act" id="findShop"><span class="ico pin"></span>現在地からお店を探す</button>
        <div id="shopList"></div>
        ${input('cafe.shop', '店名', { ph: '例：〇〇珈琲店' })}
        ${input('cafe.address', '場所', { ph: '住所や最寄り駅（任意）' })}
        ${input('date', '日付', { type: 'date' })}
      </section>
      <section class="block">
        <h2>飲んだ一杯</h2>
        <label class="act"><input type="file" accept="image/*" id="menuShot" hidden><span class="ico cam"></span>メニューを撮って読み取る</label>
        <div id="menuList"></div>
        ${input('cafe.menuName', 'メニュー名', { ph: '例：エチオピア イルガチェフェ' })}
        ${input('cafe.origin', '産地', { ph: '国・地域・農園' })}
        <div class="field"><span>精製</span>${chips('cafe.process', PROCESSES)}</div>
        <div class="field"><span>焙煎度</span>${chips('cafe.roast', ROAST_LEVELS)}</div>
        <div class="field"><span>淹れ方</span>${chips('cafe.method', BREW_METHODS)}</div>
        <div class="field"><span>温度</span>${chips('cafe.style', DRINK_STYLES)}</div>
        ${input('cafe.price', '値段', { type: 'text', mode: 'numeric', unit: '円' })}
        ${input('cafe.menuNotes', 'メニューにあった味の説明', { ph: '例：ベリー、チョコ、明るい酸' })}
      </section>`
    : `
      <section class="block">
        <h2>豆</h2>
        <label class="act"><input type="file" accept="image/*" id="bagShot" hidden><span class="ico cam"></span>豆の袋を撮って読み取る</label>
        <div id="menuList"></div>
        ${input('home.bean', '豆の名前', { ph: '例：グアテマラ ウエウエテナンゴ' })}
        <div class="field"><span>焙煎</span>
          <div class="chips" data-chips="home.selfRoastLabel"><button type="button" class="chip" id="selfRoast" aria-pressed="${!!F.home.selfRoast}">自家焙煎</button></div>
        </div>
        <div id="roasterBox" ${F.home.selfRoast ? 'hidden' : ''}>${input('home.roaster', '焙煎したお店', { ph: '豆を買ったお店' })}</div>
        ${input('home.roastDate', '焙煎日', { type: 'date' })}
        ${input('home.origin', '産地', { ph: '国・地域・農園' })}
        ${input('home.variety', '品種', { ph: '例：ゲイシャ、ブルボン' })}
        <div class="field"><span>精製</span>${chips('home.process', PROCESSES)}</div>
        <div class="field"><span>焙煎度</span>${chips('home.roast', ROAST_LEVELS)}</div>
        ${input('home.bagNotes', '袋にあった味の説明', { ph: '例：ピーチ、ジャスミン' })}
      </section>
      <section class="block">
        <h2>淹れ方<small>レシピ</small></h2>
        ${input('date', '日付', { type: 'date' })}
        <div class="field"><span>器具</span>${chips('home.method', BREW_METHODS)}</div>
        <div class="field"><span>温度</span>${chips('home.style', DRINK_STYLES)}</div>
        <div class="recipe">
          ${input('home.dose', '豆', { mode: 'decimal', unit: 'g' })}
          ${input('home.water', '湯', { mode: 'decimal', unit: 'g' })}
          ${input('home.temp', '湯温', { mode: 'decimal', unit: '℃' })}
          ${input('home.time', '時間', { ph: '2:30', unit: '分:秒' })}
        </div>
        <p class="ratio" id="ratio"></p>
        <div class="field"><span>挽き目</span>${chips('home.grind', GRINDS)}</div>
      </section>`}
      <section class="block">
        <h2>写真</h2>
        <div id="photos">${photoSlots()}</div>
      </section>
      ${tastingBlock()}
      <section class="block">
        <h2>総合とメモ</h2>
        <div class="field"><span>総合</span><span class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" aria-label="${n}" aria-pressed="${F.rating >= n}">★</button>`).join('')}</span></div>
        ${isCafe ? input('cafe.dessert', '一緒に食べたもの', { ph: '例：自家製プリン' }) : input('home.food', '一緒に食べたもの', { ph: '例：フィナンシェ' })}
        <label class="field"><span>メモ</span><textarea data-field="memo" rows="4" placeholder="気づいたこと、また飲みたいか、次に試すこと">${esc(F.memo || '')}</textarea></label>
      </section>
    </form>
    <div class="savebar"><button type="button" class="save" id="save">保存する</button></div>
  `;
  bindForm();
  renderFlavorChips(); refreshTasting(); refreshPhotos(); refreshRatio();
}

function refreshRatio() {
  const el = $('#ratio'); if (!el) return;
  const d = parseFloat(F.home.dose), w = parseFloat(F.home.water);
  el.textContent = d > 0 && w > 0 ? `比率 1 : ${(w / d).toFixed(1)}` : '';
}

async function refreshPhotos() {
  $('#photos').innerHTML = photoSlots();
  $$('#photos .ph').forEach(async el => { const u = await photoURL(el.dataset.ph); if (u) el.style.backgroundImage = `url(${u})`; });
}

async function addPhotos(slot, files) {
  for (const file of files) {
    const blob = await shrinkImage(file);
    const id = uid();
    await db.putPhoto(id, blob);
    newPhotos.push(id);
    F.photos[slot].push(id);
  }
  refreshPhotos();
}

function bindForm() {
  const form = $('#form');
  form.addEventListener('input', e => {
    const f = e.target.dataset.field; if (!f) return;
    set(F, f, e.target.value);
    if (f === 'home.dose' || f === 'home.water') refreshRatio();
  });
  form.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip?.dataset.flavor) return toggleFlavor(chip.dataset.flavor);
    if (chip?.id === 'selfRoast') {
      F.home.selfRoast = !F.home.selfRoast; chip.setAttribute('aria-pressed', F.home.selfRoast);
      $('#roasterBox').hidden = F.home.selfRoast; return;
    }
    if (chip) {
      const box = chip.closest('[data-chips]'); const field = box.dataset.chips; const v = chip.dataset.v;
      if (box.dataset.multi === 'true') {
        const cur = get(F, field) || [];
        set(F, field, cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]);
        chip.setAttribute('aria-pressed', !cur.includes(v));
      } else {
        const now = get(F, field) === v ? '' : v; set(F, field, now);
        $$('.chip', box).forEach(c => c.setAttribute('aria-pressed', c.dataset.v === now));
      }
      return;
    }
    const tab = e.target.closest('.cat-tabs [data-cat]');
    if (tab) { activeCat = tab.dataset.cat; renderFlavorChips(); return; }
    const seg = e.target.closest('.wheel .seg');
    if (seg) { const it = ITEM_BY_ID[seg.dataset.id]; activeCat = it.cat.id; renderFlavorChips(); toggleFlavor(seg.dataset.id); return; }
    const dot = e.target.closest('[data-score] button');
    if (dot) {
      const k = dot.parentElement.dataset.score, n = +dot.dataset.n;
      F.scores[k] = F.scores[k] === n ? n - 1 : n;
      $$('button', dot.parentElement).forEach(b => b.setAttribute('aria-pressed', +b.dataset.n <= F.scores[k]));
      $('#radarBox').innerHTML = radarSVG(F.scores); return;
    }
    const st = e.target.closest('[data-star]');
    if (st) { const n = +st.dataset.star; F.rating = F.rating === n ? n - 1 : n; $$('#stars button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.star <= F.rating)); return; }
    const ph = e.target.closest('.ph');
    if (ph) {
      const id = ph.dataset.ph; const slot = ph.closest('[data-slot]').dataset.slot;
      if (!confirm('この写真を外しますか？')) return;
      F.photos[slot] = F.photos[slot].filter(x => x !== id);
      if (newPhotos.includes(id)) { newPhotos = newPhotos.filter(x => x !== id); db.deletePhoto(id); } else removedPhotos.push(id);
      refreshPhotos(); return;
    }
  });
  form.addEventListener('keydown', e => { const seg = e.target.closest('.wheel .seg'); if (seg && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleFlavor(seg.dataset.id); } });
  form.addEventListener('change', e => {
    const k = e.target.dataset.add; if (k && e.target.files.length) addPhotos(k, [...e.target.files]);
  });

  $('#findShop')?.addEventListener('click', findShops);
  $('#menuShot')?.addEventListener('change', e => e.target.files[0] && readPhoto('menu', e.target.files[0]));
  $('#bagShot')?.addEventListener('change', e => e.target.files[0] && readPhoto('bag', e.target.files[0]));
  $('#cancel').onclick = cancelForm;
  $('#save').onclick = saveForm;
}

async function findShops() {
  const box = $('#shopList');
  box.innerHTML = `<p class="busy">現在地を確かめています…</p>`;
  try {
    const p = await getPosition();
    F.cafe.lat = p.latitude; F.cafe.lon = p.longitude;
    box.innerHTML = `<p class="busy">近くのお店を探しています…</p>`;
    let shops;
    try { shops = (await api(`/api/nearby?lat=${p.latitude}&lon=${p.longitude}`)).shops; }
    catch { shops = await nearbyDirect(p.latitude, p.longitude); }
    if (!shops.length) { box.innerHTML = `<p class="busy">近くにお店が見つかりませんでした。店名を入力してください（位置は記録しました）。</p>`; return; }
    box.innerHTML = `<ul class="picklist">${shops.map((s, i) => `<li><button type="button" data-shop="${i}"><strong>${esc(s.name)}</strong><small>${s.distance}m${s.address ? '　' + esc(s.address) : ''}</small></button></li>`).join('')}</ul>`;
    $$('[data-shop]', box).forEach(b => b.onclick = () => {
      const s = shops[+b.dataset.shop];
      Object.assign(F.cafe, { shop: s.name, address: s.address || F.cafe.address || '', lat: s.lat, lon: s.lon });
      $('[data-field="cafe.shop"]').value = s.name; $('[data-field="cafe.address"]').value = F.cafe.address || '';
      box.innerHTML = ''; toast(`${s.name} にしました`);
    });
  } catch (err) { box.innerHTML = `<p class="busy err">${esc(err.message)}</p>`; }
}

async function readPhoto(kind, file) {
  const box = $('#menuList');
  box.innerHTML = `<p class="busy">${kind === 'menu' ? 'メニュー' : '袋'}を読み取っています…（10秒ほど）</p>`;
  const blob = await shrinkImage(file, 1568, 0.85);
  const id = uid(); await db.putPhoto(id, blob); newPhotos.push(id);
  const slot = kind === 'menu' ? 'menu' : 'beans'; F.photos[slot].push(id); refreshPhotos();
  try {
    const dataUrl = await blobToDataURL(blob);
    const res = await api('/api/read', { method: 'POST', body: JSON.stringify({ kind, image: dataUrl.split(',')[1], mediaType: 'image/jpeg', shop: F.cafe?.shop || '' }) });
    const items = res.items || [];
    if (!items.length) { box.innerHTML = `<p class="busy">コーヒーの名前を読み取れませんでした。手で入力してください（写真は残しました）。</p>`; return; }
    if (kind === 'bag') { applyBag(items[0]); box.innerHTML = ''; toast('袋の内容を入れました。違う所は直してください'); return; }
    box.innerHTML = `<p class="hint">飲んだものをタップしてください。</p><ul class="picklist">${items.map((m, i) => `<li><button type="button" data-menu="${i}"><strong>${esc(m.name)}</strong><small>${esc([m.origin, m.process, m.roast, m.price ? m.price + '円' : ''].filter(Boolean).join('　'))}</small></button></li>`).join('')}</ul>`;
    $$('[data-menu]', box).forEach(b => b.onclick = () => { applyMenu(items[+b.dataset.menu]); box.innerHTML = ''; toast('メニューの内容を入れました'); });
  } catch (err) {
    box.innerHTML = `<p class="busy err">${esc(err.message)}<br>写真は残したので、手で入力してください。</p>`;
  }
}

function pickOption(v, list) { if (!v) return ''; return list.find(o => v.includes(o) || o.includes(v)) || ''; }
function applyMenu(m) {
  Object.assign(F.cafe, {
    menuName: m.name || F.cafe.menuName, origin: m.origin || F.cafe.origin,
    process: pickOption(m.process, PROCESSES) || F.cafe.process, roast: pickOption(m.roast, ROAST_LEVELS) || F.cafe.roast,
    method: pickOption(m.method, BREW_METHODS) || F.cafe.method, price: m.price ? String(m.price) : F.cafe.price,
    menuNotes: m.notes || F.cafe.menuNotes,
  });
  syncFields();
}
function applyBag(b) {
  Object.assign(F.home, {
    bean: b.name || F.home.bean, roaster: b.roaster || F.home.roaster, origin: b.origin || F.home.origin,
    variety: b.variety || F.home.variety, process: pickOption(b.process, PROCESSES) || F.home.process,
    roast: pickOption(b.roast, ROAST_LEVELS) || F.home.roast, roastDate: b.roastDate || F.home.roastDate, bagNotes: b.notes || F.home.bagNotes,
  });
  syncFields();
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
  F.title = titleOf(F);
  F.updatedAt = new Date().toISOString();
  await db.putRecord(F);
  for (const id of removedPhotos) await db.deletePhoto(id);
  newPhotos = []; removedPhotos = [];
  toast('保存しました');
  location.replace(`#/r/${F.id}`);
}

// ---------- 詳細 ----------
async function renderDetail(id) {
  const r = await db.getRecord(id);
  if (!r) { view.innerHTML = `<div class="empty"><p>この記録は見つかりませんでした。</p><a class="act" href="#/">一覧へ戻る</a></div>`; return; }
  const cupUrl = await photoURL(r.photos?.cup?.[0] || firstPhoto(r));
  const c = flavorCentroid(r.flavors || []);
  const info = r.type === 'cafe'
    ? [['店名', r.cafe.shop], ['場所', r.cafe.address], ['メニュー', r.cafe.menuName], ['産地', r.cafe.origin], ['精製', r.cafe.process], ['焙煎度', r.cafe.roast], ['淹れ方', [r.cafe.method, r.cafe.style].filter(Boolean).join('・')], ['値段', r.cafe.price ? r.cafe.price + '円' : ''], ['お店の説明', r.cafe.menuNotes], ['一緒に食べたもの', r.cafe.dessert]]
    : [['豆', r.home.bean], ['焙煎', r.home.selfRoast ? '自家焙煎' : r.home.roaster], ['焙煎日', fmtDate(r.home.roastDate)], ['産地', r.home.origin], ['品種', r.home.variety], ['精製', r.home.process], ['焙煎度', r.home.roast], ['器具', [r.home.method, r.home.style].filter(Boolean).join('・')], ['レシピ', recipeText(r.home)], ['挽き目', r.home.grind], ['袋の説明', r.home.bagNotes], ['一緒に食べたもの', r.home.food]];
  const terms = TERM_GROUPS.flatMap(g => (r.terms?.[g.id] || []).map(t => ({ g: g.title, t })));
  const slots = PHOTO_SLOTS[r.type].filter(([k]) => r.photos?.[k]?.length);
  const hasScores = ATTRS.some(a => r.scores?.[a.id]);
  view.innerHTML = `
    <header class="form-top">
      <a class="back" href="#/">一覧</a>
      <span></span>
      <a class="back" href="#/edit/${r.id}">直す</a>
    </header>
    <article class="detail">
      <p class="kind ${r.type}">${r.type === 'cafe' ? 'お店の一杯' : '家の一杯'}　${fmtDate(r.date)}</p>
      <h1>${esc(titleOf(r))}</h1>
      ${r.type === 'cafe' && r.cafe.menuName && r.cafe.shop ? `<p class="at">${esc(r.cafe.shop)}</p>` : ''}
      ${r.rating ? `<p class="rate" aria-label="総合 ${r.rating}">${stars(r.rating)}</p>` : ''}
      <div class="wheel-wrap big">${wheelSVG(new Set(r.flavors || []), { photoUrl: cupUrl })}</div>
      ${c ? `<p class="centroid">味の重心：<strong>${centroidLabel(c)}</strong></p>` : ''}
      ${(r.flavors || []).length ? `<div class="tags">${r.flavors.map(id => { const it = ITEM_BY_ID[id]; return it ? `<span class="tag" style="--c:${it.cat.color}">${it.name}</span>` : ''; }).join('')}</div>` : ''}
      ${terms.length ? `<div class="tags terms">${terms.map(x => `<span class="tag plain">${esc(x.t)}</span>`).join('')}</div>` : ''}
      ${hasScores ? `<section class="block"><h2>味のバランス</h2><div class="radar-box">${radarSVG(r.scores)}</div></section>` : ''}
      ${r.memo ? `<section class="block"><h2>メモ</h2><p class="memo">${esc(r.memo).replace(/\n/g, '<br>')}</p></section>` : ''}
      ${slots.length ? `<section class="block"><h2>写真</h2>${slots.map(([k, l]) => `<h3 class="ph-h">${l}</h3><div class="gallery">${r.photos[k].map(pid => `<button type="button" class="gph" data-full="${pid}" aria-label="${l}の写真を大きく見る"></button>`).join('')}</div>`).join('')}</section>` : ''}
      <section class="block"><h2>くわしく</h2><dl class="info">${info.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${r.type === 'cafe' && r.cafe.lat ? `<a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${r.cafe.lat},${r.cafe.lon}" target="_blank" rel="noopener">地図で開く</a>` : ''}
      </section>
      <div class="detail-actions">
        ${r.type === 'home' ? `<button type="button" class="act" id="again">同じ豆でもう一杯記録する</button>` : `<button type="button" class="act" id="again">このお店でもう一杯記録する</button>`}
        <button type="button" class="danger" id="del">この記録を消す</button>
      </div>
    </article>`;
  $$('.gph').forEach(async el => { const u = await photoURL(el.dataset.full); if (u) el.style.backgroundImage = `url(${u})`; el.onclick = () => showFull(u); });
  $('#del').onclick = async () => {
    if (!confirm('この記録と写真を消します。元に戻せません。消しますか？')) return;
    for (const pid of Object.values(r.photos || {}).flat()) await db.deletePhoto(pid);
    await db.deleteRecord(r.id); toast('消しました'); location.hash = '#/';
  };
  $('#again').onclick = () => {
    const n = blankRecord(r.type);
    if (r.type === 'home') n.home = { ...r.home, time: r.home.time };
    else n.cafe = { shop: r.cafe.shop, address: r.cafe.address, lat: r.cafe.lat, lon: r.cafe.lon };
    pendingDraft = n; location.hash = `#/new/${r.type}`;
  };
}
let pendingDraft = null;
function recipeText(h) {
  const d = parseFloat(h.dose), w = parseFloat(h.water);
  return [h.dose && `豆${h.dose}g`, h.water && `湯${h.water}g`, d > 0 && w > 0 && `1:${(w / d).toFixed(1)}`, h.temp && `${h.temp}℃`, h.time && h.time].filter(Boolean).join('　');
}
function showFull(u) {
  const o = $('#full'); o.innerHTML = `<img src="${u}" alt="">`; o.hidden = false;
  o.onclick = () => { o.hidden = true; o.innerHTML = ''; };
}

// ---------- 味の地図 ----------
async function renderMap() {
  const all = await db.allRecords();
  const freq = {}; all.forEach(r => (r.flavors || []).forEach(id => freq[id] = (freq[id] || 0) + 1));
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = top[0]?.[1] || 1;
  const liked = all.filter(r => (r.rating || 0) >= 4).flatMap(r => r.flavors || []);
  const likedC = flavorCentroid(liked);
  const shops = {}; all.filter(r => r.type === 'cafe' && r.cafe?.shop).forEach(r => { const s = shops[r.cafe.shop] ??= { n: 0, sum: 0, k: 0 }; s.n++; if (r.rating) { s.sum += r.rating; s.k++; } });
  const shopTop = Object.entries(shops).sort((a, b) => b[1].n - a[1].n).slice(0, 5);
  const plotted = all.filter(r => r.scores?.acidity && r.scores?.bitterness && r.scores?.body).length;
  view.innerHTML = `
    <header class="top"><h1 class="brand">味の地図</h1></header>
    <section class="block">
      <h2>一杯ずつの位置</h2>
      <p class="hint">「味のバランス」で酸味・苦味・コクを付けた一杯が並びます（${plotted}杯）。点をタップすると記録が開きます。</p>
      <div class="map-box">${tasteMapSVG(all)}</div>
      <p class="legend"><span class="lg cafe"></span>お店　<span class="lg home"></span>家</p>
    </section>
    <section class="block">
      <h2>好きな一杯の重心</h2>
      <p class="hint">総合★4以上の一杯で選んだ風味を、まとめて円に置いたものです。</p>
      ${liked.length ? `<div class="wheel-wrap">${wheelSVG(new Set(liked))}</div><p class="centroid">あなたの好み：<strong>${centroidLabel(likedC)}</strong></p>` : `<p class="busy">★4以上の記録が増えると、ここに好みの傾向が出ます。</p>`}
    </section>
    <section class="block">
      <h2>よく感じる風味</h2>
      ${top.length ? `<ul class="bars">${top.map(([id, n]) => { const it = ITEM_BY_ID[id]; return `<li><span>${it.name}</span><span class="bar"><span style="width:${n / max * 100}%;background:${it.cat.color}"></span></span><em>${n}</em></li>`; }).join('')}</ul>` : `<p class="busy">まだありません。</p>`}
    </section>
    ${shopTop.length ? `<section class="block"><h2>よく行くお店</h2><ul class="bars shops">${shopTop.map(([name, s]) => `<li><span>${esc(name)}</span><em>${s.n}杯${s.k ? '　平均★' + (s.sum / s.k).toFixed(1) : ''}</em></li>`).join('')}</ul></section>` : ''}
  `;
}

// ---------- 設定 ----------
async function renderSettings() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const all = await db.allRecords();
  view.innerHTML = `
    <header class="top"><h1 class="brand">設定</h1></header>
    <section class="block">
      <h2>読み取りの合言葉</h2>
      <p class="hint">メニューや豆の袋の読み取りに使います。Cloudflare に設定した合言葉（APP_TOKEN）と同じものを入れてください。</p>
      <label class="field"><span>合言葉</span><span class="in"><input type="password" id="tok" value="${esc(token())}" autocomplete="off"></span></label>
      <button type="button" class="act" id="saveTok">合言葉を保存する</button>
    </section>
    <section class="block">
      <h2>控え</h2>
      <p class="hint">記録はこの端末の中だけにあります（${all.length}杯${est ? `、約${(est.usage / 1048576).toFixed(1)}MB` : ''}）。機種変更や消えたときに備えて、ときどき控えを書き出してください。写真も含まれます。</p>
      <button type="button" class="act" id="exp">控えを書き出す</button>
      <label class="act"><input type="file" accept="application/json,.json" id="imp" hidden>控えを読み込む</label>
    </section>
    <section class="block about">
      <h2>このアプリについて</h2>
      <p class="hint">近くのお店は OpenStreetMap のデータで探します。お店が出ないときは店名を入力してください。風味の円は、このアプリ独自の分け方です。</p>
    </section>`;
  if (navigator.storage?.persist) navigator.storage.persist();
  $('#saveTok').onclick = () => { localStorage.setItem('ippai-token', $('#tok').value.trim()); toast('合言葉を保存しました'); };
  $('#exp').onclick = exportAll;
  $('#imp').onchange = e => e.target.files[0] && importAll(e.target.files[0]);
}

async function exportAll() {
  toast('控えを作っています…');
  const records = await db.allRecords();
  const photos = {};
  for (const p of await db.allPhotos()) photos[p.id] = await blobToDataURL(p.blob);
  const blob = new Blob([JSON.stringify({ app: 'ippai-kirokucho', version: 1, exportedAt: new Date().toISOString(), records, photos })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `一杯の記録帳_${today()}.json`; a.click();
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

// ---------- 新規の選択 ----------
function openNewSheet() {
  const s = $('#sheet'); s.hidden = false;
  s.onclick = e => { if (e.target === s || e.target.closest('a')) s.hidden = true; };
}

// ---------- ルーター ----------
async function route() {
  const h = location.hash || '#/';
  $('#sheet').hidden = true;
  $$('.tabbar a').forEach(a => a.setAttribute('aria-current', h === a.getAttribute('href') ? 'page' : 'false'));
  document.body.dataset.mode = /^#\/(new|edit)/.test(h) ? 'form' : 'view';
  window.scrollTo(0, 0);
  let m;
  if ((m = h.match(/^#\/new\/(cafe|home)/))) { const d = pendingDraft; pendingDraft = null; return renderForm(m[1], d && d.type === m[1] ? d : null); }
  if ((m = h.match(/^#\/edit\/(\w+)/))) { const r = await db.getRecord(m[1]); return r ? renderForm(r.type, r, true) : renderList(); }
  if ((m = h.match(/^#\/r\/(\w+)/))) return renderDetail(m[1]);
  if (h === '#/map') return renderMap();
  if (h === '#/settings') return renderSettings();
  return renderList();
}

window.addEventListener('hashchange', route);
$('#newBtn').onclick = openNewSheet;
route();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
