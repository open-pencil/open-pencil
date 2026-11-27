---
pageClass: guide
title: Arrivare da Figma
description: Porta i tuoi file e livelli Figma in OpenPencil, e scopri cosa funziona allo stesso modo e cosa funziona diversamente.
---

# Arrivare da Figma

OpenPencil legge e scrive i file `.fig` di Figma e usa i nomi e le scorciatoie di Figma, quindi la maggior parte di ciò che sai funziona anche qui. I tuoi file restano tuoi: si riaprono in Figma ogni volta che ne hai bisogno.

## Portare i tuoi file

1. In Figma, apri il file e scegli **File → Save local copy…**.
2. In OpenPencil, apri il file `.fig`, oppure trascinalo sulla finestra. Vedi [Aprire e salvare](./files).

Salvando in OpenPencil si ottiene un file `.fig` che si apre anche in Figma.

## Copiare livelli tra i due

Seleziona dei livelli in Figma, premi <Keys mac="⌘ C" other="Ctrl C" /> e incollali in OpenPencil con <Keys mac="⌘ V" other="Ctrl V" />. Funziona anche al contrario. Riempimenti, contorni, effetti, testo, auto-layout, raggi degli angoli e tracciati vettoriali vengono conservati.

Le immagini nei livelli incollati vengono scaricate da Figma, quindi il file Figma da cui provengono deve essere uno che puoi aprire. <Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> e <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> copiano e incollano solo l’aspetto di un livello, anche da e verso Figma.

## Cosa funziona allo stesso modo

- **Cornici, gruppi, sezioni e auto-layout**, con le stesse impostazioni, compreso il layout a griglia.
- **Componenti, varianti e istanze**, con proprietà e slot. Vedi [Componenti](./components).
- **Variabili e modalità**. Vedi [Variabili](./variables).
- **Gli stili** dei tuoi file e delle tue librerie si applicano come in Figma.
- **Le scorciatoie** sono quelle di Figma, come <Keys mac="R" other="R" /> per un rettangolo e <Keys mac="⇧ A" other="Shift A" /> per l’auto-layout. Vedi [Scorciatoie da tastiera](/reference/keyboard-shortcuts).

## Cosa funziona diversamente

- **Librerie.** Le librerie del team di Figma non si collegano a OpenPencil. Per condividere componenti tra file qui, [pubblica una libreria OpenPencil](./component-libraries).
- **Stili.** Puoi applicare e scollegare gli stili, ma non ancora crearli o modificarli. Usa le [variabili](./variables) per nuovi colori e dimensioni.
- **Le modalità delle variabili** si impostano su una cornice o una pagina in **Aspetto**, dove ogni raccolta ha sempre una riga.
- **Font.** L’app desktop usa i font del tuo computer. Nel browser possono usarli anche Chrome ed Edge, dopo che lo hai consentito. Vedi [Scegliere un font](./text-editing#scegliere-un-font).
- **La prototipazione** non c’è ancora. I componenti possono [funzionare come controlli](./components#far-funzionare-un-componente-come-un-controllo) in anteprima, come un interruttore che scatta.
- **La cronologia delle versioni** è disponibile per i file su [OpenPencil Cloud](/cloud/).

La [Matrice funzionalità Figma](/it/reference/figma-compatibility) elenca ogni funzionalità di Figma e fino a che punto OpenPencil la supporta.

## Al posto di plugin e Dev Mode

- **Chiedi all’IA.** Molto di ciò che fanno i plugin, come rinominare livelli, creare varianti o controllare il contrasto, la [chat IA](./ai-chat) lo fa a partire da una frase. Può anche usare un [agente di programmazione](./coding-agents) che hai.
- **Scrivi uno script.** Gli script usano la stessa API dei plugin di Figma, `figma.currentPage` e il resto. Vedi [Scripting](/it/developers/cli/scripting).
- **Ottieni il codice.** La scheda Codice, accanto a Design, mostra la selezione come HTML, Vue o React, con CSS o Tailwind.
- **Verifica i design.** [Verificare i design](./checking-designs) trova contrasto basso, aree di tocco piccole e colori che dovrebbero usare una variabile.
