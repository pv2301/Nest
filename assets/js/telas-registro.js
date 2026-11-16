/* Telas do registro de ocorrência: início, novo, lista, fila de ciência, detalhe,
   painel e ficha da criança. */

import { S, app, registrarTela, ir, toast, render, recarregar, rodape,
         filaDe, meusRegistros, visiveis, posRender, temFuncao } from './core.js';
import { Store } from './store.js';
import { esc, quandoLegivel, agoraHora } from './util.js';
import { CONFIG } from '../../config.js';
import { KIDS, CATS, LOCAIS, PROVIDENCIAS, CONDICOES, REGIOES, PAPEIS_ENVOLVIDO,
         SEVL, JULGAMENTO, HEAT, HORAS, TURMAS, kid } from './dados.js';

const sevTag = n => `<span class="sev n${n}">${n} · ${SEVL[n]}</span>`;

function statusPill(o){
  if(o.status === 'concluido')      return '<span class="pill done">&check; Concluído</span>';
  if(o.status === 'acompanhamento') return '<span class="pill follow">Em acompanhamento</span>';
  if(o.status === 'complemento')    return '<span class="pill wait">Requer complemento</span>';
  const n = (o.chain || []).find(c => c.st === 'now');
  return `<span class="pill wait">Aguarda ciência · ${esc(n ? n.nivel.split(' (')[0] : '—')}</span>`;
}

function itemHTML(o, prazo){
  const nomes = (o.envolvidos || []).map(e => (kid(e.kid) || {}).nome || '—').join(' · ');
  return `<button class="item n${o.sev}" onclick="app.abrirOc('${esc(o.id)}')">
    <span class="stripe"></span>
    <div class="row" style="gap:8px;margin-bottom:5px"><h4 class="grow">${esc(o.tipo)}</h4>${sevTag(o.sev)}</div>
    <div class="fs12 muted" style="margin-bottom:7px">${esc(nomes)} · ${esc(o.local)} · ${esc(o.quando)}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${statusPill(o)}
      ${prazo && o.prazo ? `<span class="pill">${esc(o.prazo)}</span>` : ''}
      ${o.duas ? '<span class="pill">2 turmas</span>' : ''}</div>
  </button>`;
}

app.abrirOc = id => { S.detalhe = id; ir('detalhe'); };

const vazio = (titulo, texto) =>
  `<div class="empty"><div class="big">${esc(titulo)}</div><p class="fs12" style="margin:0">${esc(texto)}</p></div>`;

/* ---------------------------------------------------------------- início */
registrarTela('home', () => {
  const u = S.conta, fila = filaDe(u), meus = meusRegistros(u).slice(0, 3);
  let out = '<div class="stack s18">';

  if(u.trocarSenha) out += `<div class="notice info"><span class="ic">◆</span><div>Sua senha é temporária. <b onclick="app.ir('trocarSenha')" style="text-decoration:underline;cursor:pointer">Defina uma nova</b>.</div></div>`;

  out += `<button class="btn" style="padding:16px" onclick="app.ir('novo')">+ &nbsp;Registrar ocorrência</button>`;

  if(fila.length){
    out += `<div><p class="sec-label">Aguardando sua ciência</p>
      <div class="stack s8">${fila.map(o => itemHTML(o, true)).join('')}</div></div>`;
  }

  if(temFuncao(u, 'painel')){
    out += `<div><p class="sec-label">Resumo</p><div class="tiles">
      <div class="tile"><b>${S.ocs.length}</b><small>registros no sistema</small></div>
      <div class="tile${fila.length ? ' mark' : ''}"><b>${fila.length}</b><small>aguardando sua ciência</small></div>
    </div></div>`;
  }

  out += `<div><p class="sec-label">${u.papel === 'gestao' ? 'Últimos registros' : 'Meus registros'}</p>
    <div class="stack s8">${meus.length ? meus.map(o => itemHTML(o)).join('')
      : vazio('Nenhum registro ainda', 'O que você registrar aparece aqui, com o estado da ciência.')}</div>
    ${meus.length ? `<button class="btn ghost sm" style="width:100%;margin-top:9px" onclick="app.ir('lista')">Ver todos</button>` : ''}
  </div>`;

  return out + rodape() + '</div>';
});

