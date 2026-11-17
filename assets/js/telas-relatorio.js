/* Ficha completa da ocorrência, para imprimir ou salvar em PDF.

   Dois modos de identificação, porque são dois destinos diferentes:
   - Interna: todas as crianças nomeadas. Vai para o arquivo da escola.
   - Para a família: só a criança daquela família é nomeada; as demais viram
     "outra criança". É a regra de sigilo do documento em papel — preservar a
     identidade das outras crianças — aplicada por construção, não por disciplina.

   A impressão usa window.print(), que aqui funciona por ser um site comum. O próprio
   navegador oferece "Salvar como PDF", sem nenhuma dependência. */

import { S, app, registrarTela, ir, toast, render, aluno } from './core.js';
import { esc, iniciais, quandoLegivel, SEAL } from './util.js';
import { SEVL } from './dados.js';
import { tipoDe, localDe, quandoTexto } from './telas-registro.js';

app.abrirFicha = id => {
  const o = S.ocs.find(x => x.id === id);
  S.ficha = { id, modo:'interna', focoKid: (o && o.envolvidos && o.envolvidos[0]) ? o.envolvidos[0].kid : null, incluirFoto:false };
  ir('ficha');
};

app.fichaModo = m => { S.ficha.modo = m; render(); };
app.fichaFoco = k => { S.ficha.focoKid = k; render(); };
app.fichaFoto = () => { S.ficha.incluirFoto = !S.ficha.incluirFoto; render(); };
app.imprimirFicha = () => {
  if(typeof window.print !== 'function') return toast('Este navegador não oferece impressão.');
  window.print();
};

/** Nome a exibir conforme o modo. No modo família, só a criança escolhida é nomeada. */
function nomeNaFicha(kid, idx){
  const f = S.ficha;
  if(f.modo === 'interna' || kid === f.focoKid) return aluno(kid).nome;
  return 'Outra criança' + (idx > 0 ? ' ' + String.fromCharCode(64 + idx) : '');
}

