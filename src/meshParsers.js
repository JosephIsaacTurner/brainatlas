import * as THREE from 'three';
import { inflate } from 'pako';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

/**
 * Parses Stanford .ply mesh files (ASCII or binary, raw or gzipped)
 */
export function parsePLY(arrayBuffer) {
  let u8 = new Uint8Array(arrayBuffer);
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    u8 = inflate(u8);
  }
  const loader = new PLYLoader();
  const geom = loader.parse(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}

/**
 * Parses Stereolithography .stl mesh files (ASCII or binary, raw or gzipped)
 */
export function parseSTL(arrayBuffer) {
  let u8 = new Uint8Array(arrayBuffer);
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    u8 = inflate(u8);
  }
  const loader = new STLLoader();
  const geom = loader.parse(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}

/**
 * Parses Surf Ice .mz3 binary mesh files (gzipped or uncompressed)
 * Specification: https://github.com/neurolabusc/surf-ice/tree/master/mz3
 */
export function parseMZ3(arrayBuffer) {
  let u8 = new Uint8Array(arrayBuffer);
  
  // Check for gzip magic header (0x1f, 0x8b)
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    u8 = inflate(u8);
  }

  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const magic = view.getUint16(0, true);
  if (magic !== 23117) {
    throw new Error(`Invalid MZ3 magic: expected 23117, got ${magic}`);
  }

  const attr = view.getUint16(2, true);
  const nface = view.getUint32(4, true);
  const nvert = view.getUint32(8, true);
  const nskip = view.getUint32(12, true);

  const isFace = (attr & 1) !== 0;
  const isVert = (attr & 2) !== 0;

  if (!isVert || nvert === 0) {
    throw new Error('MZ3 file has no vertex coordinates');
  }

  const faceOffset = 16 + nskip;
  const faceBytes = isFace ? nface * 12 : 0;
  const vertOffset = faceOffset + faceBytes;

  // Copy sliced buffers to guarantee 4-byte alignment
  const positionsBuf = u8.buffer.slice(u8.byteOffset + vertOffset, u8.byteOffset + vertOffset + nvert * 12);
  const positions = new Float32Array(positionsBuf);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  if (isFace && nface > 0) {
    const indicesBuf = u8.buffer.slice(u8.byteOffset + faceOffset, u8.byteOffset + faceOffset + faceBytes);
    const indices = new Uint32Array(indicesBuf);
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}

/**
 * Parses GIfTI .gii surface files (XML with Base64/GZip DataArrays)
 */
export function parseGII(textOrBuffer) {
  let xmlText;
  if (typeof textOrBuffer === 'string') {
    xmlText = textOrBuffer;
  } else {
    // ArrayBuffer
    const u8 = new Uint8Array(textOrBuffer);
    if (u8[0] === 0x1f && u8[1] === 0x8b) {
      const decomp = inflate(u8);
      xmlText = new TextDecoder('utf-8').decode(decomp);
    } else {
      xmlText = new TextDecoder('utf-8').decode(u8);
    }
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const dataArrays = xmlDoc.querySelectorAll('DataArray');

  let positions = null;
  let indices = null;

  for (const da of dataArrays) {
    const intent = da.getAttribute('Intent');
    const encoding = da.getAttribute('Encoding') || '';
    const dim0 = parseInt(da.getAttribute('Dim0') || '0', 10);
    const dataElem = da.querySelector('Data');
    if (!dataElem) continue;

    const b64 = dataElem.textContent.replace(/\s+/g, '');
    const binaryStr = atob(b64);
    let bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (encoding.toLowerCase().includes('gzip')) {
      bytes = inflate(bytes);
    }

    if (intent === 'NIFTI_INTENT_POINTSET') {
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + dim0 * 12);
      positions = new Float32Array(copy);
    } else if (intent === 'NIFTI_INTENT_TRIANGLE') {
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + dim0 * 12);
      indices = new Uint32Array(copy);
    }
  }

  if (!positions) {
    throw new Error('GIfTI file does not contain NIFTI_INTENT_POINTSET');
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  if (indices) {
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}

/**
 * Combines two geometries (e.g. Left + Right Hemispheres) into a single unified geometry
 */
export function combineGeometries(geomA, geomB) {
  const posA = geomA.attributes.position.array;
  const posB = geomB.attributes.position.array;
  const vCountA = posA.length / 3;
  const vCountB = posB.length / 3;

  const combinedPos = new Float32Array((vCountA + vCountB) * 3);
  combinedPos.set(posA, 0);
  combinedPos.set(posB, posA.length);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(combinedPos, 3));

  if (geomA.index && geomB.index) {
    const idxA = geomA.index.array;
    const idxB = geomB.index.array;
    const combinedIdx = new Uint32Array(idxA.length + idxB.length);
    combinedIdx.set(idxA, 0);
    for (let i = 0; i < idxB.length; i++) {
      combinedIdx[idxA.length + i] = idxB[i] + vCountA;
    }
    geom.setIndex(new THREE.BufferAttribute(combinedIdx, 1));
  }

  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.userData.hemiVertexCounts = { left: vCountA, right: vCountB };
  geom.userData.isBilateral = true;
  return geom;
}

/**
 * Detects if a GIfTI file contains scalar data (overlay) or mesh geometry (POINTSET)
 */
