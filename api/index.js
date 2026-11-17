/* Roteador da API. Uma função serverless atende todas as ações, no mesmo contrato
   {acao, dados} que o front já usava — assim a migração do Apps Script não exigiu
   reescrever as telas. */

const { consultar, uma, todas, registrar } = require('./_db');
const A = require('./_auth');
const { ErroApi } = A;

/* ============================ ajudantes ============================ */

const listaFuncoes = f => Array.isArray(f) ? f.join(',') : String(f || '');

const alunoPublico = a => ({
  id: a.id, nome: a.nome, turma: a.turma || '',
  nascimento: a.nascimento || '', saude: a.saude || '',
  ativo: a.ativo !== false, avulso: !!a.avulso,
  criadoEm: a.criado_em ? new Date(a.criado_em).toISOString() : ''
});

const turmaPublica = t => ({
  id: t.id, nome: t.nome, faixa: t.faixa || '',
  missResponsavel: t.miss_responsavel || ''
});

/** Ocorrências que esta pessoa pode ver. Gestão vê tudo; Miss vê o que criou, o que
    aguarda a sua ciência e o que já passou por ela. */
async function ocorrenciasDe(eu){
  const linhas = await todas('SELECT dados FROM ocorrencias ORDER BY criado_em DESC');
  const tudo = linhas.map(l => l.dados);
  if(eu.papel === 'gestao') return tudo;
  return tudo.filter(o => {
    if(o.autorLogin === eu.login) return true;
    if(eu.turma) return (o.chain || []).some(c => String(c.nivel).includes(eu.turma));
    return false;
  });
}

async function diretorio(){
  const cs = await todas(
    `SELECT login, nome, papel, turma FROM contas WHERE status = 'ativo' ORDER BY nome`);
  return cs.map(c => ({ login:c.login, nome:c.nome, papel:c.papel, turma:c.turma || null, status:'ativo' }));
}

/* ============================ ações ============================ */

/** Pública: chamada antes do login. Turmas entram porque o cadastro precisa delas. */
async function estado(){
  const g = await uma(
    `SELECT 1 FROM contas WHERE papel = 'gestao' AND status = 'ativo' LIMIT 1`);
  const cfg = await todas('SELECT chave, valor FROM config');
  const mapa = Object.fromEntries(cfg.map(r => [r.chave, r.valor]));
  const escola = (mapa.escolaNome || mapa.escolaSubtitulo || mapa.escolaLogo) ? {
    ...(mapa.escolaNome ? { nome: mapa.escolaNome } : {}),
    ...(mapa.escolaSubtitulo ? { subtitulo: mapa.escolaSubtitulo } : {}),
    ...(mapa.escolaLogo ? { logo: mapa.escolaLogo } : {})
  } : null;
  const ts = await todas('SELECT * FROM turmas ORDER BY nome');
  return { precisaConfigurar: !g, escola, turmas: ts.map(turmaPublica) };
}

async function configurar(d, res){
  const existe = await uma(`SELECT 1 FROM contas WHERE papel='gestao' AND status='ativo' LIMIT 1`);
  if(existe) throw new ErroApi('Já existe uma conta de gestão. Peça o acesso a ela.', 'ja_configurado');

  const codigo = process.env.CODIGO_CONFIG;
  if(!codigo) throw new ErroApi('Servidor sem CODIGO_CONFIG definido.', 'config', 500);
  if(String(d.codigo || '') !== String(codigo)) throw new ErroApi('Código de configuração incorreto.', 'codigo');

  A.validaLogin(d.login);
  if(await uma('SELECT 1 FROM contas WHERE login=$1', [d.login]))
    throw new ErroApi('Esse login já existe.', 'duplicado');

  await consultar(
    `INSERT INTO contas (login,nome,papel,turma,funcoes,status,senha_hash,aprovado_por,aprovado_em)
     VALUES ($1,$2,'gestao',NULL,'painel','ativo',$3,'(configuração inicial)',now())`,
    [d.login, d.nome, await A.hashSenha(d.chave)]);

  await registrar(d.login, 'configuracao_inicial', '');
  const c = await uma('SELECT * FROM contas WHERE login=$1', [d.login]);
  return A.contaPublica(c);
}

