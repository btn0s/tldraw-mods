import { ChevronUp, Monitor, Moon, Sun } from 'lucide-react'
import { ArrowToolbarItem, AssetToolbarItem, DefaultContextMenu, DefaultContextMenuContent, DefaultToolbar, DrawToolbarItem, EraserToolbarItem, HandToolbarItem, NoteToolbarItem, RectangleToolbarItem, SelectToolbarItem, TextToolbarItem, TldrawUiMenuGroup, TldrawUiMenuItem, useDialogs, useEditor, type TLUiContextMenuProps } from 'tldraw'
import { installed, type ModConfig } from '@/mod'
import { CommandBar, toggleCommandBar, type Palette, type PaletteCommand } from '@/command-bar'

// A short toolbar and a ⌘K command bar. The toolbar keeps ten everyday buttons and a "More tools" button; every other
// tool, including the ones other mods add, is reached through the command bar. It also lists named landmarks on every
// page, editor preferences, and a light/dark/system switch, and mirrors mod commands into the right-click menu.

const preferenceCommands: PaletteCommand[] = [
	{ id: 'theme-light', label: 'Set theme to Light', icon: <Sun size={18} aria-hidden />, readonlyOk: true, run(editor, trackEvent) { editor.user.updateUserPreferences({ colorScheme: 'light' }); trackEvent?.('color-scheme', { source: 'dialog', value: 'light' }) } },
	{ id: 'theme-dark', label: 'Set theme to Dark', icon: <Moon size={18} aria-hidden />, readonlyOk: true, run(editor, trackEvent) { editor.user.updateUserPreferences({ colorScheme: 'dark' }); trackEvent?.('color-scheme', { source: 'dialog', value: 'dark' }) } },
	{ id: 'theme-system', label: 'Set theme to System', icon: <Monitor size={18} aria-hidden />, readonlyOk: true, run(editor, trackEvent) { editor.user.updateUserPreferences({ colorScheme: 'system' }); trackEvent?.('color-scheme', { source: 'dialog', value: 'system' }) } },
]
const preferenceActionIds = ['toggle-snap-mode', 'toggle-tool-lock', 'toggle-grid', 'toggle-wrap-mode', 'toggle-focus-mode', 'toggle-edge-scrolling', 'toggle-dynamic-size-mode', 'toggle-paste-at-cursor', 'toggle-debug-mode']

// Built once, after config.tsx has filled `installed`; identity must stay stable for the ⌘K listener.
const palette: Palette = {
	personalTools: installed.tools,
	commands: installed.commands,
	preferenceCommands,
	preferenceActionIds,
}

function MoreToolsItem() {
	const dialogs = useDialogs()
	return <TldrawUiMenuItem id="more" label="More tools" kbd="$k" icon={<ChevronUp size={24} aria-hidden />} readonlyOk onSelect={() => toggleCommandBar(dialogs, palette)} />
}

const toolbarItems = [SelectToolbarItem, HandToolbarItem, DrawToolbarItem, EraserToolbarItem, ArrowToolbarItem, TextToolbarItem, NoteToolbarItem, AssetToolbarItem, RectangleToolbarItem, MoreToolsItem]

function Toolbar() {
	return (
		<DefaultToolbar maxItems={toolbarItems.length} maxSizePx={toolbarItems.length * 50}>
			{toolbarItems.map(Item => <Item key={Item.name} />)}
		</DefaultToolbar>
	)
}

function ContextMenu(props: TLUiContextMenuProps) {
	const editor = useEditor()
	function run(command: PaletteCommand) {
		// tldraw does not expose Radix's onCloseAutoFocus; cancel the menu's focus return so the command can focus a shape input.
		editor.getContainer().querySelector('[data-testid="context-menu"]')?.addEventListener('focusScope.autoFocusOnUnmount', event => event.preventDefault(), { once: true })
		command.run(editor)
	}
	return (
		<DefaultContextMenu {...props}>
			{palette.commands.length > 0 && (
				<TldrawUiMenuGroup id="mods">
					{palette.commands.map(command => <TldrawUiMenuItem key={command.id} id={command.id} label={command.label} onSelect={() => run(command)} />)}
				</TldrawUiMenuGroup>
			)}
			<DefaultContextMenuContent />
		</DefaultContextMenu>
	)
}

export default (({ config }) => {
	const Previous = config.components.InFrontOfTheCanvas
	config.components = {
		...config.components,
		Toolbar,
		ContextMenu,
		InFrontOfTheCanvas: () => <>{Previous ? <Previous /> : null}<CommandBar palette={palette} /></>,
	}
}) satisfies ModConfig
