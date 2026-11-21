// 端末内の保存（IndexedDB）。記録と写真を分けて持つ。
const DB_NAME = 'ippai-kirokucho';
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' }).createIndex('date', 'date');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => res(result);
    t.onerror = () => rej(t.error);
  });
}
const req2p = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  async allRecords() {
    const list = await tx('records', 'readonly', s => req2p(s.getAll()));
    return list.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  },
  getRecord: id => tx('records', 'readonly', s => req2p(s.get(id))),
  putRecord: rec => tx('records', 'readwrite', s => { s.put(rec); }),
  deleteRecord: id => tx('records', 'readwrite', s => { s.delete(id); }),
  putPhoto: (id, blob) => tx('photos', 'readwrite', s => { s.put({ id, blob }); }),
  async getPhoto(id) { const r = await tx('photos', 'readonly', s => req2p(s.get(id))); return r?.blob || null; },
  deletePhoto: id => tx('photos', 'readwrite', s => { s.delete(id); }),
  allPhotos: () => tx('photos', 'readonly', s => req2p(s.getAll())),
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 写真を縮めてJPEGにする（長辺 max px）
export async function shrinkImage(file, max = 1600, quality = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  let w, h, src = bmp;
  if (!bmp) {
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
    w = src.naturalWidth; h = src.naturalHeight;
  } else { w = bmp.width; h = bmp.height; }
  const k = Math.min(1, max / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  return new Promise(res => cv.toBlob(res, 'image/jpeg', quality));
}

export const blobToDataURL = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
export const dataURLToBlob = async url => (await fetch(url)).blob();
