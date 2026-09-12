import * as THREE from 'three';
import { createSliceMaterial } from './shaders/sliceShader.js';

export class ClippingManager {
  constructor(scene, volumeManager, meshManager) {
    this.scene = scene;
    this.volumeManager = volumeManager;
    this.meshManager = meshManager;

    this.globalEnabled = true;
    this.brainCenter = new THREE.Vector3(0.0, -20.0, 10.0);

    // Multi-plane and negative clipping uniforms (shared directly with MeshManager)
    this.clipUniforms = (meshManager && meshManager.clipUniforms) ? meshManager.clipUniforms : {
      uGlobalClipEnabled: { value: true },
      uClipActive: { value: [true, false, false] },
      uClipNormal: { value: [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)] },
      uClipConstant: { value: [0, 0, 0] },
      uClipNegative: { value: [true, true, true] }
    };
    if (meshManager) meshManager.clipUniforms = this.clipUniforms;

    this.updateCallbacks = [];

    // Multi-plane configurations (up to 3 simultaneous clipping planes)
    this.planes = [
      {
        id: 1,
        name: 'Plane 1 (Axial)',
        enabled: true,
        azimuth: 0,
        elevation: -90,
        depth: 0,
        inverted: false,
        negative: true, // Negative Mode default: true
        normal: new THREE.Vector3(0, 0, -1),
        normal0: new THREE.Vector3(0, 0, -1),
        constant: 0,
        threePlane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
        sliceQuad: null,
        sliceMaterial: null,
        helper: null,
        showHelper: true // Plane box default: visible
      },
      {
        id: 2,
        name: 'Plane 2 (Coronal)',
        enabled: false,
        azimuth: 180,
        elevation: 0,
        depth: 0,
        inverted: true,
        negative: true, // Negative Mode default: true
        normal: new THREE.Vector3(0, 1, 0),
        normal0: new THREE.Vector3(0, 1, 0),
        constant: 0,
        threePlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        sliceQuad: null,
        sliceMaterial: null,
        helper: null,
        showHelper: true // Plane box default: visible
      },
      {
        id: 3,
        name: 'Plane 3 (Sagittal)',
        enabled: false,
        azimuth: 90,
        elevation: 0,
        depth: 0,
        inverted: false,
        negative: true, // Negative Mode default: true
        normal: new THREE.Vector3(1, 0, 0),
        normal0: new THREE.Vector3(1, 0, 0),
        constant: 0,
        threePlane: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
        sliceQuad: null,
        sliceMaterial: null,
        helper: null,
        showHelper: true // Plane box default: visible
      }
    ];

    // Global volumetric slice rendering settings
    this.sliceVisible = true;
    this.rawWindowMin = 100.0;
    this.rawWindowMax = 300.0;
    this.windowMin = 100.0 / 351.04;
    this.windowMax = 300.0 / 351.04;
    this.colormap = 0; // 0=Gray, 1=Bone, 2=Hot, 3=Cool, 4=Rainbow, 5=Velvet, 6=Atlas
    this.sliceOpacity = 1.0;
    this.maskMode = 'brain'; // 'none', 'brain', 'skull', 'skin'
    this.maskThresholdValue = 20.0;
    this.slabThickness = 0.0;
    this.slabMode = 0;

    // Overlay volume settings (synced from VolumeManager)
    this.volumeManager.onOverlayChange(() => this.updateOverlayUniforms());

    // Base volume settings (synced when switching base volume)
    this.volumeManager.onBaseVolumeChange(() => {
      this.setVolumeTexture(this.volumeManager.texture);
      const def = this.volumeManager.defaultRawWindow || [0, this.volumeManager.rawMax];
      this.setRawWindow(def[0], def[1]);
      if (this.globalEnabled) this.update();
    });