/* ---------------------------------------------------------------- escolha do modo */
registrarTela('novo', () => `<div class="stack">
  <button class="item" style="padding:16px" onclick="app.iniciar('rapido')">
    <div class="row" style="margin-bottom:5px"><h4 class="grow" style="font-size:15px">Registro rápido</h4><span class="pill">~40s</span></div>
    <p class="fs12 muted" style="margin:0">Criança, tipo, gravidade e uma linha. Para o cotidiano leve.</p>
  </button>
  <button class="item" style="padding:16px" onclick="app.iniciar('completo')">
    <div class="row" style="margin-bottom:5px"><h4 class="grow" style="font-size:15px">Registro completo</h4><span class="pill">5 passos</span></div>
    <p class="fs12 muted" style="margin:0">Envolvidos e papéis, providências, condição de cada criança, lesão e foto.</p>
  </button>
  <div class="notice calm"><span class="ic">◆</span><div>Seu rascunho fica salvo enquanto você preenche. Se for interrompida, pode voltar.</div></div>
</div>`);

app.iniciar = modo => {
  S.modoRegistro = modo; S.passo = 1;
  S.rascunho = { envolvidos:[], quando:'Agora', local:'', cat:'', tipo:'', sev:0,
                 presenciou:true, relator:'', desc:'', prov:[], foto:false, cond:{}, lesao:{} };
  ir(modo === 'rapido' ? 'rapido' : 'wizard');
};

/* ---------------------------------------------------------------- blocos compartilhados */
function kidChips(){
  const u = S.conta, d = S.rascunho;
  const minha = u.turma || TURMAS[0];
  const prio = KIDS.filter(k => k.turma === minha), outros = KIDS.filter(k => k.turma !== minha);
  const um = k => `<button class="chip kid" aria-pressed="${d.envolvidos.some(e => e.kid === k.id)}" onclick="app.togKid('${k.id}')">
      <span class="avatar sm">${esc(k.ini)}</span>${esc(k.nome)}</button>`;
  return `<div class="stack s8">
    <div><p class="fs11 muted" style="margin:0 0 6px">Turma ${esc(minha)}</p><div class="chips">${prio.map(um).join('')}</div></div>
    ${outros.length ? `<div><p class="fs11 muted" style="margin:0 0 6px">Outras turmas</p><div class="chips">${outros.map(um).join('')}</div></div>` : ''}
  </div>`;
}

app.togKid = id => {
  const d = S.rascunho, i = d.envolvidos.findIndex(e => e.kid === id);
  if(i >= 0) d.envolvidos.splice(i, 1); else d.envolvidos.push({ kid:id, papel:'' });
  render();
};

function sinalRecentes(){
  const d = S.rascunho, c = d.envolvidos.map(e => kid(e.kid)).filter(k => k && k.recentes > 0);
  if(!c.length) return '';
  if(S.conta.papel === 'gestao')
    return `<div class="notice info"><span class="ic">◆</span><div>${c.map(k => `<b>${esc(k.nome)}</b>: ${k.recentes} registro(s) em 30 dias`).join(' · ')}</div></div>`;
  /* Para quem não é gestão: só a existência, nunca a quantidade nem o conteúdo. */
  return `<div class="notice info"><span class="ic">◆</span><div>${c.map(k => '<b>' + esc(k.nome) + '</b>').join(' e ')} ${c.length > 1 ? 'têm' : 'tem'} registros recentes. Converse com a coordenação.</div></div>`;
}

const sevPicker = () => `<div class="sevpick">${[1,2,3,4].map(n => `
  <button data-n="${n}" aria-pressed="${S.rascunho.sev === n}" onclick="app.campo('sev',${n})">
    <b>${n}</b><small>${SEVL[n]}</small></button>`).join('')}</div>`;

app.campo = (k, v) => { S.rascunho[k] = v; render(); };
app.campoTxt = (k, v) => { S.rascunho[k] = v; };
app.togArr = (k, v) => {
  const a = S.rascunho[k], i = a.indexOf(v);
  i >= 0 ? a.splice(i, 1) : a.push(v);
  render();
};
app.campoObj = (k, id, v) => { S.rascunho[k][id] = v; render(); };

function checagemLinguagem(txt){
  const achados = JULGAMENTO.filter(w =>
    new RegExp('(^|[^a-zà-ú])' + w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '([^a-zà-ú]|$)', 'i').test(txt));
  if(!achados.length) return '';
  return `<div class="notice info"><span class="ic">◆</span><div>Encontrei <b>${achados.map(esc).join('</b>, <b>')}</b>. Prefira descrever o fato observável — o que a criança fez ou disse — em vez de interpretar. O envio não fica bloqueado.</div></div>`;
}

const completo = d => !!(d.envolvidos.length && d.tipo && d.sev && d.desc.trim().length > 8);

/* Digitar não redesenha a tela (perderia o foco), então o botão de envio e o aviso
   de linguagem são atualizados à mão. */
