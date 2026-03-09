---
title: Stiftwerkzeug
description: Vektorpfade mit Bézier-Kurven zeichnen mit dem Stiftwerkzeug in OpenPencil.
---

# Stiftwerkzeug

Das Stiftwerkzeug erstellt Vektorpfade mit einem Vektornetzwerk-Datenmodell, kompatibel mit Figmas .fig-Format.

## Aktivieren

Drücken Sie <kbd>P</kbd>, um das Stiftwerkzeug zu aktivieren.

## Punkte setzen

- **Klicken** setzt einen Eckpunkt (gerades Segment)
- **Klicken + Ziehen** setzt einen Kurvenpunkt mit Bézier-Tangentengriffen

Klicken Sie mehrere Punkte, um einen Pfad Segment für Segment aufzubauen. Eine Vorschaulinie erstreckt sich vom letzten Punkt zu Ihrem Cursor.

## Pfad schließen

Klicken Sie auf den **ersten Punkt** des Pfades, um ihn zu einer Schleife zu schließen. Geschlossene Pfade können gefüllt werden.

## Offene Pfade

Drücken Sie <kbd>Escape</kbd>, um den aktuellen Pfad als offenen Pfad zu bestätigen. Offene Pfade werden nur als Konturen gerendert.

## Vektornetzwerke

Pfade verwenden das Vektornetzwerk-Datenmodell statt einfacher Punktlisten. Vektornetzwerke ermöglichen flexiblere Topologien und sind vollständig mit dem .fig-Format kompatibel.

## Tastenkürzel

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Stiftwerkzeug | <kbd>P</kbd> | <kbd>P</kbd> |
| Offenen Pfad bestätigen | <kbd>Escape</kbd> | Escape |

## Tipps

- Ziehen Sie länger beim Setzen eines Kurvenpunktes, um die Kurve breiter zu machen.
- Nach dem Erstellen eines Pfades nutzen Sie das Eigenschaftspanel für Füllung, Kontur und Effekte.
