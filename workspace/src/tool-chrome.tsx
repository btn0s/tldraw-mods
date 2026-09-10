import { useEffect, useRef, type ChangeEvent, type ComponentPropsWithoutRef, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import { BaseBoxShapeTool, useValue, type Editor, type StateNode, type TLShape, type TLShapeId, type TLStateNodeConstructor } from 'tldraw'
import { cn } from '@/lib/utils'

const stop = (event: SyntheticEvent) => event.stopPropagation()
const sides = ['top', 'right', 'bottom', 'left'] as const
type Side = (typeof sides)[number]

// Each edge sits 8 canvas units outside the frame; top/bottom lay controls out in a row, left/right in a column.
const edgeClass: Record<Side, string> = {
	top: 'left-0 w-full flex-row bottom-[calc(100%+8px)]',
	bottom: 'left-0 w-full flex-row top-[calc(100%+8px)]',
	left: 'top-0 h-full flex-col right-[calc(100%+8px)]',
	right: 'top-0 h-full flex-col left-[calc(100%+8px)]',
}

export interface ShapeEditing {
	editing: boolean
	readonly: boolean
	dark: boolean
	/** Leave editing: back to the select tool with the canvas focused. */
	finish(): void
}

// Editing state every custom shape reads, plus the one way to leave editing.
export function useShapeEditing(editor: Editor, shape: { id: TLShapeId }): ShapeEditing {
	const editing = useValue('shape editing', () => editor.getEditingShapeId() === shape.id, [editor, shape.id])
	const readonly = useValue('shape readonly', () => editor.getInstanceState().isReadonly || editor.isShapeOrAncestorLocked(shape.id), [editor, shape.id])
	const dark = useValue('shape theme', () => editor.user.getUserPreferences().isDarkMode, [editor])
	function finish() {
		editor.setEditingShape(null)
		editor.setCurrentTool('select')
		editor.focus()
	}
	return { editing, readonly, dark, finish }
}

type TextControl = HTMLInputElement | HTMLTextAreaElement

export interface ToolChromeFieldProps extends Omit<ComponentPropsWithoutRef<'input'>, 'onChange' | 'value' | 'onKeyDown'> {
	value: string
	/** The control's own classes (padding, line-height); the span's `className` sizes the field. */
	controlClassName?: string
	onChange?: (event: ChangeEvent<TextControl>) => void
	/** A textarea that grows with its content instead of a single-line input. */
	multiline?: boolean
	/** Take focus while true. */
	focus?: boolean
	/** Also select the text on focus, for renames. */
	selectOnFocus?: boolean
	/** 'enter' submits the form on Enter (Shift+Enter breaks a line when multiline); 'mod-enter' submits on ⌘/Ctrl+Enter and lets Enter break lines. */
	submit?: 'enter' | 'mod-enter'
	onEscape?: () => void
}

// The one text field for shape chrome. Controlled; sizes to its content; keeps keys away from the canvas.
export function ToolChromeField({ multiline = false, focus = false, selectOnFocus = false, submit = 'enter', onEscape, className, controlClassName, value, placeholder, ...props }: ToolChromeFieldProps) {
	const control = useRef<TextControl>(null)
	useEffect(() => {
		if (!focus) return
		control.current?.focus()
		if (selectOnFocus) control.current?.select()
	}, [focus, selectOnFocus])
	function onKeyDown(event: KeyboardEvent<TextControl>) {
		event.stopPropagation()
		if (event.nativeEvent.isComposing) return
		if (event.key === 'Escape') { event.preventDefault(); onEscape?.() }
		else if (event.key === 'Enter') {
			const submits = submit === 'mod-enter' ? event.metaKey || event.ctrlKey : !(multiline && event.shiftKey)
			if (submits) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
		}
	}
	// A hidden mirror of the text (::after) sizes the grid cell; the control fills it. Single-line fields grow in width, multiline in height.
	const shared = {
		value, placeholder, autoComplete: 'off', spellCheck: false, ...props, onKeyDown,
		className: cn('[grid-area:1/1] box-border h-full min-h-8 w-full min-w-0 resize-none overflow-auto border-0 bg-transparent px-1 py-[7px] text-inherit text-ellipsis outline-0 select-text [font:inherit] leading-[18px] placeholder:text-muted-foreground', controlClassName),
	}
	return (
		<span
			className={cn('relative inline-grid min-w-0 max-w-full items-center after:invisible after:[grid-area:1/1] after:px-1 after:py-[7px] after:[font:inherit] after:leading-[18px] after:whitespace-pre after:content-[attr(data-value)_"_"]', multiline && 'max-h-26 after:whitespace-pre-wrap after:[overflow-wrap:anywhere]', className)}
			data-value={value || placeholder || ''}
		>
			{multiline
				? <textarea ref={control as React.RefObject<HTMLTextAreaElement>} rows={1} {...(shared as ComponentPropsWithoutRef<'textarea'>)} />
				: <input ref={control as React.RefObject<HTMLInputElement>} {...(shared as ComponentPropsWithoutRef<'input'>)} />}
		</span>
	)
}

// Slots follow the frame's bounds without changing its geometry or exported content.
export function ToolChrome(slots: Partial<Record<Side, ReactNode>>) {
	return (
		<>
			{sides.map(side => slots[side] ? (
				<div key={side} className={cn('pointer-events-none absolute flex items-center justify-between gap-3', edgeClass[side])} onPointerDown={stop} onPointerUp={stop} onDoubleClick={stop} onKeyDown={stop} onKeyUp={stop}>
					{slots[side]}
				</div>
			) : null)}
		</>
	)
}

export interface ToolChromeGroupProps extends ComponentPropsWithoutRef<'form'> {
	as?: 'div' | 'form'
	/** 'panel' for a raised control strip, 'well' for a group that holds a text field. */
	surface?: 'panel' | 'well'
}

// Shape chrome is always the pill variant. Both elements accept the same attribute set; the form's types are the superset.
export function ToolChromeGroup({ as = 'div', surface = 'panel', className = '', children, ...props }: ToolChromeGroupProps) {
	const Tag = as as 'div'
	return <Tag {...(props as ComponentPropsWithoutRef<'div'>)} className={cn(`ui-${surface} ui-round pointer-events-auto flex min-h-10 [flex-direction:inherit] items-center gap-0.5 p-1`, className)}>{children}</Tag>
}

// A box tool whose new shape opens for editing at once, so its input can take focus and the user keeps typing.
// BaseBoxShapeTool only reports drag-created shapes through onCreate; click placement finishes inside Pointing,
// whose `complete()` the SDK does not declare.
interface PointingConstructor extends Omit<TLStateNodeConstructor, 'children'> {
	new (editor: Editor, parent?: StateNode): StateNode & { complete(): void }
}
const [BoxIdle, BoxPointing] = BaseBoxShapeTool.children() as unknown as [TLStateNodeConstructor, PointingConstructor]
class EditingPointing extends BoxPointing {
	override complete() {
		super.complete()
		const shape = this.editor.getOnlySelectedShape()
		if (shape?.type === (this.parent as BaseBoxShapeTool).shapeType) this.editor.setEditingShape(shape.id)
	}
}

export abstract class EditingBoxShapeTool extends BaseBoxShapeTool {
	static override children(): TLStateNodeConstructor[] { return [BoxIdle, EditingPointing] }
	// The editor's page-state side effect moves the select tool into editing.
	override onCreate(shape: TLShape | null) { if (shape) this.editor.setEditingShape(shape.id) }
}
