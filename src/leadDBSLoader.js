/**
 * Comprehensive Browser Lead-DBS Tractogram & Colorbar Loader
 *
 * Supports:
 * 1. MATLAB Level 5 MAT files (pure JS with pako decompression):
 *    - Format A: "fibers" (N, 4) & "idx" (M, 1) [e.g. Fasciculus Lenticularis, STN limbic tract]
 *    - Format B: "fibcell" (cell array) with optional "vals" & "fibcolor" [e.g. Hyperdirect Pathway]
 * 2. MATLAB v7.3 HDF5 MAT files (via WebAssembly h5wasm with async event-loop yielding):
 *    - Format A: "fibers" & "idx" HDF5 datasets [e.g. Brainstem Connectome CST]
 *    - Format B: "fibcell" nested cell references with optional "vals" & "fibcolor" [e.g. Sweet Streamlines]
 * 3. Lead-DBS SVG Colorbars (extracting embedded raster gradient strips or SVG linearGradient stops).
 */

import { inflate } from 'pako';

/**
 * Detects whether a MAT file buffer is MATLAB 5.0 binary or MATLAB 7.3 (HDF5)
 */
export function detectMatFormat(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 520));
  // Check HDF5 signature at offset 512: \x89HDF\r\n\x1a\n
  if (bytes.length >= 520 &&
      bytes[512] === 0x89 && bytes[513] === 0x48 && bytes[514] === 0x44 && bytes[515] === 0x46 &&
      bytes[516] === 0x0d && bytes[517] === 0x0a && bytes[518] === 0x1a && bytes[519] === 0x0a) {
    return 'v7.3';
  }
  const textHeader = new TextDecoder().decode(bytes.subarray(0, 30));
  if (textHeader.startsWith('MATLAB 7.3')) {
    return 'v7.3';
  }
  if (textHeader.startsWith('MATLAB 5.0') || textHeader.startsWith('MATLAB')) {
    return 'v5';
  }
  return 'unknown';
}

/**
 * Parses Level 5 MAT tags (small or 8-byte format)
 */
function readLevel5Tag(dv, off) {
  const first = dv.getUint32(off, true);
  const second = dv.getUint32(off + 4, true);
  if (first > 0xFFFF) {
    return {
      type: first & 0xFFFF,
      size: (first >> 16) & 0xFFFF,
      headerSize: 4,
      isSmall: true
    };
  }
  return {
    type: first,
    size: second,
    headerSize: 8,
    isSmall: false
  };
}

/**
 * Parses an uncompressed miMATRIX (type 14) in a Level 5 MAT stream
 */
