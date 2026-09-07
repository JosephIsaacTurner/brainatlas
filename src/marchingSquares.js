/**
 * Marching Squares 2D Isocontour Generator
 * 
 * Computes isocontour line segments across a 2D scalar grid for statistical overlay thresholding.
 * Supports:
 * - "Contour greater than threshold" (isovalue T_pos, boundary where value crosses T_pos)
 * - "Contour less than threshold" (isovalue T_neg, boundary where value crosses T_neg)
 * - Linear interpolation along grid edges for sub-cell precision
 */
export class MarchingSquares {
  /**
   * Generates line segments for a given 2D scalar grid.
   * 
   * @param {Float32Array|Array} grid - 1D array of scalar values of length W * H (row-major: y * W + x)
   * @param {number} W - Grid width
   * @param {number} H - Grid height
   * @param {number} threshold - Target contour threshold
   * @param {boolean} isLessThan - If true, evaluates region where value <= threshold
   * @param {number} outWidth - Target output canvas width in pixels
   * @param {number} outHeight - Target output canvas height in pixels
   * @returns {Array<[[x1, y1], [x2, y2]]>} Array of 2D line segments in target coordinates
   */
  static generateContour(grid, W, H, threshold, isLessThan = false, outWidth = W, outHeight = H) {
    if (!grid || W < 2 || H < 2 || !Number.isFinite(threshold)) return [];

    const segments = [];
    const scaleX = outWidth / (W - 1);
    const scaleY = outHeight / (H - 1);

    const isAbove = (val) => isLessThan ? (val <= threshold) : (val >= threshold);

    const interp = (va, vb) => {
      const denom = vb - va;
      if (Math.abs(denom) < 1e-7) return 0.5;
      const t = (threshold - va) / denom;
      return Math.max(0.0, Math.min(1.0, t));
    };

    for (let y = 0; y < H - 1; y++) {
      const rowOffset0 = y * W;
      const rowOffset1 = (y + 1) * W;

      for (let x = 0; x < W - 1; x++) {
        const v0 = grid[rowOffset0 + x];         // Top-Left
        const v1 = grid[rowOffset0 + (x + 1)];   // Top-Right
        const v2 = grid[rowOffset1 + (x + 1)];   // Bottom-Right
        const v3 = grid[rowOffset1 + x];         // Bottom-Left

        // 4-bit corner classification
        let c = 0;
        if (isAbove(v0)) c |= 8;
        if (isAbove(v1)) c |= 4;
        if (isAbove(v2)) c |= 2;
        if (isAbove(v3)) c |= 1;

        if (c === 0 || c === 15) continue;

        // Linearly interpolated edge crossings in pixel coordinates
        const x_px = x * scaleX;
        const x1_px = (x + 1) * scaleX;
        const y_px = y * scaleY;
        const y1_px = (y + 1) * scaleY;

        const ptTop = [x_px + interp(v0, v1) * scaleX, y_px];
        const ptRight = [x1_px, y_px + interp(v1, v2) * scaleY];
        const ptBottom = [x_px + interp(v3, v2) * scaleX, y1_px];
        const ptLeft = [x_px, y_px + interp(v0, v3) * scaleY];

        switch (c) {
          case 1: segments.push([ptLeft, ptBottom]); break;
          case 2: segments.push([ptBottom, ptRight]); break;
          case 3: segments.push([ptLeft, ptRight]); break;
          case 4: segments.push([ptTop, ptRight]); break;
          case 5: segments.push([ptLeft, ptTop], [ptBottom, ptRight]); break;
          case 6: segments.push([ptTop, ptBottom]); break;
          case 7: segments.push([ptLeft, ptTop]); break;
          case 8: segments.push([ptTop, ptLeft]); break;
          case 9: segments.push([ptTop, ptBottom]); break;
          case 10: segments.push([ptTop, ptRight], [ptLeft, ptBottom]); break;
          case 11: segments.push([ptTop, ptRight]); break;
          case 12: segments.push([ptLeft, ptRight]); break;
          case 13: segments.push([ptBottom, ptRight]); break;
          case 14: segments.push([ptLeft, ptBottom]); break;
        }
      }
    }

    return segments;
  }
}
