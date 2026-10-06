---
layout: doc
title: AI und Automatisierung
description: OpenPencil über AI-Chat, CLI, JSX, MCP und APIs automatisieren.
---

# AI und Automatisierung

OpenPencil behandelt Designdateien als strukturierte Daten. Vorgänge aus dem Editor — Formen erstellen, Füllungen ändern, automatische Anordnung konfigurieren oder Ressourcen exportieren — stehen auch über CLI, AI-Agenten und APIs zur Verfügung.

Editor und Automatisierung verwenden denselben Kern. Ein Vorgang verhält sich daher gleich, ob er über die Oberfläche, ein Skript oder einen Agenten ausgelöst wird.

## AI-Chat

Der integrierte Assistent kann mehr als 90 Werkzeuge ausführen. Eine Anweisung kann beispielsweise Schatten mehrerer Schaltflächen ändern, eine Komponente mit dunkler Variante erstellen oder alle Rahmen einer Seite im Maßstab 2× exportieren.

[AI-Chat →](./ai-chat)

## Zusammenarbeit

OpenPencil synchronisiert Dokumente direkt zwischen Teilnehmern über WebRTC. Ein geteilter Raumlink genügt; ein zentraler Server und ein Konto sind nicht erforderlich. Teilnehmerzeiger und Ansichtsverfolgung zeigen die anderen Personen. Yjs CRDT führt gleichzeitige Änderungen zusammen.

[Zusammenarbeit →](./collaboration)

## JSX-Renderer

Eine Oberfläche kann deklarativ als JSX beschrieben werden. Ein Aufruf erstellt einen vollständigen Baum aus Rahmen, Text, automatischer Anordnung, Füllungen und Konturen.

In der Gegenrichtung exportiert OpenPencil eine Auswahl als JSX oder HTML mit Tailwind-Klassen. Das Ergebnis kann als Ausgangspunkt für Umsetzung, Codeprüfung oder einen weiteren AI-Schritt dienen.

[JSX-Renderer →](./jsx-renderer)

## CLI

Die CLI untersucht, exportiert und analysiert `.fig`-Dateien ohne geöffneten Editor. Sie listet Seiten und Objekte auf, sucht Inhalte, extrahiert Designtoken und rendert PNG. Für die Weiterverarbeitung steht eine JSON-Ausgabe zur Verfügung.

Über RPC kann die CLI außerdem den laufenden Desktop-Editor steuern: Dokumente öffnen, speichern und wechseln, Änderungen rückgängig machen, Einstellungen ändern und jedes MCP-Werkzeug aufrufen.

[Dateien untersuchen](./cli/inspecting) · [Export](./cli/exporting) · [Designs analysieren](./cli/analyzing) · [Skripte](./cli/scripting) · [App steuern](/programmable/cli/app-control)

## MCP-Server

Claude Code, Cursor, Windsurf und andere MCP-Clients können dieselben 90 Werkzeuge verwenden wie der integrierte AI-Chat. Der Server unterstützt stdio und HTTP mit Sitzungen.

[MCP-Server →](/programmable/mcp-server)

## URL-Schema {#url-scheme}

Die Desktop-Anwendung registriert `openpencil://`. Eine veröffentlichte Seite – eine Storybook-Story, eine Design-Review, eine README – kann damit direkt auf eine Ebene verweisen:

```
openpencil://open?file=web/design/hikyo.pen&node=Button/Large/Default
```

`file` ist ein auf das Repository bezogener Pfad, der auf `.pen` oder `.fig` endet; absolute Pfade und Segmente `.` oder `..` werden abgelehnt. `node` ist optional. Beide Werte sind URL-kodiert – Pfadtrenner dürfen unkodiert bleiben, ein literales `+` muss jedoch als `%2B` gesendet werden –, und bei einem wiederholten Schlüssel gilt der letzte Wert.

Die App gleicht `file` mit den Pfaden der geöffneten Tabs als vollständige abschließende Segmentfolge ab und fokussiert diesen Tab, ohne das Dokument erneut zu lesen. So wird die Ebene auch dann ausgewählt, wenn die Datei seit dem Öffnen verschoben wurde oder nicht mehr lesbar ist. Es gilt der erste geöffnete Tab, dessen Pfad auf den angeforderten Pfad endet; das ist wichtig, wenn zwei Checkouts dieselbe Datei geöffnet haben. Die Segmente werden so verglichen, wie es das Dateisystem der Plattform tut: unter macOS und Windows ohne Beachtung der ASCII-Groß-/Kleinschreibung, unter Linux exakt. `Web/Design/hikyo.pen` und `web/design/hikyo.pen` sind daher auf einem Mac dieselbe Datei und unter Linux zwei verschiedene. Passt kein geöffneter Tab, fragt ein Dateidialog einmal nach der Datei; die gewählte Datei muss auf denselben relativen Pfad enden, sonst wird der Link abgebrochen. Es wird kein Pfad an ein Stammverzeichnis angehängt, und über das, was der Dialog liefert, hinaus wird kein Dateisystemzugriff gewährt. Eine Datei, die der Link tatsächlich öffnet – die gewählte –, kommt wie jede andere geöffnete Datei in die Liste der zuletzt geöffneten Dateien; das Fokussieren eines bereits geöffneten Tabs ändert die Liste nicht, weil nichts geöffnet wurde.

