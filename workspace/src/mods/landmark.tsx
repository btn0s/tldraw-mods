import { MapPin } from 'lucide-react'
import type { ModCommand, ModConfig, ModTool } from '@/mod'
import { Group2d, HTMLContainer, Rectangle2d, ShapeUtil, T, createShapeId, resizeBox, useValue, type Editor, type RecordProps, type TLBaseShape, type TLResizeInfo } from 'tldraw'
import { cn } from '@/lib/utils'
import { EditingBoxShapeTool, ToolChromeField, useShapeEditing } from '@/tool-chrome'

// The chip keeps a constant screen size, like a frame heading, so a landmark stays readable when zoomed out.
const chipHeight = 28
const chipGap = 6
const chipPadding = 8 + 14 + 6 + 10 // left pad, pin, gap, right pad
const labelFont = '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Helvetica,Arial,sans-serif'
const placeholder = 'Landmark'
const defaultSize = { w: 480, h: 320 }
// Generous: the outline must clear tool chrome floating outside wrapped shapes (browser URL pill, image prompt) and leave room for the chip.
const selectionPadding = 120

export interface LandmarkProps { w: number; h: number; label: string }
declare module '@tldraw/tlschema' { interface TLGlobalShapePropsMap { landmark: LandmarkProps } }
export type LandmarkShape = TLBaseShape<'landmark', LandmarkProps>

export const landmarkIcon = <MapPin size={24} aria-hidden />

// Wrap the selection (or the viewport centre when nothing is selected) and start naming it.
export function createLandmark(editor: Editor) {
	if (editor.getIsReadonly()) return
	const selection = editor.getSelectionPageBounds()
	const viewport = editor.getViewportPageBounds()
	const box = selection
		? { x: selection.x - selectionPadding, y: selection.y - selectionPadding, w: selection.w + selectionPadding * 2, h: selection.h + selectionPadding * 2 }
		: { x: viewport.midX - defaultSize.w / 2, y: viewport.midY - defaultSize.h / 2, ...defaultSize }
	const id = createShapeId()
	editor.markHistoryStoppingPoint('create landmark')
	editor.createShape({ id, type: 'landmark', x: box.x, y: box.y, props: { w: box.w, h: box.h, label: '' } })
	editor.sendToBack([id])
	editor.select(id)
	editor.setEditingShape(id)
}

const widths = new WeakMap<LandmarkProps, number>()
function chipWidth(editor: Editor, shape: LandmarkShape) {
	let width = widths.get(shape.props)
	if (width === undefined) {
		width = editor.textMeasure.measureText(shape.props.label || placeholder, {
			fontFamily: labelFont, fontSize: 12, fontWeight: '500', fontStyle: 'normal', lineHeight: 1, maxWidth: null, padding: '0px',
		}).w + chipPadding
		widths.set(shape.props, width)
	}
	return width
}

function LandmarkShapeView({ shape, editor }: { shape: LandmarkShape; editor: Editor }) {
	const { editing, readonly, finish } = useShapeEditing(editor, shape)
	const zoom = useValue('landmark zoom', () => editor.getEfficientZoomLevel(), [editor])

	return (
		<HTMLContainer className="overflow-visible font-sans text-xs/none font-medium text-foreground antialiased" style={{ width: shape.props.w, height: shape.props.h }}>
			<svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
				<rect width={shape.props.w} height={shape.props.h} className="fill-none stroke-foreground/45 [stroke-dasharray:6_4] [stroke-width:1] [vector-effect:non-scaling-stroke]" />
			</svg>
			<form
				className={cn('pointer-events-none absolute bottom-full left-0 box-border flex origin-bottom-left items-center gap-1.5 whitespace-nowrap rounded-full pr-2.5 pl-2 text-foreground', editing ? 'pointer-events-auto bg-well shadow-well' : 'bg-key shadow-key')}
				style={{ height: chipHeight, transform: `scale(${1 / zoom}) translateY(${-chipGap}px)` }}
				onPointerDown={editing ? (event) => event.stopPropagation() : undefined}
				onSubmit={(event) => { event.preventDefault(); finish() }}
			>
				<MapPin className="shrink-0" size={14} aria-hidden />
				{editing ? (
					<ToolChromeField
						className="after:min-h-7 after:p-0 after:leading-7" controlClassName="min-h-7 p-0 leading-7"
						value={shape.props.label} placeholder={placeholder} aria-label="Landmark name" maxLength={200} disabled={readonly}
						focus={!readonly} selectOnFocus onEscape={finish}
						onChange={(event) => editor.updateShape({ id: shape.id, type: 'landmark', props: { label: event.currentTarget.value } })}
					/>
				) : <span className={shape.props.label ? undefined : 'text-muted-foreground'}>{shape.props.label || placeholder}</span>}
			</form>
		</HTMLContainer>
	)
}

export class LandmarkShapeUtil extends ShapeUtil<LandmarkShape> {
	static override type = 'landmark' as const
	static override props: RecordProps<LandmarkShape> = { w: T.number, h: T.number, label: T.string }
	getDefaultProps(): LandmarkProps { return { ...defaultSize, label: '' } }
	override canEdit() { return true }
	override canResize() { return true }
	override hideRotateHandle() { return true }
	override getText(shape: LandmarkShape) { return shape.props.label }
	// Frame-like hit-testing reaches the chip outside the bounds and needs full-brush selection; children are never accepted, so nothing reparents into a landmark.
	override isFrameLike() { return true }
	getGeometry(shape: LandmarkShape) {
		const z = this.editor.getEfficientZoomLevel()
		return new Group2d({ children: [
			new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false }),
			new Rectangle2d({ x: 0, y: -(chipHeight + chipGap) / z, width: chipWidth(this.editor, shape) / z, height: chipHeight / z, isFilled: true, isLabel: true, excludeFromShapeBounds: true }),
		] })
	}
	component(shape: LandmarkShape) { return <LandmarkShapeView shape={shape} editor={this.editor} /> }
	override getIndicatorPath(shape: LandmarkShape) {
		const path = new Path2D()
		path.rect(0, 0, shape.props.w, shape.props.h)
		return path
	}
	override onResize(shape: LandmarkShape, info: TLResizeInfo<LandmarkShape>) { return resizeBox(shape, info, { minWidth: 40, minHeight: 40 }) }
	override toSvg(shape: LandmarkShape) {
		return (
			<g fill="none" stroke="#8a8a8a">
				<rect width={shape.props.w} height={shape.props.h} strokeWidth={1} strokeDasharray="6 4" />
				{shape.props.label ? <text x={0} y={-chipGap} fill="#8a8a8a" stroke="none" fontFamily="Inter, sans-serif" fontSize={12} fontWeight={500}>{shape.props.label}</text> : null}
			</g>
		)
	}
}

export class LandmarkShapeTool extends EditingBoxShapeTool {
	static override id = 'landmark'
	static override initial = 'idle'
	override shapeType = 'landmark' as const
}

export const tool: ModTool = { id: 'landmark', label: 'Landmark', icon: landmarkIcon }
export const commands: ModCommand[] = [{ id: 'create-landmark', label: 'Create landmark', icon: landmarkIcon, run: createLandmark }]
export default (({ config }) => {
	config.shapeUtils.push(LandmarkShapeUtil)
	config.tools.push(LandmarkShapeTool)
}) satisfies ModConfig
