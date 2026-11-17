/* Camada de dados. Dois modos, uma única interface:
   - "local": tudo no localStorage deste aparelho. Funciona sem backend, mas o que é
     criado num celular não aparece em outro.
   - "api":   fala com o Apps Script (backend/Codigo.gs), que guarda na planilha. É o
     modo em que criar conta num aparelho e aprovar em outro funciona de verdade.

   O modo é escolhido por CONFIG.API_URL estar preenchido ou não. Nenhuma outra parte
   do app toca em armazenamento — quando o backend mudar, muda só este arquivo. */

import { CONFIG } from '../../config.js';
import { derivarChave, resumoLocal, carimbo, iniciais, primeiroNome } from './util.js';
import { DEMO_CONTAS, DEMO_OCORRENCIAS, SEMENTE_ALUNOS, SEMENTE_TURMAS } from './dados.js';

const K = { contas:'reg.contas', ocs:'reg.ocorrencias', sessao:'reg.sessao',
            aparelho:'reg.aparelho', alunos:'reg.alunos', turmas:'reg.turmas',
            rascunho:'reg.rascunho' };

/* localStorage pode lançar (janela anônima, dados bloqueados): nunca deixar quebrar. */
const memoria = {};
const LS = {
  ler(k, padrao){
    try { const v = localStorage.getItem(k); return v === null ? padrao : JSON.parse(v); }
    catch { return k in memoria ? memoria[k] : padrao; }
  },
  gravar(k, v){
    memoria[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  },
  apagar(k){
    delete memoria[k];
    try { localStorage.removeItem(k); } catch {}
  }
};

export class ErroStore extends Error {
  constructor(mensagem, codigo){ super(mensagem); this.codigo = codigo || 'erro'; }
}

const temApi = () => !!(CONFIG.API_URL && CONFIG.API_URL.trim());

/* Apps Script não responde a preflight CORS. Enviando como text/plain a requisição
   vira "simples" e passa direto; o servidor lê e.postData.contents como JSON. */
async function api(acao, dados){
  let resposta;
  try {
    resposta = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao, token: LS.ler(K.sessao, {}).token || '', dados: dados || {} }),
      redirect: 'follow'
    });
  } catch {
    throw new ErroStore('Não consegui falar com o servidor. Verifique a conexão.', 'rede');
  }
  let json;
  try { json = await resposta.json(); }
  catch { throw new ErroStore('O servidor respondeu em formato inesperado. Confira a URL do Apps Script.', 'resposta'); }
  if(!json || json.ok !== true) throw new ErroStore((json && json.erro) || 'Falha no servidor.', (json && json.codigo) || 'erro');
  return json.dados;
}

/* ---------- contas locais ---------- */
const contasLocais = () => LS.ler(K.contas, []);
const gravarContasLocais = cs => LS.gravar(K.contas, cs);

function publica(c){
  if(!c) return null;
  const { resumo, ...resto } = c;
  return resto;
}

