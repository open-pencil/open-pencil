---
title: Ebenen & Seiten
description: Ebenen, Seiten und das Eigenschaftspanel in OpenPencil verwalten.
---

# Ebenen & Seiten

Die Editor-Oberfläche hat drei Hauptpanels: Ebenen (links), Canvas (Mitte) und Eigenschaften (rechts). Alle Panels sind durch Ziehen der Trennlinien skalierbar.

## Ebenenpanel

Das Ebenenpanel links zeigt die Dokumenthierarchie als Baum.

### Baumansicht

Knoten werden in einem zusammenklappbaren Baum angezeigt. Klicken Sie auf den Pfeil neben einem Frame, einer Gruppe oder Komponente, um Kinder ein- oder auszuklappen.

### Ziehen zum Umordnen

Ziehen Sie Ebenen, um sie umzuordnen. Ebenen weiter oben in der Liste werden über den anderen gerendert.

### Sichtbarkeit umschalten

Klicken Sie auf das Auge-Symbol neben einer Ebene, um sie auf dem Canvas ein- oder auszublenden.

### Umbenennen

Doppelklicken Sie auf einen Ebenennamen, um ihn inline umzubenennen. <kbd>Enter</kbd> oder Klick außerhalb bestätigt, <kbd>Escape</kbd> bricht ab.

### Auswahl-Synchronisation

Klicken auf eine Ebene wählt den entsprechenden Knoten auf dem Canvas aus, und umgekehrt.

## Seitenpanel

Das Seitenpanel zeigt alle Seiten im Dokument.

- **Seite wechseln** — klicken Sie auf einen Seitenreiter
- **Seite hinzufügen** — klicken Sie auf die Hinzufügen-Schaltfläche
- **Seite löschen** — aktuelle Seite entfernen
- **Seite umbenennen** — Doppelklick auf den Seitennamen

Jede Seite hat ihren eigenen Canvas und Viewport-Zustand.

## Eigenschaftspanel

Das Eigenschaftspanel rechts hat drei Tabs:

### Design-Tab

Zeigt die Eigenschaften des/der ausgewählten Knoten, organisiert in Abschnitte:

- **Darstellung** — Deckkraft, Eckenradius, Sichtbarkeit
- **Füllung** — Vollfarbe, Verläufe, Bildfüllungen, Variablenbindungen
- **Kontur** — Farbe, Breite, Kappe, Verbindung, Strichmuster
- **Effekte** — Schlagschatten, innerer Schatten, Unschärfen
- **Typografie** — Schriftfamilie, Größe, Gewicht, B/I/U/S-Buttons
- **Layout** — [Auto-Layout](./auto-layout)-Steuerungen
- **Export** — Skalierung, Format und Export-Button

### Code-Tab

Zeigt den ausgewählten Knoten als JSX-Code mit Syntaxhervorhebung.

### KI-Tab

KI-Chat-Interface (auch mit <kbd>⌘</kbd><kbd>J</kbd> umschaltbar).

## Tastenkürzel

| Aktion | Mac | Windows / Linux |
|--------|-----|-----------------|
| KI-Chat umschalten | <kbd>⌘</kbd><kbd>J</kbd> | Strg + J |
