/* O formulário: registro rápido, registro completo em passos, e o que os dois
   precisam — seleção de crianças, quando e onde, descrição, foto, e o envio.

   O roteamento da ciência mora aqui porque é a revisão que o mostra, mas quem decide
   é regras.mjs, e quem grava a cadeia é o servidor: este lado só exibe. */

import { S, app, registrarTela, ir, toast, render, rodape, otimista, aluno,
         nomesTurmas, avancarPasso, voltar } from './core.js';
import { Store } from './store.js';
import { escolha } from './escolha.js';
import { montarDestinos, paraCadeia, oQueFalta, podeCorrigir,
         RETENCAO_FOTO_DIAS } from './regras.mjs';
import { esc, quandoLegivel, agoraHora, iniciais, novoId } from './util.js';
import { tituloNome } from './nomes.mjs';
import { CONFIG } from '../../config.js';
import { CATS, OUTRO, EXEMPLOS, LOCAIS, PROVIDENCIAS, CONDICOES, REGIOES,
         PAPEIS_ENVOLVIDO, CANAIS_INFORME, SEVL, JULGAMENTO } from './vocabulario.js';
import { sevTag, vazio } from './telas-comum.js';

/* ---------------------------------------------------------------- o que falta */
const faltas = oQueFalta;

/** Texto da falta daquele campo, ou vazio.

    Recalculado a cada desenho, e só depois da primeira tentativa de enviar: marcar
    de saída um formulário em branco seria agressivo, e guardar a lista de faltas
    deixava a marca velha — o campo continuava vermelho depois de preenchido. */
const erroDe = campo => {
  if(!S.tentouEnviar || !S.rascunho) return '';
  const x = faltas(S.rascunho).find(f => f.campo === campo);
  return x ? x.texto : '';
};

/* O botão nunca fica desabilitado sem explicação: ao tocar, mostra o que falta e
   cada item leva ao passo certo. Antes ele só ficava cinza, sem dizer por quê. */
app.tentarEnviar = () => {
  /* Dois toques rápidos criavam dois registros: cada chamada gerava o seu id e as
     duas gravavam. O `salvando` do core já existe para a barra de trabalho; aqui ele
     também fecha a porta. */
  if(S.salvando) return;
  const f = faltas(S.rascunho);
  S.tentouEnviar = true;
  if(!f.length) return app.enviar();
  S.faltas = f;
  render();
  const el = document.getElementById('faltas');
  if(el) el.scrollIntoView({ block:'center', behavior:'smooth' });
};

function blocoFaltas(){
  /* Refeito a cada desenho: o aviso encolhe conforme a pessoa preenche. */
  if(!S.tentouEnviar || !S.rascunho) return '';
  S.faltas = faltas(S.rascunho);
  if(!S.faltas.length) return '';
  const temPassos = S.modoRegistro === 'completo';
  return `<div class="notice alert" id="faltas"><span class="ic">!</span><div>
    <b>Falta preencher ${S.faltas.length === 1 ? 'um item' : S.faltas.length + ' itens'}:</b>
    <ul style="margin:6px 0 0;padding-left:18px">
      ${S.faltas.map(x => `<li style="margin-bottom:3px">${temPassos
        ? `<a href="#" onclick="app.irPasso(${x.passo});return false" style="color:inherit">${esc(x.texto)} <span style="opacity:.7">(passo ${x.passo})</span></a>`
        : esc(x.texto)}</li>`).join('')}
    </ul></div></div>`;
}

