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
  formErro: null, ocupado: false, toastMsg: null
};

/* Ações chamadas pelos onclick dos templates. Cada módulo de tela acrescenta as suas. */
export const app = {};
if(typeof window !== 'undefined') window.app = app;

const TELAS = {};
export function registrarTela(nome, fn){ TELAS[nome] = fn; }

/* Ganchos rodados depois de cada render (ex.: pintar o heatmap). */
export const posRender = [];

const SEM_CHROME = new Set(['entrada','entrar','criar','criado','biometria','configurar','trocarSenha','desbloquear']);

/* ---------- navegação ---------- */
export function ir(tela, { guardar = true } = {}){
  if(guardar && S.tela && S.tela !== tela) S.pilha.push(S.tela);
  S.tela = tela;
  S.formErro = null;
  const sc = document.getElementById('scroll');
  if(sc) sc.scrollTop = 0;
  render();
}

export function voltar(){
  const anterior = S.pilha.pop();
  S.tela = anterior || (S.conta ? 'home' : 'entrada');
  S.formErro = null;
  const sc = document.getElementById('scroll');
  if(sc) sc.scrollTop = 0;
  render();
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
export async function recarregar(){
  if(!S.conta) return;
  try {
    S.ocs = await Store.ocorrencias();
    S.diretorio = await Store.diretorio();
    S.alunos = await Store.alunos();
    S.turmas = await Store.turmas();
    if(S.conta.papel === 'gestao') S.contas = await Store.contas();
  } catch(e){
    toast(e.message || 'Não consegui carregar os dados.');
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
  if(c.papel !== 'assistente') t.push(['ciencia', ICON.ciencia, 'Ciência', filaDe(c).length]);
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
       + (S.tela === 'wizard' ? `<div class="steps">${[1,2,3,4,5].map(i=>`<i class="${i<=S.passo?'on':''}"></i>`).join('')}</div>` : '');
}

function barraInferior(){
  return `<div class="tabbar">${abas().map(([k, ic, lab, n]) => `
    <button onclick="app.ir('${k}')" ${S.tela === k ? 'aria-current="page"' : ''}>
      <span class="ic">${svgIc(ic)}</span><span>${esc(lab)}${n ? `<span class="cnt">${n}</span>` : ''}</span>
    </button>`).join('')}</div>`;
}

function faixaModo(){
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

  faixa.innerHTML = faixaModo();
  chrome.innerHTML = logada ? barraSuperior() : '';
  view.innerHTML = fn ? fn() : '';
  tabs.innerHTML = logada ? barraInferior() : '';

  document.querySelectorAll('.toast').forEach(t => t.remove());
  if(S.toastMsg){
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = S.toastMsg;
    document.body.appendChild(d);
  }
  posRender.forEach(f => { try { f(); } catch(e){ console.error(e); } });
}

app.ir = ir;
app.voltar = voltar;
app.render = render;
