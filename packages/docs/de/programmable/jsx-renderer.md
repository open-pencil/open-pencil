---
title: JSX-Renderer
description: Designs mit JSX erstellen — die Syntax, die LLMs bereits von Millionen von React-Komponenten kennen.
---

# JSX-Renderer

OpenPencil verwendet JSX als Sprache zur Designerstellung. LLMs haben Millionen von React-Komponenten gesehen — ein Layout als `<Frame><Text>` zu beschreiben ist natürlich, kein spezielles Training nötig. Jedes Token zählt, wenn ein KI-Agent Dutzende von Operationen durchführt, und JSX ist die kompakteste deklarative Darstellung.

JSX ist auch diff-fähig. Wenn eine KI ein Design ändert, ist die Änderung ein JSX-Diff — lesbar, überprüfbar, versionierbar.

## Designs erstellen

Das `render`-Werkzeug (verfügbar im KI-Chat, MCP und CLI eval) akzeptiert JSX:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text size={14} color="#666">Description text</Text>
</Frame>
```

Im MCP-Server und KI-Chat akzeptiert das `render`-Werkzeug JSX-Strings direkt. Im CLI verwendest du den `export`-Befehl für die umgekehrte Richtung — [Designs als JSX exportieren](./cli/exporting).

## Elemente

Alle Knotentypen sind als JSX-Elemente verfügbar:

| Element | Erstellt | Aliasse |
|---------|----------|---------|
| `<Frame>` | Frame (Container, unterstützt Auto-Layout) | `<View>` |
| `<Rectangle>` | Rechteck | `<Rect>` |
| `<Ellipse>` | Ellipse / Kreis | |
| `<Text>` | Textknoten (Kinder werden zum Textinhalt) | |
| `<Line>` | Linie | |
| `<Star>` | Stern | |
| `<Polygon>` | Polygon | |
| `<Vector>` | Vektorpfad | |
| `<Group>` | Gruppe | |
| `<Section>` | Abschnitt | |

## Stil-Props

Kompakte Kurzschreibweisen, inspiriert von Tailwinds Benennung.

### Layout

| Prop | Beschreibung |
|------|--------------|
| `flex` | `"row"` oder `"col"` — aktiviert Auto-Layout |
| `gap` | Abstand zwischen Kindern |
| `wrap` | Kinder in nächste Zeile umbrechen |
| `rowGap` | Gegenachsen-Abstand beim Umbrechen |
| `justify` | `"start"`, `"end"`, `"center"`, `"between"` |
| `items` | `"start"`, `"end"`, `"center"`, `"stretch"` |
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | Innenabstand |

### Größe & Position

| Prop | Beschreibung |
|------|--------------|
| `w`, `h` | Breite/Höhe — Zahl, `"fill"` oder `"hug"` |
| `minW`, `maxW`, `minH`, `maxH` | Größenbeschränkungen |
| `x`, `y` | Position |

### Erscheinungsbild

| Prop | Beschreibung |
|------|--------------|
| `bg` | Hintergrundfüllung (Hex-Farbe) |
| `fill` | Alias für `bg` |
| `stroke` | Konturfarbe |
| `strokeWidth` | Konturbreite (Standard: 1) |
| `rounded` | Eckenradius (oder `roundedTL`, `roundedTR`, `roundedBL`, `roundedBR`) |
| `cornerSmoothing` | iOS-artig abgerundete Ecken (0–1) |
| `opacity` | 0–1 |
| `shadow` | Schlagschatten (z.B. `"0 4 8 #00000040"`) |
| `blur` | Ebenen-Unschärferadius |
| `rotate` | Rotation in Grad |
| `blendMode` | Mischmodus |
| `overflow` | `"hidden"` oder `"visible"` |

### Typografie

| Prop | Beschreibung |
|------|--------------|
| `size` / `fontSize` | Schriftgröße |
| `font` / `fontFamily` | Schriftfamilie |
| `weight` / `fontWeight` | `"bold"`, `"medium"`, `"normal"` oder Zahl |
| `color` | Textfarbe |
| `textAlign` | `"left"`, `"center"`, `"right"`, `"justified"` |

## Als JSX exportieren

Bestehende Designs zurück in JSX konvertieren:

```sh
open-pencil export design.fig -f jsx                   # OpenPencil-Format
open-pencil export design.fig -f jsx --style tailwind  # Tailwind-Klassen
```

Der Roundtrip funktioniert: Exportiere ein Design als JSX, bearbeite den Code, rendere es zurück.

## Visuelles Diffing

Da Designs als JSX darstellbar sind, werden Änderungen zu Code-Diffs:

```diff
 <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF">
-  <Text size={18} weight="bold">Old Title</Text>
+  <Text size={24} weight="bold" color="#1D1B20">New Title</Text>
   <Text size={14} color="#666">Description</Text>
 </Frame>
```

Das macht Designänderungen in Pull Requests überprüfbar, in der Versionskontrolle nachverfolgbar und in der CI auditierbar.
