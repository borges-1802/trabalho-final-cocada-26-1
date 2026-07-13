// @ts-ignore: Allow side-effect import of CSS without type declarations
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import type { ReactNode } from 'react';

interface SectionMeta {
  id: string;
  title: string;
}

const SECTIONS: SectionMeta[] = [
  { id: 'motivacao', title: 'Motivação' },
  { id: 'svd', title: '1. Decomposição em Valores Singulares' },
  { id: 'eckart-young', title: '2. Aproximação de posto k' },
  { id: 'frobenius', title: '3. Norma de Frobenius e cotovelo' },
  { id: 'por-que-comprime', title: '4. Por que SVD comprime bem' },
  { id: 'calculo', title: '5. Cálculo: completa vs truncada' },
  { id: 'estabilidade', title: '6. Estabilidade numérica' },
  { id: 'taxa-regiao', title: '7. Taxa de compressão e região' },
  { id: 'referencias', title: 'Referências' },
];

function Theorem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside className="callout theorem">
      <div className="callout-label">{label}</div>
      <div className="callout-body">{children}</div>
    </aside>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="callout note">
      <div className="callout-label">Nota</div>
      <div className="callout-body">{children}</div>
    </aside>
  );
}

export default function Teoria() {
  return (
    <div className="teoria-layout">
      <nav className="toc" aria-label="Índice">
        <div className="toc-title">Índice</div>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="prose">
        <header className="prose-header">
          <h1>Fundamentos: SVD aplicada à compressão de imagens</h1>
          <p className="subtitle">
            Base teórica do projeto — decomposição, otimalidade, complexidade, estabilidade e o
            esquema de compressão por região implementado.
          </p>
        </header>

        <section id="motivacao">
          <h2>Motivação: de onde vem esse problema</h2>
          <p>
            O problema deste projeto é literalmente o exemplo usado em aula para introduzir a SVD
            (aula de 08/04): <em>"queremos enviar uma foto P&amp;B com{' '}
            <InlineMath math="m \times n" /> pixels. Há alguma forma de armazenar [uma submatriz]
            de forma a não perder muita informação?"</em> A resposta começa com o caso mais
            simples — uma matriz de posto 1, escrita como{' '}
            <InlineMath math="A = \sigma_1 u_1 v_1^{T}" /> — e generaliza para{' '}
            <InlineMath math="A = \sum_i \sigma_i u_i v_i^{T}" />, a soma que truncaremos na Seção 2.
          </p>
          <p>
            A apostila do Marcello apresenta a mesma ideia de outro ângulo, antes mesmo de chegar
            em imagens: o exemplo do <strong>contador</strong> que percebe redundância nas
            planilhas de ganhos mensais de uma empresa e reescreve a matriz{' '}
            <InlineMath math="(n \times 12)" /> como um produto de dois vetores — ganho total por
            ano e distribuição percentual por mês. Generalizando, decompor{' '}
            <InlineMath math="A_{(n\times m)}" /> como{' '}
            <InlineMath math="B_{(n\times k)} C_{(k\times m)}" /> só compensa em espaço de
            armazenamento quando
          </p>
          <BlockMath math="nk + km < nm \iff k < \frac{nm}{n+m}," />
          <p>
            exatamente a mesma lógica por trás da taxa de compressão que usamos para uma imagem
            (Seção 7). A apostila usa ainda um segundo exemplo, de reconhecimento de dígitos
            manuscritos em <InlineMath math="\mathbb{R}^9" />, para mostrar que essa mesma ideia
            de aproximação <InlineMath math="A \approx BC" /> serve tanto para comprimir dados
            quanto para visualizar/reconhecer padrões em dimensão reduzida — a compressão de
            imagem é um caso particular desse problema mais geral de aproximação de posto baixo.
          </p>
        </section>

        <section id="svd">
          <h2>1. Decomposição em Valores Singulares</h2>
          <p>
            Toda matriz real <InlineMath math="A \in \mathbb{R}^{m \times n}" /> admite a
            decomposição
          </p>
          <BlockMath math="A = U \Sigma V^{T}" />
          <p>
            onde <InlineMath math="U \in \mathbb{R}^{m \times m}" /> e{' '}
            <InlineMath math="V \in \mathbb{R}^{n \times n}" /> são ortogonais e{' '}
            <InlineMath math="\Sigma \in \mathbb{R}^{m \times n}" /> é composta por um bloco
            diagonal superior — cujas entradas são os valores singulares{' '}
            <InlineMath math="\Sigma_{ii} = \sigma_i" />, com{' '}
            <InlineMath math="\sigma_1 \geq \sigma_2 \geq \dots \geq \sigma_r \geq 0" /> — e um
            bloco inferior nulo, sendo <InlineMath math="r = \operatorname{rank}(A)" />. Os{' '}
            <InlineMath math="\sigma_i" /> são os <strong>valores singulares</strong>; as colunas
            de <InlineMath math="U" /> e <InlineMath math="V" /> são os vetores singulares à
            esquerda e à direita.
          </p>
          <p>
            Geometricamente, <InlineMath math="A" /> transforma uma bola unitária em um elipsoide
            cujos eixos principais têm comprimento <InlineMath math="\sigma_i" /> nas direções{' '}
            <InlineMath math="u_i" />.
          </p>
        </section>

        <section id="eckart-young">
          <h2>2. Aproximação de posto k e o Teorema de Eckart–Young–Mirsky</h2>
          <p>
            Truncando a soma <InlineMath math="A = \sum_{i=1}^{r} u_i \sigma_i v_i^{T}" /> nos{' '}
            <InlineMath math="k" /> maiores termos:
          </p>
          <BlockMath math="A_k = \sum_{i=1}^{k} \sigma_i u_i v_i^{T} = U_k\, \Sigma_k\, V_k^{T}" />
          <p>
            Cada termo <InlineMath math="\sigma_i v_i^{T}" /> pode ser lido como a coordenada de
            um ponto no eixo <InlineMath math="u_i" />: assim como a decomposição QR permite
            escrever cada coluna de <InlineMath math="A" /> como combinação linear das colunas de{' '}
            <InlineMath math="Q" />, a escrita <InlineMath math="A_k = U_k E_k" /> (com{' '}
            <InlineMath math="E_k = \Sigma_k V_k^{T}" />) permite ler cada coluna de{' '}
            <InlineMath math="A" /> como combinação linear da base ortonormal formada pelas
            colunas de <InlineMath math="U_k" />.
          </p>
          <p>A otimalidade dessa truncagem é o resultado central do capítulo de SVD/PCA.</p>

          <Theorem label="Teorema T30 · Eckart–Young–Mirsky">
            <p>
              Seja <InlineMath math="A \in \mathbb{R}^{m\times n}" /> tal que{' '}
              <InlineMath math="A = U\Sigma V^T" /> e{' '}
              <InlineMath math="k \leq \min(m,n)" />. Então
            </p>
            <BlockMath math="A_k \in \operatorname*{arg\,min}_{\operatorname{rank}(B) \leq k} \|A - B\|_F^{2}." />
          </Theorem>

          <p>
            A demonstração passa por dois resultados anteriores da apostila: o{' '}
            <strong>Teorema T22</strong> (Projeção Ótima sobre Componentes Diagonais), que
            mostra que a matriz <InlineMath math="I_k" /> (k primeiros vetores canônicos)
            maximiza <InlineMath math="\|A^TX\|_F^2" /> sob a restrição{' '}
            <InlineMath math="X^TX = I" />; e o <strong>Teorema T23</strong> (Troca de Variáveis
            de Modelos de Reconhecimento de Padrões), que transporta esse resultado do espaço de{' '}
            <InlineMath math="\Sigma" /> de volta para o espaço de <InlineMath math="A" />. É
            essa otimalidade — não existe outra matriz de mesmo posto com menor erro de
            Frobenius — que justifica a SVD truncada como esquema de compressão.
          </p>
        </section>

        <section id="frobenius">
          <h2>3. Norma de Frobenius e o critério do cotovelo</h2>

          <Theorem label="Teorema T31 · Norma de Frobenius e valores singulares">
            <p>
              Seja <InlineMath math="A = U\Sigma V^T" />. Então
            </p>
            <BlockMath math="\|A\|_F^{2} = \sum_{i=1}^{r} \sigma_i^{2}." />
          </Theorem>

          <p>
            A demonstração usa a <strong>Propriedade P13.4</strong> (invariância da norma de
            Frobenius por matrizes ortogonais) para eliminar <InlineMath math="U" /> e{' '}
            <InlineMath math="V^T" />, e a <strong>Propriedade P13.1</strong> (quadrado da norma
            de Frobenius) para reduzir <InlineMath math="\|\Sigma\|_F^2" /> à soma dos quadrados
            da diagonal.
          </p>
          <p>Como consequência direta,</p>
          <BlockMath math="\|A - A_k\|_F^2 = \sum_{i=k+1}^{r}\sigma_i^{2}," />
          <p>
            o que dá um critério não-arbitrário para escolher <InlineMath math="k" />: a apostila
            propõe olhar o <strong>gráfico do cotovelo</strong> — magnitude individual dos{' '}
            <InlineMath math="\sigma_i" /> (queda acentuada nos primeiros termos) e a soma
            acumulada desses valores (Figura F51). Escolher <InlineMath math="k" /> antes do
            cotovelo causa <strong>underfitting</strong> (perde-se informação relevante de{' '}
            <InlineMath math="A" />); escolher <InlineMath math="k" /> muito além do cotovelo
            causa <strong>overfitting</strong> (o ruído gaussiano que corrompe a matriz de baixo
            posto original passa a ser incorporado à aproximação).
          </p>
        </section>

        <section id="por-que-comprime">
          <h2>4. Por que a SVD comprime bem imagens</h2>
          <p>
            A leitura estatística da apostila é: uma imagem pode ser vista como se, originalmente,
            fosse uma matriz de posto baixo (regiões lisas, texturas repetitivas, redundância
            espacial) corrompida por um ruído de pequena magnitude. Se esse ruído não ofusca os
            elementos de <InlineMath math="A" />, o posto real da matriz fica refletido nos
            primeiros valores singulares — daí a queda acentuada visível no espectro e a razão
            de poucos <InlineMath math="\sigma_i" /> já capturarem a maior parte de{' '}
            <InlineMath math="\|A\|_F^2" />.
          </p>
        </section>

        <section id="calculo">
          <h2>5. Como se calcula: SVD completa vs SVD truncada</h2>

          <Note>
            Esta seção é aprofundamento além da ementa do curso — não corresponde a um teorema
            da apostila, mas se conecta diretamente ao <strong>Método da Potência</strong>{' '}
            estudado no bloco de P2.
          </Note>

          <p>
            A <strong>SVD completa</strong> (LAPACK <code>gesdd</code>, usada por{' '}
            <code>numpy.linalg.svd</code>) tem complexidade{' '}
            <InlineMath math="O(\min(mn^{2}, m^{2}n))" /> e devolve todos os{' '}
            <InlineMath math="r=\min(m,n)" /> valores singulares, mesmo quando só interessam os{' '}
            <InlineMath math="k \ll r" /> maiores.
          </p>
          <p>
            A <strong>SVD truncada</strong> via ARPACK/Lanczos (
            <code>scipy.sparse.linalg.svds</code>) calcula só os <InlineMath math="k" /> maiores,
            aplicando essencialmente o <strong>método da potência</strong> em{' '}
            <InlineMath math="A^{T}A" />: multiplicações sucessivas por{' '}
            <InlineMath math="A^{T}A" /> convergem para o autovetor dominante — o mesmo princípio
            do Método da Potência visto no bloco de PCA/SVD/K-means, só que aplicado à matriz{' '}
            <InlineMath math="A^{T}A" /> em vez de à matriz original. Deflação (Lanczos em
            blocos) fornece os demais <InlineMath math="\sigma_2, \sigma_3, \dots" />. Cada
            iteração custa <InlineMath math="O(mn)" />, então obter os <InlineMath math="k" />{' '}
            maiores custa aproximadamente <InlineMath math="O(k \cdot m \cdot n)" />.
          </p>
          <p>
            No back-end usamos uma heurística: <code>svds</code> quando{' '}
            <InlineMath math="k < 0.3 \cdot \min(m,n)" />, senão a SVD completa (ARPACK fica
            lento quando <InlineMath math="k" /> é grande, por precisar de muitas iterações de
            deflação).
          </p>
        </section>

        <section id="estabilidade">
          <h2>
            6. Estabilidade numérica: por que não calcular via{' '}
            <InlineMath math="A^{T}A" />
          </h2>

          <Note>
            Também não está formalizada como teorema na apostila, mas se apoia diretamente em
            dois resultados dela.
          </Note>

          <p>
            Uma tentação é diagonalizar <InlineMath math="A^{T}A" /> e tirar a raiz quadrada dos
            autovalores para obter os <InlineMath math="\sigma_i" /> — o que é justificado pelo{' '}
            <strong>Teorema T26</strong> (Igualdade entre os autovalores não-nulos de{' '}
            <InlineMath math="A^{T}A" /> e <InlineMath math="AA^{T}" />) e pelo{' '}
            <strong>Teorema T27</strong> (Autovalores de Matriz Simétrica são Reais), que garante
            que esses autovalores são reais e não-negativos, logo a raiz está bem definida.
          </p>
          <p>
            Ainda assim, calcular por esse caminho é <strong>numericamente instável</strong>: o
            número de condicionamento se eleva ao quadrado,
          </p>
          <BlockMath math="\kappa(A^{T}A) = \kappa(A)^{2}," />
          <p>
            dobrando a perda de dígitos significativos em ponto flutuante. Se{' '}
            <InlineMath math="\kappa(A) \approx 10^{6}" />, resolver via{' '}
            <InlineMath math="A^{T}A" /> se comporta como{' '}
            <InlineMath math="\kappa \approx 10^{12}" />, consumindo praticamente todos os ~16
            dígitos do <code>float64</code>. Algoritmos como Golub–Reinsch (o{' '}
            <code>gesdd</code>) trabalham diretamente em <InlineMath math="A" /> via
            bidiagonalização ortogonal, preservando o condicionamento original — a mesma
            preocupação com estabilidade numérica que aparece no curso ao evitar pivôs pequenos
            na fatoração PLU.
          </p>
        </section>

        <section id="taxa-regiao">
          <h2>7. Taxa de compressão e compressão por região</h2>
          <p>
            Para uma imagem <InlineMath math="m \times n" /> aproximada por posto{' '}
            <InlineMath math="k" />, armazenar <InlineMath math="U_k" />,{' '}
            <InlineMath math="\Sigma_k" /> e <InlineMath math="V_k" /> em vez da matriz original
            dá uma taxa de compressão aproximada de
          </p>
          <BlockMath math="\text{taxa} \approx \frac{k(m+n)}{mn}," />
          <p>
            fórmula fechada que a apostila do Yuri Castro apresenta explicitamente na seção
            sobre SVD truncada e aproximação de posto k. Este projeto responde, na prática, à
            questão integradora 26 dessa apostila — <em>"explique como a decomposição SVD pode
            ser usada para comprimir uma imagem e relacione a taxa de compressão com o número de
            valores singulares retidos"</em> — comparando a taxa teórica acima com o tamanho de
            arquivo real medido a cada slider movido na interface.
          </p>
          <p>
            A extensão implementada permite dois valores de <InlineMath math="k" />: um alto
            dentro de uma região selecionada (<InlineMath math="k_{\text{região}}" />, alta
            fidelidade) e um baixo fora dela (<InlineMath math="k_{\text{base}}" />, compressão
            agressiva). Esta parte não corresponde a nenhum resultado da apostila — é a
            aplicação original do projeto.
          </p>

          <div className="mode-cards">
            <div className="mode-card">
              <div className="mode-card-title">Modo Global</div>
              <p>
                Uma única SVD por canal reconstrói duas aproximações{' '}
                <InlineMath math="A_{k_{\text{base}}}" /> e{' '}
                <InlineMath math="A_{k_{\text{região}}}" />, misturadas via máscara binária{' '}
                <InlineMath math="M" />:
              </p>
              <BlockMath math="\tilde{A} = (1-M) \odot A_{k_{\text{base}}} + M \odot A_{k_{\text{região}}}" />
            </div>
            <div className="mode-card">
              <div className="mode-card-title">Modo Tiles</div>
              <p>
                Divide a imagem em blocos <InlineMath math="128 \times 128" /> e faz uma SVD por
                bloco, usando <InlineMath math="k_{\text{região}}" /> nos blocos que intersectam
                a região e <InlineMath math="k_{\text{base}}" /> nos demais. Custo total menor
                (SVDs de matrizes pequenas), mas a transição entre blocos gera artefatos
                visíveis.
              </p>
            </div>
          </div>
        </section>

        <section id="referencias">
          <h2>Referências</h2>
          <ul className="refs">
            <li>
              Apostila da disciplina (Prof. Marcello Goulart) — Teoremas T22, T23, T26, T27, T30,
              T31 e Propriedades P13.1, P13.4, capítulo de PCA/SVD; exemplos do contador
              (compressão de dados) e do reconhecimento de dígitos (aproximação de posto baixo).
            </li>
            <li>
              Notas de aula / quadro (08/04) — introdução da SVD via o problema de compressão de
              foto P&amp;B, exemplos de matrizes de posto 1 e posto 2.
            </li>
            <li>
              Apostila complementar (Yuri Castro) — formulação geométrica{' '}
              <InlineMath math="Av_i = \sigma_i u_i" />, fórmula de taxa de compressão{' '}
              <InlineMath math="k(m+n)/mn" />, Exercício 26 (SVD e compressão de imagem),
              aplicação a sistemas de recomendação (Netflix Prize).
            </li>
          </ul>
        </section>

        <div className="prose-footer">
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            ↑ Voltar ao topo
          </a>
        </div>
      </article>
    </div>
  );
}
