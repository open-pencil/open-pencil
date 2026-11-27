---
pageClass: guide
title: Fotos
description: Rellena una capa con una foto de stock gratuita de Unsplash o Pexels en OpenPencil.
---

# Fotos

OpenPencil busca en las bibliotecas de fotos gratuitas de [Unsplash](https://unsplash.com) y [Pexels](https://www.pexels.com) desde el relleno de imagen de una capa. Ambas permiten a cualquiera usar sus fotos gratis, y ambas piden una clave de API para buscar en ellas, que también es gratuita. La clave se queda en tu dispositivo.

Para buscar y usar fotos se necesita conexión de red con el servicio en el que buscas.

## Rellenar una capa con una foto

Dibuja el marco o la forma que debe rellenar la foto, y luego:

1. Abre su relleno y cámbialo a **Imagen**.
2. Elige **Foto de stock** en la vista previa.
3. Antes de que escribas, el selector muestra las selecciones del propio servicio: el feed editorial de Unsplash o las fotos destacadas de Pexels. Escribe lo que buscas, como `mountains` o `coffee`; se cargan más resultados a medida que te desplazas. Pasa el puntero sobre una foto, o llega a ella con las teclas de flecha, para ver quién la hizo.
4. Elige una. Se convierte en el relleno de imagen de la capa y conserva el modo de escala del relleno, así que **Fill**, **Fit**, **Crop** y **Tile** funcionan con ella como con cualquier imagen.

El botón de servicio en la cabecera del selector cambia entre Unsplash y Pexels. El selector se abre en el último que usaste, o en uno que tenga clave cuando ese no la tenga. Mientras un servicio no tenga clave, el selector lo indica: elige **Abrir Ajustes**, abre el servicio en **Ajustes → Multimedia**, sigue **Obtener clave API** para crear una, pégala y elige **Guardar**. **Probar conexión** prueba la clave que has escrito, o la guardada, con una sola petición al servicio.

Una app de Unsplash tiene dos claves: pega su **Access Key**, no su Secret key. Una app nueva de Unsplash permite 50 peticiones por hora hasta que Unsplash la aprueba para producción; cada búsqueda, cada página de resultados y cada prueba cuentan.

Pexels ha dejado de emitir claves de API nuevas por ahora. Si ya tienes una clave de Pexels, sigue funcionando; si no, usa Unsplash.

## Créditos y claves

Unsplash y Pexels piden que se dé crédito a las personas que hicieron las fotos; el selector indica el fotógrafo de cada foto. OpenPencil avisa a Unsplash cuando se usa una de sus fotos, como exigen las condiciones de su API.

Cambia o quita las claves en **Ajustes → Multimedia**. La herramienta de fotos de stock del chat de IA usa las mismas claves.
