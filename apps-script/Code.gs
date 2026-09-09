/**
 * Garden Garden — Système de réservations
 * Google Sheet "Réservations Garden Garden"
 * SHEET_ID: 1qIpRoT3IccSyPYZaFJem-fsF-DwmhSrtRLUoTLCI3tI
 *
 * Colonnes attendues sur la 1ère ligne de la feuille :
 * Reçu le | Prénom | Nom | Date | Heure | Convives | Téléphone | Email | Occasion | Statut
 */

var SHEET_ID = '1qIpRoT3IccSyPYZaFJem-fsF-DwmhSrtRLUoTLCI3tI';
var HEADERS = ['Reçu le', 'Prénom', 'Nom', 'Date', 'Heure', 'Convives', 'Téléphone', 'Email', 'Occasion', 'Statut'];

function getSheet_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Reçoit une réservation (POST en JSON) et l'ajoute à la feuille
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
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

    return jsonResponse_({ success: true });
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

// Retourne les réservations en JSON : ?action=getReservations
// Nettoie les lignes de test : ?action=cleanupTestData
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;

    if (action === 'cleanupTestData') {
      return jsonResponse_(cleanupTestData_());
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
