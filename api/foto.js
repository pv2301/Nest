/* Foto da lesão: envio, leitura autorizada e remoção.

   Regras que vêm do desenho, não da tecnologia:
   - a imagem nunca é um link direto; sai por aqui, depois de conferir a sessão e se
     a pessoa está na cadeia de ciência daquele registro ou é gestão;
   - toda visualização vai para o log;
   - some sozinha depois do prazo de retenção (config.js), salvo quando a gestão
     marcou preservar.

   Ressalva: no plano atual do Vercel o arquivo tem URL pública, ainda que impossível
   de adivinhar. Servir por aqui impede listagem e acesso sem sessão, mas quem obtiver
   a URL final consegue abrir. Com retenção curta é aceitável; privacidade real exige
   o recurso pago. */

const crypto = require('crypto');
const { uma, consultar, todas, registrar } = require('./_db');
const A = require('./_auth');
const { ErroApi } = A;

/* O prazo vem de regras.mjs, que é o único lugar onde ele existe. Antes havia um
   número aqui e outro em config.js, e os dois podiam divergir sem ninguém notar: a
   tela prometeria um prazo e o servidor cumpriria outro.

   regras.mjs é .mjs justamente para este arquivo, que é CommonJS, conseguir
   carregá-lo por import dinâmico. */
let _regras = null;
const diasRetencao = async () =>
  ((_regras = _regras || import('../assets/js/regras.mjs')), (await _regras).RETENCAO_FOTO_DIAS);
const TAMANHO_MAX = 6 * 1024 * 1024;
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

/* O Blob só é carregado quando existe token: nos testes ele é injetado. */
let blob = null;
function usarBlob(b){ blob = b; }
function obterBlob(){
  if(blob) return blob;
  blob = require('@vercel/blob');
  return blob;
}

/** A pessoa pode ver ou mexer no anexo deste registro? */
async function podeVer(eu, ocorrenciaId){
  if(eu.papel === 'gestao') return true;
  const linha = await uma('SELECT dados, autor_login FROM ocorrencias WHERE id=$1', [ocorrenciaId]);
  if(!linha) return false;
  if(linha.autor_login === eu.login) return true;
  const o = linha.dados || {};
  return !!(eu.turma && (o.chain || []).some(c => String(c.nivel).includes(eu.turma)));
}

async function lerBinario(req){
  const pedacos = [];
  let total = 0;
  for await (const p of req){
    total += p.length;
    if(total > TAMANHO_MAX) throw new ErroApi('Imagem acima de 6 MB.', 'tamanho', 413);
    pedacos.push(p);
  }
  return Buffer.concat(pedacos);
}

async function enviar(req, res){
  const eu = await A.exigeSessao(req);
  const ocorrenciaId = String(req.query?.ocorrencia || '');
  if(!ocorrenciaId) throw new ErroApi('Informe a ocorrência.', 'dados');
  if(!await podeVer(eu, ocorrenciaId)) throw new ErroApi('Sem acesso a esta ocorrência.', 'permissao', 403);

  const tipo = String(req.headers['content-type'] || '').split(';')[0].trim();
  if(!TIPOS.has(tipo)) throw new ErroApi('Envie uma imagem JPEG, PNG ou WebP.', 'tipo', 415);

  const corpo = await lerBinario(req);
  if(!corpo.length) throw new ErroApi('Imagem vazia.', 'dados');

  const id = crypto.randomBytes(16).toString('hex');
  const ext = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `anexos/${ocorrenciaId}/${id}.${ext}`;

  const { put } = obterBlob();
  const salvo = await put(caminho, corpo, {
    access: 'public',
    contentType: tipo,
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  const dias = await diasRetencao();
  const expira = new Date(Date.now() + dias * 864e5);
  await consultar(
    `INSERT INTO anexos (id, ocorrencia_id, caminho, url, expira_em) VALUES ($1,$2,$3,$4,$5)`,
    [id, ocorrenciaId, salvo.pathname || caminho, salvo.url, expira]);

  await registrar(eu.login, 'anexa_foto', ocorrenciaId);
  return { id, expiraEm: expira.toISOString(), dias };
}

async function servir(req, res){
  const eu = await A.exigeSessao(req);
  const id = String(req.query?.id || '');
  const anexo = await uma('SELECT * FROM anexos WHERE id=$1', [id]);
  if(!anexo) throw new ErroApi('Anexo não encontrado ou já removido pela retenção.', 'inexistente', 404);
  if(!await podeVer(eu, anexo.ocorrencia_id))
    throw new ErroApi('Sem acesso a este anexo.', 'permissao', 403);

  await registrar(eu.login, 've_foto', anexo.ocorrencia_id + ' ' + id);

  const r = await fetch(anexo.url);
  if(!r.ok) throw new ErroApi('Não consegui ler o arquivo.', 'arquivo', 502);
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).end(buf);
}

async function remover(req){
  const eu = await A.exigeGestao(req);
  const id = String(req.query?.id || '');
  const anexo = await uma('SELECT * FROM anexos WHERE id=$1', [id]);
  if(!anexo) return true;
  try {
    const { del } = obterBlob();
    await del(anexo.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch(e){ console.error('falha ao apagar blob', e); }
  await consultar('DELETE FROM anexos WHERE id=$1', [id]);
  await registrar(eu.login, 'remove_foto', anexo.ocorrencia_id + ' ' + id);
  return true;
}

/** Apaga o que passou da retenção e não foi preservado. Usada pela tarefa diária. */
async function expurgar(agora = new Date()){
  const vencidos = await todas(
    'SELECT * FROM anexos WHERE preservado = false AND expira_em < $1', [agora]);
  let apagados = 0;
  for(const a of vencidos){
    try {
      const { del } = obterBlob();
      await del(a.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch(e){ console.error('falha ao apagar blob', a.id, e); }
    await consultar('DELETE FROM anexos WHERE id=$1', [a.id]);
    await registrar(null, 'retencao_foto', a.ocorrencia_id + ' ' + a.id);
    apagados++;
  }
  return apagados;
}

module.exports = async function handler(req, res){
  try {
    if(req.method === 'POST')        return res.status(200).json({ ok:true, dados: await enviar(req, res) });
    if(req.method === 'GET')         return await servir(req, res);
    if(req.method === 'DELETE')      return res.status(200).json({ ok:true, dados: await remover(req) });
    res.status(405).json({ ok:false, erro:'Método não suportado.', codigo:'metodo' });
  } catch(e){
    const http = e instanceof ErroApi ? e.http : 500;
    if(http >= 500) console.error('erro no anexo:', e);
    res.status(http).json({
      ok:false,
      erro: e instanceof ErroApi ? e.message : 'Falha no servidor.',
      codigo: e.codigo || 'erro'
    });
  }
};

module.exports.expurgar = expurgar;
module.exports.podeVer = podeVer;
module.exports.usarBlob = usarBlob;
module.exports.diasRetencao = diasRetencao;
