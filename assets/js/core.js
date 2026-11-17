/* Estado, roteamento e render. As telas se registram aqui; nenhuma delas importa
   outra, o que evita dependência circular entre os módulos de tela. */

import { CONFIG } from '../../config.js';
import { Store, perfil, temFuncao } from './store.js';
import { esc, SEAL, ICON, svgIc, confRodape } from './util.js';

export { temFuncao };

export const S = {
  pronto: false,
  modo: 'local',
  precisaConfigurar: false,
  conta: null,              // perfil autenticado
  escola: { ...CONFIG.ESCOLA },
  tela: 'entrada',
  pilha: [],
  contas: [],
  diretorio: [],
  alunos: [],
  turmas: [],
  ocs: [],
  periodo: 'mes',
  buscaAluno: '',
  filtroTurma: '',
  rascunho: null, passo: 1, modoRegistro: null,
  detalhe: null, usuarioSel: null,
  formErro: null, ocupado: false, toastMsg: null,
  sincronizando: false, salvando: false
};

/* Ações chamadas pelos onclick dos templates. Cada módulo de tela acrescenta as suas. */
export const app = {};
if(typeof window !== 'undefined') window.app = app;

const TELAS = {};
export function registrarTela(nome, fn){ TELAS[nome] = fn; }

/* Ganchos rodados depois de cada render (ex.: pintar o heatmap). */
export const posRender = [];

const SEM_CHROME = new Set(['entrada','entrar','criar','criado','biometria','configurar','trocarSenha','desbloquear']);

/* ---------- navegação ----------
   O histórico do navegador acompanha a navegação interna, para o gesto de voltar do
   Android (deslizar da borda) e o botão do navegador funcionarem. A URL não muda: só
   entram entradas no histórico, senão recarregar a página cairia num caminho que o
   GitHub Pages não serve.

   Regra para botão e gesto não se desencontrarem: o botão da tela pede history.back()
   e quem navega de fato é sempre o popstate. */

let profundidade = 0;

function empilhar(){
  try { history.pushState({ app:true }, '', location.href); profundidade++; } catch {}
}

export function ir(tela, { guardar = true } = {}){
  if(guardar && S.tela && S.tela !== tela){
    S.pilha.push(S.tela);
    empilhar();
  }
  S.tela = tela;
  S.formErro = null;
  const sc = document.getElementById('scroll');
  if(sc) sc.scrollTop = 0;
  render();
}

/** Avança um passo do wizard, deixando rastro no histórico para o gesto voltar um a um. */
export function avancarPasso(){
  S.passo = Math.min(4, S.passo + 1);
  S.faltas = null;
  empilhar();
  const sc = document.getElementById('scroll');
  if(sc) sc.scrollTop = 0;
  render();
}

/** Navegação real. Chamada pelo popstate — e diretamente só quando não há histórico. */
export function voltar(){
  if(S.tela === 'wizard' && S.passo > 1){
    S.passo--;
    S.faltas = null;
    const sc0 = document.getElementById('scroll');
    if(sc0) sc0.scrollTop = 0;
    return render();
  }
  const anterior = S.pilha.pop();
  S.tela = anterior || (S.conta ? 'home' : 'entrada');
  S.formErro = null;
  const sc = document.getElementById('scroll');
  if(sc) sc.scrollTop = 0;
  render();
}

/** O que o botão '‹' da tela chama. Delega ao histórico para não dessincronizar. */
export function voltarUI(){
  if(profundidade > 0) history.back();
  else voltar();
}

if(typeof window !== 'undefined'){
  window.addEventListener('popstate', () => {
    if(profundidade > 0) profundidade--;
    voltar();
  });
}

let tToast;
export function toast(msg){
  S.toastMsg = msg;
  render();
  clearTimeout(tToast);
  /* Só remove o aviso da tela. Re-renderizar aqui apagaria o que a pessoa estivesse
     digitando no instante em que o tempo acabasse — foi assim que um cadastro perdeu
     o nome já preenchido. */
  tToast = setTimeout(() => {
    S.toastMsg = null;
    document.querySelectorAll('.toast').forEach(t => t.remove());
  }, 3000);
}

export function erroForm(msg){ S.formErro = msg; render(); }

/* ---------- carregamento de dados ---------- */
/* Uma única ida ao servidor. Antes eram quatro ou cinco em sequência, a ~2,5s cada:
   mais de 12 segundos depois de qualquer ação. */
export async function recarregar({ silencioso = false } = {}){
  if(!S.conta) return;
  if(!silencioso){ S.sincronizando = true; render(); }
  try {
    const d = await Store.sincronizar();
    S.ocs = d.ocorrencias || [];
    S.diretorio = d.diretorio || [];
    S.alunos = d.alunos || [];
    S.turmas = d.turmas || [];
    S.contas = d.contas || [];
    if(d.conta) S.conta = perfil({ ...S.conta, ...d.conta });
  } catch(e){
    toast(e.message || 'Não consegui falar com o servidor.');
  } finally {
    S.sincronizando = false;
    if(!silencioso) render();
  }
}

