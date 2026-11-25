# Aide automatique à l'écoute : mesures du prototype (25/11/2026)

**Ce qui a été mesuré** : 64 lectures fabriquées par `tools/aide_ecoute_audio.py` sur 16 exercices du Zoo
(8 textes, 4 listes de mots, 4 listes de syllabes), puis passées dans `aide-ecoute.js` avec le vrai modèle
(`tools/aide_ecoute_mesure.js`, Chromium). Quatre façons de lire par exercice :
- **fluide** : voix adulte de synthèse, tout l'exercice ;
- **mot à mot, arrêt** : voix d'enfant de synthèse, un mot à la fois avec des pauses, arrêt au milieu (textes) ou à 60 s ;
- **3 erreurs + 2 répétitions** : même chose avec 3 mots mal lus (une voyelle changée : « fiche » → « fuche ») et 2 mots répétés ;
- **+ bruit de classe** : la même lecture avec un autre élève qui lit à voix basse et un souffle.

| Exercice · lecture | Dernier mot lu : exact / à 1 mot / à 2 mots | Erreurs trouvées | Fausses alertes (mots justes entourés) |
|---|---|---|---|
| texte · fluide | 100 % / 100 % / 100 % | — | 1 % |
| texte · mot à mot, arrêt | 88 % / 100 % / 100 % | — | 3 % |
| texte · erreurs + répétitions | 88 % / 88 % / 100 % | 12/24 (50 %) | 3 % |
| texte · erreurs + bruit | 50 % / 50 % / 75 % | 10/24 (42 %) | 13 % |
| mots · fluide | 100 % | — | 1 % |
| mots · mot à mot, arrêt | 100 % | — | 4 % |
| mots · erreurs + répétitions | 100 % | 2/12 (17 %) | 4 % |
| mots · erreurs + bruit | 100 % | 3/12 (25 %) | 16 % |
| syllabes · fluide | 50 % / 75 % / 75 % | — | 14 % |
| syllabes · mot à mot, arrêt | 100 % | — | 21 % |
| syllabes · erreurs + répétitions | 50 % / 100 % / 100 % | 7/12 (58 %) | 23 % |
| syllabes · erreurs + bruit | 25 % / 100 % / 100 % | 6/12 (50 %) | 27 % |

Durée : 1 à 5 s par lecture sur un ordinateur rapide (la tablette sera plus lente) ; la première fois, 45 Mo à télécharger.

## Ce qu'on peut en dire honnêtement
- **Le dernier mot lu est la partie fiable** (presque toujours juste ou à un mot près), sauf avec une autre voix
  qui lit à côté : l'aide peut alors « avancer » trop loin. C'est ce que l'aide pré-remplit en priorité.
- **Les erreurs** : environ une sur deux trouvée dans les textes, beaucoup moins dans les listes de mots.
  Les mots entourés ne comptent jamais tout seuls : le maître(sse) les confirme d'un toucher.
- **Syllabes** : trop de fausses alertes (une sur cinq) → l'aide ne propose que le dernier mot lu.
- Les mots d'une lettre (« a », « y ») ne sont jamais jugés : dits seuls, la machine ne les entend presque jamais.
- **Limites** : voix de synthèse, pas de vrais enfants (articulation, hésitations, souffle, micro de tablette) ;
  les erreurs de test sont fabriquées par changement de voyelle, et l'aide ajoute justement ce genre de
  « voisins » aux mots possibles : sur de vraies erreurs (inversions, ajouts, mots inventés), elle en trouvera moins.
  Seul un essai sur de vraies lectures dira si l'aide fait gagner du temps.

## Choix techniques retenus (après comparaison)
- Grammaire = mots de l'exercice + suites de 2–3 mots dans l'ordre + « voisins » plausibles (voyelle ou consonne
  confondue, seulement des mots connus du modèle) + `[unk]`.
- Alignement : début imposé, fin libre ; « lu »/« lue », « fée »/« fé » se valent (code phonétique grossier).
- Mots entendus écartés si confiance < 0,5 ou durée < 0,12 s (souvent une autre voix).
