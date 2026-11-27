# Salle de jeux — passation

**État au 27/11/2026.** La galerie (#400), la roue à suspense (#404), « Le Pas de la girafe » dans la salle (#407) et le masquage du cadre de roue vide sur iOS 12 (#408) sont fusionnés. Le morceau joue en boucle dans la salle. Les parties utilisent leur musique d’origine. Le rendu sur un vrai iPad ancien reste à confirmer.

## État au 26 novembre 2026

La galerie claire choisie par Gabriel est fusionnée (PR #400, `952fea4`). Le code de la galerie est visible sur le site public. Les neuf vignettes JPEG proviennent de captures des jeux du faux site local. La grille affiche deux colonnes sur téléphone et trois sur écran large.

## Fonctionnement

- Chaque jeu démarre verrouillé. L’élève confirme un achat définitif (3 pièces par défaut), puis utilise une partie à chaque lancement. La limite quotidienne continue de s’appliquer.
- L’enseignant peut changer le prix dans « Réglages généraux → Boutique ». Le prix est commun aux jeux et enregistré dans `settings.gamePrice`.
- La liste des jeux ouverts est dans `progress.arcadeUnlocked`. La déduction de pièces et le droit d’accès sont sauvegardés ensemble via `student_save_progress_v2` avec le contrôle de version existant. La galerie est partagée par Lecture et Calcul et le portefeuille est commun. Aucune migration.
- Les jeux utilisés comme exercices assignés s’ouvrent depuis la mission sans achat. Les mécanismes de récompenses et les records en jeu restent disponibles.

## Reprendre et tester

- Élève et intégration Calcul : `zoo-connecte.html` (`renderJeux`, `unlockArcadeGame`, `playGame`). Réglage : `enseignants.html`. Vignettes : `img/arcade/`. Visite guidée : `demo-tour.js`.
- Générer le site fictif avec `python3 tools/build_test_pages.py`. Vérifier sur `zoo-test.html` l’affichage des neuf images, l’annulation et le manque de pièces, l’achat, le rechargement et le lancement. Utiliser `?remed=tiles` pour vérifier l’accès à un jeu assigné. Dans `enseignants-test.html`, vérifier l’enregistrement du prix. Ces vérifications ont été faites sur navigateur simulé et les captures sont en JPEG pour les anciens appareils. Une vérification sur un vrai iPad reste à faire.
