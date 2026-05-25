import type { MenuEntry } from "@open-pencil/vue";

import { useEditorCommands, useI18n } from "@open-pencil/vue";
import { computed } from "vue";

import { useEditorStore } from "@/app/editor/active-store";
import { createSharedEditorMenuActions } from "@/app/shell/menu/editor-actions";
import type {
	AppMenuActionItem,
	AppMenuEntry,
	AppMenuGroupSchema,
} from "@/app/shell/menu/schema";
import { APP_MENU_SCHEMA } from "@/app/shell/menu/schema";
import { appMenuShortcutLabel } from "@/app/shell/menu/shortcut";
import { openFileDialog } from "@/app/shell/menu/use";
import { useAppTheme } from "@/app/shell/theme";

export interface AppMenuGroup {
	label: string;
	items: MenuEntry[];
}

function isVisible(entry: { target?: string }): boolean {
	return entry.target !== "native";
}

function isSeparator(
	entry: AppMenuEntry,
): entry is Extract<AppMenuEntry, { type: "separator" }> {
	return entry.type === "separator";
}

export function useAppMenu() {
	const store = useEditorStore();
	const { menuItem: commandMenuItem } = useEditorCommands();
	const { menu, locale, availableLocales, localeLabels, setLocale } = useI18n();
	const { theme, setTheme } = useAppTheme();

	const translatedMenuItemLabels: Partial<
		Record<string, keyof typeof menu.value>
	> = {
		new: "new",
		open: "open",
		save: "save",
		"save-as": "saveAs",
		"export-selection": "exportSelection",
		autosave: "autosave",
		close: "closeTab",
		copy: "copy",
		cut: "cut",
		paste: "paste",
		"paste-to-replace": "pasteToReplace",
		language: "language",
		profiler: "profiler",
		"toggle-ui": "toggleUI",
		theme: "theme",
		"theme-light": "themeLight",
		"theme-dark": "themeDark",
		"zoom-in": "zoomIn",
		"zoom-out": "zoomOut",
		"text.bold": "bold",
		"text.italic": "italic",
		"text.underline": "underline",
		"arrange.align-left": "arrangeAlignLeft",
		"arrange.align-center": "arrangeAlignCenter",
		"arrange.align-right": "arrangeAlignRight",
		"arrange.align-top": "arrangeAlignTop",
		"arrange.align-middle": "arrangeAlignMiddle",
		"arrange.align-bottom": "arrangeAlignBottom",
	};

	const languageMenu = computed<MenuEntry[]>(() =>
		availableLocales.map((code) => ({
			label: localeLabels[code],
			checked: locale.value === code,
			onCheckedChange: (checked: boolean) => {
				if (checked) setLocale(code);
			},
		})),
	);

	function exportSelection(format: "png" | "svg" | "fig") {
		if (store.state.selectedIds.size > 0) void store.exportSelection(1, format);
	}

	const actions: Partial<Record<string, () => void>> = {
		new: () => {
			void import("@/app/tabs").then((m) => m.createTab());
		},
		open: () => void openFileDialog(),
		save: () => void store.saveFigFile(),
		"save-as": () => void store.saveFigFileAs(),
		"export-selection": () => exportSelection("png"),
		cut: () => document.execCommand("cut"),
		"export-png": () => exportSelection("png"),
		"export-svg": () => exportSelection("svg"),
		"export-fig": () => exportSelection("fig"),
		...createSharedEditorMenuActions(setTheme),
	};

	function itemAction(item: AppMenuActionItem): (() => void) | undefined {
		return actions[item.id];
	}

	function checked(item: AppMenuActionItem): boolean | undefined {
		switch (item.id) {
			case "autosave":
				return store.state.autosaveEnabled;
			case "profiler":
				return store.renderer?.profiler.hudVisible ?? false;
			case "theme-light":
				return theme.value === "light";
			case "theme-dark":
				return theme.value === "dark";
			case "theme-auto":
				return theme.value === "auto";
			default:
				return undefined;
		}
	}

	function onCheckedChange(
		item: AppMenuActionItem,
	): ((checked: boolean) => void) | undefined {
		switch (item.id) {
			case "autosave":
				return (value: boolean) => {
					store.state.autosaveEnabled = value;
				};
			case "profiler":
				return () => store.toggleProfiler();
			case "theme-light":
			case "theme-dark":
			case "theme-auto":
				return (value: boolean) => {
					if (value) itemAction(item)?.();
				};
			default:
				return undefined;
		}
	}

	function menuLabel(entry: AppMenuActionItem): string {
		const key = translatedMenuItemLabels[entry.id];
		return key ? menu.value[key] : entry.label;
	}

	function buildEntry(entry: AppMenuEntry): MenuEntry | null {
		if (!isVisible(entry)) return null;
		if (isSeparator(entry)) return { separator: true };

		if (entry.id === "language") {
			return { label: menuLabel(entry), sub: languageMenu.value };
		}

		if (entry.command) {
			return commandMenuItem(entry.command, appMenuShortcutLabel(entry.id));
		}

		return {
			label: menuLabel(entry),
			shortcut: appMenuShortcutLabel(entry.id),
			action: itemAction(entry),
			checked: checked(entry),
			onCheckedChange: onCheckedChange(entry),
			sub: entry.sub
				?.map(buildEntry)
				.filter((item): item is MenuEntry => item !== null),
		};
	}

	function groupLabel(group: AppMenuGroupSchema): string {
		const key = group.label.toLowerCase() as keyof typeof menu.value;
		return menu.value[key] ?? group.label;
	}

	function buildGroup(group: AppMenuGroupSchema): AppMenuGroup | null {
		if (!isVisible(group)) return null;
		return {
			label: groupLabel(group),
			items: group.items
				.map(buildEntry)
				.filter((item): item is MenuEntry => item !== null),
		};
	}

	const topMenus = computed<AppMenuGroup[]>(() =>
		APP_MENU_SCHEMA.map(buildGroup).filter(
			(group): group is AppMenuGroup => group !== null,
		),
	);

	return { topMenus };
}
