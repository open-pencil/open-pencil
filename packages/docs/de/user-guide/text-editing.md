---
title: Textbearbeitung
description: Text erstellen und bearbeiten mit Rich-Formatierung, Schriften und Inline-Bearbeitung in OpenPencil.
---

# Textbearbeitung

Erstellen Sie Textknoten und bearbeiten Sie sie direkt auf dem Canvas mit voller Rich-Text-Unterstützung.

## Text erstellen

Drücken Sie <kbd>T</kbd>, um das Textwerkzeug zu aktivieren, dann klicken Sie auf den Canvas. Ein leerer Textknoten erscheint mit blinkendem Cursor — tippen Sie sofort los.

## Inline-Bearbeitung

Doppelklicken Sie auf einen vorhandenen Textknoten, um den Inline-Bearbeitungsmodus zu betreten. Ein blauer Umriss zeigt den Bearbeitungsmodus an. Klicken Sie außerhalb, um zu bestätigen.

## Cursor-Navigation

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Links/rechts | <kbd>←</kbd> / <kbd>→</kbd> | <kbd>←</kbd> / <kbd>→</kbd> |
| Hoch/runter | <kbd>↑</kbd> / <kbd>↓</kbd> | <kbd>↑</kbd> / <kbd>↓</kbd> |
| Wortweise | <kbd>⌥</kbd><kbd>←</kbd> / <kbd>⌥</kbd><kbd>→</kbd> | Strg + <kbd>←</kbd> / Strg + <kbd>→</kbd> |
| Zeilenanfang/-ende | <kbd>⌘</kbd><kbd>←</kbd> / <kbd>⌘</kbd><kbd>→</kbd> | Pos1 / Ende |

Halten Sie <kbd>Shift</kbd> mit jeder Bewegungstaste, um die Auswahl zu erweitern.

## Textauswahl

- **Klicken** in einen Textknoten positioniert den Cursor
- **Klicken + Ziehen** wählt einen Textbereich aus
- **Doppelklick** auf ein Wort wählt es aus
- **Dreifachklick** wählt den gesamten Text aus

## Rich-Text-Formatierung

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Fett | <kbd>⌘</kbd><kbd>B</kbd> | Strg + B |
| Kursiv | <kbd>⌘</kbd><kbd>I</kbd> | Strg + I |
| Unterstrichen | <kbd>⌘</kbd><kbd>U</kbd> | Strg + U |

Durchgestrichen ist über den **S**-Schalter im Typografie-Bereich verfügbar.

## Bearbeitungsoperationen

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Wort vor Cursor löschen | <kbd>⌥</kbd><kbd>⌫</kbd> | Strg + Rücktaste |
| Bis Zeilenanfang löschen | <kbd>⌘</kbd><kbd>⌫</kbd> | — |
| Ausschneiden | <kbd>⌘</kbd><kbd>X</kbd> | Strg + X |
| Kopieren | <kbd>⌘</kbd><kbd>C</kbd> | Strg + C |
| Einfügen | <kbd>⌘</kbd><kbd>V</kbd> | Strg + V |

## Schriftauswahl

Die Schriftauswahl im Typografie-Bereich bietet Suchfilter, Schriftvorschau und virtuelles Scrollen.

## Schriftquellen

- **Standardschrift** — Inter wird automatisch geladen
- **Desktop** — Systemschriften sowie aktivierte Kataloge von Google Fonts, Fontsource, Bunny Fonts und Fontshare
- **Browser** — Systemschriften werden in Chrome und Edge unterstützt; Online-Schriftkataloge benötigen die Desktop-App
- **Heruntergeladene Schriften** — die Desktop-App speichert heruntergeladene Schriftschnitte zur erneuten Verwendung auf demselben Gerät

## Fehlende Schriften und Ersetzungen

Wenn eine angeforderte Familie oder ein Schriftschnitt nicht geladen werden kann, zeigt OpenPencil oberhalb des Editors eine Warnung an, statt die Ersatzdarstellung stillschweigend als originalgetreu zu behandeln.

Klappe die Warnung auf, um alle betroffenen Schriftschnitte und ihre aktiven Ersetzungen zu sehen. Mit **Ebenen auswählen** findest du die betroffenen Textknoten; mit **Schriften erneut laden** kannst du nach Änderungen an Netzwerkzugriff, lokaler Schriftberechtigung oder Anbietereinstellungen einen neuen Versuch starten. Ein Schriftschnitt kann aus einem anderen geladenen Schnitt derselben Familie synthetisiert werden; eine fehlende Familie verwendet Inter als Ersatz, wenn verfügbar.

## Tipps

- IME-Eingabe (Chinesisch, Japanisch, Koreanisch) wird vollständig unterstützt.
- Rich-Text-Formatierung bleibt bei .fig-Import/Export erhalten.
