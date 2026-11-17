#!/usr/bin/env python3
"""Fabrique audio/syllabes.mp3 + audio/syllabes.json : toutes les syllabes et tous les sons du CP dits par une même voix
(fr-FR-DeniseNeural), dans un seul fichier (« audio sprite » lu par Howler.js dans le Zoo).

Pourquoi : la voix de l'appareil (speechSynthesis) épelle certaines syllabes courtes (« ba » → « B A ») et change d'un
iPad à une tablette Samsung. Avec ce fichier, le Zoo joue toujours le même enregistrement ; la voix de l'appareil ne sert
plus qu'aux consignes, aux mots et à ce qui n'est pas dans le fichier.

Utilisation (depuis la racine du dépôt) :
    python3 -m venv /tmp/zoo-venv && /tmp/zoo-venv/bin/pip install edge-tts
    /tmp/zoo-venv/bin/python -I tools/build_audio_sprite.py            # fabrique audio/syllabes.mp3 et .json
    options : --voix fr-FR-HenriNeural  --vitesse=-10%  --garder (garde tmp_audio/)  --proxy http://…

Il faut : node (lit exo-data.js via tools/audio_liste.js), ffmpeg, edge-tts, et l'accès à speech.platform.bing.com.
Pour ajouter un son : le mettre dans SONS_CP (clé écrite → texte que la voix doit lire) ; pour corriger un son mal dit
par cette voix : DENISE_FIX. Relancer le script, écouter dans test-syllabes.html (mode « voix enregistrée »),
puis augmenter ?v= de audio-lecture.js dans zoo-connecte.html (le fichier son change de nom de version tout seul).
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RATE = 24000  # échantillons par seconde (sortie de la voix)

# Clé écrite (en minuscules) → texte à lire, écrit pour ne pas être épelé ni pris pour un sigle.
# Les syllabes de l'exercice (exo-data.js) sont ajoutées automatiquement par tools/audio_liste.js.
SONS_CP = {
    # voyelles
    "a": "a", "e": "euh", "é": "et", "è": "est", "ê": "est", "i": "i", "o": "o", "u": "u", "y": "i",
    # consonnes et graphèmes seuls : dits avec un petit « eu », comme en classe
    "f": "feu", "l": "leu", "m": "meu", "n": "neu", "r": "reu", "s": "seu", "v": "veu", "z": "zeu", "ch": "cheu",
    "b": "beu", "d": "deu", "g": "gueu", "j": "jeu", "p": "peu", "t": "teu", "c": "keu", "k": "keu", "qu": "keu",
    "gn": "gneu", "ph": "feu",
    # sons complexes
    "ou": "ou", "on": "ont", "om": "ont", "an": "en", "am": "en", "en": "en", "em": "en", "in": "hein", "im": "hein",
    "ain": "hein", "ein": "hein", "un": "un", "oi": "oie", "au": "eau", "eau": "eau", "eu": "euh", "oeu": "euh", "œu": "euh",
    "ai": "est", "ei": "est", "et": "et", "er": "et", "ez": "et",
    # syllabes demandées avec un vrai mot qui se dit pareil
    "ba": "bas", "la": "là", "ra": "rat", "pa": "pas", "ta": "tas", "do": "dos", "bo": "beau",
    # syllabes inverses (voyelle + consonne)
    "al": "al", "ar": "ar", "as": "asse", "el": "elle", "il": "il", "ir": "ir", "ol": "olle", "or": "or",
    "ul": "ulle", "ur": "ur", "our": "our", "oir": "oir",
}

# Corrections propres à cette voix (relevées à l'écoute) : clé écrite → texte à lire.
DENISE_FIX = {
}

# Quand un son paraît épelé, on essaie d'abord un vrai mot qui se dit pareil, puis des écritures de secours.
HOMOPHONES = {
    "dant": ["dent", "dans"], "dra": ["drap", "dras"], "ga": ["gars", "gas"], "ja": ["jas", "jah"], "tra": ["tras", "trah"],
    "dri": ["dris", "drie"], "vri": ["vris", "vrie"],
}


def alternatives(t):
    base = t.replace("’", "'")
    alts = list(HOMOPHONES.get(base, []))
    if not re.search(r"[eh]$", base):
        alts += [base + "h", base + "e"]
    alts += [base + "s", base + "t"]
    return [a for a in alts if a != t]


def norm(s):
    return re.sub(r"\s+", " ", s.strip().lower().replace("'", "’"))


def app_list():
    out = subprocess.run(["node", os.path.join(ROOT, "tools", "audio_liste.js"), os.path.join(ROOT, "exo-data.js")],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def max_dur(key, say):
    """Durée de parole au-delà de laquelle on soupçonne une épellation."""
    n = len(re.sub(r"[^a-zàâçéèêëîïôûùüÿœ]", "", norm(key)))
    return 0.50 if n <= 3 else 0.62


def nuclei(wav_path):
    """Nombre de syllabes entendues (pics d'énergie des voyelles, sons graves seulement) : 2 ou plus = probablement épelé."""
    import array
    import math
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", wav_path, "-af", "highpass=f=120,lowpass=f=900", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                       capture_output=True, check=True)
    a = array.array("h", r.stdout)
    fr = 160
    e = [10 * math.log10(sum(x * x for x in a[i:i + fr]) / fr + 1) for i in range(0, len(a) - fr, fr)]
    v = [sum(e[max(0, i - 3):i + 4]) / len(e[max(0, i - 3):i + 4]) for i in range(len(e))]
    if not v:
        return 0
    floor, count, lp, trough = max(v) - 18, 0, None, None
    for i in range(1, len(v) - 1):
        if v[i] >= v[i - 1] and v[i] > v[i + 1] and v[i] > floor:
            if lp is None:
                lp, count, trough = v[i], 1, None
            elif trough is not None and min(lp, v[i]) - trough >= 7:
                count, lp, trough = count + 1, v[i], None
            else:
                lp = max(lp, v[i])
        if lp is not None:
            trough = v[i] if trough is None else min(trough, v[i])
    return count


def suspect(r, lim):
    """Vrai si le son est probablement épelé : trop long ET plusieurs syllabes entendues, ou 3 syllabes."""
    return (r["dur"] > lim and r["n"] >= 2) or r["n"] >= 3


def speech_bounds(wav_path):
    """Début et fin de la parole (en échantillons), en ignorant le silence au début et à la fin."""
    with wave.open(wav_path, "rb") as w:
        raw = w.readframes(w.getnframes())
    import array
    a = array.array("h", raw)
    thr = 330  # environ -40 dB
    first = next((i for i, x in enumerate(a) if abs(x) > thr), 0)
    last = next((i for i in range(len(a) - 1, -1, -1) if abs(a[i]) > thr), len(a) - 1)
    return a, first, last


async def tts(text, path, voice, rate, proxy):
    import edge_tts
    for k in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate, proxy=proxy).save(path)
            if os.path.getsize(path) > 500:
                return True
        except Exception as e:  # réseau capricieux : on réessaie
            err = e
        await asyncio.sleep(1 + k)
    print("  ÉCHEC", text, err if 'err' in dir() else "", file=sys.stderr)
    return False


