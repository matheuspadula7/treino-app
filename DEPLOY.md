# Deploy automatico (GitHub + Hostinger)

Cada envio para a branch `main` do GitHub atualiza o app no servidor sozinho. Nada de subir arquivos pelo Gerenciador.

## Como as pastas ficam no servidor

```
<pasta da conta>/
  treino-private/          <- fora da pasta publicada, o deploy nunca mexe aqui
    config.php             <- banco, senha do app, chave da IA
    storage/               <- fotos e prints
  public_html/             <- recebe o deploy do GitHub
    api/ css/ js/ icons/ index.html ...
```

O app procura `treino-private` ao lado da pasta publicada. Se nao achar, usa `api/config.php` e `storage/` como antes.

## Migracao (uma vez)

1. Backup: no Gerenciador de Arquivos, compacte e baixe a pasta publicada. No phpMyAdmin, Exportar o banco.
2. Crie a pasta `treino-private` no mesmo nivel da `public_html`.
3. COPIE (nao mova ainda) `public_html/api/config.php` para `treino-private/config.php` e `public_html/storage/` para `treino-private/storage/`.
4. hPanel > Avancado > Git > Conectar com GitHub, autorize so o repositorio `treino-app`, branch `main`, pasta raiz `public_html`, Deploy.
5. Confira: abra o app, entre, e acesse `/api/index.php?r=health`. Deve mostrar config e storage como "privada" e database "ok".
6. So depois de conferir, apague `public_html/api/config.php` e as fotos antigas de `public_html/storage/` (deixe o `.htaccess`).

## Rotina depois da migracao

1. Altero o codigo e envio para o GitHub.
2. A Hostinger publica em segundos (hPanel > Git > Todas as implantacoes mostra o status).
3. No celular, feche e abra o app para pegar a versao nova.

## Se algo der errado

- Hostinger > Git > Todas as implantacoes: veja o ultimo commit publicado.
- Para voltar uma versao, reverta o commit no GitHub e a Hostinger publica de novo.
- Banco ou fotos nunca sao tocados pelo deploy: ficam no MySQL e em `treino-private`.
