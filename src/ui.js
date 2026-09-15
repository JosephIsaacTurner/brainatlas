import * as THREE from 'three';
import GUI from 'lil-gui';
import { VOLUME_CONFIGS } from './volumeManager.js';
import { isGIIScalarFile } from './meshParsers.js';
import { MESH_RENDER_STYLES, ADDITIONAL_BRAIN_STRUCTURES, SKULL_SUBSTRUCTURES } from './meshManager.js';
import { generateMeshFromVolume } from './marchingCubes.js';

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
    this.initTurntableControls();
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
        // Tractography loaded: UI updates via reactive callbacks
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

    if (this.tractographyManager) {
      this.tractographyManager.updateClipping();
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

  setDuralFoldsVisible(visible) {
    this.meshManager.setDuralFoldsVisible(visible);
    const ind = document.getElementById('ind-dural');
    const btn = document.getElementById('btn-toggle-dural');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);
    if (this.duralVisController) {
      this.duralVisController.updateDisplay();
    }
  }

  setTractsVisible(visible) {
    if (this.tractographyManager) {
      this.tractographyManager.setVisible(visible);
      if (visible && this.tractographyManager.enabledCount === 0) {
        this.tractographyManager.enableDefaultCranialNerves();
      }
    }
    const ind = document.getElementById('ind-tracts');
    const btn = document.getElementById('btn-toggle-tracts');
    if (ind) ind.classList.toggle('active', visible);
    if (btn) btn.classList.toggle('active', visible);
    if (this.tractVisController) {
      this.tractVisController.updateDisplay();
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

  initTurntableControls() {
    const container = document.createElement('div');
    container.id = 'turntable-panel';
    container.className = 'turntable-panel';

    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'turntable-checkbox-label';
    checkboxLabel.title = 'Continuously rotate 3D view around vertical turntable axis';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'turntable-spin-cb';
    checkbox.checked = false;

    const labelText = document.createElement('span');
    labelText.className = 'turntable-label-text';
    labelText.textContent = 'Turntable Spin';

    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(labelText);
    container.appendChild(checkboxLabel);

    // Rate control element (hidden by default, appears when checkbox is checked)
    const rateContainer = document.createElement('div');
    rateContainer.id = 'turntable-rate-container';
    rateContainer.className = 'turntable-rate-container';
    rateContainer.style.display = 'none';

    const rateHeader = document.createElement('div');
    rateHeader.className = 'turntable-rate-header';

    const rateTitle = document.createElement('span');
    rateTitle.className = 'turntable-rate-title';
    rateTitle.textContent = 'Rate:';

    const rateWrap = document.createElement('div');
    rateWrap.className = 'turntable-rate-wrap';

    const rateInput = document.createElement('input');
    rateInput.type = 'number';
    rateInput.id = 'turntable-rate-input';
    rateInput.className = 'turntable-rate-num';
    rateInput.min = '1';
    rateInput.max = '300';
    rateInput.step = '1';
    rateInput.value = '20';
    rateInput.title = 'Seconds per full rotation';

    const rateUnit = document.createElement('span');
    rateUnit.className = 'turntable-unit';
    rateUnit.textContent = 's / rot';

    rateWrap.appendChild(rateInput);
    rateWrap.appendChild(rateUnit);

    rateHeader.appendChild(rateTitle);
    rateHeader.appendChild(rateWrap);
    rateContainer.appendChild(rateHeader);

    const rateSlider = document.createElement('input');
    rateSlider.type = 'range';
    rateSlider.id = 'turntable-rate-slider';
    rateSlider.className = 'turntable-rate-slider';
    rateSlider.min = '3';
    rateSlider.max = '120';
    rateSlider.step = '1';
    rateSlider.value = '20';
    rateSlider.title = 'Seconds per full rotation';
    rateContainer.appendChild(rateSlider);

    container.appendChild(rateContainer);
    document.body.appendChild(container);

    const updateSpeed = (val) => {
      const sec = Math.max(0.5, Math.min(600, parseFloat(val) || 20));
      rateInput.value = Math.round(sec);
      rateSlider.value = Math.min(120, Math.max(3, Math.round(sec)));
      if (this.viewer) {
        this.viewer.setTurntableSpeed(sec);
      }
    };

    checkbox.addEventListener('change', () => {
      const active = checkbox.checked;
      rateContainer.style.display = active ? 'flex' : 'none';
      const sec = parseFloat(rateInput.value) || 20;
      if (this.viewer) {
        this.viewer.setTurntableSpin(active, sec);
      }
    });

    rateSlider.addEventListener('input', (e) => {
      updateSpeed(e.target.value);
    });

    rateInput.addEventListener('change', (e) => {
      updateSpeed(e.target.value);
    });

    rateInput.addEventListener('input', (e) => {
      updateSpeed(e.target.value);
    });
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
            <option value="bigbrain">BigBrain (500um)</option>
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
        <!-- Anatomical Structure Toggles (Order: Brain, Skull, Soft Tissue, Arterial, Venous, Ventricles, Dural Folds) in the Same Line -->
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

          <button class="btn btn-toggle" id="btn-toggle-dural" title="Toggle Dural Folds (D)">
            <span class="indicator" id="ind-dural"></span> Dural Folds
          </button>

          <button class="btn btn-toggle" id="btn-toggle-tracts" title="Toggle Tractography (T)">
            <span class="indicator" id="ind-tracts"></span> Tracts
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

    document.getElementById('btn-toggle-dural').addEventListener('click', () => {
      this.setDuralFoldsVisible(!this.meshManager.duralFoldsVisible);
      this.switchTab('meshes');
    });

    const btnTracts = document.getElementById('btn-toggle-tracts');
    if (btnTracts) {
      btnTracts.addEventListener('click', () => {
        if (this.tractographyManager) {
          this.setTractsVisible(!this.tractographyManager.visible);
          this.switchTab('meshes');
        }
      });
    }


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
        <button class="sidebar-search-btn" id="btn-search-structures" title="Search structures, meshes, tracts (/ or ⌘K)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
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
    const btnSearch = document.getElementById('btn-search-structures');
    const panelMeshes = document.getElementById('sidebar-panel-meshes');
    const panelVolumes = document.getElementById('sidebar-panel-volumes');
    const panelOverlays = document.getElementById('sidebar-panel-overlays');

    this.tabButtons = { meshes: btnMeshes, volumes: btnVolumes, overlays: btnOverlays };
    this.tabPanels = { meshes: panelMeshes, volumes: panelVolumes, overlays: panelOverlays };

    btnMeshes.addEventListener('click', () => this.switchTab('meshes'));
    btnVolumes.addEventListener('click', () => this.switchTab('volumes'));
    btnOverlays.addEventListener('click', () => this.switchTab('overlays'));
    if (btnSearch) {
      btnSearch.addEventListener('click', () => this.openStructureSearchModal());
    }

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
    // 1. BRAIN & VELVET SHADER
    this.brainFolder = this.meshGui.addFolder('🧠 Brain');
    const brainFolder = this.brainFolder;
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

    // Brain Velvet Shader Style Parameters
    const velvetFolder = brainFolder.addFolder('✨ Brain Velvet Shader Style');
    velvetFolder.add(this.meshManager, 'velvetAmbient', 0.0, 1.0, 0.01).name('Ambient').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetDiffuse', 0.0, 1.0, 0.01).name('Diffuse').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetSpecular', 0.0, 1.5, 0.01).name('Specular').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetSheen', 0.0, 2.0, 0.01).name('Sheen Halo').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetEdginess', 1.0, 10.0, 0.2).name('Edginess (Nap)').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetBackscatter', 0.0, 1.0, 0.01).name('Backscatter').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetEdge', 0.0, 1.0, 0.05).name('Edge Darkening').onChange(() => this.meshManager.updateVelvetUniforms());
    velvetFolder.add(this.meshManager, 'velvetLightBackfaces').name('Light Backfaces').onChange(() => this.meshManager.updateVelvetUniforms());

    // 2. SKULL (Full vs Ohio)
    this.skullFolder = this.meshGui.addFolder('💀 Skull');
    const skullFolder = this.skullFolder;
    this.skullVisController = makeBold(skullFolder.add(this.meshManager, 'skullVisible').name('Visible')).onChange((v) => {
      this.setSkullVisible(v);
    });
    makeBold(skullFolder.add(this.meshManager, 'skullClipped').name('Clip Skull')).onChange((v) => this.meshManager.setSkullClipped(v));

    this.skullModelController = skullFolder.add(this.meshManager, 'currentSkullType', {
      'Full Skull (MNI Warped)': 'full',
      'Ohio Skull (MNI Warped)': 'ohio'
    }).name('Skull Model').onChange(async (type) => {
      await this.meshManager.switchSkull(type);
      if (this.skullSubstructuresContainer) {
        this.skullSubstructuresContainer.style.display = 'flex';
      }
      if (this.refreshSkullSubstructures) {
        this.refreshSkullSubstructures();
      }
    });

    this.setupSkullSubstructuresMultiselect(skullFolder, this.skullModelController);

    skullFolder.add(this.meshManager, 'skullOpacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setSkullOpacity(v));
    skullFolder.add(this.meshManager, 'skullStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setSkullStyle(v));
    skullFolder.addColor(this.meshManager, 'skullColor').name('Bone Color').onChange(() => this.meshManager.updateSkullMaterial());

    // 3. SOFT TISSUE
    this.skinFolder = this.meshGui.addFolder('👤 Soft Tissue');
    const skinFolder = this.skinFolder;
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
    this.arterialFolder = this.meshGui.addFolder('🩸 Arterial Structures');
    const arterialFolder = this.arterialFolder;
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
    this.venousFolder = this.meshGui.addFolder('🫐 Venous Structures');
    const venousFolder = this.venousFolder;
    this.venousVisController = makeBold(venousFolder.add(this.meshManager, 'venousVisible').name('Visible')).onChange((v) => {
      this.setVenousVisible(v);
    });
    makeBold(venousFolder.add(this.meshManager, 'venousClipped').name('Clip Venous')).onChange((v) => {
      this.meshManager.setVenousClipped(v);
    });
    venousFolder.add(this.meshManager, 'venousOpacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setVenousOpacity(v));
    venousFolder.add(this.meshManager, 'venousStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setVenousStyle(v));
    venousFolder.addColor(this.meshManager, 'venousColor').name('Color').onChange(() => this.meshManager.updateVenousMaterial());

    // 6. VENTRICLES
    this.ventFolder = this.meshGui.addFolder('💧 Ventricles');
    const ventFolder = this.ventFolder;
    this.ventriclesVisController = makeBold(ventFolder.add(this.meshManager, 'ventriclesVisible').name('Visible')).onChange((v) => {
      this.setVentriclesVisible(v);
    });
    makeBold(ventFolder.add(this.meshManager, 'ventriclesClipped').name('Clip Ventricles')).onChange((v) => {
      this.meshManager.setVentriclesClipped(v);
    });
    ventFolder.add(this.meshManager, 'ventriclesOpacity', 0.1, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setVentriclesOpacity(v));
    ventFolder.add(this.meshManager, 'ventriclesStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setVentriclesStyle(v));
    ventFolder.addColor(this.meshManager, 'ventriclesColor').name('Color').onChange(() => this.meshManager.updateVentriclesMaterial());

    // 7. DURAL FOLDS MESH (falx_tentorium_mesh.obj)
    this.duralFolder = this.meshGui.addFolder('🛡️ Dural Folds');
    const duralFolder = this.duralFolder;
    this.duralVisController = makeBold(duralFolder.add(this.meshManager, 'duralFoldsVisible').name('Visible')).onChange((v) => {
      this.setDuralFoldsVisible(v);
    });
    makeBold(duralFolder.add(this.meshManager, 'duralFoldsClipped').name('Clip Dural Folds')).onChange((v) => {
      this.meshManager.setDuralFoldsClipped(v);
    });
    duralFolder.add(this.meshManager, 'duralFoldsOpacity', 0.05, 1.0, 0.01).name('Opacity').onChange((v) => this.meshManager.setDuralFoldsOpacity(v));
    duralFolder.add(this.meshManager, 'duralFoldsStyle', MESH_RENDER_STYLES).name('Style').onChange((v) => this.meshManager.setDuralFoldsStyle(v));
    duralFolder.addColor(this.meshManager, 'duralFoldsColor').name('Color').onChange(() => this.meshManager.updateDuralFoldsMaterial());

    // 8. TRACTOGRAPHY (.trk / .trk.gz / .mat) - Listed higher than Custom Meshes
    this.tractographyFolder = this.meshGui.addFolder('🧵 Tractography (.trk / .trk.gz / .mat)');
    this.setupTractographyControls(this.tractographyFolder);

    // 9. CUSTOM OBJ/PLY/STL MESHES
    this.customMeshFolder = this.meshGui.addFolder('📂 Custom Meshes (.obj, .mz3, .gii, .ply, .stl)');
    this.setupCustomMeshControls(this.customMeshFolder);

    // 10. ENVIRONMENT & VIEW
    const envFolder = this.meshGui.addFolder('🎨 Environment & View');
    this.envFolder = envFolder;
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

    // Default all folders in the right menu to collapsed on initial load
    brainFolder.close();
    velvetFolder.close();
    skullFolder.close();
    skinFolder.close();
    arterialFolder.close();
    venousFolder.close();
    ventFolder.close();
    duralFolder.close();
    this.tractographyFolder.close();
    this.customMeshFolder.close();
    envFolder.close();
  }

  initVolumeGUI() {
    this.volFolder = this.volumeGui.addFolder('🔬 Synchronized Volumetric Slice');
    const volFolder = this.volFolder;

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

    volFolder.add(this.volumeManager, 'interpolate').name('Interpolate Volume').onChange((v) => {
      this.volumeManager.setInterpolate(v);
      this.clippingManager.update();
      if (this.multiplanarViewer && this.multiplanarViewer.isOpen) {
        this.multiplanarViewer.update();
      }
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
      'Rocket': 7,
      'Viridis': 8,
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

    // Default to collapsed on initial load
    volFolder.close();

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

      pFolder.open();
    }

    this.clipGui.open();
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
      'ACTC': 20,
      'Rocket': 21,
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

      posFolder.close();

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

      negFolder.close();

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

        contourFolder.close();
      }

      // Create 3D Mesh button for volumetric overlays
      if (ov.type === 'volume') {
        folder.add({ fn: () => this.openCreateMeshModal(ov) }, 'fn').name('✨ Create 3D Mesh...');
      }

      // Trash / Remove button
      folder.add({ fn: () => this.volumeManager.removeOverlay(ov.id) }, 'fn').name('🗑️ Remove Overlay');
      folder.close();
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

    this.refreshBrainStructures = () => {
      for (const struct of ADDITIONAL_BRAIN_STRUCTURES) {
        if (checkboxes[struct.id]) {
          checkboxes[struct.id].checked = !!this.meshManager.additionalBrainStructures[struct.id]?.enabled;
        }
      }
      updateButtonSummary();
    };
    this._updateBrainStructuresSummary = updateButtonSummary;

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

  setupSkullSubstructuresMultiselect(skullFolder, anchorController) {
    const container = document.createElement('div');
    container.className = 'controller custom-multiselect-controller';
    container.style.display = 'flex';
    this.skullSubstructuresContainer = container;

    const ensureOhioSkullMode = async () => {
      if (this.meshManager.currentSkullType !== 'ohio') {
        if (this.skullModelController) {
          this.skullModelController.setValue('ohio');
        } else {
          await this.meshManager.switchSkull('ohio');
        }
      }
    };

    const nameLabel = document.createElement('div');
    nameLabel.className = 'name';
    nameLabel.textContent = 'Sub-bones';
    nameLabel.title = 'Ohio Skull Sub-bones (22 individual bones)';
    container.appendChild(nameLabel);

    const widget = document.createElement('div');
    widget.className = 'widget multiselect-widget';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'multiselect-toggle-btn';

    const btnText = document.createElement('span');
    btnText.className = 'multiselect-btn-text';
    btnText.textContent = `All (${SKULL_SUBSTRUCTURES.length}) selected`;

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
    titleSpan.textContent = 'Bones (22)';

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

    // Checklist of substructures
    const list = document.createElement('div');
    list.className = 'multiselect-list';

    const checkboxes = {};
    const colorInputs = {};

    const updateButtonSummary = () => {
      const selected = Object.keys(this.meshManager.skullSubstructures).filter(
        id => this.meshManager.skullSubstructures[id]?.enabled
      );
      if (selected.length === 0) {
        btnText.textContent = 'None selected';
      } else if (selected.length === SKULL_SUBSTRUCTURES.length) {
        btnText.textContent = `All (${selected.length}) selected`;
      } else if (selected.length === 1) {
        const item = SKULL_SUBSTRUCTURES.find(s => s.id === selected[0]);
        btnText.textContent = item?.shortName || item?.name || '1 selected';
      } else {
        btnText.textContent = `${selected.length} selected`;
      }
    };

    this.refreshSkullSubstructures = () => {
      for (const struct of SKULL_SUBSTRUCTURES) {
        if (checkboxes[struct.id]) {
          checkboxes[struct.id].checked = !!this.meshManager.skullSubstructures[struct.id]?.enabled;
        }
      }
      updateButtonSummary();
    };

    const swatchDots = {};

    const setBoneColor = async (id, hexVal) => {
      if (swatchDots[id]) swatchDots[id].style.backgroundColor = hexVal;
      if (colorInputs[id]) colorInputs[id].value = hexVal;
      this.meshManager.setSkullSubstructureColor(id, hexVal);
      await ensureOhioSkullMode();
    };

    let currentCategory = null;
    const categoryLabels = {
      'mandible_cervical': 'Mandible & Cervical Vertebrae',
      'cranial': 'Cranial Bones',
      'face': 'Face Bones'
    };

    SKULL_SUBSTRUCTURES.forEach((struct, idx) => {
      if (struct.category !== currentCategory) {
        currentCategory = struct.category;
        const groupHeader = document.createElement('div');
        groupHeader.className = 'multiselect-group-header';
        groupHeader.textContent = categoryLabels[currentCategory] || currentCategory;
        list.appendChild(groupHeader);
      }

      const itemRow = document.createElement('div');
      itemRow.className = 'multiselect-item';

      const leftContainer = document.createElement('div');
      leftContainer.className = 'multiselect-item-left';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'multiselect-checkbox';
      cb.id = `ms-check-skull-${struct.id}`;
      cb.checked = !!this.meshManager.skullSubstructures[struct.id]?.enabled;
      checkboxes[struct.id] = cb;

      const labelText = document.createElement('label');
      labelText.className = 'multiselect-item-text';
      labelText.htmlFor = `ms-check-skull-${struct.id}`;
      labelText.textContent = struct.name;
      labelText.title = struct.name;

      leftContainer.appendChild(cb);
      leftContainer.appendChild(labelText);

      // Color swatch and picker popover
      const colorContainer = document.createElement('div');
      colorContainer.className = 'multiselect-color-container';

      const curColorHex = this.meshManager.skullSubstructures[struct.id]?.defaultColorHex || struct.defaultColorHex;

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

      const hiddenColorInput = document.createElement('input');
      hiddenColorInput.type = 'color';
      hiddenColorInput.className = 'multiselect-hidden-color-input';
      hiddenColorInput.value = curColorHex;
      colorInputs[struct.id] = hiddenColorInput;

      hiddenColorInput.addEventListener('input', (e) => {
        setBoneColor(struct.id, e.target.value);
      });

      hiddenColorInput.addEventListener('change', (e) => {
        setBoneColor(struct.id, e.target.value);
      });

      const colorPopup = document.createElement('div');
      colorPopup.className = 'structure-color-popup';
      if (idx >= 6) {
        colorPopup.classList.add('popup-upward');
      }
      colorPopup.style.display = 'none';

      const renderColorPopup = () => {
        colorPopup.innerHTML = '';

        const popupHeader = document.createElement('div');
        popupHeader.className = 'color-popup-header';
        popupHeader.textContent = 'Bone Color';
        colorPopup.appendChild(popupHeader);

        const presetsContainer = document.createElement('div');
        presetsContainer.className = 'color-popup-presets';

        const activeColorHex = this.meshManager.skullSubstructures[struct.id]?.defaultColorHex || struct.defaultColorHex;
        const mainSkullHex = '#' + new THREE.Color(this.meshManager.skullColor).getHexString();

        const colorOptions = [
          { id: 'default', name: 'Default Bone Color', hex: mainSkullHex },
          { id: 'anatomical', name: `Anatomical Color (${struct.shortName || struct.name})`, hex: struct.anatomicalColorHex || struct.defaultColorHex }
        ];


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
            setBoneColor(struct.id, opt.hex);
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
        const targetState = cb.checked;
        if (this.meshManager.currentSkullType !== 'ohio') {
          this.meshManager.skullSubstructures[struct.id].enabled = targetState;
          await ensureOhioSkullMode();
        }
        cb.checked = targetState;
        this.meshManager.setSkullSubstructureEnabled(struct.id, targetState);
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
      for (const struct of SKULL_SUBSTRUCTURES) {
        this.meshManager.skullSubstructures[struct.id].enabled = true;
        if (checkboxes[struct.id]) checkboxes[struct.id].checked = true;
      }
      await ensureOhioSkullMode();
      for (const struct of SKULL_SUBSTRUCTURES) {
        this.meshManager.setSkullSubstructureEnabled(struct.id, true);
      }
      updateButtonSummary();
    });

    // Quick action: None
    noneBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      for (const struct of SKULL_SUBSTRUCTURES) {
        this.meshManager.skullSubstructures[struct.id].enabled = false;
        if (checkboxes[struct.id]) checkboxes[struct.id].checked = false;
      }
      await ensureOhioSkullMode();
      for (const struct of SKULL_SUBSTRUCTURES) {
        this.meshManager.setSkullSubstructureEnabled(struct.id, false);
      }
      updateButtonSummary();
    });

    // Insert after anchorController
    if (anchorController && anchorController.domElement) {
      anchorController.domElement.insertAdjacentElement('afterend', container);
    } else if (skullFolder && skullFolder.domElement) {
      const children = skullFolder.domElement.querySelector('.children');
      if (children) children.appendChild(container);
      else skullFolder.domElement.appendChild(container);
    }

    this.skullSubstructuresWidget = {
      container,
      updateSummary: updateButtonSummary,
      setCheckboxes: (enabledMap) => {
        for (const id in enabledMap) {
          if (checkboxes[id]) checkboxes[id].checked = !!enabledMap[id];
        }
        updateButtonSummary();
      },
      setColorInputs: (colorMap) => {
        for (const id in colorMap) {
          setBoneColor(id, colorMap[id]);
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
    const folderChildren = folder.domElement.querySelector('.children') || folder.domElement;
    folderChildren.querySelectorAll('.custom-multiselect-controller').forEach((el) => el.remove());
    folder.children.slice().forEach((c) => c.destroy());

    // 1. Multiselect checklist for tract bundles
    const container = document.createElement('div');
    container.className = 'controller custom-multiselect-controller';

    const nameLabel = document.createElement('div');
    nameLabel.className = 'name';
    nameLabel.textContent = 'Tracts';
    nameLabel.title = 'Select neuroanatomical tractography bundles';
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
    titleSpan.textContent = 'Tract Library';

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

    // List of tract bundles
    const list = document.createElement('div');
    list.className = 'multiselect-list';

    const checkboxes = {};
    const badgeSpans = {};
    const swatchDots = {};
    const colorInputs = {};

    const updateButtonSummary = () => {
      if (!this.tractographyManager) return;
      const allTracts = this.tractographyManager.getAllTracts();
      const enabled = allTracts.filter(t => t.enabled);
      if (enabled.length === 0) {
        btnText.textContent = 'None selected';
      } else if (enabled.length === allTracts.length) {
        btnText.textContent = `All (${enabled.length}) active`;
      } else if (enabled.length === 1) {
        btnText.textContent = `${enabled[0].shortName || enabled[0].name}`;
      } else {
        const totalPts = this.tractographyManager.totalPoints;
        const ptsStr = totalPts > 0 ? ` (${Math.round(totalPts / 1000)}k pts)` : '';
        btnText.textContent = `${enabled.length} active${ptsStr}`;
      }
    };

    const updateBadges = () => {
      if (!this.tractographyManager) return;
      for (const tract of this.tractographyManager.getAllTracts()) {
        const badge = badgeSpans[tract.id];
        if (!badge) continue;
        if (tract.loading) {
          badge.textContent = '⏳ loading...';
          badge.className = 'multiselect-item-badge loading';
        } else if (tract.loaded && tract.totalStreamlines > 0) {
          const kFibers = (tract.totalStreamlines / 1000).toFixed(1);
          badge.textContent = `${kFibers}k`;
          badge.className = 'multiselect-item-badge';
        } else {
          badge.textContent = '';
          badge.className = 'multiselect-item-badge';
        }
      }
    };

    const renderTractList = () => {
      list.innerHTML = '';
      if (!this.tractographyManager) return;

      const allTracts = this.tractographyManager.getAllTracts();
      let currentCat = null;
      const catLabels = {
        'projection': 'Projection Tracts',
        'association': 'Association Tracts',
        'commissural': 'Commissural Tracts',
        'cranial': 'Cranial Nerves',
        'custom': 'Custom Uploaded Tracts'
      };

      allTracts.forEach((tract, idx) => {
        if (tract.category !== currentCat) {
          currentCat = tract.category;
          const groupHeader = document.createElement('div');
          groupHeader.className = 'multiselect-group-header';
          groupHeader.textContent = catLabels[currentCat] || tract.categoryName || currentCat;
          list.appendChild(groupHeader);
        }

        const itemRow = document.createElement('div');
        itemRow.className = 'multiselect-item';

        const leftContainer = document.createElement('div');
        leftContainer.className = 'multiselect-item-left';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'multiselect-checkbox';
        cb.id = `ms-check-tract-${tract.id}`;
        cb.checked = Boolean(tract.enabled);
        checkboxes[tract.id] = cb;

        const labelText = document.createElement('label');
        labelText.className = 'multiselect-item-text';
        labelText.htmlFor = `ms-check-tract-${tract.id}`;
        labelText.textContent = tract.shortName || tract.name;
        labelText.title = tract.name;

        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'multiselect-item-badge';
        badgeSpans[tract.id] = badgeSpan;

        labelText.appendChild(badgeSpan);
        leftContainer.appendChild(cb);
        leftContainer.appendChild(labelText);

        // Color swatch and popover
        const colorContainer = document.createElement('div');
        colorContainer.className = 'multiselect-color-container';

        const curColorHex = tract.colorHex || tract.defaultColorHex || '#38bdf8';

        const colorSwatch = document.createElement('button');
        colorSwatch.type = 'button';
        colorSwatch.className = 'multiselect-color-swatch-btn';
        colorSwatch.title = `Color for ${tract.name}`;

        const swatchDot = document.createElement('span');
        swatchDot.className = 'multiselect-swatch-dot';
        swatchDot.style.backgroundColor = curColorHex;
        swatchDots[tract.id] = swatchDot;

        const swatchCaret = document.createElement('span');
        swatchCaret.className = 'multiselect-swatch-caret';
        swatchCaret.textContent = '▾';

        colorSwatch.appendChild(swatchDot);
        colorSwatch.appendChild(swatchCaret);

        const hiddenColorInput = document.createElement('input');
        hiddenColorInput.type = 'color';
        hiddenColorInput.className = 'multiselect-hidden-color-input';
        hiddenColorInput.value = curColorHex;
        colorInputs[tract.id] = hiddenColorInput;

        const setBundleColor = (colorHex) => {
          swatchDot.style.backgroundColor = colorHex;
          hiddenColorInput.value = colorHex;
          this.tractographyManager.setTractColor(tract.id, colorHex);
        };

        hiddenColorInput.addEventListener('input', (e) => setBundleColor(e.target.value));
        hiddenColorInput.addEventListener('change', (e) => setBundleColor(e.target.value));

        const colorPopup = document.createElement('div');
        colorPopup.className = 'structure-color-popup';
        if (idx >= 6) colorPopup.classList.add('popup-upward');
        colorPopup.style.display = 'none';

        const renderColorPopup = () => {
          colorPopup.innerHTML = '';
          const popupHeader = document.createElement('div');
          popupHeader.className = 'color-popup-header';
          popupHeader.textContent = 'Bundle Color';
          colorPopup.appendChild(popupHeader);

          const presetsContainer = document.createElement('div');
          presetsContainer.className = 'color-popup-presets';

          const activeHex = tract.colorHex || tract.defaultColorHex || '#38bdf8';
          const defaultHex = tract.defaultColorHex || '#38bdf8';

          const colorOptions = [
            { id: 'default', name: 'Default Bundle Color', hex: defaultHex },
            { id: 'cyan', name: 'Cyan Highlight', hex: '#38bdf8' },
            { id: 'yellow', name: 'Yellow Gold', hex: '#facc15' },
            { id: 'emerald', name: 'Emerald Green', hex: '#10b981' },
            { id: 'purple', name: 'Violet Purple', hex: '#a855f7' },
            { id: 'rose', name: 'Rose Red', hex: '#f43f5e' }
          ];

          colorOptions.forEach(opt => {
            const optRow = document.createElement('button');
            optRow.type = 'button';
            optRow.className = 'color-popup-option';
            if (opt.hex.toLowerCase() === activeHex.toLowerCase()) optRow.classList.add('active');

            const dot = document.createElement('span');
            dot.className = 'color-popup-dot';
            dot.style.backgroundColor = opt.hex;

            const name = document.createElement('span');
            name.className = 'color-popup-label';
            name.textContent = opt.name;

            optRow.appendChild(dot);
            optRow.appendChild(name);

            if (opt.hex.toLowerCase() === activeHex.toLowerCase()) {
              const check = document.createElement('span');
              check.className = 'color-popup-check';
              check.textContent = '✓';
              optRow.appendChild(check);
            }

            optRow.addEventListener('click', (e) => {
              e.stopPropagation();
              setBundleColor(opt.hex);
              colorPopup.style.display = 'none';
            });

            presetsContainer.appendChild(optRow);
          });

          colorPopup.appendChild(presetsContainer);

          const customBtn = document.createElement('button');
          customBtn.type = 'button';
          customBtn.className = 'color-popup-custom-btn';
          customBtn.innerHTML = '<span class="color-custom-icon">🎨</span> <span class="color-popup-label">Custom Color...</span>';
          customBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            colorPopup.style.display = 'none';
            hiddenColorInput.click();
          });
          colorPopup.appendChild(customBtn);

          // If custom tract, offer remove button
          if (tract.category === 'custom') {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'color-popup-custom-btn';
            removeBtn.style.color = '#ef4444';
            removeBtn.innerHTML = '<span>🗑️</span> <span class="color-popup-label">Delete Tract</span>';
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.tractographyManager.removeCustomTract(tract.id);
              renderTractList();
              updateButtonSummary();
              updateBadges();
            });
            colorPopup.appendChild(removeBtn);
          }
        };

        colorSwatch.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.structure-color-popup').forEach(p => {
            if (p !== colorPopup) p.style.display = 'none';
          });
          const willOpen = (colorPopup.style.display === 'none');
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
          await this.tractographyManager.setTractEnabled(tract.id, cb.checked);
          updateButtonSummary();
          updateBadges();
        });

        itemRow.appendChild(leftContainer);
        itemRow.appendChild(colorContainer);
        list.appendChild(itemRow);
      });
    };

    renderTractList();
    updateButtonSummary();
    updateBadges();

    this._renderTractList = renderTractList;
    this._updateTractSummary = updateButtonSummary;
    this._updateTractBadges = updateBadges;

    // Register manager update listener
    this.tractographyManager.onUpdate(() => {
      for (const tract of this.tractographyManager.getAllTracts()) {
        if (checkboxes[tract.id]) {
          checkboxes[tract.id].checked = Boolean(tract.enabled);
        }
      }
      updateButtonSummary();
      updateBadges();
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
        document.querySelectorAll('.structure-color-popup').forEach(p => p.style.display = 'none');
      }
    });

    // Quick action: All
    allBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      allBtn.disabled = true;
      allBtn.textContent = '...';
      await this.tractographyManager.enableAllTracts();
      allBtn.disabled = false;
      allBtn.textContent = 'All';
      for (const tract of this.tractographyManager.getAllTracts()) {
        if (checkboxes[tract.id]) checkboxes[tract.id].checked = true;
      }
      updateButtonSummary();
      updateBadges();
    });

    // Quick action: None
    noneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tractographyManager.disableAllTracts();
      for (const tract of this.tractographyManager.getAllTracts()) {
        if (checkboxes[tract.id]) checkboxes[tract.id].checked = false;
      }
      updateButtonSummary();
      updateBadges();
    });

    // Append multiselect to folder
    folderChildren.appendChild(container);

    // 2. Global controls in Lil-GUI
    this.tractVisController = makeBold(folder.add(this.tractographyManager, 'visible').name('Visible')).onChange((v) => {
      this.setTractsVisible(v);
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

    const updateCtrlVisibility = () => {
      const mode = this.tractographyManager.colorMode;
      const isColormap = (mode === 'colormap' || mode === 'orientation');
      const isRgb = (this.tractographyManager.colormap === 'rgb');

      if (colormapCtrl) colormapCtrl.show(isColormap);
      if (metricCtrl) metricCtrl.show(isColormap && !isRgb);
      const showContrast = isColormap;
      if (minCtrl) minCtrl.show(showContrast);
      if (maxCtrl) maxCtrl.show(showContrast);
      if (ditherCtrl) ditherCtrl.show(showContrast);
    };

    folder.add(this.tractographyManager, 'colorMode', {
      'Colormap / Directional': 'colormap',
      'Tract Colors': 'solid'
    }).name('Color Mode').onChange((mode) => {
      this.tractographyManager.setColorMode(mode);
      updateCtrlVisibility();
    });

    colormapCtrl = folder.add(this.tractographyManager, 'colormap', {
      'RGB': 'rgb',
      'Lead-DBS Colorbar': 'leaddbs',
      'Rocket': 'rocket',
      'Turbo': 'turbo',
      'Viridis': 'viridis',
      'Plasma': 'plasma',
      'Inferno': 'inferno',
      'Magma': 'magma',
      'Cividis': 'cividis',
      'Cool-Warm': 'coolwarm',
      'Rainbow (Jet)': 'rainbow',
      'Hot': 'hot',
      'Cool': 'cool',
      'Red-Yellow': 'red_yellow',
      'Winters': 'winters',
      'Grayscale': 'grayscale',
      'ACTC': 'actc'
    }).name('Colormap').onChange((cm) => {
      this.tractographyManager.setColormap(cm);
      updateCtrlVisibility();
    });

    metricCtrl = folder.add(this.tractographyManager, 'colormapMetric', {
      'Streamline Values / Effect Size': 'vals',
      'Principal Direction (LR → AP → IS)': 'principal',
      'Inferior - Superior (Z)': 'is',
      'Anterior - Posterior (Y)': 'ap',
      'Left - Right (X)': 'lr',
      'Elevation Angle (Vertical/Horizontal)': 'angle',
      'Streamline Length': 'length'
    }).name('Gradient Metric').onChange((m) => {
      this.tractographyManager.setColormapMetric(m);
      if (m === 'vals') {
        if (!this.tractographyManager.customColormapTable) {
          this.openColorbarFilePicker();
        }
      }
    });

    folder.add({
      loadColorbar: () => this.openColorbarFilePicker()
    }, 'loadColorbar').name('🎨 Load Colorbar (.svg)...');

    minCtrl = folder.add(this.tractographyManager, 'contrastMin', 0.0, 1.0, 0.01).name('Colormap Min').onChange((v) => {
      this.tractographyManager.setContrastMin(v);
    });

    maxCtrl = folder.add(this.tractographyManager, 'contrastMax', 0.0, 1.0, 0.01).name('Colormap Max').onChange((v) => {
      this.tractographyManager.setContrastMax(v);
    });

    ditherCtrl = folder.add(this.tractographyManager, 'dither', 0.0, 0.8, 0.05).name('Fiber Dithering').onChange((v) => {
      this.tractographyManager.setDither(v);
    });

    updateCtrlVisibility();

    folder.add(this.tractographyManager, 'opacity', 0.05, 1.0, 0.05).name('Opacity').onChange((v) => {
      this.tractographyManager.setOpacity(v);
    });

    folder.add(this.tractographyManager, 'lineWidth', 1.0, 10.0, 0.5).name('Fiber Width').onChange((w) => {
      this.tractographyManager.setLineWidth(w);
    });

    folder.add(this.tractographyManager, 'subsample', {
      '10% (Default - Fast)': 10,
      '25% (Medium)': 4,
      '50% (Dense)': 2,
      '100% (All Streamlines)': 1
    }).name('Fiber Density').onChange((sub) => {
      this.tractographyManager.setSubsample(parseInt(sub, 10));
    });

    // Custom TRK / Lead-DBS MAT upload trigger
    const fileTrigger = {
      chooseFile: async () => {
        if (window.showOpenFilePicker) {
          try {
            const pickerOpts = {
              types: [{
                description: 'Tractography (.trk, .trk.gz, .mat)',
                accept: {
                  'application/octet-stream': ['.trk', '.trk.gz', '.mat']
                }
              }],
              multiple: false
            };
            if (this._lastFileHandle) pickerOpts.startIn = this._lastFileHandle;
            const [fileHandle] = await window.showOpenFilePicker(pickerOpts);
            if (fileHandle) {
              this._lastFileHandle = fileHandle;
              const f = await fileHandle.getFile();
              const name = f.name.toLowerCase();
              if (name.endsWith('.mat')) {
                this.showProgressModal('Loading Lead-DBS Tractogram...', `Processing ${f.name}...`, 0.1);
                try {
                  await this.tractographyManager.loadLeadDBSFromFile(f, (p) => {
                    this.updateProgressModal({ progress: p.progress, message: p.message });
                  });
                  this.setTractsVisible(true);
                  this.refreshTractMultiselect();
                  this.switchTab('meshes');
                  folder.open();
                } catch (err) {
                  alert(`Error loading ${f.name}: ${err.message}`);
                } finally {
                  this.hideProgressModal();
                }
              } else if (name.endsWith('.trk') || name.endsWith('.trk.gz') || name.endsWith('.gz')) {
                this.showProgressModal('Loading Tractogram...', `Processing ${f.name}...`, 0.1);
                try {
                  await this.tractographyManager.loadTRKFromFile(f, (p) => {
                    this.updateProgressModal({ progress: p.progress, message: p.message });
                  });
                  this.setTractsVisible(true);
                  this.refreshTractMultiselect();
                  this.switchTab('meshes');
                  folder.open();
                } catch (err) {
                  alert(`Error loading ${f.name}: ${err.message}`);
                } finally {
                  this.hideProgressModal();
                }
              }
              return;
            }
          } catch (err) {
            if (err.name === 'AbortError') return;
          }
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.trk,.trk.gz,.gz,.mat,application/gzip,application/x-gzip,application/octet-stream';
        input.onchange = async (e) => {
          if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            const name = f.name.toLowerCase();
            if (name.endsWith('.mat')) {
              this.showProgressModal('Loading Lead-DBS Tractogram...', `Processing ${f.name}...`, 0.1);
              try {
                await this.tractographyManager.loadLeadDBSFromFile(f, (p) => {
                  this.updateProgressModal({ progress: p.progress, message: p.message });
                });
                this.setTractsVisible(true);
                this.refreshTractMultiselect();
                this.switchTab('meshes');
                folder.open();
              } catch (err) {
                alert(`Error loading ${f.name}: ${err.message}`);
              } finally {
                this.hideProgressModal();
              }
            } else if (name.endsWith('.trk') || name.endsWith('.trk.gz') || name.endsWith('.gz')) {
              this.showProgressModal('Loading Tractogram...', `Processing ${f.name}...`, 0.1);
              try {
                await this.tractographyManager.loadTRKFromFile(f, (p) => {
                  this.updateProgressModal({ progress: p.progress, message: p.message });
                });
                this.setTractsVisible(true);
                this.refreshTractMultiselect();
                this.switchTab('meshes');
                folder.open();
              } catch (err) {
                alert(`Error loading ${f.name}: ${err.message}`);
              } finally {
                this.hideProgressModal();
              }
            } else {
              alert('Please select a valid TrackVis .trk, .trk.gz, or Lead-DBS .mat file.');
            }
          }
        };
        input.click();
      }
    };

    folder.add(fileTrigger, 'chooseFile').name('📁 Load Custom .trk / .mat');

    folder.add({
      clearAll: () => {
        this.tractographyManager.clear();
        renderTractList();
        updateButtonSummary();
        updateBadges();
      }
    }, 'clearAll').name('❌ Clear All Tracts');
  }

  refreshTractMultiselect() {
    if (this._renderTractList) {
      this._renderTractList();
      if (this._updateTractSummary) this._updateTractSummary();
      if (this._updateTractBadges) this._updateTractBadges();
    } else if (this.tractographyFolder) {
      this.setupTractographyControls(this.tractographyFolder);
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
        <div class="dropzone-desc">Accepts <strong>.obj, .mz3, .gii, .ply, .stl</strong> 3D meshes, <strong>.trk / .trk.gz / .mat</strong> tractography, or <strong>.nii / .gii</strong> overlays</div>
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

      const files = Array.from(e.dataTransfer.files);
      const matFile = files.find(f => f.name.toLowerCase().endsWith('.mat'));
      const trkFile = files.find(f => f.name.toLowerCase().endsWith('.trk') || f.name.toLowerCase().endsWith('.trk.gz'));
      const svgFile = files.find(f => f.name.toLowerCase().endsWith('.svg'));
      const niiFile = files.find(f => f.name.toLowerCase().endsWith('.nii') || f.name.toLowerCase().endsWith('.nii.gz'));
      const meshFile = files.find(f => {
        const n = f.name.toLowerCase();
        return n.endsWith('.obj') || n.endsWith('.mz3') || n.endsWith('.ply') || n.endsWith('.ply.gz') || n.endsWith('.stl') || n.endsWith('.stl.gz') || n.endsWith('.gii') || n.endsWith('.gii.gz');
      });

      try {
        if (matFile) {
          if (this.tractographyManager) {
            this.showProgressModal('Loading Lead-DBS Tractogram...', `Processing ${matFile.name}...`, 0.1);
            try {
              await this.tractographyManager.loadLeadDBSFromFile(matFile, (p) => {
                this.updateProgressModal({ progress: p.progress, message: p.message });
              });
              if (svgFile) {
                this.updateProgressModal({ progress: 0.95, message: `Loading colorbar from ${svgFile.name}...` });
                await this.tractographyManager.loadColorbarSVGFromFile(svgFile);
              }
              this.setTractsVisible(true);
              this.refreshTractMultiselect();
              this.switchTab('meshes');
              if (this.tractographyFolder) this.tractographyFolder.open();
            } finally {
              this.hideProgressModal();
            }
          }
        } else if (trkFile) {
          if (this.tractographyManager) {
            this.showProgressModal('Loading Tractogram...', `Processing ${trkFile.name}...`, 0.1);
            try {
              await this.tractographyManager.loadTRKFromFile(trkFile, (p) => {
                this.updateProgressModal({ progress: p.progress, message: p.message });
              });
              if (svgFile) {
                this.updateProgressModal({ progress: 0.95, message: `Loading colorbar from ${svgFile.name}...` });
                await this.tractographyManager.loadColorbarSVGFromFile(svgFile);
              }
              this.setTractsVisible(true);
              this.refreshTractMultiselect();
              this.switchTab('meshes');
              if (this.tractographyFolder) this.tractographyFolder.open();
            } finally {
              this.hideProgressModal();
            }
          }
        } else if (svgFile) {
          if (this.tractographyManager) {
            this.showProgressModal('Loading Colorbar...', `Parsing ${svgFile.name}...`, 0.3);
            try {
              await this.tractographyManager.loadColorbarSVGFromFile(svgFile);
              this.refreshTractMultiselect();
              this.switchTab('meshes');
              if (this.tractographyFolder) this.tractographyFolder.open();
            } finally {
              this.hideProgressModal();
            }
          }
        } else if (niiFile) {
          await this.volumeManager.loadOverlayFromFile(niiFile);
          if (!this.clippingManager.globalEnabled) {
            this.clippingManager.planes[0].enabled = true;
            this.setClippingEnabled(true);
          }
          this.switchTab('overlays');
        } else if (meshFile) {
          const n = meshFile.name.toLowerCase();
          if (n.endsWith('.gii') || n.endsWith('.gii.gz')) {
            const buffer = await meshFile.arrayBuffer();
            if (isGIIScalarFile(buffer)) {
              await this.volumeManager.loadGIIOverlayFromFile(meshFile, this.meshManager);
              this.switchTab('overlays');
            } else {
              await this.meshManager.loadCustomMesh(meshFile);
              this.switchTab('meshes');
            }
          } else {
            await this.meshManager.loadCustomMesh(meshFile);
            this.switchTab('meshes');
          }
        } else {
          alert('Unsupported file format. Please drop a .obj, .mz3, .gii, .ply, .stl mesh, .trk / .trk.gz / .mat tractography, .svg colorbar, or .nii / .gii overlay.');
        }
      } catch (err) {
        this.hideProgressModal();
        alert(`Error loading dropped file: ${err.message}`);
      }
    });
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Global Search shortcut (/ or Cmd+K / Ctrl+K)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName))) {
        e.preventDefault();
        this.openStructureSearchModal();
        return;
      }

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
        case 'd':
          this.setDuralFoldsVisible(!this.meshManager.duralFoldsVisible);
          this.switchTab('meshes');
          break;

        case 'm':
          if (this.multiplanarViewer) this.multiplanarViewer.toggle();
          break;
        case 't':
          if (this.tractographyManager) {
            this.setTractsVisible(!this.tractographyManager.visible);
            this.switchTab('meshes');
          }
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

  /**
   * Opens the Create 3D Mesh dialog for a NIfTI volumetric overlay
   */
  openCreateMeshModal(overlay) {
    if (!overlay || overlay.type !== 'volume' || !overlay.rawOverlayData) {
      alert('Only 3D NIfTI volumetric overlays can be converted into 3D meshes.');
      return;
    }

    const existing = document.getElementById('mesh-creator-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'mesh-creator-modal-backdrop';
    backdrop.id = 'mesh-creator-backdrop';

    const modal = document.createElement('div');
    modal.className = 'mesh-creator-modal';

    const dims = overlay.dims || [0, 0, 0];
    const rawMin = overlay.rawMin !== undefined ? overlay.rawMin : 0;
    const rawMax = overlay.rawMax !== undefined ? overlay.rawMax : 1;
    let defaultThreshold = overlay.posMin !== undefined && overlay.posMin > rawMin && overlay.posMin < rawMax
      ? overlay.posMin
      : parseFloat(((rawMin + rawMax) * 0.5).toFixed(2));
    if (defaultThreshold <= rawMin || defaultThreshold >= rawMax) {
      defaultThreshold = parseFloat((rawMin + 0.5 * (rawMax - rawMin)).toFixed(2));
    }

    const baseCleanName = (overlay.name || 'overlay').replace(/\.nii(\.gz)?$/i, '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const defaultName = `${baseCleanName}_mesh`;
    const rangeSpan = Math.max(1e-4, rawMax - rawMin);
    const stepSize = rangeSpan > 50 ? 0.5 : (rangeSpan > 5 ? 0.1 : 0.01);

    modal.innerHTML = `
      <div class="mesh-creator-header">
        <div class="mesh-creator-title-group">
          <span class="mesh-creator-icon">✨</span>
          <span class="mesh-creator-title">Create 3D Mesh from NIfTI</span>
        </div>
        <button type="button" class="mesh-creator-close-btn" id="btn-mesh-creator-close" title="Close (Esc)">✕</button>
      </div>
      <div class="mesh-creator-body">
        <div class="mesh-creator-info">
          <div class="mesh-creator-row">
            <span class="mesh-creator-label">Overlay Source:</span>
            <span class="mesh-creator-value" style="color: #cbd5e1; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${overlay.name}</span>
          </div>
          <div class="mesh-creator-row">
            <span class="mesh-creator-label">Volume Grid:</span>
            <span class="mesh-creator-value">${dims[0]} × ${dims[1]} × ${dims[2]} voxels</span>
          </div>
          <div class="mesh-creator-row">
            <span class="mesh-creator-label">Data Range:</span>
            <span class="mesh-creator-value">[${rawMin.toFixed(2)}, ${rawMax.toFixed(2)}]</span>
          </div>
        </div>

        <div class="mesh-creator-section">
          <label class="mesh-creator-input-label" for="mc-threshold-slider">Threshold Value (Isovalue Cutoff):</label>
          <div class="mesh-creator-slider-row">
            <input type="range" class="mesh-creator-slider" id="mc-threshold-slider"
              min="${rawMin}" max="${rawMax}" step="${stepSize}" value="${defaultThreshold}">
            <input type="number" class="mesh-creator-number" id="mc-threshold-number"
              min="${rawMin}" max="${rawMax}" step="${stepSize}" value="${defaultThreshold}">
          </div>
          <span class="mesh-creator-hint">Voxels with intensity ≥ threshold are binarized and meshed into an in-memory 3D surface.</span>
        </div>

        <div class="mesh-creator-section">
          <label class="mesh-creator-input-label" for="mc-name-input">Mesh Name:</label>
          <input type="text" class="mesh-creator-text-input" id="mc-name-input" value="${defaultName}">
        </div>

        <div class="mesh-creator-section">
          <label class="mesh-creator-input-label" for="mc-color-input">Surface Color:</label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="color" id="mc-color-input" value="#38bdf8" style="cursor: pointer; width: 38px; height: 28px; border: none; border-radius: 4px; background: transparent;">
            <span class="mesh-creator-hint" id="mc-color-label">#38bdf8</span>
          </div>
        </div>

        <div class="mesh-creator-status" id="mc-status-text"></div>
      </div>

      <div class="mesh-creator-footer">
        <button type="button" class="mesh-creator-btn btn-secondary" id="btn-mesh-creator-cancel">Cancel</button>
        <button type="button" class="mesh-creator-btn btn-primary" id="btn-mesh-creator-create">Create 3D Mesh</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const slider = modal.querySelector('#mc-threshold-slider');
    const numInput = modal.querySelector('#mc-threshold-number');
    const nameInput = modal.querySelector('#mc-name-input');
    const colorInput = modal.querySelector('#mc-color-input');
    const colorLabel = modal.querySelector('#mc-color-label');
    const statusText = modal.querySelector('#mc-status-text');
    const btnCancel = modal.querySelector('#btn-mesh-creator-cancel');
    const btnClose = modal.querySelector('#btn-mesh-creator-close');
    const btnCreate = modal.querySelector('#btn-mesh-creator-create');

    const closeModal = () => {
      window.removeEventListener('keydown', onKey);
      backdrop.remove();
    };

    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);

    slider.addEventListener('input', (e) => {
      numInput.value = e.target.value;
    });

    numInput.addEventListener('input', (e) => {
      slider.value = e.target.value;
    });

    colorInput.addEventListener('input', (e) => {
      colorLabel.textContent = e.target.value;
    });

    btnCancel.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    btnCreate.addEventListener('click', () => {
      const thresholdVal = parseFloat(numInput.value);
      if (isNaN(thresholdVal)) {
        statusText.textContent = 'Please enter a valid numeric threshold.';
        statusText.style.color = '#ef4444';
        return;
      }

      const meshName = nameInput.value.trim() || defaultName;
      const colorHex = colorInput.value || '#38bdf8';

      btnCreate.disabled = true;
      btnCancel.disabled = true;
      statusText.textContent = '⏳ Generating 3D mesh (marching cubes)...';
      statusText.style.color = '#38bdf8';

      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            const geom = generateMeshFromVolume(overlay.rawOverlayData, overlay.dims, overlay.affine, thresholdVal, 1);
            if (!geom || geom.getAttribute('position').count === 0) {
              statusText.textContent = `⚠️ No surface found at threshold ${thresholdVal.toFixed(2)}. Try adjusting the threshold within [${rawMin.toFixed(2)}, ${rawMax.toFixed(2)}].`;
              statusText.style.color = '#f59e0b';
              btnCreate.disabled = false;
              btnCancel.disabled = false;
              return;
            }

            const customEntry = this.meshManager._registerCustomMesh(geom, meshName);
            if (customEntry) {
              const hexNum = parseInt(colorHex.replace('#', '0x'), 16);
              customEntry.color = hexNum;
              if (customEntry.material && customEntry.material.color) {
                customEntry.material.color.setHex(hexNum);
              }
              customEntry.visible = true;
              if (customEntry.mesh) customEntry.mesh.visible = true;
            }

            closeModal();
            this.switchTab('meshes');
            if (this.customMeshFolder) this.customMeshFolder.open();
          } catch (err) {
            statusText.textContent = `Error generating mesh: ${err.message}`;
            statusText.style.color = '#ef4444';
            btnCreate.disabled = false;
            btnCancel.disabled = false;
          }
        }, 30);
      });
    });
  }

  /**
   * Builds an index of all searchable structures, meshes, tracts, bones, and overlays
   */
  buildSearchIndex() {
    const items = [];

    // 1. Brain Surface Meshes
    items.push({
      id: 'brain_pial',
      category: 'Brain Surface',
      icon: '🧠',
      title: 'Pial Cortex (Gray Matter Surface)',
      subtitle: 'Cerebral cortex surface model with velvet shader',
      keywords: 'cortex gray matter cerebrum hemisphere velvet brain surface pial',
      tab: 'meshes',
      folder: this.brainFolder,
      action: () => {
        this.setBrainVisible(true);
        if (this.brainFolder) this.brainFolder.open();
      }
    });

    // 2. Additional Brain Structures (Subcortical & Brainstem)
    if (ADDITIONAL_BRAIN_STRUCTURES) {
      ADDITIONAL_BRAIN_STRUCTURES.forEach(struct => {
        items.push({
          id: struct.id,
          category: 'Subcortical Structure',
          icon: '🧠',
          title: struct.name,
          subtitle: `Subcortical brain mesh (${struct.shortName || struct.name})`,
          keywords: `brain subcortical basal ganglia thalamus brainstem nucleus ${struct.name} ${struct.shortName || ''} ${struct.id}`,
          tab: 'meshes',
          folder: this.brainFolder,
          action: async () => {
            this.switchTab('meshes');
            await this.meshManager.toggleAdditionalBrainStructure(struct.id, true);
            const cb = document.getElementById(`ms-check-${struct.id}`);
            if (cb) cb.checked = true;
            if (this.additionalBrainStructuresWidget?.setCheckboxes) {
              this.additionalBrainStructuresWidget.setCheckboxes({ [struct.id]: true });
            }
            if (this.refreshBrainStructures) this.refreshBrainStructures();
            this.setBrainVisible(true);
            if (this.brainFolder) {
              this.brainFolder.open();
              setTimeout(() => {
                if (this.additionalBrainStructuresWidget?.container) {
                  this.additionalBrainStructuresWidget.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 60);
            }
          }
        });
      });
    }

    // 3. Skull & Bones
    items.push({
      id: 'skull_monolithic',
      category: 'Skull Bone',
      icon: '💀',
      title: 'Full Skull (Monolithic)',
      subtitle: 'Complete cranium and facial skeleton',
      keywords: 'skull cranium bone head monolithic',
      tab: 'meshes',
      folder: this.skullFolder,
      action: async () => {
        if (this.skullModelController) this.skullModelController.setValue('full');
        this.setSkullVisible(true);
        if (this.skullFolder) this.skullFolder.open();
      }
    });

    if (SKULL_SUBSTRUCTURES) {
      const catLabels = {
        'mandible_cervical': 'Mandible & Cervical',
        'cranial': 'Cranial Bone',
        'face': 'Facial Bone'
      };
      SKULL_SUBSTRUCTURES.forEach(bone => {
        items.push({
          id: bone.id,
          category: catLabels[bone.category] || 'Skull Sub-bone',
          icon: '💀',
          title: bone.name,
          subtitle: `Ohio Skull anatomical sub-bone (${bone.shortName || bone.name})`,
          keywords: `skull bone ${catLabels[bone.category] || ''} ${bone.name} ${bone.shortName || ''} ${bone.id}`,
          tab: 'meshes',
          folder: this.skullFolder,
          action: async () => {
            if (this.meshManager.currentSkullType !== 'ohio' && this.skullModelController) {
              this.skullModelController.setValue('ohio');
            }
            await this.meshManager.setSkullSubstructureEnabled(bone.id, true);
            const cb = document.getElementById(`ms-check-skull-${bone.id}`);
            if (cb) cb.checked = true;
            if (this.refreshSkullSubstructures) this.refreshSkullSubstructures();
            this.setSkullVisible(true);
            if (this.skullFolder) this.skullFolder.open();
          }
        });
      });
    }

    // 4. Soft Tissue
    items.push({
      id: 'skin_soft_tissue',
      category: 'Soft Tissue',
      icon: '👤',
      title: 'Soft Tissue (Skin & Scalp)',
      subtitle: 'External head and facial soft tissue mesh',
      keywords: 'skin scalp soft tissue face head',
      tab: 'meshes',
      folder: this.skinFolder,
      action: () => {
        this.setSkinVisible(true);
        if (this.skinFolder) this.skinFolder.open();
      }
    });

    // 5. Vascular & Ventricles & Dura
    items.push({
      id: 'arterial_vasculature',
      category: 'Vasculature',
      icon: '🫀',
      title: 'Arterial Vasculature',
      subtitle: 'Circle of Willis and cerebral arteries',
      keywords: 'artery arterial circle of willis carotids basilar vasculature vessels',
      tab: 'meshes',
      folder: this.arterialFolder,
      action: () => {
        this.setArterialVisible(true);
        if (this.arterialFolder) this.arterialFolder.open();
      }
    });

    items.push({
      id: 'venous_vasculature',
      category: 'Vasculature',
      icon: '🩸',
      title: 'Venous Vasculature',
      subtitle: 'Dural venous sinuses and cerebral veins',
      keywords: 'vein venous sagittal sinus transverse sigmoid jugular vessels',
      tab: 'meshes',
      folder: this.venousFolder,
      action: () => {
        this.setVenousVisible(true);
        if (this.venousFolder) this.venousFolder.open();
      }
    });

    items.push({
      id: 'ventricles_csf',
      category: 'Fluid Spaces',
      icon: '💧',
      title: 'Ventricles (Ventricular System)',
      subtitle: 'Lateral, third, fourth ventricles and CSF pathways',
      keywords: 'ventricle ventricles csf cerebrospinal fluid lateral third fourth choroid',
      tab: 'meshes',
      folder: this.ventFolder,
      action: () => {
        this.setVentriclesVisible(true);
        if (this.ventFolder) this.ventFolder.open();
      }
    });

    items.push({
      id: 'dural_folds',
      category: 'Meninges',
      icon: '🛡️',
      title: 'Dural Folds (Falx & Tentorium)',
      subtitle: 'Falx cerebri and tentorium cerebelli',
      keywords: 'dura dural folds falx cerebri tentorium cerebelli meninges',
      tab: 'meshes',
      folder: this.duralFolder,
      action: () => {
        this.setDuralFoldsVisible(true);
        if (this.duralFolder) this.duralFolder.open();
      }
    });

    // 6. Tractography Bundles
    if (this.tractographyManager) {
      const allTracts = this.tractographyManager.getAllTracts();
      allTracts.forEach(tract => {
        items.push({
          id: tract.id,
          category: `Tract: ${tract.categoryName || tract.category || 'White Matter'}`,
          icon: '🧵',
          title: tract.name,
          subtitle: `White matter fiber tract (${tract.shortName || tract.name})`,
          keywords: `tract tractography streamline white matter fibers nerve ${tract.name} ${tract.shortName || ''} ${tract.id}`,
          tab: 'meshes',
          folder: this.tractographyFolder,
          action: async () => {
            await this.tractographyManager.setTractEnabled(tract.id, true);
            this.setTractsVisible(true);
            const cb = document.getElementById(`ms-check-tract-${tract.id}`);
            if (cb) cb.checked = true;
            this.refreshTractMultiselect();
            if (this.tractographyFolder) this.tractographyFolder.open();
          }
        });
      });
    }

    // 7. Base MRI Volumes
    for (const [key, cfg] of Object.entries(VOLUME_CONFIGS)) {
      items.push({
        id: key,
        category: 'MRI Volume / Atlas',
        icon: '🔬',
        title: cfg.label || key,
        subtitle: `Volumetric template/atlas (${key})`,
        keywords: `volume atlas mri contrast mni bigbrain histology tissue structure substructure ${cfg.label || ''} ${key}`,
        tab: 'volumes',
        folder: this.volFolder,
        action: async () => {
          await this.switchBaseVolume(key);
          if (this.volFolder) this.volFolder.open();
        }
      });
    }

    // 8. Active Overlays
    if (this.volumeManager && this.volumeManager.overlays) {
      this.volumeManager.overlays.forEach((ov, idx) => {
        items.push({
          id: ov.id,
          category: 'Overlay Map',
          icon: ov.type === 'gifti_surface' ? '🎨' : '📊',
          title: ov.name,
          subtitle: `Active overlay [${idx + 1}] (${ov.type === 'volume' ? '3D NIfTI' : 'GIfTI Surface'})`,
          keywords: `overlay nifti gifti statistical map ${ov.name} ${ov.id}`,
          tab: 'overlays',
          folder: null,
          action: () => {
            this.volumeManager.toggleOverlay(ov.id, true);
          }
        });
      });
    }

    return items;
  }

  /**
   * Opens the Structure Search modal dialog
   */
  openStructureSearchModal() {
    const existing = document.getElementById('structure-search-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'structure-search-backdrop';
    backdrop.id = 'structure-search-backdrop';

    const modal = document.createElement('div');
    modal.className = 'structure-search-modal';

    modal.innerHTML = `
      <div class="structure-search-header">
        <div class="structure-search-input-wrap">
          <div class="structure-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input type="text" class="structure-search-input" id="structure-search-input"
            placeholder="Search structures, meshes, tracts, bones, or atlases... (e.g. 'thalamus', 'optic', 'cst')" autocomplete="off" spellcheck="false">
        </div>
        <button type="button" class="structure-search-close-btn" id="btn-structure-search-close" title="Close (Esc)">✕</button>
      </div>
      <div class="structure-search-results" id="structure-search-results"></div>
      <div class="structure-search-footer">
        <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
        <span><kbd>↵</kbd> to select & open</span>
        <span><kbd>esc</kbd> to dismiss</span>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const input = modal.querySelector('#structure-search-input');
    const resultsContainer = modal.querySelector('#structure-search-results');
    const closeBtn = modal.querySelector('#btn-structure-search-close');

    const searchIndex = this.buildSearchIndex();
    let selectedIndex = 0;
    let filteredItems = searchIndex.slice(0, 25);

    const closeModal = () => {
      window.removeEventListener('keydown', onKey);
      backdrop.remove();
    };

    const renderResults = () => {
      resultsContainer.innerHTML = '';
      if (filteredItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'structure-search-empty';
        empty.innerHTML = `No structures found matching "<strong>${input.value.trim()}</strong>"`;
        resultsContainer.appendChild(empty);
        return;
      }

      filteredItems.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'structure-search-item';
        if (idx === selectedIndex) row.classList.add('selected');

        row.innerHTML = `
          <div class="structure-search-item-main">
            <span class="structure-search-item-icon">${item.icon || '📍'}</span>
            <div class="structure-search-item-text">
              <span class="structure-search-item-title">${item.title}</span>
              <span class="structure-search-item-subtitle">${item.subtitle || ''}</span>
            </div>
          </div>
          <span class="structure-search-item-badge">${item.category}</span>
        `;

        row.addEventListener('click', () => {
          activateItem(item);
        });

        row.addEventListener('mouseenter', () => {
          selectedIndex = idx;
          updateSelectedClass();
        });

        resultsContainer.appendChild(row);
      });

      ensureSelectedVisible();
    };

    const updateSelectedClass = () => {
      const rows = resultsContainer.querySelectorAll('.structure-search-item');
      rows.forEach((r, idx) => {
        r.classList.toggle('selected', idx === selectedIndex);
      });
    };

    const ensureSelectedVisible = () => {
      const selectedEl = resultsContainer.children[selectedIndex];
      if (selectedEl && selectedEl.scrollIntoView) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    };

    const activateItem = async (item) => {
      closeModal();
      if (item.tab) {
        this.switchTab(item.tab);
      }
      if (item.action) {
        await item.action();
      }
      if (item.folder) {
        item.folder.open();
      }
    };

    const filterList = (query) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        filteredItems = searchIndex.slice(0, 25);
      } else {
        const terms = q.split(/\s+/).filter(Boolean);
        filteredItems = searchIndex.filter(item => {
          const haystack = `${item.title} ${item.subtitle || ''} ${item.category} ${item.keywords || ''}`.toLowerCase();
          return terms.every(term => haystack.includes(term));
        }).slice(0, 30);
      }
      selectedIndex = 0;
      renderResults();
    };

    input.addEventListener('input', (e) => {
      filterList(e.target.value);
    });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredItems.length;
          updateSelectedClass();
          ensureSelectedVisible();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
          updateSelectedClass();
          ensureSelectedVisible();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          activateItem(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    renderResults();
    requestAnimationFrame(() => input.focus());
  }

  /**
   * Universal progress modal for file loading, decompression, and parsing
   */
  showProgressModal(title = 'Loading File...', message = 'Processing...', progress = 0.0, detail = '') {
    const modal = document.getElementById('progress-modal');
    if (!modal) return;
    const titleEl = document.getElementById('progress-modal-title');
    const statusEl = document.getElementById('progress-modal-status');
    const fillEl = document.getElementById('progress-modal-fill');
    const percentEl = document.getElementById('progress-modal-percent');
    const detailEl = document.getElementById('progress-modal-detail');

    if (titleEl) titleEl.textContent = title;
    if (statusEl) statusEl.textContent = message;
    const pct = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (percentEl) percentEl.textContent = `${pct}%`;
    if (detailEl) detailEl.textContent = detail;

    modal.classList.remove('hidden');
  }

  updateProgressModal({ progress, message, detail } = {}) {
    const modal = document.getElementById('progress-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    const statusEl = document.getElementById('progress-modal-status');
    const fillEl = document.getElementById('progress-modal-fill');
    const percentEl = document.getElementById('progress-modal-percent');
    const detailEl = document.getElementById('progress-modal-detail');

    if (message && statusEl) statusEl.textContent = message;
    if (progress !== undefined && fillEl) {
      const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
      fillEl.style.width = `${pct}%`;
      if (percentEl) percentEl.textContent = `${pct}%`;
    }
    if (detail !== undefined && detailEl) detailEl.textContent = detail;
  }

  hideProgressModal(delayMs = 350) {
    const modal = document.getElementById('progress-modal');
    if (!modal) return;
    setTimeout(() => {
      modal.classList.add('hidden');
    }, delayMs);
  }

  /**
   * Opens file picker for Lead-DBS Colorbar (.svg), pre-populated to the last folder if supported
   */
  async openColorbarFilePicker() {
    if (!this.tractographyManager) return;

    if (window.showOpenFilePicker) {
      try {
        const pickerOpts = {
          types: [{
            description: 'Lead-DBS Colorbar (.svg)',
            accept: { 'image/svg+xml': ['.svg'] }
          }],
          multiple: false
        };
        if (this._lastFileHandle) pickerOpts.startIn = this._lastFileHandle;
        const [fileHandle] = await window.showOpenFilePicker(pickerOpts);
        if (fileHandle) {
          this._lastFileHandle = fileHandle;
          const file = await fileHandle.getFile();
          this.showProgressModal('Loading Colorbar...', `Parsing ${file.name}...`, 0.3);
          try {
            await this.tractographyManager.loadColorbarSVGFromFile(file);
            this.refreshTractMultiselect();
          } catch (err) {
            alert(`Error loading colorbar: ${err.message}`);
          } finally {
            this.hideProgressModal();
          }
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    input.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        this.showProgressModal('Loading Colorbar...', `Parsing ${file.name}...`, 0.3);
        try {
          await this.tractographyManager.loadColorbarSVGFromFile(file);
          this.refreshTractMultiselect();
        } catch (err) {
          alert(`Error loading colorbar: ${err.message}`);
        } finally {
          this.hideProgressModal();
        }
      }
    };
    input.click();
  }
}

