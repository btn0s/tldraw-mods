import { useState, type FormEvent, type SyntheticEvent } from 'react'
import { Monitor, PanelsTopLeft, RotateCw, Smartphone, Tablet } from 'lucide-react'
import type { ModConfig, ModTool } from '@/mod'
import { HTMLContainer, Rectangle2d, ShapeUtil, T, resizeBox, type Editor, type RecordProps, type TLBaseShape, type TLResizeInfo } from 'tldraw'
import { cn } from '@/lib/utils'
import { EditingBoxShapeTool, ToolChrome, ToolChromeField, ToolChromeGroup, useShapeEditing } from '@/tool-chrome'

// The preset fold is state- and index-driven (delays per key via --i) and lives here as CSS; everything else is Tailwind.
// Symmetric margins instead of gap: folded keys take their spacing with them, so the lone active key stays centered.
const foldCss = `
.browser-presets { --fold-out:cubic-bezier(.22,1,.36,1); --fold-in:cubic-bezier(.4,0,.2,1); }
.browser-presets .ui-key { overflow:hidden; margin:0 2px; scale:1; transition:width 240ms var(--fold-in) 140ms,margin 240ms var(--fold-in) 140ms,opacity 160ms ease 140ms,scale 240ms var(--fold-in) 140ms,transform 120ms ease,background 90ms ease,box-shadow 90ms ease; }
.browser-presets[data-collapsed=true]:not(:hover,:focus-within) .ui-key:not([aria-pressed=true]) { width:0; margin:0; opacity:0; scale:.6; pointer-events:none; }
.browser-presets[data-collapsed=true]:is(:hover,:focus-within) .ui-key { transition:width 360ms var(--fold-out) calc(var(--i) * 30ms),margin 360ms var(--fold-out) calc(var(--i) * 30ms),opacity 220ms ease calc(var(--i) * 30ms),scale 360ms var(--fold-out) calc(var(--i) * 30ms),transform 120ms ease,background 90ms ease,box-shadow 90ms ease; }
@media (hover:none),(pointer:coarse) { .browser-presets[data-collapsed=true] .ui-key:not([aria-pressed=true]) { width:32px; margin:0 2px; opacity:1; scale:1; pointer-events:auto; } }
@media (prefers-reduced-motion:reduce) { .browser-presets .ui-key { transition:none !important; } }
`

export interface BrowserProps { w: number; h: number; url: string }
declare module '@tldraw/tlschema' { interface TLGlobalShapePropsMap { browser: BrowserProps } }
export type BrowserShape = TLBaseShape<'browser', BrowserProps>

// Accept web addresses, never executable or local-file schemes.
export function normalizeUrl(value: string) {
	const input = value.trim()
	if (!input) throw new Error('Enter a web address.')
	const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input)
	const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#]|$)/i.test(input)
	const hasHostPort = /^[\w.-]+:\d+([/?#]|$)/.test(input)
	const url = new URL(isLocal ? `http://${input}` : hasScheme && !hasHostPort ? input : `https://${input}`)
	if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
		throw new Error('Use an http:// or https:// address.')
	}
	if (url.username || url.password) throw new Error('Use an address without embedded credentials.')
	return url.href
}

const stop = (event: SyntheticEvent) => event.stopPropagation()
const viewportPresets = [
	{ name: 'Phone', w: 390, h: 844, Icon: Smartphone },
	{ name: 'Tablet', w: 768, h: 1024, Icon: Tablet },
	{ name: 'Desktop', w: 1440, h: 900, Icon: Monitor },
]

