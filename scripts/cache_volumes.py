import os
import json
import gzip
import shutil
import numpy as np
import nibabel as nib
from nilearn.image import resample_img

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.cache')
os.makedirs(CACHE_DIR, exist_ok=True)

PUBLIC_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'data')
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

VOLUMES = {
    'volume_t1': {
        'path': '/Users/jiturner/Repositories/Standard/manjon_atlas/T1w_average.nii.gz',
        'is_atlas': False,
        'default_window': [100.0, 300.0]
    },
    'volume_t2': {
        'path': '/Users/jiturner/Repositories/Standard/manjon_atlas/T2w_average.nii.gz',
        'is_atlas': False,
        'default_window': [0.0, 300.0]
    },
    'volume_ct': {
        'path': '/Users/jiturner/Repositories/joseph_skulls/data/reference/reference_ct/template_with_skull_fixed_official_cleaned.nii.gz',
        'is_atlas': False,
        'default_window': [10.0, 90.0]
    },
    'volume_flash25': {
        'path': '/Users/jiturner/Repositories/Standard/Synthesized_FLASH25_in_MNI_v2_500um.nii.gz',
        'is_atlas': False,
        'default_window': [8.0, 35.0]
    },
    'volume_mni152': {
        'path': '/Users/jiturner/Repositories/Standard/mni_icbm152_nlin_asym_09b_nifti/mni_icbm152_nlin_asym_09b/mni_icbm152_t1_tal_nlin_asym_09b_hires.nii',
        'is_atlas': False,
        'default_window': [40.0, 80.0]
    },
    'volume_bigbrain': {
        'path': '/Users/jiturner/Repositories/Standard/BigBrain-to-ICBM2009asym-nonlin-500um.nii',
        'is_atlas': False,
        'is_bigbrain': True,
        'default_window': [25000.0, 60000.0]
    },
    'volume_tissue': {
        'path': '/Users/jiturner/Repositories/Standard/manjon_atlas/tissue_atlas_masked.nii.gz',
        'is_atlas': True,
        'max_label': 9.0
    },
    'volume_structure': {
        'path': '/Users/jiturner/Repositories/Standard/manjon_atlas/structure_atlas.nii.gz',
        'is_atlas': True,
        'max_label': 54.0
    },
    'volume_substructure': {
        'path': '/Users/jiturner/Repositories/Standard/manjon_atlas/substructure_atlas.nii.gz',
        'is_atlas': True,
        'max_label': 352.0
    }
}

