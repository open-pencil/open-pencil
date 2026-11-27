---
pageClass: guide
title: Coding-Agents
description: Claude Code, Codex, Cursor oder einen anderen Coding-Agenten, den du schon hast, als KI in der OpenPencil-Desktop-App verwenden.
---

# Coding-Agents

Die Desktop-App kann einen Coding-Agenten, den du schon hast, als ihre KI verwenden: Claude Code, Codex, [Antigravity CLI](#antigravity), Gemini CLI, [Cursor](#cursor), [Grok Build](#grok-build) oder [Pi](#pi). Der Agent läuft auf deinem Computer mit deinem eigenen Abo, und OpenPencil gibt ihm die Werkzeuge, um auf der Arbeitsfläche zu arbeiten.

Coding-Agenten brauchen die [Desktop-App](/de/download): Der Browser kann keine Programme auf deinem Computer starten.

## Einen Agenten einrichten

1. Installiere den Connector des Agenten, wie es sein Abschnitt unten zeigt. Claude Code und Codex brauchen kein weiteres Programm.
2. Installiere den MCP-Server von OpenPencil, der dem Agenten die Werkzeuge für die Arbeitsfläche gibt:

   ```sh
   npm install -g @open-pencil/mcp
   ```

3. Öffne **Einstellungen → Modelle → Geführte Einrichtung starten** und wähle den Agenten unter **Coding-Agenten auf diesem Computer**.
4. Prüfe, ob der Agent und der MCP-Server als installiert angezeigt werden. **Adapter installieren** installiert den Connector für dich.
5. Ist der Agent nicht angemeldet, klicke auf **Anmelden**. Die geführte Einrichtung zeigt das Konto, das der Agent verwendet, etwa seinen Tarif und seine E-Mail-Adresse.

**OpenPencil-Werkzeuge** zeigt, ob der Agent die Werkzeuge für die Arbeitsfläche erreicht. **Erneut prüfen** sieht noch einmal nach, nachdem du etwas installiert oder dich angemeldet hast.

Nutzt du den Agenten schon in einem Terminal, kann er sich selbst einrichten: Klicke auf seiner Karte auf **Einrichtungs-Prompt kopieren** und füge den Prompt in den Agenten ein.

## Modell und Modus wählen

Ein Agent ist ein Modell wie jedes andere in **Einstellungen → Modelle**, er kann also der **Design-Agent** sein, **Schnelle Aufgaben** erledigen, **Prüfungen** schreiben oder, wenn er Bilder liest, das **Vision**-Modell sein. Bei **Schnelle Aufgaben** benennt ein Agent Unterhaltungen, die Zusammenfassungen schreibt aber weiterhin der Design-Agent, und Pi tut keines von beidem. Du kannst denselben Agenten zweimal mit unterschiedlichen Einstellungen hinzufügen.

In den Einstellungen eines Agenten:

- **Modell**: **Standard des Agenten** überlässt die Wahl dem Agenten, oder wähle eines der Modelle, die er anbietet. Lädt die Liste nicht, wähle **Benutzerdefiniertes Modell…** und gib die ID eines Modells ein.
- **Denkstufe**: die eigenen Stufen des Agenten für das gewählte Modell, etwa Max bei Claude Code oder Ultra bei Codex.
- **Modus**: was der Agent tun darf, bevor er dich fragt, mit den eigenen Namen des Agenten, etwa Manual, Accept edits, Plan, Auto und Bypass permissions bei Claude Code oder Read-only bis Full access bei Codex.
- **Bildeingabe**: Schalte sie aus, wenn das gewählte Modell keine Bilder lesen kann.

Das Menü neben dem Senden-Button ändert Modell, Denkstufe und Modus für den aktuellen Chat, ab der nächsten Nachricht.

## Claude Code

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

Melde dich über die geführte Einrichtung an oder führe `claude` aus und tippe `/login`. Kann der Browser die Anmeldung nicht zurückgeben, zeigt die Anmeldeseite einen Code, den du in die geführte Einrichtung einfügst.

## Codex

```sh
npm install -g @agentclientprotocol/codex-acp
```

Melde dich über die geführte Einrichtung mit ChatGPT an oder führe `codex login` aus.

Ein älterer Connector, `@zed-industries/codex-acp`, installiert ein Programm mit demselben Namen, kann sich aber nicht anmelden. Die geführte Einrichtung bittet dich, ihn zu entfernen.

## Antigravity CLI {#antigravity}

Antigravity CLI ist Googles Agent für Gemini. Es braucht keinen Connector. Installiere es von der [Antigravity-Website](https://antigravity.google):

```sh
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Unter Windows führst du stattdessen das hier in PowerShell aus:

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Führe `agy` einmal aus und wähle, wie du dich anmeldest. Die geführte Einrichtung zeigt es als installiert an, kann aber sein Konto nicht anzeigen.

Bevor er startet, bittet der Agent manchmal darum, seinen eigenen Ordner `~/.gemini/antigravity-cli/mcp` aufzulisten. Erlaube es: Lehnst du ab, endet sein Zug.

## Gemini CLI

```sh
npm install -g @google/gemini-cli
```

Es braucht keinen Connector. Führe `gemini` einmal aus und wähle, wie du dich anmeldest. Mit privaten Google-Konten kann man sich nicht mehr bei Gemini CLI anmelden: Nutze für diese [Antigravity CLI](#antigravity).

## Cursor

Die CLI von Cursor braucht keinen Connector. Installiere sie nach der [CLI-Installationsanleitung](https://cursor.com/docs/cli/installation):

```sh
curl https://cursor.com/install -fsS | bash
```

Unter Windows verwendest du den PowerShell-Befehl auf dieser Seite. Führe einmal `cursor-agent login` aus, um dich anzumelden. Bei den Modellen von Cursor steht die Denkstufe im Namen.

## Grok Build

Grok Build braucht keinen Connector. Installiere es nach der [Anleitung zu Grok Build](https://docs.x.ai/build/overview):

```sh
curl -fsSL https://x.ai/cli/install.sh | bash
```

Unter Windows verwendest du den PowerShell-Befehl auf dieser Seite. Führe einmal `grok login` aus, um dich anzumelden.

## Pi

Pi läuft über das Begleitprogramm von OpenPencil, das Node.js 22.15 oder neuer oder Bun braucht. Die geführte Einrichtung installiert es mit einem Klick, oder du installierst es selbst:

```sh
npm install -g @open-pencil/harness
```

Pi verwendet die Anbieter, bei denen du dich in Pi angemeldet hast, daher musst du keinen Schlüssel einfügen. Führe `pi` aus, melde dich mit `/login` an und wähle mit `/model` ein Standardmodell. Um in OpenPencil ein anderes Modell zu verwenden, gib es in den Pi-Einstellungen in OpenPencil als `provider/model` ein. Mit einem Schlüssel für [AI Gateway](https://vercel.com/ai-gateway) verwendet Pi stattdessen das Gateway.

Pi kann keine Bilder lesen. Nach einem Neustart von Pi oder OpenPencil geht eine Unterhaltung in einer neuen Pi-Sitzung weiter.

## Fehlerbehebung

- **Nach der Installation nicht gefunden.** Apps, die über das Dock oder das Startmenü gestartet werden, sehen nicht jeden Ordner, den dein Terminal sieht. OpenPencil sucht in den üblichen Ordnern von npm, Bun, Volta, mise und Homebrew. Liegt deiner woanders, füge ihn zum `PATH` deiner Login-Shell hinzu und starte OpenPencil neu.
- **Aktualisierung nötig.** Der MCP-Server oder das Begleitprogramm von Pi passt nicht zur Version der App. Klicke auf den Aktualisierungs-Button oder führe den Befehl aus, den die geführte Einrichtung zeigt, und dann **Erneut prüfen**.
- **Der Agent erreicht die Werkzeuge von OpenPencil nicht** oder kann die Arbeitsfläche nicht bearbeiten. Prüfe, ob der MCP-Server in der geführten Einrichtung als installiert angezeigt wird und unter **Einstellungen → MCP** läuft. Codex überspringt den Server von OpenPencil, wenn seine eigene `config.toml` einen Server namens `open-pencil` enthält: Entferne diesen Eintrag.
- **Der Agent bittet dich, dich anzumelden.** Klicke in der geführten Einrichtung auf **Anmelden** oder melde dich mit dem eigenen Befehl des Agenten an und sende deine Nachricht dann erneut.

Der Agent arbeitet in einem eigenen Ordner in den App-Daten von OpenPencil, daher übernimmt er keine Projekteinstellungen aus deinem Home-Ordner. Er verwendet aber weiterhin seine eigenen Einstellungen, etwa die MCP-Server und Regeln in `~/.codex` oder `~/.claude`.
