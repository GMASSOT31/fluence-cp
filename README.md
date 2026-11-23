# Zoo de Lecture

Application pédagogique statique pour la lecture et le calcul au CP.

Pour reprendre le développement, lire [CLAUDE.md](CLAUDE.md) et [les outils de test](tools/README.md).

## Publier gratuitement avec GitHub Pages

1. Ouvrir **Settings > Pages** dans ce dépôt GitHub.
2. Dans **Build and deployment**, sélectionner **Deploy from a branch**.
3. Choisir la branche **main**, le dossier **/(root)**, puis **Save**.
4. Attendre la publication à l’adresse : https://zoodelecture.fr/ (domaine OVH ; l’ancienne adresse https://gmassot31.github.io/fluence-cp/ redirige automatiquement)

Chaque modification sur la branche `main` est ensuite publiée automatiquement.

## Pages

- `index.html` : page d’accueil de zoodelecture.fr (présentation, accès élève, enseignant et démo).
- `mentions-legales.html`, `confidentialite.html` : pages légales.
- `img/` : captures utilisées par la page d’accueil.
- `eleve.html` : connexion élève (code de classe, prénom, PIN), puis `zoo-connecte.html` (le Zoo, sauvegardé sur Supabase).
- `enseignants.html` : espace enseignant et administration.
- `zoo-local.html` : ancienne version du Zoo, sans serveur (données dans le navigateur). Plus utilisée, gardée pour mémoire.

La progression des comptes élèves est sauvegardée dans Supabase. Le navigateur conserve notamment la liste des profils mémorisés sur l’appareil. Les enregistrements de lecture restent sur l’appareil qui les a capturés, jusqu’à leur écoute et validation par l’enseignant.
