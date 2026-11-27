---
pageClass: guide
title: Komponenten
description: Wiederverwendbare Komponenten anlegen, Instanzen platzieren, Varianten und Eigenschaften hinzufügen und Komponenten zu funktionierenden Bedienelementen machen.
---

# Komponenten

Eine Komponente ist ein Stück Design, das du immer wieder verwendest, etwa ein Button oder eine Karte. Ihre Kopien heißen Instanzen. Änderst du die Komponente, ändert sich jede Instanz mit.

<GuideLegend>

<GuideImage name="components/overview" alt="Eine Button-Komponente mit zwei Varianten in einem gestrichelten Kasten und daneben eine Instanz „Publish“" />

1. Ein **Komponentensatz** enthält die Varianten einer Komponente. Er hat einen gestrichelten violetten Rahmen.
2. Jede **Variante** ist eine eigene Komponente. Ihr Name, etwa **Variant=Primary**, steht über ihr.
3. Eine **Instanz** ist eine Kopie, die du in dein Design setzt. Sie behält ihren eigenen Text, hier **Publish**.

</GuideLegend>

## Eine Komponente erstellen

1. Wähle einen Rahmen aus oder die Ebenen, die du wiederverwenden willst.
2. Drücke <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" />.

Ein Rahmen oder eine Gruppe wird selbst zur Komponente. Andere Ebenen werden in eine neue Komponente gepackt. Komponenten zeigen ihren Namen in Violett über sich auf der Arbeitsfläche.

## Eine Instanz platzieren

Öffne **Elemente** oben im linken Panel. Dort stehen die Komponenten deiner Datei, nach Seiten geordnet, und die aus den Bibliotheken, die du eingeschaltet hast.

<GuideLegend>

<GuideImage name="components/assets" alt="Das Elemente-Panel mit den Komponenten Button und Switch" />

- Klicke auf eine Komponente, um sie zu platzieren, oder zieh sie auf die Arbeitsfläche.
- Tippe ins Suchfeld, um eine Komponente nach Namen zu finden.
- Die Buttons neben der Suche wechseln zwischen Raster und Liste und öffnen die [Bibliotheken](./component-libraries).

</GuideLegend>

Du kannst auch mit der rechten Maustaste auf eine Komponente auf der Arbeitsfläche klicken und **Instanz erstellen** wählen oder auf ihr <Keys mac="⌘ D" other="Ctrl D" /> drücken.

## Alle Instanzen ändern

Bearbeite die Komponente: ihre Größe, Farben, Texte, ihr Layout oder die Ebenen in ihr. Jede Instanz zieht mit, außer dort, wo du die Instanz selbst geändert hast.

Um die Komponente zu finden, aus der eine Instanz stammt, klicke mit der rechten Maustaste auf die Instanz und wähle **Zur Hauptkomponente**. OpenPencil öffnet ihre Seite und wählt sie aus.

## Eine einzelne Instanz ändern

Wähle eine Instanz aus und ändere sie wie jede andere Ebene: Bearbeite ihren Text, tausche eine Farbe aus oder blende eine Ebene in ihr aus. Diese Änderungen bleiben erhalten, wenn sich die Komponente ändert, und alles andere folgt weiter der Komponente.

Manches kommt immer aus der Komponente: wo jede Ebene in der Instanz sitzt, ihre Drehung und ihre Einschränkungen.

Um eine Instanz von ihrer Komponente zu lösen, drücke <Keys mac="⌥ ⌘ B" other="Ctrl Alt B" />. Sie wird zu einem einfachen Rahmen, der genauso aussieht.

## Varianten anlegen

Varianten sind Versionen einer Komponente, etwa ein primärer und ein sekundärer Button oder ein Schalter, der an und aus ist.

1. Wähle eine Komponente aus.
2. Klicke oben im Design-Panel auf **Variante hinzufügen**. Die Komponente wird zu einem Satz, mit einer Kopie darunter.
3. Ändere die Kopie und gib ihr unter **Varianten** einen Namen.

Um Komponenten zusammenzufassen, die du schon hast, wähle sie aus und drücke <Keys mac="⇧ ⌘ K" other="Ctrl Shift K" />.

Eine Variante kann mehrere Eigenschaften haben, etwa **Size=Small, State=Hover**. Der Satz braucht nicht jede Kombination. Verlangt eine Instanz eine, die der Satz nicht hat, verwendet sie die Variante oben links.

## Eine Variante in einer Instanz wählen

<GuideLegend>

<GuideImage name="components/instance" alt="Komponenteneigenschaften einer Instanz: Label auf Publish und Variant auf Primary gesetzt" />

Wähle eine Instanz aus. **Komponenteneigenschaften** oben im Design-Panel zeigt, was du einstellen kannst: eine Variante wählen, ein Label eintippen oder eine Ebene ein- und ausschalten.

</GuideLegend>

## Eigenschaften hinzufügen

