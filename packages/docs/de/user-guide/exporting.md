---
title: Exportieren
description: Bilder exportieren (PNG, JPG, WEBP) und .fig-Dateien speichern/öffnen in OpenPencil.
---

# Exportieren

Einzelne Knoten als Bilder exportieren oder ganze Dokumente als .fig-Dateien speichern und öffnen.

## Bildexport

Wählen Sie einen Knoten und nutzen Sie den Export-Bereich im Eigenschaftspanel.

### Export-Einstellungen

- **Skalierung** — 0,5×, 0,75×, 1×, 1,5×, 2×, 3× oder 4×
- **Skalierung** — 0,5×–4× (für SVG ausgeblendet — Vektoren sind auflösungsunabhängig)
- **Format** — PNG (transparenter Hintergrund), JPG (weißer Hintergrund), WEBP (transparenter Hintergrund), SVG (Vektor)

Sie können mehrere Export-Einstellungen hinzufügen. Eine Live-Vorschau mit Schachbretthintergrund zeigt, was exportiert wird.

### Export-Methoden

| Methode | Mac | Windows / Linux |
|---------|-----|-----------------|
| Tastenkürzel | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> | <kbd>Shift</kbd> + <kbd>Strg</kbd> + E |
| Kontextmenü | Rechtsklick <kbd>→</kbd> Exportieren… | Rechtsklick <kbd>→</kbd> Exportieren… |
| Eigenschaftspanel | Klick auf „Exportieren" | Klick auf „Exportieren" |

## Als kopieren

Das Kontextmenü bietet **Als kopieren** mit mehreren Zwischenablage-Formaten:

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Als Text kopieren | — | — |
| Als SVG kopieren | — | — |
| Als PNG kopieren | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> | <kbd>Shift</kbd> + <kbd>Strg</kbd> + C |
| Als JSX kopieren | — | — |

## .fig-Dateioperationen

OpenPencil verwendet das .fig-Format — kompatibel mit Figma. Gespeicherte Dateien werden komprimiert und enthalten ein Vorschaubild.

### Dateien öffnen

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Datei öffnen | <kbd>⌘</kbd><kbd>O</kbd> | Strg + O |

### Dateien speichern

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Speichern | <kbd>⌘</kbd><kbd>S</kbd> | Strg + S |
| Speichern unter | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>Strg</kbd> + S |

- **Speichern** überschreibt die aktuelle Datei ohne Dialog
- **Speichern unter** öffnet einen Speicherdialog

### Round-Trip-Kompatibilität

Aus OpenPencil exportierte Dateien können in Figma geöffnet werden und umgekehrt.

## Tastenkürzel

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Auswahl exportieren | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> | <kbd>Shift</kbd> + <kbd>Strg</kbd> + E |
| Als PNG kopieren | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> | <kbd>Shift</kbd> + <kbd>Strg</kbd> + C |
| Datei öffnen | <kbd>⌘</kbd><kbd>O</kbd> | Strg + O |
| Speichern | <kbd>⌘</kbd><kbd>S</kbd> | Strg + S |
| Speichern unter | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>Strg</kbd> + S |

## Tipps

- Verwenden Sie 2× oder 3× Skalierung für hochauflösende Bildschirme.
- JPG verwendet immer weißen Hintergrund — nutzen Sie PNG oder WEBP für Transparenz.
- Verwenden Sie SVG-Export für vektorielle Weiterbearbeitung in Code-Editoren oder Illustrator.
