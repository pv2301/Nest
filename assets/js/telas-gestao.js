/* Gestão de usuários: aprovar cadastros, trocar perfis, conceder funções.
   Visível apenas para quem tem papel 'gestao'. */

import { S, app, registrarTela, ir, toast, render, recarregar, rodape, pendentes } from './core.js';
import { Store } from './store.js';
import { esc, ICON, svgIc, iniciais, quandoLegivel, senhaTemporaria } from './util.js';
import { PAPEIS_CONTA, FUNCOES, TURMAS } from './dados.js';

const rotuloPapel = p => (PAPEIS_CONTA.find(x => x.id === p) || {}).nome || p;
const gestoresAtivos = () => S.contas.filter(c => c.papel === 'gestao' && c.status === 'ativo');

function linhaUsuario(c){
  const sel = {
    pendente: '<span class="pill wait">Pendente</span>',
    ativo:    '',
    inativo:  '<span class="pill off">Desativado</span>',
    recusado: '<span class="pill off">Recusado</span>'
  }[c.status] || '';
  return `<button class="urow" onclick="app.abrirUsuario('${esc(c.login)}')">
    <span class="avatar sm">${esc(iniciais(c.nome))}</span>
    <span class="grow">
      <span style="display:block;font-size:13.5px;font-weight:600">${esc(c.nome)}</span>
      <span class="fs11 muted">${esc(c.login)} · ${esc(rotuloPapel(c.papel))}${c.turma ? ' · ' + esc(c.turma) : ''}</span>
    </span>
    ${sel}
  </button>`;
}