app.checarTexto = (campo, destino, v) => {
  S.rascunho[campo] = v;
  const el = document.getElementById(destino);
  if(el) el.innerHTML = checagemLinguagem(v);
  const b = document.getElementById('btn-enviar');
  if(b) b.disabled = !completo(S.rascunho);
};

/* ---------------------------------------------------------------- registro rápido */
registrarTela('rapido', () => {
  const d = S.rascunho;
  const tipos = [...CATS['Interação entre pares'], ...CATS['Físico / acidente'], 'Choro intenso', 'Alimentação'];
  return `<div class="stack s18">
    <div><p class="sec-label">Quem</p>${kidChips()}</div>
    ${sinalRecentes()}
    <div><p class="sec-label">O que aconteceu</p><div class="chips">
      ${tipos.map(t => `<button class="chip" aria-pressed="${d.tipo === t}" onclick="app.campo('tipo','${esc(t)}')">${esc(t)}</button>`).join('')}</div></div>
    <div><p class="sec-label">Gravidade</p>${sevPicker()}</div>
    <div class="field"><label for="r-desc">Em uma linha</label>
      <textarea class="input" id="r-desc" style="min-height:70px" placeholder="O que você observou, em linguagem de fato."
        oninput="app.checarTexto('desc','r-chk',this.value)">${esc(d.desc)}</textarea>
      <div id="r-chk" style="margin-top:8px">${checagemLinguagem(d.desc)}</div></div>
    <div class="row fs12 muted" style="gap:6px"><div class="grow">Hoje, ${esc(agoraHora())} · ${esc(S.conta.curto)}${S.conta.turma ? ' · Turma ' + esc(S.conta.turma) : ''}</div></div>
    <button class="btn" id="btn-enviar" ${completo(d) ? '' : 'disabled'} onclick="app.enviar()">Enviar registro</button>
  </div>`;
});

