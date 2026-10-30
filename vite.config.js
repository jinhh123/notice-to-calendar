import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  // 读取 .env 文件中的密钥
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue()],
    server: {
      proxy: {
        // 拦截 /api/deepseek 请求（本地开发时代替 Pages Function）
        '/api/deepseek': {
          target: 'https://api.deepseek.com', // 实际转发给 DeepSeek
          changeOrigin: true,
          // 线上由 functions/api/deepseek.js 补上 /chat/completions，本地这里补
          rewrite: () => '/chat/completions',
          configure: (proxy, options) => {
            // 在服务端偷偷加上 API Key
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.DEEPSEEK_API_KEY}`)
            })
          }
        }
      }
    }
  }
})