/* Roteador da API. Uma função serverless atende todas as ações, no mesmo contrato
   {acao, dados} que o front já usava — assim a migração do Apps Script não exigiu
   reescrever as telas. */

const { consultar, uma, todas, registrar } = require('./_db');
const A = require('./_auth');
const { podeVer } = require('./foto');

/* As regras moram num módulo só, compartilhado com o navegador. É ESM e isto aqui é
   CommonJS, então entra por import dinâmico, cacheado na primeira vez. */
let _regras = null;
const regras = async () => _regras || (_regras = await import('../assets/js/regras.mjs'));
const { ErroApi } = A;

/* ============================ ajudantes ============================ */

const listaFuncoes = f => Array.isArray(f) ? f.join(',') : String(f || '');

const alunoPublico = a => ({
  id: a.id, nome: a.nome, turma: a.turma || '',
  nascimento: a.nascimento || '', saude: a.saude || '',
  ativo: a.ativo !== false, avulso: !!a.avulso, demo: !!a.demo,
  criadoEm: a.criado_em ? new Date(a.criado_em).toISOString() : ''
});

const turmaPublica = t => ({
  id: t.id, nome: t.nome, faixa: t.faixa || '',
  missResponsavel: t.miss_responsavel || '', demo: !!t.demo
});

/** Ocorrências que esta pessoa pode ver. Gestão vê tudo; Miss vê o que criou, o que
    aguarda a sua ciência e o que já passou por ela. */
/* Antes esta função tinha a sua própria versão da regra, mais frouxa que a da tela:
   mandava à Miss todo registro cuja cadeia citasse a turma dela, inclusive os que
   ainda estavam na fila atrás de outra turma e que a interface escondia. Agora as
   duas chamam a mesma função, e o que a tela esconde não sai do banco. */
