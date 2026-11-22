/* Format d’import : une carte par page A4 portrait, image dans le cadre et libellé dans le pied. */
(function (root) {
  "use strict";
  var loader;
  var pdfRoot = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  var prompt = [
    "À partir des planches jointes, produis UN SEUL PDF par thème, même si le Zoo doit créer plusieurs corpus. Utilise exclusivement les illustrations d’origine : découpe-les dans les planches, sans les inventer, les redessiner, les remplacer ni les retoucher. Garde l’ordre et les libellés d’origine.",
    "Compte les N cartes. Le Zoo créera C = N divisé par 18, arrondi à l’entier supérieur. Un corpus contient entre 6 et 18 mots. Si le dernier groupe compterait moins de 6 cartes, le Zoo le complétera en déplaçant les dernières cartes du groupe précédent, sans dupliquer de cartes. Exemples : 18 → 1 corpus, 36 → 2, 54 → 3. Avec 52 cartes d’École, le Zoo créera École 1, École 2 et École 3 (18, 18 et 16 cartes).",
    "Crée une page A4 portrait par illustration (210 × 297 mm), sans couverture ni séparateur. Sur la première page uniquement, entre 2 % et 8 % de la hauteur depuis le haut, écris cette ligne en texte PDF sélectionnable : « IMAGIER : NOM | MOTS : N | CORPUS : C ». Remplace NOM par le titre du thème sans numéro, N par le nombre total de cartes et C par le nombre de corpus.",
    "Sur chaque page, fond blanc, place l’image seule entre 10 % et 90 % de la largeur et entre 10 % et 72 % de la hauteur depuis le haut. Respecte ses proportions. Entre 80 % et 91 % de la hauteur, écris le libellé en texte PDF sélectionnable sur une ligne. Garde les accents et les articles. N’ajoute ni numéro de page, ni autre texte.",
    "Vérifie que les N pages contiennent exactement les N illustrations d’origine et que C est correct. Signale toute illustration ou tout libellé illisible au lieu de le deviner. Livre le PDF unique."
  ].join("\n\n");
  function groupCards(cards) {
    var groups = [];
    for (var i = 0; i < cards.length; i += 18) groups.push(cards.slice(i, i + 18));
    var last = groups[groups.length - 1];
    if (last && last.length < 6 && groups.length > 1) {
      var previous = groups[groups.length - 2];
      groups[groups.length - 1] = previous.splice(previous.length - (6 - last.length)).concat(last);
    }
    return groups;
  }
  function library() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    if (!loader) loader = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = pdfRoot + "pdf.min.js";
      script.onload = function () {
        if (!root.pdfjsLib) { reject(new Error("Lecteur PDF indisponible.")); return; }
        root.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfRoot + "pdf.worker.min.js";
        resolve(root.pdfjsLib);
      };
      script.onerror = function () { reject(new Error("Impossible de charger le lecteur PDF.")); };
      document.head.appendChild(script);
    }).catch(function (error) { loader = null; throw error; });
    return loader;
  }
  async function extract(file, onPage) {
    if (!file || file.size > 25 * 1024 * 1024) throw new Error("Choisissez un PDF de moins de 25 Mo.");
    var pdfjs = await library();
    var task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
    try {
      var pdf = await task.promise, cards = [], name = "";
      if (pdf.numPages < 6) throw new Error("Le PDF doit contenir au moins six cartes, une par page.");
      for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i), size = page.getViewport({ scale: 1 });
        if (Math.abs(size.width / size.height - 210 / 297) > 0.012) throw new Error("Page " + i + " : utilisez le format A4 portrait.");
        var viewport = page.getViewport({ scale: 500 / size.width });
        var text = await page.getTextContent();
        function textBetween(top, bottom) {
          return text.items.filter(function (item) {
            if (!item.str || !item.transform) return false;
            var y = size.convertToViewportPoint(item.transform[4], item.transform[5])[1] / size.height;
            return y >= top && y <= bottom;
          }).map(function (item) { return item.str; }).join(" ").trim();
        }
        if (i === 1) {
          var header = textBetween(0.01, 0.09);
          var manifest = /^IMAGIER\s*:\s*(.+?)\s*\|\s*MOTS\s*:\s*(\d+)\s*\|\s*CORPUS\s*:\s*(\d+)\s*$/i.exec(header);
          var legacy = /\|\s*MOTS\s*:\s*(\d+)\s*$/i.exec(header);
          if (/^IMAGIER\s*:/i.test(header) && !manifest) {
            throw new Error("Format attendu : « IMAGIER : NOM | MOTS : N | CORPUS : C ».");
          }
          var declaredCards = manifest ? Number(manifest[2]) : legacy ? Number(legacy[1]) : null;
          if (declaredCards !== null && declaredCards !== pdf.numPages) {
            throw new Error("L’en-tête annonce " + declaredCards + " mots, mais le PDF contient " + pdf.numPages + " pages.");
          }
          if (manifest) {
            var actualGroups = Math.ceil(pdf.numPages / 18);
            if (Number(manifest[3]) !== actualGroups) {
              throw new Error("L’en-tête annonce " + manifest[3] + " corpus. Pour " + pdf.numPages + " mots, indiquez " + actualGroups + " corpus.");
            }
            name = manifest[1].trim();
          }
        }
        var label = textBetween(0.78, 0.93);
        var canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
        var crop = document.createElement("canvas");
        crop.width = 400; crop.height = Math.round(viewport.height * 0.62);
        crop.getContext("2d").drawImage(canvas, viewport.width * 0.1, viewport.height * 0.1, crop.width, crop.height, 0, 0, crop.width, crop.height);
        var blob = await new Promise(function (resolve) { crop.toBlob(resolve, "image/jpeg", 0.85); });
        if (!blob || blob.size > 300000) throw new Error("Image trop lourde à la page " + i + ".");
        cards.push({ label: label, blob: blob });
        page.cleanup();
        onPage(i, pdf.numPages);
      }
      return { name: name, groups: groupCards(cards) };
    } finally { await task.destroy(); }
  }
  root.ZooVocabularyImport = { prompt: prompt, extract: extract, groupCards: groupCards };
})(window);
