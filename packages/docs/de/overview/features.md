# Funktionen

## Figma-Dateien

OpenPencil öffnet und speichert `.fig`-Dateien direkt. Import und Export verwenden wie Figma den Kiwi-Binärcodec mit 194 Schemadefinitionen und rund 390 Feldern pro Objekt. Speichern: <kbd>⌘</kbd><kbd>S</kbd>, Speichern unter: <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Kopieren und Einfügen mit Figma:** Objekte in Figma auswählen, <kbd>⌘</kbd><kbd>C</kbd> drücken, zu OpenPencil wechseln und mit <kbd>⌘</kbd><kbd>V</kbd> einfügen. Füllungen, Konturen, automatische Anordnung, Text, Effekte, Eckenradien und Vektornetzwerke bleiben in beiden Richtungen erhalten.

## Zeichnen und Bearbeiten

- **Formen:** Rechteck (<kbd>R</kbd>), Ellipse (<kbd>O</kbd>), Linie (<kbd>L</kbd>), Polygon und Stern.
- **Zeichenstift:** Vektornetzwerke statt einfacher Pfade, Bézierkurven mit Tangentengriffen.
- **Text:** Bearbeitung direkt auf der Arbeitsfläche, IME-Unterstützung und Doppelklick zum Wechsel in den Bearbeitungsmodus.
- **Formatierter Text:** Fett, Kursiv, Unterstrichen und Durchgestrichen für einzelne Zeichenbereiche.
- **Automatische Anordnung:** Flexbox und CSS Grid über Yoga WASM mit Richtung, Abstand, Innenabstand, Verteilung, Ausrichtung, Größenmodi und Rasterspuren.
- **Komponenten:** Komponenten und Komponentensätze, Instanzen mit Überschreibungen und automatische Synchronisierung.
- **Variablen:** Designtoken mit Sammlungen, Modi wie Hell und Dunkel, den Typen Color, Float, String und Boolean sowie Variablenbindungen.
- **Sektionen:** Container zur Organisation mit automatischer Übernahme überlappender Objekte.

## Eigenschaften

Die Registerkarten Design, Code und AI passen sich der aktuellen Auswahl an:

- **Darstellung:** Deckkraft, einheitlicher oder separater Eckenradius und Sichtbarkeit.
- **Füllung:** Volltonfarbe, lineare, radiale, Winkel- und Diamantverläufe sowie Bilder.
- **Kontur:** Farbe, Stärke, Ausrichtung, separate Stärke pro Seite, Enden, Verbindungen und Strichelung.
- **Effekte:** Schlagschatten, innerer Schatten sowie Ebenen-, Hintergrund- und Vordergrundunschärfe.
- **Typografie:** Schriftwahl mit Suche und virtuellem Scrollen, Schnitt, Größe, Ausrichtung und Formatierung.
- **Anordnung:** Einstellungen der automatischen Anordnung.
- **Export:** Maßstab, PNG/JPG/WEBP/SVG und Vorschau.

## Darstellung

Skia über CanvasKit WASM ist dieselbe Grafik-Engine, die auch Figma verwendet. OpenPencil unterstützt unter anderem:

- lineare, radiale, Winkel- und Diamantverläufe;
- Bildfüllungen mit verschiedenen Skalierungsarten;
- Zwischenspeicherung von Effekten pro Objekt;
- Bögen, partielle Ellipsen und Ringe;
- Auslassen nicht sichtbarer Objekte und Wiederverwenden von Zeichenwerkzeugen;
- Fanglinien mit Berücksichtigung der Drehung;
- Lineale mit Markierung des Auswahlbereichs;
- Hervorhebung entlang der tatsächlichen Geometrie.

## Rückgängig und Wiederholen

Erstellen, Löschen, Verschieben, Größenänderung, Eigenschaftsänderungen, Wechsel des übergeordneten Objekts, Anordnung und Variablen lassen sich rückgängig machen. Tastenkürzel: <kbd>⌘</kbd><kbd>Z</kbd> und <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Seiten und Dokumente

Seiten können hinzugefügt, gelöscht und umbenannt werden und behalten jeweils ihre eigene Ansichtsposition und Vergrößerung. Mehrere Dokumente lassen sich in Registerkarten öffnen.

## Export

- **Bilder:** PNG, JPG und WEBP im Maßstab 0,5× bis 4×.
- **SVG:** Formen, Text mit Stilbereichen, Verläufe, Effekte und Mischmodi.
- **Tailwind JSX:** HTML mit Tailwind-v4-Klassen für React oder Vue.
- **Kopieren als:** Text, SVG, PNG oder JSX über das Kontextmenü.

```sh
openpencil export design.fig -f jsx --style tailwind
```

## AI-Chat

<kbd>⌘</kbd><kbd>J</kbd> öffnet den Assistenten. Mehr als 90 Werkzeuge erstellen Formen, ändern Stile und Anordnungen, bearbeiten Komponenten und Variablen, führen boolesche Operationen aus, analysieren Designtoken und exportieren Ressourcen. Unterstützt werden Anthropic, OpenAI, Google AI, OpenRouter und kompatible Endpunkte.

Werkzeugaufrufe erscheinen als einklappbare Einträge auf einer Zeitleiste. Zur visuellen Prüfung stellt der Assistent seine Änderungen dar und vergleicht das Ergebnis mit der Anfrage. Sämtliche Änderungen durch AI können rückgängig gemacht werden.

## MCP-Server

Claude Code, Cursor, Windsurf und andere MCP-Clients können `.fig`-Dateien mit mehr als 90 Werkzeugen ohne grafische Oberfläche lesen und verändern. Als Übertragung stehen stdio und HTTP zur Verfügung.

```sh
npm install -g @open-pencil/mcp
```

## CLI

`.fig`-Dateien lassen sich im Terminal untersuchen, exportieren und analysieren:

```sh
openpencil tree design.fig              # Objektbaum
openpencil find design.fig --type TEXT  # Suche
openpencil export design.fig -f png     # Export
openpencil analyze colors design.fig    # Farbanalyse
openpencil analyze clusters design.fig  # Wiederkehrende Strukturen
openpencil eval design.fig -c "..."     # Figma Plugin API
```

Alle Befehle unterstützen `--json`. Installation: `npm install -g @open-pencil/cli` oder `bun add -g @open-pencil/cli`.

## Zusammenarbeit in Echtzeit

Die Zusammenarbeit erfolgt direkt zwischen den Teilnehmern über WebRTC und benötigt keinen zentralen Server. Ein Link genügt. Verfügbar sind Zeiger der Teilnehmer, Anwesenheitsanzeigen und das Folgen der Ansicht eines anderen Teilnehmers.

## Desktop und Web

**Desktop:** Tauri v2, rund 7 MB, für macOS, Windows und Linux, mit nativen Menüs, Offlinebetrieb und automatischem Speichern.

**Web:** [app.openpencil.dev](https://app.openpencil.dev), als PWA installierbar und für Touch-Bedienung optimiert.

## Ersatzweise Google Fonts laden

Ist eine Schrift nicht lokal verfügbar, lädt OpenPencil sie automatisch von Google Fonts. Eine manuelle Installation ist nicht erforderlich.
