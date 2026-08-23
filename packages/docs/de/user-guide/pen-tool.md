---
title: Zeichenstift
description: Vektorpfade und Bézierkurven mit dem Zeichenstift zeichnen.
---

# Zeichenstift

Der Zeichenstift erstellt Vektorpfade auf Grundlage des mit Figma kompatiblen Vektornetzmodells.

## Aktivieren

Drücken Sie <kbd>P</kbd>.

## Ankerpunkte setzen

- Ein Klick setzt einen Eckpunkt und erzeugt ein gerades Segment.
- Klicken und Ziehen setzt einen Punkt mit Béziergriffen.
- Halten Sie während des Ziehens <kbd>Space</kbd> gedrückt, um den Punkt selbst zu verschieben.

Jeder weitere Punkt ergänzt ein Segment. Eine Vorschau führt vom letzten Punkt zum Mauszeiger.

## Pfad schließen

Klicken Sie auf den ersten Punkt. Ein geschlossener Pfad kann eine Füllung besitzen.

## Offener Pfad

<kbd>Escape</kbd> beendet den Pfad, ohne ihn zu schließen. Offene Pfade werden nur über ihre Kontur dargestellt.

## Vektornetze

OpenPencil speichert Vektoren als Vektornetze statt als einfache Punktlisten. Dadurch sind verzweigte Strukturen möglich und die Geometrie kann ohne Umwandlung im `.fig`-Format gespeichert werden.

## Im Bearbeitungsmodus fortsetzen

- Klick auf den Endpunkt eines offenen Pfads setzt das Zeichnen fort.
- Klick auf ein Segment fügt einen Punkt ein.
- <kbd>Option</kbd>/<kbd>Alt</kbd> + Klick entfernt einen Punkt, sofern die Struktur dies erlaubt.

Weitere Informationen: [Vektoren bearbeiten](./vector-edit).
