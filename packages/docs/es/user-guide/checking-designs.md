---
pageClass: guide
title: Revisar diseños
description: Encuentra problemas de accesibilidad, coherencia y estructura con el panel Revisar y los marcadores de problemas en el lienzo.
---

# Revisar diseños

OpenPencil revisa la página actual mientras trabajas y señala las capas que incumplen reglas de diseño habituales: texto difícil de leer, controles demasiado pequeños para tocarlos, colores que deberían usar una variable y espaciados fuera de la escala.

## Encontrar problemas

Abre la pestaña **Revisar** en el panel derecho. Su indicador muestra cuántos errores y advertencias tiene la página.

<GuideImage name="checking-designs/lint" alt="Una tarjeta de registro con texto tenue y pequeño y un botón pequeño, sus marcadores de problemas y el panel Revisar con contraste bajo, texto pequeño y un área táctil pequeña" />

- **Página** muestra todos los problemas de la página actual; **Selección** limita la lista a las capas seleccionadas y todo lo que contienen; **Documento** muestra los problemas de todas las páginas, marcando los que están en otras páginas. Al hacer clic en uno de ellos se cambia a su página. Las páginas de un archivo `.fig` grande que aún no se han abierto se revisan en cuanto las abres.
- Los problemas se agrupan por regla, empezando por los más graves. Los errores y las advertencias empiezan desplegados; las sugerencias empiezan plegadas.
- Los botones de gravedad bajo el selector de alcance muestran u ocultan los errores, las advertencias y las sugerencias.
- Pasa el puntero sobre el título de un grupo para leer qué revisa la regla y por qué.

Pasa el puntero sobre un problema para resaltar su capa en el lienzo. Haz clic en él para seleccionar la capa; si está fuera de la vista, el lienzo se desplaza hasta ella, y solo aleja el zoom cuando la capa no cabe.

## Corregir problemas

Las filas que se pueden corregir en un solo paso muestran un botón al pasar el puntero:

- Un color fijo que coincide con una de las variables de color del documento se vincula a ella (botón de enlace). La fila indica el nombre de la variable.
- Las posiciones y los tamaños con subpíxeles se redondean a píxeles enteros. Los valores que definen el auto-layout o el redimensionado del texto, las ilustraciones vectoriales y las partes de los grupos no se tocan.
- El radio de esquina y el espaciado fuera de escala cambian al valor más cercano de la escala, y el texto por debajo del tamaño mínimo crece hasta él (botón de varita). Esto cambia el diseño, así que se aplica fila a fila.
- Un grupo se convierte en un marco en su sitio, conservando sus capas, su posición y su aspecto (botón de marco), y una capa oculta se puede eliminar (botón de papelera). Ninguna de las dos opciones se ofrece para capas bloqueadas ni para capas dentro de un componente o una instancia, cuya estructura pertenece al componente.

Vincular colores y redondear píxeles mantiene el aspecto del diseño, así que sus grupos también ofrecen **Vincular las N** o **Corregir las N**. Cada corrección es un solo paso de deshacer.

Los demás problemas muestran el valor que requiere atención, como una relación de contraste o el tamaño de un área táctil, para que puedas corregirlos en el panel Diseño.

## Ver los problemas en el lienzo

Los marcadores del lienzo, los recuentos de las páginas y las marcas del panel Capas están desactivados hasta que los activas, así que un archivo abierto en un perfil nuevo no aparece lleno de advertencias. Actívalos o desactívalos con **Ver → Problemas de diseño**, o con **Mostrar problemas en el lienzo** en el menú de ajustes del panel Revisar. Un perfil que ya había guardado la elección la conserva.

Mientras están activados, las capas con errores y advertencias llevan un marcador en su esquina superior derecha: rojo para los errores y ámbar para las advertencias. Las sugerencias solo aparecen en el panel Revisar.

- Pasa el puntero sobre un marcador para ver sus problemas. Haz clic en él para seleccionar la capa y abrir sus problemas en el panel Revisar.
- Los marcadores que se superpondrían se fusionan en uno que muestra su recuento total.
- Cuando una capa es demasiado pequeña para verla con el zoom actual, su marcador pasa a la capa contenedora más cercana que sea lo bastante grande para señalarla.
- Los errores y las advertencias que quedan fuera de la parte visible del lienzo se fijan en su borde, apuntando hacia ellos. Pasa el puntero sobre una de esas marcas para verlos; haz clic en ella para mostrar el más cercano de los más graves y abrirlo en Revisar.
- Las capas ocultas y las que un marco recorta fuera de la vista conservan sus problemas en el panel, pero no tienen marcador.

Las páginas con errores o advertencias muestran su recuento en la lista de páginas, revisadas en segundo plano mientras trabajas. El panel Capas marca las mismas capas: una capa con errores o advertencias muestra el más grave como un icono, y una capa plegada con problemas en su interior muestra un punto. Esas marcas siguen el mismo interruptor que los marcadores del lienzo.

## Ver los problemas en el código

La pestaña Código subraya los errores y las advertencias en el Design JSX, HTML, Vue o React de sus capas, en la propiedad que causa el problema cuando la hay, como `size={10}` para un texto pequeño, o en la clase que da estilo a la capa. Pasa el puntero sobre el subrayado para leer el problema. La página se revisa mientras el panel Revisar está abierto o los marcadores del lienzo están activados, y los subrayados siguen esa revisión y tus ediciones.

## Elegir las reglas

El menú de ajustes del panel Revisar cambia entre conjuntos de reglas predefinidos:

- **Recomendadas** — valores equilibrados para el trabajo diario.
- **Estrictas** — todas las reglas como advertencia o error.
- **Accesibilidad** — solo contraste, tamaño del área táctil y tamaño del texto.

Desactiva una sola regla desde el menú de su grupo. **Activar N reglas desactivadas**, en el menú de ajustes, las recupera. Los conjuntos predefinidos y las reglas desactivadas se guardan entre sesiones.

Las mismas reglas se ejecutan desde la línea de comandos con `openpencil lint`; consulta [Inspeccionar archivos](/es/developers/cli/inspecting).
