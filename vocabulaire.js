/* Le catalogue est alimenté exclusivement par les imagiers importés. */
(function (root) {
  "use strict";
  var catalog = [];
  var api = { catalog: catalog, get: get, blocks: blocks, load: load };
  function get(id) { return catalog.filter(function (book) { return book.id === id; })[0] || null; }
  function blocks(book) {
    var result = [];
    for (var i = 0; i < book.words.length; i += 6) {
      var current = book.words.slice(i, i + 6);
      if (current.length < 6 && i > 0) current = current.concat(book.words.slice(i - (6 - current.length), i));
      result.push(current);
    }
    return result;
  }
  function load(rows, base) {
    catalog.length = 0;
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || !/^[0-9a-f-]{36}$/.test(row.id) || typeof row.title !== "string"
          || !Array.isArray(row.words) || row.words.length < 6 || !row.words.every(function (word) { return typeof word === "string"; })) return;
      catalog.push({ id: row.id, title: row.title, words: row.words.map(function (word, i) {
        return [word, base + "/storage/v1/object/public/vocabulaire-zoo/" + row.id + "/" + ("00" + (i + 1)).slice(-3) + ".jpg"];
      }) });
    });
  }
  root.ZooVocabulary = api;
})(typeof window === "undefined" ? module.exports : window);
