---
pageClass: guide
title: Auswahl & Bearbeitung
description: Ebenen auswählen und dann verschieben, skalieren, drehen, kopieren und mehrere auf einmal bearbeiten.
---

# Auswahl & Bearbeitung

Um eine Ebene zu ändern, wähle sie zuerst aus. Das Design-Panel zeigt dann ihre Einstellungen, und mit den Griffen um sie herum kannst du sie skalieren und drehen.

## Eine Ebene auswählen

Klick auf eine Ebene auf der Arbeitsfläche. In einem Rahmen wählt ein Klick eine Ebene direkt im Rahmen aus, etwa eine Zeile einer Liste. Doppelklicke, um eine Ebene tiefer zu gehen.

<GuidePair>

<GuideImage name="selection-and-manipulation/click" alt="Die Zeile Paper Lanterns in einer Playlist-Karte ist ausgewählt" caption="Ein Klick wählt die Zeile aus" />
<GuideImage name="selection-and-manipulation/double-click" alt="Titel und Interpret in der Zeile sind ausgewählt" caption="Ein Doppelklick geht in sie hinein" />

</GuidePair>

Um direkt die Ebene unter dem Mauszeiger zu erreichen, halte <Keys mac="⌘" other="Ctrl" /> und klick. Um nichts auszuwählen, klick auf eine leere Stelle der Arbeitsfläche oder drück <Keys mac="Esc" other="Esc" />.

## Mehrere Ebenen auswählen

- Halte <Keys mac="⇧" other="Shift" /> und klick auf Ebenen, um sie zur Auswahl hinzuzufügen oder aus ihr zu entfernen.
- Zieh von einer leeren Stelle aus über die Arbeitsfläche, um ein Rechteck aufzuziehen. Die Ebenen, die es berührt, werden ausgewählt. Ein Rahmen auf der Seite wird nur ausgewählt, wenn das Rechteck ihn ganz abdeckt.
- Drücke <Keys mac="⌘ A" other="Ctrl A" />, um alles auf der Seite auszuwählen.

<GuideImage name="selection-and-manipulation/marquee" alt="Ein Auswahlrechteck über zwei Zeilen einer Playlist-Karte" />

## Mit der Tastatur auswählen

- <Keys mac="Enter" other="Enter" /> wählt die Ebenen in der ausgewählten Ebene aus.
- <Keys mac="⇧ Enter" other="Shift Enter" /> wählt die Ebene aus, die sie enthält.
- <Keys mac="Tab" other="Tab" /> und <Keys mac="⇧ Tab" other="Shift Tab" /> wählen die nächste und vorherige Ebene auf derselben Ebene der Hierarchie aus.

## Ebenen verschieben

Zieh eine ausgewählte Ebene. Die Pfeiltasten verschieben sie um ein Pixel, mit <Keys mac="⇧" other="Shift" /> um zehn.

- Halte beim Ziehen <Keys mac="⇧" other="Shift" />, um geradlinig zu verschieben.
- Lass die Ebene über einem Rahmen los, um sie in ihn zu legen. Zieh sie aus dem Rahmen heraus, um sie herauszunehmen.
- Halte beim Ziehen <Keys mac="Space" other="Space" />, damit die Ebene in ihrem Rahmen bleibt.

## Skalieren und drehen

<GuideLegend>

<GuideImage name="selection-and-manipulation/handles" alt="Eine ausgewählte Karte mit drei nummerierten Teilen: einem Eckgriff, dem Drehgriff und der Größe" />

1. Zieh an einem **Griff**, um zu skalieren. Halte an einer Ecke <Keys mac="⇧" other="Shift" />, um die Proportionen beizubehalten.
2. Zieh am **Drehgriff**, um zu drehen, oder zeig knapp neben eine Ecke und zieh. Halte <Keys mac="⇧" other="Shift" />, um in 15°-Schritten zu drehen.
3. Die **Größe** wird angezeigt, solange die Ebene ausgewählt ist.

</GuideLegend>

Um eine genaue Größe oder einen Winkel einzugeben, verwende **W**, **H** und das Winkelfeld im Design-Panel. <Keys mac="⇧ H" other="Shift H" /> und <Keys mac="⇧ V" other="Shift V" /> spiegeln die Auswahl waagerecht oder senkrecht.

## Kopieren, einfügen und löschen

