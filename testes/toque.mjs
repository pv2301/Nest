/* Tocar na tela como um dedo toca.

   A primeira versão disto fabricava TouchEvent em JavaScript e, se nada os barrasse,
   chamava el.click() por conta própria. Isso aproxima o dedo mas não é o dedo: quem
   decide se um toque vira clique é o navegador, depois de testar o que está debaixo
   do ponto, respeitar o que está por cima, reconhecer se o gesto virou rolagem e só
   então sintetizar o clique. Um teste que pula tudo isso pode passar enquanto um dedo
   real falha — foi o que aconteceu.

   Aqui o toque vai pelo protocolo de depuração do Chromium (Input.dispatchTouchEvent),
   que é a mesma porta por onde um toque de verdade entra. O que passar aqui passa no
   celular; o que falhar aqui falha no celular.

   Precisa de um contexto com hasTouch — os perfis de celular do Playwright já têm. */

/** Abre a sessão de depuração da página. Uma por página basta. */
export async function abrirToque(page){
  const cdp = await page.context().newCDPSession(page);
  return new Toque(page, cdp);
}

class Toque {
  constructor(page, cdp){ this.page = page; this.cdp = cdp; }

  async _pontos(tipo, pontos){
    await this.cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: pontos });
  }

  /** Um toque simples, com a deriva que qualquer dedo tem ao encostar. */
  async tocar(x, y, { deriva = 3, passos = 4, pausa = 16 } = {}){
    await this._pontos('touchStart', [{ x, y }]);
    for(let i = 1; i <= passos; i++){
      await this.page.waitForTimeout(pausa);
      await this._pontos('touchMove', [{ x, y: y + deriva * i / passos }]);
    }
    await this._pontos('touchEnd', []);
  }

  /** Arrasta de verdade: é assim que se puxa a tela para atualizar. */
  async arrastar(x, y, distancia, { passos = 10, pausa = 16 } = {}){
    await this._pontos('touchStart', [{ x, y }]);
    for(let i = 1; i <= passos; i++){
      await this.page.waitForTimeout(pausa);
      await this._pontos('touchMove', [{ x, y: y + distancia * i / passos }]);
    }
    await this._pontos('touchEnd', []);
  }

  /** Toca no centro do elemento, trazendo-o à vista antes.

      A caixa vem do Playwright e não de um querySelector dentro da página: assim
      valem também os seletores do Playwright, como :has-text(), que o navegador não
      entende. */
  async tocarElemento(seletor, opcoes = {}){
    const caixa = await this.caixaVisivel(seletor);
    if(!caixa) return { erro: 'não encontrei ou não está visível: ' + seletor };
    await this.tocar(caixa.x + caixa.largura / 2, caixa.y + caixa.altura / 2, opcoes);
    return caixa;
  }

  /** Onde o elemento está na tela, depois de rolado até aparecer. */
  async caixaVisivel(seletor){
    const loc = this.page.locator(seletor).first();
    if(!(await loc.count())) return null;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const r = await loc.boundingBox();
    if(!r || !r.width || !r.height) return null;
    return { x:r.x, y:r.y, largura:r.width, altura:r.height };
  }
}

/* ---------------------------------------------------------------- instrumentação */

/** Embrulha cada função de window.app num contador.

    É o que permite perguntar "este toque chamou a função certa?" sem escrever uma
    asserção à mão para cada um dos 67 handlers do app. O onclick do elemento diz qual
    app.<função> deveria rodar; depois do toque se confere se rodou. */
export const instrumentar = page => page.evaluate(() => {
  if(window.__chamadas) return Object.keys(window.__chamadas).length;
  window.__chamadas = {};
  window.__erros = [];
  for(const nome of Object.keys(window.app)){
    const f = window.app[nome];
    if(typeof f !== 'function') continue;
    window.app[nome] = function(...args){
      window.__chamadas[nome] = (window.__chamadas[nome] || 0) + 1;
      try { return f.apply(this, args); }
      catch(e){ window.__erros.push(nome + ': ' + e.message); throw e; }
    };
  }
  return Object.keys(window.app).length;
});

export const zerar = page => page.evaluate(() => { window.__chamadas = {}; window.__erros = []; });
export const chamadas = page => page.evaluate(() => window.__chamadas || {});
export const errosDeHandler = page => page.evaluate(() => window.__erros || []);

/** Tudo em que dá para tocar na tela de agora, com o nome da função que cada um
    deveria disparar. */
export const interativos = page => page.evaluate(() => {
  const dentro = document.getElementById('view');
  const alvos = [...document.querySelectorAll(
    '#view [onclick], #view button, #view a[href], #view input, #view textarea, ' +
    '#tabs button, .appbar button')];
  const vistos = new Set();
  return alvos.filter(el => {
    if(vistos.has(el)) return false;
    vistos.add(el);
    return true;
  }).map((el, i) => {
    el.dataset.varredura = 'v' + i;
    const on = el.getAttribute('onclick') || '';
    const m = on.match(/app\.([a-zA-Z_$][\w$]*)/);
    const r = el.getBoundingClientRect();
    return {
      marca: 'v' + i,
      funcao: m ? m[1] : null,
      etiqueta: (el.innerText || el.getAttribute('aria-label') || el.id || el.tagName)
        .trim().slice(0, 40).replace(/\s+/g, ' '),
      tag: el.tagName.toLowerCase(),
      tipo: el.getAttribute('type') || '',
      largura: Math.round(r.width),
      altura: Math.round(r.height),
      desativado: el.disabled === true,
      dentroDaRolagem: !!dentro && dentro.contains(el)
    };
  });
});

/** O elemento está livre no ponto em que se toca, ou tem algo por cima?

    A barra de abas é fixa no rodapé: qualquer coisa no fim da tela pode estar
    embaixo dela, e aí o dedo acerta a barra, não o botão. */
export const coberto = (page, marca) => page.evaluate(m => {
  const el = document.querySelector(`[data-varredura="${m}"]`);
  if(!el) return { erro:'sumiu' };
  el.scrollIntoView({ block:'center' });
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const emCima = document.elementFromPoint(x, y);
  if(!emCima) return { coberto:true, por:'(fora da janela)' };
  if(el.contains(emCima) || emCima.contains(el)) return { coberto:false };
  const q = emCima.closest('.tabbar') ? 'barra de abas'
    : emCima.closest('.appbar') ? 'barra superior'
    : (emCima.className || emCima.tagName);
  return { coberto:true, por:String(q).slice(0, 40) };
}, marca);
