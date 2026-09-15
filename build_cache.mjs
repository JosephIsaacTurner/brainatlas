import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '.cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export const PUBLIC_DATA_DIR = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(PUBLIC_DATA_DIR)) {
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
}

export const BRAIN_OBJ_PATH = '/Users/jiturner/Repositories/joseph_skulls/scratchwork/surf.obj';
export const SKULL_OBJ_PATH = '/Users/jiturner/Repositories/joseph_skulls/data/output/skulls/full_skull/full_skull_mni_warped.obj';
export const SKULL_OHIO_OBJ_PATH = '/Users/jiturner/Repositories/joseph_skulls/data/output/ohio_skull/ohio_skull/ohio_skull_mni_warped_mandible_fixed.obj';
export const VENTRICLES_OBJ_PATH = '/Users/jiturner/Repositories/joseph_skulls/scratchwork/mni152_smwp_ventricles_ref_0p1.obj';
export const SKIN_OBJ_PATH = '/Users/jiturner/Repositories/joseph_skulls/data/raw/NYHead/NYhead_segmentations/skin_mask_filled_0p5.obj';
export const ARTERIAL_OBJ_PATH = '/Users/jiturner/Repositories/Standard/UBA167/manually_refined_again_final.obj';
export const VENOUS_OBJ_PATH = '/Users/jiturner/Repositories/Standard/mni_colin27_2008_nifti/manual_venous_structures_fixed.obj';
export const DURAL_FOLDS_OBJ_PATH = '/Users/jiturner/Downloads/falx_tentorium_mesh.obj';
export const VOLUME_T1_PATH = '/Users/jiturner/Repositories/Standard/manjon_atlas/T1w_average.nii.gz';
export const VOLUME_T2_PATH = '/Users/jiturner/Repositories/Standard/manjon_atlas/T2w_average.nii.gz';
export const VOLUME_CT_PATH = '/Users/jiturner/Repositories/joseph_skulls/data/reference/reference_ct/template_with_skull_fixed_official_cleaned.nii.gz';
export const VOLUME_FLASH25_PATH = '/Users/jiturner/Repositories/Standard/Synthesized_FLASH25_in_MNI_v2_500um.nii.gz';
export const VOLUME_MNI_PATH = '/Users/jiturner/Repositories/Standard/mni_icbm152_nlin_asym_09b_nifti/mni_icbm152_nlin_asym_09b/mni_icbm152_t1_tal_nlin_asym_09b_hires.nii';
export const VOLUME_BIGBRAIN_PATH = '/Users/jiturner/Repositories/Standard/BigBrain-to-ICBM2009asym-nonlin-500um.nii';
export const VOLUME_TISSUE_PATH = '/Users/jiturner/Repositories/Standard/manjon_atlas/tissue_atlas_masked.nii.gz';
export const VOLUME_STRUCTURE_PATH = '/Users/jiturner/Repositories/Standard/manjon_atlas/structure_atlas.nii.gz';
export const VOLUME_SUBSTRUCTURE_PATH = '/Users/jiturner/Repositories/Standard/manjon_atlas/substructure_atlas.nii.gz';
export const VOLUME_NII_PATH = VOLUME_T1_PATH;

export const SKULL_SUBSTRUCTURE_DIR = '/Users/jiturner/Repositories/joseph_skulls/data/output/OhioOnJagakeSkull/substructures';