- <Keys mac="⌘ D" other="Ctrl D" /> erstellt eine Kopie neben dem Original.
- Halte beim Ziehen <Keys mac="⌥" other="Alt" />, um eine Kopie herauszuziehen.
- <Keys mac="⌘ C" other="Ctrl C" /> und <Keys mac="⌘ V" other="Ctrl V" /> kopieren und fügen ein. Eine eingefügte Ebene behält ihre Position; um unter dem Mauszeiger einzufügen, klick mit der rechten Maustaste und wähle **Hier einfügen**.
- <Keys mac="⇧ ⌘ R" other="Ctrl Shift R" /> fügt anstelle der ausgewählten Ebenen ein.
- <Keys mac="⌫" other="Delete" /> löscht die Auswahl.

Text, den du von einer Webseite kopierst, wird als eine Textebene eingefügt. Kopierst du einen Teil des Layouts einer Seite, etwa eine Karte, bietet ein Hinweis **Als Ebenen einfügen** an, um ihn als Rahmen und Text nachzubauen.

## Das Aussehen einer Ebene kopieren

<Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> kopiert, wie eine Ebene aussieht, und <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> gibt dieses Aussehen jeder ausgewählten Ebene. Das funktioniert auch mit Ebenen, die du in Figma kopiert hast.

Zum Aussehen gehören Füllungen, Konturen, Effekte, Deckkraft, Mischmodus, Eckenradius und die Stile und Variablen, die sie verwenden. Zwischen Rahmen gehört Auto-Layout dazu, zwischen Textebenen der Textstil. Position, Größe, Name und Inhalt bleiben, wie sie sind.

## Ebenen gruppieren

- <Keys mac="⌘ G" other="Ctrl G" /> gruppiert die Auswahl.
- <Keys mac="⌥ ⌘ G" other="Ctrl Alt G" /> legt sie stattdessen in einen neuen Rahmen.
- <Keys mac="⇧ ⌘ G" other="Ctrl Shift G" /> löst eine Gruppe, einen Rahmen oder einen Abschnitt auf und lässt die Ebenen, wo sie sind.

Um Ebenen in einer Zeile oder Spalte anzuordnen, verwende stattdessen [Auto-Layout](./auto-layout).

## Eine Ebene durch eine Form zeigen

Leg die Form unter die Ebenen, die sie ausschneiden soll, wähle alle aus und drück <Keys mac="⌥ ⌘ M" other="Ctrl Alt M" />. Die unterste Ebene wird zur Maske: Die Ebenen darüber sind nur innerhalb von ihr zu sehen, etwa ein Foto in einem Kreis. Drücke die Tasten noch einmal, um die Maske auszuschalten.

## Ebenen nach vorn oder hinten stellen

Ebenen weiter oben in der [Ebenenliste](./layers-and-pages) verdecken die darunter.

- <Keys mac="]" other="]" /> bringt die Auswahl ganz nach vorn, und <Keys mac="[" other="[" /> schickt sie ganz nach hinten.
- <Keys mac="⌘ ]" other="Ctrl ]" /> und <Keys mac="⌘ [" other="Ctrl [" /> verschieben sie um eine Stufe.

## Ebenen ausblenden und sperren

- <Keys mac="⇧ ⌘ H" other="Ctrl Shift H" /> blendet die Auswahl aus oder wieder ein. Ausgeblendete Ebenen bleiben in der Ebenenliste.
- <Keys mac="⇧ ⌘ L" other="Ctrl Shift L" /> sperrt sie. Eine gesperrte Ebene kannst du auf der Arbeitsfläche weder auswählen noch verschieben; wähle sie stattdessen in der Ebenenliste aus.

## Mehrere Ebenen auf einmal bearbeiten

Sind mehrere Ebenen ausgewählt, zeigt das Design-Panel die Einstellungen, die sie gemeinsam haben. **Gemischt** markiert eine Einstellung, die sich zwischen ihnen unterscheidet. Änderst du eine Einstellung, ändert sie sich für alle.

<GuideImage name="selection-and-manipulation/several" alt="Das Design-Panel für zwei ausgewählte Zeilen, mit Y auf Gemischt" />

<GuideLegend>

<GuideImage name="selection-and-manipulation/selection-colors" alt="Auswahlfarben mit vier Farben" />

**Auswahlfarben** listet jede Farbe in der Auswahl auf, auch die der Ebenen darin. Ändere hier eine Farbe, um sie überall zu ändern, wo sie verwendet wird.

</GuideLegend>
