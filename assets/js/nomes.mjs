/* Como um nome se escreve.

   Mora num .mjs, e não dentro de util.js, para valer nos dois lados: o navegador
   importa direto, e a API — que é CommonJS e não importa um .js como módulo ES —
   carrega por import dinâmico. Mesma saída de regras.mjs, pelo mesmo motivo.

   Por isso aqui não se importa nada: o arquivo tem de carregar sozinho em qualquer
   um dos dois mundos.

   "maria da silva" digitada às pressas sai impressa num relatório que vai à família.
   O teclado do celular ajuda com autocapitalize, o de computador não tem, e quem não
   passa pela tela não tem nenhum dos dois — então a normalização acontece ao
   gravar, nos dois lados. */

/* Partículas ficam minúsculas quando não abrem o nome: "Maria da Silva", não
   "Maria Da Silva".

   `der` e `den` não entram. "Van Der Berg" está certo como está: ali não há
   preposição portuguesa nenhuma, e rebaixar o que é parte do sobrenome de alguém
   seria estragar o nome em vez de arrumá-lo. */
const PARTICULAS = new Set(['de','da','do','das','dos','e','du','del','di','la','van','von']);

/* Algarismos romanos de nome de turma — "Pré II", "Jardim I".

   VIVI, LILI e IVI também são sequências válidas de I, V e X, então em nome de
   pessoa um romano em minúscula é quase sempre um nome: ali só se preserva o que já
   veio em maiúscula. Em nome de turma a leitura se inverte — ninguém chama uma turma
   de Vivi —, e por isso quem normaliza turma pede `romanos`. A diferença é de
   contexto, e o contexto quem tem é quem chama. */
const ROMANOS = new Set(['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']);

const TEM_DIGITO = /\d/;

export function tituloNome(valor, { romanos = false } = {}){
  const t = String(valor ?? '').trim().replace(/\s+/g, ' ');
  if(!t) return '';

  return t.split(' ').map((bruto, i) => {
    /* Token com dígito é código, não palavra: "3a" é a turma 3A. Vale sempre, porque
       nome de criança não tem algarismo. */
    if(TEM_DIGITO.test(bruto)) return bruto.toLocaleUpperCase('pt-BR');

    if(ROMANOS.has(bruto)) return bruto;
    if(romanos && ROMANOS.has(bruto.toLocaleUpperCase('pt-BR')))
      return bruto.toLocaleUpperCase('pt-BR');

    const baixo = bruto.toLocaleLowerCase('pt-BR');
    if(i > 0 && PARTICULAS.has(baixo)) return baixo;

    /* Baixa tudo primeiro: assim "MARIA" também se acerta. Depois sobe a inicial,
       inclusive depois de apóstrofo e hífen — D'Ávila, Jean-Pierre. */
    return baixo.replace(/(^|['’-])(\p{L})/gu,
      (_, sep, ch) => sep + ch.toLocaleUpperCase('pt-BR'));
  }).join(' ');
}

/** Para frases, não nomes: sobe só a primeira letra. */
export function primeiraMaiuscula(valor){
  const t = String(valor ?? '').trim();
  return t ? t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1) : '';
}