Mit einem Objektnamen wählt die App alle Ebenen auf der aktuellen Seite aus, die genau diesen Namen tragen, und zoomt die Ansicht auf die gesamte Auswahl. Enthält die aktuelle Seite keine, wechselt die App zur ersten Seite, die eine enthält, und lädt dazu bei Bedarf Seiten nach. Ein unbekannter Name zeigt einen Hinweis und lässt das Dokument geöffnet. Das Schema kann nur eine Datei öffnen und Ebenen auswählen.

Die Webversion nimmt denselben Link aus ihrer Adressleiste an:

```
https://app.openpencil.dev/?file=https://raw.githubusercontent.com/open-pencil/open-pencil/master/tests/fixtures/pencil_button.pen&node=Button/Large/Default
```

Hier ist `file` eine absolute `https:`-URL, die auf `.pen` oder `.fig` endet – die Webversion hat kein Dateisystem, daher werden ein relativer Pfad, eine `http:`-URL oder jede andere Endung mit einer Warnung in der Konsole und sonst ohne Folgen abgelehnt. Die Endung wird dem Pfad der URL entnommen, ein Query-String an der verlinkten Datei ändert also nichts. Ein Fragment wird vor dem Abruf entfernt: Es erreicht den Server nie, daher öffnen `…/hikyo.pen#a` und `…/hikyo.pen#b` einen Tab, nicht zwei. `node` verhält sich genau wie oben: dieselbe Auswahl nach exaktem Namen samt Zoom, derselbe Hinweis, wenn keine Ebene den Namen trägt. Beide Werte sind URL-kodiert, ein literales `+` muss als `%2B` gesendet werden, und bei einem wiederholten Schlüssel gilt der letzte Wert, wie in der Desktop-Anwendung. Der Link wird auf jeder Route verarbeitet, `/share/<room>?file=…` und `/demo?file=…` funktionieren also wie `/?file=…`.

Der Browser ruft die Datei Cross-Origin ab, der Host muss das daher erlauben: `raw.githubusercontent.com` sendet `Access-Control-Allow-Origin: *` und funktioniert. Die Anfrage enthält keine Zugangsdaten und folgt keinen Weiterleitungen, damit ein `https:`-Link nicht auf einen unverschlüsselten umgeleitet werden kann – eine URL der Form `https://github.com/<owner>/<repo>/raw/...` leitet auf `raw.githubusercontent.com` weiter und wird deshalb abgelehnt; verlinken Sie daher direkt den Raw-Host. `file` und `node` werden über den Router aus der Adressleiste entfernt, sobald sie gelesen wurden – vor dem Abruf und auch dann, wenn der Link abgelehnt wurde –, sodass ein Neuladen das Dokument nicht erneut öffnet und weder eine kopierte URL noch eine spätere Navigation in der App den Link enthält. Ein verlinktes Dokument ist auf 64 MiB begrenzt: Der Body wird beim Streamen mitgezählt, nicht aus `Content-Length` übernommen, und die Anfrage wird abgebrochen, sobald die Grenze überschritten ist; der Link meldet dann, dass die Datei 64 MiB überschreitet. Eine Bereitstellung, die die App mit einer Content-Security-Policy ausliefert, muss den verlinkten Host in `connect-src` erlauben, sonst wird der Abruf blockiert und der Link meldet, dass die Datei nicht geöffnet werden konnte.

Unter macOS gehört das Schema dem installierten App-Bundle, Links erreichen daher einen installierten Build und keinen `tauri dev`-Prozess. Unter Windows und Linux kommt der Link über das Deep-Link-Plugin an, auch wenn die App noch nicht läuft: Der Link wird beim Start vorgemerkt und verarbeitet, sobald der Editor bereit ist; unter Linux reicht der mitgelieferte Desktop-Eintrag den Link über `%U` weiter.

## Offene Plattform

OpenPencil steht unter der MIT-Lizenz, speichert Dokumente lokal und macht seine Vorgänge programmatisch zugänglich. `.fig`-Dateien können untersucht, umgewandelt, in CI verarbeitet oder als Kontext an ein Sprachmodell übergeben werden, ohne an einen bestimmten Hostinganbieter gebunden zu sein.
