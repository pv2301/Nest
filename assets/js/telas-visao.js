/* Visão geral: três formas de olhar os mesmos registros, numa tela só.

   Antes eram duas entradas na Gestão — Painel e Calendário — e os destaques seriam
   uma terceira. É o mesmo conjunto de dados visto de três ângulos, então viram guias.

   O seletor semana/mês/ano continua dentro da guia do calendário; o filtro de
   período, dentro das outras duas. Cada controle governa o seu pedaço. */

import { S, app, registrarTela, render, rodape, posRender, aluno } from './core.js';
import { esc, ICON, svgIc } from './util.js';
import { PERIODOS, catId } from './vocabulario.js';
import { filtraPorPeriodo, agregaPorHoraLocal, contaPor, recorrencia, paresRecorrentes,
         resumo, ladoDaCelula, colunaDeNomes, LINHA_HORAS } from './metricas.js';
import { tipoDe, vazio } from './telas-comum.js';
import { escolha } from './escolha.js';
import { corpoCalendario } from './telas-calendario.js';
import { destaques } from './destaques.js';

const GUIAS = [
  { valor:'destaques',    nome:'Destaques' },
  { valor:'calendario',   nome:'Calendário' },
  { valor:'estatisticas', nome:'Estatísticas' }
];

/* Hoje, semana, mês… Vale para os destaques e para as estatísticas, que leem os
   mesmos registros; o calendário tem o seletor próprio de semana/mês/ano. */
const filtroPeriodo = () => `<div class="chips" role="group" aria-label="Período">
  ${PERIODOS.map(p => `<button class="chip sm" aria-pressed="${S.periodo === p.id}"
    onclick="app.periodo('${esc(p.id)}')">${esc(p.nome)}</button>`).join('')}
</div>`;

function corpo(guia){
  return guia === 'calendario' ? corpoCalendario()
    : guia === 'estatisticas' ? corpoPainel()
    : destaques();
}

function telaVisao(){
  const g = GUIAS.some(x => x.valor === S.visaoGuia) ? S.visaoGuia : 'destaques';
  return `<div class="stack s18">
    ${escolha({ id:'visao-guia', opcoes:GUIAS, valor:g,
      aoEscolher:v => { S.visaoGuia = v; } })}
    ${g === 'calendario' ? '' : filtroPeriodo()}
    ${corpo(g)}
    ${rodape()}
  </div>`;
}

registrarTela('visao', telaVisao);

/* Painel e Calendário continuam respondendo pelo nome: quem tiver o endereço antigo
   na memória — ou um atalho antigo — cai na guia certa em vez de numa tela que sumiu.

   Só ao ENTRAR, e não a cada desenho. Fixando a cada desenho, quem chegasse por um
   destes dois endereços ficava preso na guia: tocar em Destaques mudava S.visaoGuia, o
   redesenho passava por aqui e punha 'estatisticas' de volta antes de desenhar. Pela
   aba de baixo — 'visao' — as guias sempre funcionaram; por 'painel' e 'calendario',
   não trocavam. Medido. Era eu que tinha escrito assim, ao consertar outra coisa:
   antes estas telas mexiam em S.tela no meio do desenho, o que não redesenha.

   `telaDesenhada` é a tela do desenho anterior, então diferente dela significa "acabei
   de chegar" — e aí o endereço antigo continua levando à guia certa. */
const aoEntrar = (tela, guia) => { if(S.telaDesenhada !== tela) S.visaoGuia = guia; };
registrarTela('painel', () => { aoEntrar('painel', 'estatisticas'); return telaVisao(); });
registrarTela('calendario', () => { aoEntrar('calendario', 'calendario'); return telaVisao(); });

/* ---------------------------------------------------------------- painel */
app.periodo = p => { S.periodo = p; render(); };

/* Os tipos de uma categoria, do mais comum ao menos. */
const tiposDe = (ocs, cat) =>
  contaPor(ocs.filter(o => o.categoria === cat), o => tipoDe(o), 8);

/* Uma aberta por vez: num celular, duas ou três abertas empurram o resto da tela
   para fora de vista, e a comparação entre categorias — que é o ponto do cartão —
   se perde. */
app.abrirCategoria = cat => {
  S.catAberta = S.catAberta === cat ? null : cat;
  render();
};

