// esbuild plugin: every imported `.css` file is a Tailwind v4 stylesheet, compiled against the classes used under `src/`
// and delivered to the script as a string (it is injected through a <style> element, never a stylesheet link).
import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export function tailwindPlugin({ sources }) {
	return {
		name: 'tailwind',
		setup(build) {
			build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
				const watchFiles = [path]
				const compiler = await compile(await readFile(path, 'utf8'), { base: dirname(path), onDependency: file => watchFiles.push(file) })
				const candidates = new Scanner({ sources: sources.map(base => ({ base, pattern: '**/*', negated: false })) }).scan()
				return { contents: compiler.build(candidates), loader: 'text', watchFiles }
			})
		},
	}
}
