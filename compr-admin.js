/* Réglage réservé à l’administrateur. Les images sont converties en JPEG avant envoi. */
(function () {
  "use strict";
  var bucket = "comprehension-zoo";
  var limit = 16;

  function element(tag, text) {
    var node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(label) {
    var node = element("button", label);
    node.type = "button";
    node.className = "secondary";
    return node;
  }
  function jpeg(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type) || file.size > 12000000) {
        reject(new Error("Choisissez une image JPG, PNG, WebP, GIF ou AVIF de 12 Mo maximum."));
        return;
      }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Cette image n’a pas pu être ouverte."));
      };
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          var canvas = element("canvas"), scale = Math.min(1, 640 / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            if (blob && blob.size <= 500000) resolve(blob);
            else reject(new Error("Cette image n’a pas pu être convertie."));
          }, "image/jpeg", 0.85);
        } catch (error) { reject(error); }
      };
      img.src = url;
    });
  }

  function open(client, host, sounds, userId) {
    if (!host || host.dataset.editorUser === userId) return;
    host.dataset.editorUser = userId;
    host.textContent = "Chargement des exercices…";
    client.rpc("get_comprehension_exercises").then(function (result) {
      if (host.dataset.editorUser !== userId) return;
      if (result.error) throw result.error;
      render(client, host, sounds, result.data || {});
    }).catch(function () {
      if (host.dataset.editorUser !== userId) return;
      host.textContent = "Les exercices n’ont pas pu être chargés. ";
      var retry = button("Réessayer");
      retry.onclick = function () { delete host.dataset.editorUser; open(client, host, sounds, userId); };
      host.appendChild(retry);
    });
  }

  function render(client, host, sounds, saved) {
    host.textContent = "";
    var files = client.storage.from(bucket), drafts = Object.create(null);
    var label = element("label", "Son à compléter");
    var select = element("select");
    select.id = "comprEditSound";
    label.htmlFor = select.id;
    sounds.forEach(function (sound) {
      var option = element("option", sound.label);
      option.value = sound.id; select.appendChild(option);
    });
    var rows = element("div"), guide = element("p"), add = button("Ajouter un mot"), save = button("Enregistrer ce son");
    save.className = "primary";
    var status = element("p"); status.setAttribute("role", "status");
    [label, select, guide, rows, add, save, status].forEach(function (node) { host.appendChild(node); });

    function draft(id) {
      if (!drafts[id]) drafts[id] = (saved[id] || []).map(function (row) { return { word: row.word, path: row.path }; });
      return drafts[id];
    }
    function paint() {
      rows.textContent = "";
      var id = select.value, entries = draft(id);
      var automatic = ZooExo.comprWords(id, sounds.map(function (s) { return s.id; })).own;
      guide.textContent = automatic.length ? "Mots déjà illustrés par le Zoo : " + automatic.join(", ") + "." : "Le Zoo n’a pas encore de mot illustré pour ce son.";
      entries.forEach(function (entry, index) {
        var row = element("div"); row.className = "compr-edit-row";
        var word = element("input");
        word.type = "text"; word.maxLength = 40; word.value = entry.word;
        word.placeholder = "Mot à comprendre";
        word.setAttribute("aria-label", "Mot " + (index + 1));
        word.oninput = function () { entry.word = word.value; };
        var pick = element("input");
        pick.type = "file"; pick.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
        pick.setAttribute("aria-label", "Image du mot " + (index + 1));
        function attach(file) {
          if (!file || select.disabled) return;
          entry.file = file;
          delete entry.pendingPath;
          if (entry.preview) URL.revokeObjectURL(entry.preview);
          entry.preview = URL.createObjectURL(entry.file);
          paint();
        }
        pick.onchange = function () { attach(pick.files[0]); };
        row.ondragover = function (event) { event.preventDefault(); };
        row.ondrop = function (event) {
          event.preventDefault();
          attach(event.dataTransfer.files[0]);
        };
        var remove = button("Retirer");
        remove.setAttribute("aria-label", "Retirer le mot " + (index + 1));
        remove.onclick = function () {
          if (entry.preview) URL.revokeObjectURL(entry.preview);
          entries.splice(index, 1); paint();
        };
        row.appendChild(word);
        if (entry.preview || entry.path) {
          var img = element("img");
          img.alt = "Aperçu de l’image";
          img.src = entry.preview || files.getPublicUrl(entry.path).data.publicUrl;
          row.appendChild(img);
        }
        row.appendChild(pick);
        row.appendChild(remove);
        rows.appendChild(row);
      });
      add.disabled = entries.length >= limit;
    }

    select.onchange = function () { status.textContent = ""; paint(); };
    add.onclick = function () { draft(select.value).push({ word: "", path: null }); paint(); rows.lastChild.firstChild.focus(); };
    save.onclick = async function () {
      var id = select.value, entries = draft(id), words = new Set();
      var valid = entries.every(function (entry) {
        entry.word = entry.word.trim().normalize("NFC").toLocaleLowerCase("fr");
        if (!/^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[’'-][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/.test(entry.word)
            || words.has(entry.word) || !(entry.path || entry.file)) return false;
        words.add(entry.word);
        return true;
      });
      if (!valid) { status.textContent = "Vérifiez que chaque ligne contient un mot différent et une image."; return; }
      host.querySelectorAll("button, input, select").forEach(function (node) { node.disabled = true; });
      status.textContent = "Enregistrement…";
      try {
        var next = [];
        for (var entry of entries) {
          if (entry.file && !entry.pendingPath) {
            var blob = await jpeg(entry.file);
            var path = crypto.randomUUID() + ".jpg";
            var upload = await files.upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600" });
            if (upload.error) throw new Error("L’image de « " + entry.word + " » n’a pas pu être envoyée.");
            entry.pendingPath = path;
          }
          next.push({ word: entry.word, path: entry.pendingPath || entry.path });
        }
        var result = await client.rpc("admin_save_comprehension_exercise", { p_sound: id, p_entries: next, p_previous: saved[id] || [] });
        if (result.error) throw new Error(result.error.message || "Enregistrement impossible.");
        saved[id] = next;
        entries.forEach(function (entry) { if (entry.preview) URL.revokeObjectURL(entry.preview); });
        delete drafts[id];
        status.textContent = "Exercice enregistré.";
      } catch (error) { status.textContent = error.message || "Enregistrement impossible. Réessayez."; }
      finally {
        select.disabled = save.disabled = false;
        paint();
      }
    };
    paint();
  }
  window.ZooComprAdmin = { open: open };
})();
