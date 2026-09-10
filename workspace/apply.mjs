import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { bundle } from './build.mjs'

// Writes the bundle into each open document's script workspace through the desktop app's local API.
// With no argument: every open local document inside this directory. With a path: that document, anywhere.
const root = dirname(fileURLToPath(import.meta.url))
const target = process.argv[2] ? resolve(process.argv[2]) : null
const appData = process.platform === 'darwin' ? join(homedir(), 'Library/Application Support')
	: process.platform === 'win32' ? process.env.APPDATA
	: process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
const { port, token } = JSON.parse(await readFile(join(appData, 'tldraw/server.json'), 'utf8'))

async function request(path, body) {
	const response = await fetch(`http://localhost:${port}${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	})
	const data = await response.json()
	if (!response.ok || !data.success) throw new Error(JSON.stringify(data))
	return data.result
}

const docs = (await request('/api/search', { code: 'return await api.getDocs()' }))
	.filter(doc => doc.ownership === 'local' && (target ? doc.filePath === target : doc.filePath.startsWith(root + '/')))
if (!docs.length) throw new Error(target ? `Open ${target} in tldraw offline first.` : `No documents from ${root} are open in tldraw offline.`)
const output = await bundle()

async function apply(doc) {
	const base = `/api/doc/${doc.id}`
	const workspace = await request(`${base}/script-workspace`, {})
	await writeFile(join(workspace.scriptDir, 'config.js'), output)
	for (let attempt = 0; attempt < 40; attempt++) {
		await setTimeout(250)
		const status = await request(`${base}/script-status`)
		if (status.state === 'error') throw new Error(JSON.stringify(status))
		if (status.state !== 'applied') continue
		try {
			await request(`${base}/exec`, { code: 'await helpers.saveDoc()' })
		} catch (error) {
			// The watcher can finish before config.js's new editor has mounted.
			if (error.message.includes('"error":"Editor not mounted"')) continue
			throw error
		}
		console.log(`Applied and saved: ${doc.filePath}`)
		return
	}
	throw new Error(`${doc.filePath}: script watcher did not finish within 10 seconds. Inspect script-status before retrying.`)
}

const results = await Promise.allSettled(docs.map(apply))
for (const result of results) if (result.status === 'rejected') console.error(result.reason.message)
process.exit(results.some(result => result.status === 'rejected') ? 1 : 0)
