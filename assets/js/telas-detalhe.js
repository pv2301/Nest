/* O registro aberto: a ocorrência inteira, a foto, e as ações de quem a recebe —
   dar ciência, pedir complemento, mudar a gravidade, marcar a comunicação. */

import { S, app, registrarTela, ir, rodape, otimista, filaDe, aluno,
         voltarPara } from './core.js';
import { Store } from './store.js';
import { podeCorrigir, RETENCAO_FOTO_DIAS } from './regras.mjs';
import { esc, quandoLegivel, iniciais, ICON, svgIc } from './util.js';
import { CONFIG } from '../../config.js';
import { SEVL } from './vocabulario.js';
import { localDe, quandoTexto, sevTag, statusPill, tipoDe, vazio } from './telas-comum.js';
import { dialogoRemocao } from './telas-auditoria.js';
import { escolha } from './escolha.js';

/* ---------------------------------------------------------------- detalhe */
function fotoBloco(o){
  const gestao = S.conta.papel === 'gestao';
  if(o.fotoPurgada) return `<div class="photo" style="border-style:solid">Foto apagada em ${esc(o.fotoPurgada)}</div>`;
  if(o.preservado) return `<div class="photo">1 foto · <b>preservada por decisão da gestão</b><br><span class="fs11">Fora da exclusão automática · acesso em log</span></div>`
    + (gestao ? `<button class="btn ghost sm" style="width:100%;margin-top:8px" onclick="app.preservar('${esc(o.id)}',false)">Voltar à retenção de ${RETENCAO_FOTO_DIAS} dias</button>` : '');
  const url = o.fotoId ? Store.urlFoto(o.fotoId) : null;
  return (url
      ? `<div class="fotobox"><img src="${esc(url)}" alt="Foto da lesão" loading="lazy"></div>`
      : `<div class="photo">1 foto registrada</div>`)
    + (gestao ? `<button class="btn ghost sm" style="width:100%;margin-top:8px" onclick="app.preservar('${esc(o.id)}',true)">Preservar anexo (exceção)</button>` : '');
}

registrarTela('detalhe', () => {
  const o = S.ocs.find(x => x.id === S.detalhe), u = S.conta;
  if(!o) return vazio('Registro não encontrado', 'Ele pode ter sido removido.');
  const souDestino = filaDe(u).some(x => x.id === o.id);

  return `<div class="stack s18">
    <div>
      <div class="row" style="gap:8px;margin-bottom:7px;flex-wrap:wrap">${sevTag(o.sev)}${statusPill(o)}${o.duas ? '<span class="pill">2 turmas</span>' : ''}${o.demo ? '<span class="pill demo">demonstração</span>' : ''}</div>
      <h1 style="font-size:19px">${esc(tipoDe(o))}</h1>
      <p class="fs12 muted" style="margin:4px 0 0">#${esc(o.id)} · ${esc(o.categoria || '—')} · ${esc(localDe(o))} · ${esc(quandoTexto(o))}</p>
      <p class="fs12 muted" style="margin:2px 0 0">Registrado por ${esc(o.autor)}${o.presenciou
        ? ' · presenciou'
        : ' · informada por ' + esc((o.informante && o.informante.nome) || 'terceiros') + ((o.informante && o.informante.canal) ? ' (' + esc(o.informante.canal) + ')' : '')}</p>
    </div>

    <div><p class="sec-label">Crianças envolvidas</p><div class="stack s8">
      ${(o.envolvidos || []).map(e => `<div class="card flat">
        <div class="row" style="margin-bottom:6px"><span class="avatar sm">${esc(iniciais(aluno(e.kid).nome))}</span>
          <b class="fs13 grow">${esc(aluno(e.kid).nome)}</b><span class="pill">${esc(e.papel || '—')}</span></div>
        <div class="fs12 muted">Turma ${esc(e.turma || aluno(e.kid).turma || '—')} · ${esc(e.cond)}${e.lesao ? ' · marca em ' + esc(e.lesao) : ''}</div>
      </div>`).join('')}</div></div>

    <div><p class="sec-label">Descrição</p><p class="fs13" style="margin:0">${esc(o.desc)}</p></div>

    ${(o.prov || []).length ? `<div><p class="sec-label">Providências</p><div class="chips">
      ${o.prov.map(p => `<span class="pill">${esc(p)}</span>`).join('')}</div></div>` : ''}

    ${o.foto ? `<div><p class="sec-label">Anexo</p>${fotoBloco(o)}</div>` : ''}

    <div><p class="sec-label">Cadeia de ciência</p><div class="chain">
      ${(o.chain || []).map((c, i) => `<div class="node ${c.st}">
        <div class="gut"><div class="dot ${c.st === 'ok' ? 'ok' : c.st === 'now' ? 'now' : ''}">${c.st === 'ok' ? '&check;' : i+1}</div>${i < o.chain.length-1 ? `<div class="line ${c.st === 'ok' ? 'done' : ''}"></div>` : ''}</div>
        <div class="body"><b class="fs13">${esc(c.nivel)}</b>
          <div class="fs11 muted">${c.st === 'ok'
            ? 'Ciência em ' + esc(c.quandoISO ? quandoLegivel(c.quandoISO) : c.quando)
            : c.st === 'now' ? 'Aguardando' : 'Na fila'}</div>
          ${c.parecer ? `<p class="fs12" style="margin:6px 0 0;padding:8px 10px;background:var(--surface-2);border-radius:9px">${esc(c.parecer)}</p>` : ''}
        </div></div>`).join('')}</div></div>

    ${o.acomp ? `<div class="notice info"><span class="ic">◆</span><div><b>Acompanhamento:</b> ${esc(o.acomp)}</div></div>` : ''}

    <button class="btn soft" onclick="app.abrirFicha('${esc(o.id)}')">
      ${svgIc(ICON.exportar).replace('<svg','<svg width="17" height="17"')} Gerar relatório</button>

    ${podeCorrigir(S.conta, o) ? `<button class="btn ghost" onclick="app.corrigirRegistro('${esc(o.id)}')">Corrigir registro</button>`
      : (o.autorLogin === u.login
        ? `<p class="fs11 muted center" style="margin:0">Registro travado pela ciência.</p>` : '')}

    ${souDestino ? `<div class="card lift stack s8" style="border-color:var(--accent-text)">
      <p class="sec-label" style="margin:0">Sua ciência</p>
      <div><p class="fs12 muted" style="margin:0 0 6px">Confirme ou corrija a gravidade</p>
        <!-- Campo com lista, como todo campo de formulário desde que a escola pediu um
             controle só. A escala de cor vai na classe de cada opção: aqui a cor é a
             informação, e ler "3" sem o tom perderia o "quanto mais escuro, mais
             sério". (Sem acento grave neste comentário: ele vive dentro de um template
             literal, e um acento grave fecharia a string.) -->
        ${escolha({ id:'sev-ciencia', placeholder:'Confirmar a gravidade', busca:false,
          opcoes:[1,2,3,4].map(n => ({ valor:String(n), nome:`${n} · ${SEVL[n]}`,
                                       classe:`sev n${n}` })),
          valor:String(o.sev || ''),
          aoEscolher:v => app.mudarSev(o.id, Number(v)) })}</div>
      <div class="field"><label for="d-par">Parecer ou orientação (opcional)</label>
        <textarea class="input" id="d-par" style="min-height:66px" placeholder="Volta visível para quem registrou." spellcheck="true" autocorrect="on" autocapitalize="sentences"></textarea></div>
      <button class="btn" onclick="app.darCiencia('${esc(o.id)}')">&check; Dar ciência</button>
      <button class="btn ghost" onclick="app.pedirComplemento('${esc(o.id)}')">Pedir complemento</button>
    </div>` : ''}

    ${u.papel === 'gestao' && !souDestino && o.status !== 'concluido' ? `<div class="card stack s8">
      <button class="btn soft" onclick="app.marcarComunicacao('${esc(o.id)}')">Registrar comunicação com a família</button>
    </div>` : ''}

    ${u.papel === 'gestao' ? (S.remocao && S.remocao.id === o.id
      ? dialogoRemocao()
      : `<button class="btn ghost" onclick="app.pedirRemocao('${esc(o.id)}')">Remover este registro</button>`) : ''}

    ${rodape()}
  </div>`;
});

