"""珈琲テイスティングノート用 BGM：オリジナルのカフェ風ピアノ曲を作曲し、音にする。
ピアノ音色：FluidR3_GM（CC BY 3.0, gleitz/midi-js-soundfonts）
使い方：python3 compose.py <音色フォルダ> <出力wav>
"""
import sys, random, subprocess
import numpy as np
from scipy.signal import fftconvolve, lfilter

SR = 44100
NOTES_DIR, OUT = sys.argv[1], sys.argv[2]
BPM = 74
BEAT = 60 / BPM
SWING = 0.62  # 裏拍を少し後ろに

NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
def nname(m): return f"{NAMES[m % 12]}{m // 12 - 1}"

_cache = {}
def sample(m):
    if m not in _cache:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{NOTES_DIR}/{nname(m)}.mp3', '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
        _cache[m] = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    return _cache[m]

# ---- 和音（ルート, 種類） F調 ----
Q = {'maj7': [0, 4, 7, 11, 14], 'm7': [0, 3, 7, 10, 14], '7': [0, 4, 7, 10, 14, 21], '7b9': [0, 4, 7, 10, 13],
     'm6': [0, 3, 7, 9, 14], '7sus': [0, 5, 7, 10, 14], 'm7b5': [0, 3, 6, 10]}
def ch(root, q): return (root, q)
F, G, A, Bb, C, D, E, Eb = 53, 55, 57, 58, 48, 50, 52, 51  # 低めの基準音
SEC_A = [[ch(F, 'maj7')], [ch(D, 'm7')], [ch(G, 'm7')], [ch(C, '7')], [ch(F, 'maj7')], [ch(A, 'm7'), ch(D, '7b9')], [ch(G, 'm7')], [ch(G, 'm7'), ch(C, '7')]]
SEC_A2 = [[ch(F, 'maj7')], [ch(D, 'm7')], [ch(G, 'm7')], [ch(C, '7')], [ch(A, 'm7')], [ch(D, '7b9')], [ch(G, 'm7'), ch(C, '7')], [ch(F, 'maj7')]]
SEC_B = [[ch(Bb, 'maj7')], [ch(Eb, '7')], [ch(A, 'm7')], [ch(D, '7')], [ch(G, 'm7')], [ch(C, '7sus')], [ch(A, 'm7'), ch(D, '7b9')], [ch(G, 'm7'), ch(C, '7')]]
FORM = SEC_A + SEC_A2 + SEC_B + SEC_A  # 32小節、最後は頭（F）へ戻る
SCALE_F = [0, 2, 4, 5, 7, 9, 11]

events = []  # (start_sec, midi, vel, dur_sec)
def t_of(bar, beat):  # 拍（0〜3.5）をスイング込みの秒に
    whole, frac = divmod(beat, 1)
    off = SWING if abs(frac - 0.5) < 1e-6 else frac
    return (bar * 4 + whole + off) * BEAT

def voicing(root, q):
    # 左手：根音を除いた和音（3度・7度・9度）を C3〜C4 付近に
    tones = [(root % 12) + i for i in Q[q][1:]]
    out = []
    for t in tones[:4]:
        m = 48 + ((t - 48) % 12)
        if m < 50: m += 12
        out.append(m)
    return sorted(set(out))[:4]

def chord_pcs(root, q): return {(root + i) % 12 for i in Q[q]}

