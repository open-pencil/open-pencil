---
pageClass: guide
title: Fotos
description: Eine Ebene in OpenPencil mit einem kostenlosen Stockfoto von Unsplash oder Pexels füllen.
---

# Fotos

OpenPencil durchsucht die kostenlosen Fotobibliotheken von [Unsplash](https://unsplash.com) und [Pexels](https://www.pexels.com) direkt aus der Bildfüllung einer Ebene. Beide erlauben allen, ihre Fotos kostenlos zu verwenden, und beide verlangen für die Suche einen API-Schlüssel, der ebenfalls kostenlos ist. Der Schlüssel bleibt auf deinem Gerät.

Zum Suchen und Verwenden von Fotos brauchst du eine Netzwerkverbindung zu dem Dienst, den du durchsuchst.

## Eine Ebene mit einem Foto füllen

Zeichne den Rahmen oder die Form, die das Foto füllen soll, und dann:

1. Öffne ihre Füllung und stelle sie auf **Bild** um.
2. Wähle in der Vorschau **Stockfoto**.
3. Bevor du tippst, zeigt die Auswahl die Empfehlungen des Dienstes: den redaktionellen Feed von Unsplash oder die kuratierten Fotos von Pexels. Tippe ein, was du suchst, etwa `mountains` oder `coffee`; beim Scrollen werden weitere Ergebnisse geladen. Zeige auf ein Foto oder geh mit den Pfeiltasten dorthin, um zu sehen, wer es aufgenommen hat.
4. Wähle eines aus. Es wird zur Bildfüllung der Ebene und behält den Skalierungsmodus der Füllung, sodass **Fill**, **Fit**, **Crop** und **Tile** darauf wie bei jedem Bild funktionieren.

Der Dienst-Button im Kopf der Auswahl wechselt zwischen Unsplash und Pexels. Die Auswahl öffnet sich mit dem zuletzt verwendeten Dienst oder mit einem, der einen Schlüssel hat, wenn dieser keinen hat. Solange ein Dienst keinen Schlüssel hat, sagt die Auswahl das: Wähle **Einstellungen öffnen**, öffne den Dienst unter **Einstellungen → Medien**, folge **API-Schlüssel abrufen**, um einen zu erstellen, füge ihn ein und wähle **Speichern**. **Verbindung testen** probiert den eingegebenen oder den gespeicherten Schlüssel mit einer Anfrage an den Dienst aus.

Eine Unsplash-App hat zwei Schlüssel: Füge ihren **Access Key** ein, nicht ihren Secret Key. Eine neue Unsplash-App erlaubt 50 Anfragen pro Stunde, bis Unsplash sie für den Produktivbetrieb freigibt; jede Suche, jede Ergebnisseite und jeder Test zählt.

Pexels vergibt derzeit keine neuen API-Schlüssel. Hast du schon einen Pexels-Schlüssel, funktioniert er weiterhin; andernfalls nutze Unsplash.

## Urhebernennung und Schlüssel

Unsplash und Pexels bitten darum, Fotos den Menschen zuzuschreiben, die sie aufgenommen haben; die Auswahl nennt bei jedem Foto die Fotografin oder den Fotografen. OpenPencil teilt Unsplash mit, wenn eines seiner Fotos verwendet wird, wie es die API-Bedingungen verlangen.

Ändere oder entferne die Schlüssel unter **Einstellungen → Medien**. Das Stockfoto-Werkzeug des KI-Chats verwendet dieselben Schlüssel.
