import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/api-route-extractor/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'local-cors-proxy',
        configureServer(server) {
          server.middlewares.use('/proxy', async (req, res, next) => {
            try {
              const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
              const targetUrl = urlObj.searchParams.get('url');

              if (!targetUrl) {
                res.statusCode = 400;
                res.end('Missing "url" query parameter');
                return;
              }

              // Dynamic import to ensure Node modules are available
              const { URL: NodeURL } = await import('url');
              const http = await import('http');
              const https = await import('https');

              const target = new NodeURL(targetUrl);
              const lib = target.protocol === 'https:' ? https : http;

              const proxyReq = lib.request(targetUrl, {
                method: req.method,
                headers: {
                  ...req.headers,
                  host: target.host,
                  'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              }, (proxyRes) => {
                // Set CORS headers
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

                res.statusCode = proxyRes.statusCode || 500;
                
                // Forward headers
                Object.entries(proxyRes.headers).forEach(([key, value]) => {
                   if (value) res.setHeader(key, value);
                });

                proxyRes.pipe(res);
              });

              proxyReq.on('error', (err) => {
                console.error('Proxy Error:', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Proxy Request Failed', details: err.message }));
              });

              if (req.method !== 'GET' && req.method !== 'HEAD') {
                req.pipe(proxyReq);
              } else {
                proxyReq.end();
              }

            } catch (error) {
              console.error('Middleware Error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal Proxy Error' }));
            }
          });
        }
      }
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