/* Aplica a mudança na hora e grava atrás. Os 2,5s do servidor continuam existindo,
   mas deixam de ser espera: é a diferença entre "travou" e "é rápido".
   Se a gravação falhar, desfaz e explica. */
export async function otimista(aplicar, gravar, msgOk){
  const antes = JSON.parse(JSON.stringify({ ocs: S.ocs, contas: S.contas, alunos: S.alunos, turmas: S.turmas }));
  aplicar();
  S.salvando = true;
  render();
  try {
    await gravar();
    S.salvando = false;
    if(msgOk) toast(msgOk); else render();
  } catch(e){
    S.ocs = antes.ocs; S.contas = antes.contas; S.alunos = antes.alunos; S.turmas = antes.turmas;
    S.salvando = false;
    toast('Não foi salvo: ' + (e.message || 'falha no servidor') + '. Tente de novo.');
  }
}

export async function autenticar(conta){
  S.conta = perfil(conta);
  await recarregar();
  S.pilha = [];
  S.tela = conta.trocarSenha ? 'trocarSenha' : 'home';
  render();
}

export function sairDaConta(){
  Store.sair();
  S.conta = null; S.contas = []; S.ocs = []; S.pilha = []; S.rascunho = null;
  S.tela = 'entrada';
  render();
}
app.sair = sairDaConta;

/* ---------- abas ---------- */
export function abas(){
  const c = S.conta; if(!c) return [];
  const t = [['home', ICON.home, 'Início'], ['lista', ICON.lista, 'Registros']];
  t.push(['ciencia', ICON.ciencia, 'Ciência', filaDe(c).length]);
  if(temFuncao(c, 'painel'))   t.push(['painel', ICON.painel, 'Painel']);
  if(temFuncao(c, 'horario'))  t.push(['horario', ICON.horario, 'Horário']);
  if(temFuncao(c, 'relacoes')) t.push(['relacoes', ICON.relacoes, 'Relações']);
  if(c.papel === 'gestao')     t.push(['alunos', ICON.alunos, 'Alunos']);
  if(c.papel === 'gestao')     t.push(['usuarios', ICON.usuarios, 'Usuários', pendentes().length]);
  return t;
}

export const pendentes = () => S.contas.filter(c => c.status === 'pendente');

/** Aluno por id. Substitui a antiga constante KIDS: agora vem do cadastro da gestão. */
export function aluno(id){
  return S.alunos.find(a => a.id === id) || { id, nome:'(aluno removido)', turma:'', ini:'??' };
}
export const nomesTurmas = () => S.turmas.map(t => t.nome);

/** Registros aguardando a ciência desta pessoa. */
export function filaDe(u){
  return S.ocs.filter(o => {
    const n = (o.chain || []).find(c => c.st === 'now');
    if(!n) return false;
    if(u.papel === 'gestao') return n.nivel.startsWith('Gestão');
    if(u.papel === 'miss')   return !!u.turma && n.nivel.includes(u.turma);
    return false;
  });
}

export function meusRegistros(u){
  if(u.papel === 'gestao') return S.ocs;
  return S.ocs.filter(o => o.autorLogin === u.login);
}

export function visiveis(u){
  if(u.papel === 'gestao') return S.ocs;
  const fila = filaDe(u).map(o => o.id);
  return S.ocs.filter(o =>
    o.autorLogin === u.login ||
    fila.includes(o.id) ||
    (u.papel === 'miss' && !!u.turma && (o.chain || []).some(c => c.nivel.includes(u.turma) && c.st === 'ok'))
  );
}

/* ---------- render ---------- */
function barraSuperior(){
  const c = S.conta;
  const titulos = {
    home:'Início', lista:'Registros', ciencia:'Ciência', painel:'Painel',
    horario:'Quadro horário', relacoes:'Relações', usuarios:'Usuários',
    novo:'Novo registro', rapido:'Registro rápido', wizard:'Registro completo',
    detalhe:'Ocorrência ' + (S.detalhe || ''), usuario:'Usuário', crianca:'Ficha da criança',
    conta:'Minha conta', alunos:'Alunos e turmas', aluno:'Aluno', ficha:'Exportar ficha'
  };
  const comVoltar = ['detalhe','novo','rapido','wizard','usuario','crianca','conta','aluno','ficha'].includes(S.tela);
  const esquerda = comVoltar
    ? `<button class="back" onclick="app.voltar()" aria-label="Voltar">&lsaquo;</button>`
    : `<button class="avatar" onclick="app.ir('conta')" title="${esc(c.nome)}">${esc(c.ini)}</button>`;
  const titulo = comVoltar
    ? `<div class="grow"><h2>${esc(titulos[S.tela] || '')}</h2></div>`
    : `<div class="grow"><h2>${esc(c.curto)}</h2><div class="sub">${esc(c.rotulo)}</div></div>`;
  return `<div class="appbar">${esquerda}${titulo}<div style="margin-left:auto;flex:none">${SEAL}</div></div>`
       + (S.tela === 'wizard' ? `<div class="steps">${[1,2,3,4].map(i=>`<i class="${i<=S.passo?'on':''}"></i>`).join('')}</div>` : '');
}

