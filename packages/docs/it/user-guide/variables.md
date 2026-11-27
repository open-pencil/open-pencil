---
pageClass: guide
title: Variabili
description: Tieni colori, dimensioni e altri valori in un unico posto, cambiali con le modalità e portali nel codice come CSS o design token.
---

# Variabili

Una variabile è un valore con un nome, come un colore del marchio o un raggio degli angoli, che i livelli usano al posto di un numero proprio. Modifica la variabile, e ogni livello che la usa cambia. Le modalità danno alle stesse variabili altri valori, come un tema scuro.

## Aprire le variabili

Scegli **Visualizza → Variabili…**, oppure fai clic su una parte vuota della tela e apri **Variabili** nel pannello Design.

<GuideImage name="variables/dialog" alt="La finestra Variabili con la raccolta Theme, quattro variabili in Light e Dark, le impostazioni della raccolta e il foglio di stile" />

1. Le **raccolte** raggruppano le variabili, come i colori o le spaziature.
2. Ogni **variabile** ha un valore per ogni modalità, in colonne.
3. Le **impostazioni** della variabile selezionata, o della raccolta quando non ne è selezionata nessuna.
4. Il **foglio di stile** mostra la raccolta come CSS.

**Espandi**, nell’angolo della finestra, le fa occupare quasi tutto lo schermo. In una finestra stretta o su un telefono, mostra una modalità alla volta.

## Creare una variabile

1. Fai clic su **Crea variabile** e scegli un tipo: colore, numero, testo, vero/falso, easing o tempo.
2. Scrivi un nome. Le barre la inseriscono in un gruppo: `Brand/Primary` compare come **Primary** sotto **Brand**.
3. Imposta il suo valore in ogni modalità.

A destra puoi anche impostare:

- **Nome CSS**, usato dal foglio di stile. Se lo lasci vuoto, viene ricavato dal nome, come `--color-brand-primary`.
- **Unità** per i numeri: `px`, `rem`, `%`, `ms`, `s`, `deg` o nessuna.
- **Ambiti**, le impostazioni che propongono la variabile.
- **Descrizione**, e **Nascondi dalla pubblicazione** per tenerla fuori dalle [librerie](./component-libraries).

Per far seguire a una variabile un’altra variabile, fai clic sul pulsante della variabile accanto al suo valore e sceglila. **Scollega variabile** la riporta a un valore semplice.

## Usare una variabile

<GuideLegend>

<GuideImage name="variables/apply" alt="La riga Riempimento di un livello selezionato con il pulsante Applica variabile aperto, che elenca i colori di Theme" />

1. Seleziona un livello.
2. Fai clic su **Applica variabile** accanto a un’impostazione, come un colore di riempimento, un raggio degli angoli o uno spazio.
3. Scegli una variabile.

</GuideLegend>

L’impostazione mostra allora il nome della variabile. Per usare di nuovo un valore semplice, fai clic su **Applica variabile** e scegli **Scollega variabile**.

## Usare le modalità

Una raccolta può avere più modalità, come **Light** e **Dark**. Ogni variabile della raccolta ha un valore in ciascuna.

- Per aggiungere una modalità, fai clic su **+** accanto a **Modalità** nelle impostazioni della raccolta.
- Per rinominarne una, modificane il nome. Il menu **⋯** accanto la duplica, la rende predefinita o la elimina.

<GuideLegend>

<GuideImage name="variables/mode" alt="L’impostazione Theme in Aspetto aperta, con Auto, Light e Dark" />

Per mostrare una cornice in un’altra modalità, selezionala e scegli la modalità in **Aspetto**. I livelli al suo interno la seguono, a meno che non abbiano una modalità propria. **Auto** prende la modalità dal livello che lo contiene.

</GuideLegend>

Nel codice, **Si applica quando** indica quando subentra una modalità. Il CSS che scrive compare sotto:

| Si applica quando | CSS |
| --- | --- |
| **viene attivata manualmente** | un attributo su un elemento, come `[data-theme="dark"]` |
| **il sistema è in modalità scura** | `@media (prefers-color-scheme: dark)` |
| **il sistema è in modalità chiara** | `@media (prefers-color-scheme: light)` |
| **il contrasto elevato è attivo** | `@media (prefers-contrast: more)` |
| **la riduzione del movimento è attiva** | `@media (prefers-reduced-motion: reduce)` |
| **lo schermo è più stretto di** una larghezza | `@media (max-width: 640px)` |
| **lo schermo è più largo di** una larghezza | `@media (min-width: 640px)` |
| **il contenitore è più stretto di** una larghezza | `@container (max-width: 640px)` |
| **il contenitore è più largo di** una larghezza | `@container (min-width: 640px)` |
| **CSS personalizzato** | qualsiasi selettore, o una query `@media`, `@supports` o `@container` |

La modalità predefinita è sempre attiva e va in `:root`. L’**Attributo di attivazione** di una raccolta, `data-theme` per impostazione predefinita, è l’attributo che attiva le sue modalità manuali. Cambialo per adattarlo al tuo codice, per esempio `data-color-scheme`.

