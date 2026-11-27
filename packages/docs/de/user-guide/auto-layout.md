---
pageClass: guide
title: Auto-Layout
description: Rahmen bauen, die ihre Ebenen anordnen und mit dem Inhalt mitwachsen.
---

# Auto-Layout

Mit Auto-Layout ordnet ein Rahmen die Ebenen in ihm selbst an. Bearbeitest du einen Text, fügst eine Zeile hinzu oder blendest eine Ebene aus, rückt alles andere passend nach. Nutze es für Buttons, Listen, Karten und ganze Screens.

<GuidePair>

<GuideImage name="auto-layout/before" alt="Eine Playlist-Karte mit zwei Songs" caption="Zwei Songs" />
<GuideImage name="auto-layout/after" alt="Eine höhere Playlist-Karte mit drei Songs" caption="Füg einen hinzu, und die Karte wächst mit" />

</GuidePair>

## Auto-Layout hinzufügen

1. Wähle einen Rahmen aus oder die Ebenen, die du anordnen willst.
2. Drücke <Keys mac="⇧ A" other="Shift A" />.

Ein Rahmen beginnt, seine Ebenen anzuordnen. Lose Ebenen werden in einen neuen Rahmen gepackt. Drückst du auf dem Rahmen noch einmal <Keys mac="⇧ A" other="Shift A" />, schaltest du Auto-Layout wieder aus.

## Den Rahmen einrichten

Wähle den Rahmen aus und suche im Design-Panel nach **Auto-Layout**.

<GuideLegend>

<GuideImage name="auto-layout/panel" alt="Die Auto-Layout-Einstellungen mit sechs nummerierten Bedienelementen" />

1. **Fluss** ordnet Ebenen frei, vertikal, horizontal oder in einem Raster an.
2. **Layout umbrechen** schiebt Ebenen in eine neue Zeile, wenn der Platz nicht reicht.
3. **Sizing** legt fest, wie sich Breite und Höhe des Rahmens verhalten.
4. **Ausrichtung** platziert die Ebenen im Rahmen. Klicke auf einen Punkt.
5. **Abstand** ist der Platz zwischen den Ebenen. Wähle in seinem Menü **Automatisch**, um sie gleichmäßig zu verteilen.
6. **Padding** ist der Innenabstand zu den Rändern des Rahmens. Mit dem Button daneben legst du jede Seite einzeln fest.

</GuideLegend>

## Abstände auf der Arbeitsfläche ändern

Wähle den Rahmen aus und zeige auf einen Abstand oder einen Rand, um seine Größe zu sehen. Doppelklicke darauf, klicke dann auf den angezeigten Wert und gib einen neuen ein.

## Festlegen, wie Ebenen ihre Größe ändern

Wähle eine Ebene aus und öffne dann das Menü in ihrem Feld **W** oder **H**.

<GuideLegend>

<GuideImage name="auto-layout/sizing" alt="Das geöffnete Breitenmenü mit Fest, An Inhalt anpassen und Füllen" />

- **Fest** behält die Größe, die du eingestellt hast.
- **An Inhalt anpassen** passt sich dem Inhalt an.
- **Füllen** nimmt den verfügbaren Platz im übergeordneten Rahmen ein.

</GuideLegend>

Probiere für eine Listenzeile **Füllen** für die Breite und **An Inhalt anpassen** für die Höhe. Im selben Menü fügst du auch Mindest- und Höchstgrößen hinzu.

## Ebenen neu anordnen

Zieh eine Ebene an eine neue Stelle im Rahmen. Die blaue Linie zeigt, wo sie landet.

<GuidePair>

<GuideImage name="auto-layout/drag" alt="Der Zeiger zieht Low Tide, eine blaue Linie über Paper Lanterns" caption="Low Tide nach oben ziehen" />
<GuideImage name="auto-layout/drop" alt="Low Tide zwischen Slow Morning und Paper Lanterns" caption="Loslassen, und es rückt an seinen Platz" />

</GuidePair>

## Ebenen umbrechen

Schalte **Layout umbrechen** für Inhalte wie Tags ein, bei denen sich die Anzahl der Elemente ändert. Ein zweites Abstandsfeld legt den Platz zwischen den Zeilen fest.

<GuideImage name="auto-layout/wrap" alt="Sieben Tags, die über drei Zeilen fließen" />

## Ein Raster bauen

<GuideLegend>

<GuideImage name="auto-layout/grid-panel" alt="Spalten- und Zeileneinstellungen für ein Raster" />

1. Wähle den Rahmen aus und wähle unter **Fluss** die Option **Raster**.
2. Füge mit **+** neben **Spalten** und **Zeilen** Spuren hinzu.
3. Wähle **Füllen (fr)** für Spuren, die sich den Platz teilen, oder **Fest (px)** für eine feste Größe.
4. Lege unten die Abstände zwischen Spalten und Zeilen fest.

</GuideLegend>

<GuideImage name="auto-layout/grid" alt="Sechs Albumcover in drei Spalten und zwei Zeilen" />

## Eine Ebene frei platzieren

Manche Ebenen, etwa ein Badge in einer Ecke, sollen nicht mit dem Rest angeordnet werden.

1. Wähle die Ebene aus.
2. Klicke neben **Position** auf **Auto-Layout ignorieren**.
3. Zieh sie an eine beliebige Stelle im Rahmen.

Du kannst beim Ziehen auch <Keys mac="⌃" other="Ctrl" /> gedrückt halten. Die Ebene landet dann im Rahmen unter dem Zeiger.
