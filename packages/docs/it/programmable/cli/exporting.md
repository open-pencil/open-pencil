---
title: Esportare dalla CLI
description: Generare immagini, SVG, HTML, storie Storybook e altri output senza aprire l’editor.
---

# Esportare dalla CLI

`export` produce il rendering di una pagina o di un oggetto da un file supportato.

```sh
bun open-pencil export design.fig -o preview.png
```

## Scegliere il contenuto

Le opzioni del comando selezionano pagina, identificatore o oggetto trovato. Il formato viene dedotto dall’estensione o indicato esplicitamente.

## Scala e dimensioni

La scala controlla la risoluzione. È possibile fissare larghezza o altezza; le proporzioni vengono mantenute quando è fornita una sola dimensione.

## SVG e HTML

SVG conserva la geometria vettoriale ed è adatto a icone, revisione e modifiche successive.

L’esportazione HTML crea un documento autonomo con struttura e stili disponibili. È pensata per consegna, ispezione ed elaborazioni successive, non come sostituto identico del rendering CanvasKit. È disponibile solo lavorando su file.

## Tailwind JSX

Per esportare JSX con classi di utilità Tailwind:

```sh
openpencil export design.fig -f tailwind-jsx    # oppure: -f jsx --style tailwind
```

## Esportazione Storybook

Il formato `-f storybook` genera un file CSF3 `.stories.ts` per ogni set di componenti o componente:

```sh
openpencil export design.fig -f storybook                      # storie React in ./design-stories/
openpencil export design.fig -f storybook --framework vue -o src/stories
openpencil export design.fig -f storybook --framework html --page "Components"
openpencil export design.pen -f storybook -o src/stories --watch  # riesporta a ogni salvataggio
openpencil export 'src/**/*.pen' -f storybook --beside --watch    # storie accanto a ogni design
```

### Design accanto alle storie

Tieni il file di design di ogni componente nella cartella del componente ed esporta con `--beside`: storie, immagini del design e manifest `.openpencil-stories.json` di ciascun documento finiscono nella cartella del documento stesso, accanto al codice del componente. Un glob `stories` di Storybook come `../src/**/*.stories.ts` in `.storybook/main.ts` le raccoglie senza altra configurazione.

Puoi passare più documenti, oppure un glob tra apici come `'src/**/*.pen'` che OpenPencil espande da solo (Node.js 22 o successivo). Più documenti richiedono `--beside` oppure `--output`; `--page` funziona solo con un documento. I documenti vengono esportati uno dopo l’altro e, se uno fallisce, gli altri vengono comunque esportati prima che il comando termini con un errore. `--watch` osserva tutti i documenti trovati; un documento creato dopo l’avvio dell’osservazione richiede una nuova esecuzione.

Ogni variante di un set di componenti diventa una storia e le sue proprietà di variante diventano controlli `select`, quindi cambiando un controllo si vede la variante corrispondente. Un set con un comportamento riceve invece le prop del controllo: uno Switch o una Checkbox un booleano `checked`, un Toggle `pressed`, un Collapsible `open` e `disabled` quando il set disegna uno stato disabilitato; hover, pressed e focus restano storie a sé. I componenti singoli con nomi separati da barre, come `Button/Primary` e `Button/Secondary`, sono raggruppati in un unico file `Button` con un controllo `Variant`. Una combinazione per cui il design non ha una variante genera in Storybook un errore con nome invece di mostrare un’altra variante.

Le storie renderizzano il componente come HTML con stili inline, come `-f html`, quindi non richiedono il runtime di OpenPencil; `--framework` (`react`, `vue` o `html`) cambia solo il wrapper e l’import di `Meta`/`StoryObj` da `@storybook/react-vite`, `@storybook/vue3-vite` o `@storybook/html-vite`. Il testo usa le famiglie di font del documento, che Storybook deve caricare per conto proprio. Le proprietà di testo, booleane e di sostituzione dell’istanza non vengono ancora esportate.

Le storie includono voci `parameters.design` per [`@storybook/addon-designs`](https://github.com/storybookjs/addon-designs):

- **OpenPencil:** quando il percorso del documento è dentro la cartella corrente, un [link `openpencil://`](../index#url-scheme) che apre il documento nell’app desktop e seleziona la variante, o il suo set di componenti se un altro livello ha lo stesso nome della variante. Lo schema indirizza i livelli per nome, quindi una storia i cui nomi di variante e di componente sono entrambi condivisi con altri livelli non ottiene alcun link.
- **Design:** un PNG 2× della variante, scritto in `<Name>.design/` accanto alla storia e referenziato con `new URL(…, import.meta.url)`, così Vite lo include nel bundle. Copia il parametro sulla storia del tuo componente per confrontare l’implementazione con il design. `--no-design-images` salta il rendering; la sostituzione dei font segue `--font-policy` come nell’esportazione raster.

`-o` indica la cartella di output. Un manifest `.openpencil-stories.json` registra, con un percorso relativo alla cartella di output, quale documento e quale pagina hanno generato ogni storia e immagine; includilo nel commit insieme alle storie. Un’esportazione sostituisce i file generati da una precedente esportazione dello stesso documento, compresi quelli di componenti nel frattempo eliminati o rinominati; con `--page`, solo quelli di quella pagina. Prima di modificare qualsiasi cosa, rifiuta di sovrascrivere qualunque altro file: una storia scritta a mano, quella di un altro documento o un’immagine estranea. Un’esportazione di una sola pagina i cui nomi di file sono slittati su storie di un’altra pagina richiede invece un’esportazione completa. Senza il manifest, le storie esistenti sono considerate di qualcun altro, quindi rimuovile prima di esportare di nuovo. `--watch` mantiene il comando in esecuzione e riesporta a ogni salvataggio del documento, così l’hot reload di Storybook segue il design; un salvataggio che non può essere letto viene segnalato e l’osservazione continua. Una `--page` mancante o una sostituzione con `--font-policy strict` terminano comunque il comando.

## Modalità app in esecuzione

Ometti il file per esportare dall’app in esecuzione:

```sh
openpencil export -f png                       # esporta la selezione del documento attivo
openpencil export --page "Components" -f png   # esporta ogni livello di una pagina
openpencil export --node 1:23 -f png           # esporta un livello, in qualsiasi pagina
```

`--page` accetta il nome di una pagina e `--page-id` l’ID di una pagina da `openpencil documents list`; entrambi esportano quella pagina senza portare l’app su di essa. Aggiungi `--document-id` per esportare da un documento diverso da quello attivo.

La modalità app supporta PNG, JPG, WEBP, SVG e PDF. Le esportazioni PowerPoint, JSX, HTML, Storybook e `.fig` richiedono un file. L’esportazione di miniature in modalità file non è attualmente supportata.

## Percorso di output

`-o` o `--output` definisce il percorso. La CLI segnala formati errati, oggetti mancanti e percorsi non validi invece di produrre risultati parziali in silenzio.

Consulta `bun open-pencil export --help` per formati e opzioni disponibili.
