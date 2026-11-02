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
   prive     : mettre true pour un événement sur invitation ; la carte
               affiche "Sur invitation" au lieu du bouton "Réserver".
   video     : facultatif, un lien vers une vidéo (reel/post Instagram
               ou vidéo YouTube). Affiche un bouton "lecture" sur la
               photo qui ouvre la vidéo dans une fenêtre par-dessus la
               page. Les autres liens (TikTok...) s'ouvrent dans un
               nouvel onglet.
   affiche   : mettre true quand l'image est une affiche (format
               vertical) : elle est montrée en entier, sans être
               coupée, et s'ouvre en grand quand on clique dessus.
   telephone : facultatif (ex. "07 60 37 06 90") ; le bouton devient
               "Réserver au ..." et lance l'appel depuis un téléphone.
   exemple   : à SUPPRIMER sur les vrais événements ; tant qu'il vaut
               true, un badge "Exemple" s'affiche sur la carte.

   Les événements passés disparaissent tout seuls le lendemain de leur
   date, et la liste est triée par date automatiquement.
   ===================================================================== */

var EVENEMENTS = [
  {
    date: "2026-10-29",
    titre: "Inauguration privée",
    texte: "Garden Garden célèbre son inauguration lors d'une soirée privée, réservée aux invités, avec une performance live de la chanteuse Priscillia.",
    prive: true,
    image: "images/facade-soir.jpg",
    video: "https://www.instagram.com/reel/Ddvx2Dqu0y4/"
  },
  {
    date: "2026-11-12",
    heure: "20h00 – 2h00",
    titre: "Red Carpet, soirée tapis rouge",
    texte: "D'B Events et Garden Garden vous présentent une soirée bar-lounge au décor immersif, avec DJ Pioups aux platines. Dress code élégant rouge et noir. Réservation obligatoire.",
    prix: "10 € l'entrée avec une consommation",
    telephone: "07 60 37 06 90",
    image: "images/affiche-red-carpet-12-11.jpg",
    affiche: true
  },
  {
    date: "2026-11-26",
    heure: "20h00",
    titre: "Dîner concert avec Mister Twin",
    texte: "Mister Twin en concert, « la voix de vos plus belles soirées », pour un dîner concert à partir de 20h. Les réservations sont ouvertes.",
    image: "images/affiche-mister-twin-26-11.jpg",
    affiche: true
  }
];
