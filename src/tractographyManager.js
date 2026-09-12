import * as THREE from 'three';
import { inflate } from 'pako';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { evaluateColormap } from './colormaps.js';
import { fetchBinary } from './dataLoader.js';

/**
 * Built-in Tractography Catalog
 * Categorized into Projection Tracts, Association Tracts, Commissural Tracts, and Cranial Nerves.
 */
export const BUILTIN_TRACTS = [
  // --- Projection Tracts ---
  {
    id: 'cst_l',
    name: 'Corticospinal Tract (CST) - Left',
    shortName: 'CST Left',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/CST_L.trk.gz',
    defaultColorHex: '#3b82f6'
  },
  {
    id: 'cst_r',
    name: 'Corticospinal Tract (CST) - Right',
    shortName: 'CST Right',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/CST_R.trk.gz',
    defaultColorHex: '#60a5fa'
  },
  {
    id: 'ct_l',
    name: 'Corticothalamic Tract (CT) - Left',
    shortName: 'CT Left',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/CT_L.trk.gz',
    defaultColorHex: '#0ea5e9'
  },
  {
    id: 'ct_r',
    name: 'Corticothalamic Tract (CT) - Right',
    shortName: 'CT Right',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/CT_R.trk.gz',
    defaultColorHex: '#38bdf8'
  },
  {
    id: 'ml_l',
    name: 'Medial Lemniscus (ML) - Left',
    shortName: 'ML Left',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/ML_L.trk.gz',
    defaultColorHex: '#06b6d4'
  },
  {
    id: 'ml_r',
    name: 'Medial Lemniscus (ML) - Right',
    shortName: 'ML Right',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/ML_R.trk.gz',
    defaultColorHex: '#22d3ee'
  },
  {
    id: 'stt_l',
    name: 'Spinothalamic Tract (STT) - Left',
    shortName: 'STT Left',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/STT_L.trk.gz',
    defaultColorHex: '#14b8a6'
  },
  {
    id: 'stt_r',
    name: 'Spinothalamic Tract (STT) - Right',
    shortName: 'STT Right',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/STT_R.trk.gz',
    defaultColorHex: '#2dd4bf'
  },
  {
    id: 'or_l',
    name: 'Optic Radiations (OR) - Left',
    shortName: 'OR Left',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/OR_L.trk.gz',
    defaultColorHex: '#eab308'
  },
  {
    id: 'or_r',
    name: 'Optic Radiations (OR) - Right',
    shortName: 'OR Right',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/OR_R.trk.gz',
    defaultColorHex: '#facc15'
  },
  {
    id: 'f_l',
    name: 'Fornix (F) - Left',
    shortName: 'Fornix Left',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/F_L.trk.gz',
    defaultColorHex: '#10b981'
  },
  {
    id: 'f_r',
    name: 'Fornix (F) - Right',
    shortName: 'Fornix Right',
    category: 'projection',
    categoryName: 'Projection Tracts',
    path: 'data/tracts/F_R.trk.gz',
    defaultColorHex: '#34d399'
  },

  // --- Association Tracts ---
  {
    id: 'af_l',
    name: 'Arcuate Fasciculus (AF) - Left',
    shortName: 'AF Left',
    category: 'association',
    categoryName: 'Association Tracts',
    path: 'data/tracts/AF_L.trk.gz',
    defaultColorHex: '#a855f7'
  },
  {
    id: 'af_r',
    name: 'Arcuate Fasciculus (AF) - Right',
    shortName: 'AF Right',
    category: 'association',
    categoryName: 'Association Tracts',
    path: 'data/tracts/AF_R.trk.gz',
    defaultColorHex: '#c084fc'
  },

  // --- Commissural Tracts ---
  {
    id: 'cc_ant',
    name: 'Corpus Callosum - Anterior / Genu',
    shortName: 'CC Anterior / Genu',
    category: 'commissural',
    categoryName: 'Commissural Tracts',
    path: 'data/tracts/CC_ant.trk.gz',
    defaultColorHex: '#ef4444'
  },
  {
    id: 'cc_mid',
    name: 'Corpus Callosum - Body',
    shortName: 'CC Body',
    category: 'commissural',
    categoryName: 'Commissural Tracts',
    path: 'data/tracts/CC_mid.trk.gz',
    defaultColorHex: '#f97316'
  },
  {
    id: 'cc_post',
    name: 'Corpus Callosum - Posterior / Splenium',
    shortName: 'CC Posterior / Splenium',
    category: 'commissural',
    categoryName: 'Commissural Tracts',
    path: 'data/tracts/CC_post.trk.gz',
    defaultColorHex: '#ec4899'
  },

  // --- Cranial Nerves ---
  {
    id: 'cn2_l',
    name: 'CN II (Optic Nerve) - Left',
    shortName: 'CN II Left',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNII_L.trk.gz',
    defaultColorHex: '#fbbf24'
  },
  {
    id: 'cn2_r',
    name: 'CN II (Optic Nerve) - Right',
    shortName: 'CN II Right',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNII_R.trk.gz',
    defaultColorHex: '#fde047'
  },
  {
    id: 'cn3_l',
    name: 'CN III (Oculomotor) - Left',
    shortName: 'CN III Left',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNIII_L.trk.gz',
    defaultColorHex: '#f87171'
  },
  {
    id: 'cn3_r',
    name: 'CN III (Oculomotor) - Right',
    shortName: 'CN III Right',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNIII_R.trk.gz',
    defaultColorHex: '#fca5a5'
  },
  {
    id: 'cn4_l',
    name: 'CN IV (Trochlear) - Left',
    shortName: 'CN IV Left',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNIV_L.trk.gz',
    defaultColorHex: '#fb923c'
  },
  {
    id: 'cn4_r',
    name: 'CN IV (Trochlear) - Right',
    shortName: 'CN IV Right',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNIV_R.trk.gz',
    defaultColorHex: '#fdba74'
  },
  {
    id: 'cn5_l',
    name: 'CN V (Trigeminal) - Left',
    shortName: 'CN V Left',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNV_L.trk.gz',
    defaultColorHex: '#a3e635'
  },
  {
    id: 'cn5_r',
    name: 'CN V (Trigeminal) - Right',
    shortName: 'CN V Right',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNV_R.trk.gz',
    defaultColorHex: '#bef264'
  },
  {
    id: 'cn7_l',
    name: 'CN VII (Facial) - Left',
    shortName: 'CN VII Left',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNVII_L.trk.gz',
    defaultColorHex: '#4ade80'
  },
  {
    id: 'cn7_r',
    name: 'CN VII (Facial) - Right',
    shortName: 'CN VII Right',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNVII_R.trk.gz',
    defaultColorHex: '#86efac'
  },
  {
    id: 'cn8_l',
    name: 'CN VIII (Vestibulocochlear) - Left',
    shortName: 'CN VIII Left',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNVIII_L.trk.gz',
    defaultColorHex: '#2dd4bf'
  },
  {
    id: 'cn8_r',
    name: 'CN VIII (Vestibulocochlear) - Right',
    shortName: 'CN VIII Right',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNVIII_R.trk.gz',
    defaultColorHex: '#5eead4'
  },
  {
    id: 'cn10_l',
    name: 'CN X (Vagus) - Left',
    shortName: 'CN X Left',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNX_L.trk.gz',
    defaultColorHex: '#818cf8'
  },
  {
    id: 'cn10_r',
    name: 'CN X (Vagus) - Right',
    shortName: 'CN X Right',
    category: 'cranial',
    categoryName: 'Cranial Nerves',
    path: 'data/tracts/CNX_R.trk.gz',
    defaultColorHex: '#a5b4fc'
  }
];