export const SKULL_SUBSTRUCTURE_CONFIGS = [
  { id: 'cervical_vertebrae', name: 'Cervical Vertebrae', shortName: 'Cervical Vertebrae', file: 'cervical_vertebrae.obj', cacheKey: 'subbone_cervical_vertebrae', defaultColor: '#94a3b8' },
  { id: 'ethmoid', name: 'Ethmoid Bone', shortName: 'Ethmoid', file: 'ethmoid.obj', cacheKey: 'subbone_ethmoid', defaultColor: '#14b8a6' },
  { id: 'frontal', name: 'Frontal Bone', shortName: 'Frontal', file: 'frontal.obj', cacheKey: 'subbone_frontal', defaultColor: '#f59e0b' },
  { id: 'left_inferior_nasal_concha', name: 'Left Inferior Nasal Concha', shortName: 'L Inf Nasal Concha', file: 'left_inferior_nasal_concha.obj', cacheKey: 'subbone_left_inferior_nasal_concha', defaultColor: '#84cc16' },
  { id: 'left_lacrimal', name: 'Left Lacrimal Bone', shortName: 'L Lacrimal', file: 'left_lacrimal.obj', cacheKey: 'subbone_left_lacrimal', defaultColor: '#06b6d4' },
  { id: 'left_maxilla', name: 'Left Maxilla', shortName: 'L Maxilla', file: 'left_maxilla.obj', cacheKey: 'subbone_left_maxilla', defaultColor: '#eab308' },
  { id: 'left_palatine', name: 'Left Palatine Bone', shortName: 'L Palatine', file: 'left_palatine.obj', cacheKey: 'subbone_left_palatine', defaultColor: '#6366f1' },
  { id: 'left_parietal', name: 'Left Parietal Bone', shortName: 'L Parietal', file: 'left_parietal.obj', cacheKey: 'subbone_left_parietal', defaultColor: '#3b82f6' },
  { id: 'left_temporal', name: 'Left Temporal Bone', shortName: 'L Temporal', file: 'left_temporal.obj', cacheKey: 'subbone_left_temporal', defaultColor: '#10b981' },
  { id: 'left_zygomatic', name: 'Left Zygomatic Bone', shortName: 'L Zygomatic', file: 'left_zygomatic.obj', cacheKey: 'subbone_left_zygomatic', defaultColor: '#a855f7' },
  { id: 'mandible', name: 'Mandible', shortName: 'Mandible', file: 'mandible.obj', cacheKey: 'subbone_mandible', defaultColor: '#ef4444' },
  { id: 'nasal', name: 'Nasal Bone', shortName: 'Nasal', file: 'nasal.obj', cacheKey: 'subbone_nasal', defaultColor: '#f97316' },
  { id: 'occipital', name: 'Occipital Bone', shortName: 'Occipital', file: 'occipital.obj', cacheKey: 'subbone_occipital', defaultColor: '#8b5cf6' },
  { id: 'right_inferior_nasal_concha', name: 'Right Inferior Nasal Concha', shortName: 'R Inf Nasal Concha', file: 'right_inferior_nasal_concha.obj', cacheKey: 'subbone_right_inferior_nasal_concha', defaultColor: '#a3e635' },
  { id: 'right_lacrimal', name: 'Right Lacrimal Bone', shortName: 'R Lacrimal', file: 'right_lacrimal.obj', cacheKey: 'subbone_right_lacrimal', defaultColor: '#22d3ee' },
  { id: 'right_maxillary', name: 'Right Maxilla', shortName: 'R Maxilla', file: 'right_maxillary.obj', cacheKey: 'subbone_right_maxillary', defaultColor: '#facc15' },
  { id: 'right_palatine', name: 'Right Palatine Bone', shortName: 'R Palatine', file: 'right_palatine.obj', cacheKey: 'subbone_right_palatine', defaultColor: '#818cf8' },
  { id: 'right_parietal', name: 'Right Parietal Bone', shortName: 'R Parietal', file: 'right_parietal.obj', cacheKey: 'subbone_right_parietal', defaultColor: '#60a5fa' },
  { id: 'right_temporal', name: 'Right Temporal Bone', shortName: 'R Temporal', file: 'right_temporal.obj', cacheKey: 'subbone_right_temporal', defaultColor: '#34d399' },
  { id: 'right_zygomatic', name: 'Right Zygomatic Bone', shortName: 'R Zygomatic', file: 'right_zygomatic.obj', cacheKey: 'subbone_right_zygomatic', defaultColor: '#c084fc' },
  { id: 'sphenoid', name: 'Sphenoid Bone', shortName: 'Sphenoid', file: 'sphenoid.obj', cacheKey: 'subbone_sphenoid', defaultColor: '#ec4899' },
  { id: 'vomer', name: 'Vomer', shortName: 'Vomer', file: 'vomer.obj', cacheKey: 'subbone_vomer', defaultColor: '#d946ef' }
].map(s => ({
  ...s,
  path: path.join(SKULL_SUBSTRUCTURE_DIR, s.file)
}));

