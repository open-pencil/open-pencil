---
title: Privacy e statistiche di utilizzo
description: "Cosa invia OpenPencil in rete, perché invia statistiche di utilizzo anonime e come disattivare ogni parte."
---

<script setup>
import {
  describeBuildFields,
  describePingFields,
  describeReportFields,
  describeUsageEvents
} from '@open-pencil/feedback/contract'

const columns = [
  { key: 'name', label: 'Field', kind: 'code' },
  { key: 'values', label: 'Values', kind: 'description' }
]

function rows(fields, freeForm = 'A version number') {
  return fields.map((field) => ({
    name: field.name,
    description: field.description,
    values: field.values.length > 0 ? field.values.join(', ') : freeForm
  }))
}

const pingRows = rows(describePingFields())
const buildFields = describeBuildFields()
  .map((field) => field.name)
  .join(', ')
const events = describeUsageEvents()
const reportRows = rows(describeReportFields(), 'Free-form')
</script>
# Privacy e statistiche di utilizzo

- I tuoi design, i nomi dei file e dei livelli, i testi, i prompt e le chiavi non lasciano mai il tuo dispositivo, a meno che non sia tu a condividerli o sincronizzarli, o ad allegare un design a una segnalazione che invii.
- Le build ufficiali inviano un ping anonimo al giorno, senza alcun ID. Puoi disattivarlo.
- Le statistiche di utilizzo dettagliate vengono inviate solo se rispondi di sì quando ti viene chiesto, e puoi smettere in qualsiasi momento.

## Perché raccogliamo dati

OpenPencil è sviluppato da un piccolo team. Dobbiamo sapere quali piattaforme, formati di file e funzionalità usano le persone, per decidere cosa sviluppare dopo. Dobbiamo anche dimostrare che OpenPencil viene usato, perché è questo che tiene in vita il finanziamento del progetto. Un conteggio delle installazioni attive e un’idea di quali funzionalità contano rispondono a entrambe le domande senza sapere nulla di te o del tuo lavoro.

## Il ping giornaliero

Una volta al giorno, una build ufficiale invia questo a `feedback.openpencil.dev`:

```http
POST https://feedback.openpencil.dev/ping

{ "version": "0.17.0", "platform": "macos", "arch": "arm64", "app": "desktop", "browser": "unknown", "usageStats": "denied", "pingDays": "5-8", "enteredStep": false }
```

<SdkDataTable :columns="columns" :rows="pingRows" />

Non contiene alcun ID, quindi i ping della stessa installazione non possono essere collegati tra loro. La risposta alla domanda sulle statistiche di utilizzo è l’unico modo che abbiamo per sapere quante persone rifiutano, perché rifiutare significa che non viene mai inviato nient’altro. L’app conserva solo la data del suo ultimo ping, così invia un ping al giorno, e per quanti giorni ha inviato il ping. Viene inviato solo l’intervallo in cui cade quel numero: 1, 2, 3–4, 5–8 e così via, raddoppiando, mai il numero stesso. Ogni installazione attraversa gli intervalli in ordine, quindi il server può distinguere le installazioni che tornano dalle copie di uno stesso stato salvato avviate più e più volte, che ripetono lo stesso intervallo, senza distinguere le installazioni tra loro. Il server aggiunge uno a un contatore per quel giorno e quella build, e uno a un contatore per quel giorno, quell’app e quell’intervallo. Aggiunge anche uno a un contatore per quel giorno, l’app e la piattaforma, e la rete da cui è arrivato il ping: il numero della rete e il nome dell’operatore come li riporta Cloudflare, per esempio un fornitore di internet domestico, un’università o un host cloud. Questo distingue le persone reali dalle installazioni automatiche che girano nei data center, senza nulla che identifichi un dispositivo. Il server non conserva nient’altro. Non registra gli indirizzi e rifiuta un ping che contiene qualsiasi altro campo.

