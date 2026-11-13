#!/usr/bin/env python3
"""Mots de la dictée et de l'écoute : décompose chaque mot en graphèmes (lettres ou groupes de lettres) et retrouve le son qui enseigne chacun,
pour ne proposer à un élève que des mots qu'il peut ÉCRIRE avec les sons déjà vus (ordre de la progression).

Usage :
  python3 -I tools/exo_mots.py            # rapport : mots refusés, mots par son, vérification
  python3 -I tools/exo_mots.py --ecrire   # réécrit le bloc « WORD_POOL » de exo-data.js

Pour ajouter des mots : les ajouter dans CANDIDATS ci-dessous, relancer avec --ecrire, relire le rapport.
Règles de lecture : voir les commentaires de segmente(). Un mot est refusé s'il contient une lettre muette finale (t, d, s, x, p, g, z),
une lettre jamais enseignée (â, î, ô, û, ç…), un « e » fermé non prévu, un c/g doux avant une nasale, etc."""
import re
import sys
import os

ORDER = ["voy", "voy2", "l", "f", "ch", "s", "m", "r", "n", "v", "j", "z", "p", "t", "c", "b", "d", "g", "ou", "au", "h", "on", "oi", "an", "en", "ai", "er",
         "fr", "fl", "in", "ain", "oin", "ian", "eu", "k", "gn", "ph", "gj", "cs", "es", "elle", "sz", "ill", "y", "ti", "w", "x", "un"]
POS = {s: i for i, s in enumerate(ORDER)}

# graphème → son qui l'enseigne
G2S = {}
def reg(sound, *gs):
    for g in gs:
        G2S[g] = sound
reg("voy", "a", "e", "i", "o", "u", "y")
reg("voy2", "é", "è")
for c in "lfsmrnvjzptcbdg":
    reg(c, c)
reg("ch", "ch"); reg("h", "h"); reg("ou", "ou"); reg("au", "au", "eau"); reg("on", "on", "om"); reg("oi", "oi"); reg("an", "an", "am"); reg("en", "en", "em")
reg("ai", "ai", "ei", "ê", "et"); reg("er", "er", "ez", "es/e")      # er, ez, es = le son /e/ ; « es/e » = « es » final lu /e/ (les, mes)
reg("fr", "fr", "pr", "br", "cr", "dr", "gr", "tr", "vr"); reg("fl", "fl", "pl", "bl", "cl", "gl")
reg("in", "in", "im"); reg("ain", "ain", "ein"); reg("oin", "oin"); reg("ian", "ian", "ien", "ion", "ieu")
reg("eu", "eu", "œu"); reg("k", "k", "qu"); reg("gn", "gn"); reg("ph", "ph"); reg("gj", "ge", "gi", "gy"); reg("cs", "ce", "ci", "cy")
reg("es", "es", "el", "ec", "er/c")                                    # es, el, ec, er (+ consonne) = le son /ɛ/ fermé
reg("elle", "elle", "ette", "ll", "tt", "mm", "nn", "pp", "rr", "ff", "ss", "bb", "dd", "cc", "gg", "zz")
reg("sz", "s/z"); reg("ill", "ill"); reg("y", "y/j", "ii"); reg("ti", "ti"); reg("w", "w"); reg("x", "x"); reg("un", "un", "yn")

VOY = set("aeiouyéèê")
NASAL = {"on": "on", "om": "on", "an": "an", "am": "an", "en": "en", "em": "en", "in": "in", "im": "in", "un": "un", "yn": "un",
         "ain": "ain", "ein": "ain", "oin": "oin", "ian": "ian", "ien": "ian", "ion": "ian"}
FERMES = {"mer", "fer", "ver", "hiver", "enfer", "hier"}              # « er » final lu /ɛʀ/ et non /e/
MUETS = set("tdsxpgz")                                               # lettres souvent muettes en fin de mot : refusées


def voyelle(ch):
    return ch != "" and ch in VOY


def dans(ch, chars):
    """Vrai si ch est une lettre de chars (attention : "" est « dans » toute chaîne en Python)."""
    return ch != "" and ch in chars


