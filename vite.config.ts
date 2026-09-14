import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// Only DOM elements accept inspector attributes. Three.js treats "code-path" as
// a nested object property and throws when scene components hot-reload.
const inspectorDomTags = new Set('a article aside b blockquote br button canvas code div em fieldset footer form h1 h2 h3 h4 header hr img input kbd label legend li main nav ol option p pre section select small span strong style svg table tbody td textarea th thead tr ul'.split(' '))

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [inspectAttr({
    predicate: (node) => node.type === 'JSXElement'
      && node.openingElement.name.type === 'JSXIdentifier'
      && inspectorDomTags.has(node.openingElement.name.name),
  }), react()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    fs: { deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/artifacts/**', '**/server/**'] },
    proxy: { '/api': { target: 'http://127.0.0.1:4188', changeOrigin: false } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
