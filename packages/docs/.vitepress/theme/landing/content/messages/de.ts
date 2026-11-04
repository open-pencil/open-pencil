import type { LandingMessages } from './types'

export const de: LandingMessages = {
  hero: {
    title: 'Design ohne Lock‑in.',
    lede: 'Ein Open-Source-Design-Editor, der deine Figma-Dateien öffnet, auf deinem Rechner läuft und jede Ebene von dir oder deinem KI-Agenten steuern lässt.',
    open: 'Tour starten',
    download: 'Herunterladen',
    github: 'GitHub'
  },
  loading: 'Editor wird geladen',
  features: {
    figma: {
      title: 'Öffne, was du schon hast',
      detail:
        'OpenPencil liest .fig-Dateien direkt: Seiten, Komponenten, Instanzen, Variablen und Auto-Layout kommen als bearbeitbare Ebenen an, und du kannst wieder als .fig speichern. Füge SVG ein oder öffne HTML und CSS, und auch daraus werden Ebenen, angeordnet wie im Browser.',
      hint: 'Das ist die Tour der App selbst, eine echte .fig-Datei. Öffne ein Kapitel in den Ebenen und klick dich durch.'
    },
    design: {
      title: 'Gestalten mit echten Werkzeugen',
      detail:
        'Auto-Layout, Constraints, Füllungen, Konturen, Effekte und Typografie, mit den Reglern dort, wo du sie erwartest. Komponenten haben Slots: Eine Instanz behält das Design und bringt ihren eigenen Inhalt mit. Alles lässt sich rückgängig machen, und nichts wartet auf einen Server.',
      hint: 'Fahre über das ausgewählte Cover und zieh an einer Ecke, um sie abzurunden. Die anderen Player bringen ihr eigenes Cover über den Artwork-Slot mit.'
    },
    interactive: {
      title: 'Komponenten, die funktionieren',
      detail:
        'Gib einer Komponente ein Verhalten, etwa Schalter, Checkbox, Schieberegler, Tabs oder Textfeld, und die Vorschau führt sie als echtes Reka-UI-Steuerelement aus. Varianten werden zu ihren Zuständen, und dieselben Komponenten lassen sich mit klickbaren Steuerelementen nach Storybook exportieren.',
      hint: 'Diese Leinwand ist in der Vorschau: Drück auf Play, zieh den Fortschrittsbalken, schalte Zufallswiedergabe um. Verlasse die Vorschau zum Bearbeiten.'
    },
    tokens: {
      title: 'Variablen sind Design-Tokens',
      detail:
        'Farben, Abstände und Schrift liegen in Sammlungen mit Modi und werden als Tokens bearbeitet. Exportierter Code schreibt gebundene Werte als CSS-Custom-Properties, sodass der Code dieselben Namen verwendet wie das Design.',
      hint: 'Jeder Player liest die Theme-Sammlung in seinem eigenen Modus. Ändere den Wert eines Tokens, und beide folgen.'
    },
    shaders: {
      title: 'Füllungen, die sich bewegen',
      detail:
        'Ein Shader ist eine Füllung wie jede andere: Wähle ihn in der Füllungsauswahl, stapel Effekte, stell ihre Regler ein oder füge ein Preset von shaders.com ein. Dateien behalten ein Standbild davon, damit sie überall öffnen, und die Vorschau spielt ihn ab.',
      hint: 'Diese Leinwand ist in der Vorschau, deshalb bewegen sich die Shader. Verlasse die Vorschau, wähle ein Quadrat und öffne seine Füllung.'
    },
    linting: {
      title: 'Linting',
      detail:
        'OpenPencil prüft das Design, während du arbeitest: Kontrast, zu kleine Schrift, Standardnamen, versteckte und leere Ebenen, überflüssige Gruppen. Probleme werden auf der Arbeitsfläche markiert, viele lassen sich mit einem Klick beheben, und dieselben Regeln laufen in der CLI und für Agenten.',
      hint: 'Klicke auf eine Markierung auf der Arbeitsfläche oder wende eine Korrektur aus der Liste an.'
    },
    ai: {
      title: 'Gestalten mit KI, mit deinen Schlüsseln',
      detail:
        'Beschreibe in normaler Sprache, was du willst: Der Agent bearbeitet das Dokument mit denselben Werkzeugen wie du und zeigt seine Arbeit schon während des Streamings auf der Arbeitsfläche. Verbinde einen beliebigen Anbieter mit deinem eigenen Schlüssel oder nutze den Coding-Agenten, den du ohnehin verwendest.',
      hint: 'Ein aufgezeichneter Durchgang läuft durch die echte Agentenschleife. Sieh zu, wie die Arbeitsfläche beim Streamen entsteht.'
    },
    collab: {
      title: 'Gemeinsam arbeiten, mit Menschen und Agenten',
      detail:
        'Teile einen Link, und alle bearbeiten dasselbe Dokument, Peer-to-Peer, mit Live-Cursorn, Folgemodus, an Ebenen gehefteten Kommentaren und Sprachanrufen. KI-Agenten kommen genauso dazu: Alle im Raum sehen zu, wie sie bauen, während sie streamen.',
      hint: 'Beide Bildschirme gehören dir. Zieh auf einem eine Ebene und sieh zu, wie sie sich auf dem anderen bewegt; dann frag den Agenten.'
    },
    code: {
      title: 'Vom Design zum Code',
      detail:
        'Jede Auswahl ist eine Vue- oder React-Komponente mit Varianten als Props und Reka UI oder Radix hinter den interaktiven, oder HTML, Tailwind und Design-JSX mit Variablen als Tokens. Komponenten werden als Storybook-Stories exportiert, und Design-JSX bleibt mit der Leinwand verbunden: Bearbeite es, und die Leinwand folgt.',
      hint: 'Wechsle zu React, HTML oder Design-JSX oder wähle eine andere Ebene.'
    },
    script: {
      title: 'Alles per Skript',
      detail:
        'Die openpencil-CLI arbeitet mit einer Datei, ohne dass die App läuft, oder steuert die geöffnete App. Untersuche ein Dokument, frage es mit XPath ab, prüfe es mit dem Linter, exportiere es oder führe mit eval Figma-Plugin-Code darauf aus. Der MCP-Server gibt Agenten dieselben Möglichkeiten über stdio oder HTTP.',
      hint: 'Führe einen Befehl aus und beobachte die Arbeitsfläche.'
    },
    sdk: {
      title: 'Bau es in dein eigenes Produkt ein',
      detail:
        'OpenPencil ist ebenso Werkzeugkasten wie App: eine Framework-unabhängige Engine, ein Headless-Vue-SDK und eigene Pakete für Szenengraph und Dateiformate. Bette eine Arbeitsfläche in dein Produkt ein, rendere und prüfe Designs in der CI oder baue einen anderen Editor auf derselben Engine. Jede Arbeitsfläche auf dieser Seite ist dieses SDK, eingebettet in eine Dokumentationsseite.',
      hint: 'Der Code neben der Arbeitsfläche ist alles, was man zum Einbinden braucht.'
    }
  },
  agents: {
    heading: 'Funktioniert mit',
    rest: 'und jedem MCP-Client'
  },
  commands: {
    cli: '{count} Befehle',
    mcp: '{count} MCP-Tools',
    mcpDetail:
      'Erstellen, gestalten, anordnen, untersuchen und exportieren. Jedes davon steht auch dem integrierten Agenten zur Verfügung.'
  },
  ownership: {
    title: 'Deine Dateien bleiben deine',
    items: [
      {
        title: 'Lokal zuerst',
        detail:
          'Dokumente sind Dateien auf deiner Festplatte. Kein Konto, kein Server, kein Internet nötig.'
      },
      {
        title: 'Dein Speicher',
        detail: 'Synchronisiere bei Bedarf über deinen eigenen S3-kompatiblen Bucket.'
      },
      {
        title: 'Offene Formate',
        detail: 'Export nach .fig, PDF, PPTX, SVG, HTML und JSX. Ein Wechsel ist jederzeit möglich.'
      },
      {
        title: 'MIT-lizenziert',
        detail: 'Der Editor, die Rendering-Engine, der .fig-Codec und die CLI.'
      }
    ]
  },
  roadmap: {
    title: 'Roadmap',
    more: 'Vollständige Roadmap',
    shipped: {
      label: 'Erschienen',
      entries: [
        { title: 'Interaktive Komponenten und Vorschau' },
        { title: 'Variablen als Design-Tokens' },
        { title: 'Linting mit Korrekturen per Klick' },
        { title: 'KI-Agenten als Mitwirkende, mit Folgemodus' },
        { title: 'KI-Schritte zurücknehmen, neu erzeugen und bearbeiten' },
        { title: 'Code mit Ebenen verknüpft' },
        { title: 'Visueller Diff und Patch' },
        { title: 'Kommentare und Sprachanrufe in geteilten Räumen' },
        { title: 'Vue- und React-Komponenten im Code-Tab' },
        { title: 'SVG- und HTML-Import als bearbeitbare Ebenen' },
        { title: 'Shader-Füllungen' },
        { title: 'W3C-Design-Tokens' },
        { title: 'Eine geführte Tour durch den Editor' },
        { title: 'Listen und Stile für beliebige Textbereiche' }
      ]
    },
    now: {
      label: 'Jetzt',
      entries: [
        {
          title: 'Storybook aus echten Komponenten',
          detail: 'Stories mit Reka UI für Vue und Radix UI für React.'
        },
        {
          title: 'Komponenten erstellen',
          detail: 'Schnelleres Bearbeiten von Varianten und Auswahl innerhalb von Komponenten.'
        }
      ]
    },
    next: {
      label: 'Als Nächstes',
      lead: {
        title: 'OpenPencil selbst hosten',
        detail:
          'Der gesamte Workspace in deinem eigenen Netzwerk: Synchronisierung, Freigabe, Kommentare und Team-Bibliotheken, ohne eine Datei an jemand anderen zu senden.',
        features: [
          {
            title: 'Dein Speicher',
            detail: 'Dokumente bleiben in deinem Bucket, in deiner Region.'
          },
          {
            title: 'Deine Identität',
            detail: 'Anmeldung über deinen OIDC- oder SSO-Anbieter, mit Rollen.'
          },
          {
            title: 'Dein Netzwerk',
            detail: 'Ein Kollaborations-Relay, das hinter deiner Firewall funktioniert.'
          },
          {
            title: 'Dein Betrieb',
            detail: 'Geführte Bereitstellung, Upgrades, Backups und Aufbewahrung.'
          }
        ]
      },
      entries: [
        {
          title: 'Versionsverlauf',
          detail: 'Automatische Snapshots, benannte Checkpoints und Wiederherstellung.'
        }
      ],
      cloud: {
        title: 'OpenPencil Cloud',
        detail:
          'Der gehostete Arbeitsbereich für Teams: Live-Synchronisierung, Freigabe, Bibliotheken und KI, ohne eigenen Betrieb.'
      }
    },
    later: {
      label: 'Später',
      entries: [
        {
          title: 'Verwaltete Design-Systeme',
          detail: 'Vorschlagen, prüfen, veröffentlichen und migrieren.'
        },
        {
          title: 'Einbettbarer Editor',
          detail: 'Bring den Editor von dieser Seite in dein eigenes Produkt.'
        }
      ]
    }
  },
  cloud: {
    badge: 'Früher Zugang',
    title: 'OpenPencil Cloud',
    lede: 'Der Design-Arbeitsbereich deines Teams, für dich gehostet. Alle bearbeiten dieselben Dateien live, teilen sie per Link und gestalten mit KI, ohne etwas zu installieren oder zu betreiben. Deine Dateien bleiben offen: Exportiere sie jederzeit als .fig.',
    features: [
      {
        title: 'Team-Synchronisierung in Echtzeit',
        detail: 'Jede Änderung erreicht sofort alle im Team, auf jedem Gerät.'
      },
      {
        title: 'Freigabelinks und Kommentare',
        detail: 'Schick einen Link zur Durchsicht und diskutiert direkt auf der Leinwand.'
      },
      {
        title: 'Team-Bibliotheken',
        detail: 'Komponenten, Stile und Tokens einmal veröffentlichen und in jeder Datei nutzen.'
      },
      {
        title: 'Gehostete KI',
        detail: 'Agenten, die mit dir gestalten, ohne API-Schlüssel zu verwalten.'
      },
      {
        title: 'SSO und Admin-Steuerung',
        detail: 'Single Sign-on, Rollen und Kontrolle darüber, wer was sieht.'
      }
    ]
  },
  waitlist: {
    label: 'E-Mail-Adresse',
    placeholder: 'du@beispiel.de',
    submit: 'Auf die Warteliste',
    confirmHuman: 'Bestätige, dass du ein Mensch bist',
    invalid: 'Gib eine gültige E-Mail-Adresse ein.',
    joined: 'Schau in dein Postfach',
    joinedDetail: 'Öffne den Link, den wir dir geschickt haben, um deine Adresse zu bestätigen.',
    failed:
      'Die Warteliste ist nicht erreichbar. Prüfe deine Verbindung und versuch es noch einmal.',
    privacy: 'Wir schreiben dir nur zu OpenPencil Cloud.',
    refused: 'Wir konnten nicht bestätigen, dass du kein Bot bist. Versuch es noch einmal.',
    limited: 'Zu viele Versuche. Versuch es in einer Minute noch einmal.',
    unavailable: 'Von hier aus ist die Anmeldung nicht möglich. Trag dich auf openpencil.dev ein.'
  },
  closing: {
    title: 'Nimm deine Designs mit.',
    download: 'OpenPencil herunterladen',
    docs: 'Dokumentation lesen',
    cloud: 'Auf die Cloud-Warteliste'
  },
  clipboard: {
    copy: 'Kopieren',
    copied: 'Kopiert'
  },
  stage: {
    activate: 'Live ausprobieren',
    terminal: {
      tree: 'Ebenenbaum',
      restyle: 'Akzent umfärben',
      addPlayer: 'Player hinzufügen',
      selection: 'Auswahl',
      export: 'Tailwind-Export'
    },
    ai: {
      recorded: 'Aufgezeichneter Durchgang',
      play: 'Abspielen',
      replay: 'Erneut abspielen',
      request: 'Füge neben dem Player eine Warteschlange „Up next“ hinzu.',
      reasoning:
        'Der Player steht allein im Hero-Rahmen, der seine Kinder in einer Reihe anordnet, also landet eine dort hinzugefügte Karte direkt daneben. Ich binde Hintergrund, Radius und Textfarben der Karte an die Theme-Variablen, die auch der Player nutzt, damit sie mit ihm zwischen Dunkel und Hell wechselt, und liste drei Titel auf, jeweils mit kleinem Cover, Titel und Interpret.',
      reply:
        'Neben dem Player gibt es jetzt eine Karte **Up next** mit drei Titeln. Farben und Radius kommen aus den Theme-Variablen, sie folgt dem Player also zwischen Dunkel und Hell.'
    },
    collab: {
      you: 'Du',
      yourScreen: 'Dein Bildschirm',
      theirScreen: 'Sams Bildschirm',
      askAgent: 'Agenten fragen'
    },
    sdk: {
      install: 'Installieren'
    }
  },
  download: {
    title: 'OpenPencil herunterladen',
    lede: 'Die Desktop-App für macOS, Windows und Linux. Kostenlos und quelloffen, ohne Anmeldung.',
    version: 'Version {version}, veröffentlicht am {date}',
    forPlatform: 'Für {platform} herunterladen',
    moreFiles: 'Weitere Downloads für {platform}',
    releaseNotes: 'Versionshinweise',
    yourSystem: 'Ihr System',
    arch: {
      appleSilicon: 'Apple Silicon',
      intel: 'Intel',
      x64: 'x64',
      arm: 'ARM'
    },
    formats: {
      dmg: 'Image-Datei',
      exe: 'Installationsprogramm',
      msi: 'Für verwaltete Installationen',
      appimage: 'Läuft auf den meisten Distributionen',
      deb: 'Debian, Ubuntu',
      rpm: 'Fedora, openSUSE'
    },
    requirements: 'Systemanforderungen',
    allTitle: 'Alle Downloads',
    checksums: 'SHA-256-Prüfsummen',
    onGitHub: 'Release auf GitHub',
    unavailable:
      'Die Liste der Downloads konnte nicht geladen werden. Alle Dateien finden Sie auf der Release-Seite auf GitHub.',
    others: {
      title: 'Weitere Wege',
      homebrew: {
        title: 'Homebrew',
        detail:
          'Die signierte macOS-App aus dem offiziellen Cask. Homebrew prüft jedes Update, daher kann es etwas später ankommen als hier.'
      },
      web: {
        title: 'Im Browser',
        detail: 'Derselbe Editor unter app.openpencil.dev, ohne Installation.',
        action: 'Web-App öffnen'
      },
      cli: {
        title: 'Kommandozeile',
        detail:
          '.fig-Dateien untersuchen, exportieren, prüfen und skripten, ohne die App zu öffnen.'
      },
      source: {
        title: 'Aus dem Quellcode',
        detail: 'Bauen Sie die App selbst mit Bun und Rust.',
        action: 'Build-Anleitung'
      }
    },
    beta: {
      badge: 'Beta',
      title: 'Probieren Sie, was kommt',
      lede: 'Betas bringen die Funktionen der nächsten Version früher, bevor sie alle erreichen.',
      caveats: [
        'Eine App mit der stabilen Version aktualisiert sich nicht auf eine Beta; installieren Sie die Beta, um sie zu testen.',
        'Entfernen Sie unter Linux eine mit .deb oder .rpm installierte Beta, bevor Sie die finale Version installieren.',
        'Die Betas von CLI und SDK liegen auf npm unter dem Tag next.'
      ],
      notes: 'Was ist neu'
    }
  }
}
