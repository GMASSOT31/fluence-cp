# Reconnaissance vocale hors ligne (aide automatique à l'écoute)

Utilisée seulement par `aide-ecoute.js`, chargée à la demande quand le maître(sse) touche
« 🤖 Proposer automatiquement » dans « Mon maître(sse) écoute » (essai activé par l'admin).
Tout se passe dans le navigateur de la tablette : l'enregistrement n'est envoyé nulle part.

| Fichier | Origine | Licence |
|---|---|---|
| `vosk.js` | `vosk-browser` 0.0.8, fichier `dist/vosk.js` du paquet npm (https://www.npmjs.com/package/vosk-browser, code : https://github.com/ccoreilly/vosk-browser) | Apache-2.0 |
| `modele-fr.tar.gz` | `vosk-model-small-fr-0.22` (https://alphacephei.com/vosk/models), zip recompressé en `.tar.gz` (format attendu par vosk-browser), contenu inchangé | Apache-2.0 |
| `mots-fr.txt` | liste des 135 770 mots du modèle, extraite de `graph/Gr.fst` (un mot inconnu n'est ni proposé ni jugé) | Apache-2.0 (même modèle) |

Pour changer de version : remplacer les fichiers, puis augmenter `V` dans `aide-ecoute.js`
(le navigateur garde le modèle sous son adresse : une nouvelle adresse = nouveau téléchargement).
