"""小さな作曲・録音エンジン（試聴版用）。音色は FluidR3_GM（CC BY 3.0）。"""
import subprocess
import numpy as np
from scipy.signal import fftconvolve, lfilter, butter
from scipy.io import wavfile

SR = 44100
SF = '/tmp/bgm/sf'
NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
ALIAS = {'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'}

def midi(n):
    n = n.strip()
    name, octv = (n[:2], n[2:]) if len(n) > 2 and n[1] in '#b' else (n[:1], n[1:])
    name = ALIAS.get(name, name)
    return NAMES.index(name) + (int(octv) + 1) * 12
def nname(m): return f"{NAMES[m % 12]}{m // 12 - 1}"

_cache = {}
def sample(inst, m):
    k = (inst, m)
    if k not in _cache:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{SF}/{inst}/{nname(m)}.mp3', '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
        _cache[k] = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    return _cache[k]

# 和音：記号 → 構成音（半音）
QUAL = {'maj7': [0, 4, 7, 11], 'maj9': [0, 4, 7, 11, 14], '6': [0, 4, 7, 9], '69': [0, 4, 9, 14], 'add9': [0, 4, 7, 14],
        'm7': [0, 3, 7, 10], 'm9': [0, 3, 10, 14], 'm6': [0, 3, 7, 9], '7': [0, 4, 7, 10], '9': [0, 4, 10, 14], '13': [0, 4, 10, 21],
        '7b9': [0, 4, 10, 13], 'sus4': [0, 5, 7], '7sus4': [0, 5, 7, 10], '': [0, 4, 7], 'm': [0, 3, 7]}
def chord(sym):
    """'Cmaj7', 'D/F#', 'Bbm6' → (根音pc, [音程], 低音pc)"""
    bass = None
    if '/' in sym: sym, b = sym.split('/'); bass = b
    root = sym[:2] if len(sym) > 1 and sym[1] in '#b' else sym[:1]
    q = sym[len(root):]
    r = midi(root + '0') % 12
    return r, QUAL[q], (midi(bass + '0') % 12 if bass else r)

def voice(sym, lo=52, n=4):
    """左手・ギター用の密集配置（lo 以上）"""
    r, iv, _ = chord(sym)
    pcs = [(r + i) % 12 for i in iv]
    out = []
    for pc in pcs:
        m = lo + ((pc - lo) % 12)
        out.append(m)
    return sorted(out)[:n]

def melody(spec, start_beat=0):
    """'G5:1.5 E5:.5 r:1' → [(拍, midi or None, 長さ)]"""
    out, t = [], start_beat
    for tok in spec.split():
        n, d = tok.split(':'); d = float(d)
        out.append((t, None if n == 'r' else midi(n), d)); t += d
    return out, t

class Song:
    def __init__(self, bpm, swing=0.5):
        self.bpm, self.swing, self.ev, self.perc = bpm, swing, [], []
    def sec(self, beat):
        whole, frac = divmod(beat, 1)
        if abs(frac - 0.5) < 1e-6: frac = self.swing
        return (whole + frac) * 60 / self.bpm
    def note(self, inst, beat, m, vel, dur_beats, pan=0.0, ring=0.25):
        self.ev.append((inst, self.sec(beat), m, vel, dur_beats * 60 / self.bpm, pan, ring))
    def hit(self, kind, beat, vel):
        self.perc.append((kind, self.sec(beat), vel))

    def render(self, total_beats, out, wet=0.24, level=0.42):
        N = int(total_beats * 60 / self.bpm * SR)
        mix = np.zeros((N + SR * 6, 2), np.float32)
        for inst, st, m, vel, dur, pan, ring in self.ev:
            s = sample(inst, m)
            L = min(len(s), int((dur + ring) * SR)); s = s[:L].copy()
            end = int(dur * SR)
            if end < L: s[end:] *= np.exp(-np.arange(L - end) / (ring / 3 * SR))
            a = 0.35 + 0.6 * vel
            s = lfilter([a], [1, -(1 - a)], s).astype(np.float32) * vel
            i = int(st * SR); g = 0.5
            mix[i:i + L, 0] += s * g * (1 - pan); mix[i:i + L, 1] += s * g * (1 + pan)
        rng = np.random.default_rng(1)
        for kind, st, vel in self.perc:
            i = int(st * SR)
            if kind == 'shaker':
                L = int(0.07 * SR); n = rng.standard_normal(L).astype(np.float32)
                b, a = butter(2, [4500 / (SR / 2), 11000 / (SR / 2)], 'band'); n = lfilter(b, a, n)
                env = np.minimum(1, np.arange(L) / (0.012 * SR)) * np.exp(-np.arange(L) / (0.018 * SR))
                s = n * env * vel * 0.10; pan = 0.35
            elif kind == 'rim':
                L = int(0.05 * SR); t = np.arange(L) / SR
                s = (np.sin(2 * np.pi * 1700 * t) * 0.6 + rng.standard_normal(L) * 0.25) * np.exp(-t / 0.008) * vel * 0.12; pan = -0.2
            elif kind == 'brush':
                L = int(0.32 * SR); n = rng.standard_normal(L).astype(np.float32)
                b, a = butter(2, [1800 / (SR / 2), 7000 / (SR / 2)], 'band'); n = lfilter(b, a, n)
                env = np.sin(np.linspace(0, np.pi, L)) ** 2
                s = n * env * vel * 0.05; pan = 0.1
            elif kind == 'kick':
                L = int(0.25 * SR); t = np.arange(L) / SR
                s = np.sin(2 * np.pi * (55 + 60 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.09) * vel * 0.35; pan = 0
            s = s.astype(np.float32)
            mix[i:i + L, 0] += s * (1 - pan) * 0.5; mix[i:i + L, 1] += s * (1 + pan) * 0.5
        # 部屋の響き
        ir_len = int(1.8 * SR)
        ir = rng.standard_normal((ir_len, 2)).astype(np.float32) * np.exp(-np.arange(ir_len) / (0.38 * SR))[:, None]
        ir = lfilter([0.3], [1, -0.7], ir, axis=0).astype(np.float32)
        ir /= np.abs(ir).sum(axis=0).max() / 6
        wetsig = np.stack([fftconvolve(mix[:, c], ir[:, c])[:len(mix)] for c in range(2)], 1)
        o = mix * 0.9 + wetsig * wet
        loop = o[:N].copy(); tail = o[N:]
        loop[:len(tail)] += tail[:N]          # 繰り返しのつなぎ目をなめらかに
        loop /= np.percentile(np.abs(loop), 99.9) / 0.6
        loop = np.tanh(loop * 1.05) / np.tanh(1.05) * level
        wavfile.write(out, SR, (loop * 32767).astype(np.int16))
        return N / SR
