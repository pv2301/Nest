/* Telas do registro: início, novo, wizard, listas, fila de ciência, detalhe e painel. */

import { S, app, registrarTela, ir, toast, render, recarregar, rodape, otimista,
         filaDe, meusRegistros, visiveis, posRender, temFuncao, aluno, nomesTurmas,
         avancarPasso, voltar, rascunhoGuardado } from './core.js';
import { Store } from './store.js';
import { campoLista } from './campo-lista.js';
import { esc, semAcento, quandoLegivel, agoraHora, iniciais, ICON, svgIc } from './util.js';
import { CONFIG } from '../../config.js';
import { CATS, OUTRO, EXEMPLOS, LOCAIS, PROVIDENCIAS, CONDICOES, REGIOES,
         PAPEIS_ENVOLVIDO, CANAIS_INFORME, SEVL, JULGAMENTO, PERIODOS } from './dados.js';
import { filtraPorPeriodo, agregaPorHoraLocal, contaPor, recorrencia, paresRecorrentes,
         resumo, quandoDe } from './metricas.js';

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

/* ---------------------------------------------------------------- início */
registrarTela('home', () => {
  const u = S.conta, fila = filaDe(u), meus = meusRegistros(u).slice(0, 3);
  let out = '<div class="stack s18">';
  if(u.trocarSenha) out += `<div class="notice info"><span class="ic">◆</span><div>Sua senha é temporária. <b onclick="app.ir('trocarSenha')" style="text-decoration:underline;cursor:pointer">Defina uma nova</b>.</div></div>`;

  out += primeirosPassos(u);

  /* Rascunho interrompido: o preenchimento é salvo sozinho, então dá para retomar. */
  const r = rascunhoGuardado();
  if(r) out += `<button class="rascunho" onclick="app.retomarRascunho()">
    <span class="grow"><b>Continuar registro</b>
      <span class="fs11">${esc(r.rascunho.tipo || r.rascunho.categoria || 'sem tipo ainda')} · começado ${esc(quandoLegivel(r.em))}</span></span>
    <span class="chip sm" onclick="event.stopPropagation();app.descartarRascunho()">Descartar</span>
  </button>`;

  out += `<button class="btn" style="padding:16px" onclick="app.ir('novo')">+ &nbsp;Registrar ocorrência</button>`;
  if(fila.length) out += `<div><p class="sec-label">Aguardando sua ciência</p>
      <div class="stack s8">${fila.map(o => itemHTML(o)).join('')}</div></div>`;
  out += `<div><p class="sec-label">${u.papel === 'gestao' ? 'Últimos registros' : 'Meus registros'}</p>
    <div class="stack s8">${meus.length ? meus.map(o => itemHTML(o)).join('')
      : vazio('Nenhum registro ainda', 'O que você registrar aparece aqui, com o estado da ciência.')}</div>
    ${meus.length ? `<button class="btn ghost sm" style="width:100%;margin-top:9px" onclick="app.ir('lista')">Ver todos</button>` : ''}
  </div>`;
  return out + rodape() + '</div>';
});

/* ---------------------------------------------------------------- escolha do modo */
registrarTela('novo', () => `<div class="stack">
  <button class="item" style="padding:16px" onclick="app.iniciar('rapido')">
    <div class="row" style="margin-bottom:5px"><h4 class="grow" style="font-size:15px">Registro rápido</h4><span class="pill">~40s</span></div>
    <p class="fs12 muted" style="margin:0">Categoria, criança, gravidade e uma linha.</p>
  </button>
  <button class="item" style="padding:16px" onclick="app.iniciar('completo')">
    <div class="row" style="margin-bottom:5px"><h4 class="grow" style="font-size:15px">Registro completo</h4><span class="pill">5 passos</span></div>
    <p class="fs12 muted" style="margin:0">Envolvidos, horário, local, providências e foto.</p>
  </button>
</div>`);

app.iniciar = modo => {
  /* Sem isto, começar um registro logo depois de uma correção sobrescreveria o
     registro corrigido: o envio ainda acharia que está editando. */
  S.editando = null;
  S.modoRegistro = modo; S.passo = 1; S.buscaAluno = ''; S.filtroTurma = '';
  S.rascunho = { categoria:'', tipo:'', tipoOutro:'', envolvidos:[],
                 quandoOpcao:'Agora', quandoISO:new Date().toISOString(),
                 local:'', localOutro:'', sev:0, presenciou:true,
                 informanteNome:'', informanteCanal:'', desc:'', prov:[], foto:false,
                 cond:{}, lesao:{} };
  ir(modo === 'rapido' ? 'rapido' : 'wizard');
};

/* ---------------------------------------------------------------- o que falta */
function faltas(d){
  const f = [];
  if(!d.categoria) f.push({ passo:1, texto:'Escolher a categoria' });
  else if(!d.tipo) f.push({ passo:1, texto:'Escolher o tipo' });
  if(d.tipo === OUTRO && !String(d.tipoOutro).trim()) f.push({ passo:1, texto:'Descrever o tipo em "Outro"' });
  if(!d.sev) f.push({ passo:1, texto:'Escolher a gravidade' });
  if(!d.envolvidos.length) f.push({ passo:2, texto:'Selecionar ao menos uma criança' });
  else if(d.envolvidos.some(e => !e.papel)) f.push({ passo:2, texto:'Marcar o papel de cada criança' });
  if(String(d.desc).trim().length <= 8) f.push({ passo:3, texto:'Escrever a descrição do ocorrido' });
  if(!d.presenciou && !String(d.informanteNome).trim()) f.push({ passo:3, texto:'Informar quem relatou' });
  return f;
}

/* O botão nunca fica desabilitado sem explicação: ao tocar, mostra o que falta e
   cada item leva ao passo certo. Antes ele só ficava cinza, sem dizer por quê. */
app.tentarEnviar = () => {
  const f = faltas(S.rascunho);
  if(!f.length) return app.enviar();
  S.faltas = f;
  render();
  const el = document.getElementById('faltas');
  if(el) el.scrollIntoView({ block:'center', behavior:'smooth' });
};

function blocoFaltas(){
  if(!S.faltas || !S.faltas.length) return '';
  const temPassos = S.modoRegistro === 'completo';
  return `<div class="notice alert" id="faltas"><span class="ic">!</span><div>
    <b>Falta preencher ${S.faltas.length === 1 ? 'um item' : S.faltas.length + ' itens'}:</b>
    <ul style="margin:6px 0 0;padding-left:18px">
      ${S.faltas.map(x => `<li style="margin-bottom:3px">${temPassos
        ? `<a href="#" onclick="app.irPasso(${x.passo});return false" style="color:inherit">${esc(x.texto)} <span style="opacity:.7">(passo ${x.passo})</span></a>`
        : esc(x.texto)}</li>`).join('')}
    </ul></div></div>`;
}

