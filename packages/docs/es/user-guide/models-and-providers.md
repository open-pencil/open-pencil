---
pageClass: guide
title: Modelos y proveedores
description: Con qué proveedores de IA funciona el chat, qué funciona en el navegador y en la app de escritorio, y qué hacer cuando no se puede conectar con un proveedor.
---

<script setup>
import ModelProviders from '#docs/theme/components/ModelProviders.vue'
</script>

# Modelos y proveedores

El [chat de IA](./ai-chat) usa un modelo que tú conectas: un [agente de programación](./coding-agents) que ya tengas, una clave de API de un proveedor, tu cuenta de [OpenPencil Cloud](/cloud/ai) o tu propio servidor. Con una clave de API o tu propio servidor, las peticiones van directamente de la app al proveedor, y un agente de programación usa su propia conexión. La IA de OpenPencil Cloud pasa por el servicio propio de Cloud, que reenvía cada petición al proveedor del modelo que usa.

Añade un modelo desde **Ajustes → Modelos**, o deja que lo haga la configuración guiada. En una instalación nueva, al iniciar sesión en OpenPencil Cloud con un plan que incluye IA, esta se configura sola; un modelo que ya hayas configurado se queda como está.

La configuración guiada también asigna a cada tipo de trabajo el modelo que recomienda el proveedor para él, salvo que lo que ya tengas asignado siga funcionando: **Agente de diseño** ejecuta el chat, **Revisión** critica diseños a partir de capturas de pantalla, **Tareas rápidas** hace trabajos rápidos como poner nombre a los chats y **Visión** lee imágenes. La visión solo se configura cuando dices que quieres trabajar con imágenes. Un proveedor cuyo modelo principal no lee imágenes, como DeepSeek o Z.ai, revisa los diseños, y lee imágenes cuando se lo pides, con uno de sus modelos que sí lo haga, si tiene alguno. Puedes cambiar cualquiera de ellos en **Asignaciones**, dentro de **Ajustes → Modelos**.

## Proveedores

<ModelProviders />

**OpenAI-compatible** sirve para la mayoría de los demás servicios y servidores locales, con un interruptor para elegir entre las API Completions y Responses. **Anthropic-compatible** sirve para los servicios que hablan la API Messages de Anthropic. Introduce la URL base, la clave y el ID de modelo que espera tu servidor.

Con **OpenRouter** también puedes iniciar sesión en lugar de pegar una clave.

**ChatGPT** usa tu plan de ChatGPT en lugar de una clave de API, y sus respuestas cuentan para los límites del plan. Solo está disponible en la app de escritorio. Al iniciar sesión se abre el navegador y se vuelve a la app en `localhost:1455`, la única dirección que acepta OpenAI, así que cierra antes cualquier `codex login` que esté en marcha. El inicio de sesión se renueva solo, y la lista de modelos viene de tu cuenta.

## En el navegador y en la app de escritorio

La app de escritorio puede conectarse con cualquier proveedor, y guarda las claves en el almacén de credenciales de tu sistema. También ofrece lo que el navegador no puede: agentes de programación e inicio de sesión con ChatGPT.

La app web envía las peticiones desde el navegador, así que el proveedor tiene que permitirlo (CORS). Los proveedores integrados lo permiten; con tu propio servidor u otro servicio, compruébalo antes de depender de él.

Cuando la app web muestra **«No se ha podido acceder a este endpoint desde el navegador»**, la petición nunca recibió una respuesta que el navegador aceptara. O el proveedor no permite peticiones desde el navegador, o sí las permite pero no incluye el permiso en sus respuestas de error, de modo que una clave o un nombre de modelo incorrectos tienen el mismo aspecto. Prueba los mismos ajustes en la app de escritorio: si funcionan ahí, el proveedor bloquea el navegador. [Testing a Model Provider](/development/testing-model-providers) explica cómo comprobar un proveedor por tu cuenta.

## Elegir un modelo

El chat funciona llamando a herramientas, así que un modelo tiene que admitir **llamadas a herramientas** y transmitirlas de forma fiable; los modelos varían en esto incluso dentro del mismo proveedor. Añade **visión** para que el chat pueda mirar imágenes y comprobar su propio trabajo.

Los modelos de razonamiento pueden gastar todo su presupuesto de salida pensando. Si un modelo se detiene sin hacer nada, sube sus **Tokens de salida máx.** o baja su **Nivel de razonamiento**.

Cada paso de una respuesta vuelve a enviar la conversación y las descripciones de las herramientas, así que las respuestas largas usan muchos tokens de entrada. **Máximo de pasos por mensaje**, en **Chat** dentro de **Ajustes → Modelos**, lo limita para la IA integrada, mientras que los agentes de programación definen sus propios límites; consulta [Mientras la IA trabaja](./ai-chat#mientras-la-ia-trabaja).

## Mantener tus claves a salvo

En el navegador, las claves se guardan en el almacenamiento cifrado del navegador para que no tengas que volver a escribirlas; en Ajustes puedes hacer que solo se guarden durante la sesión. La app de escritorio usa el almacén de credenciales de tu sistema. Una clave guardada en el navegador puede seguir siendo usada por los scripts que se ejecutan en la página, así que, cuando el proveedor lo permita, es mejor usar claves con permisos limitados y límites de gasto.
