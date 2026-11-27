---
pageClass: guide
title: Auto-layout
description: Crea cornici che dispongono i propri livelli e si ridimensionano con il contenuto.
---

# Auto-layout

L’auto-layout fa sì che una cornice disponga i livelli al suo interno. Modifica un testo, aggiungi una riga o nascondi un livello, e tutto il resto si sposta per adattarsi. Usalo per pulsanti, elenchi, schede e intere schermate.

<GuidePair>

<GuideImage name="auto-layout/before" alt="Una scheda playlist con due brani" caption="Due brani" />
<GuideImage name="auto-layout/after" alt="Una scheda playlist più alta con tre brani" caption="Aggiungine uno, e la scheda cresce" />

</GuidePair>

## Aggiungere l’auto-layout

1. Seleziona una cornice, o i livelli che vuoi disporre.
2. Premi <Keys mac="⇧ A" other="Shift A" />.

Una cornice inizia a disporre i propri livelli. I livelli sciolti vengono racchiusi in una nuova cornice. Premi di nuovo <Keys mac="⇧ A" other="Shift A" /> sulla cornice per disattivare l’auto-layout.

## Configurare la cornice

Seleziona la cornice e cerca **Auto-layout** nel pannello Design.

<GuideLegend>

<GuideImage name="auto-layout/panel" alt="Le impostazioni dell’auto-layout con sei controlli numerati" />

1. **Flusso** dispone i livelli liberamente, in verticale, in orizzontale o in una griglia.
2. **Layout a capo** sposta i livelli su una nuova riga quando finisce lo spazio.
3. **Dimensioni** stabilisce come si comportano la larghezza e l’altezza della cornice.
4. **Allineamento** posiziona i livelli nella cornice. Fai clic su un punto.
5. **Spazio** è lo spazio tra i livelli. Scegli **Auto** nel suo menu per distribuirli.
6. **Spaziatura interna** è lo spazio all’interno dei bordi della cornice. Il pulsante accanto imposta ogni lato separatamente.

</GuideLegend>

## Cambiare la spaziatura sulla tela

Seleziona la cornice e punta uno spazio o un bordo per vederne la misura. Fai doppio clic, poi fai clic sul valore che compare e scrivine uno nuovo.

## Scegliere come si ridimensionano i livelli

Seleziona un livello, poi apri il menu nel suo campo **W** o **H**.

<GuideLegend>

<GuideImage name="auto-layout/sizing" alt="Il menu della larghezza aperto, con Fisso, Adatta al contenuto e Riempi" />

- **Fisso** mantiene la dimensione che hai impostato.
- **Adatta al contenuto** si adatta al contenuto.
- **Riempi** occupa lo spazio disponibile nella cornice genitore.

</GuideLegend>

Per la riga di un elenco, prova **Riempi** per la larghezza e **Adatta al contenuto** per l’altezza. Lo stesso menu aggiunge dimensioni minime e massime.

## Riordinare i livelli

Trascina un livello in un nuovo punto della cornice. La linea blu mostra dove finirà.

<GuidePair>

<GuideImage name="auto-layout/drag" alt="Il puntatore che trascina Low Tide, con una linea blu sopra Paper Lanterns" caption="Trascina Low Tide verso l’alto" />
<GuideImage name="auto-layout/drop" alt="Low Tide tra Slow Morning e Paper Lanterns" caption="Rilascia, e va al suo posto" />

</GuidePair>

## Mandare a capo i livelli

Attiva **Layout a capo** per contenuti come i tag, in cui il numero di elementi cambia. Un secondo campo di spazio imposta la distanza tra le righe.

<GuideImage name="auto-layout/wrap" alt="Sette tag distribuiti su tre righe" />

## Creare una griglia

<GuideLegend>

<GuideImage name="auto-layout/grid-panel" alt="Le impostazioni di colonne e righe di una griglia" />

1. Seleziona la cornice e scegli **Griglia** in **Flusso**.
2. Usa **+** accanto a **Colonne** e **Righe** per aggiungere tracce.
3. Scegli **Riempi (fr)** per tracce che si dividono lo spazio, o **Fisso (px)** per una dimensione stabilita.
4. Imposta in basso gli spazi tra colonne e righe.

</GuideLegend>

<GuideImage name="auto-layout/grid" alt="Sei copertine di album in tre colonne e due righe" />

## Posizionare liberamente un livello

Alcuni livelli, come un badge in un angolo, non dovrebbero essere disposti insieme agli altri.

1. Seleziona il livello.
2. Fai clic su **Ignora layout automatico** accanto a **Posizione**.
3. Trascinalo in qualsiasi punto della cornice.

Puoi anche tenere premuto <Keys mac="⌃" other="Ctrl" /> mentre trascini. Il livello finisce nella cornice sotto il puntatore.
