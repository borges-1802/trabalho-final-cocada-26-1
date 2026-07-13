import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { errorMap } from '../api';
import { useApp } from '../AppContext';
import { Link } from 'react-router-dom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

async function decodePixels(blob: Blob): Promise<{ w: number; h: number; data: Uint8ClampedArray } | null> {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return { w: bmp.width, h: bmp.height, data: img.data };
}

function computePsnr(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = a[i + c] - b[i + c];
      sumSq += d * d;
      n++;
    }
  }
  const mse = sumSq / n;
  if (mse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
}

/** ‖R_orig − R_comp‖_F calculado pixel a pixel no canal R. */
function frobRedChannel(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sumSq = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = a[i] - b[i];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq);
}

export default function Analise() {
  const app = useApp();
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [psnr, setPsnr] = useState<number | null>(null);
  const [measuredFrobR, setMeasuredFrobR] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!app.file || !app.compressedUrl) return;
      setLoading(true);
      setErrorMsg(null);
      setHeatmapUrl(null);
      setPsnr(null);
      try {
        const compBlob = await fetch(app.compressedUrl).then((r) => r.blob());
        const [heat, origPx, compPx] = await Promise.all([
          errorMap(app.file, compBlob),
          decodePixels(app.file),
          decodePixels(compBlob),
        ]);
        if (cancelled) return;
        setHeatmapUrl(URL.createObjectURL(heat));
        if (origPx && compPx && origPx.w === compPx.w && origPx.h === compPx.h) {
          setPsnr(computePsnr(origPx.data, compPx.data));
          setMeasuredFrobR(frobRedChannel(origPx.data, compPx.data));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [app.file, app.compressedUrl]);

  const metrics = useMemo(() => {
    if (!app.stats || !app.imageDims) return null;
    const sigma = app.stats.singular_values;
    const sigmaSq = sigma.map((s) => s * s);
    const totalSq = sigmaSq.reduce((a, b) => a + b, 0);
    const frobA = Math.sqrt(totalSq);
    const k = app.selectionBox ? app.kRegion : app.kBase;
    const tailSq = sigmaSq.slice(k).reduce((a, b) => a + b, 0);
    const frobErrTheoretical = Math.sqrt(tailSq);
    const relErr = totalSq > 0 ? frobErrTheoretical / frobA : 0;
    const { width: n, height: m } = app.imageDims;
    const storedFloats = k * (m + n + 1);
    const originalFloats = m * n;
    const ratio = originalFloats / storedFloats;
    // Discrepância entre teórico e medido (só faz sentido sem região selecionada,
    // onde toda a imagem é comprimida com um único k).
    const discrepancy = measuredFrobR !== null && frobErrTheoretical > 0
      ? Math.abs(measuredFrobR - frobErrTheoretical) / frobErrTheoretical
      : null;
    return {
      frobA, frobErrTheoretical, relErr, k, m, n,
      storedFloats, originalFloats, ratio,
      measuredFrobR, discrepancy,
    };
  }, [app.stats, app.imageDims, app.kBase, app.kRegion, app.selectionBox, measuredFrobR]);

  const singularData = useMemo(() => {
    if (!app.stats) return null;
    return {
      labels: app.stats.singular_values.map((_, i) => i + 1),
      datasets: [{
        label: 'σᵢ',
        data: app.stats.singular_values,
        borderColor: '#60a5fa',
        borderWidth: 2,
        pointRadius: 0,
      }],
    };
  }, [app.stats]);

  const frobeniusData = useMemo(() => {
    if (!app.stats) return null;
    const sigmaSq = app.stats.singular_values.map((s) => s * s);
    const totalSq = sigmaSq.reduce((a, b) => a + b, 0);
    if (totalSq <= 0) return null;
    let tail = totalSq;
    const relErr: number[] = new Array(sigmaSq.length);
    for (let i = 0; i < sigmaSq.length; i++) {
      tail -= sigmaSq[i];
      relErr[i] = Math.sqrt(Math.max(tail, 0) / totalSq);
    }
    return {
      labels: relErr.map((_, i) => i + 1),
      datasets: [{
        label: '‖A − Aₖ‖_F / ‖A‖_F',
        data: relErr,
        borderColor: '#f472b6',
        borderWidth: 2,
        pointRadius: 0,
      }],
    };
  }, [app.stats]);

  // (B) Otimalidade: compara SVD contra "top-k linhas por norma" e "top-k colunas por norma".
  // Todas as três aproximações têm posto ≤ k; SVD deve minimizar ‖A − Aₖ‖_F pelo T30.
  const optimalityData = useMemo(() => {
    if (!app.stats) return null;
    const s = app.stats.singular_values;
    const rowNorms = app.stats.row_squared_norms_sorted;
    const colNorms = app.stats.col_squared_norms_sorted;
    if (!rowNorms || !colNorms) return null;

    const n = Math.min(s.length, rowNorms.length, colNorms.length);
    // Tail (relativo à ‖A‖_F) de cada método
    const totalSq = s.reduce((a, v) => a + v * v, 0);
    const rowTotalSq = rowNorms.reduce((a, v) => a + v, 0);
    const colTotalSq = colNorms.reduce((a, v) => a + v, 0);
    if (totalSq <= 0) return null;

    let svdTail = totalSq;
    let rowTail = rowTotalSq;
    let colTail = colTotalSq;
    const svdErr: number[] = [];
    const rowErr: number[] = [];
    const colErr: number[] = [];
    for (let i = 0; i < n; i++) {
      svdTail -= s[i] * s[i];
      rowTail -= rowNorms[i];
      colTail -= colNorms[i];
      const denom = Math.sqrt(totalSq);
      svdErr.push(Math.sqrt(Math.max(svdTail, 0)) / denom);
      rowErr.push(Math.sqrt(Math.max(rowTail, 0)) / denom);
      colErr.push(Math.sqrt(Math.max(colTail, 0)) / denom);
    }

    return {
      labels: Array.from({ length: n }, (_, i) => i + 1),
      datasets: [
        { label: 'SVD (Aₖ ótimo)', data: svdErr, borderColor: '#22c55e', borderWidth: 2.5, pointRadius: 0 },
        { label: 'Top-k linhas', data: rowErr, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, borderDash: [4, 4] },
        { label: 'Top-k colunas', data: colErr, borderColor: '#ec4899', borderWidth: 2, pointRadius: 0, borderDash: [4, 4] },
      ],
    };
  }, [app.stats]);

  // (C) Estabilidade numérica: σᵢ via SVD (LAPACK gesdd, estável) vs via √λᵢ(AᵀA) (instável).
  // Nos σᵢ pequenos, a raiz de autovalores pequenos ampliado por κ(A)² erra mais.
  const stabilityData = useMemo(() => {
    if (!app.stats || !app.stats.singular_values_ata) return null;
    const svd = app.stats.singular_values;
    const ata = app.stats.singular_values_ata;
    const n = Math.min(svd.length, ata.length);
    return {
      labels: Array.from({ length: n }, (_, i) => i + 1),
      datasets: [
        { label: 'σᵢ via SVD (estável)', data: svd.slice(0, n), borderColor: '#60a5fa', borderWidth: 2, pointRadius: 0 },
        { label: 'σᵢ via √λ(AᵀA) (instável)', data: ata.slice(0, n), borderColor: '#ef4444', borderWidth: 1.5, pointRadius: 0, borderDash: [3, 3] },
      ],
    };
  }, [app.stats]);

  const stabilityRelErr = useMemo(() => {
    if (!app.stats || !app.stats.singular_values_ata) return null;
    const svd = app.stats.singular_values;
    const ata = app.stats.singular_values_ata;
    const n = Math.min(svd.length, ata.length);
    const points: number[] = [];
    for (let i = 0; i < n; i++) {
      const denom = svd[i] || 1e-30;
      points.push(Math.abs(svd[i] - ata[i]) / denom);
    }
    // Substitui 0 (log undefined) por floor
    const floor = 1e-16;
    const safe = points.map((v) => Math.max(v, floor));
    return {
      labels: Array.from({ length: n }, (_, i) => i + 1),
      datasets: [
        { label: '|σ_SVD − σ_AᵀA| / σ_SVD', data: safe, borderColor: '#fbbf24', borderWidth: 2, pointRadius: 0 },
      ],
    };
  }, [app.stats]);

  if (!app.file) {
    return (
      <div className="empty">
        <p>Nenhuma imagem carregada.</p>
        <p><Link to="/">Ir para o Compressor</Link> pra carregar uma imagem.</p>
      </div>
    );
  }

  return (
    <div className="analise">
      <h1>Análise</h1>

      <section className="grid-3">
        <div className="image-slot">
          <h3>Original</h3>
          <div className="image-wrap">
            {app.originalUrl && <img src={app.originalUrl} alt="original" />}
          </div>
        </div>
        <div className="image-slot">
          <h3>Comprimida (k_base={app.kBase}, k_região={app.kRegion})</h3>
          <div className="image-wrap">
            {app.compressedUrl ? (
              <img src={app.compressedUrl} alt="compressed" />
            ) : (
              <span className="placeholder">Recomprima em Compressor</span>
            )}
          </div>
        </div>
        <div className="image-slot">
          <h3>Mapa de erro</h3>
          <div className="image-wrap">
            {loading && <div className="loading">Calculando…</div>}
            {heatmapUrl ? (
              <img src={heatmapUrl} alt="heatmap" />
            ) : (
              <span className="placeholder">
                {errorMsg ? `Erro: ${errorMsg}` : 'Carregando…'}
              </span>
            )}
          </div>
          <p className="note">
            Preto = erro zero, magenta/amarelo = erro alto. Bordas de alta frequência acumulam
            mais erro.
          </p>
        </div>
      </section>

      <section className="metrics">
        <h2>Métricas (canal R, para o k atual)</h2>
        {metrics ? (
          <div className="metric-cards">
            <div className="card">
              <div className="k">‖A‖<sub>F</sub></div>
              <div className="v">{metrics.frobA.toFixed(2)}</div>
              <div className="desc">Norma de Frobenius da matriz original</div>
            </div>
            <div className="card">
              <div className="k">Erro relativo</div>
              <div className="v">{(metrics.relErr * 100).toFixed(2)}%</div>
              <div className="desc">‖A − A<sub>k</sub>‖<sub>F</sub> / ‖A‖<sub>F</sub></div>
            </div>
            <div className="card">
              <div className="k">PSNR</div>
              <div className="v">{psnr === null ? '…' : (psnr === Infinity ? '∞' : `${psnr.toFixed(2)} dB`)}</div>
              <div className="desc">Peak Signal-to-Noise Ratio (RGB, imagem inteira)</div>
            </div>
            <div className="card">
              <div className="k">Taxa de compressão</div>
              <div className="v">{metrics.ratio.toFixed(2)}×</div>
              <div className="desc">
                mn / [k(m+n+1)] · {metrics.originalFloats.toLocaleString()} → {metrics.storedFloats.toLocaleString()} floats
              </div>
            </div>
            <div className="card">
              <div className="k">Teoria × Medida (canal R)</div>
              <div className="v">
                {metrics.discrepancy === null
                  ? '…'
                  : metrics.discrepancy < 1e-4
                    ? '≈ 0 ✓'
                    : `${(metrics.discrepancy * 100).toFixed(2)}%`}
              </div>
              <div className="desc">
                Diferença entre o erro previsto pelo T31 e o erro medido pixel a pixel.
                {app.selectionBox && ' Com região ativa, discrepância é esperada.'}
              </div>
            </div>
          </div>
        ) : (
          <p className="placeholder">Carregando estatísticas…</p>
        )}
      </section>

      <section className="charts">
        <h2>Espectro e curva de erro (canal R)</h2>
        <div className="chart-grid">
          <div>
            <h3>Valores singulares σᵢ (escala log)</h3>
            {singularData ? (
              <Line
                data={singularData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      type: 'logarithmic',
                      title: { display: true, text: 'σᵢ (log)' },
                    },
                    x: { title: { display: true, text: 'i' } },
                  },
                }}
              />
            ) : <span className="placeholder">…</span>}
            <p className="note">
              Em log, o decaimento aparente vira reta - se for aproximadamente linear, o
              espectro decai exponencialmente e a imagem é altamente compressível.
            </p>
          </div>
          <div>
            <h3>Erro relativo de Frobenius vs k</h3>
            {frobeniusData ? (
              <Line data={frobeniusData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
            ) : <span className="placeholder">…</span>}
            <p className="note">
              ‖A − Aₖ‖_F / ‖A‖_F - pelo T31, essa curva é totalmente determinada pelo espectro
              acima, sem precisar reconstruir a imagem em cada k.
            </p>
          </div>
        </div>
      </section>

      <section className="charts">
        <h2>Otimalidade empírica (T30) - SVD vs alternativas ingênuas</h2>
        <p className="section-desc">
          Comparação do erro relativo de Frobenius para três aproximações de posto k, todas
          calculadas do mesmo canal R: (i) a SVD truncada Aₖ, (ii) manter apenas as k linhas de
          maior norma da imagem (zerando as demais) e (iii) manter apenas as k colunas de maior
          norma. O Teorema de Eckart–Young garante que a curva verde (SVD) fica abaixo de
          qualquer outra aproximação de mesmo posto - a diferença fica maior para k pequeno.
        </p>
        <div className="chart-single">
          {optimalityData ? (
            <Line
              data={optimalityData}
              options={{
                responsive: true,
                plugins: { legend: { display: true, position: 'top' } },
                scales: {
                  y: { title: { display: true, text: '‖A − Aₖ‖_F / ‖A‖_F' } },
                  x: { title: { display: true, text: 'k' } },
                },
              }}
            />
          ) : <span className="placeholder">…</span>}
        </div>
      </section>

      <section className="charts">
        <h2>Estabilidade numérica - SVD direta vs √λ(AᵀA)</h2>
        <p className="section-desc">
          Duas formas de obter os valores singulares: (a) SVD direta via LAPACK <code>gesdd</code>{' '}
          - numericamente estável; (b) autovalores de AᵀA seguidos de raiz quadrada - instável
          porque <code>κ(AᵀA) = κ(A)²</code>, dobrando a perda de dígitos significativos. Em
          uma foto real bem condicionada as duas curvas praticamente coincidem no topo, mas o
          erro relativo cresce rapidamente nos σᵢ pequenos - que são justamente os que
          determinam quando um modelo de posto k começa a incorporar ruído.
        </p>
        <div className="chart-grid">
          <div>
            <h3>Valores singulares (log)</h3>
            {stabilityData ? (
              <Line
                data={stabilityData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: true, position: 'top' } },
                  scales: {
                    y: { type: 'logarithmic', title: { display: true, text: 'σᵢ (log)' } },
                    x: { title: { display: true, text: 'i' } },
                  },
                }}
              />
            ) : <span className="placeholder">…</span>}
          </div>
          <div>
            <h3>Erro relativo entre os métodos (log)</h3>
            {stabilityRelErr ? (
              <Line
                data={stabilityRelErr}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { type: 'logarithmic', title: { display: true, text: '|Δσ| / σ (log)' } },
                    x: { title: { display: true, text: 'i' } },
                  },
                }}
              />
            ) : <span className="placeholder">…</span>}
            <p className="note">
              Se a curva subir vários ordens de magnitude no final, é a assinatura de
              instabilidade do método via AᵀA - exatamente o que a Seção 6 da Teoria prevê.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
