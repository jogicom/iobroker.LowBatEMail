

# Hinweise fuer Entwickler

Bei der Integration von weiteren Adapter Typen, bin ich auf  Hilfe angewiesen. Hier beschreibe ich nun das Grundkonzept der Adaptertypen und im Anschluss gehe ich noch auf die STATES ein, die vom Script angelegt werden.

## Inhaltsverzeichnis

- [Erweiterung der toolChain](#erweiterung-der-toochain)
- [Objekte und States die Verwendung finden](#Objekte-und-States-die-Verwendung-finden)


## Erweiterung der toolChain
Als Beispiel nehme ich jetzt mal den fiktiven Adapter der ZigBee Geraete bedient und unter der fiktiven Instanz "zigbee.0" laeuft. 

###### Erstellen eines neuen Tooltype mit eindeutiger ID:
```javascript
const TOOLTYPE_ZB  = 1;
```
###### Erweitern der toolTypeList:

Der Index muss mit der TOOLTYPE ID uebereinstimmen
```javascript
var toolTypeList = ["Homematic", "ZigBee"];
```
###### Erweitern der Adapterliste:

Als naechstes muss die Adaperliste angepasst werden, damit diese Geraete auch auf der Watchlist landen
```javascript
var adapterList = [ {header:"", name:"hm-rpc.1.", typ:TOOLTYPE_HM},
​                   {header:"", name:"zigbee.0.", typ:TOOLTYPE_ZB}  ];
```

###### Erweitern der Function addToWatchlist

Hier muss ein neuer Abschnitt fuer den neuen Adapter integriert werden. Die Aufgabe diese Abschnittest besteht darin:

-  den richtige State des Geraetes zu ermitteln, der ueberwacht wird
- den Namen des Geraetes zu ermitteln, unter dem das Geraet in der Liste geführt wird
- und diesen Datensatz zu der Watchlist hinzuzufuegen

Der Eintrag muss folgendes Format haben:

| Name       | Funktion                                                     |
| ---------- | ------------------------------------------------------------ |
| id:        | Die ID des States, der auf Aenderungen ueberwacht wird (Bei HM z.B. *hm-rpc.1.MEQxxxxx.0.LOWBAT*) |
| name:      | Der Name des Geraetes z.B Vorratsraum                        |
| tool:      | Die ID des Tools, das zur Erfassung und Auswertung der Zustaende benutzt wird, hier wird immer adType uebernommen , also in unserem Beispiel TOOLTYPE_ZB |
| lowcount:  | Anzahl der kurzfristigen lowBat Meldungen, die bereits von dem Geraet ausgegangen sind, hier wird beim erstellen der Liste 0 eingetragen |
| isLow:     | Ein bool das signalisiert ob die Batterie OK (false) oder Leer (true) signalisiert, der Startzustand ist false |
| isSend:    | Ein bool der signalisiert, ob die Batteriemeldung bereits versendet wurde, der Startzustand ist false |
| stateType: | Der Typ des States, hier gibt es 3 Varianten, STATUSTYP_FLAG=Der Status der ueberwacht wird, ist ein Bool,  STATUSTYP_PERCENT= eine Prozentanzeige des Ladezustandes,  STATUSTYP_VOLTAGE= eine Spannungsanzeige des Ladezustandes, dies ist nuetzlich wenn innerhalb eines Adapter mehrere verschiedene Statevarianten vorliegen und erleichtert der toolChain das auslesen des Batterie Zustandes. |
| thandle    | Startzustand null                                            |

Der neue Listeneintrag kann dann mit watchlist.push der Watchliste hinzugefuegt werden.

###### Erweitern der toolChain
Die Function toolChain stellt Funktionen bereit, die Informationen ueber ein Geraet zur Verfuegung stellen. Das Script fragt die Geraete nie direkt ab, sondern nur ueber die toolChain. Dazu muss die toolChain um das neue Tool erweitert werden.

Der toolChain werden beim Aufruf 2 Parameter uebergeben:

1. command (das Kommando was abgerufen wird
2. index, der index des betreffendes Geraetes in der watchlist

Die toolChain muss auf folgende Kommandos wie folgt antworten:

| Kommando:                     | Rückgabe:                                                    |
| ----------------------------- | ------------------------------------------------------------ |
| TOOLCOM_IS_BAT_LOW_FROMDEVICE | Ein Bool, das den Zustand der Batterie des Geraetes darstellt, also false=BatteryOK, true= BatteryLow |
| TOOLCOM_GETSTATETEXT          | Einen String der den Zustand der Batterie wieder gibt, also "Battery OK", "Batterie Low", "Battery 2.7V" oder auch "Battery 10%". Was hier zurueck gegeben wird, erscheint bei der Status Mail im Batterie zustand. |

Somit wurde der neue Adapter Typ (hoffentlich erfolgreich implementiert)

## Objekte und States die Verwendung finden

Die States, die vom Script angelegt werden, finden sich, je nach  javascript Instanz unter dem Objekt "javascript.x.BatterieStatus".

Dort wird im Stammverzeichnis fuer jedes Geraet ein Objekt angelegt in dem die Laufzeiten und Batteriewechsel gespeichert sind, damit diese bei einem Neustart verfuegbar bleiben.

Zur Not kann dort Manuell eingeriffen werden.

Es gibt in diesem Verzeichnis auch noch ein Objekt "xReplace" mit weiteren States, von denen sollte man die Finger lassen, wenn man nicht genau weiss, was man tut. Wird hier manuell eingegriffen kann das Fehlfunktionen nach sich ziehen.



| State javascript.x.BatterieStatus | Verwendung                                                   |
| --------------------------------- | ------------------------------------------------------------ |
| .BatteryOKDevices (number)        | Anzahl der Geraete mit Batterie OK                           |
| .LowBatteryDevices (number)       | Anzahl der Geraete mit Batterie low                          |
| .LowBatteryDeviceList (string)    | Liste in Textform, in der die Geraete aufgefuehrt sind, die aktuell den Status LowBat haben |
| .SendInfoMail (bool)              | Wird dieses Flag auf "true" gesetzt, wird eine Statusmail versendet, das Flag wird automatisch zurueckgesetzt |