export const Store = {
  modo(){ return temApi() ? 'api' : 'local'; },

  /** Chamado ANTES do login. Diz se falta configurar e entrega as turmas, que a
      tela de cadastro precisa para a pessoa escolher a sua. */
  async estado(){
    if(temApi()) return await api('estado');
    return {
      precisaConfigurar: !contasLocais().some(c => c.papel === 'gestao' && c.status === 'ativo'),
      turmas: LS.ler(K.turmas, [])
    };
  },

  /* ---------- sessão neste aparelho ---------- */
  sessao(){ return LS.ler(K.sessao, null); },
  guardarSessao(s){ LS.gravar(K.sessao, s); },
  sair(){ LS.apagar(K.sessao); },

  aparelhoLembrado(){ return LS.ler(K.aparelho, null); },
  lembrarAparelho(login){ LS.gravar(K.aparelho, { login, desde: carimbo() }); },
  esquecerAparelho(){ LS.apagar(K.aparelho); },

  /* ---------- autenticação ---------- */

  /** Cria a primeira conta de gestão. No modo api exige o código definido no deploy. */
  async configurarPrimeiraGestao({ nome, login, senha, codigo }){
    const chave = await derivarChave(senha, login);
    if(temApi()){
      const conta = await api('configurar', { nome, login, chave, codigo });
      return conta;
    }
    const cs = contasLocais();
    if(cs.some(c => c.login === login)) throw new ErroStore('Esse login já existe neste aparelho.', 'duplicado');
    const conta = {
      login, nome, papel:'gestao', turma:null,
      /* Só o painel por padrão: horário e relações são concedidos quando as telas
         existirem, para não ocuparem lugar na barra de abas desde já. */
      funcoes:['painel'],
      status:'ativo', resumo: await resumoLocal(chave),
      criadoEm: carimbo(), aprovadoPor:'(configuração inicial)', aprovadoEm: carimbo()
    };
    cs.push(conta); gravarContasLocais(cs);
    return publica(conta);
  },

  async entrar(login, senha){
    const chave = await derivarChave(senha, login);
    if(temApi()){
      const r = await api('entrar', { login, chave });
      LS.gravar(K.sessao, { token: r.token, login: r.conta.login });
      return r.conta;
    }
    const conta = contasLocais().find(c => c.login === login);
    if(!conta) throw new ErroStore('Login ou senha incorretos.', 'credenciais');
    if(conta.resumo !== await resumoLocal(chave)) throw new ErroStore('Login ou senha incorretos.', 'credenciais');
    if(conta.status === 'pendente') throw new ErroStore('Sua conta ainda está aguardando aprovação da gestão.', 'pendente');
    if(conta.status === 'recusado') throw new ErroStore('Este cadastro não foi aprovado. Procure a coordenação.', 'recusado');
    if(conta.status !== 'ativo') throw new ErroStore('Esta conta está desativada. Procure a coordenação.', 'inativo');
    LS.gravar(K.sessao, { token:'local', login });
    return publica(conta);
  },

  async criarConta({ nome, login, senha, papel, turma }){
    const chave = await derivarChave(senha, login);
    if(temApi()) return await api('criarConta', { nome, login, chave, papel, turma });
    const cs = contasLocais();
    if(cs.some(c => c.login === login)) throw new ErroStore('Esse login já está em uso. Escolha outro.', 'duplicado');
    const conta = {
      login, nome, papel: papel === 'gestao' ? 'gestao' : 'miss', turma: turma || null,
      funcoes: [], status:'pendente', resumo: await resumoLocal(chave), criadoEm: carimbo()
    };
    cs.push(conta); gravarContasLocais(cs);
    return publica(conta);
  },

  /** Confere o token do aparelho e devolve a conta, ou null. */
  async retomarSessao(){
    const s = this.sessao();
    if(!s || !s.login) return null;
    try {
      if(temApi()) return await api('eu');
      const c = contasLocais().find(x => x.login === s.login && x.status === 'ativo');
      return c ? publica(c) : null;
    } catch { return null; }
  },

  async trocarSenha(login, senhaNova){
    const chave = await derivarChave(senhaNova, login);
    if(temApi()) return await api('trocarSenha', { login, chave });
    const cs = contasLocais(); const c = cs.find(x => x.login === login);
    if(!c) throw new ErroStore('Conta não encontrada.', 'inexistente');
    c.resumo = await resumoLocal(chave); delete c.trocarSenha;
    gravarContasLocais(cs);
  },

  /** Tudo numa ida só. Cada chamada custa ~2,5s no Apps Script, então buscar as
      cinco coleções separadamente custava mais de 12 segundos por sincronização. */
  async sincronizar(){
    if(temApi()) return await api('sincronizar');
    const contas = contasLocais();
    const eu = this.sessao();
    const minha = eu ? contas.find(c => c.login === eu.login) : null;
    return {
      conta: publica(minha),
      ocorrencias: LS.ler(K.ocs, []),
      diretorio: contas.filter(c => c.status === 'ativo')
        .map(c => ({ login:c.login, nome:c.nome, papel:c.papel, turma:c.turma, status:c.status })),
      alunos: LS.ler(K.alunos, []),
      turmas: LS.ler(K.turmas, []),
      contas: minha && minha.papel === 'gestao' ? contas.map(publica) : []
    };
  },

  /* ---------- rascunho do formulário ----------
     Fica no aparelho: é trabalho em andamento, não registro. Sem isto, fechar a aba
     no meio do preenchimento perde tudo. */
  rascunho(){ return LS.ler(K.rascunho, null); },
  guardarRascunho(r){ LS.gravar(K.rascunho, r); },
  descartarRascunho(){ LS.apagar(K.rascunho); },

  /** Lista enxuta do pessoal ativo (nome, papel, turma), para rotear a cadeia de
      ciência. Qualquer pessoa autenticada pode ler: não traz situação nem senha. */
  async diretorio(){
    if(temApi()) return await api('diretorio');
    return contasLocais()
      .filter(c => c.status === 'ativo')
      .map(c => ({ login:c.login, nome:c.nome, papel:c.papel, turma:c.turma, status:c.status }));
  },

  /* ---------- gestão de usuários ---------- */
  async contas(){
    if(temApi()) return await api('contas');
    return contasLocais().map(publica);
  },

  async atualizarConta(login, patch){
    if(temApi()) return await api('atualizarConta', { login, patch });
    const cs = contasLocais(); const c = cs.find(x => x.login === login);
    if(!c) throw new ErroStore('Conta não encontrada.', 'inexistente');
    Object.assign(c, patch); gravarContasLocais(cs);
    return publica(c);
  },

  /** Devolve a senha temporária, mostrada uma única vez. */
  async redefinirSenha(login, senhaTemp){
    const chave = await derivarChave(senhaTemp, login);
    if(temApi()) return await api('redefinirSenha', { login, chave });
    const cs = contasLocais(); const c = cs.find(x => x.login === login);
    if(!c) throw new ErroStore('Conta não encontrada.', 'inexistente');
    c.resumo = await resumoLocal(chave); c.trocarSenha = true;
    gravarContasLocais(cs);
  },

  /* ---------- alunos e turmas ----------
     Antes eram constantes no código. Agora são dados que a gestão mantém: sem isso,
     uma criança nova obriga a mexer no repositório. Qualquer pessoa autenticada LÊ
     (precisa, para registrar); só a gestão escreve — o backend é quem impõe isso. */

  async alunos(){
    if(temApi()) return await api('alunos');
    return LS.ler(K.alunos, []);
  },

  async salvarAluno(aluno){
    if(temApi()) return await api('salvarAluno', { aluno });
    const as = LS.ler(K.alunos, []);
    const i = as.findIndex(a => a.id === aluno.id);
    if(i >= 0) as[i] = { ...as[i], ...aluno }; else as.push(aluno);
    LS.gravar(K.alunos, as);
    return aluno;
  },

  async arquivarAluno(id, arquivar = true){
    if(temApi()) return await api('salvarAluno', { aluno: { id, ativo: !arquivar } });
    const as = LS.ler(K.alunos, []);
    const a = as.find(x => x.id === id);
    if(a){ a.ativo = !arquivar; LS.gravar(K.alunos, as); }
    return a;
  },

  async turmas(){
    if(temApi()) return await api('turmas');
    return LS.ler(K.turmas, []);
  },

  async salvarTurma(turma){
    if(temApi()) return await api('salvarTurma', { turma });
    const ts = LS.ler(K.turmas, []);
    const i = ts.findIndex(t => t.id === turma.id);
    if(i >= 0) ts[i] = { ...ts[i], ...turma }; else ts.push(turma);
    LS.gravar(K.turmas, ts);
    return turma;
  },

  async removerTurma(id){
    if(temApi()) return await api('removerTurma', { id });
    LS.gravar(K.turmas, LS.ler(K.turmas, []).filter(t => t.id !== id));
  },

  /* ---------- ocorrências ---------- */
  async ocorrencias(){
    if(temApi()) return await api('ocorrencias');
    return LS.ler(K.ocs, []);
  },

  async salvarOcorrencia(oc){
    if(temApi()) return await api('salvarOcorrencia', { ocorrencia: oc });
    const os = LS.ler(K.ocs, []);
    const i = os.findIndex(x => x.id === oc.id);
    if(i >= 0) os[i] = oc; else os.unshift(oc);
    LS.gravar(K.ocs, os);
    return oc;
  },

  /* ---------- dados de demonstração ---------- */
  async carregarDemo(){
    if(temApi()) return await api('carregarDemo');
    const cs = contasLocais();
    for(const d of DEMO_CONTAS) if(!cs.some(c => c.login === d.login)) cs.push({ ...d, demo:true });
    gravarContasLocais(cs);

    const ts = LS.ler(K.turmas, []);
    for(const t of SEMENTE_TURMAS) if(!ts.some(x => x.nome === t.nome)) ts.push({ ...t, demo:true });
    LS.gravar(K.turmas, ts);

    const as = LS.ler(K.alunos, []);
    for(const a of SEMENTE_ALUNOS) if(!as.some(x => x.id === a.id)) as.push({ ...a, demo:true });
    LS.gravar(K.alunos, as);

    const os = LS.ler(K.ocs, []);
    for(const o of DEMO_OCORRENCIAS) if(!os.some(x => x.id === o.id)) os.push({ ...o, demo:true });
    os.sort((a,b) => String(b.quandoISO || '').localeCompare(String(a.quandoISO || '')));
    LS.gravar(K.ocs, os);
  },

  async limparDemo(){
    if(temApi()) return await api('limparDemo');
    gravarContasLocais(contasLocais().filter(c => !c.demo));
    LS.gravar(K.ocs, LS.ler(K.ocs, []).filter(o => !o.demo));
    LS.gravar(K.alunos, LS.ler(K.alunos, []).filter(a => !a.demo));
    LS.gravar(K.turmas, LS.ler(K.turmas, []).filter(t => !t.demo));
  },

  /** Apaga tudo deste aparelho. Só no modo local. */
  reiniciarAparelho(){
    Object.values(K).forEach(LS.apagar);
  }
};

/** Enriquece a conta com campos de exibição que o app usa em várias telas. */
export function perfil(conta){
  if(!conta) return null;
  const rotulos = { miss:'Miss', gestao:'Gestão' };
  const base = rotulos[conta.papel] || conta.papel;
  return {
    ...conta,
    curto: primeiroNome(conta.nome),
    ini: iniciais(conta.nome),
    rotulo: base + (conta.turma ? ' · Turma ' + conta.turma : (conta.papel === 'gestao' ? ' · Coordenação' : '')),
    funcoes: conta.funcoes || []
  };
}

/** Uma função está disponível? Gestão tem o painel por padrão. */
export function temFuncao(conta, f){
  if(!conta) return false;
  if(f === 'painel' && conta.papel === 'gestao') return true;
  return (conta.funcoes || []).includes(f);
}
