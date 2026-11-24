---
title: OpenPencil vs. Paper
description: Wie sich OpenPencil, ein Open-Source-Design-Editor, und Paper, eine kommerzielle Design-Arbeitsfläche auf Basis von HTML und CSS, bei Figma-Dateien, lokaler Nutzung, KI-Agenten und Preis unterscheiden.
---

# OpenPencil vs. Paper

[Paper](https://paper.design) ist ein kommerzielles Designwerkzeug, dessen Arbeitsfläche auf HTML und CSS basiert und das für die Arbeit mit KI-Coding-Agenten über MCP gemacht ist. OpenPencil ist ein Open-Source-Design-Editor, der die `.fig`-Dateien von Figma öffnet, einen eigenen KI-Assistenten hat und auch Agenten einen vollständigen Werkzeugsatz gibt. Diese Seite vergleicht den Stand von Paper Desktop 0.5 und OpenPencil 0.17.

## Auf einen Blick

|                     | OpenPencil                                                                                   | Paper                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Lizenz              | Open Source: MIT (Editor), Apache 2.0 (Cloud-Server)                                         | Proprietär                                                                        |
| Preis               | Kostenlos; Cloud-Tarife bieten zusätzlich Speicher, Editoren und KI-Guthaben                 | Kostenloser Tarif mit 100 MCP-Aufrufen pro Woche; Pro pro Editor                  |
| Plattformen         | Desktop-App für macOS, Windows und Linux sowie Browser                                       | Desktop-App für macOS, Windows und Linux sowie Browser                            |
| Speicherort         | Auf dem eigenen Gerät, im eigenen Storage-Bucket oder in OpenPencil Cloud                    | Dienst von Paper                                                                  |
| Self-Hosting        | OpenPencil-Cloud-Server                                                                      | —                                                                                 |
| Figma               | Öffnet und speichert `.fig`-Dateien; Kopieren und Einfügen in beide Richtungen               | Einfügen aus Figma                                                                |
| Integrierte KI      | Chat-Assistent mit über 100 Designwerkzeugen; eigene Anbieterschlüssel oder Cloud-Guthaben   | Bild- und SVG-Erzeugung; Designarbeit über externe Agenten                        |
| Coding-Agenten      | MCP-Server sowie Claude Code, Codex, Cursor und andere, die im Editor laufen                 | Lokale und entfernte MCP-Server                                                   |
| Skripte             | Headless-CLI und mit der Figma Plugin API kompatible Skripte                                 | CLI für seinen MCP-Server                                                         |
| Codeexport          | Design JSX, HTML, Vue und React mit CSS oder Tailwind                                        | React mit CSS oder Tailwind                                                       |
| Export              | PNG, JPG, WEBP, SVG und `.fig`; PDF über die CLI                                             | PNG, SVG, PDF und Video                                                           |
| Zusammenarbeit      | Peer-to-Peer-Räume oder OpenPencil Cloud mit Kommentaren und Versionsverlauf                 | Bearbeitung in Echtzeit mit Teammitgliedern und Agenten sowie Kommentare          |

## Dateien und Hosting

Paper speichert Designs in seinem eigenen Dienst. OpenPencil speichert gewöhnliche `.fig`-Dateien, die auch Figma öffnet, und lässt sie auf dem eigenen Gerät, im eigenen [Storage-Bucket](/user-guide/cloud-storage) oder in [OpenPencil Cloud](/cloud/) ablegen, gehostet oder auf einem [vom eigenen Team betriebenen Server](/cloud/self-hosting/). Es öffnet Figma-Dateien direkt, während Paper aus Figma eingefügte Ebenen übernimmt.

## KI und Agenten

Beide sind für Agenten gemacht. Paper bindet externe Agenten wie Claude Code oder Cursor über seinen MCP-Server an, und der kostenlose Tarif erlaubt 100 MCP-Aufrufe pro Woche.

OpenPencil hat einen [KI-Assistenten](/de/user-guide/ai-chat) im Editor, der einen eigenen Anbieterschlüssel oder Cloud-Guthaben nutzt, und über 100 Werkzeuge stehen externen Agenten über den [MCP-Server](/developers/mcp-server) ohne Aufruflimits offen. Die Desktop-App kann außerdem [Coding-Agenten](/user-guide/coding-agents) direkt im Editor ausführen, jeden mit eigenem Cursor auf der Arbeitsfläche. Die [CLI](/de/developers/cli/inspecting) und [`eval`](/de/developers/cli/scripting) arbeiten mit Dokumenten, ganz ohne den Editor zu öffnen.

## Wo Paper voraus ist

- **Arbeitsfläche aus HTML und CSS.** Die Ebenen von Paper sind Web-Layout, sodass das Design dem entspricht, was ein Browser darstellt. OpenPencil ordnet mit Flexbox und CSS Grid über Taffy an und exportiert HTML, aber seine Arbeitsfläche ist keine Webseite.
- **Generierte Medien.** Paper erzeugt Bilder und SVGs und exportiert Video.
- **Entfernter MCP-Server.** Der gehostete MCP-Server von Paper funktioniert auch, wenn die App geschlossen ist.

## Was passt

OpenPencil ist die richtige Wahl für einen Open-Source-Editor, `.fig`-Dateien in eigener Hand, KI sowohl integriert als auch über Agenten oder Agentenaufrufe ohne Limits. Paper passt, wenn eine Arbeitsfläche gewünscht ist, die durchgehend aus HTML und CSS besteht.
