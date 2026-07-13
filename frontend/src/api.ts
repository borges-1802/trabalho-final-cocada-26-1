const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface ImageInfo {
  width: number;
  height: number;
  k_max: number;
}

export interface SvdStats {
  singular_values: number[];
  cumulative_energy: number[];
  total_energy: number;
  rank: number;
  singular_values_ata: number[];
  row_squared_norms_sorted: number[];
  col_squared_norms_sorted: number[];
  shape: [number, number];
}

export interface Region {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

async function postForm(path: string, form: FormData, asBlob = false) {
  const res = await fetch(`${API}${path}`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return asBlob ? res.blob() : res.json();
}

export function getMaxK(file: File): Promise<ImageInfo> {
  const f = new FormData();
  f.append('file', file);
  return postForm('/max-k', f) as Promise<ImageInfo>;
}

export function compress(k: number, file: File): Promise<Blob> {
  const f = new FormData();
  f.append('file', file);
  return postForm(`/compress?k=${k}`, f, true) as Promise<Blob>;
}

export function compressRegion(
  kRegion: number,
  kBase: number,
  file: File,
  region: Region,
): Promise<Blob> {
  const f = new FormData();
  f.append('file', file);
  f.append('region', JSON.stringify(region));
  return postForm(
    `/compress-region?k_region=${kRegion}&k_base=${kBase}`,
    f,
    true,
  ) as Promise<Blob>;
}

export function compressRegionGlobal(
  kRegion: number,
  kBase: number,
  file: File,
  region: Region,
): Promise<Blob> {
  const f = new FormData();
  f.append('file', file);
  f.append('region', JSON.stringify(region));
  return postForm(
    `/compress-region-global?k_region=${kRegion}&k_base=${kBase}`,
    f,
    true,
  ) as Promise<Blob>;
}

export function errorMap(original: File, compressed: Blob): Promise<Blob> {
  const f = new FormData();
  f.append('file_original', original);
  f.append('file_compressed', compressed);
  return postForm('/error-map', f, true) as Promise<Blob>;
}

export function svdStats(file: File): Promise<SvdStats> {
  const f = new FormData();
  f.append('file', file);
  return postForm('/svd-stats', f) as Promise<SvdStats>;
}
