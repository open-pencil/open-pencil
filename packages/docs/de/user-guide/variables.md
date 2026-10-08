---
title: Variablen
description: Designvariablen, Sammlungen, Modi und Farbbindungen in OpenPencil.
---

# Variablen

Variablen speichern wiederverwendbare Designtoken wie Farben, Abstände und andere Eigenschaften, die an Objekte gebunden werden können. Ändert sich ein Variablenwert, werden alle Objekte aktualisiert, die ihn verwenden.

## Variablen-Dialog öffnen

Der Dialog öffnet sich über **Ansicht → Variablen…**, über die Suche nach „Variablen“ in der Befehlspalette oder, wenn kein Objekt ausgewählt ist, im Bereich Variablen des Bereichs Design. **Erweitern** in der Ecke des Dialogs gibt ihm den größten Teil des Fensters.

Der Dialog listet links die Variablen der aktiven Sammlung auf, bearbeitet rechts die ausgewählte Variable oder die Sammlung und zeigt darunter das daraus entstehende Stylesheet. In einem schmalen Fenster oder auf dem Smartphone zeigt er jeweils einen Modus an. Eine Variable, die Sammlungseinstellungen oder das Stylesheet öffnen sich dann über der Liste mit einer Zurück-Schaltfläche.

## Sammlungen

Variablen sind in Sammlungen organisiert. In einem breiten Dialog stehen sie in einer Seitenleiste mit der Anzahl der Variablen je Sammlung; schmaler erscheinen sie als Registerkarten, auf dem Smartphone als Menü.

- **Sammlung wechseln:** in der Seitenleiste oder auf der Registerkarte darauf klicken
- **Sammlung erstellen:** neben **Sammlungen** auf **+** oder in der Werkzeugleiste auf die Ordner-Schaltfläche (**Sammlung erstellen**) klicken
- **Umbenennen oder löschen:** Ist keine Variable ausgewählt, bearbeitet die rechte Seite die Sammlung: Dort lässt sich der Name ändern oder die Sammlung über das Menü **⋯** neben dem Namen löschen (**Sammlung löschen**)
- **Umschalt-Attribut:** das Attribut, das manuell umgeschaltete Modi aktiviert, standardmäßig `data-theme` für eine Sammlung namens Theme; ein anderer Name wie `data-color-scheme` passt es an eine bestehende Codebasis an

## Modi

Jede Sammlung kann mehrere Modi enthalten (z. B. Hell und Dunkel). Die Modi erscheinen als Wertespalten in der Liste, und eine Variable hat für jeden Modus einen Wert. Verwaltet werden sie in den **Sammlungseinstellungen**:

- **Modus hinzufügen:** auf **+** neben **Modi** klicken
- **Umbenennen:** den Namen des Modus bearbeiten
- **Duplizieren, als Standard festlegen, löschen:** das Menü **⋯** neben dem Modus verwenden (**Modus duplizieren**, **Als Standard festlegen**, **Modus löschen**)

Der Standardmodus ist **Immer aktiv** und steht in `:root`. Jeder andere Modus hat **Gilt wenn**; das legt fest, wann der Modus im exportierten Stylesheet greift, und das CSS, das daraus entsteht, steht darunter:

| Gilt wenn | CSS |
| --- | --- |
| **manuell umgeschaltet wird** | das Umschalt-Attribut der Sammlung mit dem Modus als Wert, etwa `[data-theme="dark"]` für den Modus Dunkel einer Sammlung Theme |
| **das System im Dunkelmodus ist** / **das System im Hellmodus ist** | `@media (prefers-color-scheme: dark)` / `light` |
| **hoher Kontrast aktiv ist** | `@media (prefers-contrast: more)` |
| **reduzierte Bewegung aktiv ist** | `@media (prefers-reduced-motion: reduce)` |
| **der Bildschirm schmaler ist als** / **der Bildschirm breiter ist als** eine Breite | `@media (max-width: 640px)` / `min-width` |
| **der Container schmaler ist als** / **der Container breiter ist als** eine Breite | `@container (max-width: 640px)` / `min-width` |
| **Benutzerdefiniertes CSS** | ein beliebiger Selektor oder eine Abfrage mit `@media`, `@supports` oder `@container` |

Auf der Arbeitsfläche zeigt eine Ebene einen Modus, sobald sie auf ihn gesetzt ist, unabhängig von der Bedingung. Im exportierten Code wird ein manuell umgeschalteter Modus aktiviert, indem sein Attribut an ein Element gesetzt wird; Ebenen, die auf ihn gesetzt sind, werden daher mit diesem Attribut exportiert. Ebenen, die auf einen Modus mit einer anderen Bedingung gesetzt sind, auch mit benutzerdefinierten Selektoren, werden mit festen Werten statt Tokens exportiert, weil das Stylesheet und nicht die Ebene entscheidet, wann dieser Modus gilt.

## Variablen verwalten

Variablen sind nach den Ordnern in ihren Namen gruppiert (`Brand/Primary` erscheint als *Primary* unter *Brand*) und zeigen ihren CSS-Namen sowie einen Wert pro Modus.