export const BRAIN_STRUCTURE_CONFIGS = [
  {
    id: 'brainstem_midbrain_diencephalon',
    name: 'Brainstem, Midbrain & Diencephalon',
    shortName: 'Brainstem / Midbrain / Diencephalon',
    file: 'BrainstemMidbrainDiencephalonMask_0p5.obj',
    path: '/Users/jiturner/Repositories/Standard/manjon_atlas/BrainstemMidbrainDiencephalonMask_0p5.obj',
    cacheKey: 'struct_brainstem_midbrain_diencephalon',
    defaultColor: '#a855f7' // Purple
  },
  {
    id: 'thalamus',
    name: 'Thalamus',
    shortName: 'Thalamus',
    file: 'ThalamusMask_0p5.obj',
    path: '/Users/jiturner/Repositories/Standard/manjon_atlas/ThalamusMask_0p5.obj',
    cacheKey: 'struct_thalamus',
    defaultColor: '#06b6d4' // Cyan
  },
  {
    id: 'brainstem_cerebellum',
    name: 'Brainstem & Cerebellum',
    shortName: 'Brainstem / Cerebellum',
    file: 'BrainstemCerebellumMask_0p5.obj',
    path: '/Users/jiturner/Repositories/Standard/manjon_atlas/BrainstemCerebellumMask_0p5.obj',
    cacheKey: 'struct_brainstem_cerebellum',
    defaultColor: '#10b981' // Emerald
  },
  {
    id: 'basal_ganglia',
    name: 'Basal Ganglia',
    shortName: 'Basal Ganglia',
    file: 'BasalGangliaMask_0p5.obj',
    path: '/Users/jiturner/Repositories/Standard/manjon_atlas/BasalGangliaMask_0p5.obj',
    cacheKey: 'struct_basal_ganglia',
    defaultColor: '#f59e0b' // Amber
  },
  {
    id: 'limbic_system',
    name: 'Limbic System',
    shortName: 'Limbic System',
    file: 'LimbicSystemMask_0p5.obj',
    path: '/Users/jiturner/Repositories/Standard/manjon_atlas/LimbicSystemMask_0p5.obj',
    cacheKey: 'struct_limbic_system',
    defaultColor: '#f43f5e' // Rose
  },
  {
    id: 'pituitary',
    name: 'Pituitary',
    shortName: 'Pituitary',
    file: 'pituitary_v2.obj',
    path: fs.existsSync('/Users/jiturner/Downloads/pituitary_v2.obj')
      ? '/Users/jiturner/Downloads/pituitary_v2.obj'
      : path.join(__dirname, 'public', 'data', 'raw', 'pituitary_v2.obj'),
    cacheKey: 'struct_pituitary',
    defaultColor: '#ec4899' // Pink
  }
];

console.log('--- Starting Binary Pre-caching ---');

