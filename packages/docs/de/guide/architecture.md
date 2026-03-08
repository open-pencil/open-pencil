# Architektur

## Systemübersicht

`mermaid
graph TB
    subgraph Tauri["Tauri v2 Shell"]
        subgraph Editor["Editor (Web)"]
            UI["Vue 3 UI<br/>Toolbar · Panels · Properties<br/>Layers · Color Picker"]
            Skia["Skia CanvasKit (WASM, 7MB)<br/>Vector rendering · Text shaping<br/>Effects · Export"]
            subgraph Core["Core Engine (TS)"]
                SG[SceneGraph] --- Layout[Layout - Yoga]
                SG --- Selection
                Undo[Undo/Redo] --- Constraints
                Constraints --- HitTest[Hit Testing]
            end
            subgraph FileFormat["File Format Layer"]
                FigIO[".fig import/export"] --- Kiwi[Kiwi codec]
                Kiwi --- SVG[SVG export]
            end
        end
        MCP["MCP Server (90 tools, stdio+HTTP)"]
        Collab["P2P Collab (Trystero + Yjs)"]
    end
`

## Editor-Layout

Die Oberfläche folgt Figmas UI3-Layout — Werkzeugleiste unten, Navigation links, Eigenschaften rechts:

- **Navigationspanel (links)** — Ebenenbaum, Seitenpanel
- **Canvas (Mitte)** — Unendlicher Canvas mit CanvasKit-Rendering, Zoom/Pan
- **Eigenschaftspanel (rechts)** — Kontextsensitive Abschnitte: Darstellung, Füllung, Kontur, Typografie, Layout, Position
- **Werkzeugleiste (unten)** — Werkzeugauswahl: Auswahl, Frame, Sektion, Rechteck, Ellipse, Linie, Text, Stift, Hand

## Komponenten

### Rendering (CanvasKit WASM)

Dieselbe Rendering-Engine wie Figma. CanvasKit bietet GPU-beschleunigte 2D-Zeichnung mit Vektorformen, Textgestaltung via Paragraph API, Effekten (Schatten, Unschärfe, Mischmodi) und Export (PNG, SVG). Das 7 MB große WASM-Binary wird beim Start geladen und erstellt eine GPU-Oberfläche auf dem HTML-Canvas.

Der Renderer ist in fokussierte Module in `packages/core/src/renderer/` aufgeteilt: Szenentraversierung, Overlays, Füllungen, Konturen, Formen, Effekte, Lineale, Labels und Remote-Cursor.

### Szenengraph

Flache `Map<string, Node>` mit GUID-Strings als Schlüssel. Baumstruktur über `parentIndex`-Referenzen. Bietet O(1)-Lookup, effiziente Traversierung, Hit-Testing und rechteckige Bereichsabfragen für Marquee-Selektion.

Siehe [Szenengraph-Referenz](/reference/scene-graph) für Interna.

### Layout-Engine (Yoga WASM)

Metas Yoga bietet CSS-Flexbox-Layout-Berechnung. Ein dünner Adapter mappt Figma-Eigenschaftsnamen auf Yoga-Äquivalente:

| Figma-Eigenschaft | Yoga-Äquivalent |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### Dateiformat (Kiwi-Binär)

Verwendet Figmas Kiwi-Binär-Codec mit 194 Message-/Enum-/Struct-Definitionen. Import: Header parsen → Zstd-Dekompression → Kiwi-Dekodierung → `NodeChange`[] → Szenengraph. Export kehrt den Prozess um, inklusive Thumbnail-Generierung.

Siehe [Dateiformat-Referenz](/reference/file-format) für Details.

### KI & Werkzeuge

Werkzeuge werden einmal in `packages/core/src/tools/` definiert, aufgeteilt nach Domäne: read, create, modify, structure, variables, vector, analyze. Jedes Werkzeug hat typisierte Parameter und eine `execute(figma, args)`-Funktion. Adapter konvertieren sie für:

- **KI-Chat** — valibot-Schemas, verbunden mit OpenRouter
- **MCP-Server** — zod-Schemas, stdio + HTTP-Transporte
- **CLI** — verfügbar über den `eval`-Befehl

87 Core-Werkzeuge + 3 MCP-Dateiverwaltungswerkzeuge = 90 insgesamt.

### Rückgängig/Wiederherstellen

Inverse-Command-Muster. Vor jeder Änderung werden betroffene Felder als Snapshot gespeichert. Der Snapshot wird zur inversen Operation. Batching gruppiert schnelle Änderungen (wie Ziehen) zu einzelnen Undo-Einträgen.

### Zwischenablage

Figma-kompatible bidirektionale Zwischenablage. Kodiert/dekodiert Kiwi-Binär (gleiches Format wie .fig-Dateien) über native Browser-Kopier/Einfüge-Events. Verarbeitet Vektorpfad-Skalierung, Instanz-Kinder, Component-Set-Erkennung und Override-Anwendung.

### P2P-Kollaboration

Echtzeit-Peer-to-Peer-Kollaboration über Trystero (WebRTC) + Yjs CRDT. Kein Server-Relay — Signalisierung über öffentliche MQTT-Broker, STUN/TURN für NAT-Traversal. Das Awareness-Protokoll bietet Live-Cursor, Auswahlen und Präsenz. Lokale Persistenz über y-indexeddb.

### CLI-zu-App RPC-Bridge

Wenn die Desktop-App läuft, verbinden sich CLI-Befehle über WebSocket statt eine .fig-Datei zu benötigen. Der Automatisierungsserver läuft auf `127.0.0.1:7600` (HTTP) und `127.0.0.1:7601` (WebSocket). Befehle werden gegen den Live-Editor-Zustand ausgeführt, sodass Automatisierungsskripte und KI-Agenten mit der laufenden App interagieren können.

## Ausblick

### Vollständiges figma-use-Werkzeugset

Der MCP-Server bietet derzeit 90 Werkzeuge. Die Referenzimplementierung in [figma-use](https://github.com/dannote/figma-use) hat 118. Die verbleibenden Werkzeuge decken erweiterte Layout-Constraints, Prototyp-Verbindungen, erweiterte Komponenteneigenschafts-Bearbeitung und Massen-Dokumentoperationen ab.

### CI-Design-Werkzeuge

Die headless CLI unterstützt bereits `analyze colors/typography/spacing/clusters`. Nächster Schritt: GitHub Actions-Integration für automatisiertes Design-Linting und visuelle Regression in PRs.

### Prototyping

Frame-zu-Frame-Übergänge, Interaktions-Trigger (Klick, Hover, Ziehen), Overlay-Verwaltung und Vollbild-Vorschaumodus.

### CSS Grid Layout

CSS Grid wird über einen [Yoga-Fork](https://github.com/open-pencil/yoga/tree/grid) mit Cherry-Picked Grid-PRs aus dem Upstream unterstützt. Wählen Sie einen Frame aus und klicken Sie auf das Grid-Symbol, um von Flex zu Grid zu wechseln. Konfigurieren Sie Spalten-/Zeilen-Tracks (fr, feste px, auto), Spalten- und Zeilenabstände und Padding pro Seite.

### Windows Code Signing

macOS-Binaries sind seit v0.6.0 signiert und notarisiert. Windows Authenticode-Signierung über Azure Code Signing ist geplant, um die SmartScreen-Warnung zu entfernen.
