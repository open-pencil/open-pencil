# Funktionen

## Warum OpenPencil

Design-Tools sind ein Lieferkettenproblem. Wenn Ihr Tool proprietär ist, bestimmt der Anbieter, was möglich ist — er kann Ihre Automatisierung über Nacht brechen. OpenPencil ist eine Open-Source-Alternative: MIT-lizenziert, Figma-kompatibel, vollständig lokal und programmierbar.

## Figma .fig-Datei Import & Export

Öffnen und speichern Sie native Figma-Dateien direkt. Der Import dekodiert das vollständige 194-Definitionen-Kiwi-Schema einschließlich NodeChange-Nachrichten mit ~390 Feldern. Der Export kodiert den Szenengraphen zurück in Kiwi-Binärformat mit Zstd-Kompression und Thumbnail-Generierung. Speichern (<kbd>⌘</kbd><kbd>S</kbd>) und Speichern unter (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>) verwenden native OS-Dialoge in der Desktop-App. Die Import/Export-Pipeline unterstützt Round-Trip-Treue.

## Kopieren & Einfügen mit Figma

Knoten in Figma auswählen, <kbd>⌘</kbd><kbd>C</kbd>, zu OpenPencil wechseln, <kbd>⌘</kbd><kbd>V</kbd> — sie erscheinen mit Füllungen, Konturen, Auto-Layout, Text, Eckenradien, Effekten und Vektornetzwerken. Funktioniert auch umgekehrt.

Paste verarbeitet komplexe Szenarien: Vektorpfade werden von Figmas `normalizedSize` auf die tatsächlichen Knotenmaße skaliert, Instanz-Kinder werden aus den `symbolData` ihrer Komponente gefüllt, Component-Sets werden erkannt und `symbolOverrides` für Text, Füllungen, Sichtbarkeit und Layout-Eigenschaften angewendet. Schriften, die von eingefügten Textknoten referenziert werden, werden automatisch geladen.

## Vektornetzwerke

Das Stiftwerkzeug verwendet Figmas Vektornetzwerk-Modell — keine einfachen Pfade. Klicken für Eckpunkte, Klicken+Ziehen für Bézier-Kurven mit Tangentengriffen. Offene und geschlossene Pfade werden unterstützt.

## Formwerkzeuge

Die Werkzeugleiste bietet alle grundlegenden Figma-Formwerkzeuge: Rechteck (<kbd>R</kbd>), Ellipse (<kbd>O</kbd>), Linie (<kbd>L</kbd>), Polygon und Stern. Alle Formen unterstützen Füllung, Kontur, Hover-Hervorhebung und Auswahlumriss.

## Auto-Layout

Yoga WASM bietet CSS-Flexbox-Layout. Frames unterstützen:

- **Richtung** — horizontal, vertikal, Umbruch
- **Abstand** — Zwischenraum zwischen Kindern
- **Polsterung** — einheitlich oder pro Seite
- **Ausrichtung** — Start, Mitte, Ende, Zwischenraum
- **Querachse** — Start, Mitte, Ende, Dehnen
- **Kindgröße** — fest, füllen, anpassen

Shift+A schaltet Auto-Layout um oder umschließt ausgewählte Knoten.

## Inline-Textbearbeitung

Canvas-native Textbearbeitung — kein DOM-Textarea-Overlay. Doppelklicken Sie auf einen Textknoten, um den Bearbeitungsmodus zu betreten. Der Canvas rendert einen blinkenden Cursor, blaue Auswahlrechtecke und einen blauen Umriss.

**Schriftart-Auswahl** mit virtuellem Scrollen, Suchfilter und CSS-Schriftvorschau. In Tauri werden Systemschriften über Rusts `font-kit`-Crate aufgelistet.

## Rich-Text-Formatierung

Zeichenweise Formatierung innerhalb eines Textknotens. <kbd>⌘</kbd><kbd>B</kbd> für fett, <kbd>⌘</kbd><kbd>I</kbd> für kursiv, <kbd>⌘</kbd><kbd>U</kbd> für unterstrichen. Rich-Text-Formatierung bleibt bei .fig-Import/Export erhalten.

