import type { ModConfig } from '@/mod'
import strip from '@/toolbar-strip'

// Cell order in assets/icons/toolbar-strip.png (128px cells, left to right). Only the main tool row gets the art pass;
// quick actions keep tldraw's icons and the More button uses lucide, so the trailing cells are unused.
const cells = ['select', 'hand', 'draw', 'eraser', 'arrow', 'text', 'note', 'asset', 'rectangle', 'undo', 'redo', 'delete', 'duplicate', 'more']
const tools = ['select', 'hand', 'draw', 'eraser', 'arrow', 'text', 'note', 'asset', 'rectangle']

const buttons = tools.map(id => `[data-testid="tools.${id}"]`)
const selector = buttons.map(b => `${b} .tlui-icon`).join(',')
const positions = tools.map(id => `[data-testid="tools.${id}"] .tlui-icon { background-position:calc(var(--sprite-cell) * -${cells.indexOf(id)}) 0; }`).join('\n')

// Replace tldraw's masked monochrome glyphs with the rendered 3D sprite; the inline mask style needs !important.
export const toolbarIconsCss = `
${selector} { --sprite-cell:32px; mask:none !important; -webkit-mask:none !important; background:url(${strip}) 0 0 / calc(var(--sprite-cell) * ${cells.length}) var(--sprite-cell) no-repeat; width:var(--sprite-cell); height:var(--sprite-cell); filter:drop-shadow(0 1px 1px #00000055); transition:transform 120ms ease; }
${positions}
${buttons.map(b => `${b}:hover:not(:disabled) .tlui-icon`).join(',')} { transform:scale(1.12); }
${buttons.map(b => `${b}[data-isactive=true] .tlui-icon`).join(',')} { transform:scale(1.15); }
@media (prefers-reduced-motion:reduce) { ${selector} { transition:none; transform:none !important; } }
`

// Rendered 3D icons for the main toolbar buttons, in place of tldraw's flat glyphs.
export default (({ config }) => {
	const Previous = config.components.InFrontOfTheCanvas
	config.components.InFrontOfTheCanvas = () => <>{Previous ? <Previous /> : null}<style>{toolbarIconsCss}</style></>
}) satisfies ModConfig
