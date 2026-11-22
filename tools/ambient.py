"""珈琲テイスティングノートのBGM：間の多い、静かなピアノ（環境音楽の考え方）。
打楽器なし・旋律なし・弱い音・中音域・不規則な間。和音は濁らない音だけで組む。"""
import sys, random
from engine import Song, midi
OUT = sys.argv[1]
s = Song(60)   # 1拍 = 1秒
CH = [('F2', ['F4','A4','C5','E5','G5','C4','A3']), ('D2', ['D4','F4','A4','C5','E5','A3']),
      ('Bb2', ['Bb3','D4','F4','A4','C5','F5']), ('C3', ['C4','E4','G4','A4','D5','G3'])]
SEG = 22.0
rnd = random.Random(11)
t_total = 0
for cyc in range(3):
    for root, tones in CH:
        t0 = t_total
        s.note('acoustic_grand_piano', t0 + rnd.uniform(0, .4), midi(root), 0.22, 9, 0, 3.0)
        t = t0 + rnd.uniform(1.0, 2.2); last = None
        while t < t0 + SEG - 1.5:
            n = rnd.choice([x for x in tones if x != last]); last = n
            s.note('acoustic_grand_piano', t, midi(n), rnd.uniform(0.2, 0.36), 6, rnd.uniform(-.25, .25), 3.0)
            if rnd.random() < 0.3:   # たまに、寄りそう音をひとつ
                n2 = rnd.choice([x for x in tones if x != n])
                s.note('acoustic_grand_piano', t + rnd.uniform(.35, .6), midi(n2), rnd.uniform(0.16, 0.26), 6, rnd.uniform(-.25, .25), 3.0)
            t += rnd.uniform(1.8, 4.2)
        t_total += SEG
print(s.render(t_total, OUT, wet=0.5, level=0.3), len(s.ev))
