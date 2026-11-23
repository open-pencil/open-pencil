---
title: OpenPencil vs. Figma
description: Wie sich OpenPencil, ein Open-Source-Design-Editor, der .fig-Dateien öffnet, von Figma bei der Hoheit über die eigenen Dateien, Offline-Nutzung, Self-Hosting, KI und Preis unterscheidet.
---

# OpenPencil vs. Figma

Figma ist das meistgenutzte Werkzeug für Interface-Design und läuft als Dienst: Die Dateien liegen auf den Servern von Figma, und was man mit ihnen tun kann, hängt vom Tarif ab. OpenPencil ist ein Open-Source-Design-Editor, der dieselben `.fig`-Dateien öffnet und speichert, auf dem eigenen Gerät läuft und selbst entscheiden lässt, wo Dokumente liegen und welche KI an ihnen arbeitet. Diese Seite vergleicht den Stand vom November 2026 und OpenPencil 0.17.

## Auf einen Blick

|                     | OpenPencil                                                                                            | Figma                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Lizenz              | Open Source: MIT (Editor), Apache 2.0 (Cloud-Server)                                                  | Proprietärer Dienst                                                                      |
| Preis               | Kostenlos und ohne Dateilimits; Cloud-Tarife bieten zusätzlich Speicher, Editoren und KI-Guthaben     | Kostenloser Tarif mit 3 Designdateien pro Team; kostenpflichtige Tarife pro Platz        |
| Speicherort         | Auf dem eigenen Gerät, im eigenen Storage-Bucket oder in OpenPencil Cloud                             | Server von Figma; eine lokale `.fig`-Kopie lässt sich jeweils für eine Datei speichern   |
| Offline nutzbar     | Ja                                                                                                    | Nur in bereits geöffneten Dateien                                                        |
| Self-Hosting        | OpenPencil-Cloud-Server                                                                               | —                                                                                        |
| Plattformen         | Desktop-App für macOS, Windows und Linux sowie Browser                                                | Desktop-App für macOS und Windows sowie Browser                                          |
| `.fig`-Dateien      | Öffnet und speichert sie; Kopieren und Einfügen mit Figma in beide Richtungen                         | Nativ                                                                                    |
| Integrierte KI      | Chat-Assistent mit über 100 Designwerkzeugen; eigene Anbieterschlüssel oder Cloud-Guthaben            | KI von Figma mit monatlichem Guthaben pro Platz; Modelle wählt Figma                     |
| Coding-Agenten      | MCP-Server, der Designs liest und schreibt, sowie Agenten, die im Editor laufen                       | MCP-Server für Designkontext, mit Aufruflimits je nach Platz                             |
| Skripte             | Headless-CLI und mit der Figma Plugin API kompatible Skripte                                          | Plugins in der App                                                                       |
| Code                | Design JSX, HTML, Vue und React mit CSS oder Tailwind, inklusive                                      | Dev Mode auf kostenpflichtigen Plätzen                                                   |
| Zusammenarbeit      | Peer-to-Peer-Räume oder OpenPencil Cloud mit Kommentaren und Versionsverlauf                          | Bearbeitung in Echtzeit, Kommentare und Versionsverlauf                                  |
| Prototyping         | Live-Verhalten von Komponenten; Abläufe und Übergänge stehen auf der [Roadmap](/development/roadmap)  | Abläufe, Interaktionen und Smart Animate                                                 |

## Die eigenen Dateien

In Figma liegen Dokumente in der Cloud von Figma. **Save local copy** lädt jeweils eine `.fig` herunter, ohne Kommentare und Versionsverlauf, und die Eigentümerin oder der Eigentümer einer Datei kann das abschalten.

OpenPencil behandelt eine `.fig` als gewöhnliche Datei auf der Festplatte. Man kann sie öffnen, ändern und an jemanden mit Figma zurückschicken, der sie wie gewohnt öffnet. Ebenen in Figma zu kopieren und in OpenPencil einzufügen funktioniert ebenfalls, in beide Richtungen. Zum Teilen von Dokumenten lassen sie sich in einem eigenen [S3-kompatiblen Bucket](/user-guide/cloud-storage) oder in [OpenPencil Cloud](/cloud/) ablegen, entweder im gehosteten Dienst oder auf einem [vom eigenen Team betriebenen Server](/cloud/self-hosting/). Was heute originalgetreu geöffnet und gespeichert wird, steht unter [Figma-Kompatibilität](/de/reference/figma-compatibility).

## Offline und Linux

Figma hat keinen Offline-Modus: Ohne Verbindung lassen sich nur bereits geöffnete Dateien weiterbearbeiten. Die Desktop-App gibt es für macOS und Windows. OpenPencil funktioniert vollständig offline und hat eine native Desktop-App für macOS, Windows und Linux, rund 20 MB groß.

## KI und Automatisierung

Die KI-Funktionen von Figma laufen auf den Modellen von Figma und werden auf ein monatliches Guthaben pro Platz angerechnet, und der MCP-Server von Figma gibt Coding-Agenten Designkontext innerhalb von Aufruflimits, die vom Platz abhängen.

Der [KI-Assistent](/de/user-guide/ai-chat) von OpenPencil arbeitet mit einem eigenen Schlüssel für Anthropic, OpenAI, Google AI, OpenRouter oder einen beliebigen kompatiblen Endpunkt, ohne Limits von unserer Seite, oder mit dem Guthaben, das ein OpenPencil-Cloud-Tarif enthält. Coding-Agenten wie Claude Code, Codex und Cursor erhalten über den [MCP-Server](/developers/mcp-server) dieselben über 100 Werkzeuge und können Designs erstellen und ändern, nicht nur lesen. Die [CLI](/de/developers/cli/inspecting) untersucht, prüft und exportiert `.fig`-Dateien, ohne den Editor zu öffnen, und [`eval`](/de/developers/cli/scripting) führt darauf Skripte aus, die gegen die Figma Plugin API geschrieben sind.

## Wo Figma voraus ist

- **Reife und Feinschliff.** Figma wurde über viele Jahre von einem großen Team verfeinert; OpenPencil ist jünger und hat noch Ecken und Kanten.
- **Prototyping und Dev Mode.** Figma bietet vollständiges Prototyping, Präsentation und Übergabe an die Entwicklung. OpenPencil hat Live-Verhalten von Komponenten und Codeexport, aber noch keine Prototyp-Abläufe.
- **Plugins und Community.** Figma hat einen großen Plugin-Katalog und Community-Dateien.
- **Produkte über Design hinaus.** Figma bietet außerdem Slides, Sites und Make. OpenPencil hat Designdateien und Boards.

## Was passt

OpenPencil ist die richtige Wahl, wenn Designdateien auf der eigenen Festplatte oder dem eigenen Server liegen sollen, ein Editor gebraucht wird, der offline und unter Linux funktioniert, oder KI und Coding-Agenten selbst gewählt und selbst bezahlt werden sollen – und der Austausch von `.fig`-Dateien mit Figma-Nutzern trotzdem möglich bleiben soll. Figma passt, wenn das Team auf dessen Prototyping, Dev Mode oder Plugins angewiesen ist.
