// La vraie carte, à feuilleter en 3D (bibliothèque page-flip, copiée dans assets/vendor).
// Pour ajouter un livre (ex. la carte des vins) : ajouter ses pages dans LIVRES, dans l'ordre,
// toutes au même format (portrait A4). Un livre sans page n'apparaît pas.
var LIVRES = {
  carte: {
    titre: 'La carte',
    pages: [
      'images/carte/1-couverture.jpg',
      'images/carte/2-bienvenue.jpg',
      'images/carte/3-entrees-viandes.jpg',
      'images/carte/4-planches-desserts.jpg',
      'images/carte/5-menu-grenouilles.jpg'
    ]
  },
  vins: {
    titre: 'La carte des vins',
    pages: []
  }
};

(function(){
  var livre = document.getElementById('livre');
  if(!livre) return;
  var bookEl = document.getElementById('livreBook');
  var tabs = document.getElementById('livreTabs');
  var pageLbl = document.getElementById('livrePage');
  var prev = document.getElementById('livrePrev');
  var next = document.getElementById('livreNext');
  var zoom = document.getElementById('livreZoom');
  var flip = null, courant = null;

  Object.keys(LIVRES).forEach(function(cle){
    if(!LIVRES[cle].pages.length) return;
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = LIVRES[cle].titre; b.setAttribute('data-livre', cle);
    b.addEventListener('click', function(){ charger(cle); });
    tabs.appendChild(b);
  });

  function majPied(){
    if(!flip) return;
    var i = flip.getCurrentPageIndex(), n = flip.getPageCount();
    var double = flip.getOrientation() === 'landscape' && i > 0 && i < n - 1;
    pageLbl.textContent = (double ? 'Pages ' + (i + 1) + '-' + (i + 2) : 'Page ' + (i + 1)) + ' / ' + n;
    prev.disabled = i <= 0;
    next.disabled = i >= n - 1;
    zoom.href = LIVRES[courant].pages[i];
  }

  // Taille du livre : la plus grande qui tient dans l'écran (une page sur téléphone, deux sur ordinateur)
  function dimensions(){
    var ratio = 1414 / 1000;
    var haut = Math.max(260, window.innerHeight - 190);
    var large = window.innerWidth - 32;
    var deuxPages = window.innerWidth > window.innerHeight && window.innerWidth >= 820;
    var w = Math.min(deuxPages ? large / 2 : large, haut / ratio, 520);
    return { w: Math.floor(w), h: Math.floor(w * ratio) };
  }

  function charger(cle){
    if(!window.St || !St.PageFlip) return;
    courant = cle;
    Array.prototype.forEach.call(tabs.children, function(b){ b.classList.toggle('active', b.getAttribute('data-livre') === cle); });
    if(flip){ flip.destroy(); flip = null; }
    bookEl.innerHTML = '';
    var holder = document.createElement('div');
    bookEl.appendChild(holder);
    var d = dimensions();
    flip = new St.PageFlip(holder, {
      width: d.w, height: d.h,
      size: 'fixed',
      showCover: true,
      usePortrait: true,
      maxShadowOpacity: 0.6,
      mobileScrollSupport: false,
      flippingTime: 900
    });
    flip.loadFromImages(LIVRES[cle].pages);
    flip.on('flip', majPied);
    flip.on('init', majPied);
    majPied();
  }

  window.ouvrirLivre = function(cle){
    livre.classList.add('open');
    document.body.style.overflow = 'hidden';
    charger(LIVRES[cle] && LIVRES[cle].pages.length ? cle : 'carte');
    try{ if(typeof gtag === 'function') gtag('event', 'ouvrir_carte_3d', { event_label: cle }); }catch(e){}
  };
  window.fermerLivre = function(){
    livre.classList.remove('open');
    document.body.style.overflow = '';
    if(flip){ flip.destroy(); flip = null; }
    bookEl.innerHTML = '';
  };
  prev.addEventListener('click', function(){ if(flip) flip.flipPrev(); });
  next.addEventListener('click', function(){ if(flip) flip.flipNext(); });
  document.addEventListener('keydown', function(ev){
    if(!livre.classList.contains('open')) return;
    if(ev.key === 'Escape') window.fermerLivre();
    if(ev.key === 'ArrowRight' && flip) flip.flipNext();
    if(ev.key === 'ArrowLeft' && flip) flip.flipPrev();
  });
  // Rotation du téléphone ou redimensionnement : on recharge le livre à la bonne taille
  // (on ignore les changements de hauteur seuls : la barre d'adresse du téléphone qui apparaît ou disparaît)
  var t = null, largeur = window.innerWidth;
  window.addEventListener('resize', function(){
    if(!flip || window.innerWidth === largeur) return;
    largeur = window.innerWidth;
    clearTimeout(t);
    t = setTimeout(function(){ var i = flip.getCurrentPageIndex(); charger(courant); if(i) flip.turnToPage(i); }, 250);
  });
})();
