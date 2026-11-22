// 風味の言葉（独自に整理した3層の分類）
// category → group → item。円の内側から外側へ並ぶ。
export const FLAVOR_TREE = [
  { id: 'fruit', name: 'フルーティー', short: '果実', color: '#C23A4E', groups: [
    { name: 'ベリー', items: ['ブルーベリー', 'ラズベリー', 'ストロベリー', 'カシス'] },
    { name: '柑橘', items: ['レモン', 'ライム', 'オレンジ', 'グレープフルーツ'] },
    { name: '果樹', items: ['リンゴ', '洋ナシ', 'ピーチ', 'アプリコット', 'チェリー', 'ブドウ'] },
    { name: '南国', items: ['マンゴー', 'パイナップル', 'パッション'] },
    { name: 'ドライ', items: ['レーズン', 'プルーン', 'イチジク'] },
  ]},
  { id: 'floral', name: 'フローラル', short: '花', color: '#B86FA8', groups: [
    { name: '花', items: ['ジャスミン', 'ローズ', 'オレンジの花', 'ラベンダー'] },
    { name: '紅茶', items: ['紅茶', 'ベルガモット', 'カモミール'] },
  ]},
  { id: 'sweet', name: 'スイート', short: '甘み', color: '#D4962A', groups: [
    { name: '砂糖', items: ['ハチミツ', 'キャラメル', '黒糖', 'メープル'] },
    { name: '香り', items: ['バニラ', 'ミルク'] },
  ]},
  { id: 'nutty', name: 'ナッツ・ココア', short: 'ココア', color: '#8A5A3B', groups: [
    { name: 'ナッツ', items: ['アーモンド', 'ヘーゼルナッツ', 'ピーナッツ', 'クルミ'] },
    { name: 'ココア', items: ['ミルクチョコ', 'ダークチョコ', 'カカオ'] },
  ]},
  { id: 'spice', name: 'スパイス', short: 'スパイス', color: '#B5532C', groups: [
    { name: '甘い香辛', items: ['シナモン', 'クローブ', 'ナツメグ', 'カルダモン'] },
    { name: '辛い', items: ['黒コショウ'] },
  ]},
  { id: 'roast', name: 'ロースト', short: '焙煎', color: '#4B362A', groups: [
    { name: '焼き', items: ['トースト', '穀物', '麦芽'] },
    { name: '煙', items: ['スモーキー', '焦げ'] },
  ]},
  { id: 'ferment', name: '発酵・洋酒', short: '洋酒', color: '#7B2A4A', groups: [
    { name: '洋酒', items: ['赤ワイン', 'ラム', 'ウイスキー'] },
    { name: '発酵', items: ['発酵感', '熟成感'] },
  ]},
  { id: 'green', name: 'グリーン', short: '青', color: '#6A8A3A', groups: [
    { name: '植物', items: ['ハーブ', '若草', 'ミント'] },
    { name: '生っぽさ', items: ['青豆', '未熟'] },
  ]},
  { id: 'defect', name: '欠点', short: '欠点', color: '#85857E', groups: [
    { name: '雑味', items: ['紙っぽさ', '土っぽさ', 'カビ'] },
    { name: '化学', items: ['薬品', 'ゴム'] },
    { name: '収れん', items: ['渋み'] },
  ]},
];

// 平たい一覧（id = "カテゴリ:言葉"）と角度を用意
export const FLAVOR_ITEMS = [];
(() => {
  let n = 0;
  FLAVOR_TREE.forEach(c => c.groups.forEach(g => g.items.forEach(name => {
    FLAVOR_ITEMS.push({ id: `${c.id}:${name}`, name, group: g.name, cat: c });
    n++;
  })));
  const step = 360 / n;
  FLAVOR_ITEMS.forEach((it, i) => { it.a0 = i * step; it.a1 = (i + 1) * step; it.mid = (i + 0.5) * step; });
})();
export const ITEM_BY_ID = Object.fromEntries(FLAVOR_ITEMS.map(i => [i.id, i]));

