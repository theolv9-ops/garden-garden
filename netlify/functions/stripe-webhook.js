// Webhook Stripe : appelé automatiquement par Stripe quand un paiement de chambre
// est confirmé. C'est le SEUL endroit qui écrit une réservation "Payée" dans le
// Google Sheet et déclenche l'email de confirmation au client — jamais depuis le
// navigateur du client, pour qu'on ne puisse pas se faire passer pour Stripe.
//
// Variables d'environnement nécessaires (à définir dans Netlify) :
// - STRIPE_SECRET_KEY     : clé secrète du compte Stripe
// - STRIPE_WEBHOOK_SECRET : signature du endpoint (fournie par Stripe à la création du webhook)
// - GAS_WEBHOOK_URL       : l'URL du Google Apps Script (déjà utilisée par le site pour les tables)
// - GAS_SHARED_SECRET     : doit être identique à la propriété de script SHARED_SECRET côté Apps Script

const Stripe = require('stripe');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Méthode non autorisée' };
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 500, body: 'Webhook non configuré' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: `Signature du webhook invalide : ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const m = session.metadata || {};

    if (process.env.GAS_WEBHOOK_URL) {
      try {
        await fetch(process.env.GAS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            type: 'chambre',
            secret: process.env.GAS_SHARED_SECRET,
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

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
