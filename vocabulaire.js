/* Le catalogue est alimenté exclusivement par les imagiers importés. */
(function (root) {
  "use strict";
  var catalog = [];
  var api = { catalog: catalog, get: get, blocks: blocks, load: load, reviewHistory: reviewHistory, reviewDue: reviewDue };
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
  function reviewHistory(progress) {
    var entries = Object.create(null);
    if (!progress || typeof progress !== "object") return entries;
    Object.keys(progress.vocabReview || {}).forEach(function (id) {
      var entry = progress.vocabReview[id];
      if (/^[0-9a-f-]{36}$/.test(id) && entry && Number.isInteger(entry.count)
          && entry.count >= 1 && entry.count <= 4 && Number.isFinite(entry.last) && entry.last > 0) {
        entries[id] = { count: entry.count, last: entry.last };
      }
    });
    var seen = Object.create(null);
    if (Array.isArray(progress.hist)) progress.hist.forEach(function (item) {
      if (!item || item.type !== "vocabulaire" || !/^[0-9a-f-]{36}$/.test(item.corpus) ||
          entries[item.corpus] || !Number.isFinite(item.ok) || item.ok <= 0) return;
      var dates = seen[item.corpus] || (seen[item.corpus] = []);
      if (dates.indexOf(item.ok) < 0) dates.push(item.ok);
    });
    Object.keys(seen).forEach(function (id) {
      entries[id] = { count: Math.min(4, seen[id].length), last: Math.max.apply(null, seen[id]) };
    });
    return entries;
  }
  function reviewDue(entry) {
    if (!entry || entry.count >= 4) return null;
    var due = new Date(entry.last);
    due.setHours(0, 0, 0, 0);
    if (entry.count === 1 || entry.count === 2) due.setDate(due.getDate() + (entry.count === 1 ? 4 : 8));
    else {
      var day = due.getDate();
      due.setDate(1); due.setMonth(due.getMonth() + 1);
      var lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
      due.setDate(Math.min(day, lastDay));
    }
    return due.getTime();
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
