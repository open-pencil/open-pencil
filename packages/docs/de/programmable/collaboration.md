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
- **Auswahl:** ausgewählte Objekte der anderen Teilnehmer.

## Ansichtsverfolgung

Ein Klick auf einen Avatar folgt der Ansicht dieses Teilnehmers. Position und Zoom werden angepasst. Ein weiterer Klick beendet die Verfolgung.

## Technische Grundlage

WebRTC überträgt die Designdaten direkt zwischen den Teilnehmern. Ein zentraler Anwendungsserver leitet die Änderungen nicht weiter.

Yjs synchronisiert den Dokumentzustand als CRDT und führt gleichzeitige Änderungen automatisch zusammen. IndexedDB speichert den lokalen Stand, sodass ein erneutes Öffnen desselben Raums ihn wiederherstellt.

## Hinweise

- Zusammenarbeit funktioniert im Browser und in der Desktop-App.
- Raumkennungen werden mit kryptografisch sicheren Zufallswerten erzeugt.
- Zeiger und Anwesenheitseinträge getrennter Teilnehmer werden automatisch entfernt.
