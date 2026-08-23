---
title: Dateien untersuchen
description: Dokumentbaum, Objekte, Seiten und Variablen über die CLI lesen.
---

# Dateien untersuchen

Die CLI liest `.fig`-Dateien, ohne den Editor zu öffnen. Läuft die Desktop-App, kann der Dateiname entfallen; die CLI verwendet dann RPC für das geöffnete Dokument.

::: tip Installation
```sh
npm install -g @open-pencil/cli
# oder
bun add -g @open-pencil/cli
# oder
brew install open-pencil/tap/open-pencil
```
:::

## Dokumentinformationen

```sh
openpencil info design.fig
```

Zeigt Seiten, Objektanzahl, verwendete Schriften und Dateigröße.

## Dokumentbaum und Suche

```sh
openpencil tree design.fig
openpencil find design.fig --type TEXT
openpencil find design.fig --name "Button"
```

## XPath-Abfragen

```sh
openpencil query design.fig "//FRAME"
openpencil query design.fig "//TEXT[@fontSize >= 24]"
openpencil query design.fig "//*[@visible = false]"
```

Attributnamen wie `fontSize`, `layoutMode` und `strokeWeight` entsprechen der API und bleiben unverändert.

## Objekte, Seiten und Variablen

```sh
openpencil node design.fig --id 1:23
openpencil pages design.fig
openpencil variables design.fig
```

## Geöffnetes Dokument

```sh
openpencil documents
openpencil tree --document-id tab-123 --page-id 0:1
```

Für automatisierte Abläufe zuerst `openpencil documents --json` aufrufen und anschließend `--document-id` und `--page-id` ausdrücklich übergeben.

## Qualitätsprüfung

```sh
openpencil lint design.fig
openpencil lint design.pen --preset strict
openpencil lint design.fig --rule color-contrast
```

Alle Befehle unterstützen `--json`.
