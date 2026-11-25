#!/usr/bin/env python3
"""Fabrique des lectures de test pour mesurer l'aide automatique à l'écoute (aide-ecoute.js).

Voix de synthèse (edge-tts, accès à speech.platform.bing.com) : Denise (adulte), Eloise (voix d'enfant),
Henri (bruit de fond : un autre élève qui lit). Chaque cas a sa « vérité » : dernier mot lu et mots faux.
Rien de tout cela n'est un vrai élève : les résultats sur de vraies lectures d'enfants seront moins bons.

  python3 -I tools/aide_ecoute_audio.py DOSSIER      (fabrique DOSSIER/cas.json + DOSSIER/*.webm)
Puis : node tools/aide_ecoute_mesure.js DOSSIER
"""
import asyncio, hashlib, json, os, random, re, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
DUREE = 60

EXOS = ["t:l", "t:f", "t:ch", "t:s", "t:ou", "t:on", "t:an", "t:oi",
        "m:l", "m:ch", "m:ou", "m:on", "s:l", "s:f", "s:ch", "s:ou"]


def defauts():
    src = open(os.path.join(RACINE, "zoo-connecte.html"), encoding="utf-8").read()
    i = src.index("var DEFAULTS = {")
    j = src.index("\n  };", i)
    out = {}
    for k, v in re.findall(r'"([tms]:[a-z0-9]+)":\s*"((?:[^"\\]|\\.)*)"', src[i:j]):
        out[k] = v.replace("\\n", "\n")
    return out


def mots(texte):
    return [w for ln in texte.split("\n") for w in ln.split()]


async def tts(texte, voix, rate, cache):
    import ssl, edge_tts, edge_tts.communicate as ec
    ca = "/root/.ccr/ca-bundle.crt"   # environnement cloud : certificat du proxy
    if os.path.exists(ca):
        ec._SSL_CTX = ssl.create_default_context(cafile=ca)
    h = hashlib.sha1(("%s|%s|%s" % (texte, voix, rate)).encode()).hexdigest()[:16]
    f = os.path.join(cache, h + ".mp3")
    if not os.path.exists(f):
        for essai in range(4):
            try:
                await edge_tts.Communicate(texte, voix, rate=rate).save(f)
                if os.path.getsize(f) > 0:
                    break
            except Exception:
                pass
            await asyncio.sleep(2 + essai * 3)
    if not os.path.exists(f) or os.path.getsize(f) == 0:
        if os.path.exists(f):
            os.remove(f)
        return None
    return f


def wav(src, dst, filtres=""):
    """mp3 → wav 16 kHz mono, silences du début et de la fin coupés"""
    af = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    if filtres:
        af += "," + filtres
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-af", af, "-ar", "16000", "-ac", "1", dst], check=True)


def duree(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def silence(dst, s):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "%.3f" % s, dst], check=True)


def concat(parts, dst, cache):
    lst = os.path.join(cache, "concat_%d.txt" % random.randint(0, 1 << 30))
    with open(lst, "w") as fh:
        for p in parts:
            fh.write("file '%s'\n" % p)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-ar", "16000", "-ac", "1", dst], check=True)
    os.remove(lst)


VOY = {"a": "o", "o": "a", "i": "u", "u": "i", "é": "a", "e": "a", "è": "é", "y": "a"}


def faux(w):
    """un mot mal lu : la première voyelle change (« lu » → « li », « fée » → « fae »…)"""
    for k, c in enumerate(w):
        lc = c.lower()
        if lc in VOY:
            return w[:k] + VOY[lc] + w[k + 1:]
    return w + "a"


async def mot_a_mot(liste, voix, rnd, cache, sub=None, rep=None, pause=(0.35, 0.9)):
    """lit les mots un par un avec des pauses (lecteur débutant) ; renvoie fichiers + moment de fin de chaque mot"""
    parts, fins, t = [], [], 0.0
    sub = sub or {}
    rep = rep or set()
    for i, w in enumerate(liste):
        dit = sub.get(i, w)
        if not re.sub(r"[^\w]", "", dit):
            fins.append(t)   # signe seul (« ! ») : rien à dire
            continue
        seq = [dit]
        if i in rep:
            seq = [dit, dit]   # répète le mot (hésitation) : ce n'est pas une erreur
        for d in seq:
            mot = re.sub(r"[.,;!?«»]", "", d) or d
            mp3 = await tts(mot, voix, "-15%", cache) or await tts(mot, "fr-FR-DeniseNeural", "-15%", cache)
            if not mp3:
                raise RuntimeError("voix indisponible pour " + mot)
            f = mp3[:-4] + "_%s.wav" % voix[6:10]
            if not os.path.exists(f):
                wav(mp3, f)
            parts.append(f)
            t += duree(f)
            p = os.path.join(cache, "sil_%d.wav" % int(rnd.uniform(*pause) * 1000))
            if not os.path.exists(p):
                silence(p, int(p.split("_")[-1][:-4]) / 1000)
            parts.append(p)
            t += int(p.split("_")[-1][:-4]) / 1000
        fins.append(t)
    return parts, fins