/* ---------------------------------------------------------------- wizard */
registrarTela('wizard', () => {
  const d = S.rascunho, st = S.passo;
  let corpo = '';

  if(st === 1) corpo = `<div class="stack s18">
    <div><p class="sec-label">1 · Quem esteve envolvido</p>${kidChips()}</div>
    ${sinalRecentes()}
    ${d.envolvidos.length ? `<div><p class="sec-label">Papel de cada criança</p><div class="stack s8">
      ${d.envolvidos.map((e, i) => `<div class="card flat">
        <div class="row" style="margin-bottom:8px"><span class="avatar sm">${esc((kid(e.kid)||{}).ini)}</span>
          <b class="fs13 grow">${esc((kid(e.kid)||{}).nome)}</b><span class="fs11 muted">Turma ${esc((kid(e.kid)||{}).turma)}</span></div>
        <div class="chips">${PAPEIS_ENVOLVIDO.map(p => `<button class="chip" style="min-height:32px;padding:6px 11px;font-size:12px"
          aria-pressed="${e.papel === p}" onclick="app.papelEnvolvido(${i},'${p}')">${p}</button>`).join('')}</div>
      </div>`).join('')}</div>
      <p class="fs11 muted" style="margin:8px 0 0">Uma ocorrência, não duas fichas. É o papel que permite saber, depois, quem morde e quem é mordido.</p></div>` : ''}
    <div><p class="sec-label">Quando</p><div class="chips">
      ${['Agora','Há 15 min','Há 30 min','Há 1h'].map(t => `<button class="chip" aria-pressed="${d.quando === t}" onclick="app.campo('quando','${t}')">${t}</button>`).join('')}</div></div>
    <div><p class="sec-label">Onde</p><div class="chips">
      ${LOCAIS.map(l => `<button class="chip" aria-pressed="${d.local === l}" onclick="app.campo('local','${esc(l)}')">${esc(l)}</button>`).join('')}</div></div>
    <div class="notice calm"><span class="ic">◆</span><div>Preenchido sozinho: <b>${esc(S.conta.curto)}</b>, hoje, ${esc(agoraHora())}${S.conta.turma ? ', Turma ' + esc(S.conta.turma) : ''}.</div></div>
  </div>`;

  if(st === 2) corpo = `<div class="stack s18">
    <div><p class="sec-label">2 · Categoria</p><div class="chips">
      ${Object.keys(CATS).map(c => `<button class="chip" aria-pressed="${d.cat === c}" onclick="app.escolherCat('${esc(c)}')">${esc(c)}</button>`).join('')}</div></div>
    ${d.cat ? `<div><p class="sec-label">Tipo</p><div class="chips">
      ${CATS[d.cat].map(t => `<button class="chip" aria-pressed="${d.tipo === t}" onclick="app.campo('tipo','${esc(t)}')">${esc(t)}</button>`).join('')}</div></div>` : ''}
    <div><p class="sec-label">Gravidade</p>${sevPicker()}
      <p class="fs11 muted" style="margin:8px 0 0">A Miss confirma ou corrige este nível ao dar ciência.</p></div>
    <div><p class="sec-label">Você presenciou?</p><div class="chips">
      <button class="chip" aria-pressed="${d.presenciou}" onclick="app.campo('presenciou',true)">Presenciei</button>
      <button class="chip" aria-pressed="${!d.presenciou}" onclick="app.campo('presenciou',false)">Fui informada</button></div>
      ${!d.presenciou ? `<div class="field" style="margin-top:9px"><label for="w-rel">Quem relatou (obrigatório)</label>
        <input class="input" id="w-rel" value="${esc(d.relator)}" placeholder="Nome de quem informou" oninput="app.campoTxt('relator',this.value)"></div>` : ''}</div>
    <div class="field"><label for="w-desc">Descrição objetiva</label>
      <textarea class="input" id="w-desc" placeholder="O que aconteceu, onde, em que contexto, e o que foi observado antes e depois."
        oninput="app.checarTexto('desc','w-chk',this.value)">${esc(d.desc)}</textarea>
      <div id="w-chk" style="margin-top:8px">${checagemLinguagem(d.desc)}</div>
      <p class="hint">Toque no microfone do teclado para ditar.</p></div>
    <div><p class="sec-label">Foto da lesão (opcional)</p>
      <div class="photo" onclick="app.campo('foto',${!d.foto})">${d.foto ? '&check; 1 foto anexada · toque para remover' : 'Tirar foto · só a região da lesão, sem rosto e sem outras crianças'}</div>
      <p class="hint">A foto sobe direto e não fica na galeria do aparelho. Todo acesso fica em log, e ela é apagada sozinha ${CONFIG.REGRAS.retencaoFotoDias} dias depois.</p></div>
  </div>`;

  if(st === 3) corpo = `<div class="stack s18">
    <div><p class="sec-label">3 · O que foi feito</p><div class="chips">
      ${PROVIDENCIAS.map(p => `<button class="chip" aria-pressed="${d.prov.includes(p)}" onclick="app.togArr('prov','${esc(p)}')">${esc(p)}</button>`).join('')}</div></div>
    ${d.tipo === 'Mordida' ? `<div class="card flat"><p class="sec-label">Cuidados para mordida</p>
      <div class="stack s6 fs12">
        ${['Lavar com água e sabão','Compressa fria por 5 minutos','Observar inchaço e rompimento da pele','Se houver rompimento, comunicar a coordenação']
          .map((t, i) => `<div class="row" style="gap:7px"><span>${i+1}.</span><div class="grow">${t}</div></div>`).join('')}
      </div></div>` : ''}
  </div>`;

  if(st === 4) corpo = `<div class="stack s18">
    <p class="sec-label">4 · Como cada criança ficou</p>
    ${d.envolvidos.length ? d.envolvidos.map(e => `<div class="card stack s8">
      <div class="row"><span class="avatar sm">${esc((kid(e.kid)||{}).ini)}</span>
        <b class="fs13 grow">${esc((kid(e.kid)||{}).nome)}</b>${e.papel ? `<span class="pill">${esc(e.papel)}</span>` : ''}</div>
      <div class="chips">${CONDICOES.map(c => `<button class="chip" style="min-height:32px;padding:6px 11px;font-size:12px"
        aria-pressed="${d.cond[e.kid] === c}" onclick="app.campoObj('cond','${e.kid}','${esc(c)}')">${esc(c)}</button>`).join('')}</div>
      <div><p class="fs11 muted" style="margin:2px 0 6px">Região da marca ou lesão</p>
        <div class="bodymap">${REGIOES.map(r => `<button aria-pressed="${d.lesao[e.kid] === r}"
          onclick="app.campoObj('lesao','${e.kid}','${esc(r)}')">${esc(r)}</button>`).join('')}</div></div>
    </div>`).join('') : '<p class="fs13 muted">Volte ao passo 1 e selecione as crianças envolvidas.</p>'}
  </div>`;

  if(st === 5){
    const dest = destinoCiencia();
    corpo = `<div class="stack s18">
      <p class="sec-label">5 · Revisar e enviar</p>
      <div class="card"><dl class="kv">
        <dt>Envolvidos</dt><dd>${d.envolvidos.map(e => esc((kid(e.kid)||{}).nome) + (e.papel ? ` <span class="muted">(${esc(e.papel)})</span>` : '')).join('<br>') || '—'}</dd>
        <dt>Tipo</dt><dd>${esc(d.tipo || '—')}${d.cat ? ` <span class="muted">· ${esc(d.cat)}</span>` : ''}</dd>
        <dt>Gravidade</dt><dd>${d.sev ? sevTag(d.sev) : '—'}</dd>
        <dt>Quando</dt><dd>${esc(d.quando)}</dd>
        <dt>Onde</dt><dd>${esc(d.local || '—')}</dd>
        <dt>Providências</dt><dd>${d.prov.map(esc).join(', ') || '—'}</dd>
        <dt>Foto</dt><dd>${d.foto ? '1 anexada' : 'nenhuma'}</dd>
      </dl></div>
      <div class="card flat"><p class="sec-label">Para quem vai a ciência</p>
        <div class="chain">${dest.map((n, i) => `<div class="node">
          <div class="gut"><div class="dot">${i+1}</div>${i < dest.length-1 ? '<div class="line"></div>' : ''}</div>
          <div class="body"><b class="fs13">${esc(n.q)}</b><div class="fs11 muted">${esc(n.p)}</div></div></div>`).join('')}</div></div>
      <div class="notice calm"><span class="ic">◆</span><div>Você pode editar este registro até a primeira ciência, ou por ${CONFIG.REGRAS.travaEdicaoHoras}h — o que vier primeiro. Depois disso, só acrescentar adendos.</div></div>
      <button class="btn" id="btn-enviar" ${completo(d) ? '' : 'disabled'} onclick="app.enviar()">Enviar registro</button>
      ${completo(d) ? '' : '<p class="fs11 muted center" style="margin:0">Faltam: crianças, tipo, gravidade e descrição.</p>'}
    </div>`;
  }

  const nav = st < 5 ? `<div class="row" style="gap:9px;margin-top:20px">
      ${st > 1 ? '<button class="btn ghost" onclick="app.passo(-1)">Voltar</button>' : ''}
      <button class="btn" onclick="app.passo(1)">Continuar</button></div>` : '';
  return corpo + nav;
});