La risposta al ping elenca i messaggi che l’app può mostrare, come una richiesta di donazioni o l’invito a provare OpenPencil Cloud: il loro testo, dove compaiono nell’app, con che frequenza e a quali build. Una build che li mostra decide sul dispositivo se è il momento di mostrarne uno, in base a da quanto tempo è installata, alla sua versione, alla piattaforma e al fatto che tu abbia effettuato l’accesso a Cloud, e conserva sempre sul dispositivo cosa hai fatto con ciascuno, per esempio **Non ora**. Niente di tutto ciò torna indietro con il ping. Se condividi le statistiche di utilizzo, queste indicano quando uno di questi messaggi è stato mostrato, rimandato o seguito, con il nome del messaggio e il punto in cui è comparso (gli eventi qui sotto); il server le conserva solo per i messaggi che serve ancora o che l’app include, come la sua richiesta di donazione. Il pulsante di un messaggio apre la relativa pagina con il nome del messaggio nell’indirizzo, così i conteggi delle visite del sito possono dire quale messaggio ha portato qualcuno, senza nulla su di te o sul tuo dispositivo. Un messaggio dal server è testo: non può eseguire codice, mostrare immagini né contenere link se non verso openpencil.dev. La richiesta di donazione propria dell’app rimanda alla pagina delle donazioni indicata dal progetto. Le build che compili da solo non ricevono messaggi dal server.

Il ping è attivo per impostazione predefinita. Disattivalo in **Impostazioni → Privacy**; da quel momento l’app non mostra più messaggi dal server.

## Statistiche di utilizzo

Le statistiche di utilizzo sono disattivate finché non dai il tuo consenso. OpenPencil lo chiede una sola volta, con un piccolo avviso che compare dopo la schermata di benvenuto al primo avvio, o a un avvio successivo se non hai risposto, con due scelte equivalenti: **No, grazie** e **Condividi statistiche**. Nessuna delle due è preselezionata, e puoi cambiare risposta in seguito in **Impostazioni → Privacy**.

Quando acconsenti, l’app crea un ID di installazione casuale sul tuo dispositivo. Non è collegato a un account, a un indirizzo email o a nient’altro che ti riguardi. Gli eventi di utilizzo vengono inviati con questo ID, insieme ai campi della build indicati sopra (<code>{{ buildFields }}</code>). Quando smetti di condividere, l’app elimina l’ID; se acconsenti di nuovo ne crea uno nuovo.

Questi sono tutti gli eventi che l’app può inviare. Il servizio su `feedback.openpencil.dev` confronta ogni evento con questo elenco e rifiuta qualsiasi evento, proprietà o valore che non vi compare, quindi nemmeno un’app modificata può inviare altro attraverso di esso.

<template v-for="event in events" :key="event.name">
  <h3><code>{{ event.name }}</code></h3>
  <p>{{ event.description }}</p>
  <SdkDataTable v-if="event.properties.length" :columns="columns" :rows="rows(event.properties)" />
</template>

