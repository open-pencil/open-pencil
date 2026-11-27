---
title: Privacidad
description: Qué envía OpenPencil por la red, por qué envía estadísticas de uso anónimas y cómo desactivar cada parte.
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

# Privacidad

- Tus diseños, nombres de archivo, nombres de capa, textos, prompts y claves nunca salen de tu dispositivo, salvo que tú mismo los compartas o sincronices, o adjuntes un diseño a un informe que envíes.
- Las versiones oficiales envían un ping anónimo al día, sin ningún identificador. Puedes desactivarlo.
- Las estadísticas de uso detalladas solo se envían si respondes que sí cuando se te pregunta, y puedes dejar de compartirlas en cualquier momento.

## Por qué recopilamos datos

OpenPencil lo desarrolla un equipo pequeño. Necesitamos saber qué plataformas, formatos de archivo y funciones usa la gente para decidir qué desarrollar a continuación. También necesitamos demostrar que OpenPencil se usa, porque eso es lo que mantiene la financiación del proyecto. Un recuento de instalaciones activas y una idea de qué funciones importan responden a ambas preguntas sin saber nada de ti ni de tu trabajo.

## El ping diario

Una vez al día, una versión oficial envía esto a `feedback.openpencil.dev`:

```http
POST https://feedback.openpencil.dev/ping

{ "version": "0.17.0", "platform": "macos", "arch": "arm64", "app": "desktop", "browser": "unknown", "usageStats": "denied", "pingDays": "5-8", "enteredStep": false }
```

<SdkDataTable :columns="columns" :rows="pingRows" />

No lleva ningún identificador, así que los pings de una misma instalación no se pueden relacionar entre sí. La respuesta a la pregunta sobre estadísticas de uso es la única forma que tenemos de saber cuántas personas las rechazan, ya que rechazarlas significa que nunca se envía nada más. La app solo guarda la fecha de su último ping, para enviarlo una vez al día, y cuántos días lo ha enviado. Solo se envía el tramo en el que cae ese número: 1, 2, 3–4, 5–8, y así sucesivamente, duplicándose, nunca el número en sí. Todas las instalaciones pasan por los tramos en orden, así que el servidor puede distinguir las instalaciones que vuelven de las copias de un mismo estado guardado que se ejecutan una y otra vez, que repiten el mismo tramo, sin distinguir unas instalaciones de otras. El servidor suma uno a un contador de ese día y esa versión, y uno a un contador de ese día, esa app y ese tramo. También suma uno a un contador de ese día, la app y la plataforma, y la red desde la que llegó el ping: el número de la red y el nombre de su operador tal como los indica Cloudflare, como un proveedor de internet doméstico, una universidad o un servicio de alojamiento en la nube. Eso permite distinguir a personas reales de instalaciones automatizadas que se ejecutan en centros de datos, sin nada que identifique un dispositivo. El servidor no guarda nada más. No registra direcciones y rechaza cualquier ping que lleve otro campo.

La respuesta al ping incluye una lista de mensajes que la app puede mostrar, como una petición de donaciones o una invitación a probar OpenPencil Cloud: su texto, en qué parte de la app aparecen, con qué frecuencia y en qué versiones. Una versión que los muestra decide en el propio dispositivo si toca mostrar alguno, según cuánto tiempo lleva instalada, su versión, su plataforma y si has iniciado sesión en Cloud, y también guarda en el dispositivo lo que hiciste con cada uno, como **Ahora no**. Nada de eso se devuelve con el ping. Si compartes estadísticas de uso, estas indican cuándo se mostró uno de estos mensajes, se pospuso o se siguió, con el nombre del mensaje y dónde se mostró (los eventos de más abajo); el servidor solo los guarda para los mensajes que todavía ofrece o que incluye la app, como su petición de donaciones. El botón de un mensaje abre su página con el nombre del mensaje en la dirección, para que el recuento de visitas del sitio pueda saber qué mensaje trajo a alguien, sin nada sobre ti ni tu dispositivo. Un mensaje del servidor es texto: no puede ejecutar código, mostrar imágenes ni enlazar a ningún sitio que no sea openpencil.dev. La petición de donaciones propia de la app enlaza a la página de donaciones que indica el proyecto. Las versiones que compilas tú mismo no reciben mensajes del servidor.

El ping está activado de forma predeterminada. Desactívalo en **Ajustes → Privacidad**; a partir de entonces la app no muestra mensajes del servidor.

## Estadísticas de uso

Las estadísticas de uso están desactivadas hasta que des tu consentimiento. OpenPencil lo pregunta una sola vez, en un pequeño aviso que aparece tras la pantalla de bienvenida en el primer inicio, o en un inicio posterior si no has respondido, con dos opciones equivalentes: **No, gracias** y **Compartir estadísticas**. No hay nada seleccionado de antemano, y puedes cambiar tu respuesta más adelante en **Ajustes → Privacidad**.

Cuando aceptas, la app crea en tu dispositivo un identificador de instalación aleatorio. No está vinculado a ninguna cuenta, dirección de correo ni ningún otro dato sobre ti. Los eventos de uso se envían con él, junto con los campos de versión indicados arriba (<code>{{ buildFields }}</code>). Cuando dejas de compartir, la app borra el identificador; si vuelves a aceptar, se crea uno nuevo.

Estos son todos los eventos que puede enviar la app. El servicio de `feedback.openpencil.dev` comprueba cada evento con esta lista y rechaza cualquier evento, propiedad o valor que no esté en ella, así que una app modificada tampoco puede enviar nada más a través de él.