// ---- テイスティングの項目 ----
// 設計の土台：SCAの新しい評価方式（CVA, 2024）の「強さ」と「好み」を分ける考え方、
// 当てはまるものを全部選ぶ方式（CATA）、カップ・オブ・エクセレンスの質の見方。

// 強さ（1〜5）。好き嫌いではなく「どれだけ感じたか」
export const ATTRS = [
  { id: 'acidity', name: '酸味' },
  { id: 'sweetness', name: '甘さ' },
  { id: 'body', name: 'コク' },
  { id: 'bitterness', name: '苦味' },
  { id: 'aftertaste', name: '余韻' },
];
export const FRAGRANCE = { id: 'fragrance', name: '粉の香り', sub: 'フレグランス' };

// 主な味（5つの基本の味から2つまで）
export const MAIN_TASTES = ['甘味', '酸味', '苦味', '塩味', '旨味'];

export const TERM_GROUPS = [
  { id: 'acidity', title: '酸の質', sub: 'アシディティ', terms: ['明るい', 'ジューシー', 'シトリック（柑橘の酸）', 'マリック（リンゴの酸）', 'ワイニー（ぶどうの酸）', '柔らかい', '鋭い', '酸っぱい（いやな酸）'] },
  { id: 'mouthfeel', title: '口あたり', sub: 'マウスフィール', terms: ['シルキー', 'ベルベット', 'シロップのよう', 'クリーミー', 'ティーライク', '軽やか', '重厚', 'ざらつき', '粉っぽい', 'オイリー', '金属っぽい', '口が渇く（ドライ）'] },
  { id: 'finish', title: '余韻の質', sub: 'フィニッシュ', terms: ['甘い余韻', '心地よい苦み', '酸が残る', '香りが残る', 'すっと消える', '渋みが残る'] },
  { id: 'cooling', title: '冷めてからの変化', sub: 'クーリング', terms: ['甘くなった', '酸が明るくなった', '果実感が出た', 'ほぼ変わらない', '苦味が強くなった', '雑味が出た'] },
  { id: 'impression', title: '全体の印象', sub: 'オーバーオール', terms: ['クリーン', 'バランスがいい', '複雑', '透明感', '華やか', '落ち着き', '力強い', '優しい'] },
];
export const TERM_BY_ID = Object.fromEntries(TERM_GROUPS.map(g => [g.id, g]));

// 香り・風味は、まず大きな分類を選び、必要なら一段細かく（CATA）
export function catOptions() {
  return FLAVOR_TREE.map(c => ({ id: c.id, name: c.name, color: c.color, groups: c.groups.map(g => ({ id: `${c.id}/${g.name}`, name: g.name })) }));
}
export function catLabel(key) {
  const [cid, g] = key.split('/');
  const c = FLAVOR_TREE.find(x => x.id === cid);
  return c ? (g ? g : c.name) : key;
}
export function catColor(key) { return FLAVOR_TREE.find(x => x.id === key.split('/')[0])?.color || '#888'; }

export const BREW_METHODS = ['ハンドドリップ', 'エスプレッソ', 'フレンチプレス', 'エアロプレス', 'サイフォン', 'ネルドリップ', '水出し', 'モカポット'];
export const ROAST_LEVELS = ['ライト', 'シナモン', 'ミディアム', 'ハイ', 'シティ', 'フルシティ', 'フレンチ', 'イタリアン'];
export const PROCESSES = ['ウォッシュト', 'ナチュラル', 'ハニー', 'アナエロビック', 'スマトラ式'];
export const GRINDS = ['極細', '細挽き', '中細', '中挽き', '粗挽き'];
export const DRINK_STYLES = ['ホット', 'アイス'];

// 選んだ風味の「重心」：角度の平均と、まとまり具合（0〜1）
export function flavorCentroid(ids) {
  const items = ids.map(id => ITEM_BY_ID[id]).filter(Boolean);
  if (!items.length) return null;
  let x = 0, y = 0;
  items.forEach(it => { const r = it.mid * Math.PI / 180; x += Math.sin(r); y += Math.cos(r); });
  x /= items.length; y /= items.length;
  const strength = Math.min(1, Math.hypot(x, y));
  let ang = Math.atan2(x, y) * 180 / Math.PI; if (ang < 0) ang += 360;
  const near = FLAVOR_ITEMS.reduce((b, it) => {
    const d = Math.min(Math.abs(it.mid - ang), 360 - Math.abs(it.mid - ang));
    return d < b.d ? { d, it } : b;
  }, { d: 999, it: null }).it;
  return { angle: ang, strength, cat: near.cat, item: near };
}

