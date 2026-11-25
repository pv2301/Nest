/* Seleção: um controle só, escolhido pelo número de opções.

   A regra é a de Material 3 e do guia da Apple, e vive aqui — nenhuma tela decide
   por conta própria:

     até 3 opções → segmentado, lado a lado   (trocar custa um toque)
     4 opções     → chips visíveis
     5 ou mais    → campo que abre lista, com busca

   Esconder duas opções atrás de um campo transforma uma resposta de um toque em
   duas, e este formulário é preenchido de pé, com pressa.

   A contagem é feita ao desenhar: uma escola com doze turmas recebe campo onde a de
   três recebe chips, sem ninguém decidir de novo.

   Regra que não se quebra: digitar na busca NÃO redesenha a tela, reescreve só as
   opções. Redesenhar destrói o campo em foco e derruba o teclado preditivo.

   A lista abre no fluxo, empurrando o conteúdo, em vez de flutuar: flutuando seria
   cortada pelo recorte de rolagem. */

import { S, app, render } from './core.js';
import { esc, semAcento, ICON, svgIc } from './util.js';

const ATE_SEGMENTADO = 3;
const ATE_CHIPS = 4;

/* Configuração de cada controle desenhado: os handlers globais só recebem strings
   pelo onclick, então precisam reencontrar o resto aqui. Recriado a cada render. */
const CAMPOS = {};

const normaliza = ops => (ops || [])
  .filter(Boolean)
  .map(o => typeof o === 'string' ? { valor:o, nome:o } : o);

const chave = s => semAcento(String(s ?? '')).toLowerCase();

/* "Contém", não borda de palavra: quem digita "ali" espera achar "Alice". */
const filtra = (lista, q) => !String(q || '').trim() ? lista
  : lista.filter(o => chave(o.nome).includes(chave(q)) || chave(o.sub).includes(chave(q)));

const selecionados = cfg => cfg.multipla ? (cfg.valor || []) : (cfg.valor ? [cfg.valor] : []);

/* ---------------------------------------------------------------- rótulo e erro */
const rotuloHTML = cfg => cfg.rotulo
  ? `<p class="sec-label" id="lab-${esc(cfg.id)}">${esc(cfg.rotulo)}</p>` : '';

const erroHTML = cfg => cfg.erro
  ? `<p class="erromsg" id="err-${esc(cfg.id)}">${esc(cfg.erro)}</p>` : '';

const aria = cfg => `${cfg.rotulo ? `aria-labelledby="lab-${esc(cfg.id)}"` : ''}
  ${cfg.erro ? `aria-invalid="true" aria-describedby="err-${esc(cfg.id)}"` : ''}`;

/* ---------------------------------------------------------------- segmentado */
/* Opção pode trazer `ic`, o nome de um ícone do ICON. Só o segmentado desenha: nos
   chips e no campo com lista a marca competiria com o texto em vez de ajudar. */
function segmentado(cfg){
  const lista = normaliza(cfg.opcoes);
  const sel = selecionados(cfg);
  return `<div class="esc${cfg.erro ? ' com-erro' : ''}">
    ${rotuloHTML(cfg)}
    <div class="seg" role="radiogroup" ${aria(cfg)} data-escolha="${esc(cfg.id)}">
      ${lista.map(o => `<button type="button" role="radio" aria-checked="${sel.includes(o.valor)}"
        onclick="app.escolherLista('${esc(cfg.id)}','${esc(o.valor)}')"
        >${o.ic && ICON[o.ic] ? svgIc(ICON[o.ic]) : ''}${esc(o.nome)}</button>`).join('')}
    </div>
    ${erroHTML(cfg)}
  </div>`;
}

/* ---------------------------------------------------------------- chips */
function chips(cfg){
  const lista = normaliza(cfg.opcoes);
  const sel = selecionados(cfg);
  const papel = cfg.multipla ? 'group' : 'radiogroup';
  return `<div class="esc${cfg.erro ? ' com-erro' : ''}">
    ${rotuloHTML(cfg)}
    <div class="chips" role="${papel}" ${aria(cfg)} data-escolha="${esc(cfg.id)}">
      ${lista.map(o => {
        const on = sel.includes(o.valor);
        const marca = cfg.multipla ? `aria-pressed="${on}"` : `role="radio" aria-checked="${on}"`;
        return `<button type="button" class="chip" ${marca}
          onclick="app.escolherLista('${esc(cfg.id)}','${esc(o.valor)}')">${esc(o.nome)}</button>`;
      }).join('')}
    </div>
    ${erroHTML(cfg)}
  </div>`;
}

