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
| Tastenkürzel | ⇧ ⌘ E | Shift + Strg + E |
| Kontextmenü | Rechtsklick → Exportieren… | Rechtsklick → Exportieren… |
| Eigenschaftspanel | Klick auf „Exportieren" | Klick auf „Exportieren" |

## Als kopieren

Das Kontextmenü bietet **Als kopieren** mit mehreren Zwischenablage-Formaten:

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Als Text kopieren | — | — |
| Als SVG kopieren | — | — |
| Als PNG kopieren | ⇧ ⌘ C | Shift + Strg + C |
| Als JSX kopieren | — | — |

## .fig-Dateioperationen

OpenPencil verwendet das .fig-Format — dasselbe Binärformat wie Figma.

### Dateien öffnen

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Datei öffnen | ⌘ O | Strg + O |

### Dateien speichern

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Speichern | ⌘ S | Strg + S |
| Speichern unter | ⇧ ⌘ S | Shift + Strg + S |

- **Speichern** überschreibt die aktuelle Datei ohne Dialog
- **Speichern unter** öffnet einen Speicherdialog

### Round-Trip-Kompatibilität

Aus OpenPencil exportierte Dateien können in Figma geöffnet werden und umgekehrt.

## Tastenkürzel

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Auswahl exportieren | ⇧ ⌘ E | Shift + Strg + E |
| Als PNG kopieren | ⇧ ⌘ C | Shift + Strg + C |
| Datei öffnen | ⌘ O | Strg + O |
| Speichern | ⌘ S | Strg + S |
| Speichern unter | ⇧ ⌘ S | Shift + Strg + S |

## Tipps

- Verwenden Sie 2× oder 3× Skalierung für hochauflösende Bildschirme.
- JPG verwendet immer weißen Hintergrund — nutzen Sie PNG oder WEBP für Transparenz.
- Verwenden Sie SVG-Export für vektorielle Weiterbearbeitung in Code-Editoren oder Illustrator.
