import './style.css';
import { Viewer } from './viewer.js';
import { VolumeManager } from './volumeManager.js';
import { MeshManager } from './meshManager.js';
import { ClippingManager } from './clippingManager.js';
import { OrientationCube } from './orientationCube.js';
import { TractographyManager } from './tractographyManager.js';
import { UIManager } from './ui.js';
import { MultiplanarViewer } from './multiplanarViewer.js';

async function init() {
  const container = document.getElementById('canvas-container');
  const cubeContainer = document.getElementById('orientation-cube-container');

  const progressFill = document.getElementById('progress-fill');
  const loadingStatus = document.getElementById('loading-status');
  const loadingOverlay = document.getElementById('loading-overlay');

  function updateProgress(percent, message) {
    if (progressFill) progressFill.style.width = `${Math.min(100, Math.round(percent * 100))}%`;
    if (loadingStatus) loadingStatus.innerText = message;
  }

  try {
    // 1. Initialize Viewer
    updateProgress(0.05, 'Initializing WebGL2 Neuroimaging Engine...');
    const viewer = new Viewer(container);

    // 2. Initialize Volume Manager (Anatomical T1w + Overlays)
    updateProgress(0.15, 'Loading 3D T1w MRI Volume...');
    const volumeManager = new VolumeManager();

    // 3. Initialize Mesh Manager (Brain, Skulls, Ventricles, Skin, Custom)
    const meshManager = new MeshManager(viewer.scene);
    volumeManager.setMeshManager(meshManager);

    // 4. Initialize Multi-Plane Clipping Manager
    const clippingManager = new ClippingManager(viewer.scene, volumeManager, meshManager);

    // 5. Load Staged Assets
    // Phase A: Volume
    await volumeManager.load((ev) => {
      updateProgress(0.15 + ev.progress * 0.25, ev.message);
    });
    clippingManager.setVolumeTexture(volumeManager.texture);

    // Phase A2: Background Volumetric Mask (Brain Mask)
    await volumeManager.loadMask('brain');
    await clippingManager.setMaskMode('brain');

    // Pre-cache other volumetric masks in background
    setTimeout(() => {
      volumeManager.loadMask('skull').catch(() => {});
      volumeManager.loadMask('skin').catch(() => {});
    }, 1200);

    // Phase B: Brain Mesh (Hardcoded: surf.obj, Default: Velvet)
    updateProgress(0.45, 'Loading Brain Mesh (924k vertices)...');
    await meshManager.loadBrain((ev) => {
      updateProgress(0.45 + ev.progress * 0.2, ev.message);
    });

    // Phase C: Skull Mesh (Hardcoded: full_skull_mni_warped.obj)
    updateProgress(0.65, 'Loading Skull Mesh (1.04M vertices)...');
    await meshManager.loadSkull((ev) => {
      updateProgress(0.65 + ev.progress * 0.15, ev.message);
    });

    // Phase D: Ventricles Mask Mesh (Hardcoded: mni152_smwp_ventricles_ref_0p1.obj)
    updateProgress(0.82, 'Loading Ventricle Mask Mesh...');
    await meshManager.loadVentricles((ev) => {
      updateProgress(0.82 + ev.progress * 0.08, ev.message);
    });

    // Phase E: Soft Tissue Mesh (Extracted from skin.nii via analysis_env)
    updateProgress(0.88, 'Loading Soft Tissue Mesh...');
    await meshManager.loadSkin((ev) => {
      updateProgress(0.88 + ev.progress * 0.04, ev.message);
    });

    // Phase F: Arterial Structures Mesh (UBA167_max_op1_manually_refined_skinny.obj)
    updateProgress(0.92, 'Loading Arterial Structures Mesh...');
    await meshManager.loadArterial((ev) => {
      updateProgress(0.92 + ev.progress * 0.04, ev.message);
    });

    // Phase G: Venous Structures Mesh (manual_venous_structures.obj)
    updateProgress(0.96, 'Loading Venous Structures Mesh...');
    await meshManager.loadVenous((ev) => {
      updateProgress(0.96 + ev.progress * 0.04, ev.message);
    });

    // 6. Initialize Orientation Cube
    const orientationCube = new OrientationCube(viewer.camera, viewer.controls, cubeContainer);

    // 7. Initialize Tractography Manager (.trk / .trk.gz streamlines)
    const tractographyManager = new TractographyManager(viewer.scene, clippingManager, viewer);

    // 8. Initialize UI Manager
    const uiManager = new UIManager(viewer, meshManager, clippingManager, volumeManager, orientationCube, tractographyManager);

    // 9. Initialize Multiplanar Slice Viewer
    const multiplanarViewer = new MultiplanarViewer(volumeManager, clippingManager, uiManager);
    uiManager.multiplanarViewer = multiplanarViewer;

    // Initial state synchronization: Clipping ON (axial plane 1), Skull ON, Brain ON, Soft Tissue ON, Plane Box ON
    clippingManager.update();
    uiManager.updateHUD();

    // 10. Register render hooks
    viewer.addRenderHook(() => {
      orientationCube.update();
      multiplanarViewer.render();
    });

    // Finalize
    updateProgress(1.0, 'Ready');
    setTimeout(() => {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }, 300);

    // Start render loop
    viewer.start();

    window.__TURNER_APP__ = {
      viewer,
      volumeManager,
      meshManager,
      clippingManager,
      orientationCube,
      tractographyManager,
      uiManager,
      multiplanarViewer
    };

    console.log('Brain and Skull Atlas with Multi-Plane Clipping & Overlays initialized successfully.');
  } catch (err) {
    console.error('Initialization error:', err);
    if (loadingStatus) {
      loadingStatus.innerHTML = `<span style="color: #ef4444;">Error: ${err.message}</span>`;
    }
  }
}

window.addEventListener('DOMContentLoaded', init);
