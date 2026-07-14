import asyncio
import json
from PIL import Image
from fastapi import APIRouter, Form, Query, Response
from fastapi.responses import JSONResponse
import numpy as np
from data_processing.image_utils import (
    compress_channel_svd,
    compress_full_image,
    compress_image_with_region,
    compress_image_with_region_global,
    compute_error_map,
    load_img_into_numpy,
    numpy_to_bytes,
)
from fastapi import UploadFile, File


router = APIRouter(tags=["api"])


@router.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    try:
        img_np = load_img_into_numpy(file)
        return JSONResponse(
            {
                "width": int(img_np.shape[1]),
                "height": int(img_np.shape[0]),
                "channels": int(img_np.shape[2]) if img_np.ndim == 3 else 1,
                "message": "Imagem recebida com sucesso!",
            }
        )

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@router.post("/compress")
async def compress_image(
    k: int = Query(50, ge=1),
    file: UploadFile = File(...),
):

    img_np = load_img_into_numpy(file)

    loop = asyncio.get_event_loop()
    img_np = await loop.run_in_executor(None, compress_full_image, img_np, k)

    out_bytes = numpy_to_bytes(img_np)

    return Response(content=out_bytes, media_type="image/png")


@router.post("/max-k")
async def get_max_k(file: UploadFile = File(...)):
    # Lê dimensões originais sem decodificar totalmente (Image.open é lazy)
    file.file.seek(0)
    from PIL import Image as PILImage
    with PILImage.open(file.file) as pil:
        orig_w, orig_h = pil.size
    file.file.seek(0)

    img_np = load_img_into_numpy(file)
    height, width = img_np.shape[:2]
    k_max = min(height, width)

    return JSONResponse(
        {
            "width": int(width),
            "height": int(height),
            "k_max": int(k_max),
            "original_width": int(orig_w),
            "original_height": int(orig_h),
            "was_resized": bool(orig_w != width or orig_h != height),
        }
    )


@router.post("/compress-region")
async def compress_region(
    k_region: int = Query(50, ge=1),
    k_base: int = Query(10, ge=1),
    file: UploadFile = File(...),
    region: str = Form(...),
):
    region = json.loads(region)  # x1, y1, x2, y2

    img = Image.open(file.file).convert("RGB")
    img_np = np.array(img)

    loop = asyncio.get_running_loop()

    out_np = await loop.run_in_executor(
        None, lambda: compress_image_with_region(img_np, k_region, k_base, region)
    )

    out_bytes = numpy_to_bytes(out_np)
    return Response(content=out_bytes, media_type="image/png")


@router.post("/compress-region-global")
async def compress_region_global(
    k_region: int = Query(50, ge=1),
    k_base: int = Query(10, ge=1),
    file: UploadFile = File(...),
    region: str = Form(...),
):
    region = json.loads(region)

    img = Image.open(file.file).convert("RGB")
    img_np = np.array(img)

    loop = asyncio.get_running_loop()

    # SVD global + máscara rodando na worker thread
    out_np = await loop.run_in_executor(
        None,
        lambda: compress_image_with_region_global(img_np, k_region, k_base, region),
    )

    out_bytes = numpy_to_bytes(out_np)
    return Response(content=out_bytes, media_type="image/png")


@router.post("/error-map")
async def error_map(
    file_original: UploadFile = File(...), file_compressed: UploadFile = File(...)
):
    orig = load_img_into_numpy(file_original)
    comp = load_img_into_numpy(file_compressed)

    heat = compute_error_map(orig, comp)
    out_bytes = numpy_to_bytes(heat)

    return Response(content=out_bytes, media_type="image/png")


def _compute_deep_stats(R: np.ndarray) -> dict:
    m, n = R.shape

    # SVD estável (LAPACK gesdd)
    _, S, _ = np.linalg.svd(R, full_matrices=False)
    total_energy = float(np.sum(S))
    cumulative = (np.cumsum(S) / total_energy).tolist()

    # (C) SVD via autovalores de AᵀA (ou AAᵀ, o que for menor) — método instável.
    # Erros de ponto flutuante aparecem nos σᵢ pequenos, especialmente por causa de κ(AᵀA)=κ(A)².
    M = R.T @ R if m >= n else R @ R.T
    eig = np.linalg.eigvalsh(M)          # ordem ascendente, autovalores reais
    eig = np.clip(eig, 0.0, None)         # remove pequenos negativos por arredondamento
    S_ata = np.sqrt(eig)[::-1]            # descendente
    S_ata = S_ata[: len(S)].tolist()

    # (B) Aproximações "ingênuas" de posto k: manter apenas as k linhas/colunas
    # de maior norma. Erro de Frobenius = √(soma das normas² descartadas).
    row_sq_sorted = np.sort(np.sum(R * R, axis=1))[::-1].tolist()
    col_sq_sorted = np.sort(np.sum(R * R, axis=0))[::-1].tolist()

    return {
        "singular_values": S.tolist(),
        "cumulative_energy": cumulative,
        "total_energy": total_energy,
        "rank": len(S),
        "singular_values_ata": S_ata,
        "row_squared_norms_sorted": row_sq_sorted,
        "col_squared_norms_sorted": col_sq_sorted,
        "shape": [int(m), int(n)],
    }


@router.post("/svd-stats")
async def svd_stats(file: UploadFile = File(...)):
    img = load_img_into_numpy(file)
    R = img[:, :, 0].astype(float)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _compute_deep_stats, R)
