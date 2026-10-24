# Laboratoire privé « Zoo de Calcul » (phase 1)

Ce dossier ne contient que de la documentation. Les fichiers du labo : `labo-calcul.html` (élève), `calcul/enseignant.js` (espace enseignant/admin, **intégré à `enseignants.html`** ; `labo-calcul-enseignant.html` n'est plus qu'une redirection),
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

La migration crée l'interrupteur **désactivé** : après application, l'admin l'active depuis l'espace enseignant (onglet « Enseignants » › Accès au laboratoire de calcul).

## Animaux et progression (comme le Zoo de Lecture)
Chaque étape a son animal, du plus lent au plus rapide : plus l'étape validée est haute, plus l'animal court vite (nombres : 🐌 escargot → 🐆 guépard ; addition : 🐜 fourmi → 🦁 lion ; soustraction : 🐊 crocodile → 🦌 cerf ; vitesses « environ » dans `calcul/engine.js`). Un œuf 🥚 éclot quand l'étape est réussie, l'animal grandit (✨) quand elle est maîtrisée. Les menus « ÉCOUTER », « ADDITION » et « SOUSTRACTION » ne montrent que les étapes **réussies + la suivante** (l'ordre et le choix des étapes restent réglables par l'enseignant). « Mes nombres lus » et « Mes calculs gagnés » montrent les animaux (❓ tant que l'étape n'est pas atteinte).

