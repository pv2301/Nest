/* Estado, roteamento e render. As telas se registram aqui; nenhuma delas importa
   outra, o que evita dependência circular entre os módulos de tela. */

import { CONFIG } from '../../config.js';
import { Store, perfil, temFuncao } from './store.js';
import { esc, SEAL, ICON, svgIc, confRodape, iniciais } from './util.js';
import { quemVe, aguardaCiencia } from './regras.mjs';

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
  sincronizando: false, salvando: false, contagemDemo: null, confirmarLimpeza: false,
  heatCheio: false
};

/* Ações chamadas pelos onclick dos templates. Cada módulo de tela acrescenta as suas. */
export const app = {};
if(typeof window !== 'undefined') window.app = app;

const TELAS = {};
export function registrarTela(nome, fn){ TELAS[nome] = fn; }

/* Ganchos rodados depois de cada render (ex.: pintar o heatmap). */
export const posRender = [];

const SEM_CHROME = new Set(['entrada','entrar','criar','criado','biometria','configurar','trocarSenha','desbloquear','recuperar']);

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
  /* Com uma lista aberta, voltar fecha a lista em vez de sair da tela — é o que o
     voltar nativo do Android faz com qualquer menu aberto. A tabela em tela cheia
     entra na mesma cadeia, e antes: ela cobre tudo. */
  if(S.heatCheio){ S.heatCheio = false; return render(); }
  if(S.listaAberta){ S.listaAberta = null; return render(); }
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
    /* Quantos registros fictícios existem — a aba Alunos mostra antes de limpar. */
    if(S.conta.papel === 'gestao'){
      try { S.contagemDemo = await Store.contarDemo(); } catch { S.contagemDemo = null; }
    }
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
  /* O que o rollback precisa devolver. O rascunho entra aqui porque o `aplicar` do
     envio o descarta antes da gravação: sem isto, uma falha de rede levava embora
     tudo o que a pessoa tinha escrito, e a mensagem ainda dizia "tente de novo" sem
     haver com o que tentar. Reproduzido com a rede cortada antes de existir esta
     linha. */
  const antes = JSON.parse(JSON.stringify({ ocs: S.ocs, contas: S.contas, alunos: S.alunos, turmas: S.turmas }));
  const forma = { rascunho: S.rascunho, passo: S.passo, modo: S.modoRegistro,
                  editando: S.editando, tela: S.tela, pilha: S.pilha.slice(),
                  /* Também esta: o `aplicar` do envio zera a marca, e o autosave
                     reanunciava "Rascunho salvo" por cima da mensagem de erro. */
                  avisou: S.avisouRascunho };
  const rascunhoGravado = Store.rascunho();

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

    /* Sessão vencida é outro caso: continuar no formulário só produziria a mesma
       recusa a cada toque. Guarda o que foi escrito no aparelho, leva ao login, e o
       início oferece "Continuar registro" assim que a pessoa entrar de novo. */
    if(e.codigo === 'sessao'){
      if(forma.rascunho){
        Store.guardarRascunho({ rascunho: { ...forma.rascunho, fotoArquivo:undefined,
          fotoPreview:undefined, foto:false },
          passo: forma.passo, modo: forma.modo,
          login: S.conta ? S.conta.login : '', em: new Date().toISOString() });
      }
      sairDaConta();
      S.formErro = forma.rascunho
        ? 'A sessão expirou antes de enviar. O registro está guardado neste aparelho: entre de novo e continue de onde parou.'
        : 'A sessão expirou. Entre novamente.';
      return render();
    }

    /* Só quando havia um formulário em curso: as outras escritas otimistas (ciência,
       cadastro, turma) não têm rascunho e não devem ser levadas de volta a lugar
       nenhum. */
    if(forma.rascunho){
      S.rascunho = forma.rascunho; S.passo = forma.passo; S.modoRegistro = forma.modo;
      S.editando = forma.editando; S.pilha = forma.pilha; S.tela = forma.tela;
      S.avisouRascunho = forma.avisou;
      if(rascunhoGravado) Store.guardarRascunho(rascunhoGravado);
      render();
      toast('Não enviei: ' + (e.message || 'falha no servidor') + ' O que você escreveu está aqui.');
      return;
    }
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
/* Quatro abas, não sete. Com todas as funções concedidas a barra chegava a sete
   itens num aparelho de 430px: menos de 62px cada, rótulo de 10px cortando no meio.
   Tudo o que é administração passa a morar numa aba só. */
export function abas(){
  const c = S.conta; if(!c) return [];
  const t = [['home', ICON.home, 'Início'], ['lista', ICON.lista, 'Registros'],
             ['ciencia', ICON.ciencia, 'Ciência', filaDe(c).length]];
  if(entradasGestao(c).length)
    t.push(['gestao', ICON.mais, 'Gestão', c.papel === 'gestao' ? pendentes().length : 0]);
  return t;
}

/** O que a tela de Gestão reúne, conforme o perfil e as funções concedidas. Fica aqui
    porque a barra precisa saber se há alguma entrada antes de mostrar a aba. */
