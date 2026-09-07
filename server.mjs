import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  processVolume,
  processOBJ,
  processSkin,
  BRAIN_OBJ_PATH,
  SKULL_OBJ_PATH,
  SKULL_OHIO_OBJ_PATH,
  VENTRICLES_OBJ_PATH,
  SKIN_OBJ_PATH,
  ARTERIAL_OBJ_PATH,
  VENOUS_OBJ_PATH,
  VOLUME_NII_PATH,
  VOLUME_T1_PATH,
  VOLUME_T2_PATH,
  VOLUME_CT_PATH,
  VOLUME_FLASH25_PATH,
  VOLUME_MNI_PATH,
  VOLUME_TISSUE_PATH,
  VOLUME_STRUCTURE_PATH,
  VOLUME_SUBSTRUCTURE_PATH,
  BRAIN_STRUCTURE_CONFIGS
} from './build_cache.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const CACHE_DIR = path.join(__dirname, '.cache');

// Auto-check and re-cache volumes if any source file changed
export function checkAndAutoUpdateVolumeCache(requestedKey = null) {
  const sources = [
    { key: 'volume_t1', path: VOLUME_T1_PATH },
    { key: 'volume_t2', path: VOLUME_T2_PATH },
    { key: 'volume_ct', path: VOLUME_CT_PATH },
    { key: 'volume_flash25', path: VOLUME_FLASH25_PATH },
    { key: 'volume_mni152', path: VOLUME_MNI_PATH },
    { key: 'volume_tissue', path: VOLUME_TISSUE_PATH },
    { key: 'volume_structure', path: VOLUME_STRUCTURE_PATH },
    { key: 'volume_substructure', path: VOLUME_SUBSTRUCTURE_PATH }
  ];

  let needsRebuild = false;
  for (const s of sources) {
    if (requestedKey && !requestedKey.includes(s.key)) continue;
    if (fs.existsSync(s.path)) {
      const cachePath = path.join(CACHE_DIR, `${s.key}.bin.gz`);
      const srcMtime = fs.statSync(s.path).mtimeMs;
      const cacheMtime = fs.existsSync(cachePath) ? fs.statSync(cachePath).mtimeMs : 0;
      if (srcMtime > cacheMtime || !fs.existsSync(cachePath)) {
        console.log(`[Auto-Cache] Detected modified source for ${s.key}, rebuilding volume cache...`);
        needsRebuild = true;
        break;
      }
    }
  }

  if (needsRebuild) {
    const py = fs.existsSync('/Users/jiturner/miniforge3/envs/analysis_env/bin/python')
      ? '/Users/jiturner/miniforge3/envs/analysis_env/bin/python'
      : 'python';
    execSync(`${py} scripts/cache_volumes.py`, { cwd: __dirname, stdio: 'inherit' });
    console.log(`[Auto-Cache] Volumes cache rebuilt successfully.`);
  }
}

// Ensure cache exists
function ensureCache() {
  checkAndAutoUpdateVolumeCache();
  processOBJ('brain', BRAIN_OBJ_PATH);
  processOBJ('skull', SKULL_OBJ_PATH);
  processOBJ('skull_ohio', SKULL_OHIO_OBJ_PATH);
  processOBJ('ventricles', VENTRICLES_OBJ_PATH);
  processOBJ('skin', SKIN_OBJ_PATH);
  processOBJ('arterial', ARTERIAL_OBJ_PATH);
  processOBJ('venous', VENOUS_OBJ_PATH);
  for (const s of BRAIN_STRUCTURE_CONFIGS) {
    processOBJ(s.cacheKey, s.path);
  }

  if (!fs.existsSync(path.join(CACHE_DIR, 'mask_brain.bin.gz')) ||
      !fs.existsSync(path.join(CACHE_DIR, 'mask_skull.bin.gz')) ||
      !fs.existsSync(path.join(CACHE_DIR, 'mask_skin.bin.gz'))) {
    const py = fs.existsSync('/Users/jiturner/miniforge3/envs/analysis_env/bin/python')
      ? '/Users/jiturner/miniforge3/envs/analysis_env/bin/python'
      : 'python';
    execSync(`${py} scripts/cache_masks.py`, { cwd: __dirname, stdio: 'inherit' });
  }
}
ensureCache();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
  '.obj': 'text/plain',
  '.nii': 'application/octet-stream',
  '.gz': 'application/gzip'
};

