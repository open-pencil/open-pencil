---
pageClass: guide
title: Designs prüfen
description: Probleme bei Barrierefreiheit, Konsistenz und Struktur mit dem Prüfen-Panel und Problemmarkierungen auf der Arbeitsfläche finden.
---

# Designs prüfen

OpenPencil prüft die aktuelle Seite, während du arbeitest, und weist auf Ebenen hin, die gängige Designregeln verletzen: schwer lesbarer Text, Bedienelemente, die zum Antippen zu klein sind, Farben, die eine Variable verwenden sollten, und Abstände außerhalb der Skala.

## Probleme finden

Öffne im rechten Panel den Tab **Prüfen**. Sein Badge zeigt, wie viele Fehler und Warnungen die Seite hat.

<GuideImage name="checking-designs/lint" alt="Eine Registrierungskarte mit blassem, kleinem Text und einem kleinen Button, ihre Problemmarkierungen und das Prüfen-Panel mit geringem Kontrast, kleinem Text und einem kleinen Touch-Ziel" />

- **Seite** listet jedes Problem auf der aktuellen Seite auf; **Auswahl** beschränkt die Liste auf die ausgewählten Ebenen und alles darin; **Dokument** listet die Probleme aller Seiten auf und kennzeichnet die auf anderen Seiten. Ein Klick auf eines davon wechselt zu seiner Seite. Seiten einer großen `.fig`-Datei, die noch nicht geöffnet wurden, werden geprüft, sobald du sie öffnest.
- Die Probleme sind nach Regel gruppiert, die schwerwiegendsten zuerst. Fehler und Warnungen sind anfangs aufgeklappt, Vorschläge zugeklappt.
- Die Schweregrad-Buttons unter der Bereichsauswahl blenden Fehler, Warnungen und Vorschläge ein und aus.
- Zeige auf den Titel einer Gruppe, um zu lesen, was die Regel prüft und warum.

Zeige auf ein Problem, um seine Ebene auf der Arbeitsfläche hervorzuheben. Klicke darauf, um die Ebene auszuwählen; liegt sie außerhalb des Bildschirms, schwenkt die Arbeitsfläche zu ihr und zoomt nur dann heraus, wenn die Ebene nicht hineinpasst.

## Probleme beheben

Zeilen, die sich in einem Schritt beheben lassen, zeigen beim Darüberfahren einen Button:

- Eine fest eingetragene Farbe, die zu einer der Farbvariablen des Dokuments passt, wird an diese gebunden (Verknüpfungs-Button). Die Zeile nennt die Variable.
- Positionen und Größen mit Subpixeln werden auf ganze Pixel gerundet. Werte, die Auto-Layout oder die Größenänderung von Text festlegt, sowie Vektorgrafiken und die Teile von Gruppen bleiben unverändert.
- Eckenradius und Abstände außerhalb der Skala werden auf den nächsten Skalenwert geändert, und Text unter der Mindestgröße wächst auf diese an (Zauberstab-Button). Diese Korrekturen ändern das Design, daher werden sie zeilenweise angewendet.
- Eine Gruppe wird an Ort und Stelle in einen Rahmen umgewandelt und behält ihre Ebenen, Position und ihr Aussehen (Rahmen-Button), und eine ausgeblendete Ebene lässt sich löschen (Papierkorb-Button). Beides wird weder für gesperrte Ebenen angeboten noch für Ebenen in einer Komponente oder Instanz, deren Struktur zur Komponente gehört.

Das Binden von Farben und das Runden von Pixeln lässt das Design so aussehen, wie es ist, daher bieten ihre Gruppen auch **Bind all** oder **Fix all** an. Jede Korrektur ist ein einzelner Rückgängig-Schritt.

Andere Probleme zeigen den Wert, um den du dich kümmern solltest, etwa ein Kontrastverhältnis oder die Größe eines Touch-Ziels, damit du sie im Design-Panel beheben kannst.

