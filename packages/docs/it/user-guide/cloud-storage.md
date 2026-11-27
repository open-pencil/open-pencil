---
pageClass: guide
title: Archiviazione cloud
description: Conserva documenti e librerie di componenti nel tuo bucket compatibile con S3 — AWS S3, Backblaze B2, Cloudflare R2, MinIO e altri.
---

# Archiviazione cloud

OpenPencil può conservare i documenti in un bucket di tua proprietà su qualsiasi servizio compatibile con S3: AWS S3, Backblaze B2, Cloudflare R2, MinIO e altri. Non c’è nessun server di OpenPencil in mezzo; l’editor comunica direttamente con il tuo bucket usando le tue chiavi di accesso.

## Collegare un bucket

Apri **Impostazioni → Archiviazione**, seleziona **Archiviazione S3** e compila:

| Campo                                | Cosa inserire                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| **Endpoint**                         | L’URL dell’API S3 del provider, compreso l’eventuale percorso richiesto. Vedi gli esempi qui sotto. |
| **Bucket**                           | Il nome del bucket.                                                                         |
| **Regione**                          | Facoltativa. Se la lasci vuota, viene ricavata dall’endpoint, oppure è `us-east-1` quando non è possibile. |
| **ID chiave di accesso**             | Una chiave di accesso con permessi di lettura, scrittura, elenco ed eliminazione sul bucket. |
| **Chiave di accesso segreta**        | Il segreto della chiave.                                                                    |

Esempi di endpoint:

- AWS S3: `https://s3.eu-west-1.amazonaws.com`
- Backblaze B2: `https://s3.eu-central-003.backblazeb2.com`
- Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`
- MinIO: `http://localhost:9000`, o l’indirizzo su cui è in ascolto il tuo server

Seleziona **Verifica connessione** per controllare endpoint, chiavi e bucket prima di salvare, poi **Salva**. OpenPencil aggiunge da sé il bucket all’endpoint, come `{endpoint}/{bucket}/{key}`, quindi non inserire il nome del bucket nell’endpoint.

Nell’app desktop, le chiavi di accesso vengono conservate nel portachiavi delle credenziali del sistema. Nel browser vengono cifrate nell’archivio del browser, oppure conservate solo finché non chiudi la sessione quando **Impostazioni → Generali → Ricorda le chiavi API su questo dispositivo** è disattivato.

## Consentire l’app web in CORS

Il browser può raggiungere solo un bucket che consente le richieste dall’origine della pagina, quindi l’app web ha bisogno di una regola CORS sul bucket. L’app desktop invia le richieste in modo nativo e non ne ha bisogno.

Aggiungi una regola come questa, con le origini da cui apri OpenPencil:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://cloud.openpencil.dev"],
    "ExposeHeaders": ["ETag", "Content-Range", "x-amz-request-id", "x-amz-id-2", "x-amz-version-id"],
    "MaxAgeSeconds": 3600
  }
]
```

L’app web si sta trasferendo da app.openpencil.dev a cloud.openpencil.dev: a una regola configurata per il vecchio indirizzo va aggiunto quello nuovo. Impostala nella console AWS in **Permissions → Cross-origin resource sharing** del bucket, nella dashboard di Cloudflare in **Settings → CORS policy** del bucket R2, oppure con la CLI del tuo provider. Quando la regola manca, **Verifica connessione** indica che il browser non è riuscito a raggiungere il bucket dal sito corrente.

## Salvare un documento nell’archiviazione

Apri o crea un documento, poi scegli **File → Salva in…**. Se non c’è un’area di lavoro Cloud tra cui scegliere, il documento viene salvato direttamente nel bucket; altrimenti scegli il bucket dall’elenco. La scheda resta legata a esso: **Salva** e il salvataggio automatico ora scrivono nell’archiviazione invece che su un file locale. Un `.fig` locale che avevi aperto mantiene il contenuto dell’ultimo salvataggio.

Per aprire i documenti archiviati, seleziona il tuo bucket nella barra laterale della pagina iniziale. **Nuovo design**, con il bucket selezionato, crea un documento al suo interno. La pagina iniziale elenca ogni documento del bucket con un’anteprima letta dal documento stesso, quindi per elencare un file grande viene scaricata solo la miniatura incorporata.

## Come funziona il salvataggio

Il salvataggio scrive il documento prima su questo dispositivo e lo carica in background, così la modifica non aspetta mai la rete. Se un caricamento non riesce o sei offline, viene ritentato con intervalli crescenti, e il lavoro in sospeso riprende quando ti riconnetti o cambi le impostazioni di archiviazione.

Ogni documento viene caricato per intero. Quando due dispositivi salvano lo stesso documento, vince l’ultimo caricamento.

I documenti che hai aperto restano nella cache del dispositivo per riaprirli più velocemente, fino a 500 MB. Quando la cache è piena vengono rimosse solo le copie completamente caricate, che vengono scaricate di nuovo la volta successiva che le apri.

## Librerie di componenti

Il bucket può contenere anche librerie di componenti. In **Risorse → Gestire le librerie**, imposta la fonte su **Archiviazione** per pubblicare e attivare le librerie lì invece che su questo dispositivo. La pubblicazione usa scritture condizionali, così due persone che pubblicano la stessa libreria nello stesso momento non possono sovrascrivere l’una la revisione dell’altra. Vedi [Librerie di componenti](./component-libraries) per pubblicare e aggiornare le librerie.

## Cosa c’è nel bucket

OpenPencil scrive solo sotto due prefissi e lascia stare tutto il resto del bucket:

- `open_pencil_storage/canvases/` — ogni documento come `<id>.fig`, con il nome e l’ora di modifica in `<id>.meta.json`.
- `open-pencil/libraries/` — il `manifest.json` di ogni libreria e le sue revisioni pubblicate.

## Note sui provider

- **Cloudflare R2** richiede nella sua regola CORS l’origine esatta dell’app web; non accetta origini con caratteri jolly come `https://*.example.com`.
- **MinIO** risponde alle richieste CORS da qualsiasi origine, a meno che tu non lo configuri diversamente.
- **`rclone serve s3`** funziona con due limiti. Rifiuta le richieste CORS di preflight, quindi l’app web ha bisogno davanti di un reverse proxy che risponda a queste richieste; l’app desktop no. Ignora anche le scritture condizionali, quindi le pubblicazioni simultanee di librerie non vengono rilevate.