## Rückgängig/Wiederherstellen

Jede Operation ist rückgängig machbar. Das System verwendet ein Inverse-Command-Muster. <kbd>⌘</kbd><kbd>Z</kbd> macht rückgängig, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> stellt wieder her.

## Fanglinien

Kanten- und Mittenfang mit roten Führungslinien bei ausgerichteten Knoten. Rotationsbewusst.

## Canvas-Lineale

Lineale an den oberen und linken Kanten zeigen Koordinatenskalen. Bei Auswahl eines Knotens werden Position und Koordinaten-Badges angezeigt.

## Farbauswahl & Fülltypen

HSV-Farbauswahl mit Farbton-Schieberegler, Alpha-Schieberegler, Hex-Eingabe und Deckkraftsteuerung. Fülltypen: Vollfarbe, Verlauf (Linear, Radial, Winkel, Diamant) und Bild.

## Ebenen-Panel

Baumansicht der Dokumenthierarchie mit Reka UI Tree-Komponente. Aufklappen/Zuklappen, Ziehen zum Umordnen, Sichtbarkeit pro Knoten umschalten.

## Eigenschafts-Panel

Registerkarten-Oberfläche mit **Design** | **Code** | **KI**-Tabs.

Der **Design**-Tab zeigt kontextsensitive Abschnitte: Darstellung, Füllung, Kontur, Effekte, Typografie, Layout, Position, Export und Seite.

Der **Code**-Tab zeigt JSX-Export der Auswahl. Der **KI**-Tab bietet eine KI-Chat-Oberfläche.

## Gruppieren/Entgruppieren

⌘G gruppiert ausgewählte Knoten. ⇧⌘G entgruppiert.

## Sektionen

Sektionen (<kbd>S</kbd>) sind organisatorische Container auf der obersten Ebene des Canvas.

## Mehrseitige Dokumente

Dokumente unterstützen mehrere Seiten wie Figma. Jede Seite hat einen unabhängigen Viewport-Zustand.

## Hover-Hervorhebung

Knoten werden beim Überfahren mit einem formgerechten Umriss hervorgehoben.

## Erweitertes Rendering (Tier 1)

Der CanvasKit-Renderer unterstützt vollständige Tier-1-Visualfunktionen: Gradientenfüllungen (linear, radial, angular, diamant), Bildfüllungen, Effekte (Schatten, Unschärfe), Kontureigenschaften (Cap, Join, Dash), Bogendaten, Viewport-Culling, Paint-Wiederverwendung und RAF-Zusammenfassung.

## Komponenten & Instanzen

Erstellen Sie wiederverwendbare Komponenten aus Frames oder Auswahlen (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>). Live-Synchronisation, Override-Unterstützung und Komponenten-Sets (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>).

## Variablen

Design-Token als Variablen mit Sammlungen und Modi. Unterstützt COLOR-Typ mit vollständiger UI, FLOAT/STRING/BOOLEAN definiert. Organisieren Sie Variablen in Sammlungen, definieren Sie Modi (z.B. Hell/Dunkel).

## Bildexport

Ausgewählte Knoten als PNG, JPG oder WEBP exportieren. Skalierung von 0,5× bis 4×, Formatauswahl und Live-Vorschau.

## Kontextmenü

Rechtsklick auf dem Canvas öffnet ein Figma-ähnliches Kontextmenü mit Zwischenablage, Z-Reihenfolge, Gruppierung, Komponenten- und Sichtbarkeitsaktionen.

## Z-Ordnung, Sichtbarkeit & Sperre

