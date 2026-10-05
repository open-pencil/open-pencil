---
title: Variablen
description: Designvariablen, Sammlungen, Modi und Farbbindungen in OpenPencil.
---

# Variablen

Variablen speichern wiederverwendbare Designtoken wie Farben, Abstände und andere Eigenschaften, die an Objekte gebunden werden können. Ändert sich ein Variablenwert, werden alle Objekte aktualisiert, die ihn verwenden.

## Variablen-Dialog öffnen

Wenn kein Objekt ausgewählt ist, zeigt der Bereich Design die Seiteneigenschaften, darunter einen Bereich Variablen mit der Anzahl der Sammlungen und Variablen. Das Einstellungssymbol öffnet den Dialog.

Der Dialog listet links die Variablen der aktiven Sammlung auf, bearbeitet rechts die ausgewählte Variable oder die Sammlung und zeigt darunter das daraus entstehende Stylesheet. In einem schmalen Fenster oder auf dem Smartphone zeigt er jeweils einen Modus an. Eine Variable, die Sammlungseinstellungen oder das Stylesheet öffnen sich dann über der Liste mit einer Zurück-Schaltfläche.

## Sammlungen

Variablen sind in Sammlungen organisiert, die als Registerkarten erscheinen (auf schmalen Bildschirmen als Menü).

- **Sammlung wechseln:** auf eine Registerkarte klicken
- **Sammlung erstellen:** in der Werkzeugleiste auf die Ordner-Schaltfläche (**Sammlung erstellen**) klicken
- **Umbenennen oder löschen:** Ist keine Variable ausgewählt, bearbeitet die rechte Seite die Sammlung: Dort lässt sich der Name ändern oder die Sammlung über das Menü **⋯** neben dem Namen löschen (**Sammlung löschen**)

## Modi

Jede Sammlung kann mehrere Modi enthalten (z. B. Hell und Dunkel). Die Modi erscheinen als Wertespalten in der Liste, und eine Variable hat für jeden Modus einen Wert. Verwaltet werden sie in den **Sammlungseinstellungen**:

- **Modus hinzufügen:** auf **+** neben **Modi** klicken
- **Umbenennen:** den Namen des Modus bearbeiten
- **Duplizieren, als Standard festlegen, löschen:** das Menü **⋯** neben dem Modus verwenden (**Modus duplizieren**, **Als Standard festlegen**, **Modus löschen**)

Der Standardmodus ist **Immer aktiv** und steht in `:root`. Jeder andere Modus hat **Gilt wenn**; das legt fest, wann der Modus im exportierten Stylesheet greift, und das CSS, das daraus entsteht, steht darunter:

| Gilt wenn | CSS |
| --- | --- |
| **manuell umgeschaltet wird** | ein Attribut, das nach Sammlung und Modus benannt ist, etwa `[data-theme="dark"]` für den Modus Dunkel einer Sammlung Theme |
| **das System im Dunkelmodus ist** / **das System im Hellmodus ist** | `@media (prefers-color-scheme: dark)` / `light` |
| **hoher Kontrast aktiv ist** | `@media (prefers-contrast: more)` |
| **reduzierte Bewegung aktiv ist** | `@media (prefers-reduced-motion: reduce)` |
| **der Bildschirm schmaler ist als** / **der Bildschirm breiter ist als** eine Breite | `@media (max-width: 640px)` / `min-width` |
| **der Container schmaler ist als** / **der Container breiter ist als** eine Breite | `@container (max-width: 640px)` / `min-width` |
| **Benutzerdefiniertes CSS** | ein beliebiger Selektor oder eine Abfrage mit `@media`, `@supports` oder `@container` |

Auf der Arbeitsfläche zeigt eine Ebene einen Modus, sobald sie auf ihn gesetzt ist, unabhängig von der Bedingung. Im exportierten Code wird ein manuell umgeschalteter Modus aktiviert, indem sein Attribut an ein Element gesetzt wird; Ebenen, die auf ihn gesetzt sind, werden daher mit diesem Attribut exportiert. Ebenen, die auf einen Modus mit einer anderen Bedingung gesetzt sind, auch mit benutzerdefinierten Selektoren, werden mit festen Werten statt Tokens exportiert, weil das Stylesheet und nicht die Ebene entscheidet, wann dieser Modus gilt.

## Variablen verwalten

Variablen sind nach den Ordnern in ihren Namen gruppiert (`Brand/Primary` erscheint als *Primary* unter *Brand*) und zeigen ihren CSS-Namen sowie einen Wert pro Modus.

- **Variable erstellen:** in der Werkzeugleiste auf **+** klicken und einen Typ wählen; die neue Variable wird zur Bearbeitung geöffnet
- **Auswählen:** auf eine Zeile klicken oder mit den Pfeiltasten navigieren und die Eingabetaste drücken
- **Suchen:** in das Suchfeld tippen, um Variablen nach Namen zu filtern
- **Löschen:** unten in den Einstellungen der Variable auf **Variable löschen** klicken

Die Auswahl einer Variable bearbeitet:

- **Name** und **CSS-Name:** den CSS-Namen leer lassen, damit er aus Name und Geltungsbereichen abgeleitet wird, etwa `--color-brand-primary`
- **Einheit:** bei Zahlen `px`, `rem`, `%`, `ms`, `s`, `deg` oder keine; Werte werden in dieser Einheit eingegeben
- **Werte:** pro Modus; eine Farbe öffnet die Farbauswahl, ein Alias zeigt die Variable, auf die er verweist
- **CSS-Ausdruck:** bei Zahlen ein Wert wie `clamp(1rem, 4vw, 1.5rem)`, der in CSS anstelle der Zahl geschrieben wird, während die Arbeitsfläche weiterhin die Zahl zeichnet
- **Geltungsbereiche:** für welche Eigenschaften die Variable angeboten wird
- **Beschreibung**

## Stylesheet

Unten im Dialog wird die aktive Sammlung als CSS-Custom-Properties oder als Tailwind-v4-Theme angezeigt. Die Kopieren-Schaltfläche (**Alle Variablen als CSS kopieren**) kopiert die Variablen des gesamten Dokuments in diesem Format, sodass Aliase auf andere Sammlungen aufgelöst werden.

## Variablen an Füllungen binden

Mit der Variablenauswahl im Bereich Füllung des Eigenschaftenbereichs lässt sich eine Farbvariable an die Füllung eines Objekts binden.

- **Binden:** eine Farbvariable in der Auswahl wählen. Die Füllung zeigt ein violettes Etikett mit dem Variablennamen.
- **Lösen:** auf die Schaltfläche zum Lösen am Etikett klicken, um die Bindung zu entfernen. Die Füllung kehrt zum aufgelösten Farbwert zurück.

Ändert sich der Wert der Variable (oder wird der Modus gewechselt), werden alle gebundenen Füllungen automatisch aktualisiert.

## Hinweise

- Sammlungen gruppieren zusammengehörige Token, etwa `Primitives` für Ausgangsfarben, `Semantic` für rollenbezogene Aliase und `Spacing` für Layoutwerte.
- Modi eignen sich für Themen: Hell- und Dunkel-Werte lassen sich in derselben Sammlung definieren.
- Variablen unterstützen Aliase: Eine Sammlung `Semantic` kann auf Werte einer Sammlung `Primitives` verweisen.
- Wie Füllungen und die Farbauswahl funktionieren, steht unter [Formen zeichnen](./drawing-shapes).
