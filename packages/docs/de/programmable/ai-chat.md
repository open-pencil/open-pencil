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

| Anbieter | Beispiele | Einrichtung |
|----------|-----------|-------------|
| **OpenRouter** | Claude, GPT, Gemini, DeepSeek, Qwen und weitere | API-Schlüssel von [openrouter.ai](https://openrouter.ai) |
| **Anthropic** | Claude Sonnet 4.6, Claude Opus 4.6 | API-Schlüssel von [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-5.3 Codex, GPT-4.1, o3, o4-mini | API-Schlüssel von [platform.openai.com](https://platform.openai.com) |
| **Google AI** | Gemini 3.1 Pro, Gemini 3 Flash | API-Schlüssel von [aistudio.google.dev](https://aistudio.google.dev) |
| **Z.ai** | GLM-5.1, GLM-5, GLM-4.7 und GLM-4.5 | API-Schlüssel laut [Z.ai-Dokumentation](https://docs.z.ai/devpack/quick-start) |
| **MiniMax** | MiniMax M3, M2.7, M2.7-highspeed, M2.5 und M2.1 | API-Schlüssel von [platform.minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| **OpenAI-kompatibel** | Endpunkt im OpenAI-API-Format | Eigene Basisadresse und Schlüssel |
| **Anthropic-kompatibel** | Endpunkt im Anthropic-API-Format | Eigene Basisadresse und Schlüssel |

Anfragen gehen direkt an den Anbieter. Im Browser gelten dessen CORS-Regeln. Bereitstellungen unterscheiden sich darin, wie zuverlässig Werkzeugaufrufe gestreamt werden. Messergebnisse stehen unter [BYOK-Kompatibilität](/programmable/byok-provider-compatibility).

### Externe MCP-Verbindungen

Desktop-ACP-Agenten können vertrauenswürdige entfernte MCP-Server verwenden. Unter **Einstellungen → MCP-Verbindungen** wird ein Streamable-HTTP-Endpunkt hinzugefügt, optional ein Bearer-Token gespeichert und die Verbindung aktiviert.

Token werden im Anmeldedatenspeicher und erst beim Start einer ACP-Sitzung gelesen. Entfernte Server müssen HTTPS verwenden; für lokale Entwicklung sind Loopback-Adressen über HTTP erlaubt.

## Werkzeuge

Der Assistent verfügt über mehr als 90 Werkzeuge für Erstellung, Gestaltung, Anordnung, Komponenten, Variablen, Suche, Prüfung, Analyse, Export und Vektorbearbeitung.

## Visuelle Prüfung

Nach Änderungen kann der Assistent das Ergebnis mit `export_image` rendern und mit der Anfrage vergleichen. Dadurch werden Anordnungsfehler, fehlende Elemente und abweichende Farben sichtbar. `diff_visual`, standardmäßig aktiviert, vergleicht ein bearbeitetes Objekt mit einer Referenzkopie und liefert die geänderten Pixel und den betroffenen Bereich, sodass der Assistent prüfen kann, ob eine Änderung auf ihr Ziel beschränkt blieb.

## Hinweise

- Vor der Anfrage die betreffenden Objekte auswählen; der Assistent kennt die aktuelle Auswahl.
- Farben, Größen und Positionen möglichst genau angeben.
- Eine Nachricht kann mehrere Objekte ändern.
- Während eine Antwort läuft, können Sie andere Seiten ansehen: Der Assistent arbeitet auf der Seite weiter, auf der die Nachricht begonnen hat, und seine Vorschauen erscheinen, sobald Sie zurückkehren. Solange Sie woanders sind, nennt der Chat die Seite, an der gearbeitet wird, mit **Zur Seite**, um dorthin zurückzukehren. Wechselt der Assistent selbst die Seite, folgt Ihre Ansicht.
- Änderungen durch AI können rückgängig gemacht werden.
- Nach jedem Werkzeugaufruf wird die Anordnung neu berechnet.
