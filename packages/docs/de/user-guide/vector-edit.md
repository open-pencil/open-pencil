---
title: Vektorobjekt bearbeiten
description: "Vektorpfad-Geometrie bearbeiten: Ankerpunkte, Bézier-Griffe, Modifikatoren und Stiftwerkzeug-Aktionen im Bearbeitungsmodus."
---

# Vektorobjekt bearbeiten

Der Bearbeitungsmodus für Vektorobjekte ermöglicht es, die **Geometrie** einer Kurve zu verändern: Ankerpositionen, Segmentform und Bézier-Griffe.  
In diesem Modus bearbeiten Sie den Pfad selbst, keine standardmäßigen Objekttransformationen.

## Modus aktivieren

- Wählen Sie ein Vektorobjekt mit dem Auswahlwerkzeug aus.
- **Doppelklicken Sie auf die Kurve**.

Damit wird die Geometriebearbeitung für das ausgewählte Vektorobjekt aktiviert.

## Modus beenden

- Drücken Sie <kbd>Escape</kbd>.
- Oder wechseln Sie in einen anderen Bearbeitungskontext.

## Was sich in diesem Modus ändert

- Der normale Transform-Begrenzungsrahmen des Objekts ist deaktiviert.
- Die Bearbeitung von Ankern, Segmenten und Griffen wird verfügbar.
- Der Cursor wechselt an den Ecken des Begrenzungsrahmens nicht zum Skalierungs-/Rotationssymbol.

## Grundlegende Aktionen

### Anker verschieben

- Ziehen Sie einen Ankerpunkt.
- Verbundene Segmente und die Pfadform werden live in der Vorschau aktualisiert.

### Bézier-Griff bearbeiten

- Ziehen Sie einen Griff am Anker.
- Standardmäßig richtet sich das Verhalten nach der aktuellen Griffzusammensetzung des Ankers.

## Modifikatoren beim Ziehen von Griffen

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Kontinuierlich (Glatt / Kontinuierlich) | <kbd>Cmd</kbd> + Ziehen | <kbd>Strg</kbd> + Ziehen |
| Ecke (unabhängige Griffe) | <kbd>Option</kbd> + Ziehen | <kbd>Alt</kbd> + Ziehen |
| Richtungssperre (nur Länge) | <kbd>Shift</kbd> + Ziehen | <kbd>Shift</kbd> + Ziehen |

### Kontinuierlich: <kbd>Cmd</kbd>/<kbd>Strg</kbd> + Ziehen

- Der aktive Griff wird auf dieselbe Linie wie der gegenüberliegende Griff eingeschränkt.
- Nur die Länge des aktiven Griffs ändert sich.
- Verwenden Sie dies für weiche Übergänge ohne Eckknick.

### Ecke: <kbd>Option</kbd>/<kbd>Alt</kbd> + Ziehen

- Der aktive Griff wird unabhängig bearbeitet.
- Der gegenüberliegende Griff bleibt an seiner Position.
- Verwenden Sie dies, um einen scharfen Eckübergang zu erzeugen.

### Richtungssperre: <kbd>Shift</kbd> + Ziehen

Für Anker mit **kontinuierlicher** oder **symmetrischer** Zusammensetzung:

- Die Griffrichtung wird auf den Wert **vor Beginn des aktuellen Ziehvorgangs** gesperrt;
- das Ziehen ändert nur die Grifflänge (oder -längen, abhängig von der Zusammensetzung).

## Biegung überschreiben durch Ziehen eines Ankers

Wenn Sie einen Anker ziehen und dabei <kbd>Cmd</kbd>/<kbd>Strg</kbd> gedrückt halten, wählt der Editor den Zielgriff nach der **Segmentanschlussrichtung** an diesem Anker aus (nicht nach dem nächstgelegenen Nachbarpunkt).  
Dies funktioniert auch bei Ankern mit mehreren Pfadverzweigungen: Nach der Auflösung bleibt der Zielgriff für den aktuellen Ziehvorgang gesperrt.

## Stiftwerkzeug im Bearbeitungsmodus

Bei aktivem Stiftwerkzeug:

- **Klicken Sie auf ein Segment**, um einen neuen Anker einzufügen (Segment teilen).
- **Klicken Sie auf den Endpunkt eines offenen Pfads**, um das Zeichnen von diesem Punkt aus fortzusetzen.
- **Option/Alt + Klick auf einen Anker**, um ihn zu löschen (sofern die Topologie dies erlaubt).

Informationen zum Erstellen und Schließen von Pfaden finden Sie unter [Stiftwerkzeug](./pen-tool.md).

## Praktischer Arbeitsablauf

1. Zeichnen Sie eine Form mit dem Stiftwerkzeug.
2. Doppelklicken Sie auf die Kurve, um den Bearbeitungsmodus für Vektorobjekte zu aktivieren.
3. Verschieben Sie Anker, um die Silhouette zu verfeinern.
4. Ziehen Sie Griffe:
   - mit <kbd>Cmd</kbd>/<kbd>Strg</kbd> für weiche, kontinuierliche Übergänge,
   - mit <kbd>Option</kbd>/<kbd>Alt</kbd> für unabhängige Bearbeitungen,
   - mit <kbd>Shift</kbd> für reine Längenänderungen.
5. Drücken Sie <kbd>Escape</kbd>, um den Modus zu beenden.