// 1. Process Volume (T1w or T2w)
export function processVolume(name = 'volume', filePath = VOLUME_NII_PATH) {
  const cachePath = path.join(CACHE_DIR, `${name}.bin.gz`);
  const metaPath = path.join(CACHE_DIR, `${name}.json`);

  if (fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    console.log(`Volume (${name}) binary cache already exists, skipping generation.`);
    return;
  }

  console.log(`Processing volume (${name}) from ${filePath}...`);
  console.time(`volume_${name}_process`);
  const compressedNii = fs.readFileSync(filePath);
  const rawNii = zlib.gunzipSync(compressedNii);

  const dim = [];
  for (let i = 0; i < 8; i++) {
    dim.push(rawNii.readInt16LE(40 + i * 2));
  }
  const dims = [dim[1], dim[2], dim[3]];
  const totalVoxels = dims[0] * dims[1] * dims[2];
  const voxOffset = Math.round(rawNii.readFloatLE(108));

  // Affine matrix extraction from NIfTI header (srow_x, srow_y, srow_z)
  const srow_x = [
    rawNii.readFloatLE(280),
    rawNii.readFloatLE(284),
    rawNii.readFloatLE(288),
    rawNii.readFloatLE(292)
  ];
  const srow_y = [
    rawNii.readFloatLE(296),
    rawNii.readFloatLE(300),
    rawNii.readFloatLE(304),
    rawNii.readFloatLE(308)
  ];
  const srow_z = [
    rawNii.readFloatLE(312),
    rawNii.readFloatLE(316),
    rawNii.readFloatLE(320),
    rawNii.readFloatLE(324)
  ];

  console.log(`Dims: ${dims.join('x')}, Voxels: ${totalVoxels}`);
  const floatData = new Float32Array(rawNii.buffer, rawNii.byteOffset + voxOffset, totalVoxels);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < floatData.length; i++) {
    const v = floatData[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  console.log(`Voxel raw range: min=${min}, max=${max}`);

  // Quantize to uint8 (0..255) for WebGL 3D texture
  const uint8Data = new Uint8Array(totalVoxels);
  const maxVal = max > 0 ? max : 1;
  const scale = 255.0 / maxVal;
  for (let i = 0; i < totalVoxels; i++) {
    const v = floatData[i];
    uint8Data[i] = v > 0 ? Math.min(255, Math.max(0, Math.round(v * scale))) : 0;
  }

  // Save compressed binary buffer
  const compressedUint8 = zlib.gzipSync(uint8Data, { level: 6 });
  fs.writeFileSync(cachePath, compressedUint8);

  const metadata = {
    name,
    dims,
    origin: [srow_x[3], srow_y[3], srow_z[3]],
    spacing: [srow_x[0], srow_y[1], srow_z[2]],
    size: [dims[0] * srow_x[0], dims[1] * srow_y[1], dims[2] * srow_z[2]],
    srow_x,
    srow_y,
    srow_z,
    rawMin: min,
    rawMax: max,
    format: 'uint8',
    byteLength: uint8Data.byteLength,
    compressedLength: compressedUint8.byteLength
  };

  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  console.timeEnd(`volume_${name}_process`);
  console.log(`Volume (${name}) cached: ${compressedUint8.length} bytes (gzipped)`);
}

// 2. Process OBJ
export function processOBJ(name, filePath) {
  const cachePath = path.join(CACHE_DIR, `${name}.bin.gz`);
  const metaPath = path.join(CACHE_DIR, `${name}.json`);

  if (fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    const srcMtime = fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
    const cacheMtime = fs.statSync(cachePath).mtimeMs;
    let cachedSource = null;
    try {
      const metaObj = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      cachedSource = metaObj.sourcePath;
    } catch (e) {}

    if (cachedSource === filePath && srcMtime <= cacheMtime) {
      console.log(`${name} binary cache already exists and is up to date, skipping.`);
      return;
    }
    console.log(`${name} source file changed or path updated, regenerating binary cache...`);
  }

  console.log(`Processing mesh: ${name} from ${filePath}...`);
  console.time(`mesh_process_${name}`);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');

  let vCount = 0, triCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('v ')) {
      vCount++;
    } else if (l.startsWith('f ')) {
      const parts = l.slice(2).trim().split(/\s+/);
      if (parts.length >= 3) {
        triCount += parts.length - 2;
      }
    }
  }

  const positions = new Float32Array(vCount * 3);
  const indices = new Uint32Array(triCount * 3);

  let vIdx = 0, iIdx = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('v ')) {
      const parts = l.slice(2).trim().split(/\s+/);
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      const z = parseFloat(parts[2]);
      positions[vIdx++] = x;
      positions[vIdx++] = y;
      positions[vIdx++] = z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    } else if (l.startsWith('f ')) {
      const parts = l.slice(2).trim().split(/\s+/);
      if (parts.length >= 3) {
        const v0 = parseInt(parts[0], 10) - 1;
        for (let k = 1; k < parts.length - 1; k++) {
          indices[iIdx++] = v0;
          indices[iIdx++] = parseInt(parts[k], 10) - 1;
          indices[iIdx++] = parseInt(parts[k + 1], 10) - 1;
        }
      }
    }
  }

  // Fast normal computation
  const normals = new Float32Array(vCount * 3);
  for (let i = 0; i < triCount; i++) {
    const i1 = indices[i * 3] * 3;
    const i2 = indices[i * 3 + 1] * 3;
    const i3 = indices[i * 3 + 2] * 3;

    const ax = positions[i2] - positions[i1];
    const ay = positions[i2 + 1] - positions[i1 + 1];
    const az = positions[i2 + 2] - positions[i1 + 2];

    const bx = positions[i3] - positions[i1];
    const by = positions[i3 + 1] - positions[i1 + 1];
    const bz = positions[i3 + 2] - positions[i1 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
    normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
    normals[i3] += nx; normals[i3 + 1] += ny; normals[i3 + 2] += nz;
  }

  // Normalize
  for (let i = 0; i < vCount; i++) {
    const idx = i * 3;
    const nx = normals[idx];
    const ny = normals[idx + 1];
    const nz = normals[idx + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0.00001) {
      normals[idx] = nx / len;
      normals[idx + 1] = ny / len;
      normals[idx + 2] = nz / len;
    } else {
      normals[idx] = 0;
      normals[idx + 1] = 0;
      normals[idx + 2] = 1;
    }
  }

  // Header: 16 bytes: [Magic "MESH", vCount (u32), triCount (u32), flags (u32)]
  const headerBuf = Buffer.alloc(16);
  headerBuf.write('MESH', 0, 4, 'ascii');
  headerBuf.writeUInt32LE(vCount, 4);
  headerBuf.writeUInt32LE(triCount, 8);
  headerBuf.writeUInt32LE(0, 12);

  const posBuf = Buffer.from(positions.buffer);
  const normBuf = Buffer.from(normals.buffer);
  const indBuf = Buffer.from(indices.buffer);

  const combined = Buffer.concat([headerBuf, posBuf, normBuf, indBuf]);
  const compressed = zlib.gzipSync(combined, { level: 6 });
  fs.writeFileSync(cachePath, compressed);

  const meta = {
    name,
    sourcePath: filePath,
    vertexCount: vCount,
    triangleCount: triCount,
    bounds: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      size: [maxX - minX, maxY - minY, maxZ - minZ]
    },
    rawBytes: combined.length,
    compressedBytes: compressed.length
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  // Also sync to public/data for Vite static bundling
  fs.copyFileSync(cachePath, path.join(PUBLIC_DATA_DIR, `${name}.bin.gz`));
  fs.copyFileSync(metaPath, path.join(PUBLIC_DATA_DIR, `${name}.json`));

  console.timeEnd(`mesh_process_${name}`);
  console.log(`${name} cached: ${compressed.length} bytes (gzipped), ${vCount} verts, ${triCount} tris`);
}

