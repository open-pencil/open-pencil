# Figma-Kompatibilität

Vergleich der Funktionen von Figma Design mit dem aktuellen Stand von OpenPencil.

::: tip Status
✅ Unterstützt — funktioniert vollständig · 🟡 Teilweise — Grundfunktion vorhanden, einzelne Teile fehlen · 🔲 Nicht umgesetzt
:::

**Abdeckung:** 128 von 156 Funktionen berücksichtigt — 112 ✅ vollständig, 16 🟡 teilweise und 28 🔲 nicht umgesetzt. Stand: 2026-10-27.

## Oberfläche und Navigation

| Funktion | Status | Hinweise |
|----------|--------|----------|
| Werkzeugleiste | ✅ | Untere Leiste im UI3-Stil: Verschieben, Rahmen/Sektion, Formen, Zeichenstift/Bleistift, Text, Hand und Kommentar; anpassbar, mit Symbolauswahl |
| Ebenen-Panel | ✅ | Baum mit Auf-/Zuklappen, Ziehen, Sichtbarkeit und einstellbarer Breite |
| Seiten-Panel | ✅ | Erstellen, Löschen, Umbenennen und eigener Ansichtszustand |
| Eigenschaften-Panel | ✅ | Darstellung, Füllung, Kontur, Effekte, Typografie, Anordnung, Layoutraster, Einschränkungen, Position, Maske, Komponenteneigenschaften, Auswahlfarben und Export; einstellbare Breite |
| Zoom und Verschieben | ✅ | Mausrad, Zwei-Finger-Zoom, Tastenkürzel, mittlere Maustaste und Handwerkzeug |
| Lineale | ✅ | Lineale mit Auswahlbereich und Koordinaten |
| Hintergrund | ✅ | Eigene Farbe pro Seite |
| Hilfslinien | ✅ | Aus den Linealen auf die Arbeitsfläche oder in Rahmen ziehen; auswählen, verschieben, duplizieren, löschen und rückgängig machen; in `.fig` gespeichert |
| Befehlspalette | ✅ | <kbd>⌘</kbd><kbd>K</kbd> öffnet eine durchsuchbare Liste der Editor- und App-Aktionen |
| Kontextmenü | ✅ | Zwischenablage, Reihenfolge, Gruppen, Komponenten, Sichtbarkeit, Sperre und Seitenwechsel |
| Tastenkürzel | 🟡 | Werkzeuge, Bearbeitung, boolesche Operationen, Abflachen, Masken, Komponenten, Ausrichtung, Reihenfolge, Navigation und Textformatierung; kein Skalieren (<kbd>K</kbd>), Pfeil, Pipette (<kbd>I</kbd>) oder Zoomwerkzeug |
| Suchen und Ersetzen | 🔲 | Keine dokumentweite Textsuche |
| Ebenenkonturen | 🔲 | Keine Drahtgitteransicht |
| Eigene Miniatur | 🔲 | Gespeicherte Dateien zeigen ihre erste Seite, wie Figma ohne Cover-Seite; keine eigene Auswahl |
| Schrittweite | 🔲 | 1 px und 10 px, keine eigenen Werte |
| Anwendungsmenü | ✅ | Browsermenü und native Tauri-Menüs |
| AI-Werkzeuge | 🟡 | 126 Werkzeuge im AI-Chat, für Coding-Agents (ACP) und über MCP; Stockfotos und Bildvektorisierung; keine Bilderzeugung oder AI-Suche |

## Ebenen und Formen

| Funktion | Status | Hinweise |
|----------|--------|----------|
| Grundformen | ✅ | Rechteck, Ellipse, Linie, Polygon und Stern |
| Rahmen | ✅ | Beschnitt, eigenes Koordinatensystem und Größenvorlagen |
| Gruppen | ✅ | Gruppieren und Aufheben |
| Sektionen | ✅ | Beschriftung und automatische Übernahme überlappender Objekte |
| Bögen | ✅ | Start-/Endwinkel und Innenradius |
| Masken | ✅ | Als Maske verwenden (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>M</kbd>); Alpha-, Vektor- und Luminanzmasken im Abschnitt Maske |
| Hierarchie | ✅ | 19 Objekttypen und Eltern-Kind-Baum |
| Auswahl | ✅ | Klick, Shift-Klick und Rahmenauswahl |
| Ausrichtung und Position | ✅ | Position, Drehung und Maße |
| Kopieren und Einfügen | ✅ | Standardzwischenablage, Figma-Kiwi und Kopieren als Text/SVG/PNG/JSX |
| Proportionale Größenänderung | 🟡 | Shift und die Seitenverhältnissperre erhalten Proportionen; kein Skalierungswerkzeug (<kbd>K</kbd>), das Konturen, Effekte und Text mitskaliert |
| Sperre und Sichtbarkeit | ✅ | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> und <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> sowie Ebenen-Panel |
| Umbenennen | ✅ | Direkt im Ebenen-Panel |
| Vorder-/Hintergrund | ✅ | Tastenkürzel und Kontextmenü |
| Seite wechseln | ✅ | Auswahl zwischen Seiten verschieben |
| Einschränkungen | ✅ | Links, rechts, Mitte, Strecken und Skalieren je Achse im Abschnitt Einschränkungen; greifen bei Größenänderung des Elternobjekts, auch in Instanzen |
| Intelligente Auswahl | 🟡 | Ausrichten und Verteilen über Panel und Menü Anordnen; keine Abstandsgriffe der intelligenten Auswahl und kein Aufräumen |
| Anordnungshilfen | ✅ | Raster, Spalten und Zeilen in Rahmen mit Anzahl, Typ, Rand, Spaltenabstand und Farbe; Rasterstile; mehrere Rahmen gleichzeitig |
| Abstände messen | ✅ | <kbd>⌥</kbd> halten und überfahren zeigt Abstände zur Auswahl |
| Mehrfachbearbeitung | ✅ | Gemeinsame Eigenschaften und `Mixed` bei Abweichungen |
| Ähnliche Objekte | 🔲 | Keine Suche |
| Eigenschaften kopieren | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>C</kbd> / <kbd>⌥</kbd><kbd>⌘</kbd><kbd>V</kbd> über die Systemzwischenablage, auch von und nach Figma: Füllungen, Konturen, Effekte, Ecken, Stile, Variablen, Auto Layout zwischen Rahmen und Textstil zwischen Textebenen |
| Eltern-Kind-Beziehungen | ✅ | Vollständige Hierarchie und Neuordnung durch Ziehen |

