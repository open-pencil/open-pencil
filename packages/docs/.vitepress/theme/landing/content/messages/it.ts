import type { LandingMessages } from './types'

export const it: LandingMessages = {
  hero: {
    title: 'Design senza lock‑in.',
    lede: 'Un editor di design open source che apre i tuoi file Figma, gira sul tuo computer e lascia a te o al tuo agente AI il controllo di ogni livello.',
    open: 'Apri l’editor',
    download: 'Scarica',
    github: 'GitHub'
  },
  loading: 'Caricamento dell’editor',
  features: {
    figma: {
      title: 'Apri i tuoi file Figma',
      detail:
        'OpenPencil legge direttamente i file .fig: pagine, componenti, istanze, variabili e auto-layout arrivano come livelli modificabili. Il copia e incolla funziona in entrambe le direzioni, e puoi salvare di nuovo in .fig.',
      hint: 'Questo è un vero file .fig. Espandi i livelli ed esploralo.'
    },
    design: {
      title: 'Progetta con strumenti veri',
      detail:
        'Auto-layout, vincoli, riempimenti, tracce, effetti e tipografia, con i controlli dove te li aspetti. Tutto è annullabile e niente aspetta un server.',
      hint: 'Seleziona un livello e cambia riempimento, raggio o spaziatura interna.'
    },
    components: {
      title: 'Componenti e variabili',
      detail:
        'Crea una libreria con varianti e proprietà dei componenti, collega colori e spaziature alle variabili e cambia modalità. Le istanze seguono la loro origine mentre la modifichi.',
      hint: 'Cerca tra le risorse, poi trascina un componente sulla tela.'
    },
    ai: {
      title: 'Progetta con l’AI, con le tue chiavi',
      detail:
        'Chiedi con parole tue e l’agente modifica il documento con gli stessi strumenti che usi tu, mostrando il lavoro sulla tela man mano che arriva. Collega qualsiasi provider con la tua chiave, oppure usa l’agente di programmazione che già utilizzi.',
      hint: 'Un turno registrato passa per il vero ciclo dell’agente. Guarda la tela costruirsi mentre arriva.'
    },
    code: {
      title: 'Dal design al codice',
      detail:
        'Ogni selezione è disponibile come Tailwind JSX, HTML o JSX di design, e i componenti si esportano come storie di Storybook. Modifica il JSX e la tela lo segue.',
      hint: 'Seleziona un altro livello e guarda il codice cambiare.'
    },
    script: {
      title: 'Automatizza tutto',
      detail:
        'La CLI openpencil lavora su un file senza che l’app sia aperta, oppure controlla l’app in esecuzione. Ispeziona un documento, interrogalo con XPath, controllalo con il linter, esportalo o esegui codice dei plugin Figma con eval. Il server MCP offre agli agenti le stesse possibilità tramite stdio o HTTP.',
      hint: 'Esegui un comando e osserva la tela.'
    },
    sdk: {
      title: 'Integralo nel tuo prodotto',
      detail:
        'OpenPencil è tanto un insieme di strumenti quanto un’app: un motore indipendente dal framework, un SDK Vue headless e pacchetti separati per il grafo di scena e i formati di file. Incorpora una tela nel tuo prodotto, genera e controlla i design in CI oppure costruisci un altro editor sullo stesso motore. Ogni tela di questa pagina è quell’SDK in esecuzione dentro un sito di documentazione.',
      hint: 'Il codice accanto alla tela è tutto ciò che serve per montarne una.'
    }
  },
  agents: {
    heading: 'Funziona con',
    rest: 'e qualsiasi client MCP'
  },
  commands: {
    cli: '{count} comandi',
    mcp: '{count} strumenti MCP',
    mcpDetail:
      'Creare, applicare stili, impaginare, ispezionare ed esportare. Ognuno è disponibile anche per l’agente integrato.'
  },
  ownership: {
    title: 'I tuoi file restano tuoi',
    items: [
      {
        title: 'Prima in locale',
        detail:
          'I documenti sono file sul tuo disco. Nessun account, nessun server, nessuna connessione necessaria.'
      },
      {
        title: 'Il tuo spazio di archiviazione',
        detail: 'Sincronizza tramite il tuo bucket compatibile con S3 quando ti serve.'
      },
      {
        title: 'Formati aperti',
        detail: 'Esporta in .fig, PDF, PPTX, SVG, HTML e JSX. Andarsene è sempre possibile.'
      },
      {
        title: 'Licenza MIT',
        detail: 'L’editor, il motore di rendering, il codec .fig e la CLI.'
      }
    ]
  },
  roadmap: {
    title: 'Roadmap',
    more: 'Roadmap completa',
    now: {
      label: 'Ora',
      entries: [
        {
          title: 'Agenti AI come collaboratori',
          detail:
            'Gli agenti compaiono sulla tela come qualsiasi altro partecipante, e puoi seguire ciò che fanno.'
        },
        {
          title: 'Annulla, rigenera e modifica i turni dell’AI',
          detail: 'Ogni chiamata a uno strumento mostra che cosa ha cambiato.'
        },
        {
          title: 'Controlli di design in tempo reale',
          detail: 'Un pannello Lint con indicatori sulla tela e correzioni.'
        },
        {
          title: 'Codice collegato ai livelli',
          detail: 'Selezione e modifiche si sincronizzano in entrambe le direzioni.'
        },
        {
          title: 'Diff visivo e patch',
          detail: 'Nell’app, per gli agenti e come openpencil diff.'
        }
      ]
    },
    next: {
      label: 'Poi',
      lead: {
        title: 'OpenPencil self-hosted',
        detail:
          'L’intero spazio di lavoro dentro la tua rete: sincronizzazione, condivisione, commenti e librerie di team senza inviare un file a nessun altro.',
        features: [
          {
            title: 'Il tuo spazio di archiviazione',
            detail: 'I documenti restano nel tuo bucket, nella tua regione.'
          },
          {
            title: 'La tua identità',
            detail: 'Accesso tramite il tuo provider OIDC o SSO, con ruoli.'
          },
          {
            title: 'La tua rete',
            detail: 'Un relay di collaborazione che funziona dietro il tuo firewall.'
          },
          {
            title: 'La tua gestione',
            detail: 'Distribuzione guidata, aggiornamenti, backup e conservazione.'
          }
        ]
      },
      entries: [
        {
          title: 'Cronologia delle versioni',
          detail: 'Istantanee automatiche, checkpoint con nome e ripristino.'
        },
        {
          title: 'OpenPencil Cloud, facoltativo',
          detail:
            'Sincronizzazione e condivisione ospitate per i team che le vogliono. Mai obbligatorio.'
        }
      ]
    },
    later: {
      label: 'Più avanti',
      entries: [
        {
          title: 'Design system governati',
          detail: 'Proporre, rivedere, pubblicare e migrare.'
        },
        {
          title: 'Editor incorporabile',
          detail: 'Porta l’editor di questa pagina nel tuo prodotto.'
        }
      ]
    }
  },
  closing: {
    title: 'Porta i tuoi design con te.',
    download: 'Scarica OpenPencil',
    docs: 'Leggi la documentazione'
  },
  stage: {
    terminal: {
      tree: 'Albero dei livelli',
      restyle: 'Cambia i pulsanti',
      addPlan: 'Aggiungi un piano',
      selection: 'Selezione',
      export: 'Esporta in Tailwind'
    },
    ai: {
      recorded: 'Turno registrato',
      play: 'Riproduci',
      replay: 'Riproduci di nuovo',
      request: 'Aggiungi tre garanzie sotto i piani.',
      reasoning:
        'I piani sono in una colonna con auto-layout, quindi una riga di tre schede può stare subito sotto.',
      reply:
        'Ho aggiunto una riga **Guarantees** sotto i piani: tre schede con lo stesso sfondo e raggio delle schede dei piani.'
    },
    sdk: {
      copy: 'Copia',
      copied: 'Copiato'
    }
  }
}
