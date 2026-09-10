// Generates site/dist from ../registry.json: an index with search, one page per item, and (via shadcn build) r/<name>.json
// so the site doubles as a registry endpoint. Plain HTML and one stylesheet; no framework.
import { execFileSync } from 'node:child_process'
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = dirname(fileURLToPath(import.meta.url))
const root = join(site, '..')
const dist = join(site, 'dist')
const registry = JSON.parse(await readFile(join(root, 'registry.json'), 'utf8'))
const hub = registry.homepage.replace('https://github.com/', '')
const origin = 'https://tldrawmods.dev'
// Shapes first; plumbing and the workspace last.
const rank = item => (item.categories ?? []).includes('shape') ? 0 : 1
registry.items.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const install = item => item.name === 'workspace' ? 'npx tldraw-mods init' : `npx tldraw-mods add ${item.name}`
const exists = path => access(path).then(() => true, () => false)
// A clip for an item: site/media/<name>.{mp4,webm,jpg} recorded by record.mjs, or meta.video (an mp4 URL) for pointer items.
async function clip(item) {
	if (item.meta?.video) return { mp4: item.meta.video, poster: item.meta.poster }
	if (await exists(join(site, 'media', `${item.name}.mp4`))) return { mp4: `media/${item.name}.mp4`, webm: `media/${item.name}.webm`, poster: `media/${item.name}.jpg` }
	return null
}
const video = (c, depth = 0) => c ? `<video autoplay muted loop playsinline preload="none" width="960" height="600" poster="${'../'.repeat(depth)}${esc(c.poster ?? '')}" aria-hidden>${c.webm ? `<source src="${'../'.repeat(depth)}${esc(c.webm)}" type="video/webm">` : ''}<source src="${'../'.repeat(depth)}${esc(c.mp4)}" type="video/mp4"></video>` : ''
const source = item => item.files?.[0] ? `${registry.homepage}/blob/main/${item.files[0].path}` : registry.homepage

const css = `
:root{--bg:#f5f5f5;--fg:#0f0f0f;--muted:#6a6a6a;--well:#ececec;--line:#dcdcdc;--font:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
@media(prefers-color-scheme:dark){:root{--bg:#0f0f0f;--fg:#f5f5f5;--muted:#9a9a9a;--well:#1a1a1a;--line:#282828}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 var(--font);-webkit-font-smoothing:antialiased}
a{color:inherit}header,main,footer{max-width:760px;margin:0 auto;padding:0 20px}
header{display:flex;justify-content:space-between;align-items:center;height:56px}header a{text-decoration:none}nav a{margin-left:16px;color:var(--muted)}
h1{font-size:28px;letter-spacing:-.01em;margin:24px 0 8px}h2{font-size:17px;margin:0}h2.sub{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-family:var(--mono);margin:24px 0 8px}
.lede{color:var(--muted);margin:0 0 20px}.label{font:11px var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
code{font:13px var(--mono)}pre{background:var(--well);border-radius:10px;padding:12px 14px;overflow:auto;box-shadow:inset 0 1px 2px rgba(0,0,0,.08)}p>code,li>code,li code{background:var(--well);padding:2px 6px;border-radius:4px}
input{width:100%;font:inherit;padding:10px 14px;border:0;border-radius:10px;background:var(--well);color:inherit;box-shadow:inset 0 1px 2px rgba(0,0,0,.08);margin:8px 0 20px}input:focus{outline:none}
#mods{list-style:none;padding:0;margin:0;display:grid;gap:12px}#mods li{padding:16px;border-radius:10px;border:1px solid var(--line);display:grid;gap:6px}video{width:100%;height:auto;aspect-ratio:16/10;border-radius:6px;background:var(--well);display:block;margin-bottom:6px}main>video{border-radius:10px;margin:0 0 20px}@media(prefers-reduced-motion:reduce){video{display:none}}#mods li a{text-decoration:none}#mods li p{margin:0;color:var(--muted)}#mods li code{background:var(--well);padding:4px 8px;border-radius:6px;justify-self:start}
details{margin:0 0 8px;padding:12px 16px;border:1px solid var(--line);border-radius:10px}summary{cursor:pointer;font-weight:600}details ol{padding-left:20px}details li{margin:6px 0}
ul.plain{list-style:none;padding:0;margin:0}.alt{color:var(--muted)}footer{color:var(--muted);font-size:13px;padding:40px 20px}
`

