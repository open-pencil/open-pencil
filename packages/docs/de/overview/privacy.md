---
title: Datenschutz
description: Was OpenPencil über das Netzwerk sendet, warum es anonyme Nutzungsstatistiken sendet und wie du jeden Teil davon ausschaltest.
---

<script setup>
import {
  describeBuildFields,
  describePingFields,
  describeReportFields,
  describeUsageEvents
} from '@open-pencil/feedback/contract'

const columns = [
  { key: 'name', label: 'Field', kind: 'code' },
  { key: 'values', label: 'Values', kind: 'description' }
]

function rows(fields, freeForm = 'A version number') {
  return fields.map((field) => ({
    name: field.name,
    description: field.description,
    values: field.values.length > 0 ? field.values.join(', ') : freeForm
  }))
}

const pingRows = rows(describePingFields())
const buildFields = describeBuildFields()
  .map((field) => field.name)
  .join(', ')
const events = describeUsageEvents()
const reportRows = rows(describeReportFields(), 'Free-form')
</script>

# Datenschutz

- Deine Designs, Dateinamen, Ebenennamen, Texte, Prompts und Schlüssel verlassen dein Gerät nie, es sei denn, du teilst oder synchronisierst sie selbst oder hängst ein Design an eine Meldung an, die du sendest.
- Offizielle Builds senden einmal am Tag einen anonymen Ping ohne ID. Du kannst ihn ausschalten.
- Ausführliche Nutzungsstatistiken werden nur gesendet, wenn du auf Nachfrage zustimmst, und du kannst jederzeit damit aufhören.

## Warum wir überhaupt etwas erheben

OpenPencil wird von einem kleinen Team entwickelt. Wir müssen wissen, welche Plattformen, Dateiformate und Funktionen genutzt werden, um entscheiden zu können, was wir als Nächstes bauen. Außerdem müssen wir zeigen, dass OpenPencil genutzt wird, denn davon hängt die Finanzierung des Projekts ab. Eine Zahl aktiver Installationen und ein Bild davon, welche Funktionen wichtig sind, beantworten beide Fragen, ohne etwas über dich oder deine Arbeit zu wissen.

## Der tägliche Ping

Einmal am Tag sendet ein offizieller Build Folgendes an `feedback.openpencil.dev`:

```http
POST https://feedback.openpencil.dev/ping

{ "version": "0.17.0", "platform": "macos", "arch": "arm64", "app": "desktop", "browser": "unknown", "usageStats": "denied", "pingDays": "5-8", "enteredStep": false }
```

<SdkDataTable :columns="columns" :rows="pingRows" />

Er enthält keine ID, daher lassen sich Pings derselben Installation nicht miteinander verknüpfen. Die Antwort auf die Frage nach den Nutzungsstatistiken ist der einzige Weg, auf dem wir erfahren, wie viele Leute ablehnen, denn wer ablehnt, sendet nie etwas anderes. Die App speichert nur das Datum ihres letzten Pings, damit sie einmal am Tag pingt, und an wie vielen Tagen sie gepingt hat. Gesendet wird nur die Stufe, in die diese Zahl fällt: 1, 2, 3–4, 5–8 und so weiter, jeweils verdoppelt, nie die Zahl selbst. Jede Installation durchläuft die Stufen der Reihe nach. So kann der Server wiederkehrende Installationen von Kopien eines gespeicherten Zustands unterscheiden, die immer wieder gestartet werden und dieselbe Stufe wiederholen, ohne Installationen voneinander zu unterscheiden. Der Server zählt einen Zähler für diesen Tag und Build um eins hoch und einen für diesen Tag, die App und die Stufe. Außerdem zählt er einen Zähler für diesen Tag, die App und Plattform und das Netzwerk hoch, aus dem der Ping kam: die Nummer und den Betreibernamen des Netzwerks, wie Cloudflare sie meldet, etwa ein Internetanbieter für Privatkunden, eine Universität oder ein Cloud-Hoster. So lassen sich echte Menschen von automatisierten Installationen in Rechenzentren unterscheiden, ohne irgendetwas, das ein Gerät identifiziert. Sonst speichert der Server nichts. Er protokolliert keine Adressen und lehnt einen Ping ab, der ein anderes Feld enthält.

