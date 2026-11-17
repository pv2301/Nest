# Backend — Apps Script + Planilha

Sem este backend o site funciona, mas em **modo local**: cada aparelho guarda as
próprias contas, e um cadastro feito no celular da professora não aparece para a
gestão em outro aparelho.

Com o backend ligado, o ciclo **criar conta → gestão aprovar → entrar** funciona de
verdade entre aparelhos diferentes, e quem usa não precisa de conta Google nem de
conta Claude — só do link.

São cerca de 10 minutos, uma vez só.

---

## 1. A planilha

A planilha já foi criada no seu Drive com o nome
**Registros de Ocorrências — banco de dados** (o link está na conversa). Ela está
vazia de propósito: o passo 3 cria as abas e os cabeçalhos sozinho.

Se preferir criar você mesmo, abra <https://sheets.new> com a conta que vai guardar
os dados e siga daqui.

> **Qual conta usar.** Dado de comportamento e saúde de criança não deve ficar numa
> conta pessoal. O ideal é uma conta institucional da escola (ou, sem Workspace, uma
> conta Google criada só para o sistema, com a senha no cofre da escola e verificação
> em duas etapas ativa). Dá para migrar depois transferindo a propriedade do arquivo,
> mas é bem mais simples começar já na conta certa.

## 2. Colar o código

1. Na planilha: **Extensões → Apps Script**.
2. Apague o conteúdo de `Código.gs` e cole todo o conteúdo de
   [`Codigo.gs`](./Codigo.gs) deste repositório.
3. Salve (ícone de disquete).

## 3. Preparar a planilha e os segredos

1. No editor, escolha a função **`prepararPlanilha`** na lista e clique em **Executar**.
2. Autorize quando o Google pedir (é o seu próprio script acessando a sua planilha).
3. Abra **Ver → Registro de execução**: ele mostra o `CODIGO_CONFIG`, um número de 6
   dígitos. **Anote**: é ele que libera a criação da primeira conta de gestão.

Isso cria as abas `contas`, `alunos`, `turmas`, `ocorrencias`, `sessoes`, `log` e
`config`, e gera dois segredos em **Configurações do projeto → Propriedades do
script**:

| Propriedade | Para que serve |
|---|---|
| `PEPPER` | Segredo do servidor somado à senha antes de guardar. Nunca compartilhe e nunca mude depois — mudar invalida todas as senhas. |
| `CODIGO_CONFIG` | Código de uso único para criar a primeira conta de gestão. Depois disso pode ser apagado. |

## 4. Publicar como Web App

1. **Implantar → Nova implantação → Tipo: App da Web**.
2. Preencha:
   - **Executar como:** Eu *(a sua conta)*
   - **Quem pode acessar:** **Qualquer pessoa**
3. **Implantar** e copie a **URL do app da Web** — termina em `/exec`.

> "Qualquer pessoa" é necessário porque as professoras não têm conta Google no
> sistema. Quem controla o acesso é o login do app, não o Google. A planilha
> continua privada: ninguém a abre, só o script escreve nela.

## 5. Ligar o site ao backend

No arquivo [`config.js`](../config.js) deste repositório, cole a URL:

```js
API_URL: 'https://script.google.com/macros/s/AKfy...../exec',
```

Faça o commit. O GitHub Pages republica em um ou dois minutos. A faixa amarela
"modo local" some do topo do app — é assim que você confirma que ligou.

## 6. Criar a primeira conta de gestão

Abra o site. Como ainda não existe gestão, ele mostra **Configuração inicial**.
Preencha nome, login (`nome.sobrenome`), senha e o `CODIGO_CONFIG` do passo 3.

Essa conta aprova todas as outras. A partir daí, qualquer pessoa com o link cria a
sua conta e fica pendente até a gestão aprovar.

## 7. (Opcional) Tirar o nome da escola do repositório

O repositório é público. Para a identidade não ficar visível nele:

1. Na planilha, na aba `config`, crie as linhas:

   | chave | valor |
   |---|---|
   | `escolaNome` | nome da escola |
   | `escolaSubtitulo` | Registro interno de ocorrência |
   | `escolaLogo` | URL da logo, ou deixe em branco |

2. Em `config.js`, esvazie os campos de `ESCOLA`.

O app passa a buscar a identidade do backend, que é privado.

## 8. (Opcional) Limpeza automática

Em **Acionadores → Adicionar acionador**, aponte para `manutencaoDiaria`, baseado em
tempo, diariamente. Ele apaga sessões vencidas.

---

## Atualizar o código depois

Edite no editor do Apps Script e use **Implantar → Gerenciar implantações → Editar
→ Versão: Nova versão**. Mantendo a mesma implantação, a URL não muda e nada precisa
ser alterado no site.

---

## Sobre a segurança deste desenho

**A senha nunca chega ao servidor.** O navegador deriva uma chave com PBKDF2-SHA256,
150.000 iterações, e envia apenas essa chave. O servidor guarda `SHA-256(chave +
PEPPER)`. Quem baixar a planilha não recupera as senhas; quem obtiver a planilha
*e* o `PEPPER` ainda precisa quebrar o PBKDF2.

**O que este desenho não resolve**, e convém saber:

- O trânsito depende do HTTPS do Google — sem ele, a chave derivada funcionaria como
  senha para quem interceptasse.
- Não há verificação de e-mail: qualquer pessoa com o link cria um cadastro. O
  controle é a aprovação da gestão, que deve conferir se conhece a pessoa.
- Não há limite de tentativas de login. Para o tamanho de uma escola é aceitável;
  se virar problema, dá para contar tentativas por login na aba `log`.
- O `log` registra quem fez o quê, mas quem tem acesso à planilha pode editá-lo.

Para o uso pretendido — registro interno de uma escola pequena, com uma gestão que
conhece a equipe — esse conjunto é adequado. Para dado de criança em escala maior, o
caminho é um banco de verdade com autenticação gerenciada.
