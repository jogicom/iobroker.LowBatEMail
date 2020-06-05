// LowBattEMail.js V 0.1.4
// Geraete mit LowBat per EMail melden
// (c) 2020 WagoTEC.de, freigegeben unter MIT Lizenz

// Liste der verfügbaren ToolChain's
const TOOLTYPE_HM  = 0;

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! individuelle Konfiguration !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//var adapterList = [ {header:"", name:"hm-rpc.1.", typ:TOOLTYPE_HM} ,
//                    {header:"", name:"hm-rpc.4.", typ:TOOLTYPE_HM}];
var adapterList = [ {header:"", name:"hm-rpc.1.", typ:TOOLTYPE_HM}];

// EMail Einstellungen wenn nicht Global implementiert hier definieren
// const EMAIL_FROM_ADDRESS  = "fromname@fromdomain.de";
// const EMAIL_TO_ADDRESS    = "toname@todomain.de";
// const EMAIL_SUBJ_HEAD     = "MySystemName: ";

// Wenn die Debugfunktion nicht Global implementiert ist, diese Funktion hier aktivieren
//function myDebug (debugtext){
//  log(debugtext);               // Ausgabe der Debugtexte bei Bedarf aktivieren
//}
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Ende individuelle Konfiguration !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
const SCRIPT_VERSION      = "V 0.1.4";                  // Version Info
const COLOR_LOWBAT        = "#ff0033";                  // Zeilenfarbe wenn Gerät nicht erreichbar
const COLOR_OKBAT         = "#00ff00";                  // Zeilenfarbe wenn Gerät erreichbar
const SHORT_LOWBAT_TIME   = 360000;                     // ms nach 6 Minuten gilt Gerät als Dauerhaft LOWBAT
const EMAIL_SEND_DELAY    = 120000;                     // ms EMail Versand um 2 Minuten verzögern
const SHORT_LOWBAT_MAX    = 5;                          // Bei 5 LOWBAT Meldungen pro Tag wird Wechselflag gesetzt, wenn Meldung toggelt

const DATE_FORMAT         = "TT.MM.JJJJ";               // Ausgabeformat des datums
const REPLACE_STATES      = 5;                          // Maximale Grösse der VIS Wechseltabelle

// Verwendete Bezeichnungen der States, pro Gerät einmal vorhanden
const STATE_LAST_BATT_CHANGE  = ".LastBatteryChange";           // Datum des letzten Batterie Tausch
const STATE_RUNTIME_AKT       = ".AktuelleLaufzeit";            // Bis dato erreichte Laufzeit in Tagen
const STATE_RUNTIME_LAST      = ".LetzteLaufzeit";              // Bis zum letzten Batteriewechsel erreichte Laufzeit in Tagen

// Für Batteriewechsel 1x vorhanden
const STATE_LOWBATTERY_LIST   = "LowBatteryDeviceList";         // Liste in Textform der Geräte mit BattLow
const STATE_OKBATTERY_COUNT   = "BatteryOKDevices";             // Anzahl der Geräte BattOK
const STATE_LOWBATTERY_COUNT  = "LowBatteryDevices";            // Anzahl der Geräte mit BattLow
const STATE_SENDMAIL_BUTTON   = "SendInfoMail";                 // Wenn True, wird eine StatusMail versendet
const STATE_REPLACE_INFOBOX   = "InfoBox";                      // VIS Platzhalter für InfoBox Texte
// Für Batteriewechsel je 5x vorhanden
const STATE_REPLACE_STARTFLAG = "xReplace.StartFlag";           // VIS: wenn True, wird Batteriewechsel durchgeführt
const STATE_REPLACE_INDEX     = "xReplace.Index";               // Index in der Watchlist des Geräts für das Batteriewechsel ansteht
const STATE_REPLACE_DEVNAME   = "xReplace.DeviceName";          // Name des Geräts für das Batteriewechsel ansteht

const REORG_CHANGE_TABLE_TIME = 120000;                         // Zeit um welche die Reorganisation der Wechseltabelle verzoegert wird
const CLEAR_INFOBOX_TIME      = 300000;                         // Zeit bis Infoboxmeldungen gelöscht werden

