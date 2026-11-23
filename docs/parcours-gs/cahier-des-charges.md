# Cahier des charges — Zoo de Lecture & Zoo de Calcul : parcours GS, CP et CE1

Version 1.0 — 23 novembre 2026 — fourni par Gabriel (texte de référence, ne pas réécrire ; le suivi est dans `avancement.md`).
Statut : spécification fonctionnelle validée pour développement, sous réserve d'audit technique préalable.
Application : zoodelecture.fr · Public : GS, CP et, à terme, CE1 · Priorité : compatibilité totale avec l'existant.

Recommandation de Gabriel : réaliser d'abord un **prototype complet d'une seule activité GS Lecture** (progression, aide, validation, roue, suivi enseignant), le faire valider, puis le réutiliser pour les autres activités.

## 1. Objectif
Proposer à chaque élève des activités à son niveau réel. Niveau attribué indépendamment par domaine : Lecture GS/CP/CE1, Calcul GS/CP/CE1. Le CP actuel reste entièrement opérationnel et inchangé. Le GS est développé avec les activités ci-dessous. Le CE1 est anticipé dans l'architecture mais non activable tant qu'aucune activité n'existe.

Principes : 1) l'enseignant décide du parcours de chaque élève ; 2) l'élève ne choisit jamais son niveau ; 3) lecture et calcul indépendants ; 4) progression automatique fondée sur les réussites ; 5) activités paramétrables par l'enseignant ; 6) récompenses communes à tous les parcours ; 7) aucun historique supprimé lors d'un changement de niveau ; 8) utilisable en autonomie par un enfant de 5 à 7 ans ; 9) aucune régression du CP.

## 2. Audit technique préalable obligatoire
Inspecter le dépôt et Supabase : architecture, authentification élève/enseignant, classes/élèves, stockage des progressions, paramètres CP, règles de validation, roue/pièces, boutique/achats, animaux/avatars/niveaux, graphiques de suivi, fonctions serveur/RLS, sauvegarde et reprise de séance. **Réutiliser les mécanismes existants ; pas de deuxième architecture parallèle.** Avant toute migration : vérifier les dépendances, prévoir un retour arrière. Les noms du document sont conceptuels.

## 3. Gestion des parcours par élève
3.1 Fiche de chaque élève : sélecteur « Parcours Lecture » (GS, CP par défaut, CE1 visible mais désactivé) et « Parcours Calcul » (idem). Changement possible à tout moment par l'enseignant.
3.2 Modification collective : sélectionner plusieurs élèves et modifier lecture seule, calcul seul ou les deux ; confirmation avant ; les non-sélectionnés ne changent pas.
3.3 Conservation : résultats, compétences, statistiques, récompenses, pièces, achats, animaux et avatars conservés ; retour sur un parcours déjà utilisé = progression retrouvée ; jamais de réinitialisation automatique.
3.4 Élève : jamais de choix GS/CP/CE1 ; chaque domaine ouvre directement le parcours attribué ; aucune étiquette stigmatisante (« niveau GS », « faible ») ; identité visuelle actuelle.

