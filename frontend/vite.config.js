import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// dist 去污（M6 收尾）：publicDir 整目录复制会带入 legacy 资源，其中 game.html 及其
// 7 个脚本依赖（约 1.1MB）与 Vue 运行时无关。构建后从 dist 移除；生产镜像由
// Dockerfile 精确 COPY 到 /app/public（server 静态回退继续可达），双轨保留。
const DIST_LEGACY_FILES = [
  'game.html', 'debug-saves.html',
  'game.js', 'game-data.js', 'game-events-expanded.js',
  'game-visual.js', 'save-utils.js', 'game-rules.js', 'game-combat.js'
]

function removeLegacyDistFiles() {
  return {
    name: 'remove-legacy-dist-files',
    closeBundle() {
      for (const file of DIST_LEGACY_FILES) {
        try { fs.unlinkSync(path.resolve(__dirname, 'dist', file)) } catch { /* 不存在即忽略 */ }
      }
    }
  }
}

export default defineConfig({
  plugins: [vue(), removeLegacyDistFiles()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // 将原项目的 public 目录作为静态资源目录
  // 这样 /data/*.json, /assets/*, /css/*, map.html, codex.html 都可直接访问
  publicDir: path.resolve(__dirname, '../public'),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // vendor 分包：框架层（vue/pinia/vue-router）独立成 chunk，
        // 业务迭代不再打爆框架代码的浏览器长缓存。
        manualChunks(id) {
          if (id.includes('node_modules') && /[\\/]node_modules[\\/](vue|@vue|pinia|vue-router)[\\/]/.test(id)) {
            return 'vendor'
          }
          return undefined
        }
      }
    }
  }
})