// IDs der verschiedenen EMail Typen
const EMAILTYPE_START         = 0;                              // EMail wird von der Script Start Routine versendet
const EMAILTYPE_LOWBAT        = 1;                              // EMail wird bei Erkennung eines LowBats versendet
const EMAILTYPE_STATUS        = 2;                              // EMail wurde manuell Angefordert
const EMAILTYPE_DAYLY         = 3;                              // EMail taeglicher Statusbericht, wenn Geraete LowBat haben

//Welcher Zustand eines Device signalisiert den Lowbat Zustand
const STATUSTYP_FLAG          = 0;                              // Flag
const STATUSTYP_PERCENT       = 1;                              // Ladezustand in %
const STATUSTYP_VOLTAGE       = 2;                              // Ladezustand in V (Spannung)

// Commandos für die toolChain
const TOOLCOM_IS_BAT_LOW_FROMDEVICE = 0;                        // Auslesen des Batteriezustandes, return true = LOW, false = OK
const TOOLCOM_GETSTATETEXT          = 1;                        // Text des Zustandes Return Text der den Zustand des Batteriezustandes beschreibt

const TEXT_BATTERY_LOW        = "Low Battery";
const TEXT_BATTERY_OK         = "OK";

var toolTypeList = ["Homematic"];                               // Liste der verfügbaren ToolChain's
var statustypList = ["Flag", "Prozent", "Spannung"];            // Liste der verschiedenen LowBat Statustypen
// Ignore List fuer Homematic Geraete, die bei der Auswertung ignoriert werden
var devIgnoreHM = "_HM-LC-Sw1-FM_, _HM-LC-Sw1-Pl-CT-R1_";

DEBUGNAME = "LowBattEMail";
myDebug("Debug is ON");

var eMailDelayID = 0;                                             // ID des verzögerten Mailversandes
var lastErrorDevice = "";                                         // Gerät, das zuletzt eine Statusänderung hatte
var stateHeader = "javascript." + instance + ".BatterieStatus.";

setStateDelayed(stateHeader + STATE_SENDMAIL_BUTTON, false, 20000);    // Button fuer Manuellen Mailversand: Reset falls gesetzt

var watchlist = [];

// Generiere Watch-Objektliste fuer alle konfigurierten Adapter
adapterList.forEach(function(obj,i) {
  // Zuerst pruefen ob die Parameter vorhanden sind, wenn einer fehlt, abbrechen
  if(typeof obj.header === "undefined") {
    log("Fehler in der Adapterkonfiguration, pruefe die Angabe header: in der Adapterliste", 'error');
    return;
  }
  if(typeof obj.name === "undefined") {
    log("Fehler in der Adapterkonfiguration, pruefe die Angabe name: in der Adapterliste", 'error');
    return;
  }
  if(typeof obj.typ === "undefined") {
    log("Fehler in der Adapterkonfiguration, pruefe die Angabe typ: in der Adapterliste", 'error');
    return;
  }
  addToWatchlist(obj.header,obj.name, obj.typ);         // Eintrag in die Watchliste
});

// Sortieren des watchlist Arrays nach Geraetename
watchlist.sort(function(a, b) {
  var nameA = a.name.toUpperCase(); // Groß-/Kleinschreibung ignorieren
  var nameB = b.name.toUpperCase(); // Groß-/Kleinschreibung ignorieren
  if (nameA < nameB) { return -1;}
  if (nameA > nameB) { return 1; }
  return 0;
});

stateCreate();        // Benoetigte States erstellen

// Alle Geraete nach Scriptstart auf LowBat Pruefen
watchlist.forEach(function(obj, i) {
  var status = toolChain(TOOLCOM_IS_BAT_LOW_FROMDEVICE,i);
  if(status === true) {
    setTimeout(batteryLongLow,SHORT_LOWBAT_TIME,i);
    myDebug("Eine Geraet meldet LowBat bei Script Start: " + watchlist[i].name + " Pruefung laeuft");
  }
});

//Subscribes auf alle Batterie-States bilden
watchlist.forEach(function(obj, i) {
  on ({id: obj.id,    change: "ne" }, function () {checkBattery(i)});
});
setTimeout(sendEMail, 30000, EMAILTYPE_START);        // Verzögerter Mailversand für Startmail anstossen
setTimeout(writeChangeTable, 40000);                  // Changetabelle erneuern