export const TRACT_CATEGORIES = [
  { id: 'projection', name: 'Projection Tracts' },
  { id: 'association', name: 'Association Tracts' },
  { id: 'commissural', name: 'Commissural Tracts' },
  { id: 'cranial', name: 'Cranial Nerves' }
];

/**
 * Tractography Manager
 * 
 * Handles loading, parsing, and multi-tract rendering of TrackVis (.trk / .trk.gz) streamlines.
 * Features:
 * - High-speed binary parsing with automatic gzip inflation
 * - Transformation from TrackVis voxel space to MNI scanner RAS+ mm
 * - Multi-tract concurrent loading and visualization
 * - Built-in anatomical tract library (CST, CT, ML, STT, OR, Fornix, AF, CC divided, Cranial Nerves)
 * - Three.js LineSegments2 / LineMaterial for screen-space line thickness (1 - 10px)
 * - Surf Ice style orientation-based directional coloring (Red: L-R, Green: A-P, Blue: I-S)
 * - Colormap gradient mapping differentiated by Surf-Ice principal fiber orientation vector
 * - Colormap min / max contrast stretching and bundle dithering
 * - Superimposition over 3D rendered slice quads (renderOrder = 10, depthTest = true, depthWrite = false)
 * - Synchronized multi-plane clipping with existing clipping planes
 * - Adjustable opacity, line visibility, and streamline subsampling / density (default 10%)
 */