async function criarConta(d){
  A.validaLogin(d.login);
  if(!d.nome || String(d.nome).trim().split(/\s+/).length < 2)
    throw new ErroApi('Informe o nome completo.', 'nome');
  if(await uma('SELECT 1 FROM contas WHERE login=$1', [d.login]))
    throw new ErroApi('Esse login já está em uso. Escolha outro.', 'duplicado');

  const papel = d.papel === 'gestao' ? 'gestao' : 'miss';
  await consultar(
    `INSERT INTO contas (login,nome,papel,turma,funcoes,status,senha_hash)
     VALUES ($1,$2,$3,$4,'','pendente',$5)`,
    [d.login, d.nome, papel, d.turma || null, await A.hashSenha(d.chave)]);

  await registrar(d.login, 'cadastro', papel);
  const c = await uma('SELECT * FROM contas WHERE login=$1', [d.login]);
  return A.contaPublica(c);
}

async function entrar(d, res){
  const c = await uma('SELECT * FROM contas WHERE login=$1', [d.login]);
  /* Mesma mensagem para login inexistente e senha errada: não revela quem existe. */
  const ok = c && await A.conferirSenha(d.chave, c.senha_hash);
  if(!ok){
    await registrar(String(d.login || '?'), 'entrada_negada', '');
    throw new ErroApi('Login ou senha incorretos.', 'credenciais', 401);
  }
  if(c.status === 'pendente') throw new ErroApi('Sua conta ainda está aguardando aprovação da gestão.', 'pendente', 403);
  if(c.status === 'recusado') throw new ErroApi('Este cadastro não foi aprovado. Procure a coordenação.', 'recusado', 403);
  if(c.status !== 'ativo')    throw new ErroApi('Esta conta está desativada. Procure a coordenação.', 'inativo', 403);

  await A.abrirSessao(res, c.login);
  await registrar(c.login, 'entrada', '');
  return { conta: A.contaPublica(c) };
}

/** Tudo numa requisição só: o front carrega a sessão inteira de uma vez. */
async function sincronizar(eu){
  const [ocs, dir, als, tms] = await Promise.all([
    ocorrenciasDe(eu),
    diretorio(),
    todas('SELECT * FROM alunos ORDER BY nome'),
    todas('SELECT * FROM turmas ORDER BY nome')
  ]);
  const contas = eu.papel === 'gestao'
    ? (await todas('SELECT * FROM contas ORDER BY nome')).map(A.contaPublica)
    : [];
  return {
    conta: A.contaPublica(eu),
    ocorrencias: ocs,
    diretorio: dir,
    alunos: als.map(alunoPublico),
    turmas: tms.map(turmaPublica),
    contas
  };
}

async function trocarSenha(eu, d){
  const alvo = String(d.login || eu.login);
  if(alvo !== eu.login && eu.papel !== 'gestao')
    throw new ErroApi('Você só pode trocar a própria senha.', 'permissao', 403);
  const r = await consultar(
    'UPDATE contas SET senha_hash=$1, trocar_senha=false WHERE login=$2',
    [await A.hashSenha(d.chave), alvo]);
  if(!r.rowCount) throw new ErroApi('Conta não encontrada.', 'inexistente', 404);
  await registrar(eu.login, 'troca_senha', alvo);
  return true;
}