def segmente(mot):
    """Renvoie la liste des graphèmes (str), ou None si le mot ne se décompose pas avec les règles enseignées."""
    w = mot.lower()
    n = len(w)

    def suite(i):                      # lettre à l'indice i ou ""
        return w[i] if 0 <= i < n else ""

    def avec(g, i, k):                 # graphème g sur k lettres, puis le reste du mot
        t = go(i + k)
        return None if t is None else [g] + t

    def nasale_ok(j):                  # une nasale n'en est une que si la lettre qui suit n'est ni une voyelle ni n / m
        x = suite(j)
        return not voyelle(x) and not dans(x, "nm")

    def go(i):
        if i == n:
            return []
        c = w[i]
        r = w[i:]
        two = r[:2]
        # --- groupes longs
        for g in ("ette", "elle"):
            if r.startswith(g):
                return avec(g, i, 4)
        if r.startswith("tion"):                                       # potion : ti + on
            t = go(i + 4)
            return None if t is None else ["ti", "on"] + t
        if r.startswith("eau"):
            return avec("eau", i, 3)
        if r.startswith("ill") and i > 0:                              # fille, bille, feuille, abeille : « ill » après une autre lettre
            return avec("ill", i, 3)
        if two in ("ai", "ei") and suite(i + 2) == "l" and suite(i + 3) == "l":   # paille, abeille : a / e + ill
            return avec(c, i, 1)
        for g in ("ain", "ein", "oin", "ian", "ien", "ion"):
            if r.startswith(g) and nasale_ok(i + 3):
                t = go(i + 3)
                if t is not None:
                    return [g] + t
        # --- groupes de 2 lettres qu'on ne coupe jamais
        if two == "œu":
            return avec("œu", i, 2)
        if two in ("ai", "ei", "au", "ou", "oi", "eu", "ch", "ph", "gn", "qu"):
            return avec(two, i, 2)
        if two in ("ll", "tt", "mm", "nn", "pp", "rr", "ff", "ss", "bb", "dd", "cc", "gg", "zz", "ii"):
            return avec(two, i, 2)
        if two in NASAL and nasale_ok(i + 2):
            t = go(i + 2)
            if t is not None:
                return [two] + t
        # --- e : /ɛ/ fermé (er, es, el, ec, ez, et) ou /e/ final, sinon e ouvert /ə/
        if c == "e":
            nx = suite(i + 1)
            fin = (i + 2 == n)
            if two == "er" and fin:
                return avec("er/c" if w in FERMES else "er", i, 2)
            if two == "er" and suite(i + 2) != "" and not voyelle(suite(i + 2)):
                return avec("er/c", i, 2)                              # merci, perle : /ɛʀ/ + consonne
            if two == "ez" and fin:
                return ["ez"]
            if two == "es" and fin:
                return ["es/e"]
            if two == "es" and suite(i + 2) != "" and not voyelle(suite(i + 2)):
                return avec("es", i, 2)                                # veste, reste : /ɛs/ + consonne
            if two == "et" and fin:
                return ["et"]
            if two in ("el", "ec") and fin:
                return [two]
            ouvert = (nx == "" or voyelle(nx) or
                      (not voyelle(nx) and (voyelle(suite(i + 2)) or suite(i + 2) == "h" or
                       (dans(suite(i + 2), "rl") and voyelle(suite(i + 3))))))
            return avec("e", i, 1) if ouvert else None
        # --- groupes consonne + r / l  (avant c et g : « gr », « cl »…)
        if dans(c, "fpbcdgtv") and suite(i + 1) == "r" and voyelle(suite(i + 2)):
            return avec(c + "r", i, 2)
        if dans(c, "fpbcg") and suite(i + 1) == "l" and voyelle(suite(i + 2)):
            return avec(c + "l", i, 2)
        # --- c et g : durs devant a, o, u, consonne ; doux devant e, i, y
        if c in "cg":
            nx = suite(i + 1)
            if dans(nx, "éèê"):
                return None                                            # « cé », « gé »… : non géré
            if dans(nx, "eiy"):
                if nx == "e" and dans(suite(i + 2), "nm") and not voyelle(suite(i + 3)):
                    return None                                        # centre, mangeons : non géré
                if c == "c" and nx == "e" and suite(i + 2) == "t" and i + 3 == n:
                    return None                                        # lacet : non géré
                return avec(c + nx, i, 2)
            if c == "g" and nx == "u" and dans(suite(i + 2), "eiéè"):
                return None                                            # gue, gui : graphème non enseigné
            return avec(c, i, 1)
        # --- s : entre deux voyelles il se lit /z/
        if c == "s":
            return avec("s/z" if voyelle(suite(i - 1)) and voyelle(suite(i + 1)) else "s", i, 1)
        # --- y : voyelle /i/ ; /j/ entre deux voyelles ou en début de mot devant une voyelle
        if c == "y":
            semi = voyelle(suite(i + 1)) and (i == 0 or voyelle(suite(i - 1)))
            return avec("y/j" if semi else "y", i, 1)
        # --- lettres simples
        if c in "aiouéèê" or c in "lfmrnvjzptbdhkwx":
            return avec(c, i, 1)
        return None                                                    # â î ô û ç œ…, ponctuation

    seg = go(0)
    if seg is None:
        return None
    if len(seg) > 1 and seg[-1] in MUETS and seg[-2] != "e":           # lettre muette finale : refusée
        return None
    for g in seg:                                                      # chaque graphème doit enseigner un son
        if g not in G2S:
            return None
    return seg


def besoin(seg):
    """Sons nécessaires (dans l'ordre de la progression) et son le plus tardif."""
    snd = sorted({G2S[g] for g in seg}, key=lambda s: POS[s])
    return snd, snd[-1]


