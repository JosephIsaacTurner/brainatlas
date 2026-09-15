import * as THREE from 'three';
import { createVelvetMaterial } from './shaders/velvetShader.js';
import { createXRayMaterial } from './shaders/xrayShader.js';
import { parseMZ3, parseGII, parsePLY, parseSTL, combineGeometries } from './meshParsers.js';
import { evaluateOverlayColormap } from './colormaps.js';
import { fetchBinary, getDataUrl } from './dataLoader.js';

// Unified set of render styles available to every mesh in the scene.
export const MESH_RENDER_STYLES = ['velvet', 'glass', 'bone', 'phong', 'matte', 'matcap', 'wireframe'];

export const ADDITIONAL_BRAIN_STRUCTURES = [
  {
    id: 'brainstem_midbrain_diencephalon',
    name: 'Brainstem, Midbrain & Diencephalon',
    shortName: 'Brainstem / Midbrain / Diencephalon',
    file: 'BrainstemMidbrainDiencephalonMask_0p5.obj',
    cacheKey: 'struct_brainstem_midbrain_diencephalon',
    defaultColor: 0xa855f7,
    defaultColorHex: '#a855f7'
  },
  {
    id: 'thalamus',
    name: 'Thalamus',
    shortName: 'Thalamus',
    file: 'ThalamusMask_0p5.obj',
    cacheKey: 'struct_thalamus',
    defaultColor: 0x06b6d4,
    defaultColorHex: '#06b6d4'
  },
  {
    id: 'brainstem_cerebellum',
    name: 'Brainstem & Cerebellum',
    shortName: 'Brainstem / Cerebellum',
    file: 'BrainstemCerebellumMask_0p5.obj',
    cacheKey: 'struct_brainstem_cerebellum',
    defaultColor: 0x10b981,
    defaultColorHex: '#10b981'
  },
  {
    id: 'basal_ganglia',
    name: 'Basal Ganglia',
    shortName: 'Basal Ganglia',
    file: 'BasalGangliaMask_0p5.obj',
    cacheKey: 'struct_basal_ganglia',
    defaultColor: 0xf59e0b,
    defaultColorHex: '#f59e0b'
  },
  {
    id: 'limbic_system',
    name: 'Limbic System',
    shortName: 'Limbic System',
    file: 'LimbicSystemMask_0p5.obj',
    cacheKey: 'struct_limbic_system',
    defaultColor: 0xf43f5e,
    defaultColorHex: '#f43f5e'
  },
  {
    id: 'pituitary',
    name: 'Pituitary',
    shortName: 'Pituitary',
    file: 'pituitary_v2.obj',
    cacheKey: 'struct_pituitary',
    defaultColor: 0xec4899,
    defaultColorHex: '#ec4899'
  }
];

export const SKULL_SUBSTRUCTURES = [
  // 1. Mandible & Cervical Vertebrae (at top)
  { id: 'mandible', name: 'Mandible', shortName: 'Mandible', category: 'mandible_cervical', file: 'mandible.obj', cacheKey: 'subbone_mandible', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xef4444, anatomicalColorHex: '#ef4444' },
  { id: 'cervical_vertebrae', name: 'Cervical Vertebrae', shortName: 'Cervical Vertebrae', category: 'mandible_cervical', file: 'cervical_vertebrae.obj', cacheKey: 'subbone_cervical_vertebrae', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x94a3b8, anatomicalColorHex: '#94a3b8' },

  // 2. Cranial Bones
  { id: 'frontal', name: 'Frontal Bone', shortName: 'Frontal', category: 'cranial', file: 'frontal.obj', cacheKey: 'subbone_frontal', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xf59e0b, anatomicalColorHex: '#f59e0b' },
  { id: 'occipital', name: 'Occipital Bone', shortName: 'Occipital', category: 'cranial', file: 'occipital.obj', cacheKey: 'subbone_occipital', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x8b5cf6, anatomicalColorHex: '#8b5cf6' },
  { id: 'sphenoid', name: 'Sphenoid Bone', shortName: 'Sphenoid', category: 'cranial', file: 'sphenoid.obj', cacheKey: 'subbone_sphenoid', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xec4899, anatomicalColorHex: '#ec4899' },
  { id: 'ethmoid', name: 'Ethmoid Bone', shortName: 'Ethmoid', category: 'cranial', file: 'ethmoid.obj', cacheKey: 'subbone_ethmoid', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x14b8a6, anatomicalColorHex: '#14b8a6' },
  { id: 'left_parietal', name: 'Left Parietal Bone', shortName: 'L Parietal', category: 'cranial', file: 'left_parietal.obj', cacheKey: 'subbone_left_parietal', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x3b82f6, anatomicalColorHex: '#3b82f6' },
  { id: 'right_parietal', name: 'Right Parietal Bone', shortName: 'R Parietal', category: 'cranial', file: 'right_parietal.obj', cacheKey: 'subbone_right_parietal', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x60a5fa, anatomicalColorHex: '#60a5fa' },
  { id: 'left_temporal', name: 'Left Temporal Bone', shortName: 'L Temporal', category: 'cranial', file: 'left_temporal.obj', cacheKey: 'subbone_left_temporal', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x10b981, anatomicalColorHex: '#10b981' },
  { id: 'right_temporal', name: 'Right Temporal Bone', shortName: 'R Temporal', category: 'cranial', file: 'right_temporal.obj', cacheKey: 'subbone_right_temporal', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x34d399, anatomicalColorHex: '#34d399' },

  // 3. Face Bones
  { id: 'nasal', name: 'Nasal Bone', shortName: 'Nasal', category: 'face', file: 'nasal.obj', cacheKey: 'subbone_nasal', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xf97316, anatomicalColorHex: '#f97316' },
  { id: 'vomer', name: 'Vomer', shortName: 'Vomer', category: 'face', file: 'vomer.obj', cacheKey: 'subbone_vomer', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xd946ef, anatomicalColorHex: '#d946ef' },
  { id: 'left_maxilla', name: 'Left Maxilla', shortName: 'L Maxilla', category: 'face', file: 'left_maxilla.obj', cacheKey: 'subbone_left_maxilla', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xeab308, anatomicalColorHex: '#eab308' },
  { id: 'right_maxillary', name: 'Right Maxilla', shortName: 'R Maxilla', category: 'face', file: 'right_maxillary.obj', cacheKey: 'subbone_right_maxillary', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xfacc15, anatomicalColorHex: '#facc15' },
  { id: 'left_zygomatic', name: 'Left Zygomatic Bone', shortName: 'L Zygomatic', category: 'face', file: 'left_zygomatic.obj', cacheKey: 'subbone_left_zygomatic', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xa855f7, anatomicalColorHex: '#a855f7' },
  { id: 'right_zygomatic', name: 'Right Zygomatic Bone', shortName: 'R Zygomatic', category: 'face', file: 'right_zygomatic.obj', cacheKey: 'subbone_right_zygomatic', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xc084fc, anatomicalColorHex: '#c084fc' },
  { id: 'left_lacrimal', name: 'Left Lacrimal Bone', shortName: 'L Lacrimal', category: 'face', file: 'left_lacrimal.obj', cacheKey: 'subbone_left_lacrimal', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x06b6d4, anatomicalColorHex: '#06b6d4' },
  { id: 'right_lacrimal', name: 'Right Lacrimal Bone', shortName: 'R Lacrimal', category: 'face', file: 'right_lacrimal.obj', cacheKey: 'subbone_right_lacrimal', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x22d3ee, anatomicalColorHex: '#22d3ee' },
  { id: 'left_palatine', name: 'Left Palatine Bone', shortName: 'L Palatine', category: 'face', file: 'left_palatine.obj', cacheKey: 'subbone_left_palatine', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x6366f1, anatomicalColorHex: '#6366f1' },
  { id: 'right_palatine', name: 'Right Palatine Bone', shortName: 'R Palatine', category: 'face', file: 'right_palatine.obj', cacheKey: 'subbone_right_palatine', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x818cf8, anatomicalColorHex: '#818cf8' },
  { id: 'left_inferior_nasal_concha', name: 'Left Inferior Nasal Concha', shortName: 'L Inf Nasal Concha', category: 'face', file: 'left_inferior_nasal_concha.obj', cacheKey: 'subbone_left_inferior_nasal_concha', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0x84cc16, anatomicalColorHex: '#84cc16' },
  { id: 'right_inferior_nasal_concha', name: 'Right Inferior Nasal Concha', shortName: 'R Inf Nasal Concha', category: 'face', file: 'right_inferior_nasal_concha.obj', cacheKey: 'subbone_right_inferior_nasal_concha', defaultColor: 0xeeece8, defaultColorHex: '#eeece8', anatomicalColor: 0xa3e635, anatomicalColorHex: '#a3e635' }
];