Die Antwort auf den Ping listet Meldungen auf, die die App anzeigen kann, etwa eine Bitte um Spenden oder ein Angebot, OpenPencil Cloud auszuprobieren: ihren Text, wo in der App sie erscheinen, wie oft und für welche Builds. Ein Build, der sie anzeigt, entscheidet auf dem Gerät, ob eine fällig ist, anhand der Zeit seit der Installation, seiner Version, seiner Plattform und ob du bei Cloud angemeldet bist, und speichert auch auf dem Gerät, was du mit jeder Meldung gemacht hast, etwa **Nicht jetzt**. Nichts davon geht mit dem Ping zurück. Wenn du Nutzungsstatistiken teilst, melden sie, wann eine dieser Meldungen angezeigt, aufgeschoben oder befolgt wurde, mit dem Namen der Meldung und dem Ort, an dem sie erschien (die Ereignisse unten); der Server behält diese nur für Meldungen, die er noch ausliefert oder die mit der App ausgeliefert werden, etwa ihre Spendenbitte. Der Button einer Meldung öffnet ihre Seite mit dem Namen der Meldung in der Adresse, sodass die Besuchszahlen der Website zeigen, welche Meldung jemanden hergebracht hat, ohne etwas über dich oder dein Gerät. Eine Meldung vom Server ist Text: Sie kann keinen Code ausführen, keine Bilder zeigen und nirgendwohin verlinken außer auf openpencil.dev. Die eigene Spendenbitte der App verlinkt auf die Spendenseite, die das Projekt angibt. Builds, die du selbst kompilierst, erhalten keine Meldungen vom Server.

Der Ping ist standardmäßig eingeschaltet. Schalte ihn unter **Einstellungen → Datenschutz** aus; die App zeigt dann keine Meldungen vom Server an.

## Nutzungsstatistiken

Nutzungsstatistiken sind ausgeschaltet, bis du zustimmst. OpenPencil fragt einmal, in einem kleinen Hinweis, der beim ersten Start nach dem Willkommensbildschirm erscheint, oder bei einem späteren Start, wenn du noch nicht geantwortet hast, mit zwei gleichwertigen Möglichkeiten: **Nein, danke** und **Statistik teilen**. Nichts ist für dich vorausgewählt, und du kannst deine Antwort später unter **Einstellungen → Datenschutz** ändern.

Wenn du zustimmst, erzeugt die App auf deinem Gerät eine zufällige Installations-ID. Sie ist nicht mit einem Konto, einer E-Mail-Adresse oder sonst etwas über dich verknüpft. Nutzungsereignisse werden mit ihr gesendet, zusammen mit den Build-Feldern oben (<code>{{ buildFields }}</code>). Wenn du das Teilen beendest, löscht die App die ID; stimmst du erneut zu, wird eine neue erzeugt.

Das sind alle Ereignisse, die die App senden kann. Der Dienst unter `feedback.openpencil.dev` prüft jedes Ereignis gegen diese Liste und lehnt jedes Ereignis, jede Eigenschaft und jeden Wert ab, der nicht darauf steht, sodass auch eine veränderte App nichts anderes darüber senden kann.

<template v-for="event in events" :key="event.name">
  <h3><code>{{ event.name }}</code></h3>
  <p>{{ event.description }}</p>
  <SdkDataTable v-if="event.properties.length" :columns="columns" :rows="rows(event.properties)" />
</template>

