import os
import json
import gzip
import numpy as np
import nibabel as nib
from nilearn.image import resample_img

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.cache')
os.makedirs(CACHE_DIR, exist_ok=True)

MASKS = {
    'mask_brain': {
        'path': '/Users/jiturner/Repositories/joseph_skulls/scratchwork/surf_mask_filled.nii.gz',
        'downsample': False
    },
    'mask_skull': {
        'path': '/Users/jiturner/Repositories/joseph_skulls/data/output/skulls/full_skull/skull_mask_attempt.nii.gz',
        'downsample': False
    },
    'mask_skin': {
        'path': '/Users/jiturner/Repositories/joseph_skulls/data/raw/NYHead/NYhead_segmentations/skin_mask_filled.nii.gz',
        'downsample': True,
        'target_voxel_size': 0.75,
        'target_origin': [-98.0, -134.0, -193.0]
    }
}

def cache_all_masks():
    print("--- Caching Volumetric Masks (Brain, Skull, Soft Tissue) ---")
    for name, cfg in MASKS.items():
        src_path = cfg['path']
        bin_path = os.path.join(CACHE_DIR, f"{name}.bin.gz")
        meta_path = os.path.join(CACHE_DIR, f"{name}.json")

        if not os.path.exists(src_path):
            print(f"[Warning] Mask file not found: {src_path}")
            continue

        print(f"Processing mask {name} from {src_path}...")
        img = nib.load(src_path)

        if cfg.get('downsample', False):
            voxel_size = cfg.get('target_voxel_size', 0.75)
            origin = cfg.get('target_origin', [-98.0, -134.0, -193.0])
            target_affine = np.diag([voxel_size, voxel_size, voxel_size, 1.0])
            target_affine[:3, 3] = origin
            resampled = resample_img(img, target_affine=target_affine, interpolation='continuous', copy_header=True)
            fdata = np.clip(resampled.get_fdata(), 0.0, 1.0)
            data = np.round(fdata * 255.0).astype(np.uint8)
            affine = resampled.affine
        else:
            fdata = img.get_fdata()
            data = (fdata > 0.5).astype(np.uint8) * 255
            affine = img.affine

        dims = list(data.shape)
        srow_x, srow_y, srow_z = affine[0], affine[1], affine[2]

        S = np.diag([dims[0], dims[1], dims[2], 1.0])
        world_to_tex = np.linalg.inv(affine @ S)
        world_to_tex_col_major = list(world_to_tex.T.flatten())

        flat_data = data.flatten(order='F')
        gz = gzip.compress(flat_data.tobytes(), compresslevel=6)
        with open(bin_path, 'wb') as f:
            f.write(gz)

        metadata = {
            'name': name,
            'dims': dims,
            'origin': [float(srow_x[3]), float(srow_y[3]), float(srow_z[3])],
            'spacing': [float(srow_x[0]), float(srow_y[1]), float(srow_z[2])],
            'worldToVolumeTex': world_to_tex_col_major,
            'format': 'uint8',
            'byteLength': int(data.nbytes),
            'compressedLength': len(gz)
        }

        with open(meta_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"Mask {name} cached: {len(gz)} bytes (gzipped), dims={dims}")

if __name__ == '__main__':
    cache_all_masks()
