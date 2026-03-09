# Funktionen

## Figma .fig-Dateien

Öffnen und speichern Sie native Figma-Dateien direkt. Die Import/Export-Pipeline verwendet denselben Kiwi-Binär-Codec wie Figma — 194 Schema-Definitionen, ~390 Felder pro Knoten. Speichern mit <kbd>⌘</kbd><kbd>S</kbd>, Speichern unter mit <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Kopieren & Einfügen mit Figma** — Knoten in Figma auswählen, <kbd>⌘</kbd><kbd>C</kbd>, zu OpenPencil wechseln, <kbd>⌘</kbd><kbd>V</kbd>. Füllungen, Konturen, Auto-Layout, Text, Effekte, Eckenradien und Vektornetzwerke bleiben erhalten. Funktioniert in beide Richtungen.

## Zeichnen & Bearbeiten

- **Formen** — Rechteck (<kbd>R</kbd>), Ellipse (<kbd>O</kbd>), Linie (<kbd>L</kbd>), Polygon, Stern
- **Stiftwerkzeug** — Vektornetzwerke (keine einfachen Pfade), Bézier-Kurven mit Tangentengriffen
- **Text** — Canvas-native Bearbeitung mit IME-Unterstützung, Doppelklick zum Betreten des Bearbeitungsmodus
- **Rich Text** — Zeichenweise Fett (<kbd>⌘</kbd><kbd>B</kbd>), Kursiv (<kbd>⌘</kbd><kbd>I</kbd>), Unterstrichen (<kbd>⌘</kbd><kbd>U</kbd>), Durchgestrichen
- **Auto-Layout** — Flexbox via Yoga WASM: Richtung, Abstand, Polsterung, Ausrichtung, Kindgröße. <kbd>⇧</kbd><kbd>A</kbd> zum Umschalten
- **Komponenten** — Erstellen (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), Component Sets (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), Instanzen mit Override-Unterstützung, Live-Synchronisation
- **Variablen** — Design-Tokens mit Sammlungen, Modi (Hell/Dunkel), Farb-/Float-/String-/Boolean-Typen, Variablenbindung
- **Sektionen** — Organisatorische Container mit automatischer Kindübernahme und Titel-Pills

## Eigenschafts-Panel

Kontextsensitive Design | Code | KI-Tabs:

- **Darstellung** — Deckkraft, Eckenradius (einheitlich oder pro Ecke), Sichtbarkeit
- **Füllung** — Vollfarbe, Verlauf (Linear/Radial/Angular/Diamant), Bild
- **Kontur** — Farbe, Breite, Ausrichtung (Innen/Mitte/Außen), Pro-Seite-Breiten, Cap, Join, Dash
- **Effekte** — Schlagschatten, Innerer Schatten, Ebenen-Unschärfe, Hintergrund-Unschärfe, Vordergrund-Unschärfe
- **Typografie** — Schriftart-Auswahl mit virtuellem Scrollen und Suche, Gewicht, Größe, Ausrichtung, Stil-Buttons
- **Layout** — Auto-Layout-Steuerungen (wenn aktiviert)
- **Export** — Skalierung, Format (PNG/JPG/WEBP/SVG), Live-Vorschau

## Rendering

Skia (CanvasKit WASM) — dieselbe Rendering-Engine wie Figma:

- Verlaufsfüllungen (Linear, Radial, Angular, Diamant)
- Bildfüllungen mit Skalierungsmodi
- Effekte mit Pro-Knoten-Caching
- Bogendaten (partielle Ellipsen, Donuts)
- Viewport-Culling und Paint-Wiederverwendung
- Fanglinien mit rotationsbewusster Ausrichtung
- Canvas-Lineale mit Auswahl-Badges
- Hover-Hervorhebung entlang der tatsächlichen Geometrie

## Rückgängig/Wiederherstellen

Jede Operation ist rückgängig machbar — Erstellen, Löschen, Verschieben, Größenänderungen, Eigenschaftsänderungen, Umordnung, Layout-Änderungen, Variablen-Operationen. Verwendet ein Inverse-Command-Muster. <kbd>⌘</kbd><kbd>Z</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Mehrseitige Dokumente

