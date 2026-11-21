/* O vocabulário do domínio: as listas fixas que o formulário oferece e os rótulos que
   a tela usa. Nada aqui é dado de escola — alunos e turmas são geridos pela gestão e
   moram no Store. Separado das sementes de demonstração, que são outra coisa: estas
   são as palavras do app, aquelas são conteúdo de exemplo. */

/* Dois perfis: quem registra (Miss) e quem toma ciência e decide (Gestão). */
export const PAPEIS_CONTA = [
  { id:'miss',   nome:'Miss' },
  { id:'gestao', nome:'Gestão' }
];

export const FUNCOES = [
  { id:'painel',   nome:'Painel de estatísticas', desc:'Heatmap, recorrência e qualidade do processo', pronta:true },
  { id:'horario',  nome:'Quadro horário',         desc:'Quem está em qual turma e turno',              pronta:false },
  { id:'relacoes', nome:'Relações',               desc:'Vínculo entre Miss, turma e crianças', pronta:false }
];

/* Categoria é a PRIMEIRA escolha do registro. Acidente, doença e incidente são as três
   que a escola usa no dia a dia; comportamento e rotina ficam separados porque choro
   na despedida não é incidente, e juntá-los esconderia o padrão no painel. */
export const CATS = {
  'Acidente': [
    'Queda', 'Batida / colisão', 'Prensou / entalou', 'Corte / escoriação', 'Queimadura'
  ],
  'Doença': [
    'Febre / mal-estar', 'Vômito', 'Diarreia', 'Reação alérgica', 'Medicação administrada'
  ],
  'Incidente': [
    'Mordida', 'Arranhão', 'Tapa', 'Empurrão', 'Briga', 'Conflito por objeto', 'Exclusão'
  ],
  'Comportamento e emocional': [
    'Choro intenso', 'Desregulação', 'Dificuldade de separação', 'Recusa de atividade', 'Agressão verbal'
  ],
  'Rotina e cuidados': [
    'Alimentação', 'Higiene', 'Sono', 'Banheiro'
  ]
};

/* A ponte entre a categoria e a cor: o sufixo da classe CSS que lhe dá o matiz.
   Existe porque chave de objeto com acento e espaço não vira nome de classe, e
   porque a tradução tem de morar num lugar só — um teste confere que toda categoria
   daqui tem a sua regra .cat-* na folha de estilo. */
export const CAT_ID = {
  'Acidente':                 'acidente',
  'Doença':                   'doenca',
  'Incidente':                'incidente',
  'Comportamento e emocional':'comportamento',
  'Rotina e cuidados':        'rotina'
};

/** Sufixo da classe de cor desta categoria. Sem categoria, nenhum matiz. */
export const catId = c => CAT_ID[c] || '';

export const OUTRO = 'Outro';

/* Exemplo mostrado no campo de descrição, por categoria. É modelo de linguagem de
   fato — o que foi observado, sem interpretar a intenção da criança. */
export const EXEMPLOS = {
  'Acidente': 'Durante o brincar livre no pátio, [criança] correu em direção ao escorregador, tropeçou no degrau e caiu sentada na areia. Chorou por cerca de dois minutos. Apliquei compressa fria no joelho esquerdo e observei a marcha, sem alteração.',
  'Doença': 'Por volta das 10h, [criança] disse estar com dor de cabeça e recusou o lanche. Aferi a temperatura: 37,8 °C. Levei ao espaço de descanso e comuniquei a coordenação, que entrou em contato com a família.',
  'Incidente': 'Durante o brincar livre no pátio, [criança A] e [criança B] disputavam o mesmo balde. [criança B] mordeu a mão direita de [criança A], que chorou por cerca de três minutos. Separei as duas imediatamente, acolhi [criança A] e higienizei o local da mordida.',
  'Comportamento e emocional': 'Na chegada, [criança] chorou na despedida da mãe por cerca de dez minutos, pedindo colo. Foi acolhida no canto da leitura e, após esse período, retornou à roda com o grupo.',
  'Rotina e cuidados': 'No almoço, [criança] recusou o prato principal e comeu apenas a fruta. Ofereci novamente em porção menor, sem insistir. Permaneceu à mesa com o grupo até o fim da refeição.'
};

export const LOCAIS = ['Pátio externo','Sala de aula','Refeitório','Parque de areia','Corredor','Banheiro','Quadra','Entrada / portaria'];

export const PROVIDENCIAS = ['Intervenção imediata','Acolhimento','Higienização','Primeiros cuidados','Mediação do conflito','Orientação pedagógica','Comunicação à coordenação','Observação posterior'];

export const CONDICOES = ['Retornou às atividades','Permaneceu chorosa','Precisou de acompanhamento','Relatou dor/desconforto','Marca/lesão visível'];

export const REGIOES = ['Cabeça / rosto','Braço direito','Braço esquerdo','Mão direita','Mão esquerda','Tronco','Costas','Perna direita','Perna esquerda','Pé direito','Pé esquerdo','Não se aplica'];

/* "Testemunhou" saiu: não se aplica a criança envolvida numa ocorrência. */
export const PAPEIS_ENVOLVIDO = ['Sofreu','Causou','Ambos','Envolvida'];

export const CANAIS_INFORME = ['Presencialmente','Por telefone','Por mensagem ou app','Outro canal'];

export const SEVL = { 1:'Informativo', 2:'Atenção', 3:'Relevante', 4:'Urgente' };

export const PERIODOS = [
  { id:'hoje',   nome:'Hoje',    dias:1 },
  { id:'semana', nome:'Semana',  dias:7 },
  { id:'mes',    nome:'Mês',     dias:30 },
  { id:'sem6',   nome:'6 meses', dias:182 },
  { id:'ano',    nome:'1 ano',   dias:365 }
];

/* Palavras que denunciam julgamento em vez de fato observável. Aviso, nunca bloqueio. */
export const JULGAMENTO = ['agressivo','agressiva','mal-educado','mal educada','malcriado','malcriada','birra','manhoso','manhosa','preguiçoso','chato','chata','sempre','nunca','de propósito','propositalmente','bagunceiro','teimoso','teimosa','difícil','problema','culpa','mentiroso','fingindo','drama','terrível','impossível'];