// Bei allen Geräten die Nutzungszeit der Batterien um 1 Tag hochzählen
// und dann eine Statusmail versenden, sollten leere Batterien da sein
// LowBat Counts um 1 erniedrigen
schedule("0 1 * * *", function () {
  var head      = "";
  var liefetime = 0;

  watchlist.forEach(function(obj, i) {
    head = stateHeader + obj.name;
    lifetime = getState(head + STATE_RUNTIME_AKT).val;
    lifetime += 1;
    setState(head + STATE_RUNTIME_AKT, lifetime);
    if(obj.lowcount > 0) obj.lowcount -= 1;                     // Anzahl Kurzzeit LowBat
  });
  myDebug("LifetimeCount ===>Will be triggered at 1  AM every Day!<===");
  sendEMail(EMAILTYPE_DAYLY);                                   // Taegliche Status Mail, wenn leere Batterien vorhanden sind
});

log ("LowBattery " + SCRIPT_VERSION + " Monitor wurde initalisiert");

// Status EMail manuell versenden durch Flag ausgelöst (über VIS)
on(stateHeader + STATE_SENDMAIL_BUTTON, function(obj) {
    if (obj.state.val) {
      log("Manuelle Statusmail wurde ausgeloest");
      fSendMailAllways = true;
      sendEMail(EMAILTYPE_STATUS);
      setStateDelayed(stateHeader + STATE_SENDMAIL_BUTTON, false,5000);
    }
});

// Batterie gewechselt Button ueberwachen durch Flag 0-4 ausgelöst (über VIS)
on(stateHeader + STATE_REPLACE_STARTFLAG + "0", function(obj) {
    if (obj.state.val) {
      batteryChangeCommand(0);
      clearStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "0");
      setStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "0", false, 10000);
    }
});

on(stateHeader + STATE_REPLACE_STARTFLAG + "1", function(obj) {
    if (obj.state.val) {
      batteryChangeCommand(1);
      clearStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "1");
      setStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "1", false, 10000);
    }
});

on(stateHeader + STATE_REPLACE_STARTFLAG + "2", function(obj) {
    if (obj.state.val) {
      batteryChangeCommand(2);
      clearStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "2");
      setStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "2", false, 10000);
    }
});

on(stateHeader + STATE_REPLACE_STARTFLAG + "3", function(obj) {
    if (obj.state.val) {
      batteryChangeCommand(3);
      clearStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "3");
      setStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "3", false, 10000);
    }
});

on(stateHeader + STATE_REPLACE_STARTFLAG + "4", function(obj) {
    if (obj.state.val) {
      batteryChangeCommand(4);
      clearStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "4");
      setStateDelayed(stateHeader + STATE_REPLACE_STARTFLAG + "4", false, 10000);
    }
});

// END OF SCRIPT

// Diese Funktion wird aufgerufen (Subscribe), wenn sich ein LowBat State aendert
function checkBattery(index) {
  var listchange = false;
  var thandle = watchlist[index].thandle;

  if(toolChain(TOOLCOM_IS_BAT_LOW_FROMDEVICE,index)) {                                  // Zustand direkt vom Device == Lowbat ?
    watchlist[index].thandle = setTimeout(batteryLongLow,SHORT_LOWBAT_TIME,index);      // In einiger Zeit nochmal prüfen
    myDebug("Eine Geraet meldet LowBat: " + watchlist[index].name + " Pruefung laeuft");
  } else {                                                        // Zustand direkt vom Device == OK
    if(watchlist[index].thandle) {                                // Es laeuft bereits eine Ueberpruefung
      clearTimeout(watchlist[index].thandle);                     //Timeout loeschen
      watchlist[index].thandle = null;
      watchlist[index].lowcount = watchlist[index].lowbatCount + 1; // Es war ein kurzzeitiger LowBat
      if(watchlist[index] > SHORT_LOWBAT_MAX) {               // Batterie hat maximale Anzahl von Lowbats ueberschritten
        watchlist[index].isLow = true;                        // Geraet als dauerhaft lowbat markieren
        if(!watchlist[index].isSend) listchange = true;       // Wenn Zustand noch nicht verarbeitet wurde
        lastErrorDevice = watchlist[index].name;              // Name des Geraetes merken
        log("Ein Geraet hat zu viele kurzfristige LowBat: " + watchlist[index].name);
      } else {
        log("Ein Geraet hatte einen kurzzeitigen LowBat: " + watchlist[index].name);
      }
    }
  }
  if(listchange === true) {                                                   // Es gibt was zu versenden
    if (eMailDelayID !== 0) clearTimeout(eMailDelayID);                       // Vorhandenen EMail Delay stoppen
    eMailDelayID = setTimeout(sendEMail, EMAIL_SEND_DELAY,EMAILTYPE_LOWBAT);  // Zeitversetzen EMail Versand anstossen
    clearTimeout(writeChangeTable);
    setTimeout(writeChangeTable, 1000);                                       // Tabelle fuer VIS neu organisieren
    myDebug("Zeitversetzer EMail Versand und Tabellenaufbau angestossen (checkBattery)");
  }
}

