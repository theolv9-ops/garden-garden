// Version 2 : l'animation d'entrée (une seule animation marquante), faite avec Motion.
// Si Motion ne charge pas ou si le visiteur a demandé moins d'animations, la page s'affiche simplement, sans rien cacher.
(function(){
  var M = window.Motion;
  if(!M || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ease = [0.22, 0.8, 0.24, 1];

  // Page d'accueil : les deux portes s'ouvrent de bas en haut, puis leur texte monte
  var pans = document.querySelectorAll('.porte-pan');
  if(pans.length){
    M.animate(pans, { clipPath:['inset(100% 0 0 0 round 6px)', 'inset(0% 0 0 0 round 6px)'] }, { duration:1.1, delay:M.stagger(0.14), easing:ease });
    M.animate('.porte-pan img', { transform:['scale(1.18)', 'scale(1)'] }, { duration:1.6, delay:M.stagger(0.14), easing:ease });
    M.animate('.porte-in > *', { opacity:[0, 1], transform:['translateY(24px)', 'none'] }, { duration:0.8, delay:M.stagger(0.07, { startDelay:0.55 }), easing:ease });
    M.animate('.porte-top, .porte-foot', { opacity:[0, 1] }, { duration:0.8, delay:0.3 });
  }

  // Restaurant et hôtel : la photo d'accueil s'ouvre depuis un cadre, comme un rideau
  var heroBg = document.querySelector('.hero .hero-bg');
  if(heroBg){
    M.animate(heroBg, { clipPath:['inset(7% 5% 7% 5% round 6px)', 'inset(0% 0% 0% 0% round 0px)'] }, { duration:1.3, easing:ease });
  }
})();