export function isGIIScalarFile(textOrBuffer) {
  let xmlText;
  if (typeof textOrBuffer === 'string') {
    xmlText = textOrBuffer;
  } else {
    const u8 = new Uint8Array(textOrBuffer);
    if (u8[0] === 0x1f && u8[1] === 0x8b) {
      try {
        const decomp = inflate(u8);
        xmlText = new TextDecoder('utf-8').decode(decomp);
      } catch (e) {
        return false;
      }
    } else {
      xmlText = new TextDecoder('utf-8').decode(u8.subarray(0, Math.min(u8.length, 4096)));
    }
  }
  const hasPointset = xmlText.includes('Intent="NIFTI_INTENT_POINTSET"');
  const hasDataArray = xmlText.includes('<DataArray');
  return !hasPointset && hasDataArray;
}

/**
 * Parses GIfTI .gii scalar overlay files (e.g. .func.gii, .shape.gii, .label.gii)
 */
export function parseGIIScalars(textOrBuffer) {
  let xmlText;
  if (typeof textOrBuffer === 'string') {
    xmlText = textOrBuffer;
  } else {
    const u8 = new Uint8Array(textOrBuffer);
    if (u8[0] === 0x1f && u8[1] === 0x8b) {
      const decomp = inflate(u8);
      xmlText = new TextDecoder('utf-8').decode(decomp);
    } else {
      xmlText = new TextDecoder('utf-8').decode(u8);
    }
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const dataArrays = xmlDoc.querySelectorAll('DataArray');

  let hasPointset = false;
  let targetDataArray = null;

  for (const da of dataArrays) {
    const intent = da.getAttribute('Intent') || '';
    if (intent === 'NIFTI_INTENT_POINTSET') {
      hasPointset = true;
    } else if (!targetDataArray) {
      targetDataArray = da;
    }
  }

  if (hasPointset) {
    throw new Error('Selected GIfTI file is a surface mesh (.surf.gii), not a scalar overlay. Load it under Custom Meshes or Brain Models.');
  }

  if (!targetDataArray) {
    throw new Error('No scalar DataArray found in GIfTI file.');
  }

  const dim0 = parseInt(targetDataArray.getAttribute('Dim0') || '0', 10);
  const dim1 = parseInt(targetDataArray.getAttribute('Dim1') || '1', 10);
  const encoding = targetDataArray.getAttribute('Encoding') || '';
  const dataType = targetDataArray.getAttribute('DataType') || 'NIFTI_TYPE_FLOAT32';
  const dataElem = targetDataArray.querySelector('Data');
  if (!dataElem) {
    throw new Error('GIfTI DataArray has no <Data> element.');
  }

  let float32Array;
  if (encoding.toLowerCase() === 'ascii') {
    const tokens = dataElem.textContent.trim().split(/\s+/);
    float32Array = new Float32Array(tokens.length);
    for (let i = 0; i < tokens.length; i++) {
      float32Array[i] = parseFloat(tokens[i]) || 0.0;
    }
  } else {
    const b64 = dataElem.textContent.replace(/\s+/g, '');
    const binaryStr = atob(b64);
    let bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    if (encoding.toLowerCase().includes('gzip')) {
      bytes = inflate(bytes);
    }

    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    if (dataType.includes('FLOAT32')) {
      float32Array = new Float32Array(buffer);
    } else if (dataType.includes('INT32')) {
      const i32 = new Int32Array(buffer);
      float32Array = new Float32Array(i32.length);
      for (let i = 0; i < i32.length; i++) float32Array[i] = i32[i];
    } else if (dataType.includes('UINT32')) {
      const u32 = new Uint32Array(buffer);
      float32Array = new Float32Array(u32.length);
      for (let i = 0; i < u32.length; i++) float32Array[i] = u32[i];
    } else if (dataType.includes('FLOAT64')) {
      const f64 = new Float64Array(buffer);
      float32Array = new Float32Array(f64.length);
      for (let i = 0; i < f64.length; i++) float32Array[i] = f64[i];
    } else if (dataType.includes('INT16')) {
      const i16 = new Int16Array(buffer);
      float32Array = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) float32Array[i] = i16[i];
    } else if (dataType.includes('UINT8')) {
      const u8 = new Uint8Array(buffer);
      float32Array = new Float32Array(u8.length);
      for (let i = 0; i < u8.length; i++) float32Array[i] = u8[i];
    } else {
      float32Array = new Float32Array(buffer);
    }
  }

  let scalars = float32Array;
  if (dim1 > 1 && float32Array.length >= dim0 * dim1) {
    scalars = new Float32Array(dim0);
    for (let i = 0; i < dim0; i++) {
      scalars[i] = float32Array[i];
    }
  }

  let hemisphere = null;
  const mdEntries = xmlDoc.querySelectorAll('MetaData MD');
  for (const md of mdEntries) {
    const nameElem = md.querySelector('Name');
    const valElem = md.querySelector('Value');
    if (nameElem && valElem) {
      const n = (nameElem.textContent || '').trim().toLowerCase();
      const v = (valElem.textContent || '').trim().toLowerCase();
      if (n.includes('structure') || n.includes('hemisphere') || n.includes('side')) {
        if (v.includes('left') || v === 'l' || v === 'cortexleft') hemisphere = 'left';
        else if (v.includes('right') || v === 'r' || v === 'cortexright') hemisphere = 'right';
      }
    }
  }

  return {
    scalars,
    numVertices: dim0,
    numVolumes: dim1,
    intent: targetDataArray.getAttribute('Intent') || 'NIFTI_INTENT_NONE',
    hemisphere
  };
}

