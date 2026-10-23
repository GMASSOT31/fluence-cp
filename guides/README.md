# Guides pédagogiques de Zoo de Lecture

Chaque guide est une page statique, une par dossier : `guides/<nom-du-guide>/index.html` (adresse publique : `https://zoodelecture.fr/guides/<nom-du-guide>/`).

## Ajouter un guide en 6 étapes
1. Copier `guides/ateliers-lecture-cp/` en `guides/<nouveau-nom>/` (nom court, minuscules, tirets, par exemple `syllabes-lecture-cp`).
2. Dans le nouveau `index.html`, changer : `<title>`, `meta description`, `canonical`, les balises `og:` et `twitter:` (titre, description, adresse), le bloc `application/ld+json` (titre, description, date, adresse), le `<h1>`, la date « Publié le … » et le texte.
3. Garder un seul `<h1>`, des `<h2>` descriptifs, au moins une illustration originale avec texte alternatif, 2 à 3 liens vers d'autres guides et un lien de retour vers l'accueil. Ne citer que des fonctions réellement présentes dans le site (voir `CLAUDE.md`).
4. Ajouter une carte dans la liste `<ul class="res">` de `index.html` (section « Ressources pour enseigner la lecture au CP »).
5. Ajouter l'adresse dans `sitemap.xml`.
6. Tester (`python3 tools/build_test_pages.py` puis ouvrir `guides/<nom>/` en local, aussi à 375 px de large), puis une branche `claude/guide-<nom>`, une PR, et une fusion après accord.

## Partage
Le bouton « Partager Zoo de Lecture » est géré par `share.js` : il suffit de garder le bloc `<div class="share" data-share>…</div>` de l'exemple. Feuille de partage native sur téléphone et tablette ; sinon WhatsApp, e-mail et « Copier le lien ».

## Règles
Aucun traceur ni mesure d'audience (voir `confidentialite.html`). Pas de témoignage inventé. Pas de promesse de résultat pédagogique.