def process_volume(name, config):
    file_path = config['path']
    is_atlas = config.get('is_atlas', False)
    print(f"Processing {name} from {file_path}...")
    if not os.path.exists(file_path):
        print(f"  WARNING: File {file_path} does not exist! Skipping.")
        return

    img = nib.load(file_path)
    data = img.get_fdata(dtype=np.float32)
    affine = img.affine

    dims = list(img.shape[:3])
    total_voxels = dims[0] * dims[1] * dims[2]

    # For high-resolution CT, downsample spatially to MR resolution (~0.75mm spacing)
    # using continuous cubic-spline interpolation so its resolution and memory footprint
    # match the MR sequences cleanly without aliasing or WebGL limits.
    if name == 'volume_ct':
        target_affine = np.diag([-0.75, 0.75, 0.75, 1.0])
        target_affine[:3, 3] = affine[:3, 3]
        target_shape = [
            int(np.ceil(dims[0] * 0.5 / 0.75)),
            int(np.ceil(dims[1] * 0.5 / 0.75)),
            int(np.ceil(dims[2] * 0.5 / 0.75))
        ]
        resampled = resample_img(img, target_affine=target_affine, target_shape=target_shape, interpolation='continuous', copy_header=True)
        data = resampled.get_fdata(dtype=np.float32)
        affine = resampled.affine
        dims = list(resampled.shape[:3])
        total_voxels = dims[0] * dims[1] * dims[2]
        print(f"  Downsampled CT to MR level: Dims={dims} (~0.75mm voxels)")

    srow_x = list(affine[0, :])
    srow_y = list(affine[1, :])
    srow_z = list(affine[2, :])

    min_val = float(np.min(data))
    max_val = float(np.max(data))
    print(f"  Dims: {dims}, Raw Range: min={min_val}, max={max_val}")

    flat_data = data.flatten(order='F') # Fortran order: i + j*nx + k*nx*ny

    if config.get('is_bigbrain', False):
        # BigBrain background is padded with 65535 (or > 65534)
        flat_data[flat_data >= 65534.0] = 0.0
        min_val = float(np.min(flat_data[flat_data > 0])) if np.any(flat_data > 0) else 0.0
        max_val = 65535.0
        print(f"  BigBrain background masked: set >=65534 to 0. Non-zero range: min={min_val}, max={max_val}")

    if name == 'volume_ct':
        # CT continuous normalized float16 encoding preserves full floating-point precision
        # in soft tissue (10-90 HU) preventing the 12-level posterization/chunky appearance
        max_val_safe = max_val if max_val > 0 else 1.0
        norm_data = np.clip(flat_data / max_val_safe, 0.0, 1.0).astype(np.float16)
        data_bytes = norm_data.tobytes()
        format_type = 'float16'
        byte_length = int(norm_data.nbytes)
    elif is_atlas:
        # Atlas discrete labels: 0 is background (0)
        # Scale labels to 1..255
        max_label = config.get('max_label', max_val)
        if max_label <= 0:
            max_label = 1.0
        # Round slightly interpolated labels if needed
        rounded_data = np.round(flat_data)
        pos_mask = rounded_data > 0
        scaled = np.round((rounded_data[pos_mask] / max_label) * 254.0) + 1.0
        uint8_data = np.zeros(total_voxels, dtype=np.uint8)
        uint8_data[pos_mask] = np.clip(scaled, 1, 255).astype(np.uint8)
        data_bytes = uint8_data.tobytes()
        format_type = 'uint8'
        byte_length = int(uint8_data.nbytes)
    else:
        # Continuous MRI intensity
        max_val_safe = max_val if max_val > 0 else 1.0
        pos_mask = flat_data > 0
        scaled = np.round((flat_data[pos_mask] / max_val_safe) * 254.0) + 1.0
        uint8_data = np.zeros(total_voxels, dtype=np.uint8)
        uint8_data[pos_mask] = np.clip(scaled, 1, 255).astype(np.uint8)
        data_bytes = uint8_data.tobytes()
        format_type = 'uint8'
        byte_length = int(uint8_data.nbytes)

    compressed_bytes = gzip.compress(data_bytes, compresslevel=6)
    bin_path = os.path.join(CACHE_DIR, f"{name}.bin.gz")
    with open(bin_path, 'wb') as f:
        f.write(compressed_bytes)

    # World-to-volume texture matrix
    S = np.diag([dims[0], dims[1], dims[2], 1.0])
    tex_to_world = affine @ S
    world_to_tex = np.linalg.inv(tex_to_world)
    world_to_tex_col_major = list(world_to_tex.T.flatten())

    metadata = {
        "name": name,
        "dims": dims,
        "origin": [float(srow_x[3]), float(srow_y[3]), float(srow_z[3])],
        "spacing": [float(srow_x[0]), float(srow_y[1]), float(srow_z[2])],
        "size": [float(dims[0] * srow_x[0]), float(dims[1] * srow_y[1]), float(dims[2] * srow_z[2])],
        "srow_x": [float(x) for x in srow_x],
        "srow_y": [float(y) for y in srow_y],
        "srow_z": [float(z) for z in srow_z],
        "worldToVolumeTex": world_to_tex_col_major,
        "rawMin": min_val,
        "rawMax": max_val,
        "defaultWindow": config.get('default_window', None),
        "isAtlas": is_atlas,
        "format": format_type,
        "byteLength": byte_length,
        "compressedLength": len(compressed_bytes)
    }

    meta_path = os.path.join(CACHE_DIR, f"{name}.json")
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    # Also sync to public/data for Vite static bundling
    shutil.copyfile(bin_path, os.path.join(PUBLIC_DATA_DIR, f"{name}.bin.gz"))
    shutil.copyfile(meta_path, os.path.join(PUBLIC_DATA_DIR, f"{name}.json"))

    print(f"  Cached {name}: {len(compressed_bytes)} bytes gzipped -> {bin_path} and public/data")

    # Copy volume_t1 to volume (default volume endpoint)
    if name == 'volume_t1':
        shutil.copyfile(bin_path, os.path.join(CACHE_DIR, 'volume.bin.gz'))
        shutil.copyfile(bin_path, os.path.join(PUBLIC_DATA_DIR, 'volume.bin.gz'))
        meta_vol = dict(metadata)
        meta_vol['name'] = 'volume'
        with open(os.path.join(CACHE_DIR, 'volume.json'), 'w') as f:
            json.dump(meta_vol, f, indent=2)
        shutil.copyfile(os.path.join(CACHE_DIR, 'volume.json'), os.path.join(PUBLIC_DATA_DIR, 'volume.json'))
        print("  Copied volume_t1 -> volume.bin.gz and volume.json")

if __name__ == '__main__':
    for name, config in VOLUMES.items():
        process_volume(name, config)