/* O registro já está alterado em memória: basta gravá-lo. Buscar tudo de novo aqui
   custava mais de 12 segundos por causa das idas ao Apps Script. */
/* O parâmetro se chamava `voltarPara`, o mesmo nome da função de navegação que agora
   vem de core.js — e sombrearia o import aqui dentro. Ele guarda o NOME da tela, não a
   ação, então passa a dizer isso. */
function salvar(o, msg, telaDeVolta){
  return otimista(
    () => { if(telaDeVolta){ S.detalhe = null; voltarPara(telaDeVolta); } },
    () => Store.salvarOcorrencia(o),
    msg
  );
}

app.mudarSev = (id, n) => {
  const o = S.ocs.find(x => x.id === id); if(!o) return;
  o.sev = n; salvar(o, 'Gravidade ajustada para nível ' + n);
};

app.darCiencia = id => {
  const o = S.ocs.find(x => x.id === id), u = S.conta; if(!o) return;
  const par = (document.getElementById('d-par') || {}).value || '';
  const i = o.chain.findIndex(c => c.st === 'now'); if(i < 0) return;
  o.chain[i].st = 'ok';
  /* Guarda o instante, não o texto: "Hoje, 22:47" gravado em texto continuava dizendo
     "Hoje" meses depois, na tela e no papel. */
  o.chain[i].quandoISO = new Date().toISOString();
  o.chain[i].quando = quandoLegivel(o.chain[i].quandoISO);
  if(par.trim()) o.chain[i].parecer = par.trim();
  const prox = o.chain.findIndex(c => c.st === 'wait');
  if(prox >= 0){ o.chain[prox].st = 'now'; o.status = 'aguarda_miss'; }
  else {
    o.status = u.papel === 'gestao' ? 'acompanhamento' : 'concluido';
    if(u.papel === 'gestao') o.acomp = 'Definir encaminhamento · ' + u.curto;
  }
  salvar(o, prox >= 0 ? 'Ciência registrada. Segue para ' + o.chain[prox].nivel.split(' (')[0]
    : 'Ciência registrada. ' + (u.papel === 'gestao' ? 'Registro em acompanhamento' : 'Registro concluído'), 'ciencia');
};

app.pedirComplemento = id => {
  const o = S.ocs.find(x => x.id === id); if(!o) return;
  o.status = 'complemento';
  salvar(o, 'Devolvido a ' + String(o.autor).split(' ')[0] + ' · edição reaberta', 'ciencia');
};

app.preservar = (id, v) => {
  const o = S.ocs.find(x => x.id === id); if(!o) return;
  o.preservado = v;
  salvar(o, v ? 'Anexo preservado · fora da exclusão automática' : 'Anexo volta à retenção padrão');
};

app.marcarComunicacao = id => {
  const o = S.ocs.find(x => x.id === id); if(!o) return;
  o.acomp = 'Família comunicada em ' + quandoLegivel(new Date().toISOString());
  salvar(o, 'Comunicação com a família registrada');
};
