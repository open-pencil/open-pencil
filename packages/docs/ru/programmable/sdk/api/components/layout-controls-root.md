---
title: LayoutControlsRoot
description: Компонент без встроенного оформления для автоматической компоновки и режимов размера.
---

<script setup lang="ts">
import { data } from '#docs-api/components/layout-controls-root.data'
</script>

# LayoutControlsRoot

`LayoutControlsRoot` передаёт через слот набор данных и действий `useLayout()`. Используйте его как переиспользуемую основу собственных элементов управления компоновкой.

Поля ширины и высоты могут оставаться редактируемыми, когда соответствующая ось использует Hug или Fill. При первом фактическом изменении числа `updateAxisSize()` записывает смену режима и переводит только эту ось в Fixed.

Если режим размера, удаление привязки и числовое значение должны сохраняться или отменяться одной операцией, объедините поле с `BindableValue` и поставщиком, поддерживающим пакет взаимодействия. Получение фокуса и открытие выбора не меняют режим размера.

Для меню размера вызывайте `setAxisSizing('width', mode)` или `setAxisSizing('height', mode)`. Прежние функции для каждой оси не входят в текущий набор API.

## Сгенерированный справочник API

Таблицы извлекаются из исходного кода Vue и JSDoc во время сборки документации.

<SdkComponentAPI :components="data.components" />

## См. также

- [useLayout](../composables/use-layout)
- [BindableValue](/programmable/sdk/api/components/bindable-value)
- [Панели свойств](../../guides/property-panels)
