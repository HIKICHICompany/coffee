// BGM（オリジナルのカフェ風ピアノ曲）。既定はオン。
// スマホは「最初のタップ」まで音を出せない決まりなので、最初のタップで鳴らし始める。
const KEY = 'bgm';
let audio = null;
let started = false;

export const bgmOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };

function el() {
  if (!audio) {
    audio = new Audio('/audio/cafe.m4a');
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.55;
  }
  return audio;
}

function fadeTo(target, ms = 900) {
  const a = el();
  const from = a.volume, t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    a.volume = Math.min(1, Math.max(0, from + (target - from) * k));
    if (k < 1) requestAnimationFrame(step); else if (target === 0) a.pause();
  };
  requestAnimationFrame(step);
}

export function bgmPlay() {
  if (!bgmOn()) return;
  const a = el();
  if (!a.paused) return;
  a.volume = 0;
  a.play().then(() => { started = true; fadeTo(0.55); }).catch(() => {});
}
export function bgmPause() { if (audio && !audio.paused) fadeTo(0, 400); }

export function bgmToggle() {
  const on = !bgmOn();
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
  if (on) bgmPlay(); else bgmPause();
  syncButtons();
  return on;
}

export function syncButtons() {
  document.querySelectorAll('[data-bgm-toggle]').forEach(b => {
    const on = bgmOn();
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? 'BGMを止める' : 'BGMを流す');
    const label = b.querySelector('.bgm-label'); if (label) label.textContent = on ? 'BGM オン' : 'BGM オフ';
  });
}

export function initBgm() {
  // 最初のタップで鳴らす（表紙の「ひらく」も含む）
  const first = () => { if (!started) bgmPlay(); };
  window.addEventListener('pointerdown', first, { capture: true });
  window.addEventListener('keydown', first, { capture: true });
  // 別のアプリに切り替えたら止め、戻ったら再開
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (audio && !audio.paused) audio.pause(); }
    else if (started && bgmOn()) bgmPlay();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-bgm-toggle]');
    if (b) { e.preventDefault(); e.stopPropagation(); bgmToggle(); }
  }, true);
  syncButtons();
}
