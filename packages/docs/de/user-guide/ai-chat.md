---
pageClass: guide
title: KI-Chat
description: Die KI Designs erstellen und ändern lassen, ihre Änderungen rückgängig machen, Prüfungen anfordern und ihr mit Skills etwas beibringen.
---

# KI-Chat

Beschreibe, was du willst, und die KI erstellt es auf der Arbeitsfläche: einen Screen, eine Komponente, eine Änderung an jedem Button der Seite. Drücke <Keys mac="⌘ J" other="Ctrl J" />, um den Chat zu öffnen, oder klicke neben **Design** auf den Tab **KI**.

## Die KI einrichten

Beim ersten Mal fragt dich die geführte Einrichtung, wobei die KI dir helfen soll und was du schon verwendest:

- einen [Coding-Agenten](./coding-agents), den du hast, etwa Claude Code oder Codex, in der Desktop-App;
- ein Konto bei einem KI-Anbieter, etwa OpenRouter, Anthropic, OpenAI oder Google, oder deinen ChatGPT-Tarif;
- ein Modell, das auf deinem Computer oder dem Server deiner Firma läuft;
- dein Konto bei [OpenPencil Cloud](/cloud/ai).

[Modelle und Anbieter](./models-and-providers) listet auf, was jede Möglichkeit braucht. Um die Einrichtung erneut zu starten, öffne **Einstellungen → Modelle → Geführte Einrichtung starten**.

Die KI verwendet für jede Art von Arbeit ein Modell, das du im Modellmenü unter dem Nachrichtenfeld unter **Modelle und Rollen verwalten…** ändern kannst:

