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

/**
 * Clé d'accès aux données de réservation.
 *
 * Elle n'est PAS écrite dans ce fichier : elle se règle une fois pour toutes dans
 * l'éditeur Apps Script, via Paramètres du projet > Propriétés du script, en créant
 * une propriété nommée ADMIN_KEY avec une valeur longue et aléatoire.
 *
 * Tant que cette propriété n'existe pas, la lecture des réservations est refusée :
 * c'est volontaire, pour qu'un oubli de configuration n'ouvre pas la liste des clients.
 */
function adminKeyOk_(fournie) {
  var attendue = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!attendue) return false;
  if (!fournie || String(fournie).length !== attendue.length) return false;
  // Comparaison à durée constante, pour ne pas laisser deviner la clé caractère par caractère.
  var ecart = 0;
  for (var i = 0; i < attendue.length; i++) {
    ecart |= attendue.charCodeAt(i) ^ String(fournie).charCodeAt(i);
  }
  return ecart === 0;
}

// Liste des réservations, au format attendu par la page d'administration.
function listeReservations_() {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();

  // On utilise HEADERS (et non la ligne 1 réelle de la feuille) pour nommer les clés :
  // si quelqu'un modifie/tape mal un intitulé de colonne dans la Sheet, le JSON reste correct.
  return values.slice(1)
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
}

// Reçoit une réservation (POST en JSON) et l'ajoute à la feuille
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Actions réservées à l'établissement : elles exposent ou effacent des données
    // personnelles de clients, elles exigent donc la clé d'accès.
    if (data.action === 'getReservations' || data.action === 'cleanupTestData') {
      if (!adminKeyOk_(data.key)) {
        return jsonResponse_({ success: false, error: 'Clé d\'accès invalide ou non configurée.' });
      }
      if (data.action === 'cleanupTestData') {
        return jsonResponse_(cleanupTestData_());
      }
      return jsonResponse_({ success: true, reservations: listeReservations_() });
    }

    // Sans action : c'est le formulaire public, qui crée une réservation.
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
    var isTest = /^test/i.test(prenom) || /a-supprimer/i.test(nom) || (prenom === 'Pierre' && nom === 'Martin');
    if (isTest) {
      deleted.push(prenom + ' ' + nom);
      sheet.deleteRow(i + 1); // +1 car deleteRow est 1-indexé
    }
  }

  return { success: true, deleted: deleted };
}

/**
 * Point d'entrée GET.
 *
 * Il ne renvoie plus aucune donnée de réservation : jusqu'au 19 septembre 2026, un simple
 * appel à ?action=getReservations suffisait, sans authentification, pour récupérer les
 * noms, téléphones et emails de tous les clients. La lecture passe désormais par doPost,
 * avec la clé d'accès (voir adminKeyOk_).
 */
function doGet() {
  return jsonResponse_({
    success: false,
    error: 'Action inconnue. La lecture des réservations se fait en POST, avec la clé d\'accès.'
  });
}
