import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves a project repo (no custom domain) under a subpath —
  // https://<user>.github.io/<repo>/ — not the domain root, so asset URLs
  // must be prefixed with that subpath or the browser 404s on every JS/CSS
  // file and the page stays blank. Set VITE_BASE_PATH="/repo-name/" only for
  // that build (see .github/workflows/deploy-frontend.yml); once a custom
  // domain is in front (served from root), leave it unset so base stays "/".
  base: process.env.VITE_BASE_PATH ?? '/',
  build: {
    // Monaco's editor core + full contribution set (suggest, hover, find,
    // folding, etc. — all needed for a usable editor) is inherently ~3MB and
    // lives in its own React.lazy-loaded chunk (see QueryWorkspace.tsx),
    // never in the initial bundle — the default 500kB warning is noise here.
    chunkSizeWarningLimit: 3400,
  },
  server: {
    proxy: {
      // Local dev convenience: avoids configuring CORS for localhost when
      // VITE_API_BASE_URL is left unset during development.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
