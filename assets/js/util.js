/* Utilitários: escape, ícones, marca, criptografia e validações.
   As validações são funções puras de propósito — são testadas isoladamente. */

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- ícones ---------- */
export const svgIc = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  home:'<path d="M3.2 10.6 12 3.4l8.8 7.2"/><path d="M5.6 9.4V20.2h12.8V9.4"/><path d="M10 20.2v-5.1h4v5.1"/>',
  lista:'<path d="M4 6.5h16"/><path d="M4 12h16"/><path d="M4 17.5h10"/>',
  ciencia:'<path d="M20.4 6.2 9.3 17.4l-5.7-5.7"/>',
  painel:'<rect x="3.2" y="3.2" width="7.2" height="8.4" rx="1.6"/><rect x="13.6" y="3.2" width="7.2" height="5.2" rx="1.6"/><rect x="3.2" y="14.4" width="7.2" height="6.4" rx="1.6"/><rect x="13.6" y="10.8" width="7.2" height="10" rx="1.6"/>',
  usuarios:'<circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4"/><path d="M16.4 5.2a3.4 3.4 0 0 1 0 6.1"/><path d="M18.4 14.9c1.7.7 2.9 2.2 2.9 4.1"/>',
  horario:'<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
  relacoes:'<circle cx="6" cy="6.6" r="2.8"/><circle cx="18" cy="6.6" r="2.8"/><circle cx="12" cy="17.6" r="2.8"/><path d="M8.6 7.8 10.6 15"/><path d="M15.4 7.8 13.4 15"/>',
  digital:'<path d="M12 4.3c-3.1 0-5.6 2.5-5.6 5.6v2.4"/><path d="M12 4.3c3.1 0 5.6 2.5 5.6 5.6v4.4"/><path d="M9.2 9.9a2.8 2.8 0 0 1 5.6 0v6.8"/><path d="M12 9.9v7.6"/><path d="M6.4 15.5v1.6"/><path d="M17.3 17.6a12 12 0 0 1-.5 2.1"/><path d="M7.4 19.9c-.6-1-1-1.9-1-1.9"/>'
};

/* Anéis abertos e desencontrados, como os traços à mão da logo.
   Em tamanho pequeno a letra manual vira borrão, por isso o selo é só de anéis. */
const RINGS = [[18,'var(--fg)',2.3,'101 14',-28],[15.2,'var(--coral)',2.6,'84 12',46],[12.4,'var(--gold)',2.4,'68 10',142],[9.8,'var(--teal)',2.6,'54 8',-104]];
export const SEAL = `<svg class="seal" viewBox="0 0 40 40" aria-hidden="true">
  <circle cx="20" cy="20" r="7.6" fill="var(--mint)"/>
  ${RINGS.map(([r,c,w,d,rot])=>`<circle cx="20" cy="20" r="${r}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${d}" transform="rotate(${rot} 20 20)"/>`).join('')}
</svg>`;

export const RINGBG = `<svg viewBox="0 0 200 200" aria-hidden="true">
  ${[[92,'var(--coral)',3.4,'500 70',-24],[78,'var(--gold)',3.2,'420 60',58],[64,'var(--teal)',3.4,'340 48',158],[50,'var(--mint)',3.2,'270 40',-96]]
    .map(([r,c,w,d,rot])=>`<circle cx="100" cy="100" r="${r}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${d}" transform="rotate(${rot} 100 100)"/>`).join('')}
</svg>`;

/** Rodapé de confidencialidade, ecoando o do formulário em papel.
    O nome vem da configuração — nunca escrito no código. */
export const confRodape = nome =>
  `<div class="conf"><i></i>${esc(nome ? nome + ' · ' : '')}registro interno e confidencial<i></i></div>`;

/* ---------- nomes ---------- */
export function semAcento(s){ return String(s).normalize('NFD').replace(/[̀-ͯ]/g,''); }

/** Normaliza o que a pessoa digita no campo de login, enquanto digita. */
export function normalizaLogin(s){
  return semAcento(String(s)).toLowerCase()
    .replace(/[\s_]+/g,'.')
    .replace(/[^a-z.]/g,'')
    .replace(/\.{2,}/g,'.');
}

