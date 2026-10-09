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
    interactive: {
      title: 'Componenti che funzionano',
      detail:
        'Dai a un componente un comportamento, come un interruttore, una casella, uno slider, delle schede o un campo di testo, e l’anteprima lo esegue come un vero controllo Reka UI. Le varianti diventano i suoi stati, e gli stessi componenti si esportano in Storybook con controlli cliccabili.',
      hint: 'Questa tela è in anteprima: aziona l’interruttore, trascina lo slider. Esci dall’anteprima per modificare.'
    },
    tokens: {
      title: 'Le variabili sono design token',
      detail:
        'Colori, spaziature e tipografia stanno in raccolte con modalità e si modificano come token. Il codice esportato scrive i valori collegati come proprietà personalizzate CSS, così il codice usa gli stessi nomi del design.',
      hint: 'Cambia il valore di un token o la modalità, e ogni livello collegato lo segue.'
    },
    linting: {
      title: 'Linting',
      detail:
        'OpenPencil controlla il design mentre lavori: contrasto, testo troppo piccolo, nomi predefiniti, livelli nascosti e vuoti, gruppi superflui. I problemi sono segnati sulla tela, molti si correggono con un clic, e le stesse regole funzionano nella CLI e per gli agenti.',
      hint: 'Fai clic su un indicatore sulla tela, oppure applica una correzione dall’elenco.'
    },
    ai: {
      title: 'Progetta con l’AI, con le tue chiavi',
      detail:
        'Chiedi con parole tue e l’agente modifica il documento con gli stessi strumenti che usi tu, mostrando il lavoro sulla tela man mano che arriva. Collega qualsiasi provider con la tua chiave, oppure usa l’agente di programmazione che già utilizzi.',
      hint: 'Un turno registrato passa per il vero ciclo dell’agente. Guarda la tela costruirsi mentre arriva.'
    },
    collab: {
      title: 'Lavorare insieme, persone e agenti',
      detail:
        'Condividi un link e tutti modificano lo stesso documento, peer to peer, con cursori in tempo reale, selezioni e modalità segui. Gli agenti AI si uniscono allo stesso modo: vedi dove lavorano, su ogni schermo della stanza.',
      hint: 'Entrambi gli schermi sono tuoi. Trascina un livello su uno e guardalo muoversi sull’altro, poi chiedi all’agente.'
    },
    code: {
      title: 'Dal design al codice',
      detail:
        'Ogni selezione è disponibile come Tailwind JSX, HTML o JSX di design, con le variabili scritte come token, e i componenti si esportano come storie di Storybook. Codice e tela restano collegati: seleziona una riga e viene selezionato il suo livello, modifica il JSX e la tela lo segue.',
      hint: 'Seleziona un altro livello e guarda il codice seguirlo.'
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
    shipped: {
      label: 'Rilasciato',
      entries: [
        { title: 'Componenti interattivi e anteprima' },
        { title: 'Variabili come design token' },
        { title: 'Linting con correzioni in un clic' },
        { title: 'Agenti AI come collaboratori, con modalità segui' },
        { title: 'Annulla, rigenera e modifica i turni dell’AI' },
        { title: 'Codice collegato ai livelli' },
        { title: 'Diff visivo e patch' }
      ]
    },
    now: {
      label: 'Ora',
      entries: [
        { title: 'Design token W3C', detail: 'Importare ed esportare token nel formato W3C.' },
        {
          title: 'Storybook da componenti reali',
          detail: 'Storie che usano Reka UI per Vue e Radix UI per React.'
        },
        {
          title: 'Creazione di componenti',
          detail: 'Modifica delle varianti più rapida e selezione dentro i componenti.'
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
        }
      ],
      cloud: {
        title: 'OpenPencil Cloud',
        detail:
          'Lo spazio ospitato per i team: sincronizzazione in diretta, condivisione, librerie e IA, senza nulla da gestire.'
      }
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
  cloud: {
    badge: 'Accesso anticipato',
    title: 'OpenPencil Cloud',
    lede: 'Lo spazio di design del tuo team, ospitato per te. Tutti modificano gli stessi file in diretta, li condividono con un link e progettano con l’IA, senza nulla da installare o gestire. I tuoi file restano aperti: esportali come .fig quando vuoi.',
    features: [
      {
        title: 'Sincronizzazione del team in tempo reale',
        detail:
          'Ogni modifica raggiunge tutto il team nel momento in cui avviene, su qualsiasi dispositivo.'
      },
      {
        title: 'Link di condivisione e commenti',
        detail: 'Invia un link per rivedere un design e discuterne direttamente sulla tela.'
      },
      {
        title: 'Librerie del team',
        detail: 'Pubblica componenti, stili e token una volta e usali in ogni file.'
      },
      {
        title: 'IA ospitata',
        detail: 'Agenti che progettano con te, senza chiavi API da gestire.'
      },
      {
        title: 'SSO e controlli di amministrazione',
        detail: 'Single sign-on, ruoli e controllo su chi vede cosa.'
      }
    ]
  },
  waitlist: {
    label: 'Indirizzo email',
    placeholder: 'tu@esempio.it',
    submit: "Iscriviti alla lista d'attesa",
    invalid: 'Inserisci un indirizzo email valido.',
    joined: 'Sei nella lista',
    joinedDetail: 'Ti scriveremo quando OpenPencil Cloud aprirà.',
    failed: 'Iscrizione non riuscita',
    failedDetail: 'Riprova tra un momento.',
    privacy: 'Ti scriveremo solo riguardo a OpenPencil Cloud.'
  },
  closing: {
    title: 'Porta i tuoi design con te.',
    download: 'Scarica OpenPencil',
    docs: 'Leggi la documentazione',
    cloud: "Iscriviti alla lista d'attesa di Cloud"
  },
  stage: {
    activate: 'Provalo dal vivo',
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
        'I piani sono in una colonna con auto-layout, quindi una riga di tre schede può stare subito sotto e seguire il layout. Ogni scheda avrà un titolo breve e una riga di dettaglio, con lo sfondo e il raggio degli angoli delle schede dei piani, così la riga sembra parte della pagina.',
      reply:
        'Ho aggiunto una riga **Guarantees** sotto i piani: tre schede con lo stesso sfondo e raggio delle schede dei piani.'
    },
    collab: {
      you: 'Tu',
      yourScreen: 'Il tuo schermo',
      theirScreen: 'Lo schermo di Sam',
      askAgent: 'Chiedi all’agente'
    },
    sdk: {
      copy: 'Copia',
      copied: 'Copiato',
      install: 'Installa'
    }
  }
}
