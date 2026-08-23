---
title: Vue SDK
description: Erstellen Sie OpenPencil-basierte Editoren mit Komponenten ohne vorgegebenes Erscheinungsbild und Vue Composables.
---

# Vue SDK

Mit `@open-pencil/vue` lässt sich OpenPencil nicht nur als eigenständige Designanwendung verwenden.

OpenPencil kann in andere Produkte, interne Werkzeuge oder auf bestimmte Aufgaben zugeschnittene Editoren eingebettet werden. Dabei sind Sie nicht an die Benutzeroberfläche der OpenPencil-App gebunden.

Die OpenPencil-App ist lediglich eine mögliche Oberfläche, die mit diesem Toolkit erstellt wurde. Mit dem SDK können Sie eine eigene entwickeln.

Das SDK bietet:

- einen über Vue Dependency Injection bereitgestellten Editor-Kontext;
- CanvasKit-basiertes Rendering der Arbeitsfläche;
- Composables für Auswahl, Befehle, Menüs, Eigenschaften und Variablen;
- strukturelle Komponenten ohne vorgegebenes Erscheinungsbild wie `PageListRoot`, `PropertyListRoot` und `ToolbarRoot`;
- Lokalisierung für Menüs, Panels und Dialoge sowie Komponenten zur Sprachauswahl.

## Einstieg

<SdkCardGroup>
  <SdkCard title="Erste Schritte" to="/programmable/sdk/getting-started" description="Installieren Sie das Paket, erstellen Sie eine Editor-Instanz und binden Sie die grundlegenden Komponenten ein." />
  <SdkCard title="Architektur" to="/programmable/sdk/architecture" description="Erfahren Sie, wie Composables, Komponenten und Editor-Kontext zusammenarbeiten." />
  <SdkCard title="Anleitungen" to="/programmable/sdk/guides/custom-editor-shell" description="Erstellen Sie eigene Editor-Oberflächen, Eigenschaften- und Navigationspanels." />
  <SdkCard title="API-Referenz" to="/programmable/sdk/api/" description="Informieren Sie sich über Komponenten, Composables und Low-Level-APIs." />
</SdkCardGroup>

## Wofür das SDK gedacht ist

Produkte und Teams benötigen unterschiedliche Bearbeitungsoberflächen.

Das kann ein vollständiger Designeditor sein, eine kompakte Arbeitsfläche innerhalb einer anderen Anwendung, ein internes Werkzeug, ein Vorlageneditor oder eine spezialisierte, KI-gestützte Oberfläche.

## Gestaltungsprinzipien

- **Ohne vorgegebenes Erscheinungsbild:** Das SDK stellt Logik und Struktur bereit, schreibt aber keine Gestaltung der Anwendung vor.
- **Composable statt unnötiger Hülle:** Wenn keine Oberflächenstruktur koordiniert werden muss, genügt ein Composable.
- **Bewusst gestaltete öffentliche API:** Stabile Funktionen werden aus `packages/vue/src/index.ts` exportiert.
- **Enge Vue-Integration:** Das SDK verbindet Vue mit den Funktionen von `@open-pencil/core`.

## Zwei API-Ebenen

Das SDK besteht aus zwei Hauptebenen:

1. **Composables** stellen den Editor-Zustand und zugehörige Aktionen bereit.
2. **Komponenten** definieren eine sinnvolle UI-Struktur.

Benötigen Sie lediglich Zustand und Aktionen, beginnen Sie mit den Composables. Entwickeln Sie wiederverwendbare Teile einer Editor-Oberfläche, beginnen Sie mit den Komponenten.

## API-Bereiche

- [Komponenten](/programmable/sdk/api/components/)
- [Composables](/programmable/sdk/api/composables/)
- [Low-Level-APIs](/programmable/sdk/api/advanced/)
