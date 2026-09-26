# Script de réservations — mise en service

Le fichier `Code.gs` se colle dans le projet Apps Script lié à la feuille
« Réservations Garden Garden ».

## Étape obligatoire : la clé d'accès

Depuis le 19 septembre 2026, la liste des réservations ne sort plus du script sans clé.
Avant tout, il faut donc en créer une :

1. dans l'éditeur Apps Script, ouvrir **Paramètres du projet** ;
2. section **Propriétés du script**, cliquer sur **Ajouter une propriété** ;
3. nom de la propriété : `ADMIN_KEY` ;
4. valeur : une chaîne longue et aléatoire, d'au moins 24 caractères (par exemple le
   résultat d'un gestionnaire de mots de passe). Cette valeur ne doit jamais être écrite
   dans le dépôt ni envoyée par message ;
5. enregistrer, puis **redéployer** le script (Déployer > Gérer les déploiements >
   modifier le déploiement existant > Nouvelle version), pour que l'URL `/exec` actuelle
   serve bien le nouveau code.

Tant que `ADMIN_KEY` n'existe pas, la lecture des réservations est refusée. C'est
volontaire : un oubli de configuration ne doit pas rouvrir la liste des clients.

La page `reservations.html` demande cette clé à l'ouverture et la garde le temps de
l'onglet seulement.

## Ce qui reste public

Seule la création d'une réservation par le formulaire du site reste ouverte, sans clé :
c'est le parcours normal d'un client.

## Pourquoi ce changement

Jusqu'à cette date, un simple appel à `…/exec?action=getReservations` suffisait, sans
aucune authentification, pour récupérer les noms, téléphones et emails de tous les
clients ayant réservé. L'action `cleanupTestData`, qui supprime des lignes, était elle
aussi ouverte à tous. Les deux passent désormais par `doPost` avec la clé.