export class TractographyManager {
  constructor(scene, clippingManager, viewer = null) {
    this.scene = scene;
    this.clippingManager = clippingManager;
    this.viewer = viewer;

    // Built-in tracts state (Cranial Nerves enabled by default, others off)
    this.builtinTracts = BUILTIN_TRACTS.map(t => ({
      ...t,
      enabled: (t.category === 'cranial'),
      loading: false,
      loaded: false,
      rawStreamlines: [],
      totalStreamlines: 0,
      totalPoints: 0,
      lineMesh: null,
      geometry: null,
      material: null,
      cachedPositions: null,
      streamlineStats: null,
      maxStreamlineLen: 1.0,
      colorHex: t.defaultColorHex
    }));

    // Custom user-loaded tracts
    this.customTracts = [];

    // Global visualization parameters (Tracts off by default on initial load)
    this.visible = false;
    this.colorMode = 'colormap'; // 'colormap' | 'solid'
    this.solidColor = '#38bdf8';
    this.colormap = 'rgb'; // Default 'rgb' colormap (directional orientation vector)
    this.colormapMetric = 'principal'; // 'principal' | 'angle' | 'lr' | 'ap' | 'is' | 'length'
    this.contrastMin = 0.0;
    this.contrastMax = 1.0;
    this.dither = 0.25;
    this.opacity = 0.85;
    this.lineWidth = 2.0;
    this.clipTracts = false; // Default: do not clip tracts
    this.subsample = 10; // Default 10% tract density (every 10th streamline)

    // Legacy compatibility fields
    this.fileName = '';

    // Register clipping update listener
    if (this.clippingManager) {
      this.clippingManager.onUpdate(() => {
        this.updateClipping();
      });
    }

    // Keep resolution uniform up to date on window resize
    window.addEventListener('resize', () => this.updateResolution());

    this.onLoadedCallbacks = [];
    this.onUpdateCallbacks = [];
  }

  onLoaded(cb) {
    if (typeof cb === 'function') this.onLoadedCallbacks.push(cb);
  }

  onUpdate(cb) {
    if (typeof cb === 'function') this.onUpdateCallbacks.push(cb);
  }

  notifyLoaded() {
    for (const cb of this.onLoadedCallbacks) {
      try { cb(); } catch (err) { console.error(err); }
    }
    this.notifyUpdate();
  }

  notifyUpdate() {
    for (const cb of this.onUpdateCallbacks) {
      try { cb(); } catch (err) { console.error(err); }
    }
  }

  getAllTracts() {
    return [...this.builtinTracts, ...this.customTracts];
  }

  getTract(id) {
    return this.getAllTracts().find(t => t.id === id) || null;
  }

  get hasTracts() {
    return this.getAllTracts().some(t => t.enabled && t.loaded);
  }

  get totalStreamlines() {
    return this.getAllTracts()
      .filter(t => t.enabled && t.loaded)
      .reduce((sum, t) => sum + (t.rawStreamlines?.length || 0), 0);
  }

  get totalPoints() {
    return this.getAllTracts()
      .filter(t => t.enabled && t.loaded)
      .reduce((sum, t) => sum + (t.totalPoints || 0), 0);
  }

  get enabledCount() {
    return this.getAllTracts().filter(t => t.enabled).length;
  }

