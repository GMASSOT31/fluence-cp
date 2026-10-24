# Laboratoire privé « Zoo de Calcul » (phase 1)

Ce dossier ne contient que de la documentation. Les fichiers du labo : `labo-calcul.html` (élève), `labo-calcul-enseignant.html` (enseignant/admin),
`labo-config.js` (interrupteur navigateur), `calcul/zoo-skin.css` (habillage du Zoo de Lecture, **généré** : `python3 tools/extract_zoo_skin.py`), `labo-switch.js` (bouton Lecture | Calcul), `calcul/engine.js` (questions), `calcul/voice.js` (voix),
`supabase/migrations/20261112_labo_calcul.sql` (base, appliquée) et `20261113_labo_collections.sql` (nombres reconnus et calculs gagnés) et `20261114_labo_monnaie_commune.sql` (monnaie commune, interrupteur `shared_wallet`).

## Qui a accès ?
Seulement les comptes listés dans la table `lab_access` (identifiants internes), **et** seulement si l'interrupteur serveur est activé.
* Enseignant : autorisé lui-même ; avec `scope = self_and_students`, ses élèves le sont aussi (utile pour les enfants dans votre classe de test).
* Élève : autorisé nommément (`scope = self`).
* L'administrateur (`teachers.role = 'admin'`) a toujours accès quand le labo est activé, et seul il gère la liste (onglet « Accès au laboratoire »).
Toute fonction vérifie l'autorisation **dans la base** (fonctions `SECURITY DEFINER`, tables sans droit direct). Une page cachée ou `robots.txt` ne protègent rien :
les fichiers du labo sont publics sur GitHub Pages, seules les **données et les actions** sont protégées. Réponse uniforme « Accès refusé » (aucune fuite d'information).

## Interrupteurs
| Où | Comment | Effet |
|---|---|---|
| Serveur (le vrai) | page « Accès au laboratoire › Désactiver », ou `update public.app_settings set value='{"enabled":false}' where key='lab_calcul';` | plus personne n'a accès, données conservées |
| Navigateur | `enabled:false` dans `labo-config.js` | pages du labo « indisponibles », `labo-switch.js` ne fait aucune requête |
| Retrait complet | supprimer `labo-*`, `calcul/`, les 2 balises `labo-config.js`/`labo-switch.js` de `zoo-connecte.html` et `enseignants.html`, puis (si voulu) supprimer à la main les tables `lab_*` et les fonctions `lab_*` dans Supabase | le site revient exactement à l'état d'avant |

La migration crée l'interrupteur **désactivé** : après application, l'admin l'active depuis la page enseignant du labo.

## Animaux et progression (comme le Zoo de Lecture)
Chaque étape a son animal, du plus lent au plus rapide : plus l'étape validée est haute, plus l'animal court vite (nombres : 🐌 escargot → 🐆 guépard ; addition : 🐜 fourmi → 🦁 lion ; soustraction : 🐊 crocodile → 🦌 cerf ; vitesses « environ » dans `calcul/engine.js`). Un œuf 🥚 éclot quand l'étape est réussie, l'animal grandit (✨) quand elle est maîtrisée. Les menus « J'écoute un nombre », « ADDITION » et « SOUSTRACTION » ne montrent que les étapes **réussies + la suivante** (l'ordre et le choix des étapes restent réglables par l'enseignant). « Mes nombres lus » et « Mes calculs gagnés » montrent les animaux (❓ tant que l'étape n'est pas atteinte).

## Boutique et salle d'arcade : espaces partagés
Dans le Zoo de Calcul, « Boutique » et « JOUER » ouvrent **les vrais écrans du Zoo de Lecture** (`zoo-connecte.html?vue=boutique` ou `?vue=jeux`) : mêmes contenus, mêmes effets, mêmes pièces et parties. Seul changement dans `zoo-connecte.html` : ce paramètre `vue` (valeurs `boutique` ou `jeux` seulement, sinon l'accueil habituel).
Les pièces gagnées en calcul vont dans le vrai portefeuille quand l'interrupteur serveur `shared_wallet` est activé : le serveur les met de côté (`student_progress.pending_coins`, une seule fois par série grâce à `round_id`, jamais dans `progress` ni `sync_version`) et la page les reprend aussitôt avec `student_claim_coins`, comme un cadeau. Interrupteur : `update public.app_settings set value = '{"enabled": true, "shared_wallet": true}' where key = 'lab_calcul';` (mettre `false` pour revenir aux pièces de test). L'ancienne boutique de test (`lab_student_buy_play` / `lab_student_use_play`) n'est plus utilisée.

## Interface élève
Mêmes repères que le Zoo de Lecture (bandeau, panneau gauche, panneau droit, barre du bas sur téléphone, boutique, salle d'arcade), couleur dominante verte. L'avatar et le prénom sont **lus** dans le Zoo de Lecture (lecture seule, rien n'y est écrit) ; pour changer d'avatar, on retourne dans Lecture. « Niveau » = niveaux réussis ; « Nombres » = nombres reconnus du premier coup ; « Mes calculs gagnés » = calculs réussis du premier coup.

## Données (toutes séparées de la lecture)
`lab_access` (liste blanche) · `lab_calc_progress` (résultats de calcul + **pièces et droits de jeu de TEST**) · `lab_calc_rounds` (une ligne par série, clé `student_id + round_id` = pas de double crédit) · `lab_calc_ops` (échanges de test, idem) · `lab_calc_settings` (réglages enseignant).
Aucune écriture dans `student_progress`, `students`, `teachers`, `classes` ; aucune fonction existante modifiée. Retirer un accès ne supprime rien : la ligne de `lab_access` est marquée `revoked_at`. Pas de clé étrangère : la suppression d'un vrai compte n'est jamais bloquée.
Pièces (de test, ou réelles si `shared_wallet`) : calculées par le serveur (80 % de réussite du premier coup → 1 ; 100 % → 2 ; au moins 5 questions ; 10 séries récompensées par jour au plus).

## Variables / réglages à connaître
Pas de variable d'environnement. Réglages enseignant (`lab_calc_settings.settings`) : `questions` (5–20), `pass` (50–100 %), `voice` (lecture automatique), `levels` (`nombres`, `addition`, `soustraction` : listes d'identifiants de niveau). Valeurs bornées côté serveur.

## Ce que mesurent les résultats
* **Séries** : séries terminées par niveau. **Premier essai** : % de questions réussies du premier coup (indicateur principal). **Réécoutes** : nombre de réécoutes d'un nombre (repère). **Aides** : questions où la bande des nombres a été ouverte.
* **Statut** : 🕒 À travailler (séries, aucune réussie) · ✓ Réussi (≥ 1 série au seuil) · ⭐ Maîtrisé (≥ 2 séries au seuil).
* Aucune vitesse en phase de découverte. Aucun lien avec les indicateurs de lecture (mclm, sons, étapes).

## Progression
Reconnaissance (11 niveaux n1–n11) : 0–10 · 11–16 · 17–20 · 20–59 · « 13 ou 30 ? » · 60–69 · 70–79 · 80–89 · 90–99 · 0–99 · jusqu'à 100.
Additions (a1–a8) : +1/+2 · jusqu'à 10 (images) · jusqu'à 10 (tête) · pour arriver à 10 · doubles · jusqu'à 20 sans passer la dizaine · passer la dizaine · dizaines/unités.
Soustractions (s1–s5) : −1/−2 · jusqu'à 10 · jusqu'à 20 sans passer · passer la dizaine · écart.
Ouverts par défaut : tous les niveaux de reconnaissance, a1–a4, s1–s2 (les autres sont activables par l'enseignant). Multiplication : non construite.
**Références à confirmer sur Eduscol** (les textes officiels n'ont pas pu être ouverts depuis l'environnement de développement) : programme de mathématiques du cycle 2, BO n° 41 du 31 octobre 2024 (applicable à la rentrée 2025) ; livret d'accompagnement Mathématiques CP 2025 (Eduscol).

## Tests
* `sh tools/sql/run_labo_tests.sh` : migration + 69 contrôles sur un PostgreSQL local jetable (schéma factice), jamais sur Supabase.
* `node tools/test_calcul_engine.js` : moteur (distracteurs sans doublon, dans le champ, confusions attendues, niveaux).
* `python3 tools/build_test_pages.py` puis `labo-calcul-test.html` / `labo-calcul-enseignant-test.html` (faux serveur `tools/fake-labo.js`, options dans son en-tête).

## Pour passer à la suite (décisions de Gabriel)
1. Essai de la migration dans une transaction annulée sur la vraie base, puis accord, application, vérification en lecture seule.
2. Choisir les comptes testeurs dans l'onglet « Accès au laboratoire » (par identifiant).
3. Portefeuille commun (phase ultérieure) : table de mouvements `wallet_ledger(student_id, source, ref_id, amount, unique(source, ref_id))` ; les pièces de test ne sont **jamais** converties automatiquement.
