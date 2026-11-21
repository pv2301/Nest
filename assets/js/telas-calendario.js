/* Calendário dos registros, no desenho do calendário da Samsung: grade do mês com
   pontos sob o número do dia, faixa para a semana e doze miniaturas para o ano.

   O dia tocado abre a lista daquele dia logo abaixo; o registro tocado abre o
   registro completo — o mesmo app.abrirOc da lista, então ciência, relatório e
   correção continuam todos a um toque.

   Não inventa permissão: quem decide o que aparece é visiveis(), de core.js. Quem
   diz a data de uma ocorrência é quandoDe(), de metricas.js. */

import { S, app, render, visiveis } from './core.js';
import { quandoDe } from './metricas.js';
import { itemHTML } from './telas-comum.js';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const SEMANA = ['D','S','T','Q','Q','S','S'];
const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

/* Chave local, não ISO: toISOString devolve UTC e joga a madrugada para o dia
   anterior. */
const chaveDia = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const daChave = k => { const [a, m, d] = k.split('-').map(Number); return new Date(a, m - 1, d); };

function estado(){
  if(!S.cal){
    const hoje = new Date();
    S.cal = { modo:'mes', ref:chaveDia(hoje), dia:chaveDia(hoje) };
  }
  return S.cal;
}

/** Registros visíveis agrupados por dia. */
function porDia(){
  const mapa = {};
  for(const o of visiveis(S.conta)){
    const d = quandoDe(o);
    if(!d) continue;
    (mapa[chaveDia(d)] = mapa[chaveDia(d)] || []).push(o);
  }
  for(const k in mapa) mapa[k].sort((a, b) => quandoDe(b) - quandoDe(a));
  return mapa;
}

const pontos = ocs => !ocs || !ocs.length ? ''
  : `<span class="cal-pts">${ocs.slice(0, 3).map(o =>
      `<i class="n${o.sev || 1}"></i>`).join('')}</span>`;

function celula(d, mapa, c, foraDoMes){
  const k = chaveDia(d);
  const hoje = chaveDia(new Date());
  const cls = ['cal-d'];
  if(foraDoMes) cls.push('fora');
  if(k === hoje) cls.push('hoje');
  if(k === c.dia) cls.push('sel');
  return `<button class="${cls.join(' ')}" onclick="app.calDia('${k}')"
    aria-label="${d.getDate()} de ${MESES[d.getMonth()]}"${k === c.dia ? ' aria-current="date"' : ''}>
    <span class="n">${d.getDate()}</span>${pontos(mapa[k])}</button>`;
}

/* ---------------------------------------------------------------- modos */
function grade(mapa, c){
  const ref = daChave(c.ref);
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  const celulas = [];
  for(let i = 0; i < 42; i++){
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    celulas.push(celula(d, mapa, c, d.getMonth() !== ref.getMonth()));
    if(i >= 34 && d.getMonth() !== ref.getMonth() && d.getDay() === 6) break;
  }
  return `<div class="cal-sem">${SEMANA.map(s => `<span>${s}</span>`).join('')}</div>
    <div class="cal-grade">${celulas.join('')}</div>`;
}

function faixa(mapa, c){
  const ref = daChave(c.ref);
  const dom = new Date(ref);
  dom.setDate(ref.getDate() - ref.getDay());
  const dias = [];
  for(let i = 0; i < 7; i++){
    const d = new Date(dom);
    d.setDate(dom.getDate() + i);
    dias.push(celula(d, mapa, c, false));
  }
  return `<div class="cal-sem">${SEMANA.map(s => `<span>${s}</span>`).join('')}</div>
    <div class="cal-faixa">${dias.join('')}</div>`;
}

function ano(mapa, c){
  const a = daChave(c.ref).getFullYear();
  return `<div class="cal-ano">${MESES_CURTO.map((m, i) => {
    const dias = new Date(a, i + 1, 0).getDate();
    const inicio = new Date(a, i, 1).getDay();
    let g = '';
    for(let x = 0; x < inicio; x++) g += '<i></i>';
    for(let d = 1; d <= dias; d++){
      const n = (mapa[chaveDia(new Date(a, i, d))] || []).length;
      g += `<i class="${n ? 't' + Math.min(n, 3) : ''}"></i>`;
    }
    return `<button class="cal-mini" onclick="app.calMes(${i})">
      <b>${m}</b><span class="g">${g}</span></button>`;
  }).join('')}</div>`;
}

/* ---------------------------------------------------------------- tela */
export function corpoCalendario(){
  const c = estado();
  const mapa = porDia();
  const ref = daChave(c.ref);
  const doDia = mapa[c.dia] || [];
  const dia = daChave(c.dia);

  const titulo = c.modo === 'ano' ? String(ref.getFullYear())
    : c.modo === 'mes' ? `${MESES[ref.getMonth()]} <span class="cal-ano-n">${ref.getFullYear()}</span>`
    : (() => {
        const dom = new Date(ref); dom.setDate(ref.getDate() - ref.getDay());
        const sab = new Date(dom); sab.setDate(dom.getDate() + 6);
        return `${dom.getDate()} – ${sab.getDate()} ${MESES_CURTO[sab.getMonth()].toLowerCase()}`;
      })();

  return `<div class="cal">
    <div class="cal-topo">
      <h2 class="cal-mes">${titulo}</h2>
      <div class="cal-nav">
        <button onclick="app.calNavegar(-1)" aria-label="Anterior">&lsaquo;</button>
        <button onclick="app.calNavegar(1)" aria-label="Próximo">&rsaquo;</button>
      </div>
    </div>

    <div class="seg" role="radiogroup" aria-label="Modo do calendário">
      ${[['semana','Semana'],['mes','Mês'],['ano','Ano']].map(([m, n]) =>
        `<button type="button" role="radio" aria-checked="${c.modo === m}"
          onclick="app.calModo('${m}')">${n}</button>`).join('')}
    </div>

    ${c.modo === 'mes' ? grade(mapa, c) : c.modo === 'semana' ? faixa(mapa, c) : ano(mapa, c)}

    ${c.modo === 'ano' ? '' : `<div class="cal-lista stack s8">
      <p class="sec-label">${DIAS[dia.getDay()]}, ${dia.getDate()} de ${MESES[dia.getMonth()].toLowerCase()}
        · ${doDia.length} ${doDia.length === 1 ? 'registro' : 'registros'}</p>
      ${doDia.length ? doDia.map(o => itemHTML(o)).join('')
        : `<p class="fs12 muted" style="margin:0">Nenhum registro neste dia.</p>`}
    </div>`}
  </div>`;
}

app.calModo = m => { estado().modo = m; render(); };
app.calDia = k => { const c = estado(); c.dia = k; c.ref = k; render(); };

app.calMes = i => {
  const c = estado();
  const a = daChave(c.ref).getFullYear();
  c.ref = chaveDia(new Date(a, i, 1));
  c.modo = 'mes';
  render();
};

app.calNavegar = passo => {
  const c = estado();
  const d = daChave(c.ref);
  if(c.modo === 'mes') d.setMonth(d.getMonth() + passo);
  else if(c.modo === 'semana') d.setDate(d.getDate() + passo * 7);
  else d.setFullYear(d.getFullYear() + passo);
  c.ref = chaveDia(d);
  render();
};
