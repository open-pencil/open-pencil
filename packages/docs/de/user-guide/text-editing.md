---
title: Textbearbeitung
description: Text erstellen und bearbeiten mit Rich-Formatierung, Schriften und Inline-Bearbeitung in OpenPencil.
---

# Textbearbeitung

Erstellen Sie Textknoten und bearbeiten Sie sie direkt auf dem Canvas mit voller Rich-Text-Unterstützung.

## Text erstellen

Drücken Sie **T**, um das Textwerkzeug zu aktivieren, dann klicken Sie auf den Canvas. Ein leerer Textknoten erscheint mit blinkendem Cursor — tippen Sie sofort los.

## Inline-Bearbeitung

Doppelklicken Sie auf einen vorhandenen Textknoten, um den Inline-Bearbeitungsmodus zu betreten. Ein blauer Umriss zeigt den Bearbeitungsmodus an. Klicken Sie außerhalb, um zu bestätigen.

## Cursor-Navigation

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Links/rechts | ← / → | ← / → |
| Hoch/runter | ↑ / ↓ | ↑ / ↓ |
| Wortweise | ⌥ ← / ⌥ → | Strg + ← / Strg + → |
| Zeilenanfang/-ende | ⌘ ← / ⌘ → | Pos1 / Ende |

Halten Sie **Shift** mit jeder Bewegungstaste, um die Auswahl zu erweitern.

## Textauswahl

- **Klicken** in einen Textknoten positioniert den Cursor
- **Klicken + Ziehen** wählt einen Textbereich aus
- **Doppelklick** auf ein Wort wählt es aus
- **Dreifachklick** wählt den gesamten Text aus

## Rich-Text-Formatierung

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Fett | ⌘ B | Strg + B |
| Kursiv | ⌘ I | Strg + I |
| Unterstrichen | ⌘ U | Strg + U |

Durchgestrichen ist über den **S**-Schalter im Typografie-Bereich verfügbar.

## Bearbeitungsoperationen

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Wort vor Cursor löschen | ⌥ ⌫ | Strg + Rücktaste |
| Bis Zeilenanfang löschen | ⌘ ⌫ | — |
| Ausschneiden | ⌘ X | Strg + X |
| Kopieren | ⌘ C | Strg + C |
| Einfügen | ⌘ V | Strg + V |

## Schriftauswahl

Die Schriftauswahl im Typografie-Bereich bietet Suchfilter, Schriftvorschau und virtuelles Scrollen.

## Schriftquellen

- **Standardschrift** — Inter wird automatisch geladen
- **Desktop (Tauri)** — Systemschriften via Rust font-kit
- **Browser** — via Local Font Access API (Chrome/Edge)

## Tipps

- IME-Eingabe (Chinesisch, Japanisch, Koreanisch) wird vollständig unterstützt.
- Rich-Text-Formatierung bleibt bei .fig-Import/Export erhalten.
