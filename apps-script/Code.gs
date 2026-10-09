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
 * et mettre la même valeur dans la variable d'environnement Cloudflare Pages
 * GAS_SHARED_SECRET. Cela empêche quiconque d'appeler ce endpoint pour créer de
 * fausses réservations "payées".
 */

var SHEET_ID = '1qIpRoT3IccSyPYZaFJem-fsF-DwmhSrtRLUoTLCI3tI';
var HEADERS = ['Reçu le', 'Prénom', 'Nom', 'Date', 'Heure', 'Convives', 'Téléphone', 'Email', 'Occasion', 'Statut'];

var ROOM_SHEET_NAME = 'Chambres';
var ROOM_HEADERS = ['Reçu le', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Arrivée', 'Départ', 'Nuits', 'Petit-déj', 'Montant', 'Statut', 'Session Stripe'];

// Adresse prévenue par email à chaque nouvelle réservation (table ou chambre). Envoyé
// par MailApp, depuis le compte Google propriétaire du script : contrairement à un
// service tiers (FormSubmit), l'envoi ne dépend d'aucune activation externe et n'est
// jamais bloqué en silence. Limite Google : 100 emails/jour sur un compte gratuit,
// largement suffisante ici.
var NOTIFY_EMAIL = 'contact.gardengarden38@gmail.com';

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

/**
 * Clé d'accès aux données de réservation (tables et chambres).
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

// Liste des réservations de table, au format attendu par la page d'administration.
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

// Liste des réservations de chambre payées, même logique que listeReservations_.
function listeChambres_() {
  var sheet = getRoomSheet_();
  var values = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();

  return values.slice(1)
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      ROOM_HEADERS.forEach(function (h, i) {
        var val = row[i];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, tz, 'dd/MM/yyyy HH:mm');
        }
        obj[h] = val;
      });
      return obj;
    })
    .reverse();
}

// Enregistre une réservation de table (comportement historique) et prévient
// l'établissement par email.
function saveTableReservation_(data) {
  // Verrou : deux demandes simultanées ne doivent pas se voir « de la place » en même temps.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return saveTableReservationLocked_(data);
  } finally {
    lock.releaseLock();
  }
}

function saveTableReservationLocked_(data) {
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

  var decision = decisionAutomatique_(data, rowIndex);
  if (decision.statut !== STATUT_NOUVELLE) {
    sheet.getRange(rowIndex, STATUT_COL).setValue(decision.statut);
  }
  notifierNouvelleReservation_(data, occasion, decision);
  repondreAuClient_(data, occasion, decision, sheet.getRange(rowIndex, STATUT_COL));

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

  // Stripe peut renvoyer le même paiement plusieurs fois (retry si la réponse
  // n'arrive pas assez vite à son goût) : on ignore un paiement déjà enregistré,
  // reconnu par son identifiant de session Stripe (dernière colonne).
  if (data.stripeSessionId) {
    var existant = sheet.getDataRange().getValues();
    for (var i = 1; i < existant.length; i++) {
      if (existant[i][existant[i].length - 1] === data.stripeSessionId) {
        return { success: true, doublon: true };
      }
    }
  }

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
    // On ne bloque pas l'enregistrement si l'envoi au client échoue (adresse invalide, etc.),
    // mais on logge la vraie cause dans Exécutions pour pouvoir la diagnostiquer.
    console.error('Échec de l\'email de confirmation client (chambre) : ' + err.message);
  }

  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Nouvelle chambre payée — ' + (data.prenom || '') + ' ' + (data.nom || ''),
      body: 'Nouvelle réservation de chambre payée en ligne :\n\n' +
        'Client : ' + (data.prenom || '') + ' ' + (data.nom || '') + '\n' +
        'Email : ' + (data.email || '') + '\n' +
        'Téléphone : ' + (data.telephone || '') + '\n' +
        recap
    });
  } catch (err) {
    // idem : ne pas bloquer l'enregistrement de la réservation pour un souci d'envoi
    console.error('Échec de l\'email de notification (chambre) : ' + err.message);
  }
}

// Prévient l'établissement par email qu'une réservation de table vient d'arriver.
// La réservation est déjà enregistrée dans la Sheet à ce stade : un échec
// d'envoi ici (quota Gmail dépassé, etc.) ne doit jamais faire perdre la
// réservation ni faire échouer la réponse au site, d'où le try/catch.
function notifierNouvelleReservation_(data, occasion, decision) {
  try {
    var sujet = 'Nouvelle réservation — ' + (data.prenom || '') + ' ' + (data.nom || '') +
      (decision ? ' [' + decision.libelle + ']' : '');
    var corps = [
      'Prénom : ' + (data.prenom || ''),
      'Nom : ' + (data.nom || ''),
      'Date : ' + (data.date || ''),
      'Heure : ' + (data.heure || ''),
      'Convives : ' + (data.convives || ''),
      'Téléphone : ' + (data.telephone || ''),
      'Email : ' + (data.email || ''),
      'Occasion / commentaire : ' + (occasion || '—'),
      decision ? '\nDécision automatique : ' + decision.libelle + ' — ' + decision.raison : ''
    ].join('\n');
    var options = {
      to: NOTIFY_EMAIL,
      subject: sujet,
      body: corps,
      // Le client apparaît comme expéditeur affiché ; « Répondre » lui écrit directement.
      // L'adresse d'envoi reste celle du compte Google qui a déployé le script : Google
      // n'autorise pas d'envoyer au nom de l'adresse d'un client.
      name: ((data.prenom || '') + ' ' + (data.nom || '')).trim() + ' (via le site)'
    };
    if (data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      options.replyTo = data.email;
    }
    MailApp.sendEmail(options);
  } catch (err) {
    // On logge dans Exécutions plutôt que de propager l'erreur : la
    // réservation est déjà sauvegardée, seul l'email a échoué.
    console.error('Échec de l\'email de notification : ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Suivi des réservations de table : accusé de réception, confirmation, rappel
//
// 1. Chaque demande est traitée automatiquement : confirmée si le restaurant est
//    ouvert, le groupe petit et la place disponible (capacité réglable plus bas) ;
//    refusée si fermé ; sinon laissée « Nouvelle » avec un accusé de réception qui ne
//    promet pas la table. Le client reçoit l'email correspondant tout de suite.
// 2. Quand l'établissement change le Statut à la main (« Confirmée » / « Refusée »),
//    l'email correspondant part aussi tout seul, une seule fois par ligne.
// 3. Chaque matin, un rappel est envoyé à l'établissement tant que des demandes
//    sont restées sur « Nouvelle ».
// Les déclencheurs (2 et 3) s'installent une seule fois en lançant
// installerDeclencheurs() depuis l'éditeur Apps Script.
// ---------------------------------------------------------------------------

var STATUT_COL = 10; // colonne J de l'onglet des tables
var STATUT_NOUVELLE = 'Nouvelle';
var STATUT_CONFIRMEE = 'Confirmée';
var STATUT_REFUSEE = 'Refusée';
var SIGNATURE_RESTAURANT =
  'Garden Garden\n14 hameau de Grange Rouge, 38230 Chavanoz\nTél : 04 86 80 27 50 / 06 61 02 44 31';

function emailValide_(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Date stockée en texte (2026-10-03) -> 03/10/2026 pour les emails
function dateLisible_(d) {
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(d || '');
}

function recapTable_(r) {
  return [
    'Date : ' + dateLisible_(r.date),
    'Heure : ' + (r.heure || ''),
    'Convives : ' + (r.convives || ''),
    r.occasion ? 'Précisions : ' + r.occasion : ''
  ].filter(String).join('\n');
}

// Envoie un email au client avec le nom du restaurant en expéditeur ; les réponses
// du client arrivent sur l'adresse de l'établissement.
function envoyerAuClient_(r, sujet, intro) {
  if (!emailValide_(r.email)) return false;
  MailApp.sendEmail({
    to: r.email,
    subject: sujet,
    body: 'Bonjour ' + (r.prenom || '') + ',\n\n' + intro + '\n\n' + recapTable_(r) + '\n\n' + SIGNATURE_RESTAURANT,
    name: 'Garden Garden',
    replyTo: NOTIFY_EMAIL
  });
  return true;
}

// ---- Décision automatique ------------------------------------------------
// Règles réglables ici. Une demande est confirmée toute seule si le restaurant est
// ouvert à ce moment-là, si le groupe est petit et s'il reste de la place. Sinon elle
// reste « Nouvelle » (à vérifier à la main) ou est refusée si le restaurant est fermé.
var CAPACITE_COUVERTS = { midi: 30, soir: 30 }; // couverts max par service : À AJUSTER avec Garden Garden
var GROUPE_MAX_AUTO = 6;                        // au-delà : vérification manuelle
// Jours d'ouverture par service (0 = dimanche … 6 = samedi), d'après le site.
var JOURS_OUVERTS = { midi: [0, 1, 2, 3, 4, 5, 6], soir: [4, 5, 6] };
var MIDI_DEBUT = 12 * 60, MIDI_FIN = 15 * 60;   // service du midi (dimanche : jusqu'à 18 h)
var SOIR_DEBUT = 17 * 60;

function serviceDe_(minutes, jour) {
  var finMidi = jour === 0 ? 18 * 60 : MIDI_FIN;
  if (minutes >= MIDI_DEBUT && minutes < finMidi) return 'midi';
  if (minutes >= SOIR_DEBUT) return 'soir';
  return null;
}

function nombreCouverts_(convives) {
  var m = String(convives || '').match(/^\s*(\d+)\s*personne/i);
  return m ? parseInt(m[1], 10) : null; // « Grande tablée (7+) » -> null
}

function minutesDe_(heure) {
  var m = String(heure || '').match(/^(\d{1,2})[:h](\d{2})$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

// Décide du sort d'une demande tout juste enregistrée à la ligne rowIndex.
function decisionAutomatique_(data, rowIndex) {
  var nouvelle = function (raison) { return { statut: STATUT_NOUVELLE, libelle: 'À VÉRIFIER', raison: raison }; };
  try {
    var m = String(data.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var minutes = minutesDe_(data.heure);
    var n = nombreCouverts_(data.convives);
    if (!m || minutes === null) return nouvelle('date ou heure illisible');
    if (n === null || n > GROUPE_MAX_AUTO) return nouvelle('grand groupe (' + data.convives + '), à voir avec le client');

    var jour = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)).getDay();
    var service = serviceDe_(minutes, jour);
    if (!service) return nouvelle('heure en dehors des services');
    if (JOURS_OUVERTS[service].indexOf(jour) === -1) {
      return { statut: STATUT_REFUSEE, libelle: 'REFUSÉE (fermé)', raison: 'le restaurant n\'est pas ouvert ce jour-là à ce service' };
    }

    // Places déjà confirmées le même jour, au même service (hors la ligne tout juste ajoutée).
    var values = getSheet_().getDataRange().getValues();
    var pris = 0;
    for (var i = 1; i < values.length; i++) {
      if (i + 1 === rowIndex) continue;
      if (String(values[i][STATUT_COL - 1]).trim() !== STATUT_CONFIRMEE) continue;
      if (String(values[i][3]) !== String(data.date)) continue;
      var mi = minutesDe_(values[i][4]);
      if (mi === null || serviceDe_(mi, jour) !== service) continue;
      pris += nombreCouverts_(values[i][5]) || 0;
    }
    if (pris + n > CAPACITE_COUVERTS[service]) {
      return nouvelle('service presque complet (' + pris + '/' + CAPACITE_COUVERTS[service] + ' couverts déjà confirmés)');
    }
    return { statut: STATUT_CONFIRMEE, libelle: 'CONFIRMÉE AUTO', raison: (pris + n) + '/' + CAPACITE_COUVERTS[service] + ' couverts ce service' };
  } catch (err) {
    console.error('Échec de la décision automatique : ' + err.message);
    return nouvelle('erreur de calcul, à vérifier');
  }
}

// Email au client selon la décision ; la note de la cellule Statut empêche un doublon
// si quelqu'un modifie ensuite le statut à la main.
function repondreAuClient_(data, occasion, decision, statutRange) {
  try {
    var r = { prenom: data.prenom, email: data.email, date: data.date, heure: data.heure, convives: data.convives, occasion: occasion };
    var envoye;
    if (decision.statut === STATUT_CONFIRMEE) {
      envoye = envoyerAuClient_(r, 'Votre réservation est confirmée — Garden Garden',
        'Bonne nouvelle : votre réservation est confirmée. Nous avons hâte de vous accueillir !');
    } else if (decision.statut === STATUT_REFUSEE) {
      envoye = envoyerAuClient_(r, 'Votre demande de réservation — Garden Garden',
        'Nous sommes désolés : nous ne sommes pas ouverts à ce moment-là. ' +
        'Consultez nos horaires sur le site ou appelez-nous au 04 86 80 27 50, nous trouverons un autre créneau.');
    } else {
      envoye = envoyerAuClient_(r, 'Votre demande de réservation — Garden Garden',
        'Nous avons bien reçu votre demande de réservation. Ce n\'est pas encore une confirmation : ' +
        'nous vérifions la disponibilité et nous revenons vers vous très vite, par email ou par téléphone.');
    }
    if (decision.statut !== STATUT_NOUVELLE) {
      statutRange.setNote(envoye
        ? 'Email « ' + decision.statut + ' » envoyé automatiquement au client.'
        : 'Aucun email envoyé : adresse du client absente ou invalide. Prévenir le client par téléphone.');
    }
  } catch (err) {
    console.error('Échec de l\'email au client : ' + err.message);
  }
}

// 2. Déclencheur installable « à la modification » : réagit au changement de Statut.
function surModificationStatut_(e) {
  try {
    var range = e && e.range;
    if (!range || range.getColumn() !== STATUT_COL || range.getRow() < 2) return;
    var sheet = range.getSheet();
    if (sheet.getSheetId() !== getSheet_().getSheetId()) return;

    var statut = String(range.getValue() || '').trim();
    if (statut !== STATUT_CONFIRMEE && statut !== STATUT_REFUSEE) return;

    // Garde-fou : un seul email par ligne, même si le statut est modifié plusieurs fois.
    if (range.getNote()) return;

    var row = sheet.getRange(range.getRow(), 1, 1, STATUT_COL).getValues()[0];
    var r = { prenom: row[1], nom: row[2], date: row[3], heure: row[4], convives: row[5], email: row[7], occasion: row[8] };

    var envoye;
    if (statut === STATUT_CONFIRMEE) {
      envoye = envoyerAuClient_(r, 'Votre réservation est confirmée — Garden Garden',
        'Bonne nouvelle : votre réservation est confirmée. Nous avons hâte de vous accueillir !');
    } else {
      envoye = envoyerAuClient_(r, 'Votre demande de réservation — Garden Garden',
        'Nous sommes désolés : nous ne pouvons pas honorer votre demande pour ce créneau. ' +
        'Appelez-nous au 04 86 80 27 50 et nous trouverons une autre solution ensemble.');
    }
    range.setNote(envoye
      ? 'Email « ' + statut + ' » envoyé au client le ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
      : 'Aucun email envoyé : adresse du client absente ou invalide. Prévenir le client par téléphone.');
  } catch (err) {
    console.error('Échec de l\'email de statut : ' + err.message);
  }
}

// 3. Rappel du matin : demandes restées sur « Nouvelle ».
function rappelDemandesEnAttente() {
  var values = getSheet_().getDataRange().getValues();
  var lignes = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][STATUT_COL - 1]).trim() === STATUT_NOUVELLE) {
      lignes.push('- ' + values[i][1] + ' ' + values[i][2] + ' · ' + dateLisible_(values[i][3]) + ' à ' + values[i][4] +
        ' · ' + values[i][5] + ' · ' + values[i][6]);
    }
  }
  if (lignes.length === 0) return;
  MailApp.sendEmail(NOTIFY_EMAIL,
    lignes.length + ' réservation(s) à confirmer — Garden Garden',
    'Ces demandes de table attendent encore une réponse (Statut « Nouvelle » dans la Sheet) :\n\n' +
    lignes.join('\n') +
    '\n\nPassez le Statut sur « Confirmée » (ou « Refusée ») : le client reçoit alors son email automatiquement.');
}

// À lancer UNE seule fois depuis l'éditeur (menu Exécuter) : installe le déclencheur
// de confirmation, le rappel de 9 h, et la liste déroulante du Statut. Relancer ne
// crée pas de doublons.
function installerDeclencheurs() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'surModificationStatut_' || f === 'rappelDemandesEnAttente') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('surModificationStatut_').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('rappelDemandesEnAttente').timeBased().everyDays(1).atHour(9).create();

  var sheet = getSheet_();
  var regle = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUT_NOUVELLE, STATUT_CONFIRMEE, STATUT_REFUSEE], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, STATUT_COL, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(regle);
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

// Reçoit une réservation ou une action d'administration (POST en JSON).
// - data.action === 'getReservations' | 'getChambres' | 'cleanupTestData' -> lecture/
//   maintenance réservée à l'établissement, protégée par ADMIN_KEY (voir adminKeyOk_).
// - data.type === 'chambre' -> réservation de chambre payée (depuis le webhook Stripe),
//   protégée par SHARED_SECRET (voir saveRoomReservation_).
// - sinon -> réservation de table du restaurant, créée par le formulaire public.
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Actions réservées à l'établissement : elles exposent ou effacent des données
    // personnelles de clients, elles exigent donc la clé d'accès.
    if (data.action === 'getReservations' || data.action === 'getChambres' || data.action === 'cleanupTestData') {
      if (!adminKeyOk_(data.key)) {
        return jsonResponse_({ success: false, error: 'Clé d\'accès invalide ou non configurée.' });
      }
      if (data.action === 'cleanupTestData') {
        return jsonResponse_(cleanupTestData_());
      }
      if (data.action === 'getChambres') {
        return jsonResponse_({ success: true, chambres: listeChambres_() });
      }
      return jsonResponse_({ success: true, reservations: listeReservations_() });
    }

    if (data.type === 'chambre') {
      return jsonResponse_(saveRoomReservation_(data));
    }

    // Sans action ni type : c'est le formulaire public, qui crée une réservation de table.
    return jsonResponse_(saveTableReservation_(data));
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message });
  }
}

/**
 * Point d'entrée GET.
 *
 * Il ne renvoie plus aucune donnée de réservation (tables ou chambres) : jusqu'au
 * 19 septembre 2026, un simple appel à ?action=getReservations suffisait, sans
 * authentification, pour récupérer les noms, téléphones et emails de tous les
 * clients. La lecture passe désormais par doPost, avec la clé d'accès (voir
 * adminKeyOk_).
 */
function doGet() {
  return jsonResponse_({
    success: false,
    error: 'Action inconnue. La lecture des réservations se fait en POST, avec la clé d\'accès.'
  });
}