    this.initSlices();
  }

  setRawWindow(rawMin, rawMax) {
    this.rawWindowMin = rawMin;
    this.rawWindowMax = rawMax;
    const rawMaxRef = (this.volumeManager && this.volumeManager.rawMax > 0) ? this.volumeManager.rawMax : 1.0;
    this.windowMin = this.rawWindowMin / rawMaxRef;
    this.windowMax = this.rawWindowMax / rawMaxRef;
    this.updateWindowUniforms();
  }

  updateWindowUniforms() {
    for (const p of this.planes) {
      if (p.sliceMaterial) {
        p.sliceMaterial.uniforms.uWindowMin.value = this.windowMin;
        p.sliceMaterial.uniforms.uWindowMax.value = this.windowMax;
      }
    }
  }

  initSlices() {
    const geom = new THREE.PlaneGeometry(320, 320, 1, 1);
    const helperGeom = new THREE.EdgesGeometry(geom);

    const helperColors = [0x44aaff, 0x44ffaa, 0xffaa44];

    for (let i = 0; i < this.planes.length; i++) {
      const p = this.planes[i];
      p.sliceMaterial = createSliceMaterial(this.clipUniforms, i);

      if (this.volumeManager.texture) {
        this.applyVolumeUniformsToMaterial(p.sliceMaterial);
      }

      p.sliceQuad = new THREE.Mesh(geom, p.sliceMaterial);
      p.sliceQuad.name = `VolumetricSliceQuad_${p.id}`;
      p.sliceQuad.visible = false;
      p.sliceQuad.renderOrder = 2 + i;
      this.scene.add(p.sliceQuad);

      // Edge helper frame (added directly to scene so it can be shown even when slice rendering is off)
      const helperMat = new THREE.LineBasicMaterial({
        color: helperColors[i] || 0xffffff,
        transparent: true,
        opacity: 0.65
      });
      p.helper = new THREE.LineSegments(helperGeom, helperMat);
      p.helper.visible = false;
      this.scene.add(p.helper);
    }
  }

  applyVolumeUniformsToMaterial(mat) {
    const u = mat.uniforms;
    u.uVolume.value = this.volumeManager.texture;
    u.uWorldToVolumeTex.value.copy(this.volumeManager.worldToVolumeTex);
    u.uOrigin.value.copy(this.volumeManager.origin);
    u.uSize.value.copy(this.volumeManager.size);
    this.applyMaskUniformsToMaterial(mat);
    this.applyOverlayUniformsToMaterial(mat);
  }

  getNormalizedMaskThreshold() {
    if (this.maskMode === 'nonzero') return 0.0001;
    const rawMaxRef = (this.volumeManager && this.volumeManager.rawMax > 0) ? this.volumeManager.rawMax : 1.0;
    const val = (typeof this.maskThresholdValue === 'number' && !isNaN(this.maskThresholdValue)) ? this.maskThresholdValue : 20.0;
    return Math.max(0.0, val / rawMaxRef);
  }

  applyMaskUniformsToMaterial(mat) {
    if (!mat || !mat.uniforms) return;
    const u = mat.uniforms;
    const vm = this.volumeManager;
    if (!this.maskMode || this.maskMode === 'none') {
      u.uMaskMode.value = 0;
      u.uMaskVolume.value = vm.dummyMaskTexture;
    } else if (this.maskMode === 'nonzero') {
      u.uMaskMode.value = 2;
      u.uMaskVolume.value = vm.dummyMaskTexture;
      if (u.uThreshold) u.uThreshold.value = 0.0001;
    } else if (this.maskMode === 'threshold') {
      u.uMaskMode.value = 2;
      u.uMaskVolume.value = vm.dummyMaskTexture;
      if (u.uThreshold) u.uThreshold.value = this.getNormalizedMaskThreshold();
    } else {
      u.uMaskMode.value = 1;
      u.uMaskVolume.value = vm.getMaskTexture(this.maskMode);
      u.uWorldToMaskTex.value.copy(vm.getMaskWorldToTex(this.maskMode));
      u.uMaskThreshold.value = 0.5;
    }
    mat.needsUpdate = true;
  }

  async setMaskMode(mode) {
    this.maskMode = mode;
    if (mode !== 'none' && mode !== 'nonzero' && mode !== 'threshold' && !this.volumeManager.maskTextures[mode]) {
      await this.volumeManager.loadMask(mode);
    }
    this.volumeManager.currentMask = mode;
    for (const p of this.planes) {
      if (p.sliceMaterial) {
        this.applyMaskUniformsToMaterial(p.sliceMaterial);
      }
    }
    this.update();
  }

  setMaskThresholdValue(val) {
    this.maskThresholdValue = parseFloat(val);
    const normThresh = this.getNormalizedMaskThreshold();
    for (const p of this.planes) {
      if (p.sliceMaterial && p.sliceMaterial.uniforms && p.sliceMaterial.uniforms.uThreshold) {
        p.sliceMaterial.uniforms.uThreshold.value = normThresh;
      }
    }
    this.update();
  }

  /**
   * Returns orientation information and the current MNI coordinate for a clipping plane
   * @param {Object} p - Plane object
   */
  getPlaneMNIInfo(p) {
    const n0 = p.normal0 || this.sph2cartDeg90x(p.azimuth, p.elevation, 1.0);
    const cutPoint = this.brainCenter.clone().add(n0.clone().multiplyScalar(p.depth));

    const ax = Math.abs(n0.x);
    const ay = Math.abs(n0.y);
    const az = Math.abs(n0.z);

    if (az >= ax && az >= ay) {
      return {
        axis: 'Z',
        sign: Math.sign(n0.z) || 1,
        coord: cutPoint.z,
        orientationName: 'Axial',
        min: -75,
        max: 105
      };
    } else if (ay >= ax && ay >= az) {
      return {
        axis: 'Y',
        sign: Math.sign(n0.y) || 1,
        coord: cutPoint.y,
        orientationName: 'Coronal',
        min: -125,
        max: 85
      };
    } else {
      return {
        axis: 'X',
        sign: Math.sign(n0.x) || 1,
        coord: cutPoint.x,
        orientationName: 'Sagittal',
        min: -90,
        max: 90
      };
    }
  }

  /**
   * Sets the plane depth based on the requested MNI coordinate along that plane's dominant orientation
   * @param {Object} p - Plane object
   * @param {number} coord - MNI coordinate (in mm)
   */
  setPlaneMNICoord(p, coord) {
    const n0 = p.normal0 || this.sph2cartDeg90x(p.azimuth, p.elevation, 1.0);
    const ax = Math.abs(n0.x);
    const ay = Math.abs(n0.y);
    const az = Math.abs(n0.z);

    if (az >= ax && az >= ay) {
      const denom = Math.abs(n0.z) > 1e-4 ? n0.z : -1.0;
      p.depth = (coord - this.brainCenter.z) / denom;
    } else if (ay >= ax && ay >= az) {
      const denom = Math.abs(n0.y) > 1e-4 ? n0.y : 1.0;
      p.depth = (coord - this.brainCenter.y) / denom;
    } else {
      const denom = Math.abs(n0.x) > 1e-4 ? n0.x : 1.0;
      p.depth = (coord - this.brainCenter.x) / denom;
    }
    this.update();
  }

  applyOverlayUniformsToMaterial(mat) {
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

  updateOverlayUniforms() {
    if (this.globalEnabled) {
      this.update();
    } else {
      for (const p of this.planes) {
        if (p.sliceMaterial) {
          this.applyOverlayUniformsToMaterial(p.sliceMaterial);
        }
      }
    }
  }

  setVolumeTexture(texture) {
    for (const p of this.planes) {
      if (p.sliceMaterial) {
        this.applyVolumeUniformsToMaterial(p.sliceMaterial);
        p.sliceMaterial.needsUpdate = true;
      }
    }
  }

  sph2cartDeg90x(azimuth, elevation, r = 1.0) {
    let theta = ((azimuth - 90) * Math.PI) / 180.0;
    let e = elevation;
    if (e > 360 || e < -360) {
      const n = Math.trunc(e / 360);
      e = e - n * 360;
    }
    if ((e > 89 && e < 91) || (e < -269 && e > -271)) e = 90;
    if ((e > 269 && e < 271) || (e < -89 && e > -91)) e = -90;

    const phi = (e * Math.PI) / 180.0;
    const x = r * Math.cos(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * Math.sin(theta);
    const z = r * Math.sin(phi);
    return new THREE.Vector3(x, y, z).normalize();
  }

  update() {
    if (!this.globalEnabled) {
      this.clipUniforms.uGlobalClipEnabled.value = false;
      for (let i = 0; i < 3; i++) {
        this.clipUniforms.uClipActive.value[i] = false;
        this.clipUniforms.uClipNegative.value[i] = false;
      }
      this.meshManager.updateClippingPlanes([], this.clipUniforms);
      for (const p of this.planes) {
        if (p.sliceQuad) p.sliceQuad.visible = false;
        if (p.helper) p.helper.visible = false;
      }
      for (const cb of this.updateCallbacks) {
        try {
          cb();
        } catch (err) {
          console.error('Clipping update callback error:', err);
        }
      }
      return;
    }


    this.clipUniforms.uGlobalClipEnabled.value = true;

    // 1. Collect all enabled Three.js planes and populate clipUniforms
    const activePlanes = [];
    for (let i = 0; i < this.planes.length; i++) {
      const p = this.planes[i];
      const n0 = this.sph2cartDeg90x(p.azimuth, p.elevation, 1.0);
      p.normal0 = n0.clone();
      const n = p.inverted ? n0.clone().negate() : n0.clone();
      p.normal.copy(n);

      // cutPoint is based on original unnegated normal n0 so plane stays in physical position
      const cutPoint = this.brainCenter.clone().add(n0.clone().multiplyScalar(p.depth));
      p.constant = -n.dot(cutPoint);
      p.threePlane.set(n, p.constant);

      if (p.enabled) {
        activePlanes.push(p.threePlane);

        this.clipUniforms.uClipActive.value[i] = true;
        this.clipUniforms.uClipNormal.value[i].copy(n);
        this.clipUniforms.uClipConstant.value[i] = p.constant;
        this.clipUniforms.uClipNegative.value[i] = !!p.negative;
      } else {
        this.clipUniforms.uClipActive.value[i] = false;
        this.clipUniforms.uClipNegative.value[i] = false;
      }
    }

    // 2. Update all meshes with the array of active clipping planes and clipUniforms
    this.meshManager.updateClippingPlanes(activePlanes, this.clipUniforms);

    // 3. Update each slice quad and plane box helper
    const defaultNormal = new THREE.Vector3(0, 0, 1);

    for (let i = 0; i < this.planes.length; i++) {
      const p = this.planes[i];
      if (p.enabled) {
        const n0 = p.normal0 || this.sph2cartDeg90x(p.azimuth, p.elevation, 1.0);
        const n = p.normal;
        const cutPoint = this.brainCenter.clone().add(n0.clone().multiplyScalar(p.depth));
        const quadPos = cutPoint.clone().add(n.clone().multiplyScalar(0.05));
        const quadQuat = new THREE.Quaternion().setFromUnitVectors(defaultNormal, n);

        // Helper box: visible whenever showHelper is enabled, EVEN IF slice rendering is off!
        if (p.helper) {
          p.helper.position.copy(quadPos);
          p.helper.quaternion.copy(quadQuat);
          p.helper.visible = Boolean(p.showHelper);
        }

        // Volumetric slice quad: visible only when sliceVisible is enabled
        if (p.sliceQuad) {
          p.sliceQuad.position.copy(quadPos);
          p.sliceQuad.quaternion.copy(quadQuat);
          p.sliceQuad.visible = Boolean(this.sliceVisible);

          if (this.sliceVisible) {
            // Update uniforms
            const u = p.sliceMaterial.uniforms;
            u.uPlaneIndex.value = i;
            u.uPlaneNormal.value.copy(n);
            u.uWindowMin.value = this.windowMin;
            u.uWindowMax.value = this.windowMax;
            u.uColormap.value = this.colormap;
            u.uOpacity.value = this.sliceOpacity;
            u.uSlabThickness.value = this.slabThickness;
            u.uSlabMode.value = this.slabMode;

            // Mask & Overlay updates
            this.applyMaskUniformsToMaterial(p.sliceMaterial);
            this.applyOverlayUniformsToMaterial(p.sliceMaterial);
          }
        }
      } else {
        if (p.sliceQuad) p.sliceQuad.visible = false;
        if (p.helper) p.helper.visible = false;
      }
    }

    // 4. Notify registered listeners (e.g. Multiplanar Slice Viewer)
    for (const cb of this.updateCallbacks) {
      try {
        cb();
      } catch (err) {
        console.error('Clipping update callback error:', err);
      }
    }
  }

  onUpdate(cb) {
    if (typeof cb === 'function') {
      this.updateCallbacks.push(cb);
    }
  }

  // Reset clipping planes to default axial/coronal/sagittal orientations
  resetClippingPlanes() {
    this.globalEnabled = true;

    this.planes[0].enabled = true;
    this.planes[0].azimuth = 0;
    this.planes[0].elevation = -90;
    this.planes[0].depth = 0;
    this.planes[0].inverted = false;
    this.planes[0].negative = true;
    this.planes[0].showHelper = true;

    this.planes[1].enabled = false;
    this.planes[1].azimuth = 180;
    this.planes[1].elevation = 0;
    this.planes[1].depth = 0;
    this.planes[1].inverted = true;
    this.planes[1].negative = true;
    this.planes[1].showHelper = true;

    this.planes[2].enabled = false;
    this.planes[2].azimuth = 90;
    this.planes[2].elevation = 0;
    this.planes[2].depth = 0;
    this.planes[2].inverted = false;
    this.planes[2].negative = true;
    this.planes[2].showHelper = true;

    this.update();
  }

  // Multi-plane preset setups
  setPreset(presetName) {
    this.globalEnabled = true;

    // Reset negative and showHelper flags to true by default
    for (const p of this.planes) {
      p.negative = true;
      p.showHelper = true;
    }

    switch (presetName) {
      case 'single_axial':
        this.planes[0].enabled = true;
        this.planes[0].azimuth = 0;
        this.planes[0].elevation = -90;
        this.planes[0].depth = 0;
        this.planes[0].inverted = false;
        this.planes[1].enabled = false;
        this.planes[2].enabled = false;
        break;
      case 'single_coronal':
        this.planes[0].enabled = true;
        this.planes[0].azimuth = 180;
        this.planes[0].elevation = 0;
        this.planes[0].depth = 0;
        this.planes[0].inverted = false;
        this.planes[1].enabled = false;
        this.planes[2].enabled = false;
        break;
      case 'single_sagittal':
        this.planes[0].enabled = true;
        this.planes[0].azimuth = 90;
        this.planes[0].elevation = 0;
        this.planes[0].depth = 0;
        this.planes[0].inverted = false;
        this.planes[1].enabled = false;
        this.planes[2].enabled = false;
        break;
      case 'dual_quadrant':
        // Axial + Coronal quadrant cut (classic neurosurgery cut-away: 1 quadrant kept)
        this.planes[0].enabled = true;
        this.planes[0].azimuth = 0;
        this.planes[0].elevation = -90; // Axial cut
        this.planes[0].depth = 0;
        this.planes[0].inverted = false;

        this.planes[1].enabled = true;
        this.planes[1].azimuth = 180;
        this.planes[1].elevation = 0; // Coronal cut
        this.planes[1].depth = 0;
        this.planes[1].inverted = true;

        this.planes[2].enabled = false;
        break;
      case 'dual_negative':
        // Negative Multi-Plane Cut: Intersects discard regions (3 quadrants kept, 1 corner removed)
        this.planes[0].enabled = true;
        this.planes[0].azimuth = 0;
        this.planes[0].elevation = -90;
        this.planes[0].depth = 0;
        this.planes[0].inverted = false;
        this.planes[0].negative = false;

        this.planes[1].enabled = true;
        this.planes[1].azimuth = 180;
        this.planes[1].elevation = 0;
        this.planes[1].depth = 0;
        this.planes[1].inverted = true;
        this.planes[1].negative = true; // Negative intersection mode!

        this.planes[2].enabled = false;
        break;
      case 'tri_planar':
        // Tri-planar corner cut: Axial + Coronal + Sagittal
        this.planes[0].enabled = true;
        this.planes[0].azimuth = 0;
        this.planes[0].elevation = -90; // Axial
        this.planes[0].depth = 0;
        this.planes[0].inverted = false;

        this.planes[1].enabled = true;
        this.planes[1].azimuth = 180;
        this.planes[1].elevation = 0; // Coronal
        this.planes[1].depth = 0;
        this.planes[1].inverted = false;

        this.planes[2].enabled = true;
        this.planes[2].azimuth = 90;
        this.planes[2].elevation = 0; // Sagittal
        this.planes[2].depth = 0;
        this.planes[2].inverted = false;
        break;
      case 'oblique_wedge':
        // 45 deg oblique + axial
        this.planes[0].enabled = true;
        this.planes[0].azimuth = 45;
        this.planes[0].elevation = 30;
        this.planes[0].depth = 5;
        this.planes[0].inverted = false;

        this.planes[1].enabled = true;
        this.planes[1].azimuth = 270;
        this.planes[1].elevation = 0;
        this.planes[1].depth = 0;
        this.planes[1].inverted = false;

        this.planes[2].enabled = false;
        break;
    }

    this.update();
  }

  getEquationString() {
    const active = this.planes.filter((p) => p.enabled);
    if (active.length === 0) return 'Disabled';
    return active.map((p) => {
      const neg = p.negative ? ' [NEG]' : '';
      return `P${p.id}${neg}: ${p.normal.x.toFixed(2)}X+${p.normal.y.toFixed(2)}Y+${p.normal.z.toFixed(2)}Z+${p.constant.toFixed(0)}=0`;
    }).join(' | ');
  }
}
