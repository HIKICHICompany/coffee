// 珈琲テイスティングノート：Cloudflare Worker
// 画面（public/）はそのまま配り、/api/ だけここで処理する。
//   GET  /api/nearby?lat=..&lon=..  近くのコーヒー店（OpenStreetMap）
//   POST /api/read                   メニュー・豆の袋の写真を読み取る（Claude API）

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === '/api/nearby' && request.method === 'GET') return await nearby(url);
      if (url.pathname === '/api/read' && request.method === 'POST') return await readPhoto(request, env);
      return json({ error: 'ありません' }, 404);
    } catch (e) {
      return json({ error: e.message || '処理に失敗しました' }, 500);
    }
  },
};

// ---------- 近くのお店 ----------
async function nearby(url) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: '位置が正しくありません' }, 400);
  let shops = [];
  for (const radius of [400, 1200]) {
    const q = `[out:json][timeout:15];(` +
      `nwr(around:${radius},${lat},${lon})[amenity=cafe];` +
      `nwr(around:${radius},${lat},${lon})[shop=coffee];` +
      `nwr(around:${radius},${lat},${lon})[cuisine~"coffee"];` +
      `);out center tags 60;`;
    const j = await overpass(q);
    shops = shape(j.elements || [], lat, lon);
    if (shops.length >= 3) break;
  }
  return json({ shops });
}

// 検索先が混んでいる・断られたときは、次の検索先を試す
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
async function overpass(q) {
  const fails = [];
  for (const endpoint of OVERPASS) {
    try {
      const res = await fetch(endpoint + '?data=' + encodeURIComponent(q), {
        headers: { 'user-agent': 'ippai-kirokucho/1.0 (https://coffee.hikichicompany.workers.dev)', accept: 'application/json' },
      });
      if (res.ok) return await res.json();
      fails.push(`${new URL(endpoint).host}:${res.status}`);
    } catch (e) {
      fails.push(`${new URL(endpoint).host}:${e.message}`);
    }
  }
  throw new Error('お店の検索先につながりませんでした。少し待ってもう一度お試しください（' + fails.join(', ') + '）');
}

function shape(elements, lat, lon) {
  const seen = new Set();
  return elements.map(e => {
    const t = e.tags || {};
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    const name = t['name:ja'] || t.name;
    if (!name || la == null) return null;
    const address = [t['addr:province'], t['addr:city'], t['addr:suburb'], t['addr:quarter'], t['addr:neighbourhood'], t['addr:block_number'], t['addr:housenumber']].filter(Boolean).join('') || t['addr:full'] || '';
    return { name, address, lat: la, lon: lo, distance: Math.round(dist(lat, lon, la, lo)) };
  }).filter(Boolean)
    .filter(s => { const k = s.name + Math.round(s.lat * 1e4); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.distance - b.distance).slice(0, 12);
}
function dist(a, b, c, d) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- 写真の読み取り ----------
const PROMPTS = {
  menu: `これはカフェや喫茶店のメニューの写真です。コーヒーの品目をすべて読み取り、次の形のJSONだけを返してください。説明文は不要です。
{"items":[{"name":"品名（豆の名前や商品名）","origin":"産地（国・地域・農園。なければ空）","process":"精製方法（ウォッシュト/ナチュラル/ハニー/アナエロビック/スマトラ式のいずれか。なければ空）","roast":"焙煎度（ライト/シナモン/ミディアム/ハイ/シティ/フルシティ/フレンチ/イタリアン のいずれか。浅煎りはライト、中煎りはハイ、中深煎りはフルシティ、深煎りはフレンチに寄せる。なければ空）","method":"淹れ方（ハンドドリップ/エスプレッソ/フレンチプレス/エアロプレス/サイフォン/ネルドリップ/水出し/モカポット のいずれか。なければ空）","price":数値または null,"notes":"メニューに書かれた味の説明（なければ空）"}]}
コーヒー以外の飲み物や食べ物は含めないでください。読めない文字は推測せず空にしてください。`,
  bag: `これはコーヒー豆の袋やラベルの写真です。書かれている内容を読み取り、次の形のJSONだけを返してください。説明文は不要です。
{"items":[{"name":"豆の名前（国名＋地域・農園名など）","roaster":"焙煎したお店の名前（なければ空）","origin":"産地（国・地域・農園）","variety":"品種（なければ空）","process":"精製方法（ウォッシュト/ナチュラル/ハニー/アナエロビック/スマトラ式のいずれか。なければ空）","roast":"焙煎度（ライト/シナモン/ミディアム/ハイ/シティ/フルシティ/フレンチ/イタリアン のいずれか。なければ空）","roastDate":"焙煎日 YYYY-MM-DD（なければ空）","notes":"書かれた味の説明（なければ空）"}]}
読めない文字は推測せず空にしてください。`,
};

async function readPhoto(request, env) {
  if (env.APP_TOKEN && request.headers.get('x-app-token') !== env.APP_TOKEN) {
    return json({ error: '合言葉が違います。設定画面で合言葉を入れてください' }, 401);
  }
  if (!env.ANTHROPIC_API_KEY) return json({ error: '読み取りの準備ができていません（ANTHROPIC_API_KEY が未設定）' }, 500);
  const body = await request.json();
  const kind = body.kind === 'bag' ? 'bag' : 'menu';
  if (!body.image || body.image.length > 7_000_000) return json({ error: '写真が大きすぎるか、空です' }, 400);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.MODEL || 'claude-sonnet-5-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.image } },
        { type: 'text', text: PROMPTS[kind] + (body.shop ? `\n（お店：${body.shop}）` : '') },
      ] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return json({ error: `読み取りに失敗しました（${res.status}）`, detail: t.slice(0, 300) }, 502);
  }
  const out = await res.json();
  const text = (out.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return json({ items: [] });
  let parsed; try { parsed = JSON.parse(m[0]); } catch { return json({ items: [] }); }
  const items = (parsed.items || []).filter(i => i && i.name).slice(0, 20);
  return json({ items });
}