function serveGzipFile(filePath, req, res, contentType = 'application/octet-stream') {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const stat = fs.statSync(filePath);
  const acceptEncoding = req.headers['accept-encoding'] || '';

  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Last-Modified': stat.mtime.toUTCString(),
    'ETag': `"${stat.size}-${stat.mtimeMs}"`
  };

  if (acceptEncoding.includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(zlib.createGunzip()).pipe(res);
  }
}

function serveStaticFile(filePath, res) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range'
    });
    res.end();
    return;
  }

  // API endpoints
  if (pathname === '/api/status') {
    const brainMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'brain.json'), 'utf8'));
    const skullMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'skull.json'), 'utf8'));
    const skullOhioMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'skull_ohio.json'), 'utf8'));
    const ventriclesMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'ventricles.json'), 'utf8'));
    const skinMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'skin.json'), 'utf8'));
    const arterialMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'arterial.json'), 'utf8'));
    const venousMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'venous.json'), 'utf8'));
    const volumeMeta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'volume.json'), 'utf8'));

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      status: 'ready',
      paths: {
        brain: BRAIN_OBJ_PATH,
        skull: SKULL_OBJ_PATH,
        skull_ohio: SKULL_OHIO_OBJ_PATH,
        ventricles: VENTRICLES_OBJ_PATH,
        skin: SKIN_OBJ_PATH,
        arterial: ARTERIAL_OBJ_PATH,
        venous: VENOUS_OBJ_PATH,
        volume: VOLUME_NII_PATH,
        volume_t1: VOLUME_T1_PATH,
        volume_t2: VOLUME_T2_PATH,
        volume_ct: VOLUME_CT_PATH,
        volume_flash25: VOLUME_FLASH25_PATH,
        volume_mni152: VOLUME_MNI_PATH,
        volume_tissue: VOLUME_TISSUE_PATH,
        volume_structure: VOLUME_STRUCTURE_PATH,
        volume_substructure: VOLUME_SUBSTRUCTURE_PATH
      },
      brain: brainMeta,
      skull: skullMeta,
      skull_ohio: skullOhioMeta,
      ventricles: ventriclesMeta,
      skin: skinMeta,
      arterial: arterialMeta,
      venous: venousMeta,
      volume: volumeMeta
    }, null, 2));
    return;
  }

  // Binary and metadata endpoints
  const binaryRoutes = {
    '/api/binary/volume': 'volume.bin.gz',
    '/api/metadata/volume': 'volume.json',
    '/api/binary/volume_t1': 'volume_t1.bin.gz',
    '/api/metadata/volume_t1': 'volume_t1.json',
    '/api/binary/volume_t2': 'volume_t2.bin.gz',
    '/api/metadata/volume_t2': 'volume_t2.json',
    '/api/binary/volume_ct': 'volume_ct.bin.gz',
    '/api/metadata/volume_ct': 'volume_ct.json',
    '/api/binary/volume_flash25': 'volume_flash25.bin.gz',
    '/api/metadata/volume_flash25': 'volume_flash25.json',
    '/api/binary/volume_mni152': 'volume_mni152.bin.gz',
    '/api/metadata/volume_mni152': 'volume_mni152.json',
    '/api/binary/volume_tissue': 'volume_tissue.bin.gz',
    '/api/metadata/volume_tissue': 'volume_tissue.json',
    '/api/binary/volume_structure': 'volume_structure.bin.gz',
    '/api/metadata/volume_structure': 'volume_structure.json',
    '/api/binary/volume_substructure': 'volume_substructure.bin.gz',
    '/api/metadata/volume_substructure': 'volume_substructure.json',
    '/api/binary/brain': 'brain.bin.gz',
    '/api/metadata/brain': 'brain.json',
    '/api/binary/skull': 'skull.bin.gz',
    '/api/metadata/skull': 'skull.json',
    '/api/binary/skull_ohio': 'skull_ohio.bin.gz',
    '/api/metadata/skull_ohio': 'skull_ohio.json',
    '/api/binary/ventricles': 'ventricles.bin.gz',
    '/api/metadata/ventricles': 'ventricles.json',
    '/api/binary/skin': 'skin.bin.gz',
    '/api/metadata/skin': 'skin.json',
    '/api/binary/arterial': 'arterial.bin.gz',
    '/api/metadata/arterial': 'arterial.json',
    '/api/binary/venous': 'venous.bin.gz',
    '/api/metadata/venous': 'venous.json',
    '/api/binary/mask_brain': 'mask_brain.bin.gz',
    '/api/metadata/mask_brain': 'mask_brain.json',
    '/api/binary/mask_skull': 'mask_skull.bin.gz',
    '/api/metadata/mask_skull': 'mask_skull.json',
    '/api/binary/mask_skin': 'mask_skin.bin.gz',
    '/api/metadata/mask_skin': 'mask_skin.json'
  };

  for (const s of BRAIN_STRUCTURE_CONFIGS) {
    binaryRoutes[`/api/binary/${s.cacheKey}`] = `${s.cacheKey}.bin.gz`;
    binaryRoutes[`/api/metadata/${s.cacheKey}`] = `${s.cacheKey}.json`;
  }

  if (pathname === '/api/brain_structures') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(BRAIN_STRUCTURE_CONFIGS, null, 2));
    return;
  }

  if (binaryRoutes[pathname]) {
    if (pathname.includes('volume')) {
      checkAndAutoUpdateVolumeCache(pathname);
    }
    const file = binaryRoutes[pathname];
    if (file.endsWith('.bin.gz')) {
      serveGzipFile(path.join(CACHE_DIR, file), req, res);
    } else {
      serveStaticFile(path.join(CACHE_DIR, file), res);
    }
    return;
  }

  // Raw file endpoints
  const rawRoutes = {
    '/api/raw/brain.obj': BRAIN_OBJ_PATH,
    '/api/raw/skull.obj': SKULL_OBJ_PATH,
    '/api/raw/skull_ohio.obj': SKULL_OHIO_OBJ_PATH,
    '/api/raw/ventricles.obj': VENTRICLES_OBJ_PATH,
    '/api/raw/skin.obj': SKIN_OBJ_PATH,
    '/api/raw/arterial.obj': ARTERIAL_OBJ_PATH,
    '/api/raw/venous.obj': VENOUS_OBJ_PATH,
    '/api/raw/volume.nii.gz': VOLUME_NII_PATH,
    '/api/raw/volume_t1.nii.gz': VOLUME_T1_PATH,
    '/api/raw/volume_t2.nii.gz': VOLUME_T2_PATH,
    '/api/raw/volume_ct.nii.gz': VOLUME_CT_PATH,
    '/api/raw/volume_flash25.nii.gz': VOLUME_FLASH25_PATH,
    '/api/raw/volume_mni152.nii': VOLUME_MNI_PATH,
    '/api/raw/volume_mni152.nii.gz': VOLUME_MNI_PATH,
    '/api/raw/volume_tissue.nii.gz': VOLUME_TISSUE_PATH,
    '/api/raw/volume_structure.nii.gz': VOLUME_STRUCTURE_PATH,
    '/api/raw/volume_substructure.nii.gz': VOLUME_SUBSTRUCTURE_PATH,
    '/api/raw/surf.lh.mz3': '/Users/jiturner/Repositories/Standard/surf.lh.mz3',
    '/api/raw/surf.rh.mz3': '/Users/jiturner/Repositories/Standard/surf.rh.mz3',
    '/api/raw/conte69_32k_surface_lh.gii': '/Users/jiturner/Repositories/Standard/conte69_32k_surface_lh.gii',
    '/api/raw/conte69_32k_surface_rh.gii': '/Users/jiturner/Repositories/Standard/conte69_32k_surface_rh.gii',
    '/api/raw/fsaverage_164k_hemi_L_pial.surf.gii': '/Users/jiturner/neuromaps-data/atlases/fsaverage/tpl-fsaverage_den-164k_hemi-L_pial.surf.gii',
    '/api/raw/fsaverage_164k_hemi_R_pial.surf.gii': '/Users/jiturner/neuromaps-data/atlases/fsaverage/tpl-fsaverage_den-164k_hemi-R_pial.surf.gii',
    '/api/raw/fsaverage_164k_hemi_L_inflated.surf.gii': '/Users/jiturner/neuromaps-data/atlases/fsaverage/tpl-fsaverage_den-164k_hemi-L_inflated.surf.gii',
    '/api/raw/fsaverage_164k_hemi_R_inflated.surf.gii': '/Users/jiturner/neuromaps-data/atlases/fsaverage/tpl-fsaverage_den-164k_hemi-R_inflated.surf.gii',
    '/api/raw/motor_4t95vol.nii.gz': '/Users/jiturner/Repositories/surf-ice/sample/motor_4t95vol.nii.gz',
    '/api/raw/mni_skull.ply': '/Users/jiturner/Repositories/Standard/mni_skull_clean.obj.ply',
    '/api/raw/surf.stl': '/Users/jiturner/Repositories/joseph_skulls/scratchwork/surf_printable.stl',
    '/api/raw/AF_L.trk.gz': '/Users/jiturner/Repositories/Standard/hcp1065_avg_tracts_trk/association/AF_L.trk.gz'
  };

  for (const s of BRAIN_STRUCTURE_CONFIGS) {
    rawRoutes[`/api/raw/${s.file}`] = s.path;
  }

  if (rawRoutes[pathname]) {
    serveStaticFile(rawRoutes[pathname], res);
    return;
  }

  // Static files in dist/ if built, otherwise in project root
  const distPath = path.join(__dirname, 'dist');
  let targetDir = fs.existsSync(distPath) ? distPath : __dirname;

  if (pathname === '/') pathname = '/index.html';

  let filePath = path.join(targetDir, pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', pathname);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveStaticFile(filePath, res);
  } else {
    const indexPath = fs.existsSync(path.join(distPath, 'index.html'))
      ? path.join(distPath, 'index.html')
      : path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      serveStaticFile(indexPath, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: ' + pathname);
    }
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Brain and Skull Atlas running at http://localhost:${PORT}`);
  console.log(`- Hardcoded Brain Mesh: ${BRAIN_OBJ_PATH}`);
  console.log(`- Hardcoded Skull (Full): ${SKULL_OBJ_PATH}`);
  console.log(`- Hardcoded Skull (Ohio): ${SKULL_OHIO_OBJ_PATH}`);
  console.log(`- Hardcoded Ventricles: ${VENTRICLES_OBJ_PATH}`);
  console.log(`- Hardcoded Soft Tissue: ${SKIN_OBJ_PATH}`);
  console.log(`- Hardcoded Arterial Structures: ${ARTERIAL_OBJ_PATH}`);
  console.log(`- Hardcoded Venous Structures: ${VENOUS_OBJ_PATH}`);
  console.log(`- Hardcoded MRI Volume: ${VOLUME_NII_PATH}`);
  console.log(`- Multi-plane Synchronized Volumetric Oblique Slicing: Active`);
  console.log(`=======================================================`);
});