export function entradasGestao(c = S.conta){
  if(!c) return [];
  const e = [];
  /* Painel e Calendário eram duas entradas para o mesmo conjunto de dados. Hoje são
     guias de uma tela só, então o índice tem uma linha. */
  if(temFuncao(c, 'painel'))
    e.push({ tela:'visao', ic:ICON.painel, nome:'Visão geral',
             sub:'Destaques, calendário e estatísticas' });
  if(c.papel === 'gestao'){
    const ativos = S.alunos.filter(a => a.ativo !== false).length;
    e.push({ tela:'alunos', ic:ICON.alunos, nome:'Alunos e turmas',
             sub:`${ativos} ${ativos === 1 ? 'aluno' : 'alunos'} · ${S.turmas.length} ${S.turmas.length === 1 ? 'turma' : 'turmas'}` });
    const n = pendentes().length;
    e.push({ tela:'usuarios', ic:ICON.usuarios, nome:'Usuários', n,
             sub: n ? `${n} ${n === 1 ? 'conta aguardando' : 'contas aguardando'}` : `${S.contas.length} com acesso` });
    e.push({ tela:'auditoria', ic:ICON.lista, nome:'Auditoria',
             sub:'Tudo o que aconteceu, por quem e quando' });
    e.push({ tela:'removidos', ic:ICON.exportar, nome:'Registros removidos',
             sub:'Saíram de vista, continuam guardados' });
  }
  /* Quadro horário e Relações continuam no código, com as funções que as concedem,
     mas saem do índice até existirem de verdade: eram duas portas que não levavam a
     lugar nenhum. Religar é descomentar. */
  return e;
}

export const pendentes = () => S.contas.filter(c => c.status === 'pendente');

/** Aluno por id. Substitui a antiga constante KIDS: agora vem do cadastro da gestão. */
/* Nomes que sobreviveram ao cadastro.

   Quando a gestão remove um aluno, o servidor copia o nome dele para dentro de cada
   registro em que ele aparece, justamente para os registros antigos continuarem
   legíveis. Aqui esse nome é recolhido uma vez por lista de ocorrências, e não a
   cada chamada: aluno() é chamado dentro de laços, em toda lista e em todo
   relatório. */
let _ocsLidas = null, _arquivados = {};
function nomesArquivados(){
  if(_ocsLidas === S.ocs) return _arquivados;
  _ocsLidas = S.ocs;
  _arquivados = {};
  for(const o of S.ocs || [])
    for(const e of (o.envolvidos || []))
      if(e && e.nomeArquivado && !_arquivados[e.kid]) _arquivados[e.kid] = e.nomeArquivado;
  return _arquivados;
}

export function aluno(id){
  const a = S.alunos.find(x => x.id === id);
  if(a) return a;
  /* Sem cadastro, o nome preservado no registro. Só quando nem isso existe é que a
     tela admite não saber de quem se trata. */
  const nome = nomesArquivados()[id];
  return nome
    ? { id, nome, turma:'', ini: iniciais(nome), removido:true }
    : { id, nome:'(aluno removido)', turma:'', ini:'??', removido:true };
}
export const nomesTurmas = () => S.turmas.map(t => t.nome);

/** Registros aguardando a ciência desta pessoa. */
export function filaDe(u){
  return S.ocs.filter(o => aguardaCiencia(u, o));
}

export function meusRegistros(u){
  if(u.papel === 'gestao') return S.ocs;
  return S.ocs.filter(o => o.autorLogin === u.login);
}

/* A regra vive em regras.mjs, usada também pelo servidor: eram duas implementações
   que discordavam, e o navegador recebia registro que a tela escondia. */
export function visiveis(u){
  return S.ocs.filter(o => quemVe(u, o));
}

/* ---------- render ---------- */
function barraSuperior(){
  const c = S.conta;
  const titulos = {
    home:'Início', lista:'Registros', ciencia:'Ciência', painel:'Painel',
    horario:'Quadro horário', relacoes:'Relações', usuarios:'Usuários',
    novo:'Novo registro', rapido:'Registro rápido',
    wizard: S.editando ? 'Corrigir registro' : 'Registro completo',
    detalhe:'Ocorrência ' + (S.detalhe || ''), usuario:'Usuário',
    conta:'Minha conta', alunos:'Alunos e turmas', aluno:'Aluno', ficha:'Gerar relatório',
    ajuda:'Como funciona', gestao:'Gestão', calendario:'Calendário',
    visao:'Visão geral', auditoria:'Auditoria', removidos:'Registros removidos',
    recuperar:'Recuperar senha',
    turma:'Turma' + (S.turmaSel && S.turmaSel.nome ? ' ' + S.turmaSel.nome : '')
  };
  const comVoltar = ['detalhe','novo','rapido','wizard','usuario','conta','aluno','ficha','ajuda',
    'painel','alunos','usuarios','horario','relacoes','turma','calendario',
    'visao','auditoria','removidos'].includes(S.tela);
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
  /* Durante uma correção não se guarda rascunho: retomado depois, ele criaria um
     registro novo em vez de corrigir o que estava aberto. */
  if(S.editando) return;
  if(S.rascunho && (S.tela === 'wizard' || S.tela === 'rapido')){
    /* Confirmação momentânea, uma vez por preenchimento: antes um parágrafo fixo
       anunciava a cada tela que o rascunho estava sendo salvo. */
    if(!S.avisouRascunho){
      S.avisouRascunho = true;
      /* Fora do ciclo de desenho: toast() chama render(), e esta função roda dentro
         dele. */
      setTimeout(() => toast('Rascunho salvo'), 0);
    }
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
  S.rascunho = null; S.passo = 1; S.faltas = null; S.avisouRascunho = false;
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
