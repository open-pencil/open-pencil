---
title: Variablen
description: Designvariablen, Sammlungen, Modi und Farbbindungen in OpenPencil.
---

# Variablen

Variablen speichern wiederverwendbare Designtoken wie Farben und Abstände. Objekteigenschaften können daran gebunden werden. Ändert sich ein Variablenwert, werden alle verbundenen Objekte aktualisiert.

## Variablen öffnen

Wenn kein Objekt ausgewählt ist, zeigt der Bereich Design die Seiteneigenschaften. Das Einstellungssymbol im Bereich Variablen öffnet den Dialog.

## Sammlungen und Modi

Variablen sind in Sammlungen organisiert. Jede Sammlung erscheint als Registerkarte und kann mehrere Modi wie Hell und Dunkel enthalten. Die Modi werden als Tabellenspalten dargestellt.

## Variablen bearbeiten

- Variable erstellen;
- Namen oder Wert durch Klick auf die Zelle ändern;
- Liste über das Suchfeld filtern.

Farbwerte werden direkt in der Tabelle mit einem Farbfeld und einer Farbauswahl bearbeitet.

Die Typen `FLOAT`, `STRING` und `BOOLEAN` sind im Datenmodell vorhanden, besitzen aber noch keine vollständige Bearbeitungsoberfläche.

## Bindungen für Füllungen und Konturen

Die Variablenauswahl in den Bereichen Füllung und Kontur verbindet eine Farbvariable mit der jeweiligen Farbeigenschaft.

Das Öffnen eines Feldes oder der Auswahl verändert die Bindung nicht. Erst eine tatsächliche Wertänderung kann sie abhängig vom verwendeten Steuerelement lösen oder die Variable selbst ändern.

## Hinweise

- Sammlungen gruppieren zusammengehörige Token, etwa `Primitives` für Ausgangsfarben und `Semantic` für rollenbezogene Token.
- Modi eignen sich für Themen wie Hell und Dunkel.
- Aliase erlauben einer Variable, auf den Wert einer anderen Sammlung zu verweisen.
