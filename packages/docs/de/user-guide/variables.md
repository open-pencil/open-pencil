---
pageClass: guide
title: Variablen
description: Farben, Größen und andere Werte an einem Ort verwalten, mit Modi umschalten und als CSS oder Design-Tokens in den Code übernehmen.
---

# Variablen

Eine Variable ist ein benannter Wert, etwa eine Markenfarbe oder ein Eckenradius, den Ebenen statt einer eigenen Zahl verwenden. Änderst du die Variable, ändert sich jede Ebene, die sie verwendet. Modi geben denselben Variablen andere Werte, etwa für ein dunkles Thema.

## Variablen öffnen

Wähle **Ansicht → Variablen…** oder klicke auf eine leere Stelle der Arbeitsfläche und öffne im Design-Panel **Variablen**.

<GuideImage name="variables/dialog" alt="Das Fenster Variablen mit der Sammlung Theme, vier Variablen in Light und Dark, den Sammlungseinstellungen und dem Stylesheet" />

1. **Sammlungen** gruppieren Variablen, etwa Farben oder Abstände.
2. Jede **Variable** hat in jedem Modus einen Wert, in Spalten.
3. **Einstellungen** für die ausgewählte Variable oder, wenn keine ausgewählt ist, für die Sammlung.
4. Das **Stylesheet** zeigt die Sammlung als CSS.

**Erweitern** in der Ecke des Fensters gibt ihm den Großteil des Bildschirms. In einem schmalen Fenster oder auf einem Smartphone zeigt es jeweils einen Modus.

## Eine Variable erstellen

1. Klicke auf **Variable erstellen** und wähle einen Typ: Farbe, Zahl, Text, Wahr/Falsch, Easing oder Timing.
2. Gib einen Namen ein. Schrägstriche legen sie in eine Gruppe: `Brand/Primary` erscheint als **Primary** unter **Brand**.
3. Lege ihren Wert in jedem Modus fest.

Rechts kannst du außerdem einstellen:

- **CSS-Name**, den das Stylesheet verwendet. Bleibt er leer, ergibt er sich aus dem Namen, etwa `--color-brand-primary`.
- **Einheit** für Zahlen: `px`, `rem`, `%`, `ms`, `s`, `deg` oder keine.
- **Geltungsbereiche**, also die Einstellungen, die die Variable anbieten.
- **Beschreibung** und **Von Veröffentlichung ausblenden**, um sie aus [Bibliotheken](./component-libraries) herauszuhalten.

Damit eine Variable einer anderen folgt, klicke auf den Variablen-Button neben ihrem Wert und wähle die andere aus. **Variable lösen** macht daraus wieder einen einfachen Wert.

## Eine Variable verwenden

<GuideLegend>

<GuideImage name="variables/apply" alt="Die Zeile Füllung einer ausgewählten Ebene mit geöffnetem Button Variable anwenden, der die Theme-Farben auflistet" />

1. Wähle eine Ebene aus.
2. Klicke neben einer Einstellung auf **Variable anwenden**, etwa bei einer Füllfarbe, einem Eckenradius oder einem Abstand.
3. Wähle eine Variable.

</GuideLegend>

Die Einstellung zeigt dann den Namen der Variablen. Um wieder einen einfachen Wert zu verwenden, klicke auf **Variable anwenden** und wähle **Variable lösen**.

## Modi verwenden

Eine Sammlung kann mehrere Modi haben, etwa **Light** und **Dark**. Jede Variable darin hat in jedem Modus einen Wert.

- Um einen Modus hinzuzufügen, klicke in den Einstellungen der Sammlung neben **Modi** auf **+**.
- Um einen umzubenennen, bearbeite seinen Namen. Über das Menü **⋯** daneben duplizierst du ihn, machst ihn zum Standard oder löschst ihn.

<GuideLegend>

<GuideImage name="variables/mode" alt="Die geöffnete Einstellung Theme unter Darstellung mit Automatisch, Light und Dark" />

Um einen Rahmen in einem anderen Modus zu zeigen, wähle ihn aus und wähle den Modus unter **Darstellung**. Die Ebenen darin folgen, außer sie haben einen eigenen Modus. **Automatisch** übernimmt den Modus der umgebenden Ebene.

</GuideLegend>

Für den Code legt **Gilt wenn** fest, wann ein Modus greift. Darunter steht das CSS, das daraus entsteht:

| Gilt wenn | CSS |
| --- | --- |
| **manuell umgeschaltet wird** | ein Attribut an einem Element, etwa `[data-theme="dark"]` |
| **das System im Dunkelmodus ist** | `@media (prefers-color-scheme: dark)` |
| **das System im Hellmodus ist** | `@media (prefers-color-scheme: light)` |
| **hoher Kontrast aktiv ist** | `@media (prefers-contrast: more)` |
| **reduzierte Bewegung aktiv ist** | `@media (prefers-reduced-motion: reduce)` |
| **der Bildschirm schmaler ist als** eine Breite | `@media (max-width: 640px)` |
| **der Bildschirm breiter ist als** eine Breite | `@media (min-width: 640px)` |
| **der Container schmaler ist als** eine Breite | `@container (max-width: 640px)` |
| **der Container breiter ist als** eine Breite | `@container (min-width: 640px)` |
| **Benutzerdefiniertes CSS** | ein beliebiger Selektor oder eine `@media`-, `@supports`- oder `@container`-Abfrage |

Der Standardmodus ist immer aktiv und landet in `:root`. Das **Umschalt-Attribut** einer Sammlung, standardmäßig `data-theme`, ist das Attribut, das ihre manuellen Modi einschaltet. Passe es an deinen Code an, etwa auf `data-color-scheme`.

