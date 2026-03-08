# Figma-Funktionsmatrix

Feature-für-Feature-Vergleich der Figma-Design-Funktionen mit dem aktuellen Implementierungsstand von Open Pencil.

::: tip Statuslegende
✅ Unterstützt — Funktion funktioniert vollständig · 🟡 Teilweise — Grundverhalten vorhanden, einige Unterfunktionen fehlen · 🔲 Noch nicht implementiert
:::

**Abdeckung:** 94 von 158 Figma-Feature-Punkten adressiert — 76 ✅ vollständig unterstützt, 18 🟡 teilweise, 64 🔲 noch nicht. Zuletzt aktualisiert: 2026-03-07.

## Benutzeroberfläche & Navigation

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Werkzeugleiste mit Design-Tools | ✅ | Untere Leiste (UI3-Stil): Auswählen, Frame, Sektion, Rechteck, Ellipse, Linie, Text, Hand, Stift |
| Ebenen-Panel (linke Seitenleiste) | ✅ | Baumansicht mit Auf-/Zuklappen, Drag-Neuordnung, Sichtbarkeits-Toggle; skalierbare Breite |
| Seiten-Panel | ✅ | Seiten hinzufügen, löschen, umbenennen; Viewport-Zustand pro Seite |
| Eigenschafts-Panel (rechte Seitenleiste) | ✅ | Abschnitte: Darstellung, Füllung, Kontur, Effekte, Typografie, Layout, Position; skalierbare Breite |
| Zoom & Schwenken | ✅ | Strg+Scroll, Pinch, <kbd>⌘</kbd><kbd>+</kbd> / <kbd>⌘</kbd><kbd>−</kbd> / <kbd>⌘</kbd><kbd>0</kbd>, Leertaste+Ziehen, mittlere Maustaste, Hand-Werkzeug (H) |
| Canvas-Lineale | ✅ | Oben/links Lineale mit Auswahl-Bändern und Koordinaten-Badges |
| Canvas-Hintergrundfarbe | ✅ | Pro-Seite-Hintergrund über Eigenschafts-Panel |
| Canvas-Hilfslinien | 🔲 | Figma unterstützt ziehbare Hilfslinien von Linealen |
| Aktionsmenü / Befehlspalette | 🔲 | Figmas Schnellaktionssuche |
| Kontextmenü | ✅ | Rechtsklick mit Zwischenablage, Z-Ordnung, Gruppierung, Komponente, Sichtbarkeit, Sperre, Verschieben |
| Tastaturkürzel | 🟡 | Kern-Kürzel + Komponenten + Z-Ordnung + Sichtbarkeit/Sperre implementiert; Skalieren, Pfeil, Bleistift, Spiegeln, Textformatierung noch nicht verbunden |
| Suchen und Ersetzen | 🔲 | Textsuche/-ersetzung im gesamten Dokument |
| Ebenenumriss-Ansicht | 🔲 | Drahtgitteransicht aller Ebenen |
| Benutzerdefinierte Dateiminiatur | 🔲 | Miniatur beim Export generiert, aber kein benutzerdefinierter Auswähler |
| Nudge-Wert-Einstellungen | 🔲 | Standard 1px/10px; Figma erlaubt benutzerdefinierte Werte |
| App-Menü (Browser-Modus) | ✅ | Datei, Bearbeiten, Ansicht, Objekt, Text, Anordnen; Tauri verwendet native Menüs |
| KI-Werkzeuge | 🟡 | 90 Werkzeuge via OpenRouter + MCP-Server; noch keine KI-generierten Bilder oder KI-Suche |

