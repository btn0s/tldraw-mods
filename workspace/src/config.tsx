import type { ConfigScriptContext } from 'tldraw-offline/script-context'
import { ArrowDownToolbarItem, ArrowLeftToolbarItem, ArrowRightToolbarItem, ArrowToolbarItem, ArrowUpToolbarItem, AssetToolbarItem, CheckBoxToolbarItem, CloudToolbarItem, DefaultContextMenu, DefaultContextMenuContent, DefaultToolbar, DiamondToolbarItem, DrawToolbarItem, EllipseToolbarItem, EraserToolbarItem, FrameToolbarItem, HandToolbarItem, HeartToolbarItem, HexagonToolbarItem, HighlightToolbarItem, LaserToolbarItem, LineToolbarItem, NoteToolbarItem, OvalToolbarItem, RectangleToolbarItem, RhombusToolbarItem, SelectToolbarItem, StarToolbarItem, TextToolbarItem, TldrawUiMenuGroup, TldrawUiMenuItem, TriangleToolbarItem, XBoxToolbarItem, useEditor, useValue, type TLUiContextMenuProps } from 'tldraw'
import { mods } from './mods'
import { uiCss } from './ui'
// Compiled by the build's Tailwind plugin from src/styles/globals.css against the classes used under src/.
import tailwindCss from './styles/globals.css'

const css = `${tailwindCss}\n${uiCss}`
const tools = mods.flatMap(mod => mod.tool ? [mod.tool] : [])
const commands = mods.flatMap(mod => mod.commands ?? [])

// tldraw's stock toolbar, with mod tools placed after the everyday items so they stay in the visible band instead of the overflow drawer.
const before = [SelectToolbarItem, HandToolbarItem, DrawToolbarItem, EraserToolbarItem, ArrowToolbarItem, TextToolbarItem, NoteToolbarItem, AssetToolbarItem, RectangleToolbarItem]
const after = [EllipseToolbarItem, TriangleToolbarItem, DiamondToolbarItem, HexagonToolbarItem, OvalToolbarItem, RhombusToolbarItem, StarToolbarItem, CloudToolbarItem, HeartToolbarItem, XBoxToolbarItem, CheckBoxToolbarItem, ArrowLeftToolbarItem, ArrowUpToolbarItem, ArrowDownToolbarItem, ArrowRightToolbarItem, LineToolbarItem, HighlightToolbarItem, LaserToolbarItem, FrameToolbarItem]

function ModToolItem({ id, label, icon, kbd }: (typeof tools)[number]) {
	const editor = useEditor()
	const isSelected = useValue('current tool', () => editor.getCurrentToolId() === id, [editor, id])
	return <TldrawUiMenuItem id={id} label={label} kbd={kbd} icon={icon} isSelected={isSelected} onSelect={() => { editor.setCurrentTool(id) }} />
}

function Toolbar() {
	return (
		<>
			<style>{css}</style>
			{/* The visible band grows with the mods so they never fall into the overflow drawer. */}
			<DefaultToolbar maxItems={before.length + tools.length} maxSizePx={(before.length + tools.length) * 50}>
				{before.map(Item => <Item key={Item.name} />)}
				{tools.map(tool => <ModToolItem key={tool.id} {...tool} />)}
				{after.map(Item => <Item key={Item.name} />)}
			</DefaultToolbar>
		</>
	)
}

function ContextMenu(props: TLUiContextMenuProps) {
	const editor = useEditor()
	const readonly = useValue('readonly', () => editor.getIsReadonly(), [editor])
	const visible = commands.filter(command => command.readonlyOk || !readonly)
	return (
		<DefaultContextMenu {...props}>
			{visible.length > 0 && (
				<TldrawUiMenuGroup id="mods">
					{visible.map(command => <TldrawUiMenuItem key={command.id} id={command.id} label={command.label} onSelect={() => command.run(editor)} />)}
				</TldrawUiMenuGroup>
			)}
			<DefaultContextMenuContent />
		</DefaultContextMenu>
	)
}

export default async function (ctx: ConfigScriptContext) {
	for (const mod of mods) {
		const partial = await mod.default(ctx)
		if (partial) ctx.config = { ...ctx.config, ...partial }
	}
	ctx.config.components = { ...ctx.config.components, Toolbar, ContextMenu }
	return ctx.config
}
