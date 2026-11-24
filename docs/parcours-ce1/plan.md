# Parcours CE1 — plan proposé (24/11/2026, à valider par Gabriel avant tout code)

Rédigé par Claude **sans accès aux textes officiels** (education.gouv.fr et eduscol bloqués depuis la session) : chaque repère marqué ⚠️ est à vérifier dans le BO n° 41 du 31 octobre 2024 (programmes CP–CE2, applicables en CE1 à la rentrée 2025) avant de coder.

## Principe
Même architecture que le GS (cahier des charges §12) : définitions déclaratives (`ce1-data.js` ou extension de `gs-data.js`), moteur de paliers (séries réussies d'affilée, aide après 2 échecs, roue par série réussie), parcours choisi par l'enseignant (`settings.tracks[élève] = {lecture:"ce1", calcul:"ce1"}`), réglages dans Pédagogie, toile CE1 dans Ma classe. **Pas de nouvel écran élève si un écran CP existant convient** : réutiliser J'écoute, J'écris, Je lis, Je comprends avec des contenus CE1.

## Lecture CE1 (proposé)
1. **Sons complexes et lettres muettes** — reprise des graphèmes du CP les moins sûrs (ill, gn, oin, ien, eil/euil, ail, s = z, c/ç, g/ge/gu) dans J'écoute et J'écris. ⚠️ liste des graphèmes visés en CE1.
2. **Fluence** — lecture d'1 minute sur des textes CE1 (Je lis), même enregistrement validé par l'enseignant qu'au CP ; objectif de fin d'année ⚠️ (repère courant : environ 70 mots par minute en fin de CE1).
3. **Compréhension** — Je comprends avec des phrases (et non plus des mots seuls) : phrase → image, puis petite question sur un texte court.
4. **Dictée de mots et de phrases** — J'écris avec des mots outils et l'accord simple (pluriel en -s, féminin en -e) ⚠️.
5. **Vocabulaire** — corpus d'imagiers déjà en place (Corpus de mots), catégories et mots de la même famille.

## Calcul CE1 (proposé)
1. **Nombres jusqu'à 1 000** ⚠️ — Écouter (étapes par centaine, comme les dizaines actuelles : 100–199, …), « 3 chiffres : centaines, dizaines, unités ».
2. **Faits numériques** — tables d'addition jusqu'à 10 + 10 (révision), doubles et moitiés, compléments à 100 par dizaines.
3. **Tables de multiplication** ⚠️ (au moins ×2, ×5, ×10 en CE1) — nouvelle activité « Multiplication » (le moteur la prévoit déjà, non construite).
4. **Calcul réfléchi** — additions et soustractions jusqu'à 100 avec passage de dizaine (étapes existantes a6–a8, s3–s5 + nouvelles).
5. **Problèmes simples** — énoncé lu par la voix, une question, réponse à toucher (addition / soustraction, plus tard multiplication).

## Découpage en étapes (comme le GS)
- A. Architecture CE1 activable (sélecteurs « CE1 » ouverts, aucun contenu → message « bientôt » côté élève) + toile vide.
- B. Calcul CE1 : nombres jusqu'à 1 000 (réutilise Écouter, aucune migration : le serveur accepte tout identifiant d'étape).
- C. Calcul CE1 : multiplication (nouvelle activité : migration de `lab_student_submit_round` pour l'activité « multiplication »).
- D. Lecture CE1 : contenus (sons, textes, phrases de compréhension) dans les écrans existants.
- E. Suivi, toile CE1, réglages ; recette comme `tools/test_gs_recette.js`.

## Décisions à prendre avec Gabriel
1. Commencer par le calcul (plus simple à construire) ou par la lecture ?
2. Textes de lecture CE1 : écrits par Gabriel, ou proposés par Claude puis relus ?
3. Vérification des repères ⚠️ : Gabriel colle la partie CE1 du BO, ou autorise `www.education.gouv.fr` et `eduscol.education.gouv.fr` dans l'environnement « fluence-cp » (Réglages des environnements Claude) pour que Claude les lise.