registrarTela('usuarios', () => {
  const pend = pendentes();
  const ativos = S.contas.filter(c => c.status === 'ativo');
  const outros = S.contas.filter(c => c.status === 'inativo' || c.status === 'recusado');
  return `<div class="stack s18">
    ${pend.length ? `
      <div>
        <p class="sec-label">Aguardando aprovação · ${pend.length}</p>
        <div class="stack s8">${pend.map(c => `
          <div class="card" style="border-color:var(--g2-mark)">
            <div class="row" style="margin-bottom:9px">
              <span class="avatar sm">${esc(iniciais(c.nome))}</span>
              <span class="grow">
                <b class="fs13" style="display:block">${esc(c.nome)}</b>
                <span class="fs11 muted">${esc(c.login)} · pediu ${esc(rotuloPapel(c.papel))}${c.turma ? ' · ' + esc(c.turma) : ''}</span>
              </span>
            </div>
            <p class="fs11 muted" style="margin:0 0 9px">Criada ${esc(quandoLegivel(c.criadoEm))}</p>
            <div class="row" style="gap:8px">
              <button class="btn sm" style="flex:1" onclick="app.aprovar('${esc(c.login)}')">Aprovar</button>
              <button class="btn ghost sm" style="flex:1" onclick="app.abrirUsuario('${esc(c.login)}')">Ajustar antes</button>
              <button class="btn danger sm" onclick="app.recusar('${esc(c.login)}')">Recusar</button>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}

    <div>
      <p class="sec-label">Ativos · ${ativos.length}</p>
      <div class="stack s8">${ativos.length ? ativos.map(linhaUsuario).join('')
        : `<div class="empty"><div class="big">Nenhum usuário ativo ainda</div>
             <p class="fs12" style="margin:0">Quem receber o link cria a conta e aparece aqui para você aprovar.</p></div>`}</div>
    </div>

    ${outros.length ? `<div><p class="sec-label">Desativados e recusados</p>
      <div class="stack s8">${outros.map(linhaUsuario).join('')}</div></div>` : ''}

    <div class="card flat stack s8">
      <p class="sec-label" style="margin:0">Dados de demonstração</p>
      <p class="fs12 muted" style="margin:0">
        Carrega contas e registros fictícios para você experimentar o painel e a cadeia de ciência.
        As contas de demonstração nascem sem senha: para entrar como uma delas, use
        <b>Redefinir senha</b> na ficha do usuário.
      </p>
      <div class="row" style="gap:8px">
        <button class="btn soft sm" style="flex:1" onclick="app.demo(true)">Carregar</button>
        <button class="btn ghost sm" style="flex:1" onclick="app.demo(false)">Limpar</button>
      </div>
    </div>
    ${rodape()}
  </div>`;
});

app.abrirUsuario = login => { S.usuarioSel = login; ir('usuario'); };

app.aprovar = async login => {
  try {
    await Store.atualizarConta(login, { status:'ativo', aprovadoPor:S.conta.login, aprovadoEm:new Date().toISOString() });
    await recarregar();
    toast(login + ' aprovado. Já pode entrar.');
  } catch(e){ toast(e.message); }
};

app.recusar = async login => {
  try {
    await Store.atualizarConta(login, { status:'recusado', aprovadoPor:S.conta.login });
    await recarregar();
    toast('Cadastro de ' + login + ' recusado.');
  } catch(e){ toast(e.message); }
};

app.demo = async carregar => {
  try {
    if(carregar) await Store.carregarDemo(); else await Store.limparDemo();
    await recarregar();
    toast(carregar ? 'Dados de demonstração carregados.' : 'Dados de demonstração removidos.');
  } catch(e){ toast(e.message); }
};

/* ---------------------------------------------------------------- ficha do usuário */
registrarTela('usuario', () => {
  const c = S.contas.find(x => x.login === S.usuarioSel);
  if(!c) return `<div class="empty"><div class="big">Usuário não encontrado</div></div>`;
  const euMesmo = c.login === S.conta.login;
  const ultimoGestor = c.papel === 'gestao' && c.status === 'ativo' && gestoresAtivos().length <= 1;

  return `<div class="stack s18">
    <div class="row">
      <div class="avatar" style="width:46px;height:46px;font-size:15px">${esc(iniciais(c.nome))}</div>
      <div class="grow">
        <h1 style="font-size:17px">${esc(c.nome)}</h1>
        <p class="fs12 muted" style="margin:1px 0 0">${esc(c.login)}</p>
      </div>
      ${c.status === 'pendente' ? '<span class="pill wait">Pendente</span>' : ''}
      ${c.status === 'inativo' ? '<span class="pill off">Desativado</span>' : ''}
    </div>

    ${euMesmo ? `<div class="notice info"><span class="ic">◆</span><div>
      Esta é a sua própria conta. O perfil e a situação não podem ser alterados por você mesma.</div></div>` : ''}
    ${ultimoGestor && !euMesmo ? `<div class="notice info"><span class="ic">◆</span><div>
      Última conta de gestão ativa. Promova outra pessoa antes de rebaixar ou desativar esta.</div></div>` : ''}

    <div>
      <p class="sec-label">Perfil</p>
      <div class="chips">
        ${PAPEIS_CONTA.map(p => `<button class="chip" aria-pressed="${c.papel === p.id}"
          ${euMesmo || (ultimoGestor && p.id !== 'gestao') ? 'disabled style="opacity:.45"' : ''}
          onclick="app.mudarPapel('${esc(c.login)}','${p.id}')">${esc(p.nome)}</button>`).join('')}
      </div>
      ${c.papel !== 'gestao' ? '<p class="hint">Promover a Gestão dá acesso a todos os registros da escola e à aprovação de contas.</p>' : ''}
    </div>

    <div>
      <p class="sec-label">Turma</p>
      <div class="chips">
        ${TURMAS.map(t => `<button class="chip" aria-pressed="${c.turma === t}"
          onclick="app.mudarTurma('${esc(c.login)}','${esc(t)}')">${esc(t)}</button>`).join('')}
      </div>
      <p class="hint">A turma define para qual Miss vai a ciência dos registros das crianças dela.</p>
    </div>

    <div>
      <p class="sec-label">Funções concedidas</p>
      <div class="stack s8">
        ${FUNCOES.map(f => {
          const herdada = f.id === 'painel' && c.papel === 'gestao';
          const ligada = herdada || (c.funcoes || []).includes(f.id);
          return `<button class="switch" aria-pressed="${ligada}" ${herdada ? 'disabled style="opacity:.6"' : ''}
            onclick="app.alternarFuncao('${esc(c.login)}','${f.id}')">
            <span class="grow">
              <span style="display:block;font-size:13px;font-weight:600">${esc(f.nome)}${f.pronta ? '' : ' <span class="pill" style="font-size:9.5px">em breve</span>'}</span>
              <span class="fs11 muted">${herdada ? 'Incluída no perfil de gestão' : esc(f.desc)}</span>
            </span>
            <span class="track"></span>
          </button>`;
        }).join('')}
      </div>
    </div>

    <div class="card flat">
      <dl class="kv">
        <dt>Situação</dt><dd>${esc(c.status)}</dd>
        <dt>Criada em</dt><dd>${esc(quandoLegivel(c.criadoEm) || '—')}</dd>
        ${c.aprovadoPor ? `<dt>Aprovada por</dt><dd>${esc(c.aprovadoPor)}</dd>` : ''}
      </dl>
    </div>

    ${S.senhaGerada && S.senhaGerada.login === c.login ? `
      <div class="notice calm"><span class="ic">◆</span><div>
        Senha temporária de <b>${esc(c.login)}</b>: <b style="font-size:15px">${esc(S.senhaGerada.senha)}</b><br>
        Anote agora — ela não será mostrada de novo. No primeiro acesso o sistema pede uma nova.
      </div></div>` : ''}

    <div class="stack s8">
      ${c.status === 'pendente' ? `<button class="btn" onclick="app.aprovar('${esc(c.login)}')">Aprovar cadastro</button>` : ''}
      <button class="btn ghost" onclick="app.redefinir('${esc(c.login)}')">Redefinir senha</button>
      ${c.status === 'ativo'
        ? `<button class="btn danger" ${euMesmo || ultimoGestor ? 'disabled' : ''} onclick="app.desativar('${esc(c.login)}',true)">Desativar conta</button>`
        : `<button class="btn soft" onclick="app.desativar('${esc(c.login)}',false)">Reativar conta</button>`}
    </div>
    ${rodape()}
  </div>`;
});

async function patch(login, p, msg){
  try { await Store.atualizarConta(login, p); await recarregar(); if(msg) toast(msg); else render(); }
  catch(e){ toast(e.message); }
}

app.mudarPapel = (login, papel) => {
  const c = S.contas.find(x => x.login === login);
  if(!c || c.papel === papel) return;
  const extra = papel === 'gestao' ? { funcoes: [...new Set([...(c.funcoes||[]), 'painel'])] } : {};
  patch(login, { papel, ...extra }, 'Perfil alterado para ' + rotuloPapel(papel) + '.');
};

app.mudarTurma = (login, turma) => {
  const c = S.contas.find(x => x.login === login);
  patch(login, { turma: c && c.turma === turma ? null : turma });
};

app.alternarFuncao = (login, f) => {
  const c = S.contas.find(x => x.login === login);
  if(!c) return;
  const atuais = new Set(c.funcoes || []);
  atuais.has(f) ? atuais.delete(f) : atuais.add(f);
  patch(login, { funcoes: [...atuais] });
};

app.desativar = (login, desativar) =>
  patch(login, { status: desativar ? 'inativo' : 'ativo' },
    desativar ? 'Conta desativada.' : 'Conta reativada.');

app.redefinir = async login => {
  const senha = senhaTemporaria();
  try {
    await Store.redefinirSenha(login, senha);
    await Store.atualizarConta(login, { trocarSenha:true });
    S.senhaGerada = { login, senha };
    await recarregar();
  } catch(e){ toast(e.message); }
};

/* ---------------------------------------------------------------- funções ainda não construídas */
function placeholder(icone, titulo, linhas){
  return `<div class="stack s18">
    <div class="empty">
      <div style="width:60px;height:60px;border-radius:50%;background:var(--accent-soft);color:var(--accent-text);
                  display:grid;place-items:center;margin:0 auto 12px">
        ${svgIc(icone).replace('<svg','<svg width="29" height="29"')}
      </div>
      <div class="big">${esc(titulo)}</div>
      <p class="fs12" style="margin:0 0 14px">Função concedida. A tela ainda será construída.</p>
    </div>
    <div class="card flat">
      <p class="sec-label">O que ela vai trazer</p>
      <div class="stack s6">${linhas.map(l => `<div class="row" style="gap:8px;align-items:flex-start">
        <span style="color:var(--accent-text);flex:none">•</span><span class="fs13 grow">${esc(l)}</span></div>`).join('')}</div>
    </div>
    ${rodape()}
  </div>`;
}

registrarTela('horario', () => placeholder(ICON.horario, 'Quadro horário', [
  'Quem está em qual turma e em qual turno, ao longo da semana',
  'Cobertura por horário, para enxergar os momentos com menos adulto por criança',
  'Cruzamento com o heatmap de ocorrências: os horários críticos lado a lado com a escala'
]));

registrarTela('relacoes', () => placeholder(ICON.relacoes, 'Relações', [
  'Vínculo entre Miss, assistente, turma e crianças',
  'Quem responde pela ciência de cada turma, inclusive nas ausências',
  'Pares de crianças que se envolvem com frequência, para rever agrupamentos'
]));
