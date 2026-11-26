# Aide automatique à l'écoute — avancement et passation

À lire avec `mesures.md` (résultats chiffrés et limites) et `CLAUDE.md` (règles du projet, §6 « Médaille = lecture enregistrée » et « Valider une lecture depuis la fiche »). Tenu à jour à chaque étape. Dernière mise à jour : 26/11/2026 (Claude).

## Mission Lecture CP en un seul passage

- La fin du chronomètre ou « J’ai fini » mémorise le niveau dans `progress.readOnce` et ouvre la suite. La disponibilité du micro, la reconnaissance et l’objectif de fluence ne conditionnent pas l’avancement.
- Le micro est demandé au démarrage si l’appareil permet la reconnaissance locale. Le son est transitoire en mémoire. Le Zoo utilise les données locales de l’exercice pour estimer la fluence et ne conserve ni ne transmet le fichier audio de la mission. Le mode séparé « Je m’enregistre » reste protégé par le mot de passe enseignant.
- Un score automatique exploitable (`src: "auto"`) entre dans la courbe. Sans mesure exploitable ou sous l’objectif, une entrée `reviews[].single` apparaît dans « Ma classe › À faire aujourd’hui » et dans la fiche de l’élève. La mesure en direct saisie par l’enseignant remplace le score éventuel à la prochaine connexion élève (`settings.recDec[id].mclm`, même identifiant de passage). Aucune migration.
- Le fonctionnement du micro sur un ancien appareil et la fiabilité de la reconnaissance avec des voix d’enfants restent à vérifier en classe.

## Demande de Gabriel (25/11/2026)
Aider l'enseignant à écouter les lectures enregistrées, **100 % sur l'appareil** : le son ne quitte jamais la tablette, aucune voix d'élève hébergée. Choix successifs de Gabriel (boîtes de dialogue) :
1. Prototype : l'aide **pré-remplit**, l'enseignant valide toujours.
2. « Auto + vérification en 1 geste » : la tablette calcule la fluence juste après l'enregistrement, l'enseignant valide d'un toucher dans Ma classe. **Pas de médaille sans geste de l'enseignant** (option « tout automatique » refusée).
3. Anciens iPad (iOS 12) : « essayer, à la demande » (jamais de calcul automatique sur ces appareils, pour ne pas recharger la page de l'élève).

## Où en est-on ?
- [x] **PR 386** — prototype : `aide-ecoute.js`, `vendor/vosk/`, bouton « 🤖 Proposer automatiquement » dans « Mon maître(sse) écoute », réglage admin, outils de mesure.
- [x] **PR 387** — fluence calculée par la tablette après l'enregistrement + « ✅ Valider N par minute » dans Ma classe.
- [x] **PR 388** — anciens iPad (iOS 11–13) : bouton à la demande.
- [ ] **En attente de Gabriel** : essai sur de vraies lectures (les chiffres de la tablette correspondent-ils à son comptage ?) et sur un iPad iOS 12 de l'école (marche / message d'échec / page qui se recharge ; durée). Ne rien régler avant ces retours.

## Comment ça marche
- **Activation** : `teacher_zoo_settings.settings.aideEcoute = true` (case admin « 🤖 Essai : fluence calculée par la tablette », Réglages généraux, `#aideEcouteBox` d'enseignants.html ; `collectSettings` ne l'écrit que pour le rôle admin). Le Zoo la lit dans `student_get_teacher_settings` → `data.aideEcoute`. Donc : seulement les classes de l'admin.
- **Moteur** (`aide-ecoute.js`, ES5, `window.ZooAideEcoute`, `V` = version des fichiers du modèle) :
  - charge à la demande `vendor/vosk/vosk.js` (vosk-browser 0.0.8, Worker WASM), `modele-fr.tar.gz` (vosk-model-small-fr-0.22, ≈ 42 Mo, gardé par le navigateur en IndexedDB sous son adresse) et `mots-fr.txt` (vocabulaire du modèle) ;
  - grammaire = mots de l'exercice (`parseItems(contentOf(...))`) + suites de 2–3 mots dans l'ordre + « voisins » plausibles (`voisins` : voyelle/consonne confondue, seulement des mots connus) + `[unk]` ;
  - mots entendus écartés si confiance < 0,5 ou durée < 0,12 s ; alignement à début imposé, fin libre (`align`), homophones égaux (`phon`) ; mots d'une lettre jamais jugés (`tiny`) ;
  - renvoie `{endIdx, errs, unknown, matched, heard, ms, secs}`.
  - `supported()` = calcul automatique (iOS ≥ 14, `new EventTarget()` possible…) ; `supported("demande")` = bouton de l'écoute, permis aussi sur iOS 11–13 (`etFix` remplace `EventTarget`, `readBlob` sans `Blob.arrayBuffer`, `to16k` ramène le son à 16 kHz à la main).
