import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function syncVersionJsonPlugin() {
  const writeIfChanged = (filePath: string, content: string) => {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf-8') === content) return
    fs.writeFileSync(filePath, content)
  }

  const syncVersionFiles = () => {
    const versionPath = path.resolve(__dirname, 'src/lib/version.ts')
    const content = fs.readFileSync(versionPath, 'utf-8')
    const match = content.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)
    const version = match ? match[1] : '0.0.0'
    const jsonContent = `${JSON.stringify({ version }, null, 2)}\n`
    const swPath = path.resolve(__dirname, 'public/sw.js')
    const sourceSwContent = fs.readFileSync(swPath, 'utf-8')
    if (!sourceSwContent.includes('const APP_VERSION')) throw new Error('public/sw.js is missing its version marker')
    const swContent = sourceSwContent
      .replace(/const APP_VERSION = '[^']+'/, `const APP_VERSION = '${version}'`)

    writeIfChanged(path.resolve(__dirname, 'public/version.json'), jsonContent)
    writeIfChanged(swPath, swContent)
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
    handleHotUpdate(context: { file: string }) {
      if (path.resolve(context.file) !== path.resolve(__dirname, 'src/lib/version.ts')) return
      try {
        syncVersionFiles()
      } catch (e) {
        console.warn('Could not sync version files:', e)
      }
    }
  }
}

function preserveStandardBackdropFilterPlugin() {
  return {
    name: 'preserve-standard-backdrop-filter',
    enforce: 'post' as const,
    generateBundle(_: unknown, bundle: Record<string, { type: string; fileName: string; source?: string | Uint8Array }>) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !output.fileName.endsWith('.css') || typeof output.source !== 'string') continue
        output.source = output.source.replace(
          /(^|[;{]\s*)-webkit-backdrop-filter:\s*([^;}]+)(?=;|})/gm,
          '$1backdrop-filter: $2; -webkit-backdrop-filter: $2',
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    syncVersionJsonPlugin(),
    preserveStandardBackdropFilterPlugin(),
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
