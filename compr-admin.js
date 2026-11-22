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
  function jpeg(file, maxBytes) {
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
            if (blob && blob.size <= (maxBytes || 500000)) resolve(blob);
            else reject(new Error("Cette image n’a pas pu être convertie."));
          }, "image/jpeg", 0.85);
        } catch (error) { reject(error); }
      };
      img.src = url;
    });
  }

  function openDrafts(userId) {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open("zoo-comprehension-drafts", 1);
      request.onupgradeneeded = function () { request.result.createObjectStore("drafts"); };
      request.onerror = function () { reject(request.error); };
      request.onsuccess = function () {
        var db = request.result;
        var read = db.transaction("drafts", "readonly").objectStore("drafts").get(userId);
        read.onerror = function () { db.close(); reject(read.error); };
        read.onsuccess = function () {
          resolve({ state: read.result, write: function (state) {
            return new Promise(function (done, failed) {
              var tx = db.transaction("drafts", "readwrite");
              tx.oncomplete = done;
              tx.onabort = function () { failed(tx.error); };
              tx.objectStore("drafts").put(state, userId);
            });
          } });
        };
      };
    });
  }

  function open(client, host, sounds, userId) {
    if (!host || host.dataset.editorUser === userId) return;
    host.dataset.editorUser = userId;
    host.textContent = "Chargement des exercices…";
    Promise.all([
      client.rpc("get_comprehension_exercises"),
      openDrafts(userId).catch(function () { return null; })
    ]).then(function (responses) {
      var result = responses[0];
      if (host.dataset.editorUser !== userId) return;
      if (result.error) throw result.error;
      render(client, host, sounds, result.data || {}, responses[1]);
    }).catch(function () {
      if (host.dataset.editorUser !== userId) return;
      host.textContent = "Les exercices n’ont pas pu être chargés. ";
      var retry = button("Réessayer");
      retry.onclick = function () { delete host.dataset.editorUser; open(client, host, sounds, userId); };
      host.appendChild(retry);
    });
  }

  function render(client, host, sounds, saved, local) {
    host.textContent = "";
    var files = client.storage.from(bucket), drafts = Object.create(null);
    var order = sounds.map(function (sound) { return sound.id; });
    var state = local && local.state || { sound: "", edits: {} };
    Object.keys(state.edits).forEach(function (id) {
      drafts[id] = state.edits[id].entries.map(function (entry) { return Object.assign({}, entry); });
      drafts[id].forEach(function (entry) {
        if (entry.file) entry.preview = URL.createObjectURL(entry.file);
      });
    });
    var label = element("label", "Son à compléter");
    var select = element("select");
    select.id = "comprEditSound";
    label.htmlFor = select.id;
    sounds.forEach(function (sound) {
      var option = element("option", sound.label);
      option.value = sound.id; select.appendChild(option);
    });
    if (order.indexOf(state.sound) >= 0) select.value = state.sound;
    var existing = element("div"), rows = element("div"), guide = element("p"), add = button("Ajouter un mot"), save = button("Enregistrer ce son");
    save.className = "primary";
    var status = element("p"); status.setAttribute("role", "status");
    [label, select, guide, status, existing, rows, add, save].forEach(function (node) { host.appendChild(node); });

    function draft(id) {
      if (!drafts[id]) drafts[id] = (saved[id] || []).map(function (row) { return { word: row.word, path: row.path }; });
      return drafts[id];
    }
    function persist() {
      state.sound = select.value;
      if (!local) {
        if (state.edits[select.value]) status.textContent += " Gardez la page ouverte jusqu’à l’enregistrement.";
        return;
      }
      local.write(state).catch(function () {
        status.textContent = "Le brouillon ne peut pas être gardé sur cet appareil. Laissez cette page ouverte jusqu’à l’enregistrement.";
      });
    }
    function updateControls() {
      var dirty = Object.keys(state.edits);
      Array.prototype.forEach.call(select.options, function (option, index) {
        option.textContent = sounds[index].label + (dirty.indexOf(option.value) >= 0 ? " · à enregistrer" : "");
      });
      save.disabled = !state.edits[select.value];
    }
    function edited() {
      var id = select.value, previous = state.edits[id];
      var baseline = previous ? previous.previous : saved[id] || [];
      var entries = draft(id);
      if (!entries.length && !baseline.length) {
        delete state.edits[id];
        status.textContent = "";
        updateControls();
        persist();
        return;
      }
      state.edits[id] = {
        previous: baseline,
        entries: entries.map(function (entry) {
          return { word: entry.word, path: entry.path, file: entry.file, pendingPath: entry.pendingPath };
        })
      };
      status.textContent = "Modifications à enregistrer pour « " + sounds[select.selectedIndex].label + " ».";
      updateControls();
      persist();
    }
    function attach(entry, file) {
      entry.file = file;
      delete entry.pendingPath;
      if (entry.preview) URL.revokeObjectURL(entry.preview);
      entry.preview = URL.createObjectURL(file);
      edited();
      paint();
    }
    function fileInput(row, labelText, onFile) {
      var pick = element("input");
      pick.type = "file"; pick.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
      pick.setAttribute("aria-label", labelText);
      pick.onchange = function () { if (pick.files[0]) onFile(pick.files[0]); };
      row.ondragover = function (event) { event.preventDefault(); };
      row.ondrop = function (event) {
        event.preventDefault();
        if (!select.disabled && !pick.disabled && event.dataTransfer.files[0]) onFile(event.dataTransfer.files[0]);
      };
      return pick;
    }
    function paint() {
      rows.textContent = "";
      existing.textContent = "";
      var id = select.value, entries = draft(id);
      var automatic = ZooExo.comprWords(id, order).own;
      var current = ZooExo.comprWords(id, order, saved);
      var missing = Math.max(0, 4 - current.own.length - current.prev.length, current.own.length ? 0 : 1);
      var counts = current.own.length + " pour ce son · " + current.prev.length + " des sons précédents";
      guide.textContent = missing
        ? "À compléter : " + missing + (missing === 1 ? " mot illustré à ajouter" : " mots illustrés à ajouter") + " (" + counts + ")."
        : "Assez de mots illustrés (" + counts + ").";
      existing.appendChild(element("h3", "Mots et illustrations du Zoo"));
      if (!automatic.length) existing.appendChild(element("p", "Aucun mot illustré par défaut pour ce son."));
      automatic.forEach(function (word) {
        var row = element("div"); row.className = "compr-edit-row compr-default";
        var icon = element("span", ZooExo.COMPR_PICS[word]);
        icon.setAttribute("aria-hidden", "true");
        row.appendChild(icon);
        row.appendChild(element("strong", word));
        if (entries.some(function (entry) { return entry.word === word; })) {
          row.appendChild(element("small", "Image personnalisée dans vos ajouts ci-dessous"));
        } else {
          var pick = fileInput(row, "Ajouter une image pour « " + word + " »", function (file) {
            var entry = { word: word, path: null };
            entries.push(entry);
            attach(entry, file);
          });
          pick.disabled = entries.length >= limit;
          row.appendChild(pick);
        }
        existing.appendChild(row);
      });
      if (current.prev.length) {
        var previous = element("details");
        previous.appendChild(element("summary", "Mots disponibles des sons précédents"));
        previous.appendChild(element("p", current.prev.join(", ")));
        existing.appendChild(previous);
      }
      if (entries.length) rows.appendChild(element("h3", "Vos ajouts"));
      entries.forEach(function (entry, index) {
        var row = element("div"); row.className = "compr-edit-row";
        var word = element("input");
        word.type = "text"; word.maxLength = 40; word.value = entry.word;
        word.placeholder = "Mot à comprendre";
        word.setAttribute("aria-label", "Mot " + (index + 1));
        word.oninput = function () { entry.word = word.value; edited(); };
        var pick = fileInput(row, "Image du mot " + (index + 1), function (file) { attach(entry, file); });
        var remove = button("Retirer");
        remove.setAttribute("aria-label", "Retirer le mot " + (index + 1));
        remove.onclick = function () {
          if (entry.preview) URL.revokeObjectURL(entry.preview);
          entries.splice(index, 1); edited(); paint();
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
      updateControls();
    }

    select.onchange = function () {
      status.textContent = state.edits[select.value] ? "Ce son a des modifications à enregistrer." : "";
      persist(); paint();
    };
    add.onclick = function () { draft(select.value).push({ word: "", path: null }); edited(); paint(); rows.lastChild.firstChild.focus(); };
    save.onclick = async function () {
      var id = select.value, entries = draft(id), words = new Set();
      var edit = state.edits[id];
      if (!edit) return;
      var valid = entries.every(function (entry) {
        entry.word = entry.word.trim().replace(/\s+/g, " ").normalize("NFC").toLocaleLowerCase("fr");
        if (!/^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[ ’'-][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/.test(entry.word)
            || words.has(entry.word) || !(entry.path || entry.file)) return false;
        words.add(entry.word);
        return true;
      });
      if (!valid) {
        status.textContent = "Chaque ligne doit contenir un mot ou une courte expression différente et une image.";
        status.scrollIntoView({ block: "nearest" });
        return;
      }
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
            edit.entries[entries.indexOf(entry)].pendingPath = path;
            persist();
          }
          next.push({ word: entry.word, path: entry.pendingPath || entry.path });
        }
        var result = await client.rpc("admin_save_comprehension_exercise", { p_sound: id, p_entries: next, p_previous: edit.previous });
        if (result.error) throw new Error(result.error.message || "Enregistrement impossible.");
        saved[id] = next;
        entries.forEach(function (entry) { if (entry.preview) URL.revokeObjectURL(entry.preview); });
        delete drafts[id];
        delete state.edits[id];
        persist();
        status.textContent = next.length ? "Exercice enregistré." : "Ajouts retirés pour ce son.";
      } catch (error) {
        status.textContent = error.message || "Enregistrement impossible. Réessayez.";
        status.scrollIntoView({ block: "nearest" });
      }
      finally {
        select.disabled = save.disabled = false;
        paint();
      }
    };
    if (state.edits[select.value]) status.textContent = "Brouillon retrouvé. Enregistrez ce son pour envoyer les modifications.";
    paint();
  }
  window.ZooComprAdmin = { open: open, imageToJpeg: jpeg };
})();
