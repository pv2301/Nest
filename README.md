# Registro interno de ocorrências

Aplicativo web para a equipe pedagógica registrar ocorrências do dia a dia, com
cadeia de ciência entre assistente, professora e gestão.

Feito para abrir no celular a partir de um link, sem instalar nada e sem exigir
conta Google ou de qualquer outro serviço. Quem recebe o link cria a sua conta e
passa a usar assim que a gestão aprovar.

---

## Como funciona

**Três perfis.** *Assistente* registra o que presenciou. *Miss* (professora) confirma
a gravidade e acrescenta o contexto. *Gestão* toma ciência, comunica a família e
encaminha.

**Cadeia de ciência.** Um registro sobe um nível por vez, e cada nível confirma por
escrito. Quando há crianças de turmas diferentes, a ciência é paralela — uma
professora por turma envolvida — e só depois chega à gestão.

**Conta nova entra pendente.** Qualquer pessoa com o link se cadastra; ninguém vê
nada até a gestão aprovar.

**Funções concedidas uma a uma.** Além do perfil, a gestão liga ou desliga o painel
de estatísticas, o quadro horário e as relações, por usuário.

---

## Os dois modos

| | Modo local | Modo compartilhado |
|---|---|---|
| Quando | `API_URL` vazio em `config.js` | `API_URL` preenchido |
| Onde ficam os dados | No navegador de cada aparelho | Numa planilha do Google, privada |
| Criar conta num celular e aprovar em outro | **Não funciona** | Funciona |
| Para que serve | Ver e validar as telas | Uso real |

No modo local o app mostra uma faixa amarela no topo, para ninguém se enganar.

Para ligar o modo compartilhado: **[backend/README.md](backend/README.md)** —
cerca de 10 minutos, uma vez só.

---

## Publicar o site

O repositório precisa ser **público** (GitHub Pages só publica repositório privado
em planos pagos).

1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** a branch deste projeto, pasta `/ (root)`
4. Salve. Em um ou dois minutos o site fica em
   `https://<usuario>.github.io/<repositorio>/`

Esse é o link para distribuir. No celular, **Adicionar à tela de início** deixa o
app com ícone próprio, em tela cheia.

---

## Estrutura

```
index.html              Casca da página
config.js               ÚNICO arquivo com a identidade da escola e a URL do backend
manifest.webmanifest    Permite instalar na tela de início
assets/
  logo.png              Logo da escola
  css/app.css           Estilos e paleta, derivados da logo
  js/
    util.js             Escape, ícones, validações e derivação de senha
    dados.js            Catálogos do domínio e dados de demonstração
    store.js            Camada de dados: alterna entre modo local e backend
    core.js             Estado, roteamento e render
    telas-auth.js       Entrada, login, cadastro, biometria, configuração inicial
    telas-registro.js   Registro, listas, ciência, detalhe e painel
    telas-gestao.js     Aprovação de contas, perfis e funções
    app.js              Ponto de entrada
backend/
  Codigo.gs             Apps Script do backend
  README.md             Passo a passo da publicação
```

Sem build e sem dependências: são módulos ES servidos direto. Editar um arquivo e
commitar já publica.

---

## Segurança — o que vale saber

**A senha nunca sai do aparelho.** O navegador deriva uma chave com PBKDF2-SHA256
(150.000 iterações) e só ela trafega. O servidor guarda um resumo dessa chave somado
a um segredo próprio, então nem um backup da planilha revela senhas.

**Nada sensível no repositório.** Como ele é público, aqui não há senha, hash, chave
nem segredo. A primeira conta de gestão é criada na primeira vez que o site abre,
protegida por um código que só existe no backend.

**A identidade da escola pode sair do repositório.** `config.js` é o único lugar que
a cita. Esvaziando esses campos e preenchendo a aba `config` da planilha, o nome
passa a vir do backend, que é privado. Ver o passo 7 do
[backend/README.md](backend/README.md).

**Enquanto não houver backend, não use dados reais de crianças.** No modo local tudo
fica no navegador, sem controle de acesso.

---

## Desenvolvimento

Módulos ES não funcionam abrindo o arquivo direto (`file://`). Suba um servidor:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

`localhost` conta como contexto seguro, então as funções de criptografia funcionam.

Para limpar os dados locais do navegador durante os testes, use **Sair da conta** e,
no console, `localStorage.clear()`.