## 4. Parcours GS — Lecture (un rituel + six familles ; aucune lecture autonome requise)
4.1 **Rituel : comptine alphabétique** — 1ʳᵉ séance : capsule animée 20–40 s, capitales associées à leur nom oral, dans l'ordre, voix française claire adaptée aux enfants. Ensuite facultative, petit bouton pour la revoir. Ne valide rien, pas de roue. Légère, compatible tablettes, premier toucher possible pour démarrer le son, pas de dépendance à la vidéo.
4.2 **Nom des lettres en capitales** — la voix dit une lettre, plusieurs capitales, l'élève touche la bonne, retour immédiat, question suivante. Niveaux : 2, 3, 4 propositions. Lettres introduites par petits groupes ; distracteurs pertinents (proches visuellement ou phonologiquement) ; position de la bonne réponse variable ; réécoute à volonté.
4.3 **Ordre alphabétique** — courte séquence à remettre dans l'ordre (C—A—B → toucher A, B, C). 3, 4, 5 lettres puis plus selon paramétrage ; jamais les 26 d'emblée ; touches successives plutôt que glisser-déposer ; tenir compte des lettres introduites.
4.4 **Association capitales / script** — capitale → choisir le script (et sens inverse). 2, 3, 4 propositions ; introduction progressive des lettres aux graphies plus différentes.
4.5 **Nom des lettres en script** — comme 4.2 en script ; police pédagogique aux formes non ambiguës.
4.6 **Association script / cursive** — (et inverse). **Vraie police cursive scolaire française**, pas une police décorative ; vérifier les lettres confondables.
4.7 **Nom des lettres en cursive** — comme 4.2 en cursive, 2 à 4 propositions.
4.8 **Organisation** — ne pas exiger les 26 capitales avant le script ; petits groupes configurables ; pour chaque groupe : capitales → capitale/script → script → script/cursive → cursive. Ordre alphabétique = compétence transversale. **Groupes non figés dans le code** : configuration modifiable (lettres par groupe, ordre d'introduction, écritures autorisées, activités disponibles, conditions de déblocage) avec une progression initiale par défaut.

## 5. Parcours GS — Calcul (un rituel + cinq familles)
5.1 **Rituel : comptine numérique 1–20** — animation 20–40 s, comptine entendue, nombres affichés progressivement, voix claire ; facultative ensuite (petit bouton) ; pas de récompense.
5.2 **Reconnaissance des chiffres** — la voix dit un nombre, l'élève choisit le chiffre. Paliers obligatoires : 1–3, 1–5, 0–9 (zéro introduit explicitement au palier 3 avec exemples). 2 à 4 propositions.
5.3 **Ordre des nombres** — nombres mélangés à toucher dans l'ordre croissant (3—1—2 → 1, 2, 3). Intervalles 1–3, 1–5, 0–9 ; consécutifs puis non consécutifs.
5.4 **Dénombrement** — collection d'animaux/objets, choisir le nombre parmi plusieurs. 1–3, 1–5, 0–9. Dispositions variées (alignés, désordre, rapprochés, espacés, organisés) ; objets grands et distincts ; ne pas confondre difficulté de dénombrement et de manipulation.
5.5 **Comparaison de quantités** — deux collections, consigne orale « Où y en a-t-il le plus ? » / « le moins ? ». 1–3, 1–5, 0–9. Varier tailles, espacements, dispositions (pas de réponse par la surface). « Autant » seulement dans un palier prévu ; jamais de comparaison ambiguë.
5.6 **Construction d'une collection** — nombre affiché + voix « Mets cinq animaux dans l'enclos. » ; toucher pour ajouter, retoucher ou bouton pour retirer, puis valider. 1–3, 1–5, 0–9 ; zéro = valider un enclos vide.

## 6. Moteur de progression commun (GS ; ne pas remplacer les règles CP sans nécessité)
6.1 Unités : domaine, parcours, compétence, activité, palier, série d'évaluation, tentative, validation. Une activité peut couvrir plusieurs groupes de lettres ou paliers numériques.
6.2 Déblocage automatique après prérequis ; dépendances configurables ; pas strictement linéaire (compétences en parallèle possibles) ; toujours **une action principale** clairement identifiable.
6.3 **Validation par défaut : ≥ 80 % sur deux séries distinctes** (8/10 puis 9/10 = validé ; 9/10 puis 6/10 = non validé). Séries différentes, pas les mêmes questions dans le même ordre. Défauts : 10 questions si le contenu le permet, seuil 80 %, 2 séries, réécoute illimitée, pas de chronomètre. Nombre de questions, seuil et nombre de séries modifiables par l'enseignant. Petits ensembles : éviter les séries répétitives (adapter le nombre de questions, varier distracteurs et présentations).
6.4 Erreur : retour bref, sans sanction agressive ; ne pas montrer tout de suite une réponse qui rend la tentative suivante triviale. **Après deux séries échouées sur le même palier** : aide automatique (moins de propositions si pertinent, indice visuel ou oral, démonstration guidée, retour progressif au niveau normal). L'aide ne valide jamais : la validation se fait sur des séries non assistées. Jamais bloqué sur un écran d'échec ; reprise de l'entraînement, retour à un palier antérieur si besoin.
6.5 Chaque série enregistre : élève, domaine et parcours, compétence, palier, questions, réponses, bonnes réponses, seuil, aide éventuelle, date/heure, réussite. Répéter un exercice ne crée pas de validations multiples injustifiées.
6.6 Reprise : garder les acquis, ne rien perdre, jamais deux fois la même récompense, reprendre à une étape cohérente (comportement précis à définir après inspection).

## 7. Récompenses et gamification
Conserver intégralement roue, pièces, boutique, achats, animaux, avatars, jeux. 7.1 **Roue proposée après chaque série réussie** (seuil atteint), jamais après une série échouée ; la validation complète n'est pas nécessaire. 7.2 Une seule récompense par série réussie, enregistrée de façon fiable (rechargement, reconnexion) ; réutiliser l'anti-duplication existante. 7.3 Même solde de pièces quel que soit le parcours ; achats jamais supprimés ; distinguer animaux de progression et objets/animaux acquis ; ne pas modifier probabilités, montants, règles économiques sans validation.

## 8. Interface élève et UX
Enfant de GS en autonomie, tablette tactile en priorité. Une seule action principale par étape ; 2–3 décisions au plus. Éviter menus complexes, consignes écrites indispensables, longs écrans, boutons concurrents, confirmations inutiles, gestes fins, changements d'écran inutiles. Chaque activité : consigne orale courte, bouton réécouter, exemple guidé quand l'activité est nouvelle, retour sonore et visuel cohérent ; sons désactivables. Grandes zones tactiles espacées ; pas d'information par la seule couleur ; états clairs (sélectionné, correct, incorrect, désactivé). Écran : haut = consigne audio + répéter ; centre = activité ; bas = validation seulement si nécessaire ; navigation secondaire discrète. Choix simple = un toucher ; ordre/construction = validation explicite si nécessaire. Animations courtes, réduction des mouvements respectée, jamais sur les éléments interactifs.

## 9. Interface enseignant
9.1 Sélecteurs dans les fiches élèves, modification collective, CP par défaut (existants et nouveaux), parcours actifs clairement visibles.
9.2 Paramétrage GS cohérent avec le CP : par activité, selon sa nature, activation, nombre de questions, seuil, séries nécessaires, nombre de propositions, groupes de lettres, paliers numériques, ordre/dépendances, difficulté initiale, conditions de déblocage ; valeurs conseillées, rien d'obligatoire.
9.3 Opérationnel dès la création d'une classe ; bouton « restaurer les valeurs recommandées » sans jamais supprimer de résultats ; validation ou recalcul contrôlé si un réglage rend une progression incohérente.
9.4 Isolation existante entre enseignants et classes ; paramètres dans leur périmètre réel (enseignant, classe ou élève).

## 10. Suivi des progressions
10.1 Suivis indépendants GS Lecture, CP Lecture, GS Calcul, CP Calcul (CE1 à prévoir) ; données jamais mélangées.
10.2 Radars (toile existante). **GS Lecture** : capitales, ordre alphabétique, capitale/script, script, script/cursive, cursive. **GS Calcul** : chiffres, ordre numérique, dénombrement, comparaison, construction. Les rituels ne sont pas des axes.
10.3 Radars = compétences maîtrisées (proportion de paliers/objectifs validés), jamais 100 % pour une seule série réussie ; distinguer non commencé, en cours, maîtrisé, en difficulté.
10.4 Par compétence : niveau atteint, dernières séries, taux de réussite, aides déclenchées, dates de validation ; synthétique par défaut, détails à la demande.

## 11. Architecture des données
11.1 Entités indicatives : affectation de parcours (élève, domaine, parcours, date) ; définition pédagogique (domaine, parcours, compétence, activité, palier, configuration par défaut, prérequis) ; paramétrage (périmètre enseignant/classe/élève, activité, valeurs, version) ; progression (élève, domaine, parcours, compétence, palier, statut, dates) ; tentative (élève, série, questions/réponses, score, aides, date, résultat) ; récompense (série réussie, récompense, statut). **Étendre l'existant plutôt que créer des tables.**
11.2 Migration : préserver identifiants, classes, comptes, résultats CP, pièces, achats, récompenses ; CP par défaut dans les deux domaines ; aucune réinitialisation ; migrations reproductibles, contrôlées, testées.
11.3 Sécurité : un élève ne peut ni changer son parcours, ni modifier ses scores, ni débloquer arbitrairement, ni ajouter des pièces, ni déclencher plusieurs récompenses pour une réussite. Vérifier la RLS ; jamais de clé de service dans le navigateur.

## 12. CE1 — préparation
Visible « À venir », non activable, aucune activité fictive ; l'architecture doit permettre d'ajouter compétences, types d'exercices, paliers, règles et radars sans refonte.

## 13. Performances et compatibilité
iPad et Android, smartphones récents, ordinateurs. Fluide sur appareils scolaires ; audio, animations, illustrations, chargements et requêtes optimisés ; pas de téléchargements lourds ; états de chargement et messages d'erreur compréhensibles ; ne pas dégrader l'existant.

## 14. Plan de développement
Phase 0 audit et sécurisation · Phase 1 architecture multi-parcours (affectation, individuel/collectif, historiques, CE1 non activable) · Phase 2 moteur GS (compétences, paliers, séries, validation, déblocage, aide) · Phase 3 activités GS Lecture · Phase 4 activités GS Calcul · Phase 5 récompenses et suivi (roue, économie, radars, historique, paramétrage) · Phase 6 tests et déploiement (unitaires, intégration, permissions, migration, non-régression CP, tablette, validation pédagogique, déploiement progressif).

## 15. Critères d'acceptation
T01 un élève CP existant retrouve exactement son parcours et ses résultats · T02 GS Lecture + CP Calcul possible · T03 modification collective sans effet sur les autres · T04 CP → GS → CP restitue la progression CP · T05 rituel à la 1ʳᵉ séance puis facultatif · T06 un non-lecteur comprend et répond · T07 une seule série à 80 % ne valide pas une compétence à deux séries · T08 deux séries réussies débloquent la suite · T09 deux séries échouées déclenchent une aide · T10 série réussie = roue, échouée = pas de roue · T11 recharger ne redonne pas la même récompense · T12 les radars GS ne montrent que les compétences du parcours · T13 l'enseignant modifie les paramètres et restaure les valeurs recommandées · T14 CE1 visible non activable · T15 un élève ne peut changer ni son parcours ni ses récompenses · T16 comptes, classes, boutique, animaux, jeux et CP fonctionnent toujours · T17 réalisable sur tablette sans lecture ni geste complexe · T18 une interruption ne supprime pas les acquis ni ne duplique les récompenses.

## 16. Instructions finales
1 inspecter le code réel ; 2 réutiliser l'existant ; 3 ne pas réécrire le CP ; 4 ne pas modifier l'économie ; 5 ne pas supprimer de données ; 6 ne pas multiplier écrans et menus ; 7 configuration pédagogique déclarative plutôt que règles en dur ; 8 isolation enseignants/classes ; 9 tester les migrations avant production ; 10 prévoir un retour arrière ; 11 documenter les nouvelles structures ; 12 livrer progressivement en vérifiant la compatibilité à chaque étape.
Résultat attendu : extension GS complète, pédagogique, motivante et intuitive, intégrée naturellement, sans rupture de l'expérience actuelle. Priorité absolue : préserver l'existant.