const favicon = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0f0f0f"/><rect x="7" y="7" width="18" height="18" rx="2" fill="none" stroke="#f5f5f5" stroke-width="2" stroke-dasharray="4 3"/></svg>')}`
const page = (title, body, { depth = 0, path = '', description, image = 'media/og.png', jsonld, preload } = {}) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${origin}/${path}"><link rel="icon" href="${favicon}">${preload ? `<link rel="preload" as="image" href="${'../'.repeat(depth)}${esc(preload)}">` : ''}<meta name="theme-color" content="#0f0f0f">
<meta property="og:type" content="website"><meta property="og:site_name" content="tldraw-mods"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${origin}/${path}"><meta property="og:image" content="${origin}/${esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${origin}/${esc(image)}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
<style>${css.trim()}</style></head>
<body><header><a href="${'../'.repeat(depth) || './'}"><strong>tldraw-mods</strong></a><nav><a href="${registry.homepage}">GitHub</a><a href="${'../'.repeat(depth)}protocol/">Share your own</a></nav></header>
<main>${body}</main>
<footer>Add-ons for the <a href="https://offline.tldraw.com">tldraw offline</a> app, installed with the <a href="https://ui.shadcn.com/docs/cli">shadcn CLI</a>. Not affiliated with tldraw.</footer>
</body></html>`

const card = (item, c) => `<li data-search="${esc(`${item.name} ${item.title} ${item.description} ${(item.categories ?? []).join(' ')}`.toLowerCase())}">
${video(c)}<a href="${item.name}/"><h2>${esc(item.title ?? item.name)}</h2></a>
<span class="label">${esc((item.categories ?? [item.type.replace('registry:', '')]).join(' · '))}</span>
<p>${esc(item.description)}</p>
<code>${esc(install(item))}</code></li>`

const clips = Object.fromEntries(await Promise.all(registry.items.map(async item => [item.name, await clip(item)])))
// The front page lists what a user would add on purpose: shapes, tools, and UI. Setup and shared code stay installable but unlisted.
const listed = registry.items.filter(item => (item.categories ?? []).some(c => ['shape', 'tool', 'ui'].includes(c)))
const cards = listed.map(item => card(item, clips[item.name]))
const description = 'New shapes and tools for the tldraw offline app. Install any of them into a drawing with one command: npx tldraw-mods add <name>.'
const index = page('tldraw-mods: new shapes and tools for tldraw offline', `
<h1>Mods for tldraw offline</h1>
<p class="lede">New shapes and tools for the <a href="https://offline.tldraw.com">tldraw offline</a> app. Pick one, run one command, and it is in your drawing.</p>
<pre><code>npx tldraw-mods init
npx tldraw-mods add landmark</code></pre>
<details><summary>How to use</summary>
<p>You need the <a href="https://offline.tldraw.com">tldraw offline</a> app and Node.js 20 or newer. Mods go into one drawing at a time; the <code>.tldraw</code> file carries them, and the app runs them whenever the file is opened.</p>
<ol>
<li><strong>Make a folder and save your drawing in it.</strong> <code>mkdir my-canvas &amp;&amp; cd my-canvas</code>, then in the app File → New and File → Save into that folder.</li>
<li><strong>Set up the folder</strong>, once: <code>npx tldraw-mods init</code>. Downloads the build files and installs what they need.</li>
<li><strong>Add mods</strong> while the drawing is open: <code>npx tldraw-mods add landmark</code>. The mod is downloaded, built, put into the open drawing, and saved. The new tool shows up after the rectangle tool.</li>
<li><strong>Later:</strong> <code>list</code> shows what you can add, <code>remove browser</code> takes one out, <code>apply</code> reloads after you change files yourself. The mods stay inside the <code>.tldraw</code> file wherever it goes; the folder is only for adding and removing.</li>
</ol>
<p>Drawing saved somewhere else? <code>npx tldraw-mods add landmark --doc=/path/to/file.tldraw</code>. Mods from other repos work too: <code>npx tldraw-mods add owner/repo/name</code>. Only install mods from people you trust; a mod is code that runs with the app's permissions every time the drawing is opened.</p>
</details>
<input id="q" type="search" placeholder="Search mods" aria-label="Search mods" autocomplete="off">
<ul id="mods">${cards.join('\n')}</ul>
<script>const q=document.getElementById('q'),items=[...document.querySelectorAll('#mods li')];q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();for(const li of items)li.hidden=v&&!li.dataset.search.includes(v)})</script>`, {
	description,
	jsonld: { '@context': 'https://schema.org', '@graph': [
		{ '@type': 'WebSite', name: 'tldraw-mods', url: origin, description },
		{ '@type': 'SoftwareApplication', name: 'tldraw-mods', applicationCategory: 'DeveloperApplication', operatingSystem: 'macOS, Windows, Linux', url: origin, downloadUrl: 'https://www.npmjs.com/package/tldraw-mods', softwareRequirements: 'tldraw offline, Node.js 20', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
		{ '@type': 'ItemList', itemListElement: listed.map((item, i) => ({ '@type': 'ListItem', position: i + 1, url: `${origin}/${item.name}/`, name: item.title ?? item.name })) },
	] },
})

const detail = item => page(`${item.title ?? item.name} · tldraw-mods`, `
<span class="label">${esc((item.categories ?? [item.type.replace('registry:', '')]).join(' · '))}</span>
<h1>${esc(item.title ?? item.name)}</h1>
<p class="lede">${esc(item.description)}</p>
${video(clips[item.name], 1)}
<pre><code>${esc(install(item))}</code></pre>
<p class="alt">Without the tldraw-mods command: <code>npx shadcn@latest add ${esc(hub)}/${esc(item.name)}</code></p>
${item.docs ? `<h2 class="sub">After installing</h2><pre><code>${esc(item.docs)}</code></pre>` : ''}
<h2 class="sub">Files it adds</h2><ul class="plain">${(item.files ?? []).map(f => `<li><code>${esc((f.target ?? f.path).replace(/^~\//, ''))}</code></li>`).join('')}</ul>
${item.dependencies?.length ? `<h2 class="sub">Packages it installs</h2><ul class="plain">${item.dependencies.map(d => `<li><code>${esc(d)}</code></li>`).join('')}</ul>` : ''}
${item.registryDependencies?.length ? `<h2 class="sub">Other mods it needs</h2><ul class="plain">${item.registryDependencies.map(d => `<li><code>${esc(d)}</code></li>`).join('')}</ul>` : ''}
<p><a href="${source(item)}">Source code</a> · <a href="../r/${esc(item.name)}.json">Install manifest</a></p>`, {
	depth: 1, path: `${item.name}/`, description: item.description, image: clips[item.name]?.poster ?? 'media/og.png',
	jsonld: { '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: item.title ?? item.name, description: item.description, url: `${origin}/${item.name}/`, codeRepository: source(item), programmingLanguage: 'TypeScript', runtimePlatform: 'tldraw offline', isPartOf: { '@type': 'WebSite', name: 'tldraw-mods', url: origin } },
})

const protocol = page('Share your own mod · tldraw-mods', `
<h1>Share your own mod</h1>
<p class="lede">Your mod stays in your own GitHub repo. This site only keeps a list that points at it, checks every night that it still installs, and shows it on the front page.</p>
<h2 class="sub">1. Write the mod</h2>
<p>A mod is one file, <code>src/mods/&lt;name&gt;.tsx</code>. Its default export is a function that gets the app's setup object and adds to it: a shape class, a tool class, whatever you need. It is the same function the app already uses for its own <code>config.js</code>. Two optional exports, <code>tool</code> and <code>commands</code>, add a toolbar button and right-click menu entries.</p>
<pre><code>import type { ModConfig, ModTool } from '@/mod'
import { MyShapeTool, MyShapeUtil, myIcon } from './my-shape-impl'

