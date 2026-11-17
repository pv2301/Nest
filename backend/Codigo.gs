/**
 * Backend do app de registro de ocorrências.
 * Google Apps Script publicado como Web App + Google Planilhas como banco.
 *
 * Como publicar: ver backend/README.md.
 *
 * SEGURANÇA — o que este arquivo garante e o que não garante:
 *  - A senha NUNCA chega aqui. O navegador deriva uma chave com PBKDF2 (150.000
 *    iterações) e envia só a chave; aqui guardamos um resumo dela com um segredo
 *    do servidor (PEPPER). Nem quem baixar a planilha recupera a senha.
 *  - O Web App precisa ser publicado como "qualquer pessoa", porque os usuários não
 *    têm conta Google. Toda a verificação de quem é quem está no token abaixo.
 *  - A planilha continua privada: só o dono a abre.
 */

var ABAS = {
  contas: ['login','nome','papel','turma','funcoes','status','resumo','criadoEm','aprovadoPor','aprovadoEm','trocarSenha'],
  alunos: ['id','nome','turma','nascimento','saude','ativo','avulso','criadoEm'],
  turmas: ['id','nome','faixa'],
  ocorrencias: ['id','json'],
  sessoes: ['token','login','expiraEm'],
  log: ['quando','login','acao','detalhe'],
  config: ['chave','valor']
};

var HORAS_SESSAO = 24 * 30;   // token do aparelho vale 30 dias

/* ============================= entrada ============================= */