app.irPasso = p => { S.passo = p; S.faltas = null; render(); };

/* ---------------------------------------------------------------- seleção de crianças */
/* Sem filtro de texto: quem busca é o próprio campo com lista. Aqui fica só o filtro
   de turma, que é escolha de quem está olhando a tela. */
function listaAlunos(){
  return S.alunos
    .filter(a => a.ativo !== false)
    .filter(a => !S.filtroTurma || a.turma === S.filtroTurma)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function seletorAlunos(){
  const d = S.rascunho, turmas = nomesTurmas();
  /* O filtro de turma fica fora do campo: ele filtra o que está à vista, não registra
     um valor, e aqui um toque vale mais que dois. */
  return `<div class="stack s8">
    ${turmas.length ? `<div class="chips">
      <button class="chip sm" aria-pressed="${!S.filtroTurma}" onclick="app.filtrarTurma('')">Todas</button>
      ${turmas.map(t => `<button class="chip sm" aria-pressed="${S.filtroTurma === t}" onclick="app.filtrarTurma('${esc(t)}')">${esc(t)}</button>`).join('')}
    </div>` : ''}
    ${campoLista({
      id:'kids',
      opcoes: listaAlunos().map(a => ({ valor:a.id, nome:a.nome,
        sub: a.turma ? 'Turma ' + a.turma : '', ini: iniciais(a.nome) })),
      valor: d.envolvidos.map(e => e.kid),
      multipla:true, busca:true,
      placeholder: S.alunos.length ? 'Escolher as crianças' : 'Nenhum aluno cadastrado ainda',
      vazio:'Nenhum aluno encontrado.',
      rodape:`<button class="cl-rodape" onclick="app.abrirAvulso()">+ Não está na lista</button>`,
      aoEscolher: id => app.togKid(id, true)
    })}
  </div>`;
}

app.filtrarTurma = t => { S.filtroTurma = S.filtroTurma === t ? '' : t; render(); };

app.togKid = (id, semDesenhar) => {
  const d = S.rascunho, i = d.envolvidos.findIndex(e => e.kid === id);
  if(i >= 0) d.envolvidos.splice(i, 1);
  else d.envolvidos.push({ kid:id, papel:'', turma: aluno(id).turma || '' });
  if(!semDesenhar) render();
};

/* Criança ainda não cadastrada: cria na hora, marcada para a gestão confirmar.
   Sem isso, um cadastro faltando trava o registro no momento em que ele mais importa. */
app.abrirAvulso = () => { S.avulso = { nome:'', turma: S.conta.turma || '' }; render(); };
app.fecharAvulso = () => { S.avulso = null; render(); };
app.salvarAvulso = async () => {
  const nome = (document.getElementById('av-nome') || {}).value || '';
  if(nome.trim().split(/\s+/).filter(Boolean).length < 1) return toast('Informe o nome da criança.');
  const novo = { id:'a' + Date.now().toString(36), nome:nome.trim(),
                 turma:S.avulso.turma || '', ativo:true, avulso:true, criadoEm:new Date().toISOString() };
  try {
    await Store.salvarAluno(novo);
    S.alunos = await Store.alunos();
    S.rascunho.envolvidos.push({ kid:novo.id, papel:'' });
    S.avulso = null;
    toast('Criança adicionada. A gestão confirma o cadastro depois.');
  } catch(e){ toast(e.message); }
};

function dialogoAvulso(){
  if(!S.avulso) return '';
  const turmas = nomesTurmas();
  return `<div class="card lift stack s8" style="border-color:var(--accent-text)">
    <p class="sec-label" style="margin:0">Criança fora da lista</p>
    <div class="field"><label for="av-nome">Nome da criança</label>
      <input class="input" id="av-nome" autofocus></div>
    ${turmas.length ? campoLista({ id:'turma-avulso', rotulo:'Turma', opcoes:turmas,
      valor:S.avulso.turma || '', placeholder:'Escolher a turma',
      aoEscolher:v => app.avulsoTurma(v) }) : ''}
    <div class="row" style="gap:8px">
      <button class="btn sm" style="flex:1" onclick="app.salvarAvulso()">Adicionar</button>
      <button class="btn ghost sm" style="flex:1" onclick="app.fecharAvulso()">Cancelar</button>
    </div>
  </div>`;
}
app.avulsoTurma = t => {
  const nome = (document.getElementById('av-nome') || {}).value || '';
  S.avulso.turma = S.avulso.turma === t ? '' : t;
  S.avulso.nome = nome;
  render();
  const el = document.getElementById('av-nome');
  if(el) el.value = S.avulso.nome || '';
};

function sinalRecentes(){
  const d = S.rascunho;
  const comRegistro = d.envolvidos
    .map(e => ({ a: aluno(e.kid), n: S.ocs.filter(o => (o.envolvidos || []).some(x => x.kid === e.kid)).length }))
    .filter(x => x.n > 0);
  if(!comRegistro.length) return '';
  if(S.conta.papel === 'gestao')
    return `<div class="notice info"><span class="ic">◆</span><div>${comRegistro.map(x => `<b>${esc(x.a.nome)}</b>: ${x.n} registro(s)`).join(' · ')}</div></div>`;
  /* Para quem não é gestão: só a existência, nunca a quantidade nem o conteúdo. */
  return `<div class="notice info"><span class="ic">◆</span><div>${comRegistro.map(x => '<b>' + esc(x.a.nome) + '</b>').join(' e ')} ${comRegistro.length > 1 ? 'têm' : 'tem'} registros recentes. Converse com a coordenação.</div></div>`;
}

/* Cada criança carrega a sua turma no próprio registro: uma ocorrência pode envolver
   crianças de turmas distintas, e é a turma de cada uma que decide para qual Miss vai
   a ciência. Vem preenchida do cadastro, e dá para corrigir aqui. */
function cardEnvolvido(e, i){
  const d = S.rascunho, a = aluno(e.kid), turmas = nomesTurmas();
  const cond = d.cond[e.kid] || '';
  /* A região do corpo só faz sentido quando houve lesão. Perguntar sempre enchia a
     tela com doze botões inúteis para quem só voltou às atividades. */
  const temLesao = cond === 'Marca/lesão visível' || cond === 'Relatou dor/desconforto';
  return `<div class="card flat stack s8">
    <div class="row">
      <span class="avatar sm">${esc(iniciais(a.nome))}</span>
      <b class="fs13 grow">${esc(a.nome)}</b>
      ${e.turma ? `<span class="pill">${esc(e.turma)}</span>` : '<span class="pill off">sem turma</span>'}
      <button class="chip sm" style="min-height:28px;padding:4px 9px" onclick="app.togKid('${esc(e.kid)}')" aria-label="Remover">&times;</button>
    </div>

    ${campoLista({ id:'papel-' + i, rotulo:'Papel nesta ocorrência', opcoes:PAPEIS_ENVOLVIDO,
      valor:e.papel, placeholder:'Escolher o papel',
      aoEscolher:v => { e.papel = v; S.faltas = null; } })}

    ${turmas.length ? campoLista({ id:'turma-' + i, rotulo:'Turma', opcoes:turmas,
      valor:e.turma, placeholder:'Escolher a turma',
      aoEscolher:v => { e.turma = e.turma === v ? '' : v; } }) : ''}

    ${campoLista({ id:'cond-' + i, rotulo:'Como ficou', opcoes:CONDICOES, valor:cond,
      busca:true, placeholder:'Escolher',
      aoEscolher:v => { d.cond[e.kid] = d.cond[e.kid] === v ? '' : v; } })}

    ${temLesao ? campoLista({ id:'lesao-' + i, rotulo:'Onde é a marca ou lesão',
      opcoes:REGIOES.filter(r => r !== 'Não se aplica'), valor:d.lesao[e.kid],
      placeholder:'Escolher a região',
      aoEscolher:v => { d.lesao[e.kid] = d.lesao[e.kid] === v ? '' : v; } }) : ''}
  </div>`;
}

app.turmaEnvolvido = (i, t) => {
  S.rascunho.envolvidos[i].turma = S.rascunho.envolvidos[i].turma === t ? '' : t;
  render();
};

const sevPicker = () => `<div class="sevpick">${[1,2,3,4].map(n => `
  <button data-n="${n}" aria-pressed="${S.rascunho.sev === n}" onclick="app.campo('sev',${n})">
    <b>${n}</b><small>${SEVL[n]}</small></button>`).join('')}</div>`;

app.campo = (k, v) => { S.rascunho[k] = v; S.faltas = null; render(); };
app.campoTxt = (k, v) => { S.rascunho[k] = v; };
app.togArr = (k, v) => {
  const a = S.rascunho[k], i = a.indexOf(v);
  i >= 0 ? a.splice(i, 1) : a.push(v);
  render();
};
app.campoObj = (k, id, v) => { S.rascunho[k][id] = S.rascunho[k][id] === v ? '' : v; render(); };
app.papelEnvolvido = (i, p) => { S.rascunho.envolvidos[i].papel = p; S.faltas = null; render(); };
app.escolherCat = c => { const d = S.rascunho; d.categoria = c; d.tipo = ''; d.tipoOutro = ''; S.faltas = null; render(); };

/* ---------------------------------------------------------------- quando e onde */
function blocoQuando(){
  const d = S.rascunho;
  const opcoes = [['Agora',0],['Há 15 min',15],['Há 30 min',30],['Há 1h',60]];
  const minutos = Object.fromEntries(opcoes);
  return `<div>
    ${campoLista({ id:'quando', rotulo:'Quando aconteceu',
      opcoes:[...opcoes.map(([rot]) => rot), { valor:'manual', nome:'Outro horário' }],
      valor:d.quandoOpcao, placeholder:'Escolher',
      aoEscolher:v => v === 'manual' ? app.quandoManual() : app.quandoRelativo(v, minutos[v]) })}
    ${d.quandoOpcao === 'manual' ? `<div class="field" style="margin-top:9px">
      <label for="w-quando">Data e hora</label>
      <input class="input" type="datetime-local" id="w-quando" value="${esc(paraInputLocal(d.quandoISO))}"
             oninput="app.quandoDigitado(this.value)"></div>` : ''}
    <p class="hint">Registrado por ${esc(S.conta.curto)}${S.conta.turma ? ' · Turma ' + esc(S.conta.turma) : ''} · ocorrência em ${esc(quandoLegivel(d.quandoISO))}</p>
  </div>`;
}

function paraInputLocal(iso){
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

app.quandoRelativo = (rotulo, minutos) => {
  const d = new Date(); d.setMinutes(d.getMinutes() - minutos);
  S.rascunho.quandoOpcao = rotulo;
  S.rascunho.quandoISO = d.toISOString();
  render();
};
app.quandoManual = () => { S.rascunho.quandoOpcao = 'manual'; render(); };
app.quandoDigitado = v => {
  const d = new Date(v);
  if(!isNaN(d)){
    S.rascunho.quandoISO = d.toISOString();
    const h = document.querySelector('#w-quando');
    const dica = h && h.closest('div').parentElement.querySelector('.hint');
    if(dica) dica.textContent = `Registrado por ${S.conta.curto} · ocorrência em ${quandoLegivel(S.rascunho.quandoISO)}`;
  }
};

function blocoOnde(){
  const d = S.rascunho;
  return `<div>
    ${campoLista({ id:'local', rotulo:'Onde aconteceu',
      opcoes:[...LOCAIS, { valor:OUTRO, nome:'Outro local' }],
      valor:d.local, placeholder:'Escolher o local',
      aoEscolher:v => { d.local = v; S.faltas = null; } })}
    ${d.local === OUTRO ? `<div class="field" style="margin-top:9px">
      <label for="w-local">Qual local</label>
      <input class="input" id="w-local" value="${esc(d.localOutro)}" placeholder="Escreva o local"
             oninput="app.campoTxt('localOutro',this.value)"></div>` : ''}
  </div>`;
}

/* ---------------------------------------------------------------- descrição */
function checagemLinguagem(txt){
  const achados = JULGAMENTO.filter(w =>
    new RegExp('(^|[^a-zà-ú])' + w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '([^a-zà-ú]|$)', 'i').test(txt));
  if(!achados.length) return '';
  return `<div class="notice info"><span class="ic">◆</span><div>Palavras de interpretação: <b>${achados.map(esc).join('</b>, <b>')}</b>. Descreva o que a criança fez ou disse.</div></div>`;
}

app.checarTexto = (campo, destino, v) => {
  S.rascunho[campo] = v;
  const el = document.getElementById(destino);
  if(el) el.innerHTML = checagemLinguagem(v);
};

app.usarExemplo = () => {
  const d = S.rascunho;
  const ex = EXEMPLOS[d.categoria] || EXEMPLOS['Incidente'];
  d.desc = ex;
  render();
  const el = document.getElementById('w-desc') || document.getElementById('r-desc');
  if(el){ el.focus(); el.setSelectionRange(0, 0); }
};

function campoDescricao(id){
  const d = S.rascunho;
  const ex = EXEMPLOS[d.categoria] || EXEMPLOS['Incidente'];
  return `<div class="narrativa">
    <div class="row" style="margin-bottom:7px">
      <label for="${id}" class="grow" style="margin:0">Descrição do ocorrido</label>
      <button class="btn ghost sm" style="padding:5px 10px;min-height:0;font-size:11.5px" onclick="app.usarExemplo()">Usar exemplo</button>
    </div>
    <textarea class="input" id="${id}" placeholder="${esc(ex)}"
      oninput="app.checarTexto('desc','${id}-chk',this.value)">${esc(d.desc)}</textarea>
    <div id="${id}-chk" style="margin-top:8px">${checagemLinguagem(d.desc)}</div>
    <p class="hint">Descreva o que foi observado, antes e depois.</p>
  </div>`;
}

function blocoPresenciou(){
  const d = S.rascunho;
  return `<div>
    ${campoLista({ id:'presenciou', rotulo:'Você presenciou?',
      opcoes:[{ valor:'sim', nome:'Presenciei' }, { valor:'nao', nome:'Fui informada' }],
      valor:d.presenciou ? 'sim' : 'nao', busca:false,
      aoEscolher:v => { d.presenciou = v === 'sim'; S.faltas = null; } })}
    ${!d.presenciou ? `
      <div class="field" style="margin-top:10px"><label for="w-inf">Quem informou</label>
        <input class="input" id="w-inf" value="${esc(d.informanteNome)}" placeholder="Nome de quem relatou"
               oninput="app.campoTxt('informanteNome',this.value)"></div>
      <div style="margin-top:9px">${campoLista({ id:'canal', rotulo:'Por qual canal',
        opcoes:CANAIS_INFORME, valor:d.informanteCanal, placeholder:'Escolher',
        aoEscolher:v => { d.informanteCanal = v; } })}</div>` : ''}
  </div>`;
}

/* ---------------------------------------------------------------- registro rápido */
registrarTela('rapido', () => {
  const d = S.rascunho;
  return `<div class="stack s18">
    ${blocoFaltas()}
    ${campoLista({ id:'cat-r', rotulo:'1 · Categoria', opcoes:Object.keys(CATS),
      valor:d.categoria, placeholder:'Escolher categoria',
      aoEscolher:c => { d.categoria = c; d.tipo = ''; d.tipoOutro = ''; S.faltas = null; } })}
    ${d.categoria ? `${campoLista({ id:'tipo-r', rotulo:'Tipo',
        opcoes:CATS[d.categoria].concat([OUTRO]), valor:d.tipo, placeholder:'Escolher tipo',
        aoEscolher:v => { d.tipo = v; S.faltas = null; } })}
      ${d.tipo === OUTRO ? `<div class="field" style="margin-top:9px"><input class="input" placeholder="Qual?" value="${esc(d.tipoOutro)}" oninput="app.campoTxt('tipoOutro',this.value)"></div>` : ''}` : ''}
    <div><p class="sec-label">2 · Quem</p>${seletorAlunos()}</div>
    ${dialogoAvulso()}
    ${sinalRecentes()}
    ${d.envolvidos.length ? `<div><p class="sec-label">Papel de cada criança</p><div class="stack s8">
      ${d.envolvidos.map((e, i) => cardEnvolvido(e, i)).join('')}</div></div>` : ''}
    <div><p class="sec-label">3 · Gravidade</p>${sevPicker()}</div>
    ${campoDescricao('r-desc')}
    <button class="btn" onclick="app.tentarEnviar()">${S.editando ? 'Salvar correção' : 'Enviar registro'}</button>
  </div>`;
});

/* ---------------------------------------------------------------- wizard */
registrarTela('wizard', () => {
  const d = S.rascunho, st = S.passo;
  let corpo = '';

  /* 1 — classificar o que aconteceu. Gravidade entra aqui, ao lado de categoria e
     tipo, porque é a mesma pergunta: que tipo de coisa foi, e quão séria. */
  if(st === 1) corpo = `<div class="stack s18">
    ${campoLista({ id:'cat', rotulo:'1 · Categoria do registro', opcoes:Object.keys(CATS),
      valor:d.categoria, placeholder:'Escolher categoria',
      aoEscolher:c => { d.categoria = c; d.tipo = ''; d.tipoOutro = ''; S.faltas = null; } })}
    ${d.categoria ? `${campoLista({ id:'tipo', rotulo:'Tipo',
        opcoes:CATS[d.categoria].concat([OUTRO]), valor:d.tipo, placeholder:'Escolher tipo',
        aoEscolher:v => { d.tipo = v; S.faltas = null; } })}
      ${d.tipo === OUTRO ? `<div class="field" style="margin-top:9px"><label for="w-tipo">Qual?</label>
        <input class="input" id="w-tipo" value="${esc(d.tipoOutro)}" oninput="app.campoTxt('tipoOutro',this.value)"></div>` : ''}`
      : `<p class="fs12 muted" style="margin:0">Escolha a categoria para ver os tipos.</p>`}
    ${d.tipo ? `<div><p class="sec-label">Gravidade</p>${sevPicker()}
      </div>` : ''}
  </div>`;

  /* 2 — quem: um cartão por criança, com papel, turma, como ficou e lesão.
     Antes cada criança aparecia duas vezes, em passos distantes. */
  if(st === 2) corpo = `<div class="stack s18">
    <div><p class="sec-label">2 · Quem esteve envolvido</p>${seletorAlunos()}</div>
    ${dialogoAvulso()}
    ${sinalRecentes()}
    ${d.envolvidos.length ? `<div class="stack s8">
      ${d.envolvidos.map((e, i) => cardEnvolvido(e, i)).join('')}</div>
      ` : ''}
  </div>`;

  /* 3 — contexto: quando, onde, de onde veio a informação e o relato. */
  if(st === 3) corpo = `<div class="stack s18">
    <p class="sec-label">3 · Contexto</p>
    ${blocoQuando()}
    ${blocoOnde()}
    ${blocoPresenciou()}
    ${campoDescricao('w-desc')}
    <div><p class="sec-label">Foto da lesão (opcional)</p>
      ${d.fotoPreview
        ? `<div class="fotobox"><img src="${esc(d.fotoPreview)}" alt="Foto anexada">
             <button class="btn ghost sm" style="width:100%;margin-top:8px" onclick="app.tirarFoto(true)">Remover foto</button></div>`
        : `<label class="photo" for="w-foto" style="cursor:pointer">Tirar foto · só a região da lesão, sem rosto e sem outras crianças</label>
           <input type="file" id="w-foto" accept="image/*" capture="environment" hidden onchange="app.escolherFoto(this)">`}
      </div>
  </div>`;

  /* 4 — providências e revisão. */
  if(st === 4){
    const dest = destinoCiencia();
    corpo = `<div class="stack s18">
      ${campoLista({ id:'prov', rotulo:'4 · O que foi feito', opcoes:PROVIDENCIAS,
        valor:d.prov, multipla:true, placeholder:'Escolher as providências',
        aoEscolher:v => { const i = d.prov.indexOf(v); i >= 0 ? d.prov.splice(i, 1) : d.prov.push(v); } })}

      ${d.tipo === 'Mordida' ? `<div class="card flat"><p class="sec-label">Cuidados para mordida</p>
        <div class="stack s6 fs12">
          ${['Lavar com água e sabão','Compressa fria por 5 minutos','Observar inchaço e rompimento da pele','Se houver rompimento, comunicar a coordenação']
            .map((t, i) => `<div class="row" style="gap:7px"><span>${i+1}.</span><div class="grow">${t}</div></div>`).join('')}
        </div></div>` : ''}

      ${blocoFaltas()}

      <div class="card"><p class="sec-label">Revisão</p><dl class="kv">
        <dt>Categoria</dt><dd>${esc(d.categoria || '—')}${d.tipo ? ' · ' + esc(d.tipo === OUTRO ? d.tipoOutro || 'Outro' : d.tipo) : ''}</dd>
        <dt>Gravidade</dt><dd>${d.sev ? sevTag(d.sev) : '—'}</dd>
        <dt>Envolvidos</dt><dd>${d.envolvidos.map(e => esc(aluno(e.kid).nome)
          + (e.papel ? ` <span class="muted">(${esc(e.papel)})</span>` : ' <span class="muted">(sem papel)</span>')
          + (d.cond[e.kid] ? `<br><span class="fs11 muted">${esc(d.cond[e.kid])}${d.lesao[e.kid] ? ' · ' + esc(d.lesao[e.kid]) : ''}</span>` : '')
        ).join('<br>') || '—'}</dd>
        <dt>Quando</dt><dd>${esc(quandoLegivel(d.quandoISO))}</dd>
        <dt>Onde</dt><dd>${esc(d.local === OUTRO ? (d.localOutro || 'Outro') : (d.local || '—'))}</dd>
        <dt>Origem</dt><dd>${d.presenciou ? 'Presenciou' : 'Informada por ' + esc(d.informanteNome || '—') + (d.informanteCanal ? ' · ' + esc(d.informanteCanal) : '')}</dd>
        <dt>Providências</dt><dd>${d.prov.map(esc).join(', ') || '—'}</dd>
        <dt>Foto</dt><dd>${d.foto ? '1 anexada' : 'nenhuma'}</dd>
      </dl></div>

      <div class="card flat"><p class="sec-label">Para quem vai a ciência</p>
        <div class="chain">${dest.map((n, i) => `<div class="node">
          <div class="gut"><div class="dot">${i+1}</div>${i < dest.length-1 ? '<div class="line"></div>' : ''}</div>
          <div class="body"><b class="fs13">${esc(n.q)}</b><div class="fs11 muted">${esc(n.p)}</div></div></div>`).join('')}</div></div>

      <button class="btn" id="btn-enviar" onclick="app.tentarEnviar()">${S.editando ? 'Salvar correção' : 'Enviar registro'}</button>
    </div>`;
  }

  const nav = st < 4 ? `<div class="row" style="gap:9px;margin-top:20px">
      ${st > 1 ? '<button class="btn ghost" onclick="app.passo(-1)">Voltar</button>' : ''}
      <button class="btn" onclick="app.passo(1)">Continuar</button></div>` : '';
  return corpo + nav;
});

app.passo = delta => { delta > 0 ? avancarPasso() : voltar(); };

/* A imagem fica em memória até o envio do registro: só então existe um id de
   ocorrência a que prendê-la. */
app.escolherFoto = input => {
  const arq = input.files && input.files[0];
  if(!arq) return;
  if(arq.size > 6 * 1024 * 1024) return toast('Imagem acima de 6 MB. Tente outra.');
  S.rascunho.fotoArquivo = arq;
  S.rascunho.foto = true;
  try { S.rascunho.fotoPreview = URL.createObjectURL(arq); } catch { S.rascunho.fotoPreview = ''; }
  render();
};

app.tirarFoto = () => {
  const d = S.rascunho;
  if(d.fotoPreview){ try { URL.revokeObjectURL(d.fotoPreview); } catch {} }
  d.fotoArquivo = null; d.fotoPreview = ''; d.foto = false;
  render();
};

/* ---------------------------------------------------------------- roteamento da ciência */
/* Preferência: a Miss que a gestão designou para a turma. Sem designação, a primeira
   Miss cujo cadastro aponta para essa turma. */
function missDaTurma(turma){
  const t = (S.turmas || []).find(x => x.nome === turma);
  if(t && t.missResponsavel){
    const m = (S.diretorio || []).find(d => d.login === t.missResponsavel);
    if(m) return m;
  }
  return (S.diretorio || []).find(d => d.papel === 'miss' && d.turma === turma && d.status === 'ativo');
}

function destinoCiencia(){
  const u = S.conta, d = S.rascunho, out = [];
  const turmas = [...new Set(d.envolvidos.map(e => e.turma || aluno(e.kid).turma).filter(Boolean))];

  if(u.papel === 'gestao'){
    out.push({ q:'Encerrado por você', p:'A gestão registra e conclui no mesmo ato' });
    return out;
  }
  /* Ciência paralela: uma Miss por turma envolvida, exceto a própria autora. */
  turmas.forEach(t => {
    if(u.papel === 'miss' && u.turma === t) return;
    const m = missDaTurma(t);
    out.push(m
      ? { q: `${m.nome} (Turma ${t})`, p:'Confirma a gravidade e acrescenta o contexto' }
      : { q: `Gestão (Turma ${t} sem Miss ativa)`, p:'Nenhuma Miss cadastrada para esta turma' });
  });

  const recentes = d.envolvidos.some(e => S.ocs.some(o => (o.envolvidos || []).some(x => x.kid === e.kid)));
  const gatilho = d.sev > 1 || d.foto || recentes;
  if(gatilho || !CONFIG.REGRAS.nivel1EncerraNaMiss)
    out.push({ q:'Gestão', p: d.sev > 1 ? 'Gravidade ' + d.sev : 'Gatilho: foto anexada ou registro recente' });
  else
    out.push({ q:'Encerra na Miss', p:'Nível 1 sem gatilho · entra no resumo diário da gestão' });

  return out;
}

/** Quem corrige: a autora enquanto ninguém deu ciência, e a gestão sempre. É o mesmo
    conjunto que a guarda do servidor já autoriza em salvarOcorrencia. */
function podeCorrigir(o){
  const u = S.conta;
  if(!u || !o) return false;
  if(u.papel === 'gestao') return true;
  if(o.autorLogin !== u.login) return false;
  return !(o.chain || []).some(c => c.st === 'ok');
}

/** Reabre o formulário com o registro preenchido. O registro guarda cond e lesao
    achatados dentro de cada envolvido; o formulário os quer como mapas por criança. */
app.corrigirRegistro = id => {
  const o = S.ocs.find(x => x.id === id);
  if(!o || !podeCorrigir(o)) return;
  const cond = {}, lesao = {};
  for(const e of (o.envolvidos || [])){
    if(e.cond && e.cond !== '—') cond[e.kid] = e.cond;
    if(e.lesao) lesao[e.kid] = e.lesao;
  }
  S.editando = id;
  S.modoRegistro = 'completo';
  S.passo = 1; S.buscaAluno = ''; S.filtroTurma = ''; S.faltas = null;
  S.rascunho = {
    categoria:o.categoria || '', tipo:o.tipo || '', tipoOutro:o.tipoOutro || '',
    envolvidos: (o.envolvidos || []).map(e => ({ kid:e.kid, papel:e.papel, turma:e.turma || '' })),
    quandoOpcao:'manual', quandoISO:o.quandoISO || o.criadoEm,
    local:o.local || '', localOutro:o.localOutro || '', sev:o.sev || 0,
    presenciou: o.presenciou !== false,
    informanteNome:(o.informante && o.informante.nome) || '',
    informanteCanal:(o.informante && o.informante.canal) || '',
    desc:o.desc || '', prov:(o.prov || []).slice(), foto:!!o.foto,
    cond, lesao
  };
  ir('wizard');
};

/** A cadeia de ciência que o conteúdo atual do formulário pede. */
function cadeiaNova(){
  const c = destinoCiencia()
    .filter(x => !x.q.startsWith('Encerra'))
    .map((x, i) => ({ nivel: x.q.startsWith('Encerrado') ? 'Gestão' : x.q,
                      st: i === 0 ? 'now' : 'wait' }));
  return c.length ? c : [{ nivel:'Gestão', st:'now' }];
}

app.enviar = async () => {
  const u = S.conta, d = S.rascunho;
  const arquivoFoto = d.fotoArquivo || null;
  const antigo = S.editando ? S.ocs.find(x => x.id === S.editando) : null;
  const id = antigo ? antigo.id : String(Date.now()).slice(-4);

  /* O que o formulário diz. Identidade, autoria e ciência ficam de fora: numa
     correção elas não mudam. */
  const conteudo = {
    categoria:d.categoria, tipo:d.tipo, tipoOutro:d.tipoOutro, sev:d.sev,
    local:d.local, localOutro:d.localOutro, quandoISO:d.quandoISO,
    envolvidos: d.envolvidos.map(e => ({ kid:e.kid, papel:e.papel,
      turma: e.turma || aluno(e.kid).turma || '',
      cond:d.cond[e.kid] || '—', lesao:d.lesao[e.kid] || '' })),
    desc:d.desc, prov:d.prov, foto:d.foto,
    fotoDias: d.foto ? CONFIG.REGRAS.retencaoFotoDias : undefined,
    presenciou:d.presenciou,
    informante: d.presenciou ? null : { nome:d.informanteNome, canal:d.informanteCanal },
    duas: [...new Set(d.envolvidos.map(e => e.turma || aluno(e.kid).turma))].filter(Boolean).length > 1
  };

  let oc;
  if(antigo){
    /* Corrigir muda o conteúdo, não quem registrou nem quem já tomou conhecimento.
       A cadeia só é refeita quando ninguém deu ciência e as turmas mudaram — refazer
       depois de uma ciência apagaria o que já foi dado. */
    const comCiencia = (antigo.chain || []).some(c => c.st === 'ok');
    const turmas = l => [...new Set((l || []).map(e => e.turma))].filter(Boolean).sort().join('|');
    const mudouTurma = turmas(antigo.envolvidos) !== turmas(conteudo.envolvidos);
    oc = { ...antigo, ...conteudo, id,
      corrigidoEm:new Date().toISOString(), corrigidoPor:u.nome,
      chain: (!comCiencia && mudouTurma) ? cadeiaNova() : antigo.chain };
  } else {
    oc = { ...conteudo, id, criadoEm:new Date().toISOString(),
      autor:u.nome, autorLogin:u.login, autorPapel:u.papel,
      chain: cadeiaNova(), status:'aguarda_miss' };
    if(u.papel === 'gestao'){
      oc.chain = [{ nivel:'Gestão', st:'ok', quandoISO:new Date().toISOString(),
        quando:agoraHora(), parecer:'Registrado e encerrado pela gestão.' }];
      oc.status = 'concluido';
    }
  }

  await otimista(
    () => {
      if(antigo){
        const i = S.ocs.findIndex(x => x.id === oc.id);
        if(i >= 0) S.ocs[i] = oc;
        S.detalhe = oc.id;
      } else {
        S.ocs = [oc, ...S.ocs];
      }
      S.rascunho = null; S.passo = 1; S.faltas = null; S.pilha = [];
      S.avisouRascunho = false; S.editando = null;
      Store.descartarRascunho();
      ir(antigo ? 'detalhe' : 'home', { guardar:false });
    },
    async () => {
      await Store.salvarOcorrencia(oc);
      if(arquivoFoto){
        /* A foto vai depois: só agora existe um id de ocorrência para prendê-la.
           Falhar aqui não invalida o registro, que já está salvo. */
        try {
          const r = await Store.enviarFoto(oc.id, arquivoFoto);
          oc.fotoId = r.id;
          await Store.salvarOcorrencia(oc);
          const i = S.ocs.findIndex(x => x.id === oc.id);
          if(i >= 0) S.ocs[i] = oc;
        } catch(e){ toast('Registro salvo, mas a foto não subiu: ' + e.message); }
      }
    },
    antigo ? `Registro #${id} corrigido`
      : u.papel === 'gestao' ? `Registro #${id} criado e encerrado`
      : `Registro #${id} enviado para ciência`
  );
};

/* ---------------------------------------------------------------- listas */
/* Só o resultado: a digitação reescreve esta parte, nunca o campo de busca. */
function resultadoLista(){
  const q = semAcento(String(S.buscaLista || '')).toLowerCase();
  let v = visiveis(S.conta);
  if(q) v = v.filter(o =>
    (o.envolvidos || []).some(e => semAcento(aluno(e.kid).nome).toLowerCase().includes(q) ||
                                    semAcento(aluno(e.kid).turma || '').toLowerCase().includes(q)) ||
    semAcento(tipoDe(o)).toLowerCase().includes(q));
  return v.length ? v.map(o => itemHTML(o)).join('')
    : vazio('Nenhum registro', q ? 'Nada corresponde a essa busca.'
        : 'Assim que houver registros visíveis para você, eles aparecem aqui.');
}

registrarTela('lista', () => {
  return `<div class="stack s18">
    <div class="busca">
      <span class="ic">${svgIc(ICON.busca)}</span>
      <input class="input" id="b-lista" placeholder="Buscar por aluno, turma ou tipo" value="${esc(S.buscaLista || '')}"
             oninput="app.buscarLista(this.value)">
    </div>
    <div class="stack s8" id="lista-registros">${resultadoLista()}</div>
    ${rodape()}
  </div>`;
});

app.buscarLista = v => {
  S.buscaLista = v;
  const alvo = document.getElementById('lista-registros');
  if(alvo) alvo.innerHTML = resultadoLista();
};

registrarTela('ciencia', () => {
  const fila = filaDe(S.conta).slice().sort((a, b) => b.sev - a.sev);
  if(!fila.length) return `<div class="stack s18">
    <div class="notice calm"><span class="ic">&check;</span><div>Nada aguardando a sua ciência.</div></div>${rodape()}</div>`;
  return `<div class="stack s18">
    <p class="fs12 muted" style="margin:0">Ordenado por gravidade.</p>
    <div class="stack s8">${fila.map(o => itemHTML(o)).join('')}</div>
    ${rodape()}
  </div>`;
});

/* ---------------------------------------------------------------- detalhe */
function fotoBloco(o){
  const gestao = S.conta.papel === 'gestao';
  if(o.fotoPurgada) return `<div class="photo" style="border-style:solid">Foto apagada em ${esc(o.fotoPurgada)}</div>`;
  if(o.preservado) return `<div class="photo">1 foto · <b>preservada por decisão da gestão</b><br><span class="fs11">Fora da exclusão automática · acesso em log</span></div>`
    + (gestao ? `<button class="btn ghost sm" style="width:100%;margin-top:8px" onclick="app.preservar('${esc(o.id)}',false)">Voltar à retenção de ${CONFIG.REGRAS.retencaoFotoDias} dias</button>` : '');
  const url = o.fotoId ? Store.urlFoto(o.fotoId) : null;
  return (url
      ? `<div class="fotobox"><img src="${esc(url)}" alt="Foto da lesão" loading="lazy"></div>`
      : `<div class="photo">1 foto registrada</div>`)
    + (gestao ? `<button class="btn ghost sm" style="width:100%;margin-top:8px" onclick="app.preservar('${esc(o.id)}',true)">Preservar anexo (exceção)</button>` : '');
}

registrarTela('detalhe', () => {
  const o = S.ocs.find(x => x.id === S.detalhe), u = S.conta;
  if(!o) return vazio('Registro não encontrado', 'Ele pode ter sido removido.');
  const souDestino = filaDe(u).some(x => x.id === o.id);

  return `<div class="stack s18">
    <div>
      <div class="row" style="gap:8px;margin-bottom:7px;flex-wrap:wrap">${sevTag(o.sev)}${statusPill(o)}${o.duas ? '<span class="pill">2 turmas</span>' : ''}${o.demo ? '<span class="pill demo">demonstração</span>' : ''}</div>
      <h1 style="font-size:19px">${esc(tipoDe(o))}</h1>
      <p class="fs12 muted" style="margin:4px 0 0">#${esc(o.id)} · ${esc(o.categoria || '—')} · ${esc(localDe(o))} · ${esc(quandoTexto(o))}</p>
      <p class="fs12 muted" style="margin:2px 0 0">Registrado por ${esc(o.autor)}${o.presenciou
        ? ' · presenciou'
        : ' · informada por ' + esc((o.informante && o.informante.nome) || 'terceiros') + ((o.informante && o.informante.canal) ? ' (' + esc(o.informante.canal) + ')' : '')}</p>
    </div>

    <div><p class="sec-label">Crianças envolvidas</p><div class="stack s8">
      ${(o.envolvidos || []).map(e => `<div class="card flat">
        <div class="row" style="margin-bottom:6px"><span class="avatar sm">${esc(iniciais(aluno(e.kid).nome))}</span>
          <b class="fs13 grow">${esc(aluno(e.kid).nome)}</b><span class="pill">${esc(e.papel || '—')}</span></div>
        <div class="fs12 muted">Turma ${esc(e.turma || aluno(e.kid).turma || '—')} · ${esc(e.cond)}${e.lesao ? ' · marca em ' + esc(e.lesao) : ''}</div>
      </div>`).join('')}</div></div>

    <div><p class="sec-label">Descrição</p><p class="fs13" style="margin:0">${esc(o.desc)}</p></div>

    ${(o.prov || []).length ? `<div><p class="sec-label">Providências</p><div class="chips">
      ${o.prov.map(p => `<span class="chip sm">${esc(p)}</span>`).join('')}</div></div>` : ''}

    ${o.foto ? `<div><p class="sec-label">Anexo</p>${fotoBloco(o)}</div>` : ''}

    <div><p class="sec-label">Cadeia de ciência</p><div class="chain">
      ${(o.chain || []).map((c, i) => `<div class="node ${c.st}">
        <div class="gut"><div class="dot ${c.st === 'ok' ? 'ok' : c.st === 'now' ? 'now' : ''}">${c.st === 'ok' ? '&check;' : i+1}</div>${i < o.chain.length-1 ? `<div class="line ${c.st === 'ok' ? 'done' : ''}"></div>` : ''}</div>
        <div class="body"><b class="fs13">${esc(c.nivel)}</b>
          <div class="fs11 muted">${c.st === 'ok'
            ? 'Ciência em ' + esc(c.quandoISO ? quandoLegivel(c.quandoISO) : c.quando)
            : c.st === 'now' ? 'Aguardando' : 'Na fila'}</div>
          ${c.parecer ? `<p class="fs12" style="margin:6px 0 0;padding:8px 10px;background:var(--surface-2);border-radius:9px">${esc(c.parecer)}</p>` : ''}
        </div></div>`).join('')}</div></div>

    ${o.acomp ? `<div class="notice info"><span class="ic">◆</span><div><b>Acompanhamento:</b> ${esc(o.acomp)}</div></div>` : ''}

    <button class="btn soft" onclick="app.abrirFicha('${esc(o.id)}')">
      ${svgIc(ICON.exportar).replace('<svg','<svg width="17" height="17"')} Gerar relatório</button>

    ${podeCorrigir(o) ? `<button class="btn ghost" onclick="app.corrigirRegistro('${esc(o.id)}')">Corrigir registro</button>`
      : (o.autorLogin === u.login
        ? `<p class="fs11 muted center" style="margin:0">Registro travado pela ciência.</p>` : '')}

    ${souDestino ? `<div class="card lift stack s8" style="border-color:var(--accent-text)">
      <p class="sec-label" style="margin:0">Sua ciência</p>
      <div><p class="fs12 muted" style="margin:0 0 6px">Confirme ou corrija a gravidade</p>
        <div class="sevpick">${[1,2,3,4].map(n => `<button data-n="${n}" aria-pressed="${o.sev === n}" onclick="app.mudarSev('${esc(o.id)}',${n})"><b>${n}</b><small>${SEVL[n]}</small></button>`).join('')}</div></div>
      <div class="field"><label for="d-par">Parecer ou orientação (opcional)</label>
        <textarea class="input" id="d-par" style="min-height:66px" placeholder="Volta visível para quem registrou."></textarea></div>
      <button class="btn" onclick="app.darCiencia('${esc(o.id)}')">&check; Dar ciência</button>
      <button class="btn ghost" onclick="app.pedirComplemento('${esc(o.id)}')">Pedir complemento</button>
    </div>` : ''}

    ${u.papel === 'gestao' && !souDestino && o.status !== 'concluido' ? `<div class="card stack s8">
      <button class="btn soft" onclick="app.marcarComunicacao('${esc(o.id)}')">Registrar comunicação com a família</button>
    </div>` : ''}

    ${rodape()}
  </div>`;
});

/* O registro já está alterado em memória: basta gravá-lo. Buscar tudo de novo aqui
   custava mais de 12 segundos por causa das idas ao Apps Script. */
function salvar(o, msg, voltarPara){
  return otimista(
    () => { if(voltarPara){ S.detalhe = null; ir(voltarPara, { guardar:false }); } },
    () => Store.salvarOcorrencia(o),
    msg
  );
}

app.mudarSev = (id, n) => {
  const o = S.ocs.find(x => x.id === id); if(!o) return;
  o.sev = n; salvar(o, 'Gravidade ajustada para nível ' + n);
};

app.darCiencia = id => {
  const o = S.ocs.find(x => x.id === id), u = S.conta; if(!o) return;
  const par = (document.getElementById('d-par') || {}).value || '';
  const i = o.chain.findIndex(c => c.st === 'now'); if(i < 0) return;
  o.chain[i].st = 'ok';
  /* Guarda o instante, não o texto: "Hoje, 22:47" gravado em texto continuava dizendo
     "Hoje" meses depois, na tela e no papel. */
  o.chain[i].quandoISO = new Date().toISOString();
  o.chain[i].quando = quandoLegivel(o.chain[i].quandoISO);
  if(par.trim()) o.chain[i].parecer = par.trim();
  const prox = o.chain.findIndex(c => c.st === 'wait');
  if(prox >= 0){ o.chain[prox].st = 'now'; o.status = 'aguarda_miss'; }
  else {
    o.status = u.papel === 'gestao' ? 'acompanhamento' : 'concluido';
    if(u.papel === 'gestao') o.acomp = 'Definir encaminhamento · ' + u.curto;
  }
  salvar(o, prox >= 0 ? 'Ciência registrada. Segue para ' + o.chain[prox].nivel.split(' (')[0]
    : 'Ciência registrada. ' + (u.papel === 'gestao' ? 'Registro em acompanhamento' : 'Registro concluído'), 'ciencia');
};

app.pedirComplemento = id => {
  const o = S.ocs.find(x => x.id === id); if(!o) return;
  o.status = 'complemento';
  salvar(o, 'Devolvido a ' + String(o.autor).split(' ')[0] + ' · edição reaberta', 'ciencia');
};

app.preservar = (id, v) => {
  const o = S.ocs.find(x => x.id === id); if(!o) return;
  o.preservado = v;
  salvar(o, v ? 'Anexo preservado · fora da exclusão automática' : 'Anexo volta à retenção padrão');
};

app.marcarComunicacao = id => {
  const o = S.ocs.find(x => x.id === id); if(!o) return;
  o.acomp = 'Família comunicada em ' + quandoLegivel(new Date().toISOString());
  salvar(o, 'Comunicação com a família registrada');
};

/* ---------------------------------------------------------------- painel */
app.periodo = p => { S.periodo = p; render(); };

registrarTela('painel', () => {
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

  return `<div class="stack s18">
    <div class="chips" role="group" aria-label="Período">
      ${PERIODOS.map(p => `<button class="chip sm" aria-pressed="${S.periodo === p.id}" onclick="app.periodo('${p.id}')">${esc(p.nome)}</button>`).join('')}
    </div>

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
      <div class="heat" id="heat" style="grid-template-columns:76px repeat(${grade.horas.length},1fr)">
        <div></div>${grade.horas.map(h => `<div class="hh">${h}h</div>`).join('')}
        ${grade.linhas.map(l => `<div class="rl" title="${esc(l.local)}">${esc(l.local)}</div>` +
          l.celulas.map(n => `<div class="cell" data-n="${n}" data-max="${grade.max}">${n || ''}</div>`).join('')).join('')}
      </div>
      <div class="legend" style="margin-top:10px"><span><i style="background:var(--surface-2)"></i>0</span>
        <span><i style="background:color-mix(in srgb,var(--teal) 44%,var(--surface))"></i>poucos</span>
        <span><i style="background:var(--teal)"></i>${grade.max}</span></div>
      `
      : '<p class="fs12 muted" style="margin:0">Sem horário registrado no período.</p>'}
    </div>

    <div class="card">
      <p class="sec-label">Por categoria</p>
      <div class="bars">${cats.map(([t, n]) => `
        <div><div class="bar-row"><span class="lab">${esc(t)}</span><span class="bar-n">${n}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/maxCat*100)}%"></div></div></div></div>`).join('')}</div>
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
    ${rodape()}
  </div>`;
});

posRender.push(() => {
  document.querySelectorAll('#heat .cell').forEach(c => {
    const n = +c.dataset.n, max = +c.dataset.max || 1;
    const pct = n === 0 ? 0 : Math.round(24 + (n / max) * 70);
    c.style.background = n === 0 ? 'var(--surface-2)'
      : `color-mix(in srgb, var(--teal) ${pct}%, var(--surface))`;
    c.style.color = pct >= 70 ? 'var(--accent-ink)' : 'var(--fg)';
  });
});

export { tipoDe, localDe, quandoTexto, sevTag };
