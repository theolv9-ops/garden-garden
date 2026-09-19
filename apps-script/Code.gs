/**
 * Garden Garden — Système de réservations
 * Google Sheet "Réservations Garden Garden"
 * SHEET_ID: 1qIpRoT3IccSyPYZaFJem-fsF-DwmhSrtRLUoTLCI3tI
 *
 * Onglet "Réservations" (table du restaurant), colonnes sur la 1ère ligne :
 * Reçu le | Prénom | Nom | Date | Heure | Convives | Téléphone | Email | Occasion | Statut
 *
 * Onglet "Chambres" (réservations de chambre payées via Stripe), colonnes :
 * Reçu le | Prénom | Nom | Email | Téléphone | Arrivée | Départ | Nuits | Petit-déj | Montant | Statut | Session Stripe
 *
 * Avant d'utiliser doPost avec type="chambre", définir la propriété de script
 * SHARED_SECRET (menu Extensions > Propriétés du script) avec une valeur secrète,
 * et mettre la même valeur dans la variable d'environnement Netlify GAS_SHARED_SECRET.
 * Cela empêche quiconque d'appeler ce endpoint pour créer de fausses réservations "payées".
 */

var SHEET_ID = '1qIpRoT3IccSyPYZaFJem-fsF-DwmhSrtRLUoTLCI3tI';
var HEADERS = ['Reçu le', 'Prénom', 'Nom', 'Date', 'Heure', 'Convives', 'Téléphone', 'Email', 'Occasion', 'Statut'];

var ROOM_SHEET_NAME = 'Chambres';
var ROOM_HEADERS = ['Reçu le', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Arrivée', 'Départ', 'Nuits', 'Petit-déj', 'Montant', 'Statut', 'Session Stripe'];

var OWNER_EMAIL = 'contact.gardengarden38@gmail.com';

function getSheet_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

// Récupère (ou crée) l'onglet dédié aux réservations de chambre
function getRoomSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(ROOM_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ROOM_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ROOM_HEADERS);
  }
  return sheet;
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Enregistre une réservation de table (comportement historique, inchangé)
function saveTableReservation_(data) {
  var sheet = getSheet_();

  // Le formulaire a un champ "Commentaires" mais la feuille n'a que 10 colonnes fixes :
  // on ajoute le commentaire à la suite de l'occasion pour ne rien perdre.
  var occasion = data.occasion || '';
  if (data.commentaires) {
    occasion = occasion ? occasion + ' — ' + data.commentaires : data.commentaires;
  }

  var rowValues = [[
    new Date(),
    data.prenom || '',
    data.nom || '',
    data.date || '',
    data.heure || '',
    data.convives || '',
    data.telephone || '',
    data.email || '',
    occasion,
    'Nouvelle'
  ]];

  var rowIndex = sheet.getLastRow() + 1;
  var range = sheet.getRange(rowIndex, 1, 1, rowValues[0].length);
  // Force Date/Heure/Téléphone/Email/Occasion/Statut en texte brut : sans ça, Sheets
  // les convertit automatiquement en date/heure/nombre (ex: "0612345678" -> 612345678,
  // le 0 initial disparaît). "Reçu le" reste une vraie date, "Convives" reste un nombre.
  range.setNumberFormats([['dd/MM/yyyy HH:mm', '@', '@', '@', '@', '0', '@', '@', '@', '@']]);
  range.setValues(rowValues);

  return { success: true };
}

// Enregistre une réservation de chambre déjà payée (appelé par le webhook Stripe,
// jamais directement par le site) et envoie la confirmation au client + une
// notification à Théo, sans intervention manuelle.
function saveRoomReservation_(data) {
  var secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  if (!secret || data.secret !== secret) {
    return { success: false, error: 'Non autorisé' };
  }

  var sheet = getRoomSheet_();
  var nuits = parseInt(data.nuits, 10) || 0;
  var montant = data.montant || '';
  var petitDej = data.petitDej === 'oui' ? 'Oui' : 'Non';

  var rowValues = [[
    new Date(),
    data.prenom || '',
    data.nom || '',
    data.email || '',
    data.telephone || '',
    data.arrivee || '',
    data.depart || '',
    nuits,
    petitDej,
    montant,
    'Payée',
    data.stripeSessionId || ''
  ]];

  var rowIndex = sheet.getLastRow() + 1;
  var range = sheet.getRange(rowIndex, 1, 1, rowValues[0].length);
  // Comme pour les tables : on force le texte brut sur Email/Téléphone/Dates/Statut/Session
  // pour éviter que Sheets ne les reformate (perte du 0 initial d'un numéro, etc.).
  range.setNumberFormats([['dd/MM/yyyy HH:mm', '@', '@', '@', '@', '@', '@', '0', '@', '@', '@', '@']]);
  range.setValues(rowValues);

  sendRoomConfirmationEmails_(data, montant, nuits, petitDej);

  return { success: true };
}

