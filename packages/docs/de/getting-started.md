---
pageClass: guide
title: Erste Schritte
description: Öffne OpenPencil im Browser oder auf deinem Computer, finde dich zurecht und erstelle ein erstes Design.
---

# Erste Schritte

OpenPencil ist ein Design-Editor für Bildschirme, vom einzelnen Button bis zur ganzen App. Er öffnet und speichert Figma-Dateien und läuft im Browser oder als Desktop-App.

## OpenPencil öffnen

- **Im Browser:** Geh zu [cloud.openpencil.dev](https://cloud.openpencil.dev). Du musst nichts installieren.
- **Auf deinem Computer:** Lade die App für macOS, Windows oder Linux von der [Download-Seite](/de/download). Auf dem Mac kannst du sie auch mit Homebrew installieren: `brew install --cask openpencil`.

::: tip Umgezogen von app.openpencil.dev
Die Web-App ist nach cloud.openpencil.dev umgezogen. Dateien, die du im Browser unter [app.openpencil.dev](https://app.openpencil.dev) gespeichert hast, bleiben dort, bis die Adresse weiterleitet: Öffne sie, um die Dateien in der Cloud zu speichern oder herunterzuladen.
:::

## Systemanforderungen

Im Browser braucht OpenPencil Chrome oder Edge 111, Firefox 128 oder Safari 16.4 oder neuer. Browser auf Chrome-Basis wie Brave und Opera funktionieren ab denselben Versionen.

Die Desktop-App braucht:

- **macOS** 13 Ventura oder neuer, mit installierten Safari-Updates.
- **Windows** 10 oder neuer, mit der Microsoft Edge WebView2 Runtime, die Windows aktuell hält.
- **Linux** mit WebKitGTK 2.40 oder neuer (`webkit2gtk-4.1`).

Ist dein Browser oder System zu alt, sagt dir OpenPencil, was du aktualisieren musst. Siehst du diese Meldung auf einem System, das die Anforderungen erfüllt, klick in der Meldung auf **Problem melden**.

## Zurechtfinden

<GuideImage name="getting-started/editor" alt="Der Editor mit acht nummerierten Bereichen" />

1. **Menüs.** Datei, Bearbeiten, Ansicht und die übrigen, unter dem Dateinamen.
2. **Seiten.** Jede Seite ist eine eigene Arbeitsfläche in derselben Datei.
3. **Ebenen.** Alles auf der Seite, in der Reihenfolge, in der es gezeichnet wird.
4. **Arbeitsfläche.** Hier gestaltest du.
5. **Werkzeugleiste.** Werkzeuge für Rahmen, Formen, den Stift und Text.
6. **Design-Panel.** Einstellungen für das, was du ausgewählt hast. Die Tabs neben **Design** zeigen die Auswahl als Code, öffnen den KI-Chat und prüfen dein Design auf Probleme.
7. **Zoom.** Klick auf die Prozentzahl, um die Zoomoptionen zu sehen.
8. **Teilen und Vorschau.** Lade Leute in die Datei ein oder probiere dein Design als Prototyp aus.

## Ein erstes Design erstellen

1. Drücke <Keys mac="F" other="F" /> und zieh auf der Arbeitsfläche, um einen Rahmen zu zeichnen. Rahmen enthalten den Rest deines Designs, etwa einen Bildschirm oder eine Karte.
2. Drücke <Keys mac="R" other="R" /> und zieh im Rahmen, um ein Rechteck zu zeichnen.
3. Drücke <Keys mac="T" other="T" />, klick in den Rahmen und tippe.
4. Drücke <Keys mac="Esc" other="Esc" />, um das Tippen zu beenden. Das Design-Panel zeigt jetzt Schrift und Größe des Texts.
5. Drücke <Keys mac="⌘ S" other="Ctrl S" />, um zu speichern.

[Öffnen und speichern](./user-guide/files) erklärt, wo deine Datei landet.

## Einen Befehl finden

Drücke <Keys mac="⌘ K" other="Ctrl K" /> und tippe, was du tun möchtest, etwa „links ausrichten“ oder „exportieren“. Wähle ein Ergebnis, um es auszuführen. Du kannst auch den Namen einer Seite eingeben, um zu dieser Seite zu wechseln.

## Auf Smartphone oder Tablet

Auf einem kleinen Bildschirm wandern die Panels in eine Schublade am unteren Rand. Ihre Buttons öffnen die Ebenen, das Design-Panel, den Code und den KI-Chat.

## Nächste Schritte

- [Canvas-Navigation](./user-guide/canvas-navigation): Bewegen und zoomen.
- [Auswahl & Bearbeitung](./user-guide/selection-and-manipulation): Ebenen auswählen, verschieben und skalieren.
- [Ebenen & Seiten](./user-guide/layers-and-pages): Ordnen, was in deiner Datei ist.
- [Auto-Layout](./user-guide/auto-layout): Rahmen bauen, die sich ihrem Inhalt anpassen.

Möchtest du OpenPencil selbst bauen? Lies [Contributing](/development/contributing#build-from-source).