async function atualizarConta(eu, d){
  const c = await uma('SELECT * FROM contas WHERE login=$1', [d.login]);
  if(!c) throw new ErroApi('Conta não encontrada.', 'inexistente', 404);
  const p = d.patch || {};

  /* A trava da própria conta vem primeiro: editando a si mesma, essa é a razão que
     explica o que a pessoa acabou de fazer. A da última gestão é para o caso de
     mexer na conta de outra pessoa. */
  if(c.login === eu.login && (p.papel || p.status))
    throw new ErroApi('Você não pode alterar o próprio perfil ou situação.', 'si_mesmo');

  const gestores = await todas(`SELECT login FROM contas WHERE papel='gestao' AND status='ativo'`);
  const ultimo = c.papel === 'gestao' && c.status === 'ativo' && gestores.length <= 1;
  if(ultimo && ((p.papel && p.papel !== 'gestao') || (p.status && p.status !== 'ativo')))
    throw new ErroApi('Esta é a última conta de gestão ativa. Promova outra pessoa antes.', 'ultimo_gestor');

  const campos = [], vals = [];
  const por = (col, v) => { campos.push(`${col} = $${campos.length + 1}`); vals.push(v); };
  if(p.papel) por('papel', p.papel === 'gestao' ? 'gestao' : 'miss');
  if('turma' in p) por('turma', p.turma || null);
  if(p.funcoes) por('funcoes', listaFuncoes(p.funcoes));
  if(p.status) por('status', p.status);
  if('trocarSenha' in p) por('trocar_senha', !!p.trocarSenha);
  if(p.aprovadoPor) por('aprovado_por', p.aprovadoPor);
  if(p.aprovadoEm) por('aprovado_em', new Date(p.aprovadoEm));
  if(!campos.length) return A.contaPublica(c);

  vals.push(d.login);
  await consultar(`UPDATE contas SET ${campos.join(', ')} WHERE login = $${vals.length}`, vals);
  await registrar(eu.login, 'atualiza_conta', d.login + ' ' + JSON.stringify(p));
  return A.contaPublica(await uma('SELECT * FROM contas WHERE login=$1', [d.login]));
}

async function redefinirSenha(eu, d){
  const r = await consultar(
    'UPDATE contas SET senha_hash=$1, trocar_senha=true WHERE login=$2',
    [await A.hashSenha(d.chave), d.login]);
  if(!r.rowCount) throw new ErroApi('Conta não encontrada.', 'inexistente', 404);
  await registrar(eu.login, 'redefine_senha', d.login);
  return true;
}

/* ---------- alunos e turmas ---------- */

