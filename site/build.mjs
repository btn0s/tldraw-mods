// Generates site/dist from ../registry.json: an index with search, one page per item, and (via shadcn build) r/<name>.json
// so the site doubles as a registry endpoint. Plain HTML and one stylesheet; no framework.
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = dirname(fileURLToPath(import.meta.url))
const root = join(site, '..')
const dist = join(site, 'dist')
const registry = JSON.parse(await readFile(join(root, 'registry.json'), 'utf8'))
const hub = registry.homepage.replace('https://github.com/', '')
// Shapes first; plumbing and the workspace last.
const rank = item => (item.categories ?? []).includes('shape') ? 0 : item.name === 'workspace' ? 2 : 1
registry.items.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const install = item => item.name === 'workspace' ? 'npx tldraw-mods init' : `npx tldraw-mods add ${item.name}`
const source = item => item.files?.[0] ? `${registry.homepage}/blob/main/${item.files[0].path}` : registry.homepage

const page = (title, body, depth = 0) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="${'../'.repeat(depth)}style.css"></head>
<body><header><a href="${'../'.repeat(depth) || './'}"><strong>tldraw-mods</strong></a><nav><a href="${registry.homepage}">GitHub</a><a href="${'../'.repeat(depth)}protocol/">Publish a mod</a></nav></header>
<main>${body}</main>
<footer>A <a href="https://ui.shadcn.com/docs/registry/github">shadcn GitHub registry</a> for <a href="https://github.com/tldraw/tldraw-offline">tldraw offline</a> document scripts. Not affiliated with tldraw.</footer>
</body></html>`

const card = item => `<li data-search="${esc(`${item.name} ${item.title} ${item.description} ${(item.categories ?? []).join(' ')}`.toLowerCase())}">
<a href="${item.name}/"><h2>${esc(item.title ?? item.name)}</h2></a>
<span class="label">${esc((item.categories ?? [item.type.replace('registry:', '')]).join(' · '))}</span>
<p>${esc(item.description)}</p>
<code>${esc(install(item))}</code></li>`

const index = page('tldraw-mods', `
<h1>Mods for tldraw offline</h1>
<p class="lede">Custom shapes, tools, and UI for <a href="https://github.com/tldraw/tldraw-offline">tldraw offline</a> documents. Install any of them into a document with one command.</p>
<pre><code>npx tldraw-mods init      # once per document workspace
npx tldraw-mods add landmark</code></pre>
<input id="q" type="search" placeholder="Search mods" aria-label="Search mods" autocomplete="off">
<ul id="mods">${registry.items.map(card).join('\n')}</ul>
<script>const q=document.getElementById('q'),items=[...document.querySelectorAll('#mods li')];q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();for(const li of items)li.hidden=v&&!li.dataset.search.includes(v)})</script>`)

const detail = item => page(`${item.title ?? item.name} · tldraw-mods`, `
<span class="label">${esc((item.categories ?? [item.type.replace('registry:', '')]).join(' · '))}</span>
<h1>${esc(item.title ?? item.name)}</h1>
<p class="lede">${esc(item.description)}</p>
<pre><code>${esc(install(item))}</code></pre>
<p class="alt">Or with the shadcn CLI: <code>npx shadcn@latest add ${esc(hub)}/${esc(item.name)}</code></p>
${item.docs ? `<h3>After install</h3><pre><code>${esc(item.docs)}</code></pre>` : ''}
<h3>Files</h3><ul class="plain">${(item.files ?? []).map(f => `<li><code>${esc(f.target ?? f.path)}</code></li>`).join('')}</ul>
${item.dependencies?.length ? `<h3>npm dependencies</h3><ul class="plain">${item.dependencies.map(d => `<li><code>${esc(d)}</code></li>`).join('')}</ul>` : ''}
${item.registryDependencies?.length ? `<h3>Registry dependencies</h3><ul class="plain">${item.registryDependencies.map(d => `<li><code>${esc(d)}</code></li>`).join('')}</ul>` : ''}
<p><a href="${source(item)}">Source</a> · <a href="../r/${esc(item.name)}.json">registry JSON</a></p>`, 1)

const protocol = page('Publish a mod · tldraw-mods', `
<h1>Publish a mod</h1>
<p class="lede">Mods live in your own repository. The hub is a catalog: it points at your registry, validates it nightly, and lists it here.</p>
<h3>1. Write the mod</h3>
<p>A mod is one file, <code>src/mods/&lt;name&gt;.tsx</code>, whose default export is tldraw offline's own config-script function. Optional named exports <code>tool</code> and <code>commands</code> put it in the toolbar and context menu.</p>
<pre><code>import type { ModConfig, ModTool } from '@/mod'
import { MyShapeTool, MyShapeUtil, myIcon } from './my-shape-impl'