function parseLevel5Matrix(buf, off) {
  const dv = new DataView(buf.buffer, buf.byteOffset + off);
  const matTag = readLevel5Tag(dv, 0);
  if (matTag.type !== 14) {
    throw new Error(`Expected miMATRIX (14), got ${matTag.type} at offset ${off}`);
  }
  let curr = matTag.headerSize;

  // 1. Array Flags
  const flagsTag = readLevel5Tag(dv, curr);
  curr += flagsTag.headerSize;
  const arrayClass = dv.getUint8(curr);
  curr += (flagsTag.isSmall ? 4 : (flagsTag.size + (8 - (flagsTag.size % 8)) % 8));

  // 2. Dimensions Array
  const dimsTag = readLevel5Tag(dv, curr);
  curr += dimsTag.headerSize;
  const dims = [];
  for (let i = 0; i < dimsTag.size / 4; i++) {
    dims.push(dv.getInt32(curr + i * 4, true));
  }
  curr += (dimsTag.isSmall ? 4 : (dimsTag.size + (8 - (dimsTag.size % 8)) % 8));

  // 3. Array Name
  const nameTag = readLevel5Tag(dv, curr);
  curr += nameTag.headerSize;
  let name = '';
  for (let i = 0; i < nameTag.size; i++) {
    const c = dv.getUint8(curr + i);
    if (c !== 0) name += String.fromCharCode(c);
  }
  curr += (nameTag.isSmall ? 4 : (nameTag.size + (8 - (nameTag.size % 8)) % 8));

  let data = null;
  const totalElements = dims.reduce((a, b) => a * b, 1);

  if (arrayClass === 1) { // mxCELL_CLASS
    data = [];
    for (let c = 0; c < totalElements; c++) {
      const subMat = parseLevel5Matrix(buf, off + curr);
      data.push(subMat);
      curr += subMat.totalBytes;
    }
  } else if (arrayClass === 2) { // mxSTRUCT_CLASS
    curr = matTag.headerSize + matTag.size;
  } else {
    // Numeric data
    const dataTag = readLevel5Tag(dv, curr);
    const dataOff = curr + dataTag.headerSize;
    if (dataTag.type === 7) { // miSINGLE
      data = new Float32Array(buf.buffer, buf.byteOffset + off + dataOff, dataTag.size / 4);
    } else if (dataTag.type === 9) { // miDOUBLE
      data = new Float64Array(buf.buffer, buf.byteOffset + off + dataOff, dataTag.size / 8);
    } else if (dataTag.type === 2) { // miUINT8
      data = new Uint8Array(buf.buffer, buf.byteOffset + off + dataOff, dataTag.size);
    } else if (dataTag.type === 1) { // miINT8
      data = new Int8Array(buf.buffer, buf.byteOffset + off + dataOff, dataTag.size);
    } else if (dataTag.type === 4) { // miUINT16
      data = new Uint16Array(buf.buffer, buf.byteOffset + off + dataOff, dataTag.size / 2);
    } else if (dataTag.type === 3) { // miINT16
      data = new Int16Array(buf.buffer, buf.byteOffset + off + dataOff, dataTag.size / 2);
    } else if (dataTag.type === 6) { // miUINT32
      data = new Uint32Array(buf.buffer, buf.byteOffset + off + dataOff, dataTag.size / 4);
    } else if (dataTag.type === 5) { // miINT32
      data = new Int32Array(buf.buffer, buf.byteOffset + off + dataOff, dataTag.size / 4);
    }
    curr += dataTag.headerSize + (dataTag.isSmall ? 4 : (dataTag.size + (8 - (dataTag.size % 8)) % 8));
  }

  const paddedSize = matTag.size + (8 - (matTag.size % 8)) % 8;
  return {
    name,
    arrayClass,
    dims,
    data,
    totalBytes: matTag.headerSize + paddedSize
  };
}

/**
 * Parses Level 5 MAT buffer (pure JS with pako)
 */
