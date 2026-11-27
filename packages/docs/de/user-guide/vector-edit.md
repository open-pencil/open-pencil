---
pageClass: guide
title: Vektorbearbeitung
description: Punkte und Kurven eines Pfads verschieben, Punkte hinzufügen und löschen und Formen zu neuen kombinieren.
---

# Vektorbearbeitung

Ein Pfad besteht aus Punkten, die durch gerade oder gebogene Linien verbunden sind. Um seine Form zu ändern, bearbeitest du die Punkte selbst.

## Einen Pfad bearbeiten

Doppelklicke auf einen Pfad oder wähle ihn aus und drücke <Keys mac="Enter" other="Enter" />. Seine Punkte erscheinen, und die Griffe um die Ebene verschwinden.

<GuideImage name="vector-edit/points" alt="Ein gebogener Pfad im Bearbeitungsmodus mit einem ausgewählten Punkt und seinen zwei Griffen" />

- Zieh einen Punkt, um ihn zu verschieben.
- Zieh den Griff eines Punkts, um die Kurve zu ändern.
- Klicke auf eine Linie zwischen zwei Punkten, um sie auszuwählen, und zieh sie, um beide Punkte zu verschieben.
- Zieh über eine leere Stelle, um die Punkte im Rechteck auszuwählen.
- In einer gefüllten Form ist die Fläche unter dem Zeiger schraffiert. Klicke, um sie mit all ihren Punkten auszuwählen, und zieh, um sie zu verschieben.
- Halte <Keys mac="⇧" other="Shift" /> gedrückt und klicke, um etwas zur Auswahl hinzuzufügen.

Um das Bearbeiten zu beenden, drücke <Keys mac="Esc" other="Esc" /> oder <Keys mac="Enter" other="Enter" /> oder klicke auf eine leere Stelle der Arbeitsfläche.

## Eine Kurve formen

Halte beim Ziehen eines Griffs eine Taste gedrückt:

| Taste | Wirkung |
| ---- | ------------ |
| <Keys mac="⌘" other="Ctrl" /> | Hält beide Griffe auf einer Linie, für eine glatte Kurve. Nur die Länge dieses Griffs ändert sich. |
| <Keys mac="⌥" other="Alt" /> | Verschiebt nur diesen Griff, für eine scharfe Ecke. |
| <Keys mac="⇧" other="Shift" /> | Behält die Richtung des Griffs bei und ändert nur seine Länge. |

Halte <Keys mac="⌘" other="Ctrl" /> gedrückt und zieh einen Punkt, um seine Griffe herauszuziehen und die angrenzenden Linien zu biegen.

## Punkte hinzufügen und löschen

Drücke beim Bearbeiten <Keys mac="P" other="P" />, um den Stift zu verwenden:

- Klicke auf eine Linie, um einen Punkt darauf hinzuzufügen.
- Klicke auf das Ende eines offenen Pfads, um von dort weiterzuzeichnen.
- Halte <Keys mac="⌥" other="Alt" /> gedrückt und klicke auf einen Punkt, um ihn zu löschen.

Um die Auswahl zu löschen, drücke <Keys mac="⌫" other="Delete" />. Ein gelöschter Punkt nimmt seine Linien mit. Eine gelöschte Linie lässt ihre Punkte stehen, außer nichts anderes hält sie, sodass das Löschen einer Linie in der Mitte einen Pfad in zwei teilt. Um einen Pfad stattdessen an einem Punkt zu teilen, wähle den Punkt aus und drücke <Keys mac="⌥ ⌫" other="Alt Delete" />.

## Formen kombinieren

Wähle zwei oder mehr Formen aus und wähle unter **Objekt**, wie sie kombiniert werden sollen:

<GuideImage name="vector-edit/combine" alt="Ein Quadrat und ein Kreis, die sich überlappen, und die vier Arten, sie zu kombinieren: vereinen, subtrahieren, schneiden und ausschließen" />

- **Auswahl vereinen** fügt sie zu einer Form zusammen.
- **Auswahl subtrahieren** schneidet die oberen Formen aus der untersten heraus.
- **Auswahl schneiden** behält nur die Überlappung.
- **Auswahl ausschließen** behält alles außer der Überlappung.

Das Ergebnis bleibt bearbeitbar: Jede Form behält darin ihre eigenen Punkte. **Abflachen** macht aus der Auswahl einen einfachen Pfad, und **Kontur in Pfad umwandeln** macht aus einer Kontur eine gefüllte Form. Rechtecke, Ellipsen und Sterne werden nach dem Abflachen zu Pfaden, die du Punkt für Punkt bearbeiten kannst.
