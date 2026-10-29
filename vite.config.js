import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  // 读取 .env 文件中的密钥
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue()],
    server: {
      proxy: {
        // 拦截所有 /api/deepseek 开头的请求
        '/api/deepseek': {
          target: 'https://api.deepseek.com', // 实际转发给 DeepSeek
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/deepseek/, ''), // 去掉前缀
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