def to_wav(mp3, wav):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-ar", str(RATE), "-sample_fmt", "s16", wav], check=True)


async def render(text, tmp, voice, rate, proxy, sem):
    h = hashlib.sha1((voice + rate + text).encode()).hexdigest()[:12]
    mp3, wav = os.path.join(tmp, h + ".mp3"), os.path.join(tmp, h + ".wav")
    async with sem:
        if not os.path.exists(wav):
            if not await tts(text, mp3, voice, rate, proxy):
                return None
            to_wav(mp3, wav)
    a, f, l = speech_bounds(wav)
    return {"wav": wav, "dur": (l - f) / RATE, "first": f, "last": l, "text": text, "n": nuclei(wav)}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voix", default="fr-FR-DeniseNeural")
    ap.add_argument("--vitesse", default="-10%")
    ap.add_argument("--sortie", default=os.path.join(ROOT, "audio"))
    ap.add_argument("--tmp", default=os.path.join(ROOT, "tmp_audio"))
    ap.add_argument("--garder", action="store_true")
    ap.add_argument("--proxy", default=os.environ.get("HTTPS_PROXY") or None)
    args = ap.parse_args()
    os.makedirs(args.tmp, exist_ok=True)
    os.makedirs(args.sortie, exist_ok=True)

    # 1. clé écrite → texte à lire
    keys = {}
    for k, say, src in app_list():
        keys[norm(k)] = say
    for k, say in SONS_CP.items():
        keys.setdefault(norm(k), say)
        if k in ("ba", "la", "ra", "pa", "ta", "do", "bo"):
            keys[norm(k)] = say
    texts = {}
    for k, say in keys.items():
        t = DENISE_FIX.get(k, say)
        texts.setdefault(t, []).append(k)
    print(len(keys), "écritures,", len(texts), "prononciations à enregistrer")

    # 2. enregistrements (6 à la fois), puis contrôle de la durée et écritures de secours
    sem = asyncio.Semaphore(6)
    order = sorted(texts)
    res = dict(zip(order, await asyncio.gather(*[render(t, args.tmp, args.voix, args.vitesse, args.proxy, sem) for t in order])))
    report = []
    for t in order:
        r = res[t]
        lim = max(max_dur(k, t) for k in texts[t])
        if r and not suspect(r, lim):
            continue
        tried = [(t, r["dur"] if r else None, r["n"] if r else 0)]
        best = None
        for alt in alternatives(t):
            ra = await render(alt, args.tmp, args.voix, args.vitesse, args.proxy, sem)
            tried.append((alt, ra["dur"] if ra else None, ra["n"] if ra else 0))
            if ra and ra["dur"] >= 0.08 and not suspect(ra, lim) and ra["n"] == 1:
                best = ra
                break
        if best:
            res[t] = best
            report.append("corrigé  %-14s → %-10s (%s)" % ("/".join(texts[t][:3]), best["text"], ", ".join("%s %.2fs/%d" % x for x in tried if x[1])))
        else:
            res[t] = None   # pas dans le fichier : la voix de l'appareil continue de le dire
            report.append("NON MIS   %-14s (%s)" % ("/".join(texts[t][:3]), ", ".join("%s %.2fs/%d" % x for x in tried if x[1])))

    # 3. un seul fichier : 40 ms de marge avant chaque son, 100 ms de silence entre deux sons
    pad, gap = int(0.04 * RATE), int(0.10 * RATE)
    import array
    full = array.array("h")
    sprite, clip_of = {}, {}
    for t in order:
        r = res[t]
        if not r:
            continue
        a, f, l = speech_bounds(r["wav"])
        seg = a[max(0, f - int(0.015 * RATE)): min(len(a), l + int(0.06 * RATE))]
        start = len(full)
        full.extend([0] * pad)
        full.extend(seg)
        end = len(full) + pad // 2
        full.extend([0] * gap)
        cid = norm(t)
        sprite[cid] = [round(start * 1000 / RATE), round((end - start) * 1000 / RATE)]
        for k in texts[t]:
            clip_of[k] = cid
    tmpwav = os.path.join(args.tmp, "_tout.wav")
    with wave.open(tmpwav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(full.tobytes())
    mp3 = os.path.join(args.sortie, "syllabes.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmpwav, "-ac", "1", "-ar", str(RATE), "-codec:a", "libmp3lame", "-b:a", "48k", mp3], check=True)
    ver = hashlib.sha1(open(mp3, "rb").read()).hexdigest()[:8]
    data = {"voix": args.voix, "vitesse": args.vitesse, "src": "audio/syllabes.mp3?v=" + ver,
            "sprite": {k: sprite[k] for k in sorted(sprite)}, "keys": {k: clip_of[k] for k in sorted(clip_of)}}
    with open(os.path.join(args.sortie, "syllabes.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print("%s : %.0f Ko, %.0f s, %d sons ; syllabes.json : %d écritures" % (mp3, os.path.getsize(mp3) / 1024, len(full) / RATE, len(sprite), len(clip_of)))
    for line in report:
        print(line)
    if not args.garder:
        shutil.rmtree(args.tmp, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
