# Figma-Kompatibilität

Vergleich der Funktionen von Figma Design mit dem aktuellen Stand von OpenPencil.

::: tip Status
✅ Unterstützt — funktioniert vollständig · 🟡 Teilweise — Grundfunktion vorhanden, einzelne Teile fehlen · 🔲 Nicht umgesetzt
:::

**Abdeckung:** 94 von 158 Funktionen berücksichtigt — 76 ✅ vollständig, 18 🟡 teilweise und 64 🔲 nicht umgesetzt. Stand: 2026-03-07.

## Oberfläche und Navigation

| Funktion | Status | Hinweise |
|----------|--------|----------|
| Werkzeugleiste | ✅ | Untere Leiste im UI3-Stil |
| Ebenen-Panel | ✅ | Baum mit Auf-/Zuklappen, Ziehen, Sichtbarkeit und einstellbarer Breite |
| Seiten-Panel | ✅ | Erstellen, Löschen, Umbenennen und eigener Ansichtszustand |
| Eigenschaften-Panel | ✅ | Darstellung, Füllung, Kontur, Effekte, Typografie, Anordnung und Position |
| Zoom und Verschieben | ✅ | Mausrad, Zwei-Finger-Zoom, Tastenkürzel, mittlere Maustaste und Handwerkzeug |
| Lineale | ✅ | Lineale mit Auswahlbereich und Koordinaten |
| Hintergrund | ✅ | Eigene Farbe pro Seite |
| Hilfslinien | 🔲 | Keine aus Linealen ziehbaren Hilfslinien |
| Befehlspalette | 🔲 | Keine Schnellsuche nach Aktionen |
| Kontextmenü | ✅ | Zwischenablage, Reihenfolge, Gruppen, Komponenten, Sichtbarkeit, Sperre und Seitenwechsel |
| Tastenkürzel | 🟡 | Zentrale Befehle vorhanden; einige Werkzeuge und Textformatierungen fehlen |
| Suchen und Ersetzen | 🔲 | Keine dokumentweite Textsuche |
| Ebenenkonturen | 🔲 | Keine Drahtgitteransicht |
| Eigene Miniatur | 🔲 | Wird erzeugt, kann aber nicht gewählt werden |
| Schrittweite | 🔲 | 1 px und 10 px, keine eigenen Werte |
| Anwendungsmenü | ✅ | Browsermenü und native Tauri-Menüs |
| AI-Werkzeuge | 🟡 | 90 Werkzeuge; keine Bilderzeugung oder AI-Suche |

## Ebenen und Formen

| Funktion | Status | Hinweise |
|----------|--------|----------|
| Grundformen | ✅ | Rechteck, Ellipse, Linie, Polygon und Stern |
| Rahmen | ✅ | Beschnitt, eigenes Koordinatensystem und Größenvorlagen |
| Gruppen | ✅ | Gruppieren und Aufheben |
| Sektionen | ✅ | Beschriftung und automatische Übernahme überlappender Objekte |
| Bögen | ✅ | Start-/Endwinkel und Innenradius |
| Bleistift | 🔲 | Kein Freihandwerkzeug |
| Masken | 🔲 | Keine Formmasken |
| Hierarchie | ✅ | 17 Objekttypen und Eltern-Kind-Baum |
| Auswahl | ✅ | Klick, Shift-Klick und Rahmenauswahl |
| Ausrichtung und Position | ✅ | Position, Drehung und Maße |
| Kopieren und Einfügen | ✅ | Standardzwischenablage, Figma-Kiwi und Kopieren als Text/SVG/PNG/JSX |
| Proportionale Größenänderung | 🟡 | Shift erhält Proportionen; kein eigenes Skalierungswerkzeug |
| Sperre und Sichtbarkeit | ✅ | Tastenkürzel und Ebenen-Panel |
| Umbenennen | ✅ | Direkt im Ebenen-Panel |
| Vorder-/Hintergrund | ✅ | Tastenkürzel und Kontextmenü |
| Seite wechseln | ✅ | Auswahl zwischen Seiten verschieben |
| Einschränkungen | 🔲 | Kein Anheften an Kanten oder Mitte |
| Intelligente Auswahl | 🔲 | Keine gleichmäßige Verteilung |
| Anordnungshilfen | 🔲 | Keine Spalten-/Zeilenraster |
| Abstände messen | 🔲 | Keine Alt-Anzeige |
| Mehrfachbearbeitung | ✅ | Gemeinsame Eigenschaften und `Mixed` bei Abweichungen |
| Ähnliche Objekte | 🔲 | Keine Suche |
| Eigenschaften kopieren | 🔲 | Keine Übertragung von Füllung, Kontur und Effekten |
| Eltern-Kind-Beziehungen | ✅ | Vollständige Hierarchie und Neuordnung durch Ziehen |

## Vektoren

Vektornetze und Zeichenstift werden unterstützt. Fortgeschrittene Punktbearbeitung ist teilweise verfügbar. Boolesche Operationen, Abflachen, Kontur- und Textumwandlung, Pfadversatz und Vereinfachung fehlen noch.

## Text und Typografie

Direkte Textbearbeitung, CanvasKit Paragraph, Systemschriften, Schriftwahl, Größe, Zeilenhöhe und grundlegende Ausrichtung werden unterstützt. Vertikale Ausrichtung, automatische Textgrößen, Listen, Links, OpenType-Funktionen, variable Schriften, vollständiges CJK/RTL und Symbolschriften fehlen oder sind teilweise umgesetzt.

## Farben, Verläufe und Bilder

Volltonfarben, lineare, radiale, Winkel- und Diamantverläufe sowie Bildfüllungen werden unterstützt. Muster, Mischmodi, Video, Bildkorrekturen, interaktiver Zuschnitt, Pipette und gemeinsame Farbbearbeitung fehlen.

## Effekte und Eigenschaften

Schatten, Ebenen-/Hintergrund-/Vordergrundunschärfe, Konturstärke, Enden, Verbindungen, Strichelung, Konturausrichtung und Eckenradien werden unterstützt. Kontinuierliche Ecken und mehrere Füllungen/Konturen fehlen.

## Automatische Anordnung

Flexbox, Grid, Richtung, Abstand, Innenabstand, Ausrichtung, Größenmodi, Umbruch, verschachtelte Anordnungen und Neuordnung durch Ziehen werden unterstützt. Mindest- und Höchstmaße fehlen.

## Komponenten und Designsysteme

Komponenten, Sätze, Instanzen, Varianten, Eigenschaften, Überschreibungen, Variablen und Bibliotheken werden unterstützt. Benannte Stile fehlen; einige Variablentypen besitzen noch keine vollständige Bearbeitungsoberfläche.

## Prototypen

Verbindungen, Auslöser, Aktionen, Animationen, Overlays, Scrollverhalten, Abläufe und Präsentationsmodus sind noch nicht umgesetzt.

## Import und Export

`.fig`-Import/-Export, Speichern, Figma-Zwischenablage und Bild-/SVG-Export funktionieren. Sketch-Import, PDF-Export und Versionsverlauf fehlen.

## Plugin API, Zusammenarbeit und Entwicklermodus

`eval`, P2P-Zusammenarbeit, JSX-Codeansicht, Tailwind-Export, MCP-Server und CLI sind verfügbar. Kommentare, Code Connect, Verzweigung und vollständige Übergabespezifikationen fehlen.

## Figma Draw

Spezialisierte Illustrationswerkzeuge und Mustertransformationen sind noch nicht umgesetzt.