  /**
   * Parse TrackVis binary .trk / .trk.gz buffer into MNI world coordinates (RAS+)
   */
  parseTRK(arrayBuffer, onProgress = null) {
    let u8 = new Uint8Array(arrayBuffer);

    // Check gzip magic header (0x1f, 0x8b)
    if (u8[0] === 0x1f && u8[1] === 0x8b) {
      if (onProgress) onProgress({ progress: 0.2, message: 'Decompressing gzip tractography...' });
      u8 = inflate(u8);
    }

    if (onProgress) onProgress({ progress: 0.4, message: 'Parsing TrackVis header...' });
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

    const magic = String.fromCharCode(...u8.slice(0, 5));
    if (!magic.startsWith('TRACK')) {
      throw new Error(`Invalid TRK file header magic: expected 'TRACK', got '${magic}'`);
    }

    const n_count = view.getInt32(988, true);
    const n_scalars = view.getInt16(36, true);
    const n_properties = view.getInt16(238, true);

    const voxelSizes = [
      view.getFloat32(12, true) || 1.0,
      view.getFloat32(16, true) || 1.0,
      view.getFloat32(20, true) || 1.0
    ];

    // Read 4x4 vox_to_ras matrix at byte 440
    const m = [];
    let hasVoxToRas = false;
    for (let i = 0; i < 16; i++) {
      const val = view.getFloat32(440 + i * 4, true);
      m.push(val);
      if (Math.abs(val) > 1e-4) hasVoxToRas = true;
    }

    const streamlines = [];
    let offset = 1000;
    let totalPts = 0;

    if (onProgress) onProgress({ progress: 0.6, message: 'Extracting streamlines...' });

    while (offset < u8.byteLength) {
      if (offset + 4 > u8.byteLength) break;
      const n_pts = view.getInt32(offset, true);
      offset += 4;

      if (n_pts <= 0 || n_pts > 200000) break;

      totalPts += n_pts;
      const pts = new Float32Array(n_pts * 3);

      for (let p = 0; p < n_pts; p++) {
        const vx = view.getFloat32(offset, true);
        const vy = view.getFloat32(offset + 4, true);
        const vz = view.getFloat32(offset + 8, true);
        offset += (3 + n_scalars) * 4;

        if (hasVoxToRas) {
          // Shift to voxel center
          const rx = (vx / voxelSizes[0]) - 0.5;
          const ry = (vy / voxelSizes[1]) - 0.5;
          const rz = (vz / voxelSizes[2]) - 0.5;

          // Multiply by vox_to_ras matrix
          pts[p * 3 + 0] = m[0] * rx + m[1] * ry + m[2] * rz + m[3];
          pts[p * 3 + 1] = m[4] * rx + m[5] * ry + m[6] * rz + m[7];
          pts[p * 3 + 2] = m[8] * rx + m[9] * ry + m[10] * rz + m[11];
        } else {
          pts[p * 3 + 0] = vx;
          pts[p * 3 + 1] = vy;
          pts[p * 3 + 2] = vz;
        }
      }

      // Skip streamline properties
      offset += n_properties * 4;
      streamlines.push(pts);
    }

    return {
      streamlines,
      totalPts,
      n_count: n_count > 0 ? n_count : streamlines.length
    };
  }

  /**
   * Load and parse a tract bundle if not already loaded
   */
  async ensureTractLoaded(tract, onProgress = null) {
    if (tract.loaded) return;
    if (tract.loading) return;

    try {
      tract.loading = true;
      this.notifyUpdate();

      if (!tract.path) {
        throw new Error(`No path specified for tract ${tract.name}`);
      }

      if (onProgress) onProgress({ progress: 0.1, message: `Downloading ${tract.name}...` });
      const buffer = await fetchBinary(tract.path);

      if (onProgress) onProgress({ progress: 0.5, message: `Parsing ${tract.name}...` });
      const res = this.parseTRK(buffer, onProgress);

      tract.rawStreamlines = res.streamlines;
      tract.totalStreamlines = res.streamlines.length;
      tract.totalPoints = res.totalPts;
      tract.loaded = true;
    } catch (err) {
      console.error(`Failed to load tract ${tract.name}:`, err);
      tract.error = err.message;
    } finally {
      tract.loading = false;
      this.notifyUpdate();
    }
  }

  /**
   * Toggle a tract on or off
   */
  async setTractEnabled(id, enabled, onProgress = null) {
    const tract = this.getTract(id);
    if (!tract) return;

    if (Boolean(enabled) === tract.enabled) return;

    if (enabled) {
      if (!tract.loaded) {
        await this.ensureTractLoaded(tract, onProgress);
      }
      tract.enabled = true;
      this.buildTractGeometry(tract);
      if (tract.lineMesh) {
        tract.lineMesh.visible = this.visible;
        if (!this.scene.children.includes(tract.lineMesh)) {
          this.scene.add(tract.lineMesh);
        }
      }
    } else {
      tract.enabled = false;
      if (tract.lineMesh) {
        this.scene.remove(tract.lineMesh);
        tract.lineMesh.visible = false;
      }
    }

    this.notifyUpdate();
  }