registrarTela('ficha', () => {
  const o = S.ocs.find(x => x.id === S.ficha.id);
  if(!o) return `<div class="empty"><div class="big">Registro não encontrado</div></div>`;
  const f = S.ficha;
  const envolvidos = o.envolvidos || [];
  const anonimos = f.modo === 'familia' && envolvidos.length > 1;

  const controles = `
    <div class="naoimprime stack s18">
      <div>
        <p class="sec-label">Para quem é esta ficha</p>
        <div class="stack s8">
          <button class="switch" aria-pressed="${f.modo === 'interna'}" onclick="app.fichaModo('interna')">
            <span class="grow"><span style="display:block;font-size:13px;font-weight:600">Uso interno</span>
            <span class="fs11 muted">Todas as crianças nomeadas. Para o arquivo da escola.</span></span>
            <span class="track"></span></button>
          <button class="switch" aria-pressed="${f.modo === 'familia'}" onclick="app.fichaModo('familia')">
            <span class="grow"><span style="display:block;font-size:13px;font-weight:600">Para a família</span>
            <span class="fs11 muted">Só a criança da família é nomeada; as demais viram "outra criança".</span></span>
            <span class="track"></span></button>
        </div>
      </div>

      ${f.modo === 'familia' && envolvidos.length > 1 ? `<div>
        <p class="sec-label">Qual criança nomear</p>
        <div class="chips">${envolvidos.map(e => `<button class="chip sm" aria-pressed="${f.focoKid === e.kid}" onclick="app.fichaFoco('${esc(e.kid)}')">${esc(aluno(e.kid).nome)}</button>`).join('')}</div>
      </div>` : ''}

      ${o.foto && !o.fotoPurgada ? `<button class="switch" aria-pressed="${f.incluirFoto}" onclick="app.fichaFoto()">
        <span class="grow"><span style="display:block;font-size:13px;font-weight:600">Incluir a foto do anexo</span>
        <span class="fs11 muted">Desmarcado por padrão.</span></span><span class="track"></span></button>` : ''}

      ${anonimos ? `<div class="notice calm"><span class="ic">◆</span><div>
        Na versão impressa, ${envolvidos.length - 1} criança(s) ${envolvidos.length - 1 > 1 ? 'aparecem' : 'aparece'} sem nome.</div></div>` : ''}

      <button class="btn" onclick="app.imprimirFicha()">Imprimir ou salvar em PDF</button>
      <p class="fs11 muted center" style="margin:0">Na janela de impressão, escolha "Salvar como PDF" no destino.</p>
    </div>`;

  const ficha = `
    <article class="ficha">
      <header class="ficha-topo">
        <div class="ficha-selo">${SEAL}</div>
        <div>
          <h1>Registro interno de ocorrência</h1>
          <p>${esc(S.escola.nome || '')}${S.escola.nome ? ' · ' : ''}Documento confidencial · nº ${esc(o.id)}</p>
        </div>
      </header>

      <section>
        <h2>1 · Identificação</h2>
        <dl class="ficha-kv">
          <dt>Categoria</dt><dd>${esc(o.categoria || '—')}</dd>
          <dt>Tipo</dt><dd>${esc(tipoDe(o))}</dd>
          <dt>Gravidade</dt><dd>${o.sev} · ${esc(SEVL[o.sev] || '')}</dd>
          <dt>Data e hora</dt><dd>${esc(quandoTexto(o))}</dd>
          <dt>Local</dt><dd>${esc(localDe(o))}</dd>
          <dt>Registrado por</dt><dd>${esc(o.autor)}</dd>
          <dt>Origem</dt><dd>${o.presenciou ? 'Presenciou o ocorrido'
            : 'Informada por ' + esc((o.informante && o.informante.nome) || '—') +
              ((o.informante && o.informante.canal) ? ' · ' + esc(o.informante.canal) : '')}</dd>
        </dl>
      </section>

      <section>
        <h2>2 · Crianças envolvidas</h2>
        <table class="ficha-tab">
          <thead><tr><th>Criança</th><th>Papel</th><th>Como ficou</th><th>Marca ou lesão</th></tr></thead>
          <tbody>${envolvidos.map((e, i) => `<tr>
            <td>${esc(nomeNaFicha(e.kid, i))}${f.modo === 'interna' && aluno(e.kid).turma ? `<br><span class="ficha-sub">Turma ${esc(aluno(e.kid).turma)}</span>` : ''}</td>
            <td>${esc(e.papel || '—')}</td>
            <td>${esc(e.cond || '—')}</td>
            <td>${esc(e.lesao || '—')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </section>

      <section>
        <h2>3 · Descrição do ocorrido</h2>
        <p class="ficha-texto">${esc(o.desc)}</p>
      </section>

      <section>
        <h2>4 · Providências e intervenções</h2>
        ${(o.prov || []).length ? `<ul class="ficha-lista">${o.prov.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
          : '<p class="ficha-texto">Nenhuma providência registrada.</p>'}
      </section>

      ${o.acomp ? `<section><h2>5 · Comunicação e acompanhamento</h2>
        <p class="ficha-texto">${esc(o.acomp)}</p></section>` : ''}

      <section>
        <h2>${o.acomp ? '6' : '5'} · Ciência</h2>
        <table class="ficha-tab">
          <thead><tr><th>Nível</th><th>Situação</th><th>Parecer</th></tr></thead>
          <tbody>${(o.chain || []).map(c => `<tr>
            <td>${esc(c.nivel)}</td>
            <td>${c.st === 'ok' ? 'Ciência em ' + esc(c.quando || '—') : c.st === 'now' ? 'Aguardando' : 'Na fila'}</td>
            <td>${esc(c.parecer || '—')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </section>

      ${o.foto && f.incluirFoto && !o.fotoPurgada
        ? `<section><h2>Anexo</h2><p class="ficha-texto">1 fotografia da região da lesão, arquivada no sistema.</p></section>` : ''}

      <footer class="ficha-rodape">
        <p>Documento gerado em ${esc(quandoLegivel(new Date().toISOString()))}${f.modo === 'familia' ? ' · versão para a família, com as demais crianças não identificadas' : ' · versão de uso interno'}.</p>
        <p>Registrar fatos observáveis, com linguagem clara, objetiva e respeitosa. Este documento é interno e deve ser acessado apenas por profissionais autorizados.</p>
      </footer>
    </article>`;

  return `<div class="stack s18">${controles}${ficha}</div>`;
});
