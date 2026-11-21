/* Por onde se entra: o início, a escolha do modo de registro, a lista de registros e
   a fila de ciência. São as quatro telas que a pessoa vê sem ter decidido nada. */

import { S, app, registrarTela, ir, rodape, filaDe, meusRegistros, visiveis,
         rascunhoGuardado, aluno } from './core.js';
import { escolha } from './escolha.js';
import { esc, semAcento, quandoLegivel, ICON, svgIc } from './util.js';
import { itemHTML, primeirosPassos, tipoDe, vazio } from './telas-comum.js';

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
    <span class="acao-txt" role="button" tabindex="0"
      onclick="event.stopPropagation();app.descartarRascunho()">Descartar</span>
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
  S.editando = null; S.tentouEnviar = false;
  S.modoRegistro = modo; S.passo = 1; S.buscaAluno = ''; S.filtroTurma = '';
  S.rascunho = { categoria:'', tipo:'', tipoOutro:'', envolvidos:[],
                 quandoOpcao:'Agora', quandoISO:new Date().toISOString(),
                 local:'', localOutro:'', sev:0, presenciou:true,
                 informanteNome:'', informanteCanal:'', desc:'', prov:[], foto:false,
                 cond:{}, lesao:{} };
  ir(modo === 'rapido' ? 'rapido' : 'wizard');
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
