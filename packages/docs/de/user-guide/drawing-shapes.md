---
title: Formen zeichnen
description: Rechtecke, Ellipsen, Linien, Frames, Sektionen, Polygone und Sterne in OpenPencil erstellen.
---

# Formen zeichnen

Die untere Werkzeugleiste bietet Werkzeuge zum Erstellen von Formen, Frames und Sektionen. Wählen Sie ein Werkzeug, dann klicken und ziehen Sie auf dem Canvas.

## Werkzeugleiste

| Werkzeug | Kürzel | Beschreibung |
|----------|--------|--------------|
| Rechteck | <kbd>R</kbd> | Zeichnet ein Rechteck |
| Ellipse | <kbd>O</kbd> | Zeichnet eine Ellipse |
| Linie | <kbd>L</kbd> | Zeichnet eine Linie |
| Frame | <kbd>F</kbd> | Zeichnet einen Frame (Container) |
| Sektion | <kbd>S</kbd> | Zeichnet eine Sektion (übernimmt überlappende Geschwister) |

## Formen-Flyout

Das Formen-Flyout enthält zusätzliche Formen:

- **Polygon** — erstellt ein Polygon mit standardmäßig 3 Seiten (Dreieck)
- **Stern** — erstellt einen 5-zackigen Stern

## Proportionales Zeichnen

Halten Sie <kbd>Shift</kbd> beim Ziehen:

- Rechteck → Quadrat
- Ellipse → Kreis
- Linie → rastet auf 0°/45°/90° ein

## Form-Eigenschaften

### Füllung

Jede Form kann eine Füllung haben: **Vollfarbe**, **Verlauf** (Linear, Radial, Winkel, Diamant) oder **Bild**.

### Kontur

Fügen Sie einer Form eine Kontur hinzu. Eigenschaften:

- **Breite** — einheitlich oder pro Seite (Oben/Rechts/Unten/Links) über das Seitenauswahl-Dropdown
- **Farbe** — Vollton mit Deckkraft
- **Ausrichtung** — Innen, Mitte oder Außen (beschneidungsbasiertes Rendering wie in Figma)
- **Kappenstil** — Keine, Rund, Quadrat, Pfeil
- **Verbindungsstil** — Gehrung, Abgeschrägt, Rund
- **Strichmuster** — Strich-Ein/Strich-Aus

### Eckenradius

Verfügbar für Rechtecke, Frames, Komponenten und Instanzen. Jede Ecke einzeln einstellbar.

### Effekte

- **Schlagschatten** — Versatz, Unschärferadius, Ausbreitung, Farbe
- **Innerer Schatten** — gleiche Steuerung, im Inneren der Form
- **Ebenenunschärfe** — verwischt den gesamten Knoten
- **Hintergrundunschärfe** — verwischt Inhalte hinter dem Knoten
- **Vordergrundunschärfe** — verwischt Inhalte vor dem Knoten

## Frames und Sektionen

**Frames** sind Container. Ziehen Sie Formen in einen Frame, um sie zu Kindern zu machen. Frames unterstützen [Auto-Layout](./auto-layout).

**Sektionen** sind Container auf oberster Ebene, die überlappende Geschwisterknoten automatisch übernehmen.

## Tastenkürzel

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Rechteck | <kbd>R</kbd> | <kbd>R</kbd> |
| Ellipse | <kbd>O</kbd> | <kbd>O</kbd> |
| Linie | <kbd>L</kbd> | <kbd>L</kbd> |
| Frame | <kbd>F</kbd> | <kbd>F</kbd> |
| Sektion | <kbd>S</kbd> | <kbd>S</kbd> |
| Quadrat/Kreis erzwingen | <kbd>Shift</kbd> + <kbd>Ziehen</kbd> | <kbd>Shift</kbd> + <kbd>Ziehen</kbd> |
