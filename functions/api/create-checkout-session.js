// Fonction Cloudflare Pages : crée une session de paiement Stripe pour une
// réservation de chambre. Le prix est TOUJOURS recalculé ici, côté serveur, à
// partir des dates envoyées : on ne fait jamais confiance à un montant qui
// viendrait du navigateur du client.
//
// Appel direct à l'API Stripe en HTTP (pas de dépendance npm) : ça fonctionne
// nativement sur l'environnement "edge" de Cloudflare, sans configuration
// particulière de compatibilité Node.
//
// Variable d'environnement nécessaire (Cloudflare Pages > Settings > Environment
// variables) :
// - STRIPE_SECRET_KEY : la clé secrète du compte Stripe de Garden Garden

const OPENING_DATE = '2026-10-02';
const NIGHT_PRICE_EUR = 110;
const BREAKFAST_PRICE_EUR = 15; // par personne et par jour
const ROOM_GUESTS = 2; // chambre classique, 2 personnes
const MAX_NIGHTS = 30;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Transforme un objet (éventuellement imbriqué) en paires clé/valeur au format
// attendu par l'API Stripe en form-urlencoded, ex: line_items[0][quantity]=1
function toStripeForm(obj, prefix, form) {
  form = form || new URLSearchParams();
  Object.keys(obj).forEach(function (key) {
    var value = obj[key];
    var field = prefix ? prefix + '[' + key + ']' : key;
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(function (item, i) {
        if (item !== null && typeof item === 'object') {
          toStripeForm(item, field + '[' + i + ']', form);
        } else {
          form.append(field + '[' + i + ']', String(item));
        }
      });
    } else if (typeof value === 'object') {
      toStripeForm(value, field, form);
    } else {
      form.append(field, String(value));
    }
  });
  return form;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Le paiement n'est pas encore configuré (clé Stripe manquante)." }, 500);
  }

  let data;
  try {
    data = await request.json();
  } catch (err) {
    return json({ error: 'Requête invalide' }, 400);
  }

  const prenom = String(data.prenom || '').trim();
  const nom = String(data.nom || '').trim();
  const email = String(data.email || '').trim();
  const telephone = String(data.telephone || '').trim();
  const arrivee = String(data.arrivee || '').trim();
  const depart = String(data.depart || '').trim();
  const petitDej = !!data.petitDej;

  if (!prenom || !nom || !email || !telephone || !arrivee || !depart) {
    return json({ error: 'Merci de remplir tous les champs.' }, 400);
  }

  const dArrivee = new Date(arrivee + 'T00:00:00');
  const dDepart = new Date(depart + 'T00:00:00');
  const nights = Math.round((dDepart - dArrivee) / 86400000);

  if (arrivee < OPENING_DATE) {
    return json({ error: 'Garden Garden ouvre ses portes le 2 octobre 2026.' }, 400);
  }
  if (!nights || nights < 1 || nights > MAX_NIGHTS) {
    return json({ error: 'Dates de séjour invalides.' }, 400);
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

  const origin = request.headers.get('origin') || request.headers.get('referer') || 'https://gardengarden-chavanoz.com';
  const baseUrl = origin.replace(/\/$/, '');

  const form = toStripeForm({
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

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const session = await res.json();
    if (!res.ok) {
      return json({ error: (session.error && session.error.message) || 'Erreur Stripe' }, 500);
    }
    return json({ url: session.url });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
