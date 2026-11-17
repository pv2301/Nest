/* Gestão de usuários: aprovar cadastros, trocar perfis, conceder funções.
   Visível apenas para quem tem papel 'gestao'. */

import { S, app, registrarTela, ir, toast, render, recarregar, rodape, pendentes, otimista } from './core.js';
import { Store } from './store.js';
import { esc, ICON, svgIc, iniciais, quandoLegivel, senhaTemporaria, semAcento } from './util.js';
import { PAPEIS_CONTA, FUNCOES } from './dados.js';

const rotuloPapel = p => (PAPEIS_CONTA.find(x => x.id === p) || {}).nome || p;
const gestoresAtivos = () => S.contas.filter(c => c.papel === 'gestao' && c.status === 'ativo');

function linhaUsuario(c){
  const sel = {
    pendente: '<span class="pill wait">Pendente</span>',
    ativo:    '',
    inativo:  '<span class="pill off">Desativado</span>',
    recusado: '<span class="pill off">Recusado</span>'
  }[c.status] || '';
  return `<button class="urow" onclick="app.abrirUsuario('${esc(c.login)}')">
    <span class="avatar sm">${esc(iniciais(c.nome))}</span>
    <span class="grow">
      <span style="display:block;font-size:13.5px;font-weight:600">${esc(c.nome)}</span>
      <span class="fs11 muted">${esc(c.login)} · ${esc(rotuloPapel(c.papel))}${c.turma ? ' · ' + esc(c.turma) : ''}</span>
    </span>
    ${c.demo ? '<span class="pill demo">demonstração</span>' : ''}${sel}
  </button>`;
}

