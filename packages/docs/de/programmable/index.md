---
layout: doc
title: AI und Automatisierung
description: OpenPencil über AI-Chat, CLI, JSX, MCP und APIs automatisieren.
---

# AI und Automatisierung

OpenPencil behandelt Designdateien als strukturierte Daten. Vorgänge aus dem Editor — Formen erstellen, Füllungen ändern, automatische Anordnung konfigurieren oder Ressourcen exportieren — stehen auch über CLI, AI-Agenten und APIs zur Verfügung.

Editor und Automatisierung verwenden denselben Kern. Ein Vorgang verhält sich daher gleich, ob er über die Oberfläche, ein Skript oder einen Agenten ausgelöst wird.

## AI-Chat

Der integrierte Assistent kann mehr als 90 Werkzeuge ausführen. Eine Anweisung kann beispielsweise Schatten mehrerer Schaltflächen ändern, eine Komponente mit dunkler Variante erstellen oder alle Rahmen einer Seite im Maßstab 2× exportieren.

[AI-Chat →](./ai-chat)

## Zusammenarbeit

OpenPencil synchronisiert Dokumente direkt zwischen Teilnehmern über WebRTC. Ein geteilter Raumlink genügt; ein zentraler Server und ein Konto sind nicht erforderlich. Teilnehmerzeiger und Ansichtsverfolgung zeigen die anderen Personen. Yjs CRDT führt gleichzeitige Änderungen zusammen.

[Zusammenarbeit →](./collaboration)

## JSX-Renderer

Eine Oberfläche kann deklarativ als JSX beschrieben werden. Ein Aufruf erstellt einen vollständigen Baum aus Rahmen, Text, automatischer Anordnung, Füllungen und Konturen.

In der Gegenrichtung exportiert OpenPencil eine Auswahl als JSX oder HTML mit Tailwind-Klassen. Das Ergebnis kann als Ausgangspunkt für Umsetzung, Codeprüfung oder einen weiteren AI-Schritt dienen.

[JSX-Renderer →](./jsx-renderer)

## CLI

Die CLI untersucht, exportiert und analysiert `.fig`-Dateien ohne geöffneten Editor. Sie listet Seiten und Objekte auf, sucht Inhalte, extrahiert Designtoken und rendert PNG. Für die Weiterverarbeitung steht eine JSON-Ausgabe zur Verfügung.

Über RPC kann die CLI außerdem den laufenden Desktop-Editor steuern.

[Dateien untersuchen](./cli/inspecting) · [Export](./cli/exporting) · [Designs analysieren](./cli/analyzing) · [Skripte](./cli/scripting)

## MCP-Server

Claude Code, Cursor, Windsurf und andere MCP-Clients können dieselben 90 Werkzeuge verwenden wie der integrierte AI-Chat. Der Server unterstützt stdio und HTTP mit Sitzungen.

[MCP-Server →](/programmable/mcp-server)

## Offene Plattform

OpenPencil steht unter der MIT-Lizenz, speichert Dokumente lokal und macht seine Vorgänge programmatisch zugänglich. `.fig`-Dateien können untersucht, umgewandelt, in CI verarbeitet oder als Kontext an ein Sprachmodell übergeben werden, ohne an einen bestimmten Hostinganbieter gebunden zu sein.
