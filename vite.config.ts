import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

// Плагин для создания пустого env.js (безопасность - ключ не попадает в браузер)
const createEmptyEnvPlugin = () => {
  return {
    name: 'create-empty-env',
    configureServer(server) {
      server.middlewares.use('/env.js', (req, res, next) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(`// API ключ НЕ используется во фронтенде - все запросы идут через серверный прокси
// Для безопасности ключ хранится только на бэкенде
window.GEMINI_API_KEY='';`);
      });
    },
    buildStart() {
      // При сборке также создаем пустой env.js
      const envJsPath = path.resolve(__dirname, 'public/env.js');
      const content = `// API ключ НЕ используется во фронтенде - все запросы идут через серверный прокси
// Для безопасности ключ хранится только на бэкенде
window.GEMINI_API_KEY='';`;
      fs.writeFileSync(envJsPath, content);
    }
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        strictPort: false, // Если порт занят, попробует другой
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            secure: false,
          },
        },
      },
      plugins: [
        react(),
        createEmptyEnvPlugin(), // Генерируем пустой env.js для безопасности
      ],
      // API ключ больше не нужен во фронтенде - все запросы идут через серверный прокси
      define: {
        // Оставляем для совместимости, но не передаем реальные ключи
        'process.env.API_KEY': JSON.stringify(''),
        'process.env.GEMINI_API_KEY': JSON.stringify('')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
