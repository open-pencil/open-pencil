---
title: Auto-Layout
description: Flexbox-basiertes Auto-Layout in OpenPencil — Richtung, Abstand, Polsterung, Ausrichtung und Kindgröße.
---

# Auto-Layout

Auto-Layout verwendet Yoga (Flexbox-Engine), um Kinder automatisch innerhalb eines Frames zu positionieren. Es verwaltet Richtung, Abstände, Ausrichtung und responsive Größenanpassung.

## Auto-Layout aktivieren

- Wählen Sie einen Frame und drücken Sie **⇧ A** (Shift + A), um Auto-Layout ein-/auszuschalten
- Wählen Sie lose Knoten und drücken Sie **⇧ A**, um sie in einen neuen Auto-Layout-Frame zu wickeln

Beim Umschließen werden Knoten nach visueller Position sortiert.

## Layout-Richtung

- **Horizontal** — Kinder fließen von links nach rechts
- **Vertikal** — Kinder fließen von oben nach unten
- **Umbruch** — Kinder umbrechen bei Platzmangel

## Abstände

### Zwischenraum (Gap)

Der Abstand zwischen benachbarten Kindern.

### Polsterung (Padding)

Der Abstand zwischen Frame-Rand und Kindern. Einheitlich oder pro Seite einstellbar.

## Ausrichtung

### Hauptachse (Justify)

- **Start** — Kinder packen zum Anfang
- **Mitte** — Kinder werden zentriert
- **Ende** — Kinder packen zum Ende
- **Zwischenraum** — gleicher Abstand zwischen Kindern

### Querachse (Align)

- **Start** — Kinder am Anfang ausrichten
- **Mitte** — Kinder zentrieren
- **Ende** — Kinder am Ende ausrichten
- **Dehnen** — Kinder füllen die Querachse

## Kindgröße

- **Fest** — verwendet die explizite Breite/Höhe des Kindes
- **Füllen** — dehnt sich aus, um verfügbaren Platz zu füllen
- **Anpassen** — schrumpft auf den Inhalt des Kindes

## Ziehen zum Umordnen

Innerhalb eines Auto-Layout-Frames können Sie ein Kind ziehen, um es unter Geschwistern umzuordnen.

## Tastenkürzel

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Auto-Layout umschalten | ⇧ A | Shift + A |

## Tipps

- Verschachteln Sie Auto-Layout-Frames für komplexe responsive Layouts.
- Verwenden Sie „Füllen", damit ein Kind den restlichen Platz einnimmt, wie `flex-grow: 1` in CSS.