/** "Ana Paula Ribeiro" -> "ana.paula" */
export function sugereLogin(nome){
  const p = semAcento(String(nome)).toLowerCase().split(/\s+/).filter(x=>x.length>1);
  if(p.length < 2) return '';
  return normalizaLogin(p[0] + '.' + p[1]);
}

export function iniciais(nome){
  const p = String(nome||'').trim().split(/\s+/).filter(Boolean);
  if(!p.length) return '??';
  return ((p[0][0]||'') + (p.length>1 ? p[p.length-1][0] : (p[0][1]||''))).toUpperCase();
}

export function primeiroNome(nome){
  const p = String(nome||'').trim().split(/\s+/);
  return p.length > 1 ? p[0] + ' ' + p[1] : (p[0] || '');
}

/* ---------- validações ---------- */

/** Login no formato nome.sobrenome: minúsculas, ao menos dois segmentos de 2+ letras. */
export function validaLogin(login){
  const v = String(login || '');
  if(!v) return 'Informe o login.';
  if(!/^[a-z]{2,}(\.[a-z]{2,})+$/.test(v)) return 'Use o formato nome.sobrenome, só com letras minúsculas. Ex.: ana.paula';
  if(v.length > 40) return 'Login muito longo.';
  return null;
}

/** Requisitos avaliados um a um, para a tela poder marcar cada um ao vivo. */
export function requisitosSenha(senha){
  const v = String(senha || '');
  return [
    { id:'tam',   texto:'Pelo menos 8 caracteres',          ok: v.length >= 8 },
    { id:'maius', texto:'Uma letra maiúscula',              ok: /[A-ZÀ-Þ]/.test(v) },
    { id:'minus', texto:'Uma letra minúscula',              ok: /[a-zà-þ]/.test(v) },
    { id:'numes', texto:'Um número ou caractere especial',  ok: /[0-9]/.test(v) || /[^A-Za-zÀ-þ0-9]/.test(v) }
  ];
}

export function validaSenha(senha){
  const faltam = requisitosSenha(senha).filter(r => !r.ok);
  return faltam.length ? 'A senha ainda não atende: ' + faltam.map(r=>r.texto.toLowerCase()).join(', ') + '.' : null;
}

/* ---------- derivação de senha ----------
   A senha nunca sai do aparelho: o navegador deriva uma chave com PBKDF2 e é ela que
   viaja. O servidor guarda apenas um resumo dessa chave com um segredo próprio, então
   nem o backup da planilha revela a senha. O sal vem do login para não ser preciso
   consultar o servidor antes de entrar — o que também evita descobrir quais logins existem. */

const ITERACOES = 150000;
/* Prefixo fixo do sal. Neutro de propósito: entra no cálculo da senha de todo mundo,
   então mudar isto depois invalida todas as senhas já criadas. */
const SAL = 'reg:v1:';

function hex(buf){ return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }

export function criptoDisponivel(){
  return typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.deriveBits === 'function';
}

export async function derivarChave(senha, login){
  if(!criptoDisponivel()) throw new Error('cripto_indisponivel');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(String(senha)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', salt: enc.encode(SAL + String(login)), iterations: ITERACOES, hash:'SHA-256' },
    key, 256
  );
  return hex(bits);
}

/** Resumo local da chave derivada — usado só no modo por aparelho. */
export async function resumoLocal(chave){
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('local|' + chave));
  return hex(bits);
}

export function senhaTemporaria(){
  const maius='ABCDEFGHJKLMNPQRSTUVWXYZ', minus='abcdefghijkmnopqrstuvwxyz', nums='23456789';
  const r = n => crypto.getRandomValues(new Uint32Array(n));
  const v = r(10);
  let s = maius[v[0]%maius.length];
  for(let i=1;i<=6;i++) s += minus[v[i]%minus.length];
  s += nums[v[7]%nums.length];
  s += nums[v[8]%nums.length];
  return s;
}

/* ---------- datas ---------- */
export const agoraHora = () => new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
export const agoraData = () => new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
export const carimbo = () => new Date().toISOString();

export function quandoLegivel(iso){
  if(!iso) return '';
  const d = new Date(iso), hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate()-1);
  const hora = d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(mesmoDia) return 'Hoje, ' + hora;
  if(d.toDateString() === ontem.toDateString()) return 'Ontem, ' + hora;
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ', ' + hora;
}