export const tool: ModTool = { id: 'my-shape', label: 'My shape', icon: myIcon }
export default (({ config }) =&gt; {
  config.shapeUtils.push(MyShapeUtil)
  config.tools.push(MyShapeTool)
}) satisfies ModConfig</code></pre>
<p>Write it inside a folder made by <code>npx tldraw-mods init</code>, with a drawing saved there and open in the app. <code>npm run apply</code> puts your work into the drawing so you can try it.</p>
<h2 class="sub">2. Add a registry.json to the root of your repo</h2>
<p>This file tells the installer what to download and where to put it.</p>
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
<li><code>target</code> is where the file lands in the user's folder. Keep it under <code>~/src/mods/</code> so the build finds it.</li>
<li>Do not list <code>tldraw</code>, <code>react</code>, or <code>react-dom</code> under <code>dependencies</code>. The app already has them, and installing a second copy breaks things.</li>
<li>Run <code>npx shadcn@latest registry validate</code> in your repo before you push. It checks the file and that everything it names exists.</li>
</ul>
<p>Once pushed, anyone can install it: <code>npx tldraw-mods add you/my-mods/my-shape</code>.</p>
<h2 class="sub">3. Get it listed here</h2>
<p>Open a pull request on <a href="${registry.homepage}">${esc(hub)}</a> that adds an entry to <code>registry.json</code> pointing at yours:</p>
<pre><code>{ "name": "my-shape", "type": "registry:component", "title": "My shape", "description": "One sentence.",
  "categories": ["shape"], "registryDependencies": ["you/my-mods/my-shape"], "files": [],
  "meta": { "video": "https://…/my-shape.mp4", "poster": "https://…/my-shape.jpg" } }</code></pre>
