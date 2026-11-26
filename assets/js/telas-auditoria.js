/* Auditoria: o que aconteceu no sistema, quem fez e quando.

   A tabela `log` já era escrita em dezenove pontos do servidor e ninguém nunca a
   lia. Esta tela é só a janela — e é só janela mesmo: não há aqui, nem na API, ação
   que escreva ou apague uma linha de auditoria. Quem escreve é cada ação, como
   efeito dela. Uma auditoria que o auditado pode editar não é auditoria.

   Junto vem a lista dos registros removidos, que é o outro lado da mesma ideia:
   remover tira de vista, não do banco, e a gestão pode olhar e restaurar. */

import { S, app, registrarTela, ir, render, rodape, toast, recarregar,
         voltarPara } from './core.js';
import { Store } from './store.js';
import { esc, dataCompleta } from './util.js';
import { escolha } from './escolha.js';
import { itemHTML } from './telas-comum.js';

/* ---------------------------------------------------------------- auditoria */

app.verAuditoria = async (mais = false) => {
  const a = S.auditoria = S.auditoria || { linhas: [], acoes: [], pessoas: [], quem: '', acao: '' };
  a.carregando = true;
  if(!mais) a.linhas = [];
  render();
  try {
    const r = await Store.auditoria({
      quem: a.quem || '', acao: a.acao || '', limite: 60,
      antesDe: mais && a.linhas.length ? a.linhas[a.linhas.length - 1].id : 0
    });
    a.linhas = mais ? a.linhas.concat(r.linhas) : r.linhas;
    a.acoes = r.acoes; a.pessoas = r.pessoas;
    a.fim = r.linhas.length < 60;
  } catch(e){
    toast('Não consegui ler a auditoria: ' + e.message);
  } finally {
    a.carregando = false;
    render();
  }
};

app.filtroAuditoria = (campo, valor) => {
  S.auditoria = S.auditoria || {};
  S.auditoria[campo] = S.auditoria[campo] === valor ? '' : valor;
  app.verAuditoria();
};

const TODAS = '—todas—';

registrarTela('auditoria', () => {
  /* Relê a cada entrada na tela, e não só na primeira: a auditoria serve para ver o
     que acabou de acontecer, e uma lista guardada da visita anterior mostraria o
     sistema como ele estava, não como está. telaDesenhada é o que o core já usa
     para saber se o desenho é o primeiro desta visita, então não há laço. */
  const a = S.auditoria;
  if(!a || S.telaDesenhada !== 'auditoria'){
    setTimeout(() => app.verAuditoria(), 0);
    if(!a) return carregando();
  }

  return `<div class="stack s18">
    <div class="stack s8">
      ${escolha({ id:'aud-quem', rotulo:'Quem',
        opcoes:[{ valor:TODAS, nome:'Todas as pessoas' }]
          .concat((a.pessoas || []).map(x => ({ valor:x.id, nome:x.nome }))),
        valor: a.quem || TODAS, placeholder:'Todas as pessoas', busca:true,
        aoEscolher:v => { S.auditoria.quem = v === TODAS ? '' : v; app.verAuditoria(); } })}
      ${escolha({ id:'aud-acao', rotulo:'O quê',
        opcoes:[{ valor:TODAS, nome:'Todas as ações' }]
          .concat((a.acoes || []).map(x => ({ valor:x.id, nome:x.nome }))),
        valor: a.acao || TODAS, placeholder:'Todas as ações', busca:true,
        aoEscolher:v => { S.auditoria.acao = v === TODAS ? '' : v; app.verAuditoria(); } })}
    </div>

    ${a.carregando && !a.linhas.length ? carregando()
      : !a.linhas.length
        ? `<div class="empty"><div class="big">Nada registrado ainda</div></div>`
        : `<ul class="aud">${a.linhas.map(linha).join('')}</ul>`}

    ${a.linhas.length && !a.fim
      ? `<button class="btn ghost" ${a.carregando ? 'disabled' : ''}
           onclick="app.verAuditoria(true)">${a.carregando ? 'Carregando…' : 'Ver mais'}</button>`
      : ''}

    <p class="fs11 muted" style="margin:0">
      A auditoria não pode ser editada nem apagada por ninguém, nem por esta tela.</p>
    ${rodape()}
  </div>`;
});

const carregando = () =>
  `<div class="empty"><div class="big">Carregando…</div></div>`;

function linha(l){
  const d = new Date(l.quando);
  return `<li class="aud-l">
    <span class="aud-q">${esc(hora(d))}<i>${esc(dia(d))}</i></span>
    <span class="grow">
      <span class="aud-t">${esc(l.rotulo)}</span>
      ${l.detalhe ? `<span class="fs11 muted" style="display:block">${esc(l.detalhe)}</span>` : ''}
    </span>
    <span class="aud-n">${esc(l.nome)}</span>
  </li>`;
}

