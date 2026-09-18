New Request: Complete? [x] 
[x] Bugfix: Multiplanar view when zoomed in, the moving the crosshairs around the slice planes isn't relocating to the actual location of the cursor anatomically-- it looks like its locating to the point that the cursor would be on WITHOUT the zoom. So if you start moving the crosshairs around while zoomed in, it goes crazy. Moreover, can we make the zoom applied to each of the three multiplanar viewports independently, so that you can zoom in on one plane and not the others, and have different zoom levels for each of the three planes.
  - Resolved positive feedback loop during crosshair navigation: replaced continuous camera `lookTarget` lerping to `crossPoint` with plane-anchored `cutPoint` and `panOffsets[i]`. Slices now remain stable under cursor interaction while moving crosshairs, raycasting stably and linearly from screen cursor to anatomical voxels without jumping or erratic acceleration.
  - Implemented independent per-plane zoom: converted `this.zoom` scalar to `this.zooms = [1.0, 1.0, 1.0]` and `this.panOffsets = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()]`.
  - Added dedicated per-pane zoom control badges (`[−] 1.0x [+] [⌖]`) to `.mp-pane-header` for Axial, Coronal, and Sagittal viewports, allowing independent zooming, click-to-reset, and centering on crosshairs.
  - Shift / Ctrl / Alt / Meta + mouse wheel on any slice plane now independently zooms that specific viewport.
  - Added right-click / middle-click drag to pan zoomed viewports, and double-clicking any slice re-centers view on crosshairs.
  - Updated camera frustum calculation (`baseHalfExtent = 115 / this.zooms[i]`) and retained master slider in modal header for uniform zoom adjustments.
[x] Left-hand menu "Show Imaging Slice" toggle button not disabling the imaging slice, although the top "Show Imaging Slice" toggle works well.
  - Added `setSliceVisible(visible)` method to `ClippingManager` to update `this.sliceVisible` and trigger `this.update()`.
  - Fixed Lil-GUI mutation race in `UIManager.setSliceVisible`: Lil-GUI mutates the bound property prior to `onChange`, causing the previous `sliceVisible !== visible` check to evaluate false. Removed conditional guard, ensuring `this.clippingManager.setSliceVisible(visible)` is always invoked and controller displays are refreshed.
[x] Change dural fold mesh default style to Velvet (not bone)
  - Updated default render style in `src/meshManager.js`: initialized `this.duralFoldsStyle = 'velvet'`, configuring the initial shader material to velvet upon startup and setting the Lil-GUI dropdown default to Velvet.

New Request: Complete? [x]
[x] Once again, replace the arterial mesh with an even better one: /Users/jiturner/Repositories/Standard/UBA167/manually_refined_again_final.obj. 
  - Updated `ARTERIAL_OBJ_PATH` to `/Users/jiturner/Repositories/Standard/UBA167/manually_refined_again_final.obj` in `build_cache.mjs`.
  - Backed up raw mesh to `public/data/raw/arterial.obj`.
  - Re-cached `arterial.bin.gz` (1.35 MB, 49,120 vertices, 98,268 triangles) and `arterial.json` in both `.cache/` and `public/data/`.
  - Rebuilt static distribution via `npm run build` updating `dist/data/arterial.*`.
c
New Request: Completed. [x]
[x] The search bar is working well, but not quit so well for the subcortical meshes. It finds them, but if you click it doesn't bring you to the right menu and doesn't make it visible. It's working great for the skull/sub-bones.
  - Fixed method name mismatch: Added `setAdditionalStructureEnabled` alias on `MeshManager` pointing to `toggleAdditionalBrainStructure`.
  - Updated structure search action in `UIManager.buildSearchIndex`: switches directly to the `'meshes'` tab, calls `toggleAdditionalBrainStructure(struct.id, true)`, updates checkbox and widget summary, enables overall brain visibility (`setBrainVisible(true)`), expands `brainFolder`, and smoothly scrolls the GUI viewport directly to the Additional Structures widget.
[x] Interestingly, when loading lead-DBS format tractograms, there are some interesting behaviors to possibly modify. 
    [x] It seems to be automatically loading the leaddbs colorbar/effect size measures. I think this shouldn't be initial-- instead, when people select Gradient Metric dropdown, and then from there the "Streamline Values / Effect Size" option, then it should have a file explorer that lets you then manually select the leaddbs colorbar svg file, if that makes sense. It should already know the home directory corresponding to the tractogram file, and pre-populate the file explorer to that directory, but it should not automatically load the colorbar as soon as you drag/drop the tractogram. 
      - Removed automatic forcing of `colormap = 'leaddbs'` and `colormapMetric = 'vals'` upon loading `.mat` files in `TractographyManager.loadLeadDBSFromFile`. Dropped Lead-DBS tractograms now respect the user's current colormap and directional settings (defaulting to standard RGB / Principal Direction).
      - Added file picker trigger when switching the Gradient Metric dropdown to "Streamline Values / Effect Size" (`vals`), prompting for the colorbar `.svg` file if not already loaded.
      - Retains directory handles using `window.showOpenFilePicker` with fallback to native file input, pre-populating the file explorer to the directory corresponding to the tractogram.
      - Added dedicated `🎨 Load Colorbar (.svg)...` button in the Tractography settings panel and enabled dragging and dropping `.svg` colorbar files directly onto the viewer (either alone or alongside the `.mat` tractogram).
    [x] It doesn't appear to be able to colormap by any metric BESIDES the leaddbs colorbar. We want it to be able to use other gradient metrics including the directional ones, not rely on a lead-dbs colorbar or even require one. 
      - Decoupled metric computation in `TractographyManager.computeColorsForTract`: fixed line 842 condition from `(this.colormapMetric === 'vals' || tract.isLeadDBS)` to `(this.colormapMetric === 'vals' && tract.hasScalars && tract.scalars)`.
      - Lead-DBS tractograms can now seamlessly use all gradient metrics (Principal Direction LR→AP→IS, Inferior-Superior Z, Anterior-Posterior Y, Left-Right X, Elevation Angle, Streamline Length) as well as all colormaps (Directional RGB, Rocket, Turbo, Viridis, Plasma, Inferno, Magma, Cividis, Cool-Warm, Rainbow, Hot, Cool, etc.).
      - When `leaddbs` colormap is selected, it evaluates custom LUTs extracted from SVG colorbars, falls back to `fibcolor` endpoints if present, and gracefully defaults to perceptually uniform `rocket`.
    [x] For some tractograms, it takes MINUTES to load and the window is frozen for this time. I understand if the io takes a long time, there might not be much we can do about it. But it would be nice to have a loading spinner or some sort of progress bar to let people know that the file is being processed. Most people will think the app is frozen and just close it. the browser even says "Page has stopped responding. Quit or Wait?" several times (you have to click wait) before some of these bigger ones are loaded. 
      - Added `#progress-modal` with progress card, spinner, progress bar track/fill, live percentage readout, and status messaging in `index.html` and `src/style.css` (with dark and light mode overrides).
      - Implemented `showProgressModal`, `updateProgressModal`, and `hideProgressModal` in `UIManager`.
      - Introduced cooperative event-loop yielding (`await new Promise(r => setTimeout(r, 0))`) every 50–200 streamlines during parsing, WASM extraction, and 3D geometry construction, preventing UI freezing and completely eliminating the "Page has stopped responding. Quit or Wait?" browser warning.
    [x] There are some lead-dbs tractograms that aren't loading at all and intermittently gives errors like Error loading dropped file: MAT file is missing "fibcell" dataset (not a valid Lead-DBS tractogram). (some filepaths you can test on:'/Users/jiturner/Documents/MATLAB/leaddbs/templates/space/MNI152NLin2009bAsym/atlases/DBS Tractography Atlas (Middlebrooks 2020)/rh/Fasciculus_Lenticularis.mat', '/Users/jiturner/Documents/MATLAB/leaddbs/templates/space/MNI152NLin2009bAsym/atlases/DBS Tractography Atlas (Middlebrooks 2020)/rh/STN_limbic_tract.mat', '/Users/jiturner/Documents/MATLAB/leaddbs/templates/space/MNI152NLin2009bAsym/atlases/Hyperdirect Pathway Atlas (Treu 2020)/midline/Hyperdirect_Pathway.mat'
      - Diagnosed that Lead-DBS atlases utilize four distinct formats: Level 5 MAT (`MATLAB 5.0`) with `fibers`/`idx`, Level 5 MAT with `fibcell`, v7.3 HDF5 (`MATLAB 7.3`) with `fibers`/`idx`, and v7.3 HDF5 with `fibcell`.
      - Built a pure JavaScript Level 5 MAT binary parser in `src/leadDBSLoader.js` using `pako.inflate` to parse `miCOMPRESSED` tags, `miMATRIX` structures, column-major numeric arrays, and nested cell arrays. Parses `Fasciculus_Lenticularis.mat` in 2.3ms, `STN_limbic_tract.mat` in 23.7ms, and `Hyperdirect_Pathway.mat` in 0.4ms.
      - Upgraded the v7.3 HDF5 parser in `src/leadDBSLoader.js` to support both `fibcell` nested references and `fibers`/`idx` contiguous datasets (e.g. `Brainstem Connectome CST.mat` with 1.6M points in 211ms).
      - Added `parseSvgColorbar(svgText)` supporting continuous raster gradient strips embedded as base64 PNGs and SVG `<linearGradient>` stops.


New Request: Completed. [x]
[x] Bugfix: For tractography, when I drag/drop a new tract (.trk.gz), it duplicates the tracts dropdown multiselect menu of the available tract toggle/swatches. There become two copies in a row.
  - Resolved Lil-GUI DOM leak by explicitly querying and removing `.custom-multiselect-controller` and destroying child controllers before recreating.
  - Implemented `UIManager.refreshTractMultiselect()` to refresh the existing tract checklist DOM, badges, and button labels in-place without rebuilding the folder.
  - Updated drag-and-drop and file upload handlers to invoke `refreshTractMultiselect()` instead of re-running `setupTractographyControls`.