// 3. Process Skin Mesh from skin.nii using analysis_env
export function processSkin() {
  const cachePath = path.join(CACHE_DIR, 'skin.bin.gz');
  const metaPath = path.join(CACHE_DIR, 'skin.json');

  if (fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    console.log('skin binary cache already exists, skipping.');
    return;
  }

  console.log(`Extracting skin mesh from ${SKIN_NII_PATH} using analysis_env...`);
  const pyCmd = `/Users/jiturner/miniforge3/envs/analysis_env/bin/python -c "
import nibabel as nib
import numpy as np
from skimage import measure
import zlib
import struct
import json

img = nib.load('${SKIN_NII_PATH}')
data = (img.get_fdata() > 0.5).astype(np.uint8)
verts, faces, normals, values = measure.marching_cubes(data[::2, ::2, ::2], level=0.5, spacing=(1.0, 1.0, 1.0))
verts[:, 0] -= 98.0
verts[:, 1] -= 134.0
verts[:, 2] -= 193.0

v_count = len(verts)
f_count = len(faces)
positions = verts.astype(np.float32)
normals = normals.astype(np.float32)
norm_lens = np.linalg.norm(normals, axis=1, keepdims=True)
norm_lens[norm_lens == 0] = 1.0
normals /= norm_lens
indices = faces.astype(np.uint32)

header = struct.pack('<4sIII', b'MESH', v_count, f_count, 0)
combined = header + positions.tobytes() + normals.tobytes() + indices.tobytes()
compressed = zlib.compress(combined, level=6)
with open('${cachePath}', 'wb') as f:
    f.write(compressed)

meta = {
    'name': 'skin',
    'vertexCount': v_count,
    'triangleCount': f_count,
    'bounds': {
        'min': verts.min(axis=0).tolist(),
        'max': verts.max(axis=0).tolist(),
        'center': ((verts.min(axis=0) + verts.max(axis=0)) / 2).tolist(),
        'size': (verts.max(axis=0) - verts.min(axis=0)).tolist()
    },
    'rawBytes': len(combined),
    'compressedBytes': len(compressed)
}
with open('${metaPath}', 'w') as f:
    json.dump(meta, f, indent=2)
"`;
  execSync(pyCmd);
  console.log('skin mesh extracted and cached.');
}

