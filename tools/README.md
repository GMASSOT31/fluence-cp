# Outils de test (pour le développement, pas pour les élèves)

Rien ici ne touche à la vraie base Supabase : tout tourne dans le navigateur avec de faux serveurs.

| Fichier | Rôle |
|---|---|
| `fake-supabase.js` | Faux serveur du **Zoo élève** : progression, réglages enseignant, scores et records (même règle de pièces que le serveur : 1 objectif, 3 record perso battu, 10 record pris à un camarade, la plus haute seulement), cadeaux, bons. Options d'URL : `?lirecartes=1`, `?sanscode=1`, `?illimite=1`, `?prix4=1`. Expose `window.__srv`. |
| `fake-auth.js` | Faux serveur de l'**espace enseignant** et de la **connexion élève** : classes, élèves, progression, feedback, quotas, ghost/suppression, PIN. Admin par défaut (`?teacher=1` pour un compte enseignant). Expose `window.__auth`. Connexion élève acceptée avec le PIN `4321`. |
| `build_test_pages.py` | Fabrique `tools/test-site/` (ignoré par git) : pages de test branchées sur les faux serveurs, plus des copies réelles du site pour tester la démo (`?demo=1&new=1`). |
| `check_syntax.py` | Vérifie la syntaxe JavaScript des pages et scripts (Node si installé, sinon le moteur JavaScript de macOS). |
| `check-syntax-macos.js` | Petit script utilisé par `check_syntax.py` sur macOS (`osascript -l JavaScript`). |

## Utilisation (depuis la racine du dépôt)

```
python3 tools/check_syntax.py
python3 tools/build_test_pages.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory tools/test-site
```

Puis ouvrir dans le navigateur :
- `http://localhost:8765/zoo-test.html?lirecartes=1` : Zoo élève (avec `window.__t` pour accéder aux fonctions internes)
- `http://localhost:8765/enseignants-test.html` : espace enseignant
- `http://localhost:8765/zoo-connecte.html?demo=1&new=1` : la démo sans compte, avec sa visite guidée

## Habitudes de test

- Après toute modification de la salle de jeux : relancer les 8 jeux.
- Vérifier aussi l'affichage téléphone (375 × 667).
- Quand on modifie `demo.js` ou `demo-tour.js`, augmenter leur numéro de version (`demo.js?v=…` dans les deux pages, `demo-tour.js?v=…` dans `demo.js`) pour contourner le cache des navigateurs.
- Migrations Supabase : d'abord un essai dans une transaction annulée (`raise exception 'DRYRUN_RESULT …'`), puis application seulement avec l'accord explicite de la personne responsable du projet, et ajout du fichier dans `supabase/migrations/`.