## Probleme auf der Arbeitsfläche sehen

Markierungen auf der Arbeitsfläche, Zähler auf den Seiten und Kennzeichnungen im Ebenen-Panel bleiben aus, bis du sie einschaltest, damit eine Datei in einem neuen Profil nicht mit Warnungen übersät ist. Schalte sie mit **Ansicht → Designprobleme** ein oder aus oder mit **Probleme auf der Arbeitsfläche anzeigen** im Einstellungsmenü des Prüfen-Panels. Ein Profil, in dem die Wahl schon gespeichert ist, behält sie.

Solange sie eingeschaltet sind, tragen Ebenen mit Fehlern und Warnungen an ihrer oberen rechten Ecke eine Markierung: rot für Fehler, gelb für Warnungen. Vorschläge erscheinen nur im Prüfen-Panel.

- Zeige auf eine Markierung, um ihre Probleme zu sehen. Klicke darauf, um die Ebene auszuwählen und ihre Probleme im Prüfen-Panel zu öffnen.
- Markierungen, die sich überlappen würden, werden zu einer zusammengefasst, die ihre Gesamtzahl zeigt.
- Ist eine Ebene beim aktuellen Zoom zu klein, um sie zu sehen, wandert ihre Markierung zur nächsten umgebenden Ebene, die groß genug ist, um darauf zu zeigen.
- Fehler und Warnungen außerhalb des sichtbaren Bereichs der Arbeitsfläche werden an deren Rand angeheftet und zeigen in ihre Richtung. Zeige auf eine solche Markierung, um sie zu sehen; klicke darauf, um das nächstgelegene der schwerwiegendsten Probleme ins Bild zu holen und es im Prüfen-Panel zu öffnen.
- Ausgeblendete Ebenen und Ebenen, die ein Rahmen aus dem Sichtbereich abschneidet, behalten ihre Probleme im Panel, bekommen aber keine Markierung.

Seiten mit Fehlern oder Warnungen zeigen deren Anzahl in der Seitenliste; sie werden im Hintergrund geprüft, während du arbeitest. Das Ebenen-Panel kennzeichnet dieselben Ebenen: Eine Ebene mit Fehlern oder Warnungen zeigt das schwerwiegendste als Symbol, und eine zugeklappte Ebene mit Problemen darin zeigt einen Punkt. Diese Kennzeichnungen folgen demselben Schalter wie die Markierungen auf der Arbeitsfläche.

## Probleme im Code sehen

Der Tab Code unterstreicht Fehler und Warnungen im Design JSX, HTML, Vue oder React ihrer Ebenen, und zwar an der Eigenschaft, die das Problem verursacht, falls es eine gibt, etwa `size={10}` bei kleinem Text, oder an der Klasse, die die Ebene gestaltet. Zeige auf die Unterstreichung, um das Problem zu lesen. Die Seite wird geprüft, solange das Prüfen-Panel offen ist oder die Markierungen auf der Arbeitsfläche eingeschaltet sind, und die Unterstreichungen folgen dieser Prüfung und deinen Änderungen.

## Die Regeln wählen

Das Einstellungsmenü im Prüfen-Panel wechselt zwischen Regelvorgaben:

- **Empfohlen** — ausgewogene Standards für die tägliche Arbeit.
- **Streng** — jede Regel als Warnung oder Fehler.
- **Barrierefreiheit** — nur Kontrast, Größe von Touch-Zielen und Textgröße.

Schalte eine einzelne Regel über das Menü ihrer Gruppe aus. **Turn on turned-off rules** im Einstellungsmenü schaltet sie wieder ein. Vorgaben und ausgeschaltete Regeln bleiben zwischen Sitzungen gespeichert.

Dieselben Regeln laufen in der Kommandozeile mit `openpencil lint`; siehe [Dateien inspizieren](/de/developers/cli/inspecting).