// Diese Funktion wird Zeitverzoegert aufgerufen, wenn zwischenzeitlich keine BatOK Meldung vom Geraet kam
function batteryLongLow(index) {
  watchlist[index].thandle = null;
  watchlist[index].isLow = true;                      // Geraet dauerhaft LowBat
  if(!watchlist[index].isSend) listchange = true;     // Wenn Zustand noch nicht verarbeitet wurde
  lastErrorDevice = watchlist[index].name;            // Name des Geraetes merken
  log("Ein Geraet meldet Dauerhaft LowBat: " + watchlist[index].name, 'warn');

  if (eMailDelayID !== 0) clearTimeout(eMailDelayID);                           // Vorhandenen EMail Delay stoppen
  eMailDelayID = setTimeout(sendEMail, EMAIL_SEND_DELAY,EMAILTYPE_LOWBAT);      // Zeitversetzen EMail Versand anstossen
  clearTimeout(writeChangeTable);                                               // VIS Tabelle neu aufbauen
  setTimeout(writeChangeTable, 1000);
  myDebug("Zeitversetzer EMail Versand und Tabellenaufbau angestossen (batteryLongLow)");
}

function toolChain(command, index) {
  switch(watchlist[index].tool) {
    //===============================Begin TOOLTYPE_HM===============================================================
    case TOOLTYPE_HM:
      switch(command) {
        //===========================Begin TOOLTYPE_HM Is Battery Low? ==============================================
        case TOOLCOM_IS_BAT_LOW_FROMDEVICE:
          return getState(watchlist[index].id).val;
          break;
        //===========================Begin TOOLTYPE_HM Get State Text ==============================================
        case TOOLCOM_GETSTATETEXT:
          if(watchlist[index].isLow) {
            return TEXT_BATTERY_LOW;
          } else {
            return TEXT_BATTERY_OK;
          }
          break
        default:
        log("Unbekanntes Kommando bei tooChain, tool=" + adType + " Komanndo=" +command, 'error');
      }
    break;
    //======================================End TOOLTYPE_HM=========================================
    default:
    log("Unbekanntes tool bei toolChain:" + adType , "error");
  }
}
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Geraete eines Adapters zur Ueberwachungsliste hinzufuegen
// Input: header  = string der jedem Geraetenamen vorangestellt wird
//        adapter = Name des Adapters von welchem die Batteriezustaende erfasst werden soll (zB hm-rpc4)
//        adType  = ID des Tools, mit dem die Zustaende erfasst werden (Zur Zeit nur TOOLTYPE_HM)
//
// Die Liste ist ein Array mit folgendem Aufbau pro Eintrag:
// id:      = ID des LowBat States (hm-rpc.1.OEQxxxxxxx.0.LOWBAT)
// name:    = Name des Geraetes ( Heizkoerper-WC-EG)
// tool:    = ID des Erkennungstool zum selektieren der richtigen states und Auswertung (zur Zeit nur TOOLTYPE_HM)
// lowcount = Anzahl der kurzfristigen Lowbat Meldungen des Geraets
// isLow    = ist true, wenn Batterie definitiv leer ist, wird erst nach Btteriewechsel zurueck gesetzt
// isSend   = ist true, wenn dieser Zustand bereits per Mail versendet wurde, wird erst bei Batteriewechsel zurueckgesetzt
// stateType= STATUSTYP_FLAG, STATUSTYP_PERCENT, STATUSTYP_VOLTAGE
// thandle    = immer null
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
function addToWatchlist(header,adapter, adType) {
  var ad;
  var stateName;
  var n;
  var masterid;
  var mastertype = "";
  var s;
  switch(adType) {
  case TOOLTYPE_HM:
    // Dieser Adapter ist als HM bekannt, das state welches
    // lowbat signalisiert ist ein BOOL
    //-------------------------------------------------------
    var csIndiLowbat  = $('[role=indicator.lowbat]');           // Liste aller Objekte mit role indicator.lowBattDevices
    csIndiLowbat.each(function(obj,i) {
      ad =obj.match(adapter);                                   // Pruefen ob Adaptername stimmt
      if(ad){                                                   // Adaptername passt
        stateName = getObject(obj).common.name;                 // Name ermitteln (z.B. Vorratsraum:0.LOWBAT)
        ad = stateName.match(":0.");                            // Prüfen ob Name passt, da manche Geraete mehrere LowBat Flags haben
        if(ad) {                                                 // Wenn Zeichenkette vorhanden
          n = stateName.split(":0.");                           // String splitten, n[0] enthaelt dann 'Vorratsraum'
          //Geraetetyp pruefen ob auf der IgnoreList
          s = obj.split(".");                                       // ID spitten
          masterid = s[0] + "." + s[1] + "." + s[2];                // und neu zusammen setzen
          mastertype = "_" + getObject(masterid).native.TYPE + "_"; // Device Typ auslesen
          s = devIgnoreHM.match(mastertype);                        // Pruefen ob in Sperrliste
          if(s) {
            // Geraet befindet sich auf der Sperrliste und wird nicht ueberwacht
            myDebug("Geraet " + header + n[0] + " mit ID " + obj + " NICHT zur Watchlist hinzugefuegt (Sperrliste)" );
          } else {
            // Dieses Geraet wird in die Watchlist aufgenommen
            //watchlist.push({id:obj, name:header + n[0], tool:adType, lowcount:0,isLow:false, isSend:false, stateType:STATUSTYP_FLAG, value:0});
            watchlist.push({id:obj, name:header + n[0], tool:adType, lowcount:0,isLow:false, isSend:false, stateType:STATUSTYP_FLAG, thandle:null});
            myDebug("Geraet " + header + n[0] + " mit ID " + obj + " zur Watchlist hinzugefuegt" );
          }
        }
      }
    });
    break;
    // Hier folgen noch weitere Routinen fuer andere adapter
    default:
      log("Unbekannter Adaptertyp bei addToWatchlist:" + adType , "error");
  }
}

