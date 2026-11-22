/* Conexão com o Postgres e criação do esquema.
   As migrações rodam sozinhas, de forma idempotente, na primeira requisição de cada
   instância — não há passo manual de criar tabelas. */

const { Pool } = require('pg');

let pool = null;
let pronto = null;

/** Permite injetar outro banco nos testes (pg-mem). */
/* Cada integração batiza a variável de um jeito — POSTGRES_URL, DATABASE_URL, ou um
   prefixo escolhido na hora de conectar. Em vez de exigir um nome, procuramos no
   ambiente qualquer variável que seja uma URL de Postgres. */
function urlDoBanco(){
  const preferidas = ['POSTGRES_URL', 'DATABASE_URL', 'POSTGRES_PRISMA_URL', 'STORAGE_URL'];
  for(const nome of preferidas){
    if(process.env[nome]) return process.env[nome];
  }
  for(const [nome, valor] of Object.entries(process.env)){
    if(typeof valor === 'string' && /^postgres(ql)?:\/\//.test(valor) && !/_UNPOOLED$/.test(nome)){
      console.log('usando banco da variável', nome);
      return valor;
    }
  }
  return undefined;
}

let fabrica = () => new Pool({
  connectionString: urlDoBanco(),
  ssl: { rejectUnauthorized: false },
  max: 1,                       // serverless: uma conexão por instância
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000
});

/* Quando os testes injetam o próprio banco, não há variável de ambiente para
   verificar — e não deve haver. */
let fabricaPropria = false;
function usarFabrica(f){ fabrica = f; fabricaPropria = true; pool = null; pronto = null; }

