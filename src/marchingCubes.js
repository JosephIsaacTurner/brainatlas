import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * Generates a 3D surface mesh (BufferGeometry) from a scalar volumetric grid at a given isovalue threshold.
 * Transformed directly into world MNI space via the NIfTI affine matrix.
 *
 * @param {Float32Array|Array} data - 1D scalar grid of length nx * ny * nz
 * @param {[number, number, number]} dims - Volume dimensions [nx, ny, nz]
 * @param {THREE.Matrix4} affine - 4x4 matrix mapping voxel coords (i, j, k) to MNI (x, y, z)
 * @param {number} threshold - Isovalue cutoff threshold
 * @param {number} [step=1] - Grid step for subsampling (1 = full voxel resolution)
 * @returns {THREE.BufferGeometry|null}
 */
export function generateMeshFromVolume(data, dims, affine, threshold, step = 1) {
  const [nx, ny, nz] = dims;
  const s = Math.max(1, Math.floor(step));

  const getIdx = (x, y, z) => x + y * nx + z * nx * ny;

  const positions = [];

  // Corner offsets for a cube
  // 0: (0,0,0), 1: (s,0,0), 2: (s,s,0), 3: (0,s,0)
  // 4: (0,0,s), 5: (s,0,s), 6: (s,s,s), 7: (0,s,s)
  const cornerOffsets = [
    [0, 0, 0],
    [s, 0, 0],
    [s, s, 0],
    [0, s, 0],
    [0, 0, s],
    [s, 0, s],
    [s, s, s],
    [0, s, s]
  ];

  // Edges connect pairs of corners:
  // e0: 0-1, e1: 1-2, e2: 2-3, e3: 3-0
  // e4: 4-5, e5: 5-6, e6: 6-7, e7: 7-4
  // e8: 0-4, e9: 1-5, e10: 2-6, e11: 3-7
  const edgeCorners = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  const vertList = new Float32Array(12 * 3);

  // Temporary vectors for matrix transform
  const tmpV = new THREE.Vector3();

  for (let z = 0; z < nz - s; z += s) {
    for (let y = 0; y < ny - s; y += s) {
      for (let x = 0; x < nx - s; x += s) {
        // Sample corner values
        const v0 = data[getIdx(x, y, z)];
        const v1 = data[getIdx(x + s, y, z)];
        const v2 = data[getIdx(x + s, y + s, z)];
        const v3 = data[getIdx(x, y + s, z)];
        const v4 = data[getIdx(x, y, z + s)];
        const v5 = data[getIdx(x + s, y, z + s)];
        const v6 = data[getIdx(x + s, y + s, z + s)];
        const v7 = data[getIdx(x, y + s, z + s)];

        let cubeindex = 0;
        if (v0 >= threshold) cubeindex |= 1;
        if (v1 >= threshold) cubeindex |= 2;
        if (v2 >= threshold) cubeindex |= 4;
        if (v3 >= threshold) cubeindex |= 8;
        if (v4 >= threshold) cubeindex |= 16;
        if (v5 >= threshold) cubeindex |= 32;
        if (v6 >= threshold) cubeindex |= 64;
        if (v7 >= threshold) cubeindex |= 128;

        // Completely inside or outside
        if (cubeindex === 0 || cubeindex === 255) continue;

        const edges = edgeTable[cubeindex];
        if (edges === 0) continue;

        const vals = [v0, v1, v2, v3, v4, v5, v6, v7];

        // Find vertices where the surface intersects the edges
        for (let e = 0; e < 12; e++) {
          if (edges & (1 << e)) {
            const [c1, c2] = edgeCorners[e];
            const val1 = vals[c1];
            const val2 = vals[c2];
            const off1 = cornerOffsets[c1];
            const off2 = cornerOffsets[c2];

            const denom = val2 - val1;
            const mu = Math.abs(denom) > 1e-7 ? (threshold - val1) / denom : 0.5;

            const vx = x + off1[0] + mu * (off2[0] - off1[0]);
            const vy = y + off1[1] + mu * (off2[1] - off1[1]);
            const vz = z + off1[2] + mu * (off2[2] - off1[2]);

            vertList[e * 3 + 0] = vx;
            vertList[e * 3 + 1] = vy;
            vertList[e * 3 + 2] = vz;
          }
        }

        // Create triangles (wound counter-clockwise so outward normals face away from >= threshold interior)
        const baseOffset = cubeindex << 4;
        for (let i = 0; triTable[baseOffset + i] !== -1; i += 3) {
          // TriTable has clockwise winding when bit is set for >= threshold; swap e1 and e3 for outward CCW winding
          const e1 = triTable[baseOffset + i + 2];
          const e2 = triTable[baseOffset + i + 1];
          const e3 = triTable[baseOffset + i];

          // Point 1
          tmpV.set(vertList[e1 * 3], vertList[e1 * 3 + 1], vertList[e1 * 3 + 2]);
          if (affine) tmpV.applyMatrix4(affine);
          positions.push(tmpV.x, tmpV.y, tmpV.z);

          // Point 2
          tmpV.set(vertList[e2 * 3], vertList[e2 * 3 + 1], vertList[e2 * 3 + 2]);
          if (affine) tmpV.applyMatrix4(affine);
          positions.push(tmpV.x, tmpV.y, tmpV.z);

          // Point 3
          tmpV.set(vertList[e3 * 3], vertList[e3 * 3 + 1], vertList[e3 * 3 + 2]);
          if (affine) tmpV.applyMatrix4(affine);
          positions.push(tmpV.x, tmpV.y, tmpV.z);
        }
      }
    }
  }

  if (positions.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  return geom;
}
