# SVD Image Compression

Aplicação web para explorar compressão de imagens via **Singular Value Decomposition (SVD)**, com verificação empírica dos teoremas de Eckart–Young–Mirsky (T30) e da norma de Frobenius (T31). Projeto final da disciplina de Computação Científica e Análise de Dados de 2026-1.

## O que faz

Toda imagem RGB é vista como três matrizes (R, G, B). Cada matriz A admite a decomposição

$$A = U \Sigma V^T$$

com valores singulares em ordem decrescente. Truncando nos **k maiores** obtém-se

$$A_k = U_{:,:k}\,\mathrm{diag}(\sigma_1,\dots,\sigma_k)\,V^T_{:k,:}$$

que é, pelo Teorema de Eckart–Young–Mirsky, a melhor aproximação de A com posto no máximo k nas normas de Frobenius e espectral. Quanto menor o k, maior a compressão e o erro visual.

## Telas da aplicação

### Compressor (`/`)
- Upload de imagem via botão custom.
- Sliders + inputs numéricos para `k base` e `k região`.
- Seleção de região com mouse sobre a imagem original.
- Dois modos de compressão por região: **Global** (uma SVD por canal + máscara) e **Tiles** (SVD por bloco 128×128).
- Card lateral em tempo real com o erro relativo de Frobenius do canal R.

### Análise (`/analise`)
- Original + Comprimida + **Mapa de erro** lado a lado no topo.
- **Métricas** (canal R, para o k atual): ‖A‖_F, erro relativo, PSNR (RGB inteiro), taxa de compressão teórica `mn / [k(m+n+1)]`, e um card "Teoria × Medida" que compara o erro previsto pelo T31 com o medido pixel a pixel.
- **Espectro σᵢ em escala log** — decaimento revelador; se aproximadamente linear, é exponencial.
- **Erro relativo de Frobenius vs k** — derivado só do espectro (T31).
- **Otimalidade empírica (T30)**: três curvas de erro relativo — SVD, top-k linhas por norma, top-k colunas por norma. SVD fica sempre abaixo, comprovando a otimalidade do teorema.
- **Estabilidade numérica**: dois gráficos comparando σᵢ obtidos via SVD direta (LAPACK `gesdd`) versus via `√λ(AᵀA)` (instável). Mostra empiricamente por que `κ(AᵀA) = κ(A)²` degrada os σᵢ pequenos.

### Teoria (`/teoria`)
Página estática com fórmulas via KaTeX cobrindo motivação (exemplo do contador, foto P&B), SVD, T30 Eckart–Young–Mirsky, T31 e critério do cotovelo, por que SVD comprime imagens, algoritmos de cálculo (SVD completa vs truncada via ARPACK/Lanczos, ligação com Método da Potência), estabilidade numérica, taxa de compressão e o esquema de compressão por região deste projeto. Inclui TOC lateral, callouts distintos para Teoremas e Notas, e referências.

## Stack

- **Back-end**: Python 3.12+, FastAPI, NumPy, SciPy (ARPACK truncated SVD), Pillow.
- **Front-end**: React 18 + TypeScript + Vite, React Router, Chart.js, react-chartjs-2, KaTeX.

## Estrutura

```
back-end/
├── main.py                   # FastAPI + CORS (5173 e 4200)
├── routers/api.py            # 7 endpoints
└── data_processing/
    └── image_utils.py        # SVD + compressão por região + heatmap
front-end/
└── src/
   ├── App.tsx               # BrowserRouter + AppProvider
   ├── AppContext.tsx        # estado compartilhado entre rotas
   ├── Layout.tsx            # topbar minimalista + <Outlet/>
   ├── api.ts                # cliente HTTP tipado
   ├── styles.css
   └── pages/
       ├── Compressor.tsx    # /  — tela de compressão
       ├── Analise.tsx       # /analise — métricas, gráficos, mapa de erro
       └── Teoria.tsx        # /teoria — conteúdo teórico com KaTeX
```

## Endpoints (`/api/*`)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/upload-image` | valida imagem, retorna dimensões |
| POST | `/max-k` | retorna `k_max = min(width, height)` |
| POST | `/compress?k=N` | compressão SVD uniforme |
| POST | `/compress-region?k_region&k_base` | modo tiles |
| POST | `/compress-region-global?k_region&k_base` | modo global |
| POST | `/error-map` | heatmap de erro entre original e comprimida |
| POST | `/svd-stats` | pacote completo: valores singulares (SVD estável), σᵢ via √λ(AᵀA), normas quadradas ordenadas de linhas/colunas, energia acumulada, shape |

## Otimizações do back-end

- **SVD truncado adaptativo**: `scipy.sparse.linalg.svds` (ARPACK) quando `k < 30%` do posto — só computa o necessário; cai para `np.linalg.svd` (LAPACK `gesdd`) para k grande, onde ARPACK fica lento.
- **Canais R/G/B em paralelo** via `ThreadPoolExecutor` — NumPy libera o GIL durante as chamadas BLAS.
- No modo global com região, **uma única SVD** por canal reconstrói as duas versões (base + região).
- `svd-stats` roda em thread pool para não bloquear o event loop.

## Como rodar

### Back-end (porta 8000)
```powershell
cd back-end
poetry install
poetry run python main.py
```

Alternativa sem Poetry:
```powershell
cd back-end
pip install fastapi uvicorn numpy pillow python-multipart scipy
python main.py
```

### Front-end React (porta 5173)
```powershell
cd front-end-react
npm install
npm run dev
```
Abra `http://localhost:5173`.

## Conexão com o curso

O projeto materializa vários resultados da disciplina:

- **T22, T23** — sustentam a demonstração do T30.
- **T26, T27** — justificam o método via `AᵀA`, cuja instabilidade prática é exposta na tela Análise.
- **T30 (Eckart–Young–Mirsky)** — otimalidade verificada empiricamente com o gráfico das três aproximações de posto k.
- **T31** — cada card, gráfico de erro de Frobenius e o card "Teoria × Medida" refletem essa identidade.
- **P13.1, P13.4** — propriedades usadas na demonstração de T31.
- **Método da Potência** (bloco de P2) — mesma matemática do ARPACK/Lanczos usado no `svds`.
- **Condicionamento** (bloco de P3) — a Seção 6 da Teoria e o gráfico de estabilidade numérica mostram `κ(AᵀA) = κ(A)²` em dado real.