---
title: Dateien untersuchen
description: Dokumentbaum, Objekte, Seiten und Variablen über die CLI lesen.
---

# Dateien untersuchen

Die CLI liest `.fig`-Dateien, ohne den Editor zu öffnen. Läuft die Desktop-App, kann der Dateiname entfallen; die CLI verwendet dann RPC für das geöffnete Dokument.

::: tip Installation

```sh
npm install -g @lawha/cli
# oder
bun add -g @lawha/cli
```

:::

## Dokumentinformationen

```sh
lawha info design.fig
```

Zeigt Seiten, Objektanzahl, verwendete Schriften und Dateigröße.

## Dokumentbaum und Suche

```sh
lawha tree design.fig
lawha find design.fig --type TEXT
lawha find design.fig --name "Button"
```

## XPath-Abfragen

```sh
lawha query design.fig "//FRAME"
lawha query design.fig "//TEXT[@fontSize >= 24]"
lawha query design.fig "//*[@visible = false]"
```

Attributnamen wie `fontSize`, `layoutMode` und `strokeWeight` entsprechen der API und bleiben unverändert.

## Objekte, Seiten und Variablen

```sh
lawha node design.fig --id 1:23
lawha pages design.fig
lawha variables design.fig
```

## Geöffnetes Dokument

```sh
lawha documents list
lawha tree --document-id tab-123 --page-id 0:1
```

Für automatisierte Abläufe zuerst `lawha documents list --json` aufrufen und anschließend `--document-id` und `--page-id` ausdrücklich übergeben. Dokumente öffnen, speichern, wechseln und schließen, Rückgängig machen, Einstellungen ändern und beliebige Editor-Werkzeuge aufrufen: siehe [Controlling the App](/programmable/cli/app-control).

## Qualitätsprüfung

```sh
lawha lint design.fig
lawha lint design.pen --preset strict
lawha lint design.fig --rule color-contrast
lawha lint design.fig --fix -o fixed.fig
```

Alle Befehle unterstützen `--json`; jede Meldung enthält ihre `fix`- und `suggestions`-Angaben als Daten. `--fix` wendet die sicheren Korrekturen an – Farben werden an die passende Farbvariable gebunden und die Geometrie auf ganze Pixel gerundet – und schreibt das Ergebnis in die mit `-o` angegebene `.fig`-Datei.
