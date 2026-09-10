// Mirrors the esbuild loaders in build.mjs: images arrive as data URLs, stylesheets as text.
declare module '*.png' { const dataUrl: string; export default dataUrl }
declare module '*.css' { const text: string; export default text }