## Ebenen & Formen

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Formwerkzeuge (Rechteck, Ellipse, Linie, Polygon, Stern) | ✅ | Alle Grundformtypen; Polygonseitenzahl und Stern-Innenradius konfigurierbar |
| Frames | ✅ | Inhalt beschneiden, unabhängiges Koordinatensystem |
| Gruppen | ✅ | <kbd>⌘</kbd><kbd>G</kbd> zum Gruppieren, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd> zum Entgruppieren |
| Sektionen | ✅ | Titel-Pills, automatische Übernahme überlappender Knoten, luminanzadaptiver Text |
| Bogen-Werkzeug (Bögen, Halbkreise, Ringe) | ✅ | arcData mit Start-/Endwinkel und Innenradius |
| Bleistift (Freihand-Werkzeug) | 🔲 | Figmas Freihand-Zeichenwerkzeug |
| Masken | 🔲 | Formmasken zum Beschneiden von Ebenen |
| Ebenentypen & Hierarchie | ✅ | 17 Knotentypen, flache Map + Eltern-Kind-Baum |
| Ebenen auswählen | ✅ | Klick, Umschalt-Klick, Markierungsauswahl |
| Ausrichtung & Position | ✅ | Position, Drehung, Abmessungen im Panel |
| Objekte kopieren & einfügen | ✅ | Standard-Zwischenablage + Figma-Kiwi-Binärformat |
| Ebenen proportional skalieren | 🟡 | Umschalt-Resize hält Proportionen; kein dediziertes Scale-Werkzeug (K) |
| Ebenen sperren/entsperren | ✅ | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> schaltet Sperre um |
| Ebenensichtbarkeit umschalten | ✅ | Augen-Icon im Panel + <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd>-Kürzel |
| Ebenen umbenennen | ✅ | Doppelklick-Inline-Umbenennen; <kbd>Enter</kbd>/<kbd>Escape</kbd>/Blur zum Bestätigen |
| Nach vorne / Nach hinten | ✅ | ] und [ Tastaturkürzel; auch im Kontextmenü |
| Auf Seite verschieben | ✅ | Knoten zwischen Seiten verschieben via Kontextmenü |
| Einschränkungen (responsives Resize) | 🔲 | Kanten/Mitte fixieren für Eltern-Resize-Verhalten |
| Intelligente Auswahl (verteilen/ausrichten) | 🔲 | Gleichmäßig verteilen und ausrichten |
| Layout-Hilfslinien (Spalten, Zeilen, Raster) | 🔲 | Spalten-/Zeilen-/Raster-Hilfslinien auf Frames |
| Abstände zwischen Ebenen messen | 🔲 | Alt-Hover zeigt Abstände |
| Objekte in Masse bearbeiten | ✅ | Multi-Selektion-Panel: gemeinsame Werte normal, unterschiedliche zeigen „Mixed" |
| Übereinstimmende Objekte identifizieren | 🔲 | Ähnliche Ebenen finden |
| Eigenschaften kopieren/einfügen | 🔲 | Füllung/Kontur/Effekte zwischen Ebenen kopieren |
| Eltern-Kind-Beziehungen | ✅ | Vollständige Hierarchie mit parentIndex, Drag-Reparenting |

## Vektor-Werkzeuge

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Vektornetzwerke | ✅ | Figma-kompatibles Modell, keine einfachen Pfade |
| Stift-Werkzeug | ✅ | Eckpunkte, Bézier-Kurven, offene/geschlossene Pfade |
| Vektorebenen bearbeiten | 🟡 | Erstellung funktioniert; fortgeschrittene Vertex-Bearbeitung begrenzt |
| Boolesche Operationen (Vereinigen, Subtrahieren, Schneiden, Ausschließen) | 🔲 | Formen mit Bool-Operationen kombinieren |
| Ebenen abflachen | 🔲 | Vektorpfade zusammenführen |
| Konturen in Pfade umwandeln | 🔲 | Outline-Stroke-Befehl |
| Text in Pfade umwandeln | 🔲 | Text zu Vektorkonturen abflachen |
| Shape-Builder-Werkzeug | 🔲 | Interaktives Bool-Werkzeug |
| Pfad-Offset | 🔲 | Inset/Outset eines Vektorpfads |
| Pfad vereinfachen | 🔲 | Vektorpunktanzahl reduzieren |

## Text & Typografie

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Textwerkzeug & Inline-Bearbeitung | ✅ | Canvas-native Bearbeitung, Phantom-Textarea, Style-Runs (<kbd>⌘</kbd><kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd>, S-Button) |
| Textrendering (Paragraph API) | ✅ | CanvasKit Paragraph für Formgebung, Zeilenumbrüche, Metriken |
| Schriftladung (Systemschriften) | ✅ | Inter Standard, font-kit in Tauri mit OnceLock-Cache, queryLocalFonts im Browser |
| Schriftfamilie & -stärke | ✅ | FontPicker mit virtuellem Scrollen, Suche, CSS-Vorschau |
| Schriftgröße & Zeilenhöhe | ✅ | Bearbeitbar im Typografie-Abschnitt |
| Textausrichtung | 🟡 | Grundausrichtung; Figma hat vertikale Ausrichtung und Auto-Breite/-Höhe-Modi |
| Textstile | 🟡 | Fett/Kursiv/Unterstrichen/Durchgestrichen pro Auswahl; noch keine wiederverwendbaren benannten Stil-Presets |
| Text-Resize-Modi | 🔲 | Figmas Auto-Breite, Auto-Höhe, Fixgröße-Modi |
| Aufzählungs- & nummerierte Listen | 🔲 | Listenformatierung im Text |
| Links im Text | 🔲 | Hyperlinks innerhalb von Textinhalten |
| Emojis & intelligente Symbole | 🔲 | Emoji-Rendering und Sonderzeichen |
| OpenType-Funktionen | 🔲 | Ligaturen, stilistische Alternativen, Tabellenziffern |
| Variable Schriften | 🔲 | Einstellbare Schriftachsen (Stärke, Breite, Neigung) |
| CJK-Textunterstützung | 🔲 | Chinesisches, japanisches, koreanisches Textrendering |
| RTL-Textunterstützung | 🔲 | Rechts-nach-links-Textlayout |
| Icon-Schriften | 🔲 | Spezielle Behandlung für Icon-Schrift-Glyphen |

## Farbe, Verläufe & Bilder

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Farbauswahl (HSV) | ✅ | HSV-Quadrat, Farbton-Regler, Alpha-Regler, Hex-Eingabe |
| Einfarbige Füllungen | ✅ | Hex-Farbe mit Deckkraft |
| Linearer Verlauf | ✅ | Verlaufsstopps, Transformationsgriffe |
| Radialer Verlauf | ✅ | Gerendert über CanvasKit-Shader |
| Winkel-Verlauf | ✅ | Sweep-/konischer Verlauf |
| Diamant-Verlauf | ✅ | Vierpunkt-Diamant-Verlauf |
| Bildfüllungen | ✅ | Aus Blob-Daten dekodiert mit Skalierungsmodi (Füllen, Anpassen, Beschneiden, Kacheln) |
| Musterfüllungen | 🔲 | Sich wiederholende Bild-/Musterfüllungen |
| Mischmodi | 🔲 | Ebenen- und Füllungs-Mischmodi (Multiplizieren, Negativ Multiplizieren, Überlagern usw.) |
| Bilder & Videos hinzufügen | 🟡 | Bildfüllungen gerendert; kein Drag-and-Drop-Import oder Video-Unterstützung |
| Bild-Eigenschaftsanpassung | 🔲 | Belichtung, Kontrast, Sättigung usw. |
| Bild zuschneiden | 🔲 | Interaktives Bildzuschneiden |
| Pipetten-Werkzeug | 🔲 | Farben vom Canvas aufnehmen |
| Farbbearbeitung bei gemischter Auswahl | 🔲 | Farben in heterogener Auswahl anpassen |
| Farbmodelle (RGB, HSL, HSB, Hex) | 🟡 | HSV + Hex im Picker; kein HSL- oder RGB-Modus-Umschalter |

## Effekte & Eigenschaften

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Schlagschatten | ✅ | Versatz, Unschärferadius, Farbe über CanvasKit-Filter |
| Innerer Schatten | ✅ | Eingefügter Schatteneffekt |
| Ebenen-Unschärfe | ✅ | Gaußsche Unschärfe auf der Ebene |
| Hintergrund-Unschärfe | ✅ | Inhalt hinter der Ebene unscharf |
| Vordergrund-Unschärfe | ✅ | Unschärfe im Vordergrund |
| Konturstärke | ✅ | Konfigurierbar im Eigenschafts-Panel |
| Kontur-Endung (Rund, Quadrat, Pfeil) | ✅ | `NONE`, `ROUND`, `SQUARE`, `ARROW_LINES`, `ARROW_EQUILATERAL` |
| Kontur-Verbindung (Gehrung, Abschrägung, Rund) | ✅ | Alle drei Verbindungstypen |
| Strichmuster | ✅ | Strich-An/Strich-Aus-Muster |
| Eckenradius | ✅ | Einheitlicher und pro-Ecke-Radius mit unabhängigem Toggle |
| Eckenglättung (iOS-Stil) | 🔲 | Figmas kontinuierliche Eckenabrundung |
| Mehrere Füllungen/Konturen pro Ebene | 🔲 | Figma erlaubt gestapelte Füllungen und Konturen |

## Auto Layout

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Horizontaler & vertikaler Fluss | ✅ | Yoga-WASM-Flexbox-Engine |
| Auto Layout umschalten (<kbd>⇧</kbd><kbd>A</kbd>) | ✅ | Auf Frame umschalten oder Auswahl umhüllen |
| Gap (Abstand zwischen Kindern) | ✅ | Konfigurierbar im Panel |
| Padding (einheitlich & pro Seite) | ✅ | Alle vier Seiten unabhängig |
| Justify Content | ✅ | Start, Center, <kbd>End</kbd>, Space-Between |
| Align Items | ✅ | Start, Center, <kbd>End</kbd>, Stretch |
| Kindgröße (fix, füllen, anpassen) | ✅ | Größenmodi pro Kind |
| Wrap | ✅ | Flex-Wrap für mehrzeiliges Layout |
| Grid-Auto-Layout-Fluss | ✅ | CSS Grid über Yoga-Fork — Spalten-/Zeilen-Tracks, Gaps, Spans |
| Kombinierte Flüsse (verschachtelt) | ✅ | Verschachtelte Auto-Layout-Frames mit verschiedenen Richtungen |
| Drag-Neuordnung in Auto Layout | ✅ | Visueller Einfügeindikator |
| Min/Max Breite und Höhe | 🔲 | Figma unterstützt Min/Max-Einschränkungen |

## Komponenten & Design-Systeme

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Komponenten erstellen | 🟡 | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> erstellt aus Frame/Gruppe; noch kein Komponenten-Eigenschafts-UI |
| Komponenten-Sets | 🟡 | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> kombiniert Komponenten; gestrichelter violetter Rand; keine Varianten-Eigenschaftsbearbeitung |
| Komponenteninstanzen | 🟡 | Instanz aus Kontextmenü erstellen; Live-Sync; kein Override-Bearbeitungs-UI |
| Varianten | 🔲 | Variantenwechsel und eigenschaftsbasierte Auswahl |
| Komponenteneigenschaften | 🔲 | Boolesche, Text-, Instanztausch-Eigenschaften |
| Override-Propagation | ✅ | Änderungen an Hauptkomponente werden propagiert; Overrides erhalten |
| Variablen (Farbe, Zahl, String, Boolean) | 🟡 | `COLOR` mit vollem UI; `FLOAT`/STRING/BOOLEAN definiert ohne Bearbeitungs-UI |
| Variablensammlungen & Modi | 🟡 | Sammlungen, Modi, activeMode-Wechsel funktionieren; kein Variablen-Theming-UI |
| Stile (Farbe, Text, Effekt, Layout) | 🔲 | Wiederverwendbare benannte Stil-Presets |
| Bibliotheken (veröffentlichen, teilen, aktualisieren) | 🔲 | Geteilte Komponenten-/Stil-Bibliotheken |
| Instanz ablösen | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> wandelt Instanz in Frame um |
| Zur Hauptkomponente navigieren | ✅ | Zur Quellkomponente navigieren, seitenübergreifend |

## Prototyping

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Prototyp-Verbindungen | 🔲 | Geplant für Phase 6 |
| Auslöser (Klick, Hover, Ziehen usw.) | 🔲 | Geplant für Phase 6 |
| Aktionen (Navigieren, Overlay, Scroll usw.) | 🔲 | Geplant für Phase 6 |
| Animationen & Übergänge | 🔲 | Geplant für Phase 6 |
| Smart Animate | 🔲 | Übereinstimmende Ebenen automatisch animieren |
| Overlays | 🔲 | Modale/Popover-Prototypen |
| Scroll- & Overflow-Verhalten | 🔲 | Scrollbare Frames in Prototypen |
| Prototyp-Flüsse | 🔲 | Benannte Startpunkte |
| Variablen in Prototypen | 🔲 | Bedingte Logik mit Variablen |
| Easing & Feder-Animationen | 🔲 | Benutzerdefinierte Animationskurven |
| Prototypen präsentieren & abspielen | 🔲 | Vollbild-Prototyp-Viewer |

## Import & Export

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| .fig-Datei-Import | ✅ | Vollständiger Kiwi-Codec: 194 Definitionen, ~390 Felder pro `NodeChange` |
| .fig-Datei-Export | ✅ | Kiwi-Encoding + Zstd-Kompression + Miniatur-Generierung |
| Speichern / Speichern unter | ✅ | <kbd>⌘</kbd><kbd>S</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>; native Dialoge (Tauri), File System Access API (Chrome/Edge), Download-Fallback (Safari) |
| Figma-Zwischenablage (Einfügen) | ✅ | Kiwi-Binär aus Figma-Zwischenablage dekodieren |
| Figma-Zwischenablage (Kopieren) | ✅ | Kiwi-Binär kodieren, das Figma lesen kann |
| Sketch-Datei-Import | 🔲 | .sketch-Datei-Parsing |
| Bild/SVG/PDF-Export | 🟡 | PNG/JPG/WEBP/SVG-Export ✅; PDF-Export 🔲 |
| Versionsverlauf | 🔲 | Vorherige Versionen durchsuchen und wiederherstellen |
| Assets zwischen Tools kopieren | 🟡 | Figma-Zwischenablage funktioniert; kein SVG/PDF-Clipboard |

## Plugin-API & Scripting

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Eval-Befehl mit Figma Plugin API | ✅ | Headless-JavaScript-Ausführung mit kompatiblem figma-Globalobjekt |

## Kollaboration & Entwicklermodus

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Kommentare (Anheften, Threads, Auflösen) | 🔲 | Geplant für Phase 6 |
| Echtzeit-Multiplayer | ✅ | P2P via Trystero + Yjs CRDT, Cursor, Folgemodus; kein Server |
| Cursor-Chat | 🔲 | Inline-Chat-Blasen am Cursor |
| Branching & Merging | 🔲 | Versions-Branches für Design-Dateien |
| Entwicklermodus (Inspizieren) | 🟡 | Code-<kbd>Tab</kbd> zeigt JSX; keine CSS-Eigenschaften oder Handoff-Specs |
| Code Connect | 🔲 | Design-Komponenten mit Code verknüpfen |
| Code-Snippets | 🟡 | JSX-Export mit Hervorhebung und Kopieren; keine CSS/Swift/Kotlin-Snippets |
| Figma für VS Code | 🔲 | Editor-Plugin-Integration |
| MCP-Server | ✅ | @open-pencil/mcp mit stdio + HTTP-Transporten; 87 Kern-Werkzeuge + 3 Dateiverwaltung = 90 gesamt |
| CLI-Werkzeuge | ✅ | Headless-CLI: info, tree, find, export, analyze, node, pages, variables, eval; MCP-Server |

## Figma Draw

| Funktion | Status | Anmerkungen |
|----------|--------|-------------|
| Illustrations-Werkzeuge | 🔲 | Spezialisierte Zeichenwerkzeuge von Figma Draw |
| Muster-Transformationen | 🔲 | Sich wiederholende Muster mit Transformationen erstellen |
