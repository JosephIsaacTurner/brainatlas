import * as THREE from 'three';

/**
 * Faithful Surf Ice "Velvet" Shader Implementation
 * 
 * Directly ported from Surf Ice's reference shader:
 * /Users/jiturner/Documents/MATLAB/leaddbs/ext_libs/surfice/Resources/shaders/Velvet.txt
 * (Adapted from Fluxus Library, Copyright 2007 Dave Griffiths, GPLv2)
 *
 * Implements:
 * - View-space Blinn-Phong lighting with headlamp LightPos = vec3(0.0, 20.0, 30.0)
 * - Retroreflective velvet backscatter: sheen * pow(cosine(l, v), 16.0) * backscatter
 * - Grazing nap sheen halo: sheen * pow(sqrt(1.0 - cosine(n, v)), edginess) * diffuse
 * - Two-sided / backface lighting and soft desaturated interior shading
 * - Silhouette edge darkening (Edge parameter)
 * - Negative multi-plane clipping support
 */

export const VelvetShader = {
  uniforms: {
    // Surf Ice Velvet parameters (defaults from Velvet.txt)
    uAmbient: { value: 0.25 },
    uDiffuse: { value: 0.70 },
    uSpecular: { value: 0.70 },
    uSheen: { value: 0.70 },
    uEdginess: { value: 4.0 },
    uBackscatter: { value: 0.25 },
    uEdge: { value: 0.0 },
    uLightBackfaces: { value: false },
    uLightPos: { value: new THREE.Vector3(0.0, 0.0, 50.0) }, // Pure bilateral symmetric headlamp

    // Base color and opacity
    uColor: { value: new THREE.Color(0xbdbdbd) },
    uOpacity: { value: 1.0 },
    uUseVertexColor: { value: false },

    // Multi-plane clipping uniforms
    uGlobalClipEnabled: { value: false },
    uMeshClipped: { value: true },
    uClipActive: { value: [false, false, false] },
    uClipNormal: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)] },
    uClipConstant: { value: [0, 0, 0] },
    uClipNegative: { value: [false, false, false] }
  },

  vertexShader: /* glsl */ `
    precision highp float;

    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vL;
    varying vec3 vWorldPosition;
    varying vec3 vColor;

    uniform vec3 uLightPos;

    void main() {
      // Normal transformed to eye/view space
      vN = normalize(normalMatrix * normal);

      #ifdef USE_COLOR
      vColor = color;
      #else
      vColor = vec3(1.0);
      #endif

      // Vertex in eye/view space
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

      // Vector pointing towards the camera in eye space
      vV = -mvPosition.xyz;

      // Fixed headlamp light direction in view space
      vL = normalize(uLightPos);

      // World position for multi-plane clipping
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;

      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform float uAmbient;
    uniform float uDiffuse;
    uniform float uSpecular;
    uniform float uSheen;
    uniform float uEdginess;
    uniform float uBackscatter;
    uniform float uEdge;
    uniform bool uLightBackfaces;
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform bool uUseVertexColor;

    // Multi-plane clipping uniforms
    uniform bool uGlobalClipEnabled;
    uniform bool uMeshClipped;
    uniform bool uClipActive[3];
    uniform vec3 uClipNormal[3];
    uniform float uClipConstant[3];
    uniform bool uClipNegative[3];

    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vL;
    varying vec3 vWorldPosition;
    varying vec3 vColor;

    vec3 desaturate(vec3 c, float amount) {
      vec3 gray = vec3(dot(vec3(0.2126, 0.7152, 0.0722), c));
      return mix(c, gray, amount);
    }

    bool evalClipDiscard(vec3 worldPos) {
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

      if (hasNormal && hasNegative) {
        return normalDiscard && negativeDiscard;
      } else if (hasNormal) {
        return normalDiscard;
      } else if (hasNegative) {
        return negativeDiscard;
      }
      return false;
    }

    void main() {
      if (evalClipDiscard(vWorldPosition)) discard;

      vec3 l = normalize(vL);
      vec3 n = normalize(vN);
      vec3 v = normalize(vV);

      vec3 baseMeshColor = uUseVertexColor ? vColor : uColor;

      vec3 a = baseMeshColor * uAmbient;
      vec3 d = baseMeshColor * uDiffuse;

      // Soft desaturated back-facing illumination (Surf Ice Velvet)
      vec3 backcolor = desaturate(0.75 * a + 0.75 * d * abs(dot(n, l)), 0.5);

      // In eye/view space, camera looks along -Z. A front-facing normal has n.z > 0.
      float backface = 1.0 - step(0.0, n.z); // 1 = backface, 0 = frontface
      n = mix(n, -n, backface * float(uLightBackfaces));

      d = baseMeshColor;

      float diffuse = clamp(dot(l, n), 0.0, 1.0);

      // Retroreflective velvet backscatter
      float cosine = clamp(dot(l, v), 0.0, 1.0);
      float shiny = uSheen * pow(cosine, 16.0) * uBackscatter;

      // Grazing nap sheen halo
      cosine = clamp(dot(n, v), 0.0, 1.0);
      float sine = sqrt(max(0.0, 1.0 - cosine));
      shiny = shiny + uSheen * pow(sine, uEdginess) * diffuse;

      // Front color composition
      vec3 frontcolor = a + (uDiffuse * diffuse) * d + (uSpecular * shiny);

      // Edge silhouette darkening
      if (uEdge > 0.0) {
        frontcolor *= min((max(dot(n, v), 0.0) - 0.5) * uEdge, 0.0) + 1.0;
      }

      vec3 finalColor = mix(frontcolor, backcolor, backface);

      gl_FragColor = vec4(finalColor, uOpacity);
    }
  `
};

/**
 * Creates the primary Surf Ice Velvet material
 */
export function createVelvetMaterial(clipUniforms = null, color = 0xbdbdbd) {
  const uniforms = THREE.UniformsUtils.clone(VelvetShader.uniforms);
  uniforms.uColor.value = new THREE.Color(color);

  if (clipUniforms) {
    uniforms.uGlobalClipEnabled = clipUniforms.uGlobalClipEnabled;
    uniforms.uClipActive = clipUniforms.uClipActive;
    uniforms.uClipNormal = clipUniforms.uClipNormal;
    uniforms.uClipConstant = clipUniforms.uClipConstant;
    uniforms.uClipNegative = clipUniforms.uClipNegative;
  }

  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: VelvetShader.vertexShader,
    fragmentShader: VelvetShader.fragmentShader,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    depthTest: true
  });

  // Compatibility getter/setters for color and opacity
  Object.defineProperty(mat, 'color', {
    get() { return this.uniforms.uColor.value; },
    set(c) {
      if (typeof c === 'number' || typeof c === 'string') {
        this.uniforms.uColor.value.set(c);
      } else if (c && c.isColor) {
        this.uniforms.uColor.value.copy(c);
      }
    }
  });

  Object.defineProperty(mat, 'opacity', {
    get() { return this.uniforms.uOpacity.value; },
    set(v) {
      this.uniforms.uOpacity.value = v;
      this.transparent = v < 0.999;
    }
  });

  return mat;
}

