import * as THREE from 'three';
import { createSliceMaterial } from './shaders/sliceShader.js';
import { MarchingSquares } from './marchingSquares.js';

/**
 * Multiplanar Slice Viewer
 * 
 * Synchronized multiplanar reconstruction (MPR) modal viewer.
 * Features:
 * - 3 synchronized slice viewports (Plane 1: Axial, Plane 2: Coronal, Plane 3: Sagittal by default)
 * - Oblique synchronization: When azimuth or elevation changes on any clipping plane, the corresponding view adjusts
 * - Shared WebGL context with base volume (T1/T2/CT/FLASH25), masks, and dual positive/negative overlays
 * - Interactive intersection crosshair lines showing intersections of the planes
 * - Click & drag navigation: Click anywhere on a slice to snap the other two planes to that 3D anatomical position
 * - Mouse wheel slice scrubbing and depth slider controls (-90 to +90 mm)
 * - Real-time MNI coordinate (X, Y, Z) and voxel intensity readouts
 * - Draggable modal window with toggle button in bottom left
 */
export class MultiplanarViewer {
  constructor(volumeManager, clippingManager, uiManager) {
    this.volumeManager = volumeManager;
    this.clippingManager = clippingManager;
    this.uiManager = uiManager;

    this.isOpen = false;
    this.showCrosshairs = true;
    this.hoverPoint = null;
    this.hoverPlaneIndex = -1;

    // Colors matching clipping helpers: Plane 1 (Cyan/Blue), Plane 2 (Emerald/Green), Plane 3 (Amber/Orange)
    this.planeColors = ['#38bdf8', '#4ade80', '#fb923c'];

    this.currentBgColor = this.uiManager ? this.uiManager.bgColorHex : '#121316';
    this.isLight = this.uiManager ? (this.uiManager.themeMode === 'white') : false;

    // 1. Build DOM structure
    this.initDOM();

    // 2. Initialize Three.js WebGL & 2D overlay resources
    this.initWebGL();

    // 3. Register Synchronization Events
    this.initEvents();

    // Initial sync
    this.update();
  }

