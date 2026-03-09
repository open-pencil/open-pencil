---
layout: doc
title: KI & Automatisierung
description: Jede Operation in OpenPencil ist skriptfähig — KI-Chat, CLI, JSX-Renderer, MCP-Server, Echtzeit-Zusammenarbeit.
---

# KI & Automatisierung

OpenPencil behandelt Designdateien als Daten. Jede im Editor verfügbare Operation — Formen erstellen, Füllungen setzen, Auto-Layout verwalten, Assets exportieren — ist auch über das Terminal, über KI-Agenten und aus Code heraus verfügbar. Keine Plugins zu installieren, keine API-Schlüssel, keine Warteliste.

Die Editor-Oberfläche und die Automatisierungsschnittstellen verwenden dieselbe Engine. Was du per Klick machen kannst, kannst du auch per Skript machen.

## KI-Chat

Der integrierte Assistent hat Zugriff auf 87 Werkzeuge, die die gesamte Oberfläche des Editors abdecken. Beschreibe in natürlicher Sprache, was du möchtest — „füge allen Buttons einen 16px Schlagschatten hinzu", „erstelle eine Kartenkomponente mit Dark-Mode-Variante", „exportiere jeden Frame auf dieser Seite in 2×".

[KI-Chat →](./ai-chat)

## Zusammenarbeit

Echtzeit-Multiplayer-Bearbeitung über Peer-to-Peer WebRTC. Kein Server, kein Konto. Teile einen Raum-Link und bearbeite gemeinsam mit Live-Cursorn und Folgemodus. Der Dokumentzustand wird über CRDT synchronisiert, sodass Bearbeitungen auch bei instabilen Verbindungen automatisch zusammengeführt werden.

[Zusammenarbeit →](./collaboration)

## JSX-Renderer

Beschreibe UI als JSX — die gleiche Syntax, die LLMs bereits von React kennen. Ein einziger Aufruf kann einen ganzen Komponentenbaum mit Frames, Text, Auto-Layout, Füllungen und Konturen erstellen. Kompakt, deklarativ und diff-fähig.

In die andere Richtung kannst du jede Auswahl als JSX mit Tailwind-Klassen exportieren — nützlich für die Übergabe an die Entwicklung oder um Designs zurück in ein LLM einzuspeisen.

[JSX-Renderer →](./jsx-renderer)

## CLI

`.fig`-Dateien inspizieren, exportieren und analysieren, ohne den Editor zu öffnen. Seiten auflisten, Knoten suchen, Design-Tokens extrahieren, als PNG rendern — alles vom Terminal aus mit maschinenlesbarer JSON-Ausgabe.

Das CLI verbindet sich auch über RPC mit der laufenden Desktop-App, sodass du den Editor skripten kannst, während du ihn benutzt.

[Dateien inspizieren](./cli/inspecting) · [Exportieren](./cli/exporting) · [Designs analysieren](./cli/analyzing) · [Skripting](./cli/scripting)

## MCP-Server

Verbinde Claude Code, Cursor, Windsurf oder jeden MCP-kompatiblen Client mit OpenPencil. Der Server stellt 90 Werkzeuge zum Lesen, Erstellen und Bearbeiten von Designs bereit — dieselben Werkzeuge, die der integrierte KI-Chat verwendet. Läuft über stdio oder HTTP mit Session-Unterstützung.

[MCP-Server →](./mcp-server)

## Warum offen?

Figma ist eine geschlossene Plattform. Ihr MCP-Server ist schreibgeschützt. Der CDP-Browserzugang wurde in Version 126 abgeschafft. Designdateien liegen in einem proprietären Format auf fremden Servern. Plugin-Entwicklung erfordert eine eigene Laufzeitumgebung mit eingeschränkten APIs.

OpenPencil ist die Alternative: Open Source, MIT-lizenziert, jede Operation skriptfähig, Daten lokal gespeichert. Deine Designdateien gehören dir — inspiziere sie, transformiere sie, leite sie in die CI weiter, speise sie in ein LLM ein. Keine Erlaubnis nötig.
