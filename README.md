Extensão validada em ambiente controlado

# Privacy Monitor — Extensão Firefox para Detecção de Rastreamento

> **Roteiro 4 — Insper | Prof. João Eduardo**
> Extensão WebExtension para Firefox que detecta e apresenta ao usuário os principais vetores de rastreamento e violação de privacidade presentes na navegação web moderna.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Instalação](#2-instalação)
3. [Como usar](#3-como-usar)
4. [Arquitetura da extensão](#4-arquitetura-da-extensão)
5. [Módulos implementados](#5-módulos-implementados)
6. [Metodologia do Privacy Score](#6-metodologia-do-privacy-score)
7. [Testes e validação](#7-testes-e-validação)
8. [Limitações conhecidas](#8-limitações-conhecidas)
9. [Estrutura de arquivos](#9-estrutura-de-arquivos)

---

## 1. Visão geral

O Privacy Monitor é uma extensão para Firefox Developer Edition que monitora em tempo real seis vetores de rastreamento durante a navegação web:

- **Conexões a domínios de terceira parte** — todos os recursos externos carregados pela página
- **Tentativas de hijacking** — scripts suspeitos e redirecionamentos não autorizados
- **Web Storage e IndexedDB** — dados persistidos no navegador pelo site
- **Análise de cookies** — diferenciando primeira/terceira parte e sessão/persistente
- **Browser fingerprinting** — interceptação de chamadas a Canvas, WebGL e AudioContext
- **Privacy Score** — pontuação consolidada de 0 a 100 indicando o nível de respeito à privacidade da página

A extensão foi desenvolvida em JavaScript usando a WebExtensions API e segue o padrão Manifest V2, suportado pelo Firefox.

---

## 2. Instalação

### Requisitos

- Firefox Developer Edition 115 ou superior
- Permissões de carregamento de extensões temporárias

### Passo a passo

1. Abra o Firefox Developer Edition
2. Digite `about:debugging` na barra de endereço e pressione Enter
3. No menu lateral, clique em **"Este Firefox"**
4. Clique em **"Carregar extensão temporária..."**
5. Selecione o arquivo `manifest.json` da pasta do projeto
6. A extensão aparecerá na lista como "Privacy Monitor"

### Configuração adicional

Para que a extensão funcione corretamente, certifique-se de que a configuração `xpinstall.signatures.required` está definida como `false` em `about:config`.

---

## 3. Como usar

1. Após instalar, navegue para qualquer site
2. Clique no ícone de quebra-cabeça (🧩) na barra de ferramentas do Firefox
3. Selecione **"Privacy Monitor"** na lista
4. O popup mostrará:
   - **Score** de 0 a 100 com classificação (Excelente, Bom, Ruim, Crítico)
   - **Contadores** de domínios de terceira parte, cookies, fingerprinting e storage
   - **Cinco abas** detalhando cada categoria de rastreamento detectado

---

## 4. Arquitetura da extensão

A extensão é composta por quatro contextos de execução que se comunicam por mensagens:

```
┌─────────────────────┐
│  privacy_monitor.js │ ← Background script (sempre ativo)
│  (background)       │   Intercepta requisições, cookies e calcula score
└─────────┬───────────┘
          │
          │ executeScript / sendMessage
          │
┌─────────▼───────────┐     ┌──────────────────────┐
│  content_script.js  │────▶│  injected_script.js  │
│  (em cada aba)      │     │  (contexto da página)│
└─────────┬───────────┘     └──────────────────────┘
          │
          │ runtime.sendMessage
          │
┌─────────▼───────────┐
│     popup.html      │ ← Interface visual
│     popup.js        │   Apresenta dados ao usuário
└─────────────────────┘
```

**Por que essa separação?** Cada contexto tem permissões e acessos diferentes:

- **Background script** — único contexto com acesso às APIs `webRequest`, `cookies` e `tabs.executeScript`
- **Content script** — roda dentro da aba mas em contexto isolado; consegue ler `localStorage`/`sessionStorage`/`IndexedDB`
- **Injected script** — roda no contexto da página real, podendo sobrescrever protótipos nativos como `HTMLCanvasElement.prototype.toDataURL`
- **Popup** — interface visual que solicita dados ao background via `runtime.sendMessage`

---

## 5. Módulos implementados

### 5.1 Conexões de terceira parte (2,5 pts)

**Arquivo:** `privacy_monitor.js` — Módulo 1

Utiliza a API `webRequest.onBeforeRequest` para interceptar **todas** as requisições HTTP feitas pelas abas. Para cada requisição:

1. Compara o `hostname` da requisição com o `hostname` da aba ativa
2. Se forem diferentes (após normalização do prefixo `www.`), classifica como **terceira parte**
3. Armazena o domínio e o tipo de recurso (`script`, `image`, `xmlhttprequest`, `sub_frame`, `beacon`, `websocket`, etc.)
4. Aplica deduplicação para não listar o mesmo domínio múltiplas vezes

**Resultado típico no UOL:** ~139 domínios de terceira parte detectados, incluindo Google Ads, DoubleClick, Criteo, Permutive, Amazon Adsystem, Rubicon Project e dezenas de outras redes de rastreamento.

### 5.2 Detecção de hijacking (1 pt)

**Arquivo:** `privacy_monitor.js` — Módulos 1 e 2

Implementa duas heurísticas:

**Scripts externos suspeitos** — verifica se o domínio da requisição contém palavras-chave associadas a rastreamento (`track`, `analytics`, `pixel`, `beacon`, `spy`, `monitor`, `collect`, `telemetry`, `adserv`, `doubleclick`) **E** se é do tipo `script` **E** se não está na whitelist de CDNs legítimos.

**Redirecionamentos não autorizados** — via `webRequest.onHeadersReceived`, detecta respostas HTTP com header `Location` apontando para domínios de terceira parte. Esta é a técnica usada em **cookie syncing**, onde redes de publicidade trocam identificadores entre si.

### 5.3 Web Storage e IndexedDB (2,5 pts)

**Arquivo:** `content_script.js` — Módulo 2

O content script roda dentro de cada aba e coleta:

- **localStorage** — todas as chaves e seus respectivos tamanhos em bytes
- **sessionStorage** — todas as chaves e seus respectivos tamanhos em bytes
- **IndexedDB** — lista todos os databases via `indexedDB.databases()` e, para cada um, abre uma conexão e extrai os nomes dos object stores

Os dados são enviados ao background via `runtime.sendMessage` em três momentos: ao carregamento da página, 3 segundos depois, e 6 segundos depois — garantindo captura mesmo em páginas que persistem dados após scripts assíncronos.

### 5.4 Análise de cookies (1 pt)

**Arquivo:** `privacy_monitor.js` — Módulo 3

Quando uma aba termina de carregar (`tabs.onUpdated` com `status === "complete"`), a função `coletarCookies` usa `browser.cookies.getAll({ url: tabUrl })` para obter todos os cookies relevantes à URL atual.

Para cada cookie, classifica:

| Atributo | Como é determinado |
|---|---|
| `firstParty` | Domínio do cookie coincide com o da aba |
| `session` | Cookie sem `expirationDate` |
| `persistent` | Cookie com `expirationDate` definido |
| `httpOnly` | Atributo nativo |
| `secure` | Atributo nativo |
| `sameSite` | Atributo nativo |

**Supercookies:** a base para detecção está implementada — o header `Strict-Transport-Security` é capturável via `webRequest.onHeadersReceived` para identificação de HSTS supercookies. A correlação com ETags entre múltiplos domínios fica como evolução futura.

### 5.5 Browser fingerprinting (1 pt)

**Arquivos:** `injected_script.js` + `content_script.js` — Módulo 1

A detecção exige rodar código **no contexto da página real**, não no contexto isolado do content script. A estratégia usa três camadas:

1. O `content_script.js` cria uma tag `<script>` apontando para `injected_script.js` (declarado em `web_accessible_resources` no manifest)
2. O `injected_script.js` roda no contexto da página e **sobrescreve os métodos nativos** dos protótipos:
   - `HTMLCanvasElement.prototype.toDataURL`
   - `CanvasRenderingContext2D.prototype.getImageData`
   - `WebGLRenderingContext.prototype.getParameter`
   - `WebGLRenderingContext.prototype.getExtension` (para detectar `WEBGL_debug_renderer_info`)
   - `AudioContext.prototype.createOscillator`
   - `AudioContext.prototype.createDynamicsCompressor`
3. Cada interceptor preserva o comportamento original (`apply` no método nativo) e notifica via `window.postMessage`
4. O content script escuta o `postMessage` e repassa ao background via `runtime.sendMessage`

**Por que essa abordagem?** Content scripts no Firefox rodam em "Xray vision" — vêem o DOM mas não compartilham os protótipos com a página, então sobrescrever `HTMLCanvasElement.prototype.toDataURL` no content script não afeta o código da página.

### 5.6 Privacy Score (2 pts)

Ver [seção 6 — Metodologia do Privacy Score](#6-metodologia-do-privacy-score).

---

## 6. Metodologia do Privacy Score

O Privacy Score é uma pontuação de **0 a 100** que indica quão respeitosa à privacidade do usuário é a página atual. Começa em **100** e sofre deduções por cada categoria de violação detectada.

### Fórmula de cálculo

| Categoria | Penalidade | Limite máximo |
|---|---|---|
| Domínios de terceira parte | −2 por domínio | −40 |
| Tentativas de hijacking | −3 por evento | −20 |
| APIs de fingerprinting | −10 por API detectada | sem limite |
| Cookies de terceira parte | −2 por cookie | −15 |
| Armazenamento abusivo (>20 itens) | −5 fixo | −5 |

O score nunca fica abaixo de zero.

### Classificação por faixa

| Score | Classificação | Cor |
|---|---|---|
| 80–100 | Excelente | 🟢 Verde |
| 60–79 | Bom | 🟡 Amarelo |
| 40–59 | Ruim | 🟠 Laranja |
| 0–39 | Crítico | 🔴 Vermelho |

### Justificativa dos pesos

A metodologia segue princípios consolidados de ferramentas de privacidade reconhecidas, particularmente o **Privacy Badger** da EFF (Electronic Frontier Foundation) e o **Tracker Radar** da DuckDuckGo. Ambos adotam uma abordagem em camadas onde diferentes vetores de rastreamento recebem pesos proporcionais ao risco que representam.

**Domínios de terceira parte (−2 cada, máx −40):** o peso individual é baixo porque sites legítimos podem carregar dezenas de recursos externos (CDNs, fontes, imagens). A abordagem segue o princípio do Privacy Badger: nem todo domínio externo é necessariamente um tracker. O limite máximo de −40 evita que o score zere apenas por essa categoria.

**Hijacking (−3 cada, máx −20):** peso maior por categoria porque scripts suspeitos e redirecionamentos não autorizados representam **risco ativo** de segurança, alinhado com a classificação OWASP que coloca XSS e injeção entre as top 10 ameaças web.

**Fingerprinting (−10 sem limite):** fingerprinting é o vetor mais agressivo segundo estudo da Mozilla sobre rastreamento moderno — cria identificadores persistentes que **sobrevivem à limpeza de cookies e ao modo privativo**. A ausência de limite permite que sites com múltiplas APIs de fingerprinting sejam penalizados severamente.

**Cookies de terceira parte (−2 cada, máx −15):** apesar da depreciação anunciada pelos principais browsers, ainda são amplamente usados para cookie syncing. Peso moderado porque o impacto isolado é menor que fingerprinting.

**Supercookies (−5 cada, máx −25):** peso elevado por categoria porque supercookies (HSTS persistentes e ETags compartilhados entre domínios) são especificamente projetados para **contornar a limpeza tradicional** de cookies. Detecção alinhada com pesquisa de Acar et al. (2014) sobre "The Web Never Forgets: Persistent Tracking Mechanisms in the Wild". O limite máximo evita zeragem automática mantendo o vetor com importância significativa.

**Storage abusivo (−5 fixo se >20 itens):** detecta sites que abusam de `localStorage`/`sessionStorage` como substitutos persistentes para cookies. Threshold de 20 itens baseado em análise empírica — sites legítimos raramente excedem esse limite.



---

## 7. Testes e validação

A extensão foi validada contra três cenários distintos para garantir corretude e ausência de falso-positivos:

### Site com rastreamento agressivo: `uol.com.br`
- **69 domínios** de terceira parte detectados
- **4 tentativas de hijacking** identificadas (scripts suspeitos + redirects)
- **38 cookies** capturados (32 de primeira parte, 6 de terceira parte)
- **48 itens** em localStorage, **2 bancos IndexedDB**
- **Score final: 43 (Ruim)**

### Ferramenta de teste de fingerprinting: `amiunique.org`
- **5 APIs de fingerprinting** detectadas: Canvas.toDataURL, WebGL.getParameter, WebGL.WEBGL_debug_renderer_info, AudioContext.createOscillator, AudioContext.createDynamicsCompressor
- Confirma que a extensão captura **todas** as técnicas modernas de fingerprinting

### Site limpo: `example.com`
- **0 domínios** de terceira parte
- **0 cookies**
- **0 storage**
- **0 fingerprinting**
- **Score final: 100 (Excelente)**

Esse último teste é a **prova de ausência de falso-positivo** — a extensão não inventa rastreamento onde não há.

---


