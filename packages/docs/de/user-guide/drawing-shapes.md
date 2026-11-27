---
pageClass: guide
title: Formen zeichnen
description: Rechtecke, Ellipsen, Linien, Polygone, Sterne, Rahmen und Abschnitte zeichnen, dann einfärben und mit Konturen, Schatten und Unschärfen versehen.
---

# Formen zeichnen

Die Formwerkzeuge findest du in der Werkzeugleiste unten im Fenster. Wähle eines aus und zieh dann auf der Arbeitsfläche.

## Eine Form zeichnen

1. Drücke <Keys mac="R" other="R" /> für ein Rechteck, <Keys mac="O" other="O" /> für eine Ellipse oder <Keys mac="L" other="L" /> für eine Linie. Polygone und Sterne stecken im Formmenü: Klicke auf den Pfeil neben dem Rechteck.
2. Zieh auf der Arbeitsfläche. Halte <Keys mac="⇧" other="Shift" /> gedrückt, um ein Quadrat oder einen Kreis zu zeichnen oder eine Linie in 45°-Schritten zu halten.
3. Lass los. Die neue Form bleibt ausgewählt, und die Werkzeugleiste springt zurück auf **Verschieben**.

<GuideImage name="drawing-shapes/tools" alt="Das geöffnete Formmenü in der Werkzeugleiste mit Rechteck, Linie, Ellipse, Polygon und Stern" />

Ein Klick ohne Ziehen erzeugt eine Form von 100 × 100 oder eine Linie mit der Länge 100. Beginnst du in einem Rahmen, landet die Form darin.

## Ecken abrunden

Zeige auf ein ausgewähltes Rechteck: In jeder Ecke erscheint ein Punkt. Zieh einen davon, um die Ecken abzurunden: alle, solange sie gleich sind, oder nur diese eine, wenn sie sich unterscheiden. Halte <Keys mac="⌥" other="Alt" /> gedrückt, um das Gegenteil zu tun, und <Keys mac="⇧" other="Shift" />, um in 10er-Schritten zu gehen.

Um einen Radius einzutippen, nutze **Radius** im Design-Panel. Der Button daneben legt jede Ecke einzeln fest. **Eckenglättung** lässt die Rundung früher beginnen, wie bei einem App-Symbol.

Ein Polygon oder Stern hat einen Radiuspunkt unter seiner oberen Spitze und zwei weitere:

- Zieh den Punkt auf der nächsten Spitze um die Mitte herum, um die Anzahl der Spitzen zu ändern.
- Zieh den Punkt auf der ersten inneren Spitze eines Sterns nach innen oder außen, um den Stern schlanker oder voller zu machen.

**Anzahl** und **Verhältnis** im Design-Panel tun dasselbe. Die Punkte sind ausgeblendet, solange die Form auf dem Bildschirm kleiner als etwa 108 Pixel ist: Zoome hinein, um sie zu erreichen.

<GuidePair>

<GuideImage name="drawing-shapes/corners" alt="Ein ausgewähltes Rechteck mit einem Punkt in jeder Ecke" caption="Eckpunkte an einem Rechteck" />
<GuideImage name="drawing-shapes/star" alt="Ein ausgewählter Stern mit Punkten für Radius, Anzahl der Spitzen und Verhältnis" caption="Punkte für Radius, Spitzen und Verhältnis an einem Stern" />

</GuidePair>

## Eine Form einfärben

Klicke unter **Füllung** auf das Farbquadrat. Die Buttons oben in der Auswahl legen von links nach rechts die Art der Füllung fest:

<GuideLegend>

<GuideImage name="drawing-shapes/fill" alt="Die Füllungsauswahl auf dem Verlaufs-Button mit einem violetten linearen Verlauf und seinen zwei Farbstopps" />

- **Vollton**: eine Farbe. Gib im Panel einen Hex-Wert ein oder nimm mit der Pipette eine Farbe von der Arbeitsfläche auf.
- **Verlauf**: linear, radial, Winkel oder Raute. Solange die Auswahl offen ist, zeigt die Arbeitsfläche die Griffe des Verlaufs. Zieh ein Ende, um es zu verschieben, mit <Keys mac="⇧" other="Shift" /> drehst du es in 15°-Schritten, und zieh das Quadrat eines Farbstopps, um den Stopp zu verschieben.
- **Bild**: ein Bild von deinem Computer oder ein [Stockfoto](./photos). Es kann die Form ausfüllen (**Fill**), einpassen (**Fit**), zuschneiden (**Crop**) oder kacheln (**Tile**), und die Regler passen Belichtung, Kontrast und mehr an.
- **Shader**: ein bewegter Effekt, etwa **Aurora**. Die Arbeitsfläche zeigt ein Standbild, abgespielt wird er in der Vorschau: Klicke oben rechts im Fenster auf **▷** oder drücke <Keys mac="⌘ ⌥ Enter" other="Ctrl Alt Enter" />. Klicke auf **{ }**, um eine von shaders.com kopierte Voreinstellung einzufügen.

