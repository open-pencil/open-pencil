---
title: Vue SDK
description: Erstellen Sie Inkly-gestützte Editoren mit headless Vue Composables und Primitiven.
---

# Vue SDK

`@inkly/vue` gibt es, damit Inkly mehr als eine eigenständige Design-App sein kann.

Das Ziel ist es, Inkly zu einem Toolkit zu machen, das Sie in andere Produkte, interne Tools und workflow-spezifische Editoren einbetten können — nicht nur als einzelne Standard-UI.

Die Inkly-App ist eine mögliche Zusammensetzung dieses Toolkits. Das SDK ist der Weg, eine andere zu bauen.

Es bietet Ihnen:

- injizierten Editor-Kontext
- CanvasKit-gestütztes Canvas-Rendering
- Composables für Auswahl, Befehle, Menü, Eigenschafts-Panel und Variablen
- headless strukturelle Primitive wie `PageListRoot`, `PropertyListRoot` und `ToolbarRoot`
- eingebaute i18n-Primitive für Menüs, Panels, Dialoge und benutzerdefinierte Locale-Picker

## Hier beginnen

<SdkCardGroup>
  <SdkCard title="Erste Schritte" to="/programmable/sdk/getting-started" description="Paket installieren, eine Editor-Instanz erstellen und die Kern-Primitive einbinden." />
  <SdkCard title="Architektur" to="/programmable/sdk/architecture" description="Verstehen Sie, wie Composables, Primitive und Editor-Kontext zusammenpassen." />
  <SdkCard title="Anleitungen" to="/programmable/sdk/guides/custom-editor-shell" description="Benutzerdefinierte Shells, Eigenschafts-Panels und Navigations-Panels erstellen." />
  <SdkCard title="API-Referenz" to="/programmable/sdk/api/" description="Komponenten, Composables und erweiterte öffentliche APIs durchsuchen." />
</SdkCardGroup>

## Warum das SDK existiert

Verschiedene Produkte und Teams benötigen unterschiedliche Bearbeitungsoberflächen.

Manchmal möchten Sie einen vollständigen Design-Editor. Manchmal möchten Sie einen fokussierten Canvas innerhalb einer anderen App. Manchmal benötigen Sie ein internes Workflow-Tool, einen Template-Editor oder eine KI-gestützte Bearbeitungsoberfläche für einen speziellen Anwendungsfall.

Das SDK ist die Schicht, die all das ermöglicht.

## Designprinzipien

- **Headless-First**: Logik und Struktur, kein App-Styling
- **Composable statt Wrapper**: Composables verwenden, wenn keine bedeutungsvolle strukturelle Koordination erforderlich ist
- **Bewusste öffentliche API**: stabile Exporte aus `packages/vue/src/index.ts`
- **Framework-bewusst**: Vue-Integration über `@inkly/core`

## Das Paket verstehen

Das SDK hat zwei Hauptschichten:

1. **Composables** für Editor-Zustand und Aktionen
2. **Primitive** für bedeutungsvolle UI-Struktur

Wenn Sie nur Editor-Zustand und Aktionen benötigen, beginnen Sie mit Composables.
Wenn Sie wiederverwendbare Editor-UI-Bausteine erstellen, beginnen Sie mit Primitiven.

## API-Bereiche

- [Komponenten](/programmable/sdk/api/components/)
- [Composables](/programmable/sdk/api/composables/)
- [Erweitert](/programmable/sdk/api/advanced/)
