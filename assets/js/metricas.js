/* Agregações do painel. Funções puras de propósito: recebem registros e devolvem
   números, sem tocar em estado nem em DOM — assim dá para testá-las sem navegador.

   Antes o heatmap era uma constante com números inventados. Agora sai dos registros. */

import { PERIODOS } from './vocabulario.js';

/** Início do período, a partir de "agora". 'hoje' é a meia-noite de hoje, não 24h atrás. */
export function inicioDoPeriodo(periodoId, agora = new Date()){
  const d = new Date(agora);
  if(periodoId === 'hoje'){ d.setHours(0, 0, 0, 0); return d; }
  const p = PERIODOS.find(x => x.id === periodoId);
  const dias = p ? p.dias : 30;
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function filtraPorPeriodo(ocs, periodoId, agora = new Date()){
  const corte = inicioDoPeriodo(periodoId, agora);
  return (ocs || []).filter(o => {
    const t = quandoDe(o);
    return t && t >= corte;
  });
}

/** Data da ocorrência. Registros antigos podem não ter quandoISO. */
export function quandoDe(o){
  if(o && o.quandoISO){
    const d = new Date(o.quandoISO);
    if(!isNaN(d)) return d;
  }
  if(o && o.criadoEm){
    const d = new Date(o.criadoEm);
    if(!isNaN(d)) return d;
  }
  return null;
}

export const horaDe = o => { const d = quandoDe(o); return d ? d.getHours() : null; };

/** Faixas de hora presentes nos dados, em ordem — nada de grade fixa de 8h às 15h.
    Preenche só os buracos internos, para o eixo ser contínuo; não acrescenta horas
    além da última observada, que seriam colunas vazias inventadas. */
export function faixasDeHora(ocs){
  const horas = [...new Set((ocs || []).map(horaDe).filter(h => h !== null))].sort((a, b) => a - b);
  if(!horas.length) return [];
  const cheio = [];
  for(let h = horas[0]; h <= horas[horas.length - 1]; h++) cheio.push(h);
  return cheio;
}

/**
 * Grade local × hora com a contagem de registros.
 * @returns {{horas:number[], linhas:{local:string, celulas:number[], total:number}[], max:number, total:number}}
 */
export function agregaPorHoraLocal(ocs, limiteLocais = 6){
  const lista = ocs || [];
  const horas = faixasDeHora(lista);
  if(!horas.length) return { horas: [], linhas: [], max: 0, total: 0 };

  const porLocal = new Map();
  for(const o of lista){
    const h = horaDe(o);
    if(h === null) continue;
    const local = o.local || 'Não informado';
    if(!porLocal.has(local)) porLocal.set(local, new Array(horas.length).fill(0));
    const i = horas.indexOf(h);
    if(i >= 0) porLocal.get(local)[i]++;
  }

  const linhas = [...porLocal.entries()]
    .map(([local, celulas]) => ({ local, celulas, total: celulas.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limiteLocais);

  const max = linhas.reduce((m, l) => Math.max(m, ...l.celulas), 0);
  return { horas, linhas, max, total: lista.length };
}

/* ---------- tamanho da grade na tela cheia ----------

   O cartão usa célula fixa de 34px e rola quando não cabe: com `1fr`, um dia escolar
   inteiro espremia a célula a 20px. Na tela cheia o problema se inverte — sobra
   espaço —, e a célula tem de crescer com a tela.

   Só com CSS não dá, e isto foi medido: `minmax(34px,1fr)` enche mas não tem teto, e
   com 6 horas e 3 locais num monitor a célula ia a 192x212px — um dígito perdido num
   quadrado. `minmax(34px,72px)` tem teto, mas a etapa de maximizar trilhas do grid
   leva TODA trilha ao teto, e aí o telefone passava a rolar nos dois eixos. E um teto
   na caixa não vale, porque o `min-width:100%` de que o `1fr` precisa vence
   `max-width`.

   Então aqui sai um número, da área que a tela mediu. Quadrado, que é como um mapa de
   calor se lê. */

/** Piso de legibilidade, não de toque: a célula não é botão, não tem onclick nem
    papel, e por isso não entra na regra dos 44px. Os 34px vêm de uma medição anterior
    num Pixel 7: com as colunas em `1fr`, um dia das 7h às 18h dava células de 20x20px
    com número de 9,5px, ilegíveis. */
export const CELULA_MIN = 34;
/** Teto: acima disto a célula vira um quadrado vazio em volta de um dígito. */
export const CELULA_MAX = 72;

/** O lado da célula para uma área disponível.

    `largura` e `altura` são a área da rolagem. `colunaNomes` é a coluna dos locais e
    `linhaHoras` a faixa com "8h, 9h…": as duas são descontadas aqui porque não são
    célula. `folga` é o vão entre células — são `horas` vãos na largura (um depois da
    coluna de nomes) e `locais` na altura (um depois da linha das horas).

    Esquecer a linha das horas fazia a grade sair 65px mais alta que a área e rolar na
    vertical sem precisar. Medido.

    Devolve o piso quando não cabe — e aí quem chama rola, que é melhor que encolher
    abaixo do que se lê. */
export function ladoDaCelula({ largura, altura, horas, locais,
                               colunaNomes = 0, linhaHoras = 0, folga = 3,
                               min = CELULA_MIN, max = CELULA_MAX }){
  const h = Math.max(1, Number(horas) || 0);
  const l = Math.max(1, Number(locais) || 0);
  const porLargura = ((Number(largura) || 0) - colunaNomes - h * folga) / h;
  const porAltura  = ((Number(altura)  || 0) - linhaHoras - l * folga) / l;
  const cabe = Math.floor(Math.min(porLargura, porAltura));
  return Math.max(min, Math.min(max, Number.isFinite(cabe) ? cabe : min));
}

/** Altura da faixa com as horas. Não é célula: só cabeçalho. */
export const LINHA_HORAS = 20;

/** A coluna dos nomes de local: cresce com a tela, entre 96 e 140px. */
export const colunaDeNomes = largura =>
  Math.max(96, Math.min(140, Math.round((Number(largura) || 0) * 0.18)));

/** Contagem por chave, já ordenada do maior para o menor. */
export function contaPor(ocs, chave, limite = 8){
  const mapa = new Map();
  for(const o of ocs || []){
    const v = typeof chave === 'function' ? chave(o) : o[chave];
    if(v === undefined || v === null || v === '') continue;
    mapa.set(v, (mapa.get(v) || 0) + 1);
  }
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite);
}

/** Crianças com mais de um registro no período, com o papel predominante. */
export function recorrencia(ocs, minimo = 2){
  const mapa = new Map();
  for(const o of ocs || []){
    for(const e of o.envolvidos || []){
      if(!mapa.has(e.kid)) mapa.set(e.kid, { kid: e.kid, total: 0, papeis: {} });
      const r = mapa.get(e.kid);
      r.total++;
      r.papeis[e.papel] = (r.papeis[e.papel] || 0) + 1;
    }
  }
  return [...mapa.values()]
    .filter(r => r.total >= minimo)
    .sort((a, b) => b.total - a.total)
    .map(r => ({
      ...r,
      principal: Object.entries(r.papeis).sort((a, b) => b[1] - a[1])[0] || ['—', 0]
    }));
}

/** Pares de crianças que aparecem juntas em mais de um registro. */
export function paresRecorrentes(ocs, minimo = 2){
  const mapa = new Map();
  for(const o of ocs || []){
    const ids = (o.envolvidos || []).map(e => e.kid).sort();
    for(let i = 0; i < ids.length; i++){
      for(let j = i + 1; j < ids.length; j++){
        const k = ids[i] + '|' + ids[j];
        mapa.set(k, (mapa.get(k) || 0) + 1);
      }
    }
  }
  return [...mapa.entries()]
    .filter(([, n]) => n >= minimo)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({ a: k.split('|')[0], b: k.split('|')[1], total: n }));
}

/** Números de topo do painel. */
export function resumo(ocs){
  const lista = ocs || [];
  return {
    total: lista.length,
    graves: lista.filter(o => o.sev >= 3).length,
    acompanhamento: lista.filter(o => o.status === 'acompanhamento').length,
    aguardando: lista.filter(o => (o.chain || []).some(c => c.st === 'now')).length
  };
}
