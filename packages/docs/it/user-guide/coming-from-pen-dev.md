---
pageClass: guide
title: Arrivare da pen.dev
description: Apri i file di pen.dev (in precedenza Pencil) in OpenPencil, scopri cosa viene importato e continua a progettare con un agente IA.
---

# Arrivare da pen.dev

OpenPencil apre i file `.pen` di pen.dev, che in precedenza si chiamava Pencil. Il tuo design arriva come livelli modificabili, e continui a lavorare con l’agente IA che usi già.

## Aprire un file `.pen`

Premi <Keys mac="⌘ O" other="Ctrl O" /> e scegli il file, oppure trascinalo sulla finestra. Sul computer puoi anche aprirlo dal Finder o da Esplora file con l’app desktop.

OpenPencil legge i file `.pen` ma non li scrive. Al primo salvataggio, ti chiede dove mettere un nuovo file `.fig`, con lo stesso nome dell’originale; un browser senza finestra di salvataggio lo scarica invece. Il file `.pen` resta com’era, e il file `.fig` si apre anche in Figma.

## Cosa viene importato

- Cornici, forme e tracciati, con i loro riempimenti, contorni ed effetti.
- Testo e layout: righe, colonne, spazi e spaziatura interna.
- Componenti e le loro istanze, con le modifiche fatte a ogni istanza.
- Temi, come raccolte di [variabili](./variables). Le opzioni di tema che le tue variabili combinano, come la modalità colore e la densità, condividono una raccolta le cui modalità sono le loro combinazioni; un’opzione da sola ottiene una raccolta tutta sua.
- Icone e immagini.

Alcune cose non vengono ancora importate:

- I livelli di altri file che il documento importa.
- I livelli di tipo script, browser, shader, nota e contesto.
- Nel browser, le immagini salvate accanto al file. Apri il file nell’app desktop per conservarle.

## Continuare a lavorare con un agente IA

L’agente con cui progetti in pen.dev può lavorare anche in OpenPencil:

- Nell’app desktop, usa come chat IA [Claude Code, Codex, Cursor o un altro agente di programmazione](./coding-agents) che hai già.
- Oppure collega il tuo agente al [server MCP](/developers/mcp-server) di OpenPencil dal suo terminale o editor, e modificherà il documento aperto.

Gli agenti modificano il documento mentre è aperto, quindi non hanno bisogno di un file `.pen` sul disco.
