import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 1. Yahoo Finance API Proxy
  if (req.url && req.url.startsWith('/api/yahoo')) {
    const subPath = req.url.replace(/^\/api\/yahoo/, '');
    const hosts = [
      'https://query1.finance.yahoo.com',
      'https://query2.finance.yahoo.com',
    ];

    let lastError = null;
    for (const host of hosts) {
      try {
        const targetUrl = `${host}${subPath}`;
        const upstream = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
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
      error: `Failed to proxy Yahoo Finance: ${lastError ? lastError.message : 'Unknown error'}`
    }));
    return;
  }

  // 2. Static file serving from dist/
  let reqPath = req.url ? req.url.split('?')[0] : '/';
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.join(DIST_DIR, reqPath);

  // Security check
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback to index.html
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 500;
        res.end('Internal Server Error');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
