/* Tarefa diária, agendada no vercel.json.
   Faz a limpeza que ninguém lembraria de fazer à mão: sessões vencidas e fotos que
   passaram dos 90 dias. */

const { consultar, registrar } = require('./_db');
const { expurgar } = require('./foto');

module.exports = async function handler(req, res){
  /* O Vercel assina as chamadas do cron; nada mais deve disparar isto. */
  const segredo = process.env.CRON_SECRET;
  const autorizado = !segredo ||
    req.headers['authorization'] === `Bearer ${segredo}`;
  if(!autorizado) return res.status(401).json({ ok:false, erro:'não autorizado' });

  try {
    const s = await consultar('DELETE FROM sessoes WHERE expira_em < now()');
    const fotos = await expurgar();
    await registrar(null, 'limpeza_diaria', `${s.rowCount} sessões, ${fotos} fotos`);
    res.status(200).json({ ok:true, dados:{ sessoes: s.rowCount, fotos } });
  } catch(e){
    console.error('falha na limpeza diária:', e);
    res.status(500).json({ ok:false, erro:'Falha na limpeza.' });
  }
};
