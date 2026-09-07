import * as THREE from 'three';
import * as nifti from 'nifti-reader-js';
import { parseGIIScalars } from './meshParsers.js';
import { fetchBinary, fetchJson } from './dataLoader.js';

export const VOLUME_CONFIGS = {
  t1: {
    key: 't1',
    label: 'T1w Average',
    defaultRawWindow: [100, 300],
    sliderMin: 0,
    sliderMax: 400,
    step: 1
  },
  t2: {
    key: 't2',
    label: 'T2w Average',
    defaultRawWindow: [0, 300],
    sliderMin: 0,
    sliderMax: 400,
    step: 1
  },
  ct: {
    key: 'ct',
    label: 'CT (Skull & Head)',
    defaultRawWindow: [10, 90],
    sliderMin: -100,
    sliderMax: 500,
    step: 1
  },
  flash25: {
    key: 'flash25',
    label: 'Edlow Ex Vivo',
    defaultRawWindow: [8, 35],
    sliderMin: 0,
    sliderMax: 70,
    step: 0.5
  },
  mni152: {
    key: 'mni152',
    label: 'MNI152',
    defaultRawWindow: [40, 80],
    sliderMin: 0,
    sliderMax: 100,
    step: 1
  },
  tissue: {
    key: 'tissue',
    label: 'Tissue Atlas (9 Classes)',
    defaultRawWindow: [0, 9],
    sliderMin: 0,
    sliderMax: 10,
    step: 1,
    isAtlas: true
  },
  structure: {
    key: 'structure',
    label: 'Structure Atlas (54 Labels)',
    defaultRawWindow: [0, 54],
    sliderMin: 0,
    sliderMax: 60,
    step: 1,
    isAtlas: true
  },
  substructure: {
    key: 'substructure',
    label: 'Substructure Atlas (352 Labels)',
    defaultRawWindow: [0, 352],
    sliderMin: 0,
    sliderMax: 360,
    step: 1,
    isAtlas: true
  }
};

export const MASK_CONFIGS = {
  none: { key: 'none', label: 'None' },
  brain: { key: 'mask_brain', label: 'Mask Background by Brain' },
  skull: { key: 'mask_skull', label: 'Mask Background by Skull' },
  skin: { key: 'mask_skin', label: 'Mask Background by Soft Tissue' }
};

export class VolumeManager {
  constructor() {
    // Base anatomical volume (T1w / T2w / CT / FLASH25 / MNI152 / Atlases)
    this.currentVolumeType = 't1';
    this.texture = null;
    this.metadata = null;
    this.worldToVolumeTex = new THREE.Matrix4();
    this.dims = [362, 434, 362];
    this.origin = new THREE.Vector3(-90.0, -126.0, -72.0);
    this.spacing = new THREE.Vector3(0.5, 0.5, 0.5);
    this.size = new THREE.Vector3(181.0, 217.0, 181.0);
    this.rawMin = 0;
    this.rawMax = 351.04;
    this.defaultRawWindow = [100, 300];
    this.isAtlas = false;
    this.isLoaded = false;
    this.cachedVolumes = {};
    this.cachedMetadata = {};
    this.cachedWorldToVolumeTex = {};
    this.onBaseVolumeChangeCallbacks = [];

    // Overlay volume (.nii / .nii.gz)
    this.hasOverlay = false;
    this.dummyTexture = new THREE.Data3DTexture(new Float32Array([0]), 1, 1, 1);
    this.dummyTexture.format = THREE.RedFormat;
    this.dummyTexture.type = THREE.FloatType;
    this.dummyTexture.internalFormat = 'R32F';
    this.dummyTexture.needsUpdate = true;
    this.overlayTexture = this.dummyTexture;
    this.overlayMetadata = null;
    this.overlayName = '';
    this.worldToOverlayTex = new THREE.Matrix4();
    this.overlayDims = [0, 0, 0];
    this.overlayRawMin = 0;
    this.overlayRawMax = 1;
    this.rawOverlayData = null;

    // Separate Positive and Negative Color Maps
    this.hasPosOverlay = true;
    this.posColormap = 17; // 17 = Red-Yellow (Default)
    this.posMin = 1.0;
    this.posMax = 5.0;
    this.posOpacity = 0.85;
    this.posDataMin = 0;
    this.posDataMax = 5;

    // 4D Volume overlay support
    this.isOverlay4D = false;
    this.overlayNumVolumes = 1;
    this.overlayCurrentVolumeIndex = 0;
    this.overlayAllTypedData = null;
    this.overlaySlope = 1.0;
    this.overlayInter = 0.0;
    this.overlayTotalVoxels = 0;

    this.hasNegOverlay = false;
    this.negColormap = 18; // 18 = Winters (Default Blue-Green)
    this.negMin = -1.0;
    this.negMax = -5.0;
    this.negOpacity = 0.85;
    this.negDataMin = -5;
    this.negDataMax = 0;

    // Overlay interpolation (true: trilinear filter, false: nearest native voxel filter)
    this.overlayInterpolate = true;

    // Threshold-based Contouring
    this.showContour = false;
    this.contourPosThresh = 2.0;
    this.contourNegThresh = -2.0;
    this.contourPosActive = false; // Default OFF
    this.contourNegActive = false; // Default OFF
    this.contourPosEnabled = false;
    this.contourNegEnabled = false;
    this.contourPosColorHex = '#facc15'; // Vibrant Yellow
    this.contourNegColorHex = '#38bdf8'; // Vibrant Cyan
    this.contourPosColor = new THREE.Vector3(0.98, 0.8, 0.08);
    this.contourNegColor = new THREE.Vector3(0.22, 0.74, 0.97);
    this.contourWidth = 2.0;

    // Surface overlay projection onto Brain Mesh (Surfice replication)
    this.projectOntoMesh = true;
    this.meshManager = null;
    this.overlayType = null; // 'volume' | 'gifti_surface' | null
    this.giftiScalars = null;
    this.giftiNumVertices = 0;

    // Legacy fallback properties
    this.overlayOpacity = 0.85;
    this.overlayColormap = 17;
    this.overlayMin = 1.0;
    this.overlayMax = 5.0;

    this.onOverlayChangeCallbacks = [];
    this.onOverlayPropertyChangeCallbacks = [];
    this.overlays = [];
    this.overlayContourTexture = this.dummyTexture;

    // Background Volumetric Masks (None, Brain, Skull, Soft Tissue)
    this.currentMask = 'brain';
    this.maskTextures = {};
    this.maskMetadata = {};
    this.maskWorldToTex = {};
    this.dummyMaskTexture = new THREE.Data3DTexture(new Uint8Array([255]), 1, 1, 1);
    this.dummyMaskTexture.format = THREE.RedFormat;
    this.dummyMaskTexture.type = THREE.UnsignedByteType;
    this.dummyMaskTexture.needsUpdate = true;
  }