# Mots proposés (une liste plate : le son où chaque mot devient écrivable est trouvé automatiquement).
CANDIDATS = """
rame rire lire mare riche rafale rue ruche rime rare mur sur
lune fine mine narine farine menu une rune nul mini fané
vélo vache lave navire olive rive vif ravi salive venu fève avale
joli jolie jure juré je
zéro zoo zèle azur zone zozo
papa pile purée pipe pur pelure épi épée pari papi pipi puma opéra
tomate tortue patate moto tu télé tarte vite mite tulipe minute
café école coco caméra carafe cure cola calme cèpe cavale
bébé robe bobo tuba cube bol bar
dodo dame malade salade domino dé dur idée date radar ride dune
gare légume figure gala garde regarde galère
roue poule mouche soupe bouche cou fou sou mou four jour bijou loupe boule foule joue route
auto taupe bateau gauche jaune cadeau veau seau peau beau fauve épaule
hache hibou habile hurle
mouton bonbon savon melon salon bon son ton non mon poumon chaton raton
roi moi étoile voiture loi foi poire moine noir soir voir poil voile toile boire
maman ruban tante pantalon lampe jambe danse chanson tambour mante rampe
tente menton lente rente vente encore emporte sentir mentir pente
balai reine paire aile faire air maire tête fête pêche même rêve navet jouet filet poulet volet robinet sujet
rocher panier chanter danser chez nez jouer aimer porter sauter laver monter marcher cahier tomber regarder
frite frire prune crabe trou vrai livre arbre bravo cravate tigre cadre pauvre ombre sucre
plume planète table clé flèche pli plan blé clou plante sable fable
lapin sapin matin jardin dindon timbre moulin fin vin pin bambin chemin
pain main bain train peinture plein copain demain nain grain frein sain vilain
loin coin foin pointu témoin lointain
viande triangle chien lien bien rien lion avion pion
feu jeu bleu cheveu neveu peu peur fleur heure cœur sœur jeune voleur chanteur fleuve
kilo kimono karaté quatre bouquet masque banque disque marque casque
ligne vigne montagne peigne agneau signe gagner campagne champignon
phare photo dauphin phoque alphabet téléphone orphelin
girafe genou page bougie manège gilet image orage nuage plage rouge cage magie fromage garage mélange pigeon
citron glace police racine cinéma cirque cigare face place farce
veste bec sel merci escalier perle mer fer ver ciel miel sec avec reste verte
vaisselle échelle chaussette poubelle lunette belle pomme gomme carotte bulle ballon salle balle passe chatte cassette allumette omelette
rose vase maison chaise cerise valise oiseau fraise poison usine visage musique raisin bise église
fille bille feuille papillon grenouille famille coquille chenille abeille bouteille vanille paille médaille
pyjama stylo cycliste bicyclette yoyo yoga crayon
potion addition natation récréation opération émotion
kiwi wapiti wagon wifi
taxi boxe saxo luxe taxe mixer boxer maxi
lundi brun chacun aucun un
""".split()


def rapport(ecrire=False):
    par_son = {s: [] for s in ORDER}
    refus = []
    vus = set()
    for m in CANDIDATS:
        if m in vus:
            continue
        vus.add(m)
        seg = segmente(m)
        if seg is None:
            refus.append(m)
            continue
        _, dernier = besoin(seg)
        par_son[dernier].append((m, "-".join(seg)))
    return par_son, refus


def bloc_js(par_son):
    lignes = []
    for s in ORDER:
        for m, seg in par_son[s]:
            lignes.append(seg)
    # table graphème → son
    g2s = ", ".join('"%s": "%s"' % (g, s) for g, s in sorted(G2S.items(), key=lambda kv: (POS[kv[1]], kv[0])))
    pool = ",\n    ".join(", ".join('"%s"' % x for x in lignes[i:i + 8]) for i in range(0, len(lignes), 8))
    return ("  /* ---------- Mots de la dictée et de l'écoute ----------\n"
            "     Chaque mot est donné DÉCOMPOSÉ en graphèmes (« j-o-l-i », « r-ou-e ») ; GRAPH_SOUND dit quel son enseigne chaque graphème.\n"
            "     Un mot n'est proposé pour un son que si TOUS ses graphèmes sont enseignés au plus tard par ce son, dans l'ordre de l'enseignant\n"
            "     (wordsFor). Généré par tools/exo_mots.py : ne pas modifier à la main, ajouter les mots dans ce script. */\n"
            "  var GRAPH_SOUND = { " + g2s + " };\n"
            "  var WORD_POOL = [\n    " + pool + "\n  ];")


if __name__ == "__main__":
    par_son, refus = rapport()
    print("MOTS REFUSÉS (%d) : %s" % (len(refus), " ".join(refus)))
    print()
    for s in ORDER:
        if par_son[s]:
            print("%-5s (%d) : %s" % (s, len(par_son[s]), "  ".join(seg for _, seg in par_son[s])))
    total = sum(len(v) for v in par_son.values())
    print("\nTotal accepté : %d mots" % total)
    if "--ecrire" in sys.argv:
        p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "exo-data.js")
        src = open(p, encoding="utf-8").read()
        a = src.index("/*MOTS-DEBUT*/") + len("/*MOTS-DEBUT*/")
        b = src.index("  /*MOTS-FIN*/")
        open(p, "w", encoding="utf-8").write(src[:a] + "\n" + bloc_js(par_son) + "\n" + src[b:])
        print("exo-data.js mis à jour.")