// Batterietausch wurde für das Gerät (Index im Array) bestätigt
function batteryChangeCommand(tableIndex) {
  var index = getState(stateHeader + STATE_REPLACE_INDEX+ tableIndex).val;          // Index des Geraetes in der watchlist
  if(index === -1) {
    log("batteryChangeCommand, falscher Index: " + index, 'error');
    return;
  }
  var devName = watchlist[index].name;
  var head = stateHeader + devName;
  var dt = new Date();
  var infotext = "";
  var okBattDevices = getState(stateHeader + STATE_OKBATTERY_COUNT).val;
  var lowBattDevices= getState(stateHeader + STATE_LOWBATTERY_COUNT).val;

  infotext = getState(stateHeader + STATE_REPLACE_INFOBOX).val;

  if(!toolChain(TOOLCOM_IS_BAT_LOW_FROMDEVICE, index)) {
    // Gerät meldet dass Batterie OK ist, dann den Batteriewechsel eingetragen
    watchlist[index].isLow = false;
    watchlist[index].isSend = false;
    watchlist[index].lowbatCount = 0;

    setState(head + STATE_RUNTIME_LAST, getState(head + STATE_RUNTIME_AKT).val);
    setState(head + STATE_RUNTIME_AKT, 0);
    setState (head + STATE_LAST_BATT_CHANGE , formatDate(dt, DATE_FORMAT));

    if(lowBattDevices > 0) {
      lowBattDevices -= 1;
      okBattDevices += 1;
      setState(stateHeader + STATE_OKBATTERY_COUNT, okBattDevices);
      setState(stateHeader + STATE_LOWBATTERY_COUNT, lowBattDevices);
    }
    log("Batteriewechsel fuer " + devName + " wurde bestaetigt");
    infotext += "\nBatteriewechsel fuer " + devName + " wurde ausgefuehrt\n";
  } else {
    // Gerät hat immer noch BattLow
    log("Batteriewechsel fuer " + devName + " nicht moeglich, da immer noch BattLow");
    infotext += "\nBatteriewechsel fuer " + devName + " nicht moeglich, da immer noch BattLow\n";
  }
  setState(stateHeader + STATE_REPLACE_INFOBOX, infotext);
  setTimeout(clearInfoBox, CLEAR_INFOBOX_TIME);
  clearTimeout(writeChangeTable);
  setTimeout(writeChangeTable, 1000);
}