app.passo = delta => {
  S.passo = Math.max(1, Math.min(5, S.passo + delta));
  const sc = document.getElementById('scroll'); if(sc) sc.scrollTop = 0;
  render();
};
app.papelEnvolvido = (i, p) => { S.rascunho.envolvidos[i].papel = p; render(); };
app.escolherCat = c => { S.rascunho.cat = c; S.rascunho.tipo = ''; render(); };

/* ---------------------------------------------------------------- roteamento da ciência */
function missDaTurma(turma){
  return (S.diretorio || []).find(d => d.papel === 'miss' && d.turma === turma && d.status === 'ativo');
}

function destinoCiencia(){
  const u = S.conta, d = S.rascunho, out = [];
  const turmas = [...new Set(d.envolvidos.map(e => (kid(e.kid) || {}).turma).filter(Boolean))];

  if(u.papel === 'gestao'){
    out.push({ q:'Encerrado por você', p:'A gestão registra e conclui no mesmo ato' });
    return out;
  }
  /* Ciência paralela: uma Miss por turma envolvida, exceto a própria autora. */
  turmas.forEach(t => {
    const m = missDaTurma(t);
    if(u.papel === 'miss' && u.turma === t) return;
    out.push(m
      ? { q: `${m.nome} (Turma ${t})`, p:'Confirma a gravidade e acrescenta o contexto' }
      : { q: `Gestão (Turma ${t} sem Miss ativa)`, p:'Nenhuma Miss cadastrada para esta turma' });
  });

  const gatilho = d.sev > 1 || d.foto || d.envolvidos.some(e => (kid(e.kid) || {}).recentes > 0);
  if(gatilho || !CONFIG.REGRAS.nivel1EncerraNaMiss)
    out.push({ q:'Gestão', p: d.sev > 1 ? 'Gravidade ' + d.sev : 'Gatilho: foto anexada ou registro recente' });
  else
    out.push({ q:'Encerra na Miss', p:'Nível 1 sem gatilho · entra no resumo diário da gestão' });

  return out;
}