[x] Bugfix: The "fill window" function on the multiplanar viewer is only really filling ~60% of the window, anchored on the top right.
  - Diagnosed interaction with global `html { zoom: 0.75 }`: CSS `100vw`/`100vh` under 75% zoom resulted in a 75%x75% scaled box (~56% area).
  - Replaced viewport units with `width: 100% !important; height: 100% !important; inset: 0 !important; max-width: none !important; max-height: none !important;`.
  - Cleared inline drag dimensions (`width`, `height`, `left`, `top`) on maximize and reliably restored them upon un-maximize.
[x] New feature: Add zoom option within the multiplanar viewer that zooms in on the crosshairs point.
  - Added `this.zoom = 1.0` state (range `1.0x` to `6.0x`) and `setZoom(val)` method in `src/multiplanarViewer.js`.
  - Camera frustum half-extents scale dynamically (`baseHalfExtent = 115 / this.zoom`), while camera focus points lerp towards `this.getCrosshairIntersectionPoint()`.
  - Added zoom slider, numeric readout, and reset button to modal header, plus modifier-key wheel zooming (Shift, Ctrl, Alt, Meta + wheel) inside viewports.
[x] Set "interpolate volume" to FALSE by default (the base volume)
  - Configured `this.interpolate = false;` in `src/volumeManager.js`, defaulting texture filtering to `THREE.NearestFilter`.
[x] For tractography, when you drag/drop a new tract in, it should auto-enable tract visibility even if "tracts" were disabled before import.
  - Added `this.setVisible(true)` in `loadTRKFromFile` and `loadLeadDBSFromFile` in `src/tractographyManager.js`.
  - Added `this.setTractsVisible(true)` on drag-and-drop and file input upload in `src/ui.js`, synchronizing the toolbar toggle and status indicator dot.
[x] New feature: For nifti overlays, there should be a button called "Create 3d mesh" with a threshold modal.
  - Created `src/marchingCubes.js` providing isocontour polygonization with CCW outward normals and direct MNI coordinate mapping via volume affine matrix.
  - Added "✨ Create 3D Mesh..." button in overlay folders under `setupOverlayControls` in `src/ui.js`.
  - Implemented `openCreateMeshModal(ov)` with threshold range slider, numeric input, mesh name, color picker, and Cancel/Create buttons.
  - Generated meshes are registered in-memory via `meshManager._registerCustomMesh`, added to scene, and exposed in the Custom Meshes GUI.
[x] New feature: Be able to drag/drop .mat files corresponding to lead-DBS tractogram and view them as tracts.
  - Created `src/leadDBSLoader.js` leveraging `h5wasm` to parse MATLAB v7.3 HDF5 tractograms directly in-browser.
  - Dereferences 2-level nested `fibcell` cell arrays into 3D streamlines, parses per-streamline scalars (`vals`), and parses colormap endpoints (`fibcolor`).
  - Added `loadLeadDBSFromFile` in `src/tractographyManager.js`, integrated `Lead-DBS Colorbar` (`leaddbs`) and `Streamline Values / Effect Size` (`vals`) colormap options, and wired `.mat` drag-and-drop and file chooser.
[x] New feature: Top-right menu should also have a little magnifying lense icon somewhere in the top right that when clicked, opens a modal window with a search bar.
  - Added `#btn-search-structures` magnifying glass button to `.sidebar-tabs` in the top right of the right sidebar.
  - Implemented `openStructureSearchModal()` and `buildSearchIndex()` indexing all brain surface models, 12 subcortical brain structures, monolithic skull, 22 Ohio skull sub-bones, soft tissue, vasculature, ventricles, dural folds, 32+ tract bundles, base MRI volumes, and active statistical overlays.
  - Integrated real-time multi-term search, keyboard navigation (`↑`/`↓`, `Enter`, `Esc`), and shortcut triggers (`/` and `⌘K`/`Ctrl+K`).
  - Selecting an item switches to the appropriate tab, opens the folder, and activates the structure.

New Request: Completed. [x]
[x] For multiplanar viewer, there should be a toggle button for "Radiological Orientation" to put L on screen Right (this should be default BTW). Actually we need to make sure that the anatomical L/R to screen L/R is consistent within the three panels - currently it's inconsistent.
  - Added `#mp-radiological-toggle` checkbox in the Multiplanar Slice Viewer header, enabled (checked) by default.
  - Resolved previous orientation inconsistency: Axial and Coronal views now both place Patient Left on Screen Right (and Patient Right on Screen Left) under Radiological orientation.
  - When unchecked (Neurological orientation), both Axial and Coronal views place Patient Left on Screen Left and Patient Right on Screen Right.
  - Slices, cameras, crosshairs, raycasting, and dynamic viewport orientation labels (A/P, S/I, L/R) synchronize seamlessly in both modes.
[x] Solid color picking options on tractography seems like some redundant/ambiguous controls. For the dropdown multiselect for the provided tracts, there's a color swatch selector. But then below that we also have a "Solid Color" picker and its not clear if it controls the color of the default tract(s) and if so which one(s).
  - Streamlined Tractography Color Mode into `'Colormap / Directional'` vs `'Tract Colors'`.
  - Removed redundant/confusing global "Solid Color" picker controller from the Lil-GUI panel; each tract's solid color is directly and clearly managed via its individual swatch popover in the tract multiselect checklist.
[x] In multiplanar viewer, can we display the anatomical label of the voxel the crosshairs is selecting, just next to where we are showing that voxel's intensity at the bottom? There are only three default atlases with labels currently, the tissue/structure/substructure atlas. There's an excel spreadsheet that encodes the labels that map onto voxel intensity values: /Users/jiturner/Repositories/Standard/manjon_atlas/HoliBrain_Protocol_v1.0.xlsx
  - Extracted 10 tissue classes, 54 structure labels, and 352 substructure labels from `HoliBrain_Protocol_v1.0.xlsx` into `public/data/atlas_labels.json`.
  - Re-cached `volume_substructure` as `float16` to preserve all 352 discrete integer labels without loss or uint8 quantization collisions.
  - Updated `updateVoxelReadout(worldPoint)` in `src/multiplanarViewer.js` to decode voxel values and display the anatomical structure name next to the voxel intensity (e.g. `Voxel: 14 (Left Thalamus)` or `Voxel: 4 (Deep GM)`) in real-time on hover, scrubbing, and click.
[x] Multiplanar viewer full window option that expands the modal to fill the whole window, and a button to restore to previous size.
  - Added `#mp-maximize-btn` ("Fill Window" / "Restore Size") in the modal header with responsive icon, and enabled double-clicking the header to toggle maximize.
  - Added `.multiplanar-modal.mp-maximized` styles with fixed viewport bounds (`100vw` x `100vh`), seamlessly adapting to global 75% CSS zoom.
  - Remembers and restores previous window bounds (position, width, height) when un-maximized.
[x] Is the base volume always being resampled/interpolated? By default we should interpolate, but there should be an option NOT to interpolate just as we do for NIfTI overlays.
  - Added `interpolate: true` state and `setInterpolate(enabled)` method on `VolumeManager`, dynamically switching textures between `THREE.LinearFilter` and `THREE.NearestFilter`.
  - Added `Interpolate Volume` toggle in the Base Volume Lil-GUI folder, instantly toggling interpolation across 3D slice planes and multiplanar views. 

New Request: Completed. [x]
[x] For tracts, make default to NOT clip them.
  - Set `this.clipTracts = false` by default in `src/tractographyManager.js`.
  - Tract lines initialize unclipped when enabled; 'Multi-Plane Clipping' in Tractography settings remains available to toggle on as needed.
[x] Can we apply html {zoom: 0.75} globally to the styles so that the entire app is scaled down to 75% of its original size? Literally just html { zoom: 0.75; }
  - Added global `html { zoom: 0.75; }` rule in `src/style.css`, scaling the entire app and all GUI elements cleanly down to 75% size.
[x] Make sure the bottom-left turntable spin controls text color changes appropriately depending on theme (currently hard to read on light theme)
  - Updated turntable panel text, header, label, unit, and number input styles in `src/style.css` with explicit `body.theme-white` overrides.
  - High-contrast slate styling (`#1e293b`, `#475569`, `#0f172a` text on `#f1f5f9` input) ensures crisp readability in light mode while maintaining clean dark mode styling.
[x] Push changes and update site accordingly.
  - Built production bundle with `npm run build`.
  - Committed and pushed to `origin main`, triggering automatic GitHub Pages deployment.

New Request: Completed. [x]
[x] Re-cache/process BigBrain volume without parenchyma/zero-masking (raw volume directly from /Users/jiturner/Repositories/Standard/BigBrain-to-ICBM2009asym-nonlin-500um.nii). Keep changes local, do not push yet.
  - Removed artificial zero-masking (`flat_data[flat_data >= 65534.0] = 0.0`) and removed `is_bigbrain` flag in `scripts/cache_volumes.py`.
  - Switched `volume_bigbrain` encoding to normalized `float16` (`THREE.HalfFloatType`), preserving full 16-bit histology dynamic range ([0.0, 65535.0]) without quantization posterization.
  - Re-generated `.cache/volume_bigbrain.bin.gz`, `public/data/volume_bigbrain.bin.gz` (~20.08 MB gzipped), `.cache/volume_bigbrain.json`, and `public/data/volume_bigbrain.json`.
  - Rebuilt static assets via `npm run build` updating `dist/data/volume_bigbrain.*`. Kept changes strictly local without pushing.

New Request: Completed. [x]
[x] Replace the current arterial mesh with this new one that I've improved even more: /Users/jiturner/Repositories/Standard/UBA167/manually_refined_again.obj
  - Updated `ARTERIAL_OBJ_PATH` to `/Users/jiturner/Repositories/Standard/UBA167/manually_refined_again.obj` in `build_cache.mjs`.
  - Backed up raw mesh to `public/data/raw/arterial.obj`.
  - Re-cached `public/data/arterial.bin.gz` (1.0 MB, 34,236 vertices, 68,440 triangles) and `public/data/arterial.json`.
[x] Commit all latest changes, push to github, update the github pages deployment.
  - Staged all changes and untracked binary/data assets.
  - Committed with clear descriptive message, pushed to `origin main`.
  - Triggered automatic GitHub Pages deployment workflow.

