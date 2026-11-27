---
pageClass: guide
title: Eine responsive Karte bauen
description: "Ein erstes Projekt in OpenPencil, Schritt für Schritt: eine Produktkarte, deren Text umbricht und deren Höhe bei jeder Breite dem Inhalt folgt."
---

# Eine responsive Karte bauen

In diesem Projekt baust du eine Produktkarte, die sich anpasst: Machst du sie schmaler oder breiter, streckt sich ihr Foto, ihr Text bricht um und ihre Höhe zieht mit. Das dauert etwa zehn Minuten und nutzt die Werkzeuge, die du am häufigsten brauchst.

<GuidePair>

<GuideImage name="responsive-card/narrow" alt="Die fertige Karte mit 240 Breite, die Beschreibung auf drei Zeilen" caption="240 breit" />
<GuideImage name="responsive-card/wide" alt="Dieselbe Karte mit 420 Breite, die Beschreibung auf zwei Zeilen" caption="420 breit" />

</GuidePair>

## 1. Die Teile hinzufügen

Beginne mit einer neuen Datei: **Datei → Neues Design** oder <Keys mac="⌘ N" other="Ctrl N" />.

1. Drücke <Keys mac="R" other="R" /> und zieh ein Rechteck auf, etwa 280 breit und 160 hoch. Es nimmt das Foto auf.
2. Drücke <Keys mac="T" other="T" />, klicke unter das Rechteck und tippe den Namen ein: *Ceramic mug*. Drücke <Keys mac="Esc" other="Esc" />.
3. Füge darunter auf dieselbe Weise zwei weitere Texte hinzu: eine Beschreibung, etwa *Hand-thrown in small batches, and keeps your coffee warm for longer*, und *Add to cart*.

Halte die vier Teile in einer Spalte, die linken Kanten ungefähr bündig.

<GuideImage name="responsive-card/parts" alt="Ein Rechteck und drei Texte in einer lockeren Spalte auf der Arbeitsfläche" />

## 2. Die Teile in eine Karte packen

1. Drücke <Keys mac="⌘ A" other="Ctrl A" />, um alle vier Teile auszuwählen.
2. Drücke <Keys mac="⇧ A" other="Shift A" />. Sie landen in einem neuen Rahmen mit [Auto-Layout](./auto-layout), das sie nacheinander anordnet.
3. Sind die Teile in einer Zeile gelandet, wähle im Design-Panel unter **Fluss** den Spalten-Button, **Vertikales Layout**.
4. Setze den Abstand zwischen den Teilen auf **12** und den Innenabstand auf **20**.
5. Klicke neben **Füllung** auf **+**, um der Karte einen Hintergrund zu geben, und setze **Radius** auf **16**.
6. Doppelklicke in der Ebenenliste auf den Namen des Rahmens und nenne ihn *Card*.

## 3. Die Teile strecken lassen

1. Setze **W** der Karte auf **320**.
2. Wähle das Rechteck aus. Öffne das Menü in seinem Feld **W** und wähle **Füllen**: Es übernimmt die Breite der Karte, innerhalb des Innenabstands.
3. Mach dasselbe mit dem Namen und der Beschreibung. Die Beschreibung bricht in neue Zeilen um, statt über den Rand der Karte hinauszulaufen.

Die Höhe der Karte folgt ihrem Inhalt von selbst. Probier es jetzt aus: Zieh den rechten Rand der Karte oder gib einen anderen Wert für **W** ein. Das Foto streckt sich, die Beschreibung bricht um, und die Karte wächst oder schrumpft passend.

## 4. Einen Button bauen

1. Wähle *Add to cart* aus und drücke <Keys mac="⇧ A" other="Shift A" />. Der Text kommt in einen eigenen Rahmen.
2. Gib diesem Rahmen eine blaue Füllung, einen Innenabstand von **16** links und rechts und **10** oben und unten sowie einen **Radius** von **10**. Mach den Text weiß.
3. Drücke <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" />, um den Button zu einer [Komponente](./components) zu machen, damit du ihn wiederverwenden kannst.

## 5. Ein Foto hinzufügen

1. Wähle das Rechteck aus und klicke unter **Füllung** auf das Farbquadrat.
2. Klicke oben in der Auswahl auf den Bild-Button und dann auf **Choose image**, um ein Bild von deinem Computer zu verwenden, oder auf **Stockfoto**, um [eines zu finden](./photos).

Das Foto füllt das Rechteck bei jeder Breite.

## 6. Prüfen und teilen

- Öffne den Tab **Prüfen**, um [die Karte auf Probleme zu prüfen](./checking-designs), etwa schwer lesbaren Text.
- [Exportiere sie](./exporting) als PNG oder klicke mit der rechten Maustaste darauf und wähle **Kopieren/Einfügen als → Als PNG kopieren**, um sie in einen Chat einzufügen.
- Bitte die [KI](./ai-chat) um eine Variante: *„Mach eine dunkle Version dieser Karte.“*

## Wie es weitergeht

- [Auto-Layout](./auto-layout): Zeilen, Raster, Umbruch und die anderen Arten, wie Ebenen ihre Größe ändern.
- [Komponenten](./components): Varianten, Eigenschaften und Instanzen.
- [Variablen](./variables): Farben und Größen, die du einmal festlegst, mit dunklem und hellem Modus.
