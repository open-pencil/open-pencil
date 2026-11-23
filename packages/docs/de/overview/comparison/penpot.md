---
title: OpenPencil vs. Penpot
description: Wie sich OpenPencil und Penpot, zwei Open-Source-Designwerkzeuge, bei Figma-Dateien, KI und Automatisierung, Zusammenarbeit, Self-Hosting und der Desktop-App unterscheiden.
---

# OpenPencil vs. Penpot

OpenPencil und Penpot sind beide Open-Source-Designwerkzeuge, die sich anstelle von Figma einsetzen lassen. Sie setzen an unterschiedlichen Stellen an: Penpot ist eine Webplattform rund um ein eigenes Dateiformat und einen Teamserver, OpenPencil ist ein Editor, der vorhandene Figma-Dateien öffnet, auf dem eigenen Gerät läuft und sich von Menschen, Skripten oder KI-Agenten steuern lässt. Diese Seite vergleicht den Stand von Penpot 2.19 und OpenPencil 0.17.

## Auf einen Blick

|                      | OpenPencil                                                                                           | Penpot                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Lizenz               | MIT (Editor), Apache 2.0 (Cloud-Server)                                                              | MPL 2.0                                              |
| Figma-`.fig`-Dateien | Öffnet und speichert sie; Kopieren und Einfügen mit Figma in beide Richtungen                        | Werden von einem Plugin in Figma konvertiert         |
| Plattformen          | Desktop-App für macOS, Windows und Linux sowie Browser                                               | Browser                                              |
| Offline nutzbar      | Ja; Dokumente können auf dem eigenen Gerät bleiben                                                   | Benötigt seinen Server                               |
| Konten               | Zum Bearbeiten nicht nötig; optional für Cloud                                                       | Erforderlich                                         |
| Zusammenarbeit       | Peer-to-Peer-Räume ohne Server oder OpenPencil Cloud mit Freigabe, Kommentaren und Versionsverlauf   | Serverbasiert, mit Freigabe, Kommentaren und Verlauf |
| Self-Hosting         | OpenPencil-Cloud-Server                                                                              | Docker-Bereitstellung                                |
| Integrierte KI       | Chat-Assistent mit über 100 Designwerkzeugen; eigener Anbieterschlüssel oder Cloud-Guthaben          | —                                                    |
| Agenten und Skripte  | MCP-Server, Headless-CLI und mit der Figma Plugin API kompatible Skripte                             | MCP-Server und Plugin API                            |
| Layout               | Automatische Anordnung mit Flexbox und CSS Grid                                                      | Flex- und Grid-Layout                                |
| Designtoken          | Variablen mit Modi; Import und Export von W3C-Designtoken                                            | Native Designtoken                                   |
| Codeexport           | Design JSX, HTML, Vue und React mit CSS oder Tailwind                                                | CSS-, SVG- und HTML-Inspektion                       |
| Prototyping          | Live-Verhalten von Komponenten; Abläufe und Übergänge stehen auf der [Roadmap](/development/roadmap) | Abläufe, Interaktionen und Ansichtsmodus             |

## Figma-Dateien

OpenPencil öffnet `.fig`-Dateien direkt und speichert wieder als `.fig`. Ein Team kann also wechseln, ohne zuerst seine Bibliothek zu konvertieren, und wer noch mit Figma arbeitet, kann das Ergebnis öffnen. Werden Ebenen in Figma kopiert und in OpenPencil eingefügt, bleiben Füllungen, Konturen, automatische Anordnung, Text, Effekte und Vektornetzwerke erhalten; die umgekehrte Richtung funktioniert ebenfalls. Was übernommen wird und was nicht, steht unter [Figma-Kompatibilität](/de/reference/figma-compatibility).

Penpot verwendet ein eigenes `.penpot`-Format und öffnet keine `.fig`-Dateien. Für den Umstieg von Figma wird das Export-Plugin von Penpot in Figma ausgeführt und dessen Ergebnis importiert.

## KI und Automatisierung

OpenPencil ist darauf ausgelegt, programmiert zu werden. Der [KI-Assistent](/de/user-guide/ai-chat) erstellt und bearbeitet Ebenen mit denselben über 100 Werkzeugen, die der [MCP-Server](/developers/mcp-server) Claude Code, Cursor, Codex und anderen Coding-Agenten bereitstellt, und die Desktop-App kann diese Agenten direkt im Editor ausführen. Die [CLI](/de/developers/cli/inspecting) untersucht, prüft, konvertiert und exportiert Dokumente, ohne den Editor zu öffnen, und ihr [`eval`-Befehl](/de/developers/cli/scripting) führt Skripte aus, die gegen die Figma Plugin API geschrieben sind.

Penpot hat einen offiziellen MCP-Server, über den Coding-Agenten an seinen Dateien arbeiten können, und ein Pluginsystem für Erweiterungen, die im Editor laufen. Einen integrierten Assistenten oder Headless-Skripte gibt es nicht.

## Zusammenarbeit und Hosting

Penpot besteht aus Client und Server: Dokumente liegen auf einer Penpot-Instanz, entweder der gehosteten oder einer selbst mit Docker bereitgestellten, und alle melden sich dort an.

OpenPencil speichert Dokumente standardmäßig auf dem eigenen Gerät. Für gemeinsames Bearbeiten lässt sich ein [Peer-to-Peer-Raum](/de/user-guide/collaboration) ohne Server oder Konto öffnen, mit Live-Cursorn, Folgemodus und Sprachanrufen. Für gemeinsamen Speicher, Berechtigungen, Kommentare und Versionsverlauf gibt es [OpenPencil Cloud](/cloud/): den gehosteten Dienst oder einen [vom eigenen Team betriebenen Server](/cloud/self-hosting/) aus demselben Open-Source-Code.

## Desktop-App

OpenPencil hat eine native Desktop-App für macOS, Windows und Linux, rund 20 MB groß, mit nativen Menüs, Offline-Bearbeitung und automatischem Speichern. Außerdem läuft es im Browser unter [cloud.openpencil.dev](https://cloud.openpencil.dev). Penpot läuft im Browser.

## Wo Penpot voraus ist

- **Reife.** Penpot wird seit Jahren von großen Teams produktiv eingesetzt; OpenPencil ist jünger und hat noch Ecken und Kanten.
- **Prototyping.** Penpot bietet Abläufe, Interaktionen und einen Präsentationsmodus. OpenPencil zeigt Komponenten in der Vorschau als funktionierende Bedienelemente, hat aber noch keine Prototyp-Abläufe.
- **Plugin-Ökosystem.** Penpot hat einen Katalog von Community-Plugins; die Erweiterungspunkte von OpenPencil sind derzeit Skripte, MCP und das [Vue SDK](/de/developers/sdk/).

## Was passt

OpenPencil ist die richtige Wahl, wenn mit vorhandenen Figma-Dateien weitergearbeitet werden soll, eine offline nutzbare Desktop-App gewünscht ist oder KI-Agenten und Skripte an den Designs arbeiten sollen. Penpot passt, wenn Prototyping schon heute gebraucht wird oder eine Plattform mit längerer Erfolgsbilanz gefragt ist.
