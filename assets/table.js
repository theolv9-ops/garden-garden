// Réservation de table : envoi au script Google (Apps Script), qui écrit dans la Google Sheet
// et envoie les emails. Utilisé par restaurant.html.
var OPENING_DATE = '2026-10-02';
(function(){
  var todayStr = new Date().toISOString().slice(0,10);
  var dateInput = document.getElementById('g-date');
  if(dateInput){
    dateInput.min = todayStr > OPENING_DATE ? todayStr : OPENING_DATE;
    dateInput.addEventListener('change', majHeures);
  }
})();
// Heures proposées selon le jour choisi (voir le bloc Horaires) :
// lundi-mercredi midi seulement, jeudi-samedi midi et soir, dimanche midi.
var HEURES_MIDI = ['12h00','12h30','13h00'];
var HEURES_SOIR = ['19h00','19h30','20h00','20h30','21h00'];
function majHeures(){
  var select = document.getElementById('g-heure');
  var date = document.getElementById('g-date').value;
  if(!select) return;
  var heures;
  if(!date){ heures = HEURES_MIDI.concat(HEURES_SOIR); }
  else {
    var jour = new Date(date + 'T12:00:00').getDay(); // 0 = dimanche
    if(jour >= 1 && jour <= 3) heures = ['11h30'].concat(HEURES_MIDI);
    else if(jour >= 4 && jour <= 6) heures = HEURES_MIDI.concat(HEURES_SOIR);
    else heures = HEURES_MIDI;
  }
  var avant = select.value;
  select.innerHTML = '<option value="">Choisir</option>';
  heures.forEach(function(h){ var o = document.createElement('option'); o.textContent = h; select.appendChild(o); });
  if(heures.indexOf(avant) !== -1) select.value = avant;
}
// Envoie la réservation à Apps Script, qui l'écrit dans le Google Sheet ET envoie
// les emails (client + Garden Garden). Résultat :
//  - résolu 'ok'        : le script a répondu « succès » ;
//  - résolu 'incertain' : la réponse n'a pas pu être lue (réseau, certains navigateurs mobiles
//                         bloquent la lecture) alors que la demande a pu partir ; on la renvoie
//                         alors avec le même identifiant, que le script ignore s'il l'a déjà reçue ;
//  - rejeté             : le script a explicitement refusé la demande.
var GAS_URL = 'https://script.google.com/macros/s/AKfycbwNJ-ZJkZebg-IJ-vKzTs966eLpEIyXPZTYWio1gYjCiguMARc7VrlTfMpxHcsT-KCGGA/exec';
function gsendToSheet(payload){
  payload.requestId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
  var body = JSON.stringify(payload);
  return fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: body
  }).then(function(res){
    return res.json();
  }).then(function(data){
    if(!data || data.success !== true){ var refus = new Error('script refused'); refus.refused = true; throw refus; }
    return 'ok';
  }).catch(function(err){
    if(err && err.refused) throw err;
    return fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body
    }).then(function(){ return 'incertain'; });
  });
}
function gsubmit(e){
  e.preventDefault();
  var req=['g-prenom','g-nom','g-date','g-heure','g-tel','g-email'];
  var ok=req.every(function(f){return document.getElementById(f).value.trim()!==''});
  if(!ok){ alert('Merci de remplir prénom, nom, date, heure, téléphone et email.'); return false; }
  var v=function(id){ return document.getElementById(id).value.trim(); };
  if(v('g-date') < OPENING_DATE){ alert('Garden Garden ouvre ses portes le 2 octobre 2026 — merci de choisir une date à partir de cette date.'); return false; }
  var nbPers = parseInt(v('g-pers'), 10);
  if(!(nbPers >= 1 && nbPers <= 500) || String(nbPers) !== v('g-pers')){ alert('Merci d\'indiquer le nombre de convives (un nombre entier, au moins 1).'); return false; }
  var tables = gCheckedTables();
  if(tables.length === 0){ alert('Merci de cocher la table que vous souhaitez (lounge, terrasse ou salle principale).'); gscroll('resa'); return false; }
  var tableLabel = tables.join(' ou ');
  // La feuille Google n'a pas de colonne dédiée : on place la table en tête de l'occasion.
  var occasionSheet = 'Table : ' + tableLabel + (v('g-msg') ? ' — ' + v('g-msg') : '');
  var btn = e.target.querySelector('button[type="submit"]');
  var errEl = document.getElementById('g-err');
  var okEl = document.getElementById('g-ok');
  errEl.style.display='none';
  okEl.style.display='none';
  if(btn){ btn.disabled = true; btn.textContent = 'Envoi en cours…'; }
  gsendToSheet({
    prenom: v('g-prenom'),
    nom: v('g-nom'),
    email: v('g-email'),
    telephone: v('g-tel'),
    date: v('g-date'),
    heure: v('g-heure').replace('h', ':'),
    convives: nbPers + (nbPers > 1 ? ' personnes' : ' personne'),
    occasion: occasionSheet,
    // Case facultative, décochée par défaut : on envoie aussi le texte exact affiché, pour la preuve de l'accord.
    optin: document.getElementById('g-optin').checked === true,
    optinTexte: document.getElementById('g-optin-texte').textContent.trim()
  }).then(function(resultat){
    // Un seul message à la fois : jamais l'erreur et la confirmation ensemble.
    errEl.style.display='none';
    try{ if(typeof gtag==='function'){ gtag('event','generate_lead',{event_category:'reservation',event_label:'formulaire_reservation_auto'}); } }catch(e2){}
    okEl.textContent = resultat === 'ok'
      ? '✓ Merci ! Votre demande a été envoyée. Vous recevez un email dans quelques instants.'
      : '✓ Votre demande a été envoyée. Si vous ne recevez pas d\'email dans quelques minutes, appelez-nous au 04 86 80 27 50.';
    okEl.style.display='block';
    document.getElementById('reservationForm').reset();
    try{ okEl.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e3){}
  }, function(){
    okEl.style.display='none';
    errEl.style.display='block';
    try{ errEl.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e4){}
  }).then(function(){
    if(btn){ btn.disabled = false; btn.textContent = 'Confirmer la réservation'; }
  });
  return false;
}
function gCheckedTables(){
  var boxes = document.querySelectorAll('#reservationForm input[name="table"]:checked');
  return Array.prototype.map.call(boxes, function(b){ return b.value; });
}
// Clic sur une carte du plan de salle : coche la case correspondante dans le formulaire
function chooseTable(label){
  var boxes = document.querySelectorAll('#reservationForm input[name="table"]');
  Array.prototype.forEach.call(boxes, function(b){
    if(b.value === label){ b.checked = true; }
  });
  gscroll('resa');
  var field = document.getElementById('g-table-field');
  if(field){
    field.style.transition = 'box-shadow .3s ease';
    field.style.borderRadius = '12px';
    field.style.boxShadow = '0 0 0 3px rgba(185,95,58,.35)';
    setTimeout(function(){ field.style.boxShadow = ''; }, 1200);
  }
}

