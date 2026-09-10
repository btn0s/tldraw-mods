import type { ConfigScriptContext } from 'tldraw-offline/script-context'
import { DefaultContextMenu, DefaultContextMenuContent, DefaultToolbar, DefaultToolbarContent, TldrawUiMenuGroup, TldrawUiMenuItem, useEditor, useValue, type TLUiContextMenuProps } from 'tldraw'
import { mods } from './mods'
import { uiCss } from './ui'
// Compiled by the build's Tailwind plugin from src/styles/globals.css against the classes used under src/.
import tailwindCss from './styles/globals.css'

const css = `${tailwindCss}\n${uiCss}`
const tools = mods.flatMap(mod => mod.tool ? [mod.tool] : [])
const commands = mods.flatMap(mod => mod.commands ?? [])

// Mod tools follow tldraw's stock toolbar items.
function ModToolItem({ id, label, icon, kbd }: (typeof tools)[number]) {
	const editor = useEditor()
	const isSelected = useValue('current tool', () => editor.getCurrentToolId() === id, [editor, id])
	return <TldrawUiMenuItem id={id} label={label} kbd={kbd} icon={icon} isSelected={isSelected} onSelect={() => { editor.setCurrentTool(id) }} />
}

function Toolbar() {
	return (
		<>
			<style>{css}</style>
			<DefaultToolbar>
				<DefaultToolbarContent />
				{tools.map(tool => <ModToolItem key={tool.id} {...tool} />)}
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
