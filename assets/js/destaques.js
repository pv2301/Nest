/* Destaques: a leitura dos números, não os números.

   O painel já mostra oito métricas. O que faltava era a frase — e a frase só aparece
   com evidência mínima. Com três registros no mês, "tendência" é chute, e um app que
   chuta sobre criança faz a equipe parar de registrar.

   Por isso cada destaque tem um limiar, e sem evidência não aparece nada. Sobre
   criança, diz a contagem e para por aí: quem interpreta é quem conhece a criança. */

import { S, aluno } from './core.js';
import { esc } from './util.js';
import { PERIODOS } from './vocabulario.js';
import { filtraPorPeriodo, agregaPorHoraLocal, contaPor, recorrencia,
         paresRecorrentes, quandoDe } from './metricas.js';

const HORAS_SEM_CIENCIA = 48;
const MIN_CONCENTRACAO = 5;
const FATIA_CONCENTRACAO = 0.4;
const MIN_ANTERIOR = 4;
const MIN_RECORRENCIA = 3;
const MIN_PAR = 3;

const frase = (ic, texto) => `<li class="dest"><span class="ic">${ic}</span><span>${texto}</span></li>`;

/** Janela anterior do mesmo tamanho, para comparar. */
function periodoAnterior(ocs, periodoId){
  const p = PERIODOS.find(x => x.id === periodoId);
  if(!p) return [];
  const agora = new Date();
  const fim = new Date(agora); fim.setDate(fim.getDate() - p.dias);
  const inicio = new Date(fim); inicio.setDate(inicio.getDate() - p.dias);
  return ocs.filter(o => { const d = quandoDe(o); return d && d >= inicio && d < fim; });
}

export function destaques(){
  const ocs = filtraPorPeriodo(S.ocs, S.periodo);
  const itens = [];

  /* 1. Ciência parada — o único que olha o processo, e o mais acionável. */
  const limite = Date.now() - HORAS_SEM_CIENCIA * 3600e3;
  const paradas = S.ocs.filter(o =>
    (o.chain || []).some(c => c.st === 'now') &&
    new Date(o.criadoEm || o.quandoISO || 0).getTime() < limite);
  if(paradas.length)
    itens.push(frase('!', `<b>${paradas.length} ${paradas.length === 1 ? 'registro está' : 'registros estão'}</b>
      há mais de ${HORAS_SEM_CIENCIA}h aguardando ciência.`));

  /* 2. Concentração de lugar e hora. */
  if(ocs.length >= MIN_CONCENTRACAO){
    const grade = agregaPorHoraLocal(ocs);
    let pico = null;
    grade.linhas.forEach(l => l.celulas.forEach((n, i) => {
      if(n && (!pico || n > pico.n)) pico = { n, local:l.local, hora:grade.horas[i] };
    }));
    if(pico && pico.n / ocs.length >= FATIA_CONCENTRACAO)
      itens.push(frase('◆', `<b>${esc(pico.local)}</b> por volta das ${pico.hora}h concentra
        ${pico.n} dos ${ocs.length} registros do período.`));
  }

  /* 3. Variação de um tipo contra a janela anterior. */
  const antes = periodoAnterior(S.ocs, S.periodo);
  if(antes.length >= MIN_ANTERIOR){
    const agoraPor = Object.fromEntries(contaPor(ocs, o => o.tipo || '—', 99));
    for(const [tipo, n0] of contaPor(antes, o => o.tipo || '—', 3)){
      const n1 = agoraPor[tipo] || 0;
      if(n0 < 2) continue;
      const var_ = (n1 - n0) / n0;
      if(Math.abs(var_) >= 0.5){
        itens.push(frase(var_ < 0 ? '↓' : '↑',
          `<b>${esc(tipo)}</b> ${var_ < 0 ? 'caiu' : 'subiu'} de ${n0} para ${n1}
           em relação ao período anterior.`));
        break;
      }
    }
  }

  /* 4 e 5. Repetição: contagem, sem adjetivo. */
  const rec = recorrencia(ocs).filter(x => x.total >= MIN_RECORRENCIA);
  if(rec.length)
    itens.push(frase('◆', `<b>${esc(aluno(rec[0].kid).nome)}</b> aparece em ${rec[0].total}
      registros do período.`));

  const par = paresRecorrentes(ocs).filter(x => x.total >= MIN_PAR);
  if(par.length)
    itens.push(frase('◆', `<b>${esc(aluno(par[0].a).nome)}</b> e
      <b>${esc(aluno(par[0].b).nome)}</b> aparecem juntos em ${par[0].total} registros.`));

  if(!itens.length)
    return `<div class="empty"><div class="big">Nada a destacar</div>
      <p class="fs12" style="margin:0">Com mais registros no período, os padrões aparecem aqui.</p></div>`;

  return `<div class="stack s8">
    <p class="sec-label">O que salta aos olhos</p>
    <ul class="destaques">${itens.join('')}</ul>
  </div>`;
}
