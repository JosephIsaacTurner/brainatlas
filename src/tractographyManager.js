import * as THREE from 'three';
import { inflate } from 'pako';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { evaluateColormap } from './colormaps.js';

/**
 * Tractography Manager
 * 
 * Handles loading, parsing, and rendering of TrackVis (.trk / .trk.gz) streamlines.
 * Features:
 * - High-speed binary parsing with automatic gzip inflation
 * - Transformation from TrackVis voxel space to MNI scanner RAS+ mm
 * - Three.js LineSegments2 / LineMaterial for arbitrary screen-space line thickness (1 - 10px)
 * - Surf Ice style orientation-based directional coloring (Red: L-R, Green: A-P, Blue: I-S)
 * - Colormap gradient mapping (Turbo, Viridis, Plasma, Inferno, CoolWarm, Rainbow, Hot, Cool, Red-Yellow, Winters)
 * - Colormap min / max contrast stretching and bundle dithering
 * - Superimposition over 3D rendered slice quads (renderOrder = 10, depthTest = true, depthWrite = false)
 * - Synchronized multi-plane clipping with existing clipping planes
 * - Adjustable opacity, line visibility, and streamline subsampling / density
 */
export class TractographyManager {
  constructor(scene, clippingManager, viewer = null) {
    this.scene = scene;
    this.clippingManager = clippingManager;
    this.viewer = viewer;

    this.hasTracts = false;
    this.fileName = '';
    this.rawStreamlines = []; // Array of Float32Array [x0, y0, z0, x1, y1, z1, ...] in RAS world coordinates
    this.totalStreamlines = 0;
    this.totalPoints = 0;

    // Visualization parameters
    this.visible = true;
    this.colorMode = 'orientation'; // 'orientation' | 'colormap' | 'solid'
    this.solidColor = '#38bdf8';
    this.colormap = 'turbo';
    this.colormapMetric = 'angle'; // 'angle' | 'is' | 'ap' | 'lr' | 'length'
    this.contrastMin = 0.0;
    this.contrastMax = 1.0;
    this.dither = 0.25;
    this.opacity = 0.85;
    this.lineWidth = 2.0;
    this.clipTracts = true;
    this.subsample = 1; // 1 = 100%, 2 = 50%, 4 = 25%, etc.

    this.lineMesh = null;
    this.material = null;
    this.geometry = null;
    this.cachedPositions = null;
    this.streamlineStats = null;
    this.maxStreamlineLen = 1.0;

    // Register clipping update listener
    if (this.clippingManager) {
      this.clippingManager.onUpdate(() => {
        if (this.hasTracts && this.material) {
          this.updateClipping();
        }
      });
    }

    // Keep resolution uniform up to date on window resize
    window.addEventListener('resize', () => this.updateResolution());

    this.onLoadedCallbacks = [];
  }

  onLoaded(cb) {
    if (typeof cb === 'function') this.onLoadedCallbacks.push(cb);
  }

  notifyLoaded() {
    for (const cb of this.onLoadedCallbacks) {
      try { cb(); } catch (err) { console.error(err); }
    }
  }

  /**
   * Parse TrackVis binary .trk / .trk.gz buffer into world coordinates
   */
  parseTRK(arrayBuffer, onProgress = null) {
    let u8 = new Uint8Array(arrayBuffer);

    // Check gzip magic (0x1f, 0x8b)
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

      if (n_pts <= 0 || n_pts > 100000) break;

      totalPts += n_pts;
      const pts = new Float32Array(n_pts * 3);

      for (let p = 0; p < n_pts; p++) {
        const vx = view.getFloat32(offset, true);
        const vy = view.getFloat32(offset + 4, true);
        const vz = view.getFloat32(offset + 8, true);
        offset += (3 + n_scalars) * 4;

        if (hasVoxToRas) {
          // TrackVis voxel coordinates shifted by -0.5 to voxel center
          const rx = (vx / voxelSizes[0]) - 0.5;
          const ry = (vy / voxelSizes[1]) - 0.5;
          const rz = (vz / voxelSizes[2]) - 0.5;

          // Multiply by vox_to_rasmm matrix
          pts[p * 3 + 0] = m[0] * rx + m[1] * ry + m[2] * rz + m[3];
          pts[p * 3 + 1] = m[4] * rx + m[5] * ry + m[6] * rz + m[7];
          pts[p * 3 + 2] = m[8] * rx + m[9] * ry + m[10] * rz + m[11];
        } else {
          pts[p * 3 + 0] = vx;
          pts[p * 3 + 1] = vy;
          pts[p * 3 + 2] = vz;
        }
      }

      // Skip properties
      offset += n_properties * 4;
      streamlines.push(pts);
    }