// Infobox löschen
function clearInfoBox(){
  setState(stateHeader + STATE_REPLACE_INFOBOX, "");
  myDebug("clearInfoBox ausgefuehrt");
}

// Alle Flags prüfen, ob ein Batteriewechselflag gesetzt Ist
// Wenn ja, diese Geräte in die Tabelle für VIS eintragen
// Anzahl leerer/voller Batterien zaehlen und fuer VIS eintragen
function writeChangeTable(){
  var devID;
  var head          ="";
  var devName       = "";
  var tableIndex    = 0;
  var lowbatCount   = 0;
  var okbatCount    = 0;
  var deviceList    = "";

  // Wechsel Tabelle löschen
  for(r=0; r< REPLACE_STATES; r++) {
    setState(stateHeader + STATE_REPLACE_STARTFLAG + r, false);
    setState(stateHeader + STATE_REPLACE_INDEX + r, -1);
    setState(stateHeader + STATE_REPLACE_DEVNAME + r, "");
  }

  watchlist.forEach(function(obj, i) {
    head = stateHeader + obj.name;

    if(obj.isLow === true) {      // Batterie Wechselflag gesetzt
      // Dann dieses Gerät in das TableArray einfügen
      setState(stateHeader + STATE_REPLACE_DEVNAME + tableIndex, obj.name);   // Klartextname des Geraetes
      setState(stateHeader + STATE_REPLACE_INDEX   + tableIndex, i);          // Index in der Watchlist
      tableIndex += 1;
      lowbatCount += 1;
      deviceList = deviceList + obj.name + '<br>';                            // Klartextliste der gestörten Geräte erweitern
    } else {
      okbatCount += 1;
    }
    if(tableIndex >= REPLACE_STATES) return;                                  // Abbrechen, da Tabelle voll
  });
  setState(stateHeader + STATE_LOWBATTERY_COUNT, lowbatCount);
  setState(stateHeader + STATE_OKBATTERY_COUNT , okbatCount);
  setState(stateHeader + STATE_LOWBATTERY_LIST, deviceList);
  myDebug("writeChangeTable durchgelaufen");
}

