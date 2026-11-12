"""Rend les styles des pages élèves lisibles par Safari 12 (iPad iOS 12) sans rien changer pour les navigateurs récents :
 - position: sticky  -> avec préfixe -webkit- d'abord
 - inset: X          -> top/right/bottom/left
 - clamp(a,b,c)      -> max(a, min(b, c))  (min/max existent dès Safari 11.1)
Usage : python3 -I tools/compat_safari12.py zoo-connecte.html labo-calcul.html calcul/zoo-skin.css eleve.html (à relancer après une modification du style des pages élèves)
"""
import re
import sys


def split_args(s):
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur.strip()); cur = ""
        else:
            cur += ch
    out.append(cur.strip())
    return out


def fix_clamp(text):
    res, i, n = "", 0, 0
    while True:
        j = text.find("clamp(", i)
        if j < 0:
            res += text[i:]; break
        if j > 0 and (text[j - 1].isalnum() or text[j - 1] in "-_.$"):   # pas un nom de fonction JS ou autre
            res += text[i:j + 6]; i = j + 6; continue
        k, depth = j + 6, 1
        while depth and k < len(text):
            depth += (text[k] == "(") - (text[k] == ")"); k += 1
        args = split_args(text[j + 6:k - 1])
        if len(args) != 3:
            res += text[i:k]; i = k; continue
        res += text[i:j] + "max(%s, min(%s, %s))" % tuple(args); i = k; n += 1
    return res, n


def fix(path):
    s = open(path, encoding="utf-8").read()
    o = s
    s, nsticky = re.subn(r"(?<![-\w])position:\s*sticky", "position: -webkit-sticky; position: sticky", s)
    s, ninset = re.subn(r"(?<![-\w])inset:\s*(-?\d+(?:px|%)?)(\s*[;}\"'])", lambda m: "top: %s; right: %s; bottom: %s; left: %s%s" % (m.group(1), m.group(1), m.group(1), m.group(1), m.group(2)), s)
    s, nclamp = fix_clamp(s)
    # canvas dont la hauteur venait seulement de aspect-ratio : height:auto garde le rapport des attributs width/height du canvas
    s, ncv = re.subn(r"(\.(?:snake|flap)-canvas \{ display: block; width: [^;]+;) aspect-ratio", r"\1 height: auto; aspect-ratio", s)
    if s != o:
        open(path, "w", encoding="utf-8").write(s)
    print("%-32s sticky:%d inset:%d clamp:%d canvas:%d" % (path.split("/")[-1], nsticky, ninset, nclamp, ncv))


for p in sys.argv[1:]:
    fix(p)
