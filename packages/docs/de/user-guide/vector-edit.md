---
title: Vektoren bearbeiten
description: Ankerpunkte, Béziergriffe und Segmente bearbeiten und den Zeichenstift im Bearbeitungsmodus verwenden.
---

# Vektoren bearbeiten

Im Vektorbearbeitungsmodus wird die Geometrie eines Pfads verändert: Position der Ankerpunkte, Form der Segmente und Béziergriffe.

## Bearbeitungsmodus öffnen

1. Vektorobjekt mit dem Auswahlwerkzeug auswählen.
2. Die Kurve doppelklicken.

<kbd>Escape</kbd> beendet den Modus.

## Grundlagen

- Ankerpunkt ziehen, um die verbundenen Segmente zu verändern.
- Béziergriff ziehen, um die Krümmung anzupassen.
- <kbd>Cmd</kbd>/<kbd>Strg</kbd> hält beide Griffe auf einer Linie.
- <kbd>Option</kbd>/<kbd>Alt</kbd> verändert einen Griff unabhängig.
- <kbd>Shift</kbd> behält die Richtung bei und verändert nur die Länge.

Beim Ziehen eines Ankerpunkts mit <kbd>Cmd</kbd>/<kbd>Strg</kbd> bestimmt OpenPencil den Zielgriff anhand der Richtung des verbundenen Segments. Das funktioniert auch bei verzweigten Vektornetzen.

## Zeichenstift im Bearbeitungsmodus

- Klick auf ein Segment fügt einen Ankerpunkt ein.
- Klick auf den Endpunkt eines offenen Pfads setzt das Zeichnen fort.
- <kbd>Option</kbd>/<kbd>Alt</kbd> + Klick entfernt einen Ankerpunkt, sofern die Struktur dies erlaubt.

Siehe auch [Zeichenstift](./pen-tool.md).
