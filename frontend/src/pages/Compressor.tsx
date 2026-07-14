import { useEffect, useMemo, useRef, useState } from 'react';
import {
  compress,
  compressRegion,
  compressRegionGlobal,
  getMaxK,
  svdStats,
} from '../api';
import { useApp } from '../AppContext';

interface RectPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function Compressor() {
  const app = useApp();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rect, setRect] = useState<RectPx>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [imgOffset, setImgOffset] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateImgOffset = () => {
    if (!imgRef.current) return;
    setImgOffset({
      left: imgRef.current.offsetLeft,
      top: imgRef.current.offsetTop,
    });
  };

  useEffect(() => {
    const handler = () => updateImgOffset();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const normalizeRegion = () => {
    if (!app.selectionBox || !imgRef.current) return null;
    const el = imgRef.current;
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;
    return {
      x1: Math.round((app.selectionBox.x1 / el.clientWidth) * nw),
      y1: Math.round((app.selectionBox.y1 / el.clientHeight) * nh),
      x2: Math.round((app.selectionBox.x2 / el.clientWidth) * nw),
      y2: Math.round((app.selectionBox.y2 / el.clientHeight) * nh),
    };
  };

  const runCompress = async () => {
    if (!app.file) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErrorMsg(null);
    try {
      const region = normalizeRegion();
      app.setRegion(region);
      let blob: Blob;
      if (region && app.mode === 'global') {
        blob = await compressRegionGlobal(app.kRegion, app.kBase, app.file, region, ctrl.signal);
      } else if (region && app.mode === 'tiles') {
        blob = await compressRegion(app.kRegion, app.kBase, app.file, region, ctrl.signal);
      } else {
        blob = await compress(app.kBase, app.file, ctrl.signal);
      }
      if (ctrl.signal.aborted) return;
      app.setCompressedUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    app.setOriginalUrl(URL.createObjectURL(f));
    app.setCompressedUrl(null);
    app.setSelectionBox(null);
    app.setRegion(null);
    app.setStats(null);
    setRect({ x: 0, y: 0, w: 0, h: 0 });
    setErrorMsg(null);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    try {
      const info = await getMaxK(f);
      const newKBase = Math.max(1, Math.floor(info.k_max * 0.15));
      const newKRegion = Math.max(1, Math.floor(info.k_max * 0.6));
      app.setMaxK(info.k_max);
      app.setKBase(newKBase);
      app.setKRegion(newKRegion);
      app.setImageDims({ width: info.width, height: info.height });
      app.setOriginalDims({ width: info.original_width, height: info.original_height });
      app.setWasResized(info.was_resized);
      app.setFile(f);
      svdStats(f).then((s) => app.setStats(s)).catch(console.error);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!app.file) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      runCompress();
    }, 600);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.file, app.kBase, app.kRegion, app.mode, app.selectionBox]);

  const onMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    dragStart.current = { x, y };
    setDragging(true);
    setRect({ x, y, w: 0, h: 0 });
  };
  const onMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!dragging || !dragStart.current) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    setRect({
      x: Math.min(dragStart.current.x, cx),
      y: Math.min(dragStart.current.y, cy),
      w: Math.abs(cx - dragStart.current.x),
      h: Math.abs(cy - dragStart.current.y),
    });
  };
  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (rect.w > 4 && rect.h > 4) {
      app.setSelectionBox({
        x1: rect.x,
        y1: rect.y,
        x2: rect.x + rect.w,
        y2: rect.y + rect.h,
      });
    }
  };
  const clearSelection = () => {
    app.setSelectionBox(null);
    setRect({ x: 0, y: 0, w: 0, h: 0 });
  };

  const selection = app.selectionBox
    ? {
        x: app.selectionBox.x1,
        y: app.selectionBox.y1,
        w: app.selectionBox.x2 - app.selectionBox.x1,
        h: app.selectionBox.y2 - app.selectionBox.y1,
      }
    : null;

  const frobRelErr = useMemo(() => {
    if (!app.stats) return null;
    const sigma = app.stats.singular_values;
    const sigmaSq = sigma.map((s) => s * s);
    const total = sigmaSq.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    const kActive = app.selectionBox ? app.kRegion : app.kBase;
    const kk = Math.min(Math.max(1, kActive), sigmaSq.length);
    const tail = sigmaSq.slice(kk).reduce((a, b) => a + b, 0);
    return { value: Math.sqrt(Math.max(tail, 0) / total), k: kk };
  }, [app.stats, app.kBase, app.kRegion, app.selectionBox]);

  return (
    <div className="layout">
      <div className="panel">
        <h2>Controles</h2>

        <div className="field">
          <label>Imagem</label>
          <label className="file-input">
            <input type="file" accept="image/*" onChange={onFileChange} />
            <span className="file-input-btn">Escolher arquivo</span>
            <span className="file-input-name">
              {app.file ? app.file.name : 'nenhum arquivo'}
            </span>
          </label>
          {app.imageDims && (
            <div className={`img-dims-badge ${app.wasResized ? 'resized' : ''}`}>
              {app.wasResized && app.originalDims ? (
                <>
                  <span className="lbl">Processando em</span>
                  <span className="val">
                    {app.imageDims.width}×{app.imageDims.height}
                  </span>
                  <span className="orig">
                    (original {app.originalDims.width}×{app.originalDims.height})
                  </span>
                  <div className="hint">
                    Limite do servidor. SVD escala com O(mn²); imagens
                    grandes estouram RAM/CPU. Fórmulas e teoremas seguem válidos
                    sobre a matriz reduzida.
                  </div>
                </>
              ) : (
                <>
                  <span className="lbl">Matriz</span>
                  <span className="val">
                    {app.imageDims.width}×{app.imageDims.height}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="field">
          <label>Modo de compressão por região</label>
          <div className="mode">
            <button
              className={app.mode === 'global' ? 'active' : ''}
              onClick={() => app.setMode('global')}
            >
              Global
            </button>
            <button
              className={app.mode === 'tiles' ? 'active' : ''}
              onClick={() => app.setMode('tiles')}
            >
              Tiles
            </button>
          </div>
        </div>

        <div className="field">
          <div className="k-header">
            <label>k base</label>
            <input
              type="number"
              className="k-number"
              min={1}
              max={app.maxK}
              value={app.kBase}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) app.setKBase(Math.max(1, Math.min(app.maxK, v)));
              }}
            />
          </div>
          <input
            type="range"
            min={1}
            max={app.maxK}
            value={app.kBase}
            onChange={(e) => app.setKBase(+e.target.value)}
          />
          <div className="k-hint">1 – {app.maxK} · fora da região</div>
        </div>

        <div className="field">
          <div className="k-header">
            <label>k região</label>
            <input
              type="number"
              className="k-number"
              min={1}
              max={app.maxK}
              value={app.kRegion}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) app.setKRegion(Math.max(1, Math.min(app.maxK, v)));
              }}
            />
          </div>
          <input
            type="range"
            min={1}
            max={app.maxK}
            value={app.kRegion}
            onChange={(e) => app.setKRegion(+e.target.value)}
          />
          <div className="k-hint">1 – {app.maxK} · dentro da região</div>
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={runCompress} disabled={!app.file}>
            Recomprimir
          </button>
          <button className="btn btn-secondary" onClick={clearSelection} disabled={!app.selectionBox}>
            Limpar seleção
          </button>
        </div>

        {frobRelErr && (
          <div className="side-metric">
            <div className="side-metric-label">Erro de Frobenius</div>
            <div className="side-metric-formula">‖A − A_k‖_F / ‖A‖_F · canal R</div>
            <div className="side-metric-value">{(frobRelErr.value * 100).toFixed(2)}%</div>
            <div className="side-metric-sub">
              k = {frobRelErr.k} {app.selectionBox ? '(região)' : '(base)'}
            </div>
          </div>
        )}
      </div>

      <div className="images">
        <div className="image-slot">
          <h3>Original - arraste para selecionar uma região</h3>
          <div className="image-wrap">
            {app.originalUrl ? (
              <>
                <img
                  ref={imgRef}
                  src={app.originalUrl}
                  alt="original"
                  onLoad={updateImgOffset}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={() => setDragging(false)}
                  draggable={false}
                />
                {(dragging || selection) && (
                  <div
                    className="selection"
                    style={{
                      left: (dragging ? rect : selection!).x + imgOffset.left,
                      top: (dragging ? rect : selection!).y + imgOffset.top,
                      width: (dragging ? rect : selection!).w,
                      height: (dragging ? rect : selection!).h,
                    }}
                  />
                )}
              </>
            ) : (
              <span className="placeholder">Selecione uma imagem</span>
            )}
          </div>
        </div>

        <div className="image-slot">
          <h3>Comprimida</h3>
          <div className="image-wrap">
            {app.compressedUrl ? (
              <img src={app.compressedUrl} alt="compressed" />
            ) : (
              <span className="placeholder">-</span>
            )}
            {loading && <div className="loading">Comprimindo…</div>}
          </div>
          {errorMsg && (
            <div style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>
              Erro: {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