  async loadMask(maskType = 'brain', onProgress = null) {
    if (!maskType || maskType === 'none') {
      this.currentMask = 'none';
      return null;
    }
    const cfg = MASK_CONFIGS[maskType] || MASK_CONFIGS.brain;
    const key = cfg.key;

    if (this.maskTextures[maskType]) {
      this.currentMask = maskType;
      return this.maskTextures[maskType];
    }

    if (onProgress) onProgress({ phase: 'mask_meta', progress: 0.1, message: `Loading ${cfg.label} metadata...` });
    const meta = await fetchJson(`data/${key}.json?t=${Date.now()}`);
    this.maskMetadata[maskType] = meta;

    if (onProgress) onProgress({ phase: 'mask_binary', progress: 0.4, message: `Loading ${cfg.label}...` });
    const buffer = await fetchBinary(`data/${key}.bin.gz?t=${Date.now()}`);

    const [width, height, depth] = meta.dims;
    const dataArray = new Uint8Array(buffer);
    const texture = new THREE.Data3DTexture(dataArray, width, height, depth);
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    this.maskTextures[maskType] = texture;

    const mat = new THREE.Matrix4();
    if (meta.worldToVolumeTex && meta.worldToVolumeTex.length === 16) {
      mat.fromArray(meta.worldToVolumeTex);
    }
    this.maskWorldToTex[maskType] = mat;
    this.currentMask = maskType;

    if (onProgress) onProgress({ phase: 'mask_ready', progress: 1.0, message: `${cfg.label} ready` });
    return texture;
  }

  getMaskTexture(maskType = this.currentMask) {
    if (!maskType || maskType === 'none') return this.dummyMaskTexture;
    return this.maskTextures[maskType] || this.dummyMaskTexture;
  }

  getMaskWorldToTex(maskType = this.currentMask) {
    if (!maskType || maskType === 'none') return new THREE.Matrix4();
    return this.maskWorldToTex[maskType] || new THREE.Matrix4();
  }

  getVolumeLabel(typeKey) {
    return VOLUME_CONFIGS[typeKey]?.label || 'T1w Average';
  }

  _updateVolumeMetrics(metadata) {
    this.metadata = metadata;
    this.dims = metadata.dims;
    this.origin.fromArray(metadata.origin);
    this.spacing.fromArray(metadata.spacing);
    this.size.fromArray(metadata.size);
    this.rawMin = metadata.rawMin;
    this.rawMax = metadata.rawMax;
    this.isAtlas = !!metadata.isAtlas;
    this.defaultRawWindow = metadata.defaultWindow || VOLUME_CONFIGS[this.currentVolumeType]?.defaultRawWindow || [0, metadata.rawMax];

    if (metadata.worldToVolumeTex && metadata.worldToVolumeTex.length === 16) {
      this.worldToVolumeTex.fromArray(metadata.worldToVolumeTex);
    } else if (metadata.srow_x && metadata.srow_y && metadata.srow_z) {
      const sx = metadata.srow_x;
      const sy = metadata.srow_y;
      const sz = metadata.srow_z;
      const affine = new THREE.Matrix4().set(
        sx[0], sx[1], sx[2], sx[3],
        sy[0], sy[1], sy[2], sy[3],
        sz[0], sz[1], sz[2], sz[3],
        0, 0, 0, 1
      );
      const S = new THREE.Matrix4().makeScale(this.dims[0], this.dims[1], this.dims[2]);
      const texToWorld = new THREE.Matrix4().multiplyMatrices(affine, S);
      this.worldToVolumeTex.copy(texToWorld).invert();
    } else {
      this.worldToVolumeTex.set(
        1.0 / this.size.x, 0, 0, -this.origin.x / this.size.x,
        0, 1.0 / this.size.y, 0, -this.origin.y / this.size.y,
        0, 0, 1.0 / this.size.z, -this.origin.z / this.size.z,
        0, 0, 0, 1
      );
    }
  }

  async load(onProgress = null, volumeType = 't1') {
    try {
      const validTypes = Object.keys(VOLUME_CONFIGS);
      const typeKey = validTypes.includes(volumeType) ? volumeType : 't1';
      const label = this.getVolumeLabel(typeKey);

      // Check cache first
      if (this.cachedVolumes[typeKey]) {
        this.texture = this.cachedVolumes[typeKey];
        this._updateVolumeMetrics(this.cachedMetadata[typeKey]);
        if (this.cachedWorldToVolumeTex[typeKey]) {
          this.worldToVolumeTex.copy(this.cachedWorldToVolumeTex[typeKey]);
        }
        this.currentVolumeType = typeKey;
        this.isLoaded = true;
        if (onProgress) onProgress({ phase: 'ready', progress: 1.0, message: `${label} ready` });
        return this.texture;
      }

      if (onProgress) onProgress({ phase: 'metadata', progress: 0.1, message: `Fetching ${label} metadata...` });
      let meta = null;
      try {
        meta = await fetchJson(`data/volume_${typeKey}.json?t=${Date.now()}`);
      } catch (err) {
        if (typeKey === 't1') {
          try {
            meta = await fetchJson(`data/volume.json?t=${Date.now()}`);
          } catch (e2) {}
        }
      }
      if (meta) {
        this._updateVolumeMetrics(meta);
      }

      const voxelCountStr = (this.dims[0] * this.dims[1] * this.dims[2] / 1e6).toFixed(1) + 'M';
      if (onProgress) onProgress({ phase: 'download', progress: 0.3, message: `Loading 3D ${label} (${voxelCountStr} voxels)...` });

      let buffer = null;
      try {
        buffer = await fetchBinary(`data/volume_${typeKey}.bin.gz?t=${Date.now()}`);
      } catch (err) {
        if (typeKey === 't1') {
          buffer = await fetchBinary(`data/volume.bin.gz?t=${Date.now()}`);
        } else {
          throw err;
        }
      }
      if (!buffer) {
        throw new Error(`Failed to load ${label}`);
      }
      if (onProgress) onProgress({ phase: 'processing', progress: 0.8, message: 'Creating WebGL2 3D texture...' });

      let textureType = THREE.UnsignedByteType;
      let dataArray;
      if (this.metadata && (this.metadata.format === 'float16' || this.metadata.format === 'halffloat')) {
        textureType = THREE.HalfFloatType;
        dataArray = new Uint16Array(buffer);
      } else if (this.metadata && this.metadata.format === 'float32') {
        textureType = THREE.FloatType;
        dataArray = new Float32Array(buffer);
      } else {
        textureType = THREE.UnsignedByteType;
        dataArray = new Uint8Array(buffer);
      }

      const [width, height, depth] = this.dims;

      const texture = new THREE.Data3DTexture(dataArray, width, height, depth);
      texture.format = THREE.RedFormat;
      texture.type = textureType;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.wrapR = THREE.ClampToEdgeWrapping;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;

      this.cachedVolumes[typeKey] = texture;
      this.cachedMetadata[typeKey] = this.metadata;
      this.cachedWorldToVolumeTex[typeKey] = this.worldToVolumeTex.clone();
      this.texture = texture;
      this.currentVolumeType = typeKey;
      this.isLoaded = true;

      if (onProgress) onProgress({ phase: 'ready', progress: 1.0, message: `${label} ready` });
      return texture;
    } catch (err) {
      console.error('VolumeManager load error:', err);
      throw err;
    }
  }

  async switchVolumeType(volumeType, onProgress = null) {
    const validTypes = Object.keys(VOLUME_CONFIGS);
    const typeKey = validTypes.includes(volumeType) ? volumeType : 't1';
    const label = this.getVolumeLabel(typeKey);

    // Check if the currently active texture is already this volume
    if (this.texture && this.cachedVolumes[typeKey] && this.texture === this.cachedVolumes[typeKey]) {
      this.currentVolumeType = typeKey;
      return this.texture;
    }

    // If cached, restore from cache immediately
    if (this.cachedVolumes[typeKey] && this.cachedMetadata[typeKey]) {
      this.texture = this.cachedVolumes[typeKey];
      this._updateVolumeMetrics(this.cachedMetadata[typeKey]);
      if (this.cachedWorldToVolumeTex[typeKey]) {
        this.worldToVolumeTex.copy(this.cachedWorldToVolumeTex[typeKey]);
      }
      this.currentVolumeType = typeKey;
      this.isLoaded = true;

      if (onProgress) onProgress({ phase: 'ready', progress: 1.0, message: `${label} ready (cached)` });
      this.notifyBaseVolumeChange();
      return this.texture;
    }

    // Otherwise fetch and build texture
    await this.load(onProgress, typeKey);
    this.notifyBaseVolumeChange();
    return this.texture;
  }

