---
layout: doc
title: Automatización y API
description: AI, MCP, CLI, JSX y API de plugins de Figma para automatizar diseños.
---

# Automatización y API

OpenPencil trata los archivos de diseño como datos estructurados. Las operaciones del editor —crear formas, modificar rellenos, configurar la disposición automática o exportar recursos— también están disponibles mediante CLI, agentes de AI y API.

## Chat con AI

El asistente integrado puede ejecutar más de 90 herramientas. Una instrucción puede cambiar las sombras de varios botones, crear un componente con variante oscura o exportar todos los marcos de una página a escala 2×.

[Chat con AI →](./ai-chat)

## MCP

Claude Code, Cursor, Windsurf y otros clientes MCP pueden usar las mismas herramientas. El servidor admite stdio y HTTP y mantiene sesiones independientes.

[Servidor MCP →](/programmable/mcp-server)

## CLI

La CLI examina, exporta y analiza archivos `.fig` sin abrir el editor. Puede listar páginas y objetos, buscar contenido, extraer variables de diseño y generar PNG. `--json` facilita la integración con CI y otros programas.

La CLI también se conecta a la aplicación de escritorio en ejecución mediante RPC, de modo que puedes automatizar el editor mientras lo usas: abrir, guardar y cambiar de documento, deshacer, modificar ajustes y llamar a cualquier herramienta MCP.

[CLI →](./cli/inspecting) · [Controlar la aplicación](/programmable/cli/app-control)

## JSX

Una interfaz puede describirse de forma declarativa con JSX. Una llamada crea un árbol completo con marcos, texto, disposición automática, rellenos y contornos.

En sentido inverso, OpenPencil exporta una selección como JSX o HTML con clases Tailwind, útil como base para implementar, revisar código o continuar el trabajo con AI.

[Renderizador JSX →](./jsx-renderer)

## API de plugins de Figma

El comando `eval` ejecuta JavaScript con un objeto global `figma` compatible. Permite consultar y modificar documentos, crear componentes y variables y guardar el resultado.

[Scripting con `eval` →](./cli/scripting)

## Esquema de URL {#url-scheme}

La aplicación de escritorio registra `openpencil://`, de modo que una página publicada —una historia de Storybook, una revisión de diseño, un README— puede enlazar directamente a una capa:

```
openpencil://open?file=web/design/hikyo.pen&node=Button/Large/Default
```

`file` es una ruta relativa al repositorio que termina en `.pen` o `.fig`; se rechazan las rutas absolutas y los segmentos `.` o `..`. `node` es opcional. Ambos valores van codificados como URL —los separadores de ruta pueden quedar tal cual, pero un `+` literal debe enviarse como `%2B`— y, si una clave se repite, se usa su último valor.

La aplicación compara `file` con las rutas de las pestañas abiertas como una secuencia completa de segmentos finales y da el foco a esa pestaña sin volver a leer el documento, así que un archivo que se movió o dejó de ser legible desde que se abrió sigue pudiendo seleccionar su capa. Gana la primera pestaña abierta cuya ruta termina con la ruta solicitada, lo que importa cuando dos copias del repositorio tienen abierto el mismo archivo. Los segmentos se comparan como lo hace el sistema de archivos de la plataforma: sin distinguir mayúsculas ASCII en macOS y Windows, y de forma exacta en Linux, de modo que `Web/Design/hikyo.pen` y `web/design/hikyo.pen` son el mismo archivo en un Mac y dos distintos en Linux. Si ninguna pestaña abierta coincide, un selector de archivos pide el archivo una sola vez; el archivo elegido debe terminar con la misma ruta relativa, de lo contrario el enlace se cancela. No se une ninguna ruta a una raíz y no se concede más acceso al sistema de archivos que el que devuelve el selector. Un archivo que el enlace abre de verdad —el elegido— se añade a la lista de archivos recientes como cualquier otro archivo que abras; dar el foco a una pestaña que ya estaba abierta no toca la lista, porque no se abrió nada.

Con un nombre de nodo, la aplicación selecciona todas las capas que llevan exactamente ese nombre en la página actual y ajusta la vista a toda la selección. Si la página actual no tiene ninguna, cambia a la primera página que sí la tenga, cargando páginas según haga falta. Un nombre desconocido muestra un aviso y deja el documento abierto. Abrir un archivo y seleccionar capas es todo lo que puede hacer el esquema.

La versión web acepta el mismo enlace desde su propia barra de direcciones:

```
https://app.openpencil.dev/?file=https://raw.githubusercontent.com/open-pencil/open-pencil/master/tests/fixtures/pencil_button.pen&node=Button/Large/Default
```

Aquí `file` es una URL `https:` absoluta que termina en `.pen` o `.fig`: la versión web no tiene sistema de archivos, así que una ruta relativa, una URL `http:` o cualquier otra extensión se rechaza con una advertencia en la consola y nada más. La extensión se lee de la ruta de la URL, por lo que una cadena de consulta en el archivo enlazado no cambia nada. El fragmento se descarta antes de la descarga: nunca llega al servidor, así que `…/hikyo.pen#a` y `…/hikyo.pen#b` abren una pestaña, no dos. `node` se comporta exactamente igual que arriba: la misma selección por nombre exacto y el mismo zoom, y el mismo aviso cuando ninguna capa lleva ese nombre. Ambos valores van codificados como URL, un `+` literal debe enviarse como `%2B` y una clave repetida toma su último valor, igual que en el escritorio. El enlace se procesa en cualquier ruta, de modo que `/share/<room>?file=…` y `/demo?file=…` funcionan como `/?file=…`.

El navegador descarga el archivo entre orígenes distintos, así que el servidor debe permitirlo: `raw.githubusercontent.com` envía `Access-Control-Allow-Origin: *` y funciona. La solicitud no lleva credenciales y se niega a seguir redirecciones, lo que evita que un enlace `https:` acabe desviado a uno en texto plano: una URL `https://github.com/<owner>/<repo>/raw/...` redirige a `raw.githubusercontent.com` y por tanto se rechaza, así que enlaza directamente al host raw. `file` y `node` se eliminan de la barra de direcciones mediante el router en cuanto se leen —antes de la descarga y también cuando el enlace se rechazó—, de modo que recargar no vuelve a abrir el documento y ni una URL copiada ni una navegación posterior dentro de la aplicación arrastran el contenido del enlace. Un documento enlazado tiene un límite de 64 MiB: el cuerpo se cuenta a medida que llega, sin fiarse de `Content-Length`, y la solicitud se aborta en cuanto lo supera; el enlace informa de que el archivo supera los 64 MiB. Un despliegue que sirva la aplicación con una Content-Security-Policy debe permitir el host enlazado en `connect-src`; de lo contrario la descarga se bloquea y el enlace informa de que no pudo abrir el archivo.

En macOS el esquema pertenece al paquete de la aplicación instalada, por lo que los enlaces llegan a una versión instalada y no a un proceso de `tauri dev`. En Windows y Linux el enlace llega mediante el plugin de deep links, incluso cuando la aplicación aún no está en ejecución: el enlace se pone en cola al arrancar y se procesa cuando el editor está listo; en Linux, la entrada de escritorio incluida pasa el enlace mediante `%U`.

OpenPencil tiene licencia MIT y guarda los documentos localmente. Los archivos `.fig` se pueden examinar, transformar, procesar en CI o proporcionar como contexto a un modelo sin depender de un proveedor de alojamiento concreto.