  initDOM() {
    // A. Bottom-Left Toggle Button (placed above orientation cube)
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = 'btn-multiplanar-toggle';
    this.toggleBtn.className = 'bottom-left-btn';
    this.toggleBtn.setAttribute('title', 'Toggle Multiplanar Slice Viewer');
    this.toggleBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="12" y1="3" x2="12" y2="21"/>
      </svg>
      <span>Multiplanar Slice Viewer</span>
    `;
    document.body.appendChild(this.toggleBtn);

    // B. Modal Dialog Container
    this.modal = document.createElement('div');
    this.modal.id = 'multiplanar-modal';
    this.modal.className = 'multiplanar-modal hidden';
    this.modal.innerHTML = `
      <div class="mp-header" id="mp-header">
        <div class="mp-title-group">
          <div class="mp-title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="12" y1="3" x2="12" y2="21"/>
            </svg>
          </div>
          <div>
            <div class="mp-title">Multiplanar Slice Viewer</div>
            <div class="mp-subtitle">Synchronized Oblique Cross-Sections (Planes 1, 2, 3)</div>
          </div>
        </div>
        <div class="mp-header-actions">
          <label class="mp-checkbox-label" title="Toggle orientation labels, depth readouts, and plane containers for publication view">
            <input type="checkbox" id="mp-labels-toggle" checked />
            <span>Labels</span>
          </label>
          <label class="mp-checkbox-label">
            <input type="checkbox" id="mp-crosshairs-toggle" checked />
            <span>Crosshairs</span>
          </label>
          <button id="mp-reset-btn" class="mp-action-btn" title="Reset all slices to default center">Reset Views</button>
          <button id="mp-close-btn" class="mp-close-btn" title="Close Viewer">✕</button>
        </div>
      </div>

      <div class="mp-body" id="mp-body">
        <canvas id="mp-webgl-canvas" class="mp-webgl-canvas"></canvas>

        <div class="mp-panes-container">
          <!-- Pane 0: Plane 1 (Axial) -->
          <div class="mp-pane" id="mp-pane-0" data-plane="0">
            <div class="mp-pane-header">
              <span class="mp-pane-badge badge-plane1" id="mp-badge-0">Plane 1 (Axial)</span>
              <span class="mp-pane-coords" id="mp-pane-coords-0">Depth: 0 mm</span>
            </div>
            <div class="mp-pane-viewport" id="mp-viewport-0">
              <canvas class="mp-crosshair-canvas" id="mp-crosshair-0"></canvas>
              <div class="mp-orient-label orient-top" id="mp-orient-0-top">A</div>
              <div class="mp-orient-label orient-bottom" id="mp-orient-0-bottom">P</div>
              <div class="mp-orient-label orient-left" id="mp-orient-0-left">L</div>
              <div class="mp-orient-label orient-right" id="mp-orient-0-right">R</div>
            </div>
            <div class="mp-pane-controls">
              <button class="mp-step-btn" id="mp-step-down-0" title="Step -1 mm">‹</button>
              <input type="range" class="mp-depth-slider" id="mp-slider-0" min="-90" max="90" step="1" value="0" />
              <button class="mp-step-btn" id="mp-step-up-0" title="Step +1 mm">›</button>
              <span class="mp-slider-val" id="mp-val-0">0 mm</span>
            </div>
          </div>

          <!-- Pane 1: Plane 2 (Coronal) -->
          <div class="mp-pane" id="mp-pane-1" data-plane="1">
            <div class="mp-pane-header">
              <span class="mp-pane-badge badge-plane2" id="mp-badge-1">Plane 2 (Coronal)</span>
              <span class="mp-pane-coords" id="mp-pane-coords-1">Depth: 0 mm</span>
            </div>
            <div class="mp-pane-viewport" id="mp-viewport-1">
              <canvas class="mp-crosshair-canvas" id="mp-crosshair-1"></canvas>
              <div class="mp-orient-label orient-top" id="mp-orient-1-top">S</div>
              <div class="mp-orient-label orient-bottom" id="mp-orient-1-bottom">I</div>
              <div class="mp-orient-label orient-left" id="mp-orient-1-left">L</div>
              <div class="mp-orient-label orient-right" id="mp-orient-1-right">R</div>
            </div>
            <div class="mp-pane-controls">
              <button class="mp-step-btn" id="mp-step-down-1" title="Step -1 mm">‹</button>
              <input type="range" class="mp-depth-slider" id="mp-slider-1" min="-90" max="90" step="1" value="0" />
              <button class="mp-step-btn" id="mp-step-up-1" title="Step +1 mm">›</button>
              <span class="mp-slider-val" id="mp-val-1">0 mm</span>
            </div>
          </div>

          <!-- Pane 2: Plane 3 (Sagittal) -->
          <div class="mp-pane" id="mp-pane-2" data-plane="2">
            <div class="mp-pane-header">
              <span class="mp-pane-badge badge-plane3" id="mp-badge-2">Plane 3 (Sagittal)</span>
              <span class="mp-pane-coords" id="mp-pane-coords-2">Depth: 0 mm</span>
            </div>
            <div class="mp-pane-viewport" id="mp-viewport-2">
              <canvas class="mp-crosshair-canvas" id="mp-crosshair-2"></canvas>
              <div class="mp-orient-label orient-top" id="mp-orient-2-top">S</div>
              <div class="mp-orient-label orient-bottom" id="mp-orient-2-bottom">I</div>
              <div class="mp-orient-label orient-left" id="mp-orient-2-left">P</div>
              <div class="mp-orient-label orient-right" id="mp-orient-2-right">A</div>
            </div>
            <div class="mp-pane-controls">
              <button class="mp-step-btn" id="mp-step-down-2" title="Step -1 mm">‹</button>
              <input type="range" class="mp-depth-slider" id="mp-slider-2" min="-90" max="90" step="1" value="0" />
              <button class="mp-step-btn" id="mp-step-up-2" title="Step +1 mm">›</button>
              <span class="mp-slider-val" id="mp-val-2">0 mm</span>
            </div>
          </div>
        </div>
      </div>

      <div class="mp-footer">
        <div class="mp-footer-readout">
          <span class="mp-readout-label">Crosshair MNI:</span>
          <div class="mp-mni-inputs" id="mp-mni-inputs" title="Input MNI Coordinates (X, Y, Z in mm)">
            <span class="mp-input-prefix">X:</span>
            <input type="number" step="0.5" id="mp-input-x" class="mp-coord-input" value="0.0" />
            <span class="mp-input-prefix">Y:</span>
            <input type="number" step="0.5" id="mp-input-y" class="mp-coord-input" value="-20.0" />
            <span class="mp-input-prefix">Z:</span>
            <input type="number" step="0.5" id="mp-input-z" class="mp-coord-input" value="10.0" />
            <button id="mp-btn-go-mni" class="mp-go-btn" title="Jump to MNI Coordinate">Go</button>
          </div>
          <div class="mp-copy-wrapper">
            <button id="mp-copy-mni-btn" class="mp-copy-btn" title="Copy MNI coordinates to clipboard" aria-label="Copy MNI coordinates">
              <svg class="mp-copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <span class="mp-copy-tooltip" id="mp-copy-tooltip">Copied!</span>
          </div>
          <span class="mp-readout-sep">|</span>
          <span class="mp-readout-label">Voxel:</span>
          <span class="mp-readout-val" id="mp-voxel-val">—</span>
        </div>
        <div class="mp-footer-hint">Type MNI coords • Click & drag on slices • Mouse wheel to scrub</div>
      </div>
    `;
    document.body.appendChild(this.modal);

    // Cache DOM references
    this.header = this.modal.querySelector('#mp-header');
    this.body = this.modal.querySelector('#mp-body');
    this.webglCanvas = this.modal.querySelector('#mp-webgl-canvas');
    this.closeBtn = this.modal.querySelector('#mp-close-btn');
    this.resetBtn = this.modal.querySelector('#mp-reset-btn');
    this.labelsToggle = this.modal.querySelector('#mp-labels-toggle');
    this.crosshairsToggle = this.modal.querySelector('#mp-crosshairs-toggle');
    this.copyMniBtn = this.modal.querySelector('#mp-copy-mni-btn');
    this.copyTooltip = this.modal.querySelector('#mp-copy-tooltip');
    this.inputX = this.modal.querySelector('#mp-input-x');
    this.inputY = this.modal.querySelector('#mp-input-y');
    this.inputZ = this.modal.querySelector('#mp-input-z');
    this.btnGoMni = this.modal.querySelector('#mp-btn-go-mni');
    this.voxelReadout = this.modal.querySelector('#mp-voxel-val');
    this.showLabels = true;

    this.panes = [];
    for (let i = 0; i < 3; i++) {
      this.panes.push({
        container: this.modal.querySelector(`#mp-pane-${i}`),
        badge: this.modal.querySelector(`#mp-badge-${i}`),
        coords: this.modal.querySelector(`#mp-pane-coords-${i}`),
        viewport: this.modal.querySelector(`#mp-viewport-${i}`),
        crosshairCanvas: this.modal.querySelector(`#mp-crosshair-${i}`),
        crosshairCtx: this.modal.querySelector(`#mp-crosshair-${i}`).getContext('2d'),
        slider: this.modal.querySelector(`#mp-slider-${i}`),
        sliderVal: this.modal.querySelector(`#mp-val-${i}`),
        stepDown: this.modal.querySelector(`#mp-step-down-${i}`),
        stepUp: this.modal.querySelector(`#mp-step-up-${i}`),
        orient: {
          top: this.modal.querySelector(`#mp-orient-${i}-top`),
          bottom: this.modal.querySelector(`#mp-orient-${i}-bottom`),
          left: this.modal.querySelector(`#mp-orient-${i}-left`),
          right: this.modal.querySelector(`#mp-orient-${i}-right`)
        }
      });
    }
  }

  initWebGL() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.webglCanvas,
      alpha: false,
      antialias: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.updateTheme();

    this.scenes = [];
    this.cameras = [];
    this.materials = [];
    this.quads = [];

    // Orthographic FOV: 230x230 mm comfortably encompasses whole brain volume (approx 181x217x181 mm)
    const halfExtent = 115;
    const geom = new THREE.PlaneGeometry(320, 320, 1, 1);

    for (let i = 0; i < 3; i++) {
      const scene = new THREE.Scene();

      const camera = new THREE.OrthographicCamera(
        -halfExtent, halfExtent,
        halfExtent, -halfExtent,
        0.1, 1000
      );

      // Create slice material without clipping discard (always renders full slice cross-section)
      const material = createSliceMaterial(null, i);
      material.uniforms.uGlobalClipEnabled.value = false;

      const quad = new THREE.Mesh(geom, material);
      quad.frustumCulled = false;
      scene.add(quad);

      this.scenes.push(scene);
      this.cameras.push(camera);
      this.materials.push(material);
      this.quads.push(quad);
    }

    this.raycaster = new THREE.Raycaster();
  }

  initEvents() {
    // 1. Bottom-Left Toggle Button
    this.toggleBtn.addEventListener('click', () => {
      this.toggle();
    });

    // 2. Modal Close Button & Esc Key
    this.closeBtn.addEventListener('click', () => {
      this.hide();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.hide();
      }
    });

    // 3. Labels Toggle (Minimalistic Publication Mode)
    this.labelsToggle.addEventListener('change', (e) => {
      this.showLabels = Boolean(e.target.checked);
      if (this.showLabels) {
        this.modal.classList.remove('mp-minimal');
      } else {
        this.modal.classList.add('mp-minimal');
      }
      this.updateTheme();
      this.updateCameraBounds();
      this.render();
      this.renderCrosshairs();
    });

    // 4. Crosshairs Toggle Checkbox
    this.crosshairsToggle.addEventListener('change', (e) => {
      this.showCrosshairs = Boolean(e.target.checked);
      this.renderCrosshairs();
    });

    // 5. Copy MNI Coordinates Button
    this.copyMniBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.copyTooltip) {
        this.copyTooltip.classList.add('visible');
        if (this._copyTimer) clearTimeout(this._copyTimer);
        this._copyTimer = setTimeout(() => {
          this.copyTooltip.classList.remove('visible');
        }, 2000);
      }

      const x = this.inputX ? this.inputX.value : '0.0';
      const y = this.inputY ? this.inputY.value : '0.0';
      const z = this.inputZ ? this.inputZ.value : '0.0';
      const textToCopy = `X: ${x}, Y: ${y}, Z: ${z} mm`;
      let copied = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {
        copied = false;
      }

      if (!copied && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).catch(() => {});
      }
    });

    // 5b. MNI Coordinate Input Fields & Go Button
    const handleMniInputSubmit = () => {
      const x = parseFloat(this.inputX.value);
      const y = parseFloat(this.inputY.value);
      const z = parseFloat(this.inputZ.value);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        this.goToMNICoordinates(x, y, z);
      }
    };

    if (this.btnGoMni) {
      this.btnGoMni.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMniInputSubmit();
      });
    }

    const handleCoordKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleMniInputSubmit();
        e.target.blur();
      }
    };

    if (this.inputX) {
      this.inputX.addEventListener('keydown', handleCoordKeyDown);
      this.inputX.addEventListener('change', handleMniInputSubmit);
    }
    if (this.inputY) {
      this.inputY.addEventListener('keydown', handleCoordKeyDown);
      this.inputY.addEventListener('change', handleMniInputSubmit);
    }
    if (this.inputZ) {
      this.inputZ.addEventListener('keydown', handleCoordKeyDown);
      this.inputZ.addEventListener('change', handleMniInputSubmit);
    }

    // 6. Reset Views Button
    this.resetBtn.addEventListener('click', () => {
      this.resetSlices();
    });

    // 7. Resize Observer for smooth distortion-free pane scaling
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.isOpen) {
          this.updateCameraBounds();
          this.render();
        }
      });
      this.resizeObserver.observe(this.body);
    }

    // 5. Draggable Modal Window
    let isDraggingModal = false;
    let dragStartX = 0, dragStartY = 0;
    let initialLeft = 0, initialTop = 0;

    this.header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.mp-header-actions')) return;
      isDraggingModal = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = this.modal.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      this.header.setPointerCapture(e.pointerId);
    });

    this.header.addEventListener('pointermove', (e) => {
      if (!isDraggingModal) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      this.modal.style.left = `${Math.max(20, Math.min(window.innerWidth - 100, initialLeft + dx))}px`;
      this.modal.style.top = `${Math.max(20, Math.min(window.innerHeight - 100, initialTop + dy))}px`;
      this.modal.style.transform = 'none';
    });

    this.header.addEventListener('pointerup', (e) => {
      if (isDraggingModal) {
        isDraggingModal = false;
        try { this.header.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });

    // 6. Pane Controls (Slider, Steps, Wheel Scrubbing, and Click-to-Crosshair)
    for (let i = 0; i < 3; i++) {
      const pane = this.panes[i];
      const plane = this.clippingManager.planes[i];

      // Slider scrub
      pane.slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.clippingManager.setPlaneMNICoord(plane, val);
        if (this.uiManager) {
          this.uiManager.updateHUD();
          for (const p of this.clippingManager.planes) {
            if (p._updateDepthLabel) p._updateDepthLabel();
          }
          for (const ctrl of this.uiManager.planeControllers || []) ctrl.updateDisplay();
        }
        this.update();
      });

      // Step buttons
      pane.stepDown.addEventListener('click', () => {
        const curInfo = this.clippingManager.getPlaneMNIInfo(plane);
        this.clippingManager.setPlaneMNICoord(plane, curInfo.coord - 1);
        if (this.uiManager) {
          this.uiManager.updateHUD();
          for (const p of this.clippingManager.planes) {
            if (p._updateDepthLabel) p._updateDepthLabel();
          }
          for (const ctrl of this.uiManager.planeControllers || []) ctrl.updateDisplay();
        }
        this.update();
      });

      pane.stepUp.addEventListener('click', () => {
        const curInfo = this.clippingManager.getPlaneMNIInfo(plane);
        this.clippingManager.setPlaneMNICoord(plane, curInfo.coord + 1);
        if (this.uiManager) {
          this.uiManager.updateHUD();
          for (const p of this.clippingManager.planes) {
            if (p._updateDepthLabel) p._updateDepthLabel();
          }
          for (const ctrl of this.uiManager.planeControllers || []) ctrl.updateDisplay();
        }
        this.update();
      });

      // Mouse wheel scrub
      pane.viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const curInfo = this.clippingManager.getPlaneMNIInfo(plane);
        this.clippingManager.setPlaneMNICoord(plane, curInfo.coord + delta);
        if (this.uiManager) {
          this.uiManager.updateHUD();
          for (const p of this.clippingManager.planes) {
            if (p._updateDepthLabel) p._updateDepthLabel();
          }
          for (const ctrl of this.uiManager.planeControllers || []) ctrl.updateDisplay();
        }
        this.update();
      }, { passive: false });

      // Click & drag navigation on slice
      let isCrosshairNavigating = false;

      const handleNavPointer = (e) => {
        const rect = pane.crosshairCanvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        if (px < 0 || px > rect.width || py < 0 || py > rect.height) return;

        const ndcX = (px / rect.width) * 2 - 1;
        const ndcY = -(py / rect.height) * 2 + 1;

        this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.cameras[i]);

        const hitPoint = new THREE.Vector3();
        const hit = this.raycaster.ray.intersectPlane(plane.threePlane, hitPoint);

        if (hit) {
          // Snap the OTHER two planes to pass through hitPoint
          for (let j = 0; j < 3; j++) {
            if (j === i) continue;
            const otherPlane = this.clippingManager.planes[j];
            const n0 = otherPlane.normal0 || this.clippingManager.sph2cartDeg90x(otherPlane.azimuth, otherPlane.elevation, 1.0);
            const newDepth = n0.dot(hitPoint.clone().sub(this.clippingManager.brainCenter));
            otherPlane.depth = Math.round(newDepth * 10) / 10;
          }

          this.clippingManager.update();
          if (this.uiManager) {
            this.uiManager.updateHUD();
            for (const p of this.clippingManager.planes) {
              if (p._updateDepthLabel) p._updateDepthLabel();
            }
            for (const ctrl of this.uiManager.planeControllers || []) ctrl.updateDisplay();
          }
          this.update();
          this.updateVoxelReadout(hitPoint);
        }
      };

      pane.crosshairCanvas.addEventListener('pointerdown', (e) => {
        isCrosshairNavigating = true;
        pane.crosshairCanvas.setPointerCapture(e.pointerId);
        handleNavPointer(e);
      });

      pane.crosshairCanvas.addEventListener('pointermove', (e) => {
        if (isCrosshairNavigating) {
          handleNavPointer(e);
        } else {
          // Hover coordinate & voxel query
          const rect = pane.crosshairCanvas.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          const ndcX = (px / rect.width) * 2 - 1;
          const ndcY = -(py / rect.height) * 2 + 1;
          this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.cameras[i]);
          const hitPoint = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(plane.threePlane, hitPoint)) {
            this.updateVoxelReadout(hitPoint);
          }
        }
      });

      pane.crosshairCanvas.addEventListener('pointerup', (e) => {
        if (isCrosshairNavigating) {
          isCrosshairNavigating = false;
          try { pane.crosshairCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      });

      pane.crosshairCanvas.addEventListener('pointerleave', () => {
        if (!isCrosshairNavigating) {
          this.updateVoxelReadout(this.getCrosshairIntersectionPoint());
        }
      });
    }

    // 7. Synchronize when Clipping Manager or Volumes change
    this.clippingManager.onUpdate(() => {
      if (this.isOpen) {
        this.syncVolumeTextures();
        this.update();
      }
    });

    this.volumeManager.onBaseVolumeChange(() => {
      this.syncVolumeTextures();
      if (this.isOpen) this.update();
    });

    this.volumeManager.onOverlayChange(() => {
      this.syncOverlayUniforms();
      if (this.isOpen) this.update();
    });
  }

  show() {
    this.isOpen = true;
    this.modal.classList.remove('hidden');
    this.toggleBtn.classList.add('active');

    // On initial display, set explicit pixel bounds so CSS resize works without jumping
    if (!this._hasBeenPositioned) {
      const modalWidth = Math.min(980, Math.floor(window.innerWidth * 0.94));
      const modalHeight = Math.min(480, Math.floor(window.innerHeight * 0.8));
      this.modal.style.width = `${modalWidth}px`;
      this.modal.style.height = `${modalHeight}px`;
      this.modal.style.left = `${Math.max(20, Math.floor((window.innerWidth - modalWidth) / 2))}px`;
      this.modal.style.top = `${Math.max(20, Math.floor((window.innerHeight - modalHeight) / 2))}px`;
      this.modal.style.transform = 'none';
      this._hasBeenPositioned = true;
    }

    this.updateTheme();
    this.syncVolumeTextures();
    this.update();
    this.updateCameraBounds();
    this.render();
  }

  hide() {
    this.isOpen = false;
    this.modal.classList.add('hidden');
    this.toggleBtn.classList.remove('active');
  }

  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Synchronizes the multiplanar viewer's background and theme with the overall application theme.
   * When Labels toggle is enabled, the overall background theme and color apply.
   * When Labels toggle is disabled (minimal publication view), it remains a pure black canvas.
   */
  updateTheme(bgColor = null, isLight = null) {
    if (bgColor) this.currentBgColor = bgColor;
    else if (!this.currentBgColor && this.uiManager) this.currentBgColor = this.uiManager.bgColorHex;

    if (isLight !== null) {
      this.isLight = Boolean(isLight);
    } else if (this.currentBgColor) {
      const c = new THREE.Color(this.currentBgColor);
      this.isLight = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 0.5;
    } else if (this.uiManager) {
      this.isLight = (this.uiManager.themeMode === 'white');
    }

    const bgHex = this.currentBgColor || '#121316';

    if (this.showLabels) {
      // Overall background theme applies to multiplanar viewer when Labels toggle is enabled
      if (this.renderer) {
        this.renderer.setClearColor(new THREE.Color(bgHex), 1.0);
      }
      if (this.body) {
        this.body.style.backgroundColor = bgHex;
      }
      this.modal.classList.toggle('theme-white', Boolean(this.isLight));
      this.modal.style.setProperty('--mp-bg-color', bgHex);
    } else {
      // Minimalist / Publication view: pure black canvas
      if (this.renderer) {
        this.renderer.setClearColor(0x000000, 1.0);
      }
      if (this.body) {
        this.body.style.backgroundColor = '#000000';
      }
      this.modal.classList.remove('theme-white');
    }

    if (this.isOpen) {
      this.render();
      this.renderCrosshairs();
    }
  }

  updateCameraBounds() {
    for (let i = 0; i < 3; i++) {
      const pane = this.panes[i];
      if (!pane || !pane.viewport) continue;
      const vpRect = pane.viewport.getBoundingClientRect();
      if (vpRect.width <= 0 || vpRect.height <= 0) continue;

      const aspect = vpRect.width / vpRect.height;
      const baseHalfExtent = 115;
      const camera = this.cameras[i];
      if (!camera) continue;

      let leftVal, rightVal, topVal, bottomVal;
      if (aspect >= 1.0) {
        leftVal = -baseHalfExtent * aspect;
        rightVal = baseHalfExtent * aspect;
        topVal = baseHalfExtent;
        bottomVal = -baseHalfExtent;
      } else {
        leftVal = -baseHalfExtent;
        rightVal = baseHalfExtent;
        topVal = baseHalfExtent / aspect;
        bottomVal = -baseHalfExtent / aspect;
      }

      if (Math.abs(camera.left - leftVal) > 1e-3 ||
          Math.abs(camera.right - rightVal) > 1e-3 ||
          Math.abs(camera.top - topVal) > 1e-3 ||
          Math.abs(camera.bottom - bottomVal) > 1e-3) {
        camera.left = leftVal;
        camera.right = rightVal;
        camera.top = topVal;
        camera.bottom = bottomVal;
        camera.updateProjectionMatrix();
      }
    }
  }

  /**
   * Redirects the clipping planes to intersect exactly at the specified MNI coordinate
   * @param {number} x - MNI X (mm)
   * @param {number} y - MNI Y (mm)
   * @param {number} z - MNI Z (mm)
   */
  goToMNICoordinates(x, y, z) {
    const targetPoint = new THREE.Vector3(x, y, z);
    const cm = this.clippingManager;
    for (let j = 0; j < 3; j++) {
      const plane = cm.planes[j];
      const n0 = plane.normal0 || cm.sph2cartDeg90x(plane.azimuth, plane.elevation, 1.0);
      const newDepth = n0.dot(targetPoint.clone().sub(cm.brainCenter));
      plane.depth = Math.round(newDepth * 10) / 10;
    }
    cm.update();
    if (this.uiManager) {
      this.uiManager.updateHUD();
      for (const p of cm.planes) {
        if (p._updateDepthLabel) p._updateDepthLabel();
      }
      for (const ctrl of this.uiManager.planeControllers || []) {
        ctrl.updateDisplay();
      }
    }
    this.update();
    this.updateVoxelReadout(targetPoint);
  }

  resetSlices() {
    // Reset all planes to default: Plane 1 (Axial, 0 mm), Plane 2 (Coronal, 0 mm), Plane 3 (Sagittal, 0 mm)
    this.clippingManager.planes[0].azimuth = 0;
    this.clippingManager.planes[0].elevation = -90;
    this.clippingManager.planes[0].depth = 0;

    this.clippingManager.planes[1].azimuth = 180;
    this.clippingManager.planes[1].elevation = 0;
    this.clippingManager.planes[1].depth = 0;

    this.clippingManager.planes[2].azimuth = 90;
    this.clippingManager.planes[2].elevation = 0;
    this.clippingManager.planes[2].depth = 0;

    this.clippingManager.update();
    if (this.uiManager) {
      this.uiManager.updateHUD();
      for (const p of this.clippingManager.planes) {
        if (p._updateDepthLabel) p._updateDepthLabel();
      }
      for (const ctrl of this.uiManager.planeControllers || []) {
        ctrl.updateDisplay();
      }
    }
    this.update();
  }

  syncVolumeTextures() {
    const vm = this.volumeManager;
    const cm = this.clippingManager;

    for (let i = 0; i < 3; i++) {
      const mat = this.materials[i];
      if (!mat || !mat.uniforms) continue;
      const u = mat.uniforms;

      u.uVolume.value = vm.texture;
      u.uWorldToVolumeTex.value.copy(vm.worldToVolumeTex);
      u.uOrigin.value.copy(vm.origin);
      u.uSize.value.copy(vm.size);

      // Mask uniforms
      if (!cm.maskMode || cm.maskMode === 'none') {
        u.uMaskMode.value = 0;
        u.uMaskVolume.value = vm.dummyMaskTexture;
      } else if (cm.maskMode === 'nonzero') {
        u.uMaskMode.value = 2;
        u.uMaskVolume.value = vm.dummyMaskTexture;
        if (u.uThreshold) u.uThreshold.value = 0.0001;
      } else if (cm.maskMode === 'threshold') {
        u.uMaskMode.value = 2;
        u.uMaskVolume.value = vm.dummyMaskTexture;
        if (u.uThreshold) u.uThreshold.value = cm.getNormalizedMaskThreshold();
      } else {
        u.uMaskMode.value = 1;
        u.uMaskVolume.value = vm.getMaskTexture(cm.maskMode);
        u.uWorldToMaskTex.value.copy(vm.getMaskWorldToTex(cm.maskMode));
        u.uMaskThreshold.value = 0.5;
      }

      this.syncOverlayUniformsForMaterial(mat);
      mat.needsUpdate = true;
    }
  }

  syncOverlayUniforms() {
    for (let i = 0; i < 3; i++) {
      this.syncOverlayUniformsForMaterial(this.materials[i]);
    }
  }

  syncOverlayUniformsForMaterial(mat) {
    if (!mat || !mat.uniforms) return;
    const u = mat.uniforms;
    const vm = this.volumeManager;

    const activeVolOverlays = (vm.overlays || []).filter(o => o.enabled && o.type === 'volume');
    const numVolOverlays = Math.min(4, activeVolOverlays.length);

    if (u.uNumOverlays) u.uNumOverlays.value = numVolOverlays;

    // Multi-overlay arrays (up to 4)
    for (let i = 0; i < 4; i++) {
      if (i < numVolOverlays) {
        const ov = activeVolOverlays[i];
        if (u.uMultiOverlayActive) u.uMultiOverlayActive.value[i] = true;
        if (u.uMultiOverlayVolume) u.uMultiOverlayVolume.value[i] = ov.texture || vm.dummyTexture;
        if (u.uMultiOverlayContourVolume) u.uMultiOverlayContourVolume.value[i] = ov.contourTexture || ov.texture || vm.dummyTexture;
        if (u.uMultiWorldToOverlayTex && u.uMultiWorldToOverlayTex.value[i]) {
          u.uMultiWorldToOverlayTex.value[i].copy(ov.worldToOverlayTex);
        }
        if (u.uMultiOverlayHasPos) u.uMultiOverlayHasPos.value[i] = Boolean(ov.hasPos);
        if (u.uMultiOverlayPosColormap) u.uMultiOverlayPosColormap.value[i] = ov.posColormap ?? 17;
        if (u.uMultiOverlayPosMin) u.uMultiOverlayPosMin.value[i] = ov.posMin ?? 1.0;
        if (u.uMultiOverlayPosMax) u.uMultiOverlayPosMax.value[i] = ov.posMax ?? 5.0;
        if (u.uMultiOverlayPosOpacity) u.uMultiOverlayPosOpacity.value[i] = ov.posOpacity ?? 0.85;

        if (u.uMultiOverlayHasNeg) u.uMultiOverlayHasNeg.value[i] = Boolean(ov.hasNeg);
        if (u.uMultiOverlayNegColormap) u.uMultiOverlayNegColormap.value[i] = ov.negColormap ?? 18;
        if (u.uMultiOverlayNegMin) u.uMultiOverlayNegMin.value[i] = ov.negMin ?? -1.0;
        if (u.uMultiOverlayNegMax) u.uMultiOverlayNegMax.value[i] = ov.negMax ?? -5.0;
        if (u.uMultiOverlayNegOpacity) u.uMultiOverlayNegOpacity.value[i] = ov.negOpacity ?? 0.85;

        const hasContour = Boolean(ov.showContour || ov.contourPosActive || ov.contourNegActive);
        if (u.uMultiOverlayShowContour) u.uMultiOverlayShowContour.value[i] = hasContour;
        if (u.uMultiOverlayContourPosActive) u.uMultiOverlayContourPosActive.value[i] = Boolean(ov.contourPosActive);
        if (u.uMultiOverlayContourPosThresh) u.uMultiOverlayContourPosThresh.value[i] = ov.contourPosThresh ?? 2.0;
        if (u.uMultiOverlayContourPosColor && u.uMultiOverlayContourPosColor.value[i] && ov.contourPosColor) {
          u.uMultiOverlayContourPosColor.value[i].copy(ov.contourPosColor);
        }
        if (u.uMultiOverlayContourNegActive) u.uMultiOverlayContourNegActive.value[i] = Boolean(ov.contourNegActive);
        if (u.uMultiOverlayContourNegThresh) u.uMultiOverlayContourNegThresh.value[i] = ov.contourNegThresh ?? -2.0;
        if (u.uMultiOverlayContourNegColor && u.uMultiOverlayContourNegColor.value[i] && ov.contourNegColor) {
          u.uMultiOverlayContourNegColor.value[i].copy(ov.contourNegColor);
        }
        if (u.uMultiOverlayContourWidth) u.uMultiOverlayContourWidth.value[i] = ov.contourWidth ?? 2.0;
      } else {
        if (u.uMultiOverlayActive) u.uMultiOverlayActive.value[i] = false;
        if (u.uMultiOverlayVolume) u.uMultiOverlayVolume.value[i] = vm.dummyTexture;
        if (u.uMultiOverlayContourVolume) u.uMultiOverlayContourVolume.value[i] = vm.dummyTexture;
        if (u.uMultiOverlayHasPos) u.uMultiOverlayHasPos.value[i] = false;
        if (u.uMultiOverlayHasNeg) u.uMultiOverlayHasNeg.value[i] = false;
        if (u.uMultiOverlayShowContour) u.uMultiOverlayShowContour.value[i] = false;
        if (u.uMultiOverlayContourPosActive) u.uMultiOverlayContourPosActive.value[i] = false;
        if (u.uMultiOverlayContourNegActive) u.uMultiOverlayContourNegActive.value[i] = false;
      }
    }

    // Populate legacy single-overlay uniforms for primary overlay
    const prim = numVolOverlays > 0 ? activeVolOverlays[0] : (vm.hasOverlay ? vm : null);
    if (prim) {
      u.uHasOverlay.value = true;
      u.uOverlayVolume.value = prim.texture || prim.overlayTexture || vm.dummyTexture;
      if (u.uOverlayContourVolume) {
        u.uOverlayContourVolume.value = prim.contourTexture || prim.overlayContourTexture || u.uOverlayVolume.value;
      }
      u.uWorldToOverlayTex.value.copy(prim.worldToOverlayTex);

      if (u.uHasPosOverlay) u.uHasPosOverlay.value = Boolean(prim.hasPos ?? prim.hasPosOverlay);
      if (u.uPosColormap) u.uPosColormap.value = prim.posColormap;
      if (u.uPosMin) u.uPosMin.value = prim.posMin;
      if (u.uPosMax) u.uPosMax.value = prim.posMax;
      if (u.uPosOpacity) u.uPosOpacity.value = prim.posOpacity;

      if (u.uHasNegOverlay) u.uHasNegOverlay.value = Boolean(prim.hasNeg ?? prim.hasNegOverlay);
      if (u.uNegColormap) u.uNegColormap.value = prim.negColormap;
      if (u.uNegMin) u.uNegMin.value = prim.negMin;
      if (u.uNegMax) u.uNegMax.value = prim.negMax;
      if (u.uNegOpacity) u.uNegOpacity.value = prim.negOpacity;

      const hasContour = Boolean(prim.contourPosActive || prim.contourNegActive || prim.showContour);
      if (u.uShowContour) u.uShowContour.value = hasContour;
      if (u.uContourPosThresh) u.uContourPosThresh.value = prim.contourPosThresh;
      if (u.uContourNegThresh) u.uContourNegThresh.value = prim.contourNegThresh;
      if (u.uContourPosActive) u.uContourPosActive.value = Boolean(prim.contourPosActive);
      if (u.uContourNegActive) u.uContourNegActive.value = Boolean(prim.contourNegActive);
      if (u.uContourPosEnabled) u.uContourPosEnabled.value = Boolean(prim.contourPosActive);
      if (u.uContourNegEnabled) u.uContourNegEnabled.value = Boolean(prim.contourNegActive);
      if (u.uContourPosColor && prim.contourPosColor) u.uContourPosColor.value.copy(prim.contourPosColor);
      if (u.uContourNegColor && prim.contourNegColor) u.uContourNegColor.value.copy(prim.contourNegColor);
      if (u.uContourWidth) u.uContourWidth.value = prim.contourWidth || 2.0;
    } else {
      u.uHasOverlay.value = false;
      u.uOverlayVolume.value = vm.dummyTexture;
      if (u.uOverlayContourVolume) u.uOverlayContourVolume.value = vm.dummyTexture;
      if (u.uHasPosOverlay) u.uHasPosOverlay.value = false;
      if (u.uHasNegOverlay) u.uHasNegOverlay.value = false;
      if (u.uShowContour) u.uShowContour.value = false;
    }

    mat.needsUpdate = true;
  }

  /**
   * Main synchronization update:
   * Aligns the 3 slice quads, orthographic cameras, orientation labels, and UI controls.
   */
  update() {
    const cm = this.clippingManager;
    const defaultNormal = new THREE.Vector3(0, 0, 1);

    for (let i = 0; i < 3; i++) {
      const p = cm.planes[i];
      const pane = this.panes[i];
      const quad = this.quads[i];
      const camera = this.cameras[i];
      const mat = this.materials[i];

      const n0 = p.normal0 || cm.sph2cartDeg90x(p.azimuth, p.elevation, 1.0);
      const n = p.normal;
      const cutPoint = cm.brainCenter.clone().add(n0.clone().multiplyScalar(p.depth));

      // A. Position and orient the slice quad in 3D world space
      quad.position.copy(cutPoint);
      quad.quaternion.setFromUnitVectors(defaultNormal, n);

      // B. Setup face-on orthographic camera for this plane
      // Plane 0 (Axial-like): camera looks along n0 (from +Z to -Z)
      // Plane 1 (Coronal-like) & Plane 2 (Sagittal-like): camera looks along -n0
      const viewDir = (i === 0) ? n0.clone() : n0.clone().negate();

      camera.position.copy(cutPoint).addScaledVector(viewDir, -200);

      // Stable Up-Vector calculation for arbitrary oblique normal
      let up = new THREE.Vector3(0, 0, 1);
      if (Math.abs(viewDir.dot(up)) >= 0.95) {
        // Look direction is parallel to Z (e.g. Axial); use Anterior (+Y) as Up
        up.set(0, 1, 0);
      }
      // Project up vector perpendicular to viewDir
      up.sub(viewDir.clone().multiplyScalar(viewDir.dot(up))).normalize();

      camera.up.copy(up);
      camera.lookAt(cutPoint);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      // C. Update material uniforms
      if (mat && mat.uniforms) {
        const u = mat.uniforms;
        u.uPlaneNormal.value.copy(n);
        u.uWindowMin.value = cm.windowMin;
        u.uWindowMax.value = cm.windowMax;
        u.uColormap.value = cm.colormap;
        u.uOpacity.value = cm.sliceOpacity;
        this.syncVolumeTextures();
      }

      // D. Update UI Controls & Headers
      const mniInfo = cm.getPlaneMNIInfo(p);
      pane.slider.min = mniInfo.min;
      pane.slider.max = mniInfo.max;
      pane.slider.value = Math.round(mniInfo.coord);
      const coordStr = `${mniInfo.axis}: ${mniInfo.coord >= 0 ? '+' : ''}${mniInfo.coord.toFixed(1)} mm`;
      pane.sliderVal.textContent = coordStr;
      pane.coords.textContent = `MNI ${coordStr}`;

      // Badge name with azimuth & elevation
      const isOrthogonal = (i === 0 && p.azimuth === 0 && p.elevation === -90) ||
                           (i === 1 && p.azimuth === 180 && p.elevation === 0) ||
                           (i === 2 && p.azimuth === 90 && p.elevation === 0);

      const defaultNames = ['Plane 1 (Axial)', 'Plane 2 (Coronal)', 'Plane 3 (Sagittal)'];
      if (isOrthogonal) {
        pane.badge.textContent = defaultNames[i];
      } else {
        pane.badge.textContent = `Plane ${i + 1} (Az: ${p.azimuth}°, El: ${p.elevation}°)`;
      }

      // Update orientation labels
      this.updateOrientationLabels(i, viewDir, up);
    }

    // Update crosshairs and coordinate readouts
    this.renderCrosshairs();
    this.updateVoxelReadout(this.getCrosshairIntersectionPoint());
  }

  updateOrientationLabels(planeIdx, viewDir, upDir) {
    const pane = this.panes[planeIdx];
    // Determine right vector in view space: right = viewDir x upDir
    const rightDir = new THREE.Vector3().crossVectors(viewDir, upDir).normalize();

    // Map 3D unit vectors to closest anatomical axes
    const getAxisLabel = (vec) => {
      const absX = Math.abs(vec.x), absY = Math.abs(vec.y), absZ = Math.abs(vec.z);
      if (absX >= absY && absX >= absZ) return vec.x > 0 ? 'R' : 'L';
      if (absY >= absX && absY >= absZ) return vec.y > 0 ? 'A' : 'P';
      return vec.z > 0 ? 'S' : 'I';
    };

    pane.orient.top.textContent = getAxisLabel(upDir);
    pane.orient.bottom.textContent = getAxisLabel(upDir.clone().negate());
    pane.orient.left.textContent = getAxisLabel(rightDir.clone().negate());
    pane.orient.right.textContent = getAxisLabel(rightDir);
  }

  getCrosshairIntersectionPoint() {
    // 3D Point where the three current clipping planes intersect
    const cm = this.clippingManager;
    const p1 = cm.planes[0], p2 = cm.planes[1], p3 = cm.planes[2];

    const n1 = p1.normal0 || cm.sph2cartDeg90x(p1.azimuth, p1.elevation, 1.0);
    const n2 = p2.normal0 || cm.sph2cartDeg90x(p2.azimuth, p2.elevation, 1.0);
    const n3 = p3.normal0 || cm.sph2cartDeg90x(p3.azimuth, p3.elevation, 1.0);

    // If default orthogonal:
    if (Math.abs(n1.z) > 0.9 && Math.abs(n2.y) > 0.9 && Math.abs(n3.x) > 0.9) {
      return new THREE.Vector3(
        cm.brainCenter.x + n3.x * p3.depth,
        cm.brainCenter.y + n2.y * p2.depth,
        cm.brainCenter.z + n1.z * p1.depth
      );
    }

    // General 3-plane intersection: M * X = d
    const C1 = cm.brainCenter.clone().add(n1.clone().multiplyScalar(p1.depth));
    const C2 = cm.brainCenter.clone().add(n2.clone().multiplyScalar(p2.depth));
    const C3 = cm.brainCenter.clone().add(n3.clone().multiplyScalar(p3.depth));

    const d1 = n1.dot(C1);
    const d2 = n2.dot(C2);
    const d3 = n3.dot(C3);

    const det = n1.dot(new THREE.Vector3().crossVectors(n2, n3));
    if (Math.abs(det) < 1e-4) {
      return C1.clone();
    }

    const term1 = new THREE.Vector3().crossVectors(n2, n3).multiplyScalar(d1);
    const term2 = new THREE.Vector3().crossVectors(n3, n1).multiplyScalar(d2);
    const term3 = new THREE.Vector3().crossVectors(n1, n2).multiplyScalar(d3);

    return term1.add(term2).add(term3).divideScalar(det);
  }

  updateVoxelReadout(worldPoint) {
    if (!worldPoint) return;
    this.currentWorldPoint = worldPoint.clone();

    // Update input fields if they are not currently being focused by user
    const activeEl = document.activeElement;
    if (activeEl !== this.inputX && activeEl !== this.inputY && activeEl !== this.inputZ) {
      if (this.inputX) this.inputX.value = worldPoint.x.toFixed(1);
      if (this.inputY) this.inputY.value = worldPoint.y.toFixed(1);
      if (this.inputZ) this.inputZ.value = worldPoint.z.toFixed(1);
    }

    const vm = this.volumeManager;
    let baseValStr = '—';
    let overlayValStr = '';

    // Sample base volume intensity
    if (vm && vm.texture && vm.texture.image && vm.texture.image.data) {
      const v = worldPoint.clone().applyMatrix4(vm.worldToVolumeTex);
      if (v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1 && v.z >= 0 && v.z <= 1) {
        const [nx, ny, nz] = vm.dims;
        const ix = Math.min(nx - 1, Math.max(0, Math.floor(v.x * nx)));
        const iy = Math.min(ny - 1, Math.max(0, Math.floor(v.y * ny)));
        const iz = Math.min(nz - 1, Math.max(0, Math.floor(v.z * nz)));
        const idx = ix + iy * nx + iz * nx * ny;
        const val = vm.texture.image.data[idx];
        if (typeof val === 'number') {
          baseValStr = (vm.rawMax > 1) ? `${Math.round(val)}` : val.toFixed(3);
        }
      }
    }

    // Sample overlay intensity
    if (vm && vm.hasOverlay && vm.overlayTexture && vm.overlayTexture.image && vm.overlayTexture.image.data) {
      const ov = worldPoint.clone().applyMatrix4(vm.worldToOverlayTex);
      if (ov.x >= 0 && ov.x <= 1 && ov.y >= 0 && ov.y <= 1 && ov.z >= 0 && ov.z <= 1) {
        const [nx, ny, nz] = vm.overlayDims;
        const ix = Math.min(nx - 1, Math.max(0, Math.floor(ov.x * nx)));
        const iy = Math.min(ny - 1, Math.max(0, Math.floor(ov.y * ny)));
        const iz = Math.min(nz - 1, Math.max(0, Math.floor(ov.z * nz)));
        const idx = ix + iy * nx + iz * nx * ny;
        const oval = vm.overlayTexture.image.data[idx];
        if (typeof oval === 'number' && Math.abs(oval) > 1e-4) {
          overlayValStr = ` | Overlay: ${(oval >= 0 ? '+' : '')}${oval.toFixed(2)}`;
        }
      }
    }

    this.voxelReadout.textContent = `${baseValStr}${overlayValStr}`;
  }

  renderCrosshairs() {
    const cm = this.clippingManager;
    const vm = this.volumeManager;
    const centerPoint = this.getCrosshairIntersectionPoint();

    for (let i = 0; i < 3; i++) {
      const pane = this.panes[i];
      const canvas = pane.crosshairCanvas;
      const ctx = pane.crosshairCtx;
      const camera = this.cameras[i];

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Render 2D Marching Squares Isocontour outlines on slice canvas
      if (vm.hasOverlay && (vm.contourPosActive || vm.contourNegActive || vm.showContour)) {
        this.renderMarchingSquaresContour(i, ctx, w, h, camera);
      }

      if (!this.showCrosshairs) continue;

      const p_i = cm.planes[i];
      const n_i = p_i.normal0 || cm.sph2cartDeg90x(p_i.azimuth, p_i.elevation, 1.0);
      const C_i = cm.brainCenter.clone().add(n_i.clone().multiplyScalar(p_i.depth));
      const d_i = n_i.dot(C_i);

      // Draw intersection line of the other two planes on plane i
      for (let j = 0; j < 3; j++) {
        if (j === i) continue;
        const p_j = cm.planes[j];
        const n_j = p_j.normal0 || cm.sph2cartDeg90x(p_j.azimuth, p_j.elevation, 1.0);
        const C_j = cm.brainCenter.clone().add(n_j.clone().multiplyScalar(p_j.depth));
        const d_j = n_j.dot(C_j);

        // Direction of intersection line
        const D = new THREE.Vector3().crossVectors(n_i, n_j);
        const dLen = D.length();
        if (dLen < 1e-4) continue;
        D.divideScalar(dLen);

        // Point on the intersection line closest to origin
        const cosTheta = n_i.dot(n_j);
        const denom = 1.0 - cosTheta * cosTheta;
        if (Math.abs(denom) < 1e-4) continue;

        const P0 = new THREE.Vector3()
          .addScaledVector(n_i, (d_i - d_j * cosTheta) / denom)
          .addScaledVector(n_j, (d_j - d_i * cosTheta) / denom);

        // Extend 3D line segment across the slice
        const ptA_3d = P0.clone().addScaledVector(D, -250);
        const ptB_3d = P0.clone().addScaledVector(D, 250);

        // Project to 2D canvas coordinates
        const pA_ndc = ptA_3d.project(camera);
        const pB_ndc = ptB_3d.project(camera);

        const xA = (pA_ndc.x * 0.5 + 0.5) * w;
        const yA = (-pA_ndc.y * 0.5 + 0.5) * h;
        const xB = (pB_ndc.x * 0.5 + 0.5) * w;
        const yB = (-pB_ndc.y * 0.5 + 0.5) * h;

        ctx.strokeStyle = this.planeColors[j];
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(xA, yA);
        ctx.lineTo(xB, yB);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw center crosshair reticle circle
      const centerNdc = centerPoint.clone().project(camera);
      const cx = (centerNdc.x * 0.5 + 0.5) * w;
      const cy = (-centerNdc.y * 0.5 + 0.5) * h;

      if (cx >= 0 && cx <= w && cy >= 0 && cy <= h) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Sample 2D overlay slice and evaluate 2D Marching Squares isocontour outlines
   */
  renderMarchingSquaresContour(planeIdx, ctx, w, h, camera) {
    const vm = this.volumeManager;
    if (!vm) return;

    const activeVolOverlays = (vm.overlays || []).filter(o => o.enabled && o.type === 'volume');
    const overlaysWithContours = activeVolOverlays.filter(o => o.contourPosActive || o.contourNegActive || o.showContour);

    let listToRender = overlaysWithContours;
    if (listToRender.length === 0 && vm.hasOverlay && (vm.contourPosActive || vm.contourNegActive || vm.showContour)) {
      listToRender = [{
        texture: vm.overlayTexture,
        dims: vm.overlayDims,
        worldToOverlayTex: vm.worldToOverlayTex,
        contourPosActive: vm.contourPosActive,
        contourPosThresh: vm.contourPosThresh,
        contourPosColorHex: vm.contourPosColorHex,
        contourNegActive: vm.contourNegActive,
        contourNegThresh: vm.contourNegThresh,
        contourNegColorHex: vm.contourNegColorHex,
        contourWidth: vm.contourWidth
      }];
    }

    if (listToRender.length === 0) return;

    for (const ov of listToRender) {
      if (!ov.texture || !ov.texture.image || !ov.texture.image.data) continue;
      const data = ov.texture.image.data;
      const [nx, ny, nz] = ov.dims;
      if (nx <= 1 || ny <= 1 || nz <= 1) continue;

      const N = 80;
      const grid = new Float32Array(N * N);

      const pTL = new THREE.Vector3(-1, 1, 0).unproject(camera);
      const pTR = new THREE.Vector3(1, 1, 0).unproject(camera);
      const pBL = new THREE.Vector3(-1, -1, 0).unproject(camera);

      const uvwTL = pTL.applyMatrix4(ov.worldToOverlayTex);
      const uvwTR = pTR.applyMatrix4(ov.worldToOverlayTex);
      const uvwBL = pBL.applyMatrix4(ov.worldToOverlayTex);

      const stepU_x = (uvwTR.x - uvwTL.x) / (N - 1);
      const stepU_y = (uvwTR.y - uvwTL.y) / (N - 1);
      const stepU_z = (uvwTR.z - uvwTL.z) / (N - 1);

      const stepV_x = (uvwBL.x - uvwTL.x) / (N - 1);
      const stepV_y = (uvwBL.y - uvwTL.y) / (N - 1);
      const stepV_z = (uvwBL.z - uvwTL.z) / (N - 1);

      for (let gy = 0; gy < N; gy++) {
        const rowUvwX = uvwTL.x + gy * stepV_x;
        const rowUvwY = uvwTL.y + gy * stepV_y;
        const rowUvwZ = uvwTL.z + gy * stepV_z;
        const rowOffset = gy * N;

        for (let gx = 0; gx < N; gx++) {
          const u = rowUvwX + gx * stepU_x;
          const v = rowUvwY + gx * stepU_y;
          const w_coord = rowUvwZ + gx * stepU_z;

          if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && w_coord >= 0 && w_coord <= 1) {
            const ix = Math.min(nx - 1, Math.max(0, Math.floor(u * nx)));
            const iy = Math.min(ny - 1, Math.max(0, Math.floor(v * ny)));
            const iz = Math.min(nz - 1, Math.max(0, Math.floor(w_coord * nz)));
            grid[rowOffset + gx] = data[ix + iy * nx + iz * nx * ny];
          } else {
            grid[rowOffset + gx] = 0.0;
          }
        }
      }

      const lineWidth = ov.contourWidth || 2.0;

      // Positive contour: "Contour greater than threshold"
      const posActive = ov.contourPosActive || (ov.showContour && ov.contourPosEnabled);
      if (posActive && Number.isFinite(ov.contourPosThresh)) {
        const segs = MarchingSquares.generateContour(grid, N, N, ov.contourPosThresh, false, w, h);
        if (segs.length > 0) {
          ctx.save();
          ctx.strokeStyle = ov.contourPosColorHex || '#facc15';
          ctx.lineWidth = lineWidth;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 3;
          ctx.beginPath();
          for (let s = 0; s < segs.length; s++) {
            const seg = segs[s];
            ctx.moveTo(seg[0][0], seg[0][1]);
            ctx.lineTo(seg[1][0], seg[1][1]);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Negative contour: "Contour less than threshold"
      const negActive = ov.contourNegActive || (ov.showContour && ov.contourNegEnabled);
      if (negActive && Number.isFinite(ov.contourNegThresh)) {
        const segs = MarchingSquares.generateContour(grid, N, N, ov.contourNegThresh, true, w, h);
        if (segs.length > 0) {
          ctx.save();
          ctx.strokeStyle = ov.contourNegColorHex || '#38bdf8';
          ctx.lineWidth = lineWidth;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 3;
          ctx.beginPath();
          for (let s = 0; s < segs.length; s++) {
            const seg = segs[s];
            ctx.moveTo(seg[0][0], seg[0][1]);
            ctx.lineTo(seg[1][0], seg[1][1]);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  /**
   * Render loop called on every animation frame when modal is open.
   */
  render() {
    if (!this.isOpen) return;

    const bodyRect = this.body.getBoundingClientRect();
    if (bodyRect.width <= 0 || bodyRect.height <= 0) return;

    // Resize WebGL canvas to match container
    if (this.webglCanvas.width !== Math.round(bodyRect.width * this.renderer.getPixelRatio()) ||
        this.webglCanvas.height !== Math.round(bodyRect.height * this.renderer.getPixelRatio())) {
      this.renderer.setSize(bodyRect.width, bodyRect.height, false);
    }

    this.updateCameraBounds();

    this.renderer.setScissorTest(true);

    const canvasRect = this.webglCanvas.getBoundingClientRect();

    for (let i = 0; i < 3; i++) {
      const pane = this.panes[i];
      const vpRect = pane.viewport.getBoundingClientRect();

      if (vpRect.width <= 0 || vpRect.height <= 0) continue;

      // Sync 2D crosshair canvas internal buffer dimensions
      if (pane.crosshairCanvas.width !== Math.round(vpRect.width) ||
          pane.crosshairCanvas.height !== Math.round(vpRect.height)) {
        pane.crosshairCanvas.width = Math.round(vpRect.width);
        pane.crosshairCanvas.height = Math.round(vpRect.height);
        this.renderCrosshairs();
      }

      const left = Math.round(vpRect.left - canvasRect.left);
      const bottom = Math.round(canvasRect.bottom - vpRect.bottom);
      const width = Math.round(vpRect.width);
      const height = Math.round(vpRect.height);

      this.renderer.setViewport(left, bottom, width, height);
      this.renderer.setScissor(left, bottom, width, height);

      this.renderer.render(this.scenes[i], this.cameras[i]);
    }

    this.renderer.setScissorTest(false);
  }
}