## Bandeau et scène d'évolution
Les trois animaux du bandeau sont ceux de la première étape (🐌), de l'étape du milieu (🐕) et de la dernière (🐆) de « ÉCOUTER » ; ils flottent doucement (désactivé si l'appareil demande moins d'animations). Quand une étape est réussie (l'œuf éclot) puis maîtrisée (l'animal grandit), la **même scène d'évolution que le Zoo de Lecture** s'affiche : œuf qui bouge, éclair, rayons, feu d'artifice, sons et voix, deux étoiles. Le style (`calcul/zoo-skin.css`) et les effets (`calcul/zoo-effects.js` : sons, feu d'artifice) sont **générés** à partir de `zoo-connecte.html` par `python3 tools/extract_zoo_skin.py` ; les réglages de sons de l'enseignant (`sfx`) sont respectés.

## Boutique et salle d'arcade : espaces partagés
Dans le Zoo de Calcul, « Boutique » et « JOUER » affichent, **dans le panneau central**, les vrais écrans du Zoo de Lecture : un cadre (`<iframe id="zoo-frame">`) charge `zoo-connecte.html?vue=boutique|jeux&integre=1`. Mêmes contenus, mêmes effets, mêmes pièces et parties ; le bandeau vert, les panneaux et la barre du bas restent ceux du calcul.
* `zoo-embed.js` (chargé par `zoo-connecte.html`) ne fait **rien** sans `?integre=1` et hors d'un cadre. Dans le cadre, il masque bandeau, panneaux et barre du bas du Zoo de Lecture et prévient la page parente (même origine uniquement) des pièces/parties et des parties en cours ; pendant une partie le cadre passe en plein écran.
* Le cadre prend la hauteur visible, pour que les fenêtres du Zoo (confirmation d'achat, résultats, cadeau) restent à l'écran.
* Autres modifications de `zoo-connecte.html` : la balise `zoo-embed.js` et le paramètre `?vue=` (valeurs `boutique` ou `jeux` seulement, sinon l'accueil habituel).
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
À chaque question de « ÉCOUTER », **6 propositions** quand le niveau compte au moins 6 nombres (sinon tous les nombres du niveau, par exemple 4 pour « 17 à 20 »), **toutes prises parmi les nombres du niveau** : l'élève ne voit jamais un nombre qu'il n'a pas à connaître à ce stade. Les propositions les plus proches d'une vraie confusion passent en premier (nombres voisins, inversion des chiffres, ressemblances à l'oral comme 13/30), le reste est complété avec les autres nombres du niveau.
Additions (a1–a8) : +1/+2 · jusqu'à 10 (images) · jusqu'à 10 (tête) · pour arriver à 10 · doubles · jusqu'à 20 sans passer la dizaine · passer la dizaine · dizaines/unités.
Soustractions (s1–s5) : −1/−2 · jusqu'à 10 · jusqu'à 20 sans passer · passer la dizaine · écart.
Ouverts par défaut : tous les niveaux de reconnaissance, a1–a4, s1–s2 (les autres sont activables par l'enseignant). Multiplication : non construite.
**Références à confirmer sur Eduscol** (les textes officiels n'ont pas pu être ouverts depuis l'environnement de développement) : programme de mathématiques du cycle 2, BO n° 41 du 31 octobre 2024 (applicable à la rentrée 2025) ; livret d'accompagnement Mathématiques CP 2025 (Eduscol).

## Tests
* `sh tools/sql/run_labo_tests.sh` : migration + 69 contrôles sur un PostgreSQL local jetable (schéma factice), jamais sur Supabase.
* `node tools/test_calcul_engine.js` : moteur (distracteurs sans doublon, dans le champ, confusions attendues, niveaux).
* `python3 tools/build_test_pages.py` puis `labo-calcul-test.html` (élève) et `enseignants-test.html?role=admin|teacher|refuse` (enseignant ; faux serveur `tools/fake-labo.js` + `fake-labo-fetch.js`, options dans l'en-tête).

## Pour passer à la suite (décisions de Gabriel)
1. Essai de la migration dans une transaction annulée sur la vraie base, puis accord, application, vérification en lecture seule.
2. Choisir les comptes testeurs dans l'onglet « Enseignants » (carte « Accès au laboratoire de calcul ») (par identifiant).
3. Portefeuille commun (phase ultérieure) : table de mouvements `wallet_ledger(student_id, source, ref_id, amount, unique(source, ref_id))` ; les pièces de test ne sont **jamais** converties automatiquement.

## Espace enseignant intégré
`labo-switch.js` (déjà chargé par `enseignants.html`) demande `lab_my_access` ; seulement si le compte est autorisé il charge `calcul/enseignant.js` (aucun appel ni style de plus pour les autres). Le module ajoute une bascule « Lecture | Calcul » dans le menu : en mode Calcul (mémorisé dans le navigateur) le bandeau devient « Zoo de Calcul » (accent vert), « À écouter » disparaît, et « Progression » / « Réglages péda » affichent les versions calcul (mêmes composants que la lecture) ; l'admin trouve l'interrupteur et la liste des accès dans l'onglet « Enseignants ». `enseignants.html` n'est pas modifié ; retour en Lecture = page d'origine. Aucune migration.

## Demandes d'accès des enseignants (migration 20261115, appliquée)
Un enseignant sans accès (labo activé) voit un bouton « ➕ Essayer le Zoo de Calcul » au-dessus du menu (`labo-switch.js`) ; il appelle `lab_request_access()` (table `lab_requests`, une ligne par enseignant, jamais supprimée ; une nouvelle demande n'est possible qu'1 jour après le traitement de la précédente). L'admin voit une pastille « 🧪 N » sur l'onglet « Enseignants » et, dans la carte « Accès au laboratoire de calcul », les demandes avec **Accepter** (accès pour lui et ses élèves, note « Sur demande ») ou **Refuser** (`lab_admin_decline`). Aucune notification par e-mail.

## Aides pédagogiques (UX-01 à 03)
« 🧩 Je m'aide » (facultative, comptée dans les « aides », jamais comme une erreur) : addition qui passe la dizaine = deux sauts colorés « 8 + 2 = 10 · il reste 1 · 10 + 1 = 11 » (phrase dite à voix haute) ; étape « Combien d'écart ? » = deux rangées d'animaux face à face (les animaux sans partenaire en couleur) et « De b à a, combien de pas ? ». Après **deux** erreurs sur une même question l'aide s'ouvre toute seule (ÉCOUTER : le nombre est écrit en lettres et redit) ; après **trois**, la bonne réponse est colorée. Une réponse trouvée après erreur reste « pas du premier coup » (règle de réussite inchangée). Aucune migration. Test : `labo-calcul-test.html?who=ok&all=1` (toutes les étapes ouvertes).

## Compteurs et « réussi / maîtrisé » (UX-04 et 05)
Cause de l'écart observé (« 4 animaux éclos, 3 visibles » ; « 8 niveaux réussis, 7 détaillés ») : les totaux comptaient **toutes** les réussites enregistrées, alors que les listes ne montrent que les étapes activées par l'enseignant, et qu'une étape réussie après un « trou » dans l'ordre restait cachée (❓). Corrigé : une étape réussie est toujours visible (`visibleLevels`) ; les compteurs (élève et enseignant) ne comptent que le périmètre activé et signalent le reste (« 4 au total, dont 1 masqué par ton enseignant »). **Aucune donnée modifiée ni effacée** (les réussites des étapes désactivées restent acquises). « Réussi » = au moins une série au seuil réglé (50–100 %, bonnes réponses du premier coup, aides non comptées) ; « maîtrisé » = au moins deux séries réussies (règle déjà en place, maintenant expliquée dans « Ma progression » et dans le suivi enseignant). Test : `?seed=gap`.

## Interface (UX-06 à 09)
* **Boutique** : grille adaptée à la largeur (`minmax(min(230px,100%),1fr)`), bouton « Acheter » et prix qui passent à la ligne au lieu de déborder (zoo-connecte.html, donc aussi la Lecture) ; test `t_shop` à 1366/1024/768/390 px avec 5 cartes. Le débordement signalé n'a pas pu être reproduit dans nos tests (2 cartes de test) : correction défensive.
* **Tablettes 601–880 px** : le menu « Moi » du calcul est maintenant visible (avant, aucun accès à Boutique/progression/déconnexion).
* **Textes** : en mode Calcul, l'espace enseignant masque le guide « Bienvenue dans Zoo de Lecture » et le partage de Zoo de Lecture (le labo est privé), change le pied de page et le titre de l'onglet ; retour en Lecture = textes d'origine. « Mes nombres lus » → « Mes nombres reconnus ».
* **Bande numérique** : une seule ligne continue, défilante sur petit écran, départ (cadre plein) et arrivée (cadre pointillé) repérés.
* **Arrêter une série** : avant toute réponse, retour direct ; après, fenêtre « Cette série ne sera pas gardée » (Continuer / Quitter). Une série arrêtée n'enregistre rien.

## Série d'améliorations n°2 (tablette, voix, bilan, ordre des étapes)
* **Tablette** : le survol des cases de réponse n'existe que pour une souris (`@media (hover: hover) and (pointer: fine)`) et le focus est retiré après chaque réponse.
* **Voix** : après chaque réponse le message est lu (« Bravo ! neuf plus sept, seize. » ; erreur : « Pas tout à fait. Essaie encore. » + nombre répété en ÉCOUTER). La question suivante arrive à la fin de la phrase (`onend`, filet de 9 s) ; sans synthèse vocale (ou voix coupée par l'enseignant) : 1,5 s. 
* **Étoiles** : une seule règle, sur 2 = niveau de l'étape (1 réussie, 2 maîtrisée), étoiles grises pour les manquantes, dans l'éclosion, le bilan et les cartes.
* **Ordre** : à la fin d'une série, écran d'attente (« Je range ton résultat… », aucun bouton) → éclosion si un œuf éclot ou si l'animal grandit → bilan après « Continuer ». Bilan réussi : « Étape suivante ➜ » (étape « Pour toi ») principal, « Rejouer » secondaire ; série ratée : « Rejouer » principal.
* **Aide** : 1er appui = stratégie seulement (« 8 + 2 = 10 · il reste 4 · À toi de compter ! », pas de case d'arrivée) ; le résultat n'apparaît (et n'est dit) qu'après la 2e erreur. **Une question où l'aide a été ouverte n'est plus comptée « du premier coup »** (avant, seule une erreur l'empêchait : corrigé).
* **Ordre des étapes** : migration **20261116** (`lab_teacher_settings_set` gardait un `select distinct` qui mélangeait l'ordre : cause des cartes « 80–89, 60–69, 11–16… »). Elle conserve maintenant l'ordre et remet une fois les réglages existants dans l'ordre des étapes. Côté enseignant : une colonne numérotée par domaine, ▲/▼, « ✓ Enregistré » 2 s (ou erreur).
* **TBI** (≥ 1400 px) pendant un exercice : calcul 96 px, consignes ≥ 35 px, cases 64 px, panneaux masqués.
Tests : `labo-calcul-test.html?who=ok&all=1` (+ `&egg=addition:a7`, `&order=1`).
