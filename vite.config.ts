import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function syncVersionJsonPlugin() {
  const syncVersionFiles = () => {
    const versionPath = path.resolve(__dirname, 'src/lib/version.ts')
    const content = fs.readFileSync(versionPath, 'utf-8')
    const match = content.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)
    const version = match ? match[1] : '0.0.0'
    const jsonContent = JSON.stringify({ version, buildTime: new Date().toISOString() }, null, 2)
    const swPath = path.resolve(__dirname, 'public/sw.js')
    const sourceSwContent = fs.readFileSync(swPath, 'utf-8')
    if (!sourceSwContent.includes('const APP_VERSION')) throw new Error('public/sw.js is missing its version marker')
    const swContent = sourceSwContent
      .replace(/const APP_VERSION = '[^']+'/, `const APP_VERSION = '${version}'`)

    fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), jsonContent)
    fs.writeFileSync(swPath, swContent)
  }

  return {
    name: 'sync-version-json',
    buildStart() {
      try {
        syncVersionFiles()
      } catch (e) {
        console.warn('Could not sync version files:', e)
      }
    },
    handleHotUpdate() {
      try {
        syncVersionFiles()
      } catch (e) {
        console.warn('Could not sync version files:', e)
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
  build: {
    // Vite's production CSS minifier drops the standard backdrop-filter rule
    // and leaves only the WebKit variant, breaking frosted menus on Android Chrome.
    cssMinify: false,
  },
})
