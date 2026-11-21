/* Campo com lista: uma linha que abre as opções, no lugar das paredes de chips.

   Por que não o <datalist> nativo: ele não aceita escolha múltipla, não mostra turma
   nem avatar em cada linha, não cabe o botão "não está na lista", e cada navegador o
   desenha de um jeito. Este segue o visual do app em todo aparelho.

   A regra que não pode ser quebrada: digitar na busca NÃO redesenha a tela. Reescreve
   só as opções. Redesenhar destruiria o campo em foco a cada tecla, que foi
   exatamente o defeito que derrubava a digitação no celular.

   A lista abre no fluxo, empurrando o conteúdo para baixo, em vez de flutuar por
   cima: flutuando, seria cortada pelo recorte de rolagem da tela. */

import { S, app, render } from './core.js';
import { esc, semAcento, ICON, svgIc } from './util.js';

/* Acima disto a busca aparece sozinha; abaixo, só se o chamador pedir. */
const LIMITE_BUSCA = 6;

/* Guarda a configuração de cada campo desenhado, para os handlers globais — que só
   recebem strings pelo onclick — saberem o que fazer. Recriado a cada render. */
const CAMPOS = {};

const normaliza = ops => (ops || [])
  .filter(Boolean)
  .map(o => typeof o === 'string' ? { valor:o, nome:o } : o);

const chave = s => semAcento(String(s ?? '')).toLowerCase();

/* "Contém", não borda de palavra: quem digita "ali" espera achar "Alice". */
const filtra = (lista, q) => !String(q || '').trim() ? lista
  : lista.filter(o => chave(o.nome).includes(chave(q)) || chave(o.sub).includes(chave(q)));

function opcoesHTML(cfg, q){
  const lista = filtra(normaliza(cfg.opcoes), q);
  const sel = cfg.multipla ? (cfg.valor || []) : (cfg.valor ? [cfg.valor] : []);
  if(!lista.length)
    return `<p class="cl-vazio">${esc(cfg.vazio || 'Nada encontrado.')}</p>`;
  return lista.map(o => {
    const on = sel.includes(o.valor);
    return `<button type="button" class="cl-op" aria-pressed="${on}"
      onclick="app.escolherLista('${esc(cfg.id)}','${esc(o.valor)}')">
      ${o.ini ? `<span class="avatar sm">${esc(o.ini)}</span>` : ''}
      <span class="grow">
        <span class="cl-nome">${esc(o.nome)}</span>
        ${o.sub ? `<span class="fs11 muted">${esc(o.sub)}</span>` : ''}
      </span>
      <span class="mk" aria-hidden="true"></span>
    </button>`;
  }).join('');
}

/** Desenha o campo.
    cfg: { id, rotulo, opcoes, valor, multipla, busca, placeholder, vazio, aoEscolher } */
export function campoLista(cfg){
  CAMPOS[cfg.id] = cfg;
  const lista = normaliza(cfg.opcoes);
  const aberto = S.listaAberta === cfg.id;
  const comBusca = cfg.busca !== undefined ? cfg.busca : lista.length > LIMITE_BUSCA;
  const sel = cfg.multipla ? (cfg.valor || []) : (cfg.valor ? [cfg.valor] : []);
  const marcadas = lista.filter(o => sel.includes(o.valor));
  const ph = esc(cfg.placeholder || 'Escolher');

  const resumo = cfg.multipla
    ? (marcadas.length
        ? marcadas.map(o => `<span class="tok">
            ${o.ini ? `<span class="avatar sm">${esc(o.ini)}</span>` : ''}${esc(o.nome)}
            <span class="x" role="button" aria-label="Tirar ${esc(o.nome)}"
              onclick="event.stopPropagation();app.escolherLista('${esc(cfg.id)}','${esc(o.valor)}')"
              >&times;</span></span>`).join('')
        : `<span class="cl-ph">${ph}</span>`)
    : (marcadas.length ? `<span class="cl-val">${esc(marcadas[0].nome)}</span>`
                       : `<span class="cl-ph">${ph}</span>`);

  return `<div class="cl${aberto ? ' aberto' : ''}">
    ${cfg.rotulo ? `<p class="sec-label">${esc(cfg.rotulo)}</p>` : ''}
    <button type="button" class="cl-campo" aria-expanded="${aberto}"
      onclick="app.abrirLista('${esc(cfg.id)}')">
      <span class="grow cl-resumo">${resumo}</span>
      <span class="cl-seta" aria-hidden="true">&#9662;</span>
    </button>
    ${aberto ? `<div class="cl-lista">
      ${comBusca ? `<div class="cl-busca">
        <span class="ic" aria-hidden="true">${svgIc(ICON.busca)}</span>
        <input id="bl-${esc(cfg.id)}" placeholder="Buscar" autocomplete="off"
               oninput="app.filtrarLista('${esc(cfg.id)}', this.value)">
      </div>` : ''}
      <div class="cl-ops" id="ops-${esc(cfg.id)}">${opcoesHTML(cfg, '')}</div>
      ${cfg.rodape || ''}
    </div>` : ''}
  </div>`;
}

app.abrirLista = id => {
  S.listaAberta = S.listaAberta === id ? null : id;
  render();
  /* Com busca, o teclado já aparece pronto para filtrar. */
  const b = document.getElementById('bl-' + id);
  if(b) b.focus();
};

app.filtrarLista = (id, q) => {
  const cfg = CAMPOS[id];
  const alvo = document.getElementById('ops-' + id);
  if(cfg && alvo) alvo.innerHTML = opcoesHTML(cfg, q);
};

app.escolherLista = (id, valor) => {
  const cfg = CAMPOS[id];
  if(!cfg) return;
  if(!cfg.multipla) S.listaAberta = null;
  if(typeof cfg.aoEscolher === 'function') cfg.aoEscolher(valor);
  render();
};

/* Tocar fora fecha. Sem isto, a lista só fecharia escolhendo algo. */
if(typeof document !== 'undefined'){
  document.addEventListener('click', ev => {
    if(!S.listaAberta) return;
    if(ev.target.closest && ev.target.closest('.cl')) return;
    S.listaAberta = null;
    render();
  });
}
