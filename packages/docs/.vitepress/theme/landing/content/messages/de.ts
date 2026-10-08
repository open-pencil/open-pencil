import type { LandingMessages } from './types'

export const de: LandingMessages = {
  hero: {
    title: 'Design ohne Lock‑in.',
    lede: 'Ein Open-Source-Design-Editor, der deine Figma-Dateien öffnet, auf deinem Rechner läuft und jede Ebene von dir oder deinem KI-Agenten steuern lässt.',
    open: 'Editor öffnen',
    download: 'Herunterladen',
    github: 'GitHub'
  },
  loading: 'Editor wird geladen',
  features: {
    figma: {
      title: 'Öffne deine Figma-Dateien',
      detail:
        'OpenPencil liest .fig-Dateien direkt: Seiten, Komponenten, Instanzen, Variablen und Auto-Layout kommen als bearbeitbare Ebenen an. Kopieren und Einfügen funktioniert in beide Richtungen, und du kannst wieder als .fig speichern.',
      hint: 'Das ist eine echte .fig-Datei. Klappe die Ebenen auf und klick dich durch.'
    },
    design: {
      title: 'Gestalten mit echten Werkzeugen',
      detail:
        'Auto-Layout, Constraints, Füllungen, Konturen, Effekte und Typografie, mit den Bedienelementen dort, wo du sie erwartest. Alles lässt sich rückgängig machen, und nichts wartet auf einen Server.',
      hint: 'Wähle eine Ebene aus und ändere Füllung, Radius oder Innenabstand.'
    },
    interactive: {
      title: 'Komponenten, die funktionieren',
      detail:
        'Gib einer Komponente ein Verhalten, etwa Schalter, Checkbox, Schieberegler, Tabs oder Textfeld, und die Vorschau führt sie als echtes Reka-UI-Steuerelement aus. Varianten werden zu ihren Zuständen, und dieselben Komponenten lassen sich mit klickbaren Steuerelementen nach Storybook exportieren.',
      hint: 'Diese Arbeitsfläche ist in der Vorschau: Lege den Schalter um, zieh den Regler. Verlasse die Vorschau zum Bearbeiten.'
    },
    tokens: {
      title: 'Variablen sind Design-Tokens',
      detail:
        'Farben, Abstände und Schrift liegen in Sammlungen mit Modi und werden als Tokens bearbeitet. Exportierter Code schreibt gebundene Werte als CSS-Custom-Properties, sodass der Code dieselben Namen verwendet wie das Design.',
      hint: 'Ändere den Wert eines Tokens oder wechsle den Modus, und jede daran gebundene Ebene folgt.'
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
        'Teile einen Link, und alle bearbeiten dasselbe Dokument, Peer-to-Peer, mit Live-Cursorn, Auswahlen und Folgemodus. KI-Agenten kommen genauso dazu: Du siehst auf jedem Bildschirm im Raum, wo sie arbeiten.',
      hint: 'Beide Bildschirme gehören dir. Zieh auf einem eine Ebene und sieh zu, wie sie sich auf dem anderen bewegt; dann frag den Agenten.'
    },
    code: {
      title: 'Vom Design zum Code',
      detail:
        'Jede Auswahl steht als Tailwind JSX, HTML oder Design-JSX bereit, Variablen als Tokens, und Komponenten lassen sich als Storybook-Stories exportieren. Code und Arbeitsfläche bleiben verknüpft: Wähle eine Zeile aus, und ihre Ebene wird ausgewählt; bearbeite das JSX, und die Arbeitsfläche folgt.',
      hint: 'Wähle eine andere Ebene aus und sieh zu, wie der Code folgt.'
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
    now: {
      label: 'Jetzt',
      entries: [
        {
          title: 'KI-Agenten als Mitwirkende',
          detail:
            'Agenten erscheinen auf der Arbeitsfläche wie jeder andere Teilnehmer, und du kannst ihnen folgen.'
        },
        {
          title: 'KI-Schritte zurücknehmen, neu erzeugen und bearbeiten',
          detail: 'Jeder Tool-Aufruf zeigt, was er geändert hat.'
        },
        {
          title: 'Design-Prüfungen in Echtzeit',
          detail: 'Ein Lint-Panel mit Markierungen auf der Arbeitsfläche und Korrekturen.'
        },
        {
          title: 'Code mit Ebenen verknüpft',
          detail: 'Auswahl und Änderungen werden in beide Richtungen synchronisiert.'
        },
        {
          title: 'Visueller Diff und Patch',
          detail: 'In der App, für Agenten und als openpencil diff.'
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
        },
        {
          title: 'Optionale OpenPencil Cloud',
          detail: 'Gehostete Synchronisierung und Freigabe für Teams, die das möchten. Nie Pflicht.'
        }
      ]
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
  closing: {
    title: 'Nimm deine Designs mit.',
    download: 'OpenPencil herunterladen',
    docs: 'Dokumentation lesen'
  },
  stage: {
    terminal: {
      tree: 'Ebenenbaum',
      restyle: 'Buttons umgestalten',
      addPlan: 'Tarif hinzufügen',
      selection: 'Auswahl',
      export: 'Tailwind-Export'
    },
    ai: {
      recorded: 'Aufgezeichneter Durchgang',
      play: 'Abspielen',
      replay: 'Erneut abspielen',
      request: 'Füge drei Garantien unter den Tarifen hinzu.',
      reasoning:
        'Die Tarife liegen in einer Auto-Layout-Spalte, also passt eine Reihe mit drei Karten direkt darunter.',
      reply:
        'Unter den Tarifen gibt es jetzt eine Reihe **Guarantees**: drei Karten mit dem Hintergrund und Radius der Tarifkarten.'
    },
    collab: {
      you: 'Du',
      yourScreen: 'Dein Bildschirm',
      theirScreen: 'Sams Bildschirm',
      askAgent: 'Agenten fragen',
    },
    sdk: {
      copy: 'Kopieren',
      copied: 'Kopiert'
    }
  }
}