function sendRoomConfirmationEmails_(data, montant, nuits, petitDej) {
  var recap = [
    'Arrivée : ' + data.arrivee,
    'Départ : ' + data.depart,
    'Nuits : ' + nuits,
    'Petit-déjeuner : ' + petitDej,
    'Montant payé : ' + montant + ' €'
  ].join('\n');

  try {
    if (data.email) {
      MailApp.sendEmail({
        to: data.email,
        subject: 'Votre réservation est confirmée — Garden Garden',
        body:
          'Bonjour ' + (data.prenom || '') + ',\n\n' +
          'Votre paiement a bien été reçu et votre chambre est réservée. À bientôt !\n\n' +
          recap + '\n\n' +
          'Garden Garden\n14 hameau de Grange Rouge, 2 route de Loyettes, 38230 Chavanoz\n04 86 80 27 50'
      });
    }
  } catch (err) {
    // On ne bloque pas l'enregistrement si l'envoi au client échoue (adresse invalide, etc.)
  }

  try {
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: 'Nouvelle chambre payée — ' + (data.prenom || '') + ' ' + (data.nom || ''),
      body: 'Nouvelle réservation de chambre payée en ligne :\n\n' +
        'Client : ' + (data.prenom || '') + ' ' + (data.nom || '') + '\n' +
        'Email : ' + (data.email || '') + '\n' +
        'Téléphone : ' + (data.telephone || '') + '\n' +
        recap
    });
  } catch (err) {
    // idem : ne pas bloquer l'enregistrement de la réservation pour un souci d'envoi
  }
}

// Reçoit une réservation (POST en JSON) et l'ajoute à la bonne feuille.
// data.type === 'chambre' -> réservation de chambre payée (depuis le webhook Stripe)
// sinon -> réservation de table du restaurant (comportement historique)
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.type === 'chambre') {
      return jsonResponse_(saveRoomReservation_(data));
    }

    return jsonResponse_(saveTableReservation_(data));
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message });
  }
}

// Supprime les lignes de test (Prénom commençant par "TEST", Nom contenant
// "A-SUPPRIMER", ou l'ancienne ligne "Pierre Martin"). Ne touche à rien d'autre.
function cleanupTestData_() {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var deleted = [];

  for (var i = values.length - 1; i >= 1; i--) {
    var prenom = String(values[i][1] || '');
    var nom = String(values[i][2] || '');
    var isTest = /test/i.test(prenom) || /test/i.test(nom) || /a-supprimer/i.test(nom) || (prenom === 'Pierre' && nom === 'Martin');
    if (isTest) {
      deleted.push(prenom + ' ' + nom);
      sheet.deleteRow(i + 1); // +1 car deleteRow est 1-indexé
    }
  }

  return { success: true, deleted: deleted };
}

// Retourne les réservations de table en JSON : ?action=getReservations
// Retourne les réservations de chambre en JSON : ?action=getChambres
// Nettoie les lignes de test : ?action=cleanupTestData
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;

    if (action === 'cleanupTestData') {
      return jsonResponse_(cleanupTestData_());
    }

    if (action === 'getChambres') {
      var roomSheet = getRoomSheet_();
      var roomValues = roomSheet.getDataRange().getValues();
      var tzRoom = Session.getScriptTimeZone();

      var chambres = roomValues.slice(1)
        .filter(function (row) { return row.join('') !== ''; })
        .map(function (row) {
          var obj = {};
          ROOM_HEADERS.forEach(function (h, i) {
            var val = row[i];
            if (val instanceof Date) {
              val = Utilities.formatDate(val, tzRoom, 'dd/MM/yyyy HH:mm');
            }
            obj[h] = val;
          });
          return obj;
        })
        .reverse();

      return jsonResponse_({ success: true, chambres: chambres });
    }

    if (action !== 'getReservations') {
      return jsonResponse_({ success: false, error: 'Action inconnue' });
    }

    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    var tz = Session.getScriptTimeZone();

    // On utilise HEADERS (et non la ligne 1 réelle de la feuille) pour nommer les clés :
    // si quelqu'un modifie/tape mal un intitulé de colonne dans la Sheet, le JSON reste correct.
    var reservations = values.slice(1)
      .filter(function (row) { return row.join('') !== ''; })
      .map(function (row) {
        var obj = {};
        HEADERS.forEach(function (h, i) {
          var val = row[i];
          if (val instanceof Date) {
            val = Utilities.formatDate(val, tz, 'dd/MM/yyyy HH:mm');
          }
          obj[h] = val;
        });
        return obj;
      })
      .reverse(); // les plus récentes en premier

    return jsonResponse_({ success: true, reservations: reservations });
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message });
  }
}