export function centroidLabel(c) {
  if (!c) return '';
  const deg = c.strength > 0.75 ? 'はっきり' : c.strength > 0.4 ? 'やや' : 'ほぼ中央（複雑）';
  return c.strength > 0.4 ? `${c.cat.name}寄り（${deg}）` : deg;
}

// 選んだ風味のカテゴリ割合（一覧の色リング用）
export function categoryMix(ids) {
  const count = {};
  ids.forEach(id => { const it = ITEM_BY_ID[id]; if (it) count[it.cat.id] = (count[it.cat.id] || 0) + 1; });
  return FLAVOR_TREE.filter(c => count[c.id]).map(c => ({ cat: c, n: count[c.id] }));
}

// ---- 風味の円の提案 ----
// それまでの入力（香り・風味の分類、酸の質、精製、焙煎度、産地、お店や袋の説明）から、
// 円のどこに当たりそうかを点数にし、根拠と一緒に返す。
const WORDS = [
  [/チョコ/, ['ミルクチョコ', 'ダークチョコ']], [/カカオ|ココア/, ['カカオ']], [/柑橘|シトラス|citrus/i, ['レモン', 'オレンジ']],
  [/ベリー|berry/i, ['ブルーベリー', 'ラズベリー']], [/ナッツ|nut/i, ['アーモンド', 'ヘーゼルナッツ']], [/ワイン|wine/i, ['赤ワイン']],
  [/はちみつ|蜂蜜|ハニー|honey/i, ['ハチミツ']], [/桃|ピーチ|peach/i, ['ピーチ']], [/りんご|林檎|apple/i, ['リンゴ']],
  [/みかん|オレンジ|orange/i, ['オレンジ']], [/苺|いちご|strawberry/i, ['ストロベリー']], [/ぶどう|葡萄|グレープ(?!フルーツ)|grape(?!fruit)/i, ['ブドウ']],
  [/花|フローラル|floral/i, ['ジャスミン', 'ローズ']], [/黒糖|ブラウンシュガー|brown sugar/i, ['黒糖']], [/トフィー|toffee|カラメル/i, ['キャラメル']],
  [/杏|あんず|apricot/i, ['アプリコット']], [/チェリー|さくらんぼ|cherry/i, ['チェリー']], [/スパイス|spice/i, ['シナモン']],
  [/スモーク|smoky/i, ['スモーキー']], [/ハーブ|herb/i, ['ハーブ']], [/ラム|rum/i, ['ラム']], [/バニラ|vanilla/i, ['バニラ']],
];
const ORIGINS = [
  [/エチオピア|イルガチェフェ|シダモ|グジ|ゲデオ/, { 'ジャスミン': 1.5, 'ベルガモット': 1.2, 'レモン': 1, 'ピーチ': .8, 'ブルーベリー': .6 }],
  [/ケニア/, { 'カシス': 1.8, 'グレープフルーツ': 1.4, 'トマト': 0, 'ブラックベリー': 0, 'ラズベリー': .8 }],
  [/ブラジル/, { 'ピーナッツ': 1.4, 'アーモンド': 1.2, 'ミルクチョコ': 1.4, 'キャラメル': .8 }],
  [/コロンビア/, { 'キャラメル': 1, 'オレンジ': 1, 'ミルクチョコ': 1, 'リンゴ': .6 }],
  [/グアテマラ/, { 'ミルクチョコ': 1.4, 'キャラメル': 1, 'オレンジ': .6, 'アーモンド': .6 }],
  [/コスタリカ/, { 'ハチミツ': 1.2, 'アプリコット': 1, 'オレンジ': .6 }],
  [/パナマ|ゲイシャ|ゲシャ|geisha|gesha/i, { 'ジャスミン': 2, 'ベルガモット': 1.5, 'ピーチ': 1.2, 'マンゴー': .6 }],
  [/マンデリン|スマトラ|インドネシア|スラウェシ|トラジャ/, { 'ハーブ': 1.4, 'ダークチョコ': 1.2, 'シナモン': .8, '黒糖': .6 }],
  [/ルワンダ|ブルンジ/, { '紅茶': 1.2, 'ラズベリー': 1, 'オレンジ': .6 }],
  [/イエメン|モカ/, { 'レーズン': 1.4, '赤ワイン': 1.2, 'カカオ': .8, 'シナモン': .6 }],
  [/ペルー|メキシコ|ホンジュラス|ニカラグア|エルサルバドル/, { 'ミルクチョコ': 1, 'キャラメル': 1, 'アーモンド': .8 }],
  [/ハワイ|コナ/, { 'ミルクチョコ': 1, 'ヘーゼルナッツ': 1, 'ハチミツ': .6 }],
];
const PROCESS = {
  'ナチュラル': { 'ブルーベリー': 1.4, 'ストロベリー': 1, 'レーズン': 1, '赤ワイン': .8 },
  'アナエロビック': { '発酵感': 1.8, 'ラム': 1.2, '赤ワイン': 1, 'シナモン': .6 },
  'ハニー': { 'ハチミツ': 1.4, 'アプリコット': .8, '黒糖': .6 },
  'ウォッシュト': { 'レモン': .5, '紅茶': .5 },
  'スマトラ式': { 'ハーブ': 1, 'スモーキー': .6, 'ダークチョコ': .6 },
};
const ROAST = {
  'ライト': { 'レモン': .5, 'ジャスミン': .5 }, 'シナモン': { 'レモン': .5, 'ジャスミン': .5 },
  'ミディアム': { 'キャラメル': .8, 'リンゴ': .4 }, 'ハイ': { 'キャラメル': 1, 'ミルクチョコ': .6 },
  'シティ': { 'ミルクチョコ': 1.2, 'キャラメル': 1 }, 'フルシティ': { 'ミルクチョコ': 1, 'ダークチョコ': 1, '黒糖': .6 },
  'フレンチ': { 'ダークチョコ': 1.6, 'スモーキー': 1.2, 'カカオ': 1 }, 'イタリアン': { 'ダークチョコ': 1.6, '焦げ': 1, 'スモーキー': 1.2 },
};
const ACID_TERMS = {
  'シトリック（柑橘の酸）': ['レモン', 'オレンジ', 'グレープフルーツ', 'ライム'],
  'マリック（リンゴの酸）': ['リンゴ', '洋ナシ'],
  'ワイニー（ぶどうの酸）': ['赤ワイン', 'ブドウ'],
};

