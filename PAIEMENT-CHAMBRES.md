# Paiement en ligne des chambres — mise en service

Le code est prêt. Il reste des étapes que seul Théo peut faire (créer le compte Stripe,
choisir l'hébergement, entrer les clés secrètes). Une fois ces étapes faites, le parcours
est 100 % automatique : le client choisit ses dates, paie, reçoit sa confirmation par email,
et une ligne apparaît dans l'onglet "Chambres" du Google Sheet — sans aucune action de Théo.

## 1. Créer le compte Stripe (~15 min)

1. Aller sur https://dashboard.stripe.com/register
2. S'inscrire avec les informations de Garden Garden (nom, SIRET si disponible) et l'IBAN
   qui doit recevoir les paiements.
3. Une fois le compte activé, récupérer la **clé secrète** : Développeurs > Clés API >
   "Clé secrète" (commence par `sk_live_...`). Ne jamais la partager ni la mettre dans le
   code — elle va uniquement dans Netlify (étape 3).

## 2. Héberger le site sur Netlify

Le site est aujourd'hui hébergé en pages statiques (probablement GitHub Pages), qui ne
peut pas exécuter de code côté serveur. Or il faut un endroit qui garde la clé secrète
Stripe cachée et qui parle à Stripe : c'est le rôle des "fonctions Netlify" déjà ajoutées
dans `netlify/functions/`.

1. Créer un compte sur https://netlify.com (gratuit) et connecter le dépôt GitHub
   `garden-garden`.
2. Netlify détecte automatiquement `netlify.toml` : rien à configurer côté build.
3. Une fois le site déployé sur Netlify, refaire pointer le nom de domaine
   `gardengarden-chavanoz.com` vers Netlify (Netlify explique la marche à suivre avec le
   registrar du domaine). Le fichier `CNAME` du dépôt sert aujourd'hui à GitHub Pages ;
   avec Netlify, le domaine personnalisé se configure depuis l'interface Netlify.

## 3. Renseigner les clés secrètes dans Netlify

Dans Netlify : Site settings > Environment variables, ajouter les 4 valeurs décrites dans
`.env.example` :

- `STRIPE_SECRET_KEY` — la clé secrète récupérée à l'étape 1
- `GAS_WEBHOOK_URL` — déjà indiquée dans `.env.example` (c'est l'URL Google Sheet existante)
- `GAS_SHARED_SECRET` — à inventer (une longue chaîne aléatoire au hasard) — noter cette
  valeur, elle sert aussi à l'étape 5
- `STRIPE_WEBHOOK_SECRET` — récupérée à l'étape 4 ci-dessous

## 4. Créer le webhook Stripe

Le "webhook" est ce qui permet à Stripe de prévenir automatiquement le site quand un
client a payé, pour enregistrer la réservation et envoyer la confirmation sans que Théo
ait à intervenir.

1. Dans Stripe : Développeurs > Webhooks > Ajouter un endpoint
2. URL du endpoint : `https://<ton-site>.netlify.app/.netlify/functions/stripe-webhook`
   (remplacer par le vrai domaine une fois le site sur Netlify)
3. Événement à écouter : `checkout.session.completed`
4. Stripe donne alors une "signature secrète du endpoint" (`whsec_...`) : c'est la valeur
   à mettre dans `STRIPE_WEBHOOK_SECRET` (étape 3).

## 5. Autoriser l'écriture des chambres côté Google Sheet

Dans l'éditeur Google Apps Script du projet (celui qui contient `Code.gs`) :

1. Paramètres du projet (icône ⚙️) > Propriétés du script > Ajouter une propriété de script
2. Nom : `SHARED_SECRET`, valeur : exactement la même chaîne que `GAS_SHARED_SECRET`
   (étape 3).
3. Redéployer le Web App Apps Script (Déployer > Gérer les déploiements > modifier) pour
   que le nouveau code de `Code.gs` soit pris en compte.

## Vérification

Une fois tout branché, faire un vrai test avec une petite réservation (Stripe propose un
"mode test" avec des cartes bancaires factices avant de passer en mode réel — je peux
détailler cette étape si besoin). Vérifier que :

- la redirection vers Stripe fonctionne et affiche le bon montant,
- après paiement test, une ligne apparaît dans l'onglet "Chambres" du Google Sheet,
- l'email de confirmation arrive bien au client et à
  `contact.gardengarden38@gmail.com`.