- **Tablette de l'élève** (`zoo-connecte.html`) : `finishRecordedRun` → `autoAnalyse(id)` (1,5 s après, si `aideOK()`) → `rv.auto = {v:1, end, errs, n, c, mclm, at}` dans `data.reviews` (part au serveur avec la lecture, JSON libre, **aucune migration**). Syllabes : `errs` toujours vide (trop de fausses alertes).
- **Écoute sur la tablette** : `openReview` pré-remplit `RV.endIdx` et `RV.sugg` (pointillés orange, comptés comme erreurs seulement une fois touchés) depuis `rv.auto` ; `aideBox` (bouton « 🤖 Proposer automatiquement », `aideOK("demande")`).
- **Espace enseignant** (`pedagogie.js` v38, `recItem`) : « 🤖 Calcul de la tablette : … » + « ✅ Valider N par minute » → `settings.recDec[id] = {sid, ok:true, c, auto:1, ts}` (même chemin que la validation manuelle avec un nombre : `applyRecDecisions` du Zoo calcule la fluence, `src:"rec"`) ; « ✏️ Corriger » ouvre le champ pré-rempli.

## Tests
- Écran élève : `zoo-test.html?aide=1` (réglage allumé + lecture du texte « l » en attente, id `rvA` ; ranger un son dans IndexedDB `fluence-cp-audio`/`rec` ; `window.__t.autoAnalyse("rvA")`) ; `?aide=0` : même lecture, réglage éteint.
- Espace enseignant : `enseignants-test.html?teacher=1&pedago=1&aide=1` (lecture de p1 avec un calcul : bouton « ✅ Valider 32 par minute »).
- iOS 12 simulé dans Chromium : nom d'appareil iPad iOS 12 + `addInitScript` qui rend `EventTarget` non constructible, retire `Blob.prototype.arrayBuffer`, `OfflineAudioContext` et renomme `AudioContext` en `webkitAudioContext`.
- Mesure : `python3 -I tools/aide_ecoute_audio.py DOSSIER` puis `node tools/aide_ecoute_mesure.js DOSSIER` (`AIDE_OPTS='{"ngram":1,"near":false,"minConf":0,"minDur":0}'` pour comparer des réglages). Dossier de sons hors du dépôt.

## Pièges connus
- Environnement « fluence-cp » : `alphacephei.com` (modèles vosk) et `speech.platform.bing.com` (voix edge-tts) sont autorisés. edge-tts passe par le proxy : le script charge `/root/.ccr/ca-bundle.crt` lui-même.
- Changer de modèle ou de vosk-browser : remplacer les fichiers de `vendor/vosk/`, augmenter `V` dans `aide-ecoute.js` et `?v=` de `aide-ecoute.js` dans zoo-connecte.html (voir `vendor/vosk/LISEZMOI.md`). Le dépôt porte un fichier de 42 Mo : ne pas en ajouter d'autres sans raison.
- `aide-ecoute.js` doit rester en **ES5** (chargé par tous les iPad, même ceux qui n'affichent pas le bouton) : pas de regex à rebours (`(?<=…)`), qui casserait tout le fichier sur Safari 12.
- Le décodage d'un enregistrement Chrome (webm) et d'un WAV iOS passe par `decodeAudioData` en forme à rappels (Safari ancien).

## Pistes (seulement si Gabriel le demande après ses essais)
- Écarter la voix d'un autre élève (cas « bruit » le plus faible) ; afficher une alerte « classe bruyante » quand beaucoup de mots sont écartés.
- Mesurer sur de vraies lectures d'enfants (enregistrées par Gabriel, jamais envoyées : mesure à faire sur son ordinateur).

## Journal
- 25/11/2026 — Claude : PR 386, 387, 388 fusionnées et vérifiées en ligne.
