/* O que mais de uma tela do registro usa: os rótulos derivados do registro (tipo,
   local, quando, gravidade, estado), o cartão da lista e o bloco de "nada aqui".

   Fica num arquivo só para que início, formulário, detalhe, calendário e relatório
   desenhem a mesma ocorrência do mesmo jeito. Quando o cartão muda, muda em todos. */

import { S, app, ir, aluno } from './core.js';
import { esc, quandoLegivel } from './util.js';
import { escolha } from './escolha.js';
import { indiceDePessoas, resolverCitacoes, citacoesPendentes } from './citacoes.mjs';
import { OUTRO, SEVL, catId } from './vocabulario.js';

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
  /* A tarja da esquerda era a gravidade, que o selo ao lado já dizia — por isso
     estava escondida. Agora diz a categoria, que é outra informação, e volta. */
  return `<button class="item cat-${catId(o.categoria) || 'sem'}" onclick="app.abrirOc('${esc(o.id)}')">
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
    { ok: S.turmas.length > 0, txt:'Cadastre as turmas', tela:'alunos' },
    { ok: S.alunos.length > 0, txt:'Cadastre os alunos', tela:'alunos' }
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


/* ================================================================ citações de nome

   Quem o texto de um registro nomeia. Mora aqui porque o formulário e o relatório
   precisam da MESMA resposta: se a Miss confirmou no formulário que "Souza" é o
   Ricardo, o relatório tem de anonimizar o Ricardo, não a Helena. Duas leituras
   diferentes do mesmo texto era o que colocava no comunicado de uma família o nome de
   uma criança de outra. */

/** Idade em anos, para distinguir duas crianças de nome idêntico na tela. */
export function idadeDe(nascimento){
  if(!nascimento) return '';
  const d = new Date(nascimento);
  if(isNaN(d)) return '';
  const hoje = new Date();
  let a = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if(m < 0 || (m === 0 && hoje.getDate() < d.getDate())) a--;
  return a >= 0 && a < 120 ? a + (a === 1 ? ' ano' : ' anos') : '';
}

/** Todo mundo que o cadastro conhece: crianças E adultos, juntos.

    Juntos de propósito. É o que faz "chamei a Miss Ana Paula" não arrastar uma
    criança chamada Ana: a regra do trecho mais longo prefere o nome da Miss, consome
    o trecho, e a criança nunca é considerada. Sem isso precisaria de uma exceção
    escrita à mão para cada caso.

    `extras` leva nomes que não estão no cadastro e aparecem só neste registro — quem
    informou, a autora. */
export function pessoasConhecidas(extras){
  const fora = (S.alunos || [])
    .filter(a => a && a.id && a.nome)
    .map(a => ({ id:a.id, nome:a.nome, crianca:true,
                 turma:a.turma || '', nascimento:a.nascimento || '',
                 ativo: a.ativo !== false }));
  /* Do diretório, e não de S.contas: contas só chega para a gestão, e a regra do
     adulto não pode valer só para ela — é a Miss que escreve a narrativa. O
     diretório chega para todos e traz nome, papel e turma, sem nada de senha. */
  const equipe = (S.diretorio || []).concat(S.contas || []);
  const adultos = equipe.map(c => ({ id:'u:' + (c.login || c.nome), nome:c.nome, crianca:false }));
  for(const nome of (extras || []))
    if(nome && String(nome).trim())
      adultos.push({ id:'x:' + String(nome).toLowerCase(), nome:String(nome), crianca:false });
  return fora.concat(adultos.filter(a => a.nome));
}

/** Os adultos que só existem dentro de um registro: a autora e quem relatou. */
export const adultosDoRegistro = o => [
  (o || {}).autor, (((o || {}).informante) || {}).nome, (o || {}).corrigidoPor
].filter(Boolean);

/** O contexto que o motor usa para decidir de quem é cada citação. */
export function contextoDeCitacoes(o, mencoes){
  const envolvidos = ((o || {}).envolvidos || []).map(e => e.kid).filter(Boolean);
  const turmas = [...new Set(((o || {}).envolvidos || [])
    .map(e => e.turma || (aluno(e.kid) || {}).turma || '').filter(Boolean))];
  const guardadas = {};
  for(const m of (mencoes || o && o.mencoes || []))
    if(m && m.forma) guardadas[m.forma] = m.kid || '';
  return { envolvidos, turmas, guardadas };
}

/* O índice é refeito a cada tecla enquanto a Miss escreve, e com 300 crianças
   cadastradas montar é mais caro que usar: medido, 7ms para montar e 3ms para varrer
   o texto. Guardar o último resolve — o cadastro não muda entre duas teclas. A
   assinatura é grosseira de propósito: se ela errar, erra para o lado de remontar. */
let _cache = { chave:'', idx:null };
function indiceCacheado(pessoas){
  const chave = pessoas.length + ':' + pessoas.map(p => p.id + '|' + p.nome).join(',');
  if(_cache.chave !== chave) _cache = { chave, idx: indiceDePessoas(pessoas) };
  return _cache.idx;
}

/** As citações de um texto, já resolvidas, no contexto de um registro. */
export function citacoesDo(texto, o, mencoes){
  const pessoas = pessoasConhecidas(adultosDoRegistro(o));
  return resolverCitacoes(texto, indiceCacheado(pessoas), contextoDeCitacoes(o, mencoes));
}

/** O que ainda falta a pessoa confirmar, uma pergunta por nome ambíguo. */
export function pendentesDo(texto, o, mencoes){
  const pessoas = pessoasConhecidas(adultosDoRegistro(o));
  return citacoesPendentes(texto, indiceCacheado(pessoas), contextoDeCitacoes(o, mencoes));
}

/** O bloco que pergunta. Vale no formulário e no relatório: o mesmo desenho, o mesmo
    texto, e por isso a mesma resposta.

    `aoResponder(forma, kid)` recebe `''` quando a resposta é "não é uma criança". */
const chaveId = f => String(f).replace(/[^a-z0-9]+/gi, '-');

export function blocoCitacoes(pendentes, aoResponder){
  if(!pendentes || !pendentes.length) return '';
  return `<div class="stack s10">
    ${pendentes.map(p => {
      const ops = p.candidatos.map(c => ({ valor:c.id, nome:c.nome,
        sub:[c.turma ? 'Turma ' + c.turma : '', idadeDe(c.nascimento)].filter(Boolean).join(' · ') }));
      ops.push({ valor:'nao', nome:'Não é uma criança', sub:'Adulto, lugar, outra coisa' });
      return `<div class="notice alert"><span class="ic">?</span><div class="grow">
        <p style="margin:0 0 9px"><b>${esc(p.texto)}</b> pode ser mais de uma criança.
          Quem você quis dizer?</p>
        ${escolha({ id:'cit-' + chaveId(p.forma), opcoes:ops, valor:'', placeholder:'Escolher a criança',
          vazio:'Nenhuma criança com esse nome.',
          aoEscolher:v => aoResponder(p.forma, v === 'nao' ? '' : v) })}
        ${p.candidatos.length > 1 ? `<p class="fs11 muted" style="margin:9px 0 0">
          Se forem crianças diferentes na mesma frase, escreva o nome completo de cada
          uma — aí não há dúvida a resolver.</p>` : ''}
      </div></div>`;
    }).join('')}
  </div>`;
}

export { sevTag, tipoDe, localDe, quandoTexto, statusPill, itemHTML, vazio, primeirosPassos };