  async loadBaseVolumeFromFile(file, onProgress = null) {
    try {
      if (onProgress) onProgress({ phase: 'read', progress: 0.2, message: `Reading ${file.name}...` });
      const rawBuffer = await file.arrayBuffer();

      if (onProgress) onProgress({ phase: 'parse', progress: 0.4, message: 'Parsing NIfTI header...' });
      const reader = nifti;
      let buffer = rawBuffer;
      if (reader.isCompressed(buffer)) {
        if (onProgress) onProgress({ phase: 'decompress', progress: 0.5, message: 'Decompressing gzip...' });
        buffer = reader.decompress(buffer);
      }

      if (!reader.isNIFTI(buffer)) {
        throw new Error('Selected file is not a valid NIfTI-1 or NIfTI-2 volume.');
      }

      const header = reader.readHeader(buffer);
      const dims = [header.dims[1], header.dims[2], header.dims[3]];
      const totalVoxels = dims[0] * dims[1] * dims[2];

      const affine = new THREE.Matrix4();
      if (header.affine && header.affine.length >= 3 && header.affine[0].length >= 4) {
        const a = header.affine;
        const a3 = (a.length >= 4 && a[3]) ? a[3] : [0, 0, 0, 1];
        affine.set(
          a[0][0], a[0][1], a[0][2], a[0][3],
          a[1][0], a[1][1], a[1][2], a[1][3],
          a[2][0], a[2][1], a[2][2], a[2][3],
          a3[0], a3[1], a3[2], a3[3]
        );
      } else {
        const dx = (header.pixDims && header.pixDims[1]) || 1;
        const dy = (header.pixDims && header.pixDims[2]) || 1;
        const dz = (header.pixDims && header.pixDims[3]) || 1;
        affine.set(
          dx, 0, 0, -90,
          0, dy, 0, -126,
          0, 0, dz, -72,
          0, 0, 0, 1
        );
      }

      const S = new THREE.Matrix4().makeScale(dims[0], dims[1], dims[2]);
      const texToWorld = new THREE.Matrix4().multiplyMatrices(affine, S);
      const worldToVolumeTex = new THREE.Matrix4();
      if (Math.abs(texToWorld.determinant()) > 1e-8) {
        worldToVolumeTex.copy(texToWorld).invert();
      } else {
        worldToVolumeTex.identity();
      }

      const rawImage = reader.readImage(header, buffer);
      let typedData;
      switch (header.datatypeCode) {
        case 2:
          typedData = new Uint8Array(rawImage);
          break;
        case 256:
          typedData = new Int8Array(rawImage);
          break;
        case 4:
          typedData = new Int16Array(rawImage);
          break;
        case 512:
          typedData = new Uint16Array(rawImage);
          break;
        case 8:
        case 768:
        case 16:
        case 64:
        default:
          typedData = new Float32Array(rawImage);
          break;
      }

      const slope = (header.scl_slope && Number.isFinite(header.scl_slope) && header.scl_slope !== 0) ? header.scl_slope : 1.0;
      const inter = (header.scl_inter && Number.isFinite(header.scl_inter)) ? header.scl_inter : 0.0;
      let rawMin = Infinity, rawMax = -Infinity;

      let float32Data;
      if (typedData instanceof Float32Array && slope === 1.0 && inter === 0.0) {
        float32Data = typedData;
        for (let i = 0; i < totalVoxels; i++) {
          const v = float32Data[i];
          if (Number.isFinite(v)) {
            if (v < rawMin) rawMin = v;
            if (v > rawMax) rawMax = v;
          }
        }
      } else {
        float32Data = new Float32Array(totalVoxels);
        for (let i = 0; i < totalVoxels; i++) {
          const v = typedData[i] * slope + inter;
          float32Data[i] = v;
          if (Number.isFinite(v)) {
            if (v < rawMin) rawMin = v;
            if (v > rawMax) rawMax = v;
          }
        }
      }

      if (rawMin === Infinity) rawMin = 0;
      if (rawMax === -Infinity) rawMax = 1;

      // Encode into the SAME normalized-uint8 convention used by the server-side
      // cache pipeline (scripts/cache_volumes.py): each positive voxel is scaled to
      // 1..255 as round(v / rawMax * 254) + 1, background (v <= 0) stays 0. The slice
      // shader's window/level and masking logic reads texel values assuming they are
      // already a 0..1 fraction of rawMax (see ClippingManager.setRawWindow), so a raw
      // (un-normalized) float texture here produces a binarized/washed-out white slice.
      const maxValSafe = rawMax > 0 ? rawMax : 1.0;
      const uint8Data = new Uint8Array(totalVoxels);
      for (let i = 0; i < totalVoxels; i++) {
        const v = float32Data[i];
        if (v > 0) {
          const scaled = Math.round((v / maxValSafe) * 254.0) + 1.0;
          uint8Data[i] = Math.min(255, Math.max(1, scaled));
        }
      }

      const texture = new THREE.Data3DTexture(uint8Data, dims[0], dims[1], dims[2]);
      texture.format = THREE.RedFormat;
      texture.type = THREE.UnsignedByteType;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.wrapR = THREE.ClampToEdgeWrapping;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;

      const metadata = {
        name: file.name,
        label: `Custom: ${file.name}`,
        format: 'uint8',
        dims: dims,
        origin: [-90.0, -126.0, -72.0],
        spacing: [header.pixDims[1] || 1, header.pixDims[2] || 1, header.pixDims[3] || 1],
        size: [dims[0] * (header.pixDims[1] || 1), dims[1] * (header.pixDims[2] || 1), dims[2] * (header.pixDims[3] || 1)],
        rawMin: rawMin,
        rawMax: rawMax,
        defaultWindow: [parseFloat((rawMin + 0.1 * (rawMax - rawMin)).toFixed(1)), parseFloat((rawMin + 0.7 * (rawMax - rawMin)).toFixed(1))],
        isAtlas: false,
        worldToVolumeTex: worldToVolumeTex.toArray()
      };

      VOLUME_CONFIGS['custom'] = {
        key: 'custom',
        label: `Custom (${file.name})`,
        defaultRawWindow: metadata.defaultWindow,
        sliderMin: Math.floor(rawMin),
        sliderMax: Math.ceil(rawMax),
        step: (rawMax - rawMin > 100) ? 1 : 0.1
      };

      this.cachedVolumes['custom'] = texture;
      this.cachedMetadata['custom'] = metadata;
      this.cachedWorldToVolumeTex['custom'] = worldToVolumeTex.clone();

      this.texture = texture;
      this.currentVolumeType = 'custom';
      this._updateVolumeMetrics(metadata);
      this.worldToVolumeTex.copy(worldToVolumeTex);
      this.isLoaded = true;

      if (onProgress) onProgress({ phase: 'ready', progress: 1.0, message: `Custom volume '${file.name}' loaded!` });
      this.notifyBaseVolumeChange();
      return texture;
    } catch (err) {
      console.error('Failed to load custom base volume from file:', err);
      throw err;
    }
  }

