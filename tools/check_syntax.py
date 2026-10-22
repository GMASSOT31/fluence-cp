#!/usr/bin/env python3
"""Vérifie la syntaxe JavaScript des pages du site (sans rien exécuter).

Usage (depuis la racine du dépôt) :
    python3 tools/check_syntax.py                 # toutes les pages et scripts du site
    python3 tools/check_syntax.py zoo-connecte.html demo.js

Pour une page .html, les scripts en ligne (<script> sans src) sont extraits et vérifiés ensemble.
Moteur utilisé : Node (`node --check`) s'il est installé, sinon le moteur JavaScript de macOS
(osascript -l JavaScript, via tools/check-syntax-macos.js).
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT = ["zoo-connecte.html", "enseignants.html", "eleve.html", "index.html", "demo.js", "demo-tour.js"]


def source_of(path):
    text = open(path, encoding="utf-8").read()
    if path.endswith(".html"):
        blocks = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", text, re.S)
        return "\n;\n".join(blocks)
    return text


def check(code):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(code)
        tmp = f.name
    try:
        if shutil.which("node"):
            r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
            return r.returncode == 0, (r.stderr or "").strip()
        if shutil.which("osascript"):
            env = dict(os.environ, F=tmp)
            r = subprocess.run(["osascript", "-l", "JavaScript", os.path.join(ROOT, "tools", "check-syntax-macos.js")],
                               capture_output=True, text=True, env=env)
            out = (r.stdout + r.stderr).strip()
            return out.startswith("SYNTAXE OK"), out
        return None, "Ni Node ni osascript : installe Node pour vérifier la syntaxe."
    finally:
        os.unlink(tmp)


def main(files):
    files = files or DEFAULT
    ok_all = True
    for name in files:
        path = name if os.path.isabs(name) else os.path.join(ROOT, name)
        if not os.path.exists(path):
            print(f"?  {name} : introuvable")
            continue
        ok, msg = check(source_of(path))
        if ok is None:
            print(msg)
            return 2
        print(("OK " if ok else "ERREUR ") + name + ("" if ok else " : " + msg))
        ok_all = ok_all and ok
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