/* ---------------------------------------------------------------- campo com lista */
function opcoesHTML(cfg, q){
  const lista = filtra(normaliza(cfg.opcoes), q);
  const sel = selecionados(cfg);
  if(!lista.length)
    return `<p class="cl-vazio">${esc(cfg.vazio || 'Nada encontrado.')}</p>`;
  return lista.map(o => {
    const on = sel.includes(o.valor);
    return `<button type="button" class="cl-op" role="option" aria-selected="${on}"
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

/* A lista de escolha múltipla NÃO fecha a cada toque — é o que permite escolher
   várias. O problema é que sem uma saída explícita ela vira uma armadilha no
   celular: ela ocupa 46vh com rolagem própria e overscroll-behavior:contain, então
   quem tenta rolar para alcançar o campo seguinte rola a lista por dentro e a página
   não anda. Com duas crianças escolhidas, medido num Pixel 7, "Papel nesta
   ocorrência" ficava em y=975 numa tela de 915 — fora de alcance.

   Tocar fora fecha, mas os campos de baixo estão dentro de um .esc, e o handler de
   fora ignora o que está dentro de um. Daí o botão Pronto: a saída que faltava. */
function campoLista(cfg){
  const lista = normaliza(cfg.opcoes);
  const aberto = S.listaAberta === cfg.id;
  const comBusca = cfg.busca !== undefined ? cfg.busca : lista.length > 6;
  const sel = selecionados(cfg);
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

  return `<div class="esc cl${aberto ? ' aberto' : ''}${cfg.erro ? ' com-erro' : ''}">
    ${rotuloHTML(cfg)}
    <button type="button" class="cl-campo" id="cp-${esc(cfg.id)}"
      role="combobox" aria-haspopup="listbox" aria-expanded="${aberto}"
      aria-controls="ops-${esc(cfg.id)}" ${aria(cfg)}
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
      <div class="cl-ops" id="ops-${esc(cfg.id)}" role="listbox"
           ${cfg.multipla ? 'aria-multiselectable="true"' : ''}>${opcoesHTML(cfg, '')}</div>
      ${cfg.rodape || ''}
      ${cfg.multipla ? `<button type="button" class="cl-pronto"
        onclick="app.fecharLista()">Pronto${marcadas.length ? ` · ${marcadas.length}` : ''}</button>` : ''}
    </div>` : ''}
    ${erroHTML(cfg)}
  </div>`;
}

/* ---------------------------------------------------------------- porta de entrada */
/** cfg: { id, rotulo, opcoes, valor, multipla, busca, placeholder, vazio, erro,
           rodape, aoEscolher, forcar } */
export function escolha(cfg){
  CAMPOS[cfg.id] = cfg;
  const n = normaliza(cfg.opcoes).length;
  if(cfg.forcar === 'campo' || n > ATE_CHIPS) return campoLista(cfg);
  if(n <= ATE_SEGMENTADO) return segmentado(cfg);
  return chips(cfg);
}

/* ---------------------------------------------------------------- handlers */
app.abrirLista = id => {
  S.listaAberta = S.listaAberta === id ? null : id;
  render();
  if(S.listaAberta !== id) return;
  const b = document.getElementById('bl-' + id);
  if(b) b.focus();
  /* Abrindo perto do rodapé, as opções nasceriam abaixo da dobra. */
  const lista = document.getElementById('ops-' + id);
  if(lista) lista.scrollIntoView({ block:'nearest', behavior:'smooth' });
};

app.filtrarLista = (id, q) => {
  const cfg = CAMPOS[id];
  const alvo = document.getElementById('ops-' + id);
  if(cfg && alvo) alvo.innerHTML = opcoesHTML(cfg, q);
};

/** Único handler dos três controles. */
app.escolherLista = (id, valor) => {
  const cfg = CAMPOS[id];
  if(!cfg) return;
  if(!cfg.multipla) S.listaAberta = null;
  if(typeof cfg.aoEscolher === 'function') cfg.aoEscolher(valor);
  render();
};

/** Fecha a lista aberta, se houver. Usado pelo voltar e pelo Esc. */
export function fecharLista(){
  if(!S.listaAberta) return false;
  const id = S.listaAberta;
  S.listaAberta = null;
  render();
  const campo = document.getElementById('cp-' + id);
  if(campo) campo.focus();
  return true;
}
app.fecharLista = fecharLista;

if(typeof document !== 'undefined'){
  /* Tocar fora fecha. */
  document.addEventListener('click', ev => {
    if(!S.listaAberta) return;
    if(ev.target.closest && ev.target.closest('.esc')) return;
    S.listaAberta = null;
    render();
  });

  /* Teclado: Esc fecha, setas andam, Enter escolhe. Vale para a lista e para os
     grupos de rádio, que é o que se espera de um controle de seleção. */
  document.addEventListener('keydown', ev => {
    if(ev.key === 'Escape' && S.listaAberta){ ev.preventDefault(); fecharLista(); return; }

    const dentro = ev.target.closest && ev.target.closest('.cl-lista, [data-escolha]');
    if(!dentro) return;
    const itens = Array.from(dentro.querySelectorAll('.cl-op, button[role="radio"], .chip'));
    if(!itens.length) return;
    const i = itens.indexOf(document.activeElement);

    if(ev.key === 'ArrowDown' || ev.key === 'ArrowRight'){
      ev.preventDefault(); itens[Math.min(i + 1, itens.length - 1) < 0 ? 0 : Math.min(i + 1, itens.length - 1)].focus();
    } else if(ev.key === 'ArrowUp' || ev.key === 'ArrowLeft'){
      ev.preventDefault(); itens[Math.max(i - 1, 0)].focus();
    } else if(ev.key === 'Home'){ ev.preventDefault(); itens[0].focus(); }
    else if(ev.key === 'End'){ ev.preventDefault(); itens[itens.length - 1].focus(); }
  });
}
