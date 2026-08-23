# OpenPencil und Penpot im Vergleich

OpenPencil und Penpot sind Open-Source-Designwerkzeuge mit unterschiedlichen Zielen und Architekturen.

::: info WASM-Renderer in Penpot
Penpot 2.x enthält den Rust/Skia-WASM-Renderer `render-wasm/v1`. Er wird über Serveroptionen oder `?wasm=true` aktiviert; standardmäßig kommt weiterhin der SVG-Renderer zum Einsatz. Der Vergleich berücksichtigt beide Varianten.
:::

## 1. Umfang der Codebasis

| Metrik | OpenPencil | Penpot |
|--------|------------|--------|
| Lines of code | **rund 26.000** | **rund 299.000** |
| Quelldateien | rund 143 | rund 2.900 |
| Sprachen | TypeScript, Vue | Clojure, ClojureScript, Rust, JavaScript, SQL, SCSS |
| Renderer | rund 3.200 Zeilen, TypeScript | 22.000 Zeilen, Rust/Skia WASM |
| Oberfläche | rund 4.500 Zeilen | rund 175.000 Zeilen, CLJS und SCSS |
| Serverseite | Keine, lokale Architektur | 32.600 Zeilen und 151 SQL-Dateien |
| Verhältnis | **1×** | **rund 11×** |

OpenPencil ist ungefähr elfmal kleiner. Der Unterschied entsteht vor allem durch die Architektur, nicht nur durch den Funktionsumfang.

## 2. Architektur

### OpenPencil: ein Clientprozess

```text
┌─────────────────────────────────┐
│         Tauri native shell      │
│  ┌───────────────────────────┐  │
│  │  Vue 3 + TypeScript       │  │
│  │  Editor + Kiwi codec      │  │
│  │  SceneGraph in TypeScript │  │
│  │  CanvasKit + Yoga WASM    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

Editor, SceneGraph, Dateicodec und Renderer laufen in einem Prozess. Ein separater Server, eine Datenbank und Docker sind nicht erforderlich. Der SceneGraph liegt als `Map<string, SceneNode>` vor. TypeScript ruft CanvasKit direkt auf, Yoga WASM berechnet die Anordnung synchron.

### Penpot: Client-Server-Plattform

```text
┌───────────────────────────────────────────────────────┐
│                    Docker Compose                     │
│  ClojureScript frontend │ Clojure/JVM backend        │
│  Rust/Skia WASM         │ PostgreSQL, Valkey, MinIO  │
│  Chromium exporter      │ MCP server                 │
└───────────────────────────────────────────────────────┘
```

Ein vollständiger Penpot-Betrieb umfasst Oberfläche, JVM-Serverseite, PostgreSQL, Valkey, MinIO und einen Exportdienst auf Grundlage von Chromium ohne Oberfläche. Die Entwicklungsumgebung benötigt Docker Compose, JVM, Node und Rust-Werkzeuge.

OpenPencil vermeidet Netzwerklatenz, Serialisierung zwischen Diensten, Containerverwaltung und Datenbankabfragen für gewöhnliche Editorvorgänge. Penpot ist auf eine zentral gehostete Mehrbenutzerplattform ausgerichtet; OpenPencil auf lokale Bearbeitung mit geringer Latenz.

## 3. Renderablauf

### OpenPencil: TypeScript → CanvasKit WASM

```typescript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- Ein direkter Übergang von TypeScript zu WASM.
- Der SceneGraph bleibt im JavaScript heap und wird vor dem Rendering nicht serialisiert.
- Der Renderer umfasst rund 3.200 Zeilen in spezialisierten Modulen.

### Penpot: ClojureScript → Rust WASM → Skia

Mit aktiviertem WASM-Renderer:

```text
ClojureScript → JavaScript
  → Zerlegung und Binary packing in WASM linear memory
  → Rust WASM über Emscripten C FFI
  → skia-safe
  → Skia/WebGL
```

Ohne WASM wird jedes Shape als SVG DOM element über React/Reagent gerendert.

