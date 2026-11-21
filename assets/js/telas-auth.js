/* Entrada, login, criação de conta, configuração inicial e biometria.
   Os formulários NÃO re-renderizam a cada tecla: só o trecho que muda é atualizado,
   para o foco e a posição do cursor não se perderem enquanto a pessoa digita. */

import { S, app, registrarTela, ir, voltar, toast, render, autenticar, rodape } from './core.js';
import { Store } from './store.js';
import {
  esc, RINGBG, SEAL, ICON, svgIc,
  validaLogin, validaSenha, requisitosSenha, normalizaLogin, sugereLogin, senhaTemporaria,
  criptoDisponivel, tituloNome
} from './util.js';
import { PAPEIS_CONTA, FUNCOES } from './vocabulario.js';
import { escolha } from './escolha.js';
import { CONFIG } from '../../config.js';

const val = id => (document.getElementById(id) || {}).value || '';
const marca = () => S.escola.logo
  ? `<div class="logoplate"><img src="${esc(S.escola.logo)}" alt="${esc(S.escola.nome || 'Logo')}" width="134"></div>`
  : `<div style="display:grid;place-items:center">${SEAL.replace('class="seal"','class="seal" style="width:92px;height:92px"')}</div>`;

const cabecalhoMarca = () => `
  <div class="stack s8">
    ${marca()}
    <p class="loginsub">${esc(S.escola.subtitulo || 'Registro interno de ocorrência')}</p>
  </div>`;

/* As turmas são criadas pela gestão. Aqui mostramos só as que existem de verdade —
   oferecer turmas inventadas faria a pessoa escolher algo que não existe. A lista vem
   de estado(), que é público, porque o cadastro acontece antes do login. */
const turmasDisponiveis = () => (S.turmas || []).map(t => t.nome);

const erroBloco = () => S.formErro ? `<div class="notice alert"><span class="ic">!</span><div>${esc(S.formErro)}</div></div>` : '';

/* ---------------------------------------------------------------- entrada */
registrarTela('entrada', () => `
  <div class="loginwrap">
    <div class="ringbg">${RINGBG}</div>
    <div class="stack s18" style="position:relative">
      ${cabecalhoMarca()}
      ${erroBloco()}
      <div class="card lift stack s8">
        <button class="btn" onclick="app.ir('entrar')">Entrar</button>
        <button class="btn ghost" onclick="app.irCriar()">Criar conta</button>
      </div>
      ${rodape()}
    </div>
  </div>`);

/* ---------------------------------------------------------------- entrar */
registrarTela('entrar', () => `
  <div class="loginwrap">
    <div class="stack s18">
      ${cabecalhoMarca()}
      ${erroBloco()}
      <form class="card lift stack" onsubmit="app.submeterEntrar(event)">
        <div class="field">
          <label for="f-login">Login</label>
          <input class="input" id="f-login" autocomplete="username" inputmode="text"
                 placeholder="nome.sobrenome" oninput="app.normaliza('f-login')">
        </div>
        <div class="field">
          <label for="f-senha">Senha</label>
          <input class="input" id="f-senha" type="password" autocomplete="current-password">
        </div>
        <button class="btn" type="submit" ${S.ocupado ? 'disabled' : ''}>${S.ocupado ? 'Entrando…' : 'Entrar'}</button>
        <button class="btn ghost sm" type="button" style="width:100%" onclick="app.voltar()">Voltar</button>
      </form>
      <p class="fs11 muted center" style="margin:0">Esqueceu a senha? Fale com a gestão.</p>
      ${rodape()}
    </div>
  </div>`);

app.normaliza = id => {
  const el = document.getElementById(id);
  if(!el) return;
  const pos = el.selectionStart;
  const antes = el.value;
  el.value = normalizaLogin(antes);
  const delta = el.value.length - antes.length;
  try { el.setSelectionRange(pos + delta, pos + delta); } catch {}
};

