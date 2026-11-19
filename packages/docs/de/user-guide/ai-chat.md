---
title: AI-Chat
description: Integrierter AI-Assistent mit mehr als 90 Werkzeugen zum Erstellen und Bearbeiten von Designs.
---

# AI-Chat

<kbd>⌘</kbd><kbd>J</kbd> beziehungsweise <kbd>Strg</kbd><kbd>J</kbd> öffnet den Assistenten. Eine Anweisung kann Formen erstellen, Stile ändern, die Anordnung konfigurieren, Komponenten bearbeiten oder das Dokument analysieren.

## Einrichtung

Beim ersten Start fragt die geführte Einrichtung, wobei die KI helfen soll und was bereits vorhanden ist: ein Coding-Agent wie Claude Code, Codex, Antigravity CLI, Gemini CLI, Cursor oder Grok Build in der Desktop-App, ein API-Konto oder ein lokaler bzw. Firmenserver. Sie verbindet diesen Zugang und weist ihn den Rollen **Design agent** und **Vision** zu; manuell Eingerichtetes bleibt erhalten. Bei OpenRouter genügt eine Anmeldung statt eines eingefügten API-Schlüssels. Sie lässt sich überspringen und jederzeit über **Einstellungen → KI und Agenten → Geführte Einrichtung starten** erneut ausführen. Modelle manuell einrichten:

1. AI-Chat öffnen.
2. Einstellungssymbol wählen.
3. Modell hinzufügen und Anbieter, Modellkennung, Zugangsdaten und Fähigkeiten konfigurieren.
4. Modell speichern und der Rolle **Design agent** zuweisen.

Mehrere Modelle können getrennt für Gestaltung, Prüfung, schnelle Aufgaben und Bildeingaben verwendet werden. Modelle derselben Anbieterverbindung verwenden dieselben sicher gespeicherten Zugangsdaten.

### Anbieter

Der Chat funktioniert mit OpenRouter, Anthropic, OpenAI, Google AI, DeepSeek, Z.ai, MiniMax, dem eigenen ChatGPT-Abo, jedem OpenAI- oder Anthropic-kompatiblen Server und dem eigenen [OpenPencil Cloud](/cloud/ai)-Konto. Unter [Modelle und Anbieter](/user-guide/models-and-providers) stehen die Modelle jedes Anbieters und wie er verbunden wird, was im Browser funktioniert und wie man ein Modell auswählt.

### Externe MCP-Verbindungen

Desktop-ACP-Agenten können vertrauenswürdige entfernte MCP-Server verwenden. Unter **Einstellungen → MCP-Verbindungen** wird ein Streamable-HTTP-Endpunkt hinzugefügt, optional ein Bearer-Token gespeichert und die Verbindung aktiviert.

Token werden im Anmeldedatenspeicher und erst beim Start einer ACP-Sitzung gelesen. Entfernte Server müssen HTTPS verwenden; für lokale Entwicklung sind Loopback-Adressen über HTTP erlaubt.

## Werkzeuge

Der Assistent verfügt über mehr als 90 Werkzeuge für Erstellung, Gestaltung, Anordnung, Komponenten, Variablen, Suche, Prüfung, Analyse, Export und Vektorbearbeitung.

## Skills

Skills sind Ordner mit einer `SKILL.md` im Format [Agent Skills](https://agentskills.io/specification): Anweisungen für eine Art von Arbeit, mit optionalen Referenzdateien. Die eingebaute KI sieht Name und Beschreibung jedes aktiven Skills und lädt seine Anweisungen, wenn eine Anfrage passt; Skripte in einem Skill laufen nicht.

Unter **Einstellungen → Skills** lädst du einen Skill als ZIP seines Ordners oder als `SKILL.md` hoch. In der Desktop-App kommen `~/.agents/skills` und `~/.claude/skills` dazu sowie die Ordner `.agents/skills` und `.claude/skills` neben dem geöffneten Dokument, die erst nach **Ordner vertrauen** gelten. Tippe `/` am Anfang einer Nachricht, um einen Skill auszuwählen, und `@`, um eine Ebene, eine Seite oder einen Skill zu erwähnen. Erwähnungen erscheinen als Chips, auch in den Antworten; ein Klick zeigt die Ebene auf der Arbeitsfläche.

## Visuelle Prüfung

Nach Änderungen kann der Assistent das Ergebnis mit `export_image` rendern und mit der Anfrage vergleichen. Dadurch werden Anordnungsfehler, fehlende Elemente und abweichende Farben sichtbar. `diff_pixels`, standardmäßig aktiviert, vergleicht ein bearbeitetes Objekt mit einer Referenzkopie und liefert die geänderten Pixel und den betroffenen Bereich, sodass der Assistent prüfen kann, ob eine Änderung auf ihr Ziel beschränkt blieb.

## Hinweise

- Vor der Anfrage die betreffenden Objekte auswählen; der Assistent kennt die aktuelle Auswahl.
- Farben, Größen und Positionen möglichst genau angeben.
- Eine Nachricht kann mehrere Objekte ändern.
- Während eine Antwort läuft, können Sie andere Seiten ansehen: Der Assistent arbeitet auf der Seite weiter, auf der die Nachricht begonnen hat, und seine Vorschauen erscheinen, sobald Sie zurückkehren. Solange Sie woanders sind, nennt der Chat die Seite, an der gearbeitet wird, mit **Zur Seite**, um dorthin zurückzukehren. Wechselt der Assistent selbst die Seite, folgt Ihre Ansicht.
- Änderungen durch AI können rückgängig gemacht werden.
- Nach jedem Werkzeugaufruf wird die Anordnung neu berechnet.
