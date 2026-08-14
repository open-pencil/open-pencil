---
title: Komponenten
description: Wiederverwendbare Komponenten, Instanzen, Komponenten-Sets, Overrides und Live-Synchronisation in OpenPencil.
---

# Komponenten

Komponenten sind wiederverwendbare Design-Elemente. Bearbeiten Sie die Hauptkomponente und alle Instanzen aktualisieren sich automatisch.

## Komponenten durchsuchen

Öffnen Sie links den Tab **Assets**, um lokale Komponenten und aktivierte Bibliotheken zu durchsuchen. Sie können suchen, zwischen Raster- und Listenansicht wechseln und Komponenten per Klick, <kbd>Enter</kbd> oder Drag-and-drop einfügen. Heruntergeladene Bibliotheksrevisionen bleiben auch offline verfügbar.

## Komponente erstellen

Wählen Sie einen Frame oder eine Gruppe und drücken Sie <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (Strg + Alt + K). Der Knoten wird zu einer wiederverwendbaren Komponente.

Komponenten zeigen ein lila Label mit Diamant-Symbol.

## Komponenten-Sets und Varianten

Wählen Sie zwei oder mehr Komponenten und drücken Sie <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> (Shift + Strg + K), um sie zu einem Komponenten-Set zu kombinieren — ein Container mit gestricheltem lila Rand.

Varianten können mehrere Dimensionen wie `Größe=Klein`, `Status=Hover` und `Theme=Dunkel` verwenden. Nicht jede Kombination ist erforderlich. Die Variante oben links ist Standard und dient als Fallback, wenn eine Aktualisierung keine exakte Kombination mehr enthält. Im Eigenschaften-Panel können Sie Dimensionen und Werte hinzufügen, umbenennen, sortieren und entfernen; doppelte Kombinationen werden abgelehnt.

## Komponenteneigenschaften

Komponenten unterstützen Text-, boolesche Sichtbarkeits- und Instanztausch-Eigenschaften. Verknüpfen Sie eine Eigenschaft mit einem untergeordneten Feld und ändern Sie danach den Wert einer Instanz, ohne sie zu lösen. Definitionen und Zuweisungen bleiben in `.fig`-Dateien erhalten.

## Komponentenbibliotheken

Eine Bibliothek veröffentlicht Komponenten als unveränderliche Revision. Öffnen Sie **Assets → Bibliotheken verwalten → Bibliothek veröffentlichen**, legen Sie beim ersten Mal eine stabile Bibliotheks-ID und einen Namen fest, wählen Sie die Änderungen aus und veröffentlichen Sie. Bei späteren Veröffentlichungen bleiben nicht ausgewählte Änderungen ausstehend.

Aktivieren Sie Bibliotheken unter **Bibliotheken verwalten**. Ihre Assets erscheinen neben lokalen Komponenten; veröffentlichte Definitionen sind im konsumierenden Dokument schreibgeschützt, verknüpfte Instanzen und Overrides bleiben bearbeitbar.

Unter **Updates** können Sie die aktuelle und neue Instanz nebeneinander prüfen. Aktualisieren Sie eine Instanz, alle Instanzen eines Assets, die aktuelle Seite oder alle Seiten. Kompatible Eigenschaften bleiben erhalten; fehlende Varianten zeigen vor dem Bestätigen den Fallback an. Updates unterstützen Rückgängig/Wiederholen.

Bibliotheken können lokal oder über einen konfigurierten Speicheranbieter gespeichert werden. Heruntergeladene Revisionen werden lokal zwischengespeichert. Aktivierte Bindungen und materialisierte Definitionen werden in `.fig` gespeichert, sodass Dokumente auch ohne Verbindung zur Remote-Bibliothek geöffnet werden können.

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
