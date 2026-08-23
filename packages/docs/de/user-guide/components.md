---
title: Komponenten
description: Wiederverwendbare Komponenten, Instanzen, Komponentensätze, Überschreibungen und Bibliotheken.
---

# Komponenten

Komponenten sind wiederverwendbare Designelemente. Änderungen an der Hauptkomponente werden an ihre Instanzen weitergegeben.

## Komponenten finden

Der Bereich **Assets** zeigt lokale Komponenten und aktivierte Bibliotheken. Suche, Raster- und Listenansicht sowie Einfügen per Klick, <kbd>Enter</kbd> oder Ziehen werden unterstützt. Heruntergeladene Bibliotheksversionen bleiben offline verfügbar.

## Komponente erstellen

Rahmen oder Gruppe auswählen und <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> drücken. Unter Windows und Linux: <kbd>Strg</kbd><kbd>Alt</kbd><kbd>K</kbd>.

## Komponentensätze und Varianten

Mindestens zwei Komponenten auswählen und <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> drücken. Varianten können mehrere Merkmale wie `Size=Small`, `State=Hover` und `Theme=Dark` besitzen. Nicht jede Kombination muss vorhanden sein. Die Variante oben links dient als Standard und Ersatz.

## Komponenteneigenschaften

Unterstützt werden Text, boolesche Sichtbarkeit und Instanztausch. Eine Eigenschaft kann mit einem untergeordneten Feld verbunden und anschließend in einer Instanz verändert werden, ohne die Verbindung zu lösen.

## Bibliotheken

Bibliotheken veröffentlichen Komponenten als unveränderliche Versionen. In **Assets → Manage libraries → Publish library** werden eine dauerhafte Kennung und ein Name festgelegt und die zu veröffentlichenden Änderungen ausgewählt.

Aktivierte Bibliotheken erscheinen bei den lokalen Komponenten. Veröffentlichte Definitionen sind schreibgeschützt; Instanzen und Überschreibungen bleiben bearbeitbar.

Unter **Updates** können aktuelle und neue Instanzen verglichen und einzeln, pro Ressource, pro Seite oder im gesamten Dokument aktualisiert werden. Kompatible Eigenschaften bleiben erhalten. Fehlt eine Variante, wird vor der Bestätigung die Ersatzvariante angezeigt.

Heruntergeladene Versionen werden lokal gespeichert. Verbindungen und benötigte Definitionen werden in `.fig` eingebettet, sodass das Dokument auch ohne entfernte Bibliothek geöffnet werden kann.

## Instanzen

Über das Kontextmenü kann eine Instanz erstellt, von ihrer Komponente gelöst oder die Hauptkomponente geöffnet werden.

Änderungen an der Hauptkomponente aktualisieren Breite, Höhe, Füllungen, Konturen, Effekte, Deckkraft, Eckenradien, Anordnung und Beschnitt der Instanzen. Überschriebene Werte bleiben erhalten.

## Tastenkürzel

| Aktion | macOS | Windows / Linux |
|--------|-------|-----------------|
| Komponente erstellen | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Strg</kbd><kbd>Alt</kbd><kbd>K</kbd> |
| Komponentensatz erstellen | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Shift</kbd><kbd>Strg</kbd><kbd>K</kbd> |
| Instanz lösen | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> | <kbd>Strg</kbd><kbd>Alt</kbd><kbd>B</kbd> |