// EMail versenden
function sendEMail(emailtype) {
  var lowbatCount = 0;
  var okbatCount  = 0;
  var lastCycle   = 0;
  var aktCycle    = 0;
  var lastBattChange = "";
  //var status;
  var tableText = "<TABLE BORDER=2><TR><TH>Sensor<TH>Aktuell<TH>Letzter Zyklus<TH>Aktueller Zyklus<TH>Batteriewechsel";
  var subjectText = EMAIL_SUBJ_HEAD + "Meldung von " + lastErrorDevice + ", Batterie Zustand hat sich geändert";
  var sendIt          = false;
  var sendAllDevices  = false;          // Wenn true, werden die States aller Geraete per EMail versendet

  eMailDelayID = 0;
  myDebug("EMail Funktion (sendEMail) wurde aufgerufen Type=" +emailtype);
  switch (emailtype) {
    case EMAILTYPE_START:
      // Es werden alle Geraete in der EMail aufgenommen, Lowbat egal, Mail wird auf jeden Fall versendet
      subjectText = EMAIL_SUBJ_HEAD + "Batterie Uebersicht bei Script Start fuer alle Geraete";
      tableText = "<TABLE BORDER=2><TR><TH>Geraet Name<TH>Adapter Name<TH>Tool <TH>Status Typ";
      sendAllDevices = true;
      break;

    case EMAILTYPE_LOWBAT:
      // Es werden nur Geraete per Mail versendet, die Lowbat Status haben
      subjectText =  EMAIL_SUBJ_HEAD + "Batterie Meldung von " + lastErrorDevice + ", Zustand hat sich geändert";
      sendAllDevices = false;
      break;

    case EMAILTYPE_STATUS:
      // Es werden alle Geraete versendet, Lowbat egal
      subjectText = EMAIL_SUBJ_HEAD + "Batterie Status Uebersicht wurde manuell angefordert";
      sendAllDevices = true;
      break;

    case EMAILTYPE_DAYLY:
      //  Es werden alle Geraete versendet, nur wenn Lowbat vorhanden
      subjectText = EMAIL_SUBJ_HEAD + "Taeglicher Statusbericht ueber Geraete mit niedrigem Batterie Zustand";
      sendAllDevices = false;
      break;
    default:
      log("Ungueltiger EMail Typ!", 'error');
  }

  watchlist.forEach(function(obj, i) {
    var head = "";
    var eMail = false;
    var shortLowbat = 0;
    head = stateHeader + obj.name;

    lastCycle = getState(head + STATE_RUNTIME_LAST).val;
    aktCycle = getState(head + STATE_RUNTIME_AKT).val;
    lastBattChange = getState(head + STATE_LAST_BATT_CHANGE).val;

    if(sendAllDevices) {
      // Status aller Geraete wird versendet (EMAILTYPE_DAYLY, EMAILTYPE_START und EMAILTYPE_STATUS)
      if(obj.isLow === true) {
        // Gerät hat LowBatt
        tableText += "<TR bgcolor=" + COLOR_LOWBAT + "><TD>" + obj.name;
        tableText += "<TD>" + toolChain(TOOLCOM_GETSTATETEXT,i);
        tableText += "<TD>"  + lastCycle + "<TD>" + aktCycle + "<TD>" + lastBattChange;
        obj.isSend = true; // Markierung dass dieser Zustand bereits versendet wurde, wird bei Batteriewechsel zurueckgesetzt
      } else {
        // Gerät hat KEIN Lowbat
        if(emailtype === EMAILTYPE_START){
          var l = obj.id.split(".");
          tableText += "<TR bgcolor=" + COLOR_OKBAT+ "><TD>" + obj.name;
          if(l) {
            tableText += "<TD>"+ l[0] + "." + l[1];
          } else {
            tableText += "<TD>Unknown";
          }
          tableText += "<TD>" + toolTypeList[obj.tool];
          tableText += "<TD>" + statustypList[obj.stateType];
        } else {
          tableText += "<TR bgcolor=" + COLOR_OKBAT+ "><TD>" + obj.name;
          tableText += "<TD>" + toolChain(TOOLCOM_GETSTATETEXT,i);
          tableText += "<TD>" + lastCycle + "<TD>" + aktCycle + "<TD>" + lastBattChange;
        }
      }
      sendIt = true;            // Es gibt was zu versenden
    }  else {
      // Nur Geraete mit Lowbat werden versendet
      if(obj.isLow === true) {
        // Gerät hat Lowbat, immer in Table eintragen
        tableText += "<TR bgcolor=" + COLOR_LOWBAT + "><TD>" + obj.name;
        tableText += "<TD>" + toolChain(TOOLCOM_GETSTATETEXT,i);
        tableText += "<TD>" + lastCycle + "<TD>" + aktCycle + "<TD>" + lastBattChange;
        if(!obj.isSend) sendIt = true;                      // Nur Mail versenden, wenn dieser Zustand noch nicht versendet wurde
        if(emailtype == EMAILTYPE_DAYLY) sendIt = true;     // Bei der taeglichen StatusMail immer versenden
        obj.isSend = true; // Markierung dass dieser Zustand bereits versendet wurde
      }
    }

    if(obj.isLow === true){
      lowbatCount +=1;
      // deviceList = deviceList + obj.name + '<br>';         // Klartextliste der gestörten Geräte erweitern
    } else {
      okbatCount +=1;
    }
  });

  tableText += "</TABLE>";
  if(emailtype === EMAILTYPE_START) {
    tableText = "Bei Script Start erkannte Geraete mit Batterie: " + okbatCount + "<br><br>" + tableText;
  } else {
    tableText = "<TABLE><TR><TD>Aktuell LowBattery:<TD>" + lowbatCount + "<TR><TD>Aktuell OK:<TD>" + okbatCount + "</TABLE>" + tableText;
  }

  if(sendIt || sendAllDevices) {
    // EMail nur versenden, wenn mindestens 1 MailFlag gesetz war
    // oder das Flag für "Immer Senden" gesetzt ist
    sendTo("email.0", {
            html: '<p>' + tableText + '</p>',
            from:    EMAIL_FROM_ADDRESS,
            to:      EMAIL_TO_ADDRESS,
            subject: subjectText,
    });
    log("EMail wurde versendet (sendEMail) Type=" + emailtype, 'info');
  }
}

