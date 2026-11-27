---
pageClass: guide
title: Umstieg von Figma
description: Bring deine Figma-Dateien und -Ebenen zu OpenPencil und erfahre, was gleich funktioniert und was anders.
---

# Umstieg von Figma

OpenPencil liest und schreibt Figmas eigene `.fig`-Dateien und verwendet Figmas Namen und Tastenkürzel, sodass das meiste, was du kennst, auch hier funktioniert. Deine Dateien bleiben deine: Sie öffnen sich jederzeit wieder in Figma, wenn du es brauchst.

## Deine Dateien mitbringen

1. Öffne die Datei in Figma und wähle **File → Save local copy…**.
2. Öffne die `.fig`-Datei in OpenPencil oder zieh sie auf das Fenster. Siehe [Öffnen und speichern](./files).

Beim Speichern schreibt OpenPencil eine `.fig`-Datei, die sich auch in Figma öffnet.

## Ebenen zwischen beiden kopieren

Wähle Ebenen in Figma aus, drück <Keys mac="⌘ C" other="Ctrl C" /> und füge sie mit <Keys mac="⌘ V" other="Ctrl V" /> in OpenPencil ein. Das funktioniert auch in die andere Richtung. Füllungen, Konturen, Effekte, Text, Auto-Layout, Eckenradien und Vektorpfade kommen mit.

Bilder in eingefügten Ebenen werden von Figma geladen, daher musst du die Figma-Datei, aus der sie stammen, öffnen können. <Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> und <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> kopieren und fügen nur das Aussehen einer Ebene ein, ebenfalls von und nach Figma.

## Was gleich funktioniert

- **Rahmen, Gruppen, Abschnitte und Auto-Layout**, mit denselben Einstellungen, einschließlich Raster-Layout.
- **Komponenten, Varianten und Instanzen**, mit Eigenschaften und Slots. Siehe [Komponenten](./components).
- **Variablen und Modi**. Siehe [Variablen](./variables).
- **Stile** aus deinen Dateien und Bibliotheken werden wie in Figma angewendet.
- **Tastenkürzel** sind die von Figma, etwa <Keys mac="R" other="R" /> für ein Rechteck und <Keys mac="⇧ A" other="Shift A" /> für Auto-Layout. Siehe [Tastenkürzel](/reference/keyboard-shortcuts).

## Was anders funktioniert

- **Bibliotheken.** Figmas Team-Bibliotheken lassen sich nicht mit OpenPencil verbinden. Um hier Komponenten zwischen Dateien zu teilen, [veröffentliche eine OpenPencil-Bibliothek](./component-libraries).
- **Stile.** Du kannst Stile anwenden und lösen, aber noch nicht erstellen oder bearbeiten. Nimm für neue Farben und Größen [Variablen](./variables).
- **Variablenmodi** werden an einem Rahmen oder einer Seite unter **Darstellung** festgelegt, wo jede Sammlung immer eine Zeile hat.
- **Schriften.** Die Desktop-App verwendet die Schriften auf deinem Computer. Im Browser können Chrome und Edge sie ebenfalls verwenden, sobald du es erlaubst. Siehe [Schrift wählen](./text-editing#eine-schrift-wahlen).
- **Prototyping** gibt es noch nicht. Komponenten können in der Vorschau [wie Steuerelemente funktionieren](./components#eine-komponente-wie-ein-bedienelement-funktionieren-lassen), etwa ein Schalter, der umklappt.
- **Versionsverlauf** gibt es für Dateien in [OpenPencil Cloud](/cloud/).

Die [Figma-Funktionsmatrix](/de/reference/figma-compatibility) listet jede Figma-Funktion auf und wie weit OpenPencil sie unterstützt.

## Statt Plugins und Dev Mode

- **Frag die KI.** Vieles, was Plugins erledigen, etwa Ebenen umbenennen, Varianten erstellen oder Kontrast prüfen, erledigt der [KI-Chat](./ai-chat) mit einem Satz. Er kann auch einen [Coding-Agent](./coding-agents) verwenden, den du hast.
- **Schreib ein Skript.** Skripte verwenden dieselbe API wie Figma-Plugins, `figma.currentPage` und den Rest. Siehe [Skripte](/de/developers/cli/scripting).
- **Hol dir den Code.** Der Tab Code neben Design zeigt die Auswahl als HTML, Vue oder React, mit CSS oder Tailwind.
- **Prüfe Designs.** [Designs prüfen](./checking-designs) findet geringen Kontrast, kleine Touch-Ziele und Farben, die eine Variable verwenden sollten.
