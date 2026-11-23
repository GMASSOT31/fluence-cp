# Parcours GS / CP / CE1 — avancement et passation

À lire avec `cahier-des-charges.md` (la demande de Gabriel) et `CLAUDE.md` (règles du projet). **Ce fichier est tenu à jour à chaque étape** : Claude ou Codex doit pouvoir reprendre à tout moment. Dernière mise à jour : 23/11/2026 (Claude), phase 0.

## Où en est-on ?
- [x] Phase 0 — audit (constats ci-dessous).
- [ ] **Étape A — prototype « Capitales » (GS Lecture)**, à faire valider par Gabriel avant toute autre activité. Comprend : choix du parcours Lecture dans la fiche élève, accueil GS de l'élève, activité 4.2 complète (paliers, séries, validation 2 × 80 %, aide après 2 échecs, roue après chaque série réussie), carte de suivi enseignant.
- [ ] Étape B — rituel alphabet (4.1) + voix enregistrées des noms de lettres.
- [ ] Étape C — autres activités GS Lecture (4.3 à 4.7) sur le modèle du prototype ; police cursive.
- [ ] Étape D — modification collective des parcours + paramétrage GS dans Pédagogie + radar GS Lecture.
- [ ] Étape E — GS Calcul (5.1 à 5.6), demande une migration du Zoo de Calcul.
- [ ] Étape F — tests d'acceptation T01–T18, non-régression CP, tablette.

Branches et PR de ce chantier : `claude/parcours-gs-…` (une par étape). Toujours partir du dernier `main`.

## Constats de l'audit (23/11/2026)
- **Lecture élève** (`zoo-connecte.html`) : modèle d'activité à copier = « J'entends » (`renderPhono`, `phonoStart`, `phonoQuestion`, `phonoAnswer`, `phonoEnd`, vue `v-phono`) et `listenEnd` pour la roue (`data.wheels.push({id:uid(),sid,ts})` puis `showEvolution` → `openWheel`). Sauvegarde : `save()` → `cloudFlush` → `student_save_progress_v2` ; **toute nouvelle clé de progression doit être ajoutée dans `cloudSnapshot` et relue dans `bootCloud`**. Mission : `missionBase`, `mission`, `missionAct`, accueil `renderHome`.
- **Économie de la Lecture = côté appareil** : pièces, roues (`data.wheels`, ids `uid()`) et tirage de la roue sont décidés dans le navigateur ; le serveur ne contrôle que la taille du JSON, la session, la version et la fluence > 250. Seuls les jeux et les cadeaux sont calculés par le serveur. Le CP a donc déjà cette limite (cf. T11/T15).
- **Calcul** : progression dans `lab_calc_progress` (pas `student_progress`), séries envoyées à `lab_student_submit_round` (côté serveur, activités limitées à `nombres|addition|soustraction`, anti-rejeu par `round_id`, pièces et roue calculées par le serveur). Une nouvelle activité GS Calcul demandera une migration de cette fonction.
- **Réglages** : `student_get_teacher_settings` envoie tout `teacher_zoo_settings.settings` à l'élève (Lecture et Calcul). `collectSettings` d'`enseignants.html` **reconstruit l'objet entier** : une nouvelle clé doit y être ajoutée, sinon elle est effacée.
- **Enseignant** : fiche élève = `studentDetail` (enseignants.html) appelée par `detail(r)` (pedagogie.js) ; ligne élève `line(r)` ; toile `axes`/`drawWeb`/`drawFiche` (pedagogie.js), `drawCalcFiche` (calcul/enseignant.js). **Aucune sélection multiple d'élèves aujourd'hui.**
- **Audio** : `audio/syllabes.json` ne contient que des sons de lecture (« b » = « beu ») : **aucun nom de lettre ni nombre enregistré**. `tools/build_audio_sprite.py` a les noms de fichiers en dur ; `audio-lecture.js` ne charge qu'une carte. Le calcul parle avec la voix de l'appareil (`calcul/voice.js`).
- **Polices** : Andika (lettres claires, déjà chargée), Fredoka, Figtree via Google Fonts. **Aucune police cursive scolaire.**
- **Aucun mécanisme de rituel/capsule** ; réutilisables : `showEvolution`, overlays, `img/presentation-zoo.mp4` (accueil seulement).

## Choix techniques (proposés, à confirmer au fil des étapes)
1. **Parcours de l'élève** : `teacher_zoo_settings.settings.tracks = {idÉlève: {lecture:"gs"|"cp", calcul:"gs"|"cp"}}` — absent = CP (T01, aucune donnée existante touchée). Même mécanisme que `assign`/`allo` : **aucune migration**, seul l'enseignant peut l'écrire (RLS existante), l'élève le lit via `student_get_teacher_settings`. À ajouter dans le chargement (`window.pedaTracks`) et dans `collectSettings`. Retour arrière : supprimer la clé.
2. **Progression GS Lecture** : nouvelle clé `progress.gs` dans `student_progress` (JSON libre, comme `phono`/`dictee`) : `{lecture: {comp: {idCompétence: {palier, ok:[ids de séries réussies], ko, aide, valide:{palier:date}}}, series:[dernières séries, 60 max], rewarded:[ids]}, rituel:{lecture:date}}`. Le CP n'y touche pas → CP ↔ GS conserve tout (T04).
3. **Définitions pédagogiques déclaratives** : nouveau fichier `gs-data.js` (ES2018, comme `exo-data.js`) : groupes de lettres, compétences, paliers, prérequis, réglages par défaut. Réglages de l'enseignant dans `settings.gs` (fusionnés avec les défauts, bouton « Valeurs recommandées »).
4. **Roue** : une roue par série réussie, id de roue = `gs:` + id de série, ajoutée seulement si l'id n'est pas déjà dans `rewarded` (anti-doublon local, même niveau de sécurité que le CP). Un contrôle serveur demanderait une migration de `student_save_progress_v2` : **à décider avec Gabriel**.
5. **Voix** : prototype avec la voix de l'appareil, puis (étape B) second fichier son enregistré pour les noms de lettres, les nombres 0–20 et les consignes.
6. **CE1** : visible « À venir », désactivé dans le sélecteur.

## Journal
- 23/11/2026 — Claude : cahier des charges enregistré, audit fait, plan ci-dessus.
