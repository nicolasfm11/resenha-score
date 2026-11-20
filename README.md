# ResenhaScore

Site para acompanhar a pelada: elenco, estatísticas, placar ao vivo, ranking e histórico de partidas.

## Estrutura de produção

- `src/`: interface React/Vite.
- `netlify/functions/players.mjs`: API de jogadores (`GET`, `POST`, `PUT` e `DELETE`).
- Netlify Blobs: banco persistente do elenco, criado automaticamente no primeiro acesso.
- `netlify.toml`: configuração de build, função e rota da aplicação.

O navegador mantém uma cópia local apenas para a interface abrir no desenvolvimento. Quando publicado na Netlify, o elenco é carregado e alterado pela API e fica compartilhado entre todos os acessos ao site.

## Rodar localmente

Requer Node.js 22 ou superior.

```bash
npm install
npm run dev
```

`npm run dev` inicia só a interface; nesse modo, a tela usa os dados de exemplo locais. Para testar também o banco e as funções antes da publicação, instale a CLI da Netlify e execute `netlify dev`.

## Publicar na Netlify

1. Envie esta pasta para um repositório no GitHub.
2. Na Netlify, escolha **Add new project** e importe o repositório.
3. A Netlify reconhecerá o `netlify.toml`: comando `npm run build` e pasta publicada `dist`.
4. Publique. No primeiro acesso, a função cria o store `resenhascore` com os jogadores de demonstração.

Não é necessário cadastrar URL de banco ou expor chave no frontend: o Netlify Blobs é vinculado ao próprio projeto.

### Proteger alterações no elenco

Sem configuração adicional, qualquer visitante do site consegue cadastrar, editar ou excluir jogadores. Antes de divulgar o link, crie a variável de ambiente `ADMIN_PASSWORD` em **Project configuration > Environment variables** na Netlify e publique novamente. Ao tentar alterar o elenco, o site pedirá essa senha e a manterá somente na sessão atual do navegador.

## API de jogadores

- `GET /.netlify/functions/players` lista o elenco.
- `POST /.netlify/functions/players` cria um jogador.
- `PUT /.netlify/functions/players?id=<id>` edita um jogador.
- `DELETE /.netlify/functions/players?id=<id>` remove um jogador.

Os dados são validados no servidor. Nunca coloque `ADMIN_PASSWORD` no código do frontend ou em arquivos versionados.