async function ocorrenciasDe(eu){
  const { quemVe } = await regras();
  const linhas = await todas('SELECT dados FROM ocorrencias ORDER BY criado_em DESC');
  /* Removido não sai daqui: filtrar só na tela deixaria o registro chegar ao
     navegador de quem não deve mais vê-lo. */
  return linhas.map(l => l.dados).filter(o => o && !o.removido && quemVe(eu, o));
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
  /* O nome faltava: a gestão podia corrigir turma, papel e funções, mas não um nome
     digitado errado no cadastro. */
  if(p.nome && String(p.nome).trim()) por('nome', String(p.nome).trim());
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
      /* Salvar pela gestão confirma o cadastro: deixa de ser avulso e deixa de ser
         demonstração — quem adotou um registro fictício não quer perdê-lo na limpeza. */
      `UPDATE alunos SET nome=$1, turma=$2, nascimento=$3, saude=$4, ativo=$5,
         avulso = CASE WHEN $6 THEN false ELSE avulso END,
         demo   = CASE WHEN $6 THEN false ELSE demo   END
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
    await consultar('UPDATE turmas SET nome=$1, faixa=$2, miss_responsavel=$3, demo=false WHERE id=$4',
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

async function removerAluno(eu, d){
  const a = await uma('SELECT * FROM alunos WHERE id=$1', [d.id]);
  if(!a) throw new ErroApi('Aluno não encontrado.', 'inexistente', 404);

  /* "Em uso" é aparecer em qualquer ocorrência. Apagar deixaria registros apontando
     para uma criança que não existe mais — e são justamente os registros que a escola
     precisa guardar. Nesse caso o caminho é arquivar.

     A varredura é em JavaScript, e não por consulta ao JSON, porque a forma do texto
     muda entre json e jsonb e o banco em memória dos testes não cobre os mesmos
     operadores. O volume de uma escola cabe folgado na memória. */
  /* Antes isto recusava quem aparecia em registros, porque eles guardam só o id da
     criança e passariam a apontar para ninguém. Agora o nome é copiado para dentro
     de cada registro antes de o cadastro sair: os registros antigos continuam
     legíveis, que é o que a escola precisa guardar. O que se perde é a ligação com a
     ficha — que deixou de existir de propósito.

     Arquivar continua existindo, e continua sendo o caminho para quem só quer tirar
     da lista sem abrir mão do cadastro.

     A varredura é em JavaScript, e não por consulta ao JSON, porque a forma do texto
     muda entre json e jsonb e o banco em memória dos testes não cobre os mesmos
     operadores. O volume de uma escola cabe folgado na memória. */
  const linhas = await todas('SELECT id, dados FROM ocorrencias');
  let tocados = 0;
  for(const l of linhas){
    const oc = l.dados || {};
    const envolvidos = oc.envolvidos || [];
    if(!envolvidos.some(e => e.kid === d.id)) continue;
    for(const e of envolvidos) if(e.kid === d.id) e.nomeArquivado = a.nome;
    await consultar('UPDATE ocorrencias SET dados=$1 WHERE id=$2', [oc, l.id]);
    tocados++;
  }

  await consultar('DELETE FROM alunos WHERE id=$1', [d.id]);
  await registrar(eu.login, 'remove_aluno',
    a.nome + (tocados ? ` — nome preservado em ${tocados} registro(s)` : ''));
  return (await todas('SELECT * FROM alunos ORDER BY nome')).map(alunoPublico);
}

/* ---------- auditoria ----------
   A tabela `log` já era escrita em dezenove pontos — entrada, cadastro, troca de
   senha, criar e editar aluno, salvar e remover turma, criar e editar ocorrência,
   anexar, ver e remover foto, carregar e limpar demonstração — e ninguém nunca a
   lia. Esta ação é só a porta de leitura.

   NÃO EXISTE AQUI, E NÃO DEVE PASSAR A EXISTIR, NENHUMA AÇÃO QUE ESCREVA OU APAGUE
   ESTA TABELA. Quem escreve é o registrar() de cada ação, como efeito dela. A
   limpeza diária apaga sessões e fotos vencidas e não toca no log de propósito: uma
   auditoria que o auditado pode editar não é auditoria. */

const ACOES_ROTULO = {
  entrada:'Entrou', cadastro:'Criou a própria conta', configuracao_inicial:'Configuração inicial',
  entrada_negada:'Tentativa de entrada recusada', troca_senha:'Trocou a senha',
  redefine_senha:'Redefiniu a senha de alguém', atualiza_conta:'Alterou uma conta',
  cria_aluno:'Cadastrou aluno', edita_aluno:'Editou aluno', remove_aluno:'Removeu aluno',
  salva_turma:'Salvou turma', remove_turma:'Removeu turma',
  cria_ocorrencia:'Criou registro', edita_ocorrencia:'Editou registro',
  remove_ocorrencia:'Removeu registro', restaura_ocorrencia:'Restaurou registro',
  anexa_foto:'Anexou foto', ve_foto:'Abriu uma foto', remove_foto:'Removeu foto',
  retencao_foto:'Foto apagada pela retenção', limpeza_diaria:'Limpeza diária',
  demo_carregada:'Carregou a demonstração', demo_limpa:'Limpou a demonstração'
};

async function auditoria(eu, d){
  const limite = Math.min(Math.max(Number((d || {}).limite) || 60, 1), 200);
  const antesDe = Number((d || {}).antesDe) || 0;
  const quem = String((d || {}).quem || '').trim();
  const acao = String((d || {}).acao || '').trim();

  const onde = [], vals = [];
  const cond = (coluna, v) => { vals.push(v); onde.push(coluna + ' $' + vals.length); };
  if(antesDe) cond('id <', antesDe);
  if(quem)    cond('login =', quem);
  if(acao)    cond('acao =', acao);
  vals.push(limite);

  const linhas = await todas(
    'SELECT id, quando, login, acao, detalhe FROM log ' +
    (onde.length ? 'WHERE ' + onde.join(' AND ') + ' ' : '') +
    'ORDER BY id DESC LIMIT $' + vals.length, vals);

  /* O nome de quem agiu, para a tela não mostrar só o login. */
  const nomes = Object.fromEntries(
    (await todas('SELECT login, nome FROM contas')).map(c => [c.login, c.nome]));

  return {
    linhas: linhas.map(l => ({
      id: l.id,
      quando: new Date(l.quando).toISOString(),
      login: l.login || '',
      nome: l.login ? (nomes[l.login] || l.login) : 'sistema',
      acao: l.acao,
      rotulo: ACOES_ROTULO[l.acao] || l.acao,
      detalhe: l.detalhe || ''
    })),
    /* Para a tela montar os filtros sem inventar opções que nunca ocorreram. */
    acoes: (await todas('SELECT DISTINCT acao FROM log ORDER BY acao'))
      .map(r => ({ id:r.acao, nome: ACOES_ROTULO[r.acao] || r.acao })),
    pessoas: (await todas('SELECT DISTINCT login FROM log WHERE login IS NOT NULL ORDER BY login'))
      .map(r => ({ id:r.login, nome: nomes[r.login] || r.login }))
  };
}

/* ---------- ocorrências ---------- */

/* Para quem vai a ciência. O navegador já calcula isto para mostrar na revisão, mas
   quem grava é o servidor: a cadeia decide quem lê o registro depois, e uma cadeia
   escolhida pelo cliente seria permissão escolhida pelo cliente. Mesma função dos
   dois lados — regras.mjs —, então a tela e o banco não divergem. */
async function cadeiaDoServidor(eu, oc){
  const { montarDestinos, paraCadeia } = await regras();

  const ids = (oc.envolvidos || []).map(e => e.kid).filter(Boolean);
  const alunos = ids.length
    ? await todas(`SELECT id, turma FROM alunos WHERE id = ANY($1)`, [ids])
    : [];
  const turmaDe = Object.fromEntries(alunos.map(a => [a.id, a.turma || '']));
  const turmas = [...new Set((oc.envolvidos || [])
    .map(e => turmaDe[e.kid] || e.turma || '').filter(Boolean))];

  const ativos = await todas(
    `SELECT nome, turma FROM contas WHERE papel='miss' AND status='ativo'`);
  const missDaTurma = t => ativos.find(c => c.turma === t) || null;

  /* "Já apareceu antes" conta registro anterior de qualquer criança envolvida. */
  const linhas = ids.length
    ? await todas('SELECT dados FROM ocorrencias WHERE id <> $1', [oc.id])
    : [];
  const temAnterior = linhas.some(l =>
    ((l.dados || {}).envolvidos || []).some(e => ids.includes(e.kid)));

  return paraCadeia(montarDestinos({
    papelAutor: eu.papel, turmaAutor: eu.turma || '', turmas, missDaTurma,
    temAnterior, sev: Number(oc.sev) || 0, temFoto: !!oc.foto
  }));
}

async function salvarOcorrencia(eu, d){
  const oc = d.ocorrencia;
  if(!oc || !oc.id) throw new ErroApi('Ocorrência sem identificador.', 'dados');
  const existe = await uma('SELECT autor_login, dados FROM ocorrencias WHERE id=$1', [oc.id]);

  /* Criar e editar se distinguiam só por achar a linha. Com o id antigo de quatro
     dígitos, que dava a volta a cada dez segundos, um registro novo podia nascer com
     o número de outro — e esta função o tratava como edição, sobrescrevendo em
     silêncio um registro de verdade. O cliente agora diz qual é a intenção, e um id
     já ocupado num registro novo é erro. */
  if(existe && d.novo)
    throw new ErroApi('Já existe um registro com este número. Tente enviar de novo.',
      'id_ocupado', 409);

  /* O servidor exigia só que existisse um id: um registro sem categoria, sem criança
     ou sem descrição era gravado do mesmo jeito, e só a tela impedia. A mesma
     oQueFalta que o formulário usa roda aqui — uma regra, dois lados, como quemVe e
     a cadeia de ciência.

     A tela guarda o informante dentro de um objeto; a regra o espera solto. É a
     única diferença de forma entre o rascunho e o registro gravado. */
  const { oQueFalta } = await regras();
  const falta = oQueFalta({ ...oc, informanteNome: (oc.informante || {}).nome });
  if(falta.length)
    throw new ErroApi('Registro incompleto: ' + falta.map(f => f.texto).join('; ') + '.',
      'incompleto', 422);

  if(existe){
    /* Quem pode escrever é quem pode ver: a autora corrige, e quem está na cadeia
       registra a própria ciência. Antes isto usava podeVer de foto.js — a regra do
       anexo, emprestada por conveniência; agora é a mesma regra da listagem.

       Não é podeCorrigir de propósito: dar ciência também é uma escrita, e vem de
       quem não é a autora. */
    const { quemVe } = await regras();
    if(!quemVe(eu, existe.dados || {}))
      throw new ErroApi('Você não pode alterar este registro.', 'permissao', 403);
    await consultar('UPDATE ocorrencias SET dados=$1 WHERE id=$2', [oc, oc.id]);
  } else {
    /* Registro novo: a autoria e a cadeia são do servidor, não do que chegou. A
       gestão registra e encerra no mesmo ato, e montarDestinos já diz isso. */
    oc.autorLogin = eu.login;
    oc.autor = eu.nome;
    oc.autorPapel = eu.papel;
    const agora = new Date();
    if(eu.papel === 'gestao'){
      oc.chain = [{ nivel:'Gestão', st:'ok', quandoISO: agora.toISOString(),
        quando: agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
        parecer:'Registrado e encerrado pela gestão.' }];
      oc.status = 'concluido';
    } else {
      oc.chain = await cadeiaDoServidor(eu, oc);
      oc.status = 'aguarda_miss';
    }
    if(!oc.criadoEm) oc.criadoEm = agora.toISOString();
    await consultar('INSERT INTO ocorrencias (id,dados,autor_login) VALUES ($1,$2,$3)',
      [oc.id, oc, eu.login]);
  }
  await registrar(eu.login, existe ? 'edita_ocorrencia' : 'cria_ocorrencia', oc.id);
  return oc;
}

/** Tira o registro de vista sem tirá-lo do banco.

    A gestão pediu isto para o caso do duplicado. Apagar de verdade seria outra
    coisa: um registro de incidente com criança que some é dado que a escola pode
    precisar e não terá mais, e muitos já têm ciência dada — são documentos
    assinados. Então o registro ganha a marca, some das listas, e continua inteiro
    onde está.

    O motivo é obrigatório: remover sem dizer por quê é justamente o que a auditoria
    existe para impedir. */
async function removerOcorrencia(eu, d){
  const motivo = String((d || {}).motivo || '').trim();
  if(motivo.length < 5)
    throw new ErroApi('Diga o motivo da remoção.', 'sem_motivo', 422);

  const linha = await uma('SELECT dados FROM ocorrencias WHERE id=$1', [d.id]);
  if(!linha) throw new ErroApi('Registro não encontrado.', 'inexistente', 404);

  const oc = linha.dados || {};
  if(oc.removido) throw new ErroApi('Este registro já está removido.', 'ja_removido', 409);

  oc.removido = { motivo, porQuem: eu.nome, login: eu.login,
                  quando: new Date().toISOString() };
  await consultar('UPDATE ocorrencias SET dados=$1 WHERE id=$2', [oc, d.id]);
  await registrar(eu.login, 'remove_ocorrencia', d.id + ' — ' + motivo);
  return oc;
}

async function restaurarOcorrencia(eu, d){
  const linha = await uma('SELECT dados FROM ocorrencias WHERE id=$1', [d.id]);
  if(!linha) throw new ErroApi('Registro não encontrado.', 'inexistente', 404);
  const oc = linha.dados || {};
  if(!oc.removido) throw new ErroApi('Este registro não está removido.', 'nao_removido', 409);
  delete oc.removido;
  await consultar('UPDATE ocorrencias SET dados=$1 WHERE id=$2', [oc, d.id]);
  await registrar(eu.login, 'restaura_ocorrencia', String(d.id));
  return oc;
}

/** Os removidos, só para a gestão ver e poder restaurar. */
async function ocorrenciasRemovidas(eu){
  const linhas = await todas('SELECT dados FROM ocorrencias');
  return linhas.map(l => l.dados).filter(o => o && o.removido);
}

/* ---------- demonstração ----------
   Antes esta ação só escrevia no log e não semeava nada: a gestão clicava e nada
   acontecia. Agora os dados vêm do próprio pedido, que o front já tem. */

async function carregarDemo(eu, d){
  const { turmas = [], alunos = [], ocorrencias = [], contas = [] } = d || {};
  for(const t of turmas){
    const ja = await uma('SELECT 1 FROM turmas WHERE lower(nome)=lower($1)', [t.nome]);
    if(!ja) await consultar('INSERT INTO turmas (id,nome,faixa,demo) VALUES ($1,$2,$3,true)',
      [t.id, t.nome, t.faixa || null]);
  }
  for(const a of alunos){
    const ja = await uma('SELECT 1 FROM alunos WHERE id=$1', [a.id]);
    if(!ja) await consultar(
      `INSERT INTO alunos (id,nome,turma,nascimento,saude,ativo,avulso,demo)
       VALUES ($1,$2,$3,$4,$5,true,false,true)`,
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
      `INSERT INTO contas (login,nome,papel,turma,funcoes,status,senha_hash,aprovado_por,demo)
       VALUES ($1,$2,$3,$4,$5,$6,'!','demonstração',true)`,
      [c.login, c.nome, c.papel === 'gestao' ? 'gestao' : 'miss',
       c.turma || null, listaFuncoes(c.funcoes), c.status || 'ativo']);
  }
  await registrar(eu.login, 'demo_carregada',
    `${turmas.length} turmas, ${alunos.length} alunos, ${ocorrencias.length} registros`);
  return true;
}

/** Quantos registros de demonstração existem. A tela mostra antes de limpar. */
async function contarDemo(){
  const [o, c, a, t] = await Promise.all([
    uma(`SELECT count(*)::int n FROM ocorrencias WHERE (dados->>'demo') = 'true'`),
    uma(`SELECT count(*)::int n FROM contas WHERE demo = true`),
    uma(`SELECT count(*)::int n FROM alunos WHERE demo = true`),
    uma(`SELECT count(*)::int n FROM turmas WHERE demo = true`)
  ]);
  return { ocorrencias:o.n, contas:c.n, alunos:a.n, turmas:t.n,
           total:o.n + c.n + a.n + t.n };
}

/* Apaga EXCLUSIVAMENTE o que está marcado como demonstração. Nada de adivinhar pelo
   formato do id: um registro sem a marca não é tocado em hipótese alguma. */
async function limparDemo(eu){
  const antes = await contarDemo();
  await consultar(`DELETE FROM ocorrencias WHERE (dados->>'demo') = 'true'`);
  await consultar(`DELETE FROM contas WHERE demo = true`);
  await consultar(`DELETE FROM alunos WHERE demo = true`);
  await consultar(`DELETE FROM turmas WHERE demo = true`);
  await registrar(eu.login, 'demo_limpa',
    `${antes.turmas} turmas, ${antes.alunos} alunos, ${antes.ocorrencias} registros, ${antes.contas} contas`);
  return antes;
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
    case 'removerAluno':     return removerAluno(await A.exigeGestao(req), dados);
    case 'removerOcorrencia':   return removerOcorrencia(await A.exigeGestao(req), dados);
    case 'restaurarOcorrencia': return restaurarOcorrencia(await A.exigeGestao(req), dados);
    case 'ocorrenciasRemovidas':return ocorrenciasRemovidas(await A.exigeGestao(req));
    case 'auditoria':           return auditoria(await A.exigeGestao(req), dados);
    case 'contas':           return (await A.exigeGestao(req)) &&
                                    (await todas('SELECT * FROM contas ORDER BY nome')).map(A.contaPublica);
    case 'atualizarConta':   return atualizarConta(await A.exigeGestao(req), dados);
    case 'redefinirSenha':   return redefinirSenha(await A.exigeGestao(req), dados);
    case 'salvarTurma':      return salvarTurma(await A.exigeGestao(req), dados);
    case 'removerTurma':     return removerTurma(await A.exigeGestao(req), dados);
    case 'carregarDemo':     return carregarDemo(await A.exigeGestao(req), dados);
    case 'limparDemo':       return limparDemo(await A.exigeGestao(req));
    case 'contarDemo':       return (await A.exigeGestao(req)) && contarDemo();
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
