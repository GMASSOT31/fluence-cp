# Consignes pour les agents (Codex et autres)

1. **Lire `CLAUDE.md` en entier avant de commencer.** C'est la seule source de vérité du projet : carte du dépôt, de l'hébergement et de la base (§0), règles de travail (§4), décisions prises à ne pas remettre en question (§6). Ce fichier-ci ne la recopie pas.
2. **Reprendre là où on en est** : `CLAUDE.md` §0 (dernier état vérifié, PR ouvertes), puis le fichier de passation du chantier concerné (`docs/parcours-gs/avancement.md`, `docs/parcours-ce1/avancement.md`, `docs/aide-ecoute/avancement.md`), à tenir à jour à chaque étape.
3. Vérifier ses propres accès en lecture avant d'agir (GitHub, Supabase, site public : voir CLAUDE.md §0 « Accès utiles »).
4. Travailler sur une branche `codex/<sujet>` partie du dernier `main`, une PR par changement ; ne jamais toucher aux branches, PR ou changements en cours de l'autre développeur (Claude, branches `claude/…`).
5. Ne rien fusionner sur `main` et ne rien modifier dans la base Supabase sans l'accord explicite de Gabriel (propriétaire du projet, enseignant, non technique : lui parler en français simple et lui proposer des choix).
6. Il n'y a ni prévisualisation ni base de test : tester avec les faux serveurs locaux (`tools/`), jamais avec de vraies pages ou de vrais comptes (ils écrivent dans les données réelles des élèves).
7. Avant de proposer une fusion : intégrer le dernier `main`, relancer `python3 tools/check_syntax.py` et retester le parcours touché.
8. Mettre `CLAUDE.md` (et le fichier de passation du chantier) à jour si une modification change une règle métier, le back-end ou le déploiement (moins de 200 lignes).
9. Aucune clé, mot de passe, jeton ni contenu de `.env` dans le dépôt ou les messages (la clé « publishable » Supabase déjà présente est publique).
10. Fichiers lourds ou générés à ne pas modifier à la main : `vendor/` (copies de bibliothèques, dont `vendor/vosk/` ≈ 48 Mo), `audio/*.mp3|json` (fabriqués par `tools/build_audio_sprite.py` et `tools/build_gs_audio.py`), `calcul/zoo-skin.css` et `calcul/zoo-effects.js` (`tools/extract_zoo_skin.py`), `WORD_POOL` d'`exo-data.js` (`tools/exo_mots.py`).
