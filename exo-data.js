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

  /*MOTS-DEBUT*/
  /* ---------- Mots de la dictée et de l'écoute ----------
     Chaque mot est donné DÉCOMPOSÉ en graphèmes (« j-o-l-i », « r-ou-e ») ; GRAPH_SOUND dit quel son enseigne chaque graphème.
     Un mot n'est proposé pour un son que si TOUS ses graphèmes sont enseignés au plus tard par ce son, dans l'ordre de l'enseignant
     (wordsFor). Généré par tools/exo_mots.py : ne pas modifier à la main, ajouter les mots dans ce script. */
  var GRAPH_SOUND = { "a": "voy", "e": "voy", "i": "voy", "o": "voy", "u": "voy", "y": "voy", "è": "voy2", "é": "voy2", "l": "l", "f": "f", "ch": "ch", "s": "s", "m": "m", "r": "r", "n": "n", "v": "v", "j": "j", "z": "z", "p": "p", "t": "t", "c": "c", "b": "b", "d": "d", "g": "g", "ou": "ou", "au": "au", "eau": "au", "h": "h", "om": "on", "on": "on", "oi": "oi", "am": "an", "an": "an", "em": "en", "en": "en", "ai": "ai", "ei": "ai", "et": "ai", "ê": "ai", "er": "er", "es/e": "er", "ez": "er", "br": "fr", "cr": "fr", "dr": "fr", "fr": "fr", "gr": "fr", "pr": "fr", "tr": "fr", "vr": "fr", "bl": "fl", "cl": "fl", "fl": "fl", "gl": "fl", "pl": "fl", "im": "in", "in": "in", "ain": "ain", "ein": "ain", "oin": "oin", "ian": "ian", "ien": "ian", "ieu": "ian", "ion": "ian", "eu": "eu", "œu": "eu", "k": "k", "qu": "k", "gn": "gn", "ph": "ph", "ge": "gj", "gi": "gj", "gy": "gj", "ce": "cs", "ci": "cs", "cy": "cs", "ec": "es", "el": "es", "er/c": "es", "es": "es", "bb": "elle", "cc": "elle", "dd": "elle", "elle": "elle", "ette": "elle", "ff": "elle", "gg": "elle", "ll": "elle", "mm": "elle", "nn": "elle", "pp": "elle", "rr": "elle", "ss": "elle", "tt": "elle", "zz": "elle", "s/z": "sz", "ill": "ill", "ii": "y", "y/j": "y", "ti": "ti", "w": "w", "x": "x", "un": "un", "yn": "un" };
  var WORD_POOL = [
    "r-a-m-e", "r-i-r-e", "l-i-r-e", "m-a-r-e", "r-i-ch-e", "r-a-f-a-l-e", "r-u-e", "r-u-ch-e",
    "r-i-m-e", "r-a-r-e", "m-u-r", "s-u-r", "l-u-n-e", "f-i-n-e", "m-i-n-e", "n-a-r-i-n-e",
    "f-a-r-i-n-e", "m-e-n-u", "u-n-e", "r-u-n-e", "n-u-l", "m-i-n-i", "f-a-n-é", "v-é-l-o",
    "v-a-ch-e", "l-a-v-e", "n-a-v-i-r-e", "o-l-i-v-e", "r-i-v-e", "v-i-f", "r-a-v-i", "s-a-l-i-v-e",
    "v-e-n-u", "f-è-v-e", "a-v-a-l-e", "j-o-l-i", "j-o-l-i-e", "j-u-r-e", "j-u-r-é", "j-e",
    "z-é-r-o", "z-o-o", "z-è-l-e", "a-z-u-r", "z-o-n-e", "z-o-z-o", "p-a-p-a", "p-i-l-e",
    "p-u-r-é-e", "p-i-p-e", "p-u-r", "p-e-l-u-r-e", "é-p-i", "é-p-é-e", "p-a-r-i", "p-a-p-i",
    "p-i-p-i", "p-u-m-a", "o-p-é-r-a", "p-y-j-a-m-a", "t-o-m-a-t-e", "t-o-r-t-u-e", "p-a-t-a-t-e", "m-o-t-o",
    "t-u", "t-é-l-é", "t-a-r-t-e", "v-i-t-e", "m-i-t-e", "t-u-l-i-p-e", "m-i-n-u-t-e", "s-t-y-l-o",
    "c-a-f-é", "é-c-o-l-e", "c-o-c-o", "c-a-m-é-r-a", "c-a-r-a-f-e", "c-u-r-e", "c-o-l-a", "c-a-l-m-e",
    "c-a-v-a-l-e", "b-é-b-é", "r-o-b-e", "b-o-b-o", "t-u-b-a", "c-u-b-e", "b-o-l", "b-a-r",
    "d-o-d-o", "d-a-m-e", "m-a-l-a-d-e", "s-a-l-a-d-e", "d-o-m-i-n-o", "d-é", "d-u-r", "i-d-é-e",
    "d-a-t-e", "r-a-d-a-r", "r-i-d-e", "d-u-n-e", "g-a-r-e", "l-é-g-u-m-e", "f-i-g-u-r-e", "g-a-l-a",
    "g-a-r-d-e", "r-e-g-a-r-d-e", "g-a-l-è-r-e", "r-ou-e", "p-ou-l-e", "m-ou-ch-e", "s-ou-p-e", "b-ou-ch-e",
    "c-ou", "f-ou", "s-ou", "m-ou", "f-ou-r", "j-ou-r", "b-i-j-ou", "l-ou-p-e",
    "b-ou-l-e", "f-ou-l-e", "j-ou-e", "r-ou-t-e", "au-t-o", "t-au-p-e", "b-a-t-eau", "g-au-ch-e",
    "j-au-n-e", "c-a-d-eau", "v-eau", "s-eau", "p-eau", "b-eau", "f-au-v-e", "é-p-au-l-e",
    "h-a-ch-e", "h-i-b-ou", "h-a-b-i-l-e", "h-u-r-l-e", "m-ou-t-on", "b-on-b-on", "s-a-v-on", "m-e-l-on",
    "s-a-l-on", "b-on", "s-on", "t-on", "n-on", "m-on", "p-ou-m-on", "ch-a-t-on",
    "r-a-t-on", "r-oi", "m-oi", "é-t-oi-l-e", "v-oi-t-u-r-e", "l-oi", "f-oi", "p-oi-r-e",
    "m-oi-n-e", "n-oi-r", "s-oi-r", "v-oi-r", "p-oi-l", "v-oi-l-e", "t-oi-l-e", "b-oi-r-e",
    "m-a-m-an", "r-u-b-an", "t-an-t-e", "p-an-t-a-l-on", "l-am-p-e", "j-am-b-e", "d-an-s-e", "ch-an-s-on",
    "t-am-b-ou-r", "m-an-t-e", "r-am-p-e", "t-en-t-e", "m-en-t-on", "l-en-t-e", "r-en-t-e", "v-en-t-e",
    "en-c-o-r-e", "em-p-o-r-t-e", "s-en-t-i-r", "m-en-t-i-r", "p-en-t-e", "b-a-l-ai", "r-ei-n-e", "p-ai-r-e",
    "ai-l-e", "f-ai-r-e", "ai-r", "m-ai-r-e", "t-ê-t-e", "f-ê-t-e", "p-ê-ch-e", "m-ê-m-e",
    "r-ê-v-e", "n-a-v-et", "j-ou-et", "f-i-l-et", "p-ou-l-et", "v-o-l-et", "r-o-b-i-n-et", "s-u-j-et",
    "r-o-ch-er", "p-a-n-i-er", "ch-an-t-er", "d-an-s-er", "ch-ez", "n-ez", "j-ou-er", "ai-m-er",
    "p-o-r-t-er", "s-au-t-er", "l-a-v-er", "m-on-t-er", "m-a-r-ch-er", "c-a-h-i-er", "t-om-b-er", "r-e-g-a-r-d-er",
    "fr-i-t-e", "fr-i-r-e", "pr-u-n-e", "cr-a-b-e", "tr-ou", "vr-ai", "l-i-vr-e", "a-r-br-e",
    "br-a-v-o", "cr-a-v-a-t-e", "t-i-gr-e", "c-a-dr-e", "p-au-vr-e", "om-br-e", "s-u-cr-e", "pl-u-m-e",
    "pl-a-n-è-t-e", "t-a-bl-e", "cl-é", "fl-è-ch-e", "pl-i", "pl-an", "bl-é", "cl-ou",
    "pl-an-t-e", "s-a-bl-e", "f-a-bl-e", "l-a-p-in", "s-a-p-in", "m-a-t-in", "j-a-r-d-in", "d-in-d-on",
    "t-im-br-e", "m-ou-l-in", "f-in", "v-in", "p-in", "b-am-b-in", "ch-e-m-in", "p-ain",
    "m-ain", "b-ain", "tr-ain", "p-ein-t-u-r-e", "pl-ein", "c-o-p-ain", "d-e-m-ain", "n-ain",
    "gr-ain", "fr-ein", "s-ain", "v-i-l-ain", "l-oin", "c-oin", "f-oin", "p-oin-t-u",
    "t-é-m-oin", "l-oin-t-ain", "v-ian-d-e", "tr-ian-gl-e", "ch-ien", "l-ien", "b-ien", "r-ien",
    "l-ion", "a-v-ion", "p-ion", "f-eu", "j-eu", "bl-eu", "ch-e-v-eu", "n-e-v-eu",
    "p-eu", "p-eu-r", "fl-eu-r", "h-eu-r-e", "c-œu-r", "s-œu-r", "j-eu-n-e", "v-o-l-eu-r",
    "ch-an-t-eu-r", "fl-eu-v-e", "k-i-l-o", "k-i-m-o-n-o", "k-a-r-a-t-é", "qu-a-tr-e", "b-ou-qu-et", "m-a-s-qu-e",
    "b-an-qu-e", "d-i-s-qu-e", "m-a-r-qu-e", "c-a-s-qu-e", "l-i-gn-e", "v-i-gn-e", "m-on-t-a-gn-e", "p-ei-gn-e",
    "a-gn-eau", "s-i-gn-e", "g-a-gn-er", "c-am-p-a-gn-e", "ch-am-p-i-gn-on", "ph-a-r-e", "ph-o-t-o", "d-au-ph-in",
    "ph-o-qu-e", "a-l-ph-a-b-et", "t-é-l-é-ph-o-n-e", "o-r-ph-e-l-in", "gi-r-a-f-e", "ge-n-ou", "p-a-ge", "b-ou-gi-e",
    "m-a-n-è-ge", "gi-l-et", "i-m-a-ge", "o-r-a-ge", "n-u-a-ge", "pl-a-ge", "r-ou-ge", "c-a-ge",
    "m-a-gi-e", "fr-o-m-a-ge", "g-a-r-a-ge", "m-é-l-an-ge", "p-i-ge-on", "ci-tr-on", "gl-a-ce", "p-o-l-i-ce",
    "r-a-ci-n-e", "ci-n-é-m-a", "ci-r-qu-e", "ci-g-a-r-e", "f-a-ce", "pl-a-ce", "f-a-r-ce", "cy-cl-i-s-t-e",
    "v-es-t-e", "b-ec", "s-el", "m-er/c-ci", "es-c-a-l-i-er", "p-er/c-l-e", "m-er/c", "f-er/c",
    "v-er/c", "ci-el", "m-i-el", "s-ec", "a-v-ec", "r-es-t-e", "v-er/c-t-e", "v-ai-ss-elle",
    "é-ch-elle", "ch-au-ss-ette", "p-ou-b-elle", "l-u-n-ette", "b-elle", "p-o-mm-e", "g-o-mm-e", "c-a-r-o-tt-e",
    "b-u-ll-e", "b-a-ll-on", "s-a-ll-e", "b-a-ll-e", "p-a-ss-e", "ch-a-tt-e", "c-a-ss-ette", "a-ll-u-m-ette",
    "o-m-e-l-ette", "b-i-cy-cl-ette", "r-o-s/z-e", "v-a-s/z-e", "m-ai-s/z-on", "ch-ai-s/z-e", "ce-r-i-s/z-e", "v-a-l-i-s/z-e",
    "oi-s/z-eau", "fr-ai-s/z-e", "p-oi-s/z-on", "u-s/z-i-n-e", "v-i-s/z-a-ge", "m-u-s/z-i-qu-e", "r-ai-s/z-in", "b-i-s/z-e",
    "é-gl-i-s/z-e", "f-ill-e", "b-ill-e", "f-eu-ill-e", "p-a-p-ill-on", "gr-e-n-ou-ill-e", "f-a-m-ill-e", "c-o-qu-ill-e",
    "ch-e-n-ill-e", "a-b-e-ill-e", "b-ou-t-e-ill-e", "v-a-n-ill-e", "p-a-ill-e", "m-é-d-a-ill-e", "y/j-o-y/j-o", "y/j-o-g-a",
    "cr-a-y/j-on", "p-o-ti-on", "a-dd-i-ti-on", "n-a-t-a-ti-on", "r-é-cr-é-a-ti-on", "o-p-é-r-a-ti-on", "é-m-o-ti-on", "k-i-w-i",
    "w-a-p-i-t-i", "w-a-g-on", "w-i-f-i", "t-a-x-i", "b-o-x-e", "s-a-x-o", "l-u-x-e", "t-a-x-e",
    "m-i-x-er", "b-o-x-er", "m-a-x-i", "l-un-d-i", "br-un", "ch-a-c-un", "au-c-un", "un"
  ];
  /*MOTS-FIN*/

  /* Mots qu'un élève sait ÉCRIRE : tous leurs graphèmes sont enseignés par ce son ou par un son placé avant lui (ordre de l'enseignant),
     et ce son est le dernier qui manquait au mot. Les graphèmes dont le son n'est pas dans l'ordre rendent le mot inutilisable. */
  function wordsFor(soundId, order) {
    var ids = order && order.length ? order : DEFAULT_ORDER, pos = {}, out = [];
    ids.forEach(function (id, k) { if (!(id in pos)) pos[id] = k; });
    if (!(soundId in pos)) return out;
    WORD_POOL.forEach(function (w) {
      var gs = w.split("-"), last = -1, ok = true;
      gs.forEach(function (g) {
        var sd = GRAPH_SOUND[g], k = sd in pos ? pos[sd] : -1;
        if (sd === undefined || k < 0) ok = false; else if (k > last) last = k;
      });
      if (ok && last === pos[soundId]) out.push(gs.map(function (g) { return g.split("/")[0]; }).join(""));
    });
    return out;
  }
  /* Ordre de progression d'origine (pour les listes « par défaut ») */
  var DEFAULT_ORDER = ["voy", "voy2", "l", "f", "ch", "s", "m", "r", "n", "v", "j", "z", "p", "t", "c", "b", "d", "g", "ou", "au", "h", "on", "oi", "an", "en", "ai", "er",
    "fr", "fl", "in", "ain", "oin", "ian", "eu", "k", "gn", "ph", "gj", "cs", "es", "elle", "sz", "ill", "y", "ti", "w", "x", "un"];
  var LISTEN_WORDS = {};
  DEFAULT_ORDER.forEach(function (id) { var w = wordsFor(id, DEFAULT_ORDER); if (w.length) LISTEN_WORDS[id] = w; });

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
    return { syl: syl, words: wordsFor(soundId, order) };
  }

  window.ZooExo = {
    LISTEN_ITEMS: LISTEN_ITEMS, LISTEN_SKIP: LISTEN_SKIP, SYL_VOWELS: SYL_VOWELS, SYL_E_WORDS: SYL_E_WORDS, LISTEN_SYL_CONS: LISTEN_SYL_CONS,
    LISTEN_SYL_VOW: LISTEN_SYL_VOW, SYL_NO_INVERSE: SYL_NO_INVERSE, SYL_SAY_FIX: SYL_SAY_FIX, LISTEN_WORDS: LISTEN_WORDS,
    wordsFor: wordsFor, sylConsAll: sylConsAll, sylConsByG: sylConsByG, sylOK: sylOK, sylVowSay: sylVowSay, sylSay: sylSay, exoAuto: exoAuto
  };
})();