app.submeterEntrar = async ev => {
  ev.preventDefault();
  const login = normalizaLogin(val('f-login')), senha = val('f-senha');
  const e = validaLogin(login);
  if(e) return erro(e);
  if(!senha) return erro('Informe a senha.');
  if(!criptoDisponivel()) return erro('Este navegador não oferece as funções de segurança necessárias. Abra o site por https.');
  S.ocupado = true; S.formErro = null; render();
  try {
    const conta = await Store.entrar(login, senha);
    S.ocupado = false;
    if(!Store.aparelhoLembrado()){ S.contaPendenteBio = conta; return ir('biometria'); }
    await autenticar(conta);
  } catch(err){
    S.ocupado = false;
    erro(err.message || 'Não consegui entrar.');
  }
};

function erro(msg){ S.formErro = msg; S.ocupado = false; render(); }

/* ---------------------------------------------------------------- criar conta */
app.irCriar = () => { S.novaConta = { papel:'miss', turma:'' }; ir('criar'); };

registrarTela('criar', () => {
  const n = S.novaConta || (S.novaConta = { papel:'miss', turma:'' });
  return `
  <div class="loginwrap">
    <div class="stack s18">
      <div class="stack s8 center">
        ${SEAL.replace('class="seal"','class="seal" style="width:46px;height:46px;margin:0 auto"')}
        <h1 style="font-size:19px">Criar conta</h1>
      </div>
      ${erroBloco()}
      <form class="card lift stack" onsubmit="app.submeterCriar(event)">
        <div class="field">
          <label for="c-nome">Nome completo</label>
          <input class="input" id="c-nome" autocapitalize="words" autocomplete="name" oninput="app.sugerir()">
        </div>
        <div class="field">
          <label for="c-login">Login</label>
          <input class="input" id="c-login" autocomplete="username" placeholder="nome.sobrenome" oninput="app.normaliza('c-login')">
        </div>
        <div class="field">
          <label for="c-senha">Senha</label>
          <input class="input" id="c-senha" type="password" autocomplete="new-password" oninput="app.checarSenha()">
          <div class="reqs" id="c-reqs">${listaReqs('')}</div>
        </div>
        <div class="field">
          <label for="c-senha2">Repetir a senha</label>
          <input class="input" id="c-senha2" type="password" autocomplete="new-password">
        </div>
        ${escolha({ id:'nc-papel', rotulo:'Sua função',
          opcoes:PAPEIS_CONTA.map(p => ({ valor:p.id, nome:p.nome })),
          valor:n.papel, aoEscolher:v => { n.papel = v; } })}
        ${turmasDisponiveis().length
          ? escolha({ id:'nc-turma', rotulo:'Turma', opcoes:turmasDisponiveis(),
              valor:n.turma, placeholder:'Escolher a turma',
              aoEscolher:v => { n.turma = n.turma === v ? '' : v; } })
          : `<p class="sec-label">Turma</p>
             <p class="fs12 muted" style="margin:0">A gestão definirá sua turma.</p>`}
        <button class="btn" type="submit" ${S.ocupado ? 'disabled' : ''}>${S.ocupado ? 'Enviando…' : 'Enviar para aprovação'}</button>
        <button class="btn ghost sm" type="button" style="width:100%" onclick="app.voltar()">Voltar</button>
      </form>
      ${rodape()}
    </div>
  </div>`;
});

function listaReqs(senha){
  return requisitosSenha(senha).map(r =>
    `<div class="req ${r.ok ? 'ok' : ''}"><span class="bx">${r.ok ? '&check;' : ''}</span>${esc(r.texto)}</div>`
  ).join('');
}

app.checarSenha = () => {
  const el = document.getElementById('c-reqs');
  if(el) el.innerHTML = listaReqs(val('c-senha'));
};

app.sugerir = () => {
  const el = document.getElementById('c-login');
  if(el && !el.dataset.tocado){
    const s = sugereLogin(val('c-nome'));
    if(s) el.value = s;
  }
};

