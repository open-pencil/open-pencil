---
pageClass: guide
title: Per iniziare
description: Apri OpenPencil nel browser o sul computer, impara a orientarti e crea il tuo primo design.
---

# Per iniziare

OpenPencil è un editor di design per schermi, da un singolo pulsante a un’intera app. Apre e salva i file Figma e funziona nel browser o come app desktop.

## Aprire OpenPencil

- **Nel browser:** vai su [cloud.openpencil.dev](https://cloud.openpencil.dev). Non c’è niente da installare.
- **Sul computer:** scarica l’app per macOS, Windows o Linux dalla [pagina di download](/it/download). Su Mac puoi installarla anche con Homebrew: `brew install --cask openpencil`.

::: tip Trasferita da app.openpencil.dev
L’app web si è trasferita su cloud.openpencil.dev. I file che hai conservato nel browser su [app.openpencil.dev](https://app.openpencil.dev) restano lì finché quell’indirizzo non inizia a reindirizzare: aprilo per salvarli su Cloud o scaricarli.
:::

## Requisiti di sistema

Nel browser, OpenPencil richiede Chrome o Edge 111, Firefox 128 o Safari 16.4 o versioni successive. I browser basati su Chrome, come Brave e Opera, funzionano dalle stesse versioni.

L’app desktop richiede:

- **macOS** 13 Ventura o successivo, con gli aggiornamenti di Safari installati.
- **Windows** 10 o successivo, con il runtime Microsoft Edge WebView2, che Windows mantiene aggiornato.
- **Linux** con WebKitGTK 2.40 o successivo (`webkit2gtk-4.1`).

Se il browser o il sistema è troppo vecchio, OpenPencil ti dice cosa aggiornare. Se vedi questo messaggio su un sistema che soddisfa i requisiti, fai clic su **Segnala un problema** nel messaggio.

## Orientarsi nell’editor

<GuideImage name="getting-started/editor" alt="L’editor con otto aree numerate" />

1. **Menu.** File, Modifica, Visualizza e gli altri, sotto il nome del file.
2. **Pagine.** Ogni pagina è una tela separata nello stesso file.
3. **Livelli.** Tutto ciò che è nella pagina, nell’ordine in cui viene disegnato.
4. **Tela.** Dove progetti.
5. **Barra degli strumenti.** Strumenti per cornici, forme, penna e testo.
6. **Pannello Design.** Le impostazioni di ciò che hai selezionato. Le schede accanto a **Design** lo mostrano come codice, aprono la chat IA e controllano il design alla ricerca di problemi.
7. **Zoom.** Fai clic sulla percentuale per le opzioni di zoom.
8. **Condividi e Anteprima.** Invita persone al file o prova il design come prototipo.

## Creare il primo design

1. Premi <Keys mac="F" other="F" /> e trascina sulla tela per disegnare una cornice. Le cornici contengono il resto del design, come uno schermo o una scheda.
2. Premi <Keys mac="R" other="R" /> e trascina dentro la cornice per disegnare un rettangolo.
3. Premi <Keys mac="T" other="T" />, fai clic dentro la cornice e scrivi.
4. Premi <Keys mac="Esc" other="Esc" /> per finire di scrivere. Ora il pannello Design mostra il font e la dimensione del testo.
5. Premi <Keys mac="⌘ S" other="Ctrl S" /> per salvare.

[Aprire e salvare](./user-guide/files) spiega dove finisce il tuo file.

## Trovare un comando

Premi <Keys mac="⌘ K" other="Ctrl K" /> e scrivi cosa vuoi fare, per esempio "allinea a sinistra" o "esporta". Scegli un risultato per eseguirlo. Puoi anche scrivere il nome di una pagina per andare a quella pagina.

## Usare un telefono o un tablet

Su uno schermo piccolo, i pannelli si spostano in un cassetto in basso. I suoi pulsanti aprono i livelli, il pannello Design, il codice e la chat IA.

## Passi successivi

- [Navigazione canvas](./user-guide/canvas-navigation): spostarti e usare lo zoom.
- [Selezione e manipolazione](./user-guide/selection-and-manipulation): selezionare, spostare e ridimensionare i livelli.
- [Livelli e pagine](./user-guide/layers-and-pages): organizzare il contenuto del file.
- [Auto-layout](./user-guide/auto-layout): creare cornici che si ridimensionano con il contenuto.

Vuoi compilare OpenPencil da solo? Vedi [Contributing](/development/contributing#build-from-source).
