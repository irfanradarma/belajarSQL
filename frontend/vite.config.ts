import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