/* Marca o login como editado à mão para parar de sobrescrever com a sugestão. */
document.addEventListener('input', ev => {
  if(ev.target && ev.target.id === 'c-login') ev.target.dataset.tocado = '1';
});


app.submeterCriar = async ev => {
  ev.preventDefault();
  const nome = tituloNome(val('c-nome'));
  const login = normalizaLogin(val('c-login'));
  const senha = val('c-senha'), senha2 = val('c-senha2');
  const n = S.novaConta || {};
  if(nome.split(/\s+/).filter(Boolean).length < 2) return erro('Informe o nome completo, com nome e sobrenome.');
  const eL = validaLogin(login); if(eL) return erro(eL);
  const eS = validaSenha(senha); if(eS) return erro(eS);
  if(senha !== senha2) return erro('As duas senhas não são iguais.');
  if(!criptoDisponivel()) return erro('Este navegador não oferece as funções de segurança necessárias. Abra o site por https.');
  S.ocupado = true; S.formErro = null; render();
  try {
    await Store.criarConta({ nome, login, senha, papel: n.papel || 'miss', turma: n.turma || null });
    S.ocupado = false; S.loginCriado = login; S.novaConta = null;
    ir('criado');
  } catch(err){
    erro(err.message || 'Não consegui criar a conta.');
  }
};

registrarTela('criado', () => `
  <div class="loginwrap">
    <div class="stack s18">
      <div class="stack s8 center">
        <div style="width:68px;height:68px;border-radius:50%;background:var(--accent-soft);display:grid;place-items:center;color:var(--accent-text);margin:0 auto">
          ${svgIc(ICON.ciencia).replace('<svg','<svg width="34" height="34"')}
        </div>
        <h1 style="font-size:19px">Conta enviada</h1>
        <p class="fs13 muted" style="margin:0 8px">
          <b>${esc(S.loginCriado || '')}</b> · aguardando aprovação da gestão
        </p>
      </div>
      ${S.modo === 'local' ? `<div class="notice info"><span class="ic">◆</span><div>
        <b>Modo local</b>: a conta existe só neste aparelho.</div></div>` : ''}
      <button class="btn" onclick="app.ir('entrada')">Voltar ao início</button>
      ${rodape()}
    </div>
  </div>`);

/* ---------------------------------------------------------------- biometria */
registrarTela('biometria', () => `
  <div class="loginwrap">
    <div class="stack s18">
      <div class="stack s8 center">
        <div style="width:68px;height:68px;border-radius:50%;background:var(--accent-soft);display:grid;place-items:center;color:var(--accent-text);margin:0 auto">
          ${svgIc(ICON.digital).replace('<svg','<svg width="34" height="34"')}
        </div>
        <h1 style="font-size:19px">Desbloqueio rápido</h1>
        <p class="fs12 muted" style="margin:0 10px">Entrar sem digitar a senha neste aparelho.</p>
      </div>
      <div class="card lift stack s8">
        <button class="btn" onclick="app.ativarBiometria(true)">Ativar neste aparelho</button>
        <button class="btn ghost" onclick="app.ativarBiometria(false)">Agora não</button>
      </div>
      ${rodape()}
    </div>
  </div>`);

app.ativarBiometria = async ativar => {
  const conta = S.contaPendenteBio;
  S.contaPendenteBio = null;
  if(ativar && conta) Store.lembrarAparelho(conta.login);
  if(conta) await autenticar(conta);
  else ir('entrada');
};