<kbd>]</kbd> bringt ausgewählte Knoten nach vorne, <kbd>[</kbd> sendet nach hinten. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> schaltet Sichtbarkeit um. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> schaltet die Sperre um — gesperrte Knoten können nicht vom Canvas aus ausgewählt oder verschoben werden. Knoten zwischen Seiten verschieben über das Kontextmenü „Auf Seite verschieben".

## Web- & Desktop-App

OpenPencil läuft im Browser unter [app.openpencil.dev](https://app.openpencil.dev). Die Desktop-App verwendet eine Tauri v2-Shell (~5 MB).

## App-Menü (Browser)

Im Browser-Modus bietet eine mit reka-ui Menubar erstellte Menüleiste Zugriff auf alle wichtigen Editor-Aktionen. Sechs Menüs: **Datei**, **Bearbeiten**, **Ansicht**, **Objekt**, **Text**, **Anordnen**.

## Automatisches Speichern

Dateien werden 3 Sekunden nach der letzten Szenenänderung automatisch gespeichert.

## P2P-Kollaboration

Echtzeit-Peer-to-Peer-Kollaboration — kein Server erforderlich. Teilen Sie einen Link und bearbeiten Sie gemeinsam. Basiert auf Trystero (WebRTC) für direkte Peer-Verbindungen und Yjs (CRDT) für konfliktfreie Dokumentensynchronisation.

- **Keine Hosting-Kosten** — Signalisierung über öffentliche MQTT-Broker, Daten fließen direkt zwischen Peers
- **NAT-Traversal** — Google STUN, Cloudflare STUN und Open Relay TURN-Server
- **Live-Cursor** — Figma-ähnliche farbige Cursor-Pfeile mit weißem Rand und Namens-Pills, im Bildschirmraum gerendert
- **Präsenz** — sehen Sie, wer im Raum ist, mit farbigen Avataren
- **Folgemodus** — klicken Sie auf den Avatar eines Peers, um seinem Viewport in Echtzeit zu folgen
- **Lokale Persistenz** — y-indexeddb hält den Raum über Seitenaktualisierungen hinweg am Leben
- **Sichere Räume** — IDs werden mit `crypto.getRandomValues()` generiert

## Multi-Datei-Tabs

Öffnen Sie mehrere Dokumente in Tabs innerhalb eines einzigen Fensters. Tab-Leiste mit Schließen-Buttons. Mittelklick zum Schließen eines Tabs.

- <kbd>⌘</kbd><kbd>N</kbd> oder <kbd>⌘</kbd><kbd>T</kbd> — neuer Tab
- <kbd>⌘</kbd><kbd>W</kbd> — aktuellen Tab schließen
- <kbd>⌘</kbd><kbd>O</kbd> — Datei in neuem Tab öffnen

Jeder Tab pflegt seinen eigenen Dokumentzustand, Undo-Verlauf und Viewport.

## Effekt-Rendering

Vollständiges Rendering von Figma-Effekten über CanvasKit:

- **Schlagschatten** — Versatz, Unschärferadius, Ausdehnung, Farbe
- **Innerer Schatten** — eingefügter Schatten mit Versatz, Unschärfe und Farbe
- **Ebenen-Unschärfe** — Gaußsche Unschärfe auf der gesamten Ebene
- **Hintergrund-Unschärfe** — Unschärfe des Inhalts hinter der Ebene (Glas-/Matteffekt)
- **Vordergrund-Unschärfe** — Unschärfe im Vordergrund

Per-Knoten `SkPicture`-Cache bedeutet, dass unveränderte Schatten-/Unschärfe-Knoten aus dem Cache wiedergegeben werden.

## Multi-Selektion-Eigenschaften

Wählen Sie mehrere Knoten aus und bearbeiten Sie gemeinsame Eigenschaften gleichzeitig:

- Gemeinsame Werte werden in allen Abschnitten normal angezeigt (Position, Größe, Darstellung, Füllung, Kontur, Effekte)
- Unterschiedliche Werte zeigen „Mixed"
- Breiten- und Höheneingaben funktionieren über die Auswahl
- Horizontal/vertikal spiegeln gilt für alle ausgewählten Knoten

## ScrubInput

Alle numerischen Eingaben im Eigenschafts-Panel verwenden eine Zieh-zum-Ändern-Interaktion — horizontal ziehen zum Anpassen des Wertes, oder klicken zum direkten Eingeben. Unterstützt Suffix-Anzeige (°, px, %).

## CI/CD-Builds

GitHub Actions baut native Tauri-Desktop-Apps bei Versions-Tags. Die Build-Matrix umfasst macOS (arm64, x64), Windows (x64, arm64) und Linux (x64). macOS-Builds sind mit Apple-Developer-Zertifikaten signiert und notarisiert. Release-Notes werden automatisch aus CHANGELOG.md befüllt.

## Bild- & SVG-Export

Exportieren Sie ausgewählte Knoten als PNG, JPG, WEBP oder SVG. SVG-Export unterstützt Rechtecke, Ellipsen, Linien, Sterne, Polygone, Vektoren, Text, Verläufe, Bildausfüllungen, Effekte und verschachtelte Gruppen.

CLI: `bun open-pencil export --format svg file.fig`. MCP/KI-Tool: `export_svg`.

## Als kopieren

Das **Als kopieren**-Untermenü im Kontextmenü bietet:

- **Als Text kopieren** — sichtbarer Textinhalt
- **Als SVG kopieren** — SVG-Markup der Auswahl
- **Als PNG kopieren** — rendert bei 2× in die Zwischenablage (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>)
- **Als JSX kopieren** — OpenPencil JSX

## Konturausrichtung & Pro-Seite-Breiten

Konturausrichtung: **Innen**, **Mitte** oder **Außen** (beschneidungsbasiertes Rendering wie in Figma). Individuelle Konturbreiten pro Seite (Oben/Rechts/Unten/Links) über das Seitenauswahl-Dropdown.

## Mobile Layout & PWA

OpenPencil ist als Progressive Web App auf Mobilgeräten installierbar. Das Layout passt sich kleinen Bildschirmen an — Seitenpanels werden durch ein wischbares unteres Drawer mit Tabs ersetzt: Ebenen, Eigenschaften, Design, Code.

## Tailwind CSS v4 JSX-Export

Der Code-Tab bietet einen Formatschalter zwischen **OpenPencil JSX** und **Tailwind CSS v4** (HTML mit Utility-Klassen). CLI: `bun open-pencil export --format jsx --style tailwind file.fig`

## Google Fonts Fallback

Wenn eine Schriftart lokal nicht verfügbar ist, lädt OpenPencil sie automatisch von der Google Fonts API.

## Homebrew-Tap

macOS-Nutzer können die Desktop-App über Homebrew installieren:

```sh
brew install open-pencil/tap/open-pencil
```

## Ebenen-Inline-Umbenennen

Doppelklick auf einen Ebenennamen zum Inline-Umbenennen. Enter oder Klick außerhalb bestätigt, Escape bricht ab.

## Renderer-Profiler

Ein HUD-Overlay zeigt Frame-Timing, GPU-Phasen und Frame-Budget. Zugänglich über das Ansichtsmenü.

## KI-Chat

Integrierter KI-Assistent über den KI-Tab oder <kbd>⌘</kbd><kbd>J</kbd>. Kommuniziert direkt mit OpenRouter. **78 Werkzeuge** für Lesen, Erstellen, Ändern und Organisieren von Design-Elementen. **MCP-Server** für externe KI-Coding-Tools.

## @open-pencil/core & CLI

Die Engine ist in `packages/core/` extrahiert. CLI bietet headless .fig-Dateioperationen:

- `open-pencil info <file>` — Dokumentstatistiken
- `open-pencil tree <file>` — visueller Knotenbaum
- `open-pencil find <file>` — Suche nach Name/Typ
- `open-pencil export <file>` — Rendern als PNG/JPG/WEBP
- `open-pencil eval <file>` — JavaScript mit Figma Plugin API ausführen

Alle Befehle unterstützen `--json` für maschinenlesbare Ausgabe.

## JSX-Renderer

Programmatische Design-Erstellung über TreeNode-Builder-Funktionen aus `@open-pencil/core`. Unterstützt Tailwind-ähnliche Kurzform-Props — `w`, `h`, `bg`, `rounded`, `flex`, `gap`, `p`/`px`/`py`.

## Code-Panel

Der Code-Tab im Eigenschafts-Panel zeigt die Code-Darstellung der aktuellen Auswahl mit Syntaxhervorhebung und einem Kopieren-Button. Ein Formatschalter wechselt zwischen OpenPencil JSX und Tailwind CSS v4.

## Codequalität

Copy-Paste-Erkennung via jscpd — projektweite Duplikation von 15,6% auf 0,62% reduziert.
