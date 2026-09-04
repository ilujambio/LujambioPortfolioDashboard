import { defineConfig } from 'vite';

function yahooFinanceProxyPlugin() {
  const handler = async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/yahoo')) {
      return next();
    }

    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Strip prefix: /api/yahoo/v8/finance/chart/AAPL?... -> /v8/finance/chart/AAPL?...
    const subPath = req.url.replace(/^\/api\/yahoo/, '');

    const hosts = [
      'https://query2.finance.yahoo.com',
      'https://query1.finance.yahoo.com',
    ];

    let lastError = null;
    for (const host of hosts) {
      try {
        const targetUrl = `${host}${subPath}`;
        const upstream = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://finance.yahoo.com/',
          },
        });

        if (upstream.status === 200) {
          const body = await upstream.text();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(body);
          return;
        } else {
          lastError = new Error(`Upstream returned HTTP ${upstream.status}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: `Failed to proxy Yahoo Finance request: ${lastError ? lastError.message : 'Unknown error'}`
    }));
  };

  return {
    name: 'yahoo-finance-proxy-middleware',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [yahooFinanceProxyPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all',
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all',
  },
});