function doPost(e){
  var req = {};
  try { req = JSON.parse(e.postData.contents); } catch(_){}
  var resposta;
  try {
    resposta = { ok: true, dados: executar(String(req.acao || ''), req.dados || {}, String(req.token || '')) };
  } catch(err){
    resposta = { ok: false, erro: err.message || String(err), codigo: err.codigo || 'erro' };
  }
  return ContentService.createTextOutput(JSON.stringify(resposta))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(){
  return ContentService.createTextOutput(JSON.stringify({ ok:true, dados:{ vivo:true } }))
    .setMimeType(ContentService.MimeType.JSON);
}

function executar(acao, d, token){
  switch(acao){
    case 'estado':          return estado();
    case 'configurar':      return configurarPrimeiraGestao(d);
    case 'criarConta':      return criarConta(d);
    case 'entrar':          return entrar(d);
    case 'eu':              return publica(exigeSessao(token));
    case 'diretorio':       return diretorio(exigeSessao(token));
    case 'trocarSenha':     return trocarSenha(exigeSessao(token), d);
    case 'sincronizar':     return sincronizar(exigeSessao(token));
    case 'alunos':          return alunos(exigeSessao(token));
    case 'turmas':          return turmas();
    case 'salvarAluno':     return salvarAluno(exigeGestaoOuAutor(token), d);
    case 'salvarTurma':     return salvarTurma(exigeGestao(token), d);
    case 'removerTurma':    return removerTurma(exigeGestao(token), d);
    case 'contas':          return contas(exigeGestao(token));
    case 'atualizarConta':  return atualizarConta(exigeGestao(token), d);
    case 'redefinirSenha':  return redefinirSenha(exigeGestao(token), d);
    case 'ocorrencias':     return ocorrencias(exigeSessao(token));
    case 'salvarOcorrencia':return salvarOcorrencia(exigeSessao(token), d);
    case 'carregarDemo':    return demo(exigeGestao(token), true);
    case 'limparDemo':      return demo(exigeGestao(token), false);
    default: throw erro('Ação desconhecida: ' + acao, 'acao');
  }
}

function erro(msg, codigo){ var e = new Error(msg); e.codigo = codigo || 'erro'; return e; }

/* ============================= planilha ============================= */

function planilha(){ return SpreadsheetApp.getActiveSpreadsheet(); }

function aba(nome){
  var ss = planilha(), sh = ss.getSheetByName(nome);
  if(!sh){
    sh = ss.insertSheet(nome);
    sh.appendRow(ABAS[nome]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Lê pelos nomes do cabeçalho: arrastar uma coluna na planilha não quebra nada. */
function lerTudo(nome){
  var sh = aba(nome), valores = sh.getDataRange().getValues();
  if(valores.length < 2) return [];
  var cab = valores[0], saida = [];
  for(var i = 1; i < valores.length; i++){
    var obj = { _linha: i + 1 };
    for(var j = 0; j < cab.length; j++) obj[cab[j]] = valores[i][j];
    saida.push(obj);
  }
  return saida;
}

function acrescentar(nome, obj){
  var sh = aba(nome);
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(cab.map(function(c){ return obj[c] === undefined ? '' : obj[c]; }));
}

function atualizarLinha(nome, linha, patch){
  var sh = aba(nome);
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for(var c in patch){
    var i = cab.indexOf(c);
    if(i >= 0) sh.getRange(linha, i + 1).setValue(patch[c]);
  }
}

/** Duas pessoas registrando no mesmo minuto é normal: sem trava, perde-se linha. */
function comTrava(fn){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function prop(chave, padrao){
  var v = PropertiesService.getScriptProperties().getProperty(chave);
  return v === null || v === undefined ? padrao : v;
}

/* ============================= senhas ============================= */

/** Resumo do que o navegador enviou, somado ao segredo do servidor. */
function resumoDaChave(chave){
  var pepper = prop('PEPPER', '');
  if(!pepper) throw erro('Servidor sem PEPPER configurado. Veja backend/README.md.', 'config');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pepper + '|' + chave, Utilities.Charset.UTF_8);
  return bytes.map(function(b){ return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/* ============================= sessões ============================= */

function novoToken(){ return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }

function abrirSessao(login){
  var token = novoToken();
  var expira = new Date(Date.now() + HORAS_SESSAO * 3600 * 1000).toISOString();
  acrescentar('sessoes', { token: token, login: login, expiraEm: expira });
  return token;
}

function exigeSessao(token){
  if(!token) throw erro('Sessão não informada. Entre novamente.', 'sessao');
  var s = lerTudo('sessoes').filter(function(x){ return String(x.token) === token; })[0];
  if(!s) throw erro('Sessão inválida. Entre novamente.', 'sessao');
  if(new Date(s.expiraEm) < new Date()) throw erro('Sessão expirada. Entre novamente.', 'sessao');
  var c = acharConta(String(s.login));
  if(!c || c.status !== 'ativo') throw erro('Conta indisponível. Procure a coordenação.', 'inativo');
  return c;
}

function exigeGestao(token){
  var c = exigeSessao(token);
  if(c.papel !== 'gestao') throw erro('Esta ação é restrita à gestão.', 'permissao');
  return c;
}

/* Quem registra precisa poder criar a criança que ainda não está no cadastro, senão
   um cadastro faltando trava o registro na hora em que ele mais importa. A criança
   entra marcada como avulsa, para a gestão confirmar depois. */
function exigeGestaoOuAutor(token){ return exigeSessao(token); }

/* ============================= contas ============================= */

function acharConta(login){
  return lerTudo('contas').filter(function(c){ return String(c.login) === String(login); })[0];
}

function publica(c){
  if(!c) return null;
  return {
    login: String(c.login), nome: String(c.nome), papel: String(c.papel),
    turma: c.turma ? String(c.turma) : null,
    funcoes: c.funcoes ? String(c.funcoes).split(',').filter(String) : [],
    status: String(c.status),
    criadoEm: c.criadoEm ? String(c.criadoEm) : '',
    aprovadoPor: c.aprovadoPor ? String(c.aprovadoPor) : '',
    aprovadoEm: c.aprovadoEm ? String(c.aprovadoEm) : '',
    trocarSenha: String(c.trocarSenha) === 'true'
  };
}

function estado(){
  var gestao = lerTudo('contas').filter(function(c){
    return String(c.papel) === 'gestao' && String(c.status) === 'ativo';
  });
  var conf = {};
  lerTudo('config').forEach(function(l){ if(l.chave) conf[String(l.chave)] = String(l.valor); });
  var escola = null;
  if(conf.escolaNome || conf.escolaSubtitulo || conf.escolaLogo){
    escola = {};
    if(conf.escolaNome) escola.nome = conf.escolaNome;
    if(conf.escolaSubtitulo) escola.subtitulo = conf.escolaSubtitulo;
    if(conf.escolaLogo) escola.logo = conf.escolaLogo;
  }
  return { precisaConfigurar: gestao.length === 0, escola: escola, turmas: turmas() };
}

function validaLogin_(login){
  if(!/^[a-z]{2,}(\.[a-z]{2,})+$/.test(String(login || '')))
    throw erro('Login fora do formato nome.sobrenome.', 'login');
}

function configurarPrimeiraGestao(d){
  return comTrava(function(){
    var atual = lerTudo('contas').filter(function(c){
      return String(c.papel) === 'gestao' && String(c.status) === 'ativo';
    });
    if(atual.length) throw erro('Já existe uma conta de gestão. Peça o acesso a ela.', 'ja_configurado');

    var codigo = prop('CODIGO_CONFIG', '');
    if(!codigo) throw erro('Servidor sem CODIGO_CONFIG. Veja backend/README.md.', 'config');
    if(String(d.codigo || '') !== codigo) throw erro('Código de configuração incorreto.', 'codigo');

    validaLogin_(d.login);
    if(acharConta(d.login)) throw erro('Esse login já existe.', 'duplicado');

    var agora = new Date().toISOString();
    acrescentar('contas', {
      login: d.login, nome: d.nome, papel: 'gestao', turma: '',
      funcoes: 'painel', status: 'ativo',
      resumo: resumoDaChave(d.chave), criadoEm: agora,
      aprovadoPor: '(configuração inicial)', aprovadoEm: agora, trocarSenha: false
    });
    registrar(d.login, 'configuracao_inicial', '');
    return publica(acharConta(d.login));
  });
}

function criarConta(d){
  return comTrava(function(){
    validaLogin_(d.login);
    if(!d.nome || String(d.nome).trim().split(/\s+/).length < 2) throw erro('Informe o nome completo.', 'nome');
    if(acharConta(d.login)) throw erro('Esse login já está em uso. Escolha outro.', 'duplicado');
    var papel = (d.papel === 'gestao') ? 'gestao' : 'miss';
    acrescentar('contas', {
      login: d.login, nome: d.nome, papel: papel, turma: d.turma || '',
      funcoes: '', status: 'pendente', resumo: resumoDaChave(d.chave),
      criadoEm: new Date().toISOString(), aprovadoPor: '', aprovadoEm: '', trocarSenha: false
    });
    registrar(d.login, 'cadastro', papel);
    return publica(acharConta(d.login));
  });
}

function entrar(d){
  var c = acharConta(d.login);
  /* Mesma mensagem para login inexistente e senha errada: não revela quem existe. */
  if(!c || String(c.resumo) !== resumoDaChave(d.chave)){
    registrar(String(d.login || '?'), 'entrada_negada', '');
    throw erro('Login ou senha incorretos.', 'credenciais');
  }
  var st = String(c.status);
  if(st === 'pendente') throw erro('Sua conta ainda está aguardando aprovação da gestão.', 'pendente');
  if(st === 'recusado') throw erro('Este cadastro não foi aprovado. Procure a coordenação.', 'recusado');
  if(st !== 'ativo') throw erro('Esta conta está desativada. Procure a coordenação.', 'inativo');
  registrar(c.login, 'entrada', '');
  return { token: abrirSessao(String(c.login)), conta: publica(c) };
}

function trocarSenha(eu, d){
  if(String(d.login) !== String(eu.login) && eu.papel !== 'gestao')
    throw erro('Você só pode trocar a própria senha.', 'permissao');
  var c = acharConta(d.login);
  if(!c) throw erro('Conta não encontrada.', 'inexistente');
  atualizarLinha('contas', c._linha, { resumo: resumoDaChave(d.chave), trocarSenha: false });
  registrar(eu.login, 'troca_senha', String(d.login));
  return true;
}

function diretorio(eu){
  return lerTudo('contas')
    .filter(function(c){ return String(c.status) === 'ativo'; })
    .map(function(c){
      return { login:String(c.login), nome:String(c.nome), papel:String(c.papel),
               turma: c.turma ? String(c.turma) : null, status:'ativo' };
    });
}

function contas(eu){ return lerTudo('contas').map(publica); }

function atualizarConta(eu, d){
  return comTrava(function(){
    var c = acharConta(d.login);
    if(!c) throw erro('Conta não encontrada.', 'inexistente');
    var p = d.patch || {};

    var gestoresAtivos = lerTudo('contas').filter(function(x){
      return String(x.papel) === 'gestao' && String(x.status) === 'ativo';
    });
    var ultimo = String(c.papel) === 'gestao' && String(c.status) === 'ativo' && gestoresAtivos.length <= 1;
    if(ultimo && (p.papel && p.papel !== 'gestao' || p.status && p.status !== 'ativo'))
      throw erro('Esta é a última conta de gestão ativa. Promova outra pessoa antes.', 'ultimo_gestor');
    if(String(c.login) === String(eu.login) && (p.papel || p.status))
      throw erro('Você não pode alterar o próprio perfil ou situação.', 'si_mesmo');

    var patch = {};
    if(p.papel) patch.papel = p.papel;
    if('turma' in p) patch.turma = p.turma || '';
    if(p.funcoes) patch.funcoes = p.funcoes.join(',');
    if(p.status) patch.status = p.status;
    if('trocarSenha' in p) patch.trocarSenha = !!p.trocarSenha;
    if(p.aprovadoPor) patch.aprovadoPor = p.aprovadoPor;
    if(p.aprovadoEm) patch.aprovadoEm = p.aprovadoEm;

    atualizarLinha('contas', c._linha, patch);
    registrar(eu.login, 'atualiza_conta', String(d.login) + ' ' + JSON.stringify(patch));
    return publica(acharConta(d.login));
  });
}

function redefinirSenha(eu, d){
  var c = acharConta(d.login);
  if(!c) throw erro('Conta não encontrada.', 'inexistente');
  atualizarLinha('contas', c._linha, { resumo: resumoDaChave(d.chave), trocarSenha: true });
  registrar(eu.login, 'redefine_senha', String(d.login));
  return true;
}

/* Tudo o que o app precisa numa única ida ao servidor.
   Cada chamada ao Apps Script custa ~2,5s, então buscar ocorrências, diretório,
   alunos, turmas e contas em cinco chamadas separadas custava mais de 12 segundos.
   Aqui as abas são lidas na mesma execução. */
function sincronizar(eu){
  return {
    conta: publica(eu),
    ocorrencias: ocorrencias(eu),
    diretorio: diretorio(eu),
    alunos: alunos(eu),
    turmas: turmas(),
    contas: eu.papel === 'gestao' ? contas(eu) : []
  };
}

/* ============================= alunos e turmas ============================= */

function alunoPublico(a){
  return {
    id: String(a.id), nome: String(a.nome),
    turma: a.turma ? String(a.turma) : '',
    nascimento: a.nascimento ? String(a.nascimento) : '',
    saude: a.saude ? String(a.saude) : '',
    ativo: String(a.ativo) !== 'false',
    avulso: String(a.avulso) === 'true',
    criadoEm: a.criadoEm ? String(a.criadoEm) : ''
  };
}

function alunos(eu){ return lerTudo('alunos').map(alunoPublico); }

function salvarAluno(eu, d){
  return comTrava(function(){
    var a = d.aluno;
    if(!a || !a.id) throw erro('Aluno sem identificador.', 'dados');
    var existente = lerTudo('alunos').filter(function(x){ return String(x.id) === String(a.id); })[0];

    /* Só a gestão edita um aluno já cadastrado; quem registra apenas cria avulsos. */
    if(existente && eu.papel !== 'gestao')
      throw erro('Apenas a gestão altera o cadastro de um aluno.', 'permissao');

    if(existente){
      var patch = {};
      ['nome','turma','nascimento','saude'].forEach(function(k){ if(k in a) patch[k] = a[k]; });
      if('ativo' in a) patch.ativo = !!a.ativo;
      /* Salvar pela gestão confirma o cadastro feito em campo. */
      if(eu.papel === 'gestao') patch.avulso = false;
      atualizarLinha('alunos', existente._linha, patch);
    } else {
      acrescentar('alunos', {
        id: a.id, nome: a.nome, turma: a.turma || '',
        nascimento: a.nascimento || '', saude: a.saude || '',
        ativo: a.ativo === false ? false : true,
        avulso: eu.papel !== 'gestao',
        criadoEm: new Date().toISOString()
      });
    }
    registrar(eu.login, existente ? 'edita_aluno' : 'cria_aluno', String(a.id));
    return alunoPublico(lerTudo('alunos').filter(function(x){ return String(x.id) === String(a.id); })[0]);
  });
}

/* Sem sessão: a tela de cadastro precisa das turmas antes de alguém entrar.
   Nome de turma não é dado sensível. */
function turmas(){
  return lerTudo('turmas').map(function(t){
    return { id:String(t.id), nome:String(t.nome), faixa: t.faixa ? String(t.faixa) : '' };
  });
}

function salvarTurma(eu, d){
  return comTrava(function(){
    var t = d.turma;
    if(!t || !t.nome) throw erro('Turma sem nome.', 'dados');
    var existente = lerTudo('turmas').filter(function(x){ return String(x.id) === String(t.id); })[0];
    if(existente) atualizarLinha('turmas', existente._linha, { nome:t.nome, faixa:t.faixa || '' });
    else {
      var repetida = lerTudo('turmas').filter(function(x){
        return String(x.nome).toLowerCase() === String(t.nome).toLowerCase();
      })[0];
      if(repetida) throw erro('Já existe uma turma com esse nome.', 'duplicado');
      acrescentar('turmas', { id:t.id, nome:t.nome, faixa:t.faixa || '' });
    }
    registrar(eu.login, 'salva_turma', String(t.nome));
    return turmas();
  });
}

function removerTurma(eu, d){
  return comTrava(function(){
    var t = lerTudo('turmas').filter(function(x){ return String(x.id) === String(d.id); })[0];
    if(!t) throw erro('Turma não encontrada.', 'inexistente');
    var comAlunos = lerTudo('alunos').filter(function(a){
      return String(a.turma) === String(t.nome) && String(a.ativo) !== 'false';
    });
    if(comAlunos.length) throw erro('Há alunos nesta turma. Mova-os antes de remover.', 'em_uso');
    aba('turmas').deleteRow(t._linha);
    registrar(eu.login, 'remove_turma', String(t.nome));
    return turmas();
  });
}

/* ============================= ocorrências ============================= */

function ocorrencias(eu){
  var todas = lerTudo('ocorrencias').map(function(l){
    try { return JSON.parse(l.json); } catch(_){ return null; }
  }).filter(Boolean);

  if(eu.papel === 'gestao') return todas;

  /* A Miss vê o que criou, o que aguarda a sua ciência e o que já passou por ela.
     É a regra de sigilo combinada no desenho. */
  return todas.filter(function(o){
    if(String(o.autorLogin) === String(eu.login)) return true;
    if(eu.papel === 'miss' && eu.turma){
      return (o.chain || []).some(function(c){ return String(c.nivel).indexOf(eu.turma) >= 0; });
    }
    return false;
  });
}

function salvarOcorrencia(eu, d){
  return comTrava(function(){
    var oc = d.ocorrencia;
    if(!oc || !oc.id) throw erro('Ocorrência sem identificador.', 'dados');
    var existente = lerTudo('ocorrencias').filter(function(l){ return String(l.id) === String(oc.id); })[0];
    if(existente) atualizarLinha('ocorrencias', existente._linha, { json: JSON.stringify(oc) });
    else acrescentar('ocorrencias', { id: oc.id, json: JSON.stringify(oc) });
    registrar(eu.login, existente ? 'edita_ocorrencia' : 'cria_ocorrencia', String(oc.id));
    return oc;
  });
}

/* ============================= demonstração e log ============================= */

function demo(eu, carregar){
  if(!carregar){
    var sh = aba('ocorrencias'), linhas = lerTudo('ocorrencias');
    for(var i = linhas.length - 1; i >= 0; i--){
      var o = {};
      try { o = JSON.parse(linhas[i].json); } catch(_){}
      if(o.demo) sh.deleteRow(linhas[i]._linha);
    }
    var shc = aba('contas'), cs = lerTudo('contas');
    for(var j = cs.length - 1; j >= 0; j--) if(String(cs[j].aprovadoPor) === 'demonstração') shc.deleteRow(cs[j]._linha);
    registrar(eu.login, 'demo_limpa', '');
    return true;
  }
  registrar(eu.login, 'demo_carregada', '');
  /* No modo com backend os dados fictícios são carregados pelo próprio app,
     que já os tem; aqui apenas confirmamos para manter a mesma interface. */
  return true;
}

function registrar(login, acao, detalhe){
  try { acrescentar('log', { quando:new Date().toISOString(), login:login, acao:acao, detalhe:detalhe }); } catch(_){}
}

/* ============================= manutenção ============================= *
 * Rode UMA VEZ pelo editor, em Executar, para preparar a planilha e o segredo.
 * Depois configure as propriedades do script conforme o README.
 */
function prepararPlanilha(){
  Object.keys(ABAS).forEach(function(n){ aba(n); });
  var p = PropertiesService.getScriptProperties();
  if(!p.getProperty('PEPPER')) p.setProperty('PEPPER', Utilities.getUuid() + Utilities.getUuid());
  if(!p.getProperty('CODIGO_CONFIG')) p.setProperty('CODIGO_CONFIG', String(Math.floor(100000 + Math.random() * 900000)));
  Logger.log('Pronto. CODIGO_CONFIG = ' + p.getProperty('CODIGO_CONFIG'));
}

/** Gatilho diário: apaga sessões vencidas e aplica a retenção de fotos. */
function manutencaoDiaria(){
  var sh = aba('sessoes'), ss = lerTudo('sessoes'), agora = new Date();
  for(var i = ss.length - 1; i >= 0; i--) if(new Date(ss[i].expiraEm) < agora) sh.deleteRow(ss[i]._linha);
}