Angenommene Ereignisse gehen an [PostHog](https://posthog.com), einen Dienst für Produktanalysen, in dessen EU-Cloud. Die Anfrage kommt von unserem Server, nicht von deinem Gerät, daher sieht PostHog deine Adresse nie. Ereignisse legen keine Personenprofile an und überspringen die Standortabfrage. Wir bewahren Nutzungsstatistiken 12 Monate lang auf.

## Fehler- und Problemmeldungen

Wenn OpenPencils eigener Code einen unerwarteten Fehler auslöst, ergänzt ein offizieller Build die Fehlermeldung um **Melden…**; Fehler aus Browsererweiterungen oder ohne Stacktrace erhalten das nicht. Wurde OpenPencil nach einem Fehler unerwartet beendet oder ist in der Desktop-App ein interner Fehler aufgetreten, bietet der nächste Start einmal dasselbe an. **Hilfe → Problem melden…** ist immer da. Beides öffnet ein Formular, und nichts wird gesendet, bevor du **Bericht senden** wählst. **Was gesendet wird** zeigt den genauen Bericht, bevor er rausgeht. Er enthält:

- Bei einem Fehler: seinen Typ und seine Meldung, bereinigt um Schlüssel, Token, E-Mail-Adressen und deinen Benutzernamen in Ordnerpfaden, und wo in OpenPencils Code er aufgetreten ist. Fehler von KI-Anbietern, die deine Prompts zitieren können, werden ohne Meldung gesendet.
- Was du schreibst, und eine E-Mail-Adresse, wenn du eine angibst, damit wir antworten können.
- Die Build-Felder oben (<code>{{ buildFields }}</code>) und deine Installations-ID, wenn du Nutzungsstatistiken teilst.
- Wenn du **Letzte Aktivität einbeziehen** eingeschaltet lässt: die letzten 50 Ereignisse aus **Einstellungen → Diagnose**, etwa Fehler, Zeitmessungen und Dateiformate. Sie enthalten nie Chatnachrichten oder Werkzeugausgaben.
- Wenn du **Dieses Dokument anhängen** einschaltest: das geöffnete Design als `.fig`-Datei.

Neben den Build-Feldern enthält ein Bericht diese Felder:

<SdkDataTable :columns="columns" :rows="reportRows" />

Berichte gehen an `feedback.openpencil.dev`, das sie an die Fehlerverfolgung von PostHog in dessen EU-Cloud weitergibt, ohne deine Adresse, ein Personenprofil oder eine Standortabfrage, und selbst nichts davon behält. Ein angehängtes Design wird in Cloudflare R2 in der EU gespeichert, nur das OpenPencil-Team kann es öffnen, und es wird nach 90 Tagen gelöscht.

## Alles ausschalten

- **Einstellungen → Datenschutz** hat einen Schalter für den Ping und einen für Nutzungsstatistiken.
- In der Desktop-App schaltet ein Start von OpenPencil mit `OPENPENCIL_TELEMETRY=0` oder `DO_NOT_TRACK=1` in der Umgebung beides aus.
- Nur offizielle Releases senden überhaupt etwas. Entwicklungsserver, selbst gebaute Apps und Forks senden nichts, weil der Schalter, der das Senden aktiviert, nur gesetzt wird, wenn wir ein Release bauen.

## Weitere Netzwerkanfragen

OpenPencil arbeitet lokal, aber einige Funktionen greifen auf das Netzwerk zu. Die Desktop-App sucht beim Start nach Updates, sofern du das nicht unter **Einstellungen → Allgemein** ausschaltest. **Hilfe → Nach Updates suchen…** sucht trotzdem. Alles Weitere unten verbindet sich nur, wenn du die jeweilige Funktion nutzt, und nur mit dem genannten Dienst.

| Funktion | Wohin die Verbindung geht |
| --- | --- |
| Update-Suche (Desktop) | GitHub Releases, für die neueste Versionsnummer |
| KI-Chat und Bildwerkzeuge | Der Anbieter, den du einrichtest, mit deinem eigenen Schlüssel; die Modellliste kommt von models.dev. Mit **OpenPencil Cloud** als Anbieter der KI-Dienst, den dein Cloud-Server angibt, mit einem Token für deinen Arbeitsbereich |
| Räume für die Zusammenarbeit | Die anderen Personen im Raum direkt; öffentliche Vermittler stellen die Verbindung zwischen Teilnehmenden her, und ein TURN-Relay leitet den Verkehr weiter, wenn keine direkte Verbindung möglich ist |
| Cloud-Speicher | Der Speicheranbieter, den du einrichtest |
| Schriften | Google Fonts, das eine Schrift liefern kann, die ein Dokument verwendet und die nicht installiert ist |
| Symbole | Die Iconify-API, wenn du Symbole suchst oder einfügst |
| Symbole in importiertem HTML | jsDelivr für einen Symbolindex und die Iconify-API für die infrage kommenden Symbole, mit denen ein Inline-SVG verglichen wird, per Name (das SVG wird nie gesendet), wenn du HTML importierst; schalte das unter **Einstellungen → Editor** aus oder übergib `--no-icon-names` an `openpencil import` |
| Von URL öffnen | Die Adresse, die du öffnest, und die Stylesheets, Schriften und Bilder, auf die ihre Seite verweist, abgerufen von deinem Gerät |
| Stockfotos | Unsplash oder Pexels, mit deinem eigenen Schlüssel, wenn du dort suchst oder eines ihrer Fotos platzierst |

Die App, der Feedback-Dienst und diese Seite sind Open Source. Die Ereignisliste liegt in [`packages/feedback/src/contract`](https://github.com/open-pencil/open-pencil/tree/master/packages/feedback/src/contract), und die Tabellen oben werden daraus erzeugt.