<template v-for="event in events" :key="event.name">
  <h3><code>{{ event.name }}</code></h3>
  <p>{{ event.description }}</p>
  <SdkDataTable v-if="event.properties.length" :columns="columns" :rows="rows(event.properties)" />
</template>

Los eventos aceptados van a [PostHog](https://posthog.com), un servicio de analítica de producto, en su nube de la UE. La petición sale de nuestro servidor, no de tu dispositivo, así que PostHog nunca ve tu dirección. Los eventos no crean perfiles de persona y omiten la búsqueda de ubicación. Conservamos las estadísticas de uso durante 12 meses.

## Informes de errores y problemas

Cuando el propio código de OpenPencil produce un error inesperado, una versión oficial añade **Informar…** al aviso de error; los errores de extensiones del navegador o sin traza de pila no lo incluyen. Si OpenPencil se cerró de forma inesperada después de un error, o la app de escritorio sufrió un error interno, el siguiente inicio ofrece lo mismo, una vez. **Ayuda → Informar de un problema…** está siempre disponible. Ambos abren un formulario, y no se envía nada hasta que eliges **Enviar informe**. **Qué se enviará** muestra el informe exacto antes de enviarlo. Contiene:

- Para un error: su tipo y su mensaje, sin claves, tokens, direcciones de correo ni tu nombre de usuario en las rutas de carpetas, y en qué parte del código de OpenPencil ocurrió. Los errores de los proveedores de IA, que pueden citar tus prompts, se envían sin mensaje.
- Lo que escribas y, si la indicas, una dirección de correo para que podamos responderte.
- Los campos de versión indicados arriba (<code>{{ buildFields }}</code>) y tu identificador de instalación si compartes estadísticas de uso.
- Si dejas activado **Incluir la actividad reciente**: los últimos 50 eventos de **Ajustes → Diagnóstico**, como errores, tiempos y formatos de archivo. Nunca incluyen mensajes del chat ni resultados de herramientas.
- Si activas **Adjuntar este documento**: el diseño abierto como archivo `.fig`.

Además de los campos de versión, un informe tiene estos campos:

<SdkDataTable :columns="columns" :rows="reportRows" />

Los informes van a `feedback.openpencil.dev`, que los pasa al seguimiento de errores de PostHog en su nube de la UE, sin tu dirección, sin perfil de persona ni búsqueda de ubicación, y no guarda nada de ellos. Un diseño adjunto se almacena en Cloudflare R2 en la UE, solo el equipo de OpenPencil puede abrirlo y se elimina al cabo de 90 días.

## Desactivarlo todo

- **Ajustes → Privacidad** tiene un interruptor para el ping y otro para las estadísticas de uso.
- En la app de escritorio, iniciar OpenPencil con `OPENPENCIL_TELEMETRY=0` o `DO_NOT_TRACK=1` en su entorno desactiva ambos.
- Solo las versiones oficiales envían algo. Los servidores de desarrollo, las apps compiladas por uno mismo y los forks no envían nada, porque el interruptor que habilita el envío solo se activa cuando compilamos una versión oficial.

## Otras peticiones de red

OpenPencil funciona primero en local, pero algunas funciones se conectan a la red. La app de escritorio busca actualizaciones al iniciarse, salvo que lo desactives en **Ajustes → General**. **Ayuda → Buscar actualizaciones…** sigue buscándolas. Todo lo demás que aparece a continuación solo se conecta cuando usas esa función, y solo al servicio indicado.

| Función                          | A dónde se conecta                                                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Búsqueda de actualizaciones (escritorio) | GitHub Releases, para obtener el número de la última versión                                                                                                                                                                                                                      |
| Chat de IA y herramientas de imagen | El proveedor que configures, con tu propia clave; la lista de modelos viene de models.dev. Con **OpenPencil Cloud** como proveedor, el servicio de IA que indique tu servidor de Cloud, con un token de tu espacio de trabajo                                                          |
| Salas de colaboración            | Las demás personas de la sala, directamente; unos intermediarios públicos ponen en contacto a los participantes, y un relé TURN transporta el tráfico cuando no es posible una conexión directa                                                                                          |
| Almacenamiento en la nube        | El proveedor de almacenamiento que configures                                                                                                                                                                                                                                            |
| Fuentes                          | Google Fonts, que puede proporcionar una fuente que usa un documento y que no está instalada                                                                                                                                                                                             |
| Iconos                           | La API de Iconify, cuando buscas o insertas iconos                                                                                                                                                                                                                                       |
| Iconos en HTML importado         | jsDelivr, para obtener un índice de iconos, y la API de Iconify, para los iconos candidatos con los que se compara un SVG en línea, por nombre (el SVG nunca se envía), cuando importas HTML; desactívalo en **Ajustes → Editor**, o pasa `--no-icon-names` a `openpencil import` |
| Abrir desde URL                  | La dirección que abres, y las hojas de estilo, fuentes e imágenes que enlaza su página, descargadas desde tu dispositivo                                                                                                                                                                  |
| Fotos de stock                   | Unsplash o Pexels, con tu propia clave, cuando buscas en ellos o colocas una de sus fotos                                                                                                                                                                                                |

La app, el servicio de feedback y esta página son de código abierto. La lista de eventos está en [`packages/feedback/src/contract`](https://github.com/open-pencil/open-pencil/tree/master/packages/feedback/src/contract), y las tablas de arriba se generan a partir de ella.
