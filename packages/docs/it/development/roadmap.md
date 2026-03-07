# Roadmap

## Fasi

### Fase 1: Motore Core ✅

SceneGraph, rendering Skia, forme base, selezione, zoom/pan, annulla/ripristina, guide di snap.

### Fase 2: UI Editor + Layout ✅

Vue 3 + Reka UI panels, proprietà, livelli, barra strumenti, Yoga auto-layout, editing testo inline, righelli canvas.

### Fase 3: File I/O + Feature Visive ✅

Import/export .fig, codec Kiwi, appunti, strumento penna, reti vettoriali, gruppi, Tauri v2 desktop, sezioni, multi-pagina, evidenziazione hover, rendering Tier 1.

### Fase 4: Componenti + Variabili ✅

Componenti, istanze, override, set di componenti, variabili (COLOR/FLOAT/STRING/BOOLEAN), collezioni, modalità, export immagini, menu contestuale, formattazione testo ricco.

### Fase 5: Integrazione IA & Strumenti ✅

**Consegnato:**
- @open-pencil/core estratto in packages/core/ (nessuna dipendenza DOM)
- @open-pencil/cli con operazioni headless .fig (info, tree, find, export, analyze, eval)
- Comando `eval` con API Plugin compatibile Figma
- Chat IA: connessione diretta OpenRouter, 75 strumenti in `schema.ts`, ⌘J
- 49 strumenti IA/MCP aggiuntivi portati da figma-use (75 in totale)
- Server MCP (@open-pencil/mcp): stdio + HTTP, 75 strumenti core + 3 gestione file
- Definizioni strumenti unificate: definire una volta in `schema.ts`, adattare per chat IA (valibot), MCP (zod), CLI (eval)
- Barra dei menu per modalità browser
- Salvataggio automatico: scrittura con debounce di 3s
- Pannello proprietà multi-selezione con valori condivisi/misti

**Pianificato:**
- Modalità attached: WebSocket verso l'editor in esecuzione
- Sistema di linee guida di design

### Fase 6: Collaborazione + Distribuzione 🟡

**Consegnato:**
- Collaborazione P2P via Trystero (WebRTC) + Yjs CRDT — senza server relay
- Protocollo awareness: cursori in tempo reale, selezioni, presenza
- Modalità segui: clic sull'avatar di un peer per seguire il suo viewport
- Persistenza locale via y-indexeddb
- Rendering effetti: ombra portata, ombra interna, sfocatura livello/sfondo/primo piano
- Schede multi-file: ⌘N/⌘T nuova scheda, ⌘W chiudi, ⌘O apri
- Firma codice Apple e notarizzazione per macOS
- Build Linux (x64) aggiunti al CI
- Sito documentazione VitePress con i18n (6 lingue)

**Pianificato:**
- Prototipazione (connessioni frame, transizioni, animazioni)
- Commenti (pin, thread, risolvere)
- Supporto PWA
- Cambio varianti, UI variabili FLOAT/STRING/BOOLEAN, theming tramite variabili

## Tempistica

| Fase | Durata stimata | Stato |
|------|---------------|--------|
| Fase 1: Motore Core | 3 mesi | ✅ Completata |
| Fase 2: UI Editor + Layout | 3 mesi | ✅ Completata |
| Fase 3: File I/O + Feature Visive | 2 mesi | ✅ Completata |
| Fase 4: Componenti + Variabili | 2 mesi | ✅ Completata |
| Fase 5: Integrazione IA & Strumenti | 2 mesi | ✅ Completata |
| Fase 6: Collaborazione + Distribuzione | 2 mesi | 🟡 In corso |
