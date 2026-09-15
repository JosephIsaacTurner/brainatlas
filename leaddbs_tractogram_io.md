# LEAD-DBS Tractogram Format + Browser 3D Loading

## The file format

LEAD-DBS atlas tractograms are `.mat` files saved as MATLAB v7.3, which is really HDF5 under the hood. Key top-level fields:

- **`fibcell`** — shape `(2, 1)`, one cell per hemisphere (index 0 = right, 1 = left). Each cell holds an array of HDF5 references, one per streamline. Dereferencing a streamline ref gives a `(3, N)` float array of XYZ mm coordinates (MNI space).
- **`vals`** — shape `(2, 1)`, mirrors `fibcell`. Each cell is a reference to a `(1, N_streamlines)` array of per-streamline scalars (e.g. effect size).
- **`fibcolor`** — `(3, 2)` array, RGB endpoints of the colormap used for the value range.
- **`info/`** — metadata group (connectome name as ASCII char codes, streamline counts per side).

Everything nests two levels deep: top-level dataset → reference → resolve → (sometimes) another reference → resolve → actual array. This is the main complexity, in both Python (`h5py`) and JS.

## Goal

Load one of these `.mat` files directly in the browser and render the streamlines as a dynamic 3D mesh (three.js), colored by `vals`, without a server-side conversion step. This lets us preview/QA any atlas tractogram just by pointing the tool at a file.

**Pipeline:**
1. Read raw bytes of the `.mat` file (HDF5) via `h5wasm` in-browser.
2. Walk `fibcell` → dereference → dereference again → build array of `Float32Array(3, N)` streamlines.
3. Walk `vals` the same way, normalize against min/max.
4. Build a three.js `LineSegments` (or tube geometry) per streamline, colored via the `vals`-driven colormap.
5. Render in an orbit-controlled scene.

## Test file (hardcoded path for now)

```js
const TEST_MAT_PATH = '/Users/jiturner/Documents/MATLAB/leaddbs/templates/space/MNI152NLin2009bAsym/atlases/Human Dysfunctome Atlas (Hollunder 2024)/midline/Sweet_Streamline_PD.mat';
const TEST_COLORBAR_SVG = '/Users/jiturner/Documents/MATLAB/leaddbs/templates/space/MNI152NLin2009bAsym/atlases/Human Dysfunctome Atlas (Hollunder 2024)/midline/Sweet_Streamline_PD_colorbar.svg';
```

Known ground truth from the Python exploration, to validate against once loaded in JS:

- Right hemisphere: 5423 streamlines, vals range ~0.232–0.374
- Left hemisphere: 3774 streamlines, vals range ~0.232–0.364
- Total: 9197 streamlines (matches `info/PosAmount`)

## Open question

Whether `h5wasm` resolves nested HDF5 object references cleanly on this file — needs a quick spike before building the full loader.