const doisDig = n => String(n).padStart(2, '0');
const hora = d => `${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;
const dia  = d => `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}`;

/* ---------------------------------------------------------------- removidos */

app.verRemovidos = async () => {
  S.removidos = { carregando:true, linhas: S.removidos ? S.removidos.linhas : [] };
  render();
  try {
    S.removidos = { carregando:false, linhas: await Store.ocorrenciasRemovidas() };
  } catch(e){
    S.removidos = { carregando:false, linhas: [] };
    toast('Não consegui ler os removidos: ' + e.message);
  }
  render();
};

registrarTela('removidos', () => {
  /* Mesmo motivo da auditoria: o que interessa é o estado de agora. */
  const r = S.removidos;
  if(!r || S.telaDesenhada !== 'removidos'){
    setTimeout(() => app.verRemovidos(), 0);
    if(!r) return carregando();
  }
  if(r.carregando && !r.linhas.length) return carregando();
  if(!r.linhas.length)
    return `<div class="stack s18"><div class="empty">
      <div class="big">Nenhum registro removido</div>
      <p class="fs12" style="margin:0">O que a gestão remover aparece aqui, com o motivo.</p>
    </div>${rodape()}</div>`;

  return `<div class="stack s18">
    <p class="sec-label">${r.linhas.length} ${r.linhas.length === 1 ? 'registro removido' : 'registros removidos'}</p>
    <div class="stack s8">${r.linhas.map(o => `
      <div class="card flat stack s8">
        <div class="fs13"><b>${esc(o.tipo || '—')}</b>
          <span class="muted">· #${esc(o.id)}</span></div>
        <div class="fs12"><b>Motivo:</b> ${esc((o.removido || {}).motivo || '—')}</div>
        <div class="fs11 muted">Removido por ${esc((o.removido || {}).porQuem || '—')}
          em ${esc(dataCompleta((o.removido || {}).quando) || '—')}</div>
        <button class="btn ghost sm" onclick="app.restaurar('${esc(o.id)}')">Restaurar</button>
      </div>`).join('')}</div>
    ${rodape()}
  </div>`;
});

app.restaurar = async id => {
  try {
    await Store.restaurarOcorrencia(id);
    await recarregar({ silencioso:true });
    await app.verRemovidos();
    toast('Registro restaurado');
  } catch(e){ toast('Não restaurei: ' + e.message); }
};

/* ---------------------------------------------------------------- remover com motivo */

/* Motivos que a escola de fato usa. São atalhos, não a lista fechada: o campo
   continua aberto, porque o motivo de verdade raramente cabe numa etiqueta. */
const MOTIVOS = ['Registro duplicado', 'Criado por engano', 'Dados incorretos'];

app.pedirRemocao = id => { S.remocao = { id, motivo:'' }; render(); };
app.fecharRemocao = () => { S.remocao = null; render(); };
app.motivoPronto = m => { S.remocao.motivo = m; S.remocao.erro = ''; render(); };
/* Sem render: redesenhar a cada tecla tira o foco do campo, que foi o bug que
   quebrou a busca de alunos no celular. */
app.motivoDigitado = v => { S.remocao.motivo = v; };

app.confirmarRemocao = async () => {
  const r = S.remocao;
  const campo = document.getElementById('rem-motivo');
  const motivo = String((campo && campo.value) || r.motivo || '').trim();
  if(motivo.length < 5){
    r.erro = 'Escreva o motivo — ele fica na auditoria.';
    r.motivo = motivo;
    return render();
  }
  r.enviando = true; render();
  try {
    await Store.removerOcorrencia(r.id, motivo);
    S.remocao = null;
    S.ocs = S.ocs.filter(o => o.id !== r.id);
    S.removidos = null;
    voltarPara('lista');
    toast('Registro removido');
  } catch(e){
    r.enviando = false;
    r.erro = e.message;
    render();
  }
};

/** O pedido de motivo, desenhado por quem mostra o registro.

    Cartão embutido e não janela sobreposta, como o diálogo de criança fora da
    lista: é o padrão que o app já usa, não precisa de armadilha de foco e não tem
    como ficar atrás do teclado no celular. */
export function dialogoRemocao(){
  const r = S.remocao;
  if(!r) return '';
  return `<div class="card lift stack s8" style="border-color:var(--g4)">
    <p class="sec-label" style="margin:0">Remover o registro #${esc(r.id)}</p>
    <p class="fs12 muted" style="margin:0">Sai das listas e das estatísticas, mas
      continua guardado e pode ser restaurado. O motivo fica na auditoria.</p>
    <div class="chips">${MOTIVOS.map(m => `<button class="chip sm"
      aria-pressed="${r.motivo === m}" onclick="app.motivoPronto('${esc(m)}')">${esc(m)}</button>`).join('')}</div>
    <div class="field">
      <label for="rem-motivo">Motivo</label>
      <textarea class="input" id="rem-motivo" rows="3" spellcheck="true"
        autocapitalize="sentences" oninput="app.motivoDigitado(this.value)">${esc(r.motivo || '')}</textarea>
      ${r.erro ? `<p class="erromsg">${esc(r.erro)}</p>` : ''}
    </div>
    <div class="row" style="gap:8px">
      <button class="btn ghost sm" style="flex:1" onclick="app.fecharRemocao()">Cancelar</button>
      <button class="btn danger sm" style="flex:1" ${r.enviando ? 'disabled' : ''}
        onclick="app.confirmarRemocao()">${r.enviando ? 'Removendo…' : 'Remover'}</button>
    </div>
  </div>`;
}
