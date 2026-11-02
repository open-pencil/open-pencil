---
title: AI-Chat
description: Integrierter AI-Assistent mit mehr als 90 Werkzeugen zum Erstellen und Bearbeiten von Designs.
---

# AI-Chat

<kbd>⌘</kbd><kbd>J</kbd> beziehungsweise <kbd>Strg</kbd><kbd>J</kbd> öffnet den Assistenten. Eine Anweisung kann Formen erstellen, Stile ändern, die Anordnung konfigurieren, Komponenten bearbeiten oder das Dokument analysieren.

## Einrichtung

Beim ersten Start fragt die geführte Einrichtung, wobei die KI helfen soll und was bereits vorhanden ist: ein Coding-Agent wie Claude Code, Codex oder Gemini CLI in der Desktop-App, ein API-Konto oder ein lokaler bzw. Firmenserver. Sie verbindet diesen Zugang und weist ihn den Rollen **Design agent** und **Vision** zu; manuell Eingerichtetes bleibt erhalten. Bei OpenRouter genügt eine Anmeldung statt eines eingefügten API-Schlüssels. Sie lässt sich überspringen und jederzeit über **Einstellungen → KI und Agenten → Geführte Einrichtung starten** erneut ausführen. Modelle manuell einrichten:

1. AI-Chat öffnen.
2. Einstellungssymbol wählen.
3. Modell hinzufügen und Anbieter, Modellkennung, Zugangsdaten und Fähigkeiten konfigurieren.
4. Modell speichern und der Rolle **Design agent** zuweisen.

Mehrere Modelle können getrennt für Gestaltung, Prüfung, schnelle Aufgaben und Bildeingaben verwendet werden. Modelle derselben Anbieterverbindung verwenden dieselben sicher gespeicherten Zugangsdaten.

### Anbieter

| Anbieter                 | Beispiele                                                                 | Einrichtung                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **OpenRouter**           | Claude, GPT, Gemini, DeepSeek, Qwen und weitere                           | API-Schlüssel von [openrouter.ai](https://openrouter.ai)                                                         |
| **Anthropic**            | Claude Sonnet 5.5, Claude Opus 5.5, Claude Fable 5.1 und Claude Haiku 5.5 | API-Schlüssel von [console.anthropic.com](https://console.anthropic.com)                                         |
| **OpenAI**               | GPT-6.1 Sol, GPT-6 Astra und GPT-6 Luna                                   | API-Schlüssel von [platform.openai.com](https://platform.openai.com)                                             |
| **Google AI**            | Gemini 3.8 Flash und Gemini 4 Argon                                       | API-Schlüssel von [aistudio.google.dev](https://aistudio.google.dev)                                             |
| **DeepSeek**             | DeepSeek Flash und DeepSeek V4 Pro                                        | API-Schlüssel von [platform.deepseek.com](https://platform.deepseek.com/api_keys)                                |
| **Z.ai**                 | GLM-5.3, GLM-5.3-Flash, GLM-5.3-FlashX und GLM-5V-Turbo                   | API-Schlüssel laut [Z.ai-Dokumentation](https://docs.z.ai/devpack/quick-start)                                   |
| **MiniMax**              | MiniMax-M3.1-Flash und MiniMax-M3                                         | API-Schlüssel von [platform.minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| **OpenAI-kompatibel**    | Endpunkt im OpenAI-API-Format                                             | Eigene Basisadresse und Schlüssel                                                                                |
| **Anthropic-kompatibel** | Endpunkt im Anthropic-API-Format                                          | Eigene Basisadresse und Schlüssel                                                                                |

Anfragen gehen direkt an den Anbieter. Im Browser gelten dessen CORS-Regeln. Bereitstellungen unterscheiden sich darin, wie zuverlässig Werkzeugaufrufe gestreamt werden. Messergebnisse stehen unter [BYOK-Kompatibilität](/programmable/byok-provider-compatibility).

### Externe MCP-Verbindungen

Desktop-ACP-Agenten können vertrauenswürdige entfernte MCP-Server verwenden. Unter **Einstellungen → MCP-Verbindungen** wird ein Streamable-HTTP-Endpunkt hinzugefügt, optional ein Bearer-Token gespeichert und die Verbindung aktiviert.

Token werden im Anmeldedatenspeicher und erst beim Start einer ACP-Sitzung gelesen. Entfernte Server müssen HTTPS verwenden; für lokale Entwicklung sind Loopback-Adressen über HTTP erlaubt.

## Werkzeuge

Der Assistent verfügt über mehr als 90 Werkzeuge für Erstellung, Gestaltung, Anordnung, Komponenten, Variablen, Suche, Prüfung, Analyse, Export und Vektorbearbeitung.

## Skills

Skills sind Ordner mit einer `SKILL.md` im Format [Agent Skills](https://agentskills.io/specification): Anweisungen für eine Art von Arbeit, mit optionalen Referenzdateien. Die eingebaute KI sieht Name und Beschreibung jedes aktiven Skills und lädt seine Anweisungen, wenn eine Anfrage passt; Skripte in einem Skill laufen nicht.

Unter **Einstellungen → Skills** lädst du einen Skill als ZIP seines Ordners oder als `SKILL.md` hoch. In der Desktop-App kommen `~/.agents/skills` und `~/.claude/skills` dazu sowie die Ordner `.agents/skills` und `.claude/skills` neben dem geöffneten Dokument, die erst nach **Ordner vertrauen** gelten. Tippe `/` am Anfang einer Nachricht, um einen Skill auszuwählen, und `@`, um eine Ebene, eine Seite oder einen Skill zu erwähnen. Erwähnungen erscheinen als Chips, auch in den Antworten; ein Klick zeigt die Ebene auf der Arbeitsfläche.

## Visuelle Prüfung

Nach Änderungen kann der Assistent das Ergebnis mit `export_image` rendern und mit der Anfrage vergleichen. Dadurch werden Anordnungsfehler, fehlende Elemente und abweichende Farben sichtbar. `diff_visual`, standardmäßig aktiviert, vergleicht ein bearbeitetes Objekt mit einer Referenzkopie und liefert die geänderten Pixel und den betroffenen Bereich, sodass der Assistent prüfen kann, ob eine Änderung auf ihr Ziel beschränkt blieb.

## Hinweise

- Vor der Anfrage die betreffenden Objekte auswählen; der Assistent kennt die aktuelle Auswahl.
- Farben, Größen und Positionen möglichst genau angeben.
- Eine Nachricht kann mehrere Objekte ändern.
- Während eine Antwort läuft, können Sie andere Seiten ansehen: Der Assistent arbeitet auf der Seite weiter, auf der die Nachricht begonnen hat, und seine Vorschauen erscheinen, sobald Sie zurückkehren. Solange Sie woanders sind, nennt der Chat die Seite, an der gearbeitet wird, mit **Zur Seite**, um dorthin zurückzukehren. Wechselt der Assistent selbst die Seite, folgt Ihre Ansicht.
- Änderungen durch AI können rückgängig gemacht werden.
- Nach jedem Werkzeugaufruf wird die Anordnung neu berechnet.
