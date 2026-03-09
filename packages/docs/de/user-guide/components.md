---
title: Komponenten
description: Wiederverwendbare Komponenten, Instanzen, Komponenten-Sets, Overrides und Live-Synchronisation in OpenPencil.
---

# Komponenten

Komponenten sind wiederverwendbare Design-Elemente. Bearbeiten Sie die Hauptkomponente und alle Instanzen aktualisieren sich automatisch.

## Komponente erstellen

Wählen Sie einen Frame oder eine Gruppe und drücken Sie <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (Strg + Alt + K). Der Knoten wird zu einer wiederverwendbaren Komponente.

Komponenten zeigen ein lila Label mit Diamant-Symbol.

## Komponenten-Sets

Wählen Sie zwei oder mehr Komponenten und drücken Sie <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> (Shift + Strg + K), um sie zu einem Komponenten-Set zu kombinieren — ein Container mit gestricheltem lila Rand.

## Instanzen erstellen

Rechtsklick auf eine Komponente → **Instanz erstellen**. Die Instanz erscheint 40 px rechts von der Quellkomponente.

## Instanz lösen

Wählen Sie eine Instanz und drücken Sie <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> (Strg + Alt + B). Die Instanz wird zu einem regulären Frame ohne Verbindung zur Komponente.

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

Name, Text, Schriftgröße, Schriftstärke, Schriftfamilie sowie alle visuellen und Layout-Eigenschaften.

### Neue Kinder

Wenn Sie der Komponente ein Kind hinzufügen, erhalten alle Instanzen automatisch eine geklonte Kopie.

## Hit-Testing

Komponenten und Instanzen sind opake Container — Klicken wählt die Komponente selbst. **Doppelklick** zum Betreten und Kinder auswählen.

## Visuelles Erscheinungsbild

| Element | Darstellung |
|---------|------------|
| Komponenten-Label | Lila mit Diamant-Symbol |
| Instanz-Label | Lila mit Diamant-Symbol |
| Komponenten-Set-Rand | Gestrichelt lila |

## Tastenkürzel

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| Komponente erstellen | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> | Strg + <kbd>Alt</kbd> + <kbd>K</kbd> |
| Komponenten-Set erstellen | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Shift</kbd> + <kbd>Strg</kbd> + K |
| Instanz lösen | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> | Strg + <kbd>Alt</kbd> + <kbd>B</kbd> |

## Tipps

- Textbearbeitung innerhalb einer Instanz erstellt ein Override.
- Verwenden Sie Komponenten-Sets für Varianten (z.B. Button-Zustände).
- Doppelklicken Sie in eine Komponente, bevor Sie ihre Kinder bearbeiten.
