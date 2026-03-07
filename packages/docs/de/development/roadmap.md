# Fahrplan

## Phasen

### Phase 1: Core-Engine ✅

SceneGraph, Skia-Rendering, Grundformen, Auswahl, Zoom/Pan, Rückgängig/Wiederherstellen, Fanglinien.

### Phase 2: Editor-UI + Layout ✅

Vue 3 + Reka UI Panels, Eigenschaften, Ebenen, Werkzeugleiste, Yoga Auto-Layout, Inline-Textbearbeitung, Canvas-Lineale.

### Phase 3: Datei-I/O + Visuelle Features ✅

.fig Import/Export, Kiwi-Codec, Zwischenablage, Stiftwerkzeug, Vektornetzwerke, Gruppen, Tauri v2 Desktop, Sektionen, Mehrseiten, Hover-Hervorhebung, Tier-1-Rendering (Verläufe, Bilderfüllungen, Effekte, Kontur-Eigenschaften, Bögen).

### Phase 4: Komponenten + Variablen ✅

Komponenten, Instanzen, Overrides, Komponenten-Sets, Variablen (COLOR/FLOAT/STRING/BOOLEAN), Sammlungen, Modi, Bildexport, Kontextmenü, Rich-Text-Formatierung.

### Phase 5: KI-Integration & Werkzeuge ✅

**Geliefert:**
- @open-pencil/core extrahiert in packages/core/ (keine DOM-Abhängigkeiten)
- @open-pencil/cli mit headless .fig-Operationen (info, tree, find, export, analyze, node, pages, variables, eval)
- `eval`-Befehl mit Figma-kompatibler Plugin API für Headless-Skripting
- KI-Chat: OpenRouter-Direktverbindung, 75 Werkzeuge in `schema.ts`, Modellauswahl, ⌘J
- 49 zusätzliche KI/MCP-Werkzeuge portiert von figma-use (75 gesamt)
- MCP-Server (@open-pencil/mcp): stdio + HTTP, 75 Core-Tools + 3 Dateiverwaltungs-Tools
- Vereinheitlichte Werkzeugdefinitionen: einmal in `schema.ts` definieren, für KI-Chat (valibot), MCP (zod), CLI (eval) adaptieren
- App-Menüleiste für Browser-Modus (Datei, Bearbeiten, Ansicht, Objekt, Text, Anordnen)
- Automatisches Speichern: 3s Debounce nach letzter Szenenänderung
- Multi-Selektion-Eigenschaftspanel mit gemeinsamen/gemischten Werten
- npm-Veröffentlichung mit Provenance für core, cli und mcp

**Geplant:**
- Attached Mode: WebSocket zum laufenden Editor
- Design-Guidelines-System
- Screenshot-Verification-Loop

### Phase 6: Kollaboration + Distribution 🟡

**Geliefert:**
- P2P-Kollaboration über Trystero (WebRTC) + Yjs CRDT — kein Server-Relay
- Awareness-Protokoll: Live-Cursor, Auswahlen, Präsenz
- Folgemodus: Klick auf Peer-Avatar zum Viewport-Folgen
- Lokale Persistenz über y-indexeddb
- Effekt-Rendering: Schlagschatten, innerer Schatten, Ebenen-/Hintergrund-/Vordergrund-Unschärfe
- Multi-Datei-Tabs: ⌘N/⌘T neuer Tab, ⌘W schließen, ⌘O öffnen
- Apple Code-Signierung und Notarisierung für macOS
- Linux-Builds (x64) in CI hinzugefügt
- VitePress-Dokumentationsseite mit i18n (6 Sprachen)

**Geplant:**
- Prototyping (Frame-Verbindungen, Übergänge, Animationen)
- Kommentare (Pin, Threads, Auflösen)
- PWA-Unterstützung
- Varianten-Switching, FLOAT/STRING/BOOLEAN Variable UI, variablengesteuertes Theming

## Zeitplan

| Phase | Geschätzte Dauer | Status |
|-------|-----------------|--------|
| Phase 1: Core-Engine | 3 Monate | ✅ Abgeschlossen |
| Phase 2: Editor-UI + Layout | 3 Monate | ✅ Abgeschlossen |
| Phase 3: Datei-I/O + Visuelle Features | 2 Monate | ✅ Abgeschlossen |
| Phase 4: Komponenten + Variablen | 2 Monate | ✅ Abgeschlossen |
| Phase 5: KI-Integration & Werkzeuge | 2 Monate | ✅ Abgeschlossen |
| Phase 6: Kollaboration + Distribution | 2 Monate | 🟡 In Arbeit |
