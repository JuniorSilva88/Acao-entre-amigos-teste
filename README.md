# Ação Entre Amigos — Landing Page

Pequeno site para a *5ª Ação Entre Amigos* (doação de brinquedos e Pix).

O que está incluído:
- `index.html` — página principal com SEO e dados estruturados
- `css/styles.css` — estilos responsivos com media queries
- `js/main.js` — interações: copiar Pix e envio do formulário via AJAX
- `submit.php` — handler simples em PHP que grava `data/submissions.csv` e tenta enviar um email

Instalação / testes locais

1) Coloque a imagem do cartaz em `assets/hero.jpg`. Se preferir outro nome, atualize o caminho em `index.html`.

2) Inicie um servidor PHP para testar localmente:

```bash
php -S localhost:8000
```

Depois abra `http://localhost:8000` no navegador.

Otimização de imagens (WebP e responsivo)

1) Coloque as imagens originais (ex.: `hero.jpg`, `img1.jpg`, ...) na pasta `assets/`.
2) Instale dependências Python (recomendado em virtualenv):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3) Rode o script para gerar WebP e versões redimensionadas (agora com opções):

```bash
# gerar as larguras padrão (800 e 1200) com qualidade 80
python3 convert_images.py --src assets --out assets

# gerar larguras customizadas e não gerar fallback JPEG
python3 convert_images.py --src assets --out assets --sizes 600 900 1200 --skip-jpg

# ajustar qualidade WebP
python3 convert_images.py --src assets --out assets --quality 85
```

O script agora preserva orientação EXIF, evita regravações quando a versão já existe e aceita múltiplas larguras e parâmetros de qualidade.

Atualizações no HTML
- `index.html` já usa elementos `<picture>` para preferir WebP quando disponível e fornecer fallback JPEG.
- Adicione os arquivos gerados em `assets/` e verifique as dimensões de `hero-1200.webp` para o Open Graph social.

Download automático das imagens públicas (opcional)

Eu inclui o script `download_images.sh` que baixa imagens públicas encontradas no site atual (netlify). Para usar:

```bash
chmod +x download_images.sh
./download_images.sh
```

Depois rode `python3 convert_images.py --src assets --out assets` para gerar WebP e versões redimensionadas.


Design e tema
- Ajustei a paleta para um azul mais neutro/aconchegante e melhorei o destaque do CTA (botões de Pix) no `css/styles.css`.


Notas de deploy
- O `submit.php` grava em `data/submissions.csv`. Garanta permissão de escrita (ex.: `chmod -R 755 data`).
- Se for hospedar em ambiente sem PHP, posso converter o handler para Python (Flask) ou usar um serviço externo (Formspree, Netlify Forms).

SEO e performance
- `index.html` já inclui meta tags, Open Graph e JSON-LD. Atualize `canonical`, `og:image` e o `startDate` conforme necessário.
- Minify JS/CSS e habilite cache no servidor para produção.

Próximos passos que posso fazer:
- Adicionar animações leves e otimizações de imagem (WebP)
- Implementar versão em Python/Flask em vez de PHP
- Criar workflow CI simples para deploy

Diga como quer prosseguir: ajustar layout, cores, ou eu gero a versão Python/Flask.
