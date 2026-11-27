---
pageClass: guide
title: Icone
description: Cerca nei set di icone open source e in SF Symbols, inserisci icone e sostituiscile, ricolorale o cambiane lo stile in OpenPencil.
---

# Icone

OpenPencil cerca nei set di icone open source pubblicati tramite [Iconify](https://iconify.design), come Lucide, Material Symbols, Tabler e Phosphor, e, nell’app per Mac, negli SF Symbols di Apple. Un’icona inserita ricorda di quale icona si tratta, così puoi sostituirla con un’altra o cambiarne il colore in seguito, e le esportazioni la scrivono come quell’icona.

Per cercare e inserire icone serve una connessione di rete all’API di Iconify.

## Inserire un’icona

Apri il selettore di icone in uno di questi modi:

- Fai clic su **Inserisci icona** alla fine della barra degli strumenti.
- Scegli **Oggetto → Inserisci icona…**.
- Cerca **Inserisci icona** nella tavolozza dei comandi, <Keys mac="⌘ K" other="Ctrl K" />.

Prima che tu scriva, il selettore mostra le icone già inserite in questo file e quelle che hai scelto di recente. Scrivi ciò che cerchi, come `arrow` o `heart`, per cercare in tutti i set. Passa il puntatore su un’icona per vederne il nome e il set.

Scegline una per inserirla, a 24 × 24, al centro della vista, dentro la cornice che stai modificando se ne hai aperta una. La nuova icona viene selezionata, e <Keys mac="⌘ Z" other="Ctrl Z" /> la rimuove in un solo passaggio.

<GuideImage name="icons/picker" alt="Il selettore di icone mentre cerca heart, con risultati da diversi set di icone" />

## Scegliere un set di icone

Il pulsante del set alla fine del campo di ricerca (all’inizio **Tutti i set di icone**) limita il selettore a un solo set. I set sono raggruppati per tipo, come Material o Logos; scrivi per trovarne uno per nome, come `tabler`. Ogni set mostra quante icone contiene.

Con un set scelto, il selettore mostra l’intero set, caricandone altre man mano che scorri, e una ricerca guarda solo in quel set. Passa il puntatore su un’icona, o raggiungila con i tasti freccia, per vederne il nome, il set e la licenza sotto la griglia. Il selettore ricorda l’ultimo set che hai scelto, e **Sostituisci icona** si apre sul set dell’icona che stai sostituendo.

## Sostituire o ricolorare un’icona

Selezionando un’icona inserita, nel pannello Design compare una sezione **Icona**.

- **Sostituisci icona** apre il selettore e disegna l’icona scelta al posto di quella attuale. L’icona mantiene dimensioni, posizione e colore.
- **Colore dell'icona** cambia il colore dei tracciati propri dell’icona. Le icone disegnate in più colori fissi, come i loghi dei marchi, mantengono quei colori e non mostrano questo campo.

- Le **opzioni** compaiono per le icone di Material Symbols e SF Symbols, che OpenPencil disegna da sé; vedi sotto. Cambiarne una ridisegna l’icona.

Ogni sostituzione, cambio di colore o di opzione è un singolo passaggio di annullamento; un trascinamento nel selettore del colore si annulla come un’unica modifica.

Un’icona è una cornice di tracciati vettoriali, con il nome dell’icona, come `cat`, e contrassegnata da una faccina nell’albero dei livelli. A differenza delle altre cornici della pagina, non ha un titolo sulla tela, e ridimensionarla scala i suoi tracciati. I suoi livelli, vincoli, effetti e il resto del pannello Design funzionano come per qualsiasi cornice.

## Regolare i Material Symbols

Material Symbols Outlined, Rounded e Sharp vengono disegnati a partire dai font variabili di Google, quindi le loro opzioni nella sezione Icona sono gli assi propri dei font:

- **Weight**, da 100 a 700.
- **Fill**, 0 per il contorno o 1 per il pieno.
- **Grade**, da −50 a 200, che ispessisce leggermente i tratti senza cambiare le dimensioni dell’icona, per esempio per bilanciare icone chiare su uno sfondo scuro.
- **Optical size**, da 20 a 48. Un’icona inserita parte dalla dimensione ottica corrispondente alle sue dimensioni, come raccomanda Google, quindi un’icona di 24 × 24 usa 24; impostala tu per disegnare un’icona piccola con il dettaglio di una grande, o viceversa.

## Usare gli SF Symbols {#sf-symbols}

Gli SF Symbols sono le icone di Apple. Apple ne concede la licenza solo per le proprie piattaforme, quindi OpenPencil non li include mai: li disegna macOS, e sono disponibili solo nell’[app OpenPencil per Mac](/it/download) su **macOS 14 Sonoma o successivo**. Nel browser, su Windows e Linux e nelle versioni meno recenti di macOS, il selettore di icone elenca gli SF Symbols sotto Apple e indica cosa serve per usarli invece di mostrarli.

Per usarli:

1. [Scarica OpenPencil](/it/download) per macOS e aprilo. Se il tuo Mac ha una versione di macOS meno recente, prima aggiornalo in **Impostazioni di Sistema → Generali → Aggiornamento Software**.
2. Apri il selettore di icone, scegli **SF Symbols** nel menu dei set e cerca per nome o parola chiave, come `heart` o `weather`.

La sezione Icona offre quindi:

- **Weight**, da Ultralight a Black, e **Scale**, piccola, media o grande, come nelle app di Apple.
- **Rendering**: **Monochrome** nel colore dell’icona; **Hierarchical**, il colore dell’icona con alcune opacità diverse; **Palette**, il colore dell’icona più un **Secondary color** e un **Tertiary color** per gli altri livelli del simbolo; oppure **Multicolor**, i colori propri del simbolo, in cui le parti che seguono il primo piano prendono il colore dell’icona.
- **Variable value**, da 0 a 1, per i simboli che si riempiono a passi, come `wifi` o `speaker.wave.3`; gli altri simboli non cambiano.

Un documento conserva i contorni dei suoi SF Symbols, così vengono disegnati ovunque venga aperto. Per cambiarne o sostituirne uno serve di nuovo l’app per Mac; altrove la sezione Icona lo indica al posto delle sue opzioni.

## Modificare i tracciati di un’icona

Puoi modificare i tracciati di un’icona come qualsiasi vettore. Quando i suoi punti, tracciati o colori propri cambiano, la sezione Icona indica **Modificata**:

- L’icona viene esportata come i tracciati che disegna ora anziché con il suo nome, così la modifica viene conservata.
- **Ripristina** (la freccia circolare) ridisegna l’icona originale, con le stesse dimensioni e lo stesso colore.
- La sostituzione chiede prima conferma, perché una sostituzione disegna una nuova icona e scarta la modifica.

Ridimensionare l’icona o cambiarne il colore non conta come modifica.

**Scollega icona**, nella sezione Icona, nel menu della tela o in **Oggetto → Scollega icona**, trasforma un’icona in semplice grafica: mantiene i suoi tracciati ma non viene più sostituita, ricolorata o esportata come icona. Come ogni comando delle icone, è un singolo passaggio di annullamento.

## Le icone nelle esportazioni

- **Design JSX** scrive un’icona inserita come `<Icon name="lucide:heart" size={24} color="#…" />`. Material Symbols e SF Symbols vengono esportati come i tracciati che disegnano, perché i loro nomi da soli non dicono come sono stati disegnati; per inserirne uno per nome, passa a `<Icon>` le sue `options`, come <code v-pre>options={{ wght: 600, FILL: 1 }}</code>.
- **HTML** la scrive come SVG inline contrassegnato con `data-icon`, con i tracciati dipinti in `currentColor` e il colore dell’icona impostato sull’`<svg>`, così basta cambiare quell’unico `color` per ricolorarla.
- **SVG e immagini** la disegnano come qualsiasi altro vettore.

## Le icone nell’HTML importato

L’importazione di HTML conserva come icone le icone che una pagina disegna, con i tracciati e il colore della pagina stessa:

- Un SVG inline contrassegnato con `data-icon`, come lo scrive l’esportazione HTML di OpenPencil, diventa quell’icona.
- Un altro SVG inline diventa l’icona di un set Iconify popolare che disegna, quando la disegna in modo abbastanza fedele: viene confrontato con le icone dalle forme più simili, disegnate allo stesso modo.
- Tutto il resto rimane grafica.

Il confronto scarica un indice dei set popolari, circa 2 MB, e chiede a Iconify per nome le icone con cui confrontare; l’SVG stesso non viene mai inviato. Senza connessione, un SVG inline senza `data-icon` rimane grafica. Disattivalo con **Dai un nome alle icone nell’HTML importato** in **Impostazioni → Editor**, oppure con `--no-icon-names` in `openpencil import`.

Le icone inserite da agenti IA, client MCP e design JSX sono icone allo stesso modo, quindi anche su di esse funziona la sezione Icona.