def play(chorus, rnd):
    base = chorus * len(FORM)
    prev = 72
    for bi, bar in enumerate(FORM):
        b = base + bi
        per = 4 / len(bar)
        for ci, (root, q) in enumerate(bar):
            st = ci * per
            # ベース：根音（1拍目）と5度（3拍目）
            events.append((t_of(b, st), root - 12, 0.55, per * BEAT * 0.95))
            if per == 4 and rnd.random() < 0.7:
                events.append((t_of(b, 2), root - 12 + 7, 0.40, 2 * BEAT * 0.9))
            # 左手の和音：頭か、少し前に食い気味に
            v = voicing(root, q)
            hits = [st] if per == 2 else rnd.choice([[0], [0, 2.5], [0.5, 2.5], [0, 1.5]])
            for h in hits:
                if h >= st + per: continue
                for i, m in enumerate(v):
                    events.append((t_of(b, h) + i * 0.012, m, 0.30 + rnd.random() * 0.06, (st + per - h) * BEAT))
        # 右手の旋律：2小節で一息。和音の音を軸に、音階で動く
        if bi % 2 == 1 and rnd.random() < 0.55:
            continue  # 間（ま）を作る
        root, q = bar[0]
        pcs = chord_pcs(root, q)
        rhythm = rnd.choice([[0, 1, 1.5, 2.5], [0.5, 1.5, 2, 3], [0, 1.5, 2.5, 3.5], [1, 1.5, 2, 2.5, 3], [0, 2, 3]])
        for k, beat in enumerate(rhythm):
            r2, q2 = bar[min(int(beat // (4 / len(bar))), len(bar) - 1)]
            pcs = chord_pcs(r2, q2)
            cands = [m for m in range(65, 87) if (m % 12) in pcs or ((m - 53) % 12 in SCALE_F and rnd.random() < 0.35)]
            cands.sort(key=lambda m: abs(m - prev) + (0 if m % 12 in pcs else 2) + rnd.random() * 2.5)
            m = cands[0] if abs(cands[0] - prev) > 0 else cands[1]
            prev = m
            nxt = rhythm[k + 1] if k + 1 < len(rhythm) else 4
            dur = (nxt - beat) * BEAT * (1.15 if k == len(rhythm) - 1 else 0.9)
            vel = 0.42 + 0.12 * (beat % 1 == 0) + rnd.random() * 0.08
            events.append((t_of(b, beat), m, vel, dur))
            if k == len(rhythm) - 1 and rnd.random() < 0.4:  # 句の終わりに下の3度を重ねる
                events.append((t_of(b, beat) + 0.01, m - rnd.choice([3, 4]), vel * 0.7, dur))

play(0, random.Random(7))
play(1, random.Random(21))
total = 2 * len(FORM) * 4 * BEAT

# ---- 音にする ----
N = int(total * SR)
mix = np.zeros((N + SR * 6, 2), np.float32)
for st, m, vel, dur in events:
    s = sample(m).copy()
    L = min(len(s), int((dur + 0.35) * SR))
    s = s[:L]
    rel = int(0.3 * SR); end = int(dur * SR)
    env = np.ones(L, np.float32)
    if end < L:
        env[end:] = np.exp(-np.arange(L - end) / (0.08 * SR))
    s = s * env
    a = 1 - 0.55 * (1 - vel)  # 弱く弾いた音は丸く
    s = lfilter([1 - a + 0.15], [1, -(a - 0.15)], s).astype(np.float32) * vel
    pan = np.clip((m - 64) / 40, -0.5, 0.5)
    i = int(st * SR)
    mix[i:i + L, 0] += s * (0.5 - pan * 0.6)
    mix[i:i + L, 1] += s * (0.5 + pan * 0.6)

# 残響（部屋の響き）
rng = np.random.default_rng(3)
ir_len = int(2.4 * SR)
decay = np.exp(-np.arange(ir_len) / (0.55 * SR))
ir = rng.standard_normal((ir_len, 2)).astype(np.float32) * decay[:, None]
ir = lfilter([0.25], [1, -0.75], ir, axis=0).astype(np.float32)
ir /= np.abs(ir).sum(axis=0).max() / 6
wet = np.stack([fftconvolve(mix[:, c], ir[:, c])[:len(mix)] for c in range(2)], 1)
out = mix * 0.85 + wet * 0.28

# つなぎ目：曲の終わりからはみ出した響きを頭に重ね、切れ目なく繰り返せるように
loop = out[:N].copy()
tail = out[N:]
loop[:len(tail)] += tail[:min(len(tail), N)]
# 音量をそろえる（やわらかく頭打ち）
loop /= np.percentile(np.abs(loop), 99.9) / 0.55
loop = np.tanh(loop * 1.1) / np.tanh(1.1)
loop *= 0.5
from scipy.io import wavfile
wavfile.write(OUT, SR, (loop * 32767).astype(np.int16))
print(f"length {N / SR:.1f}s, events {len(events)}")