Eigenschaften sind die Einstellungen, die eine Instanz anbietet. Die Varianteneigenschaften eines Komponentensatzes sind schon da.

1. Wähle die Komponente aus.
2. Klicke neben **Eigenschaften** auf **+** und wähle eine Art:
   - **Text** legt die Wörter eines Labels fest.
   - **Boolean** blendet eine Ebene ein oder aus, etwa ein Symbol.
   - **Instanz austauschen** ersetzt eine verschachtelte Instanz, etwa das Symbol selbst.
   - **Variante** fügt einen weiteren Satz Varianten hinzu.
3. Verknüpfe eine Ebene damit. Wähle die Ebene in der Komponente aus und klicke neben ihrer Einstellung auf **Variable/Eigenschaft anwenden**: unter **Typografie** für Text, unter **Darstellung** fürs Ein- und Ausblenden oder oben im Panel für eine verschachtelte Instanz.

<GuideLegend>

<GuideImage name="components/property" alt="Die geöffnete Eigenschaft Label mit Name, Standardwert und der Ebene, die sie steuert" />

Klicke auf eine Eigenschaft, um sie umzubenennen, ihren Standardwert zu ändern, die Ebenen zu sehen, die sie steuert, oder sie zu löschen. Zieh Eigenschaften, um ihre Reihenfolge zu ändern.

</GuideLegend>

Um die eigenen Eigenschaften einer verschachtelten Instanz an den Instanzen deiner Komponente anzuzeigen, wähle **+ → Verschachtelte Instanzen** und hake sie an.

## Slots hinzufügen

Ein Slot ist ein Rahmen in einer Komponente, dessen Inhalt jede Instanz selbst füllt, etwa der Inhalt einer Karte oder die Einträge einer Liste.

1. Wähle einen Rahmen in der Komponente aus oder die Ebenen, die in einen gepackt werden sollen.
2. Klicke im Design-Panel auf **Slot erstellen** oder wähle **Objekt → Slot erstellen**.

In den Slot-Einstellungen legst du eine Beschreibung fest, die Komponenten, die der Slot bevorzugt, und wie viele Einträge er aufnimmt; eine Instanz außerhalb dieser Grenzen zeigt eine Warnung. In einer Instanz fügst du die Einträge eines Slots hinzu, ordnest sie um und entfernst sie oder setzt ihn auf den Inhalt der Komponente zurück.

## Eine Komponente wie ein Bedienelement funktionieren lassen

Ein Verhalten macht aus einer Komponente einen funktionierenden Button, Schalter, Schieberegler, Tab oder ein Textfeld, wenn du eine Vorschau deines Designs ansiehst. Die Bedienelemente stammen aus [Reka UI](https://reka-ui.com).

1. Wähle die Komponente oder den Komponentensatz aus.
2. Klicke neben **Verhalten** auf **+** und wähle ein Bedienelement.
3. Fülle die Zeilen aus, die es anzeigt.

<GuideLegend>

<GuideImage name="components/behaviour" alt="Der Abschnitt Verhalten für einen Switch, als Bereit markiert, mit Ausgewählt, An, Aus, Regler, Zustände und Übergang" />

- Die ersten Zeilen geben an, welche Eigenschaft den Wert enthält, etwa **Ausgewählt** bei einem Schalter, und welcher Slot jedes Teil zeichnet, etwa seinen **Regler**.
- **Zustände** ist die Varianteneigenschaft dafür, wie das Bedienelement aussieht: in Ruhe, unter dem Zeiger, gedrückt, fokussiert, deaktiviert und ungültig. **Zustandsvarianten hinzufügen** legt sie für dich an.
- **Übergang** lässt das Bedienelement weich zwischen den Zuständen wechseln. Dauer und Easing können [Timing- und Easing-Variablen](./variables#easing-und-timing-variablen) folgen.

</GuideLegend>

**Bereit** erscheint, sobald das Bedienelement funktioniert. Bis dahin sagt eine Zeile unter seinem Namen, was fehlt: Klicke darauf, um dorthin zu springen.

Um deine Bedienelemente auszuprobieren, drücke <Keys mac="⌥ ⌘ ↩" other="Ctrl Alt Enter" /> oder klicke neben **Teilen** auf ▶. Schalter schalten um, Schieberegler lassen sich ziehen, Tabs öffnen sich und Textfelder nehmen Eingaben an. Die Vorschau ändert deine Datei nicht. **Zurücksetzen** bringt jedes Bedienelement in den Ausgangszustand, und <Keys mac="Esc" other="Esc" /> führt zurück zum Bearbeiten.

Verhalten werden in `.fig`-Dateien gespeichert, und exportierte Vue-, React- und Storybook-Komponenten behalten sie, wobei jeder Übergang als CSS geschrieben wird.

## Komponenten zwischen Dateien teilen

Um dieselben Komponenten in mehreren Dateien zu verwenden, veröffentliche sie als [Komponentenbibliothek](./component-libraries).
