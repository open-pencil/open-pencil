---
title: Componentes
description: Componentes reutilizables, instancias, conjuntos, sustituciones y bibliotecas.
---

# Componentes

Los componentes son objetos reutilizables. Los cambios del componente principal se propagan automáticamente a sus instancias.

## Explorar e insertar

La pestaña **Recursos** muestra componentes locales y bibliotecas habilitadas. Permite buscar y alternar entre cuadrícula y lista. Inserta un componente con un clic, <kbd>Enter</kbd> o arrastrándolo al lienzo. Las revisiones descargadas siguen disponibles sin conexión.

## Crear un componente

Selecciona un marco o grupo y pulsa <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>; en Windows y Linux, <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>K</kbd>.

## Crear una instancia

Selecciona el componente y elige **Crear instancia**, o insértalo desde Recursos. La instancia conserva un vínculo con el componente principal.

## Sustituciones

Las propiedades modificadas en una instancia se guardan como sustituciones. Los cambios posteriores del componente principal siguen llegando, excepto en las propiedades sustituidas.

## Propiedades de componente

Se admiten texto, visibilidad booleana, intercambio de instancia y variantes. Las propiedades aparecen en el panel derecho al seleccionar una instancia.

## Conjuntos y variantes

Combina componentes con <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> o <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>K</kbd>. Cada dimensión de variante —por ejemplo, estado o tamaño— puede tener varios valores. OpenPencil admite combinaciones dispersas, impide duplicados y usa como predeterminada la variante situada arriba a la izquierda.

## Sincronización

Los cambios del componente principal se muestran en una revisión antes de aplicarse. Las sustituciones de la instancia permanecen intactas. **Ir al componente principal** funciona también entre páginas, y **Separar instancia** convierte la instancia en un marco independiente.

## Bibliotecas

Publica componentes locales como biblioteca y habilita bibliotecas externas en Recursos. Las revisiones se almacenan localmente para trabajar sin conexión.
