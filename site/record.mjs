// Records looping demo clips for mod cards: drives the open Demo.tldraw through the app's local API while
// `screencapture` records the region of the window where the action happens. macOS only; needs the app open
// with workspace/Demo.tldraw and Screen Recording permission for the terminal.
//   node site/record.mjs [landmark|browser]
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const media = join(dirname(fileURLToPath(import.meta.url)), 'media')
const { port, token } = JSON.parse(await readFile(join(homedir(), 'Library/Application Support/tldraw/server.json'), 'utf8'))
async function request(path, body) {
	const response = await fetch(`http://localhost:${port}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
	const data = await response.json()
	if (!data.success) throw new Error(`${data.error}\n${body.code ?? ""}`)
	return data.result
}
const docs = await request('/api/search', { code: 'return await api.getDocs()' })
const doc = docs.find(d => d.filePath?.endsWith('/Demo.tldraw'))
if (!doc) throw new Error('Open workspace/Demo.tldraw in tldraw offline first.')
const exec = code => request(`/api/doc/${doc.id}/exec`, { code })

// A 16:10 stage in page space, mapped to a fixed screen rectangle so the crop is stable across demos.
const stage = { w: 960, h: 600 }
async function setStage() {
	return exec(`
		editor.selectAll(); editor.deleteShapes(editor.getSelectedShapeIds())
		editor.setCurrentTool('select')
		const vp = editor.getViewportScreenBounds()
		editor.setCamera({ x: (vp.w - ${stage.w}) / 2, y: (vp.h - ${stage.h}) / 2, z: 1 }, { immediate: true })
		const tl = editor.pageToScreen({ x: 0, y: 0 })
		return { x: Math.round(window.screenX + tl.x), y: Math.round(window.screenY + (window.outerHeight - window.innerHeight) + tl.y), w: ${stage.w}, h: ${stage.h} }`)
}

async function record(name, seconds, run, { bottom = false, size } = {}) {
	const rect = await setStage()
	// Bottom-anchored stage, optionally smaller: centred on the toolbar and ending at the window's bottom edge.
	if (bottom) {
		if (size) { rect.x += (rect.w - size.w) / 2; rect.w = size.w; rect.h = size.h }
		rect.y = await exec('return Math.round(window.screenY + window.outerHeight)') - rect.h
	}
	await mkdir(media, { recursive: true })
	const mov = join(media, `${name}.mov`)
	await rm(mov, { force: true })
	const capture = spawn('screencapture', ['-x', '-V', String(seconds), '-R', `${rect.x},${rect.y},${rect.w},${rect.h}`, mov], { stdio: 'inherit' })
	await sleep(400)
	await run()
	await new Promise(resolve => capture.on('exit', resolve))
	// Card-sized, silent, loop-friendly: h264 mp4 + webm, first frame as poster.
	execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mov, '-an', '-vf', 'scale=960:-2,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-movflags', '+faststart', join(media, `${name}.mp4`)])
	execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mov, '-an', '-vf', 'scale=960:-2,fps=30', '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', join(media, `${name}.webm`)])
	execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mov, '-frames:v', '1', '-vf', 'scale=960:-2', join(media, `${name}.jpg`)])
	execFileSync('rm', [mov])
	console.log(`${name}: ${seconds}s → site/media/${name}.{mp4,webm,jpg}`)
}

async function typeLabel(id, type, text, ms = 70) {
	for (let i = 1; i <= text.length; i++) {
		await exec(`editor.updateShape({ id: ${JSON.stringify(id)}, type: ${JSON.stringify(type)}, props: { ${type === 'landmark' ? 'label' : 'url'}: ${JSON.stringify(text.slice(0, i))} } })`)
		await sleep(ms)
	}
}

const demos = {
	async landmark() {
		await record('landmark', 9, async () => {
			const ids = await exec(`
				const { createShapeId } = await import('tldraw')
				const ids = [createShapeId(), createShapeId(), createShapeId()]
				editor.createShapes([
					{ id: ids[0], type: 'geo', x: 300, y: 200, props: { w: 150, h: 90, geo: 'rectangle', color: 'light-blue', fill: 'semi' } },
					{ id: ids[1], type: 'geo', x: 520, y: 200, props: { w: 150, h: 90, geo: 'rectangle', color: 'light-blue', fill: 'semi' } },
					{ id: ids[2], type: 'geo', x: 410, y: 340, props: { w: 150, h: 90, geo: 'rectangle', color: 'light-blue', fill: 'semi' } },
				])
				return ids`)
			await sleep(800)
			await exec(`editor.select(...${JSON.stringify(ids)})`)
			await sleep(700)
			const landmark = await exec(`
				const { createShapeId } = await import('tldraw')
				const b = editor.getSelectionPageBounds(), pad = 60, id = createShapeId()
				editor.createShape({ id, type: 'landmark', x: b.x - pad, y: b.y - pad, props: { w: b.w + pad * 2, h: b.h + pad * 2, label: '' } })
				editor.sendToBack([id]); editor.select(id); editor.setEditingShape(id)
				return id`)
			await sleep(500)
			await typeLabel(landmark, 'landmark', 'Onboarding flow')
			await sleep(600)
			await exec(`editor.setEditingShape(null); editor.selectNone()`)
			await sleep(700)
			await exec(`const c = editor.getCamera(); editor.setCamera({ x: c.x + 240, y: c.y + 150, z: 0.5 }, { animation: { duration: 900 } })`)
			await sleep(1500)
			await exec(`const c = editor.getCamera(); editor.setCamera({ x: c.x - 240, y: c.y - 150, z: 1 }, { animation: { duration: 900 } })`)
			await sleep(1200)
		})
	},
	// UI mods: the stage sits over the toolbar so the bottom edge of the window is in frame.
	async 'toolbar-icons'() {
		await record('toolbar-icons', 6, async () => {
			for (const id of ['draw', 'arrow', 'text', 'note', 'geo', 'select']) {
				await exec(`editor.setCurrentTool(${JSON.stringify(id)})`)
				await sleep(850)
			}
		}, { bottom: true, size: { w: 480, h: 300 } })
	},
	async 'command-bar'() {
		await record('command-bar', 11, async () => {
			await exec(`
				const { createShapeId } = await import('tldraw')
				editor.createShape({ id: createShapeId(), type: 'landmark', x: 60, y: 40, props: { w: 380, h: 200, label: 'Onboarding flow' } })
				editor.createShape({ id: createShapeId(), type: 'landmark', x: 520, y: 40, props: { w: 380, h: 200, label: 'Checkout' } })`)
			await sleep(700)
			await exec(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, bubbles: true }))`)
			await sleep(900)
			for (const q of ['c', 'ch', 'che', 'chec']) {
				await exec(`const i = editor.getContainer().querySelector('.tool-search input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(q)}); i.dispatchEvent(new Event('input', { bubbles: true }))`)
				await sleep(220)
			}
			await sleep(900)
			await exec(`editor.getContainer().querySelector('.tool-search input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`)
			await sleep(1200)
			for (const theme of ['light', 'dark']) {
				await exec(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, bubbles: true }))`)
				await sleep(700)
				await exec(`const i = editor.getContainer().querySelector('.tool-search input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(theme)}); i.dispatchEvent(new Event('input', { bubbles: true }))`)
				await sleep(700)
				await exec(`editor.getContainer().querySelector('.tool-search input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`)
				await sleep(1100)
			}
		})
	},
	async browser() {
		await record('browser', 10, async () => {
			const id = await exec(`
				const { createShapeId } = await import('tldraw')
				const id = createShapeId()
				editor.createShape({ id, type: 'browser', x: 120, y: 120, props: { w: 720, h: 400, url: '' } })
				editor.select(id); editor.setEditingShape(id)
				return id`)
			await sleep(900)
			await typeLabel(id, 'browser', 'https://example.com', 55)
			await sleep(400)
			await exec(`editor.setEditingShape(null); editor.select(${JSON.stringify(id)})`)
			await sleep(2000)
			for (const [w, h] of [[390, 440], [560, 420], [720, 400]]) {
				await exec(`editor.animateShape({ id: ${JSON.stringify(id)}, type: 'browser', props: { w: ${w}, h: ${h} } }, { animation: { duration: 350 } })`)
				await sleep(1300)
			}
			await sleep(400)
		})
	},
}

for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(demos)) await demos[name]()
