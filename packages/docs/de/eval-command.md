# `open-pencil eval` — Figma-ähnliche Plugin-API für Headless-Skripting

## Übersicht

`bun open-pencil eval <file> --code '<js>'` führt JavaScript gegen eine `.fig`-Datei mit einem Figma-kompatiblen `figma`-Globalobjekt aus. Dies ermöglicht Headless-Skripting, Batch-Operationen, KI-Werkzeug-Ausführung und Tests — alles ohne die GUI.

Das `figma`-Objekt spiegelt Figmas Plugin-API-Oberfläche so nah wie möglich, sodass vorhandenes Figma-Plugin-Wissen und Code-Snippets direkt übertragbar sind.

```bash
# Frame erstellen, Auto-Layout setzen, Kinder hinzufügen
bun open-pencil eval design.fig --code '
  const frame = figma.createFrame()
  frame.name = "Card"
  frame.resize(300, 200)
  frame.layoutMode = "VERTICAL"
  frame.itemSpacing = 12
  frame.paddingTop = frame.paddingBottom = 16
  frame.paddingLeft = frame.paddingRight = 16
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]

  const title = figma.createText()
  title.characters = "Hello World"
  title.fontSize = 24
  frame.appendChild(title)

  return { id: frame.id, name: frame.name }
'

# Knoten abfragen
bun open-pencil eval design.fig --code '
  const buttons = figma.currentPage.findAll(n => n.type === "FRAME" && n.name.includes("Button"))
  return buttons.map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
'

# Von stdin lesen (für mehrzeilige Skripte / Piping)
cat transform.js | bun open-pencil eval design.fig --stdin

# Änderungen zurückschreiben
bun open-pencil eval design.fig --code '...' --write
bun open-pencil eval design.fig --code '...' -o modified.fig
```

## Architektur

```
┌──────────────────────────────────────────────────────┐
│  CLI: `open-pencil eval <file> --code '...'`         │
│    ↓                                                 │
│  loadDocument(file) → SceneGraph                     │
│    ↓                                                 │
│  FigmaAPI(sceneGraph) → `figma` Proxy-Objekt         │
│    ↓                                                 │
│  AsyncFunction('figma', wrappedCode)(figmaProxy)     │
│    ↓                                                 │
│  Ergebnis als JSON / agentfmt ausgeben               │
│  optional: saveDocument(file) bei --write            │
└──────────────────────────────────────────────────────┘
```

### Schlüsselklassen

| Klasse | Ort | Rolle |
|--------|-----|-------|
| `FigmaAPI` | `packages/core/src/figma-api.ts` | Proxy-Objekt, das `figma.*`-Methoden gegen `SceneGraph` implementiert |
| `FigmaNode` | `packages/core/src/figma-api.ts` | Proxy, der `SceneNode` mit Figma-ähnlichem Eigenschaftszugriff umhüllt |
| `eval`-Befehl | `packages/cli/src/commands/eval.ts` | CLI-Befehl: Dokument laden, API erstellen, Code ausführen |

### Warum in `@open-pencil/core`?

Die `FigmaAPI`-Klasse lebt in core (nicht CLI), weil:
- **KI-Werkzeuge nutzen sie wieder** — das Chat-Panels `render`-Werkzeug kann JSX über dieselbe API ausführen
- **Testskripte** — Unit-Tests können die API für Fixture-Setup verwenden
- **Keine DOM-Abhängigkeiten** — läuft headless in Bun

## CLI-Befehl

```
bun open-pencil eval <file> [optionen]

Argumente:
  file            .fig-Datei zum Bearbeiten

Optionen:
  --code, -c      Auszuführender JavaScript-Code (hat Zugriff auf `figma`-Global)
  --stdin         Code von stdin statt --code lesen
  --write, -w     Änderungen in die Eingabedatei zurückschreiben
  -o, --output    In eine andere Datei schreiben
  --json          Ergebnis als JSON ausgeben (Standard für Nicht-TTY)
  --quiet, -q     Ausgabe unterdrücken, nur Datei schreiben
```

### Ausführungsmodell

1. `.fig` laden → `SceneGraph`
2. `FigmaAPI(graph)` erstellen → `figma`-Proxy
3. Benutzercode in async-Funktion verpacken: `return (async () => { <code> })()`
4. Mit `figma` als einzigem Argument ausführen
5. Rückgabewert ausgeben (JSON oder agentfmt)
6. Bei `--write` oder `-o`: `SceneGraph` zurück in `.fig` serialisieren

### Rückgabewert-Formatierung

- `undefined` / `void` → keine Ausgabe
- Primitive → direkt ausgeben
- Objekte/Arrays → `JSON.stringify(result, null, 2)` oder agentfmt-Tabellen
- `FigmaNode` → serialisiert als `{ id, type, name, x, y, width, height, fills, ... }`
- Arrays von `FigmaNode` → als Liste serialisiert

## `FigmaAPI` — Phasenweise Implementierung

Die vollständige API-Referenz mit Phasen (Core, Komponenten, Variablen, Stile) und Eigenschafts-Mapping finden Sie in der [englischen Version](/eval-command).

### Phase 1: Core

Deckt ~80% realer Plugin-Skripte ab. Enthält: Dokument & Seite, Knotenerstellung, Knoteneigenschaften, Baumoperationen, Auto-Layout, Text, Kontur und Export.

### Phase 2: Komponenten & Instanzen

`figma.createComponent()`, `combineAsVariants()`, `createInstance()`, `detachInstance()`, `mainComponent`.

### Phase 3: Variablen

`figma.variables.getLocalVariables()`, `createVariable()`, `createVariableCollection()`, `setBoundVariable()`.

### Phase 4: Stile & Erweitert

Paint/Text/Effekt-Stile, Boolesche Operationen, JSX-Renderer.

## Gemeinsam mit KI-Werkzeugen

Die `FigmaAPI`-Klasse ist **dieselbe API-Oberfläche**, die KI-Werkzeuge verwenden. Dies stellt sicher, dass CLI-Skripte und KI-Werkzeuge identisch funktionieren.

## Dateilayout

```
packages/core/src/
  figma-api.ts          # FigmaAPI-Klasse + FigmaNode-Proxy
packages/cli/src/commands/
  eval.ts               # CLI-Befehl
```
