# Publicação automática das galerias na Locaweb

O painel mantém um rascunho local no navegador. Ao selecionar **Publicar no site**, as imagens WebP são enviadas à API PHP autenticada e `data/galleries.json` é atualizado no servidor. A exportação JSON continua disponível como cópia de segurança. Este guia fica no repositório e não é enviado para a pasta pública pelo fluxo de FTP existente.

## Requisitos

- Hospedagem Locaweb com Apache e PHP 7.4 ou superior.
- Extensão PHP Fileinfo habilitada e suporte a upload de arquivos.
- A autenticação HTTP Basic já configurada em `admin/.htaccess`.
- HTTPS habilitado para o domínio.
- `upload_max_filesize` de pelo menos `5M`, `post_max_size` de pelo menos `6M` e `max_file_uploads` configurado para `1` (a API envia uma imagem por solicitação).

A API fica em `admin/api.php`, sob a mesma proteção HTTP Basic do painel. Ela também exige a identidade autenticada pelo servidor e rejeita solicitações POST de outras origens. Nenhuma senha ou credencial é incluída no JavaScript.

## Instalação por FTP

1. Faça uma cópia de segurança do `data/galleries.json` atual e dos arquivos existentes em `assets/`.
2. Envie os arquivos desta implementação, preservando a estrutura:
   - `admin/api.php`, `admin/admin.js`, `admin/admin.css` e `admin/index.html`;
   - `admin/.publish-staging/.htaccess`;
   - `assets/gallery/.htaccess`;
   - `data/.publish/.htaccess`;
   - `js/main.js`.
3. Mantenha `admin/.htaccess` e o `.htpasswd` já configurados. Não publique o `.htpasswd` dentro de `public_html`. A API herda a autenticação de `admin/`; não é necessário gravar credenciais no front-end.
4. Confirme que as pastas `admin/.publish-staging/`, `assets/gallery/` e `data/.publish/` existem após o envio. Os arquivos `.htaccess` incluídos impedem acesso HTTP às áreas temporárias e limitam a pasta de imagens.
5. Configure as permissões conforme a seção abaixo. Não altere permissões de outras pastas do site.
6. Acesse `https://iluminandofuturos.com.br/admin/` por HTTPS, entre com as credenciais existentes, adicione uma imagem e publique uma alteração de teste.
7. Confira a galeria pública em uma nova aba ou janela. A página solicita o JSON sem reutilizar o cache do navegador.

O repositório já possui um fluxo de FTP automático no GitHub Actions quando há push para `main`. Revise as alterações e confirme o destino antes de fazer esse push; esta implementação não altera nem executa a configuração de produção por conta própria.

## Permissões

O processo PHP precisa ler e gravar em:

| Caminho | Uso | Permissão recomendada |
|---|---|---|
| `assets/gallery/` | Imagens WebP publicadas | `0755` quando PHP e FTP usam o mesmo proprietário; caso contrário, `0775` com grupo corretamente configurado |
| `admin/.publish-staging/` | Imagens temporárias, protegidas por autenticação e `.htaccess` | `0755` para o proprietário PHP; `0775` apenas se necessário via grupo |
| `data/.publish/` | Arquivo temporário e lock da publicação; acesso HTTP negado | `0755` para o proprietário PHP; `0775` apenas se necessário via grupo |
| `data/` e `data/galleries.json` | Substituição atômica do JSON publicado | O processo PHP precisa gravar na pasta e no arquivo; o JSON final permanece legível publicamente |

Use o proprietário ou grupo da conta da hospedagem. **Não use `0777`**. Se a API retornar erro de permissão, verifique o usuário efetivo do PHP e ajuste somente os caminhos acima pelo painel/FTP ou com o suporte da Locaweb.

## Limites e comportamento

- Cada imagem deve ser WebP válido, ter no máximo **5 MB** e dimensões máximas de **1440 × 1440 px**. O painel converte imagens para WebP no navegador.
- Uma solicitação envia uma imagem por vez. No máximo **250 imagens temporárias** aguardam publicação; arquivos temporários com mais de 24 horas são removidos na próxima chamada à API.
- Uma publicação aceita até **50 galerias**, **100 imagens por galeria** e **250 imagens no total**.
- Os nomes publicados são gerados no servidor; o nome enviado pelo navegador não é usado como caminho.
- A publicação compara uma revisão do JSON para não sobrescrever alterações feitas por outra sessão. Se houver conflito, baixe uma cópia do rascunho e use **Descartar alterações locais** para carregar a versão atual antes de reaplicar mudanças.
- O JSON é gravado em uma pasta privada e substituído por rename atômico. Se a escrita falhar, o JSON anterior permanece; novas imagens copiadas para a pasta pública durante a tentativa são removidas.
- Ao concluir uma publicação, imagens geradas pelo painel que não aparecem mais em nenhuma galeria são removidas. Imagens existentes fora de `assets/gallery/` não são apagadas.

## Testes locais

Com PHP CLI instalado, na raiz do repositório:

```sh
php -l admin/api.php
php -l .github/tests/gallery-api.php
php .github/tests/gallery-api.php
node .github/tests/admin-panel.js
node --check admin/admin.js
node --check js/main.js
git diff --check
```

O teste PHP cria uma cópia temporária isolada do JSON e das imagens necessárias; não altera `data/galleries.json` nem `assets/` do projeto. O teste simula `REMOTE_USER` no servidor PHP local e não valida a configuração Apache/Basic Auth da Locaweb, que precisa ser conferida pelo checklist da hospedagem.

## Checklist antes de publicar na hospedagem

- [ ] Confirmar PHP 7.4+ e Fileinfo no painel Locaweb.
- [ ] Manter a autenticação em `admin/.htaccess` e testar o painel somente por HTTPS.
- [ ] Enviar os três `.htaccess` necessários, incluindo os de `.publish-staging/`, `assets/gallery/` e `data/.publish/`.
- [ ] Confirmar que uma chamada anônima a `admin/api.php` recebe `401`, que POST de outra origem é recusado e que o painel autenticado consegue carregar as galerias.
- [ ] Confirmar as permissões mínimas necessárias sem usar `0777`.
- [ ] Fazer uma publicação de teste com uma imagem e conferir o novo arquivo WebP em `assets/gallery/`.
- [ ] Renomear galeria, editar texto alternativo e remover imagem; publicar e conferir no site.
- [ ] Confirmar que uma publicação inválida ou com revisão desatualizada não substitui o JSON anterior.
- [ ] Manter uma cópia de segurança do JSON antes da primeira publicação.

## Diagnóstico rápido

- **401 / autenticação solicitada:** confirme `admin/.htaccess`, o caminho privado do `.htpasswd` já configurado e o acesso por HTTPS.
- **413 / imagem excede limite:** use uma imagem menor; confirme também `upload_max_filesize` e `post_max_size` na hospedagem.
- **415 / WebP inválido:** selecione novamente a imagem no painel; o servidor valida o MIME real e a estrutura da imagem, não apenas a extensão.
- **500 / falha ao gravar:** confira Fileinfo, permissões de `assets/gallery/`, `data/`, `data/galleries.json` e `data/.publish/`. O JSON anterior deve continuar disponível.
- **409 / versão alterada:** baixe uma cópia do rascunho se necessário, carregue a versão publicada atual no painel e reaplique as mudanças.
