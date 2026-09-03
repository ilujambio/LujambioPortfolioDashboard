import { defineConfig } from 'vite';

// Relative base so the built site works under a GitHub Pages project
// subpath like https://<user>.github.io/<repo>/ regardless of repo name.
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all',
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      },
    },
  },
});