<p><code>meta.video</code> is optional: a short silent mp4 (16:10, about 10 seconds) that loops on your card. Link to a file in your repo through raw.githubusercontent.com, or to a release asset.</p>
<p>The check that runs on every pull request and every night installs from your repo. If that stops working, the entry is marked broken rather than removed.</p>`, { depth: 1, path: 'protocol/', description: 'How to publish a mod for tldraw offline from your own GitHub repo and get it listed on tldrawmods.dev.' })


await rm(dist, { recursive: true, force: true })
await mkdir(join(dist, 'protocol'), { recursive: true })
await writeFile(join(dist, 'index.html'), index)
const pages = ['', 'protocol/', ...registry.items.map(item => `${item.name}/`)]
await writeFile(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `<url><loc>${origin}/${p}</loc></url>`).join('\n')}\n</urlset>\n`)
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`)
// For agents: everything on the site in one plain file, plus the JSON install manifests.
await writeFile(join(dist, 'llms.txt'), `# tldraw-mods

> ${description}

Site: ${origin}. Source: ${registry.homepage}. Not affiliated with tldraw.

## How to use

1. Make a folder, save a .tldraw drawing in it (File > New, File > Save in the tldraw offline app), and cd into it.
2. npx tldraw-mods init
3. With the drawing open in the app: npx tldraw-mods add <name>. The mod is downloaded, built, put into the open drawing, and saved.
4. npx tldraw-mods list | remove <name> | apply. Use --doc=<file.tldraw> if the drawing is saved elsewhere.

Any GitHub repo with a shadcn registry.json works as a source: npx tldraw-mods add owner/repo/name.

## Mods

${registry.items.map(item => `- ${item.title ?? item.name} (${item.name}): ${item.description} Install: ${install(item)}. Manifest: ${origin}/r/${item.name}.json. Page: ${origin}/${item.name}/`).join('\n')}

## Publishing a mod

A mod is one file, src/mods/<name>.tsx, whose default export is a function receiving { config } (tldraw offline's own config-script signature) and pushing shape utils, tools, or components onto it. Optional named exports: tool ({ id, label, icon, kbd? }) for a toolbar button and commands ([{ id, label, icon?, run(editor) }]) for the right-click menu. Add a registry.json at your repo root (schema: https://ui.shadcn.com/schema/registry.json) whose files target ~/src/mods/<name>.tsx. Never list tldraw, react, or react-dom as dependencies. Validate with: npx shadcn@latest registry validate. To be listed here, open a PR on ${registry.homepage} adding an item with "files": [] and "registryDependencies": ["owner/repo/name"]. Full guide: ${origin}/protocol/

## Machine-readable

- ${origin}/r/registry.json: every item
- ${origin}/r/<name>.json: one item with file contents
- ${origin}/sitemap.xml
`)
// Long cache for media and manifests; HTML revalidates.
await writeFile(join(dist, '_headers'), `/media/*\n  Cache-Control: public, max-age=31536000, immutable\n/r/*\n  Cache-Control: public, max-age=3600\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`)
if (await exists(join(site, 'media'))) await cp(join(site, 'media'), join(dist, 'media'), { recursive: true })
await writeFile(join(dist, 'protocol/index.html'), protocol)
for (const item of registry.items) {
	await mkdir(join(dist, item.name), { recursive: true })
	await writeFile(join(dist, item.name, 'index.html'), detail(item))
}
execFileSync('npx', ['--yes', 'shadcn@4.21.0', 'build', '-o', join(dist, 'r')], { cwd: root, stdio: 'inherit' })
console.log(`site: ${registry.items.length} items → ${dist}`)