function obterPool(){
  if(!pool) pool = fabrica();
  return pool;
}

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS contas (
     login          TEXT PRIMARY KEY,
     nome           TEXT NOT NULL,
     papel          TEXT NOT NULL,
     turma          TEXT,
     funcoes        TEXT NOT NULL DEFAULT '',
     status         TEXT NOT NULL,
     senha_hash     TEXT NOT NULL,
     criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
     aprovado_por   TEXT,
     aprovado_em    TIMESTAMPTZ,
     trocar_senha   BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE TABLE IF NOT EXISTS turmas (
     id               TEXT PRIMARY KEY,
     nome             TEXT NOT NULL UNIQUE,
     faixa            TEXT,
     miss_responsavel TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS alunos (
     id         TEXT PRIMARY KEY,
     nome       TEXT NOT NULL,
     turma      TEXT,
     nascimento TEXT,
     saude      TEXT,
     ativo      BOOLEAN NOT NULL DEFAULT true,
     avulso     BOOLEAN NOT NULL DEFAULT false,
     criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS ocorrencias (
     id          TEXT PRIMARY KEY,
     dados       JSONB NOT NULL,
     autor_login TEXT NOT NULL,
     criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS anexos (
     id             TEXT PRIMARY KEY,
     ocorrencia_id  TEXT NOT NULL,
     caminho        TEXT NOT NULL,
     url            TEXT NOT NULL,
     criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
     expira_em      TIMESTAMPTZ NOT NULL,
     preservado     BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE TABLE IF NOT EXISTS sessoes (
     token_hash TEXT PRIMARY KEY,
     login      TEXT NOT NULL,
     expira_em  TIMESTAMPTZ NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS log (
     id      SERIAL PRIMARY KEY,
     quando  TIMESTAMPTZ NOT NULL DEFAULT now(),
     login   TEXT,
     acao    TEXT NOT NULL,
     detalhe TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS config (
     chave TEXT PRIMARY KEY,
     valor TEXT
   )`,
  /* Marca explícita de demonstração. Antes a limpeza adivinhava pelo formato do id,
     o que um dia apagaria dado real. */
  `ALTER TABLE alunos ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE turmas ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE contas ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT false`,

  /* Corrige o passado, uma vez só: quem carregou demonstração antes desta mudança
     tem registros sem marca. É o ÚNICO lugar onde o padrão de id ainda aparece —
     nunca mais para decidir o que apagar. */
  `UPDATE contas SET demo = true WHERE demo = false AND aprovado_por = 'demonstração'`,
  `UPDATE alunos SET demo = true WHERE demo = false AND id IN ('c1','c2','c3','c4','c5','c6')`,
  `UPDATE turmas SET demo = true WHERE demo = false AND id IN ('t1','t2','t3')`,

  `CREATE INDEX IF NOT EXISTS idx_ocorrencias_criado ON ocorrencias (criado_em DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes (expira_em)`,
  `CREATE INDEX IF NOT EXISTS idx_anexos_expira ON anexos (expira_em)`,
  `CREATE INDEX IF NOT EXISTS idx_log_quando ON log (quando DESC)`
];

/* ---------- maiúscula nos nomes já gravados ----------

   Quem cadastrou "maria da silva" antes de a normalização existir continua com
   "maria da silva" até alguém reabrir e salvar. Esta passagem corrige o passado uma
   vez só, marcada em `config` para não repetir.

   Em JavaScript e não em SQL de propósito: o initcap do Postgres devolveria
   "Maria Da Silva", que é justamente o que a regra exclui. */
async function normalizarNomes(forcar = false){
  const p = obterPool();
  if(!forcar){
    const ja = await p.query(`SELECT valor FROM config WHERE chave = 'nomesNormalizados'`);
    if(ja.rows.length) return { pulou: true, mudou: 0 };
  }

  const { tituloNome } = await import('../assets/js/nomes.mjs');
  let mudou = 0;

  /* Turma aceita algarismo romano em minúscula; nome de pessoa não, porque "vivi"
     viraria "VIVI". */
  for(const [tabela, chave, romanos] of
      [['alunos','id',false], ['turmas','id',true], ['contas','login',false]]){
    const linhas = await p.query(`SELECT ${chave}, nome FROM ${tabela}`);
    for(const l of linhas.rows){
      const certo = tituloNome(l.nome, { romanos });
      if(!certo || certo === l.nome) continue;
      await p.query(`UPDATE ${tabela} SET nome = $1 WHERE ${chave} = $2`, [certo, l[chave]]);
      mudou++;
    }
  }

  await p.query(
    `INSERT INTO config (chave, valor) VALUES ('nomesNormalizados', $1)
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
    [new Date().toISOString() + ' · ' + mudou]);

  /* Numa linha de auditoria, para a mudança não acontecer em silêncio. */
  if(mudou) await registrar(null, 'normaliza_nomes', `${mudou} nome(s) corrigido(s)`);
  return { pulou: false, mudou };
}

async function migrar(){
  if(!fabricaPropria && !urlDoBanco()){
    const e = new Error('Banco de dados não configurado: nenhuma variável de ambiente com URL de Postgres foi encontrada. No Vercel, conecte o banco ao projeto e faça um novo deploy.');
    e.codigo = 'sem_banco';
    e.http = 503;
    throw e;
  }
  const p = obterPool();
  for(const sql of ESQUEMA) await p.query(sql);
  /* Depois do esquema, porque precisa da tabela config. Falhar aqui não pode
     derrubar o servidor: o app funciona com os nomes como estão. */
  try { await normalizarNomes(); }
  catch(e){ console.error('normalização de nomes adiada:', e.message); }
}

/** Garante o esquema uma vez por instância. */
function garantir(){
  if(!pronto) pronto = migrar().catch(e => { pronto = null; throw e; });
  return pronto;
}

async function consultar(sql, params){
  await garantir();
  return obterPool().query(sql, params);
}

/** Primeira linha, ou null. */
async function uma(sql, params){
  const r = await consultar(sql, params);
  return r.rows[0] || null;
}

async function todas(sql, params){
  const r = await consultar(sql, params);
  return r.rows;
}

async function registrar(login, acao, detalhe){
  try {
    await consultar('INSERT INTO log (login, acao, detalhe) VALUES ($1,$2,$3)',
      [login || null, acao, detalhe ? String(detalhe).slice(0, 2000) : null]);
  } catch { /* log nunca derruba a operação */ }
}

module.exports = { consultar, uma, todas, registrar, garantir, usarFabrica, obterPool,
                   normalizarNomes };