New Request: Completed. [x]
[x] Make the left-hand clipping/slicing menue defaulted to open on initial page load, including the Plane 1/Plan 2/Plane 3 submenus open.
  - In `src/ui.js` `initClippingGUI()`, removed the initial `.close()` call on each plane folder and called `.open()` on `pFolder` for Plane 1, Plane 2, and Plane 3.
  - Called `this.clipGui.open()` to ensure the root left-side clipping/slicing panel is fully expanded on initial page load.
[x] Bottom left under orientation cube should be checkbox for "Turntable Spin" (default off); if you turn it on, another element should appear to let you control rate of spin (seconds per full rotation). 
  - Added `#turntable-panel` directly under the anatomical orientation cube with a "Turntable Spin" checkbox (default unchecked).
  - Integrated dynamic rate control element that appears when "Turntable Spin" is checked, featuring a numeric input and synchronized range slider for controlling seconds per full rotation (from 1 to 300s, default 20s / rot).
  - In `src/viewer.js`, initialized `THREE.Clock()` and integrated `setTurntableSpin(enabled, secondsPerRotation)` and `setTurntableSpeed(secondsPerRotation)` updating `controls.autoRotate` and `controls.autoRotateSpeed = 60.0 / sec`, updating camera rotation smoothly across the vertical turntable axis with orientation cube synchronization.
  - Positioned bottom-left elements vertically aligned with comfortable spacing: Turntable controls at `bottom: 14px`, orientation cube at `bottom: 92px`, and Multiplanar Slice Viewer toggle at `bottom: 210px`.
[x] For our additional brain structures menue, we want to add another option: Pituitary (/Users/jiturner/Downloads/pituitary_v2.obj)
  - Processed `/Users/jiturner/Downloads/pituitary_v2.obj` and backed up the raw mesh to `public/data/raw/pituitary_v2.obj`.
  - Generated pre-cached binary files `public/data/struct_pituitary.bin.gz` (37.7 KB, 1435 vertices, 2866 triangles) and `public/data/struct_pituitary.json` with exact MNI bounds centered in the sella turcica.
  - Added `pituitary` to `ADDITIONAL_BRAIN_STRUCTURES` in `src/meshManager.js` and `build_cache.mjs` (default color `#ec4899`), integrating into the multiselect checklist, color pickers, material rendering, clipping, and overlay sampling.


New Request: Completed. [x]
[x] Bug: After some recent changes, the "Show Imaging Slice" isn't actually showing the volumetric slices at all anymore. Not sure what happened
  - Diagnosed root cause: `src/shaders/sliceShader.js` had `applyColormap()` defined before `colormapRocket()` and `colormapViridis()`. Because GLSL requires functions to be declared or defined before invocation, WebGL fragment shader compilation failed silently, preventing Three.js from rendering any slice quad meshes.
  - Reordered function definitions in `src/shaders/sliceShader.js` so that `applyColormap()` and `applyOverlayColormap()` are positioned after all colormap implementations (`colormapRocket`, `colormapViridis`, etc.), restoring full volumetric slice quad rendering across all clipping planes.
[x] We should make the "Sub-bones" menu available even when using "Full Skull", but as soon as people start trying to disable or enable only certain subbones, it natively switches to the Ohio skull (and this change would be reflected in the dropdown menu). That way the sub-bones menu appears without people knowing they haev to select the ohio skull in particular. If people then try to switch back from Ohio back to Full Skull, then it would switch back to the monolithic full skull and enable all sub-bones of course. 
  - Kept the "Sub-bones" multiselect widget displayed (`display: flex`) unconditionally inside the Skull menu so it is always accessible even when "Full Skull (MNI Warped)" is active.
  - Implemented `ensureOhioSkullMode()`: when a user unchecks/checks any sub-bone or clicks "All" / "None" in the Sub-bones menu while on Full Skull, `this.skullModelController.setValue('ohio')` natively switches the skull model to "Ohio Skull (MNI Warped)" and updates the lil-gui dropdown accordingly.
  - When switching back from Ohio to "Full Skull", `MeshManager.switchSkull('full')` restores the monolithic full skull mesh, hides all individual sub-bone meshes, and re-enables all 22 sub-bones.
  - Added `refreshSkullSubstructures()` to re-check all sub-bone checkboxes and update the summary button text to "All (22) selected" whenever returning to Full Skull.
[x] On initial load, the "Tracts" should not be toggled on.
  - Set `this.visible = false` on initial load in `src/tractographyManager.js`.
  - Removed initial `active` class from `#btn-toggle-tracts` and `#ind-tracts` in `src/ui.js`, so Tracts initializes un-toggled while keeping background loading of default cranial nerves intact for instant toggle-on.

New Request: Completed. [x]
Great job, now just some quick adjustments
[x] Its redundant to have the sub-parts of the Corpus Callosum as well as the full CC. Just have the sub-parts, not displaying the full CC. 
  - Removed `cc_full` (`CC.trk.gz`) from `BUILTIN_TRACTS` in `src/tractographyManager.js`. Preserved the 3 sub-parts: Anterior / Genu (`CC_ant.trk.gz`), Body (`CC_mid.trk.gz`), and Posterior / Splenium (`CC_post.trk.gz`).
[x] In the top center bar, we should have a master toggle for tractography. Have it by default turn on all cranial nerves, and have the other tracts off by default. Then you can turn on/off the other tracts as you want.
  - Added `#btn-toggle-tracts` (`title="Toggle Tractography (T)"`) in top toolbar Row 2 alongside Brain, Skull, Soft Tissue, Arterial, Venous, Ventricles, and Dural Folds. Configured active by default with indicator dot.
  - Set default built-in tract state: all 14 Cranial Nerve bundles default to `enabled: true`, and all other projection, association, and commissural tracts default to `enabled: false`.
  - Added `TractographyManager.initDefaultTracts()` called automatically on application startup in `src/main.js` to stream and render cranial nerves in the background.
  - Added `setTractsVisible(visible)` and wired up 'T' keyboard shortcut. If toggled ON when 0 tracts are enabled, it re-enables the default cranial nerves.
[x] We should be thoughtful in which parts of the menu are by default open and collapsed. I think some things seem to default to be open that shouldn't be. Honestly, I think everything in the right menu should default to collapsed on initial load. Then, if you open for example "Brain Mesh" sub-menu, it should keep the "Surf Ice Velvet Shading" sub-submenu closed until that is also open. Leave things open if people open them until they are closed intentionally.
  - Set all top-level folders and subfolders in the right sidebar GUI to collapsed on initial load (`.close()` called on `brainFolder`, `velvetFolder`, `skullFolder`, `skinFolder`, `arterialFolder`, `venousFolder`, `ventFolder`, `duralFolder`, `tractographyFolder`, `customMeshFolder`, `envFolder`, `volFolder`, `pFolder`, and overlay folders).
  - Removed auto-open triggers in `TractographyManager.onLoaded` so the tractography menu does not force itself open on background load.
  - Nested sub-folders (such as "Brain Velvet Shader Style", clipping plane folders, positive/negative overlay sub-folders) stay collapsed even when their parent folder is opened, remaining open only if the user explicitly opens them.
Some things to rename in the GUI:
[x] "Brain Mesh" -> "Brain"
  - Renamed `this.meshGui.addFolder('🧠 Brain')`.
[x] "Skull Mesh" -> "Skull"
  - Renamed `this.meshGui.addFolder('💀 Skull')`.
[x] "Soft Tissue Mesh" -> "Soft Tissue"
  - Renamed `this.meshGui.addFolder('👤 Soft Tissue')`.
