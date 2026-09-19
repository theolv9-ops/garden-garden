// Crée une session de paiement Stripe pour une réservation de chambre.
// Le prix est TOUJOURS recalculé ici, côté serveur, à partir des dates envoyées :
// on ne fait jamais confiance à un montant qui viendrait du navigateur du client.
//
// Variables d'environnement nécessaires (à définir dans Netlify, jamais dans le code) :
// - STRIPE_SECRET_KEY : la clé secrète du compte Stripe de Garden Garden

const Stripe = require('stripe');

const OPENING_DATE = '2026-10-02';
const NIGHT_PRICE_EUR = 110;
const BREAKFAST_PRICE_EUR = 15; // par personne et par jour
const ROOM_GUESTS = 2; // chambre classique, 2 personnes
const MAX_NIGHTS = 30;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Le paiement n'est pas encore configuré (clé Stripe manquante)." }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide' }) };
  }

  const prenom = String(data.prenom || '').trim();
  const nom = String(data.nom || '').trim();
  const email = String(data.email || '').trim();
  const telephone = String(data.telephone || '').trim();
  const arrivee = String(data.arrivee || '').trim();
  const depart = String(data.depart || '').trim();
  const petitDej = !!data.petitDej;

  if (!prenom || !nom || !email || !telephone || !arrivee || !depart) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Merci de remplir tous les champs.' }) };
  }

  const dArrivee = new Date(arrivee + 'T00:00:00');
  const dDepart = new Date(depart + 'T00:00:00');
  const nights = Math.round((dDepart - dArrivee) / 86400000);

  if (arrivee < OPENING_DATE) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Garden Garden ouvre ses portes le 2 octobre 2026.' }) };
  }
  if (!nights || nights < 1 || nights > MAX_NIGHTS) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Dates de séjour invalides.' }) };
  }

  const nightsAmountCents = nights * NIGHT_PRICE_EUR * 100;
  const breakfastAmountCents = petitDej ? nights * ROOM_GUESTS * BREAKFAST_PRICE_EUR * 100 : 0;

  const lineItems = [
    {
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Chambre classique — ${nights} nuit${nights > 1 ? 's' : ''} (${arrivee} → ${depart})`,
        },
        unit_amount: nightsAmountCents,
      },
      quantity: 1,
    },
  ];

  if (breakfastAmountCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Petit-déjeuner continental (2 pers. × ${nights} jour${nights > 1 ? 's' : ''})`,
        },
        unit_amount: breakfastAmountCents,
      },
      quantity: 1,
    });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = event.headers.origin || event.headers.referer || 'https://gardengarden-chavanoz.com';
  const baseUrl = origin.replace(/\/$/, '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: lineItems,
      success_url: `${baseUrl}/reservation-chambre-confirmee.html`,
      cancel_url: `${baseUrl}/reservation-chambre-annulee.html`,
      // Le webhook Stripe relit ces informations pour écrire la réservation dans le
      // Google Sheet et envoyer la confirmation au client — jamais avant paiement confirmé.
      metadata: { prenom, nom, email, telephone, arrivee, depart, nuits: String(nights), petitDej: petitDej ? 'oui' : 'non' },
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