function BrowserShapeView({ shape, editor }: { shape: BrowserShape; editor: Editor }) {
	const { editing, readonly, dark, finish } = useShapeEditing(editor, shape)
	const [reload, setReload] = useState(0)
	// The address bar holds a draft until Enter; a change to the saved URL discards it.
	const [draft, setDraft] = useState({ url: shape.props.url, value: shape.props.url })
	const address = draft.url === shape.props.url ? draft.value : shape.props.url
	let url = ''
	try { if (shape.props.url) url = normalizeUrl(shape.props.url) } catch { /* Invalid imported URLs stay inert. */ }

	function navigate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (readonly) return
		const input = event.currentTarget.elements.namedItem('url') as HTMLInputElement
		try {
			const next = normalizeUrl(input.value)
			editor.markHistoryStoppingPoint('Navigate browser')
			editor.updateShape({ id: shape.id, type: 'browser', props: { url: next } })
			input.setCustomValidity('')
			if (next === url) setReload((n) => n + 1)
		} catch (err) {
			input.setCustomValidity(err instanceof TypeError ? 'Enter a valid web address.' : (err as Error).message)
			input.reportValidity()
		}
	}

	const collapsed = viewportPresets.some(preset => shape.props.w === preset.w && shape.props.h === preset.h)
	return (
		<HTMLContainer className="overflow-visible rounded-none bg-card text-foreground shadow-[0_0_0_1px_#00000014] antialiased" style={{ width: shape.props.w, height: shape.props.h, colorScheme: dark ? 'dark' : 'light' }}>
			<style>{foldCss}</style>
			{url ? (
				<iframe
					key={`${url}:${reload}`} src={url} title={`Browser: ${url}`} className={cn('browser-frame block size-full border-0 bg-card', editing ? 'pointer-events-auto' : 'pointer-events-none')}
					sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-presentation"
					referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen"
					tabIndex={editing ? 0 : -1} onPointerDown={stop}
				/>
			) : null}
			{!editing && url ? <div className="absolute inset-0" title="Double-click to browse. Click the canvas to finish." /> : null}
			<ToolChrome top={[
				<ToolChromeGroup key="address" as="form" className="min-w-0 max-w-[min(360px,100%)] flex-[0_1_auto] pl-2.5" onSubmit={navigate}>
					{/* A page that is already loaded keeps editing for the iframe; only an empty browser wants the address bar. */}
					<ToolChromeField
						name="url" value={address} placeholder="Enter URL…" aria-label="Browser address" disabled={readonly}
						focus={editing && !url && !readonly} onEscape={finish}
						onChange={(event) => { event.currentTarget.setCustomValidity(''); setDraft({ url: shape.props.url, value: event.currentTarget.value }) }}
					/>
					<button type="button" className="ui-icon-button" title="Reload page" aria-label="Reload page" disabled={!url} onClick={() => setReload((n) => n + 1)}>
						<RotateCw size={18} aria-hidden />
					</button>
				</ToolChromeGroup>,
				// With a preset active the group folds down to that one button and unfolds on hover or focus.
				<ToolChromeGroup key="presets" className="browser-presets shrink-0 gap-0" role="group" aria-label="Viewport presets" data-collapsed={collapsed}>
					{viewportPresets.map(({ name, w, h, Icon }, index) => (
						<button
							key={name} type="button" className="ui-key ui-icon-button" style={{ '--i': index }}
							title={`${name} · ${w} × ${h}`} aria-label={`${name} viewport`}
							aria-pressed={shape.props.w === w && shape.props.h === h} disabled={readonly}
							onClick={() => {
								editor.markHistoryStoppingPoint('Change browser viewport')
								editor.updateShape({ id: shape.id, type: 'browser', props: { w, h } })
							}}
						>
							<Icon size={18} aria-hidden />
						</button>
					))}
				</ToolChromeGroup>,
			]} />
		</HTMLContainer>
	)
}

export class BrowserShapeUtil extends ShapeUtil<BrowserShape> {
	static override type = 'browser' as const
	static override props: RecordProps<BrowserShape> = { w: T.number, h: T.number, url: T.string }
	getDefaultProps(): BrowserShape['props'] { return { w: 900, h: 640, url: '' } }
	override canEdit() { return true }
	override canResize() { return true }
	override hideRotateHandle() { return true }
	override getAriaDescriptor(shape: BrowserShape) { return `Browser: ${shape.props.url || 'empty'}` }
	getGeometry(shape: BrowserShape) { return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true }) }
	component(shape: BrowserShape) { return <BrowserShapeView shape={shape} editor={this.editor} /> }
	override getIndicatorPath(shape: BrowserShape) {
		const path = new Path2D()
		path.rect(0, 0, shape.props.w, shape.props.h)
		return path
	}
	override onResize(shape: BrowserShape, info: TLResizeInfo<BrowserShape>) { return resizeBox(shape, info, { minWidth: 320, minHeight: 200 }) }
}

export class BrowserShapeTool extends EditingBoxShapeTool {
	static override id = 'browser'
	static override initial = 'idle'
	override shapeType = 'browser' as const
}

export const tool: ModTool = { id: 'browser', label: 'Browser', icon: <PanelsTopLeft size={24} aria-hidden /> }
export default (({ config }) => {
	config.shapeUtils.push(BrowserShapeUtil)
	config.tools.push(BrowserShapeTool)
}) satisfies ModConfig
