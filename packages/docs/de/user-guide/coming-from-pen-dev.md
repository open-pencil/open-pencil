---
pageClass: guide
title: Umstieg von pen.dev
description: Öffne Dateien von pen.dev (früher Pencil) in OpenPencil, sieh, was mitkommt, und gestalte mit einem KI-Agenten weiter.
---

# Umstieg von pen.dev

OpenPencil öffnet die `.pen`-Dateien von pen.dev, das früher Pencil hieß. Dein Design kommt als bearbeitbare Ebenen an, und du arbeitest mit dem KI-Agenten weiter, den du schon verwendest.

## Eine `.pen`-Datei öffnen

Drücke <Keys mac="⌘ O" other="Ctrl O" /> und wähle die Datei, oder zieh sie auf das Fenster. Auf deinem Computer kannst du sie mit der Desktop-App auch aus dem Finder oder dem Datei-Explorer öffnen.

OpenPencil liest `.pen`-Dateien, schreibt sie aber nicht. Beim ersten Speichern fragt es, wo eine neue `.fig`-Datei abgelegt werden soll, die wie das Original heißt; ein Browser ohne Speicherdialog lädt sie stattdessen herunter. Die `.pen`-Datei bleibt unverändert, und die `.fig`-Datei öffnet sich auch in Figma.

## Was mitkommt

- Rahmen, Formen und Pfade mit ihren Füllungen, Konturen und Effekten.
- Text und Layout: Zeilen, Spalten, Abstände und Innenabstand.
- Komponenten und ihre Instanzen, mit den Änderungen an jeder Instanz.
- Themes, als Sammlungen von [Variablen](./variables). Theme-Optionen, die deine Variablen kombinieren, etwa Farbmodus und Dichte, teilen sich eine Sammlung, deren Modi ihre Kombinationen sind; eine einzelne Option bekommt eine eigene Sammlung.
- Symbole und Bilder.

Manches kommt noch nicht mit:

- Ebenen aus anderen Dateien, die das Dokument importiert.
- Skript-, Browser-, Shader-, Notiz- und Kontextebenen.
- Im Browser: Bilder, die neben der Datei gespeichert sind. Öffne die Datei in der Desktop-App, um sie zu behalten.

## Mit einem KI-Agenten weiterarbeiten

Der Agent, mit dem du in pen.dev gestaltest, kann auch in OpenPencil arbeiten:

- Verwende in der Desktop-App [Claude Code, Codex, Cursor oder einen anderen Coding-Agent](./coding-agents), den du schon hast, als KI-Chat.
- Oder verbinde deinen Agenten aus seinem eigenen Terminal oder Editor mit dem [MCP-Server](/developers/mcp-server) von OpenPencil, dann bearbeitet er das geöffnete Dokument.

Agenten bearbeiten das Dokument, solange es geöffnet ist, und brauchen daher keine `.pen`-Datei auf der Festplatte.
