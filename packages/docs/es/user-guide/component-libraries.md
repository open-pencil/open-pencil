---
pageClass: guide
title: Bibliotecas de componentes
description: Publica componentes, estilos y variables desde un archivo, úsalos en otros y recibe sus actualizaciones.
---

# Bibliotecas de componentes

Una biblioteca comparte los componentes, estilos y variables de un archivo con tus demás archivos. Cada vez que publicas, se guarda una versión nueva. Los archivos que usan la biblioteca eligen cuándo adoptarla.

## Publicar una biblioteca

1. Abre el archivo con los componentes que quieres compartir.
2. Abre **Recursos** y haz clic en **Gestionar bibliotecas**, junto al campo de búsqueda.
3. Haz clic en **Publicar biblioteca**.
4. La primera vez, dale a la biblioteca un ID y un nombre. El ID no se puede cambiar después.
5. Marca los cambios que quieres publicar y, si quieres, añade una descripción.
6. Haz clic en **Publicar biblioteca**.

<GuideImage name="component-libraries/publish" alt="Publicar biblioteca con el ID acme-ui, el nombre Acme UI y el componente Button marcado" />

Una biblioteca siempre incluye todos los estilos y todas las colecciones de variables del archivo. Los cambios que dejes sin marcar esperan a la próxima vez.

## Usar una biblioteca

1. Abre **Recursos → Gestionar bibliotecas** en el archivo que la necesita.
2. Activa la biblioteca en **Explorar bibliotecas**.
3. Coloca sus componentes desde **Recursos** igual que colocas los tuyos.

Un componente trae consigo los estilos y las variables que usa. No se pueden editar aquí: cámbialos en el archivo de la biblioteca y vuelve a publicar. Las instancias siguen siendo editables como cualquier otra.

## Actualizar a una versión nueva

Abre **Gestionar bibliotecas → Actualizaciones** para ver qué ha cambiado. No cambia nada en tu archivo hasta que lo decidas.

1. Compara una instancia antes y después de la actualización.
2. Actualiza la instancia seleccionada, todas las instancias de ese componente, las instancias de esta página o todas.

Las instancias conservan los cambios que les hiciste, también en las capas que la biblioteca ha renombrado. Solo pierden los cambios en las capas que la biblioteca ha eliminado. Cuando la variante de una instancia ya no existe en la versión nueva, la revisión indica a qué variante pasa. **Deshacer** revierte una actualización.

## Dónde se guardan las bibliotecas

Las bibliotecas **Local** se quedan en este navegador o en esta app. Las bibliotecas de **Almacenamiento** están en el [bucket compatible con S3](./cloud-storage) que configures, para que otras personas puedan usarlas. Cambia entre ellas en la parte superior de **Explorar bibliotecas**.

Las versiones que has usado se guardan en tu ordenador, así que sus componentes se siguen mostrando y se pueden colocar mientras no tienes conexión. Al guardar un archivo, este conserva las versiones de biblioteca que usa, y se abre igual aunque no se pueda acceder a la biblioteca.
