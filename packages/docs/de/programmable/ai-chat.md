---
title: KI-Chat
description: Integrierter KI-Assistent mit über 90 Werkzeugen zum Erstellen und Bearbeiten von Designs.
---

# KI-Chat

Drücken Sie <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>), um den KI-Assistenten zu öffnen. Beschreiben Sie, was Sie möchten — er erstellt Formen, setzt Stile, verwaltet Layouts, arbeitet mit Komponenten und analysiert Ihr Design.

## Einrichtung

1. Öffnen Sie das KI-Chat-Panel (<kbd>⌘</kbd><kbd>J</kbd>)
2. Klicken Sie auf das Einstellungs-Symbol
3. Wählen Sie einen Anbieter und geben Sie Ihren API-Schlüssel ein
4. Wählen Sie ein Modell

### Unterstützte Anbieter

| Anbieter | Modelle | Einrichtung |
|----------|---------|-------------|
| **OpenRouter** | Claude, GPT-4, Gemini, DeepSeek u. a. | API-Schlüssel von [openrouter.ai](https://openrouter.ai) |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus usw. | API-Schlüssel von [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-4o, GPT-4 usw. | API-Schlüssel von [platform.openai.com](https://platform.openai.com) |
| **Google AI** | Gemini 2.0, Gemini 1.5 usw. | API-Schlüssel von [aistudio.google.dev](https://aistudio.google.dev) |
| **OpenAI-kompatibel** | Jeder Endpunkt mit OpenAI-API-Format | Eigene Basis-URL + Schlüssel. Unterstützt Completions- und Responses-API-Umschaltung. |
| **Anthropic-kompatibel** | Jeder Endpunkt mit Anthropic-API-Format | Eigene Basis-URL + Schlüssel |

Kein Backend, kein Abonnement — Ihr Schlüssel kommuniziert direkt mit dem Anbieter. Browser-Anfragen unterliegen den CORS-Richtlinien des Anbieters, und Modelldeployments unterscheiden sich bei der Zuverlässigkeit gestreamter Tool-Aufrufe. Messwerte und reproduzierbare Tests finden Sie in der englischen Referenz zur [BYOK-Anbieter- und Modellkompatibilität](/programmable/byok-provider-compatibility).

## Funktionen

Der Assistent verfügt über 90+ Werkzeuge in diesen Kategorien:

- **Erstellen** — Frames, Formen, Text, Komponenten, Seiten. Rendert JSX für komplexe Layouts.
- **Stylen** — Füllungen, Konturen, Effekte, Deckkraft, Eckenradius, Mischmodi.
- **Layout** — Auto-Layout, Grid, Ausrichtung, Abstände, Größenbestimmung.
- **Komponenten** — Komponenten, Instanzen, Komponentensätze erstellen. Überschreibungen verwalten.
- **Variablen** — Variablen, Sammlungen, Modi erstellen/bearbeiten. An Füllungen binden.
- **Abfragen** — Knoten finden, XPath-Selektoren, Eigenschaften lesen, Seiten, Schriften, Auswahl auflisten.
- **Inspizieren** — `get_jsx` für JSX-Ansicht, `diff_jsx` für strukturelle Vergleiche, `describe` für semantische Rolle und Design-Probleme.
- **Analysieren** — Farbpalette, Typografie-Audit, Abstands-Konsistenz, Muster-Erkennung.
- **Exportieren** — PNG, SVG, JSX mit Tailwind-Klassen. Visuelle Überprüfung via `export_image`.
- **Vektor** — Boolesche Operationen, Pfadmanipulation.

## Visuelle Überprüfung

Der Assistent kann seine Arbeit visuell überprüfen. Nach dem Erstellen oder Ändern von Designs nutzt er `export_image`, um einen Screenshot aufzunehmen und das Ergebnis mit der ursprünglichen Anforderung zu vergleichen.

## Beispiel-Prompts

- „Erstelle eine Karte mit Titel, Beschreibung und einem blauen Button"
- „Alle Buttons auf dieser Seite sollen denselben Eckenradius verwenden"
- „Welche Schriften werden in dieser Datei verwendet?"
- „Ändere den Hintergrund des ausgewählten Frames in einen Verlauf von Blau nach Lila"
- „Exportiere den ausgewählten Frame als SVG"
- „Zeige mir das JSX für diesen Frame"

## Tipps

- Wählen Sie Knoten aus, bevor Sie fragen — der Assistent weiß, was ausgewählt ist.
- Seien Sie präzise bei Farben, Größen und Positionen für exakte Ergebnisse.
- Der Assistent kann mehrere Knoten in einer Nachricht bearbeiten.
- Nutzen Sie „Rückgängig" im Editor — KI-Mutationen unterstützen volles Undo.
- Alle Layouts werden nach jeder Werkzeugausführung automatisch neu berechnet.