export const tool: ModTool = { id: 'my-shape', label: 'My shape', icon: myIcon }
export default (({ config }) =&gt; {
  config.shapeUtils.push(MyShapeUtil)
  config.tools.push(MyShapeTool)
}) satisfies ModConfig</code></pre>
<p>Develop it inside a workspace made by <code>npx tldraw-mods init</code>; <code>npm run apply</code> loads it into the open document.</p>
<h3>2. Add registry.json to your repo root</h3>
<pre><code>{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "my-mods",
  "homepage": "https://github.com/you/my-mods",
  "items": [{
    "name": "my-shape",
    "type": "registry:component",
    "title": "My shape",
    "description": "One sentence.",
    "dependencies": ["lucide-react"],
    "registryDependencies": ["${esc(hub)}/tool-chrome"],
    "files": [{ "path": "src/mods/my-shape.tsx", "type": "registry:component", "target": "~/src/mods/my-shape.tsx" }]
  }]
}</code></pre>
<ul>
<li>Targets are explicit <code>~/src/mods/…</code> paths so relative imports keep working.</li>
<li>Never list <code>tldraw</code>, <code>react</code>, or <code>react-dom</code> as dependencies; the app provides them.</li>
<li>Run <code>npx shadcn@latest registry validate</code> before pushing.</li>
</ul>
<p>At this point anyone can install it: <code>npx tldraw-mods add you/my-mods/my-shape</code>.</p>
<h3>3. List it here</h3>
<p>Open a pull request on <a href="${registry.homepage}">${esc(hub)}</a> adding a pointer item to <code>registry.json</code>:</p>
<pre><code>{ "name": "my-shape", "type": "registry:component", "title": "My shape", "description": "One sentence.",
  "categories": ["shape"], "registryDependencies": ["you/my-mods/my-shape"], "files": [] }</code></pre>
<p>CI validates your registry on every PR and nightly; a broken upstream is flagged, not silently dropped.</p>`, 1)

const css = `
:root{--bg:#f5f5f5;--fg:#0f0f0f;--muted:#6a6a6a;--well:#ececec;--line:#dcdcdc;--font:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
@media(prefers-color-scheme:dark){:root{--bg:#0f0f0f;--fg:#f5f5f5;--muted:#9a9a9a;--well:#1a1a1a;--line:#282828}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 var(--font);-webkit-font-smoothing:antialiased}
a{color:inherit}header,main,footer{max-width:760px;margin:0 auto;padding:0 20px}
header{display:flex;justify-content:space-between;align-items:center;height:56px}header a{text-decoration:none}nav a{margin-left:16px;color:var(--muted)}
h1{font-size:28px;letter-spacing:-.01em;margin:24px 0 8px}h2{font-size:17px;margin:0}h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-family:var(--mono);margin:24px 0 8px}
.lede{color:var(--muted);margin:0 0 20px}.label{font:11px var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
code{font:13px var(--mono)}pre{background:var(--well);border-radius:10px;padding:12px 14px;overflow:auto;box-shadow:inset 0 1px 2px rgba(0,0,0,.08)}p>code,li>code,li code{background:var(--well);padding:2px 6px;border-radius:4px}
input{width:100%;font:inherit;padding:10px 14px;border:0;border-radius:10px;background:var(--well);color:inherit;box-shadow:inset 0 1px 2px rgba(0,0,0,.08);margin:8px 0 20px}input:focus{outline:none}
#mods{list-style:none;padding:0;margin:0;display:grid;gap:12px}#mods li{padding:16px;border-radius:10px;border:1px solid var(--line);display:grid;gap:6px}#mods li a{text-decoration:none}#mods li p{margin:0;color:var(--muted)}#mods li code{background:var(--well);padding:4px 8px;border-radius:6px;justify-self:start}
ul.plain{list-style:none;padding:0;margin:0}.alt{color:var(--muted)}footer{color:var(--muted);font-size:13px;padding:40px 20px}
`

await rm(dist, { recursive: true, force: true })
await mkdir(join(dist, 'protocol'), { recursive: true })
await writeFile(join(dist, 'index.html'), index)
await writeFile(join(dist, 'style.css'), css.trim())
await writeFile(join(dist, 'protocol/index.html'), protocol)
for (const item of registry.items) {
	await mkdir(join(dist, item.name), { recursive: true })
	await writeFile(join(dist, item.name, 'index.html'), detail(item))
}
execFileSync('npx', ['--yes', 'shadcn@4.21.0', 'build', '-o', join(dist, 'r')], { cwd: root, stdio: 'inherit' })
console.log(`site: ${registry.items.length} items → ${dist}`)
