# Architettura

## Panoramica del Sistema

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

## Layout dell'Editor

L'interfaccia segue il layout UI3 di Figma — barra degli strumenti in basso, navigazione a sinistra, proprietà a destra:

- **Pannello navigazione (sinistra)** — Albero dei livelli, pannello pagine
- **Canvas (centro)** — Canvas infinito con rendering CanvasKit, zoom/pan
- **Pannello proprietà (destra)** — Sezioni sensibili al contesto: Aspetto, Riempimento, Bordo, Tipografia, Layout, Posizione
- **Barra degli strumenti (basso)** — Selezione strumenti: Seleziona, Frame, Sezione, Rettangolo, Ellisse, Linea, Testo, Penna, Mano

## Componenti

### Rendering (CanvasKit WASM)

Lo stesso motore di rendering di Figma. CanvasKit fornisce disegno 2D accelerato dalla GPU con forme vettoriali, formattazione del testo tramite Paragraph API, effetti (ombre, sfocature, modalità di fusione) ed esportazione (PNG, SVG). Il binario WASM da 7MB viene caricato all'avvio e crea una superficie GPU sul canvas HTML.

Il renderer è suddiviso in moduli specializzati in `packages/core/src/renderer/`: attraversamento della scena, overlay, riempimenti, bordi, forme, effetti, righelli, etichette e cursori remoti.

### Scene Graph

`Map<string, Node>` piatto indicizzato da stringhe GUID. Struttura ad albero tramite riferimenti `parentIndex`. Fornisce lookup O(1), attraversamento efficiente, hit testing e query per area rettangolare per la selezione con marquee.

Consulta il [riferimento Scene Graph](/it/reference/scene-graph) per i dettagli interni.

### Motore di Layout (Yoga WASM)

Yoga di Meta fornisce il calcolo del layout CSS flexbox. Un adattatore sottile mappa i nomi delle proprietà Figma agli equivalenti Yoga:

| Proprietà Figma | Equivalente Yoga |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### Formato File (Kiwi Binary)

Riutilizza il codec binario Kiwi di Figma con 194 definizioni di messaggio/enum/struct. Importazione: analizza l'header → decompressione Zstd → decodifica Kiwi → `NodeChange`[] → scene graph. L'esportazione inverte il processo con generazione di miniature.

Consulta il [riferimento Formato File](/it/reference/file-format) per i dettagli.

### AI e Strumenti

Gli strumenti sono definiti una sola volta in `packages/core/src/tools/`, suddivisi per dominio: read, create, modify, structure, variables, vector, analyze. Ogni strumento ha parametri tipizzati e una funzione `execute(figma, args)`. Gli adattatori li convertono per:

- **Chat AI** — schema valibot, collegati a OpenRouter
- **Server MCP** — schema zod, trasporti stdio + HTTP
- **CLI** — disponibili tramite il comando `eval`

87 strumenti core + 3 strumenti di gestione file MCP = 90 totali.

### Annulla/Ripristina

Pattern a comandi inversi. Prima di applicare qualsiasi modifica, i campi interessati vengono salvati in uno snapshot. Lo snapshot diventa l'operazione inversa. Il batching raggruppa le modifiche rapide (come il trascinamento) in singole voci di annullamento.

### Appunti

Appunti bidirezionali compatibili con Figma. Codifica/decodifica binario Kiwi (stesso formato dei file .fig) tramite eventi nativi di copia/incolla del browser. Gestisce il ridimensionamento dei tracciati vettoriali, i figli delle istanze, il rilevamento dei set di componenti e l'applicazione degli override.

### Collaborazione P2P

Collaborazione peer-to-peer in tempo reale tramite Trystero (WebRTC) + Yjs CRDT. Nessun relay server — segnalazione tramite broker MQTT pubblici, STUN/TURN per l'attraversamento NAT. Il protocollo Awareness fornisce cursori live, selezioni e presenza. Persistenza locale tramite y-indexeddb.

### Bridge RPC CLI-App

Quando l'app desktop è in esecuzione, i comandi CLI si connettono tramite WebSocket invece di richiedere un file .fig. Il server di automazione è in esecuzione su `127.0.0.1:7600` (HTTP) e `127.0.0.1:7601` (WebSocket). I comandi vengono eseguiti sullo stato dell'editor live, consentendo a script di automazione e agenti AI di interagire con l'app in esecuzione.

## Prossimi Passi

### Set Completo di Strumenti figma-use

Il server MCP attualmente espone 90 strumenti. L'implementazione di riferimento in [figma-use](https://github.com/dannote/figma-use) ne ha 118. Gli strumenti rimanenti coprono vincoli di layout avanzati, connessioni per prototipi, modifica avanzata delle proprietà dei componenti e operazioni in blocco sui documenti.

### Strumenti di Design per CI

La CLI headless supporta già `analyze colors/typography/spacing/clusters`. Prossimamente: integrazione con GitHub Actions per linting automatico del design e regressione visiva nelle PR.

### Prototipazione

Transizioni frame-to-frame, trigger di interazione (clic, hover, trascinamento), gestione degli overlay e modalità anteprima a schermo intero.

### Layout CSS Grid

CSS Grid è supportato tramite un [fork di Yoga](https://github.com/open-pencil/yoga/tree/grid) con PR grid cherry-picked dall'upstream. Seleziona un frame, clicca sull'icona griglia per passare da flex a grid. Configura track colonne/righe (fr, px fissi, auto), gap colonne e righe, e padding per lato.

### Firma del Codice per Windows

I binari macOS sono firmati e autenticati dalla v0.6.0. La firma Windows Authenticode tramite Azure Code Signing è pianificata per rimuovere l'avviso SmartScreen.
