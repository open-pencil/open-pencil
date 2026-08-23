---
title: Automatische Anordnung
description: Flexbox und CSS Grid mit Richtung, Abstand, Innenabstand, Ausrichtung und Größenmodi.
---

# Automatische Anordnung

Die automatische Anordnung verteilt untergeordnete Objekte innerhalb eines Rahmens. Verfügbar sind Flexbox mit horizontalem oder vertikalem Verlauf und Grid mit Zeilen, Spalten und einstellbaren Spuren.

## Aktivieren

- Rahmen auswählen und <kbd>⇧</kbd><kbd>A</kbd> drücken.
- Mehrere freie Objekte auswählen und denselben Kurzbefehl verwenden, um sie in einen neuen Rahmen einzuschließen.

OpenPencil sortiert die Objekte zunächst nach ihrer sichtbaren Position.

## Richtung

- **Horizontal:** von links nach rechts.
- **Vertikal:** von oben nach unten.
- **Umbruch:** bei Platzmangel eine weitere Zeile oder Spalte.

## Abstände

Der Abstand bestimmt den Raum zwischen benachbarten Objekten. Der Innenabstand bestimmt den Raum zwischen Rahmenrand und Inhalt und kann gemeinsam oder pro Seite eingestellt werden.

## Ausrichtung

Entlang der Hauptachse sind Anfang, Mitte, Ende und gleichmäßige Verteilung verfügbar. Auf der Querachse stehen Anfang, Mitte, Ende und Strecken zur Verfügung.

## Größenmodi

- **Fest:** verwendet die eingestellte Breite oder Höhe.
- **Füllen:** belegt den verfügbaren Raum.
- **Inhalt:** richtet die Größe am Inhalt aus.

Die erste tatsächliche Änderung einer Breite oder Höhe schaltet nur diese Achse auf „Fest“. Der Fokus eines Feldes allein verändert den Modus nicht.

## CSS Grid

Grid ordnet Objekte in Zeilen und Spalten mit festen, proportionalen oder inhaltsabhängigen Spurgrößen an. Zeilen- und Spaltenabstände können getrennt eingestellt werden. Startzeile, Startspalte und Zellenspanne lassen sich für jedes Objekt festlegen.

Grid wird als JSX mit Tailwind-Klassen exportiert, zum Beispiel `grid grid-cols-3`, `gap-x-4 gap-y-2` und `col-start-2 row-span-2`.

## Hinweise

- Verschachtelte Rahmen eignen sich für komplexe anpassungsfähige Anordnungen.
- „Füllen“ entspricht in vielen Fällen `flex-grow: 1`.
- Grid eignet sich für Übersichten, Galerien, Formulare und andere zweidimensionale Strukturen.
