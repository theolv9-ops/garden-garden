// Fonction Cloudflare Pages : webhook Stripe, appelé automatiquement par Stripe
// quand un paiement de chambre est confirmé. C'est le SEUL endroit qui écrit une
// réservation "Payée" dans le Google Sheet et déclenche l'email de confirmation
// au client — jamais depuis le navigateur du client, pour qu'on ne puisse pas se
// faire passer pour Stripe.
//
// La signature du webhook est vérifiée "à la main" avec l'API Web Crypto (pas de
// dépendance npm), pour rester compatible avec l'environnement edge de Cloudflare.
//
// Variables d'environnement nécessaires (Cloudflare Pages > Settings > Environment
// variables) :
// - STRIPE_WEBHOOK_SECRET : signature du endpoint (fournie par Stripe à la création du webhook)
// - GAS_WEBHOOK_URL       : l'URL du Google Apps Script (déjà utilisée par le site pour les tables)
// - GAS_SHARED_SECRET     : doit être identique à la propriété de script SHARED_SECRET côté Apps Script

var SIGNATURE_TOLERANCE_SECONDS = 300; // rejette une signature vieille de plus de 5 min (anti-rejeu)

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyStripeSignature(payload, header, secret) {
  if (!header) return false;

  var timestamp = null;
  var signatures = [];
  header.split(',').forEach(function (part) {
    var kv = part.split('=');
    if (kv[0] === 't') timestamp = kv[1];
    if (kv[0] === 'v1' && kv[1]) signatures.push(kv[1]);
  });
  if (!timestamp || signatures.length === 0) return false;

  var now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  var key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  var sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + payload));
  var expected = Array.prototype.map
    .call(new Uint8Array(sigBuffer), function (b) { return b.toString(16).padStart(2, '0'); })
    .join('');

  return signatures.some(function (sig) { return timingSafeEqual(sig, expected); });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook non configuré', { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  const valid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);

  if (!valid) {
    return new Response('Signature du webhook invalide', { status: 400 });
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(payload);
  } catch (err) {
    return new Response('JSON invalide', { status: 400 });
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const m = session.metadata || {};

    if (env.GAS_WEBHOOK_URL) {
      try {
        await fetch(env.GAS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            type: 'chambre',
            secret: env.GAS_SHARED_SECRET,
            prenom: m.prenom,
            nom: m.nom,
            email: m.email,
            telephone: m.telephone,
            arrivee: m.arrivee,
            depart: m.depart,
            nuits: m.nuits,
            petitDej: m.petitDej,
            montant: ((session.amount_total || 0) / 100).toFixed(2),
            stripeSessionId: session.id,
          }),
        });
      } catch (err) {
        // Le paiement Stripe a déjà réussi : on ne fait pas échouer le webhook pour un
        // souci d'écriture côté Google Sheet, sinon Stripe le renverra en boucle.
        // À surveiller manuellement si ça arrive souvent (voir la boîte mail Garden Garden).
        console.error('Erreur en écrivant la réservation chambre dans le Google Sheet :', err);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
