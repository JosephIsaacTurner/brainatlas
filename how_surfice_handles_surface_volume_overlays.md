# How Surfice Handles Surface vs. Volumetric Overlays

In Surfice, the mechanics of mapping volumetric **`.nii`** files versus surface **`.gii`** overlays onto brain meshes are completely different under the hood.

This document breaks down the underlying math, geometry, and implementation in the Surfice source code.

---

## 1. How Volumetric `.nii` Files Are Projected onto Brain Meshes

When loading a standard 3D volumetric NIfTI file as an overlay, Surfice performs **direct spatial point-sampling** in world coordinate space at each mesh vertex.

### Key Code References:
* **Overlay Loader / Dispatcher:** [`mesh.pas` (lines 10866–10872)](../mesh.pas#L10866-L10872) in `TMesh.LoadOverlay`
* **Voxel Loader & Vertex Loop:** [`mesh.pas` (lines 10313–10335)](../mesh.pas#L10313-L10335) in `TMesh.LoadNii`
* **Affine Matrix Inversion:** [`nifti_loader.pas` (lines 255–282)](../nifti_loader.pas#L255-L282) in `TNIfTI.setMatrix`
* **Sampling & Trilinear Interpolation:** [`nifti_loader.pas` (lines 203–253)](../nifti_loader.pas#L203-L253) in `TNIfTI.mm2intensity`
* **Smoothing Preferences:** [`prefs.pas` (line 366)](../prefs.pas#L366) and [`commandsu.pas` (lines 1009–1012)](../commandsu.pas#L1009-L1012) (`OVERLAYSMOOTHVOXELWISEDATA`)

---

### Step-by-Step Mechanism:

#### 1. Affine Matrix Inversion
In [`nifti_loader.pas` (lines 255–282)](../nifti_loader.pas#L255-L282), Surfice reads the spatial transformation matrix $\mathbf{M}_{vox2mm}$ from the NIfTI header (preferring `sform` over `qform`). This matrix maps continuous voxel indices $(i, j, k)$ to world millimeter coordinates $(x, y, z)$:

$$\begin{bmatrix} X_{mm} \\ Y_{mm} \\ Z_{mm} \\ 1 \end{bmatrix} = \mathbf{M}_{vox2mm} \begin{bmatrix} X_{vox} \\ Y_{vox} \\ Z_{vox} \\ 1 \end{bmatrix}$$

Surfice inverts this matrix (`invMat := invertMatrixF(mat);`) to derive $\mathbf{M}_{mm2vox} = \mathbf{M}_{vox2mm}^{-1}$.

#### 2. Per-Vertex World-to-Voxel Transformation
In [`mesh.pas` (lines 10313–10335)](../mesh.pas#L10313-L10335) (`TMesh.LoadNii`), Surfice iterates through every vertex of the loaded mesh:

```pascal
num_v := length(vertices);
setlength(overlay[lOverlayIndex].intensity, num_v);
for i := 0 to (num_v - 1) do
    overlay[lOverlayIndex].intensity[i] := nii.mm2intensity(vertices[i].X, vertices[i].Y, vertices[i].Z, lLoadSmooth);
```

In [`nifti_loader.pas` (lines 203–214)](../nifti_loader.pas#L203-L214) (`TNIfTI.mm2intensity`), the vertex's world millimeter coordinates $(X_{mm}, Y_{mm}, Z_{mm})$ are mapped into continuous voxel fractional coordinates $(X_{vox}, Y_{vox}, Z_{vox})$ using $\mathbf{M}_{mm2vox}$:

```pascal
Xvox := Xmm*invMat[1,1] + Ymm*invMat[1,2] + Zmm*invMat[1,3] + invMat[1,4];
Yvox := Xmm*invMat[2,1] + Ymm*invMat[2,2] + Zmm*invMat[2,3] + invMat[2,4];
Zvox := Xmm*invMat[3,1] + Ymm*invMat[3,2] + Zmm*invMat[3,3] + invMat[3,4];
```

#### 3. Bounds Check & Voxel Sampling
In [`nifti_loader.pas` (lines 218–252)](../nifti_loader.pas#L218-L252):
* **Bounding Box:** If $(X_{vox}, Y_{vox}, Z_{vox})$ is outside the volume dimensions, an intensity of `0` is assigned.
* **Nearest Neighbor** (`SmoothVoxelwiseData = false`): Voxel coordinates are rounded to the nearest integer index:
  ```pascal
  vx := round(Xvox) + round(Yvox) * hdr.dim[1] + round(Zvox) * sliceVx;
  result := img[vx];
  ```
* **Trilinear Interpolation** (`SmoothVoxelwiseData = true`, default):
  Values are interpolated across the 8 surrounding corner voxels. Surfice weights the interpolation by non-zero voxels (`notZero(img[...])`) and normalizes by the total weight (`result := result / weight`) so that zero/background voxels outside the brain mask do not bleed into the cortex surface.

---

### What This Means for "Arbitrary Meshes":
* **Mesh Independence:** A volumetric `.nii` can be projected onto **any mesh** (regardless of vertex count, triangle density, or mesh decimation).
* **Coordinate Dependence:** The mesh and the volume **must share the same physical coordinate space** (e.g., both registered to MNI152 space, or both in native scanner space). Surfice evaluates whatever voxel value resides at each vertex's 3D coordinates.
* **Point Sampling (No Ribbon Extrusion):** Surfice queries the volume at the exact 3D vertex position. Unlike specialized surface tools (such as FreeSurfer's `mri_vol2surf` or Connectome Workbench's `-volume-to-surface-mapping`), it does not project vectors along surface normals or integrate through the gray matter cortical ribbon.

---

## 2. How `.gii` (GIfTI) Overlays Work

Surface overlays (such as `.func.gii`, `.shape.gii`, or `.label.gii`) are native surface files storing scalar values per vertex.

### Key Code References:
* **GIfTI Reader:** [`mesh.pas` (lines 4943–5360)](../mesh.pas#L4943-L5360) in `TMesh.LoadGii`
* **Vertex Count Validation:** [`mesh.pas` (lines 5076–5081)](../mesh.pas#L5076-L5081)
* **Direct 1:1 Array Assignment:** [`mesh.pas` (lines 5288–5301)](../mesh.pas#L5288-L5301)

---

### Step-by-Step Mechanism:

#### 1. No 3D Coordinate Mapping
GIfTI overlays contain 1D data arrays (or $N \times V$ time series) where each element represents the scalar value of a specific vertex. There are no 3D spatial transformations or volume interpolations.

#### 2. Strict Vertex Count Check
In [`mesh.pas` (lines 5076–5081)](../mesh.pas#L5076-L5081), Surfice validates that the number of entries in the GIfTI data array (`Dim0`) matches the vertex count of the loaded mesh:

```pascal
if (isOverlay) and (Dim0 <> length(vertices)) and (length(vertices) > 0) then begin
   showmessageX(format('GIFTI overlay has a different number of vertices than the background mesh (%d vs %d)',[Dim0 , length(vertices)]));
   if surfaceID <> '' then
      showmessageX('Hint: first open the background mesh '+ surfaceID);
   goto 666;
end;
```

#### 3. Direct 1:1 Index Copy
If the count matches, Surfice assigns values directly by vertex index ([`mesh.pas` (lines 5288–5301)](../mesh.pas#L5288-L5301)):

```pascal
overlay[lOverlayIndex].volumes := Dim1;
overlay[lOverlayIndex].currentVolume := 1;
setlength(overlay[lOverlayIndex].intensity, Dim1 * length(vertices));
for k := 0 to (Dim1 - 1) do begin
  volInc := k * Dim0;
  for i := 0 to (Dim0 - 1) do begin
      overlay[lOverlayIndex].intensity[i + volInc] := asSingle(dat[j]);
      j := j + Dim1;
  end;
end;
```
* Entry `0` maps directly to vertex `0`.
* Entry `i` maps directly to vertex `i`.

---

### What This Means for "Arbitrary Meshes":
* **Strict Topology Matching:** You cannot load a `.gii` overlay onto an arbitrary mesh. The mesh must have the exact same vertex indexing and count that the overlay was computed on (e.g., standard HCP 32k fs_LR mesh, FreeSurfer 164k `fsaverage` mesh, etc.).

---

## 3. Special Hybrid Cases

Surfice also handles cases where volumetric containers store surface-based data:

### 1. CIFTI Files (`.dscalar.nii`, `.dtseries.nii`)
* **Detection:** [`mesh.pas` (line 10695)](../mesh.pas#L10695) checks `isCIfTI(FileName)`
* **Loader:** [`cifti.inc` (lines 32–337)](../cifti.inc#L32-L337) in `TMesh.loadCifti`
* **Mechanism:** Even though CIFTI files have a `.nii` extension (NIfTI-2 format), they are not 3D spatial volumes. Surfice parses the embedded XML header for surface structures (`CIFTI_STRUCTURE_CORTEX_LEFT` or `CIFTI_STRUCTURE_CORTEX_RIGHT`, chosen via `origin.X < 0`). It verifies `bm.SurfaceNumberOfVertices == length(vertices)` ([`cifti.inc` (lines 251–255)](../cifti.inc#L251-L255)) and maps values directly by `<VertexIndices>` ([`cifti.inc` (lines 288–298)](../cifti.inc#L288-L298)), operating like a GIfTI overlay rather than a 3D volume.

### 2. Flat Voxel Containers (e.g., PALM)
* **Loader:** [`mesh.pas` (lines 9769–9840)](../mesh.pas#L9769-L9840) in `TMesh.LoadVoxel2Vertex`
* **Mechanism:** Some statistical tools (like PALM) save surface scalars in volume formats (such as NIfTI or MGH). Surfice inspects the volume dimensions: if `Dim[1] == length(vertices)` and other spatial dimensions are 1 ([`mesh.pas` (lines 9793–9797)](../mesh.pas#L9793-L9797)), Surfice treats the file as a flat 1:1 vertex array rather than a 3D voxel grid.

---

## 4. Summary Comparison

| Aspect | Volumetric `.nii` / `.nii.gz` | Surface `.gii` Overlay | CIFTI `.nii` (`.dscalar.nii`) |
| :--- | :--- | :--- | :--- |
| **Source Implementation** | [`mesh.pas:10313`](../mesh.pas#L10313), [`nifti_loader.pas:203`](../nifti_loader.pas#L203) | [`mesh.pas:4943`](../mesh.pas#L4943) | [`cifti.inc:32`](../cifti.inc#L32) |
| **Data Format** | 3D/4D voxel array + affine matrix ($\mathbf{M}$) | 1D/2D array indexed by vertex | NIfTI-2 container with CIFTI XML + vertex arrays |
| **Mapping Method** | 3D spatial coordinate lookup: $(x,y,z)_{mm} \xrightarrow{\mathbf{M}^{-1}} (i,j,k)_{vox}$ | 1:1 direct array index assignment (`intensity[i] := dat[i]`) | Surface structure extraction + direct vertex indexing |
| **Mesh Requirements** | Any mesh sharing the same physical coordinate space (e.g. MNI) | Must match vertex count and vertex ordering exactly | Must match hemisphere and vertex count |
| **Interpolation** | Nearest neighbor or trilinear interpolation | None (pre-associated with vertices) | None (pre-associated with vertices) |