registrarTela('usuarios', () => {
  const pend = pendentes();
  const ativos = S.contas.filter(c => c.status === 'ativo');
  const outros = S.contas.filter(c => c.status === 'inativo' || c.status === 'recusado');
  return `<div class="stack s18">
    ${pend.length ? `
      <div>
        <p class="sec-label">Aguardando aprovação · ${pend.length}</p>
        <div class="stack s8">${pend.map(c => `
          <div class="card" style="border-color:var(--g2-mark)">
            <div class="row" style="margin-bottom:9px">
              <span class="avatar sm">${esc(iniciais(c.nome))}</span>
              <span class="grow">
                <b class="fs13" style="display:block">${esc(c.nome)}</b>
                <span class="fs11 muted">${esc(c.login)} · pediu ${esc(rotuloPapel(c.papel))}${c.turma ? ' · ' + esc(c.turma) : ''}</span>
              </span>
            </div>
            <p class="fs11 muted" style="margin:0 0 9px">Criada ${esc(quandoLegivel(c.criadoEm))}</p>
            ${c.papel === 'gestao' ? `<div class="notice alert" style="margin-bottom:9px"><span class="ic">!</span><div>
              Pedido de <b>Gestão</b>: dá acesso a todos os registros e ao controle de contas.
              Confirme que é isso mesmo, ou ajuste a função antes.</div></div>` : ''}
            <div class="row" style="gap:8px">
              <button class="btn sm" style="flex:1" onclick="app.aprovar('${esc(c.login)}')">Aprovar</button>
              <button class="btn ghost sm" style="flex:1" onclick="app.abrirUsuario('${esc(c.login)}')">Ajustar antes</button>
              <button class="btn danger sm" onclick="app.recusar('${esc(c.login)}')">Recusar</button>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}

    <div>
      <p class="sec-label">Ativos · ${ativos.length}</p>
      <div class="stack s8">${ativos.length ? ativos.map(linhaUsuario).join('')
        : `<div class="empty"><div class="big">Nenhum usuário ativo ainda</div>
             <p class="fs12" style="margin:0">Quem receber o link cria a conta e aparece aqui para você aprovar.</p></div>`}</div>
    </div>

    ${outros.length ? `<div><p class="sec-label">Desativados e recusados</p>
      <div class="stack s8">${outros.map(linhaUsuario).join('')}</div></div>` : ''}

    <div class="card flat stack s8">
      <p class="sec-label" style="margin:0">Dados de demonstração</p>
      <p class="fs12 muted" style="margin:0">
        Contas de demonstração nascem sem senha: use <b>Redefinir senha</b> na ficha.
      </p>
      <div class="row" style="gap:8px">
        <button class="btn soft sm" style="flex:1" onclick="app.demo(true)">Carregar</button>
        <button class="btn ghost sm" style="flex:1" onclick="app.demo(false)">Limpar</button>
      </div>
    </div>
    ${rodape()}
  </div>`;
});

app.abrirUsuario = login => { S.usuarioSel = login; ir('usuario'); };

app.aprovar = login => patch(login,
  { status:'ativo', aprovadoPor:S.conta.login, aprovadoEm:new Date().toISOString() },
  login + ' aprovado. Já pode entrar.');

app.recusar = login => patch(login, { status:'recusado', aprovadoPor:S.conta.login },
  'Cadastro de ' + login + ' recusado.');

app.demo = async carregar => {
  S.confirmarLimpeza = false;
  try {
    const r = carregar ? await Store.carregarDemo() : await Store.limparDemo();
    await recarregar();
    await atualizarContagemDemo();
    toast(carregar ? 'Dados de demonstração carregados.'
      : `Removidos ${(r && r.total) || 0} registros de demonstração.`);
  } catch(e){ toast(e.message); }
};

export async function atualizarContagemDemo(){
  try { S.contagemDemo = await Store.contarDemo(); } catch { S.contagemDemo = null; }
}

/* ---------------------------------------------------------------- ficha do usuário */
registrarTela('usuario', () => {
  const c = S.contas.find(x => x.login === S.usuarioSel);
  if(!c) return `<div class="empty"><div class="big">Usuário não encontrado</div></div>`;
  const euMesmo = c.login === S.conta.login;
  const ultimoGestor = c.papel === 'gestao' && c.status === 'ativo' && gestoresAtivos().length <= 1;

  return `<div class="stack s18">
    <div class="row">
      <div class="avatar" style="width:46px;height:46px;font-size:15px">${esc(iniciais(c.nome))}</div>
      <div class="grow">
        <h1 style="font-size:17px">${esc(c.nome)}</h1>
        <p class="fs12 muted" style="margin:1px 0 0">${esc(c.login)}</p>
      </div>
      ${c.status === 'pendente' ? '<span class="pill wait">Pendente</span>' : ''}
      ${c.status === 'inativo' ? '<span class="pill off">Desativado</span>' : ''}
    </div>

    ${euMesmo ? `<div class="notice info"><span class="ic">◆</span><div>
      Sua própria conta: perfil e situação não podem ser alterados por você.</div></div>` : ''}
    ${ultimoGestor && !euMesmo ? `<div class="notice info"><span class="ic">◆</span><div>
      Última conta de gestão ativa. Promova outra antes de rebaixar esta.</div></div>` : ''}

    <div>
      <p class="sec-label">Perfil</p>
      <div class="chips">
        ${PAPEIS_CONTA.map(p => `<button class="chip" aria-pressed="${c.papel === p.id}"
          ${euMesmo || (ultimoGestor && p.id !== 'gestao') ? 'disabled style="opacity:.45"' : ''}
          onclick="app.mudarPapel('${esc(c.login)}','${p.id}')">${esc(p.nome)}</button>`).join('')}
      </div>
      ${c.papel !== 'gestao' ? '<p class="hint">Gestão vê todos os registros e aprova contas.</p>' : ''}
    </div>

    <div>
      <p class="sec-label">Turma</p>
      <div class="chips">
        ${S.turmas.map(t => t.nome).map(t => `<button class="chip" aria-pressed="${c.turma === t}"
          onclick="app.mudarTurma('${esc(c.login)}','${esc(t)}')">${esc(t)}</button>`).join('')
          || '<span class="fs12 muted">Cadastre as turmas na aba Alunos.</span>'}
      </div>
    </div>

    <div>
      <p class="sec-label">Funções concedidas</p>
      <div class="stack s8">
        ${FUNCOES.map(f => {
          const herdada = f.id === 'painel' && c.papel === 'gestao';
          const ligada = herdada || (c.funcoes || []).includes(f.id);
          return `<button class="switch" aria-pressed="${ligada}" ${herdada ? 'disabled style="opacity:.6"' : ''}
            onclick="app.alternarFuncao('${esc(c.login)}','${f.id}')">
            <span class="grow">
              <span style="display:block;font-size:13px;font-weight:600">${esc(f.nome)}${f.pronta ? '' : ' <span class="pill" style="font-size:9.5px">em breve</span>'}</span>
              <span class="fs11 muted">${herdada ? 'Incluída no perfil de gestão' : esc(f.desc)}</span>
            </span>
            <span class="track"></span>
          </button>`;
        }).join('')}
      </div>
    </div>

    <div class="card flat">
      <dl class="kv">
        <dt>Situação</dt><dd>${esc(c.status)}</dd>
        <dt>Criada em</dt><dd>${esc(quandoLegivel(c.criadoEm) || '—')}</dd>
        ${c.aprovadoPor ? `<dt>Aprovada por</dt><dd>${esc(c.aprovadoPor)}</dd>` : ''}
      </dl>
    </div>

    ${S.senhaGerada && S.senhaGerada.login === c.login ? `
      <div class="notice calm"><span class="ic">◆</span><div>
        Senha temporária de <b>${esc(c.login)}</b>: <b style="font-size:15px">${esc(S.senhaGerada.senha)}</b><br>
        Anote agora — ela não será mostrada de novo. No primeiro acesso o sistema pede uma nova.
      </div></div>` : ''}

    <div class="stack s8">
      ${c.status === 'pendente' ? `<button class="btn" onclick="app.aprovar('${esc(c.login)}')">Aprovar cadastro</button>` : ''}
      <button class="btn ghost" onclick="app.redefinir('${esc(c.login)}')">Redefinir senha</button>
      ${c.status === 'ativo'
        ? `<button class="btn danger" ${euMesmo || ultimoGestor ? 'disabled' : ''} onclick="app.desativar('${esc(c.login)}',true)">Desativar conta</button>`
        : `<button class="btn soft" onclick="app.desativar('${esc(c.login)}',false)">Reativar conta</button>`}
    </div>
    ${rodape()}
  </div>`;
});

function patch(login, p, msg){
  return otimista(
    () => { const c = S.contas.find(x => x.login === login); if(c) Object.assign(c, p); },
    () => Store.atualizarConta(login, p),
    msg
  );
}

app.mudarPapel = (login, papel) => {
  const c = S.contas.find(x => x.login === login);
  if(!c || c.papel === papel) return;
  const extra = papel === 'gestao' ? { funcoes: [...new Set([...(c.funcoes||[]), 'painel'])] } : {};
  patch(login, { papel, ...extra }, 'Perfil alterado para ' + rotuloPapel(papel) + '.');
};

app.mudarTurma = (login, turma) => {
  const c = S.contas.find(x => x.login === login);
  patch(login, { turma: c && c.turma === turma ? null : turma });
};

app.alternarFuncao = (login, f) => {
  const c = S.contas.find(x => x.login === login);
  if(!c) return;
  const atuais = new Set(c.funcoes || []);
  atuais.has(f) ? atuais.delete(f) : atuais.add(f);
  patch(login, { funcoes: [...atuais] });
};

app.desativar = (login, desativar) =>
  patch(login, { status: desativar ? 'inativo' : 'ativo' },
    desativar ? 'Conta desativada.' : 'Conta reativada.');

app.redefinir = async login => {
  const senha = senhaTemporaria();
  await otimista(
    () => {
      S.senhaGerada = { login, senha };
      const c = S.contas.find(x => x.login === login); if(c) c.trocarSenha = true;
    },
    async () => {
      await Store.redefinirSenha(login, senha);
      await Store.atualizarConta(login, { trocarSenha:true });
    }
  );
};

/* ---------------------------------------------------------------- funções ainda não construídas */
function placeholder(icone, titulo, linhas){
  return `<div class="stack s18">
    <div class="empty">
      <div style="width:60px;height:60px;border-radius:50%;background:var(--accent-soft);color:var(--accent-text);
                  display:grid;place-items:center;margin:0 auto 12px">
        ${svgIc(icone).replace('<svg','<svg width="29" height="29"')}
      </div>
      <div class="big">${esc(titulo)}</div>
      <p class="fs12" style="margin:0 0 14px">Função concedida. A tela ainda será construída.</p>
    </div>
    <div class="card flat">
      <p class="sec-label">O que ela vai trazer</p>
      <div class="stack s6">${linhas.map(l => `<div class="row" style="gap:8px;align-items:flex-start">
        <span style="color:var(--accent-text);flex:none">•</span><span class="fs13 grow">${esc(l)}</span></div>`).join('')}</div>
    </div>
    ${rodape()}
  </div>`;
}

registrarTela('horario', () => placeholder(ICON.horario, 'Quadro horário', [
  'Quem está em qual turma e em qual turno, ao longo da semana',
  'Cobertura por horário, para enxergar os momentos com menos adulto por criança',
  'Cruzamento com o heatmap de ocorrências: os horários críticos lado a lado com a escala'
]));

registrarTela('relacoes', () => placeholder(ICON.relacoes, 'Relações', [
  'Vínculo entre Miss, assistente, turma e crianças',
  'Quem responde pela ciência de cada turma, inclusive nas ausências',
  'Pares de crianças que se envolvem com frequência, para rever agrupamentos'
]));

/* ================================================================
   Alunos e turmas
   Antes eram constantes no código: uma criança nova exigia mexer no
   repositório. Agora a gestão mantém, e o registro passa a ter busca.
   ================================================================ */

const turmaNomes = () => S.turmas.map(t => t.nome);

function alunosFiltrados(){
  const q = semAcento(String(S.buscaAluno || '')).toLowerCase();
  return S.alunos
    .filter(a => !S.filtroTurma || a.turma === S.filtroTurma)
    .filter(a => !q || semAcento(a.nome).toLowerCase().includes(q))
    .sort((a, b) => Number(b.ativo !== false) - Number(a.ativo !== false)
                 || a.nome.localeCompare(b.nome, 'pt-BR'));
}

registrarTela('alunos', () => {
  const lista = alunosFiltrados();
  const avulsos = S.alunos.filter(a => a.avulso).length;
  return `<div class="stack s18">
    ${avulsos ? `<div class="notice info"><span class="ic">◆</span><div>
      ${avulsos} ${avulsos > 1 ? 'crianças aguardam' : 'criança aguarda'} confirmação do cadastro.</div></div>` : ''}

    <div>
      <p class="sec-label">Turmas · ${S.turmas.length}</p>
      <div class="stack s8">
        ${S.turmas.length ? S.turmas.map(t => {
          const n = S.alunos.filter(a => a.turma === t.nome && a.ativo !== false).length;
          const misses = (S.diretorio || []).filter(d => d.papel === 'miss');
          return `<div class="card flat" style="padding:11px 12px">
            <div class="row"><b class="fs13 grow">${esc(t.nome)}</b>
              ${t.demo ? '<span class="pill demo">demonstração</span>' : ''}
              <span class="pill">${n} aluno${n === 1 ? '' : 's'}</span>
              <button class="btn ghost sm" style="padding:4px 9px;min-height:0" onclick="app.removerTurma('${esc(t.id)}')">Remover</button></div>
            <p class="fs11 muted" style="margin:7px 0 5px">Quem recebe a ciência desta turma</p>
            <div class="chips">
              ${misses.length ? misses.map(m => `<button class="chip sm" aria-pressed="${t.missResponsavel === m.login}"
                 onclick="app.missDaTurma('${esc(t.id)}','${esc(m.login)}')">${esc(m.nome)}</button>`).join('')
                : '<span class="fs11 muted">Sem Miss: a ciência vai à gestão.</span>'}
            </div>
          </div>`;
        }).join('') : `<p class="fs12 muted" style="margin:0">Nenhuma turma cadastrada.</p>`}
        <div class="row" style="gap:8px">
          <input class="input" id="t-nova" placeholder="Nome da turma" style="flex:1">
          <button class="btn sm" onclick="app.novaTurma()">Adicionar</button>
        </div>
      </div>
    </div>

    <div>
      <div class="row" style="margin-bottom:8px">
        <p class="sec-label grow" style="margin:0">Alunos · ${S.alunos.filter(a => a.ativo !== false).length}</p>
        <button class="btn sm" onclick="app.novoAluno()">+ Aluno</button>
      </div>
      <div class="stack s8">
        <div class="busca">
          <span class="ic">${svgIc(ICON.busca)}</span>
          <input class="input" id="b-al" placeholder="Buscar pelo nome" value="${esc(S.buscaAluno || '')}"
                 oninput="app.buscaAlunoGestao(this.value)">
        </div>
        ${turmaNomes().length ? `<div class="chips">
          <button class="chip sm" aria-pressed="${!S.filtroTurma}" onclick="app.filtroTurmaGestao('')">Todas</button>
          ${turmaNomes().map(t => `<button class="chip sm" aria-pressed="${S.filtroTurma === t}" onclick="app.filtroTurmaGestao('${esc(t)}')">${esc(t)}</button>`).join('')}
        </div>` : ''}
        ${lista.length ? lista.map(a => `<button class="urow" onclick="app.abrirAluno('${esc(a.id)}')">
          <span class="avatar sm">${esc(iniciais(a.nome))}</span>
          <span class="grow">
            <span style="display:block;font-size:13.5px;font-weight:600">${esc(a.nome)}</span>
            <span class="fs11 muted">${esc(a.turma || 'sem turma')}${a.saude ? ' · ' + esc(a.saude) : ''}</span>
          </span>
          ${a.demo ? '<span class="pill demo">demonstração</span>' : ''}
          ${a.avulso ? '<span class="pill wait">confirmar</span>' : ''}
          ${a.ativo === false ? '<span class="pill off">arquivado</span>' : ''}
        </button>`).join('')
        : `<div class="empty"><div class="big">Nenhum aluno</div><p class="fs12" style="margin:0">Adicione os alunos para que apareçam no registro de ocorrência.</p></div>`}
      </div>
    </div>

    ${blocoDemo()}
    ${rodape()}
  </div>`;
});

/* Tudo que a carga cria fica marcado e aparece com selo. A limpeza apaga só o que
   está marcado — dado real nunca é tocado, nem se tiver nome ou id parecido. */
function blocoDemo(){
  const n = S.contagemDemo || { total:0 };
  const existe = n.total > 0;
  return `<div class="card flat stack s8">
    <p class="sec-label" style="margin:0">Dados de demonstração</p>
    <p class="fs12 muted" style="margin:0">Turmas, alunos, contas e registros fictícios, com o selo
      <span class="pill demo">demonstração</span> na lista. As contas nascem sem senha.</p>
    ${existe ? `<div class="notice info"><span class="ic">◆</span><div>
      Hoje há <b>${n.total}</b> ${n.total === 1 ? 'registro fictício' : 'registros fictícios'} no sistema:
      ${[[n.turmas,'turma','turmas'],[n.alunos,'aluno','alunos'],[n.ocorrencias,'registro','registros'],[n.contas,'conta','contas']]
        .filter(([q]) => q > 0).map(([q, s1, s2]) => `${q} ${q === 1 ? s1 : s2}`).join(', ')}.
      Limpar remove só esses.</div></div>` : ''}
    ${S.confirmarLimpeza ? `<div class="notice alert"><span class="ic">!</span><div>
      Apagar ${n.total} ${n.total === 1 ? 'registro de demonstração' : 'registros de demonstração'}?
      Nada que você criou é afetado.</div></div>
      <div class="row" style="gap:8px">
        <button class="btn danger sm" style="flex:1" onclick="app.demo(false)">Sim, apagar</button>
        <button class="btn ghost sm" style="flex:1" onclick="app.cancelarLimpeza()">Cancelar</button>
      </div>`
    : `<div class="row" style="gap:8px">
        <button class="btn soft sm" style="flex:1" onclick="app.demo(true)">Carregar</button>
        <button class="btn ghost sm" style="flex:1" ${existe ? '' : 'disabled'} onclick="app.pedirLimpeza()">${existe ? 'Limpar' : 'Nada a limpar'}</button>
      </div>`}
  </div>`;
}

app.pedirLimpeza = () => { S.confirmarLimpeza = true; render(); };
app.cancelarLimpeza = () => { S.confirmarLimpeza = false; render(); };

app.buscaAlunoGestao = v => {
  S.buscaAluno = v; render();
  const el = document.getElementById('b-al');
  if(el){ el.focus(); try { el.setSelectionRange(99, 99); } catch {} }
};
app.filtroTurmaGestao = t => { S.filtroTurma = S.filtroTurma === t ? '' : t; render(); };

app.novaTurma = async () => {
  const nome = ((document.getElementById('t-nova') || {}).value || '').trim();
  if(!nome) return toast('Informe o nome da turma.');
  if(S.turmas.some(t => t.nome.toLowerCase() === nome.toLowerCase())) return toast('Essa turma já existe.');
  const t = { id:'t' + Date.now().toString(36), nome, faixa:'' };
  await otimista(() => { S.turmas.push(t); }, () => Store.salvarTurma(t), 'Turma criada.');
};

app.removerTurma = async id => {
  const t = S.turmas.find(x => x.id === id);
  if(!t) return;
  if(S.alunos.some(a => a.turma === t.nome && a.ativo !== false))
    return toast('Há alunos nesta turma. Mova-os antes de remover.');
  await otimista(() => { S.turmas = S.turmas.filter(x => x.id !== id); },
    () => Store.removerTurma(id), 'Turma removida.');
};

/* Com mais de uma Miss na turma, a ciência ia para a primeira encontrada, o que era
   arbitrário. Agora a gestão designa. */
app.missDaTurma = (id, login) => {
  const t = S.turmas.find(x => x.id === id); if(!t) return;
  const novo = t.missResponsavel === login ? '' : login;
  otimista(() => { t.missResponsavel = novo; },
    () => Store.salvarTurma({ ...t, missResponsavel: novo }),
    novo ? 'Ciência da turma ' + t.nome + ' com ' + login : 'Turma sem Miss designada');
};

app.novoAluno = () => { S.alunoSel = { id:'a' + Date.now().toString(36), nome:'', turma:'', nascimento:'', saude:'', ativo:true, novo:true }; ir('aluno'); };
app.abrirAluno = id => { S.alunoSel = { ...S.alunos.find(a => a.id === id) }; ir('aluno'); };

registrarTela('aluno', () => {
  const a = S.alunoSel;
  if(!a) return `<div class="empty"><div class="big">Aluno não encontrado</div></div>`;
  const nRegistros = S.ocs.filter(o => (o.envolvidos || []).some(e => e.kid === a.id)).length;
  return `<div class="stack s18">
    ${a.avulso ? `<div class="notice info"><span class="ic">◆</span><div>
      Adicionada durante um registro. Confira o nome e a turma.</div></div>` : ''}
    <div class="card stack">
      <div class="field"><label for="al-nome">Nome completo</label>
        <input class="input" id="al-nome" value="${esc(a.nome)}"></div>
      <div><p class="fs12" style="font-weight:600;color:var(--muted);margin:0 0 5px">Turma</p>
        <div class="chips">${turmaNomes().map(t => `<button class="chip sm" aria-pressed="${a.turma === t}" onclick="app.alunoCampo('turma','${esc(t)}')">${esc(t)}</button>`).join('')
        || '<span class="fs12 muted">Cadastre uma turma primeiro.</span>'}</div></div>
      <div class="field"><label for="al-nasc">Data de nascimento (opcional)</label>
        <input class="input" type="date" id="al-nasc" value="${esc(a.nascimento || '')}"></div>
      <div class="field"><label for="al-saude">Alergias e observações de saúde (opcional)</label>
        <input class="input" id="al-saude" value="${esc(a.saude || '')}" placeholder="Ex.: alergia a amendoim"></div>
    </div>

    ${!a.novo ? `<div class="card flat"><dl class="kv">
      <dt>Registros</dt><dd>${nRegistros}</dd>
      <dt>Situação</dt><dd>${a.ativo === false ? 'arquivado' : 'ativo'}</dd>
    </dl></div>` : ''}

    <div class="stack s8">
      <button class="btn" onclick="app.salvarAlunoFicha()">${a.novo ? 'Adicionar aluno' : (a.avulso ? 'Confirmar cadastro' : 'Salvar')}</button>
      ${!a.novo ? (a.ativo === false
        ? `<button class="btn soft" onclick="app.arquivarAluno(false)">Reativar</button>`
        : `<button class="btn danger" onclick="app.arquivarAluno(true)">Arquivar aluno</button>`) : ''}
      ${!a.novo ? `<p class="fs11 muted center" style="margin:0">Os registros antigos são preservados.</p>` : ''}
    </div>
    ${rodape()}
  </div>`;
});

app.alunoCampo = (k, v) => {
  /* Guarda o que já foi digitado antes de redesenhar os chips. */
  S.alunoSel.nome = (document.getElementById('al-nome') || {}).value || S.alunoSel.nome;
  S.alunoSel.nascimento = (document.getElementById('al-nasc') || {}).value || S.alunoSel.nascimento;
  S.alunoSel.saude = (document.getElementById('al-saude') || {}).value || S.alunoSel.saude;
  S.alunoSel[k] = S.alunoSel[k] === v ? '' : v;
  render();
};

app.salvarAlunoFicha = async () => {
  const a = S.alunoSel;
  const nome = ((document.getElementById('al-nome') || {}).value || '').trim();
  if(!nome) return toast('Informe o nome do aluno.');
  const dados = {
    id:a.id, nome,
    turma:a.turma || '',
    nascimento:(document.getElementById('al-nasc') || {}).value || '',
    saude:((document.getElementById('al-saude') || {}).value || '').trim(),
    ativo:a.ativo !== false
  };
  await otimista(
    () => {
      const i = S.alunos.findIndex(x => x.id === dados.id);
      if(i >= 0) S.alunos[i] = { ...S.alunos[i], ...dados, avulso:false }; else S.alunos.push(dados);
      ir('alunos', { guardar:false });
    },
    () => Store.salvarAluno(dados),
    a.novo ? 'Aluno adicionado.' : 'Aluno salvo.'
  );
};

app.arquivarAluno = async arquivar => {
  const id = S.alunoSel.id;
  await otimista(
    () => {
      const a = S.alunos.find(x => x.id === id); if(a) a.ativo = !arquivar;
      ir('alunos', { guardar:false });
    },
    () => Store.arquivarAluno(id, arquivar),
    arquivar ? 'Aluno arquivado.' : 'Aluno reativado.'
  );
};