Seiten hinzufügen, löschen, umbenennen. Jede Seite hat einen unabhängigen Viewport-Zustand. Doppelklick zum Inline-Umbenennen.

## Multi-Datei-Tabs

Mehrere Dokumente in Tabs öffnen. <kbd>⌘</kbd><kbd>T</kbd> neuer Tab, <kbd>⌘</kbd><kbd>W</kbd> schließen, <kbd>⌘</kbd><kbd>O</kbd> Datei öffnen.

## Export

- **Bild** — PNG, JPG, WEBP in konfigurierbarer Skalierung (0,5×–4×). Über Panel, Kontextmenü oder <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>
- **SVG** — Formen, Text mit Stil-Runs, Verläufe, Effekte, Mischmodi
- **Tailwind JSX** — HTML mit Tailwind v4 Utility-Klassen, bereit für React oder Vue
- **Als kopieren** — Text, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>) oder JSX über das Kontextmenü

CLI: `open-pencil export design.fig -f jsx --style tailwind`

## KI-Chat

<kbd>⌘</kbd><kbd>J</kbd> öffnet den KI-Assistenten. 87 Werkzeuge zum Erstellen von Formen, Setzen von Stilen, Verwalten von Layout, Arbeiten mit Komponenten und Variablen, Ausführen boolescher Operationen, Analysieren von Design-Tokens und Exportieren von Assets. Eigener OpenRouter-API-Key.

Tool-Aufrufe werden als einklappbare Timeline-Einträge angezeigt. Modellauswahl mit Claude, Gemini, GPT, DeepSeek und weiteren.

## MCP-Server

Claude Code, Cursor, Windsurf oder jeden MCP-Client verbinden, um `.fig`-Dateien headless zu lesen und zu schreiben. 90 Werkzeuge (87 Core + 3 Dateiverwaltung). Zwei Transporte: stdio und HTTP.

```sh
bun add -g @open-pencil/mcp
```

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Siehe [MCP-Tools-Referenz](/programmable/mcp-server) für die vollständige Werkzeugliste.

## CLI

`.fig`-Dateien vom Terminal aus inspizieren, exportieren und analysieren:

```sh
open-pencil tree design.fig          # Knotenbaum
open-pencil find design.fig --type TEXT  # Suche
open-pencil export design.fig -f png     # Rendern
open-pencil analyze colors design.fig    # Farbanalyse
open-pencil analyze clusters design.fig  # Wiederholte Muster
open-pencil eval design.fig -c "..."     # Figma Plugin API
```

Wenn die Desktop-App läuft, kann die Datei weggelassen werden, um den Live-Editor via RPC zu steuern:

```sh
open-pencil tree                     # Live-Dokument
open-pencil export -f png            # Canvas-Screenshot
```

Alle Befehle unterstützen `--json`. Installation: `bun add -g @open-pencil/cli`

## Echtzeit-Kollaboration

P2P via WebRTC — kein Server erforderlich. Link teilen und gemeinsam bearbeiten.

- Live-Cursor mit farbigen Pfeilen und Namens-Pills
- Präsenz-Avatare
- Folgemodus — auf einen Peer klicken, um seinem Viewport zu folgen
- Lokale Persistenz via IndexedDB
- Sichere Raum-IDs via `crypto.getRandomValues()`

## Desktop & Web

**Desktop** — Tauri v2, ~7 MB. macOS (signiert & notarisiert), Windows, Linux. Native Menüs, Offline-Betrieb, automatisches Speichern.

**Web** — läuft unter [app.openpencil.dev](https://app.openpencil.dev), als PWA auf Mobilgeräten installierbar mit touch-optimierter Oberfläche.

**Homebrew:**

```sh
brew install open-pencil/tap/open-pencil
```

## Google Fonts Fallback

Wenn eine Schriftart lokal nicht verfügbar ist, lädt OpenPencil sie automatisch von Google Fonts. Keine manuelle Installation nötig beim Öffnen von .fig-Dateien mit unbekannten Schriften.