function barraInferior(){
  return `<div class="tabbar">${abas().map(([k, ic, lab, n]) => `
    <button onclick="app.ir('${k}')" ${S.tela === k ? 'aria-current="page"' : ''}>
      <span class="ic">${svgIc(ic)}</span><span>${esc(lab)}${n ? `<span class="cnt">${n}</span>` : ''}</span>
    </button>`).join('')}</div>`;
}

function faixaModo(){
  /* Com ~2,5s de servidor, sem aviso o app parece travado. */
  if(S.salvando)      return `<div class="modebar trabalho"><span class="girando"></span>Salvando…</div>`;
  if(S.sincronizando) return `<div class="modebar trabalho"><span class="girando"></span>Atualizando…</div>`;
  if(S.modo === 'api') return '';
  return `<div class="modebar">Modo local · dados só neste aparelho</div>`;
}

export function rodape(){ return confRodape(S.escola.nome); }

export function render(){
  const chrome = document.getElementById('chrome');
  const view = document.getElementById('view');
  const tabs = document.getElementById('tabs');
  const faixa = document.getElementById('faixa');
  if(!view) return;

  const fn = TELAS[S.tela] || TELAS.entrada;
  const logada = !!S.conta && !SEM_CHROME.has(S.tela);

  /* Redesenhar troca o HTML inteiro, o que zerava os campos: mostrar um erro fazia a
     pessoa perder tudo o que tinha digitado. Guardamos o que estava escrito e
     devolvemos aos campos que voltaram vazios, desde que seja a mesma tela. */
  const digitado = {};
  view.querySelectorAll('input[id], textarea[id]').forEach(el => {
    if(el.type !== 'file') digitado[el.id] = el.value;
  });
  const telaAnterior = S.telaDesenhada;

  faixa.innerHTML = faixaModo();
  chrome.innerHTML = logada ? barraSuperior() : '';
  view.innerHTML = fn ? fn() : '';
  tabs.innerHTML = logada ? barraInferior() : '';

  if(telaAnterior === S.tela){
    view.querySelectorAll('input[id], textarea[id]').forEach(el => {
      if(el.type !== 'file' && el.value === '' && digitado[el.id] !== undefined) el.value = digitado[el.id];
    });
  }
  S.telaDesenhada = S.tela;

  document.querySelectorAll('.toast').forEach(t => t.remove());
  if(S.toastMsg){
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = S.toastMsg;
    document.body.appendChild(d);
  }
  posRender.forEach(f => { try { f(); } catch(e){ console.error(e); } });
  guardarRascunho();
}

/* Grava o rascunho a cada redesenho enquanto o formulário está aberto: fechar a aba
   no meio do preenchimento deixava de perder tudo. */
function guardarRascunho(){
  if(!S.conta) return;
  if(S.rascunho && (S.tela === 'wizard' || S.tela === 'rapido')){
    /* O arquivo e a URL temporária da foto não sobrevivem ao JSON nem ao recarregar:
       guardamos o resto e a pessoa escolhe a imagem de novo, se for o caso. */
    const { fotoArquivo, fotoPreview, ...semArquivo } = S.rascunho;
    Store.guardarRascunho({
      rascunho: { ...semArquivo, foto:false },
      passo: S.passo, modo: S.modoRegistro,
      login: S.conta.login, em: new Date().toISOString()
    });
  }
}

/** Retoma o rascunho guardado neste aparelho, se for desta pessoa. */
export function rascunhoGuardado(){
  const r = Store.rascunho();
  if(!r || !S.conta || r.login !== S.conta.login) return null;
  return r;
}

export function descartarRascunho(){
  Store.descartarRascunho();
  S.rascunho = null; S.passo = 1; S.faltas = null;
  render();
}
app.descartarRascunho = descartarRascunho;

app.retomarRascunho = () => {
  const r = rascunhoGuardado();
  if(!r) return;
  S.rascunho = r.rascunho; S.passo = r.passo || 1; S.modoRegistro = r.modo || 'completo';
  ir(S.modoRegistro === 'rapido' ? 'rapido' : 'wizard');
};

app.ir = ir;
app.voltar = voltarUI;
app.render = render;
