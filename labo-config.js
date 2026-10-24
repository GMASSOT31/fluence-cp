/* Laboratoire privé « Zoo de Calcul » — INTERRUPTEUR CÔTÉ NAVIGATEUR.
   enabled:false  → les pages du labo affichent « page indisponible » et labo-switch.js ne fait AUCUNE requête (le site de lecture reste identique).
   La vraie protection est côté serveur (liste blanche + interrupteur app_settings « lab_calcul », voir labo-calcul/README.md) :
   cet interrupteur-ci sert seulement à couper l'interface et les appels. Aucune clé secrète ici (la clé « publishable » est publique). */
window.LABO_CALCUL = {
  enabled: true,
  url: "https://pcxpazpflnlwmhyuozdx.supabase.co",
  key: "sb_publishable_j65mDpDNsuwwaL6uRjsMtA_U_OXQXlL"
};
