# Paiement des chambres en ligne (Stripe)

Le bouton « Payer ma chambre en ligne » de la page d'accueil pointe vers un
**lien de paiement Stripe**. Tant qu'aucun lien n'est renseigné, le bouton reste
masqué : personne ne peut tomber sur une page d'erreur.

## 1. Créer le lien de paiement dans Stripe

Tableau de bord Stripe → **Paiements** → **Liens de paiement** → **Nouveau**.

- **Produit** : `Chambre classique — Garden Garden`
- **Prix** : `110,00 €`, paiement **unique** (pas d'abonnement)
- Dans la section **Produit**, cocher **« Laisser les clients ajuster la quantité »**
  (*Let customers adjust quantity*) avec **minimum 1** et **maximum 7**.
  La quantité = **le nombre de nuits**. 3 nuits → 330 €, calculé par Stripe.
- Renommer la description en `110 € la nuit — indiquez ci-dessous le nombre de nuits`
  pour qu'aucun client ne confonde quantité et nombre de chambres.

## 2. Champs à faire remplir par le client

Dans l'onglet **Options** du lien de paiement :

- **Champs personnalisés** (2 maximum sur un lien de paiement) :
  1. `Date d'arrivée (JJ/MM/AAAA)` — type **texte**, obligatoire
  2. `Nombre de personnes` — type **liste déroulante**, valeurs `1` et `2`
- Cocher **« Exiger que les clients fournissent un numéro de téléphone »**.

Ces réponses apparaissent ensuite sur chaque paiement, dans **Paiements** →
le paiement concerné.

## 3. Option petit-déjeuner (facultatif)

Stripe permet d'ajouter des **articles optionnels** au lien : créer un produit
`Petit-déjeuner continental` à `15,00 €` et l'ajouter en article optionnel, avec
quantité ajustable. Le client le coche s'il le souhaite.

## 4. Message après paiement

Toujours dans **Options**, choisir d'afficher un message de confirmation, par
exemple :

> Merci ! Votre paiement est enregistré. Nous vous confirmons votre chambre par
> téléphone sous 24 h. Garden Garden — 04 86 80 27 50.

C'est important : **le paiement ne vérifie pas la disponibilité** des 7 chambres.
Un client peut payer pour une date complète — il faut alors le rappeler et le
rembourser depuis Stripe (bouton **Rembourser** sur le paiement).

## 5. Coller le lien dans le site

Copier l'URL du lien (de la forme `https://buy.stripe.com/4gw8wR0aB1cD2ef3gh`),
puis dans `index.html`, dans le bloc `<script>` (constante `STRIPE_PAYMENT_LINK`,
vers la ligne 938) :

```js
var STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/votre-vrai-lien';
```

Le bouton réapparaît automatiquement sur le site. Si la valeur est vide ou
contient encore le gabarit `REMPLACE_PAR_TON_LIEN`, le bouton reste masqué.

## Avant la vraie ouverture

Stripe démarre en **mode test** : les liens créés en mode test ne prennent aucun
paiement réel. Vérifier que l'interrupteur **Mode test** est **désactivé** avant
de copier le lien définitif, sinon les clients paieront avec de la fausse monnaie.
