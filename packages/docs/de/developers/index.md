---
layout: doc
title: Entwickler
description: Designdateien im Terminal per Skript bearbeiten, einen AI-Agenten den Editor steuern lassen oder einen eigenen Editor auf dem OpenPencil-Kern aufbauen.
---

# Entwickler

Alles, was der Editor kann, steht auch außerhalb des Editors zur Verfügung: im Terminal, für AI-Agenten und im Code. Alles läuft auf demselben Kern wie die App — was Sie per Klick erledigen, können Sie auch per Skript erledigen. Wählen Sie das Werkzeug für das, was Sie bauen möchten.

## Designdateien per Skript bearbeiten

Die `openpencil`-CLI liest, prüft, exportiert und bearbeitet `.fig`- und `.pen`-Dateien, ohne die App zu öffnen, und gibt JSON für Skripte und CI aus. Läuft die Desktop-Anwendung, steuert dieselbe CLI sie: Dokumente öffnen und speichern, Änderungen rückgängig machen, Einstellungen ändern und jedes Editor-Werkzeug aufrufen.

<SdkCardGroup>
  <SdkCard title="Befehlsreferenz" to="/reference/cli" description="Alle Befehle und ihre Optionen." />
  <SdkCard title="Dateien untersuchen" to="/de/developers/cli/inspecting" description="Seiten, Objekte, XPath-Abfragen und Designtoken." />
  <SdkCard title="Export mit der CLI" to="/de/developers/cli/exporting" description="Bilder, JSX, HTML, Designtoken und Storybook-Stories." />
  <SdkCard title="Skripte" to="/de/developers/cli/scripting" description="Die Figma Plugin API und eine openpencil-API über eval." />
</SdkCardGroup>

## Einen AI-Agenten gestalten lassen

Der MCP-Server stellt Claude Code, Cursor, Windsurf und jedem anderen MCP-Client die 90 Werkzeuge des integrierten Assistenten bereit, sodass ein Agent Designs lesen, erstellen und ändern kann. Agenten beschreiben Oberflächen als JSX, daraus entstehen echte Rahmen, Texte und automatische Anordnung.

<SdkCardGroup>
  <SdkCard title="MCP-Server" to="/developers/mcp-server" description="Einen Client über stdio oder HTTP verbinden." />
  <SdkCard title="JSX-Renderer" to="/de/developers/jsx-renderer" description="Komponentenbäume aus JSX erstellen und eine Auswahl zurück nach JSX exportieren." />
  <SdkCard title="Referenz für Design-JSX" to="/reference/design-authoring" description="Was Design-JSX akzeptiert." />
</SdkCardGroup>

Wenn Sie stattdessen einen Agenten in der App verwenden möchten, lesen Sie [AI-Chat](../user-guide/ai-chat) und [Coding-Agenten](/user-guide/coding-agents).

## Einen eigenen Editor bauen

`@open-pencil/vue` ist das Vue SDK, mit dem die App gebaut ist: Editor-Kontext, Zeichenfläche, Auswahl, Befehle und Panels ohne vorgegebenes Erscheinungsbild, die Sie selbst gestalten. Die Bibliotheken des Kerns funktionieren auch ohne Vue, im Browser oder auf einem Server.

<SdkCardGroup>
  <SdkCard title="Vue SDK" to="/de/developers/sdk/" description="Den Editor einbetten oder einen spezialisierten Editor bauen." />
  <SdkCard title="Native JavaScript-APIs" to="/developers/native-api" description="Die Bibliotheken des Kerns, ohne Oberfläche." />
  <SdkCard title="URL-Schema" to="/de/developers/url-scheme" description="Von einer Seite direkt auf eine Ebene in der App verlinken." />
</SdkCardGroup>

## Ein Blick ins Innere

<SdkCardGroup>
  <SdkCard title="Referenz" to="/reference/node-types" description="Objekttypen, Szenengraph, DOM/CSS-Zuordnung und Dateiformat." />
  <SdkCard title="Mitwirken" to="/development/contributing" description="Die App bauen, die Tests ausführen und eine Änderung einreichen." />
</SdkCardGroup>
