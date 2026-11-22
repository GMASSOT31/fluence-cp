/* Format d’import : une carte par page A4 portrait, image dans le cadre et libellé dans le pied. */
(function (root) {
  "use strict";
  var loader;
  var pdfRoot = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  var prompt = [
    "À partir des planches d’imagier jointes, produis un fichier PDF par corpus. Utilise uniquement les illustrations fournies : découpe-les depuis les planches. N’invente, ne redessine, ne remplace et ne retouche aucune illustration.",
    "Crée une page A4 portrait par illustration (210 × 297 mm), sans couverture. Garde l’ordre indiqué. Fond blanc, sans titre, bordure ni numéro.",
    "Place uniquement l’illustration, sans son libellé d’origine, au centre du rectangle compris entre 10 % et 90 % de la largeur, et entre 10 % et 72 % de la hauteur depuis le haut. Respecte ses proportions.",
    "Sous le cadre, entre 80 % et 91 % de la hauteur depuis le haut, écris une seule fois son nom fidèle à la planche, en texte PDF sélectionnable sur une ligne. Garde les accents et les articles. Aucun autre texte dans la page. Si un nom ou une image est illisible, signale-le avant de produire le PDF.",
    "Ne livre le PDF qu’après avoir vérifié qu’il contient une illustration d’origine par page et qu’aucun nom ne manque."
  ].join("\n\n");
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
      var pdf = await task.promise, cards = [];
      if (pdf.numPages < 6 || pdf.numPages > 60) throw new Error("Le PDF doit contenir de 6 à 60 pages.");
      for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i), size = page.getViewport({ scale: 1 });
        if (Math.abs(size.width / size.height - 210 / 297) > 0.012) throw new Error("Page " + i + " : utilisez le format A4 portrait.");
        var viewport = page.getViewport({ scale: 500 / size.width });
        var text = await page.getTextContent();
        var label = text.items.filter(function (item) {
          if (!item.str || !item.transform) return false;
          var y = size.convertToViewportPoint(item.transform[4], item.transform[5])[1] / size.height;
          return y >= 0.78 && y <= 0.93;
        }).map(function (item) { return item.str; }).join(" ").trim();
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
      return cards;
    } finally { await task.destroy(); }
  }
  root.ZooVocabularyImport = { prompt: prompt, extract: extract };
})(window);
