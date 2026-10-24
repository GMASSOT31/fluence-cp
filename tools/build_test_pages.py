#!/usr/bin/env python3
"""Fabrique un petit site de test local (tools/test-site/, ignoré par git), sans toucher à Supabase.

Usage (depuis la racine du dépôt) :
    python3 tools/build_test_pages.py
    python3 -m http.server 8765 --bind 127.0.0.1 --directory tools/test-site

Pages produites :
  zoo-test.html          Zoo élève branché sur le faux serveur tools/fake-supabase.js
                         (options d'URL : ?lirecartes=1  progression préremplie, ?sanscode=1  sans code enseignant,
                          ?illimite=1  parties illimitées, ?prix4=1  roue à 4 pièces)
                         + window.__t : accès aux fonctions internes du Zoo pour les tests (uniquement ici)
  enseignants-test.html  Espace enseignant branché sur tools/fake-auth.js (admin par défaut, ?teacher=1 pour enseignant)
  labo-calcul-test.html   Laboratoire de calcul (privé), côté élève, branché sur tools/fake-labo.js ; enseignants-test.html?role=admin|teacher|refuse montre aussi la bascule Calcul intégrée
                         (?who=ok|refuse|none, ?off=1, ?role=admin|teacher|refuse|out, ?fail=1 ; voir l'en-tête de fake-labo.js)
  eleve-test.html        Connexion élève branchée sur tools/fake-auth.js (PIN accepté : 4321)
  zoo-connecte.html, enseignants.html, eleve.html, demo.js, demo-tour.js : copies réelles ;
                         la démo sans compte se teste avec zoo-connecte.html?demo=1&new=1
Vérifier la syntaxe : python3 tools/check_syntax.py
"""
import os
import random
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "test-site")
CDN = '<script src="vendor/supabase.js?v=2.118.0"></script>'
LOADER = re.compile(r"<script>/\* Démo sans compte.*?</script>", re.S)
FLAP_HOOK = ("window.__flap={bird:bird,pipes:pipes,state:function(){return{t:t,dead:dead,won:won,started:started,ended:ended,passed:passed,scroll:scroll,lives:lives,inv:inv}},"
             "setT:function(v){t=v;bi=FLAP_BANNERS.filter(function(x){return x<=v}).length}};")
TILES_HOOK = ("window.__tiles={rows:function(){return rows},state:function(){return{t:t,lives:lives,score:score,dead:dead,ended:ended,started:started,model:target.model}},setT:function(v){t=v}};")
HOOK_AT = 'if(!cloudMode){setMode();show("login");'
HOOK = ("window.__t={data:data,LS:LS,G:G,finishScore:finishScore,winCoin:winCoin,coins:coins,listenEnd:listenEnd,"
        "listenMine:listenMine,listenNeed:listenNeed,pendingWheels:pendingWheels,renderHome:renderHome,renderJeux:renderJeux,"
        "openWheel:openWheel,showEvolution:showEvolution,charFor:charFor,uid:uid,saveReview:saveReview,petState:petState,isValid:isValid,confetti:confetti};")


def read(name):
    return open(os.path.join(ROOT, name), encoding="utf-8").read()


def write(name, text):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(text)


def swap_backend(text, fake, token=False):
    v = random.randint(100, 99999)
    tag = ('<script>sessionStorage.setItem("zoo_student_token","tok");</script>' if token else "") + \
          '<script src="%s?v=%d"></script>' % (fake, v)
    if LOADER.search(text):
        return LOADER.sub(lambda m: tag, text, count=1)
    if CDN in text:
        return text.replace(CDN, tag, 1)
    raise SystemExit("Balise Supabase introuvable : la page a changé, adapter tools/build_test_pages.py")


def main():
    os.makedirs(OUT, exist_ok=True)
    zoo = swap_backend(read("zoo-connecte.html"), "fake-supabase.js", token=True)
    if HOOK_AT in zoo:
        zoo = zoo.replace(HOOK_AT, HOOK + HOOK_AT, 1)
    zoo = zoo.replace("/*TEST_HOOK_FLAP*/", FLAP_HOOK, 1)   # accès à l'oiseau pour les tests (uniquement ici)
    zoo = zoo.replace("/*TEST_HOOK_TILES*/", TILES_HOOK, 1)
    write("zoo-test.html", zoo)
    ens = swap_backend(read("enseignants.html"), "fake-auth.js")
    # le calcul intégré à l'espace enseignant : les appels lab_* de la page sont servis par l'API factice (sans remplacer le faux client de la page)
    ens = ens.replace('<script src="labo-config.js?v=1" defer></script>', '<script>window.__labNoClient=1</script><script src="fake-labo.js"></script><script src="fake-labo-fetch.js"></script>\n<script src="labo-config.js?v=1" defer></script>', 1)
    write("enseignants-test.html", ens)
    write("eleve-test.html", swap_backend(read("eleve.html"), "fake-auth.js"))
    for name in ["zoo-connecte.html", "enseignants.html", "eleve.html", "index.html", "mentions-legales.html", "confidentialite.html", "demo.js", "demo-tour.js", "share.js", "zoo-embed.js"]:
        shutil.copy(os.path.join(ROOT, name), os.path.join(OUT, name))
    shutil.copytree(os.path.join(ROOT, "img"), os.path.join(OUT, "img"), dirs_exist_ok=True)
    shutil.copytree(os.path.join(ROOT, "guides"), os.path.join(OUT, "guides"), dirs_exist_ok=True)
    for name in ["fake-supabase.js", "fake-auth.js", "fake-labo.js", "fake-labo-fetch.js"]:
        shutil.copy(os.path.join(ROOT, "tools", name), os.path.join(OUT, name))
    # Laboratoire de calcul (privé) : pages branchées sur tools/fake-labo.js, plus les fichiers communs
    for name in ["labo-calcul.html"]:
        page = swap_backend(read(name), "fake-labo.js")
        if name == "labo-calcul.html":
            page = page.replace("var ADVANCE_MS = 1100;", "var ADVANCE_MS = 40;")   # tests rapides : passage à la question suivante presque immédiat
            page = page.replace("zoo-connecte.html", "zoo-test.html")   # le cadre « boutique / arcade » montre le Zoo branché sur le faux serveur
        write(name.replace(".html", "-test.html"), page)
    for name in ["labo-config.js", "labo-switch.js"]:
        if os.path.exists(os.path.join(ROOT, name)):
            shutil.copy(os.path.join(ROOT, name), os.path.join(OUT, name))
    shutil.copytree(os.path.join(ROOT, "calcul"), os.path.join(OUT, "calcul"), dirs_exist_ok=True)
    print("Site de test prêt dans tools/test-site/. Lancer :")
    print("  python3 -m http.server 8765 --bind 127.0.0.1 --directory tools/test-site")
    print("puis ouvrir http://localhost:8765/zoo-test.html , /enseignants-test.html , /zoo-connecte.html?demo=1&new=1")


if __name__ == "__main__":
    main()
