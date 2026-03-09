---
title: Zusammenarbeit
description: Echtzeit-Zusammenarbeit über P2P WebRTC — kein Server, kein Konto.
---

# Zusammenarbeit

Bearbeite Designs gemeinsam in Echtzeit. Peers verbinden sich direkt — kein Server leitet deine Daten weiter, kein Konto erforderlich.

## Einen Raum teilen

1. Klicke auf den Teilen-Button in der oberen rechten Ecke
2. Kopiere den generierten Link (`app.openpencil.dev/share/<room-id>`)
3. Sende ihn an deine Mitarbeiter

Jeder mit dem Link kann beitreten. Der Raum bleibt aktiv, solange mindestens ein Teilnehmer die Seite geöffnet hat.

## Was synchronisiert wird

- **Dokumentänderungen** — jede Bearbeitung (Formen, Text, Eigenschaften, Layout) wird sofort synchronisiert
- **Cursor** — sieh, wo jeder Mitarbeiter zeigt, mit Name und Farbe
- **Auswahlen** — markierte Auswahlen sind für alle sichtbar

## Folgemodus

Klicke auf den Avatar eines Mitarbeiters in der oberen Leiste, um seinem Viewport zu folgen. Deine Zeichenfläche schwenkt und zoomt passend zu seiner Ansicht. Klicke erneut, um das Folgen zu beenden.

## So funktioniert es

Peers verbinden sich direkt über WebRTC — deine Designdaten gehen direkt von Browser zu Browser, nie über einen zentralen Server. Der Dokumentzustand verwendet einen CRDT (Conflict-free Replicated Data Type), sodass gleichzeitige Bearbeitungen automatisch ohne Konflikte zusammengeführt werden.

Der Raum bleibt lokal bestehen — wenn du die Seite aktualisierst, trittst du mit dem gleichen Zustand wieder bei.

## Tipps

- Funktioniert im Browser und in der Desktop-App
- Raum-IDs sind kryptografisch zufällig — nur Personen mit dem Link können beitreten
- Veraltete Cursor werden automatisch bereinigt, wenn jemand die Verbindung trennt
