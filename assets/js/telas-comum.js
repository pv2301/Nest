/* O que mais de uma tela do registro usa: os rótulos derivados do registro (tipo,
   local, quando, gravidade, estado), o cartão da lista e o bloco de "nada aqui".

   Fica num arquivo só para que início, formulário, detalhe, calendário e relatório
   desenhem a mesma ocorrência do mesmo jeito. Quando o cartão muda, muda em todos. */

import { S, app, ir, aluno } from './core.js';
import { esc, quandoLegivel } from './util.js';
import { OUTRO, SEVL } from './vocabulario.js';

const sevTag = n => `<span class="sev n${n}">${n} · ${SEVL[n]}</span>`;
const tipoDe = o => o.tipo === OUTRO && o.tipoOutro ? o.tipoOutro : o.tipo;
const localDe = o => o.local === OUTRO && o.localOutro ? o.localOutro : (o.local || 'Não informado');
const quandoTexto = o => o.quandoISO ? quandoLegivel(o.quandoISO) : (o.quando || '—');

function statusPill(o){
  if(o.status === 'concluido')      return '<span class="pill done">&check; Concluído</span>';
  if(o.status === 'acompanhamento') return '<span class="pill follow">Em acompanhamento</span>';
  if(o.status === 'complemento')    return '<span class="pill wait">Requer complemento</span>';
  const n = (o.chain || []).find(c => c.st === 'now');
  return `<span class="pill wait">Aguarda ciência · ${esc(n ? n.nivel.split(' (')[0] : '—')}</span>`;
}

function itemHTML(o){
  const nomes = (o.envolvidos || []).map(e => aluno(e.kid).nome).join(' · ');
  return `<button class="item n${o.sev}" onclick="app.abrirOc('${esc(o.id)}')">
    <span class="stripe"></span>
    <div class="row" style="gap:8px;margin-bottom:5px"><h4 class="grow">${esc(tipoDe(o))}</h4>${sevTag(o.sev)}</div>
    <div class="fs12 muted" style="margin-bottom:7px">${esc(nomes)} · ${esc(localDe(o))} · ${esc(quandoTexto(o))}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${statusPill(o)}
      ${o.duas ? '<span class="pill">2 turmas</span>' : ''}
      ${o.demo ? '<span class="pill demo">demonstração</span>' : ''}</div>
  </button>`;
}

app.abrirOc = id => { S.detalhe = id; ir('detalhe'); };

/* Primeiro acesso da gestão caía numa tela vazia sem rumo. */
function primeirosPassos(u){
  if(u.papel !== 'gestao') return '';
  const passos = [
    { ok: S.turmas.length > 0,  txt:'Cadastre as turmas',           tela:'alunos' },
    { ok: S.alunos.length > 0,  txt:'Cadastre os alunos',           tela:'alunos' },
    { ok: S.contas.filter(c => c.status === 'ativo').length > 1, txt:'Compartilhe o link com a equipe', tela:'usuarios' }
  ];
  if(passos.every(p => p.ok)) return '';
  return `<div class="card flat stack s8">
    <p class="sec-label" style="margin:0">Para começar</p>
    ${passos.map(p => `<button class="row" style="gap:9px;width:100%;text-align:left" onclick="app.ir('${p.tela}')">
      <span class="bx-passo ${p.ok ? 'ok' : ''}">${p.ok ? '&check;' : ''}</span>
      <span class="fs13 grow" style="${p.ok ? 'opacity:.55;text-decoration:line-through' : ''}">${p.txt}</span>
      ${p.ok ? '' : '<span class="fs11 muted">abrir</span>'}
    </button>`).join('')}
  </div>`;
}

const vazio = (titulo, texto) =>
  `<div class="empty"><div class="big">${esc(titulo)}</div><p class="fs12" style="margin:0">${esc(texto)}</p></div>`;

export { sevTag, tipoDe, localDe, quandoTexto, statusPill, itemHTML, vazio, primeirosPassos };
