/* =====================================================================
   ÉVÉNEMENTS GARDEN GARDEN : c'est le seul fichier à modifier.
   ---------------------------------------------------------------------
   Pour ajouter un événement : copiez un bloc { ... }, collez-le à la
   suite (n'oubliez pas la virgule entre deux blocs) et changez le texte.

   date      : obligatoire, au format AAAA-MM-JJ (ex. "2026-10-17")
   heure     : facultatif (ex. "20h00")
   titre     : obligatoire
   texte     : obligatoire, une ou deux phrases
   prix      : facultatif (ex. "25 € par personne", "Entrée libre")
   image     : facultatif, une photo du dossier images/
   lien      : facultatif ; si rempli, le bouton ouvre ce lien
               (billetterie, page Facebook...). Sinon, le bouton
               "Réserver" pré-remplit le formulaire de réservation.
   exemple   : à SUPPRIMER sur les vrais événements ; tant qu'il vaut
               true, un badge "Exemple" s'affiche sur la carte.

   Les événements passés disparaissent tout seuls le lendemain de leur
   date, et la liste est triée par date automatiquement.
   ===================================================================== */

var EVENEMENTS = [
  {
    exemple: true,
    date: "2026-10-02",
    heure: "19h00",
    titre: "Soirée d'ouverture",
    texte: "Garden Garden ouvre ses portes : apéritif au jardin, braseros allumés et premier service à la carte.",
    prix: "Entrée libre",
    image: "images/facade-soir.jpg"
  },
  {
    exemple: true,
    date: "2026-10-17",
    heure: "20h00",
    titre: "Concert au coin du brasero",
    texte: "Un duo acoustique sous la charpente de la terrasse, cocktails et pièces grillées à la braise.",
    prix: "Sans supplément",
    image: "images/bar-exterieur.jpg"
  },
  {
    exemple: true,
    date: "2026-10-25",
    heure: "14h00",
    titre: "Tournoi de pétanque",
    texte: "Doublettes sur nos trois pistes du parc, lots pour les vainqueurs et goûter offert.",
    prix: "10 € par doublette",
    image: "images/jardin-petanque.jpg"
  },
  {
    exemple: true,
    date: "2026-11-19",
    heure: "19h00",
    titre: "Soirée Beaujolais nouveau",
    texte: "Le nouveau millésime servi au verre, planches de charcuterie et fromages de la région.",
    prix: "25 € par personne",
    image: "images/salle.jpg"
  }
];
