import * as THREE from 'three';
import GUI from 'lil-gui';
import { VOLUME_CONFIGS } from './volumeManager.js';
import { isGIIScalarFile } from './meshParsers.js';
import { MESH_RENDER_STYLES, ADDITIONAL_BRAIN_STRUCTURES } from './meshManager.js';

function makeBold(controller) {
  if (controller && controller.domElement) {
    controller.domElement.classList.add('controller-bold');
  }
  return controller;
}

export class UIManager {
  constructor(viewer, meshManager, clippingManager, volumeManager, orientationCube, tractographyManager = null) {
    this.viewer = viewer;
    this.meshManager = meshManager;
    this.clippingManager = clippingManager;
    this.volumeManager = volumeManager;
    this.orientationCube = orientationCube;
    this.tractographyManager = tractographyManager;

    this.volumeManager.setMeshManager(this.meshManager);

    this.meshGui = null;
    this.volumeGui = null;
    this.clipGui = null;
    this.currentTab = 'meshes';
    this.tabButtons = {};
    this.tabPanels = {};
    this.hudElement = null;
    this.themeMode = 'dark'; // 'dark' or 'white'
    this.bgColorHex = '#121316';
    this.bgPreset = 'dark';
    this.bgPresetController = null;
    this.bgColorController = null;

    this.initHUD();
    this.initToolbar();
    this.initGUI();
    this.initDragAndDrop();
    this.initKeyboardShortcuts();

    // Rebuild GUI when custom meshes or overlays change
    this.meshManager.onMeshesChange(() => this.rebuildCustomMeshesFolder());
    this.volumeManager.onOverlayChange(() => this.updateOverlayGUI());
    this.volumeManager.onOverlayPropertyChange(() => {
      this.clippingManager.updateOverlayUniforms();
      this.volumeManager.updateBrainMeshOverlay(this.meshManager);
      if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
        this.multiplanarViewer.update();
      }
    });
    if (this.tractographyManager) {
      this.tractographyManager.onLoaded(() => {
        if (this.tractographyFolder) {
          this.setupTractographyControls(this.tractographyFolder);
          this.switchTab('meshes');
          this.tractographyFolder.open();
        }
      });
    }
  }

  setTheme(mode) {
    if (mode === 'white') {
      this.setBackgroundColor('#ffffff', 'light');
    } else {
      this.setBackgroundColor('#121316', 'dark');
    }
  }

  setBackgroundColor(hex, presetId = null) {
    if (typeof hex === 'number') {
      hex = '#' + hex.toString(16).padStart(6, '0');
    } else if (typeof hex === 'string') {
      if (!hex.startsWith('#')) hex = '#' + hex;
    }

    const normHex = hex.toLowerCase();
    this.bgColorHex = normHex;

    // Detect preset if not explicitly provided
    if (!presetId) {
      if (normHex === '#121316') presetId = 'dark';
      else if (normHex === '#000000') presetId = 'black';
      else if (normHex === '#ffffff') presetId = 'light';
      else presetId = 'custom';
    }
    this.bgPreset = presetId;

    // Update Three.js scene background
    this.viewer.setBackgroundColor(normHex);

    // Update document background
    document.documentElement.style.setProperty('--bg-primary', normHex);
    document.body.style.backgroundColor = normHex;

    // Determine light vs dark theme based on perceived luminance
    const c = new THREE.Color(normHex);
    const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const isLight = lum > 0.5;

    this.themeMode = isLight ? 'white' : 'dark';
    document.body.classList.toggle('theme-white', isLight);

    if (isLight) {
      this.viewer.ambientLight.intensity = 0.55;
      this.viewer.headlight.intensity = 0.85;
    } else {
      this.viewer.ambientLight.intensity = 0.45;
      this.viewer.headlight.intensity = 0.95;
    }

    // Synchronize Toolbar Preset dropdown
    const selectBg = document.getElementById('select-bg-preset');
    if (selectBg && selectBg.value !== this.bgPreset) {
      selectBg.value = this.bgPreset;
    }

    // Synchronize Toolbar Color Picker
    const toolbarCp = document.getElementById('toolbar-color-picker');
    if (toolbarCp && toolbarCp.value !== normHex) {
      toolbarCp.value = normHex;
    }

    // Synchronize lil-gui controllers
    if (this.bgPresetController) {
      this.bgPresetController.updateDisplay();
    }
    if (this.bgColorController) {
      this.bgColorController.updateDisplay();
    }

    // Synchronize Multiplanar Viewer Background
    if (this.multiplanarViewer) {
      this.multiplanarViewer.updateTheme(normHex, isLight);
    }
  }

  applyBackgroundPreset(preset) {
    switch (preset) {
      case 'dark':
        this.setBackgroundColor('#121316', 'dark');
        break;
      case 'light':
      case 'white':
        this.setBackgroundColor('#ffffff', 'light');
        break;
      case 'black':
        this.setBackgroundColor('#000000', 'black');
        break;
      case 'custom':
        this.bgPreset = 'custom';
        if (this.bgPresetController) this.bgPresetController.updateDisplay();
        const sel = document.getElementById('select-bg-preset');
        if (sel) sel.value = 'custom';
        const cp = document.getElementById('toolbar-color-picker');
        if (cp) cp.click();
        break;
    }
  }

  setClippingEnabled(enabled) {
    this.clippingManager.globalEnabled = enabled;
    this.clippingManager.update();

    const ind = document.getElementById('ind-clipping');
    const btn = document.getElementById('btn-toggle-clipping');
    if (ind) ind.classList.toggle('active', enabled);
    if (btn) btn.classList.toggle('active', enabled);

    if (this.clipMasterController) {
      this.clipMasterController.updateDisplay();
    }

    this.updateHUD();
  }

  setBrainVisible(visible) {
    this.meshManager.setBrainVisible(visible);
    const ind = document.getElementById('ind-brain');
    const btn = document.getElementById('btn-toggle-brain');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);
    if (this.brainVisController) {
      this.brainVisController.updateDisplay();
    }
  }

  setSkullVisible(visible) {
    this.meshManager.setSkullVisible(visible);
    const ind = document.getElementById('ind-skull');
    const btn = document.getElementById('btn-toggle-skull');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);
    if (this.skullVisController) {
      this.skullVisController.updateDisplay();
    }
  }

  setVentriclesVisible(visible) {
    this.meshManager.setVentriclesVisible(visible);
    const ind = document.getElementById('ind-ventricles');
    const btn = document.getElementById('btn-toggle-ventricles');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);
    if (this.ventriclesVisController) {
      this.ventriclesVisController.updateDisplay();
    }
  }

  setSkinVisible(visible) {
    this.meshManager.setSkinVisible(visible);
    const ind = document.getElementById('ind-skin');
    const btn = document.getElementById('btn-toggle-skin');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);
    if (this.skinVisController) {
      this.skinVisController.updateDisplay();
    }
  }

  setArterialVisible(visible) {
    this.meshManager.setArterialVisible(visible);
    const ind = document.getElementById('ind-arterial');
    const btn = document.getElementById('btn-toggle-arterial');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);
    if (this.arterialVisController) {
      this.arterialVisController.updateDisplay();
    }
  }

  setVenousVisible(visible) {
    this.meshManager.setVenousVisible(visible);
    const ind = document.getElementById('ind-venous');
    const btn = document.getElementById('btn-toggle-venous');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);
    if (this.venousVisController) {
      this.venousVisController.updateDisplay();
    }
  }

  setSliceVisible(visible) {
    if (this.clippingManager.sliceVisible !== visible) {
      this.clippingManager.sliceVisible = visible;
      this.clippingManager.update();
    }

    const ind = document.getElementById('ind-slice');
    const btn = document.getElementById('btn-toggle-slice');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);

    if (this.clipSliceVisController && this.clipSliceVisController.getValue() !== visible) {
      this.clipSliceVisController.setValue(visible);
    }

    if (this.sliceVisController && this.sliceVisController.getValue() !== visible) {
      this.sliceVisController.setValue(visible);
    }
  }

  switchTab(name) {
    if (!this.tabButtons || !this.tabButtons[name]) return;
    this.currentTab = name;
    for (const key of Object.keys(this.tabButtons)) {
      this.tabButtons[key].classList.toggle('active', key === name);
    }
    for (const key of Object.keys(this.tabPanels)) {
      this.tabPanels[key].classList.toggle('active', key === name);
      this.tabPanels[key].style.display = key === name ? 'block' : 'none';
    }
  }

  initHUD() {
    this.hudElement = document.createElement('div');
    this.hudElement.className = 'viewer-hud';
    this.hudElement.innerHTML = `
      <div class="hud-item"><span class="hud-label">Clipping Planes:</span> <span id="hud-plane-eq">Disabled</span></div>
      <div class="hud-item"><span class="hud-label">Active Planes:</span> <span id="hud-active-planes">None</span></div>
      <div class="hud-item"><span class="hud-label">Anatomical Meshes:</span> Brain, Skull, Soft Tissue, Arterial, Venous, Ventricles</div>
      <div class="hud-item"><span class="hud-label">Volume:</span> <span id="hud-volume-info">T1w 207×256×216</span></div>
      <div class="hud-item" id="hud-overlay-row" style="display: none;"><span class="hud-label">Active Overlay:</span> <span id="hud-overlay-name" style="color: #f59e0b;">None</span></div>
    `;
    document.body.appendChild(this.hudElement);
  }

  updateHUD() {
    const eqSpan = document.getElementById('hud-plane-eq');
    const planesSpan = document.getElementById('hud-active-planes');
    const ovRow = document.getElementById('hud-overlay-row');
    const ovName = document.getElementById('hud-overlay-name');
    const volSpan = document.getElementById('hud-volume-info');

    if (!eqSpan || !planesSpan) return;

    if (volSpan) {
      const typeKey = this.volumeManager.currentVolumeType;
      const dimsStr = this.volumeManager.dims.join('×');
      const label = this.volumeManager.getVolumeLabel(typeKey);
      volSpan.innerText = `${label} (${dimsStr})`;
    }

    if (this.clippingManager.globalEnabled) {
      const active = this.clippingManager.planes.filter((p) => p.enabled);
      eqSpan.innerText = this.clippingManager.getEquationString();
      planesSpan.innerText = active.map((p) => {
        const info = this.clippingManager.getPlaneMNIInfo(p);
        return `${p.name}: ${p.azimuth}°/${p.elevation}° (MNI ${info.axis}: ${info.coord >= 0 ? '+' : ''}${info.coord.toFixed(0)}mm)`;
      }).join(' | ');
      eqSpan.style.color = '#70c5ff';
    } else {
      eqSpan.innerText = 'Disabled (Full 3D Meshes)';
      planesSpan.innerText = 'None';
      eqSpan.style.color = '#888888';
    }

    if (this.volumeManager.hasOverlay) {
      ovRow.style.display = 'block';
      const vol4dInfo = this.volumeManager.isOverlay4D ? ` [Vol ${this.volumeManager.overlayCurrentVolumeIndex + 1}/${this.volumeManager.overlayNumVolumes}]` : '';
      ovName.innerText = `${this.volumeManager.overlayName}${vol4dInfo} (${this.volumeManager.overlayDims.join('×')})`;
    } else {
      ovRow.style.display = 'none';
    }
  }

  initToolbar() {
    const toolbar = document.createElement('header');
    toolbar.className = 'top-toolbar';
    toolbar.innerHTML = `
      <div class="toolbar-row toolbar-row-top">
        <div class="toolbar-brand">
          <span class="brand-title">Brain and Skull Atlas</span>
        </div>

        <div class="divider"></div>

        <!-- Standard Anatomical View Controls -->
        <div class="btn-group">
          <button class="btn" id="btn-view-superior" title="Superior View (1)">Superior</button>
          <button class="btn" id="btn-view-inferior" title="Inferior View (2)">Inferior</button>
          <button class="btn" id="btn-view-anterior" title="Anterior View (3)">Anterior</button>
          <button class="btn" id="btn-view-posterior" title="Posterior View (4)">Posterior</button>
          <button class="btn" id="btn-view-left-lateral" title="Left Lateral View (5)">Left Lateral</button>
          <button class="btn" id="btn-view-right-lateral" title="Right Lateral View (6)">Right Lateral</button>
          <button class="btn" id="btn-view-reset" title="Reset Camera (R)">Reset</button>
        </div>

        <div class="divider"></div>

        <!-- Render Style Selector (Velvet Default) -->
        <div class="toolbar-action">
          <label for="select-render-style">Render:</label>
          <select id="select-render-style" class="toolbar-select">
            <option value="velvet" selected>Velvet (Default)</option>
            <option value="glass">Glass (X-Ray)</option>
            <option value="bone">Bone</option>
            <option value="phong">Phong</option>
            <option value="matte">Matte</option>
            <option value="matcap">MatCap</option>
            <option value="wireframe">Wireframe</option>
          </select>
        </div>

        <div class="divider"></div>

        <!-- MRI Volume Contrast (T1w Default, T2w, CT, FLASH25, MNI152, Atlases) -->
        <div class="toolbar-action">
          <label for="select-mri-contrast">Volume:</label>
          <select id="select-mri-contrast" class="toolbar-select">
            <option value="t1" selected>T1w Average</option>
            <option value="t2">T2w Average</option>
            <option value="ct">CT (Skull & Head)</option>
            <option value="flash25">Edlow Ex Vivo</option>
            <option value="mni152">MNI152</option>
            <option value="tissue">Tissue Atlas (9 Classes)</option>
            <option value="structure">Structure Atlas (54 Labels)</option>
            <option value="substructure">Substructure Atlas (352 Labels)</option>
            <option value="select_from_file">Select from file...</option>
          </select>
        </div>

        <div class="divider"></div>

        <!-- Background Color Presets & Color Picker (Dropdown Only) -->
        <div class="bg-toolbar-group" title="Background Color & Presets">
          <select class="toolbar-select" id="select-bg-preset" title="Background Color Preset">
            <option value="dark">🌙 Dark (#121316)</option>
            <option value="light">☀️ Light (#ffffff)</option>
            <option value="black">⬛ Black (#000000)</option>
            <option value="custom">🎨 Custom...</option>
          </select>
          <input type="color" class="toolbar-color-picker" id="toolbar-color-picker" value="#121316" title="Choose Custom Background Color">
        </div>
        <button class="btn btn-icon" id="btn-screenshot" title="Capture Screenshot">📷</button>
        <button class="btn btn-icon" id="btn-fullscreen" title="Toggle Fullscreen">⛶</button>
      </div>

      <div class="toolbar-row toolbar-row-bottom">
        <!-- Anatomical Structure Toggles (Order: Brain, Skull, Soft Tissue, Arterial, Venous, Ventricles) in the Same Line -->
        <div class="toolbar-structures-group">
          <button class="btn btn-toggle active" id="btn-toggle-brain" title="Toggle Brain Mesh (B)">
            <span class="indicator active" id="ind-brain"></span> Brain
          </button>

          <button class="btn btn-toggle active" id="btn-toggle-skull" title="Toggle Skull Mesh (K)">
            <span class="indicator active" id="ind-skull"></span> Skull
          </button>

          <button class="btn btn-toggle active" id="btn-toggle-skin" title="Toggle Soft Tissue Mesh (S)">
            <span class="indicator active" id="ind-skin"></span> Soft Tissue
          </button>

          <button class="btn btn-toggle" id="btn-toggle-arterial" title="Toggle Arterial Structures (A)">
            <span class="indicator" id="ind-arterial"></span> Arterial
          </button>

          <button class="btn btn-toggle" id="btn-toggle-venous" title="Toggle Venous Structures">
            <span class="indicator" id="ind-venous"></span> Venous
          </button>

          <button class="btn btn-toggle" id="btn-toggle-ventricles" title="Toggle Ventricles Mask (V)">
            <span class="indicator" id="ind-ventricles"></span> Ventricles
          </button>
        </div>

        <div class="divider"></div>

        <!-- Volumetric Cut Slice & Slice Selection & Clipping Toggle -->
        <div class="toolbar-slice-group">
          <button class="btn btn-toggle active" id="btn-toggle-slice" title="Toggle Volumetric Imaging Slice Rendering">
            <span class="indicator active" id="ind-slice"></span> Show Imaging Slice
          </button>

          <button class="btn btn-toggle active" id="btn-toggle-clipping" title="Toggle Slice Selection & Clipping (C or X)">
            <span class="indicator active" id="ind-clipping"></span> Slice Selection & Clipping
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(toolbar);

    // Anatomical View Buttons
    document.getElementById('btn-view-superior').addEventListener('click', () => this.viewer.setAnatomicalView('superior'));
    document.getElementById('btn-view-inferior').addEventListener('click', () => this.viewer.setAnatomicalView('inferior'));
    document.getElementById('btn-view-anterior').addEventListener('click', () => this.viewer.setAnatomicalView('anterior'));
    document.getElementById('btn-view-posterior').addEventListener('click', () => this.viewer.setAnatomicalView('posterior'));
    document.getElementById('btn-view-left-lateral').addEventListener('click', () => this.viewer.setAnatomicalView('left_lateral'));
    document.getElementById('btn-view-right-lateral').addEventListener('click', () => this.viewer.setAnatomicalView('right_lateral'));
    document.getElementById('btn-view-reset').addEventListener('click', () => this.viewer.resetCamera());

    // Render Style Select
    const selectStyle = document.getElementById('select-render-style');
    selectStyle.addEventListener('change', (e) => {
      this.meshManager.setRenderStyle(e.target.value);
      if (this.styleController) this.styleController.setValue(e.target.value);
    });

    // MRI Contrast Select (T1w / T2w / CT / FLASH25 / etc.)
    const selectMri = document.getElementById('select-mri-contrast');
    selectMri.addEventListener('change', async (e) => {
      const val = e.target.value;
      if (val === 'select_from_file') {
        this.switchTab('volumes');
        this.promptSelectBaseVolumeFromFile();
      } else {
        this.switchTab('volumes');
        await this.switchBaseVolume(val);
      }
    });

    // Structure Toggles
    document.getElementById('btn-toggle-brain').addEventListener('click', () => {
      this.setBrainVisible(!this.meshManager.brainVisible);
      this.switchTab('meshes');
    });

    document.getElementById('btn-toggle-skull').addEventListener('click', () => {
      this.setSkullVisible(!this.meshManager.skullVisible);
      this.switchTab('meshes');
    });

    document.getElementById('btn-toggle-skin').addEventListener('click', () => {
      this.setSkinVisible(!this.meshManager.skinVisible);
      this.switchTab('meshes');
    });

    document.getElementById('btn-toggle-arterial').addEventListener('click', () => {
      this.setArterialVisible(!this.meshManager.arterialVisible);
      this.switchTab('meshes');
    });

    document.getElementById('btn-toggle-venous').addEventListener('click', () => {
      this.setVenousVisible(!this.meshManager.venousVisible);
      this.switchTab('meshes');
    });

    document.getElementById('btn-toggle-ventricles').addEventListener('click', () => {
      this.setVentriclesVisible(!this.meshManager.ventriclesVisible);
      this.switchTab('meshes');
    });

    // Centralized Volumetric Imaging Slice Toggle
    document.getElementById('btn-toggle-slice').addEventListener('click', () => {
      this.setSliceVisible(!this.clippingManager.sliceVisible);
    });

    // Slice Selection & Clipping Toggle
    document.getElementById('btn-toggle-clipping').addEventListener('click', () => {
      const nextState = !this.clippingManager.globalEnabled;
      this.setClippingEnabled(nextState);
    });

    // Background Color Preset Select & Color Picker
    const selectBg = document.getElementById('select-bg-preset');
    if (selectBg) {
      selectBg.addEventListener('change', (e) => {
        this.applyBackgroundPreset(e.target.value);
      });
    }

    const toolbarColorPicker = document.getElementById('toolbar-color-picker');
    if (toolbarColorPicker) {
      toolbarColorPicker.addEventListener('input', (e) => {
        this.setBackgroundColor(e.target.value);
      });
      toolbarColorPicker.addEventListener('change', (e) => {
        this.setBackgroundColor(e.target.value);
      });
    }

    // Screenshot & Fullscreen
    document.getElementById('btn-screenshot').addEventListener('click', () => this.viewer.captureScreenshot(2, false));
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  }

  initGUI() {
    // 1. Create Left-side Clipping Sidebar (separate from everything else)
    this.clippingSidebar = document.createElement('div');
    this.clippingSidebar.className = 'clipping-sidebar';
    this.clippingSidebar.id = 'clipping-sidebar';
    document.body.appendChild(this.clippingSidebar);

    // 2. Create Right-side Sidebar container with Tab Switcher (Meshes, Volumes, Overlays)
    this.sidebarContainer = document.createElement('div');
    this.sidebarContainer.className = 'sidebar-container';
    this.sidebarContainer.id = 'sidebar-container';
    this.sidebarContainer.innerHTML = `
      <div class="sidebar-tabs">
        <button class="sidebar-tab active" id="tab-btn-meshes">🧠 Meshes</button>
        <button class="sidebar-tab" id="tab-btn-volumes">🔬 Volumes</button>
        <button class="sidebar-tab" id="tab-btn-overlays">📊 Overlays</button>
      </div>
      <div class="sidebar-panels">
        <div class="sidebar-panel active" id="sidebar-panel-meshes"></div>
        <div class="sidebar-panel" id="sidebar-panel-volumes"></div>
        <div class="sidebar-panel" id="sidebar-panel-overlays"></div>
      </div>
    `;
    document.body.appendChild(this.sidebarContainer);

    const btnMeshes = document.getElementById('tab-btn-meshes');
    const btnVolumes = document.getElementById('tab-btn-volumes');
    const btnOverlays = document.getElementById('tab-btn-overlays');
    const panelMeshes = document.getElementById('sidebar-panel-meshes');
    const panelVolumes = document.getElementById('sidebar-panel-volumes');
    const panelOverlays = document.getElementById('sidebar-panel-overlays');

    this.tabButtons = { meshes: btnMeshes, volumes: btnVolumes, overlays: btnOverlays };
    this.tabPanels = { meshes: panelMeshes, volumes: panelVolumes, overlays: panelOverlays };

    btnMeshes.addEventListener('click', () => this.switchTab('meshes'));
    btnVolumes.addEventListener('click', () => this.switchTab('volumes'));
    btnOverlays.addEventListener('click', () => this.switchTab('overlays'));

    // 3. Initialize the GUI panels
    this.clipGui = new GUI({ container: this.clippingSidebar, title: '✂️ Slice Selection & Clipping', width: 330 });
    this.meshGui = new GUI({ container: panelMeshes, title: '🧠 Meshes & Shading', width: 340 });
    this.volumeGui = new GUI({ container: panelVolumes, title: '🔬 Volume & Slices', width: 340 });
    this.overlayGui = new GUI({ container: panelOverlays, title: '📊 Overlays', width: 340 });

    // Build panel 1: Clipping (Left)
    this.initClippingGUI();

    // Build panel 2: Meshes (Right Tab 1)
    this.initMeshGUI();

    // Build panel 3: Volumes (Right Tab 2)
    this.initVolumeGUI();

    // Build panel 4: Overlays (Right Tab 3)
    this.initOverlayGUI();
  }

  initMeshGUI() {
    // 1. BRAIN MESH & VELVET SHADER
    const brainFolder = this.meshGui.addFolder('🧠 Brain Mesh');
    this.brainVisController = makeBold(brainFolder.add(this.meshManager, 'brainVisible').name('Visible')).onChange((v) => {
      this.setBrainVisible(v);
    });
    makeBold(brainFolder.add(this.meshManager, 'brainClipped').name('Clip Brain')).onChange((v) => this.meshManager.setBrainClipped(v));

    const brainTypeController = brainFolder.add(this.meshManager, 'currentBrainType', {
      'None': 'none',
      'MNI152 Mesh (surf.obj)': 'default',
      'MNI152 Left Hemisphere (surf.lh.mz3)': 'mni152_lh',
      'MNI152 Right Hemisphere (surf.rh.mz3)': 'mni152_rh',
      'MNI152 Both Hemispheres (surf.lh + surf.rh)': 'mni152_both',
      'fsLR32k (Conte69) Left Hemisphere': 'conte69_lh',
      'fsLR32k (Conte69) Right Hemisphere': 'conte69_rh',
      'fsLR32k (Conte69) Both Hemispheres': 'conte69_both',
      'fsaverage-164k-pial': 'fsaverage_164k_pial_both',
      'fsaverage-164k-pial Left Hemisphere': 'fsaverage_164k_pial_lh',
      'fsaverage-164k-pial Right Hemisphere': 'fsaverage_164k_pial_rh'
    }).name('Brain Surface Model').onChange(async (type) => {
      await this.meshManager.switchBrainMesh(type);
    });

    this.setupAdditionalBrainStructuresMultiselect(brainFolder, brainTypeController);

    brainFolder.add(this.meshManager, 'brainOpacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => {
      this.meshManager.setBrainOpacity(v);
    });

    this.styleController = brainFolder.add(this.meshManager, 'renderStyle', MESH_RENDER_STYLES
    ).name('Render Style').onChange((v) => {
      this.meshManager.setRenderStyle(v);
      const sel = document.getElementById('select-render-style');
      if (sel) sel.value = v;
      matcapController.show(v === 'matcap');
    });

    const matcaps = [
      '02_red_velvet.jpg', '03_blue_velvet.jpg', '04_taupe.jpg',
      '06_clay.jpg', 'Cortex.jpg', 'Cortex2.jpg', 'Porcelain.jpg',
      'Fubax.jpg', 'Gray_above.jpg'
    ];
    const matcapController = brainFolder.add(this.meshManager, 'currentMatcapName', matcaps)
      .name('MatCap Texture')
      .onChange((name) => this.meshManager.loadMatcap(name));
    matcapController.show(this.meshManager.renderStyle === 'matcap');

    brainFolder.addColor(this.meshManager, 'brainColor').name('Surface Color').onChange((v) => this.meshManager.setBrainColor(v));

    // Surf Ice Velvet Shading Parameters
    const velvetFolder = brainFolder.addFolder('✨ Surf Ice Velvet Shading');
    velvetFolder.add(this.meshManager, 'velvetAmbient', 0.0, 1.0, 0.01).name('Ambient').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetDiffuse', 0.0, 1.0, 0.01).name('Diffuse').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetSpecular', 0.0, 1.5, 0.01).name('Specular').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetSheen', 0.0, 2.0, 0.01).name('Sheen Halo').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetEdginess', 1.0, 10.0, 0.2).name('Edginess (Nap)').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetBackscatter', 0.0, 1.0, 0.01).name('Backscatter').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetEdge', 0.0, 1.0, 0.05).name('Edge Darkening').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetLightBackfaces').name('Light Backfaces').onChange(() => this.meshManager.updateVelvetUniforms());

    // 2. SKULL MESH (Full vs Ohio)
    const skullFolder = this.meshGui.addFolder('💀 Skull Mesh');
    this.skullVisController = makeBold(skullFolder.add(this.meshManager, 'skullVisible').name('Visible')).onChange((v) => {
      this.setSkullVisible(v);
    });
    makeBold(skullFolder.add(this.meshManager, 'skullClipped').name('Clip Skull')).onChange((v) => this.meshManager.setSkullClipped(v));

    skullFolder.add(this.meshManager, 'currentSkullType', {
      'Full Skull (MNI Warped)': 'full',
      'Ohio Skull (MNI Warped)': 'ohio'
    }).name('Skull Model').onChange((type) => this.meshManager.switchSkull(type));

    skullFolder.add(this.meshManager, 'skullOpacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setSkullOpacity(v));
    skullFolder.add(this.meshManager, 'skullStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setSkullStyle(v));
    skullFolder.addColor(this.meshManager, 'skullColor').name('Bone Color').onChange(() => this.meshManager.updateSkullMaterial());

    // 3. SOFT TISSUE MESH (formerly skin)
    const skinFolder = this.meshGui.addFolder('👤 Soft Tissue Mesh');
    this.skinVisController = makeBold(skinFolder.add(this.meshManager, 'skinVisible').name('Visible')).onChange((v) => {
      this.setSkinVisible(v);
    });
    makeBold(skinFolder.add(this.meshManager, 'skinClipped').name('Clip Soft Tissue')).onChange((v) => {
      this.meshManager.skinClipped = v;
      this.meshManager.updateSkinMaterial();
    });
    skinFolder.add(this.meshManager, 'skinOpacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setSkinOpacity(v));
    skinFolder.add(this.meshManager, 'skinStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setSkinStyle(v));
    skinFolder.addColor(this.meshManager, 'skinColor').name('Tissue Color').onChange(() => this.meshManager.updateSkinMaterial());

    // 4. ARTERIAL STRUCTURES MESH
    const arterialFolder = this.meshGui.addFolder('🩸 Arterial Structures');
    this.arterialVisController = makeBold(arterialFolder.add(this.meshManager, 'arterialVisible').name('Visible')).onChange((v) => {
      this.setArterialVisible(v);
    });
    makeBold(arterialFolder.add(this.meshManager, 'arterialClipped').name('Clip Arterial')).onChange((v) => {
      this.meshManager.setArterialClipped(v);
    });
    arterialFolder.add(this.meshManager, 'arterialOpacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setArterialOpacity(v));
    arterialFolder.add(this.meshManager, 'arterialStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setArterialStyle(v));
    arterialFolder.addColor(this.meshManager, 'arterialColor').name('Color').onChange(() => this.meshManager.updateArterialMaterial());

    // 5. VENOUS STRUCTURES MESH
    const venousFolder = this.meshGui.addFolder('🫐 Venous Structures');
    this.venousVisController = makeBold(venousFolder.add(this.meshManager, 'venousVisible').name('Visible')).onChange((v) => {
      this.setVenousVisible(v);
    });
    makeBold(venousFolder.add(this.meshManager, 'venousClipped').name('Clip Venous')).onChange((v) => {
      this.meshManager.setVenousClipped(v);
    });
    venousFolder.add(this.meshManager, 'venousOpacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setVenousOpacity(v));
    venousFolder.add(this.meshManager, 'venousStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setVenousStyle(v));
    venousFolder.addColor(this.meshManager, 'venousColor').name('Color').onChange(() => this.meshManager.updateVenousMaterial());

    // 6. VENTRICLE MASK MESH
    const ventFolder = this.meshGui.addFolder('💧 Ventricle Mask');
    this.ventriclesVisController = makeBold(ventFolder.add(this.meshManager, 'ventriclesVisible').name('Visible')).onChange((v) => {
      this.setVentriclesVisible(v);
    });
    makeBold(ventFolder.add(this.meshManager, 'ventriclesClipped').name('Clip Ventricles')).onChange((v) => {
      this.meshManager.setVentriclesClipped(v);
    });
    ventFolder.add(this.meshManager, 'ventriclesOpacity', 0.1, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setVentriclesOpacity(v));
    ventFolder.add(this.meshManager, 'ventriclesStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setVentriclesStyle(v));
    ventFolder.addColor(this.meshManager, 'ventriclesColor').name('Color').onChange(() => this.meshManager.updateVentriclesMaterial());

    // 7. CUSTOM OBJ/PLY/STL MESHES
    this.customMeshFolder = this.meshGui.addFolder('📂 Custom Meshes (.obj, .mz3, .gii, .ply, .stl)');
    this.setupCustomMeshControls(this.customMeshFolder);

    // 8. TRACTOGRAPHY (.trk / .trk.gz)
    this.tractographyFolder = this.meshGui.addFolder('🧵 Tractography (.trk / .trk.gz)');
    this.setupTractographyControls(this.tractographyFolder);

    // 9. ENVIRONMENT & VIEW
    const envFolder = this.meshGui.addFolder('🎨 Environment & View');
    this.bgPresetController = envFolder.add(this, 'bgPreset', {
      'Dark (#121316)': 'dark',
      'Light (#ffffff)': 'light',
      'Black (#000000)': 'black',
      'Custom...': 'custom',
    }).name('Background Preset').onChange((preset) => {
      this.applyBackgroundPreset(preset);
    });

    this.bgColorController = envFolder.addColor(this, 'bgColorHex')
      .name('Background Color')
      .onChange((color) => {
        this.setBackgroundColor(color);
      });

    envFolder.add(this.viewer.ambientLight, 'intensity', 0.0, 2.0, 0.05).name('Ambient Light');
    envFolder.add(this.viewer.headlight, 'intensity', 0.0, 2.5, 0.05).name('Headlight');
    envFolder.add(this.orientationCube, 'visible').name('Orientation Cube').onChange((v) => this.orientationCube.setVisible(v));
    envFolder.add({ fn: () => this.viewer.captureScreenshot(2, false) }, 'fn').name('Export Screenshot (2x PNG)');

    brainFolder.open();
  }

  initVolumeGUI() {
    const volFolder = this.volumeGui.addFolder('🔬 Synchronized Volumetric Slice');

    const volumeOptions = {};
    for (const key of Object.keys(VOLUME_CONFIGS)) {
      volumeOptions[VOLUME_CONFIGS[key].label] = key;
    }
    volumeOptions['Select from file...'] = 'select_from_file';

    this.volumeContrastController = volFolder.add(this.volumeManager, 'currentVolumeType', volumeOptions)
      .name('Base Volume')
      .onChange(async (v) => {
        if (v === 'select_from_file') {
          this.promptSelectBaseVolumeFromFile();
        } else {
          await this.switchBaseVolume(v);
        }
      })
      .listen();

    this.sliceVisController = volFolder.add(this.clippingManager, 'sliceVisible').name('Show Imaging Slice').onChange((v) => {
      this.setSliceVisible(v);
    });

    // Raw windowing sliders (displayed in raw intensity units)
    this.windowMinController = volFolder.add(this.clippingManager, 'rawWindowMin', 0, 400, 1)
      .name('Window Min (Cutoff)')
      .onChange((v) => {
        this.clippingManager.setRawWindow(v, this.clippingManager.rawWindowMax);
      })
      .listen();

    this.windowMaxController = volFolder.add(this.clippingManager, 'rawWindowMax', 0, 400, 1)
      .name('Window Max (Peak)')
      .onChange((v) => {
        this.clippingManager.setRawWindow(this.clippingManager.rawWindowMin, v);
      })
      .listen();

    this.colormapController = volFolder.add(this.clippingManager, 'colormap', {
      'Grayscale': 0,
      'Bone (Warm Ivory)': 1,
      'Hot Spectrum': 2,
      'Cool Spectrum': 3,
      'Rainbow (Jet)': 4,
      'Velvet Glow': 5,
      'Atlas / Qualitative': 6
    }).name('Base Colormap').onChange(() => this.clippingManager.update()).listen();

    volFolder.add(this.clippingManager, 'sliceOpacity', 0.1, 1.0, 0.05).name('Slice Opacity').onChange(() => this.clippingManager.update());

    const maskOptions = {
      'None': 'none',
      'Mask by Non-Zero Values': 'nonzero',
      'Mask by Greater Than Threshold': 'threshold',
      'Mask Background by Brain': 'brain',
      'Mask Background by Skull': 'skull',
      'Mask Background by Soft Tissue': 'skin'
    };
    this.maskController = volFolder.add(this.clippingManager, 'maskMode', maskOptions)
      .name('Background Mask')
      .onChange(async (mode) => {
        await this.clippingManager.setMaskMode(mode);
        if (this.maskThreshController) {
          this.maskThreshController.show(mode === 'threshold');
        }
        if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
          this.multiplanarViewer.update();
        }
      })
      .listen();

    this.maskThreshController = volFolder.add(this.clippingManager, 'maskThresholdValue', 0.0, 500.0, 0.1)
      .name('Mask Threshold')
      .decimals(2)
      .onChange((val) => {
        this.clippingManager.setMaskThresholdValue(val);
        if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
          this.multiplanarViewer.update();
        }
      })
      .listen();
    this.maskThreshController.show(this.clippingManager.maskMode === 'threshold');
    this.clippingManager.onUpdate(() => {
      if (this.maskThreshController) {
        this.maskThreshController.show(this.clippingManager.maskMode === 'threshold');
      }
    });

    volFolder.add(this.clippingManager, 'slabThickness', 0.0, 30.0, 1.0).name('Slab Thickness (mm)').onChange(() => this.clippingManager.update());
    volFolder.add(this.clippingManager, 'slabMode', { 'Single Slice': 0, 'MIP': 1, 'Average': 2 }).name('Slab Mode').onChange(() => this.clippingManager.update());
    volFolder.add({ reload: async () => { await this.reloadCurrentVolume(); } }, 'reload').name('🔄 Reload Volume from Disk');

    volFolder.open();

    // Initialize raw window sliders for initial volume
    this.updateWindowSlidersForVolume(this.volumeManager.currentVolumeType);
  }

  initOverlayGUI() {
    this.setupOverlayControls(this.overlayGui);
  }

  promptSelectBaseVolumeFromFile() {
    alert(
      '⚠️ MNI Stereotaxic Alignment Notice:\n\n' +
      'Please ensure your custom base volume is registered/aligned to MNI152 space.\n' +
      'Slices, crosshair navigation, stereotaxic coordinates, and overlays require valid MNI stereotaxic alignment.'
    );

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.nii,.gz,.nii.gz,application/gzip,application/x-gzip,application/octet-stream';
    input.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        try {
          await this.volumeManager.loadBaseVolumeFromFile(file, (ev) => {
            console.log(`[Custom Base Volume]: ${ev.message}`);
          });
          this.clippingManager.setVolumeTexture(this.volumeManager.texture);
          this.updateWindowSlidersForVolume('custom');
          this.clippingManager.update();
          this.updateHUD();

          // Update toolbar dropdown
          const sel = document.getElementById('select-mri-contrast');
          if (sel) {
            let customOpt = sel.querySelector('option[value="custom"]');
            if (!customOpt) {
              customOpt = document.createElement('option');
              customOpt.value = 'custom';
              const fileOpt = sel.querySelector('option[value="select_from_file"]');
              if (fileOpt) sel.insertBefore(customOpt, fileOpt);
              else sel.appendChild(customOpt);
            }
            customOpt.textContent = `Custom: ${file.name}`;
            sel.value = 'custom';
          }

          if (this.volumeContrastController) {
            this.volumeContrastController.setValue('custom');
          }
        } catch (err) {
          alert(`Failed to load custom base volume: ${err.message}`);
          if (this.volumeContrastController) {
            this.volumeContrastController.setValue(this.volumeManager.currentVolumeType);
          }
        }
      } else {
        if (this.volumeContrastController) {
          this.volumeContrastController.setValue(this.volumeManager.currentVolumeType);
        }
      }
    };
    input.click();
  }

  initClippingGUI() {
    this.planeControllers = [];

    this.clipMasterController = this.clipGui.add(this.clippingManager, 'globalEnabled')
      .name('Enable Clipping')
      .onChange((v) => {
        this.setClippingEnabled(v);
      })
      .listen();

    this.clipSliceVisController = this.clipGui.add(this.clippingManager, 'sliceVisible')
      .name('Show Imaging Slice')
      .onChange((v) => {
        this.setSliceVisible(v);
      })
      .listen();

    this.clipGui.add({ reset: () => this.resetClippingPlanes() }, 'reset').name('↺ Reset Clipping Planes');

    const multiPresets = {
      'Single: Axial Superior': 'single_axial',
      'Single: Coronal Anterior': 'single_coronal',
      'Single: Sagittal Right': 'single_sagittal',
      'Dual: Quadrant Cut (Axial+Coronal)': 'dual_quadrant',
      'Dual: 3-Quadrant Corner Cut': 'dual_negative',
      'Tri-Planar: 3-Plane Corner Cut': 'tri_planar',
      'Oblique Wedge Cut': 'oblique_wedge'
    };

    const presetObj = { selectedPreset: 'single_axial' };
    this.clipPresetController = this.clipGui.add(presetObj, 'selectedPreset', multiPresets).name('Cut Preset').onChange((p) => {
      this.clippingManager.setPreset(p);
      this.setClippingEnabled(true);
      for (const plane of this.clippingManager.planes) {
        if (plane._updateDepthLabel) plane._updateDepthLabel();
      }
      for (const ctrl of this.planeControllers) ctrl.updateDisplay();
    });

    // Sub-folders for Plane 1, Plane 2, Plane 3
    for (const p of this.clippingManager.planes) {
      const pFolder = this.clipGui.addFolder(`📌 ${p.name}`);
      const cActive = pFolder.add(p, 'enabled').name('Active').onChange(() => {
        this.clippingManager.update();
        this.updateHUD();
      }).listen();

      const mniProxy = {
        get mniCoord() {
          return parseFloat(p.clippingManager ? p.clippingManager.getPlaneMNIInfo(p).coord.toFixed(1) : 0);
        },
        set mniCoord(val) {
          if (p.clippingManager) {
            p.clippingManager.setPlaneMNICoord(p, val);
            if (p.uiManager) {
              p.uiManager.updateHUD();
              if (p.uiManager.multiplanarViewer && p.uiManager.multiplanarViewer.isOpen) {
                p.uiManager.multiplanarViewer.update();
              }
            }
          }
        }
      };
      p.clippingManager = this.clippingManager;
      p.uiManager = this;

      const info = this.clippingManager.getPlaneMNIInfo(p);
      const cMNIDepth = pFolder.add(mniProxy, 'mniCoord', info.min, info.max, 0.5)
        .name(`MNI ${info.axis} Depth (mm)`)
        .decimals(1)
        .onChange(() => {
          this.updateHUD();
          if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
            this.multiplanarViewer.update();
          }
        })
        .listen();

      const updateDepthLabel = () => {
        const curInfo = this.clippingManager.getPlaneMNIInfo(p);
        cMNIDepth.name(`MNI ${curInfo.axis} Depth (mm)`);
        cMNIDepth.min(curInfo.min).max(curInfo.max);
        cMNIDepth.updateDisplay();
      };

      const cAz = pFolder.add(p, 'azimuth', 0, 360, 1).name('Azimuth (deg)').onChange(() => {
        this.clippingManager.update();
        updateDepthLabel();
        this.updateHUD();
        if (this.multiplanarViewer && this.multiplanarViewer.isOpen) this.multiplanarViewer.update();
      }).listen();

      const cEl = pFolder.add(p, 'elevation', -90, 90, 1).name('Elevation (deg)').onChange(() => {
        this.clippingManager.update();
        updateDepthLabel();
        this.updateHUD();
        if (this.multiplanarViewer && this.multiplanarViewer.isOpen) this.multiplanarViewer.update();
      }).listen();

      const cInv = pFolder.add(p, 'inverted').name('Invert Cut').onChange(() => {
        this.clippingManager.update();
        this.updateHUD();
      }).listen();

      const cBox = pFolder.add(p, 'showHelper').name('Show Plane Box').onChange(() => {
        this.clippingManager.update();
      }).listen();

      p._updateDepthLabel = updateDepthLabel;
      this.planeControllers.push(cActive, cMNIDepth, cAz, cEl, cInv, cBox);

      if (p.id === 1) pFolder.open();
    }
  }

  resetClippingPlanes() {
    this.clippingManager.resetClippingPlanes();
    this.setClippingEnabled(true);
    for (const p of this.clippingManager.planes) {
      if (p._updateDepthLabel) p._updateDepthLabel();
    }
    for (const ctrl of this.planeControllers) {
      ctrl.updateDisplay();
    }
    if (this.clipPresetController) {
      this.clipPresetController.setValue('single_axial');
    }
    this.updateHUD();
  }

  updateWindowSlidersForVolume(typeKey) {
    const cfg = VOLUME_CONFIGS[typeKey] || VOLUME_CONFIGS.t1;
    const def = (this.volumeManager.metadata && this.volumeManager.metadata.defaultWindow)
      ? this.volumeManager.metadata.defaultWindow
      : (cfg.defaultRawWindow || [0, this.volumeManager.rawMax || 300]);

    this.clippingManager.setRawWindow(def[0], def[1]);

    if (this.windowMinController && this.windowMaxController) {
      this.windowMinController.min(cfg.sliderMin).max(cfg.sliderMax).step(cfg.step);
      this.windowMinController.setValue(def[0]);
      this.windowMinController.updateDisplay();

      this.windowMaxController.min(cfg.sliderMin).max(cfg.sliderMax).step(cfg.step);
      this.windowMaxController.setValue(def[1]);
      this.windowMaxController.updateDisplay();
    }

    if (this.maskThreshController) {
      const stepVal = (cfg.step && cfg.step < 1) ? cfg.step : 0.1;
      this.maskThreshController.min(cfg.sliderMin).max(cfg.sliderMax).step(stepVal);
      this.maskThreshController.updateDisplay();
    }
  }

  computeAdaptiveStepAndDecimals(range) {
    if (!range || range <= 0 || !isFinite(range)) {
      return { step: 0.001, decimals: 3 };
    }
    // We want ~1000 smooth increments across the range
    const rawStep = range / 1000;
    const exponent = Math.floor(Math.log10(rawStep));
    const fraction = rawStep / Math.pow(10, exponent);
    let niceFraction = 1;
    if (fraction > 1.5 && fraction <= 3.5) niceFraction = 2;
    else if (fraction > 3.5 && fraction <= 7.5) niceFraction = 5;
    else if (fraction > 7.5) niceFraction = 10;

    const step = parseFloat((niceFraction * Math.pow(10, exponent)).toPrecision(4));
    const neededDecimals = exponent < 0 ? -exponent : 0;
    const decimals = Math.max(neededDecimals, Math.min(6, neededDecimals + 1));
    return { step, decimals };
  }

  setupOverlayControls(container = this.overlayGui) {
    if (!container) return;
    const panel = this.tabPanels?.overlays;
    const prevScroll = panel ? panel.scrollTop : 0;

    container.children.slice().forEach((c) => c.destroy());

    // File input trigger
    const fileTrigger = {
      chooseFile: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.nii,.gz,.nii.gz,.gii,.gii.gz,application/gzip,application/x-gzip,application/octet-stream';
        input.multiple = true;
        input.onchange = async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            for (let i = 0; i < e.target.files.length; i++) {
              const f = e.target.files[i];
              const name = f.name.toLowerCase();
              if (name.endsWith('.gii') || name.endsWith('.gii.gz')) {
                await this.volumeManager.loadGIIOverlayFromFile(f, this.meshManager);
              } else if (name.endsWith('.nii') || name.endsWith('.nii.gz') || name.endsWith('.gz')) {
                await this.volumeManager.loadOverlayFromFile(f);
                if (!this.clippingManager.globalEnabled) {
                  this.clippingManager.planes[0].enabled = true;
                  this.setClippingEnabled(true);
                }
              } else {
                alert(`File ${f.name} is not a valid .nii or .gii file.`);
              }
            }
            this.switchTab('overlays');
          }
        };
        input.click();
      }
    };

    container.add(fileTrigger, 'chooseFile').name('📁 Load Overlay (.nii, .gii)');

    const overlays = this.volumeManager.overlays || [];

    if (overlays.length > 1) {
      container.add({ fn: () => this.volumeManager.clearAllOverlays() }, 'fn').name('🗑️ Clear All Overlays');
    }

    if (overlays.length === 0) {
      const tipObj = { info: 'Drop .nii / .gii or click above' };
      container.add(tipObj, 'info').name('Status').listen().disable();
      if (panel) {
        requestAnimationFrame(() => { panel.scrollTop = prevScroll; });
      }
      return;
    }

    const overlayColormapOptions = {
      'Red-Yellow': 17,
      'Winters (Blue-Green)': 18,
      'Grayscale': 19,
      'ACTC (Surf Ice)': 20,
      'Hot Spectrum': 0,
      'Cool Spectrum': 2,
      'Rainbow (Jet)': 1,
      'Viridis': 10,
      'Magma': 11,
      'Inferno': 12,
      'Plasma': 13,
      'Cividis': 14,
      'Turbo': 15,
      'CoolWarm': 16,
      'Emerald Green': 3,
      'Electric Red': 4,
      'Electric Blue': 5,
      'Violet / Magenta': 6,
      'Plain Flat Red': 7,
      'Plain Flat Blue': 8,
      'Plain Flat Green': 9
    };

    overlays.forEach((ov, idx) => {
      const icon = ov.type === 'gifti_surface' ? '🎨' : '🔬';
      const folderTitle = `${icon} [${idx + 1}] ${ov.name}`;
      const folder = container.addFolder(folderTitle);

      // Active / Visibility toggle
      makeBold(folder.add(ov, 'enabled').name('Active / Visible')).onChange((v) => {
        this.volumeManager.toggleOverlay(ov.id, v);
        this.clippingManager.updateOverlayUniforms();
        this.volumeManager.updateBrainMeshOverlay(this.meshManager);
        if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
          this.multiplanarViewer.update();
        }
      });

      // Project onto Brain Mesh toggle
      makeBold(folder.add(ov, 'projectOntoMesh').name('Project onto Mesh')).onChange((v) => {
        this.volumeManager.setProjectOntoMesh(v, ov.id);
      });

      if (ov.type === 'volume') {
        folder.add(ov, 'interpolate').name('Interpolate Overlay').onChange((v) => {
          this.volumeManager.setOverlayInterpolate(v, ov.id);
          this.clippingManager.updateOverlayUniforms();
        });
      }

      if (ov.type === 'gifti_surface') {
        const sideStr = ov.hemisphere ? ` (${ov.hemisphere.toUpperCase()})` : '';
        folder.add({ type: `GIfTI Surface${sideStr} - ${ov.numVertices} verts` }, 'type').name('Overlay Type').listen().disable();
      } else {
        folder.add({ type: `3D NIfTI Volume` }, 'type').name('Overlay Type').listen().disable();
      }

      folder.add({ range: `${ov.rawMin.toFixed(2)} to ${ov.rawMax.toFixed(2)}` }, 'range').name('Data Range').listen().disable();

      if (ov.is4D) {
        const volOptions = {};
        for (let v = 0; v < ov.numVolumes; v++) {
          volOptions[`Volume ${v + 1} of ${ov.numVolumes}`] = v;
        }
        folder.add(ov, 'currentVolumeIndex', volOptions)
          .name('Select 4D Volume')
          .onChange((volIdx) => {
            this.volumeManager.setOverlayVolumeIndex(volIdx, ov.id);
            this.clippingManager.updateOverlayUniforms();
            if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
              this.multiplanarViewer.update();
            }
          });
      }

      // 1. Positive Color Map Section
      const posFolder = folder.addFolder('📈 Positive Color Map');
      posFolder.add(ov, 'hasPos').name('Active').onChange(() => {
        this.clippingManager.updateOverlayUniforms();
        this.volumeManager.updateBrainMeshOverlay(this.meshManager);
      });
      posFolder.add(ov, 'posColormap', overlayColormapOptions).name('Colormap').onChange(() => {
        this.clippingManager.updateOverlayUniforms();
        this.volumeManager.updateBrainMeshOverlay(this.meshManager);
      });
      posFolder.add(ov, 'posOpacity', 0.0, 1.0, 0.01).name('Opacity').onChange(() => {
        this.clippingManager.updateOverlayUniforms();
        this.volumeManager.updateBrainMeshOverlay(this.meshManager);
      });

      const posMinLimit = Math.min(0, ov.posDataMin || 0);
      const posMaxLimit = Math.max(1e-4, ov.posDataMax || 1.0);
      const posRange = Math.max(1e-5, posMaxLimit - posMinLimit);
      const { step: posStep, decimals: posDecimals } = this.computeAdaptiveStepAndDecimals(posRange);

      posFolder.add(ov, 'posMin', posMinLimit, posMaxLimit, posStep)
        .name('Threshold Cutoff')
        .decimals(posDecimals)
        .onChange(() => {
          this.clippingManager.updateOverlayUniforms();
          this.volumeManager.updateBrainMeshOverlay(this.meshManager);
        })
        .listen();

      posFolder.add(ov, 'posMax', posMinLimit, posMaxLimit, posStep)
        .name('Threshold Peak')
        .decimals(posDecimals)
        .onChange(() => {
          this.clippingManager.updateOverlayUniforms();
          this.volumeManager.updateBrainMeshOverlay(this.meshManager);
        })
        .listen();

      posFolder.open();

      // 2. Negative Color Map Section
      const negFolder = folder.addFolder('📉 Negative Color Map');
      negFolder.add(ov, 'hasNeg').name('Active').onChange(() => {
        this.clippingManager.updateOverlayUniforms();
        this.volumeManager.updateBrainMeshOverlay(this.meshManager);
      });
      negFolder.add(ov, 'negColormap', overlayColormapOptions).name('Colormap').onChange(() => {
        this.clippingManager.updateOverlayUniforms();
        this.volumeManager.updateBrainMeshOverlay(this.meshManager);
      });
      negFolder.add(ov, 'negOpacity', 0.0, 1.0, 0.01).name('Opacity').onChange(() => {
        this.clippingManager.updateOverlayUniforms();
        this.volumeManager.updateBrainMeshOverlay(this.meshManager);
      });

      const negMinLimit = Math.min(-1e-4, ov.negDataMin || -1.0);
      const negMaxLimit = Math.max(0, ov.negDataMax || 0);
      const negRange = Math.max(1e-5, Math.abs(negMinLimit - negMaxLimit));
      const { step: negStep, decimals: negDecimals } = this.computeAdaptiveStepAndDecimals(negRange);

      negFolder.add(ov, 'negMin', negMinLimit, negMaxLimit, negStep)
        .name('Threshold Cutoff')
        .decimals(negDecimals)
        .onChange(() => {
          this.clippingManager.updateOverlayUniforms();
          this.volumeManager.updateBrainMeshOverlay(this.meshManager);
        })
        .listen();

      negFolder.add(ov, 'negMax', negMinLimit, negMaxLimit, negStep)
        .name('Threshold Peak')
        .decimals(negDecimals)
        .onChange(() => {
          this.clippingManager.updateOverlayUniforms();
          this.volumeManager.updateBrainMeshOverlay(this.meshManager);
        })
        .listen();

      if (ov.hasNeg) negFolder.open();

      // 3. Threshold-based Contours (only for volume overlays)
      if (ov.type === 'volume') {
        const contourFolder = folder.addFolder('📐 Threshold Contours');

        contourFolder.add(ov, 'contourPosActive')
          .name('Contour > Threshold')
          .onChange((v) => {
            this.volumeManager.setContourPosActive(v, ov.id);
            this.clippingManager.updateOverlayUniforms();
            if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
              this.multiplanarViewer.update();
            }
          })
          .listen();

        contourFolder.add(ov, 'contourPosThresh', posMinLimit, posMaxLimit, posStep)
          .name('Threshold (> val)')
          .decimals(posDecimals)
          .onChange(() => {
            this.clippingManager.updateOverlayUniforms();
            if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
              this.multiplanarViewer.update();
            }
          })
          .listen();

        contourFolder.addColor(ov, 'contourPosColorHex')
          .name('Color (> val)')
          .onChange((hex) => {
            this.volumeManager.setContourPosColor(hex, ov.id);
            this.clippingManager.updateOverlayUniforms();
            if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
              this.multiplanarViewer.update();
            }
          })
          .listen();

        contourFolder.add(ov, 'contourNegActive')
          .name('Contour < Threshold')
          .onChange((v) => {
            this.volumeManager.setContourNegActive(v, ov.id);
            this.clippingManager.updateOverlayUniforms();
            if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
              this.multiplanarViewer.update();
            }
          })
          .listen();

        contourFolder.add(ov, 'contourNegThresh', negMinLimit, negMaxLimit, negStep)
          .name('Threshold (< val)')
          .decimals(negDecimals)
          .onChange(() => {
            this.clippingManager.updateOverlayUniforms();
            if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
              this.multiplanarViewer.update();
            }
          })
          .listen();

        contourFolder.addColor(ov, 'contourNegColorHex')
          .name('Color (< val)')
          .onChange((hex) => {
            this.volumeManager.setContourNegColor(hex, ov.id);
            this.clippingManager.updateOverlayUniforms();
            if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
              this.multiplanarViewer.update();
            }
          })
          .listen();

        contourFolder.add(ov, 'contourWidth', 0.5, 8.0, 0.5)
          .name('Contour Thickness')
          .onChange((w) => {
            this.volumeManager.setContourWidth(w, ov.id);
            this.clippingManager.updateOverlayUniforms();
            if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
              this.multiplanarViewer.update();
            }
          })
          .listen();

        contourFolder.open();
      }

      // Trash / Remove button
      folder.add({ fn: () => this.volumeManager.removeOverlay(ov.id) }, 'fn').name('🗑️ Remove Overlay');
      folder.open();
    });

    if (panel) {
      requestAnimationFrame(() => {
        panel.scrollTop = prevScroll;
      });
    }
  }

  async switchBaseVolume(type) {
    if (this._isSwitchingVolume) return;
    this._isSwitchingVolume = true;
    try {
      const isAtlas = (type === 'tissue' || type === 'structure' || type === 'substructure');
      if (isAtlas && this.clippingManager.colormap === 0) {
        this.clippingManager.colormap = 6;
        if (this.colormapController) this.colormapController.setValue(6);
      } else if (!isAtlas && this.clippingManager.colormap === 6) {
        this.clippingManager.colormap = 0;
        if (this.colormapController) this.colormapController.setValue(0);
      }

      await this.volumeManager.switchVolumeType(type, (ev) => {
        console.log(`[Volume Switch]: ${ev.message}`);
      });
      this.clippingManager.setVolumeTexture(this.volumeManager.texture);
      this.updateWindowSlidersForVolume(type);
      this.clippingManager.update();
      this.updateHUD();

      const sel = document.getElementById('select-mri-contrast');
      if (sel && sel.value !== type) sel.value = type;

      if (this.volumeContrastController && this.volumeContrastController.getValue() !== type) {
        this.volumeContrastController.setValue(type);
      }
    } catch (err) {
      alert(`Failed to load ${type} volume: ${err.message}`);
    } finally {
      this._isSwitchingVolume = false;
    }
  }

  async reloadCurrentVolume() {
    if (this._isSwitchingVolume) return;
    this._isSwitchingVolume = true;
    try {
      await this.volumeManager.reloadCurrentVolume((ev) => {
        console.log(`[Volume Reload]: ${ev.message}`);
      });
      this.clippingManager.setVolumeTexture(this.volumeManager.texture);
      this.updateWindowSlidersForVolume(this.volumeManager.currentVolumeType);
      this.clippingManager.update();
      this.updateHUD();
      alert(`Successfully reloaded ${this.volumeManager.getVolumeLabel(this.volumeManager.currentVolumeType)} from disk.`);
    } catch (err) {
      alert(`Failed to reload volume: ${err.message}`);
    } finally {
      this._isSwitchingVolume = false;
    }
  }

  updateOverlayGUI() {
    this.setupOverlayControls(this.overlayGui);
    this.updateHUD();
  }

  setupAdditionalBrainStructuresMultiselect(brainFolder, anchorController) {
    const container = document.createElement('div');
    container.className = 'controller custom-multiselect-controller';

    const nameLabel = document.createElement('div');
    nameLabel.className = 'name';
    nameLabel.textContent = 'Additional Structures';
    nameLabel.title = 'Additional Brain Structures (Subcortical & Brainstem Meshes)';
    container.appendChild(nameLabel);

    const widget = document.createElement('div');
    widget.className = 'widget multiselect-widget';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'multiselect-toggle-btn';

    const btnText = document.createElement('span');
    btnText.className = 'multiselect-btn-text';
    btnText.textContent = 'None selected';

    const arrow = document.createElement('span');
    arrow.className = 'multiselect-arrow';
    arrow.textContent = '▾';

    toggleBtn.appendChild(btnText);
    toggleBtn.appendChild(arrow);
    widget.appendChild(toggleBtn);

    const menu = document.createElement('div');
    menu.className = 'multiselect-menu';
    menu.style.display = 'none';

    // Actions header (All / None quick toggle)
    const actionsBar = document.createElement('div');
    actionsBar.className = 'multiselect-actions';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'multiselect-menu-title';
    titleSpan.textContent = 'Structures';

    const btnGroup = document.createElement('div');
    btnGroup.className = 'multiselect-quick-btns';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'multiselect-quick-btn';
    allBtn.textContent = 'All';

    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'multiselect-quick-btn';
    noneBtn.textContent = 'None';

    btnGroup.appendChild(allBtn);
    btnGroup.appendChild(noneBtn);
    actionsBar.appendChild(titleSpan);
    actionsBar.appendChild(btnGroup);
    menu.appendChild(actionsBar);

    // Checklist of structures
    const list = document.createElement('div');
    list.className = 'multiselect-list';

    const checkboxes = {};
    const colorInputs = {};

    const updateButtonSummary = () => {
      const selected = Object.keys(this.meshManager.additionalBrainStructures).filter(
        id => this.meshManager.additionalBrainStructures[id]?.enabled
      );
      if (selected.length === 0) {
        btnText.textContent = 'None selected';
      } else if (selected.length === ADDITIONAL_BRAIN_STRUCTURES.length) {
        btnText.textContent = `All (${selected.length}) selected`;
      } else if (selected.length === 1) {
        const item = ADDITIONAL_BRAIN_STRUCTURES.find(s => s.id === selected[0]);
        btnText.textContent = item?.shortName || '1 selected';
      } else {
        btnText.textContent = `${selected.length} selected`;
      }
    };

    const colorSwatches = {};
    const swatchDots = {};
    const structColorControllers = {};

    const setStructureColor = (id, hexVal) => {
      if (swatchDots[id]) swatchDots[id].style.backgroundColor = hexVal;
      if (colorInputs[id]) colorInputs[id].value = hexVal;
      this.meshManager.setAdditionalBrainStructureColor(id, hexVal);
      if (structColorControllers[id]) structColorControllers[id].updateDisplay();
    };

    ADDITIONAL_BRAIN_STRUCTURES.forEach((struct, idx) => {
      const itemRow = document.createElement('div');
      itemRow.className = 'multiselect-item';

      const leftContainer = document.createElement('div');
      leftContainer.className = 'multiselect-item-left';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'multiselect-checkbox';
      cb.id = `ms-check-${struct.id}`;
      cb.checked = !!this.meshManager.additionalBrainStructures[struct.id]?.enabled;
      checkboxes[struct.id] = cb;

      const labelText = document.createElement('label');
      labelText.className = 'multiselect-item-text';
      labelText.htmlFor = `ms-check-${struct.id}`;
      labelText.textContent = struct.name;
      labelText.title = struct.name;

      leftContainer.appendChild(cb);
      leftContainer.appendChild(labelText);

      // Compact color swatch and presets popover
      const colorContainer = document.createElement('div');
      colorContainer.className = 'multiselect-color-container';

      const curColorHex = this.meshManager.additionalBrainStructures[struct.id]?.defaultColorHex || struct.defaultColorHex;

      const colorSwatch = document.createElement('button');
      colorSwatch.type = 'button';
      colorSwatch.className = 'multiselect-color-swatch-btn';
      colorSwatch.title = `Color for ${struct.name} (click to choose color)`;

      const swatchDot = document.createElement('span');
      swatchDot.className = 'multiselect-swatch-dot';
      swatchDot.style.backgroundColor = curColorHex;
      swatchDots[struct.id] = swatchDot;

      const swatchCaret = document.createElement('span');
      swatchCaret.className = 'multiselect-swatch-caret';
      swatchCaret.textContent = '▾';

      colorSwatch.appendChild(swatchDot);
      colorSwatch.appendChild(swatchCaret);
      colorSwatches[struct.id] = colorSwatch;

      const hiddenColorInput = document.createElement('input');
      hiddenColorInput.type = 'color';
      hiddenColorInput.className = 'multiselect-hidden-color-input';
      hiddenColorInput.value = curColorHex;
      colorInputs[struct.id] = hiddenColorInput;

      hiddenColorInput.addEventListener('input', (e) => {
        setStructureColor(struct.id, e.target.value);
      });

      hiddenColorInput.addEventListener('change', (e) => {
        setStructureColor(struct.id, e.target.value);
      });

      const colorPopup = document.createElement('div');
      colorPopup.className = 'structure-color-popup';
      if (idx >= 3) {
        colorPopup.classList.add('popup-upward');
      }
      colorPopup.style.display = 'none';

      const renderColorPopup = () => {
        colorPopup.innerHTML = '';

        const popupHeader = document.createElement('div');
        popupHeader.className = 'color-popup-header';
        popupHeader.textContent = 'Structure Color';
        colorPopup.appendChild(popupHeader);

        const presetsContainer = document.createElement('div');
        presetsContainer.className = 'color-popup-presets';

        const activeColorHex = this.meshManager.additionalBrainStructures[struct.id]?.defaultColorHex || struct.defaultColorHex;
        const mainBrainHex = '#' + new THREE.Color(this.meshManager.brainColor).getHexString();

        const colorOptions = ADDITIONAL_BRAIN_STRUCTURES.map(s => ({
          id: s.id,
          name: s.id === struct.id ? `${s.shortName || s.name} (Default)` : (s.shortName || s.name),
          hex: s.defaultColorHex
        }));
        colorOptions.push({
          id: 'main_brain',
          name: 'Main Brain Mesh',
          hex: mainBrainHex
        });

        colorOptions.forEach(opt => {
          const optRow = document.createElement('button');
          optRow.type = 'button';
          optRow.className = 'color-popup-option';

          const optDot = document.createElement('span');
          optDot.className = 'color-popup-dot';
          optDot.style.backgroundColor = opt.hex;

          const optLabel = document.createElement('span');
          optLabel.className = 'color-popup-label';
          optLabel.textContent = opt.name;

          optRow.appendChild(optDot);
          optRow.appendChild(optLabel);

          const isCurrent = activeColorHex.toLowerCase() === opt.hex.toLowerCase();
          if (isCurrent) {
            optRow.classList.add('active');
            const check = document.createElement('span');
            check.className = 'color-popup-check';
            check.textContent = '✓';
            optRow.appendChild(check);
          }

          optRow.addEventListener('click', (e) => {
            e.stopPropagation();
            setStructureColor(struct.id, opt.hex);
            colorPopup.style.display = 'none';
          });

          presetsContainer.appendChild(optRow);
        });

        colorPopup.appendChild(presetsContainer);

        const customBtn = document.createElement('button');
        customBtn.type = 'button';
        customBtn.className = 'color-popup-custom-btn';

        const matchesPreset = colorOptions.some(opt => opt.hex.toLowerCase() === activeColorHex.toLowerCase());
        if (!matchesPreset) {
          customBtn.classList.add('active');
          customBtn.innerHTML = `<span class="color-popup-dot" style="background-color: ${activeColorHex}"></span> <span class="color-popup-label">Custom (${activeColorHex})</span> <span class="color-popup-check">✓</span>`;
        } else {
          customBtn.classList.remove('active');
          customBtn.innerHTML = '<span class="color-custom-icon">🎨</span> <span class="color-popup-label">Custom Color...</span>';
        }

        customBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          colorPopup.style.display = 'none';
          hiddenColorInput.click();
        });

        colorPopup.appendChild(customBtn);
      };

      colorSwatch.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.structure-color-popup').forEach(p => {
          if (p !== colorPopup) p.style.display = 'none';
        });
        const willOpen = colorPopup.style.display === 'none';
        if (willOpen) {
          renderColorPopup();
          colorPopup.style.display = 'flex';
        } else {
          colorPopup.style.display = 'none';
        }
      });

      colorContainer.appendChild(colorSwatch);
      colorContainer.appendChild(hiddenColorInput);
      colorContainer.appendChild(colorPopup);

      cb.addEventListener('change', async (e) => {
        e.stopPropagation();
        if (structColorControllers[struct.id]) {
          structColorControllers[struct.id].show(cb.checked);
        }
        await this.meshManager.toggleAdditionalBrainStructure(struct.id, cb.checked);
        updateButtonSummary();
      });

      itemRow.appendChild(leftContainer);
      itemRow.appendChild(colorContainer);
      list.appendChild(itemRow);
    });

    menu.appendChild(list);
    widget.appendChild(menu);
    container.appendChild(widget);

    // Toggle menu open/close
    const toggleMenu = (open) => {
      const isOpen = open !== undefined ? open : (menu.style.display === 'none');
      menu.style.display = isOpen ? 'block' : 'none';
      toggleBtn.classList.toggle('active', isOpen);
      arrow.textContent = isOpen ? '▴' : '▾';
      if (!isOpen) {
        document.querySelectorAll('.structure-color-popup').forEach(p => p.style.display = 'none');
      }
    };

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        toggleMenu(false);
      }
      if (!e.target.closest('.multiselect-color-container')) {
        document.querySelectorAll('.structure-color-popup').forEach(p => {
          p.style.display = 'none';
        });
      }
    });

    // Quick action: All
    allBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      for (const struct of ADDITIONAL_BRAIN_STRUCTURES) {
        checkboxes[struct.id].checked = true;
        if (structColorControllers[struct.id]) structColorControllers[struct.id].show(true);
        await this.meshManager.toggleAdditionalBrainStructure(struct.id, true);
      }
      updateButtonSummary();
    });

    // Quick action: None
    noneBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      for (const struct of ADDITIONAL_BRAIN_STRUCTURES) {
        checkboxes[struct.id].checked = false;
        if (structColorControllers[struct.id]) structColorControllers[struct.id].show(false);
        await this.meshManager.toggleAdditionalBrainStructure(struct.id, false);
      }
      updateButtonSummary();
    });

    // Insert after anchorController
    if (anchorController && anchorController.domElement) {
      anchorController.domElement.insertAdjacentElement('afterend', container);
    } else if (brainFolder && brainFolder.domElement) {
      const children = brainFolder.domElement.querySelector('.children');
      if (children) children.appendChild(container);
      else brainFolder.domElement.appendChild(container);
    }

    // Direct sidebar color controllers inside Brain Mesh folder for enabled structures
    if (brainFolder) {
      const self = this;
      ADDITIONAL_BRAIN_STRUCTURES.forEach(s => {
        const colorProxy = {
          get color() {
            return self.meshManager.additionalBrainStructures[s.id]?.defaultColorHex || s.defaultColorHex;
          },
          set color(hexVal) {
            setStructureColor(s.id, hexVal);
          }
        };
        const ctrl = brainFolder.addColor(colorProxy, 'color').name(`${s.shortName || s.name} Color`).listen();
        ctrl.show(!!self.meshManager.additionalBrainStructures[s.id]?.enabled);
        structColorControllers[s.id] = ctrl;
      });
    }

    this.additionalBrainStructuresWidget = {
      container,
      updateSummary: updateButtonSummary,
      setCheckboxes: (enabledMap) => {
        for (const id in enabledMap) {
          if (checkboxes[id]) checkboxes[id].checked = !!enabledMap[id];
          if (structColorControllers[id]) structColorControllers[id].show(!!enabledMap[id]);
        }
        updateButtonSummary();
      },
      setColorInputs: (colorMap) => {
        for (const id in colorMap) {
          setStructureColor(id, colorMap[id]);
        }
      }
    };
  }

  setupCustomMeshControls(folder) {
    folder.children.slice().forEach((c) => c.destroy());

    const fileTrigger = {
      chooseFile: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.obj,.mz3,.gii,.gii.gz,.ply,.ply.gz,.stl,.stl.gz';
        input.onchange = async (e) => {
          if (e.target.files && e.target.files[0]) {
            await this.meshManager.loadCustomMesh(e.target.files[0]);
          }
        };
        input.click();
      }
    };

    folder.add(fileTrigger, 'chooseFile').name('📁 Load Mesh (.obj, .mz3, .gii, .ply, .stl)');

    for (let i = 0; i < this.meshManager.customMeshes.length; i++) {
      const c = this.meshManager.customMeshes[i];
      const sub = folder.addFolder(`Mesh: ${c.name}`);
      makeBold(sub.add(c, 'visible').name('Visible')).onChange((v) => {
        c.mesh.visible = v;
      });
      makeBold(sub.add(c, 'clipped').name(`Clip ${c.name}`)).onChange((v) => {
        c.mesh.material.clippingPlanes = v ? this.clippingManager.planes.filter((p) => p.enabled).map((p) => p.threePlane) : [];
        c.mesh.material.needsUpdate = true;
      });
      sub.add(c, 'opacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => {
        c.material.transparent = v < 0.99;
        c.material.opacity = v;
        c.material.needsUpdate = true;
      });
      sub.addColor(c, 'color').name('Color').onChange((hex) => {
        c.material.color.setHex(hex);
        c.material.needsUpdate = true;
      });
    }
  }

  setupTractographyControls(folder) {
    if (!folder) return;
    folder.children.slice().forEach((c) => c.destroy());

    const fileTrigger = {
      chooseFile: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.trk,.trk.gz,.gz,application/gzip,application/x-gzip,application/octet-stream';
        input.onchange = async (e) => {
          if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            const name = f.name.toLowerCase();
            if (name.endsWith('.trk') || name.endsWith('.trk.gz') || name.endsWith('.gz')) {
              await this.tractographyManager.loadTRKFromFile(f);
              this.setupTractographyControls(folder);
              this.switchTab('meshes');
              folder.open();
            } else {
              alert('Please select a valid TrackVis .trk or .trk.gz file.');
            }
          }
        };
        input.click();
      }
    };

    folder.add(fileTrigger, 'chooseFile').name('📁 Load .trk / .trk.gz Tractography');

    if (this.tractographyManager && this.tractographyManager.hasTracts) {
      folder.add({ name: this.tractographyManager.fileName }, 'name').name('File').listen().disable();
      folder.add({
        counts: `${this.tractographyManager.totalStreamlines.toLocaleString()} fibers (${Math.round(this.tractographyManager.totalPoints / 1000)}k pts)`
      }, 'counts').name('Streamlines').listen().disable();

      folder.add(this.tractographyManager, 'visible').name('Visible').onChange((v) => {
        this.tractographyManager.setVisible(v);
      });

      folder.add(this.tractographyManager, 'clipTracts').name('Multi-Plane Clipping').onChange((v) => {
        this.tractographyManager.setClipTracts(v);
      });

      let solidColorCtrl = null;
      let colormapCtrl = null;
      let metricCtrl = null;
      let minCtrl = null;
      let maxCtrl = null;
      let ditherCtrl = null;

      const updateCtrlVisibility = (mode) => {
        if (solidColorCtrl) solidColorCtrl.show(mode === 'solid');
        const isColormap = (mode === 'colormap');
        if (colormapCtrl) colormapCtrl.show(isColormap);
        if (metricCtrl) metricCtrl.show(isColormap);
        const showContrast = (mode === 'orientation' || mode === 'colormap');
        if (minCtrl) minCtrl.show(showContrast);
        if (maxCtrl) maxCtrl.show(showContrast);
        if (ditherCtrl) ditherCtrl.show(showContrast);
      };

      folder.add(this.tractographyManager, 'colorMode', {
        'Orientation (Surf-Ice RGB)': 'orientation',
        'Colormap Gradient': 'colormap',
        'Solid Color': 'solid'
      }).name('Color Mode').onChange((mode) => {
        this.tractographyManager.setColorMode(mode);
        updateCtrlVisibility(mode);
      });

      solidColorCtrl = folder.addColor(this.tractographyManager, 'solidColor').name('Solid Color').onChange((hex) => {
        this.tractographyManager.setSolidColor(hex);
      });

      colormapCtrl = folder.add(this.tractographyManager, 'colormap', {
        'Turbo': 'turbo',
        'Viridis': 'viridis',
        'Plasma': 'plasma',
        'Inferno': 'inferno',
        'CoolWarm': 'coolwarm',
        'Rainbow (Jet)': 'rainbow',
        'Hot': 'hot',
        'Cool': 'cool',
        'Red-Yellow': 'red_yellow',
        'Winters': 'winters'
      }).name('Colormap').onChange((cm) => {
        this.tractographyManager.setColormap(cm);
      });

      metricCtrl = folder.add(this.tractographyManager, 'colormapMetric', {
        'Elevation Angle (Vertical/Horizontal)': 'angle',
        'Inferior - Superior (Z)': 'is',
        'Anterior - Posterior (Y)': 'ap',
        'Left - Right (X)': 'lr',
        'Streamline Length': 'length'
      }).name('Gradient Metric').onChange((m) => {
        this.tractographyManager.setColormapMetric(m);
      });

      minCtrl = folder.add(this.tractographyManager, 'contrastMin', 0.0, 1.0, 0.01).name('Colormap Min').onChange((v) => {
        this.tractographyManager.setContrastMin(v);
      });

      maxCtrl = folder.add(this.tractographyManager, 'contrastMax', 0.0, 1.0, 0.01).name('Colormap Max').onChange((v) => {
        this.tractographyManager.setContrastMax(v);
      });

      ditherCtrl = folder.add(this.tractographyManager, 'dither', 0.0, 0.8, 0.05).name('Fiber Dithering').onChange((v) => {
        this.tractographyManager.setDither(v);
      });

      updateCtrlVisibility(this.tractographyManager.colorMode);

      folder.add(this.tractographyManager, 'opacity', 0.05, 1.0, 0.05).name('Opacity').onChange((v) => {
        this.tractographyManager.setOpacity(v);
      });

      folder.add(this.tractographyManager, 'lineWidth', 1.0, 10.0, 0.5).name('Fiber Width').onChange((w) => {
        this.tractographyManager.setLineWidth(w);
      });

      folder.add(this.tractographyManager, 'subsample', {
        '100% (All Streamlines)': 1,
        '50% (Every 2nd fiber)': 2,
        '25% (Every 4th fiber)': 4,
        '10% (Every 10th fiber)': 10
      }).name('Fiber Density').onChange((sub) => {
        this.tractographyManager.setSubsample(parseInt(sub, 10));
      });

      folder.add({
        remove: () => {
          this.tractographyManager.clear();
          this.setupTractographyControls(folder);
        }
      }, 'remove').name('❌ Remove Tractography');

      folder.open();
      setTimeout(() => {
        if (folder.domElement) {
          folder.domElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  }

  rebuildCustomMeshesFolder() {
    this.setupCustomMeshControls(this.customMeshFolder);
  }

  initDragAndDrop() {
    // Create drop overlay indicator
    const dropOverlay = document.createElement('div');
    dropOverlay.className = 'dropzone-overlay';
    dropOverlay.innerHTML = `
      <div class="dropzone-card">
        <div class="dropzone-icon">📥</div>
        <div class="dropzone-title">Drop File to Load</div>
        <div class="dropzone-desc">Accepts <strong>.obj, .mz3, .gii, .ply, .stl</strong> 3D meshes, <strong>.trk / .trk.gz</strong> tractography, or <strong>.nii / .gii</strong> overlays</div>
      </div>
    `;
    document.body.appendChild(dropOverlay);

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropOverlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null) {
        dropOverlay.classList.remove('active');
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropOverlay.classList.remove('active');

      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

      const file = e.dataTransfer.files[0];
      const name = file.name.toLowerCase();

      try {
        if (name.endsWith('.gii') || name.endsWith('.gii.gz')) {
          const buffer = await file.arrayBuffer();
          if (isGIIScalarFile(buffer)) {
            await this.volumeManager.loadGIIOverlayFromFile(file, this.meshManager);
            this.switchTab('overlays');
          } else {
            await this.meshManager.loadCustomMesh(file);
            this.switchTab('meshes');
          }
        } else if (name.endsWith('.obj') || name.endsWith('.mz3') ||
            name.endsWith('.ply') || name.endsWith('.ply.gz') || name.endsWith('.stl') || name.endsWith('.stl.gz')) {
          await this.meshManager.loadCustomMesh(file);
          this.switchTab('meshes');
        } else if (name.endsWith('.trk') || name.endsWith('.trk.gz')) {
          if (this.tractographyManager) {
            await this.tractographyManager.loadTRKFromFile(file);
            this.setupTractographyControls(this.tractographyFolder);
            this.switchTab('meshes');
            if (this.tractographyFolder) this.tractographyFolder.open();
          }
        } else if (name.endsWith('.nii') || name.endsWith('.nii.gz') || name.endsWith('.gz')) {
          await this.volumeManager.loadOverlayFromFile(file);
          // Ensure clipping is enabled so user immediately sees the overlay on the cut plane
          if (!this.clippingManager.globalEnabled) {
            this.clippingManager.planes[0].enabled = true;
            this.setClippingEnabled(true);
          }
          this.switchTab('overlays');
        } else {
          alert('Unsupported file format. Please drop a .obj, .mz3, .gii, .ply, .stl mesh, .trk / .trk.gz tractography, or .nii / .gii overlay.');
        }
      } catch (err) {
        alert(`Error loading dropped file: ${err.message}`);
      }
    });
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      switch (e.key.toLowerCase()) {
        case 'c':
        case 'x':
          this.setClippingEnabled(!this.clippingManager.globalEnabled);
          break;
        case 'b':
          this.setBrainVisible(!this.meshManager.brainVisible);
          this.switchTab('meshes');
          break;
        case 'k':
          this.setSkullVisible(!this.meshManager.skullVisible);
          this.switchTab('meshes');
          break;
        case 'v':
          this.setVentriclesVisible(!this.meshManager.ventriclesVisible);
          this.switchTab('meshes');
          break;
        case 's':
          this.setSkinVisible(!this.meshManager.skinVisible);
          this.switchTab('meshes');
          break;
        case 'a':
          this.setArterialVisible(!this.meshManager.arterialVisible);
          this.switchTab('meshes');
          break;
        case 'm':
          if (this.multiplanarViewer) this.multiplanarViewer.toggle();
          break;
        case 't':
          this.setTheme(this.themeMode === 'dark' ? 'white' : 'dark');
          break;
        case 'r':
          this.viewer.resetCamera();
          break;
        case '1':
          this.viewer.setAnatomicalView('superior');
          break;
        case '2':
          this.viewer.setAnatomicalView('inferior');
          break;
        case '3':
          this.viewer.setAnatomicalView('anterior');
          break;
        case '4':
          this.viewer.setAnatomicalView('posterior');
          break;
        case '5':
          this.viewer.setAnatomicalView('left_lateral');
          break;
        case '6':
          this.viewer.setAnatomicalView('right_lateral');
          break;
        case 'arrowup':
          if (this.clippingManager.globalEnabled && this.clippingManager.planes[0].enabled) {
            this.clippingManager.planes[0].depth = Math.min(90, this.clippingManager.planes[0].depth + 1);
            this.clippingManager.update();
            this.updateHUD();
          }
          break;
        case 'arrowdown':
          if (this.clippingManager.globalEnabled && this.clippingManager.planes[0].enabled) {
            this.clippingManager.planes[0].depth = Math.max(-90, this.clippingManager.planes[0].depth - 1);
            this.clippingManager.update();
            this.updateHUD();
          }
          break;
      }
    });
  }
}
