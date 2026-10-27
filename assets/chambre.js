// Réservation de chambre : calcul du prix et paiement Stripe. Utilisé par hotel.html.
var OPENING_DATE = '2026-10-02';
var CR_NIGHT_PRICE = 95;
var CR_BREAKFAST_PRICE = 15; // par personne et par jour
var CR_GUESTS = 2; // chambre classique, 2 personnes

(function(){
  var todayStr = new Date().toISOString().slice(0,10);
  var arriveeInput = document.getElementById('cr-arrivee');
  if(arriveeInput){ arriveeInput.min = todayStr > OPENING_DATE ? todayStr : OPENING_DATE; }
})();

function crNights(){
  var a = document.getElementById('cr-arrivee').value;
  var d = document.getElementById('cr-depart').value;
  if(!a || !d) return 0;
  var diff = Math.round((new Date(d + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  return diff > 0 ? diff : 0;
}

function crUpdateTotal(){
  var nights = crNights();
  var totalEl = document.getElementById('cr-total');
  var depart = document.getElementById('cr-depart');
  var arrivee = document.getElementById('cr-arrivee').value;

  // La date de départ ne peut pas être avant ou égale à la date d'arrivée
  if(arrivee){
    var minDepart = new Date(arrivee + 'T00:00:00');
    minDepart.setDate(minDepart.getDate() + 1);
    depart.min = minDepart.toISOString().slice(0,10);
  }

  if(nights === 0){
    totalEl.textContent = 'Choisissez vos dates pour voir le prix';
    return;
  }
  var total = nights * CR_NIGHT_PRICE;
  if(document.getElementById('cr-petitdej').checked){ total += nights * CR_GUESTS * CR_BREAKFAST_PRICE; }
  totalEl.textContent = nights + ' nuit' + (nights > 1 ? 's' : '') + ' — ' + total + ' € au total';
}

['cr-arrivee','cr-depart','cr-petitdej'].forEach(function(id){
  var el = document.getElementById(id);
  if(el){ el.addEventListener('change', crUpdateTotal); }
});

function crSubmit(e){
  e.preventDefault();
  var v = function(id){ return document.getElementById(id).value.trim(); };
  var errEl = document.getElementById('cr-err');
  var okEl = document.getElementById('cr-ok');
  errEl.style.display = 'none';
  okEl.style.display = 'none';

  var req = ['cr-prenom','cr-nom','cr-email','cr-tel','cr-arrivee','cr-depart'];
  var ok = req.every(function(f){ return v(f) !== ''; });
  if(!ok){
    errEl.textContent = 'Merci de remplir tous les champs (prénom, nom, email, téléphone, arrivée, départ).';
    errEl.style.display = 'block';
    return false;
  }
  if(v('cr-arrivee') < OPENING_DATE){
    errEl.textContent = 'Garden Garden ouvre ses portes le 2 octobre 2026 — merci de choisir une date à partir de cette date.';
    errEl.style.display = 'block';
    return false;
  }
  if(crNights() < 1){
    errEl.textContent = 'La date de départ doit être après la date d\'arrivée.';
    errEl.style.display = 'block';
    return false;
  }

  var btn = document.getElementById('cr-submit');
  btn.disabled = true;
  btn.textContent = 'Redirection…';

  fetch('https://garden-garden.pages.dev/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: v('cr-prenom'),
      nom: v('cr-nom'),
      email: v('cr-email'),
      telephone: v('cr-tel'),
      arrivee: v('cr-arrivee'),
      depart: v('cr-depart'),
      petitDej: document.getElementById('cr-petitdej').checked
    })
  })
    .then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
    .then(function(r){
      if(!r.ok || !r.data.url){ throw new Error((r.data && r.data.error) || 'Impossible de lancer le paiement.'); }
      okEl.style.display = 'block';
      window.location.href = r.data.url;
    })
    .catch(function(err){
      errEl.textContent = 'Erreur : ' + err.message + ' — vous pouvez aussi appeler le 04 86 80 27 50.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Payer et réserver';
    });

  return false;
}