</GuideLegend>

Klicke neben **Füllung** auf **+**, um eine weitere Füllung darüberzulegen. Das Auge blendet eine Füllung aus, und **−** entfernt sie.

## Eine Kontur hinzufügen

Klicke neben **Kontur** auf **+**. Dann:

- **Innen**, **Mitte** oder **Außen** legt fest, wo die Linie an der Kante sitzt.
- **W** legt die Stärke fest. Der Button mit den vier Quadraten legt die Stärke jeder Seite einzeln fest.
- Der Einstellungs-Button daneben schaltet eine gestrichelte Linie ein und legt fest, wie Enden und Ecken der Linie aussehen. Ein offener Pfad kann in einem Pfeil enden.

## Schatten und Unschärfen hinzufügen

Klicke neben **Effekte** auf **+** und wähle dann die Art des Effekts:

<GuideLegend>

<GuideImage name="drawing-shapes/effects" alt="Die Liste der Effekte: Schlagschatten, innerer Schatten, Ebenenunschärfe, Hintergrundunschärfe, Vordergrund-Weichzeichnung, Rauschen, Textur und Glas" />

- **Schlagschatten** und **Innerer Schatten**: ein Schatten außerhalb oder innerhalb der Form.
- **Ebenenunschärfe** macht die Form unscharf, **Hintergrundunschärfe** das, was dahinter liegt, wie Milchglas, und **Vordergrund-Weichzeichnung** das, was davor liegt. Eine Unschärfe ist **Gleichmäßig** oder **Progressiv**, dann geht sie von scharf zu unscharf über.
- **Rauschen** und **Textur**: Körnung über der Form.
- **Glas**: bricht und beleuchtet, was hinter der Form liegt, wie eine Linse.

</GuideLegend>

Klicke auf das Quadrat neben einem Effekt, um seine Einstellungen zu ändern. Eine Form kann mehrere Effekte haben, aber nur ein Glas und eine Textur.

## Einen Rahmen zeichnen

Ein Rahmen enthält andere Ebenen: einen Screen, eine Karte oder einen Button. Drücke <Keys mac="F" other="F" /> oder <Keys mac="A" other="A" /> und zieh.

- Ebenen, die der neue Rahmen vollständig überdeckt, landen darin.
- Für einen Rahmen in der Größe eines Smartphone-, Tablet- oder Desktop-Bildschirms wählst du bei aktivem Rahmenwerkzeug eine Größe im Design-Panel. Ist ein Rahmen ausgewählt, ändert **Frame** im Design-Panel seine Größe auf dieselbe Weise.
- Ein Rahmen blendet aus, was über ihn hinausragt. Schalte **Inhalt zuschneiden** aus, um es zu zeigen.
- Um den Inhalt eines Rahmens in Zeilen oder Spalten anzuordnen, nutze [Auto-Layout](./auto-layout).

## Bereiche mit Abschnitten gruppieren

Ein Abschnitt markiert einen Bereich der Seite, etwa einen Ablauf oder eine Reihe von Screens. Drücke <Keys mac="⇧ S" other="Shift S" /> und zieh um die Ebenen herum.

Ebenen, die ein Abschnitt vollständig überdeckt, landen darin, auch wenn du den Abschnitt später verschiebst oder seine Größe änderst. Abschnitte bleiben auf der obersten Ebene der Seite: Sie können nicht in einen Rahmen. Zieh am Namen eines Abschnitts, um ihn zu verschieben.

## Die Werkzeugleiste anpassen

Klicke mit der rechten Maustaste auf die Werkzeugleiste und wähle **Werkzeugleiste anpassen…**. Dieselben Einstellungen findest du unter **Einstellungen → Editor**.

- Schalte ein Werkzeug aus, um es auszublenden. Sein Tastenkürzel funktioniert weiterhin.
- Zieh ein Werkzeug, um es zu verschieben. Lass es in einem Kasten los, um es in dieses Menü zu legen, zwischen Kästen, um ihm einen eigenen Button zu geben, oder auf einem anderen Werkzeug, um beide in ein Menü zu legen.
- **Auf Standard zurücksetzen** stellt alles wieder her.

Werkzeuge, die in einer späteren Version hinzukommen, landen an ihrem üblichen Platz, auch in einer Werkzeugleiste, die du geändert hast.