/* ---------------------------------------------------------------- configuração inicial */
registrarTela('configurar', () => `
  <div class="loginwrap">
    <div class="ringbg">${RINGBG}</div>
    <div class="stack s18" style="position:relative">
      ${cabecalhoMarca()}
      <div class="notice calm"><span class="ic">◆</span><div>
        <b>Configuração inicial.</b> Crie a primeira conta de gestão.
      </div></div>
      ${erroBloco()}
      <form class="card lift stack" onsubmit="app.submeterConfig(event)">
        <div class="field">
          <label for="g-nome">Nome completo</label>
          <input class="input" id="g-nome" autocapitalize="words" autocomplete="name" oninput="app.sugerirGestao()">
        </div>
        <div class="field">
          <label for="g-login">Login</label>
          <input class="input" id="g-login" autocomplete="username" placeholder="nome.sobrenome" oninput="app.normaliza('g-login')">
        </div>
        <div class="field">
          <label for="g-senha">Senha</label>
          <input class="input" id="g-senha" type="password" autocomplete="new-password" oninput="app.checarSenhaG()">
          <div class="reqs" id="g-reqs">${listaReqs('')}</div>
        </div>
        <div class="field">
          <label for="g-senha2">Repetir a senha</label>
          <input class="input" id="g-senha2" type="password" autocomplete="new-password">
        </div>
        ${S.modo === 'api' ? `
        <div class="field">
          <label for="g-codigo">Código de configuração</label>
          <input class="input" id="g-codigo" autocomplete="off">
          <p class="hint">Definido no servidor, em CODIGO_CONFIG.</p>
        </div>` : ''}
        <button class="btn" type="submit" ${S.ocupado ? 'disabled' : ''}>${S.ocupado ? 'Criando…' : 'Criar conta de gestão'}</button>
      </form>
      ${rodape()}
    </div>
  </div>`);

app.sugerirGestao = () => {
  const el = document.getElementById('g-login');
  if(el && !el.value) el.value = sugereLogin(val('g-nome'));
};
app.checarSenhaG = () => {
  const el = document.getElementById('g-reqs');
  if(el) el.innerHTML = listaReqs(val('g-senha'));
};

app.submeterConfig = async ev => {
  ev.preventDefault();
  const nome = tituloNome(val('g-nome')), login = normalizaLogin(val('g-login'));
  const senha = val('g-senha'), senha2 = val('g-senha2'), codigo = val('g-codigo');
  if(nome.split(/\s+/).filter(Boolean).length < 2) return erro('Informe o nome completo.');
  const eL = validaLogin(login); if(eL) return erro(eL);
  const eS = validaSenha(senha); if(eS) return erro(eS);
  if(senha !== senha2) return erro('As duas senhas não são iguais.');
  if(S.modo === 'api' && !codigo) return erro('Informe o código de configuração.');
  if(!criptoDisponivel()) return erro('Este navegador não oferece as funções de segurança necessárias. Abra o site por https.');
  S.ocupado = true; S.formErro = null; render();
  try {
    await Store.configurarPrimeiraGestao({ nome, login, senha, codigo });
    S.ocupado = false; S.precisaConfigurar = false;
    const conta = await Store.entrar(login, senha);
    S.contaPendenteBio = conta;
    ir('biometria');
  } catch(err){
    erro(err.message || 'Não consegui criar a conta de gestão.');
  }
};

/* ---------------------------------------------------------------- troca de senha obrigatória */
registrarTela('trocarSenha', () => `
  <div class="loginwrap">
    <div class="stack s18">
      <div class="stack s8 center">
        <h1 style="font-size:19px">Defina uma nova senha</h1>
        <p class="fs12 muted" style="margin:0 10px">Sua senha foi redefinida pela gestão.</p>
      </div>
      ${erroBloco()}
      <form class="card lift stack" onsubmit="app.submeterTroca(event)">
        <div class="field">
          <label for="t-senha">Nova senha</label>
          <input class="input" id="t-senha" type="password" autocomplete="new-password" oninput="app.checarSenhaT()">
          <div class="reqs" id="t-reqs">${listaReqs('')}</div>
        </div>
        <div class="field">
          <label for="t-senha2">Repetir a nova senha</label>
          <input class="input" id="t-senha2" type="password" autocomplete="new-password">
        </div>
        <button class="btn" type="submit">Salvar e continuar</button>
      </form>
    </div>
  </div>`);