## Vektoren

Vektornetze, Zeichenstift, Bleistift, boolesche Operationen (bleiben als boolesche Ebenen bearbeitbar), Abflachen sowie die Umwandlung von Konturen und Text in Pfade werden unterstützt. Die Punktbearbeitung ist teilweise verfügbar: Punkte, Griffe, Segmente und Flächen lassen sich auswählen und ziehen, Pfade biegen, auftrennen und verlängern, aber Spiegelung und Eckeinstellungen je Punkt fehlen. Formerstellungswerkzeug, Pfadversatz und Vereinfachung fehlen noch.

## Text und Typografie

Direkte Textbearbeitung, CanvasKit Paragraph, Systemschriften, Schriftwahl, Größe, Zeilenhöhe, horizontale und vertikale Ausrichtung, automatische Textgrößen (Auto width, Auto height, Fixed size), verschachtelte Aufzählungen und nummerierte Listen, Emojis, CJK mit sprachabhängigen Ersatzschriften, RTL mit arabischer Formung und Symbolschriften (Material Symbols, Iconify, SF Symbols ab macOS 14) werden unterstützt. Teilweise umgesetzt sind Text auf Pfaden, Textstile (benannte Stile lassen sich anwenden, aber nicht erstellen oder bearbeiten), Links (bleiben erhalten, lassen sich im Panel aber nicht hinzufügen), OpenType-Funktionen (alle werden dargestellt, das Panel schaltet nur Ligaturen, kontextuelle Alternativen und Unterschneidung). Variable Schriften werden unterstützt: Achsen lassen sich im Panel und über die Plugin API setzen.

## Farben, Verläufe und Bilder

Volltonfarben, lineare, radiale, Winkel- und Diamantverläufe, Bildfüllungen, Mischmodi, Auswahlfarben für Mehrfachauswahlen sowie Hex-, RGB-, HSL-, HSB- und OkHCL-Felder werden unterstützt. Teilweise umgesetzt sind Musterfüllungen (aus Figma importierte werden dargestellt, lassen sich aber nicht erstellen), das Hinzufügen von Bildern (Ablegen oder Einfügen, kein Video) und Zuschnitt (Modus Crop, keine Griffe auf der Arbeitsfläche). Bildkorrekturen und Pipette fehlen.

## Effekte und Eigenschaften

Schatten, Ebenen-/Hintergrund-/Vordergrundunschärfe, Konturstärke, Enden, Verbindungen, Strichelung, Konturausrichtung, Eckenradien, Eckenglättung sowie beliebig viele Füllungen und Konturen werden unterstützt.

## Automatische Anordnung

Flexbox, Grid, Richtung, Abstand, Innenabstand, Ausrichtung, Größenmodi, Umbruch, verschachtelte Anordnungen, Neuordnung durch Ziehen sowie Mindest- und Höchstmaße werden unterstützt.

## Komponenten und Designsysteme

Komponenten, Sätze, Instanzen, Varianten, Eigenschaften einschließlich Slots, Überschreibungen, alle vier Variablentypen mit Sammlungen und Modi sowie Bibliotheken werden unterstützt. Stile sind teilweise umgesetzt: Sie lassen sich aus `.fig`, Bibliotheken und Design-Tokens anwenden und lösen, aber nicht erstellen oder bearbeiten.

## Prototypen

Verbindungen, Auslöser, Aktionen, Animationen, Overlays, Scrollverhalten, Abläufe und Präsentationsmodus sind noch nicht umgesetzt.

## Import und Export

`.fig`-Import/-Export, Speichern, Figma-Zwischenablage sowie Export als Bild, SVG, PDF, PPTX und draw.io funktionieren. Der Versionsverlauf ist teilweise umgesetzt und nur für Dokumente in OpenPencil Cloud (Vorschau) verfügbar, nicht für lokale Dateien. Sketch-Import fehlt.

## Plugin API, Zusammenarbeit und Entwicklermodus

`eval`, Kommentare, P2P-Zusammenarbeit mit Sprachanrufen, Tailwind-Export, MCP-Server und CLI sind verfügbar. Teilweise umgesetzt sind Entwicklermodus und Code-Snippets: Der Code-Tab zeigt Design-JSX, HTML, Vue oder React mit CSS oder Tailwind, dazu Ready-for-dev-Status; ein Inspektionsmodus mit Maßlinien sowie Swift, Kotlin und Compose fehlen. Cursor-Chat, Code Connect, Verzweigung und Figma for VS Code fehlen.

## Figma Draw

Spezialisierte Illustrationswerkzeuge und Mustertransformationen sind noch nicht umgesetzt.