Ebenen mit einem manuellen Modus werden mit dessen Attribut exportiert. Ebenen mit einem Modus, der an eine andere Bedingung geknüpft ist, werden mit einfachen Werten exportiert, weil das Stylesheet entscheidet, wann dieser Modus gilt.

## Variablen organisieren

- **Sammlungen:** Klicke neben **Sammlungen** auf **+**, um eine hinzuzufügen. Ist keine Variable ausgewählt, benennst du rechts die Sammlung um, und über ihr Menü **⋯** löschst du sie.
- **Finden:** Tippe ins Suchfeld, um nach Name, CSS-Name, Beschreibung oder Wert zu filtern. Klicke auf eine Gruppe, um nur diese Gruppe zu zeigen, oder nutze den Filter-Button, um nur bestimmte Typen zu sehen.
- **Auswählen:** Klicke auf eine Zeile oder nutze die Pfeiltasten. <Keys mac="⇧" other="Shift" />-Klick wählt einen Bereich aus, <Keys mac="⌘" other="Ctrl" />-Klick fügt eine Zeile hinzu.
- **Direkt bearbeiten:** Doppelklicke in der Liste auf einen Namen, eine Zahl oder einen Text.
- **Verschieben und löschen:** Klicke mit der rechten Maustaste, um umzubenennen, zu duplizieren, in eine Gruppe zu verschieben oder zu löschen. Zieh Zeilen, um ihre Reihenfolge zu ändern.
- **Rückgängig:** <Keys mac="⌘ Z" other="Ctrl Z" /> funktioniert hier genauso wie auf der Arbeitsfläche.

## Eine Formel schreiben

Der Wert einer Zahl kann eine Formel über andere Variablen sein, etwa `space/base * 4`. Fang an, den Namen einer Variablen zu tippen, und wähle sie aus, oder wähle **Variable verwenden**. Das Feld zeigt das Ergebnis, etwa `= 16px`. Bei anderen Typen wählst du neben dem Wert **Formel verwenden**.

- Zahlen verwenden `+`, `-`, `*`, `/` und Klammern.
- Wahr/Falsch-Werte verwenden `and`, `or` und `not` und vergleichen mit `==`, `!=`, `<`, `<=`, `>` und `>=`: `viewport > 1024 and not loading`.
- Text steht in doppelten Anführungszeichen, und `+` hängt ihn zusammen: `"Hello, " + name`. `text(count)` schreibt eine Zahl so, wie Figma es tut.
- `if(condition, then, otherwise)` wählt zwischen zwei Werten: `if(dark, gray/900, #FFFFFF)`.
- `truthy(value)` ist falsch für `0`, leeren Text, `false`, `no` und `off`.

Fehler, etwa ein unbekannter Name oder eine Schleife, werden angezeigt, wenn du das Feld verlässt, und der alte Wert bleibt erhalten. Benennst du eine Variable um, funktionieren die Formeln, die sie verwenden, weiter.

Im Stylesheet wird eine Zahlenformel zu `calc()`. Formeln mit `if()`, Text oder Wahr/Falsch-Werten lassen sich nicht als CSS schreiben und werden weggelassen.

Eine Zahl kann außerdem einen **CSS-Ausdruck** haben, der sie nur im Code ersetzt, etwa `clamp(1rem, 4vw, var(--spacing-md))`. Füge ihn über das Menü **⋯** des Werts hinzu.

## Easing- und Timing-Variablen

Easing- und Timing-Variablen beschreiben Bewegung: wie lange eine Änderung dauert und wie sie beschleunigt und abbremst. [Übergänge von Komponenten](./components#eine-komponente-wie-ein-bedienelement-funktionieren-lassen) können ihnen folgen, sodass ein Modus **Reduced motion** jeden Übergang auf einmal verkürzen kann.

- **Timing** ist eine Dauer, angegeben in Millisekunden, etwa `250ms`, oder in Sekunden, etwa `0.25s`.
- **Easing** ist eine Kurve oder eine Feder. Klicke darauf, um den Editor zu öffnen:
  - **Kurve:** Wähle ein Easing oder **Eigene Bézierkurve**, zieh dann die beiden Griffe oder gib die Zahlen ein. **Kurve spiegeln** spielt sie rückwärts ab.
  - **Feder:** Wähle Sanft, Schnell, Federnd, Langsam oder **Eigene Feder**. Zieh den ersten Überschwinger unter **Zeit** oder stelle Steifigkeit, Dämpfung und Masse unter **Physik** ein.

In CSS wird ein Timing in Millisekunden geschrieben und eine Kurve als Timing-Funktion, etwa `cubic-bezier(0.45, 1.45, 0.8, 1)`. Federn haben dort keine CSS-Form und werden weggelassen.

## Variablen als Code kopieren

Der Kopieren-Button über dem Stylesheet kopiert jede Sammlung als CSS oder als Tailwind-v4-Theme.

## Design-Tokens importieren und exportieren

Variablen und Stile wandern als [Design-Tokens](https://www.designtokens.org/) zwischen OpenPencil, Figma und Code.

- **Export:** Wähle im Kopieren-Menü des Stylesheets **Als Design-Tokens exportieren**. Du bekommst ein ZIP mit einer Datei pro Modus, die Figma jeweils als Modus importiert, sowie den Text- und Effektstilen.
- **Import:** Klicke oben im Fenster auf **Design-Tokens importieren** und wähle Token-Dateien oder ein ZIP. Dateien aus Figma und Tokens Studio funktionieren.

Vor dem Import zeigt das Fenster, wohin jede Sammlung und jeder Modus geht: in eine neue, in eine bestehende oder nirgendwohin. Variablen mit demselben Namen werden aktualisiert, die übrigen hinzugefügt, und nichts wird gelöscht. **Rückgängig** nimmt den ganzen Import zurück.
