---
title: Zusammenarbeit
description: Gemeinsame Bearbeitung in Echtzeit direkt über WebRTC, ohne zentralen Server.
---

# Zusammenarbeit

Mehrere Personen können dasselbe Dokument gleichzeitig bearbeiten. Die Teilnehmer verbinden sich direkt über WebRTC; ein Konto ist nicht erforderlich.

## Raum teilen

1. Schaltfläche „Teilen“ oben rechts öffnen.
2. Den erzeugten Link `app.openpencil.dev/share/<room-id>` kopieren.
3. Link an die anderen Teilnehmer senden.

Jede Person mit dem Link kann beitreten. Der Raum bleibt erreichbar, solange mindestens ein Teilnehmer die Seite geöffnet hat.

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

Yjs synchronisiert den Dokumentzustand als CRDT und führt gleichzeitige Änderungen automatisch zusammen. IndexedDB speichert den lokalen Stand, sodass ein erneutes Öffnen desselben Raums ihn wiederherstellt.

## Hinweise

- Zusammenarbeit funktioniert im Browser und in der Desktop-App.
- Raumkennungen werden mit kryptografisch sicheren Zufallswerten erzeugt.
- Zeiger und Anwesenheitseinträge getrennter Teilnehmer werden automatisch entfernt.