- **Variable erstellen:** auf **Variable erstellen** (oder **+**) klicken und einen Typ wählen; die neue Variable wird zur Bearbeitung geöffnet
- **Auswählen:** auf eine Zeile klicken oder mit den Pfeiltasten navigieren und die Eingabetaste drücken. Shift-Klick wählt einen Bereich aus, Cmd-Klick (Strg-Klick unter Windows und Linux) fügt eine Zeile hinzu oder entfernt sie
- **Filtern:** in das Suchfeld tippen, um nach Namen, CSS-Name, Beschreibung oder Wert zu filtern, etwa `--color-brand`, einer Hex-Farbe oder der Variable, auf die ein Alias verweist, mit derselben fehlertoleranten Suche wie die Befehlspalette; in der Seitenleiste auf eine Gruppe klicken, um nur diese Gruppe und die darin enthaltenen Gruppen anzuzeigen, oder über die Filter-Schaltfläche (**Nach Typ filtern**) nur bestimmte Typen anzeigen
- **Umbenennen oder direkt bearbeiten:** auf einen Namen oder einen Zahlen- oder Textwert in der Liste doppelklicken
- **Rechtsklick:** die ausgewählten Variablen umbenennen, duplizieren (**Duplizieren**), in eine Gruppe oder eine neue Gruppe verschieben (**In Gruppe verschieben**, **Neue Gruppe…**) oder löschen (**Variablen löschen**); auch Delete oder Backspace löscht sie
- **Neu anordnen:** eine Zeile ziehen; die Reihenfolge wird in der Datei gespeichert
- **Mehrere ausgewählt:** die rechte Seite verschiebt sie in eine Gruppe, dupliziert sie oder löscht sie
- **Rückgängig und Wiederholen:** Cmd+Z und Cmd+Shift+Z oder Cmd+Y (Strg unter Windows und Linux) wirken im Dialog wie auf der Arbeitsfläche, ein Schritt pro Änderung. Die Eingabetaste übernimmt ein Feld und kehrt zur Liste zurück; solange ein Feld noch nicht übernommenen Text enthält, macht Cmd+Z das Tippen rückgängig

Die Auswahl einer Variable bearbeitet:

- **Name** und **CSS-Name:** den CSS-Namen leer lassen, damit er aus Name und Geltungsbereichen abgeleitet wird, etwa `--color-brand-primary`. Den Namen ohne `--` eingeben; ein Name, den CSS nicht verwenden kann, wird markiert und nicht gespeichert
- **Einheit:** bei Zahlen `px`, `rem`, `%`, `ms`, `s`, `deg` oder keine; Werte werden in dieser Einheit eingegeben
- **Wert** oder **Werte:** einer pro Modus; eine Farbe öffnet die Farbauswahl. Die Variablen-Schaltfläche (**Variable verwenden**) neben einem Wert lässt ihn auf eine andere Variable desselben Typs verweisen, ein Alias, der dieser Variable folgt; **Variable lösen** macht daraus wieder den Wert, den er zeigte
- **CSS-Ausdruck:** bei Zahlen ein Wert wie `clamp(1rem, 4vw, 1.5rem)`, der in CSS anstelle der Zahl geschrieben wird, während die Arbeitsfläche weiterhin die Zahl zeichnet
- **Geltungsbereiche:** für welche Eigenschaften die Variable angeboten wird
- **Beschreibung**
- **Von Veröffentlichung ausblenden:** Dateien, die diese Datei als Bibliothek verwenden, sehen die Variable nicht

## Stylesheet

Unten im Dialog wird die aktive Sammlung als CSS-Custom-Properties angezeigt. Die Kopieren-Schaltfläche (**Alle Variablen als CSS kopieren**) kopiert die Variablen des gesamten Dokuments als CSS oder als Tailwind-v4-Theme (**Alle Variablen als Tailwind-Theme kopieren**), sodass Aliase auf andere Sammlungen aufgelöst werden.

## Design-Tokens importieren und exportieren

Variablen und Stile wandern als [W3C-Design-Tokens](https://www.designtokens.org/) zwischen OpenPencil, Figma und Code:

- **Exportieren:** Wähle im Kopiermenü des Stylesheets **Als Design-Tokens exportieren**. Das ZIP enthält je Modus einer Sammlung eine Datei, die Figma als Modus importiert, Text- und Effektstile als Typografie- und Schatten-Tokens sowie einen Resolver, der alles für Werkzeuge wie Style Dictionary zusammenführt
- **Importieren:** Klicke in der Werkzeugleiste auf **Design-Tokens importieren** und wähle Token-Dateien oder ein ZIP. Dateien aus Figma, ein Resolver mit den Dateien, die er nennt, und Tokens-Studio-Themes funktionieren
- **Ziel wählen:** Bevor sich etwas ändert, zeigt der Dialog jede gefundene Sammlung und jeden Modus und wohin sie gehen: in eine neue Sammlung oder einen neuen Modus, in einen vorhandenen oder nirgendwohin. Variablen und Stile mit demselben Namen werden aktualisiert, der Rest wird hinzugefügt; nichts wird gelöscht. Er zählt, was hinzugefügt, aktualisiert und übersprungen wird, und nennt für jedes übersprungene Token den Grund
- Der Import ist ein Schritt: **Rückgängig** nimmt ihn ganz zurück

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