function corpoPainel(){
  const ocs = filtraPorPeriodo(S.ocs, S.periodo);
  const r = resumo(ocs);
  const grade = agregaPorHoraLocal(ocs);
  const cats = contaPor(ocs, 'categoria', 5);
  const maxCat = cats.length ? cats[0][1] : 1;
  const rec = recorrencia(ocs).slice(0, 4);
  const pares = paresRecorrentes(ocs).slice(0, 3);
  const nomePeriodo = (PERIODOS.find(p => p.id === S.periodo) || {}).nome || '';

  /* O filtro de período saiu daqui: ele governa também os destaques, e duas cópias
     do mesmo controle na mesma tela seriam dois controles para a pessoa. Quem o
     desenha é telas-visao.js, uma vez, acima das guias que o usam. */
  return `<div class="stack s18">
    <div class="tiles">
      <div class="tile"><b>${r.total}</b><small>registros · ${esc(nomePeriodo.toLowerCase())}</small></div>
      <div class="tile${r.aguardando ? ' mark' : ''}"><b>${r.aguardando}</b><small>aguardando ciência</small></div>
      <div class="tile"><b>${r.graves}</b><small>níveis 3 e 4</small></div>
      <div class="tile${r.acompanhamento ? ' mark3' : ''}"><b>${r.acompanhamento}</b><small>em acompanhamento</small></div>
    </div>

    ${!ocs.length ? vazio('Nenhum registro no período', 'Escolha um período maior, ou carregue os dados de demonstração na aba Alunos.') : `
    <div class="card">
      <div class="row" style="margin-bottom:8px">
        <p class="sec-label grow" style="margin:0">Quando e onde acontece</p>
        <!-- 44 nos DOIS lados. Só com min-height o botão saía 24px de largura — um
             ícone sem texto não empurra nada — e a varredura de toque reprovou, com
             razão: um polegar erra um alvo de 24px. -->
        ${grade.linhas.length ? `<button class="btn ghost sm"
          style="min-height:44px;min-width:44px;padding:0 10px;flex:none"
          aria-label="Ver a tabela em tela cheia" title="Ver em tela cheia"
          onclick="app.heatCheio(true)">${svgIc(ICON.expandir)}</button>` : ''}
      </div>
      ${grade.linhas.length ? `
      <!-- Largura fixa por coluna e rolagem horizontal quando não couber. Com 1fr,
           um dia escolar inteiro espremia as células a 20px. Na tela cheia a conta é
           outra, porque lá sobra espaço: quem decide é ladoDaCelula. -->
      <div class="heat-cx"><div class="heat-rolagem">
        ${gradeHTML(grade, { id:'heat', colunas:'108px repeat(' + grade.horas.length + ',34px)',
                             linhaHoras:LINHA_HORAS, linhas:'34px' })}
      </div></div>
      <!-- Com máximo 2, "poucos" ficava entre 0 e 2 querendo dizer exatamente 1. -->
      <div class="legend" style="margin-top:10px"><span><i style="background:var(--surface-2)"></i>0</span>
        <span><i style="background:color-mix(in srgb,var(--teal) 44%,var(--surface))"></i>${
          grade.max <= 2 ? '1' : 'poucos'}</span>
        <span><i style="background:var(--teal)"></i>${grade.max}</span></div>
      `
      : '<p class="fs12 muted" style="margin:0">Sem horário registrado no período.</p>'}
    </div>

    <div class="card">
      <p class="sec-label">O que acontece</p>
      <!-- Eram dois cartões: um de categorias e outro de tipos, listas de barras
           quase idênticas uma embaixo da outra. Tipo é subdivisão de categoria, então
           agora são um nível só: a categoria na linha, os tipos dela ao toque.

           Cada barra no matiz da sua categoria — assim este cartão vira, de graça, a
           chave de leitura dos pontos do calendário. -->
      <div class="bars">${cats.map(([cat, n]) => {
        const aberta = S.catAberta === cat;
        const dentro = aberta ? tiposDe(ocs, cat) : [];
        return `<div class="cat-${catId(cat) || 'sem'}">
          <button class="bar-row abre" aria-expanded="${aberta}"
            aria-controls="tipos-${esc(catId(cat) || 'sem')}"
            onclick="app.abrirCategoria('${esc(cat)}')">
            <span class="lab">${esc(cat)}</span>
            <span class="bar-n">${n}</span>
            <span class="seta" aria-hidden="true">&rsaquo;</span>
            <div class="bar-track"><div class="bar-fill cor-cat"
              style="width:${Math.round(n / maxCat * 100)}%"></div></div>
          </button>
          <div class="tipos" id="tipos-${esc(catId(cat) || 'sem')}"${aberta ? '' : ' hidden'}>
            ${dentro.map(([tp, qt]) => `<div class="bar-row fina">
              <span class="lab">${esc(tp)}</span><span class="bar-n">${qt}</span>
              <div class="bar-track"><div class="bar-fill cor-cat"
                style="width:${Math.round(qt / n * 100)}%"></div></div>
            </div>`).join('') ||
              '<p class="fs11 muted" style="margin:0 0 4px">Sem tipo registrado.</p>'}
          </div>
        </div>`;
      }).join('')}</div>
    </div>

    ${rec.length ? `<div class="card">
      <p class="sec-label">Recorrência no período</p>
      <div class="stack s8">
        ${rec.map(x => `<div class="card flat" style="padding:11px 12px">
          <div class="row"><b class="fs13 grow">${esc(aluno(x.kid).nome)}</b><span class="pill${x.total >= 3 ? ' wait' : ''}">${x.total} registros</span></div>
          <div class="fs11 muted" style="margin-top:3px">Mais frequente como: ${esc(x.principal[0])} (${x.principal[1]}×) · Turma ${esc(aluno(x.kid).turma || '—')}</div>
        </div>`).join('')}
        ${pares.map(p => `<div class="card flat" style="padding:11px 12px">
          <div class="row"><b class="fs13 grow">Par recorrente</b><span class="pill wait">${p.total} episódios</span></div>
          <div class="fs11 muted" style="margin-top:3px">${esc(aluno(p.a).nome)} e ${esc(aluno(p.b).nome)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

`}
  </div>`;
}

/* ---------------------------------------------------------------- a tabela inteira

   O cartão mostra os 6 locais com mais registros e rola na horizontal quando o dia é
   longo: num telefone de 412px, um dia escolar de 12 horas deixa 172px da tabela fora
   da tela. Dá para arrastar, mas arrastar derrota o propósito de um mapa de calor,
   que existe para se ver o padrão de uma vez.

   Em tela cheia, girada no retrato, a mesma tabela cabe inteira — e aí mostra TODOS
   os locais, porque o corte nos 6 era falta de espaço, não escolha. */

/** A grade, desenhada igual nos dois lugares. Só os tamanhos mudam.

    A primeira linha é a das horas e tem altura própria, menor: ela só carrega "8h". As
    seguintes vêm de `grid-auto-rows`. */
function gradeHTML(grade, { id = '', colunas = '', linhas = '', linhaHoras = 0 } = {}){
  return `<div class="heat"${id ? ` id="${id}"` : ''}
       style="grid-template-columns:${colunas}${
         linhaHoras ? ';grid-template-rows:' + linhaHoras + 'px' : ''}${
         linhas ? ';grid-auto-rows:' + linhas : ''}">
    <div class="canto"></div>${grade.horas.map(h => `<div class="hh">${h}h</div>`).join('')}
    ${grade.linhas.map(l => `<div class="rl" title="${esc(l.local)}">${esc(l.local)}</div>` +
      l.celulas.map(n => `<div class="cell" data-n="${n}" data-max="${grade.max}">${n || ''}</div>`)
        .join('')).join('')}
  </div>`;
}

/** A tinta das células. Por classe, e não por `#heat`, para valer na tela cheia. */
function pintarCelulas(raiz){
  (raiz || document).querySelectorAll('.heat .cell').forEach(c => {
    const n = +c.dataset.n, max = +c.dataset.max || 1;
    const pct = n === 0 ? 0 : Math.round(24 + (n / max) * 70);
    c.style.background = n === 0 ? 'var(--surface-2)'
      : `color-mix(in srgb, var(--teal) ${pct}%, var(--surface))`;
    c.style.color = pct >= 70 ? 'var(--accent-ink)' : 'var(--fg)';
  });
}

app.heatCheio = abrir => { S.heatCheio = !!abrir; render(); };

/* O painel mora no document.body, e NÃO dentro de #view. Não é detalhe: puxar.js põe
   `transform` em #view enquanto a pessoa puxa para atualizar, e um ancestral
   transformado passa a ser a referência de `position:fixed` — o painel sairia de
   lugar. O toast já vive assim, pelo mesmo motivo. */
function desenharHeatCheio(){
  const velho = document.getElementById('heat-cheio');
  if(velho) velho.remove();
  if(!S.heatCheio) return null;

  const ocs = filtraPorPeriodo(S.ocs, S.periodo);
  /* Sem limite de locais: o corte nos 6 do cartão era falta de espaço. */
  const grade = agregaPorHoraLocal(ocs, Infinity);
  if(!grade.linhas.length){ S.heatCheio = false; return null; }

  const d = document.createElement('div');
  d.id = 'heat-cheio';
  d.className = 'heat-cheio naoimprime';
  d.innerHTML = `<div class="hc-palco">
    <div class="hc-topo">
      <p class="sec-label grow">Quando e onde acontece</p>
      <button class="btn ghost sm" style="min-height:44px;min-width:44px;padding:0 12px"
        aria-label="Fechar a tela cheia" onclick="app.heatCheio(false)">${svgIc(ICON.encolher)}</button>
    </div>
    <div class="hc-rol">${gradeHTML(grade, { linhaHoras:LINHA_HORAS })}</div>
  </div>`;
  document.body.appendChild(d);
  dimensionarHeatCheio(grade);
  pintarCelulas(d);
  return d;
}

/** Mede a área e escreve o tamanho da célula. A conta mora em metricas.js. */
function dimensionarHeatCheio(grade){
  const rol = document.querySelector('#heat-cheio .hc-rol');
  const g = rol && rol.querySelector('.heat');
  if(!g) return;
  /* clientWidth/clientHeight são lógicos — já vêm com os eixos do palco girado. */
  const largura = rol.clientWidth, altura = rol.clientHeight;
  const nomes = colunaDeNomes(largura);
  const lado = ladoDaCelula({ largura, altura, horas: grade.horas.length,
    locais: grade.linhas.length, colunaNomes: nomes, linhaHoras: LINHA_HORAS });
  g.style.gridTemplateColumns = `${nomes}px repeat(${grade.horas.length},${lado}px)`;
  g.style.gridTemplateRows = `${LINHA_HORAS}px`;
  g.style.gridAutoRows = `${lado}px`;
}

/* Virar o aparelho troca os dois eixos: a célula tem de ser recalculada, senão fica
   dimensionada para a tela de antes. O ouvinte é único e só faz algo com a tela
   aberta. */
if(typeof window !== 'undefined'){
  const remedir = () => {
    if(!S.heatCheio) return;
    const ocs = filtraPorPeriodo(S.ocs, S.periodo);
    dimensionarHeatCheio(agregaPorHoraLocal(ocs, Infinity));
  };
  window.addEventListener('resize', remedir, { passive:true });
  window.addEventListener('orientationchange', remedir, { passive:true });
  /* Esc fecha. Fica aqui, com quem abre, em vez de em escolha.js, que não tem nada a
     ver com a tabela. O voltar do Android fecha pelo caminho de core.js. */
  document.addEventListener('keydown', ev => {
    if(ev.key === 'Escape' && S.heatCheio){ ev.preventDefault(); app.heatCheio(false); }
  });
}

posRender.push(() => {
  /* Liga e desliga o véu da borda conforme ainda haja coluna por ver. */
  const rol = document.querySelector('.heat-rolagem');
  if(rol){
    const cx = rol.parentElement;
    const avaliar = () =>
      cx.classList.toggle('tem-mais', rol.scrollLeft + rol.clientWidth < rol.scrollWidth - 2);
    avaliar();
    rol.addEventListener('scroll', avaliar, { passive:true });
  }

  pintarCelulas(document.getElementById('view'));

  /* Sai de cena junto com a tabela: trocar de guia ou de tela fecha a tela cheia, em
     vez de deixar um painel órfão por cima do resto. */
  if(S.heatCheio && !document.getElementById('heat')) S.heatCheio = false;
  desenharHeatCheio();
});
