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

// 風味以外の専門用語（タップで選ぶ）
export const TERM_GROUPS = [
  { id: 'acidity', title: '酸の質', sub: 'アシディティ', terms: ['明るい', 'ジューシー', '柔らかい', 'シトリック（柑橘の酸）', 'マリック（リンゴの酸）', 'ワイニー', '鋭い', '穏やか'] },
  { id: 'mouthfeel', title: '口あたり', sub: 'マウスフィール', terms: ['シルキー', 'ティーライク', 'クリーミー', 'シロップのよう', 'ラウンド', '重厚', '軽やか', 'ざらつき'] },
  { id: 'finish', title: '余韻', sub: 'アフターテイスト', terms: ['長い', '短い', '甘い余韻', 'ドライ', '心地よい苦み', '酸が残る'] },
  { id: 'impression', title: '全体の印象', sub: 'オーバーオール', terms: ['クリーン', '複雑', 'バランスがいい', '透明感', '華やか', '落ち着き', '力強い', '優しい'] },
];

// 7つの評価軸（1〜5）
export const ATTRS = [
  { id: 'acidity', name: '酸味', sub: 'アシディティ' },
  { id: 'sweetness', name: '甘さ', sub: 'スウィートネス' },
  { id: 'bitterness', name: '苦味', sub: 'ビターネス' },
  { id: 'body', name: 'コク', sub: 'ボディ' },
  { id: 'aftertaste', name: '余韻', sub: 'アフターテイスト' },
  { id: 'clean', name: '透明感', sub: 'クリーンカップ' },
  { id: 'balance', name: 'バランス', sub: 'バランス' },
];

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