// Benötigte States erstellen, falls noch nicht vorhanden
function stateCreate() {
  var head = "";
  var status;
  var obj;
  var stateName = "";
  var devName = "";
  var fullName = "";
  var id;

  // Infobox Text
  createState(stateHeader + STATE_REPLACE_INFOBOX, {
       type:   'string',
       read:   true,
       write:  true,
       def:    ""
   },false);

  // Trigger für SendMail Button für Vis
  createState(stateHeader + STATE_SENDMAIL_BUTTON, {
       type:   'boolean',
       read:   true,
       write:  true,
       def:    false
   },false);

  // Liste der zur Zeit nicht erreichbaren Geräte als reiner Text
  createState(stateHeader + STATE_LOWBATTERY_LIST, {
       type:   'string',
       read:   true,
       write:  true,
       def:    ""
   },false);

   // Anzahl der zur Zeit nicht erreichbaren Geräte
   createState(stateHeader + STATE_LOWBATTERY_COUNT, {
        type:   'number',
        read:   true,
        write:  true,
        def:    0
    },false);

// Anzahl der zur Zeit erreichbaren Geräte
    createState(stateHeader + STATE_OKBATTERY_COUNT, {
         type:   'number',
         read:   true,
         write:  true,
         def:    0
     },false);

  // States zur manuellen Bestätigung des Batterie Wechsels anlegen
  for(r=0; r< REPLACE_STATES; r++) {
    // Ueber dieses Flag wird der Batteriewechsel quttiert
    createState(stateHeader + STATE_REPLACE_STARTFLAG + r, {
         type:   'boolean',
         read:   true,
         desc:   r,
         write:  true,
         def:    false
     },false);

     // Index des Gerätes in der Watchlist Liste
     createState(stateHeader + STATE_REPLACE_INDEX + r, {
          type:   'number',
          read:   true,
          write:  true,
          def:    -1
      },false);

      // Name des Gerätes in der Watchlist Liste
      createState(stateHeader + STATE_REPLACE_DEVNAME + r, {
           type:   'string',
           read:   true,
           write:  true,
           def:    ""
       },false);

    }

  // Benötigte States für jedes vorhandene Gerät erstellen
  watchlist.forEach(function(obj, i) {
    head = stateHeader + obj.name;

    // Zeitpunkt des letzten Batterie Wechsels (Datum und Uhrzeit)
   createState(head + STATE_LAST_BATT_CHANGE, {
        type:   'string',
        read:   true,
        write:  true,
        def:    ""
    },false);

    // Aktuelle Laufzeit in Tagen
   createState(head + STATE_RUNTIME_AKT, {
        type:   'number',
        read:   true,
        write:  true,
        def:    0
    },false);

    // Laufzeit des letzten Zyklus in Tagen
   createState(head + STATE_RUNTIME_LAST, {
        // desc:   'Liste der Fenster',
        type:   'number',
        read:   true,
        write:  true,
        def:    0
    },false);

  });
}