    return {
      streamlines,
      totalPts,
      n_count: n_count > 0 ? n_count : streamlines.length
    };
  }

  async loadTRKFromFile(file, onProgress = null) {
    if (onProgress) onProgress({ progress: 0.1, message: `Reading ${file.name}...` });
    const buffer = await file.arrayBuffer();
    return this.loadTRKFromBuffer(buffer, file.name, onProgress);
  }

  async loadTRKFromBuffer(buffer, name = 'tractography.trk.gz', onProgress = null) {
    const res = this.parseTRK(buffer, onProgress);

    this.fileName = name;
    this.rawStreamlines = res.streamlines;
    this.totalStreamlines = res.streamlines.length;
    this.totalPoints = res.totalPts;
    this.hasTracts = true;

    // Automatically choose reasonable subsampling for ultra-dense bundles to maintain 60 FPS
    if (this.totalStreamlines > 50000) {
      this.subsample = 4;
    } else if (this.totalStreamlines > 25000) {
      this.subsample = 2;
    } else {
      this.subsample = 1;
    }

    if (onProgress) onProgress({ progress: 0.85, message: 'Generating fiber line geometry...' });
    this.rebuildGeometry();

    if (onProgress) onProgress({ progress: 1.0, message: 'Tractography loaded' });
    this.notifyLoaded();

    return this;
  }

  /**
   * Compute streamline vertex colors based on current colorMode, colormap, and contrast settings
   */
  computeColors() {
    if (!this.cachedPositions || !this.streamlineStats) return null;
    const totalVertices = this.cachedPositions.length / 3;
    const colors = new Float32Array(totalVertices * 3);

    const solidRGB = new THREE.Color(this.solidColor);
    const cMin = Math.min(this.contrastMin, this.contrastMax);
    const cMax = Math.max(this.contrastMin, this.contrastMax);
    const cRange = Math.max(1e-4, cMax - cMin);

    const pseudoRandom = (seed) => {
      const x = Math.sin(seed + 1) * 10000;
      return x - Math.floor(x);
    };

    let vIdx = 0;

    for (let i = 0; i < this.streamlineStats.length; i++) {
      const stat = this.streamlineStats[i];
      const { len, dx, dy, dz, segCount } = stat;

      let r = 1.0, g = 1.0, b = 1.0;

      if (this.colorMode === 'solid') {
        r = solidRGB.r;
        g = solidRGB.g;
        b = solidRGB.b;
      } else if (this.colorMode === 'colormap') {
        let metricVal = 0.0;
        if (this.colormapMetric === 'is') {
          metricVal = len > 0 ? dz / len : 0.0;
        } else if (this.colormapMetric === 'ap') {
          metricVal = len > 0 ? dy / len : 0.0;
        } else if (this.colormapMetric === 'lr') {
          metricVal = len > 0 ? dx / len : 0.0;
        } else if (this.colormapMetric === 'length') {
          metricVal = this.maxStreamlineLen > 0 ? Math.min(1.0, len / this.maxStreamlineLen) : 0.0;
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
      } else {
        // 'orientation' (Surf Ice RGB style: Red=L/R, Green=A/P, Blue=I/S)
        let baseR = len > 0 ? dx / len : 0.0;
        let baseG = len > 0 ? dy / len : 0.0;
        let baseB = len > 0 ? dz / len : 0.0;

        // Apply contrast stretching across orientation channels if modified from default [0, 1]
        if (cMin > 0.001 || cMax < 0.999) {
          baseR = Math.max(0.0, Math.min(1.0, (baseR - cMin) / cRange));
          baseG = Math.max(0.0, Math.min(1.0, (baseG - cMin) / cRange));
          baseB = Math.max(0.0, Math.min(1.0, (baseB - cMin) / cRange));
        }

        const factor = (1.0 - this.dither) + this.dither * pseudoRandom(i);
        r = Math.min(1.0, Math.max(0.0, baseR * factor));
        g = Math.min(1.0, Math.max(0.0, baseG * factor));
        b = Math.min(1.0, Math.max(0.0, baseB * factor));
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
   * Fast path to update colors without reallocating 3D geometry positions
   */
  updateColors() {
    if (!this.hasTracts || !this.geometry || !this.cachedPositions) return;
    const colors = this.computeColors();
    if (colors) {
      this.geometry.setColors(colors);
    }
  }

  rebuildGeometry() {
    if (!this.hasTracts || this.rawStreamlines.length === 0) return;

    // Clean up old mesh and geometry
    if (this.lineMesh) {
      this.scene.remove(this.lineMesh);
      if (this.geometry) this.geometry.dispose();
      this.lineMesh = null;
    }

    const step = Math.max(1, this.subsample);
    let totalSegments = 0;
    this.streamlineStats = [];
    let maxLen = 0.0;

    for (let i = 0; i < this.rawStreamlines.length; i += step) {
      const sl = this.rawStreamlines[i];
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

      this.streamlineStats.push({ len, dx, dy, dz, segCount });
    }

    this.maxStreamlineLen = maxLen;
    const totalVertices = totalSegments * 2;
    const positions = new Float32Array(totalVertices * 3);
    let pIdx = 0;

    for (let i = 0; i < this.rawStreamlines.length; i += step) {
      const sl = this.rawStreamlines[i];
      const n_pts = sl.length / 3;
      if (n_pts < 2) continue;

      for (let p = 0; p < n_pts - 1; p++) {
        // Vertex 1 of segment
        positions[pIdx * 3 + 0] = sl[p * 3 + 0];
        positions[pIdx * 3 + 1] = sl[p * 3 + 1];
        positions[pIdx * 3 + 2] = sl[p * 3 + 2];
        pIdx++;

        // Vertex 2 of segment
        positions[pIdx * 3 + 0] = sl[(p + 1) * 3 + 0];
        positions[pIdx * 3 + 1] = sl[(p + 1) * 3 + 1];
        positions[pIdx * 3 + 2] = sl[(p + 1) * 3 + 2];
        pIdx++;
      }
    }

    this.cachedPositions = positions;

    this.geometry = new LineSegmentsGeometry();
    this.geometry.setPositions(positions);

    const colors = this.computeColors();
    if (colors) {
      this.geometry.setColors(colors);
    }

    if (!this.material) {
      this.material = new LineMaterial({
        vertexColors: true,
        transparent: true,
        opacity: this.opacity,
        linewidth: this.lineWidth,
        depthWrite: false,
        depthTest: true,
        clippingPlanes: []
      });
    } else {
      this.material.linewidth = this.lineWidth;
      this.material.opacity = this.opacity;
    }

    this.updateResolution();
    this.updateClipping();

    this.lineMesh = new LineSegments2(this.geometry, this.material);
    this.lineMesh.name = 'TractographyMesh';
    // renderOrder = 10 ensures fibers render AFTER the volumetric slice quad (renderOrder 2..4),
    // making them clearly visible when superimposed in front of the slice.
    this.lineMesh.renderOrder = 10;
    this.lineMesh.frustumCulled = false;
    this.lineMesh.visible = Boolean(this.visible);

    this.scene.add(this.lineMesh);
  }

  updateResolution() {
    if (this.material && this.material.resolution) {
      const w = (this.viewer && this.viewer.width) ? this.viewer.width : (window.innerWidth || 800);
      const h = (this.viewer && this.viewer.height) ? this.viewer.height : (window.innerHeight || 600);
      this.material.resolution.set(w, h);
    }
  }

  updateClipping() {
    if (!this.material) return;
    if (this.clipTracts && this.clippingManager && this.clippingManager.globalEnabled) {
      this.material.clippingPlanes = this.clippingManager.planes
        .filter(p => p.enabled)
        .map(p => p.threePlane);
    } else {
      this.material.clippingPlanes = [];
    }
    this.material.needsUpdate = true;
  }

  setColorMode(mode) {
    this.colorMode = mode;
    this.updateColors();
  }

  setColormap(colormap) {
    this.colormap = colormap;
    if (this.colorMode === 'colormap') {
      this.updateColors();
    }
  }

  setColormapMetric(metric) {
    this.colormapMetric = metric;
    if (this.colorMode === 'colormap') {
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
    if (this.material) {
      this.material.opacity = this.opacity;
      this.material.needsUpdate = true;
    }
  }

  setLineWidth(width) {
    this.lineWidth = Math.max(0.5, Math.min(20.0, Number(width) || 1.0));
    if (this.material) {
      this.material.linewidth = this.lineWidth;
      this.updateResolution();
      this.material.needsUpdate = true;
    }
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    if (this.lineMesh) {
      this.lineMesh.visible = this.visible;
    }
  }

  setClipTracts(clip) {
    this.clipTracts = Boolean(clip);
    this.updateClipping();
  }

  setSubsample(subsample) {
    this.subsample = Number(subsample);
    this.rebuildGeometry();
  }

  clear() {
    if (this.lineMesh) {
      this.scene.remove(this.lineMesh);
      if (this.geometry) this.geometry.dispose();
      if (this.material) this.material.dispose();
      this.lineMesh = null;
      this.geometry = null;
      this.material = null;
    }
    this.hasTracts = false;
    this.rawStreamlines = [];
    this.cachedPositions = null;
    this.streamlineStats = null;
    this.totalStreamlines = 0;
    this.totalPoints = 0;
    this.fileName = '';
  }
}
