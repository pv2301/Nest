/* Visão geral: três formas de olhar os mesmos registros, numa tela só.

   Antes eram duas entradas na Gestão — Painel e Calendário — e os destaques seriam
   uma terceira. É o mesmo conjunto de dados visto de três ângulos, então viram guias.

   O seletor semana/mês/ano continua dentro da guia do calendário; o filtro de
   período, dentro das outras duas. Cada controle governa o seu pedaço. */

import { S, app, registrarTela, render, rodape, posRender, aluno } from './core.js';
import { esc } from './util.js';
import { PERIODOS, catId } from './vocabulario.js';
import { filtraPorPeriodo, agregaPorHoraLocal, contaPor, recorrencia, paresRecorrentes,
         resumo } from './metricas.js';
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
   na memória — ou um atalho antigo — cai na guia certa em vez de numa tela que sumiu. */
registrarTela('painel', () => { S.visaoGuia = 'estatisticas'; return telaVisao(); });
registrarTela('calendario', () => { S.visaoGuia = 'calendario'; return telaVisao(); });

/* ---------------------------------------------------------------- painel */
app.periodo = p => { S.periodo = p; render(); };

function corpoPainel(){
  const ocs = filtraPorPeriodo(S.ocs, S.periodo);
  const r = resumo(ocs);
  const grade = agregaPorHoraLocal(ocs);
  const tipos = contaPor(ocs, o => tipoDe(o), 6);
  const maxTipo = tipos.length ? tipos[0][1] : 1;
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
      <p class="sec-label">Quando e onde acontece</p>
      ${grade.linhas.length ? `
      <!-- Largura fixa por coluna e rolagem horizontal quando não couber. Com 1fr,
           um dia escolar inteiro espremia as células a 20px. -->
      <div class="heat-cx"><div class="heat-rolagem">
        <div class="heat" id="heat"
             style="grid-template-columns:108px repeat(${grade.horas.length},34px)">
          <div class="canto"></div>${grade.horas.map(h => `<div class="hh">${h}h</div>`).join('')}
          ${grade.linhas.map(l => `<div class="rl" title="${esc(l.local)}">${esc(l.local)}</div>` +
            l.celulas.map(n => `<div class="cell" data-n="${n}" data-max="${grade.max}">${n || ''}</div>`).join('')).join('')}
        </div>
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
      <p class="sec-label">Por categoria</p>
      <!-- Cada barra no matiz da sua categoria: assim o painel vira, de graça, a
           chave de leitura dos pontos do calendário. -->
      <div class="bars">${cats.map(([t, n]) => `
        <div class="cat-${catId(t) || 'sem'}"><div class="bar-row"><span class="lab">${esc(t)}</span><span class="bar-n">${n}</span>
          <div class="bar-track"><div class="bar-fill cor-cat" style="width:${Math.round(n/maxCat*100)}%"></div></div></div></div>`).join('')}</div>
    </div>

    <div class="card">
      <p class="sec-label">Tipos mais frequentes</p>
      <div class="bars">${tipos.map(([t, n]) => `
        <div><div class="bar-row"><span class="lab">${esc(t)}</span><span class="bar-n">${n}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/maxTipo*100)}%"></div></div></div></div>`).join('')}</div>
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

  document.querySelectorAll('#heat .cell').forEach(c => {
    const n = +c.dataset.n, max = +c.dataset.max || 1;
    const pct = n === 0 ? 0 : Math.round(24 + (n / max) * 70);
    c.style.background = n === 0 ? 'var(--surface-2)'
      : `color-mix(in srgb, var(--teal) ${pct}%, var(--surface))`;
    c.style.color = pct >= 70 ? 'var(--accent-ink)' : 'var(--fg)';
  });
});