def finir(src, dst, couper, bruit=None):
    """coupe à `couper` s, ajoute un bruit de classe éventuel, encode comme un enregistrement de tablette (webm/opus 32 kb/s)"""
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", src]
    if bruit:
        cmd += ["-i", bruit, "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.02:r=16000",
                "-filter_complex", "[1:a]volume=0.18[b];[0:a][b][2:a]amix=inputs=3:duration=first:normalize=0[m]", "-map", "[m]"]
    cmd += ["-t", "%.2f" % couper, "-ar", "16000", "-ac", "1", "-c:a", "libopus", "-b:a", "32k", dst]
    subprocess.run(cmd, check=True)


async def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "aide-ecoute-cas"
    os.makedirs(out, exist_ok=True)
    cache = os.path.join(out, "cache")
    os.makedirs(cache, exist_ok=True)
    D = defauts()
    rnd = random.Random(42)
    cas = []
    # bruit de fond : un autre élève lit un autre texte, à voix basse
    fond_mp3 = await tts(D["t:p"] + " " + D["t:r"] + " " + D["t:m"], "fr-FR-HenriNeural", "-10%", cache)
    fond = os.path.join(cache, "fond.wav")
    wav(fond_mp3, fond, "aloop=loop=-1:size=2e9,atrim=0:70")
    for k in EXOS:
        if k not in D:
            continue
        try:
            cas += await un_exo(k, D, rnd, cache, out, fond)
        except Exception as e:
            print(k, "ignoré :", e, flush=True)
    json.dump(cas, open(os.path.join(out, "cas.json"), "w"), ensure_ascii=False, indent=1)
    print(len(cas), "cas dans", out)


async def un_exo(k, D, rnd, cache, out, fond):
        cas = []
        L = mots(D[k])
        n = len(L)
        base = k.replace(":", "-")
        # 1. lecture fluide (adulte), tout le texte
        mp3 = await tts(D[k].replace("\n", " "), "fr-FR-DeniseNeural", "-10%", cache)
        if not mp3:
            raise RuntimeError("voix indisponible")
        w1 = os.path.join(cache, base + "_fluide.wav")
        wav(mp3, w1)
        d1 = min(DUREE, duree(w1))
        f = base + "_fluide.webm"
        finir(w1, os.path.join(out, f), d1 + 0.3)
        cas.append({"f": f, "k": k, "voix": "adulte", "type": "fluide", "words": L, "end": n - 1 if d1 < DUREE else None, "errs": []})
        # 2. mot à mot (voix d'enfant), coupé à 60 s ou arrêté au milieu
        parts, fins = await mot_a_mot(L, "fr-FR-EloiseNeural", rnd, cache)
        w2 = os.path.join(cache, base + "_mam.wav")
        concat(parts, w2, cache)
        stop = min(DUREE, fins[-1])
        if k.startswith("t"):
            stop = min(stop, fins[n // 2])   # s'arrête au milieu du texte
        end = max(i for i, t in enumerate(fins) if t <= stop + 0.01)
        f = base + "_motamot.webm"
        finir(w2, os.path.join(out, f), stop)
        cas.append({"f": f, "k": k, "voix": "enfant", "type": "mot à mot, arrêt", "words": L, "end": end, "errs": []})
        # 3. mot à mot avec 3 mots faux et 2 répétitions
        lim = min(n - 1, int(n * 0.7))
        lisibles = [i for i in range(1, lim) if re.sub(r"[^\w]", "", L[i])]
        pos = sorted(rnd.sample(lisibles, min(3, len(lisibles))))
        sub = {i: faux(L[i]) for i in pos if faux(L[i]).lower() != L[i].lower()}
        rep = set(rnd.sample([i for i in range(lim) if i not in sub and re.sub(r"[^\w]", "", L[i])], 2))
        parts, fins = await mot_a_mot(L, "fr-FR-EloiseNeural", rnd, cache, sub, rep)
        w3 = os.path.join(cache, base + "_err.wav")
        concat(parts, w3, cache)
        stop = min(DUREE, fins[lim])
        end = max(i for i, t in enumerate(fins) if t <= stop + 0.01)
        errs = sorted(i for i in sub if i <= end)
        f = base + "_erreurs.webm"
        finir(w3, os.path.join(out, f), stop)
        cas.append({"f": f, "k": k, "voix": "enfant", "type": "3 erreurs + 2 répétitions", "words": L, "end": end, "errs": errs, "dits": {str(i): sub[i] for i in sub}})
        # 4. même lecture dans le bruit de la classe
        f = base + "_bruit.webm"
        finir(w3, os.path.join(out, f), stop, fond)
        cas.append({"f": f, "k": k, "voix": "enfant", "type": "erreurs + bruit de classe", "words": L, "end": end, "errs": errs, "dits": {str(i): sub[i] for i in sub}})
        print(k, "ok", flush=True)
        return cas


asyncio.run(main())
