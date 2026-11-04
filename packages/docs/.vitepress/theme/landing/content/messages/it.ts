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
        { title: 'Componenti interattivi e anteprima' },
        { title: 'Variabili come design token' },
        { title: 'Linting con correzioni in un clic' },
        { title: 'Agenti AI come collaboratori, con modalità segui' },
        { title: 'Annulla, rigenera e modifica i turni dell’AI' },
        { title: 'Codice collegato ai livelli' },
        { title: 'Diff visivo e patch' },
        { title: 'Commenti e chiamate vocali nelle stanze condivise' },
        { title: 'Componenti Vue e React nella scheda Codice' },
        { title: 'Importazione di SVG e HTML come livelli modificabili' },
        { title: 'Riempimenti con shader' },
        { title: 'Design token W3C' },
        { title: 'Un tour guidato dell’editor' },
        { title: 'Elenchi e stili per qualsiasi porzione di testo' }
      ]
    },
    now: {
      label: 'Ora',
      entries: [
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
    confirmHuman: 'Conferma di essere umano',
    invalid: 'Inserisci un indirizzo email valido.',
    joined: 'Controlla la posta',
    joinedDetail: 'Apri il link che ti abbiamo inviato per confermare l’indirizzo.',
    failed: 'Impossibile raggiungere la lista d’attesa. Controlla la connessione e riprova.',
    privacy: 'Ti scriveremo solo riguardo a OpenPencil Cloud.',
    refused: 'Non siamo riusciti a confermare che non sei un bot. Riprova.',
    limited: 'Troppi tentativi. Riprova tra un minuto.',
    unavailable: 'Non puoi iscriverti da qui. Iscriviti su openpencil.dev.'
  },
  closing: {
    title: 'Porta i tuoi design con te.',
    download: 'Scarica OpenPencil',
    docs: 'Leggi la documentazione',
    cloud: "Iscriviti alla lista d'attesa di Cloud"
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
        detail: 'Lo stesso editor su app.openpencil.dev, senza installare nulla.',
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
    beta: {
      badge: 'Beta',
      title: 'Prova quello che arriva',
      lede: 'Le beta portano in anticipo le funzioni della prossima versione, prima che arrivino a tutti.',
      caveats: [
        'Un’app sulla versione stabile non si aggiorna a una beta; installa la beta per provarla.',
        'Su Linux, rimuovi una beta installata con .deb o .rpm prima di installare la versione finale.',
        'Le beta della CLI e dell’SDK sono su npm con il tag next.'
      ],
      notes: 'Novità'
    }
  }
}