  /**
   * Quick action: Enable all tracts
   */
  async enableAllTracts() {
    const promises = this.getAllTracts().map(t => this.setTractEnabled(t.id, true));
    await Promise.allSettled(promises);
  }

  /**
   * Quick action: Disable all tracts
   */
  disableAllTracts() {
    for (const tract of this.getAllTracts()) {
      if (tract.enabled) {
        tract.enabled = false;
        if (tract.lineMesh) {
          this.scene.remove(tract.lineMesh);
          tract.lineMesh.visible = false;
        }
      }
    }
    this.notifyUpdate();
  }

  /**
   * Initialize and load default cranial nerves on application startup
   */
  async initDefaultTracts(onProgress = null) {
    const cranialTracts = this.builtinTracts.filter(t => t.category === 'cranial');
    for (const t of cranialTracts) {
      t.enabled = true;
    }
    await Promise.allSettled(cranialTracts.map(async (t) => {
      try {
        await this.ensureTractLoaded(t, onProgress);
        if (t.enabled) {
          this.buildTractGeometry(t);
          if (t.lineMesh) {
            t.lineMesh.visible = this.visible;
            if (!this.scene.children.includes(t.lineMesh)) {
              this.scene.add(t.lineMesh);
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to initialize default tract ${t.name}:`, err);
      }
    }));
    this.notifyUpdate();
  }

  /**
   * Quick action: Enable all Cranial Nerves
   */
  async enableDefaultCranialNerves() {
    const cranialTracts = this.builtinTracts.filter(t => t.category === 'cranial');
    const promises = cranialTracts.map(t => this.setTractEnabled(t.id, true));
    await Promise.allSettled(promises);
  }

  /**
   * Load custom TRK from user file
   */
  async loadTRKFromFile(file, onProgress = null) {
    if (onProgress) onProgress({ progress: 0.1, message: `Reading ${file.name}...` });
    const buffer = await file.arrayBuffer();

    const res = this.parseTRK(buffer, onProgress);

    const customId = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const customTract = {
      id: customId,
      name: file.name,
      shortName: file.name.replace(/\.(trk|gz)$/gi, ''),
      category: 'custom',
      categoryName: 'Custom Uploaded Tracts',
      path: null,
      enabled: true,
      loading: false,
      loaded: true,
      rawStreamlines: res.streamlines,
      totalStreamlines: res.streamlines.length,
      totalPoints: res.totalPts,
      lineMesh: null,
      geometry: null,
      material: null,
      cachedPositions: null,
      streamlineStats: null,
      maxStreamlineLen: 1.0,
      colorHex: '#38bdf8'
    };

    this.fileName = file.name;
    this.customTracts.push(customTract);
    this.buildTractGeometry(customTract);
    if (customTract.lineMesh) {
      customTract.lineMesh.visible = this.visible;
      this.scene.add(customTract.lineMesh);
    }

    this.notifyLoaded();
    return customTract;
  }

  /**
   * Remove a custom tract
   */
  removeCustomTract(id) {
    const idx = this.customTracts.findIndex(t => t.id === id);
    if (idx !== -1) {
      const tract = this.customTracts[idx];
      if (tract.lineMesh) {
        this.scene.remove(tract.lineMesh);
        if (tract.geometry) tract.geometry.dispose();
        if (tract.material) tract.material.dispose();
      }
      this.customTracts.splice(idx, 1);
      this.notifyUpdate();
    }
  }

  /**
   * Set color for a specific tract bundle
   */
  setTractColor(id, hex) {
    const tract = this.getTract(id);
    if (tract) {
      tract.colorHex = hex;
      if (this.colorMode === 'solid') {
        this.updateTractColors(tract);
      }
    }
  }

  /**
   * Calculate vertex colors for a specific tract bundle
   * Implements Surf-Ice principal fiber orientation vector calculation for both RGB orientation
   * and colormap gradient differentiation.
   */
  computeColorsForTract(tract) {
    if (!tract.cachedPositions || !tract.streamlineStats) return null;
    const totalVertices = tract.cachedPositions.length / 3;
    const colors = new Float32Array(totalVertices * 3);

    const solidRGB = new THREE.Color(tract.colorHex || this.solidColor);
    const cMin = Math.min(this.contrastMin, this.contrastMax);
    const cMax = Math.max(this.contrastMin, this.contrastMax);
    const cRange = Math.max(1e-4, cMax - cMin);

    const pseudoRandom = (seed) => {
      const x = Math.sin(seed + 1) * 10000;
      return x - Math.floor(x);
    };

    let vIdx = 0;

    for (let i = 0; i < tract.streamlineStats.length; i++) {
      const stat = tract.streamlineStats[i];
      const { len, dx, dy, dz, segCount } = stat;

      let r = 1.0, g = 1.0, b = 1.0;

      if (this.colorMode === 'solid') {
        r = solidRGB.r;
        g = solidRGB.g;
        b = solidRGB.b;
      } else if (this.colormap === 'rgb' || this.colorMode === 'orientation') {
        // 'rgb': Directional RGB colormap (Red=L/R, Green=A/P, Blue=I/S)
        let baseR = len > 0 ? dx / len : 0.0;
        let baseG = len > 0 ? dy / len : 0.0;
        let baseB = len > 0 ? dz / len : 0.0;

        // Apply contrast stretching across orientation channels if modified
        if (cMin > 0.001 || cMax < 0.999) {
          baseR = Math.max(0.0, Math.min(1.0, (baseR - cMin) / cRange));
          baseG = Math.max(0.0, Math.min(1.0, (baseG - cMin) / cRange));
          baseB = Math.max(0.0, Math.min(1.0, (baseB - cMin) / cRange));
        }

        const factor = (1.0 - this.dither) + this.dither * pseudoRandom(i);
        r = Math.min(1.0, Math.max(0.0, baseR * factor));
        g = Math.min(1.0, Math.max(0.0, baseG * factor));
        b = Math.min(1.0, Math.max(0.0, baseB * factor));
      } else {
        let metricVal = 0.0;

        if (this.colormapMetric === 'principal') {
          // Principal Fiber Orientation differentiation calculated from direction vector:
          // dx = |x0 - x1|, dy = |y0 - y1|, dz = |z0 - z1|
          // (vx, vy, vz) represents unit directional vector in [0, 1] octant (LR, AP, IS)
          const vx = len > 0 ? dx / len : 0.0;
          const vy = len > 0 ? dy / len : 0.0;
          const vz = len > 0 ? dz / len : 0.0;

          // Spherical parameterization mapping the orientation octant continuously onto [0, 1]:
          // - 0.00 = Pure Left - Right (LR)
          // - 0.50 = Pure Anterior - Posterior (AP)
          // - 1.00 = Pure Inferior - Superior (IS)
          const elevation = Math.asin(Math.min(1.0, Math.max(0.0, vz))) / (Math.PI * 0.5); // 0 (axial) to 1 (IS)
          const azimuth = Math.atan2(vy, Math.max(1e-6, vx)) / (Math.PI * 0.5); // 0 (LR) to 1 (AP)
          metricVal = (1.0 - elevation) * (azimuth * 0.5) + elevation * 1.0;
        } else if (this.colormapMetric === 'is') {
          // Inferior - Superior (Z component)
          metricVal = len > 0 ? dz / len : 0.0;
        } else if (this.colormapMetric === 'ap') {
          // Anterior - Posterior (Y component)
          metricVal = len > 0 ? dy / len : 0.0;
        } else if (this.colormapMetric === 'lr') {
          // Left - Right (X component)
          metricVal = len > 0 ? dx / len : 0.0;
        } else if (this.colormapMetric === 'length') {
          // Streamline length
          metricVal = tract.maxStreamlineLen > 0 ? Math.min(1.0, len / tract.maxStreamlineLen) : 0.0;
        } else {
          // 'angle': Elevation angle normalized between 0 (horizontal) and 1 (vertical)
          metricVal = len > 0 ? Math.asin(Math.min(1.0, dz / len)) / (Math.PI * 0.5) : 0.0;
        }

        // Contrast stretching / windowing
        const t = Math.max(0.0, Math.min(1.0, (metricVal - cMin) / cRange));
        const [cr, cg, cb] = evaluateColormap(this.colormap, t);

        // Bundle dithering
        const factor = (1.0 - this.dither) + this.dither * pseudoRandom(i);
        r = Math.min(1.0, Math.max(0.0, cr * factor));
        g = Math.min(1.0, Math.max(0.0, cg * factor));
        b = Math.min(1.0, Math.max(0.0, cb * factor));
      }

      // Fill 2 vertices per segment
      const numVertsInStreamline = segCount * 2;
      for (let v = 0; v < numVertsInStreamline; v++) {
        colors[vIdx * 3 + 0] = r;
        colors[vIdx * 3 + 1] = g;
        colors[vIdx * 3 + 2] = b;
        vIdx++;
      }
    }

    return colors;
  }

  /**
   * Fast color update for a single tract
   */
  updateTractColors(tract) {
    if (!tract.geometry || !tract.cachedPositions) return;
    const colors = this.computeColorsForTract(tract);
    if (colors) {
      tract.geometry.setColors(colors);
    }
  }

  /**
   * Update colors across all active tracts
   */
  updateColors() {
    for (const tract of this.getAllTracts()) {
      if (tract.enabled && tract.loaded) {
        this.updateTractColors(tract);
      }
    }
  }

  /**
   * Build or rebuild geometry for a specific tract bundle
   */
  buildTractGeometry(tract) {
    if (!tract.loaded || !tract.rawStreamlines || tract.rawStreamlines.length === 0) return;

    // Clean up old mesh and geometry
    if (tract.lineMesh) {
      this.scene.remove(tract.lineMesh);
      if (tract.geometry) tract.geometry.dispose();
      tract.lineMesh = null;
    }

    const step = Math.max(1, this.subsample);
    let totalSegments = 0;
    tract.streamlineStats = [];
    let maxLen = 0.0;

    for (let i = 0; i < tract.rawStreamlines.length; i += step) {
      const sl = tract.rawStreamlines[i];
      const n_pts = sl.length / 3;
      if (n_pts < 2) continue;

      const segCount = n_pts - 1;
      totalSegments += segCount;

      const x0 = sl[0], y0 = sl[1], z0 = sl[2];
      const x1 = sl[(n_pts - 1) * 3 + 0];
      const y1 = sl[(n_pts - 1) * 3 + 1];
      const z1 = sl[(n_pts - 1) * 3 + 2];

      const dx = Math.abs(x0 - x1);
      const dy = Math.abs(y0 - y1);
      const dz = Math.abs(z0 - z1);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len > maxLen) maxLen = len;

      tract.streamlineStats.push({ len, dx, dy, dz, segCount });
    }

    tract.maxStreamlineLen = maxLen;
    const totalVertices = totalSegments * 2;
    const positions = new Float32Array(totalVertices * 3);
    let pIdx = 0;

    for (let i = 0; i < tract.rawStreamlines.length; i += step) {
      const sl = tract.rawStreamlines[i];
      const n_pts = sl.length / 3;
      if (n_pts < 2) continue;

      for (let p = 0; p < n_pts - 1; p++) {
        // Vertex 1
        positions[pIdx * 3 + 0] = sl[p * 3 + 0];
        positions[pIdx * 3 + 1] = sl[p * 3 + 1];
        positions[pIdx * 3 + 2] = sl[p * 3 + 2];
        pIdx++;

        // Vertex 2
        positions[pIdx * 3 + 0] = sl[(p + 1) * 3 + 0];
        positions[pIdx * 3 + 1] = sl[(p + 1) * 3 + 1];
        positions[pIdx * 3 + 2] = sl[(p + 1) * 3 + 2];
        pIdx++;
      }
    }

    tract.cachedPositions = positions;

    tract.geometry = new LineSegmentsGeometry();
    tract.geometry.setPositions(positions);

    const colors = this.computeColorsForTract(tract);
    if (colors) {
      tract.geometry.setColors(colors);
    }

    // Determine active clipping planes
    const activePlanes = (this.clipTracts && this.clippingManager && this.clippingManager.globalEnabled)
      ? this.clippingManager.planes.filter(p => p.enabled).map(p => p.threePlane)
      : [];

    if (!tract.material) {
      tract.material = new LineMaterial({
        vertexColors: true,
        transparent: true,
        opacity: this.opacity,
        linewidth: this.lineWidth,
        depthWrite: false,
        depthTest: true,
        clippingPlanes: activePlanes
      });
    } else {
      tract.material.linewidth = this.lineWidth;
      tract.material.opacity = this.opacity;
      tract.material.clippingPlanes = activePlanes;
      tract.material.needsUpdate = true;
    }

    const w = (this.viewer && this.viewer.width) ? this.viewer.width : (window.innerWidth || 800);
    const h = (this.viewer && this.viewer.height) ? this.viewer.height : (window.innerHeight || 600);
    tract.material.resolution.set(w, h);

    tract.lineMesh = new LineSegments2(tract.geometry, tract.material);
    tract.lineMesh.name = `TractographyMesh_${tract.id}`;
    tract.lineMesh.renderOrder = 10;
    tract.lineMesh.frustumCulled = false;
    tract.lineMesh.visible = Boolean(this.visible && tract.enabled);

    if (tract.enabled) {
      this.scene.add(tract.lineMesh);
    }
  }

  /**
   * Update resolution across all active tract materials
   */
  updateResolution() {
    const w = (this.viewer && this.viewer.width) ? this.viewer.width : (window.innerWidth || 800);
    const h = (this.viewer && this.viewer.height) ? this.viewer.height : (window.innerHeight || 600);
    for (const tract of this.getAllTracts()) {
      if (tract.material && tract.material.resolution) {
        tract.material.resolution.set(w, h);
      }
    }
  }

  /**
   * Synchronize multi-plane clipping across all active tract materials
   */
  updateClipping() {
    const activePlanes = (this.clipTracts && this.clippingManager && this.clippingManager.globalEnabled)
      ? this.clippingManager.planes.filter(p => p.enabled).map(p => p.threePlane)
      : [];

    for (const tract of this.getAllTracts()) {
      if (tract.material) {
        tract.material.clippingPlanes = activePlanes;
        tract.material.needsUpdate = true;
      }
    }
  }

  setColorMode(mode) {
    this.colorMode = mode;
    this.updateColors();
  }

  setColormap(colormap) {
    this.colormap = colormap;
    if (this.colorMode !== 'solid') {
      this.updateColors();
    }
  }

  setColormapMetric(metric) {
    this.colormapMetric = metric;
    if (this.colorMode !== 'solid') {
      this.updateColors();
    }
  }

  setContrastMin(val) {
    this.contrastMin = Number(val);
    this.updateColors();
  }

  setContrastMax(val) {
    this.contrastMax = Number(val);
    this.updateColors();
  }

  setDither(val) {
    this.dither = Number(val);
    this.updateColors();
  }

  setSolidColor(hex) {
    this.solidColor = hex;
    if (this.colorMode === 'solid') {
      this.updateColors();
    }
  }

  setOpacity(opacity) {
    this.opacity = Number(opacity);
    for (const tract of this.getAllTracts()) {
      if (tract.material) {
        tract.material.opacity = this.opacity;
        tract.material.needsUpdate = true;
      }
    }
  }

  setLineWidth(width) {
    this.lineWidth = Math.max(0.5, Math.min(20.0, Number(width) || 1.0));
    for (const tract of this.getAllTracts()) {
      if (tract.material) {
        tract.material.linewidth = this.lineWidth;
        tract.material.needsUpdate = true;
      }
    }
    this.updateResolution();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    for (const tract of this.getAllTracts()) {
      if (tract.lineMesh) {
        tract.lineMesh.visible = this.visible && tract.enabled;
      }
    }
  }

  setClipTracts(clip) {
    this.clipTracts = Boolean(clip);
    this.updateClipping();
  }

  setSubsample(subsample) {
    this.subsample = Number(subsample);
    for (const tract of this.getAllTracts()) {
      if (tract.enabled && tract.loaded) {
        this.buildTractGeometry(tract);
      }
    }
  }

  clear() {
    this.disableAllTracts();
    for (const tract of this.getAllTracts()) {
      if (tract.lineMesh) {
        this.scene.remove(tract.lineMesh);
      }
      if (tract.geometry) tract.geometry.dispose();
      if (tract.material) tract.material.dispose();
      tract.lineMesh = null;
      tract.geometry = null;
      tract.material = null;
      tract.rawStreamlines = [];
      tract.cachedPositions = null;
      tract.streamlineStats = null;
      tract.loaded = false;
      tract.loading = false;
    }
    this.customTracts = [];
    this.fileName = '';
    this.notifyUpdate();
  }
}
