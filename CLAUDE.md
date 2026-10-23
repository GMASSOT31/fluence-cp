# Zoo de Lecture — mémoire du projet (à lire en premier)

## 1. Objectif
Appli web de fluence de lecture pour des classes de CP, en ligne sur https://zoodelecture.fr
- **Élève** (eleve.html → zoo-connecte.html) : lecture d'1 minute par son et par niveau (syllabes, mots, texte), en entraînement ou évaluation ; exercice d'écoute « J'écoute » ; animaux qui éclosent et grandissent ; pièces, roue, 8 jeux, boutique.
- **Enseignant / admin** (enseignants.html) : classes, élèves, suivi, réglages pédagogiques.
- **Guides pédagogiques** : `guides/<nom>/index.html` + `guides/guides.css` (mode d'emploi : `guides/README.md`) ; 5 publiés : `ateliers-lecture-cp`, `syllabes-lecture-cp`, `tablettes-lecture-cp`, `fluence-lecture-cp`, `differenciation-lecture-cp` (textes relus par Gabriel : à modifier avec son accord). **Partage** : `share.js` (landing, guides, espace enseignant). `sitemap.xml` + `robots.txt` ; aucune mesure d'audience (décision).
- **Landing page** (index.html) : présente le site, accès élève/enseignant/démo ; **démo sans compte** avec visite guidée.
- L'utilisateur (Gabriel, enseignant de CP) **n'est pas technique** : faire les manipulations soi-même.

## 2. Stack
- Site **statique** HTML/CSS/JS, sans framework, **un fichier par page**. Style : JS compact à l'ancienne (`var`, `function`, petits `el()`, `$()`, `nb()`, `q()`), commentaires en français, thème sombre pour les pages de connexion/landing, polices Fredoka + Figtree, variables CSS (`--ink`, `--muted`, `--line`, `--card`). Points de rupture téléphone : 600 et 880 px.
- Hébergement **GitHub Pages**, dépôt public GMASSOT31/fluence-cp, branche `main`, domaine OVH (fichier `CNAME`). Mise en ligne **1 à 5 min** après une fusion.
- Backend **Supabase** (projet `pcxpazpflnlwmhyuozdx`, région Paris). Fonctions RPC `SECURITY DEFINER` avec `search_path=''`, règles RLS. La clé « publishable » dans le code est normale ; **aucune autre clé dans le dépôt**.

## 3. Fichiers
- `index.html` landing · `eleve.html` connexion élève · `zoo-connecte.html` Zoo élève (~400 Ko, une grande IIFE) · `enseignants.html` espace enseignant/admin (`#inscription` = création de compte) · `mentions-legales.html`, `confidentialite.html` · `img/` captures · `CNAME`.
- `demo.js` (faux serveur de la démo, sessionStorage) et `demo-tour.js` (visite guidée « L'essentiel » 5 étapes ou « complète » 14) : **augmenter les numéros de version** `demo.js?v=` (dans zoo-connecte.html et enseignants.html) et `demo-tour.js?v=` (dans demo.js) à chaque modification. Actuels : demo.js v17, demo-tour.js v12. Paramètres d'adresse : `?demo=1&new=1` (démo), `&tour=short` (visite courte directe).
- `supabase/migrations/*.sql` : une migration par changement. `tools/` : outils de test (voir `tools/README.md`).
- `zoo-local.html` : ancienne version locale, non maintenue.
- Tables : **app_settings** (réglages admin, RLS admin seulement ; `auto_seats` = `{enabled, max:25}` : `teacher_request_seats` accorde tout de suite une demande si limite + places ≤ max — règle cachée aux enseignants, interrupteur dans l'onglet « Enseignants »), teachers, classes, students, student_progress (JSON versionné), student_sessions, student_login_attempts, teacher_zoo_settings (JSON libre), teacher_feedback.
- Fonctions élève : student_sign_in, student_session_profile, student_get_progress_v2, student_save_progress_v2, student_get_teacher_settings, verify_evaluation_code, student_submit_score, student_get_class_records, student_claim_coins, student_claim_vouchers, **student_change_pin**. Enseignant : set_student_pin, manage_student, manage_class, admin_manage_teacher, **admin_edit_class**, teacher_give_coins, teacher_give_voucher, teacher_request_seats, feedback_mark_replies_seen.
- Réglages enseignant (JSON `settings`) : thr, lock, reward, sfx, **music**, **pinChange**, allowRec, evalCode, maxPlays, packPrice, wheelPrice, sounds, texts, rewards.

## 4. Règles de travail (obligatoires)
- **Une branche `claude/<sujet>` et une PR par changement.** Mode plan (EnterPlanMode) pour les gros chantiers.
- **Jamais de fusion sur main sans accord explicite** : demander avant chaque fusion.
- **Jamais toucher à la base Supabase sans accord explicite**, une migration à la fois : (1) essai dans une transaction annulée (`raise exception 'DRYRUN_RESULT …'`), (2) accord, (3) `apply_migration`, (4) fichier ajouté dans `supabase/migrations/`, (5) vérification en lecture seule. **Appliquer la migration AVANT de fusionner la PR qui l'utilise.** Pour modifier une fonction : partir de sa définition en ligne (`pg_get_functiondef`).
- **Questions sous forme de choix** (AskUserQuestion), jamais en simple texte quand une réponse est attendue.
- Ne **jamais** taper de PIN ni de mot de passe à la place de l'utilisateur ; aucune clé ni mot de passe dans le dépôt ou les messages.
- Commits au nom de GMASSOT31 (e-mail anonyme GitHub `258298134+GMASSOT31@users.noreply.github.com`), terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Description de PR terminée par `🤖 Generated with [Claude Code](https://claude.com/claude-code)` (lien exact).
- Après une fusion : **attendre la fin de la mise en ligne** (`gh api repos/GMASSOT31/fluence-cp/pages/builds/latest` → `built` sur le bon commit) puis vérifier la page publiée (`curl` avec `?x=$(date +%s)`) avant d'annoncer « en ligne ». Dire à l'utilisateur de fermer/rouvrir l'onglet (cache 10 min).
- Avant de proposer une fusion : `python3 tools/check_syntax.py`, test navigateur avec les faux serveurs, affichage téléphone 375 × 667, relancer les 8 jeux si la salle de jeux a changé.
- Réponses **en français, simples, sans jargon**. Interface pour des CP : peu de texte, gros boutons, consignes lisibles à voix haute (🔊), récompenses claires.
- **Contexte** : déléguer à des sous-agents les tâches qui lisent beaucoup de fichiers (recherches larges, audits) ; **prévenir l'utilisateur quand la conversation s'allonge** (proposer une nouvelle session) ; garder ce fichier à jour (< 200 lignes).

## 5. Outils locaux (sur le Mac de l'utilisateur)
- `gh` est installé à `~/zoo-tools/gh` (pas dans le PATH ; connecté à GMASSOT31). Dépôt cloné dans `~/fluence-cp`.
- Tests : `python3 tools/build_test_pages.py` fabrique `tools/test-site/` (ignoré par git) ; serveur `python3 -m http.server 8766 --bind 127.0.0.1 --directory tools/test-site` (le port 8765 peut être occupé). Pages : `zoo-test.html?lirecartes=1` (Zoo élève, faux serveur `window.__srv`, accès internes `window.__t`, oiseau `window.__flap`), `enseignants-test.html` (admin par défaut, `?teacher=1` enseignant, `window.__auth`), `eleve-test.html`, `zoo-connecte.html?demo=1&new=1`. Options du faux serveur : `?sanspin=1`, `?illimite=1`, `?prix4=1`, `?sanscode=1`.
- Navigateur de test : les animations `requestAnimationFrame` et le défilement doux sont ralentis → surcharger `window.requestAnimationFrame` par un `setTimeout` pour tester ; capture d'écran avec Chrome sans fenêtre possible.
- Pièges macOS : `sed -i ''` ; ne pas couper une sortie de contrôle avec `tail` (ligne masquée) ; la fenêtre de test perd parfois la connexion (la rouvrir avec `preview_start`).

## 6. Décisions prises (ne pas remettre en question)
- **Pièces des jeux** : 1 (objectif atteint), 3 (record perso battu), 10 (record de la classe pris à un camarade) ; jamais additionnées, seule la plus haute compte ; **calculées par le serveur** (anti-triche).
- Entraînement < 15 s : n'est pas validé et n'entre ni dans les records ni dans la courbe (règle des 15 s plutôt qu'une confirmation).
- Un son réussi à l'écoute donne un tour de roue + la scène d'évolution ; scène d'évolution aussi **en attente** quand l'enseignant note plus tard une lecture enregistrée (`data.evos`, jouée à l'accueil).
- Démo : activée **uniquement** par `?demo`, n'envoie rien à Supabase, « Recommencer » revient à l'accueil du Zoo de Léo.
- Ordre des sons par défaut = progression PIANO CP (citable, aucun contenu du commerce copié). **Enregistrements audio des élèves : restent sur leur appareil.**
- PIN par défaut 1234 ; nouveau compte enseignant = 3 élèves (plus sur demande) ; ghost/suppression de classes ; l'admin peut renommer et changer le code des classes des autres (`admin_edit_class`).
- Écartés : pièces cumulées ; PIN aléatoires ; « Copier le lien élève » ; e-mails Supabase personnalisés (« rien pour l'instant ») ; jeu « Attrape-les » (remplacé par le Serpent) ; jeu « Compte les animaux » (remplacé par l'oiseau). Ancien `catch` et `count` restent acceptés par le serveur.
- Contact : via l'onglet « Améliorations » de l'espace enseignant (pas d'e-mail affiché). Éditeur des mentions légales : Gabriel MASSOT.

## 7. État actuel (23/10/2026) — tout fonctionne en ligne, aucune PR ouverte
- **Landing page** (animation CSS de l’œuf, **vidéo de présentation 30 s** `img/presentation-zoo.mp4` + vignette, 3 étapes, capture enseignant, texte de l'auteur, FAQ, mentions légales, confidentialité). Témoignages de collègues à ajouter plus tard (emplacement commenté dans index.html).
- **8 jeux** : Memory, Serpent, **Oiseau volant**, Dans l'ordre, Répète les animaux, Safari, Tour d'animaux, **Tuiles des sons** (façon Magic Tiles : 3 colonnes, **modèle toujours « d »** à distinguer de b, p, q — une rangée = 1 « d » + 2 pièges —, 3 vies, 150 s, vitesse croissante par paliers de 20 s, mélodie ; objectif 20 tuiles, score borné à 400 côté serveur ; remplace « Ballons des sons », supprimé). **Répète les animaux : défi jusqu'à 25** (borne serveur 25). Identifiants serveur : memory, snake, flap, order, simon, safari, stack, tiles. Nouveau jeu = migration qui recrée `student_get_class_records` et `student_submit_score` (+ entrée dans `GAMES`, `playGame`, `MODES` de demo.js et fake-supabase.js, `GAME_NAMES` de enseignants.html).
- **Oiseau** : 3 vies (clignote 1,7 s), **150 s au plus**, score = secondes tenues (borne serveur 150), objectif pièce = 20 s, vitesse ×2,3 la 1ʳᵉ minute puis +1 à 60, 90 et 120 s (« Vitesse supérieure ! »), poussin 🐤 vers la droite.
- Décor de zoo derrière les jeux ; **feu d'artifice** (canvas) à la place des confettis ; **musique** composée en Web Audio dans la salle de jeux et les parties (bouton 🎵/🔇 icône seule, à côté du compteur « Aujourd'hui », réglage `music`, coupée aussi si `sfx` est décoché).
- **Changer son code secret** (élève) : fonction `student_change_pin` ; boutons 🔑 à côté de « Quitter » (téléphone), « Me déconnecter » (panneau de gauche) et dans la pastille du bas ; case enseignant « Les élèves peuvent changer leur code secret » (Réglages généraux › Zoo › Code secret des élèves, `pinChange`).
- **Admin** : classement « Jeux les plus joués » (onglet Progression, calculé depuis `progress.hi[jeu].n`) ; renommer/changer le code de toutes les classes.
- **Fiches de connexion PDF** : un seul bouton « 🖨️ Fiches de connexion » par classe ; ouvre le PDF (Safari, ordinateur, Android) ; sur Chrome/Firefox/Edge pour iPhone (repérés par `CriOS`/`FxiOS`/`EdgiOS` ou `window.__gCrWeb`) : feuille de partage de l'iPhone.
- **Résultats de fluence inhabituels** : au-delà de **250 corrects/min** le score est mis à 0 et marqué `fraud` (valeur d'origine gardée) — côté serveur (`student_save_progress_v2`) et côté élève (`MCLM_MAX`) : aucune validation, certification ni récompense. L'enseignant voit « ⚠️ Résultat écarté : durée trop courte ou score inhabituel » dans les détails.
- **Espace enseignant** : « Progression » = pour chaque élève 3 pastilles (🕒 dernière activité, ➡️ prochaine étape, ✋ à valider) ; « Détails » = 4 cartes (👂 sons écoutés, 📖 sons lus : réussis ✓ et certifiés 🏅 séparés, ⚡ courbe de fluence limitée à 20 points et à un seul type de lecture, 🎮 parties) + « Voir le détail » + « En chiffres ». Code de la classe affiché sur sa carte (onglet « Élèves ») avec « Copier » et « Fiches de connexion ». Guide de démarrage en 3 étapes (comptes enseignants de moins de 30 jours, jamais l'admin, mémorisé dans le navigateur). Évaluation en direct : deux choix « Évaluation accompagnée protégée » (défaut, `evalCode` vrai) / « Évaluation sans code ».
- **Vocabulaire unique (élève et enseignant)** : « À travailler » / « ✓ Réussi en entraînement » / « 🏅 Certifié par l'enseignant ». Le niveau N de l'élève compte les étapes **réussies** (les certifiées sont comptées à part). « Résultat écarté : durée trop courte ou score inhabituel » (jamais « truqué »). Sur la ligne enseignant : « Écouter la lecture » (lecture enregistrée) ou « Prévoir une évaluation » (étapes réussies non certifiées).
- **Accueil élève** : bouton principal « 🏋️ Je m'entraîne » (ouvre directement l'exercice recommandé, prêt à démarrer, avec « Lis avec un adulte ou un camarade qui t'écoute ») ; secondaires « Choisir une autre activité » et « Faire mon évaluation avec l'enseignant ». « Changer d'étape » redonne les menus (`setReadingFocus("idle")`) ; les cases de « Ma progression » lancent le son ET le niveau cliqués.
- Démo : visite « L'essentiel » étape 4/5 ouvre « Détails » de Léo ; ouverte depuis le guide (`compte=1`) elle ne propose plus « Créer mon compte ».
- Bulle de visite guidée adaptée au téléphone ; scène d'évolution en attente ; outils de test (`tools/`).

## 8. À faire / pistes (selon la demande de l'utilisateur)
- **Sécurité (en attente de son accord)** : la limitation des essais de `student_sign_in` ne compte **que les connexions réussies** (une erreur annule l'enregistrement de l'essai) → les codes à 4 chiffres peuvent être essayés sans blocage. Correctif à préparer dans une PR séparée (renvoyer un résultat au lieu d'une erreur, comme `student_change_pin`).
- Les entraînements courts enregistrés avant la règle des 15 s comptent encore.
- Réglage de difficulté de l'oiseau (derniers paliers très rapides) selon les retours.
- Témoignages de collègues sur la landing ; vérifier avec l'utilisateur les engagements écrits (« sans publicité ni revente », « serveurs en France »).
- Tablettes 601–880 px : la pastille « Déconnexion » est cachée (le panneau de gauche porte « Me déconnecter » et 🔑).
- Pas de moyen sûr de modifier les réglages d'authentification Supabase (« Confirm email ») depuis ici : aucun jeton ; à faire à la main dans le tableau de bord (ou jeton dans `SUPABASE_ACCESS_TOKEN`).
- Ligne illisible d'un retour sur la démo : **abandonnée par l'utilisateur, ne plus en parler.**
