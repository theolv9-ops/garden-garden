// Agenda des événements (le contenu se modifie dans evenements.js, pas ici).
(function(){
  var grid = document.getElementById('agendaGrid');
  var MOIS = ['janv.','févr.','mars','avril','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  var JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  var now = new Date();
  var today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
  var list = (window.EVENEMENTS || []).filter(function(e){
    return e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= today && e.titre;
  }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(text) n.textContent = text;
    return n;
  }

  if(list.length === 0){
    var empty = el('div', 'agenda-empty reveal', 'Pas d\'événement annoncé pour le moment. Suivez-nous sur Instagram pour être les premiers informés : ');
    var a = el('a', '', '@gardengardenchavanoz');
    a.href = 'https://www.instagram.com/gardengardenchavanoz'; a.target = '_blank'; a.rel = 'noopener';
    empty.appendChild(a);
    grid.appendChild(empty);
    return;
  }

  list.forEach(function(e){
    var p = e.date.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var card = el('article', 'evt reveal');

    var photo = el('div', 'evt-photo');
    if(e.image){
      var img = document.createElement('img');
      img.src = e.image; img.alt = e.titre; img.loading = 'lazy'; img.decoding = 'async';
      img.onerror = function(){ this.style.display = 'none'; };
      photo.appendChild(img);
    }
    var badge = el('div', 'evt-date');
    badge.appendChild(el('span', 'd', String(d.getDate())));
    badge.appendChild(el('span', 'm', MOIS[d.getMonth()]));
    photo.appendChild(badge);
    if(e.exemple) photo.appendChild(el('span', 'evt-tag', 'Exemple'));
    if(e.video){
      photo.classList.add('has-video');
      var play = el('div', 'evt-play');
      play.innerHTML = '<i class="ti ti-player-play-filled"></i>';
      photo.appendChild(play);
      photo.setAttribute('role', 'button');
      photo.setAttribute('aria-label', 'Voir la vidéo — ' + e.titre);
      photo.onclick = function(){ ouvrirVideoEvenement(e.video); };
    }
    card.appendChild(photo);

    var body = el('div', 'evt-body');
    body.appendChild(el('div', 'evt-when', JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + (e.heure ? ' · ' + e.heure : '')));
    body.appendChild(el('h3', '', e.titre));
    if(e.texte) body.appendChild(el('p', '', e.texte));
    var foot = el('div', 'evt-foot');
    if(e.prix) foot.appendChild(el('span', 'evt-prix', e.prix));
    var btn;
    if(e.prive){
      btn = el('span', 'evt-invite', 'Sur invitation');
    } else if(e.lien){
      btn = el('a', 'btn-outline', 'En savoir plus');
      btn.href = e.lien; btn.target = '_blank'; btn.rel = 'noopener';
    } else {
      btn = el('button', 'btn-outline', 'Réserver');
      btn.type = 'button';
      btn.onclick = function(){ reserverEvenement(e); };
    }
    foot.appendChild(btn);
    body.appendChild(foot);
    card.appendChild(body);
    grid.appendChild(card);
  });
})();
// Bouton « Réserver » d'un événement : pré-remplit le formulaire de réservation
function reserverEvenement(e){
  var date = document.getElementById('g-date');
  if(date && e.date >= (date.min || '')){ date.value = e.date; if(typeof majHeures === 'function') majHeures(); }
  var heure = document.getElementById('g-heure');
  if(heure && e.heure){
    Array.prototype.forEach.call(heure.options, function(o){ if(o.value === e.heure) heure.value = o.value; });
  }
  var msg = document.getElementById('g-msg');
  if(msg){
    var ligne = 'Événement : ' + e.titre;
    if(msg.value.indexOf(ligne) === -1) msg.value = ligne + (msg.value ? '\n' + msg.value : '');
  }
  gscroll('resa');
}
// Vidéo d'un événement (champ "video" dans evenements.js) : ouvre un lecteur en incrustation.
// Comprend les liens Instagram (reel/p/tv) et YouTube ; tout autre lien s'ouvre dans un nouvel onglet.
function evtVideoEmbed(url){
  var m = url.match(/instagram\.com\/(reel|p|tv)\/([^/?#]+)/i);
  if(m) return { src: 'https://www.instagram.com/' + m[1] + '/' + m[2] + '/embed', wide: false };
  m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i);
  if(m) return { src: 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1', wide: true };
  return null;
}
function ouvrirVideoEvenement(url){
  var embed = evtVideoEmbed(url);
  if(!embed){ window.open(url, '_blank', 'noopener'); return; }
  var box = document.getElementById('evtLightboxBox');
  var wrap = document.getElementById('evtLightboxWrap');
  var iframe = document.createElement('iframe');
  iframe.src = embed.src;
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
  iframe.allowFullscreen = true;
  box.innerHTML = '';
  box.appendChild(iframe);
  wrap.classList.toggle('wide', embed.wide);
  document.getElementById('evtLightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function fermerVideoEvenement(){
  document.getElementById('evtLightbox').classList.remove('open');
  document.getElementById('evtLightboxBox').innerHTML = '';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function(ev){
  if(ev.key === 'Escape') fermerVideoEvenement();
});