| Rolle | Aufgabe |
| ---- | ---- |
| **Design-Agent** | Der Chat selbst. |
| **Vision** | Liest die Bilder, die du anhängst. |
| **Prüfung** | Schreibt [Designprüfungen](#eine-prufung-anfordern). Verwendet den Design-Agent, sofern du kein anderes Modell wählst. |
| **Schnelle Aufgaben** | Benennt Unterhaltungen und schreibt, wenn es ein API-Modell ist, Zusammenfassungen langer Unterhaltungen; andernfalls schreibt sie der Design-Agent. Pi benennt keine Unterhaltungen. Ohne ein Modell, das es tut, nimmt eine Unterhaltung ihre erste Nachricht als Namen. |

## Ein Design anfordern

Tippe ein, was du willst, und drücke <Keys mac="Enter" other="Enter" />. Die KI sieht, welche Ebenen ausgewählt sind; wähle also aus, was du meinst, bevor du um eine Änderung bittest.

<GuideImage name="ai-chat/reply" alt="Der KI-Chat neben der Arbeitsfläche: eine Anfrage nach einer Reisekarte, die Bearbeitung der KI, ihre Antwort und die neue Karte auf der Arbeitsfläche" />

- Tippe **@**, um eine Ebene, eine Seite oder einen Skill zu nennen. Genannte Ebenen erscheinen als Chips; klicke auf einen, um die Ebene auf der Arbeitsfläche zu finden. Der Zeiger-Button nennt die ausgewählten Ebenen.
- Hänge mit dem Bild-Button Bilder an, etwa eine Skizze oder eine Website, die dir gefällt. Dafür brauchst du ein Vision-Modell.
- Jede Bearbeitung der KI erscheint in ihrer Antwort. Klicke auf eine, um zu sehen, was sie getan hat.

Ein paar Ideen zum Ausprobieren:

- „Erstelle eine Karte mit einem Titel, einer Beschreibung und einem blauen Button.“
- „Gib allen Buttons auf dieser Seite denselben Eckenradius.“
- „Mach aus dem Hintergrund dieses Rahmens einen Verlauf von Blau zu Lila.“
- „Mach aus dieser Komponente einen Schalter, den ich in der Vorschau ausprobieren kann.“

Mit einem Modell, das Bilder liest, prüft die KI ihre Arbeit anhand eines Bilds dessen, was sie erstellt hat, und kann so korrigieren, was nicht gelungen ist.

## Während die KI arbeitet

- Arbeite einfach weiter: Die KI bleibt auf der Seite, auf der die Nachricht begonnen hat. Der Chat zeigt, wo sie arbeitet, und mit **Zur Seite** kommst du dorthin zurück.
- Um ihr zuzusehen, schalte **Agenten bei der Arbeit folgen** ein, den Ziel-Button oben im Chat. Deine Ansicht folgt der KI, auch auf eine andere Seite. Klicken, Scrollen oder <Keys mac="Esc" other="Esc" /> beendet das Folgen.
- Tippe eine weitere Nachricht und drücke <Keys mac="Enter" other="Enter" />, um sie zu senden, sobald der aktuelle Schritt fertig ist, damit die KI die Richtung ändern kann. <Keys mac="⌥ Enter" other="Alt Enter" /> wartet, bis sie mit allem fertig ist. Wartende Nachrichten erscheinen abgeblendet unter der Antwort.
- **Generierung stoppen** beendet die Antwort. Eine Bearbeitung, die gerade läuft, wird noch abgeschlossen; die nächste Nachricht sagt der KI, was sich geändert hat.

**Maximale Schritte pro Nachricht** unter **Chat** in **Einstellungen → Modelle** begrenzt, wie lange eine Antwort der eingebauten KI arbeiten kann: 50 Schritte, sofern du es nicht änderst. Coding-Agenten setzen ihre eigenen Grenzen. Erreicht eine Antwort die Grenze, macht **Fortfahren** weiter.

## Rückgängig machen, was die KI getan hat

Jede Bearbeitung der KI ist ein Schritt von <Keys mac="⌘ Z" other="Ctrl Z" />, und der Chat markiert rückgängig gemachte Bearbeitungen.

- **Änderungen zurücknehmen** unter einer Antwort macht alle ihre Bearbeitungen rückgängig, und **Änderungen wiederherstellen** bringt sie zurück.
- **Zurücknehmen und neu generieren** macht sie rückgängig und fragt erneut.

Deine nächste Nachricht sagt der KI, was du rückgängig gemacht hast, damit sie nicht auf Bearbeitungen aufbaut, die weg sind.

## Eine Prüfung anfordern

Tippe **/review**, damit das Prüfungsmodell die Auswahl ansieht, oder die Seite, wenn nichts ausgewählt ist, so wie es eine Art-Direktorin tun würde: Ausrichtung, Abstände, Kontrast, Hierarchie und alles, was kaputt aussieht.

- Füge hinzu, worauf geachtet werden soll, etwa `/review typography`.
- Hänge Bilder zum Vergleich an, etwa einen Screenshot einer Website, die du bewunderst. Dafür brauchst du ein Modell, das Bilder liest.
- Unter einer Bearbeitung der KI fragt **Diese Änderung prüfen**, ob sie das Design verbessert hat.

Die Prüfung erscheint als Karte, und jeder Befund verlinkt auf seine Ebene. **Beheben** schickt die Befunde als deine Nachricht an die KI.

## Der KI mit Skills etwas beibringen

Ein Skill ist eine Sammlung von Anweisungen für eine Art von Arbeit, etwa die Markenregeln deines Teams, im Format [Agent Skills](https://agentskills.io/specification): ein Ordner mit einer `SKILL.md` und allen Dateien, auf die sie verweist. Die KI liest einen Skill, wenn eine Anfrage ihn braucht. Um selbst einen zu verwenden, tippe **/** und wähle ihn aus.

Füge Skills unter **Einstellungen → Skills** hinzu:

- **Skill hochladen**: ein ZIP des Ordners eines Skills oder eine einzelne `SKILL.md`.
- In der Desktop-App werden auch Skills in den Ordnern `.agents/skills` und `.claude/skills` neben der geöffneten Datei gefunden. Sie bleiben aus, bis du **Ordner vertrauen** wählst, da ein Skill der KI Anweisungen gibt.
- Skills, die andere Coding-Agenten installiert haben, in `~/.agents/skills` und `~/.claude/skills`, werden ausgeschaltet aufgelistet. Schalte die ein, die beim Design helfen.

Coding-Agenten wie Claude Code laden ihre eigenen Skills.

## Lange Unterhaltungen

Die KI liest von einer Unterhaltung nur einen begrenzten Teil auf einmal. Die Anzeige oben im Chat zeigt, wie voll dieser ist; klicke darauf für Details.

Ist die Unterhaltung fast voll, komprimiert die KI sie: Sie schreibt eine Zusammenfassung, die an die Stelle der älteren Nachrichten tritt, die du weiterhin lesen kannst. **Automatisch komprimieren** unter **Chat** in **Einstellungen → Modelle** erledigt das bei Bedarf. Tippe **/compact**, um es sofort zu tun, zusammen mit dem, was danach erhalten bleiben soll, etwa `/compact keep the color decisions`.

**Chatverlauf** oben links im Chat öffnet deine früheren Unterhaltungen, die auf diesem Computer gespeichert sind. **Neuer Chat** fängt von vorn an.

## Festlegen, was die KI darf

**Einstellungen → Werkzeugzugriff** listet die Werkzeuge auf, die die KI verwenden kann, etwa Ebenen ändern, exportieren oder Skripte ausführen. Schalte Werkzeuge oder ganze Gruppen aus, damit die KI sie nicht verwendet. Die Änderung gilt ab der nächsten Nachricht. Ein Skriptwerkzeug kann trotzdem tun, was die ausgeschalteten Werkzeuge tun, daher sind diese Schalter keine Sandbox.

Der Tab **Local MCP** legt die Werkzeuge für [Coding-Agenten und andere MCP-Clients](/developers/mcp-server) fest.

## Die Anweisungen der KI ändern

::: v-pre

**Einstellungen → Prompts** enthält, was OpenPencil der KI sagt:

- **Design-Agent**: deine Anweisungen für den Chat, die nach denen von OpenPencil eingefügt werden. **Die von OpenPencil ersetzen** verwendet stattdessen deine; ohne die von OpenPencil nutzt die KI ihre Werkzeuge womöglich schlecht.
- **Prüfung**, **Chat-Titel** und **Zusammenfassungen beim Komprimieren**: die Prompts für diese Aufgaben. Es sind [Knap](https://knap.md)-Vorlagen, in denen `{{ focus }}` einen Wert einsetzt. Der Editor markiert Fehler und zeigt eine Vorschau des Ergebnisses.

:::

**Auf Standard zurücksetzen** stellt die von OpenPencil wieder her.

## Andere Werkzeuge verbinden {#external-mcp-connections}

In der Desktop-App können Coding-Agenten auch andere [MCP](https://modelcontextprotocol.io/)-Server verwenden, etwa deinen Issue-Tracker. Füge unter **Einstellungen → MCP** bei **MCP-Verbindungen** die Adresse des Servers und, falls er eines braucht, sein Token hinzu und schalte die Verbindung ein: Agenten bekommen keine ausgeschalteten Verbindungen. Füge nur Server hinzu, denen du vertraust: Ihre Werkzeuge handeln mit dem Zugriff, den du ihnen gibst.

## Benachrichtigt werden

Fragt die KI um Erlaubnis und du antwortest nicht innerhalb weniger Sekunden, schickt OpenPencil eine Benachrichtigung, sodass du in der Zwischenzeit in einer anderen App arbeiten kannst. **Einstellungen → Benachrichtigungen** kann dich auch benachrichtigen, wenn eine Antwort fertig ist. Im Browser klickst du dort zuerst auf **Mitteilungen erlauben**.
