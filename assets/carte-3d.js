// La vraie carte, à feuilleter en 3D (CSS 3D, sans bibliothèque).
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
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RATIO = 1414 / 1000;
  var DUREE = reduceMotion ? 1 : 1100;

  var courant = null;   // clé du livre affiché
  var feuilles = [];    // [{el, front, back, angle}]
  var etat = 0;         // nombre de feuilles tournées
  var deuxPages = true; // ordinateur : deux pages ; téléphone : une page
  var pw = 0, ph = 0;
  var bookDiv = null, castR = null, castL = null, edgeR = null, edgeL = null;
  var anim = null;

  Object.keys(LIVRES).forEach(function(cle){
    if(!LIVRES[cle].pages.length) return;
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = LIVRES[cle].titre; b.setAttribute('data-livre', cle);
    b.addEventListener('click', function(){ charger(cle, 0); });
    tabs.appendChild(b);
  });

  // Petit bruit de page qui tourne (généré, pas de fichier son)
  var audio = null;
  function bruitPage(){
    if(reduceMotion) return;
    try{
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var d = 0.32, n = Math.floor(audio.sampleRate * d);
      var buf = audio.createBuffer(1, n, audio.sampleRate), data = buf.getChannelData(0);
      for(var i = 0; i < n; i++){ var t = i / n; data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t) * (1 - t * .6); }
      var src = audio.createBufferSource(); src.buffer = buf;
      var f = audio.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = .7;
      var g = audio.createGain(); g.gain.value = .05;
      src.connect(f); f.connect(g); g.connect(audio.destination); src.start();
    }catch(e){}
  }

  function face(src, cote){
    var f = document.createElement('div');
    f.className = 'lv-face lv-' + cote;
    if(src){
      var img = document.createElement('img');
      img.src = src; img.alt = ''; img.draggable = false; img.decoding = 'async';
      f.appendChild(img);
    } else {
      f.className += ' lv-dos';
      f.innerHTML = '<svg viewBox="0 0 200 200" aria-hidden="true"><use href="#gg-logomark"></use></svg>';
    }
    var lum = document.createElement('i'); lum.className = 'lv-lumiere'; f.appendChild(lum);
    return f;
  }

  function dimensions(){
    var W = window.innerWidth, H = window.innerHeight;
    deuxPages = W >= 820 && W > H;
    var haut = Math.max(240, H - 210);
    pw = deuxPages ? Math.min((Math.min(W, 1240) - 80) / 2, haut / RATIO) : Math.min(W - 40, haut / RATIO, 520);
    pw = Math.floor(pw); ph = Math.floor(pw * RATIO);
  }

  function charger(cle, etatVoulu){
    courant = cle;
    Array.prototype.forEach.call(tabs.children, function(b){ b.classList.toggle('active', b.getAttribute('data-livre') === cle); });
    dimensions();
    var pages = LIVRES[cle].pages.slice();
    // Ordinateur : 2 pages par feuille (recto / verso), dos du livre si nombre impair.
    // Téléphone : 1 page par feuille, verso uni.
    var paires = [];
    if(deuxPages){ for(var i = 0; i < pages.length; i += 2) paires.push([pages[i], pages[i + 1] || null]); }
    else pages.forEach(function(p){ paires.push([p, null]); });

    bookEl.innerHTML = '';
    var scene = document.createElement('div'); scene.className = 'lv-scene' + (deuxPages ? '' : ' lv-une');
    var ombre = document.createElement('div'); ombre.className = 'lv-ombre';
    bookDiv = document.createElement('div'); bookDiv.className = 'lv-book';
    bookDiv.style.setProperty('--pw', pw + 'px'); bookDiv.style.setProperty('--ph', ph + 'px');
    edgeL = document.createElement('div'); edgeL.className = 'lv-tranche lv-tranche-g';
    edgeR = document.createElement('div'); edgeR.className = 'lv-tranche lv-tranche-d';
    castL = document.createElement('div'); castL.className = 'lv-portee lv-portee-g';
    castR = document.createElement('div'); castR.className = 'lv-portee lv-portee-d';
    bookDiv.appendChild(edgeL); bookDiv.appendChild(edgeR);
    feuilles = paires.map(function(p, i){
      var el = document.createElement('div'); el.className = 'lv-feuille';
      var fr = face(p[0], 'recto'), bk = face(p[1], 'verso');
      el.appendChild(fr); el.appendChild(bk);
      bookDiv.appendChild(el);
      return { el: el, front: fr, back: bk, angle: 0 };
    });
    bookDiv.appendChild(castL); bookDiv.appendChild(castR);
    scene.appendChild(ombre); scene.appendChild(bookDiv);
    bookEl.appendChild(scene);
    etat = Math.max(0, Math.min(etatVoulu || 0, feuilles.length));
    feuilles.forEach(function(f, i){ f.angle = i < etat ? -180 : 0; });
    rendre(null, 0);
    brancherGestes(scene);
  }

  // Dessine toutes les feuilles. « vol » = feuille en mouvement, p = avancement 0..1 de son tour.
  function rendre(vol, p){
    var n = feuilles.length;
    feuilles.forEach(function(f, i){
      var a = f.angle;
      var tournee = a < -90;
      var z = f === vol ? n + 5 : (tournee ? i + 1 : n - i);
      // léger « gondolement » de la page pendant qu'elle tourne
      var courbe = f === vol ? Math.sin(Math.PI * p) : 0;
      f.el.style.zIndex = z;
      f.el.style.transform = 'rotateY(' + a + 'deg) translateZ(' + (courbe * 18) + 'px) skewY(' + (courbe * (a > -90 ? -2.2 : 2.2)) + 'deg)';
      // éclairage : la page s'assombrit en se soulevant, reflet qui glisse
      var lumR = f.front.lastChild, lumV = f.back.lastChild;
      var sombre = Math.sin(Math.PI * Math.min(1, -a / 180));
      lumR.style.opacity = (sombre * .55).toFixed(3);
      lumV.style.opacity = (sombre * .55).toFixed(3);
      lumR.style.setProperty('--x', (100 - (-a / 180) * 100) + '%');
      lumV.style.setProperty('--x', ((-a / 180) * 100) + '%');
    });
    // ombre portée sur la page d'en dessous
    var vers = vol ? (vol.angle > -90 ? 'd' : 'g') : null;
    castR.style.opacity = vers === 'd' ? (Math.sin(Math.PI * p) * .65).toFixed(3) : 0;
    castL.style.opacity = vers === 'g' ? (Math.sin(Math.PI * p) * .65).toFixed(3) : 0;
    // tranches : épaisseur des pages restantes de chaque côté
    var gauche = feuilles.filter(function(f){ return f.angle < -90; }).length;
    var droite = n - gauche;
    edgeL.style.width = Math.min(10, gauche * 2.5) + 'px'; edgeL.style.opacity = gauche ? 1 : 0;
    edgeR.style.width = Math.min(10, droite * 2.5) + 'px'; edgeR.style.opacity = droite ? 1 : 0;
    // livre fermé : on le recentre sur la couverture ou sur le dos
    var decal = 0;
    if(!deuxPages) decal = -pw / 2;
    else if(gauche === 0) decal = -pw / 2;
    else if(droite === 0) decal = pw / 2;
    bookDiv.style.setProperty('--decal', decal + 'px');
    majPied();
  }

  function majPied(){
    var pages = LIVRES[courant].pages, n = feuilles.length;
    var txt, zoomSrc;
    if(deuxPages){
      if(etat === 0){ txt = 'Couverture'; zoomSrc = pages[0]; }
      else if(etat === n && !pages[2 * etat - 1]){ txt = 'Dos de la carte'; zoomSrc = pages[pages.length - 1]; }
      else {
        var g = 2 * etat - 1, d = 2 * etat;
        txt = pages[d] ? 'Pages ' + (g + 1) + '-' + (d + 1) + ' / ' + pages.length : 'Page ' + (g + 1) + ' / ' + pages.length;
        zoomSrc = pages[d] || pages[g];
      }
    } else {
      var i = Math.min(etat, pages.length - 1);
      txt = 'Page ' + (i + 1) + ' / ' + pages.length; zoomSrc = pages[i];
    }
    pageLbl.textContent = txt;
    prev.disabled = etat <= 0;
    next.disabled = deuxPages ? etat >= n : etat >= n - 1;
    zoom.href = zoomSrc;
  }

  function animer(f, de, a, fin){
    if(anim) return;
    var t0 = null, cible = a;
    var progressionDepart = Math.abs(de) / 180;
    bruitPage();
    anim = function(ts){
      if(!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / (DUREE * Math.max(.35, Math.abs(cible - de) / 180)));
      var e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // easeInOutCubic
      f.angle = de + (cible - de) * e;
      rendre(f, Math.abs(f.angle) / 180);
      if(k < 1) requestAnimationFrame(anim);
      else { anim = null; f.angle = cible; rendre(null, 0); if(fin) fin(); }
    };
    requestAnimationFrame(anim);
  }

  function suivante(){
    var max = deuxPages ? feuilles.length : feuilles.length - 1;
    if(anim || etat >= max) return;
    var f = feuilles[etat];
    etat++;
    animer(f, f.angle, -180);
  }
  function precedente(){
    if(anim || etat <= 0) return;
    etat--;
    var f = feuilles[etat];
    animer(f, f.angle, 0);
  }

  // Glisser du doigt ou de la souris : la page suit le geste
  function brancherGestes(scene){
    var depart = null;
    scene.addEventListener('pointerdown', function(ev){
      if(anim) return;
      var r = bookDiv.getBoundingClientRect();
      var milieu = r.left + r.width / 2;
      var avant = deuxPages ? ev.clientX > milieu : ev.clientX > window.innerWidth * .35;
      var idx = avant ? etat : etat - 1;
      var max = deuxPages ? feuilles.length : feuilles.length - 1;
      if(avant ? etat >= max : etat <= 0){ depart = null; return; }
      depart = { x: ev.clientX, avant: avant, f: feuilles[idx], bouge: false };
      scene.setPointerCapture(ev.pointerId);
    });
    scene.addEventListener('pointermove', function(ev){
      if(!depart) return;
      var dx = ev.clientX - depart.x;
      if(Math.abs(dx) > 6) depart.bouge = true;
      if(!depart.bouge) return;
      var p = Math.max(0, Math.min(1, (depart.avant ? -dx : dx) / (pw * 1.4)));
      depart.f.angle = depart.avant ? -180 * p : -180 * (1 - p);
      rendre(depart.f, Math.abs(depart.f.angle) / 180);
    });
    function lacher(){
      if(!depart) return;
      var d = depart; depart = null;
      if(!d.bouge){ if(d.avant) suivante(); else precedente(); return; }
      var p = d.avant ? -d.f.angle / 180 : 1 + d.f.angle / 180;
      if(p > .22){
        if(d.avant){ etat++; animer(d.f, d.f.angle, -180); }
        else { etat--; animer(d.f, d.f.angle, 0); }
      } else animer(d.f, d.f.angle, d.avant ? 0 : -180);
    }
    scene.addEventListener('pointerup', lacher);
    scene.addEventListener('pointercancel', lacher);
  }

  window.ouvrirLivre = function(cle){
    livre.classList.add('open');
    document.body.style.overflow = 'hidden';
    charger(LIVRES[cle] && LIVRES[cle].pages.length ? cle : 'carte', 0);
    livre.classList.remove('lv-arrivee'); void livre.offsetWidth; livre.classList.add('lv-arrivee');
    try{ if(typeof gtag === 'function') gtag('event', 'ouvrir_carte_3d', { event_label: cle }); }catch(e){}
  };
  window.fermerLivre = function(){
    livre.classList.remove('open');
    document.body.style.overflow = '';
    bookEl.innerHTML = ''; feuilles = []; anim = null;
  };
  prev.addEventListener('click', precedente);
  next.addEventListener('click', suivante);
  document.addEventListener('keydown', function(ev){
    if(!livre.classList.contains('open')) return;
    if(ev.key === 'Escape') window.fermerLivre();
    if(ev.key === 'ArrowRight') suivante();
    if(ev.key === 'ArrowLeft') precedente();
  });
  // Rotation du téléphone ou redimensionnement : on reconstruit le livre à la bonne taille
  // (on ignore les changements de hauteur seuls : la barre d'adresse du téléphone)
  var t = null, largeur = window.innerWidth;
  window.addEventListener('resize', function(){
    if(!livre.classList.contains('open') || window.innerWidth === largeur) return;
    largeur = window.innerWidth;
    clearTimeout(t);
    t = setTimeout(function(){
      var avait2 = deuxPages, e = etat;
      dimensions();
      // garde à peu près la même page en passant d'un mode à l'autre
      var nouvel = avait2 === deuxPages ? e : (deuxPages ? Math.ceil(e / 2) : Math.max(0, 2 * e - 1));
      charger(courant, nouvel);
    }, 250);
  });
})();
