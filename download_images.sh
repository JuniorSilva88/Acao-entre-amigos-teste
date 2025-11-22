#!/usr/bin/env bash
set -euo pipefail

# Script para baixar imagens públicas do site https://acaoentreamigos.netlify.app
# Ajuste a lista de URLs se algum arquivo mudar no site de origem.

command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 || {
  echo "Erro: é necessário ter curl ou wget instalado." >&2
  exit 1
}

mkdir -p assets

declare -a urls=(
  "https://acaoentreamigos.netlify.app/img/img1.jpeg"
  "https://acaoentreamigos.netlify.app/img/img2.jpeg"
  "https://acaoentreamigos.netlify.app/img/img3.jpeg"
  "https://acaoentreamigos.netlify.app/img/img4.jpeg"
  "https://acaoentreamigos.netlify.app/img/img5.jpeg"
  "https://acaoentreamigos.netlify.app/img/img6.jpeg"
  "https://acaoentreamigos.netlify.app/img/img7.jpeg"
  "https://acaoentreamigos.netlify.app/img/img8.jpeg"
  "https://acaoentreamigos.netlify.app/img/img9.jpeg"
  "https://acaoentreamigos.netlify.app/img/pix.PNG"
  "https://acaoentreamigos.netlify.app/img/cgRefrigeracao.jpeg"
  "https://acaoentreamigos.netlify.app/img/arTecRefrigeracao.jpeg"
  "https://acaoentreamigos.netlify.app/img/bsAutoEstola.jpg"
  "https://acaoentreamigos.netlify.app/img/techPolo.jpeg"
  "https://acaoentreamigos.netlify.app/img/neiDoVolei.jpeg"
  "https://acaoentreamigos.netlify.app/img/c2ar.jpeg"
  "https://acaoentreamigos.netlify.app/img/casaDoFrentista.jpg"
  "https://acaoentreamigos.netlify.app/img/corcini.jpg"
)

echo "Baixando imagens para assets/ ..."
for url in "${urls[@]}"; do
  fname=$(basename "$url")
  out=assets/$fname
  if [[ -f "$out" ]]; then
    echo "Já existe: $fname (pulando)"
    continue
  fi

  echo "-> $fname"
  curl -fsSL "$url" -o "$out" || wget -q -O "$out" "$url" || echo "Falha ao baixar $url"
done

echo "Pronto. Agora você pode rodar: python3 convert_images.py --src assets --out assets"
