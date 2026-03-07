# `open-pencil eval` — API Plugin Figma-compatibile per scripting headless

## Panoramica

`bun open-pencil eval <file> --code '<js>'` esegue JavaScript su un file `.fig` con un oggetto globale `figma` compatibile con Figma. Questo abilita scripting headless, operazioni batch, esecuzione di strumenti IA e test — tutto senza la GUI.

L'oggetto `figma` rispecchia la superficie dell'API Plugin di Figma il più fedelmente possibile, così le conoscenze esistenti sui plugin Figma e gli snippet di codice sono direttamente trasferibili.

```bash
# Creare un frame, impostare auto-layout, aggiungere figli
bun open-pencil eval design.fig --code '
  const frame = figma.createFrame()
  frame.name = "Card"
  frame.resize(300, 200)
  frame.layoutMode = "VERTICAL"
  frame.itemSpacing = 12
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
  return { id: frame.id, name: frame.name }
'

# Interrogare nodi
bun open-pencil eval design.fig --code '
  const buttons = figma.currentPage.findAll(n => n.name.includes("Button"))
  return buttons.map(b => ({ id: b.id, name: b.name }))
'

# Scrivere le modifiche
bun open-pencil eval design.fig --code '...' --write
```

## Architettura

```
CLI: open-pencil eval <file> --code '...'
  → loadDocument(file) → SceneGraph
  → FigmaAPI(sceneGraph) → proxy `figma`
  → AsyncFunction('figma', code)(figmaProxy)
  → stampa risultato / salva file con --write
```

### Classi principali

| Classe | Posizione | Ruolo |
|--------|-----------|-------|
| `FigmaAPI` | `packages/core/src/figma-api.ts` | Oggetto proxy che implementa metodi `figma.*` |
| `FigmaNode` | `packages/core/src/figma-api.ts` | Proxy che avvolge `SceneNode` con accesso proprietà stile Figma |
| Comando `eval` | `packages/cli/src/commands/eval.ts` | Carica documento, crea API, esegue codice |

### Perché in `@open-pencil/core`?

La classe `FigmaAPI` è nel core perché: gli strumenti IA la riutilizzano, i test possono usarla e non ha dipendenze DOM.

## Comando CLI

```
bun open-pencil eval <file> [opzioni]

Argomenti:
  file            File .fig su cui operare

Opzioni:
  --code, -c      Codice JavaScript da eseguire
  --stdin         Leggere codice da stdin
  --write, -w     Scrivere le modifiche nel file di input
  -o, --output    Scrivere in un file diverso
  --json          Output come JSON
  --quiet, -q     Sopprimere l'output
```

## Implementazione a fasi

- **Fase 1: Core** — creazione nodi, proprietà, operazioni albero, auto-layout, testo (~80% degli script reali)
- **Fase 2: Componenti & Istanze** — createComponent, createInstance, detachInstance
- **Fase 3: Variabili** — getLocalVariables, createVariable, setBoundVariable
- **Fase 4: Stili & Avanzato** — stili paint/testo/effetti, operazioni booleane

[Riferimento API completo in inglese](/eval-command)
