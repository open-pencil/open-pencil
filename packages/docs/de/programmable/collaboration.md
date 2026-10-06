---
title: Zusammenarbeit
description: Gemeinsame Bearbeitung in Echtzeit direkt über WebRTC, ohne zentralen Server.
---

# Zusammenarbeit

Mehrere Personen können dasselbe Dokument gleichzeitig bearbeiten. Die Teilnehmer verbinden sich direkt über WebRTC; ein Konto ist nicht erforderlich.

## Raum teilen

1. Schaltfläche „Teilen“ oben rechts öffnen.
2. **Diese Datei teilen** wählen – der Link `app.openpencil.dev/share/<room-id>` wird kopiert.
3. Link an die anderen Teilnehmer senden.

Nur „Teilen“ bringt ein Dokument in einen Raum: Der Tab, aus dem Sie teilen, wird zum Tab des Raums und bleibt mit seiner Datei verbunden. Jede Person mit dem Link kann beitreten.

## Raum beitreten

Öffnen Sie den Link oder fügen Sie ihn (oder nur die Raumkennung) unter **Beitreten** im Teilen-Panel oder unter **Raum beitreten…** auf der Startseite ein. Der Raum öffnet sich in einem eigenen Tab, sodass bereits geöffnete Dokumente unverändert bleiben. Auf einem Computer bietet der Browser außerdem **In der Desktop-App öffnen** an; der Raum öffnet sich dann über einen `openpencil://join`-Link in OpenPencil.

Sie treten sofort unter einem erzeugten Namen wie *Teal Fox* bei. Ihren eigenen Namen legen Sie im Teilen-Panel oder in den Einstellungen fest; er gilt in jedem Raum.

Räume werden nicht auf einem Server gespeichert: Die Datei liegt auf den Geräten der Personen, die im Raum waren, daher öffnet ein Raum-Tab sein Dokument nur, solange eine von ihnen online ist. Bis dahin zeigt er an, dass er wartet, erklärt den Grund und öffnet die Datei, sobald jemand beitritt, der sie hat. Ein Raum, in dem Sie schon waren, öffnet sich sofort aus der Kopie auf diesem Gerät und synchronisiert Ihre Änderungen, sobald andere zurückkehren.

**Raum verlassen** im Teilen-Panel beendet Ihre Teilnahme am Raum. Ein Tab, der sein Dokument geteilt hat, wird wieder zu diesem Dokument; ein beigetretener Tab behält die Datei des Raums als lokale, ungespeicherte Kopie, die Sie speichern können. Jeder Raum-Tab hat eine eigene Verbindung, sodass Sie in mehreren Räumen gleichzeitig sein können.

## Synchronisierte Daten

- **Dokument:** Änderungen an Formen, Text, Eigenschaften und Anordnung;
- **Zeiger:** Position, Name und Farbe jedes Teilnehmers;
- **Auswahl:** ausgewählte Objekte der anderen Teilnehmer;
- **Agenten:** Der integrierte AI-Chat erscheint als Zeiger an den Ebenen, die er bearbeitet; seine umrandete Beschriftung zeigt ein Funkelsymbol und einen Rufnamen wie *Fern*. Zeiger und Umrandung haben die Farbe der Person, die den Agenten ausführt, sodass erkennbar ist, wem er gehört. Geteilt werden nur Name, Art, Modell, Status, Seite, Position und bearbeitete Ebenen, niemals Prompts oder Antworten.

## Ansichtsverfolgung

Ein Klick auf einen Avatar folgt der Ansicht dieses Teilnehmers. Position und Zoom werden angepasst, und ein Rahmen in dessen Farbe mit einer Leiste „Du folgst …“ zeigt, wem Sie folgen. Zum Beenden klicken Sie erneut auf den Avatar, drücken <kbd>Esc</kbd> oder klicken, scrollen, zoomen oder wechseln selbst die Seite.

Ein Avatar zählt die Agenten, die die Person ausführt. Beim Daraufzeigen erscheinen alle Agenten, ihre Tätigkeit und die jeweilige Seite; mit **Folgen** neben einem Agenten bleiben die Seite und die Ebenen, die er bearbeitet, im Blick. Die Verfolgung läuft zwischen seinen Antworten weiter und endet, wenn er den Raum verlässt. Die Schaltfläche nach den Avataren listet alle Personen im Raum mit ihren Agenten auf und ist per Tastatur bedienbar. Ihr eigener Avatar listet Ihre Agenten auf – ein Klick benennt einen Agenten um – und enthält **Raum verlassen**.

Das Teilen-Panel listet alle Personen im Raum mit den Agenten auf, die sie ausführen, mit ihrer Tätigkeit und der jeweiligen Seite. Einem Agenten folgen Sie auf dieselbe Weise, um die Seite und die Ebenen, die er bearbeitet, im Blick zu behalten; die Verfolgung läuft zwischen seinen Antworten weiter und endet, wenn er den Raum verlässt. Mit einem Doppelklick auf einen eigenen Agenten benennen Sie ihn um.

## Technische Grundlage

WebRTC überträgt die Designdaten direkt zwischen den Teilnehmern. Ein zentraler Anwendungsserver leitet die Änderungen nicht weiter.

Yjs synchronisiert den Dokumentzustand als CRDT und führt gleichzeitige Änderungen automatisch zusammen.

Auch das Verschieben und Umordnen von Ebenen wird zusammengeführt. Jede Ebene merkt sich jedes Elternelement, in das sie verschoben wurde, und ihre Position unter ihren Geschwistern; jeder Teilnehmer leitet daraus denselben Ebenenbaum ab ([Evan Wallaces Baum-CRDT](https://madebyevan.com/algos/crdt-mutable-tree-hierarchy/)). Verschiebungen, Umordnungen und neue Ebenen verschiedener Personen werden alle übernommen; verschieben zwei Personen gleichzeitig dieselbe Ebene, setzt sich bei allen dieselbe Verschiebung durch. Würden gleichzeitige Verschiebungen zwei Ebenen ineinander legen, wird die spätere rückgängig gemacht, und eine Ebene, deren neues Elternelement inzwischen gelöscht wurde, kehrt an ihren vorherigen Platz zurück.

Alle Teilnehmer eines Raums brauchen eine OpenPencil-Version, die den Ebenenbaum auf dieselbe Weise speichert; Versionen, die ihn anders speichern, sehen die Räume der jeweils anderen nicht.

IndexedDB speichert den lokalen Stand: Beim Neuladen der Seite treten Sie dem Raum automatisch mit demselben Stand wieder bei.

## Hinweise

- Zusammenarbeit funktioniert im Browser und in der Desktop-App.
- Raumkennungen werden mit kryptografisch sicheren Zufallswerten erzeugt.
- Zeiger und Anwesenheitseinträge getrennter Teilnehmer werden automatisch entfernt.