[x] "Surf Ice Velvet Shading" -> Brain Velvet Shader Style (don't refer to Surf-Ice anymore)
  - Renamed `brainFolder.addFolder('✨ Brain Velvet Shader Style')`.
[x] "Ventricle Mask" -> "Ventricles"
  - Renamed `this.meshGui.addFolder('💧 Ventricles')`.
[x] "ACTC (Surf-Ice) -> "ACTC"
  - Renamed in overlay colormap dropdowns in `src/ui.js` and removed references across codebase.
[x] Tractography should be listed higher in the menu than "Custom Meshes". 
  - Reordered folders in `initMeshGUI()`: `this.tractographyFolder` is now created directly above `this.customMeshFolder`.
[x] Within tractography visualization settings, don't call it "Surf-Ice RGB", just call it "RGB". 
  - Renamed option to `'RGB': 'rgb'` and updated Principal Direction metric to `'Principal Direction (LR → AP → IS)'`.
We want to review our colormaps for nifti overlays as well as tractography. 
[x] Could we make the RGB style we've been using on tractography a colormap option for tractography, that way we can elliminate the Color Mode orientation option as it would be the same as selecting Colormap Gradient -> Gradient Metric: Orientation -> "RGB" colormap. 
  - Eliminated separate "Orientation" mode from `Color Mode` in favor of `'Colormap / Directional'` vs `'Solid Color'`.
  - Added `'RGB': 'rgb'` as the first and default colormap option in tractography.
  - In `TractographyManager.computeColorsForTract()`, when `colormap === 'rgb'`, it directly calculates the 3D directional vector `(dx/len, dy/len, dz/len)` with contrast stretching and fiber dithering.
  - In `src/ui.js`, when `colormap === 'rgb'`, the scalar gradient metric dropdown is dynamically hidden since RGB represents an intrinsic 3-vector.
[x] Can we check throughout our perceptually uniform color scales for tractography that they are indeed what we say they are? Viridis for example has looked a bit odd on tractography. 
  - Diagnosed that `src/colormaps.js` was previously using a crude 3rd-order polynomial with >27% error, causing Viridis to peak at a dull greenish-cyan rather than bright yellow.
  - Replaced low-order polynomial approximations for `Viridis`, `Plasma`, `Inferno`, `Magma`, and `Cividis` with exact 65-stop reference lookup tables sampled directly from the official matplotlib/seaborn reference specs, bringing maximum error below 0.1%.
[x] Can we add Rocket perceptually uniform colormaps to the nifti/volumetric and tractography colormap options? 
  - Added Rocket 65-stop reference colormap table and `colormapRocket(t)` in `src/colormaps.js`.
  - Implemented 6th-order Horner polynomial `colormapRocket(float t)` in WebGL slice shader `src/shaders/sliceShader.js`.
  - Added Rocket to Base Volume colormaps (`Rocket: 7`), NIfTI/GIfTI statistical overlay colormaps (`Rocket: 21`), and tractography colormaps (`Rocket: 'rocket'`).

New Request: Completed. [x]
[x] Organize the dropdown select submenue of bones by face bones, cranial bones, + mandible and cervical separately. Just have some subheadings above the respective options. Put mandible + cerivical at the top, followed by cranial, followed by face.
  - Reordered `SKULL_SUBSTRUCTURES` in `src/meshManager.js` into three explicit categories: `mandible_cervical`, `cranial`, and `face`. Mandible & Cervical Vertebrae are pinned to the top, followed by Cranial Bones, and Face Bones at the bottom.
  - Updated `setupSkullSubstructuresMultiselect` in `src/ui.js` to render `.multiselect-group-header` section headers between categories with dark/light theme styling.
[x] Make the default color for the OhioSkull sub-bones be the default gray skull color for all instead of the colors you have them set to now. Still keep the current colors as a quick alternative option when you click into the colorpicker swatch.
  - Set default color of all 22 skull sub-bones to the standard monolithic skull bone color (`0xeeece8` / `#eeece8`) in `src/meshManager.js`.
  - Preserved each sub-bone's distinct anatomical color as an `Anatomical Color Preset` in the interactive swatch popover palette in `src/ui.js`, along with the `Default Bone Color` and full `🎨 Custom Color...` picker.
[x] Add tractography for corticospinal and dorsal column/medial lemnisucs/thalamocortical to primary somatic and motor cortex, as well as optic radiations and optic nerve, as well as arcuate fasciculus, and corpus callosum (divided). Default 10% tract density. Organize with subheadings in the dropdown select menu, including "Projection Tracts", "Association Tracts", "Commissural Tracts", and "Cranial Nerves". The paths to the tracts are as follows:
Medial lemniscus: /Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/brainstem/ML_L.trk.gz (and ML_R)
Spinothalamic: /Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/brainstem/STT_L.trk.gz (and STT_R)
Optic radiation: /Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/projection/OR_L.trk.gz (and OR_R)
Fornix: /Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/projection/F_L.trk.gz (and F_R)
Arcuate Facisculus: /Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/association/AF_L.trk.gz (and AF_R)
Corticospinal Tract: /Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/projection/CST_L.trk.gz (and CST_R)
Corticothalamic Tract: /Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/projection/CT_L.trk.gz
Corpus Callosum: /Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/commissural/CC.trk.gz
CNII (Optic Nerve): '/Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/cranial nerves/CNII_L.trk.gz' (and CNII_R)
CNIII: '/Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/cranial nerves/CNIII_L.trk.gz' (and CNIII_R)
CNIV: '/Users/jiturner/Repositories/Standard/hcp842_avg_trk/cranial nerves/CNIV_L.trk.gz' (and CNIV_R)
CNV: '/Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/cranial nerves/CNV_L.trk.gz' (and CNV_R)
CNVII: ''/Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/cranial nerves/CNVII_L.trk.gz'
CNVIII: ''/Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/cranial nerves/CNVIII_L.trk.gz' (and CNVIII_R)
CNX: ''/Users/jiturner/Repositories/Standard/hcp842_avg_tracts_trk/cranial nerves/CNX_L.trk.gz' (and CNX_R)
  - Staged all 32 neuroanatomical tract bundles into `public/data/tracts/`, including splitting the Corpus Callosum into anatomically partitioned Anterior/Genu ($Y > 10$), Body ($-15 \le Y \le 10$), and Posterior/Splenium ($Y < -15$), plus complete CC.
  - Set default streamline density to 10% (`this.subsample = 10`) for 60 FPS rendering.
  - Built full multiselect checklist widget organized under subheadings: "Projection Tracts", "Association Tracts", "Commissural Tracts", "Cranial Nerves", and "Custom Uploaded Tracts" with live streamline count badges (`5.2k`), quick [All]/[None] toggles, and per-bundle color swatch palettes.
[x] The colormap options on tractography should allow the measure of differentiation between fibers to be the principal fiber orientation exactly as calculated for the surfice style visualization.
  - Implemented `Principal Direction (Surf-Ice: LR → AP → IS)` as the primary colormap metric option (`colormapMetric = 'principal'`), using the exact Surf-Ice principal fiber orientation direction vector $(dx, dy, dz) / \text{len}$ and spherical parameterization: $t = (1 - \phi) \cdot (\theta \cdot 0.5) + \phi \cdot 1.0$ (mapping Left-Right to 0.0, Anterior-Posterior to 0.5, and Inferior-Superior to 1.0).
  - Also provided individual directional components ($dx/\text{len}, dy/\text{len}, dz/\text{len}$) and elevation angle metrics.
[ ] This is a reminder for myself, not for the AI agent. I will consider filling in the sphenoid bone anterior aspect (currently the sinus is open). This is only for my own personal reminder, not for action right now.
[x] Bug: Tractography not reappearing after globally disabling clipping. You need to fiddle with tractography-specific toggle box for "multi plan clipping".
  - Fixed root cause in `src/clippingManager.js`: `clippingManager.update()` was returning early before invoking update callbacks when `!this.globalEnabled`, leaving clipping planes active on tractography materials. Callbacks are now invoked before returning, clearing clipping planes across all tract materials immediately upon global disable.
  - Added explicit `tractographyManager.updateClipping()` trigger to `ui.setClippingEnabled()`.
[x] Bug: Only allows on tract at a time. We should allow multiple.
  - Architected multi-tract concurrent management in `TractographyManager`: maintains discrete `LineSegments2` meshes, geometries, and materials per active bundle, allowing any combination of built-in and user-uploaded tracts to be loaded, visualized, colored, and clipped simultaneously. 

New Request: Completed. [x]
Don't push these to github yet, but let's get them working in the local app first. Once we have them working. I'll let you know when we're confident to push to github.
[x] Support "dural folds" as a new mesh/structure to be visualized (default: not clipped, not visible). The path to the mesh currently is /Users/jiturner/Downloads/falx_tentorium_mesh.obj
  - Cached `falx_tentorium_mesh.obj` into high-performance gzip binary format (`dural_folds.bin.gz`, 174,082 vertices, 348,580 triangles) via `build_cache.mjs` and staged into both `.cache/` and `public/data/` with `/api/binary/dural_folds` routing in `server.mjs`.
  - Added full mesh lifecycle management in `MeshManager`: `loadDuralFolds()`, `setDuralFoldsVisible()`, `setDuralFoldsOpacity()`, `setDuralFoldsClipped()`, `setDuralFoldsStyle()`, and `updateDuralFoldsMaterial()`.
  - Default state configured to not visible (`duralFoldsVisible = false`) and unclipped (`duralFoldsClipped = false`). Independent clipping syncs dynamically with the global clipping planes whenever "Clip Dural Folds" is toggled.
  - Added toolbar toggle button `#btn-toggle-dural` (`title="Toggle Dural Folds (D)"`) in top toolbar Row 2 with active indicator and keyboard shortcut 'D'.
  - Added `🛡️ Dural Folds` folder in the Lil-GUI Meshes panel with Visible, Clip Dural Folds, Opacity, Render Style, and Color controls.
[x] Replace the current MNI152 base volume with this new one: /Users/jiturner/Repositories/Standard/mni_icbm152_nlin_asym_09b_nifti/mni_icbm152_nlin_asym_09b/mni_icbm152_t1_tal_nlin_asym_09b_hires.nii
  - Updated `cache_volumes.py` to ingest high-resolution (0.5mm isotropic, 394x466x378) asymmetric non-linear ICBM152 2009b template.
  - Processed and exported uint8 texture volume (`volume_mni152.bin.gz`, 69.4M voxels, raw intensity range 0–97.3) with metadata matching world coordinate affine and default raw window [40, 80].
  - Staged into `.cache/` and `public/data/volume_mni152.bin.gz`, seamlessly served by both Node backend and static client.
[x] Add "big brain" MRI atlas: /Users/jiturner/Repositories/Standard/BigBrain-to-ICBM2009asym-nonlin-500um.nii
  - Placed BigBrain 500µm histology atlas in `Repositories/Standard/BigBrain-to-ICBM2009asym-nonlin-500um.nii`.
  - Added background masking in `cache_volumes.py` to clamp histology slide border values (`>= 65534.0`) to zero, preventing background plane opacity artifacts while preserving histology tissue gradations.
  - Cached uint8 normalized volume (`volume_bigbrain.bin.gz`, 69.4M voxels, 388x468x388) and metadata with default intensity window [25000, 60000] and range [0, 65535].
  - Added `bigbrain` entry in `VOLUME_CONFIGS` in `volumeManager.js` and registered binary/metadata/raw endpoints in `server.mjs`.
  - Added `BigBrain (500um)` option to `#select-mri-contrast` toolbar dropdown and Lil-GUI Base Volume selector with automatic window slider configuration.
[x] Toggleable sub-bones: If the OhioSkull is the skull mesh, we should load ALL these meshes individuall: /Users/jiturner/Repositories/joseph_skulls/data/output/OhioOnJagakeSkull/substructures (contains numerous .obj named by anatomical bone). A dropdown multiselect checklist should allow users to toggle each sub-bone on/off individually, and the "Clip Skull" button should clip all of them together. The default state should be all sub-bones visible.
  - Identified all 22 anatomical skull sub-bone OBJ models in `joseph_skulls/data/output/OhioOnJagakeSkull/substructures/`: cervical vertebrae, ethmoid, frontal, left/right inferior nasal concha, left/right lacrimal, left maxilla, right maxilla, left/right palatine, left/right parietal, left/right temporal, left/right zygomatic, mandible, nasal, occipital, sphenoid, and vomer (totaling 1,592,448 vertices and 1,543,059 faces).
  - Pre-cached all 22 into binary formats (`subbone_*.bin.gz`) and JSON metadata in `.cache/` and `public/data/`. Exposed endpoints in `server.mjs`.
  - Configured `SKULL_SUBSTRUCTURES` in `meshManager.js` with distinct anatomical color palettes and default state `enabled = true`.
  - Implemented `ensureSkullSubstructuresLoaded()`, `loadSingleSkullSubstructure()`, `setSkullSubstructureEnabled()`, `setSkullSubstructureColor()`, and `updateSkullSubstructuresVisibility()`.
  - Connected `switchSkull('ohio')`: hides monolithic skull mesh, loads and displays all 22 sub-bones, and reveals the Sub-bones multiselect widget. Switching back to `'full'` hides the sub-bones and restores the monolithic skull mesh.
  - Connected "Clip Skull" and dynamic clipping updates to clip all 22 sub-bones simultaneously via shared uniforms and clipping planes.
  - Built custom multiselect dropdown widget inside `💀 Skull Mesh` folder with live summary (`"All (22) selected ▾"`, `"${n} selected ▾"`), quick "All" and "None" buttons, individual toggle checkboxes, color swatch previews, preset popovers, and custom color pickers.


New Request: Completed. [x]
Great, everything's working well, I love where we're at. The next step is basically get things ready for a demo. 
[x] Write a gitignore file and make sure we know what we want to track and don't want to track at this stage to not get overwhelming
  - Created `.gitignore` excluding bulky local artifacts: `node_modules/`, `dist/`, `.cache/`, runtime logs (`server.log`), scratch scripts (`_verify_tmp.mjs`), `.DS_Store`, Python caches, and editor configurations.
  - Tracked clean application source code (`src/`), configuration, documentation, scripts, and staged the pre-processed, optimized binary neuroimaging asset bundle in `public/data/` (under 35MB per file, well within GitHub's limits) so the static viewer can run entirely serverless.
[x] Make our first initial commit
  - Initialized git repository and made clean root commit (`857ceb4`) with 112 files: application engine, shaders, UI controllers, volume & mesh managers, colormaps, matcaps, and static binary dataset assets.
[x] Then, get to work trying to make this viewer live on my github page. We'll push this to my github (@JosephIsaacTurner), and make a github pages action or whatever (you can do this) so that it is linked to my github pages site. The url of my personal github page is josephiturner.com (but it is through github pages). So the url of the viewer should be something like josephiturner.com/brainatlas or something like that. You can figure out the details of how to do this, but it should be possible. 
  - Central Data Loader & Transparent Decompression (`src/dataLoader.js`): Replaced hardcoded server-dependent `/api/` endpoints with universal relative path resolution (`getDataUrl`, `fetchBinary`, `fetchJson`). Added transparent client-side gzip decompression using the native browser `DecompressionStream` (with `pako` fallback), allowing `.bin.gz` mesh and volume files to be served directly by static GitHub Pages without requiring a Node.js backend.
  - Subpath Relative Build (`vite.config.js`, `index.html`): Configured `base: './'` so that JavaScript modules, CSS, matcaps, and binary assets seamlessly resolve whether hosted at a domain root or a subpath like `/brainatlas/`.
  - GitHub Pages & Actions Workflow (`.github/workflows/deploy.yml`): Created automated GitHub Actions pipeline on `main` branch to install dependencies, execute `npm run build`, and deploy the resulting static distribution to GitHub Pages.
  - Repository & Deployment Setup: Created public GitHub repository `JosephIsaacTurner/brainatlas`, set remote origin, and pushed `main`. Configured GitHub Pages with workflow deployment and enforced HTTPS.
  - Live Demo: Successfully built and deployed to `https://josephiturner.com/brainatlas/` (and `https://josephisaacturner.github.io/brainatlas/`), verified with live HTTP/2 200 responses across index HTML, compiled JS bundle, skull and brain meshes, and volumetric masks.


New Request: Completed. [x]
Still one more bugfix:
[x] The colorpickers for the additional structures are working, but they are occupying way too much space on the dropdown select menu that we can't actually see the names of the labels. Can we make the color picker have default options for the colors (inclulding the current default colors you have there and the color for the main mesh), and then a "Custom" option that if you click it opens up the full colorpicker?
  - Compact Color Swatch Button: Replaced the bulky native color inputs with small 15px circular color swatches (`.multiselect-color-swatch-btn`) on each structure row, freeing up horizontal space for full structure labels. Widened the dropdown menu to 320px and added wrapping text styles so structure names (e.g. "Brainstem, Midbrain & Diencephalon") are clearly readable.
  - Preset Color Palette Popover: Clicking a structure's swatch opens a polished floating palette (`.structure-color-popup`) featuring:
    1. Default colors for all 5 additional structures (Midbrain / Brainstem, Thalamus, Cerebellum / Brainstem, Basal Ganglia, Limbic System), with the structure's own default marked `(Default)`.
    2. Dynamic "Main Brain Mesh" color option synchronized with the current surface color.
    3. Active indicator checkmarks (✓) showing the currently selected color.
  - Custom Color Option: Added a prominent "🎨 Custom Color..." button that opens the system/browser native colorpicker via a hidden color input, with live two-way synchronization and active state display.
  - Positioning & Dismissal: Configured adaptive popover positioning (popping upward for lower items to prevent bottom clipping) and seamless click-outside dismissal without accidental toggling of structure checkboxes. Rebuilt production bundle.


New Request: Completed. [x]
Amazing that worked well! Now we just have to work out a few bugs and elaborate on some features for the meshes we added
[x] Within the dropdown select for the additional structures, can we have colorpicker options for each structure?
  - Added interactive `<input type="color">` pickers to each structure row inside the multiselect dropdown checklist in `src/ui.js` and styled in `src/style.css`.
  - Added `MeshManager.setAdditionalBrainStructureColor(id, colorHex)`: updates the structure's base tint, re-renders material uniforms, and dynamically recomputes per-vertex overlay colors if a NIfTI overlay is active.
[x] When we have "None" for the main brain mesh, but additional structures enabled, but then drag a NIfTI overlay, it enables the main mesh and projects the overlay onto it. However, this isn't updated/synchronized with the menu, which still thinks the main mesh is None and the substuctures are on. It would be cool if our nifti projection logic were applied onto whatever structures were enabled at the time of import, even if its these additional structures that are the substrate for projection, and then if we change the Brain meshes, including the substructures, it updates the nifti overlay projection accordingly.
  - Root cause: `MeshManager.updateBrainMaterial()` was setting `this.brainMesh.visible = this.brainVisible` unconditionally, forcing the primary brain mesh to become visible when overlay shaders were updated. Fixed by enforcing `this.brainMesh.visible = (this.currentBrainType !== 'none') && this.brainVisible` across all update paths.
  - Generalized overlay projection: Created `_applyOverlayToGeometry` and `_clearOverlayFromGeometry` in `MeshManager`. When a NIfTI overlay is active, it samples the 3D volume at the world MNI vertices of all enabled brain substrates (the primary brain surface if not 'none', and each enabled additional brain structure) with `WeakMap` geometry scalar caching.
  - Changing brain surface model in the main dropdown (including switching to/from 'None') or toggling additional structures in the checklist updates the NIfTI projection immediately across all active structures while maintaining perfect synchronization with the UI menu.


New Request: Now complete [x]
[x] Get rid of "Surf Ice Web" logo/text in the app. We aren't a web version of surfice anymore, we've evolved into our own thing that's not recognizably surfice. Let's call it "Brain and Skull Atlas" instead.
  - Removed "Surf Ice Web" badge from the top toolbar in `src/ui.js` and replaced all references in `index.html`, `README.md`, `package.json`, and client logs with "Brain and Skull Atlas". Rebuilt production bundle.
[x] Replace "Turner NeuroViewer" with "Brain and Skull Atlas"
  - Updated application title, loading splash screen, toolbar brand header, console logging in `src/main.js`, and server startup banner in `server.mjs` to "Brain and Skull Atlas".
[x] Make arterial, venous, and ventricle meshes default to NOT being clipped.
  - Set default clipping states (`ventriclesClipped = false`, `arterialClipped = false`, `venousClipped = false`) in `MeshManager`, ensured initial shader material creation sets unclipped states, and corrected the GUI controller handler to use `setVentriclesClipped(v)`.
[x] Let's update our handling of the BRAIN mesh in particular so that there are TWO dropdowns. The main dropdown for the brain mesh, and an additional one for "Additional Brain Structures" that's a dropdown multiselect checklist that has the following meshes [default none are selected BTW]: /Users/jiturner/Repositories/Standard/manjon_atlas/BrainstemMidbrainDiencephalonMask_0p5.obj, 
/Users/jiturner/Repositories/Standard/manjon_atlas/ThalamusMask_0p5.obj, /Users/jiturner/Repositories/Standard/manjon_atlas/BrainstemCerebellumMask_0p5.obj, /Users/jiturner/Repositories/Standard/manjon_atlas/BasalGangliaMask_0p5.obj, /Users/jiturner/Repositories/Standard/manjon_atlas/LimbicSystemMask_0p5.obj. We should make it so that the overall mesh can actually be "None" as an option, but the additional structures are visualized
  - Added `'None': 'none'` to the Brain Surface Model dropdown in `src/ui.js` and handled `'none'` in `MeshManager.switchBrainMesh` (hiding the primary cortex/white-matter mesh while keeping additional brain structures visible).
  - Pre-cached all 5 Manjon atlas subcortical/brainstem OBJ meshes into binary gzip files (`struct_brainstem_midbrain_diencephalon`, `struct_thalamus`, `struct_brainstem_cerebellum`, `struct_basal_ganglia`, `struct_limbic_system`) via `build_cache.mjs` and exposed `/api/binary/` endpoints and `/api/brain_structures` in `server.mjs`.
  - Built a custom lil-gui dropdown multiselect checklist widget placed directly beneath the Brain Surface Model controller. Defaults to none selected with summary text (`"None selected ▾"`, `"${count} selected ▾"`, `"All (5) selected ▾"`), quick "All" / "None" action buttons, individual checkboxes with distinct color preview dots, and click-outside dismissal.
  - Connected the additional structures to the global clipping planes, velvet/matcap/bone render styles, opacity controls, and visibility toggles.

New Request: Now complete [x]
[x] Replace the current arterial mesh with this new one that's better: /Users/jiturner/Repositories/Standard/UBA167/UBA167_max_op1_manually_refined_skinny.obj
  - Updated `ARTERIAL_OBJ_PATH` to `/Users/jiturner/Repositories/Standard/UBA167/UBA167_max_op1_manually_refined_skinny.obj`, added source path tracking to binary cache invalidation, regenerated `arterial.bin.gz` and `arterial.json` (31,071 verts, 62,150 tris), and updated references in server and frontend code.
[x] The center-top toggle button for "Brain" is in a line above all the other toggle buttons for structures, making it non-intuitive to find and less organized. Put it in the same line
  - Root cause: `.toolbar-center` used `flex-wrap: wrap` on flat button children, which caused flex wrapping to occur right after "Brain" on standard screen widths, stranding Brain alone on the line above while Skull, Soft Tissue, Arterial, Venous, and Ventricles sat on the line below. Restructured `.top-toolbar` into two purposeful rows: Row 1 hosts the view orientation controls, render style, volume selector, and background/theme presets; Row 2 groups all 6 anatomical structure toggles (`Brain`, `Skull`, `Soft Tissue`, `Arterial`, `Venous`, `Ventricles`) into a single unbroken flex container on the exact same line, alongside the volumetric slice and clipping toggles. Rebuilt the production bundle.


New Request: Now complete [x]
[x] Is there a difference between Heidrich-Seidel and Velvet? If they are the same, get rid of the redunandcy, keeping the Velvet term.
  - Confirmed `createHeidrichSeidelMaterial()` was a pure alias for `createVelvetMaterial()` (identical shader, zero difference). Removed it from shaders/velvetShader.js and dropped "heidrich" from both the top-toolbar and sidebar render-style dropdowns and from meshManager.js's style switch.
[x] For some rendering styles on the brain mesh (velvet, phong, matcap, matte), once I've loaded a nifti overlay, and go back to the brain mesh and try to change the display color, it doesn't update the color of the mesh. If I then go and alter the nifti overlay or toggle its visibility on and off, the brain mesh catches the change of color. But it isn't updating the color of the mesh when I change it directly. This is a bug that should be fixed.
  - Root cause: when an overlay is projected onto the brain, the visible color comes from a baked per-vertex "color" attribute (computed once in `updateBrainOverlayColors`), not the material's color uniform, so changing `brainColor` only updated the (invisible) uniform. Added `MeshManager.setBrainColor()` which recomputes the vertex colors when an overlay is active; wired the Surface Color picker to call it. Verified live in-browser: projected an overlay onto the brain, changed Surface Color, and the base surface tint updated immediately without touching the overlay.
[x] Consolidate rendering styles across mesh-- they should all have bone, velvet, glass, and ALL rendering styles available. Keep the defaults as they are depending on the mesh. 
  - Added a shared `MeshManager.createStyledMaterial()` factory (exported `MESH_RENDER_STYLES = ['velvet','glass','bone','phong','matte','matcap','wireframe']`) used by every mesh's material builder. Brain, Skull, Soft Tissue, Arterial Structures, Venous Structures, and Ventricle Mask now each expose a "Render Style"/"Style" dropdown with all 7 styles. Kept each mesh's prior default look (brain=velvet, skull=bone, soft tissue=glass; ventricles/arterial/venous, which previously had no style choice at all, default to the closest equivalent of their old hardcoded material). Verified in-browser: switched Skull Mesh style to "phong" and confirmed the visual specular change.
[x] Import new base volume from file still has a bug I can't quite make sense of. It lets me explore files and select .nii/nii.gz volumes, and it loads them, but they end up looking binarized as 1/0, and the window min/max and background masking doesn't apply. It ends up just looking like a white plane. 
  - Root cause: the server-cached volumes (and the shader's window/level math) store/expect intensities pre-normalized to a 0..1 fraction of `rawMax` (see `scripts/cache_volumes.py`'s `round(v/max*254)+1` uint8 encoding), but `VolumeManager.loadBaseVolumeFromFile()` was uploading the raw, un-normalized float intensities straight into the 3D texture — so virtually every non-zero voxel clamped to 1.0 (white) against the normalized window thresholds. Fixed by encoding the client-parsed NIfTI into the same normalized-uint8 convention as the cache pipeline before creating the texture. Verified in-browser: loaded T1w_average_masked.nii.gz via the direct file-load path and confirmed a proper grayscale, background-masked, correctly-windowed slice (not a binarized white plane), and that adjusting Window Min/Max visibly changes the result.


New Request: Completed [x]
[x] Replace the current ohio skull mesh with a new one I adjusted a bit: /Users/jiturner/Repositories/joseph_skulls/data/output/ohio_skull/ohio_skull/ohio_skull_mni_warped_mandible_fixed.obj


New Request: Completed [x]
[x] If bilateral brain meshes loaded, it behaves weirdly when you drag a mesh that only corresponds to one half/side. If you have two sides of the brain mesh loaded, and you load a mesh that corresponds to only say the left side, can we detect this and only attempt to project it onto the left side of the brain mesh without running into vertex count mismatch errors?
[x] Contour lines are working but also create this weird dotted edge effect on the edges of the background volume slice when its not being masked.
[x] Contour lines behavior is highly disrupted when "Interpolate Overlay" is toggle off creating this checkerboard across the entire slice.
[x] When you toggle some of the buttons in the menu (eg the contour activity toggle), it works but also scrolls the user back up the menu to the top. This is a bit annoying and should be fixed, because you can't repeatedly toggle and untoggle without scrolling back down to the button you want to toggle.
[x] Allow users to select a different base volume from file explorer. In the dropdown for valid base volumes, there should be at the bottom of the dropdown an option "Select from file" that opens a file explorer dialogue to select a new base volume. We might want to notify users that if the new volume isn't MNI aligned, then everything else (meshes, overlays) will be misaligned.
[x] Grayscale colormap for statistical overlays should be added.
[x] ACTC colormap for statistical overlays should be added.
[x] In the right-hand menu (currently has two tabs: Meshes, and Volumes), make it actually THREE tabs: Meshes, Volumes, and Overlays. Overlays will include both nifti and gifti scalar overlays. We want to be able to handle MULTIPLE overlays at once, and have each one independently toggleable, and the ability to entirely remove an overlay from the scene, not just disable it. Maybe a trash icon or something.

New Request: Completed [x]
[x] Some of the new menu toggle buttons text is inconsistently colored compared to the rest of the menu text. Examples include the new "Visible" and "Clip {mesh}" button text, which is now too dark to be visible. Same for "project onto brain mesh" button text.

New Request: Completed [x]
[x] The "Clip {mesh}" toggle button should be at the top of the respective submenu for the mesh (just under the "Visible" toggle). Both Clip {} and Visible should be bolded so they are more easily seen.
[x] Implement surface overlays. We want to replicate the functionality of surfice, and I've prepared a document outlining how surfice does it for your reference /Users/jiturner/Repositories/surf-ice/turner_browser/how_surfice_handles_surface_volume_overlays.md. This means being able to load .nii and allow them to be projected not just onto the volumetric slice (already implemented), but onto the brain surface mesh (ONLY the brain mesh, not the other meshes like the skull). You should also be able to load gifti scalars .gii and project them onto the surface, if the surface is a valid .gii with the right number of vertices. Identical to surfice implementation. When you open a gifti or nifti overlay, there should be toggleable button in the menu controls for whether you should project onto the mesh as well. 

New Request: Completed [x]
[x] Rename everything that relates to "Colin 27" in meshes to just MNI152 mesh. They aren't from the colin27 atlas, its just the MNI brain.
[x] DROP the fsaverage inflated meshes altogether. They don't align anatomically in our space so we don't want them anymore. The pial ones are fine.

New Request: Completed [x]
[x] The color theme picker has some redundancies to eliminate. We have a toggle button for dark/light theme, AND a dropdown. We should ONLY have the dropdown. Rename "Full Black" to just "Black". Get rid of "Full White" (its the same as regular light). 
[x] The overall background theme should also apply to the background of the multiplanar viewer, assuming the Labels toggle is enabled.

New Request: Completed [x]
[x] Rename these labels:
FLASH25 500um -> Edlow Ex Vivo
MNI152 Masked -> MNI152
Colin27 Full Surface -> MNI152 Mesh
Conte69 -> fsLR32k (Conte69)

[x]Brain meshes to change/add:
GET RID OF all fsLR 4k meshes. We don't want them anymore.
ADD these meshes /Users/jiturner/neuromaps-data/atlases/fsaverage/tpl-fsaverage_den-164k_hemi-L_pial.surf.gii, /Users/jiturner/neuromaps-data/atlases/fsaverage/tpl-fsaverage_den-164k_hemi-R_pial.surf.gii, (and both together bilterally), named fsaverage-164k-pial. And same for fsaverage-164k-inflated /Users/jiturner/neuromaps-data/atlases/fsaverage/tpl-fsaverage_den-164k_hemi-R_inflated.surf.gii

New Request: Completed [x]
[x] Ability to manually change background color. Pre-selected color options for the current dark/light settings, but also another for full black, and full white, and then a colorpicker for any desired color.

New Request: Completed [x]
[x] Able to input MNI coord and it redirects there in the multi-plane viewer.
[x] Mask by greater than threshold isn't working right. It works for "Greater than zero" just fine, but as soon as you go a tiny bit above zero, it masks the entire slice. It also doesn't seem to only accept integer masking values. Floats should be accepted as well.
[x] Handle 4d volume overlays: If the shape of the image has a 4th dimension, then we should allow a dropdown to select which 3d volume to visualize. This would only show up if 4d.
[x] Soft tissue mesh update: Replace with this /Users/jiturner/Repositories/joseph_skulls/data/raw/NYHead/NYhead_segmentations/skin_mask_filled_0p5.obj (this doesn't affect the masking, just the mesh visualization)
[x] Left-side menue "Show imaging slice" toggle button doesn't do anythign and isn't synchronized with the main top-center Show Imaging Slice button.
[x] For the "depth" selection for the clipping planes, let's make it consistently display MNI coordinate of the plane in that plane's orientation. This will be more intuitive for users to understand and manipulate the clipping plane. 

New Request: Completed [x]
[x] Multi-plane viewer: Make the MNI coords have a copy-svg that if you click on it it copies the mni coords to clipboard. 
[x] Multi-plane viewer: Make it resizable so that you can expand or shrink the size of the viewer window.
[x] Multi-plane viewer: Make a single toggle button "Labels" at the top of the multi-plane viewer right next to the toggle button for the Crosshairs. If you untoggle (default toggled), it makes the icons for L/R/S/I disappear, the labels for "Plane 1 (Axial)" "Plane 2 (Coronal)" "Plane 3 (Saggital)" disappear, and the Depth labels telling you the level of depth of the cut at the top of the panel disappear, and makes the card containers for each of the planes disappear so that they are all side by side essentially on the same black canvas, all at once. Gives a more minimalistic view better suited for screenshotting and puttin in publications. 
[x] For the T1w average and T2w average, we don't need to label these as (Masked) anymore, since we are using the actual original unmasked volumes. 
[x] For the "Mask by Non-Zero values", we should have another option for "Mask by greater than threshold" and allow users to manipulate the threshold value. 
[x] Plane 2 (Coronal) clipping should default to always be "Invert Cut" on. 

New Request: Completed [x]
[x] Contour line: You should be able to adjust the color and thickness of the contour line. And toggle the greater than and less than contour lines separately. Default both are off. 
[x] The tractography visualization is loading and mostly working without bugs, but there are a few. For example, when I switch from orientation based coloring to single color, and back to orientation based coloring, the fibers don't revert to orientation, they stay single color. 
[x] Changing the fiber thickness doesn't seem to do anything. 
[x] The fibers are totally invisible when superimposed on top of a rendered volume slice, even at 100% opacity. They are totally visible against meshes, interestingly. Something about the tractography fibers is invisible even when they are in front of the rendered slices-- not true for other meshes, they are visualized just fine. 
[x] I can tell that the fiber color by orientation is working because the fibers cluster into correct color groups along a gradient. Is there a way to make the actual gradient they map onto be a colormap that users can select, and is it possible to control the min and max values of the colormap to enhance or minimize the color contrast across the bundle?
[x] Rebuild our volumes from new paths: /Users/jiturner/Repositories/Standard/manjon_atlas/T1w_average.nii.gz for T1w, /Users/jiturner/Repositories/Standard/manjon_atlas/T2w_average.nii.gz for T2w, /Users/jiturner/Repositories/Standard/mni152.nii.gz for mni152. We don't need the hardcoded masked version since we have implemented masking by the brain mask within the app itself.

New Request: Completed [x]
[x] Implement .ply/.stl filetype loading for meshes (drag and drop, file exploration)
[x] Implement .trk/.trk.gz filetype loading for tractography. Once you import a new menu should open for tractography visualization settings (eg for clipping, coloring (default should be colored by orientation), opacity, width of the fibers). Some code for fiber orientation coloring available below: The fibers should be colored by fiber orientation as surfice does it. (See code fo this:)
[x] Implement threshold-based contouring. For statistical overlays, we want another option for "Show contour line" (default OFF) and "Contour greater than threshold" (numerical input) and "Contour less than threshold" numerical input). For a 2D slice: use the marching squares algorithm. For every little 2x2 group of grid cells, check which corners are above/below threshold, and draw a tiny line segment through that cell connecting the crossing points. Do this for every cell in the grid and you get a full outline. If you can think of abetter way to do this, go ahead. This will only be shown on the rendered slices, as well as on the multiplanar viewer if that's open. 


New request: Completed [x]
[x] Add a multiplanar slice viewer for the volumetric data and its overlays. Make it only appear if you click on an "Multiplanar Slice Viewer" button in bottom left, and the multi plan pops out on you like a modal maybe. The slices it show you should be synchronzized to three clipping planes, so that its default axial/coronal/sagittal but if people adjut the clipping azimuth/elevation the multiplanar view is also adjusted. 
[x] For the threshold cutoff and peak selection for thresholding the overlays, the slider and text input is a bit unwieldy and doesn't seem to like values that aren't multiples of 0.05. For example, 0.02 doesn't seem to be accepted. We should make the change of unit per scroll proportional to the range of 0, to max intensity of the ovelray instead of a fixed range, because some maps exist on very very small ranges (eg 0 to 0.02), others on giant ranges (eg 0 to 100000).


New request: Complete? [x]
[x] We want yet another masking option, "by non-zero Values" (or something like that). Basically just treats any voxel with a value of zero as background and masks it out. 
[x] Implement .mz3 filetype loading in addition to .obj (.mz3 is surfice). You can see examples of how to read .mz3 from the surfice source code (you're in it now), but specifically /Users/jiturner/Repositories/surf-ice/mz3/mz3.py might be helpful. We should be able to load .mz3 meshes and drag and drop them in as well.
[x] Once we have implemented, we should allow selecting different brain meshes, eg /Users/jiturner/Repositories/Standard/surf.lh.mz3 and /Users/jiturner/Repositories/Standard/surf.rh.mz3 would be very important for just viewing hemispheres. 
[x] See if we can also implement .gii mesh loading. If its doable, then we'd also want ot be able to select the following brain meshes: /Users/jiturner/Repositories/Standard/conte69_32k_surface_lh.gii, /Users/jiturner/Repositories/Standard/conte69_32k_surface_rh.gii (together?) and /Users/jiturner/neuromaps-data/atlases/fsLR/tpl-fsLR_den-4k_hemi-L_midthickness.surf.gii/ /Users/jiturner/neuromaps-data/atlases/fsLR/tpl-fsLR_den-4k_hemi-R_midthickness.surf.gii (together)
[x] For NIfTI overlays (typically statistical maps), we want separate out "Positive Color Map" and "Negative Color Map", that could have their own colormap, opacity, and min-max thresholding. Positive color map would be the default, but you could toggle and have negative color map. This might need some feedback from users to get right. There should be a checkbox for whether the overlay should be interpolated into the main volume space, or whether it should maintain its own native resolution (default: interpolated onto main volume). Add more colors for plain old Red, Blue, Green (flat colors, not even colormaps), and then viridis, magma, inferno, plasma, cividis, turbo, and coolwarm etc. We'd also want Red-Yellow colormap, and a Winters (Blue-Green sort a thing) for colormap
[x] For thresholding statistical colormaps, we want the threshold values not to be in normalized 0-1 space, but rather in the actual values of the statistical map.



New request: Now complete [x] 
Please do the following, in order:
[x] Compare flattening conventions. Find the exact code that converts the main T1w volume's numpy array into the bytes written to its .bin.gz (the one that already renders correctly, no stripes). Compare it line-by-line against the equivalent step in cache_masks.py for the three mask files. Check specifically for order='C' vs order='F', any np.transpose(...), or any axis-swap (e.g. via nib.as_closest_canonical or manual reordering) that happens in one path but not the other. The mask export must flatten its array in the exact same axis order (fastest-to-slowest) as the T1w export.
[x] Verify meta.dims matches the byte order used. For each mask, confirm the dims (width, height, depth) reported in its metadata JSON matches the actual order the bytes were written in. A mismatch between reported dims and actual byte layout produces this same striping even if the flattening itself was internally consistent.
[x] Each mask has its own affine — that's expected and fine, since they're aligned in world space, not voxel space. Do NOT reuse or share worldToVolumeTex across masks or assume it matches the T1w volume's matrix. For each mask, worldToVolumeTex must be derived independently from that mask's own affine/shape (post-resampling, if resampling was applied), following the same derivation code path used for the main volume's worldToVolumeTex. Please explicitly show me the derivation for all three masks side by side so we can confirm they're each computed from their own header, not copy-pasted from one mask or from the T1w volume.
[x] Sanity check in Python before touching JS. For each of the three cached masks, load the .bin.gz, reshape it using the exact dims from its metadata JSON, and render several 2D slices with matplotlib. If the slices already look scrambled/striped in this pure-Python check, the bug is confirmed to be in cache_masks.py's export step, and the JS/shader code doesn't need to change at all. Do this check first — don't touch volumeManager.js or sliceShader.js until this passes.
[x] Once the Python-side sanity check shows clean, correctly-oriented slices for all three masks, reload them in the app and confirm the striping is gone and that each mask now more or less follows the correct anatomical boundary (brain mask should hug brain tissue only, skull mask the bony skull, soft tissue mask the outer skin surface) using the shared world coordinates.


New request: Now complete [x]
[x] Replace the venous structures mesh with this fixed one: /Users/jiturner/Repositories/Standard/mni_colin27_2008_nifti/manual_venous_structures_fixed.obj
[x] Does "Negative Mode (Intersect)" even mean anything anymore? We might be able to just drop this checkbox since I think it isn't actually doing anything anymore. 
[x] The "Invert Cut" option for clipping should not MOVE the slice but invert which side of the plane is being clipped. Currently it seems to move the slice to the symmetrically opposite side of the volume.
[x] The "Enable Clipping" button at the top of the "Slice Selection & Clipping" menu is not actually toggling clipping anymore. This is a bug.
[x] This could be very complicated or simple-- not sure-- but for volumetric slices and overlays, we should adjust our "masking" options to be "Mask Background by Brain" or "Mask Background by Skull" or "Mask Background by Soft Tissue". If there isn't a direct way to apply this masking based on the masks themselves (probably the simplest options), we can create volumetric masks for each of these structures and apply them to the volumetric slices and overlays. For example, the volumetric mask that masks by the brain mesh is already generated at /Users/jiturner/Repositories/joseph_skulls/scratchwork/surf_mask_filled.nii.gz; a volumetric mask for cropping by the skull mesh is /Users/jiturner/Repositories/joseph_skulls/data/output/skulls/full_skull/skull_mask_attempt.nii.gz, and a volumetric mask for cropping by the soft tissue mesh is /Users/jiturner/Repositories/joseph_skulls/data/raw/NYHead/NYhead_segmentations/skin_mask_filled.nii.gz. We can apply these masks to the volumetric slices and overlays to mask out the background. The issue is masking while preserving the resolution of the original volume. some of these masks are very large (eg the skin mask is pretty lage file because its high resolution). Maybe downsample. IDK. You can give it a try.

New request: Now complete [x]
[x] Something is weird with the CT scan. It might be because its so high resolution that it is somehow being downsampled to a lower resolution but ends up looking worse than the MR sequences we show. It is theoretically the highest resolution scan we are using but looks lower resolution compared to other scans. Maybe think of a better way to downsample it to a lower resolution for visualization purposes, to a similar level as the MRs. 
[x] Put the clipping control menu on the left hand side of the screen separate from everything else. 
[x] Change the T1w average default windowing to min 100, max 300
[x] Default the clipping to be ON (first plane), skull enabled, brain enabled, soft tissue enabled, with clipping plane box visible.
[x] Re-order the listing of brain, skull, soft tissue etc to be in the order of: brain, skull, soft tissue, arterial structures, venous structures, ventricles. Consistently throughout the UI. 
[x] Make "Negative Mode (Intersect)" be the default for clipping planes, always enabled by default. Show plane box should also always be enabled by default. 
[x] Rename "Multi-Clip" to maybe "Slice Selection & Clipping" or something. It's just not super user friendly what this means. 
[x] Rename "Cut Slice"/"Render Cut Slice" to "Show Imaging Slice" or something. It's just not super user friendly what this means. 
[x] Add a "Reset Clipping Planes" button that resets the clipping planes to the default positions and orientations.
[x] The "Show Plane Box" only shows the plane boxes when the cut slice is enabled. It should be able to show these planes even when the cut slice is disabled and you are only slicing through the mesh. 
[x] Resolve any inconsistencies between calling it "Glass" or "XRay" for rendering styles throughout. 
[x] Make the default zoome a bit further out (it is adequately centered on the brain but with the skull it is too far zoomed in. This should apply to the orientation buttons for "Superior View" "Inferior View" "Anterior View" "Posterior View" "Left Lateral View" "Right Lateral View" etc.)


New Request: Now complete [x]
[x] The "default" clipping plane 1 should be an axial cut, basically: depth 0, azimuth 0, elevation -90. Make the other clipping plane be coronal: depth 0, azmuth 180, elevation 0. and the final clipping plane default to saggital: depth 0, azimuth 90, elevation 0. This easily translated into axial/saggital/coronal cuts, and axial is the most useful so it should be the default, first plane.
[x] At the top/center next to the main buttons for toggling the mesh activity, also include a toggle button equivalent to "Render Cut Slice" that will toggle the volumetric slice rendering on and off. Just make it more centralized instead of having to find the button in the right hand menu.
[x] Add a new available mesh called "Arterial Structures", mapping to /Users/jiturner/Repositories/Standard/arterial_structures.obj, color default red. 
[x] Add a new available mesh called "Venous Structures", mapping to /Users/jiturner/Repositories/Standard/mni_colin27_2008_nifti/manual_venous_structures.obj, color default darker blue. 

New Request: Now complete [x]
[x] Wherever the GUI says "skin", replace with "soft tissue" instead.
[x] Add a "CT" slice option to the volumetric slice viewer. (/Users/jiturner/Repositories/joseph_skulls/data/reference/reference_ct/template_with_skull_fixed_official_cleaned.nii.gz you can use) default windowing should be min: 10 max:90 (in raw values of the CT, not normalize to 0-1. Maybe you can figure out the conversion to the normalized scale, idk).
[x] MNI152 volume default windowing should be min 40: max 80
[x] T1w default windowing should be min0 max 300
[x] T2w default windowing should be min0 max 300
[x] Add yet another volumetric slice option for this: /Users/jiturner/Repositories/Standard/Synthesized_FLASH25_in_MNI_v2_500um.nii.gz (default windowing: min 8, max 35)
[x] Separate the controls for meshes, volumes (including the main slice and overlays), and the clipping controls. Right now they are all on top of eachother and its a bit confusing/overflowing.


New Request: Now complete [x]
There's still a bug around clipping. 
[x] The "Multi-Clip" toggle button at the top center doesn't seem integrated with the "enable clipping" button on the side when I hit "Multi-Clip". But when I hit "enable clipping" on the side, it toggles the multi-clip button at the top center. 
[x] When I have both the brain AND the skull meshes visible at the same time, the clipping seems to be desynchronized from updating the volumetric slic when I start changing the clipping depth. The volumetric slice seems to only update when I change the clipping depth when only the brain is visble. This seems to be unique to the skull mesh 

New Request: Now complete [x]
[x] Skull should default to "bone" style, not glass.
[x] Skull default opacity should be 100%.
[x] Brain default color should be "#bdbdbd"
[x] For some reason on the default velvet render, the clipping doesn't apply. I have to change to a different render style, check the enable clipping, and then switch back to velvet for it to work. This is a bug that needs to be fixed. I've noticed other inconsistencies about whether clipping is applied or not that I am not totally sure about or when they occur. For example the clipping for the skull only applies if I change the default style (glass) to something else, and then back to glass.
[x] There's some weird assymetry to the lighting depending on if you are looking from the left or right. I don't like this.
[x] Instead of "axial" "coronal" "saggital", have it be "Superior View" "Inferior View" "Anterior View" "Posterior View" "Left Lateral View" "Right Lateral View", and have it keep the turntable rotation axis the same for all of the views. It just adjusts the camera position.

New request: Now Complete: [x]
More options for the synchronized MRI slices:
/Users/jiturner/Repositories/Standard/mni152_masked.nii (mni152.nii.gz), and /Users/jiturner/Repositories/Standard/manjon_atlas/substructure_atlas.nii.gz

New request: Now complete: [x]
Great work! This is running very excellently. Another thing: 
[x] Let's try to improve our "velvet" render style to be more like the surfice velvet style, which is detailed in this .txt: /Users/jiturner/Documents/MATLAB/leaddbs/ext_libs/surfice/Resources/shaders/Velvet.txt Let's try to faithfully implement this in our javascript code.
[x] negative clipping: Right now, two active clip planes AND together — each plane's cut is unioned with the others', so you're left with the intersection (1 quadrant kept, 3 discarded).
Add a per-plane toggle: "negative" mode. A negative plane's discard region should intersect with the other planes' discard region, not union with it. So instead of discarding H1 ∪ H2 (→ keeps 1 quadrant), it discards H1 ∩ H2 (→ keeps 3 quadrants, only the shared corner cut away).
Net effect: normal plane = subtract more. Negative plane = subtract less, by undoing the overlap. Just flip that plane's combine op from OR to AND in the discard test.

New request: Now complete: [x]
Great work! This is incredible. Some additional suggestions:
[x] Make the .nii.gz overlays masked by the /Users/jiturner/Repositories/Standard/manjon_atlas/T1w_average_masked.nii.gz so that it doesn't overflow beyond the brain.
[x] Support T2w average in addition to T1w average, so users can select which they want to view. Default would be T1s. /Users/jiturner/Repositories/Standard/manjon_atlas/T2w_average_masked.nii.gz (already generated)
[x] When white mode is on, it makes the menu on the right hand side hard to see. We'd want to totally invert the text colors or just make the menu background dark, independent of the main background for the canvas. I prefer this latter option probably. 

Previous request: Now complete: [x]
Great work! That's surprisingly working incredibly well. Some additional features we'd want to add. Keep in mind the meshes I'm referring to all already exist in my file system and are aligned to the MNI space in world coordinates.
[x] Option for white or dark background (currently it is just dark)
[x] Option for MULTI-plane clipping, so that users can clip the mesh in multiple planes simultaneously. Currently it supports only a single clipping plane. 
[x] Ability to toggle the brain off and on, not just the skull
[x] Ability to have .nii/.nii.gz overlays on the rendered volumetric planes during clipping, with independent opacity/colormap relative to the volume itself. (support drag and drop for .nii and .nii.gz, and file exploration)
[x] Ability to toggle off and on a hardcoded ventricle mask (/Users/jiturner/Repositories/joseph_skulls/scratchwork/mni152_smwp_ventricles_ref_0p1.obj)
[x] Ability to drag in and visualize any .obj mesh file, with the same clipping and rendering capabilities as the hardcoded skull and brain meshes. (support drag and drop for .obj files, and file exploration)
[x] Additional skull mesh option to select from: /Users/jiturner/Repositories/joseph_skulls/data/output/ohio_skull/ohio_skull/ohio_skull_mni_warped.obj
[x] Ability to toggle off and on a soft tissue mesh: /Users/jiturner/Repositories/joseph_skulls/data/raw/NYHead/NYhead_segmentations/skin_0p5.obj
[x] For each mesh loaded up, we should indepdendently toggle whether the clipping applies to that mesh. The default is that the clipping is synchronized across all meshes, but we can turn of clipping for specific meshes. 

Previous request: Now complete: [x]
I want to create a javascript based application that runs in the browser client side. 
It will be a neuroimaging viewer similar to surfice, but with some additional features and some
hardcoded preferences. 
The brain mesh will be hardcoded to be this: /Users/jiturner/Repositories/joseph_skulls/scratchwork/surf.obj
We want to make the default render style be "velvet". 
We also want this skull mesh to be toggleable off and on: /Users/jiturner/Repositories/joseph_skulls/data/output/skulls/full_skull/full_skull_mni_warped.obj
We want mesh clipping, similar to surfice, so that users can clip the mesh to view internal structures.
However, it should actually render the volumetric data corresponding to the clipped region, rather than just the mesh (which is basically hollow). 
So, we have to figure out how to synchronize the clipping of the mesh with the volumetric slice that we are clipping into, 
Keeping in mind that this clipping is often oblique to the typical anatomical planes.
This is the corresponding volume: /Users/jiturner/Repositories/Standard/manjon_atlas/T1w_average_masked.nii.gz
The good thing about all this, is that the skull, mesh, and volumetric data are all aligned in MNI space in world coordinates, so there isn't any need for additional registration or transformation.
Create your application in /Users/jiturner/Repositories/surf-ice/turner_browser
Try to use the conda env "analysis_env" if possible.