Im WASM-Modus wird eine UUID in vier `u32` zerlegt, eine Transformation in sechs `f32`, Füllungen und Konturen werden binär codiert und grundlegende Formeigenschaften in einer 104-Byte-Struktur gespeichert. Der Renderer verwendet Kachelcache, Interessenbereiche, elf Renderflächen und globalen veränderlichen Zustand über `unsafe { STATE.as_mut() }`.

Das Tile system bereitet Bereiche um den Viewport vor und hält bis zu 1.024 Textures im Cache. OpenPencil rendert dagegen den sichtbaren Bereich vollständig neu.

| Aspekt | OpenPencil | Penpot |
|--------|------------|--------|
| JavaScript → WASM | Direkte Calls mit TypeScript objects | Binär gepackte Structures |
| Rendering model | Vollständiger sichtbarer Viewport | Tile cache |
| Surfaces | 1 | 11 |
| Zusätzlicher Cache | Kein Tile cache | Bis zu 1.024 Tiles |
| Renderer size | rund 3.200 LOC | 22.000 LOC |
| Unsicherer Code | Keiner | Globaler Zustand über `unsafe` |

Für kleine und mittlere Dokumente benötigt der direkte CanvasKit path weniger Zwischenverarbeitung. Bei Dokumenten mit mehr als 100.000 Shapes kann Penpots Tile system vorteilhaft sein, wenn nur ein kleiner Ausschnitt sichtbar ist.

## 4. SceneGraph und Datenmodell

### OpenPencil

```typescript
nodes: Map<string, SceneNode>
```

- Lookup nach ID in O(1).
- 29 Object types aus Figmas Kiwi schema.
- Rund 390 Fields in `NodeChange`.
- Strict TypeScript types.
- GUID im Figma format `sessionID:localID`.

Penpot pflegt eigene Type definitions in Clojure/ClojureScript und Rust. Separate Modules behandeln Colors, Components, Containers, Fills, Grid, Modifiers, Pages und Paths. Malli validiert Schemas zur Runtime, während Rendering data die Grenze von CLJS zu Rust überschreiten.

OpenPencil verwendet das Kiwi schema direkt. Penpot muss sein eigenes Datenmodell zwischen mehreren Sprachen synchron halten.

## 5. Anordnungs-Engine

OpenPencil verwendet Yoga WASM synchron:

```typescript
import Yoga from 'yoga-layout'
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
applyYogaLayout(graph, frame, yogaRoot)
```

Penpot pflegt eigene Flex- und Grid-Implementations in ClojureScript und Rust WASM. Beide Engines müssen dasselbe Ergebnis liefern.

OpenPencil nutzt die etablierte Bibliothek Yoga einschließlich einer Variante mit Grid. Penpot wartet mehrere Tausend Zeilen eigenen Anordnungscode in zwei Sprachen.

## 6. Dateiformate und Figma

### OpenPencil

- Native Kiwi binary format von Figma.
- Direkter Import von `.fig`.
- Paste von Kiwi binary data aus Figmas Clipboard.
- Wire compatibility mit Figmas Multiplayer protocol.

### Penpot

- `.penpot` ist ein ZIP mit JSON manifests, Dokumentdaten, Binary assets und Thumbnails.
- Standardmäßig SVG renderer und SVG export; optionaler WASM renderer.
- Kein nativer `.fig`-Import.
- Mehrere Format generations mit Migration system.

OpenPencil liest `.fig` und Figmas Clipboard direkt. Penpot benötigt einen getrennten Import- oder Exportweg.

## 7. Zustand und Rückgängig

OpenPencil verwendet inverse Befehle. Vorwärts- und Rückwärtsfunktionen speichern nur den benötigten Zustand; Stapel fassen mehrere Vorgänge zusammen.

Penpot verwendet Potok. `UpdateEvent` ändert den Zustand, `WatchEvent` führt Nebenwirkungen über RxJS aus. Rückgängig speichert inverse Änderungsvektoren, begrenzt die Historie auf 50 Einträge und gruppiert schnelle Änderungen in Transaktionen.

