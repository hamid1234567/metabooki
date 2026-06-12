import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function syncVersionJsonPlugin() {
  return {
    name: 'sync-version-json',
    buildStart() {
      try {
        const versionPath = path.resolve(__dirname, 'src/lib/version.ts')
        const content = fs.readFileSync(versionPath, 'utf-8')
        const match = content.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)
        const version = match ? match[1] : '0.0.0'
        const jsonContent = JSON.stringify({ version, buildTime: new Date().toISOString() }, null, 2)
        fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), jsonContent)
      } catch (e) {
        console.warn('Could not sync version.json:', e)
      }
    },
    handleHotUpdate() {
      try {
        const versionPath = path.resolve(__dirname, 'src/lib/version.ts')
        const content = fs.readFileSync(versionPath, 'utf-8')
        const match = content.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)
        const version = match ? match[1] : '0.0.0'
        const jsonContent = JSON.stringify({ version, buildTime: new Date().toISOString() }, null, 2)
        fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), jsonContent)
      } catch (e) {
        console.warn('Could not sync version.json:', e)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    syncVersionJsonPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
  },
})