  async reloadCurrentVolume(onProgress = null) {
    const typeKey = this.currentVolumeType;
    if (this.cachedVolumes[typeKey]) {
      this.cachedVolumes[typeKey].dispose();
      delete this.cachedVolumes[typeKey];
    }
    delete this.cachedMetadata[typeKey];
    delete this.cachedWorldToVolumeTex[typeKey];
    await this.load(onProgress, typeKey);
    this.notifyBaseVolumeChange();
    return this.texture;
  }

  onBaseVolumeChange(cb) {
    this.onBaseVolumeChangeCallbacks.push(cb);
  }

  notifyBaseVolumeChange() {
    for (const cb of this.onBaseVolumeChangeCallbacks) {
      cb(this);
    }
  }

  async loadOverlayFromBuffer(rawBuffer, name = 'overlay.nii.gz', onProgress = null) {
    const file = {
      name,
      arrayBuffer: async () => rawBuffer
    };
    return this.loadOverlayFromFile(file, onProgress);
  }

  /**
   * Parses and loads any .nii, .nii.gz, or .gii scalar file as an overlay
   */
  async loadOverlayFromFile(file, onProgress = null) {
    const fileNameLower = file.name.toLowerCase();
    if (fileNameLower.endsWith('.gii') || fileNameLower.endsWith('.gii.gz')) {
      return this.loadGIIOverlayFromFile(file, this.meshManager, onProgress);
    }

    try {
      if (onProgress) onProgress({ progress: 0.2, message: `Reading ${file.name}...` });
      const rawBuffer = await file.arrayBuffer();

      if (onProgress) onProgress({ progress: 0.4, message: 'Parsing NIfTI header...' });
      const reader = nifti;

      let buffer = rawBuffer;
      if (reader.isCompressed(buffer)) {
        if (onProgress) onProgress({ progress: 0.5, message: 'Decompressing gzip...' });
        buffer = reader.decompress(buffer);
      }

      if (!reader.isNIFTI(buffer)) {
        throw new Error('Selected file is not a valid NIfTI volume.');
      }

      const header = reader.readHeader(buffer);
      const dims = [header.dims[1], header.dims[2], header.dims[3]];
      const totalVoxels = dims[0] * dims[1] * dims[2];

      // Construct continuous affine matrix mapping voxel index (i,j,k) to MNI world (X,Y,Z)
      const affine = new THREE.Matrix4();
      if (header.affine && header.affine.length >= 3 && header.affine[0].length >= 4) {
        const a = header.affine;
        const a3 = (a.length >= 4 && a[3]) ? a[3] : [0, 0, 0, 1];
        affine.set(
          a[0][0], a[0][1], a[0][2], a[0][3],
          a[1][0], a[1][1], a[1][2], a[1][3],
          a[2][0], a[2][1], a[2][2], a[2][3],
          a3[0], a3[1], a3[2], a3[3]
        );
      } else {
        const dx = (header.pixDims && header.pixDims[1]) || 1;
        const dy = (header.pixDims && header.pixDims[2]) || 1;
        const dz = (header.pixDims && header.pixDims[3]) || 1;
        affine.set(
          dx, 0, 0, -90,
          0, dy, 0, -126,
          0, 0, dz, -72,
          0, 0, 0, 1
        );
      }

      // S scales normalized UVW coords [0, 1] across the volume dimensions [dims[0], dims[1], dims[2]]
      const S = new THREE.Matrix4().makeScale(dims[0], dims[1], dims[2]);
      // texToWorld = affine * S: maps [u, v, w, 1] -> [X, Y, Z, 1]
      const texToWorld = new THREE.Matrix4().multiplyMatrices(affine, S);
      // worldToOverlayTex = texToWorld^-1: maps [X, Y, Z, 1] -> [u, v, w, 1]
      const worldToOverlayTex = new THREE.Matrix4();
      if (Math.abs(texToWorld.determinant()) > 1e-8) {
        worldToOverlayTex.copy(texToWorld).invert();
      } else {
        worldToOverlayTex.identity();
      }

      if (onProgress) onProgress({ progress: 0.7, message: 'Processing overlay voxels...' });
      const rawImage = reader.readImage(header, buffer);

      // Create typed array based on datatypeCode
      let typedData;
      switch (header.datatypeCode) {
        case 2:
          typedData = new Uint8Array(rawImage);
          break;
        case 256:
          typedData = new Int8Array(rawImage);
          break;
        case 4:
          typedData = new Int16Array(rawImage);
          break;
        case 512:
          typedData = new Uint16Array(rawImage);
          break;
        case 8:
          typedData = new Int32Array(rawImage);
          break;
        case 768:
          typedData = new Uint32Array(rawImage);
          break;
        case 16:
          typedData = new Float32Array(rawImage);
          break;
        case 64:
          typedData = new Float64Array(rawImage);
          break;
        default:
          typedData = new Float32Array(rawImage);
          break;
      }

      const is4D = Boolean(header.dims && header.dims[0] >= 4 && header.dims[4] > 1);
      const numVolumes = is4D ? header.dims[4] : 1;

      const slope = (header.scl_slope && Number.isFinite(header.scl_slope) && header.scl_slope !== 0) ? header.scl_slope : 1.0;
      const inter = (header.scl_inter && Number.isFinite(header.scl_inter)) ? header.scl_inter : 0.0;

      // Extract 3D volume 0
      const float32Overlay = new Float32Array(totalVoxels);
      let posMin = Infinity, posMax = -Infinity;
      let negMin = Infinity, negMax = -Infinity;
      let rawMin = Infinity, rawMax = -Infinity;

      for (let i = 0; i < totalVoxels; i++) {
        const raw = typedData[i];
        if (Number.isFinite(raw) && !isNaN(raw)) {
          const val = raw * slope + inter;
          float32Overlay[i] = val;
          if (val > 1e-4) {
            if (val < posMin) posMin = val;
            if (val > posMax) posMax = val;
          } else if (val < -1e-4) {
            if (val < negMin) negMin = val;
            if (val > negMax) negMax = val;
          }
          if (val < rawMin) rawMin = val;
          if (val > rawMax) rawMax = val;
        } else {
          float32Overlay[i] = 0.0;
        }
      }

      const hasPos = posMax > -Infinity;
      const hasNeg = negMin < Infinity;

      if (onProgress) onProgress({ progress: 0.9, message: 'Creating WebGL 3D overlay textures...' });

      // Primary overlay texture
      const texture = new THREE.Data3DTexture(float32Overlay, dims[0], dims[1], dims[2]);
      texture.format = THREE.RedFormat;
      texture.type = THREE.FloatType;
      texture.internalFormat = 'R32F';
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.wrapR = THREE.ClampToEdgeWrapping;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;

      // Parallel linear contour texture (always LinearFilter to prevent nearest-neighbor derivative checkerboarding)
      const contourTexture = new THREE.Data3DTexture(float32Overlay, dims[0], dims[1], dims[2]);
      contourTexture.format = THREE.RedFormat;
      contourTexture.type = THREE.FloatType;
      contourTexture.internalFormat = 'R32F';
      contourTexture.minFilter = THREE.LinearFilter;
      contourTexture.magFilter = THREE.LinearFilter;
      contourTexture.wrapS = THREE.ClampToEdgeWrapping;
      contourTexture.wrapT = THREE.ClampToEdgeWrapping;
      contourTexture.wrapR = THREE.ClampToEdgeWrapping;
      contourTexture.unpackAlignment = 1;
      contourTexture.needsUpdate = true;

      const overlay = {
        id: 'ov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: file.name,
        type: 'volume',
        enabled: true,
        projectOntoMesh: true,
        dims,
        rawMin: rawMin !== Infinity ? rawMin : 0,
        rawMax: rawMax !== -Infinity ? rawMax : 1,
        rawOverlayData: float32Overlay,
        texture,
        contourTexture,
        worldToOverlayTex,
        is4D,
        numVolumes,
        currentVolumeIndex: 0,
        allTypedData: typedData,
        slope,
        inter,
        totalVoxels,
        interpolate: true,
        hasPos: hasPos || !hasNeg,
        posColormap: 17,
        posMin: hasPos ? parseFloat((posMin + 0.15 * (posMax - posMin)).toFixed(2)) : 1.0,
        posMax: hasPos ? parseFloat(posMax.toFixed(2)) : 5.0,
        posOpacity: 0.85,
        posDataMin: hasPos ? posMin : 0.0,
        posDataMax: hasPos ? posMax : 1.0,
        hasNeg: hasNeg && !hasPos,
        negColormap: 18,
        negMin: hasNeg ? parseFloat((negMax - 0.15 * (negMax - negMin)).toFixed(2)) : -1.0,
        negMax: hasNeg ? parseFloat(negMin.toFixed(2)) : -5.0,
        negOpacity: 0.85,
        negDataMin: hasNeg ? negMin : -1.0,
        negDataMax: hasNeg ? negMax : 0.0,
        showContour: false,
        contourPosActive: false,
        contourPosThresh: hasPos ? parseFloat((posMin + 0.15 * (posMax - posMin)).toFixed(2)) : 2.0,
        contourPosColorHex: '#facc15',
        contourPosColor: new THREE.Vector3(0.98, 0.8, 0.08),
        contourNegActive: false,
        contourNegThresh: hasNeg ? parseFloat((negMax - 0.15 * (negMax - negMin)).toFixed(2)) : -2.0,
        contourNegColorHex: '#38bdf8',
        contourNegColor: new THREE.Vector3(0.22, 0.74, 0.97),
        contourWidth: 2.0,
        projectedMeshScalars: null
      };

      this.addOverlay(overlay);

      if (onProgress) onProgress({ progress: 1.0, message: `Overlay '${file.name}' loaded!${is4D ? ` (4D: ${numVolumes} volumes)` : ''}` });
      return texture;
    } catch (err) {
      console.error('Failed to load overlay:', err);
      throw err;
    }
  }