export class MeshManager {
  constructor(scene, clippingPlanes = []) {
    this.scene = scene;
    this.clippingPlanes = clippingPlanes;

    // 1. Brain Mesh
    this.brainMesh = null;
    this.brainGeometry = null;
    this.brainGeometries = { default: null };
    this.currentBrainType = 'default';
    this.brainMaterial = null;
    this.brainVisible = true; // Toggleable off and on!
    this.brainOpacity = 1.0;
    this.renderStyle = 'velvet'; // Default: Velvet!
    this.brainColor = 0xbdbdbd;
    this.brainRoughness = 0.82;
    this.brainSheen = 1.0;
    this.brainSheenColor = 0xffffff;
    this.brainClipped = true; // Independent clipping toggle for brain mesh

    // Additional Brain Structures (manjon_atlas subcortical/brainstem masks)
    this.additionalBrainStructures = {};
    for (const s of ADDITIONAL_BRAIN_STRUCTURES) {
      this.additionalBrainStructures[s.id] = {
        ...s,
        color: s.defaultColor,
        enabled: false,
        mesh: null,
        geometry: null,
        material: null,
        loading: false
      };
    }

    // Brain Surface Overlay state (NIfTI & GIfTI)
    this.brainOverlayScalars = null;
    this.brainOverlaySource = null; // 'nii' | 'gii'
    this.hasBrainOverlay = false;
    this.activeVolumeManager = null;

    // Surf Ice Velvet parameters
    this.velvetAmbient = 0.25;
    this.velvetDiffuse = 0.70;
    this.velvetSpecular = 0.70;
    this.velvetSheen = 0.70;
    this.velvetEdginess = 4.0;
    this.velvetBackscatter = 0.25;
    this.velvetEdge = 0.0;
    this.velvetLightBackfaces = false;
    
    // Multi-plane clipping uniforms initialized immediately so all initial shaders have live references
    this.clipUniforms = {
      uGlobalClipEnabled: { value: false },
      uClipActive: { value: [false, false, false] },
      uClipNormal: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)] },
      uClipConstant: { value: [0, 0, 0] },
      uClipNegative: { value: [false, false, false] }
    };

    // 2. Skull Mesh
    this.skullMesh = null;
    this.skullGeometries = { full: null, ohio: null };
    this.currentSkullType = 'full'; // 'full' or 'ohio'
    this.skullMaterial = null;
    this.skullVisible = true;
    this.skullOpacity = 1.0; // Default: 100% opacity
    this.skullColor = 0xeeece8;
    this.skullStyle = 'bone'; // Default: bone style
    this.skullClipped = true;

    // Toggleable Skull Sub-bones (Ohio Skull anatomical substructures)
    this.skullSubstructures = {};
    for (const s of SKULL_SUBSTRUCTURES) {
      this.skullSubstructures[s.id] = {
        ...s,
        color: s.defaultColor,
        enabled: true, // Default state: all sub-bones visible
        mesh: null,
        geometry: null,
        material: null,
        loading: false
      };
    }

    // 3. Hardcoded Ventricle Mask Mesh
    this.ventriclesMesh = null;
    this.ventriclesGeometry = null;
    this.ventriclesMaterial = null;
    this.ventriclesVisible = false;
    this.ventriclesOpacity = 0.95;
    this.ventriclesColor = 0x00d2ff; // Luminous cyan/blue
    this.ventriclesStyle = 'phong'; // Default: glossy, closest to prior clearcoat look
    this.ventriclesClipped = false; // Default: NOT clipped

    // 4. Soft Tissue / Skin Mesh (from skin.nii)
    this.skinMesh = null;
    this.skinGeometry = null;
    this.skinMaterial = null;
    this.skinVisible = true;
    this.skinOpacity = 0.35; // Translucent shell
    this.skinColor = 0xf0d5c2; // Natural flesh tone
    this.skinStyle = 'glass'; // 'glass', 'bone', 'wireframe'
    this.skinClipped = true;

    // 5. Arterial Structures Mesh (UBA167_max_op1_manually_refined_skinny.obj)
    this.arterialMesh = null;
    this.arterialGeometry = null;
    this.arterialMaterial = null;
    this.arterialVisible = false;
    this.arterialOpacity = 1.0;
    this.arterialColor = 0xdc2626; // Default: red
    this.arterialStyle = 'bone'; // Default: closest match to prior standard material
    this.arterialClipped = false; // Default: NOT clipped

    // 6. Venous Structures Mesh (manual_venous_structures.obj)
    this.venousMesh = null;
    this.venousGeometry = null;
    this.venousMaterial = null;
    this.venousVisible = false;
    this.venousOpacity = 1.0;
    this.venousColor = 0x1d4ed8; // Default: darker blue
    this.venousStyle = 'bone'; // Default: closest match to prior standard material
    this.venousClipped = false; // Default: NOT clipped

    // 7. Dural Folds Mesh (falx_tentorium_mesh.obj)
    this.duralFoldsMesh = null;
    this.duralFoldsGeometry = null;
    this.duralFoldsMaterial = null;
    this.duralFoldsVisible = false; // Default: not visible
    this.duralFoldsOpacity = 0.95;
    this.duralFoldsColor = 0xa78bfa; // Default: distinct lavender/purple
    this.duralFoldsStyle = 'bone'; // Default: bone render style
    this.duralFoldsClipped = false; // Default: NOT clipped

    // 8. Custom Drag & Drop OBJ Meshes
    this.customMeshes = [];

    // MatCap support
    this.matcapTexture = null;
    this.currentMatcapName = '02_red_velvet.jpg';
    this.textureLoader = new THREE.TextureLoader();

    this.onMeshesChangeCallbacks = [];
  }

  // --- Brain Mesh Loading ---
  async loadBrain(onProgress = null) {
    if (onProgress) onProgress({ phase: 'brain', progress: 0.1, message: 'Fetching brain mesh...' });
    const buffer = await fetchBinary('data/brain.bin.gz');
    this.brainGeometry = this.parseBinaryMesh(buffer);
    this.brainGeometry.computeBoundingBox();
    this.brainGeometry.computeBoundingSphere();
    this.brainGeometries['default'] = this.brainGeometry;

    this.updateBrainMaterial();

    this.brainMesh = new THREE.Mesh(this.brainGeometry, this.brainMaterial);
    this.brainMesh.name = 'BrainMesh';
    this.brainMesh.visible = this.brainVisible;
    this.scene.add(this.brainMesh);

    if (onProgress) onProgress({ phase: 'brain', progress: 1.0, message: 'Brain mesh ready' });
    return this.brainMesh;
  }

  async switchBrainMesh(type = 'default', onProgress = null) {
    if (type === 'none') {
      this.currentBrainType = 'none';
      if (this.brainMesh) {
        this.brainMesh.visible = false;
      }
      if (this.hasBrainOverlay) {
        this.updateBrainOverlayColors();
      }
      return null;
    }

    if (type === 'fsaverage-164k-pial' || type === 'fsaverage_164k_pial') type = 'fsaverage_164k_pial_both';
    if (type === 'fslr32k_lh') type = 'conte69_lh';
    if (type === 'fslr32k_rh') type = 'conte69_rh';
    if (type === 'fslr32k_both') type = 'conte69_both';
    if (type === 'colin27_lh') type = 'mni152_lh';
    if (type === 'colin27_rh') type = 'mni152_rh';
    if (type === 'colin27_both') type = 'mni152_both';

    this.currentBrainType = type;

    if (this.brainGeometries[type]) {
      this.brainGeometry = this.brainGeometries[type];
      if (this.brainMesh) {
        this.brainMesh.geometry = this.brainGeometry;
        this.brainMesh.geometry.needsUpdate = true;
        this.brainMesh.visible = (this.currentBrainType !== 'none') && this.brainVisible;
      }
      this._reapplyBrainOverlayIfActive();
      this.updateBrainMaterial();
      return this.brainGeometry;
    }

    if (onProgress) onProgress({ progress: 0.2, message: `Loading brain surface: ${type}...` });

    try {
      let geom = null;
      const fetchBuf = async (url) => {
        return await fetchBinary(url);
      };

      if (type === 'default') {
        geom = this.brainGeometries['default'];
      } else if (type === 'mni152_lh' || type === 'colin27_lh') {
        const buf = await fetchBuf('data/raw/surf.lh.mz3');
        geom = parseMZ3(buf);
      } else if (type === 'mni152_rh' || type === 'colin27_rh') {
        const buf = await fetchBuf('data/raw/surf.rh.mz3');
        geom = parseMZ3(buf);
      } else if (type === 'mni152_both' || type === 'colin27_both') {
        const [bufL, bufR] = await Promise.all([
          fetchBuf('data/raw/surf.lh.mz3'),
          fetchBuf('data/raw/surf.rh.mz3')
        ]);
        const geomL = parseMZ3(bufL);
        const geomR = parseMZ3(bufR);
        geom = combineGeometries(geomL, geomR);
      } else if (type === 'conte69_lh') {
        const buf = await fetchBuf('data/raw/conte69_32k_surface_lh.gii');
        geom = parseGII(buf);
      } else if (type === 'conte69_rh') {
        const buf = await fetchBuf('data/raw/conte69_32k_surface_rh.gii');
        geom = parseGII(buf);
      } else if (type === 'conte69_both') {
        const [bufL, bufR] = await Promise.all([
          fetchBuf('data/raw/conte69_32k_surface_lh.gii'),
          fetchBuf('data/raw/conte69_32k_surface_rh.gii')
        ]);
        const geomL = parseGII(bufL);
        const geomR = parseGII(bufR);
        geom = combineGeometries(geomL, geomR);
      } else if (type === 'fsaverage_164k_pial_lh') {
        const buf = await fetchBuf('data/raw/fsaverage_164k_hemi_L_pial.surf.gii');
        geom = parseGII(buf);
      } else if (type === 'fsaverage_164k_pial_rh') {
        const buf = await fetchBuf('data/raw/fsaverage_164k_hemi_R_pial.surf.gii');
        geom = parseGII(buf);
      } else if (type === 'fsaverage_164k_pial_both') {
        const [bufL, bufR] = await Promise.all([
          fetchBuf('data/raw/fsaverage_164k_hemi_L_pial.surf.gii'),
          fetchBuf('data/raw/fsaverage_164k_hemi_R_pial.surf.gii')
        ]);
        const geomL = parseGII(bufL);
        const geomR = parseGII(bufR);
        geom = combineGeometries(geomL, geomR);
      }

      if (geom) {
        geom.computeBoundingBox();
        geom.computeBoundingSphere();
        this.brainGeometries[type] = geom;
        this.brainGeometry = geom;

        if (this.brainMesh) {
          this.brainMesh.geometry = geom;
          this.brainMesh.geometry.needsUpdate = true;
          this.brainMesh.visible = (this.currentBrainType !== 'none') && this.brainVisible;
          this._reapplyBrainOverlayIfActive();
          this.updateBrainMaterial();
        }
      }

      if (onProgress) onProgress({ progress: 1.0, message: `Surface ${type} ready` });
      return geom;
    } catch (err) {
      console.error(`Failed to load brain mesh ${type}:`, err);
      throw err;
    }
  }

  // --- Skull Mesh Loading (Full + Ohio Substructures) ---
  async loadSkull(onProgress = null) {
    if (onProgress) onProgress({ phase: 'skull', progress: 0.1, message: 'Fetching full skull mesh...' });
    const buffer = await fetchBinary('data/skull.bin.gz');
    this.skullGeometries.full = this.parseBinaryMesh(buffer);
    this.skullGeometries.full.computeBoundingBox();

    this.updateSkullMaterial();

    this.skullMesh = new THREE.Mesh(this.skullGeometries.full, this.skullMaterial);
    this.skullMesh.name = 'SkullMesh';
    this.skullMesh.visible = (this.currentSkullType === 'full') && this.skullVisible;
    this.scene.add(this.skullMesh);

    if (onProgress) onProgress({ phase: 'skull', progress: 1.0, message: 'Skull mesh ready' });

    // Preload Ohio skull substructures in background
    setTimeout(() => {
      this.ensureSkullSubstructuresLoaded().catch(() => {});
    }, 100);

    return this.skullMesh;
  }

  async switchSkull(type) {
    this.currentSkullType = type;
    if (type === 'ohio') {
      if (this.skullMesh) {
        this.skullMesh.visible = false;
      }
      await this.ensureSkullSubstructuresLoaded();
      this.updateSkullSubstructuresVisibility();
    } else {
      // Switch back to monolithic full skull and re-enable all sub-bones
      for (const id in this.skullSubstructures) {
        const sub = this.skullSubstructures[id];
        sub.enabled = true;
        if (sub.mesh) sub.mesh.visible = false;
      }
      if (!this.skullGeometries.full) {
        const buf = await fetchBinary('data/skull.bin.gz');
        this.skullGeometries.full = this.parseBinaryMesh(buf);
        this.skullGeometries.full.computeBoundingBox();
      }
      if (this.skullMesh) {
        this.skullMesh.geometry = this.skullGeometries.full;
        this.skullMesh.visible = this.skullVisible;
      }
    }
    this.notifyMeshesChange();
  }

  // --- Ohio Skull Substructures Loading and Management ---
  async ensureSkullSubstructuresLoaded(onProgress = null) {
    const ids = Object.keys(this.skullSubstructures);
    let loadedCount = 0;
    const promises = ids.map(async (id) => {
      await this.loadSingleSkullSubstructure(id);
      loadedCount++;
      if (onProgress) {
        onProgress({
          phase: 'skull_substructures',
          progress: loadedCount / ids.length,
          message: `Loading skull sub-bones (${loadedCount}/${ids.length})...`
        });
      }
    });
    await Promise.all(promises);
  }

  async loadSingleSkullSubstructure(id) {
    const sub = this.skullSubstructures[id];
    if (!sub || sub.mesh || sub.loading) return sub?.mesh;
    sub.loading = true;
    try {
      const buffer = await fetchBinary(`data/${sub.cacheKey}.bin.gz`);
      sub.geometry = this.parseBinaryMesh(buffer);
      sub.geometry.computeBoundingBox();

      sub.material = this.createStyledMaterial(
        this.skullStyle,
        sub.color,
        this.skullOpacity,
        () => this.skullClipped
      );

      sub.mesh = new THREE.Mesh(sub.geometry, sub.material);
      sub.mesh.name = `SkullSubstructure_${id}`;
      sub.mesh.visible = (this.currentSkullType === 'ohio') && this.skullVisible && sub.enabled;
      this.scene.add(sub.mesh);
      return sub.mesh;
    } catch (e) {
      console.error(`Failed to load skull sub-bone ${id}:`, e);
    } finally {
      sub.loading = false;
    }
  }

  setSkullSubstructureEnabled(id, enabled) {
    const sub = this.skullSubstructures[id];
    if (!sub) return;
    sub.enabled = enabled;
    if (enabled && !sub.mesh) {
      this.loadSingleSkullSubstructure(id).then(() => {
        this.updateSkullSubstructuresVisibility();
      });
    } else {
      this.updateSkullSubstructuresVisibility();
    }
  }

  setSkullSubstructureColor(id, hexColor) {
    const sub = this.skullSubstructures[id];
    if (!sub) return;
    sub.color = typeof hexColor === 'string' ? parseInt(hexColor.replace('#', '0x'), 16) : hexColor;
    sub.defaultColorHex = typeof hexColor === 'string' ? hexColor : '#' + sub.color.toString(16).padStart(6, '0');
    this.updateSkullSubstructureMaterial(id);
  }

  updateSkullSubstructureMaterial(id) {
    const sub = this.skullSubstructures[id];
    if (!sub || !sub.mesh) return;
    sub.material = this.createStyledMaterial(
      this.skullStyle,
      sub.color,
      this.skullOpacity,
      () => this.skullClipped
    );
    sub.mesh.material = sub.material;
    sub.mesh.material.needsUpdate = true;
  }

  updateAllSkullSubstructureMaterials() {
    for (const id in this.skullSubstructures) {
      this.updateSkullSubstructureMaterial(id);
    }
  }

  updateSkullSubstructuresVisibility() {
    for (const id in this.skullSubstructures) {
      const sub = this.skullSubstructures[id];
      if (sub.mesh) {
        sub.mesh.visible = (this.currentSkullType === 'ohio') && this.skullVisible && sub.enabled;
      }
    }
  }

  // --- Dural Folds Mesh Loading (falx_tentorium_mesh.obj) ---
  async loadDuralFolds(onProgress = null) {
    if (onProgress) onProgress({ phase: 'dural_folds', progress: 0.2, message: 'Fetching dural folds mesh...' });
    const buffer = await fetchBinary('data/dural_folds.bin.gz');
    this.duralFoldsGeometry = this.parseBinaryMesh(buffer);
    this.duralFoldsGeometry.computeBoundingBox();

    this.updateDuralFoldsMaterial();

    this.duralFoldsMesh = new THREE.Mesh(this.duralFoldsGeometry, this.duralFoldsMaterial);
    this.duralFoldsMesh.name = 'DuralFoldsMesh';
    this.duralFoldsMesh.visible = this.duralFoldsVisible;
    this.scene.add(this.duralFoldsMesh);

    if (onProgress) onProgress({ phase: 'dural_folds', progress: 1.0, message: 'Dural folds mesh ready' });
    return this.duralFoldsMesh;
  }

  // --- Ventricles Mesh Loading ---
  async loadVentricles(onProgress = null) {
    if (onProgress) onProgress({ phase: 'ventricles', progress: 0.2, message: 'Fetching ventricle mask mesh...' });
    const buffer = await fetchBinary('data/ventricles.bin.gz');
    this.ventriclesGeometry = this.parseBinaryMesh(buffer);
    this.ventriclesGeometry.computeBoundingBox();

    this.updateVentriclesMaterial();

    this.ventriclesMesh = new THREE.Mesh(this.ventriclesGeometry, this.ventriclesMaterial);
    this.ventriclesMesh.name = 'VentriclesMesh';
    this.ventriclesMesh.visible = this.ventriclesVisible;
    this.scene.add(this.ventriclesMesh);

    if (onProgress) onProgress({ phase: 'ventricles', progress: 1.0, message: 'Ventricles ready' });
    return this.ventriclesMesh;
  }

  // --- Skin / Soft Tissue Mesh Loading (from skin.nii) ---
  async loadSkin(onProgress = null) {
    if (onProgress) onProgress({ phase: 'skin', progress: 0.2, message: 'Fetching soft tissue mesh...' });
    const buffer = await fetchBinary('data/skin.bin.gz');
    this.skinGeometry = this.parseBinaryMesh(buffer);
    this.skinGeometry.computeBoundingBox();

    this.updateSkinMaterial();

    this.skinMesh = new THREE.Mesh(this.skinGeometry, this.skinMaterial);
    this.skinMesh.name = 'SkinMesh';
    this.skinMesh.visible = this.skinVisible;
    this.scene.add(this.skinMesh);

    if (onProgress) onProgress({ phase: 'skin', progress: 1.0, message: 'Soft tissue mesh ready' });
    return this.skinMesh;
  }

  // --- Arterial Structures Mesh Loading ---
  async loadArterial(onProgress = null) {
    if (onProgress) onProgress({ phase: 'arterial', progress: 0.2, message: 'Fetching arterial structures mesh...' });
    const buffer = await fetchBinary('data/arterial.bin.gz');
    this.arterialGeometry = this.parseBinaryMesh(buffer);
    this.arterialGeometry.computeBoundingBox();

    this.updateArterialMaterial();

    this.arterialMesh = new THREE.Mesh(this.arterialGeometry, this.arterialMaterial);
    this.arterialMesh.name = 'ArterialMesh';
    this.arterialMesh.visible = this.arterialVisible;
    this.scene.add(this.arterialMesh);

    if (onProgress) onProgress({ phase: 'arterial', progress: 1.0, message: 'Arterial structures mesh ready' });
    return this.arterialMesh;
  }

  // --- Venous Structures Mesh Loading ---
  async loadVenous(onProgress = null) {
    if (onProgress) onProgress({ phase: 'venous', progress: 0.2, message: 'Fetching venous structures mesh...' });
    const buffer = await fetchBinary('data/venous.bin.gz');
    this.venousGeometry = this.parseBinaryMesh(buffer);
    this.venousGeometry.computeBoundingBox();

    this.updateVenousMaterial();

    this.venousMesh = new THREE.Mesh(this.venousGeometry, this.venousMaterial);
    this.venousMesh.name = 'VenousMesh';
    this.venousMesh.visible = this.venousVisible;
    this.scene.add(this.venousMesh);

    if (onProgress) onProgress({ phase: 'venous', progress: 1.0, message: 'Venous structures mesh ready' });
    return this.venousMesh;
  }

  // --- Fast Client-Side OBJ Parser for Custom Meshes (Handles Triangles & Quads) ---
  async loadCustomOBJ(file, onProgress = null) {
    if (onProgress) onProgress({ progress: 0.2, message: `Reading ${file.name}...` });
    const text = await file.text();

    if (onProgress) onProgress({ progress: 0.5, message: 'Parsing OBJ triangles...' });
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

    if (vCount === 0 || triCount === 0) {
      throw new Error(`Invalid OBJ file '${file.name}': No vertices or faces found.`);
    }

    const positions = new Float32Array(vCount * 3);
    const indices = new Uint32Array(triCount * 3);

    let vIdx = 0, iIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('v ')) {
        const parts = l.slice(2).trim().split(/\s+/);
        positions[vIdx++] = parseFloat(parts[0]);
        positions[vIdx++] = parseFloat(parts[1]);
        positions[vIdx++] = parseFloat(parts[2]);
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

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    geom.computeBoundingBox();

    return this._registerCustomMesh(geom, file.name, onProgress);
  }

  _registerCustomMesh(geom, name, onProgress = null) {
    // Create material with active clipping planes
    const mat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.6,
      metalness: 0.1,
      clippingPlanes: this.clippingPlanes,
      side: THREE.DoubleSide
    });

    const customEntry = {
      name: name,
      mesh: null,
      geometry: geom,
      material: mat,
      visible: true,
      color: 0x93c5fd,
      opacity: 1.0,
      renderStyle: 'standard',
      clipped: true
    };
    this.setupCustomClipping(mat, () => customEntry.clipped);

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `CustomMesh_${name}`;
    mesh.visible = true;
    customEntry.mesh = mesh;

    this.scene.add(mesh);
    this.customMeshes.push(customEntry);

    this.notifyMeshesChange();

    if (onProgress) onProgress({ progress: 1.0, message: `Custom mesh '${name}' loaded!` });
    return customEntry;
  }

  async loadCustomMZ3(file, onProgress = null) {
    if (onProgress) onProgress({ progress: 0.2, message: `Reading ${file.name}...` });
    const buffer = await file.arrayBuffer();
    if (onProgress) onProgress({ progress: 0.6, message: 'Parsing MZ3 binary...' });
    const geom = parseMZ3(buffer);
    return this._registerCustomMesh(geom, file.name, onProgress);
  }

  async loadCustomGII(file, onProgress = null) {
    if (onProgress) onProgress({ progress: 0.2, message: `Reading ${file.name}...` });
    const buffer = await file.arrayBuffer();
    if (onProgress) onProgress({ progress: 0.6, message: 'Parsing GIfTI mesh...' });
    const geom = parseGII(buffer);
    return this._registerCustomMesh(geom, file.name, onProgress);
  }

  async loadCustomPLY(file, onProgress = null) {
    if (onProgress) onProgress({ progress: 0.2, message: `Reading ${file.name}...` });
    const buffer = await file.arrayBuffer();
    if (onProgress) onProgress({ progress: 0.6, message: 'Parsing PLY mesh...' });
    const geom = parsePLY(buffer);
    return this._registerCustomMesh(geom, file.name, onProgress);
  }

  async loadCustomSTL(file, onProgress = null) {
    if (onProgress) onProgress({ progress: 0.2, message: `Reading ${file.name}...` });
    const buffer = await file.arrayBuffer();
    if (onProgress) onProgress({ progress: 0.6, message: 'Parsing STL mesh...' });
    const geom = parseSTL(buffer);
    return this._registerCustomMesh(geom, file.name, onProgress);
  }

  async loadCustomMesh(file, onProgress = null) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.mz3')) {
      return await this.loadCustomMZ3(file, onProgress);
    } else if (name.endsWith('.gii') || name.endsWith('.gii.gz')) {
      return await this.loadCustomGII(file, onProgress);
    } else if (name.endsWith('.ply') || name.endsWith('.ply.gz')) {
      return await this.loadCustomPLY(file, onProgress);
    } else if (name.endsWith('.stl') || name.endsWith('.stl.gz')) {
      return await this.loadCustomSTL(file, onProgress);
    } else {
      return await this.loadCustomOBJ(file, onProgress);
    }
  }

  parseBinaryMesh(buffer) {
    const dataView = new DataView(buffer);
    const magic = String.fromCharCode(
      dataView.getUint8(0), dataView.getUint8(1), dataView.getUint8(2), dataView.getUint8(3)
    );
    if (magic !== 'MESH') throw new Error(`Invalid binary mesh format: '${magic}'`);

    const vCount = dataView.getUint32(4, true);
    const fCount = dataView.getUint32(8, true);

    const posOffset = 16;
    const normOffset = posOffset + vCount * 3 * 4;
    const indOffset = normOffset + vCount * 3 * 4;

    const positions = new Float32Array(buffer, posOffset, vCount * 3);
    const normals = new Float32Array(buffer, normOffset, vCount * 3);
    const indices = new Uint32Array(buffer, indOffset, fCount * 3);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));

    return geom;
  }

  // --- Material Updates ---
  setRenderStyle(style) {
    this.renderStyle = style;
    this.updateBrainMaterial();
    this.updateAdditionalBrainStructuresMaterials();
    if (this.hasBrainOverlay) {
      this.updateBrainOverlayColors();
    }
  }

  setBrainVisible(visible) {
    this.brainVisible = visible;
    if (this.brainMesh) {
      this.brainMesh.visible = (this.currentBrainType !== 'none') && visible;
    }
    this.updateAdditionalBrainStructuresVisibility();
  }

  setBrainOpacity(opacity) {
    this.brainOpacity = opacity;
    this.updateBrainMaterial();
    this.updateAdditionalBrainStructuresMaterials();
  }

  setBrainColor(color) {
    this.brainColor = color;
    // When a NIfTI/GIfTI overlay is projected onto the brain, the visible surface
    // color comes from the per-vertex "color" attribute (baked in updateBrainOverlayColors),
    // not the material's uColor uniform. Recompute those vertex colors here so a base
    // color change is reflected immediately instead of only on the next overlay update.
    if (this.hasBrainOverlay) {
      this.updateBrainOverlayColors();
    } else {
      this.updateBrainMaterial();
    }
  }

  async loadMatcap(name) {
    this.currentMatcapName = name;
    return new Promise((resolve, reject) => {
      this.textureLoader.load(getDataUrl(`matcaps/${name}`), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.matcapTexture = tex;
        this._refreshMatcapUsers();
        resolve(tex);
      }, undefined, reject);
    });
  }

  setupCustomClipping(material, isClippedGetter) {
    if (!material) return;
    material.customProgramCacheKey = () => 'custom_negative_clipping_v1';
    material.onBeforeCompile = (shader) => {
      material.userData.shader = shader;
      if (this.clipUniforms) {
        shader.uniforms.uGlobalClipEnabled = this.clipUniforms.uGlobalClipEnabled;
        shader.uniforms.uClipActive = this.clipUniforms.uClipActive;
        shader.uniforms.uClipNormal = this.clipUniforms.uClipNormal;
        shader.uniforms.uClipConstant = this.clipUniforms.uClipConstant;
        shader.uniforms.uClipNegative = this.clipUniforms.uClipNegative;
      }
      let _clippedVal = Boolean(isClippedGetter ? isClippedGetter() : true);
      shader.uniforms.uMeshClipped = {
        get value() { return isClippedGetter ? Boolean(isClippedGetter()) : _clippedVal; },
        set value(v) { _clippedVal = Boolean(v); }
      };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <clipping_planes_pars_vertex>',
        `#include <clipping_planes_pars_vertex>
         varying vec3 vCustomWorldPosition;`
      ).replace(
        '#include <clipping_planes_vertex>',
        `#include <clipping_planes_vertex>
         vCustomWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_pars_fragment>',
        `#include <clipping_planes_pars_fragment>
         uniform bool uGlobalClipEnabled;
         uniform bool uMeshClipped;
         uniform bool uClipActive[3];
         uniform vec3 uClipNormal[3];
         uniform float uClipConstant[3];
         uniform bool uClipNegative[3];
         varying vec3 vCustomWorldPosition;

         bool evalCustomMeshClip(vec3 worldPos) {
           if (!uGlobalClipEnabled || !uMeshClipped) return false;
           bool hasNormal = false;
           bool normalDiscard = false;
           bool hasNegative = false;
           bool negativeDiscard = true;
           for (int i = 0; i < 3; i++) {
             if (uClipActive[i]) {
               float dist = dot(worldPos, uClipNormal[i]) + uClipConstant[i];
               bool d_i = (dist < 0.0);
               if (uClipNegative[i]) {
                 hasNegative = true;
                 negativeDiscard = negativeDiscard && d_i;
               } else {
                 hasNormal = true;
                 normalDiscard = normalDiscard || d_i;
               }
             }
           }
           if (hasNormal && hasNegative) return normalDiscard && negativeDiscard;
           if (hasNormal) return normalDiscard;
           if (hasNegative) return negativeDiscard;
           return false;
         }`
      ).replace(
        '#include <clipping_planes_fragment>',
        `if (evalCustomMeshClip(vCustomWorldPosition)) discard;`
      );
    };
  }

  // --- Unified Render Style Factory ---
  // Every mesh in the scene (brain, skull, soft tissue, arterial, venous, ventricles)
  // shares this single factory so all of them expose the same set of render styles
  // (MESH_RENDER_STYLES) while keeping each mesh's own default style/color/opacity.
  createStyledMaterial(style, color, opacity, isClippedGetter, extra = {}) {
    const isClipped = isClippedGetter ? Boolean(isClippedGetter()) : true;
    const planes = isClipped ? this.clippingPlanes : [];
    const isTranslucent = opacity < 0.99;
    let mat;

    if (style === 'velvet') {
      mat = createVelvetMaterial(this.clipUniforms, color);
      const u = mat.uniforms;
      const vp = extra.velvetParams || {};
      u.uAmbient.value = vp.ambient ?? this.velvetAmbient;
      u.uDiffuse.value = vp.diffuse ?? this.velvetDiffuse;
      u.uSpecular.value = vp.specular ?? this.velvetSpecular;
      u.uSheen.value = vp.sheen ?? this.velvetSheen;
      u.uEdginess.value = vp.edginess ?? this.velvetEdginess;
      u.uBackscatter.value = vp.backscatter ?? this.velvetBackscatter;
      u.uEdge.value = vp.edge ?? this.velvetEdge;
      u.uLightBackfaces.value = vp.lightBackfaces ?? this.velvetLightBackfaces;
      u.uOpacity.value = opacity;
      u.uMeshClipped.value = isClipped;
      mat.transparent = isTranslucent;
    } else if (style === 'glass' || style === 'xray') {
      mat = createXRayMaterial(this.clipUniforms, color);
      mat.uniforms.uOpacityMultiplier.value = opacity;
      mat.uniforms.uMeshClipped.value = isClipped;
      if (extra.edgeFalloff != null) mat.uniforms.uEdgeFalloff.value = extra.edgeFalloff;
    } else if (style === 'bone') {
      mat = new THREE.MeshStandardMaterial({
        color,
        roughness: extra.roughness ?? 0.65,
        metalness: extra.metalness ?? 0.05,
        transparent: isTranslucent,
        opacity,
        depthWrite: !isTranslucent,
        clippingPlanes: planes,
        side: THREE.DoubleSide
      });
      this.setupCustomClipping(mat, isClippedGetter);
    } else if (style === 'phong') {
      mat = new THREE.MeshPhongMaterial({
        color,
        specular: 0x222222,
        shininess: extra.shininess ?? 40,
        clippingPlanes: planes,
        side: THREE.DoubleSide,
        transparent: isTranslucent,
        opacity
      });
      this.setupCustomClipping(mat, isClippedGetter);
    } else if (style === 'matte') {
      mat = new THREE.MeshLambertMaterial({
        color,
        clippingPlanes: planes,
        side: THREE.DoubleSide,
        transparent: isTranslucent,
        opacity
      });
      this.setupCustomClipping(mat, isClippedGetter);
    } else if (style === 'matcap') {
      if (!this.matcapTexture) this.loadMatcap(this.currentMatcapName);
      mat = new THREE.MeshMatcapMaterial({
        color,
        matcap: this.matcapTexture,
        clippingPlanes: planes,
        side: THREE.DoubleSide,
        transparent: isTranslucent,
        opacity
      });
      this.setupCustomClipping(mat, isClippedGetter);
    } else if (style === 'wireframe') {
      mat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity,
        clippingPlanes: planes
      });
      this.setupCustomClipping(mat, isClippedGetter);
    } else {
      // Unknown style: fall back to velvet
      return this.createStyledMaterial('velvet', color, opacity, isClippedGetter, extra);
    }

    return mat;
  }

  // Re-creates the material for every mesh currently using the MatCap style once the
  // shared MatCap texture finishes (re)loading.
  _refreshMatcapUsers() {
    if (this.renderStyle === 'matcap') {
      this.updateBrainMaterial();
      this.updateAdditionalBrainStructuresMaterials();
    }
    if (this.skullStyle === 'matcap') {
      this.updateSkullMaterial();
      this.updateAllSkullSubstructureMaterials();
    }
    if (this.skinStyle === 'matcap') this.updateSkinMaterial();
    if (this.ventriclesStyle === 'matcap') this.updateVentriclesMaterial();
    if (this.arterialStyle === 'matcap') this.updateArterialMaterial();
    if (this.venousStyle === 'matcap') this.updateVenousMaterial();
    if (this.duralFoldsStyle === 'matcap') this.updateDuralFoldsMaterial();
  }

  updateVelvetUniforms() {
    if (this.brainMaterial && this.brainMaterial.uniforms && this.brainMaterial.uniforms.uAmbient) {
      const u = this.brainMaterial.uniforms;
      u.uAmbient.value = this.velvetAmbient;
      u.uDiffuse.value = this.velvetDiffuse;
      u.uSpecular.value = this.velvetSpecular;
      u.uSheen.value = this.velvetSheen;
      u.uEdginess.value = this.velvetEdginess;
      u.uBackscatter.value = this.velvetBackscatter;
      u.uEdge.value = this.velvetEdge;
      u.uLightBackfaces.value = this.velvetLightBackfaces;
    }
    for (const key in this.additionalBrainStructures) {
      const struct = this.additionalBrainStructures[key];
      if (struct?.material?.uniforms?.uAmbient) {
        const u = struct.material.uniforms;
        u.uAmbient.value = this.velvetAmbient;
        u.uDiffuse.value = this.velvetDiffuse;
        u.uSpecular.value = this.velvetSpecular;
        u.uSheen.value = this.velvetSheen;
        u.uEdginess.value = this.velvetEdginess;
        u.uBackscatter.value = this.velvetBackscatter;
        u.uEdge.value = this.velvetEdge;
        u.uLightBackfaces.value = this.velvetLightBackfaces;
      }
    }
  }

  setBrainClipped(clipped) {
    this.brainClipped = clipped;
    if (this.brainMesh && this.brainMesh.material) {
      const mat = this.brainMesh.material;
      if (mat.uniforms && mat.uniforms.uMeshClipped) {
        mat.uniforms.uMeshClipped.value = clipped;
      }
      if (mat.userData?.shader?.uniforms?.uMeshClipped) {
        mat.userData.shader.uniforms.uMeshClipped.value = clipped;
      }
      mat.clippingPlanes = clipped ? this.clippingPlanes : [];
      mat.needsUpdate = true;
    }
    this.updateAdditionalBrainStructuresClipping(clipped);
  }

  async setAdditionalStructureEnabled(id, enabled) {
    return this.toggleAdditionalBrainStructure(id, enabled);
  }

  async toggleAdditionalBrainStructure(id, enabled) {
    const struct = this.additionalBrainStructures[id];
    if (!struct) return;
    struct.enabled = !!enabled;

    if (struct.enabled) {
      if (!struct.mesh) {
        if (struct.loading) return;
        struct.loading = true;
        try {
          const buffer = await fetchBinary(`data/${struct.cacheKey}.bin.gz`);
          struct.geometry = this.parseBinaryMesh(buffer);
          struct.geometry.computeBoundingBox();
          struct.geometry.computeBoundingSphere();

          struct.material = this.createStyledMaterial(
            this.renderStyle,
            struct.color,
            this.brainOpacity,
            () => this.brainClipped,
            { roughness: 0.5, metalness: 0.1 }
          );

          struct.mesh = new THREE.Mesh(struct.geometry, struct.material);
          struct.mesh.name = `BrainStructure_${id}`;
          struct.mesh.visible = this.brainVisible && struct.enabled;
          this.scene.add(struct.mesh);

          this.updateClippingPlanes(this.clippingPlanes, this.clipUniforms);
          if (this.renderStyle === 'velvet') {
            this.updateVelvetUniforms();
          }
          if (this.hasBrainOverlay && this.activeVolumeManager) {
            this.updateBrainOverlayColors();
          }
        } catch (err) {
          console.error(`Error loading additional brain structure ${id}:`, err);
        } finally {
          struct.loading = false;
        }
      } else {
        struct.mesh.visible = this.brainVisible && struct.enabled;
        if (this.hasBrainOverlay && this.activeVolumeManager) {
          this.updateBrainOverlayColors();
        }
      }
    } else {
      if (struct.mesh) {
        struct.mesh.visible = false;
      }
    }
  }

  setAdditionalBrainStructureColor(id, colorHex) {
    const struct = this.additionalBrainStructures[id];
    if (!struct) return;
    const c = new THREE.Color(colorHex);
    struct.color = c.getHex();
    struct.defaultColorHex = typeof colorHex === 'string' ? colorHex : '#' + c.getHexString();

    if (struct.mesh) {
      if (this.hasBrainOverlay) {
        this.updateBrainOverlayColors();
      } else {
        if (struct.material) {
          if (struct.material.uniforms && struct.material.uniforms.uColor) {
            struct.material.uniforms.uColor.value.copy(c);
          }
          if (struct.material.color) {
            struct.material.color.copy(c);
          }
          struct.material.needsUpdate = true;
        }
      }
    }
  }

  updateAdditionalBrainStructuresVisibility() {
    for (const key in this.additionalBrainStructures) {
      const struct = this.additionalBrainStructures[key];
      if (struct && struct.mesh) {
        struct.mesh.visible = this.brainVisible && struct.enabled;
      }
    }
  }

  updateAdditionalBrainStructuresMaterials() {
    for (const key in this.additionalBrainStructures) {
      const struct = this.additionalBrainStructures[key];
      if (struct && struct.mesh) {
        struct.material = this.createStyledMaterial(
          this.renderStyle,
          struct.color,
          this.brainOpacity,
          () => this.brainClipped,
          { roughness: 0.5, metalness: 0.1 }
        );
        struct.mesh.material = struct.material;
        struct.mesh.material.needsUpdate = true;
      }
    }
    this.updateClippingPlanes(this.clippingPlanes, this.clipUniforms);
    if (this.renderStyle === 'velvet') {
      this.updateVelvetUniforms();
    }
  }

  updateAdditionalBrainStructuresClipping(clipped) {
    for (const key in this.additionalBrainStructures) {
      const struct = this.additionalBrainStructures[key];
      if (struct && struct.mesh && struct.mesh.material) {
        const mat = struct.mesh.material;
        if (mat.uniforms && mat.uniforms.uMeshClipped) {
          mat.uniforms.uMeshClipped.value = clipped;
        }
        if (mat.userData?.shader?.uniforms?.uMeshClipped) {
          try {
            mat.userData.shader.uniforms.uMeshClipped.value = clipped;
          } catch (e) {}
        }
        mat.clippingPlanes = clipped ? this.clippingPlanes : [];
        mat.needsUpdate = true;
      }
    }
  }

  updateBrainMaterial() {
    this.brainMaterial = this.createStyledMaterial(
      this.renderStyle, this.brainColor, this.brainOpacity, () => this.brainClipped
    );

    if (this.hasBrainOverlay && this.currentBrainType !== 'none') {
      if (this.renderStyle === 'velvet') {
        this.brainMaterial.vertexColors = true;
        if (this.brainMaterial.uniforms && this.brainMaterial.uniforms.uUseVertexColor) {
          this.brainMaterial.uniforms.uUseVertexColor.value = true;
        }
      } else if (this.renderStyle === 'glass' || this.renderStyle === 'xray') {
        this.brainMaterial.vertexColors = true;
      } else {
        // phong, matte, matcap, bone, wireframe
        this.brainMaterial.vertexColors = true;
        this.brainMaterial.color.setHex(0xffffff);
      }
    }

    if (this.brainMesh) {
      this.brainMesh.material = this.brainMaterial;
      this.brainMesh.material.needsUpdate = true;
      this.brainMesh.visible = (this.currentBrainType !== 'none') && this.brainVisible;
    }
  }

  applyBrainOverlayScalars(scalars, source = 'nii', vm = null) {
    if (!scalars || !this.brainGeometry) return;
    const vCount = this.brainGeometry.attributes.position.count;
    if (scalars.length !== vCount) {
      console.warn(`Overlay scalar count (${scalars.length}) does not match brain vertex count (${vCount})`);
      return;
    }
    this.brainOverlayScalars = scalars;
    this.brainOverlaySource = source;
    this.hasBrainOverlay = true;
    if (vm) this.activeVolumeManager = vm;
    this.updateBrainOverlayColors(vm);
  }

  _applyOverlayToGeometry(geom, material, baseColorVal, vm, overlaysToApply) {
    if (!geom || !geom.attributes.position) return;
    const vCount = geom.attributes.position.count;

    let colorAttr = geom.attributes.color;
    if (!colorAttr || colorAttr.count !== vCount) {
      const colArray = new Float32Array(vCount * 3);
      colorAttr = new THREE.BufferAttribute(colArray, 3);
      geom.setAttribute('color', colorAttr);
    }

    const colors = colorAttr.array;
    const baseColor = new THREE.Color(baseColorVal);

    // Initialize all vertices to base surface color
    for (let i = 0; i < vCount; i++) {
      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    for (const ov of overlaysToApply) {
      let scalars = null;
      if (ov.type === 'gifti_surface') {
        if (ov.giftiScalars && ov.giftiScalars.length === vCount) {
          scalars = ov.giftiScalars;
        }
      } else if (ov.type === 'volume') {
        if (!ov._geoScalarCache) ov._geoScalarCache = new WeakMap();
        scalars = ov._geoScalarCache.get(geom);
        if (!scalars || scalars.length !== vCount) {
          if (vm && typeof vm.sampleVolumeOverlayOnMesh === 'function') {
            scalars = vm.sampleVolumeOverlayOnMesh(ov, geom);
            if (scalars) {
              ov._geoScalarCache.set(geom, scalars);
            }
          }
        }
      }

      if (!scalars || scalars.length !== vCount) continue;

      const hasPos = ov.hasPos !== false;
      const posMin = ov.posMin ?? 1.0;
      const posMax = ov.posMax ?? 5.0;
      const posOpacity = ov.posOpacity ?? 0.85;
      const posCmap = ov.posColormap ?? 17;

      const hasNeg = Boolean(ov.hasNeg);
      const negMin = ov.negMin ?? -1.0;
      const negMax = ov.negMax ?? -5.0;
      const negOpacity = ov.negOpacity ?? 0.85;
      const negCmap = ov.negColormap ?? 18;

      const cutoffNegMag = Math.min(Math.abs(negMin), Math.abs(negMax));
      const peakNegMag = Math.max(Math.abs(negMin), Math.abs(negMax));

      for (let i = 0; i < vCount; i++) {
        const s = scalars[i];
        if (hasPos && s > 1e-4 && s >= posMin) {
          const norm = Math.max(0.0, Math.min(1.0, (s - posMin) / Math.max(1e-4, posMax - posMin)));
          const c = evaluateOverlayColormap(norm, posCmap);
          colors[i * 3] = colors[i * 3] * (1.0 - posOpacity) + c[0] * posOpacity;
          colors[i * 3 + 1] = colors[i * 3 + 1] * (1.0 - posOpacity) + c[1] * posOpacity;
          colors[i * 3 + 2] = colors[i * 3 + 2] * (1.0 - posOpacity) + c[2] * posOpacity;
        } else if (hasNeg && s < -1e-4) {
          const rawMag = Math.abs(s);
          if (rawMag >= cutoffNegMag) {
            const norm = Math.max(0.0, Math.min(1.0, (rawMag - cutoffNegMag) / Math.max(1e-4, peakNegMag - cutoffNegMag)));
            const c = evaluateOverlayColormap(norm, negCmap);
            colors[i * 3] = colors[i * 3] * (1.0 - negOpacity) + c[0] * negOpacity;
            colors[i * 3 + 1] = colors[i * 3 + 1] * (1.0 - negOpacity) + c[1] * negOpacity;
            colors[i * 3 + 2] = colors[i * 3 + 2] * (1.0 - negOpacity) + c[2] * negOpacity;
          }
        }
      }
    }

    colorAttr.needsUpdate = true;

    if (material) {
      material.vertexColors = true;
      if (this.renderStyle === 'velvet') {
        if (material.uniforms && material.uniforms.uUseVertexColor) {
          material.uniforms.uUseVertexColor.value = true;
        }
      } else if (this.renderStyle === 'glass' || this.renderStyle === 'xray') {
        // Handled by shader
      } else {
        if (material.color) {
          material.color.setHex(0xffffff);
        }
      }
      material.needsUpdate = true;
    }
  }

  _clearOverlayFromGeometry(geom, material, baseColorVal) {
    if (geom && geom.attributes.color) {
      geom.deleteAttribute('color');
    }
    if (material) {
      material.vertexColors = false;
      if (material.uniforms && material.uniforms.uUseVertexColor) {
        material.uniforms.uUseVertexColor.value = false;
      }
      const c = new THREE.Color(baseColorVal);
      if (material.uniforms && material.uniforms.uColor) {
        material.uniforms.uColor.value.copy(c);
      }
      if (material.color) {
        material.color.copy(c);
      }
      material.needsUpdate = true;
    }
  }

  updateBrainOverlayColors(vm = this.activeVolumeManager) {
    if (vm) this.activeVolumeManager = vm;

    const activeOverlays = vm && vm.overlays ? vm.overlays.filter(o => o.enabled && o.projectOntoMesh) : [];

    if (activeOverlays.length === 0 && (!vm || !vm.hasOverlay || !vm.projectOntoMesh)) {
      this.clearBrainOverlay();
      return;
    }

    let overlaysToApply = activeOverlays;
    if (overlaysToApply.length === 0 && vm && vm.hasOverlay && vm.projectOntoMesh) {
      overlaysToApply = [{
        type: vm.overlayType,
        giftiScalars: vm.giftiScalars,
        hasPos: vm.hasPosOverlay,
        posMin: vm.posMin,
        posMax: vm.posMax,
        posOpacity: vm.posOpacity,
        posColormap: vm.posColormap,
        hasNeg: vm.hasNegOverlay,
        negMin: vm.negMin,
        negMax: vm.negMax,
        negOpacity: vm.negOpacity,
        negColormap: vm.negColormap
      }];
    }

    this.hasBrainOverlay = true;

    // 1. Primary brain mesh
    if (this.currentBrainType !== 'none' && this.brainGeometry) {
      this._applyOverlayToGeometry(
        this.brainGeometry,
        this.brainMaterial,
        this.brainColor,
        vm,
        overlaysToApply
      );
      this.updateBrainMaterial();
    } else if (this.brainGeometry) {
      this._clearOverlayFromGeometry(this.brainGeometry, this.brainMaterial, this.brainColor);
      if (this.brainMesh) {
        this.brainMesh.visible = false;
      }
    }

    // 2. Additional brain structures
    for (const key in this.additionalBrainStructures) {
      const struct = this.additionalBrainStructures[key];
      if (struct && struct.enabled && struct.geometry && struct.mesh) {
        this._applyOverlayToGeometry(
          struct.geometry,
          struct.mesh.material,
          struct.color,
          vm,
          overlaysToApply
        );
      } else if (struct && struct.geometry && struct.mesh) {
        this._clearOverlayFromGeometry(struct.geometry, struct.mesh.material, struct.color);
      }
    }
  }

  clearBrainOverlay() {
    this.hasBrainOverlay = false;
    this.brainOverlayScalars = null;
    this.brainOverlaySource = null;
    if (this.brainGeometry) {
      this._clearOverlayFromGeometry(this.brainGeometry, this.brainMaterial, this.brainColor);
    }
    this.updateBrainMaterial();

    for (const key in this.additionalBrainStructures) {
      const struct = this.additionalBrainStructures[key];
      if (struct && struct.geometry && struct.mesh) {
        this._clearOverlayFromGeometry(struct.geometry, struct.mesh.material, struct.color);
      }
    }
  }

  _reapplyBrainOverlayIfActive() {
    const vm = this.activeVolumeManager;
    if (vm && (vm.hasOverlay || (vm.overlays && vm.overlays.length > 0))) {
      // If any GIfTI overlays need re-padding for new bilateral mesh:
      if (vm.overlays && this.brainGeometry) {
        const vCount = this.brainGeometry.attributes.position.count;
        const isBilateral = Boolean(this.brainGeometry.userData?.isBilateral);
        const hemiCounts = this.brainGeometry.userData?.hemiVertexCounts;

        for (const ov of vm.overlays) {
          if (ov.type === 'gifti_surface' && ov.originalHemiScalars) {
            const hemiVerts = ov.originalHemiScalars.length;
            if (hemiVerts !== vCount && (isBilateral || hemiVerts === Math.floor(vCount / 2))) {
              const padded = new Float32Array(vCount);
              const leftCount = hemiCounts ? hemiCounts.left : Math.floor(vCount / 2);
              const side = ov.hemisphere || 'left';
              if (side === 'right') padded.set(ov.originalHemiScalars, leftCount);
              else padded.set(ov.originalHemiScalars, 0);
              ov.giftiScalars = padded;
              ov.numVertices = vCount;
            }
          }
        }
      }
      this.updateBrainOverlayColors(vm);
    } else {
      this.clearBrainOverlay();
    }
  }

  setSkullVisible(visible) {
    this.skullVisible = visible;
    if (this.currentSkullType === 'ohio') {
      if (this.skullMesh) this.skullMesh.visible = false;
      this.updateSkullSubstructuresVisibility();
    } else {
      if (this.skullMesh) this.skullMesh.visible = visible;
    }
  }

  setSkullOpacity(opacity) {
    this.skullOpacity = opacity;
    this.updateSkullMaterial();
    this.updateAllSkullSubstructureMaterials();
  }

  setSkullStyle(style) {
    this.skullStyle = style;
    this.updateSkullMaterial();
    this.updateAllSkullSubstructureMaterials();
  }

  setSkullClipped(clipped) {
    this.skullClipped = clipped;
    if (this.skullMesh && this.skullMesh.material) {
      const mat = this.skullMesh.material;
      if (mat.uniforms && mat.uniforms.uMeshClipped) {
        mat.uniforms.uMeshClipped.value = clipped;
      }
      if (mat.userData?.shader?.uniforms?.uMeshClipped) {
        try {
          mat.userData.shader.uniforms.uMeshClipped.value = clipped;
        } catch (e) {}
      }
      mat.clippingPlanes = clipped ? this.clippingPlanes : [];
      mat.needsUpdate = true;
    }
    // "and the 'Clip Skull' button should clip all of them together."
    for (const id in this.skullSubstructures) {
      const sub = this.skullSubstructures[id];
      if (sub.mesh && sub.mesh.material) {
        const mat = sub.mesh.material;
        if (mat.uniforms && mat.uniforms.uMeshClipped) {
          mat.uniforms.uMeshClipped.value = clipped;
        }
        if (mat.userData?.shader?.uniforms?.uMeshClipped) {
          try {
            mat.userData.shader.uniforms.uMeshClipped.value = clipped;
          } catch (e) {}
        }
        mat.clippingPlanes = clipped ? this.clippingPlanes : [];
        mat.needsUpdate = true;
      }
    }
  }

  updateSkullMaterial() {
    this.skullMaterial = this.createStyledMaterial(
      this.skullStyle, this.skullColor, this.skullOpacity, () => this.skullClipped
    );

    if (this.skullMesh) {
      this.skullMesh.material = this.skullMaterial;
      this.skullMesh.material.needsUpdate = true;
    }

    this.updateAllSkullSubstructureMaterials();
  }

  // --- Ventricles Material ---
  setVentriclesVisible(visible) {
    this.ventriclesVisible = visible;
    if (this.ventriclesMesh) this.ventriclesMesh.visible = visible;
  }

  setVentriclesOpacity(opacity) {
    this.ventriclesOpacity = opacity;
    this.updateVentriclesMaterial();
  }

  setVentriclesClipped(clipped) {
    this.ventriclesClipped = clipped;
    if (this.ventriclesMesh && this.ventriclesMesh.material) {
      const mat = this.ventriclesMesh.material;
      if (mat.uniforms && mat.uniforms.uMeshClipped) {
        mat.uniforms.uMeshClipped.value = clipped;
      }
      if (mat.userData?.shader?.uniforms?.uMeshClipped) {
        try {
          mat.userData.shader.uniforms.uMeshClipped.value = clipped;
        } catch (e) {}
      }
      mat.clippingPlanes = clipped ? this.clippingPlanes : [];
      mat.needsUpdate = true;
    }
  }

  setVentriclesStyle(style) {
    this.ventriclesStyle = style;
    this.updateVentriclesMaterial();
  }

  updateVentriclesMaterial() {
    this.ventriclesMaterial = this.createStyledMaterial(
      this.ventriclesStyle, this.ventriclesColor, this.ventriclesOpacity, () => this.ventriclesClipped,
      { roughness: 0.25, metalness: 0.1 }
    );

    if (this.ventriclesMesh) {
      this.ventriclesMesh.material = this.ventriclesMaterial;
      this.ventriclesMesh.material.needsUpdate = true;
    }
  }

  // --- Skin Material ---
  setSkinVisible(visible) {
    this.skinVisible = visible;
    if (this.skinMesh) this.skinMesh.visible = visible;
  }

  setSkinOpacity(opacity) {
    this.skinOpacity = opacity;
    this.updateSkinMaterial();
  }

  setSkinStyle(style) {
    this.skinStyle = style;
    this.updateSkinMaterial();
  }

  setSkinClipped(clipped) {
    this.skinClipped = clipped;
    if (this.skinMesh && this.skinMesh.material) {
      const mat = this.skinMesh.material;
      if (mat.uniforms && mat.uniforms.uMeshClipped) {
        mat.uniforms.uMeshClipped.value = clipped;
      }
      if (mat.userData?.shader?.uniforms?.uMeshClipped) {
        mat.userData.shader.uniforms.uMeshClipped.value = clipped;
      }
      mat.clippingPlanes = clipped ? this.clippingPlanes : [];
      mat.needsUpdate = true;
    }
  }

  updateSkinMaterial() {
    this.skinMaterial = this.createStyledMaterial(
      this.skinStyle, this.skinColor, this.skinOpacity, () => this.skinClipped,
      { roughness: 0.7, metalness: 0.02, edgeFalloff: 1.4 }
    );

    if (this.skinMesh) {
      this.skinMesh.material = this.skinMaterial;
      this.skinMesh.material.needsUpdate = true;
    }
  }

  // --- Arterial Structures Material ---
  setArterialVisible(visible) {
    this.arterialVisible = visible;
    if (this.arterialMesh) this.arterialMesh.visible = visible;
  }

  setArterialOpacity(opacity) {
    this.arterialOpacity = opacity;
    this.updateArterialMaterial();
  }

  setArterialClipped(clipped) {
    this.arterialClipped = clipped;
    if (this.arterialMesh && this.arterialMesh.material) {
      const mat = this.arterialMesh.material;
      if (mat.uniforms && mat.uniforms.uMeshClipped) {
        mat.uniforms.uMeshClipped.value = clipped;
      }
      if (mat.userData?.shader?.uniforms?.uMeshClipped) {
        try {
          mat.userData.shader.uniforms.uMeshClipped.value = clipped;
        } catch (e) {}
      }
      mat.clippingPlanes = clipped ? this.clippingPlanes : [];
      mat.needsUpdate = true;
    }
  }

  setArterialStyle(style) {
    this.arterialStyle = style;
    this.updateArterialMaterial();
  }

  updateArterialMaterial() {
    this.arterialMaterial = this.createStyledMaterial(
      this.arterialStyle, this.arterialColor, this.arterialOpacity, () => this.arterialClipped,
      { roughness: 0.35, metalness: 0.15 }
    );

    if (this.arterialMesh) {
      this.arterialMesh.material = this.arterialMaterial;
      this.arterialMesh.material.needsUpdate = true;
    }
  }

  // --- Venous Structures Material ---
  setVenousVisible(visible) {
    this.venousVisible = visible;
    if (this.venousMesh) this.venousMesh.visible = visible;
  }

  setVenousOpacity(opacity) {
    this.venousOpacity = opacity;
    this.updateVenousMaterial();
  }

  setVenousClipped(clipped) {
    this.venousClipped = clipped;
    if (this.venousMesh && this.venousMesh.material) {
      const mat = this.venousMesh.material;
      if (mat.uniforms && mat.uniforms.uMeshClipped) {
        mat.uniforms.uMeshClipped.value = clipped;
      }
      if (mat.userData?.shader?.uniforms?.uMeshClipped) {
        try {
          mat.userData.shader.uniforms.uMeshClipped.value = clipped;
        } catch (e) {}
      }
      mat.clippingPlanes = clipped ? this.clippingPlanes : [];
      mat.needsUpdate = true;
    }
  }

  setVenousStyle(style) {
    this.venousStyle = style;
    this.updateVenousMaterial();
  }

  updateVenousMaterial() {
    this.venousMaterial = this.createStyledMaterial(
      this.venousStyle, this.venousColor, this.venousOpacity, () => this.venousClipped,
      { roughness: 0.35, metalness: 0.15 }
    );

    if (this.venousMesh) {
      this.venousMesh.material = this.venousMaterial;
      this.venousMesh.material.needsUpdate = true;
    }
  }

  // --- Dural Folds Material ---
  setDuralFoldsVisible(visible) {
    this.duralFoldsVisible = visible;
    if (this.duralFoldsMesh) this.duralFoldsMesh.visible = visible;
  }

  setDuralFoldsOpacity(opacity) {
    this.duralFoldsOpacity = opacity;
    this.updateDuralFoldsMaterial();
  }

  setDuralFoldsClipped(clipped) {
    this.duralFoldsClipped = clipped;
    if (this.duralFoldsMesh && this.duralFoldsMesh.material) {
      const mat = this.duralFoldsMesh.material;
      if (mat.uniforms && mat.uniforms.uMeshClipped) {
        mat.uniforms.uMeshClipped.value = clipped;
      }
      if (mat.userData?.shader?.uniforms?.uMeshClipped) {
        try {
          mat.userData.shader.uniforms.uMeshClipped.value = clipped;
        } catch (e) {}
      }
      mat.clippingPlanes = clipped ? this.clippingPlanes : [];
      mat.needsUpdate = true;
    }
  }

  setDuralFoldsStyle(style) {
    this.duralFoldsStyle = style;
    this.updateDuralFoldsMaterial();
  }

  updateDuralFoldsMaterial() {
    this.duralFoldsMaterial = this.createStyledMaterial(
      this.duralFoldsStyle, this.duralFoldsColor, this.duralFoldsOpacity, () => this.duralFoldsClipped,
      { roughness: 0.4, metalness: 0.1 }
    );

    if (this.duralFoldsMesh) {
      this.duralFoldsMesh.material = this.duralFoldsMaterial;
      this.duralFoldsMesh.material.needsUpdate = true;
    }
  }

  // --- Multi-Plane Clipping Updates ---
  updateClippingPlanes(planes, clipUniforms = null) {
    this.clippingPlanes = planes;
    if (clipUniforms) this.clipUniforms = clipUniforms;

    const syncMat = (mat, isClipped) => {
      if (!mat) return;
      if (mat.uniforms) {
        if (this.clipUniforms) {
          mat.uniforms.uGlobalClipEnabled = this.clipUniforms.uGlobalClipEnabled;
          mat.uniforms.uClipActive = this.clipUniforms.uClipActive;
          mat.uniforms.uClipNormal = this.clipUniforms.uClipNormal;
          mat.uniforms.uClipConstant = this.clipUniforms.uClipConstant;
          mat.uniforms.uClipNegative = this.clipUniforms.uClipNegative;
        }
        if (mat.uniforms.uMeshClipped) {
          mat.uniforms.uMeshClipped.value = isClipped;
        }
      }
      if (mat.userData?.shader?.uniforms) {
        if (this.clipUniforms) {
          mat.userData.shader.uniforms.uGlobalClipEnabled = this.clipUniforms.uGlobalClipEnabled;
          mat.userData.shader.uniforms.uClipActive = this.clipUniforms.uClipActive;
          mat.userData.shader.uniforms.uClipNormal = this.clipUniforms.uClipNormal;
          mat.userData.shader.uniforms.uClipConstant = this.clipUniforms.uClipConstant;
          mat.userData.shader.uniforms.uClipNegative = this.clipUniforms.uClipNegative;
        }
        if (mat.userData.shader.uniforms.uMeshClipped) {
          try {
            mat.userData.shader.uniforms.uMeshClipped.value = isClipped;
          } catch (e) {}
        }
      }
      const targetPlanes = isClipped ? planes : [];
      const currentPlanesLen = mat.clippingPlanes ? mat.clippingPlanes.length : 0;
      if (currentPlanesLen !== targetPlanes.length) {
        mat.clippingPlanes = targetPlanes;
        mat.needsUpdate = true;
      } else {
        mat.clippingPlanes = targetPlanes;
      }
    };

    if (this.brainMesh) syncMat(this.brainMesh.material, this.brainClipped);
    if (this.skullMesh) syncMat(this.skullMesh.material, this.skullClipped);
    if (this.ventriclesMesh) syncMat(this.ventriclesMesh.material, this.ventriclesClipped);
    if (this.skinMesh) syncMat(this.skinMesh.material, this.skinClipped);
    if (this.arterialMesh) syncMat(this.arterialMesh.material, this.arterialClipped);
    if (this.venousMesh) syncMat(this.venousMesh.material, this.venousClipped);
    if (this.duralFoldsMesh) syncMat(this.duralFoldsMesh.material, this.duralFoldsClipped);

    for (const key in this.additionalBrainStructures) {
      const struct = this.additionalBrainStructures[key];
      if (struct && struct.mesh) syncMat(struct.mesh.material, this.brainClipped);
    }

    for (const key in this.skullSubstructures) {
      const sub = this.skullSubstructures[key];
      if (sub && sub.mesh) syncMat(sub.mesh.material, this.skullClipped);
    }

    for (const c of this.customMeshes) {
      if (c.mesh) syncMat(c.mesh.material, c.clipped);
    }
  }

  onMeshesChange(cb) {
    this.onMeshesChangeCallbacks.push(cb);
  }

  notifyMeshesChange() {
    for (const cb of this.onMeshesChangeCallbacks) {
      cb(this);
    }
  }
}