export function suggestFlavors(r) {
  const info = r.type === 'cafe' ? (r.cafe || {}) : (r.home || {});
  const score = {}, why = {};
  const byName = name => FLAVOR_ITEMS.filter(i => i.name === name);
  const add = (it, pts, reason) => { score[it.id] = (score[it.id] || 0) + pts; (why[it.id] ??= new Set()).add(reason); };
  const addName = (name, pts, reason) => byName(name).forEach(it => add(it, pts, reason));

  // 1. お店・袋の説明文（いちばん強い手がかり）
  const text = [info.menuNotes, info.bagNotes].filter(Boolean).join(' ');
  if (text) {
    FLAVOR_ITEMS.forEach(it => { if (text.includes(it.name)) add(it, 5, '説明に書いてある'); });
    WORDS.forEach(([re, names]) => { if (re.test(text)) names.forEach(n => addName(n, 3.5, '説明に書いてある')); });
  }
  // 2. 自分で選んだ香り・風味の分類
  const cats = [...(r.flavorCats || []).map(k => [k, 1]), ...(r.aromaCats || []).map(k => [k, .7])];
  const allCats = new Set([...(r.flavorCats || []), ...(r.aromaCats || [])]);
  cats.forEach(([k, w]) => {
    const [cid, g] = k.split('/');
    // 細かい分類も選んであれば、大きな分類の分は重ねて数えない
    if (!g && [...allCats].some(x => x.startsWith(cid + '/'))) return;
    FLAVOR_ITEMS.filter(i => i.cat.id === cid && (!g || i.group === g)).forEach(it => add(it, (g ? 3 : 1.6) * w, `${w === 1 ? '風味' : '香り'}で「${catLabel(k)}」を選んだ`));
  });
  // 3. 酸の質
  (r.terms?.acidity || []).forEach(t => (ACID_TERMS[t] || []).forEach(n => addName(n, 2.4, `酸の質が「${t.replace(/（.*）/, '')}」`)));
  // 4. 精製・焙煎度・産地（よくある傾向。弱い手がかり）
  Object.entries(PROCESS[info.process] || {}).forEach(([n, p]) => addName(n, p, `${info.process}によくある`));
  Object.entries(ROAST[info.roast] || {}).forEach(([n, p]) => addName(n, p, `${info.roast}ローストによくある`));
  const originText = [info.origin, info.menuName, info.bean, info.variety].filter(Boolean).join(' ');
  ORIGINS.forEach(([re, map]) => { if (re.test(originText)) Object.entries(map).forEach(([n, p]) => p && addName(n, p, '産地・品種によくある')); });
  // 5. 強さの記録
  const s = r.scores || {};
  if (s.acidity >= 4) { addName('レモン', 1.3, '酸味が明るい'); addName('リンゴ', 1.2, '酸味が明るい'); addName('オレンジ', 1.2, '酸味が明るい'); }
  if (s.body >= 4 && s.bitterness >= 3) addName('ダークチョコ', 1.2, 'コクが重い');
  if (s.bitterness >= 4) { addName('ダークチョコ', 1, '苦味が強い'); addName('カカオ', .8, '苦味が強い'); }
  if (s.sweetness >= 4) { addName('キャラメル', .6, '甘さが強い'); addName('ハチミツ', .6, '甘さが強い'); }
  if ((r.terms?.mouthfeel || []).includes('ティーライク')) addName('紅茶', 1, '口あたりがティーライク');

  // 似た言葉は同じカテゴリから多く出すぎないように、上位から最大8つ
  // 手がかりが少ないときは、弱い傾向も含めて最低3つは出す
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  let list = ranked.filter(([, v]) => v >= 2);
  if (list.length < 3) list = ranked.filter(([, v]) => v >= 1.2).slice(0, Math.max(3, list.length));
  const out = [], perCat = {};
  for (const [id, v] of list) {
    const c = ITEM_BY_ID[id].cat.id;
    if ((perCat[c] = (perCat[c] || 0) + 1) > 3) continue;
    out.push({ id, score: v, reasons: [...why[id]] });
    if (out.length >= 8) break;
  }
  return out;
}

// 記録から一文を作る
export function summarySentence(r) {
  const s = r.scores || {}, names = (r.flavors || []).map(id => ITEM_BY_ID[id]?.name).filter(Boolean).slice(0, 2);
  const lead = s.acidity >= 4 ? '明るい酸' : s.bitterness >= 4 ? 'しっかりした苦味' : s.sweetness >= 4 ? 'やさしい甘さ' : (s.acidity || s.bitterness) ? '穏やかな味わい' : '';
  const one = [lead, names.join('と')].filter(Boolean).join('に、');
  const bodyW = s.body ? (s.body <= 2 ? '軽やか' : s.body >= 4 ? '重厚' : 'ほどよいコク') : '';
  const sweetTail = (r.terms?.finish || []).includes('甘い余韻') ? '甘い' : '';
  const tail = s.aftertaste ? (s.aftertaste >= 4 ? `${sweetTail}余韻が長い` : s.aftertaste <= 2 ? '余韻はすっと消える' : `${sweetTail}余韻はほどよい`) : '';
  const two = bodyW && tail ? `${bodyW}${bodyW === 'ほどよいコク' ? 'で' : 'で'}、${tail}` : (bodyW || tail);
  return [one, two].filter(Boolean).map(x => x + '。');
}
