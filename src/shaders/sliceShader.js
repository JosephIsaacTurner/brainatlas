import * as THREE from 'three';

/**
 * Oblique Volumetric Slice Shader
 * 
 * Synchronously samples the 3D T1w NIfTI volume at arbitrary oblique cut planes.
 * Features:
 * - Multi-plane clipping support (so intersecting slices clip cleanly against each other)
 * - NIfTI / Nii.gz functional / statistical / atlas overlay support with independent opacity, colormap, and thresholds
 * - High-precision continuous MNI world-to-voxel coordinates
 * - Trilinear hardware sampling
 */

export const SliceShader = {
  uniforms: {
    // Base Anatomical Volume (T1w / T2w / MNI152 / Substructure)
    uVolume: { value: null }, // sampler3D
    uWorldToVolumeTex: { value: new THREE.Matrix4() },
    uOrigin: { value: new THREE.Vector3(-90.0, -126.0, -72.0) },
    uSize: { value: new THREE.Vector3(181.0, 217.0, 181.0) },
    uWindowMin: { value: 0.05 },
    uWindowMax: { value: 0.70 },
    uOpacity: { value: 1.0 },
    uColormap: { value: 0 }, // 0=Gray, 1=Bone, 2=Hot, 3=Cool, 4=Rainbow, 5=Velvet
    uMaskBackground: { value: true },
    uMaskMode: { value: 1 }, // 0=None, 1=Active Mask Volume
    uMaskVolume: { value: null }, // sampler3D
    uWorldToMaskTex: { value: new THREE.Matrix4() },
    uMaskThreshold: { value: 0.5 },
    uThreshold: { value: 0.001 },
    uPlaneNormal: { value: new THREE.Vector3(0, 1, 0) },

    // Optional 3D Slab Thickness
    uSlabMode: { value: 0 }, // 0=Single Slice (Cap), 1=MIP, 2=Average
    uSlabThickness: { value: 0.0 },
    uSlabSamples: { value: 8 },

    // Overlay Volume (.nii / .nii.gz)
    uHasOverlay: { value: false },
    uOverlayVolume: { value: null }, // sampler3D
    uOverlayContourVolume: { value: null }, // sampler3D (LinearFilter)
    uWorldToOverlayTex: { value: new THREE.Matrix4() },
    uHasPosOverlay: { value: true },
    uPosColormap: { value: 17 }, // Default: Red-Yellow (17)
    uPosMin: { value: 1.0 },
    uPosMax: { value: 5.0 },
    uPosOpacity: { value: 0.85 },
    uHasNegOverlay: { value: false },
    uNegColormap: { value: 18 }, // Default: Winters (18)
    uNegMin: { value: -1.0 },
    uNegMax: { value: -5.0 },
    uNegOpacity: { value: 0.85 },
    uOverlayMin: { value: 0.02 },
    uOverlayMax: { value: 1.0 },
    uOverlayOpacity: { value: 0.85 },
    uOverlayColormap: { value: 0 },

    // Threshold-based Contouring
    uShowContour: { value: false },
    uContourPosThresh: { value: 2.0 },
    uContourNegThresh: { value: -2.0 },
    uContourPosActive: { value: false },
    uContourNegActive: { value: false },
    uContourPosEnabled: { value: false },
    uContourNegEnabled: { value: false },
    uContourPosColor: { value: new THREE.Vector3(0.98, 0.8, 0.08) }, // Neon Yellow
    uContourNegColor: { value: new THREE.Vector3(0.22, 0.74, 0.97) }, // Neon Cyan
    uContourWidth: { value: 2.0 },

    // Multi-Overlay Support (up to 4 simultaneous volumetric overlays)
    uNumOverlays: { value: 0 },
    uMultiOverlayActive: { value: [false, false, false, false] },
    uMultiOverlayVolume: { value: [null, null, null, null] },
    uMultiOverlayContourVolume: { value: [null, null, null, null] },
    uMultiWorldToOverlayTex: { value: [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()] },
    uMultiOverlayHasPos: { value: [false, false, false, false] },
    uMultiOverlayPosColormap: { value: [17, 17, 17, 17] },
    uMultiOverlayPosMin: { value: [1.0, 1.0, 1.0, 1.0] },
    uMultiOverlayPosMax: { value: [5.0, 5.0, 5.0, 5.0] },
    uMultiOverlayPosOpacity: { value: [0.85, 0.85, 0.85, 0.85] },
    uMultiOverlayHasNeg: { value: [false, false, false, false] },
    uMultiOverlayNegColormap: { value: [18, 18, 18, 18] },
    uMultiOverlayNegMin: { value: [-1.0, -1.0, -1.0, -1.0] },
    uMultiOverlayNegMax: { value: [-5.0, -5.0, -5.0, -5.0] },
    uMultiOverlayNegOpacity: { value: [0.85, 0.85, 0.85, 0.85] },
    uMultiOverlayShowContour: { value: [false, false, false, false] },
    uMultiOverlayContourPosActive: { value: [false, false, false, false] },
    uMultiOverlayContourPosThresh: { value: [2.0, 2.0, 2.0, 2.0] },
    uMultiOverlayContourPosColor: { value: [new THREE.Vector3(0.98, 0.8, 0.08), new THREE.Vector3(0.98, 0.8, 0.08), new THREE.Vector3(0.98, 0.8, 0.08), new THREE.Vector3(0.98, 0.8, 0.08)] },
    uMultiOverlayContourNegActive: { value: [false, false, false, false] },
    uMultiOverlayContourNegThresh: { value: [-2.0, -2.0, -2.0, -2.0] },
    uMultiOverlayContourNegColor: { value: [new THREE.Vector3(0.22, 0.74, 0.97), new THREE.Vector3(0.22, 0.74, 0.97), new THREE.Vector3(0.22, 0.74, 0.97), new THREE.Vector3(0.22, 0.74, 0.97)] },
    uMultiOverlayContourWidth: { value: [2.0, 2.0, 2.0, 2.0] },

    // Multi-Plane & Negative Clipping
    uGlobalClipEnabled: { value: false },
    uClipActive: { value: [false, false, false] },
    uClipNormal: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)] },
    uClipConstant: { value: [0, 0, 0] },
    uClipNegative: { value: [false, false, false] },
    uPlaneIndex: { value: 0 }
  },

  vertexShader: /* glsl */ `
    #include <common>
    #include <clipping_planes_pars_vertex>

    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      #include <begin_vertex>
      #include <project_vertex>
      #include <clipping_planes_vertex>

      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;
    precision highp sampler3D;

    #include <clipping_planes_pars_fragment>

    // Base volume uniforms
    uniform sampler3D uVolume;
    uniform mat4 uWorldToVolumeTex;
    uniform vec3 uOrigin;
    uniform vec3 uSize;
    uniform float uWindowMin;
    uniform float uWindowMax;
    uniform float uOpacity;
    uniform int uColormap;
    uniform bool uMaskBackground;
    uniform int uMaskMode;
    uniform sampler3D uMaskVolume;
    uniform mat4 uWorldToMaskTex;
    uniform float uMaskThreshold;
    uniform float uThreshold;
    uniform vec3 uPlaneNormal;
    uniform int uSlabMode;
    uniform float uSlabThickness;
    uniform int uSlabSamples;

    // Overlay volume uniforms (Single overlay backward compatibility)
    uniform bool uHasOverlay;
    uniform sampler3D uOverlayVolume;
    uniform sampler3D uOverlayContourVolume;
    uniform mat4 uWorldToOverlayTex;
    uniform bool uHasPosOverlay;
    uniform int uPosColormap;
    uniform float uPosMin;
    uniform float uPosMax;
    uniform float uPosOpacity;
    uniform bool uHasNegOverlay;
    uniform int uNegColormap;
    uniform float uNegMin;
    uniform float uNegMax;
    uniform float uNegOpacity;
    uniform float uOverlayMin;
    uniform float uOverlayMax;
    uniform float uOverlayOpacity;
    uniform int uOverlayColormap;

    // Threshold-based Contouring uniforms (Single overlay)
    uniform bool uShowContour;
    uniform float uContourPosThresh;
    uniform float uContourNegThresh;
    uniform bool uContourPosActive;
    uniform bool uContourNegActive;
    uniform bool uContourPosEnabled;
    uniform bool uContourNegEnabled;
    uniform vec3 uContourPosColor;
    uniform vec3 uContourNegColor;
    uniform float uContourWidth;

    // Multi-overlay uniforms (up to 4 overlays)
    #define MAX_OVERLAYS 4
    uniform int uNumOverlays;
    uniform bool uMultiOverlayActive[MAX_OVERLAYS];
    uniform sampler3D uMultiOverlayVolume[MAX_OVERLAYS];
    uniform sampler3D uMultiOverlayContourVolume[MAX_OVERLAYS];
    uniform mat4 uMultiWorldToOverlayTex[MAX_OVERLAYS];
    uniform bool uMultiOverlayHasPos[MAX_OVERLAYS];
    uniform int uMultiOverlayPosColormap[MAX_OVERLAYS];
    uniform float uMultiOverlayPosMin[MAX_OVERLAYS];
    uniform float uMultiOverlayPosMax[MAX_OVERLAYS];
    uniform float uMultiOverlayPosOpacity[MAX_OVERLAYS];
    uniform bool uMultiOverlayHasNeg[MAX_OVERLAYS];
    uniform int uMultiOverlayNegColormap[MAX_OVERLAYS];
    uniform float uMultiOverlayNegMin[MAX_OVERLAYS];
    uniform float uMultiOverlayNegMax[MAX_OVERLAYS];
    uniform float uMultiOverlayNegOpacity[MAX_OVERLAYS];
    uniform bool uMultiOverlayShowContour[MAX_OVERLAYS];
    uniform bool uMultiOverlayContourPosActive[MAX_OVERLAYS];
    uniform float uMultiOverlayContourPosThresh[MAX_OVERLAYS];
    uniform vec3 uMultiOverlayContourPosColor[MAX_OVERLAYS];
    uniform bool uMultiOverlayContourNegActive[MAX_OVERLAYS];
    uniform float uMultiOverlayContourNegThresh[MAX_OVERLAYS];
    uniform vec3 uMultiOverlayContourNegColor[MAX_OVERLAYS];
    uniform float uMultiOverlayContourWidth[MAX_OVERLAYS];

    // Multi-plane clipping uniforms
    uniform bool uGlobalClipEnabled;
    uniform bool uClipActive[3];
    uniform vec3 uClipNormal[3];
    uniform float uClipConstant[3];
    uniform bool uClipNegative[3];
    uniform int uPlaneIndex;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    bool evalClipSliceDiscard(vec3 worldPos, int quadIdx) {
      if (!uGlobalClipEnabled) return false;

      // Evaluate D_in (with plane quadIdx set to discard = true)
      bool hasNormalIn = false;
      bool normalDiscardIn = false;
      bool hasNegativeIn = false;
      bool negativeDiscardIn = true;

      // Evaluate D_out (with plane quadIdx set to discard = false)
      bool hasNormalOut = false;
      bool normalDiscardOut = false;
      bool hasNegativeOut = false;
      bool negativeDiscardOut = true;

      for (int i = 0; i < 3; i++) {
        if (uClipActive[i]) {
          float dist = dot(worldPos, uClipNormal[i]) + uClipConstant[i];
          bool d_raw = (dist < 0.0);
          bool d_in = (i == quadIdx) ? true : d_raw;
          bool d_out = (i == quadIdx) ? false : d_raw;

          if (uClipNegative[i]) {
            hasNegativeIn = true;
            negativeDiscardIn = negativeDiscardIn && d_in;

            hasNegativeOut = true;
            negativeDiscardOut = negativeDiscardOut && d_out;
          } else {
            hasNormalIn = true;
            normalDiscardIn = normalDiscardIn || d_in;

            hasNormalOut = true;
            normalDiscardOut = normalDiscardOut || d_out;
          }
        }
      }

      bool dInFinal = false;
      if (hasNormalIn && hasNegativeIn) dInFinal = normalDiscardIn && negativeDiscardIn;
      else if (hasNormalIn) dInFinal = normalDiscardIn;
      else if (hasNegativeIn) dInFinal = negativeDiscardIn;

      bool dOutFinal = false;
      if (hasNormalOut && hasNegativeOut) dOutFinal = normalDiscardOut && negativeDiscardOut;
      else if (hasNormalOut) dOutFinal = normalDiscardOut;
      else if (hasNegativeOut) dOutFinal = negativeDiscardOut;

      bool keepQuad = dInFinal && (!dOutFinal);
      return !keepQuad;
    }

    // Base colormaps
    vec3 colormapGray(float t) {
      return vec3(t);
    }

    vec3 colormapBone(float t) {
      return vec3(
        t < 0.75 ? (7.0 * t) / 8.0 : (3.0 * t + 1.0) / 4.0,
        t < 0.375 ? (7.0 * t) / 8.0 : (t < 0.75 ? (29.0 * t - 3.0) / 24.0 : (7.0 * t + 5.0) / 12.0),
        t < 0.375 ? (29.0 * t) / 24.0 : (t < 0.75 ? (7.0 * t + 1.0) / 8.0 : (3.0 * t + 1.0) / 4.0)
      );
    }

    vec3 colormapHot(float t) {
      return vec3(
        smoothstep(0.0, 0.35, t),
        smoothstep(0.35, 0.75, t),
        smoothstep(0.75, 1.0, t)
      );
    }

    vec3 colormapCool(float t) {
      return vec3(t, 1.0 - t, 1.0);
    }

    vec3 colormapRainbow(float t) {
      float r = clamp(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0);
      float g = clamp(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0);
      float b = clamp(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0);
      return vec3(r, g, b);
    }

    vec3 colormapVelvet(float t) {
      vec3 c0 = vec3(0.12, 0.04, 0.18);
      vec3 c1 = vec3(0.58, 0.08, 0.24);
      vec3 c2 = vec3(0.88, 0.42, 0.22);
      vec3 c3 = vec3(0.98, 0.86, 0.62);

      if (t < 0.33) return mix(c0, c1, t / 0.33);
      if (t < 0.66) return mix(c1, c2, (t - 0.33) / 0.33);
      return mix(c2, c3, (t - 0.66) / 0.34);
    }

    vec3 colormapAtlas(float t) {
      float h = fract(t * 13.3719 + 0.15);
      float s = 0.85 + 0.15 * sin(t * 37.0);
      float v = 0.85 + 0.15 * cos(t * 29.0);
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
      return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);
    }

    vec3 applyColormap(float t, int cmap) {
      t = clamp(t, 0.0, 1.0);
      if (cmap == 1) return colormapBone(t);
      if (cmap == 2) return colormapHot(t);
      if (cmap == 3) return colormapCool(t);
      if (cmap == 4) return colormapRainbow(t);
      if (cmap == 5) return colormapVelvet(t);
      if (cmap == 6) return colormapAtlas(t);
      return colormapGray(t);
    }

    // Perceptually uniform standard scientific colormaps
    vec3 colormapViridis(float t) {
      const vec3 c0 = vec3(0.277727, 0.005407, 0.334099);
      const vec3 c1 = vec3(0.105071, 1.404614, 1.384590);
      const vec3 c2 = vec3(-0.330862, 0.214848, 0.095095);
      const vec3 c3 = vec3(-4.634230, -5.799121, -19.332441);
      const vec3 c4 = vec3(6.228270, 14.179933, 56.690553);
      const vec3 c5 = vec3(4.776385, -13.745145, -65.353033);
      const vec3 c6 = vec3(-5.435456, 4.645853, 26.312435);
      return clamp(c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6))))), 0.0, 1.0);
    }

    vec3 colormapMagma(float t) {
      const vec3 c0 = vec3(-0.002136, -0.000743, -0.005386);
      const vec3 c1 = vec3(0.251660, 0.677523, 2.494026);
      const vec3 c2 = vec3(8.353718, -3.577719, 0.314467);
      const vec3 c3 = vec3(-27.668733, 14.264730, -13.649213);
      const vec3 c4 = vec3(52.176139, -27.943191, 12.944169);
      const vec3 c5 = vec3(-50.768525, 29.046582, 4.234150);
      const vec3 c6 = vec3(18.655705, -11.489773, -5.601961);
      return clamp(c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6))))), 0.0, 1.0);
    }

    vec3 colormapInferno(float t) {
      const vec3 c0 = vec3(0.000219, 0.000424, -0.000372);
      const vec3 c1 = vec3(0.248082, 0.677156, 0.536712);
      const vec3 c2 = vec3(8.040553, -3.881721, -3.459868);
      const vec3 c3 = vec3(-24.107275, 17.658680, 17.135705);
      const vec3 c4 = vec3(44.383160, -35.247498, -27.854771);
      const vec3 c5 = vec3(-42.820701, 35.602555, 19.470501);
      const vec3 c6 = vec3(15.296155, -14.197972, -4.820416);
      return clamp(c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6))))), 0.0, 1.0);
    }

    vec3 colormapPlasma(float t) {
      const vec3 c0 = vec3(0.058732, 0.023336, 0.543340);
      const vec3 c1 = vec3(2.176514, 0.238383, 0.753960);
      const vec3 c2 = vec3(-2.689460, -0.454538, -8.298585);
      const vec3 c3 = vec3(6.130348, 3.660144, 21.054062);
      const vec3 c4 = vec3(-11.107771, -8.513681, -23.575881);
      const vec3 c5 = vec3(10.023065, 8.526941, 12.624386);
      const vec3 c6 = vec3(-3.606741, -2.485860, -2.100078);
      return clamp(c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6))))), 0.0, 1.0);
    }

    vec3 colormapCividis(float t) {
      const vec3 c0 = vec3(0.000000, 0.135112, 0.304751);
      const vec3 c1 = vec3(0.245037, 0.287870, 0.258674);
      const vec3 c2 = vec3(-0.063069, 0.449764, -0.061989);
      const vec3 c3 = vec3(0.536109, -0.082531, -0.278786);
      const vec3 c4 = vec3(0.269165, 0.210411, 0.050302);
      return clamp(c0 + t * (c1 + t * (c2 + t * (c3 + t * c4))), 0.0, 1.0);
    }

    vec3 colormapTurbo(float t) {
      const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
      const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
      const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
      const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
      const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
      const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);
      vec4 v4 = vec4(1.0, t, t * t, t * t * t);
      vec2 v2 = v4.zw * v4.z;
      return clamp(vec3(
        dot(v4, kRedVec4) + dot(v2, kRedVec2),
        dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
        dot(v4, kBlueVec4) + dot(v2, kBlueVec2)
      ), 0.0, 1.0);
    }

    vec3 colormapCoolWarm(float t) {
      vec3 c0 = vec3(0.23, 0.30, 0.75);
      vec3 c1 = vec3(0.86, 0.86, 0.86);
      vec3 c2 = vec3(0.70, 0.015, 0.15);
      if (t < 0.5) return mix(c0, c1, t * 2.0);
      return mix(c1, c2, (t - 0.5) * 2.0);
    }

    // Specialized statistical overlay colormaps
    vec3 applyOverlayColormap(float t, int cmap) {
      t = clamp(t, 0.0, 1.0);
      if (cmap == 0) {
        // Hot Spectrum: Red -> Orange -> Yellow -> White
        if (t < 0.5) {
          return mix(vec3(0.92, 0.08, 0.0), vec3(1.0, 0.82, 0.0), t / 0.5);
        } else {
          return mix(vec3(1.0, 0.82, 0.0), vec3(1.0, 1.0, 1.0), (t - 0.5) / 0.5);
        }
      }
      if (cmap == 1) {
        // Rainbow / Jet: Royal Blue -> Cyan -> Green -> Yellow -> Red
        float r = clamp(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0);
        float g = clamp(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0);
        float b = clamp(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0);
        return vec3(r, g, b);
      }
      if (cmap == 2) {
        // Cool: Electric Cyan -> Sky -> Bright Magenta
        return mix(vec3(0.0, 0.85, 1.0), vec3(1.0, 0.15, 0.95), t);
      }
      if (cmap == 3) {
        // Emerald Green: Deep Emerald -> Lime -> Brilliant Mint
        return mix(vec3(0.0, 0.7, 0.2), vec3(0.4, 1.0, 0.75), t);
      }
      if (cmap == 4) {
        // Electric Red: Crimson -> Bright Coral -> Neon Amber
        return mix(vec3(0.9, 0.0, 0.1), vec3(1.0, 0.6, 0.15), t);
      }
      if (cmap == 5) {
        // Electric Blue: Rich Blue -> Cyan -> White-Cyan
        return mix(vec3(0.05, 0.35, 1.0), vec3(0.35, 0.95, 1.0), t);
      }
      if (cmap == 6) {
        // Violet / Magenta: Royal Purple -> Neon Fuchsia -> Pastel Rose
        return mix(vec3(0.55, 0.0, 0.9), vec3(1.0, 0.35, 0.95), t);
      }
      if (cmap == 7) {
        // Plain Flat Red
        return vec3(1.0, 0.05, 0.05);
      }
      if (cmap == 8) {
        // Plain Flat Blue
        return vec3(0.05, 0.35, 1.0);
      }
      if (cmap == 9) {
        // Plain Flat Green
        return vec3(0.05, 0.85, 0.15);
      }
      if (cmap == 10) return colormapViridis(t);
      if (cmap == 11) return colormapMagma(t);
      if (cmap == 12) return colormapInferno(t);
      if (cmap == 13) return colormapPlasma(t);
      if (cmap == 14) return colormapCividis(t);
      if (cmap == 15) return colormapTurbo(t);
      if (cmap == 16) return colormapCoolWarm(t);
      if (cmap == 17) {
        // Red-Yellow: Classic positive fMRI activation
        return mix(vec3(0.95, 0.05, 0.0), vec3(1.0, 0.95, 0.05), t);
      }
      if (cmap == 18) {
        // Winters: Classic negative fMRI activation (Deep Blue to Brilliant Cyan/Green)
        return mix(vec3(0.0, 0.15, 0.95), vec3(0.0, 0.95, 0.65), t);
      }
      if (cmap == 19) {
        // Grayscale
        return vec3(t);
      }
      if (cmap == 20) {
        // ACTC: Surf Ice ACTC lookup table
        float n1 = 64.0 / 255.0;
        float n2 = 128.0 / 255.0;
        float n3 = 156.0 / 255.0;
        if (t <= n1) {
          return mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 136.0 / 255.0), t / n1);
        } else if (t <= n2) {
          return mix(vec3(0.0, 0.0, 136.0 / 255.0), vec3(24.0 / 255.0, 177.0 / 255.0, 0.0), (t - n1) / (n2 - n1));
        } else if (t <= n3) {
          return mix(vec3(24.0 / 255.0, 177.0 / 255.0, 0.0), vec3(248.0 / 255.0, 254.0 / 255.0, 0.0), (t - n2) / (n3 - n2));
        } else {
          return mix(vec3(248.0 / 255.0, 254.0 / 255.0, 0.0), vec3(1.0, 0.0, 0.0), (t - n3) / (1.0 - n3));
        }
      }
      return vec3(0.92, 0.08, 0.0);
    }

    float sampleVolumeAtWorld(vec3 worldPos) {
      vec4 texCoord = uWorldToVolumeTex * vec4(worldPos, 1.0);
      vec3 uvw = texCoord.xyz;
      if (uvw.x < 0.0 || uvw.x > 1.0 ||
          uvw.y < 0.0 || uvw.y > 1.0 ||
          uvw.z < 0.0 || uvw.z > 1.0) {
        return 0.0;
      }
      return texture(uVolume, uvw).r;
    }

    bool sampleOverlayLayer(
      sampler3D ovTex,
      mat4 worldToTex,
      vec3 worldPos,
      bool hasPos,
      int posCmap,
      float posMin,
      float posMax,
      float posOpacity,
      bool hasNeg,
      int negCmap,
      float negMin,
      float negMax,
      float negOpacity,
      out vec3 outColor,
      out float outAlpha
    ) {
      vec4 ovTexCoord = worldToTex * vec4(worldPos, 1.0);
      vec3 ovUvw = ovTexCoord.xyz;
      if (ovUvw.x < 0.0 || ovUvw.x > 1.0 ||
          ovUvw.y < 0.0 || ovUvw.y > 1.0 ||
          ovUvw.z < 0.0 || ovUvw.z > 1.0) {
        return false;
      }
      float ovRaw = texture(ovTex, ovUvw).r;

      // Positive activation
      if (hasPos && ovRaw > 0.0001) {
        if (ovRaw >= posMin) {
          float normVal = clamp((ovRaw - posMin) / max(0.0001, posMax - posMin), 0.0, 1.0);
          outColor = applyOverlayColormap(normVal, posCmap);
          outAlpha = posOpacity;
          return true;
        }
      }
      // Negative activation
      else if (hasNeg && ovRaw < -0.0001) {
        float rawMag = abs(ovRaw);
        float cutoffMag = min(abs(negMin), abs(negMax));
        float peakMag = max(abs(negMin), abs(negMax));
        if (rawMag >= cutoffMag) {
          float normVal = clamp((rawMag - cutoffMag) / max(0.0001, peakMag - cutoffMag), 0.0, 1.0);
          outColor = applyOverlayColormap(normVal, negCmap);
          outAlpha = negOpacity;
          return true;
        }
      }
      return false;
    }

    vec3 applyContourLine(
      vec3 inColor,
      vec3 worldPos,
      vec3 uvwBase,
      sampler3D contourTex,
      mat4 worldToTex,
      bool posOn,
      float posThresh,
      vec3 posColor,
      bool negOn,
      float negThresh,
      vec3 negColor,
      float contourWidth
    ) {
      if (!posOn && !negOn) return inColor;

      // Guard against background volume slice border artifacts when not masked
      if (uvwBase.x < 0.005 || uvwBase.x > 0.995 ||
          uvwBase.y < 0.005 || uvwBase.y > 0.995 ||
          uvwBase.z < 0.005 || uvwBase.z > 0.995) {
        return inColor;
      }

      vec4 ovCoord = worldToTex * vec4(worldPos, 1.0);
      vec3 ovUvw = ovCoord.xyz;
      // Guard against overlay boundary artifacts
      if (ovUvw.x < 0.005 || ovUvw.x > 0.995 ||
          ovUvw.y < 0.005 || ovUvw.y > 0.995 ||
          ovUvw.z < 0.005 || ovUvw.z > 0.995) {
        return inColor;
      }

      // Sample from the linearly filtered texture to avoid checkerboard
      float ovRaw = texture(contourTex, ovUvw).r;
      float grad = fwidth(ovRaw);
      if (grad < 1e-6 || grad > 25.0) return inColor;

      vec3 resColor = inColor;

      // Positive contour: value must be strictly positive and near threshold
      if (posOn && ovRaw > 0.0001) {
        float diffPos = abs(ovRaw - posThresh);
        float dPos = diffPos / grad;
        if (dPos < contourWidth && diffPos < 3.0 * grad) {
          float edge = 1.0 - smoothstep(max(0.0, contourWidth - 1.0), contourWidth, dPos);
          resColor = mix(resColor, posColor, edge * 0.95);
        }
      }

      // Negative contour: value must be strictly negative and near threshold
      if (negOn && ovRaw < -0.0001) {
        float diffNeg = abs(ovRaw - negThresh);
        float dNeg = diffNeg / grad;
        if (dNeg < contourWidth && diffNeg < 3.0 * grad) {
          float edge = 1.0 - smoothstep(max(0.0, contourWidth - 1.0), contourWidth, dNeg);
          resColor = mix(resColor, negColor, edge * 0.95);
        }
      }

      return resColor;
    }

    vec3 applyAllOverlays(vec3 inColor, vec3 worldPos, vec3 uvwBase) {
      vec3 color = inColor;
      if (uNumOverlays > 0) {
        if (uMultiOverlayActive[0]) {
          vec3 ovCol = vec3(0.0);
          float ovA = 0.0;
          if (sampleOverlayLayer(
            uMultiOverlayVolume[0], uMultiWorldToOverlayTex[0], worldPos,
            uMultiOverlayHasPos[0], uMultiOverlayPosColormap[0], uMultiOverlayPosMin[0], uMultiOverlayPosMax[0], uMultiOverlayPosOpacity[0],
            uMultiOverlayHasNeg[0], uMultiOverlayNegColormap[0], uMultiOverlayNegMin[0], uMultiOverlayNegMax[0], uMultiOverlayNegOpacity[0],
            ovCol, ovA
          )) {
            color = mix(color, ovCol, ovA);
          }
          bool pOn = uMultiOverlayContourPosActive[0] || (uMultiOverlayShowContour[0] && uMultiOverlayContourPosActive[0]);
          bool nOn = uMultiOverlayContourNegActive[0] || (uMultiOverlayShowContour[0] && uMultiOverlayContourNegActive[0]);
          color = applyContourLine(
            color, worldPos, uvwBase, uMultiOverlayContourVolume[0], uMultiWorldToOverlayTex[0],
            pOn, uMultiOverlayContourPosThresh[0], uMultiOverlayContourPosColor[0],
            nOn, uMultiOverlayContourNegThresh[0], uMultiOverlayContourNegColor[0],
            uMultiOverlayContourWidth[0]
          );
        }
        if (uMultiOverlayActive[1]) {
          vec3 ovCol = vec3(0.0);
          float ovA = 0.0;
          if (sampleOverlayLayer(
            uMultiOverlayVolume[1], uMultiWorldToOverlayTex[1], worldPos,
            uMultiOverlayHasPos[1], uMultiOverlayPosColormap[1], uMultiOverlayPosMin[1], uMultiOverlayPosMax[1], uMultiOverlayPosOpacity[1],
            uMultiOverlayHasNeg[1], uMultiOverlayNegColormap[1], uMultiOverlayNegMin[1], uMultiOverlayNegMax[1], uMultiOverlayNegOpacity[1],
            ovCol, ovA
          )) {
            color = mix(color, ovCol, ovA);
          }
          bool pOn = uMultiOverlayContourPosActive[1] || (uMultiOverlayShowContour[1] && uMultiOverlayContourPosActive[1]);
          bool nOn = uMultiOverlayContourNegActive[1] || (uMultiOverlayShowContour[1] && uMultiOverlayContourNegActive[1]);
          color = applyContourLine(
            color, worldPos, uvwBase, uMultiOverlayContourVolume[1], uMultiWorldToOverlayTex[1],
            pOn, uMultiOverlayContourPosThresh[1], uMultiOverlayContourPosColor[1],
            nOn, uMultiOverlayContourNegThresh[1], uMultiOverlayContourNegColor[1],
            uMultiOverlayContourWidth[1]
          );
        }
        if (uMultiOverlayActive[2]) {
          vec3 ovCol = vec3(0.0);
          float ovA = 0.0;
          if (sampleOverlayLayer(
            uMultiOverlayVolume[2], uMultiWorldToOverlayTex[2], worldPos,
            uMultiOverlayHasPos[2], uMultiOverlayPosColormap[2], uMultiOverlayPosMin[2], uMultiOverlayPosMax[2], uMultiOverlayPosOpacity[2],
            uMultiOverlayHasNeg[2], uMultiOverlayNegColormap[2], uMultiOverlayNegMin[2], uMultiOverlayNegMax[2], uMultiOverlayNegOpacity[2],
            ovCol, ovA
          )) {
            color = mix(color, ovCol, ovA);
          }
          bool pOn = uMultiOverlayContourPosActive[2] || (uMultiOverlayShowContour[2] && uMultiOverlayContourPosActive[2]);
          bool nOn = uMultiOverlayContourNegActive[2] || (uMultiOverlayShowContour[2] && uMultiOverlayContourNegActive[2]);
          color = applyContourLine(
            color, worldPos, uvwBase, uMultiOverlayContourVolume[2], uMultiWorldToOverlayTex[2],
            pOn, uMultiOverlayContourPosThresh[2], uMultiOverlayContourPosColor[2],
            nOn, uMultiOverlayContourNegThresh[2], uMultiOverlayContourNegColor[2],
            uMultiOverlayContourWidth[2]
          );
        }
        if (uMultiOverlayActive[3]) {
          vec3 ovCol = vec3(0.0);
          float ovA = 0.0;
          if (sampleOverlayLayer(
            uMultiOverlayVolume[3], uMultiWorldToOverlayTex[3], worldPos,
            uMultiOverlayHasPos[3], uMultiOverlayPosColormap[3], uMultiOverlayPosMin[3], uMultiOverlayPosMax[3], uMultiOverlayPosOpacity[3],
            uMultiOverlayHasNeg[3], uMultiOverlayNegColormap[3], uMultiOverlayNegMin[3], uMultiOverlayNegMax[3], uMultiOverlayNegOpacity[3],
            ovCol, ovA
          )) {
            color = mix(color, ovCol, ovA);
          }
          bool pOn = uMultiOverlayContourPosActive[3] || (uMultiOverlayShowContour[3] && uMultiOverlayContourPosActive[3]);
          bool nOn = uMultiOverlayContourNegActive[3] || (uMultiOverlayShowContour[3] && uMultiOverlayContourNegActive[3]);
          color = applyContourLine(
            color, worldPos, uvwBase, uMultiOverlayContourVolume[3], uMultiWorldToOverlayTex[3],
            pOn, uMultiOverlayContourPosThresh[3], uMultiOverlayContourPosColor[3],
            nOn, uMultiOverlayContourNegThresh[3], uMultiOverlayContourNegColor[3],
            uMultiOverlayContourWidth[3]
          );
        }
      } else if (uHasOverlay) {
        vec3 ovCol = vec3(0.0);
        float ovA = 0.0;
        if (sampleOverlayLayer(
          uOverlayVolume, uWorldToOverlayTex, worldPos,
          uHasPosOverlay, uPosColormap, uPosMin, uPosMax, uPosOpacity,
          uHasNegOverlay, uNegColormap, uNegMin, uNegMax, uNegOpacity,
          ovCol, ovA
        )) {
          color = mix(color, ovCol, ovA);
        }
        bool pOn = uContourPosActive || (uShowContour && uContourPosEnabled);
        bool nOn = uContourNegActive || (uShowContour && uContourNegEnabled);
        color = applyContourLine(
          color, worldPos, uvwBase, uOverlayContourVolume, uWorldToOverlayTex,
          pOn, uContourPosThresh, uContourPosColor,
          nOn, uContourNegThresh, uContourNegColor,
          uContourWidth
        );
      }
      return color;
    }

    void main() {
      // Discard fragment if not an exposed cap boundary of the clipped object
      if (evalClipSliceDiscard(vWorldPosition, uPlaneIndex)) discard;

      // 1. Single slice (Default - crisp coplanar cross-section)
      if (uSlabMode == 0 || uSlabThickness <= 0.001) {
        vec4 texCoord = uWorldToVolumeTex * vec4(vWorldPosition, 1.0);
        vec3 uvw = texCoord.xyz;

        // 1. Outside volume bounding box -> Always discard
        if (uvw.x < 0.0 || uvw.x > 1.0 ||
            uvw.y < 0.0 || uvw.y > 1.0 ||
            uvw.z < 0.0 || uvw.z > 1.0) {
          discard;
        }

        // 2. Volumetric background mask (Brain / Skull / Soft Tissue)
        if (uMaskMode == 1) {
          vec4 maskTexCoord = uWorldToMaskTex * vec4(vWorldPosition, 1.0);
          vec3 mUvw = maskTexCoord.xyz;
          if (mUvw.x < 0.0 || mUvw.x > 1.0 ||
              mUvw.y < 0.0 || mUvw.y > 1.0 ||
              mUvw.z < 0.0 || mUvw.z > 1.0) {
            discard;
          }
          float maskVal = texture(uMaskVolume, mUvw).r;
          if (maskVal < uMaskThreshold) {
            discard;
          }
        }

        float rawVal = texture(uVolume, uvw).r;

        // 3. Mask Background by Non-Zero Values
        if (uMaskMode == 2 && rawVal <= uThreshold) {
          discard;
        }

        // Apply Window/Level to base anatomical MRI
        float normVal = clamp((rawVal - uWindowMin) / max(0.0001, uWindowMax - uWindowMin), 0.0, 1.0);
        vec3 color = applyColormap(normVal, uColormap);

        // Apply all active statistical overlays & contours
        color = applyAllOverlays(color, vWorldPosition, uvw);

        gl_FragColor = vec4(color, uOpacity);
        return;
      }

      // 2. Slab mode (MIP or Average over thickness behind the cut plane)
      vec3 stepVec = normalize(uPlaneNormal) * (uSlabThickness / float(uSlabSamples));
      float maxVal = 0.0;
      float sumVal = 0.0;
      int validSamples = 0;

      for (int i = 0; i < 16; i++) {
        if (i >= uSlabSamples) break;
        vec3 samplePos = vWorldPosition + stepVec * float(i);
        float v = sampleVolumeAtWorld(samplePos);
        if (v > maxVal) maxVal = v;
        sumVal += v;
        if (v > uThreshold) validSamples++;
      }

      // Background mask test in slab mode
      if (uMaskMode == 1) {
        vec4 maskTexCoord = uWorldToMaskTex * vec4(vWorldPosition, 1.0);
        vec3 mUvw = maskTexCoord.xyz;
        if (mUvw.x < 0.0 || mUvw.x > 1.0 ||
            mUvw.y < 0.0 || mUvw.y > 1.0 ||
            mUvw.z < 0.0 || mUvw.z > 1.0) {
          discard;
        }
        if (texture(uMaskVolume, mUvw).r < uMaskThreshold) {
          discard;
        }
      }

      float finalRaw = (uSlabMode == 1) ? maxVal : (sumVal / float(uSlabSamples));

      // Non-zero background mask in slab mode
      if (uMaskMode == 2 && finalRaw <= uThreshold) {
        discard;
      }

      float normVal = clamp((finalRaw - uWindowMin) / max(0.0001, uWindowMax - uWindowMin), 0.0, 1.0);
      vec3 color = applyColormap(normVal, uColormap);

      vec4 baseCoord = uWorldToVolumeTex * vec4(vWorldPosition, 1.0);
      color = applyAllOverlays(color, vWorldPosition, baseCoord.xyz);

      gl_FragColor = vec4(color, uOpacity);
    }
  `
};

export function createSliceMaterial(clipUniforms = null, planeIndex = 0) {
  const uniforms = THREE.UniformsUtils.clone(SliceShader.uniforms);
  uniforms.uPlaneIndex.value = planeIndex;

  if (clipUniforms) {
    uniforms.uGlobalClipEnabled = clipUniforms.uGlobalClipEnabled;
    uniforms.uClipActive = clipUniforms.uClipActive;
    uniforms.uClipNormal = clipUniforms.uClipNormal;
    uniforms.uClipConstant = clipUniforms.uClipConstant;
    uniforms.uClipNegative = clipUniforms.uClipNegative;
  }

  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: SliceShader.vertexShader,
    fragmentShader: SliceShader.fragmentShader,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0
  });
  return mat;
}
