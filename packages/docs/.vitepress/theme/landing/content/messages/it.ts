import type { LandingMessages } from './types'

export const it: LandingMessages = {
  hero: {
    title: 'Design senza lock‑in.',
    lede: 'Un editor di design open source che apre i tuoi file Figma, gira sul tuo computer e lascia a te o al tuo agente AI il controllo di ogni livello.',
    open: 'Fai il tour',
    download: 'Scarica',
    github: 'GitHub'
  },
  loading: 'Caricamento dell’editor',
  features: {
    figma: {
      title: 'Apri quello che hai già',
      detail:
        'OpenPencil legge direttamente i file .fig: pagine, componenti, istanze, variabili e auto layout arrivano come livelli modificabili, e puoi salvare di nuovo in .fig. Incolla SVG o apri HTML e CSS, e diventano livelli anche loro, disposti come li dispone un browser.',
      hint: 'Questo è il tour dell’app stessa, un vero file .fig. Apri un capitolo nei livelli ed esplora.'
    },
    design: {
      title: 'Progetta con strumenti veri',
      detail:
        'Auto layout, vincoli, riempimenti, tratti, effetti e tipografia, con i controlli dove te li aspetti. I componenti hanno slot: un’istanza mantiene il design e porta il proprio contenuto. Tutto si può annullare, e niente aspetta un server.',
      hint: 'Passa sopra la copertina selezionata e trascina un angolo per arrotondarlo. Gli altri lettori portano la propria copertina tramite lo slot Artwork.'
    },
    board: {
      title: 'Pianifica sulle lavagne',
      detail:
        'Le lavagne portano note adesive, forme, connettori e sezioni di FigJam, e aprono e salvano i file .jam che Figma legge. Incolla un diagramma di flusso Mermaid o apri un diagramma draw.io e diventa forme da spostare; gli agenti abbozzano lavagne con gli stessi strumenti.',
      hint: 'Trascina una nota o una forma: i suoi connettori la seguono. Scegli uno strumento dalla barra per aggiungere i tuoi.'
    },
    interactive: {
      title: 'Componenti che funzionano',
      detail:
        'Dai a un componente un comportamento, come un interruttore, una casella, uno slider, delle schede o un campo di testo, e l’anteprima lo esegue come un vero controllo Reka UI. Le varianti diventano i suoi stati, e gli stessi componenti si esportano in Storybook con controlli cliccabili.',
      hint: 'Questa tela è in anteprima: premi play, trascina la barra di avanzamento, attiva la riproduzione casuale. Esci dall’anteprima per modificare.'
    },
    tokens: {
      title: 'Le variabili sono design token',
      detail:
        'Colori, spaziature e tipografia stanno in raccolte con modalità e si modificano come token. Il codice esportato scrive i valori collegati come proprietà personalizzate CSS, così il codice usa gli stessi nomi del design.',
      hint: 'Ogni lettore legge la collezione Theme nella propria modalità. Cambia il valore di un token ed entrambi lo seguono.'
    },
    shaders: {
      title: 'Riempimenti che si muovono',
      detail:
        'Uno shader è un riempimento come gli altri: sceglilo nel selettore di riempimento, impila effetti, regola i cursori o incolla un preset da shaders.com. I file ne conservano un fotogramma fisso, così si aprono ovunque, e l’anteprima lo riproduce.',
      hint: 'Questa tela è in anteprima, per questo gli shader si muovono. Esci dall’anteprima, seleziona un quadrato e apri il suo riempimento.'
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
        'Condividi un link e tutti modificano lo stesso documento, peer to peer, con cursori dal vivo, modalità segui, commenti fissati ai livelli e chiamate vocali. Gli agenti di IA entrano allo stesso modo: tutti nella stanza li guardano costruire mentre trasmettono.',
      hint: 'Entrambi gli schermi sono tuoi. Trascina un livello su uno e guardalo muoversi sull’altro, poi chiedi all’agente.'
    },
    code: {
      title: 'Dal design al codice',
      detail:
        'Ogni selezione è un componente Vue o React, con le varianti come props e Reka UI o Radix dietro quelli interattivi, oppure HTML, Tailwind e design JSX con le variabili scritte come token. I componenti si esportano come storie di Storybook, e il design JSX resta collegato alla tela: modificalo e la tela lo segue.',
      hint: 'Passa a React, HTML o design JSX, oppure seleziona un altro livello.'
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
        { title: 'OpenPencil Cloud, anche self-hosted' },
        { title: 'Lavagne in stile FigJam' },
        { title: 'Pagine web da un URL come livelli' },
        { title: 'Agent Skills e subagenti' },
        { title: 'Formule nelle variabili' },
        { title: 'Font variabili, Material Symbols e SF Symbols' },
        { title: 'Vetro, sfocatura progressiva, rumore e texture' },
        { title: 'Regolazioni delle immagini' },
        { title: 'Lo strumento Scala' },
        { title: 'Una tela più veloce' },
        { title: 'Commenti e chiamate vocali nelle stanze condivise' },
        { title: 'Componenti interattivi e anteprima' },
        { title: 'Linting con correzioni in un clic' }
      ]
    },
    now: {
      label: 'Ora',
      entries: [
        {
          title: 'Colori Display P3',
          detail:
            'I documenti vengono disegnati ed esportati nel loro profilo colore, come in Figma.'
        },
        {
          title: 'Importare siti web',
          detail: 'Pagine da un URL più fedeli al browser, in più dimensioni di finestra.'
        },
        {
          title: 'OpenPencil su Android',
          detail: 'L’editor su telefoni, tablet e pieghevoli Android.'
        }
      ]
    },
    next: {
      label: 'Poi',
      leads: [
        {
          title: 'OpenPencil sul telefono',
          detail: 'Un’app companion per iOS e Android, e l’editor stesso su telefoni e tablet.',
          features: [
            {
              title: 'App companion',
              detail: 'Apri i file Cloud, segui una stanza dal vivo e rispondi a commenti e agenti.'
            },
            {
              title: 'Anteprima sul dispositivo',
              detail: 'Mostra un frame del desktop sul telefono mentre progetti.'
            },
            {
              title: 'Progettare su tablet',
              detail: 'Input touch e con penna, con pannelli pensati per schermi piccoli.'
            },
            {
              title: 'Gli stessi documenti',
              detail: 'L’editor e il Cloud che usi già, non un’app separata.'
            }
          ]
        },
        {
          title: 'Presentazioni',
          detail: 'Presentazioni accanto a design e lavagne, costruite con il tuo design system.',
          features: [
            {
              title: 'I tuoi componenti',
              detail:
                'Le presentazioni usano gli stessi componenti, variabili e librerie dei tuoi design.'
            },
            {
              title: 'Vista relatore',
              detail:
                'Note del relatore, presentazione a schermo intero e un pubblico che segue dal vivo.'
            },
            {
              title: 'File di Figma Slides',
              detail: 'Apri e salva file .deck, ed esporta in PDF e PowerPoint.'
            },
            {
              title: 'Presentazioni con l’IA',
              detail:
                'Prepara una bozza da una scaletta o da un documento, nel tema della presentazione.'
            }
          ]
        }
      ],
      entries: [
        {
          title: 'Single sign-on',
          detail: 'OIDC e SSO per i team, con account di servizio e webhook.'
        },
        {
          title: 'Progetti e cartelle',
          detail: 'Organizza gli spazi Cloud, con modelli e ricerca.'
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
        },
        { title: 'Prototipazione', detail: 'Collegamenti, transizioni e overlay tra frame.' }
      ]
    }
  },
  cloud: {
    badge: 'Ora disponibile',
    title: 'OpenPencil Cloud',
    lede: 'Lo spazio di design del tuo team, ospitato per te. Tutti modificano gli stessi file dal vivo, li condividono con un link e progettano con l’IA pagata con i crediti del piano, senza nulla da installare o gestire. Inizia gratis con 300 MB ed esporta i tuoi file in .fig quando vuoi.',
    signUp: 'Prova OpenPencil Cloud',
    plans: 'Vedi i piani',
    features: [
      {
        title: 'Sincronizzazione in tempo reale',
        detail: 'Ogni modifica arriva a tutto il team mentre avviene, su ogni dispositivo.'
      },
      {
        title: 'Link e commenti',
        detail: 'Invia un link per rivedere un design e discutine direttamente sulla tela.'
      },
      {
        title: 'Cronologia delle versioni',
        detail: 'Versioni con nome e salvataggi automatici da vedere, ripristinare o copiare.'
      },
      {
        title: 'L’IA del tuo piano',
        detail: 'Agenti che progettano con te, pagati con i crediti del piano, senza chiavi API.'
      },
      {
        title: 'Self-hosting',
        detail: 'Esegui lo stesso server sulla tua infrastruttura, con licenza Apache 2.0.'
      }
    ]
  },
  closing: {
    title: 'Porta i tuoi design con te.',
    download: 'Scarica OpenPencil',
    docs: 'Leggi la documentazione',
    cloud: 'Prova OpenPencil Cloud'
  },
  clipboard: {
    copy: 'Copia',
    copied: 'Copiato'
  },
  stage: {
    activate: 'Provalo dal vivo',
    terminal: {
      tree: 'Albero dei livelli',
      restyle: 'Ricolora l’accento',
      addPlayer: 'Aggiungi un lettore',
      selection: 'Selezione',
      export: 'Esporta in Tailwind'
    },
    ai: {
      recorded: 'Turno registrato',
      play: 'Riproduci',
      replay: 'Riproduci di nuovo',
      request: 'Aggiungi una coda «Up next» accanto al lettore.',
      reasoning:
        'Il lettore è da solo nel frame dell’hero, che dispone i figli in riga, quindi una scheda aggiunta lì finisce proprio accanto. Collego sfondo, raggio e colori del testo della scheda alle variabili Theme usate dal lettore, così passa con lui da scuro a chiaro, ed elenco tre brani, ciascuno con una piccola copertina, un titolo e un artista.',
      reply:
        'Ho aggiunto una scheda **Up next** accanto al lettore con tre brani. Colori e raggio vengono dalle variabili Theme, quindi segue il lettore tra scuro e chiaro.'
    },
    collab: {
      you: 'Tu',
      yourScreen: 'Il tuo schermo',
      theirScreen: 'Lo schermo di Sam',
      askAgent: 'Chiedi all’agente'
    },
    sdk: {
      install: 'Installa'
    }
  },
  download: {
    title: 'Scarica OpenPencil',
    lede: 'L’app desktop per macOS, Windows e Linux. Gratuita e open source, senza registrazione.',
    version: 'Versione {version}, pubblicata il {date}',
    forPlatform: 'Scarica per {platform}',
    moreFiles: 'Altri download per {platform}',
    releaseNotes: 'Note di rilascio',
    yourSystem: 'Il tuo sistema',
    arch: {
      appleSilicon: 'Apple Silicon',
      intel: 'Intel',
      x64: 'x64',
      arm: 'ARM'
    },
    formats: {
      dmg: 'Immagine disco',
      exe: 'Programma di installazione',
      msi: 'Per installazioni gestite',
      appimage: 'Funziona sulla maggior parte delle distribuzioni',
      deb: 'Debian, Ubuntu',
      rpm: 'Fedora, openSUSE'
    },
    requirements: 'Requisiti di sistema',
    allTitle: 'Tutti i download',
    checksums: 'Checksum SHA-256',
    onGitHub: 'Versione su GitHub',
    unavailable:
      'Non è stato possibile caricare l’elenco dei download. Tutti i file sono nella pagina delle versioni su GitHub.',
    others: {
      title: 'Altri modi per averla',
      homebrew: {
        title: 'Homebrew',
        detail:
          'L’app macOS firmata, dal cask ufficiale. Homebrew controlla ogni aggiornamento, quindi può arrivare un po’ più tardi che qui.'
      },
      web: {
        title: 'Nel browser',
        detail: 'Lo stesso editor su cloud.openpencil.dev, senza installare nulla.',
        action: 'Apri l’app web'
      },
      cli: {
        title: 'Riga di comando',
        detail: 'Ispeziona, esporta, controlla e automatizza file .fig senza aprire l’app.'
      },
      source: {
        title: 'Dai sorgenti',
        detail: 'Compila l’app da te con Bun e Rust.',
        action: 'Istruzioni di compilazione'
      }
    },
    nightly: {
      badge: 'Nightly',
      title: 'Prova quello che arriva',
      lede: 'Le nightly vengono compilate ogni notte dal codice più recente, così le novità arrivano appena sono pronte.',
      caveats: [
        'Una nightly non passa i test di una release e può rompersi; tieni una copia del tuo lavoro.',
        'Hai già l’app? Scegli Nightly in Impostazioni → Aggiornamenti → Canale di aggiornamento invece di scaricarla.',
        'Una nightly si aggiorna alla build della notte successiva. Per tornare indietro, scegli Stabile lì.'
      ],
      onGitHub: 'Ultima nightly su GitHub'
    }
  }
}
