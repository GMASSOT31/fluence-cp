# Parcours CE1 — avancement et passation

À lire avec `plan.md` (repères officiels cités) et `../parcours-gs/avancement.md` (même architecture). Tenu à jour à chaque étape.

## Où en est-on ?
- [x] Plan corrigé avec les textes officiels et validé par Gabriel le 24/11/2026 (début par le calcul ; mission CE1 = révision « jusqu'à 99 » puis les centaines).
- [x] **Étape A — CE1 activable pour le calcul** (24/11/2026, branche `claude/parcours-ce1-plan`) : `pedagogie.js` v34 (`READY` par matière, `trackOf` rend `"ce1"` pour le calcul seulement, bouton « CE1 » dans la fiche et dans le volet collectif quand la matière est « Calcul seul » ; en lecture : « CE1 · à venir », désactivé ; un ancien réglage `lecture:"ce1"` est lu comme CP) ; `gs-data.js` v6 (`TRACK_READY` par matière). Réglage : `settings.tracks[élève].calcul = "ce1"`, aucune migration. Recette `node tools/test_gs_recette.js` : T14 contrôle les deux cas.
- [ ] Étape B — Écouter jusqu'à 1 000.

## Journal
- 24/11/2026 — Claude : programmes CE1 lus (annexes 3 et 4 du BO n° 41, livret eduscol CE1 maths), plan corrigé, étape A.