app.enviar = async () => {
  const u = S.conta, d = S.rascunho, dest = destinoCiencia();
  const id = String(Date.now()).slice(-4);
  const chain = dest.filter(x => !x.q.startsWith('Encerra')).map((x, i) => ({
    nivel: x.q.startsWith('Encerrado') ? 'Gestão' : x.q,
    st: i === 0 ? 'now' : 'wait'
  }));
  const oc = {
    id, tipo:d.tipo, cat:d.cat || '—', sev:d.sev, local:d.local || LOCAIS[0],
    quando:'Hoje, ' + agoraHora(), criadoEm:new Date().toISOString(),
    autor:u.nome, autorLogin:u.login, autorPapel:u.papel,
    envolvidos: d.envolvidos.map(e => ({ kid:e.kid, papel:e.papel || 'Envolvida',
      cond:d.cond[e.kid] || '—', lesao:d.lesao[e.kid] || '' })),
    desc:d.desc, prov:d.prov, foto:d.foto, fotoDias: d.foto ? CONFIG.REGRAS.retencaoFotoDias : undefined,
    presenciou:d.presenciou, relator:d.relator,
    chain: chain.length ? chain : [{ nivel:'Gestão', st:'now' }],
    status:'aguarda_miss', prazo:CONFIG.REGRAS.travaEdicaoHoras + 'h restantes',
    duas: [...new Set(d.envolvidos.map(e => (kid(e.kid) || {}).turma))].length > 1
  };
  if(u.papel === 'gestao'){
    oc.chain = [{ nivel:'Gestão', st:'ok', quando:'agora', parecer:'Registrado e encerrado pela gestão.' }];
    oc.status = 'concluido'; oc.prazo = null;
  }
  try {
    await Store.salvarOcorrencia(oc);
    await recarregar();
    S.rascunho = null; S.passo = 1; S.pilha = [];
    ir('home', { guardar:false });
    toast(u.papel === 'gestao' ? `Registro #${id} criado e encerrado` : `Registro #${id} enviado para ciência`);
  } catch(e){ toast(e.message || 'Não consegui salvar.'); }
};

/* ---------------------------------------------------------------- listas */
registrarTela('lista', () => {
  const u = S.conta, v = visiveis(u);
  return `<div class="stack s18">
    <p class="fs12 muted" style="margin:0">${u.papel === 'gestao'
      ? 'A gestão vê todos os registros da escola.'
      : 'Você vê os registros que criou' + (u.papel === 'miss' ? ' e os que passaram pela sua ciência.' : '. Os registros de outras pessoas não aparecem aqui.')}</p>
    <div class="stack s8">${v.length ? v.map(o => itemHTML(o)).join('')
      : vazio('Nenhum registro', 'Assim que houver registros visíveis para você, eles aparecem aqui.')}</div>
    ${rodape()}
  </div>`;
});

registrarTela('ciencia', () => {
  const fila = filaDe(S.conta).slice().sort((a, b) => b.sev - a.sev);
  if(!fila.length) return `<div class="stack s18">
    <div class="notice calm"><span class="ic">&check;</span><div>Nada aguardando a sua ciência.</div></div>${rodape()}</div>`;
  return `<div class="stack s18">
    <p class="fs12 muted" style="margin:0">Ordenado por gravidade. O prazo vem do nível: 4h no nível 3, 24h no nível 2. Vencido, sobe sozinho para a gestão.</p>
    <div class="stack s8">${fila.map(o => itemHTML(o, true)).join('')}</div>
    ${rodape()}
  </div>`;
});

/* ---------------------------------------------------------------- detalhe */
function fotoBloco(o){
  const gestao = S.conta.papel === 'gestao';
  if(o.fotoPurgada) return `<div class="photo" style="border-style:solid">Foto removida pela política de retenção em ${esc(o.fotoPurgada)}<br><span class="fs11">A descrição e a região do corpo permanecem no registro</span></div>`;
  if(o.preservado) return `<div class="photo">1 foto · <b>preservada por decisão da gestão</b><br><span class="fs11">Fora da exclusão automática · acesso em log</span></div>`
    + (gestao ? `<button class="btn ghost sm" style="width:100%;margin-top:8px" onclick="app.preservar('${esc(o.id)}',false)">Voltar à retenção de ${CONFIG.REGRAS.retencaoFotoDias} dias</button>` : '');
  return `<div class="photo">1 foto · visível para a cadeia de ciência e a gestão<br><span class="fs11">Acesso em log · apagada sozinha em ${o.fotoDias || CONFIG.REGRAS.retencaoFotoDias} dias</span></div>`
    + (gestao ? `<button class="btn ghost sm" style="width:100%;margin-top:8px" onclick="app.preservar('${esc(o.id)}',true)">Preservar anexo (exceção)</button>` : '');
}