async function salvarAluno(eu, d){
  const a = d.aluno;
  if(!a || !a.id) throw new ErroApi('Aluno sem identificador.', 'dados');
  const existe = await uma('SELECT * FROM alunos WHERE id=$1', [a.id]);

  /* Quem registra pode criar a criança que falta no cadastro — senão um cadastro
     ausente trava o registro na hora em que ele mais importa. Editar já cadastrado
     é só da gestão. */
  if(existe && eu.papel !== 'gestao')
    throw new ErroApi('Apenas a gestão altera o cadastro de um aluno.', 'permissao', 403);

  if(existe){
    await consultar(
      `UPDATE alunos SET nome=$1, turma=$2, nascimento=$3, saude=$4, ativo=$5,
         avulso = CASE WHEN $6 THEN false ELSE avulso END
       WHERE id=$7`,
      [a.nome ?? existe.nome, a.turma ?? existe.turma, a.nascimento ?? existe.nascimento,
       a.saude ?? existe.saude, a.ativo === false ? false : true,
       eu.papel === 'gestao', a.id]);
  } else {
    await consultar(
      `INSERT INTO alunos (id,nome,turma,nascimento,saude,ativo,avulso)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a.id, a.nome, a.turma || null, a.nascimento || null, a.saude || null,
       a.ativo === false ? false : true, eu.papel !== 'gestao']);
  }
  await registrar(eu.login, existe ? 'edita_aluno' : 'cria_aluno', a.id);
  return alunoPublico(await uma('SELECT * FROM alunos WHERE id=$1', [a.id]));
}

async function salvarTurma(eu, d){
  const t = d.turma;
  if(!t || !t.nome) throw new ErroApi('Turma sem nome.', 'dados');
  const existe = await uma('SELECT * FROM turmas WHERE id=$1', [t.id]);
  if(existe){
    await consultar('UPDATE turmas SET nome=$1, faixa=$2, miss_responsavel=$3 WHERE id=$4',
      [t.nome, t.faixa || null, t.missResponsavel || null, t.id]);
  } else {
    const repetida = await uma('SELECT 1 FROM turmas WHERE lower(nome)=lower($1)', [t.nome]);
    if(repetida) throw new ErroApi('Já existe uma turma com esse nome.', 'duplicado');
    await consultar('INSERT INTO turmas (id,nome,faixa,miss_responsavel) VALUES ($1,$2,$3,$4)',
      [t.id, t.nome, t.faixa || null, t.missResponsavel || null]);
  }
  await registrar(eu.login, 'salva_turma', t.nome);
  return (await todas('SELECT * FROM turmas ORDER BY nome')).map(turmaPublica);
}

async function removerTurma(eu, d){
  const t = await uma('SELECT * FROM turmas WHERE id=$1', [d.id]);
  if(!t) throw new ErroApi('Turma não encontrada.', 'inexistente', 404);
  const comAlunos = await uma('SELECT 1 FROM alunos WHERE turma=$1 AND ativo = true LIMIT 1', [t.nome]);
  if(comAlunos) throw new ErroApi('Há alunos nesta turma. Mova-os antes de remover.', 'em_uso');
  await consultar('DELETE FROM turmas WHERE id=$1', [d.id]);
  await registrar(eu.login, 'remove_turma', t.nome);
  return (await todas('SELECT * FROM turmas ORDER BY nome')).map(turmaPublica);
}

/* ---------- ocorrências ---------- */

async function salvarOcorrencia(eu, d){
  const oc = d.ocorrencia;
  if(!oc || !oc.id) throw new ErroApi('Ocorrência sem identificador.', 'dados');
  const existe = await uma('SELECT autor_login FROM ocorrencias WHERE id=$1', [oc.id]);
  if(existe){
    await consultar('UPDATE ocorrencias SET dados=$1 WHERE id=$2', [oc, oc.id]);
  } else {
    await consultar('INSERT INTO ocorrencias (id,dados,autor_login) VALUES ($1,$2,$3)',
      [oc.id, oc, eu.login]);
  }
  await registrar(eu.login, existe ? 'edita_ocorrencia' : 'cria_ocorrencia', oc.id);
  return oc;
}

/* ---------- demonstração ----------
   Antes esta ação só escrevia no log e não semeava nada: a gestão clicava e nada
   acontecia. Agora os dados vêm do próprio pedido, que o front já tem. */

async function carregarDemo(eu, d){
  const { turmas = [], alunos = [], ocorrencias = [], contas = [] } = d || {};
  for(const t of turmas){
    const ja = await uma('SELECT 1 FROM turmas WHERE lower(nome)=lower($1)', [t.nome]);
    if(!ja) await consultar('INSERT INTO turmas (id,nome,faixa) VALUES ($1,$2,$3)',
      [t.id, t.nome, t.faixa || null]);
  }
  for(const a of alunos){
    const ja = await uma('SELECT 1 FROM alunos WHERE id=$1', [a.id]);
    if(!ja) await consultar(
      `INSERT INTO alunos (id,nome,turma,nascimento,saude,ativo,avulso)
       VALUES ($1,$2,$3,$4,$5,true,false)`,
      [a.id, a.nome, a.turma || null, a.nascimento || null, a.saude || null]);
  }
  for(const o of ocorrencias){
    const ja = await uma('SELECT 1 FROM ocorrencias WHERE id=$1', [o.id]);
    if(!ja) await consultar('INSERT INTO ocorrencias (id,dados,autor_login) VALUES ($1,$2,$3)',
      [o.id, { ...o, demo:true }, o.autorLogin || eu.login]);
  }
  /* Contas de demonstração entram sem senha utilizável: para entrar como uma delas,
     a gestão redefine a senha pela própria tela de usuários. */
  for(const c of contas){
    const ja = await uma('SELECT 1 FROM contas WHERE login=$1', [c.login]);
    if(!ja) await consultar(
      `INSERT INTO contas (login,nome,papel,turma,funcoes,status,senha_hash,aprovado_por)
       VALUES ($1,$2,$3,$4,$5,$6,'!',  'demonstração')`,
      [c.login, c.nome, c.papel === 'gestao' ? 'gestao' : 'miss',
       c.turma || null, listaFuncoes(c.funcoes), c.status || 'ativo']);
  }
  await registrar(eu.login, 'demo_carregada',
    `${turmas.length} turmas, ${alunos.length} alunos, ${ocorrencias.length} registros`);
  return true;
}

async function limparDemo(eu){
  await consultar(`DELETE FROM ocorrencias WHERE (dados->>'demo') = 'true'`);
  await consultar(`DELETE FROM contas WHERE aprovado_por = 'demonstração'`);
  await consultar(`DELETE FROM alunos WHERE id LIKE 'c%' AND id NOT IN (
                     SELECT DISTINCT jsonb_array_elements(dados->'envolvidos')->>'kid'
                     FROM ocorrencias)`);
  await consultar(`DELETE FROM turmas WHERE id LIKE 't_' AND nome NOT IN (SELECT DISTINCT turma FROM alunos WHERE turma IS NOT NULL)`);
  await registrar(eu.login, 'demo_limpa', '');
  return true;
}

/* ============================ despacho ============================ */

async function despachar(acao, dados, req, res){
  switch(acao){
    case 'estado':           return estado();
    case 'configurar':       return configurar(dados, res);
    case 'criarConta':       return criarConta(dados);
    case 'entrar':           return entrar(dados, res);
    case 'sair':             return A.fecharSessao(req, res).then(() => true);
    case 'eu':               return A.contaPublica(await A.exigeSessao(req));
    case 'sincronizar':      return sincronizar(await A.exigeSessao(req));
    case 'diretorio':        return (await A.exigeSessao(req)) && diretorio();
    case 'trocarSenha':      return trocarSenha(await A.exigeSessao(req), dados);
    case 'alunos':           return (await A.exigeSessao(req)) &&
                                    (await todas('SELECT * FROM alunos ORDER BY nome')).map(alunoPublico);
    case 'turmas':           return (await todas('SELECT * FROM turmas ORDER BY nome')).map(turmaPublica);
    case 'ocorrencias':      return ocorrenciasDe(await A.exigeSessao(req));
    case 'salvarOcorrencia': return salvarOcorrencia(await A.exigeSessao(req), dados);
    case 'salvarAluno':      return salvarAluno(await A.exigeSessao(req), dados);
    case 'contas':           return (await A.exigeGestao(req)) &&
                                    (await todas('SELECT * FROM contas ORDER BY nome')).map(A.contaPublica);
    case 'atualizarConta':   return atualizarConta(await A.exigeGestao(req), dados);
    case 'redefinirSenha':   return redefinirSenha(await A.exigeGestao(req), dados);
    case 'salvarTurma':      return salvarTurma(await A.exigeGestao(req), dados);
    case 'removerTurma':     return removerTurma(await A.exigeGestao(req), dados);
    case 'carregarDemo':     return carregarDemo(await A.exigeGestao(req), dados);
    case 'limparDemo':       return limparDemo(await A.exigeGestao(req));
    default: throw new ErroApi('Ação desconhecida: ' + acao, 'acao', 404);
  }
}

async function lerCorpo(req){
  if(req.body){
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const pedacos = [];
  for await (const p of req) pedacos.push(p);
  const texto = Buffer.concat(pedacos).toString('utf8');
  return texto ? JSON.parse(texto) : {};
}

module.exports = async function handler(req, res){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if(req.method === 'GET'){
    return res.status(200).end(JSON.stringify({ ok:true, dados:{ vivo:true } }));
  }
  if(req.method !== 'POST'){
    return res.status(405).end(JSON.stringify({ ok:false, erro:'Método não suportado.', codigo:'metodo' }));
  }
  try {
    const corpo = await lerCorpo(req);
    const dados = await despachar(String(corpo.acao || ''), corpo.dados || {}, req, res);
    res.status(200).end(JSON.stringify({ ok:true, dados }));
  } catch(e){
    const http = e.http || (e instanceof ErroApi ? e.http : 500);
    if(http >= 500) console.error('erro na API:', e);
    /* Erro de configuração tem mensagem própria: "falha no servidor" não ajudaria
       ninguém a descobrir que falta conectar o banco. */
    const explicavel = e instanceof ErroApi || e.codigo === 'sem_banco';
    res.status(http).end(JSON.stringify({
      ok: false,
      erro: explicavel ? e.message : 'Falha no servidor.',
      codigo: e.codigo || 'erro'
    }));
  }
};

module.exports.despachar = despachar;