app.irPasso = p => { S.passo = p; render(); };

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
    ${escolha({
      id:'kids',
      opcoes: listaAlunos().map(a => ({ valor:a.id, nome:a.nome,
        sub: a.turma ? 'Turma ' + a.turma : '', ini: iniciais(a.nome) })),
      valor: d.envolvidos.map(e => e.kid),
      multipla:true, busca:true, erro:erroDe('criancas'),
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
  const novo = { id:'a' + Date.now().toString(36), nome:tituloNome(nome),
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
      <input class="input" id="av-nome" autocapitalize="words" autofocus></div>
    ${turmas.length ? escolha({ id:'turma-avulso', rotulo:'Turma', opcoes:turmas,
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
      <button class="icone-x" onclick="app.togKid('${esc(e.kid)}')" aria-label="Tirar ${esc(a.nome)}">&times;</button>
    </div>

    ${escolha({ id:'papel-' + i, rotulo:'Papel nesta ocorrência', opcoes:PAPEIS_ENVOLVIDO,
      valor:e.papel, placeholder:'Escolher o papel', erro:e.papel ? '' : erroDe('papel'),
      aoEscolher:v => { e.papel = v; S.faltas = null; } })}

    ${turmas.length ? escolha({ id:'turma-' + i, rotulo:'Turma', opcoes:turmas,
      valor:e.turma, placeholder:'Escolher a turma',
      aoEscolher:v => { e.turma = e.turma === v ? '' : v; } }) : ''}

    ${escolha({ id:'cond-' + i, rotulo:'Como ficou', opcoes:CONDICOES, valor:cond,
      busca:true, placeholder:'Escolher',
      aoEscolher:v => { d.cond[e.kid] = d.cond[e.kid] === v ? '' : v; } })}

    ${temLesao ? escolha({ id:'lesao-' + i, rotulo:'Onde é a marca ou lesão',
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
    ${escolha({ id:'quando', rotulo:'Quando aconteceu',
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
    ${escolha({ id:'local', rotulo:'Onde aconteceu',
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
  const err = erroDe('descricao');
  return `<div class="narrativa${err ? ' com-erro' : ''}">
    <div class="row" style="margin-bottom:7px">
      <label for="${id}" class="grow" style="margin:0">Descrição do ocorrido</label>
      <!-- O min-height:0 fazia dele um alvo de 27px, que um polegar erra. A área
           cresce sem a aparência crescer: o padding vertical é que aumenta. -->
      <button class="btn ghost sm" style="padding:13px 10px;min-height:44px;font-size:11.5px"
        onclick="app.usarExemplo()">Usar exemplo</button>
    </div>
    <textarea class="input" id="${id}" placeholder="${esc(ex)}"
      spellcheck="true" autocorrect="on" autocapitalize="sentences"${err ? ' aria-invalid="true"' : ''}
      oninput="app.checarTexto('desc','${id}-chk',this.value)">${esc(d.desc)}</textarea>
    <div id="${id}-chk" style="margin-top:8px">${checagemLinguagem(d.desc)}</div>
    <p class="hint">Descreva o que foi observado, antes e depois.</p>
    ${err ? `<p class="erromsg">${esc(err)}</p>` : ''}
  </div>`;
}

function blocoPresenciou(){
  const d = S.rascunho;
  return `<div>
    ${escolha({ id:'presenciou', rotulo:'Você presenciou?',
      opcoes:[{ valor:'sim', nome:'Presenciei' }, { valor:'nao', nome:'Fui informada' }],
      valor:d.presenciou ? 'sim' : 'nao', busca:false,
      aoEscolher:v => { d.presenciou = v === 'sim'; S.faltas = null; } })}
    ${!d.presenciou ? `
      <div class="field" style="margin-top:10px"><label for="w-inf">Quem informou</label>
        <input class="input" id="w-inf" autocapitalize="words" value="${esc(d.informanteNome)}" placeholder="Nome de quem relatou"
               oninput="app.campoTxt('informanteNome',this.value)"></div>
      <div style="margin-top:9px">${escolha({ id:'canal', rotulo:'Por qual canal',
        opcoes:CANAIS_INFORME, valor:d.informanteCanal, placeholder:'Escolher',
        aoEscolher:v => { d.informanteCanal = v; } })}</div>` : ''}
  </div>`;
}

/* ---------------------------------------------------------------- registro rápido */
registrarTela('rapido', () => {
  const d = S.rascunho;
  return `<div class="stack s18">
    ${blocoFaltas()}
    ${escolha({ id:'cat-r', rotulo:'1 · Categoria', opcoes:Object.keys(CATS),
      valor:d.categoria, placeholder:'Escolher categoria', erro:erroDe('categoria'),
      aoEscolher:c => { d.categoria = c; d.tipo = ''; d.tipoOutro = ''; S.faltas = null; } })}
    ${d.categoria ? `${escolha({ id:'tipo-r', rotulo:'Tipo',
        opcoes:CATS[d.categoria].concat([OUTRO]), valor:d.tipo, placeholder:'Escolher tipo', erro:erroDe('tipo'),
        aoEscolher:v => { d.tipo = v; S.faltas = null; } })}
      ${d.tipo === OUTRO ? `<div class="field" style="margin-top:9px"><input class="input" placeholder="Qual?" value="${esc(d.tipoOutro)}" oninput="app.campoTxt('tipoOutro',this.value)"></div>` : ''}` : ''}
    <div><p class="sec-label">2 · Quem</p>${seletorAlunos()}</div>
    ${dialogoAvulso()}
    ${sinalRecentes()}
    ${d.envolvidos.length ? `<div><p class="sec-label">Papel de cada criança</p><div class="stack s8">
      ${d.envolvidos.map((e, i) => cardEnvolvido(e, i)).join('')}</div></div>` : ''}
    <div><p class="sec-label">3 · Gravidade</p>${sevPicker()}</div>
    ${campoDescricao('r-desc')}
    <button class="btn" ${S.salvando ? 'disabled' : ''} onclick="app.tentarEnviar()">${
      S.salvando ? 'Enviando…' : S.editando ? 'Salvar correção' : 'Enviar registro'}</button>
  </div>`;
});

/* ---------------------------------------------------------------- wizard */
registrarTela('wizard', () => {
  const d = S.rascunho, st = S.passo;
  let corpo = '';

  /* 1 — classificar o que aconteceu. Gravidade entra aqui, ao lado de categoria e
     tipo, porque é a mesma pergunta: que tipo de coisa foi, e quão séria. */
  if(st === 1) corpo = `<div class="stack s18">
    ${escolha({ id:'cat', rotulo:'1 · Categoria do registro', opcoes:Object.keys(CATS),
      valor:d.categoria, placeholder:'Escolher categoria', erro:erroDe('categoria'),
      aoEscolher:c => { d.categoria = c; d.tipo = ''; d.tipoOutro = ''; S.faltas = null; } })}
    ${d.categoria ? `${escolha({ id:'tipo', rotulo:'Tipo',
        opcoes:CATS[d.categoria].concat([OUTRO]), valor:d.tipo, placeholder:'Escolher tipo', erro:erroDe('tipo'),
        aoEscolher:v => { d.tipo = v; S.faltas = null; } })}
      ${d.tipo === OUTRO ? `<div class="field" style="margin-top:9px"><label for="w-tipo">Qual?</label>
        <input class="input" id="w-tipo" value="${esc(d.tipoOutro)}" oninput="app.campoTxt('tipoOutro',this.value)"></div>` : ''}`
      : `<p class="fs12 muted" style="margin:0">Escolha a categoria para ver os tipos.</p>`}
    ${d.tipo ? `<div class="esc${erroDe('gravidade') ? ' com-erro' : ''}">
      <p class="sec-label">Gravidade</p>${sevPicker()}
      ${erroDe('gravidade') ? `<p class="erromsg">${esc(erroDe('gravidade'))}</p>` : ''}
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
      ${escolha({ id:'prov', rotulo:'4 · O que foi feito', opcoes:PROVIDENCIAS,
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

      <button class="btn" id="btn-enviar" ${S.salvando ? 'disabled' : ''} onclick="app.tentarEnviar()">${
        S.salvando ? 'Enviando…' : S.editando ? 'Salvar correção' : 'Enviar registro'}</button>
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
  const u = S.conta, d = S.rascunho;
  const turmas = [...new Set(d.envolvidos.map(e => e.turma || aluno(e.kid).turma).filter(Boolean))];
  const temAnterior = d.envolvidos.some(e =>
    S.ocs.some(o => (o.envolvidos || []).some(x => x.kid === e.kid)));
  /* Quem decide é regras.mjs; aqui só se junta o que ela precisa saber. O servidor
     refaz a mesma conta com os mesmos dados. */
  return montarDestinos({
    papelAutor:u.papel, turmaAutor:u.turma, turmas,
    missDaTurma, temAnterior, sev:d.sev, temFoto:!!d.foto
  }).map(x => ({ q:x.nivel, p:x.nota, encerra:x.encerra }));
}


/** Reabre o formulário com o registro preenchido. O registro guarda cond e lesao
    achatados dentro de cada envolvido; o formulário os quer como mapas por criança. */
app.corrigirRegistro = id => {
  const o = S.ocs.find(x => x.id === id);
  if(!o || !podeCorrigir(S.conta, o)) return;
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

/** A cadeia que o conteúdo atual do formulário pede. */
function cadeiaNova(){
  return paraCadeia(destinoCiencia().map(x => ({ nivel:x.q, encerra:x.encerra })));
}

app.enviar = async () => {
  const u = S.conta, d = S.rascunho;
  const arquivoFoto = d.fotoArquivo || null;
  const antigo = S.editando ? S.ocs.find(x => x.id === S.editando) : null;
  const id = antigo ? antigo.id : novoId();

  /* O que o formulário diz. Identidade, autoria e ciência ficam de fora: numa
     correção elas não mudam. */
  const conteudo = {
    categoria:d.categoria, tipo:d.tipo, tipoOutro:d.tipoOutro, sev:d.sev,
    local:d.local, localOutro:d.localOutro, quandoISO:d.quandoISO,
    envolvidos: d.envolvidos.map(e => ({ kid:e.kid, papel:e.papel,
      turma: e.turma || aluno(e.kid).turma || '',
      cond:d.cond[e.kid] || '—', lesao:d.lesao[e.kid] || '' })),
    desc:d.desc, prov:d.prov, foto:d.foto,
    fotoDias: d.foto ? RETENCAO_FOTO_DIAS : undefined,
    presenciou:d.presenciou,
    informante: d.presenciou ? null : { nome:tituloNome(d.informanteNome), canal:d.informanteCanal },
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
      S.avisouRascunho = false; S.editando = null; S.tentouEnviar = false;
      Store.descartarRascunho();
      ir(antigo ? 'detalhe' : 'home', { guardar:false });
    },
    async () => {
      try {
        await Store.salvarOcorrencia(oc, { novo: !antigo });
      } catch(e){
        /* Número já ocupado: com seis caracteres aleatórios é raro, mas raro não é
           nunca, e fazer a pessoa reescrever o registro por causa de um sorteio
           infeliz seria absurdo. Sorteia outro e tenta uma vez. */
        if(e.codigo !== 'id_ocupado' || antigo) throw e;
        oc.id = novoId();
        await Store.salvarOcorrencia(oc, { novo:true });
        const i = S.ocs.findIndex(x => x.id === id);
        if(i >= 0) S.ocs[i] = oc;
      }
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
