# Brain and Skull Atlas

A client-side JavaScript/WebGL neuroimaging viewer featuring **multi-plane synchronized oblique volumetric mesh clipping**, default **velvet render styling**, multi-layer anatomical structures, functional **NIfTI overlays**, and real-time anatomical orientation.

---

## What's New

1. **White & Dark Background Theme**:
   - Easily switch between Dark (`#121316`) and White (`#ffffff`) background modes via the top toolbar button, control panel, or <kbd>T</kbd> hotkey.
   - Text, toolbars, HUD, and 3D orientation cube dynamically adapt for high contrast in both themes.

2. **MULTI-Plane Synchronized Volumetric Clipping**:
   - Supports up to 3 simultaneous clipping planes (**Plane 1**, **Plane 2**, **Plane 3**).
   - Each plane has independent Azimuth ($0^\circ\text{--}360^\circ$), Elevation ($-90^\circ\text{--}+90^\circ$), Depth ($-90\text{mm}\text{--}+90\text{mm}$), and Invert toggle.
   - **Intersection-Clipped Slice Quads**: Intersecting cut planes clip each other, creating clean orthogonal quadrant cuts, tri-planar corner cuts, or custom oblique wedges with no protruding geometry into cut-away space.
   - Includes presets:
     - *Single Coronal Anterior*
     - *Single Axial Superior*
     - *Single Sagittal Right*
     - *Dual Quadrant Cut (Axial + Coronal)*
     - *Tri-Planar Corner Cut (Axial + Coronal + Sagittal)*
     - *Oblique Wedge Cut*

3. **Toggleable Brain Mesh**:
   - The primary brain mesh ([`surf.obj`](file:///Users/jiturner/Repositories/joseph_skulls/scratchwork/surf.obj)) can now be toggled on/off independently via the toolbar button, control panel, or <kbd>B</kbd> hotkey.
   - Includes an Opacity slider ($0.05\text{--}1.0$) to make the cortex translucent, exposing internal deep brain structures and ventricles.

4. **Functional & Statistical NIfTI Overlays (`.nii` / `.nii.gz`)**:
   - Drag & drop any `.nii` or `.nii.gz` file directly into the browser window, or use the file explorer button in the controls.
   - Rendered on the oblique volumetric cut planes in real time.
   - Independent overlay opacity ($0.0\text{--}1.0$), threshold min/max sliders, and dedicated colormaps (*Hot*, *Rainbow/Jet*, *Cool*, *Emerald Green*, *Electric Red*, *Electric Blue*, *Violet*).

5. **Hardcoded Ventricle Mask Mesh**:
   - Source: [`mni152_smwp_ventricles_ref_0p1.obj`](file:///Users/jiturner/Repositories/joseph_skulls/scratchwork/mni152_smwp_ventricles_ref_0p1.obj).
   - Easily toggled on/off via toolbar button, GUI, or <kbd>V</kbd> hotkey.
   - Customizable color (default luminous cyan `#00d2ff`), opacity, and clipping options.

6. **Custom `.obj` Mesh Drag-and-Drop & Exploration**:
   - Drag & drop any `.obj` 3D mesh onto the viewer, or browse with the file picker.
   - Custom meshes receive the exact same clipping planes, render styles (Velvet, Phong, Matte, X-Ray), color picker, opacity, and toggle controls.

7. **Multiple Skull Mesh Options**:
   - Choose between two MNI-warped skull models via the Skull dropdown:
     - **Full Skull (MNI Warped)** ([`full_skull_mni_warped.obj`](file:///Users/jiturner/Repositories/joseph_skulls/data/output/skulls/full_skull/full_skull_mni_warped.obj))
     - **Ohio Skull (MNI Warped)** ([`ohio_skull_mni_warped_mandible_fixed.obj`](file:///Users/jiturner/Repositories/joseph_skulls/data/output/ohio_skull/ohio_skull/ohio_skull_mni_warped_mandible_fixed.obj))
   - Easily toggled on/off via toolbar button or <kbd>K</kbd> hotkey.

8. **Soft Tissue / Skin Mesh**:
   - Extracted from [`skin.nii`](file:///Users/jiturner/Repositories/joseph_skulls/data/raw/NYHead/NYhead_segmentations/skin.nii) using `marching_cubes` in `analysis_env`.
   - Aligned in MNI world coordinates.
   - Toggled on/off via toolbar button or GUI, with adjustable opacity (default 0.35 translucent skin shell) and clipping options.

---

## Quick Start

The server runs on port 3000:

```bash
cd /Users/jiturner/Repositories/surf-ice/turner_browser

# Start the standalone server:
npm start

# Or start in Vite development mode with hot-reload:
npm run dev
```

Open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| **C** or **X** | Toggle Multi-Plane Clipping On/Off |
| **B** | Toggle Brain Mesh On/Off |
| **K** | Toggle Skull Mesh On/Off |
| **V** | Toggle Ventricle Mask On/Off |
| **T** | Toggle White / Dark Background Theme |
| **R** | Reset Camera View |
| **1 / 2 / 3 / 4** | Snap to Axial, Coronal, Sagittal, or Oblique View |
| **↑ / ↓** | Step Primary Cut Plane Depth Forward / Backward |
| **Drag & Drop** | Drop any `.obj` or `.nii` / `.nii.gz` file onto the window |
