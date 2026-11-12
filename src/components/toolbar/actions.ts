import { computed } from 'vue'
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line'
import IconArrowUpToLine from '~icons/lucide/arrow-up-to-line'
import IconClipboard from '~icons/lucide/clipboard'
import IconCopy from '~icons/lucide/copy'
import IconCopyPlus from '~icons/lucide/copy-plus'
import IconGroup from '~icons/lucide/group'
import IconLock from '~icons/lucide/lock'
import IconScissors from '~icons/lucide/scissors'
import IconTrash2 from '~icons/lucide/trash-2'
import IconUngroup from '~icons/lucide/ungroup'

import { useEditorCommands } from '@open-pencil/vue/editor/commands'
import { useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import type { ToolbarActionItem } from '@/components/toolbar/types'

/** The phone toolbar's edit and arrange pages: clipboard, duplicate, delete, order, group, lock. */
export function useToolbarActions() {
  const store = useEditorStore()
  const { getCommand } = useEditorCommands()
  const { menu } = useI18n()
  const editActions = computed<ToolbarActionItem[]>(() => [
    { icon: IconCopy, label: menu.value.copy, action: () => void store.mobileCopy() },
    { icon: IconClipboard, label: menu.value.paste, action: () => void store.mobilePaste() },
    { icon: IconScissors, label: menu.value.cut, action: () => void store.mobileCut() },
    {
      icon: IconCopyPlus,
      label: getCommand('selection.duplicate').label,
      action: () => getCommand('selection.duplicate').run()
    },
    {
      icon: IconTrash2,
      label: getCommand('selection.delete').label,
      action: () => getCommand('selection.delete').run()
    }
  ])

  const arrangeActions = computed<ToolbarActionItem[]>(() => [
    {
      icon: IconArrowUpToLine,
      label: menu.value.front,
      action: () => getCommand('selection.bringToFront').run()
    },
    {
      icon: IconArrowDownToLine,
      label: menu.value.back,
      action: () => getCommand('selection.sendToBack').run()
    },
    {
      icon: IconGroup,
      label: getCommand('selection.group').label,
      action: () => getCommand('selection.group').run()
    },
    {
      icon: IconUngroup,
      label: getCommand('selection.ungroup').label,
      action: () => getCommand('selection.ungroup').run()
    },
    {
      icon: IconLock,
      label: menu.value.lock,
      action: () => getCommand('selection.toggleLock').run()
    }
  ])

  return { editActions, arrangeActions }
}
