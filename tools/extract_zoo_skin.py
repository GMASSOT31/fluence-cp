#!/usr/bin/env python3
"""Fabrique calcul/zoo-skin.css : copie, depuis zoo-connecte.html, seulement les règles CSS dont le sélecteur concerne les composants
réutilisés par le labo de calcul (bandeau, panneaux, boutique, cartes, boutons…). zoo-connecte.html n'est pas modifié.
Usage : python3 tools/extract_zoo_skin.py   (à relancer si le style du Zoo de Lecture change)"""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = re.compile(r"""(^|[\s,>+~(])(:root|html|body|\*|main|header|button|h1|h2|h3|p|a|input|small|strong|label|blockquote|select)([\s,.:\[>+~{]|$)|
  \.(zoo-|layout|panel|pcard|pn-|avatar|gold-coin|bottom-nav|me-menu|card\b|primary|secondary|ghost-sm|home-|quote-card|toast|shop|awning|shelf|prod|wallet|pricetag|buy|need|can\b|
  zoo-grid|zoo-card|play-cta|read-cta|listen-cta|big-btn|row\b|hint|muted|link|field|stat\b|sym|game-result|needs-reward|mini-stars|cert-stamp|pet\b|pet-|son\b|bad-msg|sr-only|visually|ticket|bag|ico\b|grow|name\b|confetti|cloud|booting|qty|tint|toast|seg\b)""", re.X)
def split_rules(css):
    out, i, n = [], 0, len(css)
    while i < n:
        while i < n and css[i] in " \n\t\r": i += 1
        if i >= n: break
        if css.startswith("/*", i):
            j = css.find("*/", i); i = n if j < 0 else j + 2; continue
        j = css.find("{", i)
        if j < 0: break
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{": depth += 1
            elif css[k] == "}": depth -= 1
            k += 1
        out.append((css[i:j].strip(), css[j + 1:k - 1])); i = k
    return out
def keep_rules(css, names_used):
    res = []
    for sel, body in split_rules(css):
        if sel.startswith("@media") or sel.startswith("@supports"):
            inner, _ = keep_rules(body, names_used)
            if inner.strip(): res.append("%s {\n%s}\n" % (sel, inner))
        elif sel.startswith("@keyframes"):
            res.append((sel, body))
        elif sel.startswith("@font-face") or sel.startswith("@import"):
            res.append("%s {%s}\n" % (sel, body))
        elif any(KEEP.search(s.strip()) for s in sel.split(",")):
            res.append("  %s {%s}\n" % (sel, body))
    return "".join(x for x in res if isinstance(x, str)), [x for x in res if not isinstance(x, str)]
def main():
    s = open(os.path.join(ROOT, "zoo-connecte.html"), encoding="utf-8").read()
    css = s[s.index("<style>") + 7:s.index("</style>")]
    text, kf = keep_rules(css, set())
    used = lambda name: re.search(r"animation[^;}]*\b" + re.escape(name) + r"\b", text)
    kfs = "".join("@keyframes %s {%s}\n" % (sel.split()[1], body) for sel, body in kf if used(sel.split()[1]))
    head = "/* GÉNÉRÉ par tools/extract_zoo_skin.py à partir de zoo-connecte.html : ne pas modifier à la main (les changements propres au calcul vont dans labo-calcul.html). */\n"
    open(os.path.join(ROOT, "calcul", "zoo-skin.css"), "w", encoding="utf-8").write(head + text + kfs)
    print("calcul/zoo-skin.css :", len(head + text + kfs), "octets")
main()
