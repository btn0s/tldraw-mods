#!/usr/bin/env node
// tldraw-mods: install mods into a tldraw offline document-script workspace.
// A thin convention layer over the shadcn CLI: the hub is a shadcn GitHub registry, mods are files in src/mods/,
// and the workspace's build lists that directory to register them. Nothing here edits source files.
import { spawn } from 'node:child_process'
import { access, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const hub = process.env.TLDRAW_MODS_HUB ?? 'btn0s/tldraw-mods'
// Pinned in package.json. shadcn's "." export is its CLI entry.
const shadcnBin = fileURLToPath(import.meta.resolve('shadcn'))
const [command, ...args] = process.argv.slice(2)
const flags = new Set(args.filter(arg => arg.startsWith('--')).map(arg => arg.split('=')[0]))
const doc = args.find(arg => arg.startsWith('--doc='))?.slice(6)
const positional = args.filter(arg => !arg.startsWith('--'))
const cwd = process.cwd()

const usage = `tldraw-mods <command>

  init [dir]         Create a document-script workspace (default: current directory)
  add <mod...>       Install mods from the hub, or owner/repo/item from any shadcn GitHub registry
  remove <mod...>    Delete src/mods/<mod>.tsx
  list               Mods in the hub
  search <query>     Filter the hub
  apply [doc.tldraw] Bundle and load into the open document(s)
  build              Bundle only, as a check

Flags: --doc=<file.tldraw> apply to that document instead of ones inside this folder (add/remove)
       --dry-run (add), --no-apply (add/remove)
Hub: ${hub} (override with TLDRAW_MODS_HUB)`

function run(file, argv, options = {}) {
	return new Promise((done, fail) => {
		const child = spawn(file, argv, { stdio: 'inherit', cwd, ...options })
		child.on('exit', code => code === 0 ? done() : fail(Object.assign(new Error(`${basename(argv[0] ?? file)} exited with ${code}`), { code })))
		child.on('error', fail)
	})
}
const shadcn = (...argv) => run(process.execPath, [shadcnBin, ...argv])
const exists = path => access(path).then(() => true, () => false)
const address = name => name.includes('/') ? name : `${hub}/${name}`

async function fetchRegistry() {
	const url = `https://raw.githubusercontent.com/${hub}/HEAD/registry.json`
	const response = await fetch(url)
	if (!response.ok) throw new Error(`Could not read ${url}: ${response.status}`)
	return (await response.json()).items
}

async function requireWorkspace() {
	if (!await exists(join(cwd, 'build.mjs')) || !await exists(join(cwd, 'src/config.tsx'))) {
		throw new Error(`No workspace in ${cwd}. Run: tldraw-mods init`)
	}
}

async function build() { await run(process.execPath, ['build.mjs']) }

async function apply(doc) {
	await requireWorkspace()
	await run(process.execPath, ['apply.mjs', ...(doc ? [resolve(doc)] : [])])
}

// Build, then apply if a matching document is open; otherwise say how.
async function applyOrBuild() {
	if (flags.has('--no-apply')) return build()
	try { await apply(doc) } catch (error) {
		if (error.code !== 2) throw error
		await build()
		console.log('Then: tldraw-mods apply')
	}
}

async function init() {
	const dir = resolve(positional[0] ?? '.')
	process.chdir(dir)
	const pkg = join(dir, 'package.json')
	if (!await exists(pkg)) {
		await writeFile(pkg, JSON.stringify({ name: basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, '-'), private: true, type: 'module', scripts: { build: 'node build.mjs', apply: 'node apply.mjs' } }, null, 2) + '\n')
	}
	// shadcn needs both before it will write anything.
	if (!await exists(join(dir, 'tsconfig.json'))) await writeFile(join(dir, 'tsconfig.json'), tsconfig)
	if (!await exists(join(dir, 'components.json'))) await writeFile(join(dir, 'components.json'), componentsJson)
	await run(process.execPath, [shadcnBin, 'add', `${hub}/workspace`, '--yes', '--overwrite'], { cwd: dir })
	console.log(`\nWorkspace ready in ${dir}. Next: tldraw-mods add landmark`)
}

async function add() {
	await requireWorkspace()
	if (!positional.length) throw new Error('add: name a mod')
	await shadcn('add', ...positional.map(address), '--yes', '--overwrite', ...(flags.has('--dry-run') ? ['--dry-run'] : []))
	if (!flags.has('--dry-run')) await applyOrBuild()
}

async function remove() {
	await requireWorkspace()
	if (!positional.length) throw new Error('remove: name a mod')
	for (const name of positional) {
		const file = join(cwd, 'src/mods', `${name}.tsx`)
		if (!await exists(file)) throw new Error(`Not installed: src/mods/${name}.tsx`)
		await rm(file)
		console.log(`Removed src/mods/${name}.tsx`)
	}
	await applyOrBuild()
}

async function list(query = '') {
	const items = (await fetchRegistry()).filter(item => !query || `${item.name} ${item.title} ${item.description} ${(item.categories ?? []).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
	if (!items.length) return console.log('No matches.')
	const width = Math.max(...items.map(item => item.name.length))
	for (const item of items) console.log(`${item.name.padEnd(width)}  ${item.description ?? ''}`)
}

const tsconfig = `{
	// Types come from the installed desktop app, as its generated script-workspace jsconfig maps them.
	"compilerOptions": {
		"target": "es2022",
		"module": "esnext",
		"moduleResolution": "bundler",
		"jsx": "react-jsx",
		"lib": ["es2022", "dom", "dom.iterable"],
		"strict": true,
		"allowJs": true,
		"noEmit": true,
		"skipLibCheck": true,
		"isolatedModules": true,
		"paths": {
			"@/*": ["./src/*"],
			"tldraw": ["/Applications/tldraw offline.app/Contents/Resources/sdk-types/tldraw.d.mts"],
			"@tldraw/*": ["/Applications/tldraw offline.app/Contents/Resources/sdk-types/@tldraw/*.d.mts"],
			"react": ["/Applications/tldraw offline.app/Contents/Resources/sdk-types/@types/react/index.d.ts"],
			"react/jsx-runtime": ["/Applications/tldraw offline.app/Contents/Resources/sdk-types/@types/react/jsx-runtime.d.ts"],
			"react-dom": ["/Applications/tldraw offline.app/Contents/Resources/sdk-types/@types/react-dom/index.d.ts"],
			"tldraw-offline/script-context": ["/Applications/tldraw offline.app/Contents/Resources/script-context.d.ts"]
		}
	},
	"include": ["src/**/*"]
}
`
const componentsJson = `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/styles/globals.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
`

const commands = { init, add, remove, list: () => list(), search: () => list(positional.join(' ')), apply: () => apply(positional[0] ?? doc), build: async () => { await requireWorkspace(); await build() } }
try {
	if (!command || !(command in commands)) { console.log(usage); process.exit(command ? 1 : 0) }
	await commands[command]()
} catch (error) {
	console.error(error.message)
	process.exit(1)
}
