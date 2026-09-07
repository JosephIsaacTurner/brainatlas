/**
 * Analytical & Multi-Stop Colormaps for 1D Scalar Visualization
 */

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

// Google Turbo Colormap polynomial approximation
export function colormapTurbo(t) {
  const x = clamp(t, 0.0, 1.0);
  const r = 0.1357 + x * (4.61539 - x * (42.6603 - x * (132.131 - x * (161.076 - x * 65.2014))));
  const g = 0.0914 + x * (2.19418 + x * (16.4218 - x * (57.8596 - x * (62.3391 - x * 28.5308))));
  const b = 0.1067 + x * (12.5879 - x * (84.4608 - x * (282.885 - x * (427.604 - x * 224.819))));
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

// Viridis Colormap
export function colormapViridis(t) {
  const x = clamp(t, 0.0, 1.0);
  const r = -0.019 + x * (0.835 + x * (-0.976 + x * 1.139));
  const g = 0.003 + x * (1.403 + x * (-0.942 + x * 0.443));
  const b = 0.334 + x * (1.385 + x * (-3.695 + x * 2.296));
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

// Plasma Colormap
export function colormapPlasma(t) {
  const x = clamp(t, 0.0, 1.0);
  const r = 0.058 + x * (2.428 + x * (-2.684 + x * 1.196));
  const g = 0.015 + x * (0.335 + x * (1.734 - x * 1.185));
  const b = 0.533 + x * (1.135 + x * (-4.228 + x * 2.681));
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

// Inferno Colormap
export function colormapInferno(t) {
  const x = clamp(t, 0.0, 1.0);
  const r = 0.001 + x * (2.148 + x * (-2.385 + x * 1.235));
  const g = 0.001 + x * (0.178 + x * (2.285 - x * 1.564));
  const b = 0.015 + x * (2.034 + x * (-6.685 + x * 4.935));
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

// CoolWarm Colormap (Diverging Blue -> White -> Red)
export function colormapCoolWarm(t) {
  const x = clamp(t, 0.0, 1.0);
  if (x < 0.5) {
    const u = x * 2.0;
    return [mix(0.23, 0.95, u), mix(0.30, 0.95, u), mix(0.75, 0.95, u)];
  } else {
    const u = (x - 0.5) * 2.0;
    return [mix(0.95, 0.70, u), mix(0.95, 0.15, u), mix(0.95, 0.15, u)];
  }
}

// Rainbow (Jet) Colormap
export function colormapRainbow(t) {
  const x = clamp(t, 0.0, 1.0);
  const r = clamp(1.5 - Math.abs(x * 4.0 - 3.0), 0.0, 1.0);
  const g = clamp(1.5 - Math.abs(x * 4.0 - 2.0), 0.0, 1.0);
  const b = clamp(1.5 - Math.abs(x * 4.0 - 1.0), 0.0, 1.0);
  return [r, g, b];
}

// Hot Spectrum Colormap (Black -> Red -> Yellow -> White)
export function colormapHot(t) {
  const x = clamp(t, 0.0, 1.0);
  const r = clamp(x * 3.0, 0.0, 1.0);
  const g = clamp(x * 3.0 - 1.0, 0.0, 1.0);
  const b = clamp(x * 3.0 - 2.0, 0.0, 1.0);
  return [r, g, b];
}

// Cool Spectrum Colormap (Cyan -> Magenta)
export function colormapCool(t) {
  const x = clamp(t, 0.0, 1.0);
  return [x, 1.0 - x, 1.0];
}

// Magma Colormap
export function colormapMagma(t) {
  const x = clamp(t, 0.0, 1.0);
  const c0 = [-0.002136, -0.000743, -0.005386];
  const c1 = [0.251660, 0.677523, 2.494026];
  const c2 = [8.353718, -3.577719, 0.314467];
  const c3 = [-27.668733, 14.264730, -13.649213];
  const c4 = [52.176139, -27.943191, 12.944169];
  const c5 = [-50.768525, 29.046582, 4.234150];
  const c6 = [18.655705, -11.489773, -5.601961];
  return [
    clamp(c0[0] + x * (c1[0] + x * (c2[0] + x * (c3[0] + x * (c4[0] + x * (c5[0] + x * c6[0]))))), 0, 1),
    clamp(c0[1] + x * (c1[1] + x * (c2[1] + x * (c3[1] + x * (c4[1] + x * (c5[1] + x * c6[1]))))), 0, 1),
    clamp(c0[2] + x * (c1[2] + x * (c2[2] + x * (c3[2] + x * (c4[2] + x * (c5[2] + x * c6[2]))))), 0, 1)
  ];
}

// Cividis Colormap
export function colormapCividis(t) {
  const x = clamp(t, 0.0, 1.0);
  const c0 = [0.000000, 0.135112, 0.304751];
  const c1 = [0.245037, 0.287870, 0.258674];
  const c2 = [-0.063069, 0.449764, -0.061989];
  const c3 = [0.536109, -0.082531, -0.278786];
  const c4 = [0.269165, 0.210411, 0.050302];
  return [
    clamp(c0[0] + x * (c1[0] + x * (c2[0] + x * (c3[0] + x * c4[0]))), 0, 1),
    clamp(c0[1] + x * (c1[1] + x * (c2[1] + x * (c3[1] + x * c4[1]))), 0, 1),
    clamp(c0[2] + x * (c1[2] + x * (c2[2] + x * (c3[2] + x * c4[2]))), 0, 1)
  ];
}

// Red-Yellow Colormap (fMRI positive activation)
export function colormapRedYellow(t) {
  const x = clamp(t, 0.0, 1.0);
  return [mix(0.95, 1.0, x), mix(0.05, 0.95, x), 0.05];
}

// Winters Colormap (Deep Blue -> Vibrant Cyan -> Green)
export function colormapWinters(t) {
  const x = clamp(t, 0.0, 1.0);
  return [0.0, mix(0.15, 0.95, x), mix(0.95, 0.65, x)];
}

// Grayscale Colormap (Black -> White)
export function colormapGrayscale(t) {
  const x = clamp(t, 0.0, 1.0);
  return [x, x, x];
}

// ACTC Colormap (Surf Ice ACTC lookup table: Black -> Dark Blue -> Green -> Yellow -> Red)
export function colormapACTC(t) {
  const x = clamp(t, 0.0, 1.0);
  const n0 = 0.0;
  const n1 = 64.0 / 255.0;  // 0.25098
  const n2 = 128.0 / 255.0; // 0.50196
  const n3 = 156.0 / 255.0; // 0.61176
  const n4 = 1.0;

  if (x <= n1) {
    const u = (x - n0) / (n1 - n0);
    return [0.0, 0.0, mix(0.0, 136.0 / 255.0, u)];
  } else if (x <= n2) {
    const u = (x - n1) / (n2 - n1);
    return [mix(0.0, 24.0 / 255.0, u), mix(0.0, 177.0 / 255.0, u), mix(136.0 / 255.0, 0.0, u)];
  } else if (x <= n3) {
    const u = (x - n2) / (n3 - n2);
    return [mix(24.0 / 255.0, 248.0 / 255.0, u), mix(177.0 / 255.0, 254.0 / 255.0, u), 0.0];
  } else {
    const u = (x - n3) / (n4 - n3);
    return [mix(248.0 / 255.0, 1.0, u), mix(254.0 / 255.0, 0.0, u), 0.0];
  }
}

export const COLORMAP_FUNCTIONS = {
  'turbo': colormapTurbo,
  'viridis': colormapViridis,
  'magma': colormapMagma,
  'plasma': colormapPlasma,
  'inferno': colormapInferno,
  'cividis': colormapCividis,
  'coolwarm': colormapCoolWarm,
  'rainbow': colormapRainbow,
  'hot': colormapHot,
  'cool': colormapCool,
  'red_yellow': colormapRedYellow,
  'winters': colormapWinters,
  'grayscale': colormapGrayscale,
  'actc': colormapACTC
};

export function evaluateColormap(name, t) {
  const fn = COLORMAP_FUNCTIONS[name] || colormapTurbo;
  return fn(t);
}

/**
 * Evaluates any of the 21 overlay colormap IDs matching sliceShader.js
 */
export function evaluateOverlayColormap(t, cmap) {
  t = clamp(t, 0.0, 1.0);
  switch (cmap) {
    case 0: // Hot Spectrum: Red -> Orange -> Yellow -> White
      if (t < 0.5) {
        return [mix(0.92, 1.0, t / 0.5), mix(0.08, 0.82, t / 0.5), 0.0];
      } else {
        return [1.0, mix(0.82, 1.0, (t - 0.5) / 0.5), mix(0.0, 1.0, (t - 0.5) / 0.5)];
      }
    case 1: // Rainbow / Jet: Royal Blue -> Cyan -> Green -> Yellow -> Red
      return colormapRainbow(t);
    case 2: // Cool: Electric Cyan -> Sky -> Bright Magenta
      return [mix(0.0, 1.0, t), mix(0.85, 0.15, t), mix(1.0, 0.95, t)];
    case 3: // Emerald Green: Deep Emerald -> Lime -> Brilliant Mint
      return [mix(0.0, 0.4, t), mix(0.7, 1.0, t), mix(0.2, 0.75, t)];
    case 4: // Electric Red: Crimson -> Coral -> Neon Amber
      return [mix(0.9, 1.0, t), mix(0.0, 0.6, t), mix(0.1, 0.15, t)];
    case 5: // Electric Blue: Rich Blue -> Cyan -> White-Cyan
      return [mix(0.05, 0.35, t), mix(0.35, 0.95, t), 1.0];
    case 6: // Violet / Magenta: Royal Purple -> Neon Fuchsia -> Pastel Rose
      return [mix(0.55, 1.0, t), mix(0.0, 0.35, t), 0.95];
    case 7: // Plain Flat Red
      return [1.0, 0.05, 0.05];
    case 8: // Plain Flat Blue
      return [0.05, 0.35, 1.0];
    case 9: // Plain Flat Green
      return [0.05, 0.85, 0.15];
    case 10: return colormapViridis(t);
    case 11: return colormapMagma(t);
    case 12: return colormapInferno(t);
    case 13: return colormapPlasma(t);
    case 14: return colormapCividis(t);
    case 15: return colormapTurbo(t);
    case 16: return colormapCoolWarm(t);
    case 17: // Red-Yellow: Classic positive fMRI activation
      return colormapRedYellow(t);
    case 18: // Winters: Classic negative fMRI activation
      return colormapWinters(t);
    case 19: // Grayscale
      return colormapGrayscale(t);
    case 20: // ACTC (Surf Ice ACTC colormap)
      return colormapACTC(t);
    default:
      return [0.92, 0.08, 0.0];
  }
}
