import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: '.',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
      '/datajud': {
        target: 'https://api-publica.datajud.cnj.jus.br',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/datajud/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Authorization', 'APIKey cDZHYzlZa0JadVREZDJCendBdUFWZz09cDZHYzlZa0JadVREZDJCendBdUFWZz09')
            proxyReq.setHeader('Content-Type', 'application/json')
          })
        },
      },
      // Diário de Justiça Eletrônico Nacional (DJEN) — API pública do CNJ.
      // Intimações/publicações por OAB. Sem autenticação.
      '/comunica': {
        target: 'https://comunicaapi.pje.jus.br',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/comunica/, ''),
      },
      // IBGE SIDRA — número-índice do INPC (correção da média previdenciária).
      '/sidra': {
        target: 'https://apisidra.ibge.gov.br',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/sidra/, ''),
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
