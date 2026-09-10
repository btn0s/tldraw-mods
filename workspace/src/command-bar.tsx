import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { MapPin, Search, ToggleRight } from 'lucide-react'
import { TldrawUiDialogTitle, TldrawUiIcon, TldrawUiKbd, unwrapLabel, useActions, useDialogs, useEditor, useIsToolSelected, useTools, useTranslation, useUiEvents, useValue, type Editor, type TLPageId, type TLShapeId, type TLUiActionItem, type TLUiDialogsContextType, type TLUiEventHandler, type TLUiToolItem } from 'tldraw'

import type { ModCommand, ModTool } from '@/mod'

/** A tool a mod adds; `icon` is a rendered element rather than a tldraw icon name. */
export type PersonalTool = ModTool & { readonlyOk?: boolean }
/** An editor action offered in the palette. */
export interface PaletteCommand extends ModCommand { run(editor: Editor, trackEvent?: TLUiEventHandler): void }
export interface Palette { personalTools: PersonalTool[]; commands: PaletteCommand[]; preferenceCommands: PaletteCommand[]; preferenceActionIds: string[] }

interface Landmark { entryType: 'landmark'; id: TLShapeId; pageId: TLPageId; label: string; page: string; sort: string; readonlyOk: true }
type ToolEntry = (TLUiToolItem | (PersonalTool & { onSelect(source: string): void })) & { entryType: 'tool' }
type ActionEntry = Omit<TLUiActionItem, 'label'> & { entryType: 'action'; label: string }
type Entry = PaletteCommand | Landmark | ToolEntry | ActionEntry
const isLandmark = (entry: Entry): entry is Landmark => 'entryType' in entry && entry.entryType === 'landmark'
const isCommand = (entry: Entry): entry is PaletteCommand => 'run' in entry
const isAction = (entry: Entry): entry is ActionEntry => 'entryType' in entry && entry.entryType === 'action'

const dialogId = 'personal-tool-search'
// Only tldraw's dialog frame is addressed by selector; everything of ours is Tailwind.
const css = `
.tlui-dialog__content:has(.tool-search) { padding:0; overflow:hidden; max-width:calc(100vw - 40px); }
.tlui-dialog__positioner:has(.tool-search) { align-items:start; padding-top:min(18vh,160px); }
`
const landmarkIcon = <MapPin size={18} aria-hidden />

function Option({ command, hint, ...props }: { command: Entry; hint?: string } & Omit<ComponentPropsWithoutRef<'li'>, 'children'>) {
	return (
		<li role="option" className="ui-option group" {...props}>
			<span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground group-aria-selected:text-foreground [&_svg]:size-4">
				{isLandmark(command) ? landmarkIcon : typeof command.icon === 'string' ? <TldrawUiIcon icon={command.icon} label={command.label} /> : command.icon}
			</span>
			<span className="flex-1 truncate">{command.label}</span>
			{hint ? <span className="ui-label inline-flex items-center gap-1.5 before:size-1 before:rounded-full before:bg-current before:content-['']">{hint}</span> : null}
			{'kbd' in command && command.kbd ? <TldrawUiKbd>{command.kbd}</TldrawUiKbd> : null}
		</li>
	)
}

function ToolOption({ command, ...props }: { command: ToolEntry } & Omit<ComponentPropsWithoutRef<'li'>, 'children'>) {
	const selected = useIsToolSelected(command as TLUiToolItem)
	return <Option command={command} hint={selected ? 'Active' : ''} {...props} />
}

// Named landmarks on every page; the current page lists first so nearby landmarks stay at the top.
function useLandmarks(editor: Editor): Landmark[] {
	return useValue('command bar landmarks', () => {
		const currentPageId = editor.getCurrentPageId()
		const landmarks: Landmark[] = []
		for (const page of editor.getPages()) {
			const onCurrentPage = page.id === currentPageId
			for (const id of editor.getPageShapeIds(page)) {
				const shape = editor.getShape(id)
				if (!shape || shape.type !== 'landmark') continue
				const name = shape.props.label.trim()
				landmarks.push({ entryType:'landmark', id, pageId:page.id, label:name || 'Landmark', page:onCurrentPage ? '' : page.name, sort:`${onCurrentPage ? 0 : 1}${name || '\uffff'}`, readonlyOk:true })
			}
		}
		return landmarks.sort((a, b) => a.sort.localeCompare(b.sort))
	}, [editor])
}