app.checarSenhaT = () => {
  const el = document.getElementById('t-reqs');
  if(el) el.innerHTML = listaReqs(val('t-senha'));
};

app.submeterTroca = async ev => {
  ev.preventDefault();
  const senha = val('t-senha'), senha2 = val('t-senha2');
  const eS = validaSenha(senha); if(eS) return erro(eS);
  if(senha !== senha2) return erro('As duas senhas não são iguais.');
  try {
    await Store.trocarSenha(S.conta.login, senha);
    S.conta.trocarSenha = false;
    toast('Senha atualizada.');
    ir('home', { guardar:false });
  } catch(err){ erro(err.message || 'Não consegui trocar a senha.'); }
};

/* ---------------------------------------------------------------- minha conta */
/* A tela do perfil tinha quatro linhas de ficha técnica e quatro botões de mesmo
   peso. Três delas não diziam nada: "Perfil" repetia o rótulo logo abaixo do nome,
   "Aparelho: desbloqueio rápido ativo" repetia o botão que o desliga, e "Modo:
   compartilhado" era jargão sem ação possível — só o modo local é informação séria,
   e aí vira aviso.

   Agora são três grupos: o que é aparência, o que é deste aparelho e o que é da
   conta. Sair fica separado do resto, porque é a única ação sem volta. */
registrarTela('conta', () => {
  const c = S.conta, lembrado = Store.aparelhoLembrado(), tema = Store.tema();
  /* O nome da função, não o seu id: a tela mostrava "painel" onde a Gestão escreve
     "Painel de estatísticas". */
  const funcoes = (c.funcoes || [])
    .map(id => (FUNCOES.find(f => f.id === id) || {}).nome || id);
  return `<div class="stack s18">
    <div class="row">
      <div class="avatar" style="width:46px;height:46px;font-size:15px">${esc(c.ini)}</div>
      <div class="grow"><h1 style="font-size:17px">${esc(c.nome)}</h1>
        <p class="fs12 muted" style="margin:1px 0 0">${esc(c.login)} · ${esc(c.rotulo)}</p></div>
    </div>

    <div class="stack s8">
      <p class="sec-label" style="margin:0">Aparência</p>
      ${escolha({ id:'tema', opcoes:[
          { valor:'claro',   nome:'Claro',   ic:'sol' },
          { valor:'escuro',  nome:'Escuro',  ic:'lua' },
          { valor:'sistema', nome:'Sistema', ic:'sistema' }
        ], valor:tema, aoEscolher:v => app.tema(v) })}
    </div>

    <div class="stack s8">
      <p class="sec-label" style="margin:0">Este aparelho</p>
      <button class="switch" aria-pressed="${!!lembrado}"
        onclick="app.${lembrado ? 'revogarAparelho' : 'lembrarEste'}()">
        <span class="grow">
          <span style="display:block;font-size:13px;font-weight:600">Desbloqueio rápido</span>
          <span class="fs11 muted">Entrar sem digitar a senha neste aparelho</span>
        </span>
        <span class="track"></span>
      </button>
      ${S.modo === 'api' ? '' : `<div class="notice info">Sem servidor configurado: os
        registros ficam guardados só neste aparelho e ninguém mais os vê.</div>`}
    </div>

    <div class="stack s8">
      <p class="sec-label" style="margin:0">Conta</p>
      ${funcoes.length ? `<p class="fs12 muted" style="margin:-2px 0 2px">
        Funções concedidas: ${esc(funcoes.join(', '))}</p>` : ''}
      <button class="urow" onclick="app.ir('trocarSenha')">
        <span class="grow"><span class="lin-t">Trocar minha senha</span></span>
        <span class="ch" aria-hidden="true">&rsaquo;</span>
      </button>
      <button class="urow" onclick="app.ir('ajuda')">
        <span class="grow"><span class="lin-t">Como funciona</span></span>
        <span class="ch" aria-hidden="true">&rsaquo;</span>
      </button>
    </div>

    <button class="btn danger" onclick="app.sair()">Sair da conta</button>
    ${rodape()}
  </div>`;
});