I livelli impostati su una modalità manuale vengono esportati con il suo attributo. I livelli impostati su una modalità con qualsiasi altra condizione vengono esportati con valori semplici, perché è il foglio di stile a decidere quando si applica quella modalità.

## Organizzare le variabili

- **Raccolte:** fai clic su **+** accanto a **Raccolte** per aggiungerne una. Senza variabili selezionate, il lato destro rinomina la raccolta, e il suo menu **⋯** la elimina.
- **Cercare:** scrivi nel campo di ricerca per filtrare per nome, nome CSS, descrizione o valore. Fai clic su un gruppo per mostrare solo quel gruppo, o usa il pulsante del filtro per mostrare solo alcuni tipi.
- **Selezionare:** fai clic su una riga, o usa i tasti freccia. <Keys mac="⇧" other="Shift" />-clic seleziona un intervallo, e <Keys mac="⌘" other="Ctrl" />-clic ne aggiunge una.
- **Modificare sul posto:** fai doppio clic su un nome, un numero o un testo nell’elenco.
- **Spostare ed eliminare:** fai clic destro per rinominare, duplicare, spostare in un gruppo o eliminare. Trascina le righe per riordinarle.
- **Annullare:** <Keys mac="⌘ Z" other="Ctrl Z" /> funziona qui come sulla tela.

## Scrivere una formula

Il valore di un numero può essere una formula basata su altre variabili, come `space/base * 4`. Inizia a scrivere il nome di una variabile e sceglila, oppure scegli **Usa una variabile**. Il campo mostra il risultato, come `= 16px`. Per gli altri tipi, scegli **Usa una formula** accanto al valore.

- I numeri usano `+`, `-`, `*`, `/` e le parentesi.
- I valori vero/falso usano `and`, `or` e `not`, e si confrontano con `==`, `!=`, `<`, `<=`, `>` e `>=`: `viewport > 1024 and not loading`.
- Il testo va tra virgolette doppie, e `+` lo concatena: `"Hello, " + name`. `text(count)` scrive un numero come fa Figma.
- `if(condition, then, otherwise)` sceglie tra due valori: `if(dark, gray/900, #FFFFFF)`.
- `truthy(value)` è falso per `0`, il testo vuoto, `false`, `no` e `off`.

Gli errori, come un nome sconosciuto o un ciclo, compaiono quando esci dal campo, e il vecchio valore resta. Rinominare una variabile mantiene funzionanti le formule che la usano.

Nel foglio di stile, una formula numerica diventa `calc()`. Le formule con `if()`, testo o valori vero/falso non si possono scrivere in CSS e vengono omesse.

Un numero può anche avere un’**Espressione CSS** che lo sostituisce solo nel codice, come `clamp(1rem, 4vw, var(--spacing-md))`. Aggiungila dal menu **⋯** del valore.

## Variabili di easing e di tempo

Le variabili di easing e di tempo contengono il movimento: quanto dura un cambiamento e come accelera e rallenta. Le [transizioni dei componenti](./components#far-funzionare-un-componente-come-un-controllo) possono seguirle, così una modalità **Reduced motion** può accorciare tutte le transizioni in un colpo solo.

- **Tempo** è una durata, scritta in millisecondi, come `250ms`, o in secondi, come `0.25s`.
- **Easing** è una curva o una molla. Fai clic per aprire l’editor:
  - **Curva:** scegli un easing o **Bézier personalizzata**, poi trascina le due maniglie o scrivi i numeri. **Rifletti curva** la riproduce al contrario.
  - **Molla:** scegli Delicata, Rapida, Elastica, Lenta o **Molla personalizzata**. Trascina il primo superamento sotto **Tempo**, o imposta rigidità, smorzamento e massa sotto **Fisica**.

In CSS, un tempo viene scritto in millisecondi e una curva come funzione di temporizzazione, come `cubic-bezier(0.45, 1.45, 0.8, 1)`. Le molle lì non hanno una forma CSS e vengono omesse.

## Copiare le variabili come codice

Il pulsante di copia sopra il foglio di stile copia tutte le raccolte come CSS, o come tema Tailwind v4.

## Importare ed esportare design token

Variabili e stili passano tra OpenPencil, Figma e il codice come [design token](https://www.designtokens.org/).

- **Esportare:** nel menu di copia del foglio di stile, scegli **Esporta come design token**. Ottieni un file zip con un file per ogni modalità, che Figma importa come modalità, e gli stili di testo e di effetto.
- **Importare:** fai clic su **Importa design token** in cima alla finestra e scegli file di token o uno zip. Funzionano i file di Figma e di Tokens Studio.

Prima dell’importazione, la finestra mostra dove va ogni raccolta e ogni modalità: in una nuova, in una esistente o da nessuna parte. Le variabili con lo stesso nome vengono aggiornate, le altre vengono aggiunte, e nulla viene eliminato. **Annulla** annulla l’intera importazione.