  setOverlayVolumeIndex(volIndex, ovId = null) {
    const ov = ovId ? this.getOverlay(ovId) : (this.overlays.find(o => o.is4D) || this.overlays[0]);
    if (!ov || !ov.is4D || !ov.allTypedData) return;
    this.extractOverlay3DVolume(volIndex, ov);
  }

  extractOverlay3DVolume(volIndex, ov = null) {
    const target = ov || this.overlays.find(o => o.is4D) || this.overlays[0];
    if (!target || !target.allTypedData) return;

    volIndex = Math.max(0, Math.min(target.numVolumes - 1, parseInt(volIndex, 10) || 0));
    target.currentVolumeIndex = volIndex;

    const totalVoxels = target.totalVoxels;
    const offset = volIndex * totalVoxels;
    const volData = target.allTypedData.subarray(offset, offset + totalVoxels);
    const slope = target.slope;
    const inter = target.inter;

    const float32Overlay = new Float32Array(totalVoxels);
    let posMin = Infinity, posMax = -Infinity;
    let negMin = Infinity, negMax = -Infinity;
    let rawMin = Infinity, rawMax = -Infinity;

    for (let i = 0; i < totalVoxels; i++) {
      const raw = volData[i];
      if (Number.isFinite(raw) && !isNaN(raw)) {
        const val = raw * slope + inter;
        float32Overlay[i] = val;
        if (val > 1e-4) {
          if (val < posMin) posMin = val;
          if (val > posMax) posMax = val;
        } else if (val < -1e-4) {
          if (val < negMin) negMin = val;
          if (val > negMax) negMax = val;
        }
        if (val < rawMin) rawMin = val;
        if (val > rawMax) rawMax = val;
      } else {
        float32Overlay[i] = 0.0;
      }
    }

    const hasPos = posMax > -Infinity;
    const hasNeg = negMin < Infinity;

    target.posDataMin = hasPos ? posMin : 0.0;
    target.posDataMax = hasPos ? posMax : 1.0;
    target.posMin = hasPos ? parseFloat((posMin + 0.15 * (posMax - posMin)).toFixed(2)) : 1.0;
    target.posMax = hasPos ? parseFloat(posMax.toFixed(2)) : 5.0;
    target.hasPos = hasPos || !hasNeg;

    target.negDataMin = hasNeg ? negMin : -1.0;
    target.negDataMax = hasNeg ? negMax : 0.0;
    target.negMin = hasNeg ? parseFloat((negMax - 0.15 * (negMax - negMin)).toFixed(2)) : -1.0;
    target.negMax = hasNeg ? parseFloat(negMin.toFixed(2)) : -5.0;
    target.hasNeg = hasNeg && !hasPos;

    target.contourPosThresh = target.posMin;
    target.contourNegThresh = target.negMin;

    target.rawMin = rawMin !== Infinity ? rawMin : 0;
    target.rawMax = rawMax !== -Infinity ? rawMax : 1;
    target.rawOverlayData = float32Overlay;
    target.projectedMeshScalars = null;

    if (target.texture && target.texture.image) {
      target.texture.image.data = float32Overlay;
      target.texture.needsUpdate = true;
    }
    if (target.contourTexture && target.contourTexture.image) {
      target.contourTexture.image.data = float32Overlay;
      target.contourTexture.needsUpdate = true;
    }

    this._syncLegacyOverlayState();

    if (this.projectOntoMesh && this.meshManager) {
      this.meshManager.updateBrainOverlayColors(this);
    }

    this.notifyOverlayChange();
  }

  // --- Multi-Overlay Management ---

