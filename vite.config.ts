import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { estimateFragments } from './src/parser/estimateCore.ts'

function estimateDev(): Plugin {
  return {
    name: 'thali-estimate',
    configureServer(server) {
      server.middlewares.use('/api/estimate', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
        req.on('end', () => {
          void (async () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as { fragments?: string[] }
              const estimates = await estimateFragments(body.fragments ?? [], {
                GEMINI_API_KEY: process.env.GEMINI_API_KEY,
                OPENAI_API_KEY: process.env.OPENAI_API_KEY,
              })
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ estimates }))
            } catch {
              res.statusCode = 503
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ error: 'unavailable' }))
            }
          })()
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.GEMINI_API_KEY ??= env.GEMINI_API_KEY
  process.env.OPENAI_API_KEY ??= env.OPENAI_API_KEY
  return {
    plugins: [
      react(),
      tailwindcss(),
      estimateDev(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'Thali Log',
          short_name: 'Thali',
          description: 'Log a meal the way you would say it.',
          theme_color: '#f3ecdf',
          background_color: '#f3ecdf',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