/* Guardado no aparelho e aplicado na raiz. O index.html relê a mesma chave antes da
   pintura, para a próxima abertura já nascer no tema certo. */
app.tema = v => {
  Store.guardarTema(v);
  const raiz = document.documentElement;
  if(v === 'sistema') delete raiz.dataset.theme;
  else raiz.dataset.theme = v === 'escuro' ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]');
  if(m) m.content = raiz.dataset.theme === 'dark' ? '#101713' : '#00C5BB';
  render();
};

app.revogarAparelho = () => { Store.esquecerAparelho(); toast('Desbloqueio rápido desativado.'); render(); };
app.lembrarEste = () => { Store.lembrarAparelho(S.conta.login); toast('Desbloqueio rápido ativado.'); render(); };

/* ---------------------------------------------------------------- desbloqueio ao abrir */
registrarTela('desbloquear', () => {
  const l = Store.aparelhoLembrado();
  return `
  <div class="loginwrap">
    <div class="ringbg">${RINGBG}</div>
    <div class="stack s18" style="position:relative">
      ${cabecalhoMarca()}
      <div class="card lift stack s8 center">
        <div style="width:62px;height:62px;border-radius:50%;background:var(--accent-soft);display:grid;place-items:center;color:var(--accent-text);margin:0 auto">
          ${svgIc(ICON.digital).replace('<svg','<svg width="31" height="31"')}
        </div>
        <p class="fs13" style="margin:0">Entrar como <b>${esc(l ? l.login : '')}</b></p>
        <button class="btn" onclick="app.desbloquear()">Desbloquear</button>
        <button class="btn ghost sm" style="width:100%" onclick="app.usarOutra()">Entrar com outra conta</button>
      </div>
      ${rodape()}
    </div>
  </div>`;
});

app.desbloquear = async () => {
  const conta = await Store.retomarSessao();
  if(conta) return autenticar(conta);
  Store.esquecerAparelho();
  S.formErro = 'A sessão deste aparelho expirou. Entre com a sua senha.';
  ir('entrar');
};

app.usarOutra = () => { Store.esquecerAparelho(); Store.sair(); ir('entrada', { guardar:false }); };

export { senhaTemporaria };

/* ---------------------------------------------------------------- como funciona
   O que a interface deixou de explicar em cada botão fica aqui, num lugar só, para
   quem quiser consultar — fora do caminho de quem já sabe.

   Só entra o que o código cumpre. Ficaram de fora duas regras que o app anunciava e
   nunca teve: a trava de edição com adendos (não existe tela de edição nem de adendo)
   e o prazo de ciência que escalaria sozinho para a gestão (o prazo é uma etiqueta
   fixa, nunca recalculada, e não há escalonamento). */
registrarTela('ajuda', () => `
  <div class="stack s18">
    <div class="card flat">
      <dl class="kv">
        <dt>Quem vê</dt><dd>Cada Miss vê os registros que criou e os das crianças da sua turma. A gestão vê todos.</dd>
        <dt>Ciência</dt><dd>O registro segue para a Miss de cada turma envolvida e depois para a gestão.</dd>
        <dt>Rascunho</dt><dd>Salvo sozinho enquanto você preenche.</dd>
        <dt>Fotos</dt><dd>Apagadas em ${CONFIG.REGRAS.retencaoFotoDias} dias. Visíveis à cadeia de ciência e à gestão; todo acesso fica em log.</dd>
        <dt>Contas</dt><dd>A gestão aprova cada conta nova e define função e turma.</dd>
        <dt>Relatório</dt><dd>Três versões: sem identificar (padrão), para a família e de uso interno.</dd>
      </dl>
    </div>
    ${rodape()}
  </div>`);
