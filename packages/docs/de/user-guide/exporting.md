---
pageClass: guide
title: Exportieren
description: Ebenen als Bild, PDF oder Folien speichern oder in eine andere App kopieren.
---

# Exportieren

Speichere eine Ebene als Datei oder kopiere sie direkt in eine andere App. Wenn du später an einem Design weiterarbeiten willst, [speichere stattdessen das Dokument](./files).

## Eine Ebene exportieren

1. Wähle eine oder mehrere Ebenen aus. Ist nichts ausgewählt, exportierst du die Seite.
2. Klicke im Design-Panel neben **Export** auf **+**.
3. Wähle eine Größe und ein Format.
4. Klicke auf **Export**.

<GuideLegend>

<GuideImage name="exporting/panel" alt="Die Exporteinstellungen mit vier nummerierten Bedienelementen" />

1. **Exportmaßstab** legt die Bildgröße fest. Wähle einen Wert oder gib einen eigenen ein, etwa `2.5`.
2. **Exportformat** legt den Dateityp fest.
3. **Export** speichert jede Zeile als Datei. Mehrere Dateien kommen in einem ZIP.
4. **Vorschau** zeigt, was du bekommst.

</GuideLegend>

Brauchst du eine Ebene in mehreren Größen, klicke noch einmal auf **+**. Jede neue Zeile verdoppelt den Maßstab der vorherigen.

## Ein Format wählen

| Für | Format |
| --- | --- |
| Screenshots und Bilder mit Transparenz | PNG |
| Fotos, bei denen Transparenz keine Rolle spielt | JPG |
| Kleinere Bilder fürs Web | WEBP |
| Symbole und Grafiken, die in jeder Größe scharf bleiben | SVG |
| Seiten drucken und weitergeben | PDF |
| Präsentationen | PPTX |
| Diagramme | draw.io |

Der Maßstab gilt nur für PNG, JPG und WEBP.

**Datei → Auswahl exportieren…** speichert außerdem eine `.fig`-Datei, die nur die ausgewählten Ebenen enthält.

## In eine andere App kopieren

Klicke mit der rechten Maustaste auf eine Ebene und wähle **Kopieren/Einfügen als**.

<GuideLegend>

<GuideImage name="exporting/copy-as" other="exporting/copy-as-other" alt="Das Menü „Kopieren/Einfügen als“" />

- **Als PNG kopieren** ist für Chats und Dokumente gedacht. Drücke <Keys mac="⇧ ⌘ C" other="Ctrl Shift C" />.
- **Als SVG kopieren** ist für Code und Vektor-Editoren gedacht.
- **Als JSX kopieren** ist für Code gedacht.
- **Als Text kopieren** kopiert den Text einer Textebene.

</GuideLegend>