registrarTela('detalhe', () => {
  const o = S.ocs.find(x => x.id === S.detalhe), u = S.conta;
  if(!o) return vazio('Registro não encontrado', 'Ele pode ter sido removido.');
  const souDestino = filaDe(u).some(x => x.id === o.id);

  return `<div class="stack s18">
    <div>
      <div class="row" style="gap:8px;margin-bottom:7px;flex-wrap:wrap">${sevTag(o.sev)}${statusPill(o)}${o.duas ? '<span class="pill">2 turmas</span>' : ''}</div>
      <h1 style="font-size:19px">${esc(o.tipo)}</h1>
      <p class="fs12 muted" style="margin:4px 0 0">#${esc(o.id)} · ${esc(o.cat)} · ${esc(o.local)} · ${esc(o.quando)}</p>
      <p class="fs12 muted" style="margin:2px 0 0">Registrado por ${esc(o.autor)}${o.presenciou ? ' · presenciou' : ' · informada por ' + esc(o.relator || 'terceiros')}</p>
    </div>

    <div><p class="sec-label">Crianças envolvidas</p><div class="stack s8">
      ${(o.envolvidos || []).map(e => `<div class="card flat">
        <div class="row" style="margin-bottom:6px"><span class="avatar sm">${esc((kid(e.kid)||{}).ini)}</span>
          <b class="fs13 grow">${esc((kid(e.kid)||{}).nome)}</b><span class="pill">${esc(e.papel)}</span></div>
        <div class="fs12 muted">Turma ${esc((kid(e.kid)||{}).turma)} · ${esc(e.cond)}${e.lesao ? ' · marca em ' + esc(e.lesao) : ''}</div>
      </div>`).join('')}</div></div>

    <div><p class="sec-label">Descrição</p><p class="fs13" style="margin:0">${esc(o.desc)}</p></div>

    ${(o.prov || []).length ? `<div><p class="sec-label">Providências</p><div class="chips">
      ${o.prov.map(p => `<span class="chip" style="min-height:30px;padding:5px 11px;font-size:12px">${esc(p)}</span>`).join('')}</div></div>` : ''}

    ${o.foto ? `<div><p class="sec-label">Anexo</p>${fotoBloco(o)}</div>` : ''}

    <div><p class="sec-label">Cadeia de ciência</p><div class="chain">
      ${(o.chain || []).map((c, i) => `<div class="node ${c.st}">
        <div class="gut"><div class="dot ${c.st === 'ok' ? 'ok' : c.st === 'now' ? 'now' : ''}">${c.st === 'ok' ? '&check;' : i+1}</div>${i < o.chain.length-1 ? `<div class="line ${c.st === 'ok' ? 'done' : ''}"></div>` : ''}</div>
        <div class="body"><b class="fs13">${esc(c.nivel)}</b>
          <div class="fs11 muted">${c.st === 'ok' ? 'Ciência em ' + esc(c.quando) : c.st === 'now' ? 'Aguardando' + (o.prazo ? ' · ' + esc(o.prazo) : '') : 'Na fila'}</div>
          ${c.parecer ? `<p class="fs12" style="margin:6px 0 0;padding:8px 10px;background:var(--surface-2);border-radius:9px">${esc(c.parecer)}</p>` : ''}
        </div></div>`).join('')}</div></div>

    ${o.acomp ? `<div class="notice info"><span class="ic">◆</span><div><b>Acompanhamento:</b> ${esc(o.acomp)}</div></div>` : ''}

    ${souDestino ? `<div class="card lift stack s8" style="border-color:var(--accent-text)">
      <p class="sec-label" style="margin:0">Sua ciência</p>
      <div><p class="fs12 muted" style="margin:0 0 6px">Confirme ou corrija a gravidade</p>
        <div class="sevpick">${[1,2,3,4].map(n => `<button data-n="${n}" aria-pressed="${o.sev === n}" onclick="app.mudarSev('${esc(o.id)}',${n})"><b>${n}</b><small>${SEVL[n]}</small></button>`).join('')}</div></div>
      <div class="field"><label for="d-par">Parecer ou orientação (opcional)</label>
        <textarea class="input" id="d-par" style="min-height:66px" placeholder="Volta visível para quem registrou."></textarea></div>
      <button class="btn" onclick="app.darCiencia('${esc(o.id)}')">&check; Dar ciência</button>
      <button class="btn ghost" onclick="app.pedirComplemento('${esc(o.id)}')">Pedir complemento</button>
    </div>` : ''}

    ${u.papel === 'gestao' && !souDestino && o.status !== 'concluido' ? `<div class="card stack s8">
      <button class="btn soft" onclick="app.marcarComunicacao('${esc(o.id)}')">Registrar comunicação com a família</button>
    </div>` : ''}

    ${o.autorLogin === u.login && o.status !== 'concluido' ? `<p class="fs11 muted center" style="margin:0">
      ${(o.chain || []).some(c => c.st === 'ok')
        ? 'Edição encerrada pela ciência. Você ainda pode acrescentar um adendo.'
        : `Editável até a primeira ciência ou por ${CONFIG.REGRAS.travaEdicaoHoras}h.`}</p>` : ''}
    ${rodape()}
  </div>`;
});

