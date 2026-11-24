---
title: OpenPencil vs. Pencil
description: Wie sich OpenPencil, ein Open-Source-Design-Editor, und Pencil (pen.dev), ein proprietäres KI-Designwerkzeug, bei Lizenz, Dateiformaten, KI, Zusammenarbeit und Preis unterscheiden.
---

# OpenPencil vs. Pencil

[Pencil](https://pen.dev) ist ein kommerzielles KI-Designwerkzeug, das Designs in `.pen`-Dateien speichert und mit Coding-Agenten zusammenarbeitet. OpenPencil ist ein Open-Source-Design-Editor, der diese `.pen`-Dateien ebenso öffnet wie die `.fig`-Dateien von Figma. Die beiden sind getrennte Projekte verschiedener Teams. Diese Seite vergleicht den Stand von Pencil Desktop 1.2 und OpenPencil 0.17.

## Auf einen Blick

|                      | OpenPencil                                                                                                   | Pencil                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Lizenz               | Open Source: MIT (Editor), Apache 2.0 (Cloud-Server)                                                         | Proprietär                                                                                  |
| Preis                | Kostenlos; Cloud-Tarife bieten zusätzlich Speicher, Editoren und KI-Guthaben                                 | Kostenloser Tarif mit begrenzter KI; Pro- und Ultra-Tarife pro Nutzer                       |
| Plattformen          | Desktop-App für macOS, Windows und Linux sowie Browser                                                       | Desktop-App, Erweiterung für Code-Editoren und Browser                                      |
| Natives Format       | Figma `.fig`                                                                                                 | `.pen`                                                                                      |
| Öffnet `.pen`        | Ja                                                                                                           | Ja                                                                                          |
| Öffnet `.fig`        | Öffnet und speichert sie                                                                                     | Importiert sie                                                                              |
| Integrierte KI       | Chat-Assistent mit über 100 Designwerkzeugen; eigene Anbieterschlüssel oder Cloud-Guthaben                   | Agenten auf der Arbeitsfläche; eigene Schlüssel, ein ChatGPT- oder Claude-Abo oder Tarife   |
| Coding-Agenten       | MCP-Server sowie Claude Code, Codex, Cursor und andere, die im Editor laufen                                 | MCP-Server für Claude Code, Codex, Cursor und andere                                        |
| Skripte              | Headless-CLI und mit der Figma Plugin API kompatible Skripte                                                 | CLI                                                                                         |
| Codeexport           | Design JSX, HTML, Vue und React mit CSS oder Tailwind                                                        | HTML mit CSS oder Tailwind                                                                  |
| Zusammenarbeit       | Bearbeitung in Echtzeit in Peer-to-Peer-Räumen oder in OpenPencil Cloud mit Kommentaren und Verlauf          | Freigabelinks, Live-Freigaben, Kommentare und Versionen                                     |
| Self-Hosting         | OpenPencil-Cloud-Server                                                                                      | —                                                                                           |

## Lizenz und Dateien

Pencil wird lizenziert, nicht verkauft: Seine Bedingungen verbieten, die App zu verändern oder weiterzugeben. Der Editor von OpenPencil steht unter MIT-Lizenz und sein Cloud-Server unter Apache 2.0, sodass sich alles lesen, ändern und selbst hosten lässt.

OpenPencil speichert im `.fig`-Format von Figma, das auch Figma und andere Werkzeuge öffnen. Es öffnet `.pen`-Dokumente, sodass sich ein Pencil-Projekt übernehmen und als `.fig` speichern lässt; zum Öffnen von Dateien siehe [Export](/user-guide/exporting).

## KI

Beide Editoren sind für die Arbeit mit KI gebaut. Pencil lässt mehrere Agenten gleichzeitig auf der Arbeitsfläche laufen, erzeugt Bilder und SVGs und rechnet die KI-Nutzung auf Tariflimits an, sofern kein eigener Schlüssel und kein eigenes Abo verwendet wird.

Der [KI-Assistent](/de/user-guide/ai-chat) von OpenPencil arbeitet mit einem eigenen Schlüssel für Anthropic, OpenAI, Google AI, OpenRouter und andere Anbieter, ohne Nutzungslimit von unserer Seite, oder mit dem Guthaben, das ein Cloud-Tarif enthält. Über 100 Werkzeuge stehen Coding-Agenten über den [MCP-Server](/developers/mcp-server) offen, und die Desktop-App führt [Coding-Agenten](/user-guide/coding-agents) wie Claude Code und Codex direkt im Editor aus, jeden mit eigenem Cursor auf der Arbeitsfläche.

## Zusammenarbeit

OpenPencil bearbeitet gemeinsam in Echtzeit: entweder in einem [Peer-to-Peer-Raum](/de/user-guide/collaboration) ohne Konto und ohne eigenes Hosting oder mit Dokumenten in [OpenPencil Cloud](/cloud/), gehostet oder auf dem eigenen Server, mit Freigabe, Kommentaren und Versionsverlauf. Pencil teilt Designs per Link und Live-Freigabe, mit Kommentaren und Versionen, über seinen eigenen Dienst.

## Wo Pencil voraus ist

- **Parallele Agenten.** Pencil lässt im höchsten Tarif bis zu sechs Agenten auf einer Arbeitsfläche laufen.
- **Generierte Bilder.** Pencil erzeugt Bilder und SVGs und entfernt Hintergründe; OpenPencil vektorisiert Bilder über Recraft oder fal.ai, erzeugt sie aber nicht.
- **Erweiterung für Code-Editoren.** Pencil läuft in VS Code und Cursor; OpenPencil läuft daneben.

## Was passt

OpenPencil ist die richtige Wahl für einen Open-Source-Editor zum Selbsthosten, Dateien in einem Format, das auch Figma öffnet, und KI mit eigenen Schlüsseln ohne Tariflimits. Pencil passt, wenn mehrere Agenten gleichzeitig im Code-Editor designen sollen.
