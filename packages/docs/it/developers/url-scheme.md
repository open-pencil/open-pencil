---
title: Schema URL
description: "Collega una pagina pubblicata direttamente a un livello, con openpencil:// per l’app desktop e ?file= per l’app web."
---

# Schema URL

L’app desktop registra `openpencil://`, quindi una pagina pubblicata (una storia Storybook, una revisione del design, un README) può rimandare direttamente a un livello:

```
openpencil://open?file=web/design/hikyo.pen&node=Button/Large/Default
```

`file` è un percorso relativo al repository che termina con `.pen` o `.fig`; percorsi assoluti e segmenti `.` o `..` vengono rifiutati. `node` è facoltativo. L’app cerca `file` tra i percorsi delle schede aperte e, se non ne trova, chiede il file con un selettore.

Con un nome di nodo, l’app seleziona ogni livello con quel nome esatto nella pagina corrente e adatta la vista all’intera selezione. Se la pagina corrente non ne contiene, passa alla prima pagina che ne ha, caricando le pagine se necessario. Un nome sconosciuto mostra un avviso e lascia aperto il documento.

OpenPencil ha licenza MIT e conserva i documenti localmente. I file `.fig` possono essere esaminati, trasformati, elaborati in CI o forniti come contesto a un modello senza dipendere da uno specifico servizio di hosting.