Gli eventi accettati vanno a [PostHog](https://posthog.com), un servizio di analisi dei prodotti, sul suo cloud europeo. La richiesta parte dal nostro server, non dal tuo dispositivo, quindi PostHog non vede mai il tuo indirizzo. Gli eventi non creano profili personali e non prevedono la ricerca della posizione. Conserviamo le statistiche di utilizzo per 12 mesi.

## Segnalazioni di errori e problemi

Quando il codice di OpenPencil genera un errore imprevisto, una build ufficiale aggiunge **Segnala…** all’avviso di errore; gli errori delle estensioni del browser o senza traccia dello stack non lo ricevono. Se OpenPencil si è chiuso inaspettatamente dopo un errore, o l’app desktop ha incontrato un errore interno, l’avvio successivo offre la stessa possibilità, una volta. **Aiuto → Segnala un problema…** è sempre disponibile. Entrambi aprono un modulo, e non viene inviato nulla finché non scegli **Invia segnalazione**. **Cosa verrà inviato** mostra la segnalazione esatta prima che parta. Contiene:

- Per un errore: il tipo e il messaggio, ripuliti da chiavi, token, indirizzi email e dal tuo nome utente nei percorsi delle cartelle, e il punto del codice di OpenPencil in cui si è verificato. Gli errori dei provider IA, che possono citare i tuoi prompt, vengono inviati senza messaggio.
- Quello che scrivi, e un indirizzo email se ne fornisci uno, così possiamo risponderti.
- I campi della build indicati sopra (<code>{{ buildFields }}</code>), e il tuo ID di installazione se condividi le statistiche di utilizzo.
- Se lasci attivo **Includi l’attività recente**: gli ultimi 50 eventi da **Impostazioni → Diagnostica**, come errori, tempi e formati di file. Non includono mai messaggi della chat o output degli strumenti.
- Se attivi **Allega questo documento**: il design aperto come file `.fig`.

Oltre ai campi della build, una segnalazione contiene questi campi:

<SdkDataTable :columns="columns" :rows="reportRows" />

Le segnalazioni vanno a `feedback.openpencil.dev`, che le passa al tracciamento degli errori di PostHog sul suo cloud europeo, senza il tuo indirizzo, un profilo personale o una ricerca della posizione, e non ne conserva nulla. Un design allegato viene archiviato in Cloudflare R2 nell’UE, solo il team di OpenPencil può aprirlo e viene eliminato dopo 90 giorni.

## Disattivare tutto

- **Impostazioni → Privacy** ha un interruttore per il ping e uno per le statistiche di utilizzo.
- Nell’app desktop, avviare OpenPencil con `OPENPENCIL_TELEMETRY=0` o `DO_NOT_TRACK=1` nel suo ambiente disattiva entrambi.
- Solo le versioni ufficiali inviano qualcosa. I server di sviluppo, le app compilate da te e i fork non inviano nulla, perché l’opzione che abilita l’invio viene impostata solo quando compiliamo una versione.

## Altre richieste di rete

OpenPencil funziona in locale prima di tutto, ma alcune funzionalità si collegano alla rete. L’app desktop controlla gli aggiornamenti all’avvio, a meno che tu non lo disattivi in **Impostazioni → Generali**. **Aiuto → Controlla aggiornamenti…** controlla comunque. Tutto il resto qui sotto si collega solo quando usi quella funzionalità, e solo al servizio indicato.

| Funzionalità                     | Dove si collega                                                                                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controllo aggiornamenti (desktop) | GitHub Releases, per il numero dell’ultima versione                                                                                                                                                                                                                            |
| Chat IA e strumenti per immagini | Il provider che configuri, con la tua chiave; l’elenco dei modelli arriva da models.dev. Con **OpenPencil Cloud** come provider, il servizio IA indicato dal tuo server Cloud, con un token per la tua area di lavoro                                                           |
| Stanze di collaborazione         | Direttamente le altre persone nella stanza; dei broker pubblici mettono in contatto i partecipanti, e un relay TURN trasporta il traffico quando non è possibile una connessione diretta                                                                                       |
| Archiviazione cloud              | Il provider di archiviazione che configuri                                                                                                                                                                                                                                      |
| Font                             | Google Fonts, che può fornire un font usato da un documento ma non installato                                                                                                                                                                                                   |
| Icone                            | L’API di Iconify, quando cerchi o inserisci icone                                                                                                                                                                                                                               |
| Icone nell’HTML importato        | jsDelivr, per un indice delle icone, e l’API di Iconify, per le icone candidate con cui viene confrontato un SVG inline, per nome (l’SVG non viene mai inviato), quando importi HTML; disattivalo in **Impostazioni → Editor**, o passa `--no-icon-names` a `openpencil import` |
| Apri da URL                      | L’indirizzo che apri, e i fogli di stile, i font e le immagini a cui rimanda la sua pagina, scaricati dal tuo dispositivo                                                                                                                                                        |
| Foto stock                       | Unsplash o Pexels, con la tua chiave, quando li cerchi o inserisci una delle loro foto                                                                                                                                                                                          |

L’app, il servizio di feedback e questa pagina sono open source. L’elenco degli eventi si trova in [`packages/feedback/src/contract`](https://github.com/open-pencil/open-pencil/tree/master/packages/feedback/src/contract), e le tabelle qui sopra sono generate da lì.
