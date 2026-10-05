import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Power Platform ToolBox loads tools from disk into a sandboxed iframe: classic (non-module) script
// at the end of <body>, single IIFE bundle. The same dist/ also works as an unpacked browser extension.
const pptbHtml = {
  name: 'pptb-html',
  apply: 'build', // dev server needs its module scripts
  enforce: 'post',
  transformIndexHtml(html) {
    const scripts = []
    html = html
      .replace(/\s*type="module"/g, '')
      .replace(/\s*crossorigin/g, '')
      .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, (s) => (scripts.push(s), ''))
    return html.replace('</body>', scripts.join('\n') + '\n</body>')
  },
}

export default defineConfig({
  base: './',
  plugins: [react(), pptbHtml],
  build: { rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } } },
})
