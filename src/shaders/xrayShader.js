import * as THREE from 'three';

/**
 * Surf Ice X-Ray / Glass brain shader
 * 
 * Based on Surf Ice / BrainDeer:
 * Grazing angle rim falloff: rim = pow(1.0 - |n.v|, edgeFalloff)
 * floor opacity keeps center transparent, grazing silhouette luminous.
 */

export const XRayShader = {
  uniforms: {
    uColor: { value: new THREE.Color(0xf2ede4) }, // Bone tone
    uEdgeFalloff: { value: 1.8 },
    uFloorOpacity: { value: 0.12 },
    uOpacityMultiplier: { value: 0.8 },

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

    varying vec3 vWorldNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldPosition;
    #ifdef USE_COLOR
    varying vec3 vColor;
    #endif

    void main() {
      #ifdef USE_COLOR
      vColor = color;
      #endif
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vViewDir = normalize(cameraPosition - worldPos.xyz);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform vec3 uColor;
    uniform float uEdgeFalloff;
    uniform float uFloorOpacity;
    uniform float uOpacityMultiplier;

    // Multi-plane clipping uniforms
    uniform bool uGlobalClipEnabled;
    uniform bool uMeshClipped;
    uniform bool uClipActive[3];
    uniform vec3 uClipNormal[3];
    uniform float uClipConstant[3];
    uniform bool uClipNegative[3];

    varying vec3 vWorldNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldPosition;
    #ifdef USE_COLOR
    varying vec3 vColor;
    #endif

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

      vec3 N = normalize(vWorldNormal);
      vec3 V = normalize(vViewDir);

      float ndotv = abs(dot(N, V));
      float rim = pow(1.0 - ndotv, uEdgeFalloff);
      float alpha = uFloorOpacity + (1.0 - uFloorOpacity) * rim;
      alpha *= uOpacityMultiplier;

      #ifdef USE_COLOR
      vec3 tint = vColor;
      #else
      vec3 tint = uColor;
      #endif

      gl_FragColor = vec4(tint, clamp(alpha, 0.0, 1.0));
    }
  `
};

export function createXRayMaterial(clipUniforms = null, color = 0xebe0ce) {
  const uniforms = THREE.UniformsUtils.clone(XRayShader.uniforms);
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
    vertexShader: XRayShader.vertexShader,
    fragmentShader: XRayShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide
  });

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

  return mat;
}