async function salvar(o, msg, voltarPara){
  try {
    await Store.salvarOcorrencia(o);
    await recarregar();
    if(voltarPara){ S.detalhe = null; ir(voltarPara, { guardar:false }); }
    toast(msg);
  } catch(e){ toast(e.message || 'Não consegui salvar.'); }
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
  o.chain[i].quando = 'Hoje, ' + agoraHora();
  if(par.trim()) o.chain[i].parecer = par.trim();
  const prox = o.chain.findIndex(c => c.st === 'wait');
  if(prox >= 0){ o.chain[prox].st = 'now'; o.status = 'aguarda_miss'; }
  else {
    o.status = u.papel === 'gestao' ? 'acompanhamento' : 'concluido';
    o.prazo = null;
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

/* ---------------------------------------------------------------- painel */
registrarTela('painel', () => {
  const fila = filaDe(S.conta);
  const porTipo = {};
  S.ocs.forEach(o => { porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1; });
  const tipos = Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = tipos.length ? tipos[0][1] : 1;
  const comDados = S.ocs.length > 0;

  return `<div class="stack s18">
    <div class="tiles">
      <div class="tile"><b>${S.ocs.length}</b><small>registros no sistema</small></div>
      <div class="tile${fila.length ? ' mark' : ''}"><b>${fila.length}</b><small>aguardando ciência</small></div>
      <div class="tile"><b>${S.ocs.filter(o => o.sev >= 3).length}</b><small>níveis 3 e 4</small></div>
      <div class="tile${S.ocs.some(o => o.status === 'acompanhamento') ? ' mark3' : ''}"><b>${S.ocs.filter(o => o.status === 'acompanhamento').length}</b><small>em acompanhamento</small></div>
    </div>

    ${!comDados ? vazio('Ainda sem dados', 'O painel enche conforme os registros entram. Para experimentar agora, carregue os dados de demonstração na aba Usuários.') : `
    <div class="card">
      <p class="sec-label">Quando e onde acontece</p>
      <div class="heat" id="heat">
        <div></div>${HORAS.map(h => `<div class="hh">${h}</div>`).join('')}
        ${HEAT.map(([l, v]) => `<div class="rl">${esc(l)}</div>` + v.map(n => `<div class="cell" data-n="${n}">${n || ''}</div>`).join('')).join('')}
      </div>
      <div class="legend" style="margin-top:10px"><span><i style="background:var(--surface-2)"></i>0</span>
        <span><i style="background:color-mix(in srgb,var(--teal) 44%,var(--surface))"></i>1–2</span>
        <span><i style="background:var(--teal)"></i>3–4</span></div>
      <div class="notice info" style="margin-top:11px"><span class="ic">◆</span>
        <div>Exemplo de leitura: concentração às <b>10h–11h no pátio e no parque</b>. A decisão não é sobre as crianças — é mais um adulto nesse intervalo, ou antecipar o lanche.</div></div>
    </div>

    <div class="card">
      <p class="sec-label">Tipos mais frequentes</p>
      <div class="bars">${tipos.map(([t, n]) => `
        <div><div class="bar-row"><span class="lab">${esc(t)}</span><span class="bar-n">${n}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/max*100)}%"></div></div></div></div>`).join('')}</div>
    </div>

    <div class="card">
      <p class="sec-label">Leitura ética</p>
      <p class="fs12 muted" style="margin:0">Números de processo, não de pessoas. Servem para apoio e formação — nunca para avaliação punitiva, ou a equipe para de registrar.</p>
    </div>`}
    ${rodape()}
  </div>`;
});

posRender.push(() => {
  document.querySelectorAll('#heat .cell').forEach(c => {
    const n = +c.dataset.n;
    c.style.background = n === 0 ? 'var(--surface-2)'
      : `color-mix(in srgb, var(--teal) ${Math.min(24 + n*20, 94)}%, var(--surface))`;
    c.style.color = n >= 3 ? 'var(--accent-ink)' : 'var(--fg)';
  });
});
