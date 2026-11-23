---
title: OpenPencil vs. Lunacy
description: Wie sich OpenPencil und Lunacy, zwei kostenlose Desktop-Design-Editoren, die Figma-Dateien öffnen, bei Lizenz, Speichern zurück nach Figma, KI und Automatisierung sowie Self-Hosting unterscheiden.
---

# OpenPencil vs. Lunacy

[Lunacy](https://icons8.com/lunacy) von Icons8 und OpenPencil sind beide kostenlose Design-Editoren mit nativen Desktop-Apps für macOS, Windows und Linux, und beide öffnen die `.fig`-Dateien von Figma. Sie unterscheiden sich darin, wer die Software kontrolliert und wohin die Arbeit danach geht. Diese Seite vergleicht den Stand von Lunacy 14 und OpenPencil 0.17.

## Auf einen Blick

|                     | OpenPencil                                                                                            | Lunacy                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Lizenz              | Open Source: MIT (Editor), Apache 2.0 (Cloud-Server)                                                  | Proprietäre Freeware                                                                         |
| Preis               | Kostenlos; Cloud-Tarife bieten zusätzlich Speicher, Editoren und KI-Guthaben                          | Kostenlos; kostenpflichtige Tarife für Cloud- und Teamfunktionen und Grafiken ohne Namensnennung |
| Plattformen         | Desktop-App für macOS, Windows und Linux sowie Browser                                                | Desktop-App für macOS, Windows und Linux sowie Browser                                       |
| Natives Format      | Figma `.fig`                                                                                          | `.free` und Sketch `.sketch`                                                                 |
| `.fig`-Dateien      | Öffnet und speichert sie; Kopieren und Einfügen mit Figma in beide Richtungen                         | Öffnet sie                                                                                   |
| Offline nutzbar     | Ja                                                                                                    | Ja, mit lokalen Dokumenten                                                                   |
| Zusammenarbeit      | Peer-to-Peer-Räume oder OpenPencil Cloud mit Kommentaren und Versionsverlauf                          | Cloud von Lunacy oder eine private Cloud, mit Kommentaren                                    |
| Self-Hosting        | OpenPencil-Cloud-Server                                                                               | Private Cloud auf eigenen Servern, mit kostenpflichtiger Lizenz                              |
| Integrierte KI      | Chat-Assistent mit über 100 Designwerkzeugen; eigene Anbieterschlüssel oder Cloud-Guthaben            | KI-Chat über den Dienst von Icons8, dazu Bildwerkzeuge                                       |
| Coding-Agenten      | MCP-Server sowie Claude Code, Codex, Cursor und andere, die im Editor laufen                          | MCP-Server                                                                                   |
| Skripte             | Headless-CLI und mit der Figma Plugin API kompatible Skripte                                          | Plugins über seine MCP-API                                                                   |
| Codeexport          | Design JSX, HTML, Vue und React mit CSS oder Tailwind                                                 | CSS-Inspektion                                                                               |
| Prototyping         | Live-Verhalten von Komponenten; Abläufe und Übergänge stehen auf der [Roadmap](/development/roadmap)  | Abläufe, Smart Animate und Federanimationen                                                  |
| Integrierte Assets  | Icon-Sets                                                                                             | Icons, Fotos, Illustrationen und UI-Kits von Icons8                                          |

## Arbeit mit Figma-Dateien

Lunacy öffnet `.fig`-Dateien und speichert im eigenen `.free`-Format oder als Sketch-Datei, sodass ein Design, das Figma in Richtung Lunacy verlässt, nicht als `.fig` zurückgeht. OpenPencil speichert selbst `.fig`: Man kann eine Datei von einer Kollegin oder einem Kollegen mit Figma öffnen, ändern und zurückschicken sowie Ebenen zwischen beiden Apps in beide Richtungen kopieren und einfügen. Komplexe Dateien können beim erneuten Öffnen in Figma trotzdem anders aussehen; daher das Original behalten, bis das Ergebnis geprüft ist, siehe [Figma-Kompatibilität](/de/reference/figma-compatibility).

## Open Source und Hosting

Lunacy ist kostenlos nutzbar, aber Closed Source, und seine private Cloud auf eigenen Servern zu betreiben erfordert eine kostenpflichtige Lizenz. Der Code von OpenPencil ist offen, und Dokumente können auf dem eigenen Gerät, im eigenen [Storage-Bucket](/user-guide/cloud-storage) oder in [OpenPencil Cloud](/cloud/) bleiben, auch auf einem [vom eigenen Team betriebenen Server](/cloud/self-hosting/).

## KI und Automatisierung

Der KI-Chat von Lunacy läuft über den Dienst von Icons8 und braucht keinen API-Schlüssel. Der [KI-Assistent](/de/user-guide/ai-chat) von OpenPencil nutzt einen eigenen Anbieterschlüssel oder Cloud-Guthaben, und dieselben über 100 Werkzeuge stehen Coding-Agenten über den [MCP-Server](/developers/mcp-server) offen. Die [CLI](/de/developers/cli/inspecting) untersucht, prüft und exportiert Dokumente, ohne den Editor zu öffnen, und [`eval`](/de/developers/cli/scripting) führt Skripte aus, die gegen die Figma Plugin API geschrieben sind.

## Wo Lunacy voraus ist

- **Prototyping.** Lunacy hat Abläufe, Smart Animate und Federanimationen; OpenPencil hat noch keine Prototyp-Abläufe.
- **Integrierte Grafiken.** Lunacy enthält Icons, Fotos, Illustrationen und UI-Kits von Icons8.
- **Reife.** Lunacy wird seit Jahren entwickelt und hat Version 14 erreicht.

## Was passt

OpenPencil ist die richtige Wahl, wenn weiterhin `.fig`-Dateien mit Figma-Nutzern ausgetauscht werden müssen, Software und Hosting unter eigener Kontrolle sein sollen oder Coding-Agenten und Skripte an den Designs arbeiten sollen. Lunacy passt, wenn Prototyping und eine große integrierte Grafikbibliothek in einer kostenlosen App gewünscht sind.