Serialisierbare Änderungen passen gut zu Penpots serverbasierter Zusammenarbeit, erhöhen jedoch die Komplexität. OpenPencils Ansatz ist für den Editor in einem Prozess direkter.

## 8. Development

| Metrik | OpenPencil | Penpot |
|--------|------------|--------|
| Setup | `bun install && bun dev` | Docker Compose, JVM, Node und Rust |
| HMR | Vite | shadow-cljs |
| Types | Strict TypeScript | Malli runtime schemas |
| Desktop | Tauri v2 | Browser |
| Zentrale Technologien | TypeScript und Vue | Clojure, ClojureScript, Rust und Docker |

## 9. Performance characteristics

| Szenario | OpenPencil | Penpot |
|----------|------------|--------|
| Kaltstart | unter 2 s einschließlich WASM | über 10 s für Server, Client und WASM |
| Gewöhnliche Operation | Innerhalb eines Process | Möglicher Network round trip |
| Render frame | Direkter Skia call | CLJS → JS → WASM FFI → Skia |
| Grundbedarf an Memory | rund 50 MB im Browser tab | JVM, Database, Cache und Browser |
| Offline | Vollständiger local-first mode | Server erforderlich |
| 10K Shapes | Ein Rendering pass | Tile renderer mit elf Surfaces |

## 10. Stärken von Penpot

1. **Serverbasierte Zusammenarbeit:** Konten, Zugriffskontrolle und zentrale Speicherung über WebSockets.
2. **PDF export:** eigener Chromium exporter.
3. **Plugin system:** Sandboxed execution und Plugin API.
4. **Design tokens:** integrierte Unterstützung.
5. **CSS Grid:** eigene Implementation; OpenPencil verwendet einen Yoga fork mit Grid.
6. **Self-hosting:** Team platform über Docker deploybar.
7. **Reife:** mehrjährige Verwendung in Production.

## 11. Scripts und Erweiterbarkeit

Der Befehl [`eval`](/programmable/cli/scripting) stellt eine Figma-kompatible Plugin API für Skripte ohne Oberfläche, Stapelvorgänge und automatisierte Tests bereit. Außerdem sind 90 AI-Werkzeuge über AI-Chat, MCP-Server und CLI verfügbar. Sie decken Lesen, Erstellen, Ändern, Struktur, Variablen, Vektorpfade, Analyse, Vergleiche, boolesche Operationen und Anordnung ab.

Penpot besitzt isoliert ausgeführte Plugins, aber keine vergleichbare Skript-API ohne Oberfläche oder MCP-Integration.

## Zusammenfassung

| Bereich | Vorteil | Grund |
|---------|---------|-------|
| Einfachheit | OpenPencil | Ein Prozess statt mehrerer Dienste |
| Darstellung | OpenPencil | Direkter CanvasKit-Pfad |
| Codebasis | OpenPencil | Rund 26.000 statt 299.000 Zeilen |
| Figma compatibility | OpenPencil | Native Kiwi und `.fig` |
| Development setup | OpenPencil | TypeScript und Vue statt Clojure, Rust und Docker |
| Desktop app | OpenPencil | Native Tauri application |
| Layout | OpenPencil | Yoga statt zwei eigener Implementations |
| Collaboration | Unterschiedliche Stärken | Penpot: Server und Access control; OpenPencil: P2P ohne Hosting |
| Selbsthosting | Penpot | Docker-Bereitstellung |
| Ökosystemreife | Penpot | Mehrjährige Produktionserfahrung |

OpenPencil ist ein kompakter Editor in einem Prozess mit CanvasKit-Renderer und nativer `.fig`-Unterstützung. Penpot ist eine vollständige Client-Server-Plattform mit Clojure, ClojureScript, Rust, Datenbanken und Docker-Diensten. Beide unterstützen Zusammenarbeit mit unterschiedlichen Modellen. Penpot bietet ein Plugin-Ökosystem und PDF-Export; OpenPencil eine Figma-kompatible API ohne Oberfläche, 90 AI/MCP-Werkzeuge, SVG-Export und eine Desktop-App.