function goToLandmark(editor: Editor, landmark: Landmark) {
	if (landmark.pageId !== editor.getCurrentPageId()) editor.setCurrentPage(landmark.pageId)
	const bounds = editor.getShapePageBounds(landmark.id)
	if (!bounds) return
	editor.select(landmark.id)
	editor.zoomToBounds(bounds, { inset:64, targetZoom:1, animation:{ duration:320 } })
}

function ToolSearch({ personalTools, commands: personalCommands, preferenceCommands, preferenceActionIds, onClose }: Palette & { onClose(): void }) {
	const editor = useEditor()
	const actions = useActions()
	const tools = useTools()
	const msg = useTranslation()
	const trackEvent = useUiEvents()
	const readonly = useValue('command bar readonly', () => editor.getIsReadonly(), [editor])
	const landmarks = useLandmarks(editor)
	const [query, setQuery] = useState('')
	const [activeId, setActiveId] = useState<string | null>(null)
	const input = useRef<HTMLInputElement>(null)
	const list = useRef<HTMLDivElement>(null)
	const listId = useId()
	const term = query.trim().toLocaleLowerCase()
	const matches = (command: Entry) => (!readonly || command.readonlyOk) && `${command.label} ${isLandmark(command) ? command.page : ''} ${command.id}`.toLocaleLowerCase().includes(term)
	const preferenceActions = preferenceActionIds.flatMap((id): ActionEntry[] => {
		const action = actions[id]
		if (!action) return []
		const labelKey = unwrapLabel(action.label, 'default') ?? unwrapLabel(action.label, 'menu')
		return [{ ...action, entryType:'action', label:labelKey ? msg(labelKey) : id.replaceAll('-', ' '), icon:action.icon ?? <ToggleRight size={18} aria-hidden /> }]
	})
	const groups: { heading: string; items: Entry[] }[] = [
		{ heading:'Commands', items:[...personalCommands, ...preferenceActions, ...preferenceCommands].filter(matches) },
		{ heading:'Landmarks', items:landmarks.filter(matches) },
		{ heading:'Tools', items:[
			...personalTools.map((tool): ToolEntry => ({ ...tool, entryType:'tool', onSelect: () => editor.setCurrentTool(tool.id) })),
			...Object.values(tools).map((tool): ToolEntry => {
				const label = msg(tool.label)
				return { ...tool, entryType:'tool', label:label === tool.label ? tool.id[0].toUpperCase() + tool.id.slice(1).replaceAll('-', ' ') : label }
			}),
		].filter(matches) },
	].filter(group => group.items.length)
	const commands = groups.flatMap(group => group.items)
	const activeIndex = Math.max(0, commands.findIndex(command => command.id === activeId))
	const active = commands[activeIndex]
	useEffect(() => { input.current?.focus() }, [])
	useEffect(() => {
		list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block:'nearest' })
	}, [active?.id])

	function choose(command: Entry | undefined) {
		if (!command) return
		onClose()
		editor.complete()
		editor.setEditingShape(null)
		if (isCommand(command)) {
			// Focus the canvas before running: a command may hand focus to a shape's input.
			editor.focus()
			command.run(editor, trackEvent)
			return
		}
		if (isLandmark(command)) goToLandmark(editor, command)
		// Use native actions and tools so preference persistence, analytics, and tool defaults stay intact.
		else command.onSelect('dialog')
		editor.focus()
	}

	function navigate(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === 'Tab' || (event.target !== input.current && event.key !== 'Escape')) return
		event.stopPropagation()
		if (event.nativeEvent.isComposing) return
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			if (commands.length) setActiveId(commands[(activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length]!.id)
		} else if (event.key === 'Enter') {
			event.preventDefault()
			choose(active)
		} else if (event.key === 'Escape') {
			event.preventDefault()
			onClose()
		}
	}

	return (
		<div className="tool-search w-[min(560px,calc(100vw-42px))] font-sans text-[13px]/[1.4] antialiased" onKeyDown={navigate}>
			<style>{css}</style>
			<TldrawUiDialogTitle className="sr-only">Search commands, landmarks, and tools</TldrawUiDialogTitle>
			<div className="ui-well m-2 flex h-12 items-center gap-2.5 rounded-md pr-2 pl-3">
				<Search className="shrink-0 text-muted-foreground" size={18} strokeWidth={1.75} aria-hidden />
				<input
					ref={input} className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-inherit caret-foreground outline-0 [font:inherit] placeholder:text-muted-foreground" role="combobox" aria-label="Search commands, landmarks, and tools" aria-expanded aria-autocomplete="list"
					aria-controls={listId} aria-activedescendant={active ? `${listId}-${activeIndex}` : undefined}
					placeholder="Search commands, landmarks, and tools…" value={query} autoComplete="off" spellCheck={false}
					onChange={event => { setQuery(event.currentTarget.value); setActiveId(null) }}
				/>
				<button type="button" className="ui-key ui-kbd h-5 px-1.5 tracking-[.06em] text-muted-foreground uppercase hover:text-foreground" aria-label="Close command bar" onClick={onClose}>esc</button>
			</div>
			<div className="relative">
				<div ref={list} id={listId} role="listbox" aria-label="Commands, landmarks, and tools" className="m-0 h-[min(336px,calc(100dvh-260px))] overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-color:var(--ui-line)_transparent] [scrollbar-width:thin]">
					{groups.map(group => {
						const offset = commands.indexOf(group.items[0]!)
						return (
							<div key={group.heading} role="group" aria-label={group.heading} className="[&+&]:mt-1">
								<div className="ui-label flex h-7 items-center justify-between px-2.5"><span>{group.heading}</span><span>{group.items.length}</span></div>
								<ul className="m-0 list-none p-0">
									{group.items.map((command, i) => {
										const index = offset + i
										const shared = {
											id: `${listId}-${index}`, 'aria-selected': index === activeIndex,
											onPointerMove: () => setActiveId(command.id), onPointerDown: (event: PointerEvent) => event.preventDefault(), onClick: () => choose(command),
										}
										return isLandmark(command) || isCommand(command) || isAction(command)
											? <Option key={command.id} command={command} hint={isLandmark(command) ? command.page : undefined} {...shared} />
											: <ToolOption key={command.id} command={command} {...shared} />
									})}
								</ul>
							</div>
						)
					})}
				</div>
				{!commands.length ? <div className="ui-label absolute inset-0 grid place-content-center p-5 text-center" role="status">No matching commands, landmarks, or tools</div> : null}
			</div>
			<div className="ui-rule-top flex h-9 items-center justify-between gap-3 px-4 text-[11px] text-muted-foreground">
				<span className="flex items-center gap-[5px]"><kbd className="ui-key ui-kbd">↑</kbd><kbd className="ui-key ui-kbd">↓</kbd>Navigate</span>
				<span className="flex items-center gap-[5px]">{active && (isCommand(active) || isAction(active)) ? 'Run command' : active && isLandmark(active) ? 'Go to landmark' : 'Switch tool'}<kbd className="ui-key ui-kbd">↵</kbd></span>
			</div>
		</div>
	)
}

export function toggleCommandBar({ addDialog, removeDialog, dialogs }: TLUiDialogsContextType, palette: Palette) {
	if (dialogs.get().some(dialog => dialog.id === dialogId)) {
		removeDialog(dialogId)
	} else if (!dialogs.get().length) {
		addDialog({ id: dialogId, component: props => <ToolSearch {...props} {...palette} /> })
	}
}

// Keep `palette` identity stable so the shortcut listener is not re-bound.
export function CommandBar({ palette }: { palette: Palette }) {
	const dialogApi = useDialogs()
	const { removeDialog, dialogs } = dialogApi
	useEffect(() => {
		function handleShortcut(event: globalThis.KeyboardEvent) {
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.code !== 'KeyK' || event.isComposing) return
			event.preventDefault()
			event.stopImmediatePropagation()
			if (event.repeat) return
			toggleCommandBar(dialogApi, palette)
		}
		window.addEventListener('keydown', handleShortcut, true)
		return () => {
			window.removeEventListener('keydown', handleShortcut, true)
			if (dialogs.get().some(dialog => dialog.id === dialogId)) removeDialog(dialogId)
		}
	}, [dialogApi, removeDialog, dialogs, palette])
	return null
}
