#!/usr/bin/env node
/* Mesure de l'aide automatique à l'écoute (aide-ecoute.js) dans Chromium, avec le vrai modèle.
   node tools/aide_ecoute_mesure.js DOSSIER   (DOSSIER fabriqué par tools/aide_ecoute_audio.py)
   Écrit DOSSIER/resultats.json et affiche un tableau : dernier mot lu (exact, à 1 ou 2 mots près),
   erreurs trouvées (rappel) et fausses alertes (mots justes proposés comme erreurs). */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), DIR = path.resolve(process.argv[2] || "aide-ecoute-cas");
/* AIDE_OPTS='{"ngram":1,"near":false,"minConf":0}' pour comparer des réglages */
const OPTS = JSON.parse(process.env.AIDE_OPTS || "{}");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".txt": "text/plain; charset=utf-8", ".gz": "application/gzip", ".webm": "audio/webm", ".json": "application/json" };

const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  const f = u.startsWith("/cas/") ? path.join(DIR, u.slice(5)) : path.join(ROOT, u === "/" ? "/tools/aide-ecoute-banc.html" : u);
  if (!f.startsWith(ROOT) && !f.startsWith(DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(b);
  });
});

(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  const cas = JSON.parse(fs.readFileSync(path.join(DIR, "cas.json"), "utf8"));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", e => console.error("page:", e.message));
  await page.goto(`http://127.0.0.1:${port}/tools/aide-ecoute-banc.html`);
  const ok = await page.evaluate(() => window.ZooAideEcoute.supported());
  if (!ok) { console.error("Appareil non pris en charge"); process.exit(1); }
  const out = [];
  for (const c of cas) {
    c.opts = OPTS;
    const r = await page.evaluate(async (c) => {
      const b = await (await fetch("/cas/" + encodeURIComponent(c.f))).blob();
      try { return await window.ZooAideEcoute.propose(b, c.words, Object.assign({ raw: true }, c.opts)); } catch (e) { return { error: String(e && e.message || e) }; }
    }, c);
    const row = { f: c.f, k: c.k, type: c.type, voix: c.voix, n: c.words.length, end: c.end, errs: c.errs, got: r };
    if (!r.error) {
      row.dEnd = c.end == null ? null : r.endIdx - c.end;
      const truth = new Set(c.errs), sug = new Set(r.errs);
      row.found = c.errs.filter(i => sug.has(i)).length;
      row.fa = r.errs.filter(i => !truth.has(i)).length;
      row.read = Math.min(c.end == null ? c.words.length - 1 : c.end, r.endIdx) + 1;
    }
    out.push(row);
    console.log([c.f.padEnd(26), row.error || r.error ? "ERREUR " + (r.error || "") :
      `fin ${r.endIdx}/${c.end} (écart ${row.dEnd}) erreurs ${row.found}/${c.errs.length} fausses alertes ${row.fa}/${row.read} ${(r.ms / 1000).toFixed(1)} s`].join(" "));
  }
  fs.writeFileSync(path.join(DIR, "resultats.json"), JSON.stringify(out, null, 1));
  /* Résumé par type de cas */
  const groups = {};
  out.filter(o => !o.got.error).forEach(o => {
    const g = (o.k[0] === "t" ? "texte" : o.k[0] === "m" ? "mots" : "syllabes") + " · " + o.type;
    const s = groups[g] = groups[g] || { n: 0, ex: 0, p1: 0, p2: 0, nEnd: 0, err: 0, found: 0, fa: 0, read: 0, ms: 0 };
    s.n++; s.ms += o.got.ms;
    if (o.dEnd != null) { s.nEnd++; if (o.dEnd === 0) s.ex++; if (Math.abs(o.dEnd) <= 1) s.p1++; if (Math.abs(o.dEnd) <= 2) s.p2++; }
    s.err += o.errs.length; s.found += o.found; s.fa += o.fa; s.read += o.read;
  });
  console.log("\nRésumé (dernier mot : exact / à 1 mot près / à 2 mots près ; erreurs trouvées ; fausses alertes sur les mots lus)");
  Object.keys(groups).sort().forEach(g => {
    const s = groups[g], pc = (a, b) => b ? Math.round(100 * a / b) + " %" : "—";
    console.log(`${g.padEnd(42)} n=${s.n}  fin ${pc(s.ex, s.nEnd)} / ${pc(s.p1, s.nEnd)} / ${pc(s.p2, s.nEnd)}  erreurs ${s.found}/${s.err} (${pc(s.found, s.err)})  fausses alertes ${pc(s.fa, s.read)}  ${(s.ms / s.n / 1000).toFixed(1)} s/lecture`);
  });
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
