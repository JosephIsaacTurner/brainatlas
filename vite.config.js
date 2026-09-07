import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

const CACHE_DIR = path.resolve(import.meta.dirname, '.cache');
const BRAIN_OBJ_PATH = '/Users/jiturner/Repositories/joseph_skulls/scratchwork/surf.obj';
const SKULL_OBJ_PATH = '/Users/jiturner/Repositories/joseph_skulls/data/output/skulls/full_skull/full_skull_mni_warped.obj';
const VOLUME_NII_PATH = '/Users/jiturner/Repositories/Standard/manjon_atlas/T1w_average_masked.nii.gz';

function apiPlugin() {
  return {
    name: 'turner-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = decodeURIComponent(url.pathname);

        if (pathname === '/api/status') {
          const brainMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'brain.json'), 'utf8'));
          const skullMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'skull.json'), 'utf8'));
          const volumeMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'volume.json'), 'utf8'));

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'ready',
            paths: {
              brain: BRAIN_OBJ_PATH,
              skull: SKULL_OBJ_PATH,
              volume: VOLUME_NII_PATH
            },
            brain: brainMeta,
            skull: skullMeta,
            volume: volumeMeta
          }));
          return;
        }

        if (pathname === '/api/binary/volume') {
          const filePath = path.join(CACHE_DIR, 'volume.bin.gz');
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Encoding', 'gzip');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        if (pathname === '/api/metadata/volume') {
          const filePath = path.join(CACHE_DIR, 'volume.json');
          res.setHeader('Content-Type', 'application/json');
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        if (pathname === '/api/binary/brain') {
          const filePath = path.join(CACHE_DIR, 'brain.bin.gz');
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Encoding', 'gzip');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        if (pathname === '/api/metadata/brain') {
          const filePath = path.join(CACHE_DIR, 'brain.json');
          res.setHeader('Content-Type', 'application/json');
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        if (pathname === '/api/binary/skull') {
          const filePath = path.join(CACHE_DIR, 'skull.bin.gz');
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Encoding', 'gzip');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        if (pathname === '/api/metadata/skull') {
          const filePath = path.join(CACHE_DIR, 'skull.json');
          res.setHeader('Content-Type', 'application/json');
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        if (pathname === '/api/raw/brain.obj') {
          res.setHeader('Content-Type', 'text/plain');
          fs.createReadStream(BRAIN_OBJ_PATH).pipe(res);
          return;
        }
        if (pathname === '/api/raw/skull.obj') {
          res.setHeader('Content-Type', 'text/plain');
          fs.createReadStream(SKULL_OBJ_PATH).pipe(res);
          return;
        }
        if (pathname === '/api/raw/volume.nii.gz') {
          res.setHeader('Content-Type', 'application/gzip');
          fs.createReadStream(VOLUME_NII_PATH).pipe(res);
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [apiPlugin()],
  server: {
    port: 3000,
    open: false,
    fs: {
      allow: ['..', '/Users/jiturner/Repositories']
    }
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2000
  }
});
