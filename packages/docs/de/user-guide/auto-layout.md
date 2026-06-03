---
title: Auto-Layout
description: Flex- und Grid-Layout in Inkly — Richtung, Abstand, Polsterung, Ausrichtung, Kindgröße und CSS-Grid-Tracks.
---

# Auto-Layout

Auto-Layout positioniert Kinder automatisch innerhalb eines Frames. Es unterstützt zwei Modi: **Flex** (horizontaler/vertikaler Fluss) und **Grid** (Zeilen und Spalten mit Track-Größen).

## Auto-Layout aktivieren

- Wählen Sie einen Frame und drücken Sie <kbd>⇧</kbd><kbd>A</kbd> (<kbd>Shift</kbd> + <kbd>A</kbd>), um Auto-Layout ein-/auszuschalten
- Wählen Sie lose Knoten und drücken Sie <kbd>⇧</kbd><kbd>A</kbd>, um sie in einen neuen Auto-Layout-Frame zu wickeln

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
| Auto-Layout umschalten | <kbd>⇧</kbd><kbd>A</kbd> | <kbd>Shift</kbd> + <kbd>A</kbd> |

## CSS Grid

Grid-Layout ordnet Kinder in Zeilen und Spalten mit expliziter Track-Größe an.

### Grid aktivieren

Wählen Sie einen Frame mit aktiviertem Auto-Layout und klicken Sie auf das Grid-Symbol in der Layout-Werkzeugleiste, um von Flex zu Grid zu wechseln.

### Track-Größen

Definieren Sie Spalten- und Zeilen-Tracks mit drei Größenmodi:

- **fr** — proportionale Einheit, teilt verfügbaren Platz proportional
- **px** — feste Pixelgröße
- **auto** — passt sich dem Inhalt an

### Grid-Abstände

Setzen Sie separate horizontale (Spalten-) und vertikale (Zeilen-) Abstände zwischen Zellen.

### Kind-Positionierung

Kinder werden automatisch in Grid-Zellen in Zeilenreihenfolge platziert. Sie können die Platzierung mit Spalten-/Zeilen-Start und Span-Werten in den Layout-Eigenschaften des Kindes überschreiben.

### JSX- und Tailwind-Export

Grid-Layouts werden als JSX mit Tailwind-Klassen exportiert: `grid grid-cols-3`, `gap-x-4 gap-y-2`, `col-start-2 row-span-2`.

## Tipps

- Verschachteln Sie Auto-Layout-Frames für komplexe responsive Layouts.
- Verwenden Sie „Füllen", damit ein Kind den restlichen Platz einnimmt, wie `flex-grow: 1` in CSS.
- Verwenden Sie Grid für Dashboard-Layouts, Galerien und Formulare — alles mit zweidimensionaler Struktur.