processVolume('volume', VOLUME_T1_PATH);
processVolume('volume_t1', VOLUME_T1_PATH);
processVolume('volume_t2', VOLUME_T2_PATH);

// Process MNI152, CT, FLASH25, and Substructure Atlas volumes via cache_volumes.py
if (!fs.existsSync(path.join(CACHE_DIR, 'volume_mni152.bin.gz')) ||
    !fs.existsSync(path.join(CACHE_DIR, 'volume_ct.bin.gz')) ||
    !fs.existsSync(path.join(CACHE_DIR, 'volume_flash25.bin.gz')) ||
    !fs.existsSync(path.join(CACHE_DIR, 'volume_substructure.bin.gz'))) {
  try {
    const pyPath = fs.existsSync('/Users/jiturner/miniforge3/envs/analysis_env/bin/python')
      ? '/Users/jiturner/miniforge3/envs/analysis_env/bin/python'
      : 'python';
    execSync(`${pyPath} scripts/cache_volumes.py`, { cwd: __dirname, stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to run cache_volumes.py:', e);
  }
}

processOBJ('brain', BRAIN_OBJ_PATH);
processOBJ('skull', SKULL_OBJ_PATH);
processOBJ('skull_ohio', SKULL_OHIO_OBJ_PATH);
processOBJ('ventricles', VENTRICLES_OBJ_PATH);
processOBJ('skin', SKIN_OBJ_PATH);
processOBJ('arterial', ARTERIAL_OBJ_PATH);
processOBJ('venous', VENOUS_OBJ_PATH);
processOBJ('dural_folds', DURAL_FOLDS_OBJ_PATH);
for (const s of BRAIN_STRUCTURE_CONFIGS) {
  processOBJ(s.cacheKey, s.path);
}
for (const s of SKULL_SUBSTRUCTURE_CONFIGS) {
  processOBJ(s.cacheKey, s.path);
}
console.log('--- Binary Pre-caching Complete ---');
