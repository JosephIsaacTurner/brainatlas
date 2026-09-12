import { inflate } from 'pako';

// Base URL configured by Vite (e.g. './' or '/brainatlas/')
export const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL : './';

/**
 * Resolve a relative path against the app's base URL.
 * Ensures compatibility with any deployment subpath (e.g. /brainatlas/ or custom domain root).
 */
export function getDataUrl(relativePath) {
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  return `${base}${cleanPath}`;
}

/**
 * Fetch and return an ArrayBuffer, automatically decompressing if it's gzip-compressed.
 * Transparently handles:
 *  1. Static hosting (GitHub Pages) where .bin.gz is served without Content-Encoding: gzip
 *  2. HTTP servers (Node server.mjs) where browser automatically decompresses due to Content-Encoding: gzip
 *  3. Uncompressed binary files (.mz3, .gii, etc.)
 */
export async function fetchBinary(url) {
  const fullUrl = getDataUrl(url);
  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error(`Failed to load binary asset from ${fullUrl}: ${res.statusText} (${res.status})`);
  }

  const buffer = await res.arrayBuffer();
  const u8 = new Uint8Array(buffer);

  // Check for gzip magic header (0x1F, 0x8B)
  if (u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b) {
    // Attempt native browser DecompressionStream first for optimal performance
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(buffer);
        writer.close();
        const decompressed = await new Response(ds.readable).arrayBuffer();
        return decompressed;
      } catch (e) {
        console.warn('DecompressionStream failed, falling back to pako inflate:', e);
      }
    }
    // Fallback to pako
    const inflated = inflate(u8);
    return inflated.buffer;
  }

  return buffer;
}

/**
 * Fetch and return JSON metadata.
 */
export async function fetchJson(url) {
  const fullUrl = getDataUrl(url);
  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error(`Failed to load JSON metadata from ${fullUrl}: ${res.statusText} (${res.status})`);
  }
  return await res.json();
}
