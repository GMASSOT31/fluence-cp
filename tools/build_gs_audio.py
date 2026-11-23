"""Sons enregistrés du parcours GS : noms des lettres, nombres 0–20, consignes → audio/gs.mp3 + audio/gs.json (« audio sprite »).

Même voix que les syllabes du Zoo (fr-FR-DeniseNeural, −10 %), mêmes outils que tools/build_audio_sprite.py (réutilisés).
Il faut : ffmpeg, edge-tts (python3 -m venv /tmp/zoo-venv && /tmp/zoo-venv/bin/pip install edge-tts) et l'accès à speech.platform.bing.com
(environnement Claude « fluence-cp »). Lancer depuis la racine : /tmp/zoo-venv/bin/python tools/build_gs_audio.py
Pour changer un texte : modifier CLIPS ci-dessous, relancer, puis augmenter GS_AUDIO_V dans gs-lecture.js.
Le lecteur (gs-lecture.js) joue l'enregistrement s'il existe, sinon la voix de l'appareil : le site marche aussi sans ces fichiers."""
import asyncio, hashlib, importlib.util, json, os, sys, wave, array, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bas", os.path.join(HERE, "build_audio_sprite.py"))
bas = importlib.util.module_from_spec(spec); spec.loader.exec_module(bas)
RATE = bas.RATE

# clé → texte dit. Lettres : la lettre seule en capitale (la voix dit son nom) ; quelques noms écrits en toutes lettres.
LETTRES = {c: c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
LETTRES.update({"W": "double vé", "Y": "i grec"})
CLIPS = {}
CLIPS.update({"L:" + c: t for c, t in LETTRES.items()})
CLIPS.update({"N:%d" % n: str(n) for n in range(21)})
CLIPS.update({
    "c:touche": "Touche la lettre",
    "c:pas": "Ce n’est pas celle-là.",
    "c:aide": "Je vais t’aider. Regarde bien les lettres et écoute leur nom.",
    "c:amoi": "À toi de jouer !",
    "c:alpha": "Écoute la comptine des lettres !",
    "c:alphafin": "Bravo ! Tu as écouté toutes les lettres.",
    "c:bravo": "Bravo !",
    "c:presque": "Presque ! On recommence ?",
    "c:aideok": "Ce n’est pas grave. Je vais t’aider.",
    "c:valide": "Bravo ! Tu as gagné toutes les étoiles.",
    "c:mission": "Ta mission : reconnaître les lettres. Touche le gros bouton.",
    "c:rituel": "D’abord, écoute la comptine des lettres. Touche le gros bouton.",
    "c:fini": "Bravo, tu connais toutes les lettres ! Tu peux t’entraîner encore.",
    "c:roue": "Une roue t’attend. Touche le gros bouton pour la lancer.",
    "c:meme": "Touche la même lettre.",
    "c:ordre": "Range les lettres dans l’ordre de l’alphabet.",
})


async def main():
    voice, rate, out = "fr-FR-DeniseNeural", "-10%", os.path.join(HERE, "..", "audio")
    tmp = "/tmp/zoo-gs-audio"; os.makedirs(tmp, exist_ok=True)
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    sem = asyncio.Semaphore(6)
    keys = list(CLIPS)
    res = await asyncio.gather(*[bas.render(CLIPS[k], tmp, voice, rate, proxy, sem) for k in keys])
    pad, gap = int(0.04 * RATE), int(0.10 * RATE)
    full, sprite, missing = array.array("h"), {}, []
    for k, r in zip(keys, res):
        if not r:
            missing.append(k); continue
        a, f, l = bas.speech_bounds(r["wav"])
        seg = a[max(0, f - int(0.015 * RATE)): min(len(a), l + int(0.06 * RATE))]
        start = len(full); full.extend([0] * pad); full.extend(seg)
        end = len(full) + pad // 2; full.extend([0] * gap)
        sprite[k] = [round(start * 1000 / RATE), round((end - start) * 1000 / RATE)]
    wav = os.path.join(tmp, "_gs.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(full.tobytes())
    mp3 = os.path.join(out, "gs.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-ar", str(RATE), "-codec:a", "libmp3lame", "-b:a", "48k", mp3], check=True)
    ver = hashlib.sha1(open(mp3, "rb").read()).hexdigest()[:8]
    with open(os.path.join(out, "gs.json"), "w", encoding="utf-8") as f:
        json.dump({"voix": voice, "vitesse": rate, "src": "audio/gs.mp3?v=" + ver, "sprite": sprite, "textes": {k: CLIPS[k] for k in sprite}}, f, ensure_ascii=False, separators=(",", ":"))
    print("%s : %.0f Ko, %d sons, manquants : %s" % (mp3, os.path.getsize(mp3) / 1024, len(sprite), ", ".join(missing) or "aucun"))
    for k in keys:
        if k in sprite: print("  %-10s %5d ms  %s" % (k, sprite[k][1], CLIPS[k]))

if __name__ == "__main__":
    asyncio.run(main())