  addOverlay(overlay) {
    if (!overlay.id) {
      overlay.id = 'ov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
    this.overlays.push(overlay);
    this._syncLegacyOverlayState();
    if (this.meshManager && overlay.projectOntoMesh) {
      this.meshManager.updateBrainOverlayColors(this);
    }
    this.notifyOverlayChange();
  }

  removeOverlay(id) {
    const idx = this.overlays.findIndex(o => o.id === id);
    if (idx !== -1) {
      const ov = this.overlays[idx];
      if (ov.texture && ov.texture !== this.dummyTexture) {
        ov.texture.dispose();
      }
      if (ov.contourTexture && ov.contourTexture !== this.dummyTexture) {
        ov.contourTexture.dispose();
      }
      this.overlays.splice(idx, 1);
      this._syncLegacyOverlayState();
      if (this.meshManager) {
        this.meshManager.updateBrainOverlayColors(this);
      }
      this.notifyOverlayChange();
    }
  }

  toggleOverlay(id, enabled) {
    const ov = this.getOverlay(id);
    if (ov) {
      ov.enabled = Boolean(enabled);
      this._syncLegacyOverlayState();
      if (this.meshManager) {
        this.meshManager.updateBrainOverlayColors(this);
      }
      this.notifyOverlayPropertyChange();
    }
  }

  getOverlay(id) {
    return this.overlays.find(o => o.id === id);
  }

  getActiveOverlays() {
    return this.overlays.filter(o => o.enabled);
  }

  clearAllOverlays() {
    for (const ov of this.overlays) {
      if (ov.texture && ov.texture !== this.dummyTexture) {
        ov.texture.dispose();
      }
      if (ov.contourTexture && ov.contourTexture !== this.dummyTexture) {
        ov.contourTexture.dispose();
      }
    }
    this.overlays = [];
    this._syncLegacyOverlayState();
    if (this.meshManager) {
      this.meshManager.clearBrainOverlay();
    }
    this.notifyOverlayChange();
  }

  _syncLegacyOverlayState() {
    const primary = this.overlays.find(o => o.enabled) || this.overlays[0];
    if (primary) {
      this.hasOverlay = true;
      this.overlayType = primary.type;
      this.overlayName = primary.name;
      this.overlayDims = primary.dims || [0, 0, 0];
      this.overlayRawMin = primary.rawMin ?? 0;
      this.overlayRawMax = primary.rawMax ?? 1;
      this.rawOverlayData = primary.rawOverlayData || null;
      this.overlayTexture = primary.texture || this.dummyTexture;
      this.overlayContourTexture = primary.contourTexture || this.overlayTexture || this.dummyTexture;
      if (primary.worldToOverlayTex) {
        this.worldToOverlayTex.copy(primary.worldToOverlayTex);
      }
      this.hasPosOverlay = Boolean(primary.hasPos);
      this.posColormap = primary.posColormap ?? 17;
      this.posMin = primary.posMin ?? 1.0;
      this.posMax = primary.posMax ?? 5.0;
      this.posOpacity = primary.posOpacity ?? 0.85;
      this.posDataMin = primary.posDataMin ?? 0.0;
      this.posDataMax = primary.posDataMax ?? 1.0;

      this.hasNegOverlay = Boolean(primary.hasNeg);
      this.negColormap = primary.negColormap ?? 18;
      this.negMin = primary.negMin ?? -1.0;
      this.negMax = primary.negMax ?? -5.0;
      this.negOpacity = primary.negOpacity ?? 0.85;
      this.negDataMin = primary.negDataMin ?? -1.0;
      this.negDataMax = primary.negDataMax ?? 0.0;

      this.showContour = Boolean(primary.showContour || primary.contourPosActive || primary.contourNegActive);
      this.contourPosActive = Boolean(primary.contourPosActive);
      this.contourNegActive = Boolean(primary.contourNegActive);
      this.contourPosEnabled = this.contourPosActive;
      this.contourNegEnabled = this.contourNegActive;
      this.contourPosThresh = primary.contourPosThresh ?? 2.0;
      this.contourNegThresh = primary.contourNegThresh ?? -2.0;
      this.contourPosColorHex = primary.contourPosColorHex ?? '#facc15';
      this.contourNegColorHex = primary.contourNegColorHex ?? '#38bdf8';
      if (primary.contourPosColor) this.contourPosColor.copy(primary.contourPosColor);
      if (primary.contourNegColor) this.contourNegColor.copy(primary.contourNegColor);
      this.contourWidth = primary.contourWidth ?? 2.0;

      this.overlayInterpolate = primary.interpolate !== false;
      this.projectOntoMesh = primary.projectOntoMesh !== false;
      this.isOverlay4D = Boolean(primary.is4D);
      this.overlayNumVolumes = primary.numVolumes || 1;
      this.overlayCurrentVolumeIndex = primary.currentVolumeIndex || 0;
      this.giftiScalars = primary.giftiScalars || null;
      this.giftiNumVertices = primary.numVertices || 0;
    } else {
      this.hasOverlay = false;
      this.overlayType = null;
      this.overlayName = '';
      this.overlayDims = [0, 0, 0];
      this.overlayRawMin = 0;
      this.overlayRawMax = 1;
      this.rawOverlayData = null;
      this.overlayTexture = this.dummyTexture;
      this.overlayContourTexture = this.dummyTexture;
      this.worldToOverlayTex.identity();
      this.giftiScalars = null;
      this.giftiNumVertices = 0;
      this.showContour = false;
      this.contourPosActive = false;
      this.contourNegActive = false;
      this.contourPosEnabled = false;
      this.contourNegEnabled = false;
    }
  }

  setMeshManager(mm) {
    this.meshManager = mm;
    if (mm) {
      mm.activeVolumeManager = this;
      if (this.hasOverlay && this.projectOntoMesh) {
        mm.updateBrainOverlayColors(this);
      }
    }
  }

  setProjectOntoMesh(enabled, ovId = null) {
    if (ovId) {
      const ov = this.getOverlay(ovId);
      if (ov) ov.projectOntoMesh = Boolean(enabled);
    } else {
      this.projectOntoMesh = Boolean(enabled);
      for (const ov of this.overlays) {
        ov.projectOntoMesh = this.projectOntoMesh;
      }
    }
    if (this.meshManager) {
      this.meshManager.updateBrainOverlayColors(this);
    }
    this.notifyOverlayPropertyChange();
  }

  updateBrainMeshOverlay(mm = this.meshManager) {
    if (!mm) return;
    mm.updateBrainOverlayColors(this);
  }

  /**
   * Evaluates continuous voxel value at world millimeter coordinate (x, y, z)
   * Faithful JavaScript port of Surfice TNIfTI.mm2intensity with non-zero weighting
   */
  sampleOverlayAtWorldMm(x, y, z, ov = null) {
    const rawData = ov ? ov.rawOverlayData : this.rawOverlayData;
    const hasOv = ov ? Boolean(ov.rawOverlayData) : this.hasOverlay;
    if (!rawData || !hasOv) return 0.0;
    const dims = ov ? ov.dims : this.overlayDims;
    if (!dims || dims[0] <= 0 || dims[1] <= 0 || dims[2] <= 0) return 0.0;

    const w2tex = ov ? ov.worldToOverlayTex : this.worldToOverlayTex;
    const m = w2tex.elements;
    const u = m[0] * x + m[4] * y + m[8] * z + m[12];
    const v = m[1] * x + m[5] * y + m[9] * z + m[13];
    const w = m[2] * x + m[6] * y + m[10] * z + m[14];

    if (u < 0 || u > 1 || v < 0 || v > 1 || w < 0 || w > 1) {
      return 0.0;
    }

    const dimX = dims[0];
    const dimY = dims[1];
    const dimZ = dims[2];

    const Xvox = u * dimX;
    const Yvox = v * dimY;
    const Zvox = w * dimZ;

    if (Xvox < 0 || Yvox < 0 || Zvox < 0) return 0.0;
    if (Xvox >= dimX - 1 || Yvox >= dimY - 1 || Zvox >= dimZ - 1) return 0.0;

    const sliceVx = dimX * dimY;
    const img = rawData;

    const interpolate = ov ? (ov.interpolate !== false) : this.overlayInterpolate;
    if (!interpolate) {
      const rx = Math.round(Xvox);
      const ry = Math.round(Yvox);
      const rz = Math.round(Zvox);
      if (rx < 0 || rx >= dimX || ry < 0 || ry >= dimY || rz < 0 || rz >= dimZ) return 0.0;
      return img[rx + ry * dimX + rz * sliceVx] || 0.0;
    }

    const x0 = Math.floor(Xvox);
    const y0 = Math.floor(Yvox);
    const z0 = Math.floor(Zvox);

    const xf1 = Xvox - x0;
    const yf1 = Yvox - y0;
    const zf1 = Zvox - z0;
    const xf0 = 1.0 - xf1;
    const yf0 = 1.0 - yf1;
    const zf0 = 1.0 - zf1;

    const i000 = x0 + y0 * dimX + z0 * sliceVx;
    const i100 = i000 + 1;
    const i010 = i000 + dimX;
    const i110 = i000 + 1 + dimX;
    const i001 = i000 + sliceVx;
    const i101 = i000 + 1 + sliceVx;
    const i011 = i000 + dimX + sliceVx;
    const i111 = i000 + 1 + dimX + sliceVx;

    const v000 = img[i000] || 0.0;
    const v100 = img[i100] || 0.0;
    const v010 = img[i010] || 0.0;
    const v110 = img[i110] || 0.0;
    const v001 = img[i001] || 0.0;
    const v101 = img[i101] || 0.0;
    const v011 = img[i011] || 0.0;
    const v111 = img[i111] || 0.0;

    const nz = (val) => (Math.abs(val) > 1e-5 ? 1.0 : 0.0);

    const w000 = xf0 * yf0 * zf0 * nz(v000);
    const w100 = xf1 * yf0 * zf0 * nz(v100);
    const w010 = xf0 * yf1 * zf0 * nz(v010);
    const w110 = xf1 * yf1 * zf0 * nz(v110);
    const w001 = xf0 * yf0 * zf1 * nz(v001);
    const w101 = xf1 * yf0 * zf1 * nz(v101);
    const w011 = xf0 * yf1 * zf1 * nz(v011);
    const w111 = xf1 * yf1 * zf1 * nz(v111);

    const totalWeight = w000 + w100 + w010 + w110 + w001 + w101 + w011 + w111;
    if (totalWeight < 1e-7) return 0.0;

    const sum = xf0 * yf0 * zf0 * v000 +
                xf1 * yf0 * zf0 * v100 +
                xf0 * yf1 * zf0 * v010 +
                xf1 * yf1 * zf0 * v110 +
                xf0 * yf0 * zf1 * v001 +
                xf1 * yf0 * zf1 * v101 +
                xf0 * yf1 * zf1 * v011 +
                xf1 * yf1 * zf1 * v111;

    return sum / totalWeight;
  }

  sampleVolumeOverlayOnMesh(ov, geom) {
    if (!geom || !ov || ov.type !== 'volume' || !ov.rawOverlayData) return null;
    const posAttr = geom.attributes.position;
    if (!posAttr) return null;
    const vCount = posAttr.count;
    const scalars = new Float32Array(vCount);
    const p = new THREE.Vector3();
    for (let i = 0; i < vCount; i++) {
      p.fromBufferAttribute(posAttr, i);
      scalars[i] = this.sampleOverlayAtWorldMm(p.x, p.y, p.z, ov);
    }
    return scalars;
  }

  projectNiiToBrainMesh(mm = this.meshManager) {
    if (!mm) return;
    for (const ov of this.overlays) {
      if (ov.type === 'volume' && ov.enabled && ov.projectOntoMesh) {
        if (mm.brainGeometry && mm.currentBrainType !== 'none') {
          ov.projectedMeshScalars = this.sampleVolumeOverlayOnMesh(ov, mm.brainGeometry);
        }
      }
    }
    mm.updateBrainOverlayColors(this);
  }

  async loadGIIOverlayFromFile(file, mm = this.meshManager, onProgress = null) {
    try {
      if (onProgress) onProgress({ progress: 0.2, message: `Reading GIfTI ${file.name}...` });
      const rawBuffer = await file.arrayBuffer();

      if (onProgress) onProgress({ progress: 0.5, message: 'Parsing GIfTI scalar data...' });
      const { scalars, numVertices, hemisphere } = parseGIIScalars(rawBuffer);

      if (!scalars || scalars.length === 0) {
        throw new Error('No scalar values found in GIfTI overlay.');
      }

      let detectedHemi = hemisphere;
      const fnLower = file.name.toLowerCase();
      if (!detectedHemi) {
        if (/[\._-](l|lh|left)[\._-]/i.test(fnLower) || fnLower.includes('cortexleft') || fnLower.includes('.l.') || fnLower.includes('hemi-l') || fnLower.includes('lh.') || fnLower.startsWith('lh.')) {
          detectedHemi = 'left';
        } else if (/[\._-](r|rh|right)[\._-]/i.test(fnLower) || fnLower.includes('cortexright') || fnLower.includes('.r.') || fnLower.includes('hemi-r') || fnLower.includes('rh.') || fnLower.startsWith('rh.')) {
          detectedHemi = 'right';
        }
      }

      let finalScalars = scalars;
      let finalNumVertices = numVertices;

      if (mm && mm.brainGeometry) {
        const meshVCount = mm.brainGeometry.attributes.position.count;
        const isBilateral = Boolean(mm.brainGeometry.userData && mm.brainGeometry.userData.isBilateral);
        const hemiCounts = mm.brainGeometry.userData && mm.brainGeometry.userData.hemiVertexCounts;

        const isHalfMesh = (numVertices === Math.floor(meshVCount / 2)) || 
                           (hemiCounts && (numVertices === hemiCounts.left || numVertices === hemiCounts.right));

        if (numVertices !== meshVCount && (isBilateral || isHalfMesh)) {
          // Auto-project single-hemisphere overlay onto bilateral mesh
          const padded = new Float32Array(meshVCount);
          const leftCount = hemiCounts ? hemiCounts.left : Math.floor(meshVCount / 2);
          const side = detectedHemi || 'left';

          if (side === 'right') {
            padded.set(scalars, leftCount);
          } else {
            padded.set(scalars, 0);
          }
          finalScalars = padded;
          finalNumVertices = meshVCount;
          console.log(`[GIfTI Overlay]: Auto-projected ${side} hemisphere (${numVertices} verts) onto bilateral mesh (${meshVCount} verts total).`);
        } else if (numVertices !== meshVCount) {
          alert(`GIfTI overlay has a different number of vertices than the background mesh (${numVertices} vs ${meshVCount}).\n\nHint: First open the matching background mesh (e.g. fsLR32k (Conte69) or fsaverage-164k-pial).`);
          if (onProgress) onProgress({ progress: 1.0, message: `Warning: vertex count mismatch (${numVertices} vs ${meshVCount})` });
        }
      }

      let posMin = Infinity, posMax = -Infinity;
      let negMin = Infinity, negMax = -Infinity;
      let rawMin = Infinity, rawMax = -Infinity;

      for (let i = 0; i < finalScalars.length; i++) {
        const val = finalScalars[i];
        if (Number.isFinite(val) && !isNaN(val)) {
          if (val > 1e-4) {
            if (val < posMin) posMin = val;
            if (val > posMax) posMax = val;
          } else if (val < -1e-4) {
            if (val < negMin) negMin = val;
            if (val > negMax) negMax = val;
          }
          if (val < rawMin) rawMin = val;
          if (val > rawMax) rawMax = val;
        }
      }

      const hasPos = posMax > -Infinity;
      const hasNeg = negMin < Infinity;

      const overlay = {
        id: 'ov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: file.name,
        type: 'gifti_surface',
        enabled: true,
        projectOntoMesh: true,
        giftiScalars: finalScalars,
        originalHemiScalars: scalars,
        numVertices: finalNumVertices,
        hemisphere: detectedHemi,
        rawMin: rawMin !== Infinity ? rawMin : 0,
        rawMax: rawMax !== -Infinity ? rawMax : 1,
        hasPos: hasPos || !hasNeg,
        posColormap: 17,
        posMin: hasPos ? parseFloat((posMin + 0.15 * (posMax - posMin)).toFixed(2)) : 1.0,
        posMax: hasPos ? parseFloat(posMax.toFixed(2)) : 5.0,
        posOpacity: 0.85,
        posDataMin: hasPos ? posMin : 0.0,
        posDataMax: hasPos ? posMax : 1.0,
        hasNeg: hasNeg && !hasPos,
        negColormap: 18,
        negMin: hasNeg ? parseFloat((negMax - 0.15 * (negMax - negMin)).toFixed(2)) : -1.0,
        negMax: hasNeg ? parseFloat(negMin.toFixed(2)) : -5.0,
        negOpacity: 0.85,
        negDataMin: hasNeg ? negMin : -1.0,
        negDataMax: hasNeg ? negMax : 0.0,
        showContour: false,
        contourPosActive: false,
        contourPosThresh: hasPos ? parseFloat((posMin + 0.15 * (posMax - posMin)).toFixed(2)) : 2.0,
        contourPosColorHex: '#facc15',
        contourPosColor: new THREE.Vector3(0.98, 0.8, 0.08),
        contourNegActive: false,
        contourNegThresh: hasNeg ? parseFloat((negMax - 0.15 * (negMax - negMin)).toFixed(2)) : -2.0,
        contourNegColorHex: '#38bdf8',
        contourNegColor: new THREE.Vector3(0.22, 0.74, 0.97),
        contourWidth: 2.0
      };

      this.addOverlay(overlay);

      if (onProgress) onProgress({ progress: 1.0, message: `GIfTI surface overlay '${file.name}' loaded (${finalNumVertices} vertices)!` });
      return finalScalars;
    } catch (err) {
      console.error('Failed to load GIfTI overlay:', err);
      throw err;
    }
  }

  setOverlayInterpolate(enabled, ovId = null) {
    if (ovId) {
      const ov = this.getOverlay(ovId);
      if (ov) {
        ov.interpolate = Boolean(enabled);
        if (ov.texture && ov.texture !== this.dummyTexture) {
          const filter = ov.interpolate ? THREE.LinearFilter : THREE.NearestFilter;
          ov.texture.minFilter = filter;
          ov.texture.magFilter = filter;
          ov.texture.needsUpdate = true;
        }
      }
    } else {
      this.overlayInterpolate = Boolean(enabled);
      for (const ov of this.overlays) {
        ov.interpolate = this.overlayInterpolate;
        if (ov.texture && ov.texture !== this.dummyTexture) {
          const filter = this.overlayInterpolate ? THREE.LinearFilter : THREE.NearestFilter;
          ov.texture.minFilter = filter;
          ov.texture.magFilter = filter;
          ov.texture.needsUpdate = true;
        }
      }
    }
    this._syncLegacyOverlayState();
    this.notifyOverlayPropertyChange();
  }

  clearOverlay() {
    this.clearAllOverlays();
  }

  setContourPosActive(active, ovId = null) {
    if (ovId) {
      const ov = this.getOverlay(ovId);
      if (ov) {
        ov.contourPosActive = Boolean(active);
        ov.showContour = ov.contourPosActive || ov.contourNegActive;
      }
    } else {
      this.contourPosActive = Boolean(active);
      this.contourPosEnabled = this.contourPosActive;
      this.showContour = this.contourPosActive || this.contourNegActive;
      for (const ov of this.overlays) {
        ov.contourPosActive = this.contourPosActive;
        ov.showContour = ov.contourPosActive || ov.contourNegActive;
      }
    }
    this._syncLegacyOverlayState();
    this.notifyOverlayPropertyChange();
  }

  setContourNegActive(active, ovId = null) {
    if (ovId) {
      const ov = this.getOverlay(ovId);
      if (ov) {
        ov.contourNegActive = Boolean(active);
        ov.showContour = ov.contourPosActive || ov.contourNegActive;
      }
    } else {
      this.contourNegActive = Boolean(active);
      this.contourNegEnabled = this.contourNegActive;
      this.showContour = this.contourPosActive || this.contourNegActive;
      for (const ov of this.overlays) {
        ov.contourNegActive = this.contourNegActive;
        ov.showContour = ov.contourPosActive || ov.contourNegActive;
      }
    }
    this._syncLegacyOverlayState();
    this.notifyOverlayPropertyChange();
  }

  setContourPosColor(hex, ovId = null) {
    const c = new THREE.Color(hex);
    if (ovId) {
      const ov = this.getOverlay(ovId);
      if (ov) {
        ov.contourPosColorHex = hex;
        if (!ov.contourPosColor) ov.contourPosColor = new THREE.Vector3();
        ov.contourPosColor.set(c.r, c.g, c.b);
      }
    } else {
      this.contourPosColorHex = hex;
      this.contourPosColor.set(c.r, c.g, c.b);
      for (const ov of this.overlays) {
        ov.contourPosColorHex = hex;
        if (!ov.contourPosColor) ov.contourPosColor = new THREE.Vector3();
        ov.contourPosColor.set(c.r, c.g, c.b);
      }
    }
    this._syncLegacyOverlayState();
    this.notifyOverlayPropertyChange();
  }

  setContourNegColor(hex, ovId = null) {
    const c = new THREE.Color(hex);
    if (ovId) {
      const ov = this.getOverlay(ovId);
      if (ov) {
        ov.contourNegColorHex = hex;
        if (!ov.contourNegColor) ov.contourNegColor = new THREE.Vector3();
        ov.contourNegColor.set(c.r, c.g, c.b);
      }
    } else {
      this.contourNegColorHex = hex;
      this.contourNegColor.set(c.r, c.g, c.b);
      for (const ov of this.overlays) {
        ov.contourNegColorHex = hex;
        if (!ov.contourNegColor) ov.contourNegColor = new THREE.Vector3();
        ov.contourNegColor.set(c.r, c.g, c.b);
      }
    }
    this._syncLegacyOverlayState();
    this.notifyOverlayPropertyChange();
  }

  setContourWidth(width, ovId = null) {
    const w = Math.max(0.5, Math.min(10.0, Number(width) || 2.0));
    if (ovId) {
      const ov = this.getOverlay(ovId);
      if (ov) ov.contourWidth = w;
    } else {
      this.contourWidth = w;
      for (const ov of this.overlays) ov.contourWidth = w;
    }
    this._syncLegacyOverlayState();
    this.notifyOverlayPropertyChange();
  }

  onOverlayPropertyChange(cb) {
    this.onOverlayPropertyChangeCallbacks.push(cb);
  }

  notifyOverlayPropertyChange() {
    this._syncLegacyOverlayState();
    for (const cb of this.onOverlayPropertyChangeCallbacks) {
      cb(this);
    }
  }

  onOverlayChange(cb) {
    this.onOverlayChangeCallbacks.push(cb);
  }

  notifyOverlayChange() {
    this._syncLegacyOverlayState();
    for (const cb of this.onOverlayChangeCallbacks) {
      cb(this);
    }
  }

  getBounds() {
    return {
      min: this.origin.clone(),
      max: this.origin.clone().add(this.size),
      center: this.origin.clone().add(this.size.clone().multiplyScalar(0.5)),
      size: this.size.clone()
    };
  }
}
