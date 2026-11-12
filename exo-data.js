/* Exercices : données partagées entre le Zoo élève (zoo-connecte.html) et l'espace enseignant (enseignants.html).
   Source unique : sons à reconnaître, syllabes, mots, textes que la voix lit mal, et exoAuto() = la liste « automatique » d'un son
   (ce que le Zoo propose tant que l'enseignant n'a rien choisi). Syntaxe ES2018 pour rester lisible par Safari 12 (iPad iOS 12). */
(function () {
  /* Graphèmes à reconnaître et à prononcer, par son : [id, "graphèmes séparés par des virgules", texte à dire]
     (les voix de synthèse disent souvent le nom de la lettre : on leur donne une syllabe proche du son) */
  var LISTEN_ITEMS = [
    ["voy", "a", "a"], ["voy", "e", "euh"], ["voy", "i", "i"], ["voy", "o", "o"], ["voy", "u", "u"], ["voy2", "é", "et"], ["voy2", "è", "est"],
    ["l", "l", "leu"], ["f", "f", "feu"], ["ch", "ch", "cheu"], ["s", "s", "seu"], ["m", "m", "meu"], ["r", "r", "reu"], ["n", "n", "neu"],
    ["v", "v", "veu"], ["j", "j", "jeu"], ["z", "z", "zeu"], ["p", "p", "peu"], ["t", "t", "teu"], ["c", "c", "keu"], ["b", "b", "beu"],
    ["d", "d", "deu"], ["g", "g", "gueu"], ["ou", "ou", "ou"], ["au", "au,eau", "o"], ["on", "on,om", "on"], ["oi", "oi", "oua"],
    ["an", "an,am", "an"], ["en", "en,em", "an"], ["ai", "ai,ei,ê,et", "est"], ["er", "er,ez,es", "et"], ["fr", "fr", "freu"], ["fr", "pr", "preu"],
    ["fl", "fl", "fleu"], ["fl", "pl", "pleu"], ["in", "in,im", "hein"], ["ain", "ain,ein", "hein"], ["oin", "oin", "ouin"], ["ian", "ian", "iant"],
    ["eu", "eu,oeu", "euh"], ["k", "k,qu", "keu"], ["gn", "gn", "gneu"], ["ph", "ph", "feu"], ["gj", "ge,gi", "jeu"], ["cs", "ce,ci", "seu"],
    ["es", "es,el,ec", "est"], ["elle", "elle,ette", "elle"], ["ill", "ill", "ille"], ["y", "y,ii", "i"], ["ti", "ti", "scie"], ["w", "w", "ouais"],
    ["x", "x", "ksse"], ["un", "un,yn", "un"]
  ];
  var LISTEN_SKIP = { h: 1, sz: 1 };   /* « h » est muet, « s qui se lit z » ne se reconnaît pas à l’oreille seule */

  /* ---------- Écouter : syllabes, à partir de la première consonne ---------- */
  /* Voyelles simples : écrit → texte dit après la consonne (« lai » se prononce comme « lè ») */
  var SYL_VOWELS = { a: "a", e: "e", i: "i", o: "o", u: "u", "é": "é", "è": "ai" };
  var SYL_E_WORDS = { l: 1, m: 1, n: 1, s: 1, t: 1, d: 1, j: 1 };   /* « le, me, ne… » sont des mots : la voix les lit bien */
  /* Sons-consonnes : [graphie, ce que la voix dit, voyelles permises] (c et g restent durs : seulement a et o) */
  var LISTEN_SYL_CONS = {
    l: [["l", "l"]], f: [["f", "f"]], ch: [["ch", "ch"]], s: [["s", "s"]], m: [["m", "m"]], r: [["r", "r"]], n: [["n", "n"]], v: [["v", "v"]],
    j: [["j", "j"]], z: [["z", "z"]], p: [["p", "p"]], t: [["t", "t"]], b: [["b", "b"]], d: [["d", "d"]],
    c: [["c", "k", "a o"]], g: [["g", "g", "a o"]], k: [["k", "k", "a i o u é"]], gn: [["gn", "gn", "a e i o"]], ph: [["ph", "f"]],
    fr: [["fr", "fr"], ["pr", "pr"]], fl: [["fl", "fl"], ["pl", "pl"]]
  };
  /* Sons-voyelles arrivant après les consonnes : [graphie, ce que la voix dit après la consonne] */
  var LISTEN_SYL_VOW = {
    ou: [["ou", "ou"]], au: [["au", "o"], ["eau", "o"]], on: [["on", "on"]], oi: [["oi", "oi"]], an: [["an", "an"]], en: [["en", "an"]],
    ai: [["ai", "ai"], ["ei", "ai"]], in: [["in", "in"]], ain: [["ain", "in"]], oin: [["oin", "oin"]], eu: [["eu", "eu"]], un: [["un", "un"]]
  };
  var SYL_NO_INVERSE = { fr: 1, pr: 1, fl: 1, pl: 1, gn: 1, ph: 1, j: 1, ch: 1 };
  function sylConsAll() { var out = []; Object.keys(LISTEN_SYL_CONS).forEach(function (id) { LISTEN_SYL_CONS[id].forEach(function (e) { out.push({ id: id, g: e[0], say: e[1], vow: e[2] ? e[2].split(" ") : null }); }); }); return out; }
  function sylConsByG(g) { return sylConsAll().filter(function (c) { return c.g === g; })[0] || null; }
  /* c et g restent durs : devant e, i, é, è, ei, eau, in, eu… ils changeraient de son */
  function sylOK(cg, v) {
    var c = sylConsByG(cg);
    if (!c) return false;
    if (c.vow) return SYL_VOWELS[v] !== undefined ? c.vow.indexOf(v) >= 0 : (cg !== "c" && cg !== "g") || /^[aou]/.test(v);
    return true;
  }
  function sylVowSay(v) {
    if (SYL_VOWELS[v] !== undefined) return SYL_VOWELS[v];
    var out = null;
    Object.keys(LISTEN_SYL_VOW).forEach(function (id) { LISTEN_SYL_VOW[id].forEach(function (e) { if (e[0] === v) out = e[1]; }); });
    return out || v;
  }
  /* Textes que la voix lit mal (épelés, lus comme une abréviation ou en anglais), mesurés sur une voix française :
     on les remplace par un mot qui se prononce pareil */
  var SYL_SAY_FIX = { lo: "l’eau", chu: "chue", "ché": "chez", /* « è » : « tai », « pai »… étaient épelés (« té, a, i ») par la voix du téléphone → vrais mots qui se disent pareil */ tai: "taie", pai: "paie", bai: "baie", lai: "lait", fai: "fait", sai: "sais", vai: "vais", nai: "nais", jai: "jais", rai: "raie", dai: "dais", kai: "quai", zi: "zie", za: "zat", zo: "zot", vo: "vos", ba: "bas", jon: "jont", rain: "rin", zain: "zin", jain: "geint" };
  function sylSay(cg, v) {
    var c = sylConsByG(cg), cs = c ? c.say : cg;
    if (v === "e") return SYL_E_WORDS[cg] ? cg + "e" : cs + "eu";
    var vs = sylVowSay(v);
    if (vs === "an") vs = cs === "k" ? "an" : "ant";             /* « fan », « man », « van » étaient lus en anglais */
    else if (vs === "in" || vs === "un") vs = "ain";             /* « min » était lu « minute », « fun » en anglais */
    var t = cs + vs;
    return SYL_SAY_FIX[t] || t;
  }

  /* Mots courants qui contiennent le son (la voix les dit, l’élève retrouve leur écriture parmi des pseudo-mots) */
  var LISTEN_WORDS = {
    r: ["rame", "rire", "lire", "mare", "riche", "rafale"], n: ["lune", "fine", "mine", "narine", "farine", "menu"],
    v: ["vélo", "vache", "lave", "navire", "olive", "valise"], j: ["joli", "jus", "juge", "jour", "jamais", "jupe"],
    z: ["zéro", "zébu", "zoo", "lézard", "zèbre", "bizou"], p: ["papa", "pomme", "pile", "purée", "pirate", "lapin"],
    t: ["tomate", "tortue", "tête", "tapis", "patate", "moto"], c: ["café", "cube", "carotte", "canard", "école", "coco"],
    b: ["bébé", "banane", "robe", "bulle", "bateau", "cabane"], d: ["dodo", "dame", "malade", "radis", "salade", "domino"],
    g: ["gare", "gomme", "légume", "figure", "garage", "gâteau"], ou: ["loup", "roue", "poule", "mouche", "soupe", "bouche"],
    au: ["auto", "sauce", "chaud", "taupe", "bateau", "château"], on: ["mouton", "bonbon", "ballon", "savon", "melon", "pont"],
    oi: ["roi", "moi", "toit", "poisson", "étoile", "voiture"], an: ["maman", "ruban", "orange", "tante", "pantalon", "chanter"],
    en: ["dent", "vent", "tente", "enfant", "menton", "serpent"], ai: ["lait", "maison", "balai", "fraise", "reine", "neige"],
    er: ["rocher", "panier", "dîner", "chanter", "danser", "goûter"], fr: ["frite", "fraise", "fromage", "prune", "prince", "prêt"],
    fl: ["fleur", "flûte", "flamme", "plume", "pluie", "planète"], in: ["lapin", "sapin", "matin", "jardin", "dindon", "timbre"],
    ain: ["pain", "main", "bain", "train", "peinture", "plein"], oin: ["loin", "coin", "point", "moins", "foin", "pointu"],
    ian: ["viande", "triangle", "riant", "pliant", "étudiant", "friand"], eu: ["feu", "jeu", "bleu", "cheveu", "neveu", "nœud"],
    k: ["kiwi", "koala", "kayak", "quatre", "bouquet", "kilo"], gn: ["ligne", "vigne", "montagne", "peigne", "agneau", "cygne"],
    ph: ["phare", "photo", "dauphin", "éléphant", "phoque", "alphabet"], gj: ["girafe", "genou", "page", "bougie", "manège", "gilet"],
    cs: ["cerise", "citron", "glace", "ciel", "police", "racine"], es: ["veste", "bec", "sel", "merci", "escalier", "perle"],
    elle: ["vaisselle", "échelle", "chaussette", "baguette", "poubelle", "lunette"], ill: ["fille", "bille", "feuille", "papillon", "grenouille", "maillot"],
    y: ["pyjama", "stylo", "cycliste", "bicyclette", "rugby", "gymnase"], ti: ["potion", "addition", "natation", "récréation", "opération", "émotion"],
    w: ["kiwi", "wapiti", "sandwich", "western", "tramway"], x: ["taxi", "boxe", "saxo", "texte", "luxe", "index"],
    un: ["lundi", "brun", "parfum", "chacun", "aucun", "emprunt"]
  };

  /* Liste « automatique » d'un son : { syl : syllabes (ou sons seuls s'il n'y a pas de syllabes), words : mots }.
     order = identifiants des sons dans l'ordre de l'enseignant (pour un son-voyelle, les consonnes viennent des sons placés avant lui) ;
     label = étiquette du son (pour un son ajouté par l'enseignant, les graphèmes sont déduits de l'étiquette) */
  function exoAuto(soundId, order, label) {
    var syl = [];
    if (LISTEN_SYL_CONS[soundId]) {
      LISTEN_SYL_CONS[soundId].forEach(function (e) {
        Object.keys(SYL_VOWELS).forEach(function (v) { if (sylOK(e[0], v)) syl.push(e[0] + v); });
      });
    } else if (LISTEN_SYL_VOW[soundId]) {
      var known = [], ids = order || [], idx = ids.indexOf(soundId);
      ids.forEach(function (id, k) {
        if (idx >= 0 && k > idx) return;
        (LISTEN_SYL_CONS[id] || []).forEach(function (e) { if (known.indexOf(e[0]) < 0) known.push(e[0]); });
      });
      LISTEN_SYL_VOW[soundId].forEach(function (e) {
        known.forEach(function (cg) { if (sylOK(cg, e[0]) && syl.length < 40) syl.push(cg + e[0]); });
      });
    }
    if (!syl.length) {
      LISTEN_ITEMS.forEach(function (r) { if (r[0] === soundId) syl.push(r[1].split(",")[0]); });
    }
    if (!syl.length && label) {
      String(label).split(",").forEach(function (x) { x = x.replace(/…/g, "").trim(); if (x && x.indexOf(" ") < 0) syl.push(x); });
    }
    return { syl: syl, words: (LISTEN_WORDS[soundId] || []).slice() };
  }

  window.ZooExo = {
    LISTEN_ITEMS: LISTEN_ITEMS, LISTEN_SKIP: LISTEN_SKIP, SYL_VOWELS: SYL_VOWELS, SYL_E_WORDS: SYL_E_WORDS, LISTEN_SYL_CONS: LISTEN_SYL_CONS,
    LISTEN_SYL_VOW: LISTEN_SYL_VOW, SYL_NO_INVERSE: SYL_NO_INVERSE, SYL_SAY_FIX: SYL_SAY_FIX, LISTEN_WORDS: LISTEN_WORDS,
    sylConsAll: sylConsAll, sylConsByG: sylConsByG, sylOK: sylOK, sylVowSay: sylVowSay, sylSay: sylSay, exoAuto: exoAuto
  };
})();
