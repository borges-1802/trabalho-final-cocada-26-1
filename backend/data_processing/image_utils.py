import numpy as np
import io
from PIL import Image
from fastapi import UploadFile
from scipy.sparse.linalg import svds
from concurrent.futures import ThreadPoolExecutor

_pool = ThreadPoolExecutor(max_workers=3)


def load_img_into_numpy(file: UploadFile) -> np.ndarray:
    """Load an uploaded image file into a NumPy array (sempre RGB)."""
    image = Image.open(file.file).convert("RGB")
    return np.array(image)


def numpy_to_bytes(img_array: np.ndarray, format: str = "PNG") -> bytes:
    """Convert a NumPy array image to bytes."""
    image = Image.fromarray(img_array.astype("uint8"))
    byte_io = io.BytesIO()
    image.save(byte_io, format=format)
    return byte_io.getvalue()


def _truncated_svd(A: np.ndarray, k: int):
    """Retorna U, S, VT já ordenados em ordem decrescente, contendo os top-k componentes.

    svds (ARPACK) só compensa quando k é pequeno. Quando k passa de ~30% do posto,
    o LAPACK gesdd (np.linalg.svd) é mais rápido e mais estável.
    """
    m, n = A.shape
    max_k = min(m, n)
    k = max(1, min(k, max_k))

    if k >= int(max_k * 0.3):
        U, S, VT = np.linalg.svd(A, full_matrices=False)
        return U[:, :k], S[:k], VT[:k, :]

    U, S, VT = svds(A, k=k)
    idx = np.argsort(-S)
    return U[:, idx], S[idx], VT[idx, :]


def compress_channel_svd(channel: np.ndarray, k: int) -> np.ndarray:
    A = channel.astype(np.float64)
    U, S, VT = _truncated_svd(A, k)
    compressed = U @ np.diag(S) @ VT
    compressed = np.clip(compressed, 0, 255)
    return compressed.astype(np.uint8)


def compress_full_image(img_np: np.ndarray, k: int) -> np.ndarray:
    if img_np.ndim == 2:
        img_np = np.stack([img_np, img_np, img_np], axis=2)

    channels = [img_np[:, :, i] for i in range(3)]
    results = list(_pool.map(lambda c: compress_channel_svd(c, k), channels))

    return np.stack(results, axis=2).astype("uint8")


def _svd_channel_full(channel: np.ndarray):
    """SVD completa (usada em tiles pequenos onde svds não compensa)."""
    return np.linalg.svd(channel, full_matrices=False)


def _compress_channel_from_svd(U, S, VT, k):
    k = max(1, min(k, len(S)))
    return np.clip(U[:, :k] @ np.diag(S[:k]) @ VT[:k, :], 0, 255).astype(np.uint8)


def compress_image_with_region(img_np, k_region, k_base, region, tile_size=128):
    print(
        f"compress_image_with_region: k_region={k_region}, k_base={k_base}, region={region}"
    )
    h, w = img_np.shape[:2]
    R, G, B = img_np[:, :, 0], img_np[:, :, 1], img_np[:, :, 2]

    r_out = np.zeros_like(R)
    g_out = np.zeros_like(G)
    b_out = np.zeros_like(B)

    for y in range(0, h, tile_size):
        for x in range(0, w, tile_size):

            tile_x2 = min(x + tile_size, w)
            tile_y2 = min(y + tile_size, h)

            inside = not (
                region["x2"] < x
                or region["x1"] > tile_x2
                or region["y2"] < y
                or region["y1"] > tile_y2
            )

            k_tile = k_region if inside else k_base

            r_tile = R[y:tile_y2, x:tile_x2]
            g_tile = G[y:tile_y2, x:tile_x2]
            b_tile = B[y:tile_y2, x:tile_x2]

            r_out[y:tile_y2, x:tile_x2] = compress_channel_svd(r_tile, k_tile)
            g_out[y:tile_y2, x:tile_x2] = compress_channel_svd(g_tile, k_tile)
            b_out[y:tile_y2, x:tile_x2] = compress_channel_svd(b_tile, k_tile)

    return np.stack([r_out, g_out, b_out], axis=2)


def compress_image_with_region_global(img_np, k_region, k_base, region):
    h, w = img_np.shape[:2]

    R, G, B = img_np[:, :, 0], img_np[:, :, 1], img_np[:, :, 2]

    M = np.zeros((h, w), dtype=float)
    x1, y1, x2, y2 = region["x1"], region["y1"], region["x2"], region["y2"]
    M[y1:y2, x1:x2] = 1.0

    def mix_channel(channel):
        A = channel.astype(np.float64)
        k_needed = max(k_region, k_base)
        U, S, VT = _truncated_svd(A, k_needed)

        kb = max(1, min(k_base, len(S)))
        kr = max(1, min(k_region, len(S)))

        a_low = U[:, :kb] @ np.diag(S[:kb]) @ VT[:kb, :]
        a_high = U[:, :kr] @ np.diag(S[:kr]) @ VT[:kr, :]

        out = a_low * (1 - M) + a_high * M
        return np.clip(out, 0, 255).astype(np.uint8)

    results = list(_pool.map(mix_channel, [R, G, B]))
    return np.stack(results, axis=2)


_HEAT_CMAP_STOPS = np.array(
    [
        [0.00, 0.001, 0.000, 0.014],
        [0.13, 0.114, 0.045, 0.196],
        [0.25, 0.257, 0.039, 0.320],
        [0.38, 0.406, 0.075, 0.352],
        [0.50, 0.560, 0.145, 0.334],
        [0.63, 0.729, 0.239, 0.269],
        [0.75, 0.874, 0.383, 0.152],
        [0.88, 0.966, 0.594, 0.020],
        [1.00, 0.988, 0.998, 0.645],
    ]
)


def _heat_cmap(t: np.ndarray) -> np.ndarray:
    r = np.interp(t, _HEAT_CMAP_STOPS[:, 0], _HEAT_CMAP_STOPS[:, 1])
    g = np.interp(t, _HEAT_CMAP_STOPS[:, 0], _HEAT_CMAP_STOPS[:, 2])
    b = np.interp(t, _HEAT_CMAP_STOPS[:, 0], _HEAT_CMAP_STOPS[:, 3])
    return np.stack([r, g, b], axis=-1)


def compute_error_map(original_np: np.ndarray, compressed_np: np.ndarray):
    error = np.mean(
        np.abs(original_np.astype(float) - compressed_np.astype(float)), axis=2
    )
    error_norm = error / (np.max(error) + 1e-8)
    heatmap = _heat_cmap(error_norm)
    return (heatmap * 255).clip(0, 255).astype(np.uint8)
