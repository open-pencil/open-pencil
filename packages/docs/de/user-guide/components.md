---
title: Komponenten
description: Wiederverwendbare Komponenten, Instanzen, Komponenten-Sets, Overrides und Live-Synchronisation in OpenPencil.
---

# Komponenten

Komponenten sind wiederverwendbare Design-Elemente. Bearbeiten Sie die Hauptkomponente und alle Instanzen aktualisieren sich automatisch.

## Komponente erstellen

Wählen Sie einen Frame oder eine Gruppe und drücken Sie **⌥ ⌘ K** (Strg + Alt + K). Der Knoten wird an Ort und Stelle in einen COMPONENT-Typ umgewandelt.

Komponenten zeigen ein lila Label mit Diamant-Symbol.

## Komponenten-Sets

Wählen Sie zwei oder mehr Komponenten und drücken Sie **⇧ ⌘ K** (Shift + Strg + K), um sie zu einem Komponenten-Set zu kombinieren — ein Container mit gestricheltem lila Rand.

## Instanzen erstellen

Rechtsklick auf eine Komponente → **Instanz erstellen**. Die Instanz erscheint 40 px rechts von der Quellkomponente.

## Instanz lösen

Wählen Sie eine Instanz und drücken Sie **⌥ ⌘ B** (Strg + Alt + B). Die Instanz wird zu einem regulären Frame ohne Verbindung zur Komponente.

## Zur Hauptkomponente

Rechtsklick auf eine Instanz → **Zur Hauptkomponente**. Der Editor navigiert zur Hauptkomponente und wählt sie aus.

## Live-Synchronisation

Wenn Sie eine Komponente bearbeiten, aktualisieren sich alle Instanzen automatisch. Synchronisierte Eigenschaften:

- Breite und Höhe
- Füllungen, Konturen und Effekte
- Deckkraft und Eckenradien
- Layout-Eigenschaften
- Inhalte beschneiden

## Overrides

Instanzen können bestimmte Eigenschaften überschreiben, ohne die Synchronisationsverbindung zu unterbrechen. Überschriebene Eigenschaften werden bei der Synchronisation übersprungen.

### Überschreibbare Eigenschaften

Name, Text, fontSize, fontWeight, fontFamily sowie alle visuellen und Layout-Eigenschaften.

### Neue Kinder

Wenn Sie der Komponente ein Kind hinzufügen, erhalten alle Instanzen automatisch eine geklonte Kopie.

## Hit-Testing

Komponenten und Instanzen sind opake Container — Klicken wählt die Komponente selbst. **Doppelklick** zum Betreten und Kinder auswählen.

## Visuelles Erscheinungsbild

| Element | Darstellung |
|---------|------------|
| Komponenten-Label | Lila (#9747ff) mit Diamant-Symbol |
| Instanz-Label | Lila (#9747ff) mit Diamant-Symbol |
| Komponenten-Set-Rand | Gestrichelt lila |

## Tastenkürzel

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Komponente erstellen | ⌥ ⌘ K | Strg + Alt + K |
| Komponenten-Set erstellen | ⇧ ⌘ K | Shift + Strg + K |
| Instanz lösen | ⌥ ⌘ B | Strg + Alt + B |

## Tipps

- Textbearbeitung innerhalb einer Instanz erstellt ein Override.
- Verwenden Sie Komponenten-Sets für Varianten (z.B. Button-Zustände).
- Doppelklicken Sie in eine Komponente, bevor Sie ihre Kinder bearbeiten.
