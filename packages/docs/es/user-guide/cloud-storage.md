---
pageClass: guide
title: Almacenamiento en la nube
description: Guarda documentos y bibliotecas de componentes en tu propio bucket compatible con S3 — AWS S3, Backblaze B2, Cloudflare R2, MinIO y otros.
---

# Almacenamiento en la nube

OpenPencil puede guardar documentos en un bucket tuyo de cualquier servicio compatible con S3: AWS S3, Backblaze B2, Cloudflare R2, MinIO y otros. No hay ningún servidor de OpenPencil de por medio; el editor se comunica directamente con tu bucket usando tus propias claves de acceso.

## Conectar un bucket

Abre **Ajustes → Almacenamiento**, selecciona **Almacenamiento S3** y rellena:

| Campo                          | Qué introducir                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Punto de conexión**          | La URL de la API S3 del proveedor, incluida cualquier ruta necesaria. Consulta los ejemplos de abajo. |
| **Bucket**                     | El nombre del bucket.                                                                                |
| **Región**                     | Opcional. Si lo dejas vacío, se lee del punto de conexión, o se usa `us-east-1` cuando no es posible. |
| **ID de clave de acceso**      | Una clave de acceso con permisos de lectura, escritura, listado y eliminación en el bucket.          |
| **Clave de acceso secreta**    | El secreto de la clave.                                                                              |

Ejemplos de punto de conexión:

- AWS S3: `https://s3.eu-west-1.amazonaws.com`
- Backblaze B2: `https://s3.eu-central-003.backblazeb2.com`
- Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`
- MinIO: `http://localhost:9000`, o donde escuche tu servidor

Selecciona **Probar conexión** para comprobar el punto de conexión, las claves y el bucket antes de guardar, y después **Guardar**. OpenPencil añade por sí mismo el bucket al punto de conexión, como `{endpoint}/{bucket}/{key}`, así que no incluyas el nombre del bucket en el punto de conexión.

En la app de escritorio, las claves de acceso se guardan en el almacén de credenciales del sistema. En el navegador se cifran en el almacenamiento del navegador, o solo se conservan hasta que cierras la sesión cuando **Ajustes → General → Recordar claves API en este dispositivo** está desactivado.

## Permitir la app web en CORS

El navegador solo puede acceder a un bucket que permita peticiones desde el origen de la página, así que la app web necesita una regla CORS en el bucket. La app de escritorio envía sus peticiones de forma nativa y no necesita ninguna.

Añade una regla como esta, con los orígenes desde los que abres OpenPencil:

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

La app web se está trasladando de app.openpencil.dev a cloud.openpencil.dev: a una regla configurada para la dirección antigua hay que añadirle la nueva. Configúrala en la consola de AWS, en **Permissions → Cross-origin resource sharing** del bucket; en el panel de Cloudflare, en **Settings → CORS policy** del bucket R2, o con la CLI de tu proveedor. Cuando falta la regla, **Probar conexión** indica que el navegador no ha podido acceder al bucket desde el sitio actual.

## Guardar un documento en el almacenamiento

Abre o crea un documento y elige **Archivo → Guardar en…**. Si no hay ningún espacio de trabajo de Cloud entre el que elegir, el documento se guarda directamente en el bucket; si no, elige el bucket en la lista. La pestaña queda vinculada a él: **Guardar** y el guardado automático escriben ahora en el almacenamiento en lugar de en un archivo local. Un `.fig` local que tuvieras abierto conserva lo último que guardaste en él.

Para abrir documentos guardados, selecciona tu bucket en la barra lateral de Inicio. **Nuevo diseño** con el bucket seleccionado crea un documento en él. Inicio muestra todos los documentos del bucket con una vista previa leída del propio documento, así que para mostrar un archivo grande solo se descarga su miniatura incrustada.

## Cómo funciona el guardado

Al guardar, el documento se escribe primero en este dispositivo y se sube en segundo plano, así que la edición nunca espera a la red. Si una subida falla o no tienes conexión, se reintenta con esperas cada vez más largas, y el trabajo pendiente se reanuda cuando vuelves a conectarte o cambias los ajustes de almacenamiento.

Cada documento se sube entero. Cuando dos dispositivos guardan el mismo documento, gana la última subida.

Los documentos que has abierto se quedan en la caché del dispositivo para que se vuelvan a abrir más rápido, hasta 500 MB. Cuando la caché se llena, solo se eliminan las copias que están completamente subidas, y se vuelven a descargar la próxima vez que las abres.

## Bibliotecas de componentes

El bucket también puede contener bibliotecas de componentes. En **Recursos → Gestionar bibliotecas**, cambia el origen a **Almacenamiento** para publicar y activar ahí las bibliotecas en lugar de en este dispositivo. La publicación usa escrituras condicionales, así que dos personas que publiquen la misma biblioteca a la vez no pueden sobrescribir la revisión de la otra. Consulta [Bibliotecas de componentes](./component-libraries) para publicar y actualizar bibliotecas.

## Qué hay en el bucket

OpenPencil solo escribe bajo dos prefijos y no toca nada más del bucket:

- `open_pencil_storage/canvases/` — cada documento como `<id>.fig`, con su nombre y su fecha de modificación en `<id>.meta.json`.
- `open-pencil/libraries/` — el `manifest.json` de cada biblioteca y sus revisiones publicadas.

## Notas sobre proveedores

- **Cloudflare R2** necesita el origen exacto de la app web en su regla CORS; no acepta orígenes con comodines como `https://*.example.com`.
- **MinIO** responde a las peticiones CORS desde cualquier origen, salvo que lo configures de otra manera.
- **`rclone serve s3`** funciona con dos limitaciones. Rechaza las peticiones CORS de comprobación previa, así que la app web necesita delante un proxy inverso que las responda; la app de escritorio no. Además, ignora las escrituras condicionales, así que no se detectan las publicaciones simultáneas de una biblioteca.
