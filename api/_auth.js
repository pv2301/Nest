/* Sessão, senha e permissões.

   A senha nunca chega aqui: o navegador deriva PBKDF2-SHA256 com 150.000 iterações e
   envia só a chave derivada. O servidor aplica bcrypt sobre ela. Duas camadas — um
   vazamento do banco não entrega a senha, e a senha em claro não trafega.

   A sessão vive num cookie httpOnly: o JavaScript da página não o alcança, então um
   XSS não a rouba. O que fica no banco é o resumo do token, não o token. */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { uma, consultar, registrar } = require('./_db');

const COOKIE = 'reg_sessao';
const DIAS_SESSAO = 30;
const CUSTO_BCRYPT = 10;

class ErroApi extends Error {
  constructor(mensagem, codigo, http){
    super(mensagem);
    this.codigo = codigo || 'erro';
    this.http = http || 400;
  }
}

const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

async function hashSenha(chave){
  if(!chave || String(chave).length < 16) throw new ErroApi('Chave de senha inválida.', 'chave');
  return bcrypt.hash(String(chave), CUSTO_BCRYPT);
}

const conferirSenha = (chave, hash) => bcrypt.compare(String(chave || ''), String(hash || ''));

/* ---------- código de recuperação ----------

   O código tem ~81 bits de acaso, então o hash é SHA-256 e não bcrypt: bcrypt existe
   para tornar lenta a adivinhação de senha humana, que é curta e previsível. Aqui não
   há o que adivinhar, e o mesmo hashToken já guarda o token de sessão pelo mesmo
   motivo. */
const normalizaCodigo = v => String(v || '').toUpperCase().replace(/[^0-9A-HJ-NP-Z]/g, '');
const hashCodigo = c => hashToken(normalizaCodigo(c));

/* ---------- limite de tentativas ----------

   Não havia limite nenhum no app, nem no login: dava para tentar senha
   indefinidamente. A contagem sai da tabela `log`, que já registra cada falha e já
   tem índice por `quando` — não precisa de tabela nova, e a auditoria ganha uma
   função operacional além da de prestar contas.

   O bloqueio é por login tentado e não por conta: não mexe em `status`, não precisa
   da gestão para destravar, expira sozinho, e protege também logins que não existem
   sem revelar quais são. */
const FALHAS_ATE_TRAVAR = 5;
const JANELA_MIN = 10;

async function conferirLimite(login){
  const r = await uma(
    `SELECT count(*)::int AS n, max(quando) AS ultima FROM log
     WHERE login = $1 AND acao IN ('entrada_negada','recuperacao_negada')
       AND quando > now() - interval '${JANELA_MIN} minutes'`,
    [String(login || '')]);
  if(!r || r.n < FALHAS_ATE_TRAVAR) return;
  const faltam = Math.max(1, Math.ceil(
    (new Date(r.ultima).getTime() + JANELA_MIN * 60000 - Date.now()) / 60000));
  throw new ErroApi(
    `Muitas tentativas. Espere ${faltam} minuto${faltam > 1 ? 's' : ''} e tente de novo.`,
    'excesso', 429);
}

/* ---------- cookie ---------- */
function lerCookie(req, nome){
  const bruto = req.headers && req.headers.cookie;
  if(!bruto) return null;
  for(const parte of bruto.split(';')){
    const i = parte.indexOf('=');
    if(i < 0) continue;
    if(parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

function porCookie(res, token, maxIdade){
  const seguro = process.env.NODE_ENV !== 'teste';
  const partes = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax',
    `Max-Age=${maxIdade}`
  ];
  if(seguro) partes.push('Secure');
  res.setHeader('Set-Cookie', partes.join('; '));
}

function limparCookie(res){
  porCookie(res, '', 0);
}

/* ---------- sessão ---------- */
async function abrirSessao(res, login){
  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + DIAS_SESSAO * 864e5);
  await consultar('INSERT INTO sessoes (token_hash, login, expira_em) VALUES ($1,$2,$3)',
    [hashToken(token), login, expira]);
  porCookie(res, token, DIAS_SESSAO * 86400);
  return token;
}

async function fecharSessao(req, res){
  const token = lerCookie(req, COOKIE);
  if(token) await consultar('DELETE FROM sessoes WHERE token_hash = $1', [hashToken(token)]);
  limparCookie(res);
}

/** Conta autenticada, ou erro. */
async function exigeSessao(req){
  const token = lerCookie(req, COOKIE);
  if(!token) throw new ErroApi('Sessão não encontrada. Entre novamente.', 'sessao', 401);
  const s = await uma('SELECT login, expira_em FROM sessoes WHERE token_hash = $1', [hashToken(token)]);
  if(!s) throw new ErroApi('Sessão inválida. Entre novamente.', 'sessao', 401);
  if(new Date(s.expira_em) < new Date()){
    await consultar('DELETE FROM sessoes WHERE token_hash = $1', [hashToken(token)]);
    throw new ErroApi('Sessão expirada. Entre novamente.', 'sessao', 401);
  }
  const c = await uma('SELECT * FROM contas WHERE login = $1', [s.login]);
  if(!c || c.status !== 'ativo') throw new ErroApi('Conta indisponível. Procure a coordenação.', 'inativo', 403);
  return c;
}

async function exigeGestao(req){
  const c = await exigeSessao(req);
  if(c.papel !== 'gestao') throw new ErroApi('Esta ação é restrita à gestão.', 'permissao', 403);
  return c;
}

/* ---------- formatos ---------- */
/** O que pode sair para o cliente: nunca o hash da senha. */
function contaPublica(c){
  if(!c) return null;
  return {
    login: c.login,
    nome: c.nome,
    papel: c.papel,
    turma: c.turma || null,
    funcoes: c.funcoes ? String(c.funcoes).split(',').filter(Boolean) : [],
    status: c.status,
    demo: !!c.demo,
    criadoEm: c.criado_em ? new Date(c.criado_em).toISOString() : '',
    aprovadoPor: c.aprovado_por || '',
    aprovadoEm: c.aprovado_em ? new Date(c.aprovado_em).toISOString() : '',
    trocarSenha: !!c.trocar_senha,
    /* A data, nunca o código: o perfil precisa saber se existe um e desde quando,
       e o hash não sai daqui. */
    recuperacaoEm: c.recuperacao_em ? new Date(c.recuperacao_em).toISOString() : ''
  };
}

const LOGIN_OK = /^[a-z]{2,}(\.[a-z]{2,})+$/;
function validaLogin(login){
  if(!LOGIN_OK.test(String(login || '')))
    throw new ErroApi('Login fora do formato nome.sobrenome.', 'login');
}

module.exports = {
  ErroApi, COOKIE,
  hashSenha, conferirSenha, hashToken,
  normalizaCodigo, hashCodigo, conferirLimite,
  abrirSessao, fecharSessao, exigeSessao, exigeGestao,
  lerCookie, limparCookie,
  contaPublica, validaLogin, registrar
};