async function parseLevel5Mat(buffer, onProgress = null) {
  if (onProgress) onProgress({ progress: 0.2, message: 'Decompressing MATLAB 5.0 data blocks...' });

  const buf = new Uint8Array(buffer);
  let offset = 128;
  const vars = {};

  while (offset + 8 <= buf.length) {
    const dv = new DataView(buf.buffer, buf.byteOffset + offset);
    const type = dv.getUint32(0, true);
    const size = dv.getUint32(4, true);

    if (type === 15) { // miCOMPRESSED
      const slice = buf.subarray(offset + 8, offset + 8 + size);
      const uncomp = inflate(slice);
      const m = parseLevel5Matrix(uncomp, 0);
      vars[m.name] = m;
      offset += 8 + size;
    } else {
      const padded = size + (8 - (size % 8)) % 8;
      offset += 8 + padded;
    }
  }

  const streamlines = [];
  const scalars = [];
  let totalPts = 0;
  let minScalar = Infinity;
  let maxScalar = -Infinity;
  let fibcolor = null;

  // Check fibcolor if present
  if (vars['fibcolor'] && vars['fibcolor'].data) {
    const fc = vars['fibcolor'].data;
    const dims = vars['fibcolor'].dims;
    if (fc.length >= 6) {
      if (dims[0] === 2 && dims[1] === 3) {
        // column-major [2, 3]
        fibcolor = {
          color0: [fc[0] > 1 ? fc[0] / 255 : fc[0], fc[2] > 1 ? fc[2] / 255 : fc[2], fc[4] > 1 ? fc[4] / 255 : fc[4]],
          color1: [fc[1] > 1 ? fc[1] / 255 : fc[1], fc[3] > 1 ? fc[3] / 255 : fc[3], fc[5] > 1 ? fc[5] / 255 : fc[5]]
        };
      } else {
        // column-major [3, 2]
        fibcolor = {
          color0: [fc[0] > 1 ? fc[0] / 255 : fc[0], fc[1] > 1 ? fc[1] / 255 : fc[1], fc[2] > 1 ? fc[2] / 255 : fc[2]],
          color1: [fc[3] > 1 ? fc[3] / 255 : fc[3], fc[4] > 1 ? fc[4] / 255 : fc[4], fc[5] > 1 ? fc[5] / 255 : fc[5]]
        };
      }
    }
  }

  // Format 1: fibers (N, 4) & idx (M, 1)
  if (vars['fibers'] && vars['idx']) {
    const fibers = vars['fibers'].data;
    const idx = vars['idx'].data;
    const N = vars['fibers'].dims[0];
    const totalS = idx.length;
    let ptOffset = 0;

    for (let s = 0; s < totalS; s++) {
      const nPts = idx[s];
      if (nPts >= 2) {
        const pts = new Float32Array(nPts * 3);
        for (let p = 0; p < nPts; p++) {
          const srcIdx = ptOffset + p;
          pts[p * 3 + 0] = fibers[srcIdx];
          pts[p * 3 + 1] = fibers[N + srcIdx];
          pts[p * 3 + 2] = fibers[2 * N + srcIdx];
        }
        streamlines.push(pts);
        totalPts += nPts;
        scalars.push(0.0);
      }
      ptOffset += nPts;

      if (s % 500 === 0 && totalS > 1000) {
        if (onProgress) {
          onProgress({
            progress: 0.3 + (s / totalS) * 0.65,
            message: `Extracting streamlines: ${s.toLocaleString()} / ${totalS.toLocaleString()}...`
          });
        }
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }
  // Format 2: fibcell (cell array)
  else if (vars['fibcell']) {
    const fc = vars['fibcell'];
    const valsVar = vars['vals'];
    const hemiCount = fc.data.length;

    for (let h = 0; h < hemiCount; h++) {
      const hemi = fc.data[h];
      if (!hemi || !hemi.data) continue;
      const hemiScalars = (valsVar && valsVar.data && valsVar.data[h] && valsVar.data[h].data) ? valsVar.data[h].data : null;
      const numS = hemi.data.length;

      for (let s = 0; s < numS; s++) {
        const smat = hemi.data[s];
        if (!smat || !smat.data) continue;
        const dims = smat.dims;
        const nPoints = (dims[0] === 3) ? dims[1] : dims[0];
        if (nPoints < 2) continue;

        const data = smat.data;
        const pts = new Float32Array(nPoints * 3);

        if (dims[0] === 3) {
          // (3, N) column-major: [x0, y0, z0, x1, y1, z1, ...]
          for (let p = 0; p < nPoints; p++) {
            pts[p * 3 + 0] = data[p * 3 + 0];
            pts[p * 3 + 1] = data[p * 3 + 1];
            pts[p * 3 + 2] = data[p * 3 + 2];
          }
        } else {
          // (N, 3) column-major: [X_0..X_{N-1}, Y_0..Y_{N-1}, Z_0..Z_{N-1}]
          for (let p = 0; p < nPoints; p++) {
            pts[p * 3 + 0] = data[p];
            pts[p * 3 + 1] = data[nPoints + p];
            pts[p * 3 + 2] = data[2 * nPoints + p];
          }
        }
        streamlines.push(pts);
        totalPts += nPoints;

        let sVal = 0.0;
        if (hemiScalars && s < hemiScalars.length) {
          sVal = Number(hemiScalars[s]);
          if (Number.isFinite(sVal)) {
            if (sVal < minScalar) minScalar = sVal;
            if (sVal > maxScalar) maxScalar = sVal;
          }
        }
        scalars.push(sVal);

        if (s % 200 === 0 && numS > 500) {
          if (onProgress) {
            onProgress({
              progress: 0.3 + ((h + s / numS) / hemiCount) * 0.65,
              message: `Extracting streamlines: ${streamlines.length.toLocaleString()}...`
            });
          }
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
  } else {
    throw new Error('MAT file is missing both "fibers" and "fibcell" tractography structures.');
  }

  if (onProgress) onProgress({ progress: 1.0, message: 'Streamlines ready!' });

  return {
    streamlines,
    scalars,
    totalPts,
    totalStreamlines: streamlines.length,
    fibcolor,
    minScalar: Number.isFinite(minScalar) ? minScalar : 0.0,
    maxScalar: Number.isFinite(maxScalar) ? maxScalar : 1.0,
    hasScalars: scalars.length > 0 && maxScalar > minScalar
  };
}

/**
 * Parses MATLAB v7.3 HDF5 MAT buffer via h5wasm with cooperative async event-loop yielding
 */
async function parseV73Mat(buffer, onProgress = null) {
  if (onProgress) onProgress({ progress: 0.1, message: 'Initializing HDF5 WebAssembly runtime...' });

  const h5 = await import('h5wasm');
  await h5.ready;

  if (onProgress) onProgress({ progress: 0.25, message: 'Mounting MAT file into memory...' });

  const tempName = `leaddbs_${Date.now()}_${Math.random().toString(36).slice(2)}.mat`;
  h5.FS.writeFile(tempName, new Uint8Array(buffer));

  let f = null;
  try {
    f = new h5.File(tempName, 'r');

    const fibcell = f.get('fibcell');
    const fibersDs = f.get('fibers');
    const idxDs = f.get('idx');
    const valsDs = f.get('vals');
    const fibcolorDs = f.get('fibcolor');

    // Parse fibcolor endpoints if present (shape [3, 2] or [2, 3] in MATLAB)
    let fibcolor = null;
    if (fibcolorDs && fibcolorDs.value) {
      const fc = fibcolorDs.value;
      if (fc.length >= 6) {
        fibcolor = {
          color0: [fc[0] > 1 ? fc[0] / 255 : fc[0], fc[2] > 1 ? fc[2] / 255 : fc[2], fc[4] > 1 ? fc[4] / 255 : fc[4]],
          color1: [fc[1] > 1 ? fc[1] / 255 : fc[1], fc[3] > 1 ? fc[3] / 255 : fc[3], fc[5] > 1 ? fc[5] / 255 : fc[5]]
        };
      }
    }

    const streamlines = [];
    const scalars = [];
    let totalPts = 0;
    let minScalar = Infinity;
    let maxScalar = -Infinity;

    // Case 1: fibers (4, N) & idx (1, M) or (N, 4) & (M, 1)
    if (fibersDs && idxDs) {
      if (onProgress) onProgress({ progress: 0.4, message: 'Reading contiguous fiber vertices...' });
      const fibersVal = fibersDs.value;
      const idxVal = idxDs.value;
      const shape = fibersDs.shape;
      const totalS = idxVal.length;

      const isTransposed = shape[0] === 4; // [4, N] in HDF5 row-major
      const N = isTransposed ? shape[1] : shape[0];
      let ptOffset = 0;

      for (let s = 0; s < totalS; s++) {
        const nPts = idxVal[s];
        if (nPts >= 2) {
          const pts = new Float32Array(nPts * 3);
          if (isTransposed) {
            for (let p = 0; p < nPts; p++) {
              const srcIdx = ptOffset + p;
              pts[p * 3 + 0] = fibersVal[srcIdx];
              pts[p * 3 + 1] = fibersVal[N + srcIdx];
              pts[p * 3 + 2] = fibersVal[2 * N + srcIdx];
            }
          } else {
            for (let p = 0; p < nPts; p++) {
              const srcIdx = (ptOffset + p) * 4;
              pts[p * 3 + 0] = fibersVal[srcIdx + 0];
              pts[p * 3 + 1] = fibersVal[srcIdx + 1];
              pts[p * 3 + 2] = fibersVal[srcIdx + 2];
            }
          }
          streamlines.push(pts);
          totalPts += nPts;
          scalars.push(0.0);
        }
        ptOffset += nPts;

        if (s % 500 === 0 && totalS > 1000) {
          if (onProgress) {
            onProgress({
              progress: 0.4 + (s / totalS) * 0.55,
              message: `Extracting streamlines: ${s.toLocaleString()} / ${totalS.toLocaleString()}...`
            });
          }
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
    // Case 2: fibcell (cell array of references)
    else if (fibcell) {
      const hemiCount = (fibcell.value && fibcell.value.length) || 0;

      for (let h = 0; h < hemiCount; h++) {
        const hRef = fibcell.value[h];
        if (!hRef) continue;

        const hemiDs = fibcell.dereference(hRef);
        if (!hemiDs || !hemiDs.value) continue;

        let valsHemiDs = null;
        if (valsDs && valsDs.value && valsDs.value[h]) {
          try {
            valsHemiDs = valsDs.dereference(valsDs.value[h]);
          } catch (_) {}
        }

        const numStreamlines = hemiDs.shape[1] || hemiDs.shape[0] || hemiDs.value.length;
        const hemiScalars = valsHemiDs ? valsHemiDs.value : null;

        const sideName = (h === 0) ? 'Right' : 'Left';

        for (let s = 0; s < numStreamlines; s++) {
          const sRef = hemiDs.value[s];
          if (!sRef) continue;

          const streamDs = hemiDs.dereference(sRef);
          if (!streamDs || !streamDs.value) continue;

          const dim0 = streamDs.shape[0];
          const dim1 = streamDs.shape[1];
          const nPoints = (dim0 === 3) ? dim1 : (dim1 === 3 ? dim0 : Math.floor(streamDs.value.length / 3));
          if (nPoints < 2) continue;

          const data = streamDs.value;
          const pts = new Float32Array(nPoints * 3);

          if (dim0 === 3) {
            // (3, N) in row-major: [X_0..X_{N-1}, Y_0..Y_{N-1}, Z_0..Z_{N-1}]
            for (let p = 0; p < nPoints; p++) {
              pts[p * 3 + 0] = data[p];
              pts[p * 3 + 1] = data[nPoints + p];
              pts[p * 3 + 2] = data[2 * nPoints + p];
            }
          } else {
            // (N, 3)
            for (let p = 0; p < nPoints; p++) {
              pts[p * 3 + 0] = data[p * 3 + 0];
              pts[p * 3 + 1] = data[p * 3 + 1];
              pts[p * 3 + 2] = data[p * 3 + 2];
            }
          }

          streamlines.push(pts);
          totalPts += nPoints;

          let sVal = null;
          if (hemiScalars && s < hemiScalars.length) {
            sVal = Number(hemiScalars[s]);
            if (Number.isFinite(sVal)) {
              if (sVal < minScalar) minScalar = sVal;
              if (sVal > maxScalar) maxScalar = sVal;
            }
          }
          scalars.push(sVal !== null ? sVal : 0.0);

          // Cooperative event-loop yielding to keep browser UI at 60 FPS and update progress
          if (s % 50 === 0) {
            if (onProgress) {
              const currentFraction = (h + (s / numStreamlines)) / hemiCount;
              onProgress({
                progress: 0.3 + currentFraction * 0.65,
                message: `Extracting ${sideName} hemisphere streamlines: ${s.toLocaleString()} / ${numStreamlines.toLocaleString()} (${Math.round(currentFraction * 100)}%)...`
              });
            }
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }
    } else {
      throw new Error('MAT file is missing both "fibcell" and "fibers" tractography structures.');
    }

    if (onProgress) onProgress({ progress: 1.0, message: 'Streamlines ready!' });

    return {
      streamlines,
      scalars,
      totalPts,
      totalStreamlines: streamlines.length,
      fibcolor,
      minScalar: Number.isFinite(minScalar) ? minScalar : 0.0,
      maxScalar: Number.isFinite(maxScalar) ? maxScalar : 1.0,
      hasScalars: scalars.length > 0 && maxScalar > minScalar
    };
  } finally {
    if (f) {
      try { f.close(); } catch (_) {}
    }
    try {
      h5.FS.unlink(tempName);
    } catch (_) {}
  }
}

/**
 * Universal Lead-DBS MAT parser entry point.
 * Automatically branches to pure JS Level 5 parser or HDF5 v7.3 parser.
 */
export async function parseLeadDBSMat(buffer, onProgress = null) {
  const format = detectMatFormat(buffer);

  if (format === 'v5') {
    return await parseLevel5Mat(buffer, onProgress);
  } else if (format === 'v7.3') {
    return await parseV73Mat(buffer, onProgress);
  } else {
    // Attempt Level 5 first; fallback to v7.3
    try {
      return await parseLevel5Mat(buffer, onProgress);
    } catch (_) {
      return await parseV73Mat(buffer, onProgress);
    }
  }
}

/**
 * Parses color string to [r, g, b] in [0, 1]
 */
function parseColorString(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();

  // Hex format #rrggbb or #rgb
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255.0,
        parseInt(hex.slice(2, 4), 16) / 255.0,
        parseInt(hex.slice(4, 6), 16) / 255.0
      ];
    } else if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255.0,
        parseInt(hex[1] + hex[1], 16) / 255.0,
        parseInt(hex[2] + hex[2], 16) / 255.0
      ];
    }
  }

  // rgb(r, g, b)
  const rgbMatch = s.match(/rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (rgbMatch) {
    return [
      parseFloat(rgbMatch[1]) / 255.0,
      parseFloat(rgbMatch[2]) / 255.0,
      parseFloat(rgbMatch[3]) / 255.0
    ];
  }

  // Named colors
  const named = {
    white: [1, 1, 1],
    black: [0, 0, 0],
    red: [1, 0, 0],
    green: [0, 1, 0],
    blue: [0, 0, 1],
    yellow: [1, 1, 0],
    cyan: [0, 1, 1],
    magenta: [1, 0, 1]
  };
  return named[s] || null;
}

/**
 * Parses Lead-DBS Colorbar SVG into an array of RGB stops [[r,g,b], ...] normalized to [0, 1].
 * Supports:
 * 1. Embedded base64 raster images (PNG/JPEG) representing the continuous colorbar strip
 * 2. SVG <linearGradient> with <stop offset="..." stop-color="..."> tags
 */
export async function parseSvgColorbar(svgText) {
  if (!svgText || typeof svgText !== 'string') return null;

  // 1. Check for embedded base64 image (typical in Lead-DBS colorbar SVGs)
  const imgMatch = svgText.match(/(?:xlink:)?href=["']data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=\s]+)["']/i);
  if (imgMatch) {
    const cleanB64 = imgMatch[1].replace(/\s+/g, '');
    const dataUri = `data:image/png;base64,${cleanB64}`;

    if (typeof Image !== 'undefined' && typeof document !== 'undefined') {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUri;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      // Draw middle horizontal scanline
      ctx.drawImage(img, 0, Math.floor(img.height / 2), img.width, 1, 0, 0, img.width, 1);
      const imgData = ctx.getImageData(0, 0, img.width, 1).data;

      const lut = [];
      for (let i = 0; i < img.width; i++) {
        lut.push([
          imgData[i * 4 + 0] / 255.0,
          imgData[i * 4 + 1] / 255.0,
          imgData[i * 4 + 2] / 255.0
        ]);
      }
      return lut;
    }
  }

  // 2. Check for <stop> tags in <linearGradient>
  const stopRegex = /<stop\s+([^>]+)>/gi;
  const stops = [];
  let match;
  while ((match = stopRegex.exec(svgText)) !== null) {
    const attrStr = match[1];
    const offsetMatch = attrStr.match(/offset=["']([^"']+)["']/i);
    const colorMatch = attrStr.match(/stop-color=["']([^"']+)["']/i) || attrStr.match(/style=["'][^"']*stop-color:\s*([^;"']+)/i);
    if (offsetMatch && colorMatch) {
      const offStr = offsetMatch[1].trim();
      const offset = offStr.endsWith('%') ? parseFloat(offStr) / 100.0 : parseFloat(offStr);
      const colorStr = colorMatch[1].trim();
      const rgb = parseColorString(colorStr);
      if (rgb && Number.isFinite(offset)) {
        stops.push({ offset, rgb });
      }
    }
  }

  if (stops.length >= 2) {
    stops.sort((a, b) => a.offset - b.offset);
    const numStops = 256;
    const lut = [];
    for (let i = 0; i < numStops; i++) {
      const t = i / (numStops - 1);
      let c = stops[0].rgb;
      if (t <= stops[0].offset) {
        c = stops[0].rgb;
      } else if (t >= stops[stops.length - 1].offset) {
        c = stops[stops.length - 1].rgb;
      } else {
        for (let j = 0; j < stops.length - 1; j++) {
          if (t >= stops[j].offset && t <= stops[j + 1].offset) {
            const span = stops[j + 1].offset - stops[j].offset;
            const frac = span > 1e-6 ? (t - stops[j].offset) / span : 0.0;
            const c0 = stops[j].rgb;
            const c1 = stops[j + 1].rgb;
            c = [
              c0[0] * (1.0 - frac) + c1[0] * frac,
              c0[1] * (1.0 - frac) + c1[1] * frac,
              c0[2] * (1.0 - frac) + c1[2] * frac
            ];
            break;
          }
        }
      }
      lut.push(c);
    }
    return lut;
  }

  return null;
}
