---
title: Chat IA
description: Assistente IA integrato con oltre 90 strumenti per creare e modificare design.
---

# Chat IA

Premi <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>) per aprire l'assistente IA. Descrivi cosa vuoi — crea forme, imposta stili, gestisce il layout, lavora con i componenti e analizza il tuo design.

## Configurazione

1. Apri il pannello chat IA (<kbd>⌘</kbd><kbd>J</kbd>)
2. Clicca sull'icona delle impostazioni
3. Scegli un provider e inserisci la tua chiave API
4. Seleziona un modello

### Provider supportati

| Provider | Modelli | Configurazione |
|----------|---------|----------------|
| **OpenRouter** | Claude, GPT-4, Gemini, DeepSeek e altri | Chiave API da [openrouter.ai](https://openrouter.ai) |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, ecc. | Chiave API da [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-4o, GPT-4, ecc. | Chiave API da [platform.openai.com](https://platform.openai.com) |
| **Google AI** | Gemini 2.0, Gemini 1.5, ecc. | Chiave API da [aistudio.google.dev](https://aistudio.google.dev) |
| **Compatibile OpenAI** | Qualsiasi endpoint con formato API OpenAI | URL base personalizzato + chiave. Supporta toggle tra API Completions e Responses. |
| **Compatibile Anthropic** | Qualsiasi endpoint con formato API Anthropic | URL base personalizzato + chiave |

Nessun backend o abbonamento: la tua chiave comunica direttamente con il provider. Le richieste del browser dipendono dalla policy CORS del provider e l’affidabilità delle chiamate agli strumenti in streaming varia tra i deployment. Consulta il riferimento in inglese sulla [compatibilità di provider e modelli BYOK](/programmable/byok-provider-compatibility) per risultati misurati e test riproducibili.

## Funzionalità

L'assistente dispone di oltre 90 strumenti in queste categorie:

- **Creare** — frame, forme, testo, componenti, pagine. Rendering JSX per layout complessi.
- **Stile** — riempimenti, contorni, effetti, opacità, raggio dei bordi, modalità di fusione.
- **Layout** — auto-layout, griglia, allineamento, spaziatura, dimensionamento.
- **Componenti** — creare componenti, istanze, set di componenti. Gestire le sovrascritture.
- **Variabili** — creare/modificare variabili, collezioni, modalità. Collegare ai riempimenti.
- **Query** — trovare nodi, selettori XPath, leggere proprietà, elencare pagine, font, selezione.
- **Ispezionare** — `get_jsx` per vista JSX, `diff_jsx` per differenze strutturali, `describe` per ruolo semantico e problemi di design.
- **Analizzare** — palette colori, audit tipografico, coerenza degli spazi, rilevamento di pattern.
- **Esportare** — PNG, SVG, JSX con classi Tailwind. Verifica visiva tramite `export_image`.
- **Vettoriale** — operazioni booleane, manipolazione tracciati.

## Verifica visiva

L'assistente può verificare visivamente il suo lavoro. Dopo aver creato o modificato design, utilizza `export_image` per catturare un'immagine e confrontare il risultato con la richiesta originale.

## Esempi di prompt

- "Crea una card con titolo, descrizione e un pulsante blu"
- "Fai in modo che tutti i pulsanti di questa pagina usino lo stesso raggio dei bordi"
- "Quali font sono usati in questo file?"
- "Cambia lo sfondo del frame selezionato con un gradiente dal blu al viola"
- "Esporta il frame selezionato come SVG"
- "Mostrami il JSX di questo frame"

## Suggerimenti

- Seleziona i nodi prima di chiedere — l'assistente sa cosa è selezionato.
- Sii specifico su colori, dimensioni e posizioni per risultati precisi.
- L'assistente può modificare più nodi in un singolo messaggio.
- Usa "annulla" nell'editor — le mutazioni IA supportano l'annullamento completo.
- Tutti i layout vengono ricalcolati automaticamente dopo ogni esecuzione di strumento.
