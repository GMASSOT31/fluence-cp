/* Corpus illustrés. Les intitulés servent à la voix et à l’apprentissage, jamais aux réponses visibles du test. */
(function (root) {
  "use strict";
  var school = [
    [
      ["une trousse", "✏️👝"], ["un tableau", "🟩🖍️"], ["un stylo", "🖊️"], ["une gomme", "▰", "eraser"], ["un carnet", "📒"], ["un cahier", "📓"],
      ["un taille-crayon", "✏️🔧"], ["une règle", "📏"], ["un feutre", "🖍️"], ["un crayon à papier", "✏️"], ["une craie", "▱", "chalk"], ["un dictionnaire", "📘🔤"],
      ["une ardoise", "▣", "slate"], ["un bureau", "🗄️🪑"], ["un livre", "📕"], ["un album", "📖🖼️"], ["une chaise", "🪑"], ["un journal", "📰"]
    ],
    [
      ["un pinceau", "🖌️"], ["une bibliothèque", "📚"], ["un crayon de couleur", "✏️", "color-pencil"], ["une paire de ciseaux", "✂️"], ["une élève", "👧📓"], ["une maîtresse", "👩‍🏫"],
      ["point", "●", "punctuation"], ["texte", "▤", "paper"], ["exemple", "💡📝"], ["phrase", "▔▔▔ ●", "paper"], ["nom et prénom", "👤✍️"], ["virgule", ",", "punctuation"],
      ["taillé", "✏️✨"], ["sablier", "⌛"], ["lecture", "🧒📖"], ["chorale", "👧🎶👦"], ["case", "▦", "paper"], ["brouillon", "📝〰"]
    ],
    [
      ["interrogation", "?", "punctuation"], ["exclamation", "!", "punctuation"], ["correction", "📋✅"], ["dictée", "🗣️✍️"], ["exercice", "📝"], ["chuchoter", "🤫👂"],
      ["souligner", "▁", "paper"], ["signer", "📄✍️"], ["gommer", "▰💨", "eraser"], ["relier", "●╱●", "paper"], ["entourer", "◉", "paper"], ["copier", "📄➜📄"],
      ["barrer", "╳", "paper"], ["corriger", "✎✓", "paper"], ["cocher", "☑", "paper"], ["mémoriser", "🧠💭"]
    ]
  ];
  var catalog = school.map(function (words, i) {
    return { id: "ecole" + (i + 1), title: "École " + (i + 1), words: words };
  });
  function get(id) {
    return catalog.filter(function (book) { return book.id === id; })[0] || null;
  }
  function blocks(book) {
    var result = [];
    for (var i = 0; i < book.words.length; i += 6) {
      var current = book.words.slice(i, i + 6);
      if (current.length < 6 && i > 0) current = current.concat(book.words.slice(i - (6 - current.length), i));
      result.push(current);
    }
    return result;
  }
  root.ZooVocabulary = { catalog: catalog, get: get, blocks: blocks };
})(typeof window === "undefined" ? module.exports : window);
