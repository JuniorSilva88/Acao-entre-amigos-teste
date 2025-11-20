#!/usr/bin/env python3
"""
convert_images.py

Script simples para gerar versões WebP e múltiplas larguras (responsive) a partir das imagens em `assets/`.
Requisitos: Pillow

Uso:
  python3 convert_images.py --src assets --out assets

O script gera arquivos com sufixos: `-800.webp`, `-1200.webp` e versões JPEG `-800.jpg` se não existirem.
"""
import os
import sys
from PIL import Image
import argparse

def ensure_dir(p):
    os.makedirs(p, exist_ok=True)

def process_image(path, outdir, sizes=(800,1200), quality=80):
    name = os.path.splitext(os.path.basename(path))[0]
    try:
        img = Image.open(path)
    except Exception as e:
        print(f"Erro abrindo {path}: {e}")
        return
    for w in sizes:
        # calc height to keep aspect
        ratio = w / img.width
        h = int(img.height * ratio)
        im2 = img.resize((w,h), Image.LANCZOS)
        out_webp = os.path.join(outdir, f"{name}-{w}.webp")
        im2.save(out_webp, 'WEBP', quality=quality, method=6)
        print(f"Gerado: {out_webp}")
        # also save a jpeg fallback if original was jpeg
        out_jpg = os.path.join(outdir, f"{name}-{w}.jpg")
        im2.save(out_jpg, 'JPEG', quality=85)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--src', default='assets', help='pasta com imagens originais')
    p.add_argument('--out', default='assets', help='pasta para salvar as versões')
    args = p.parse_args()
    src = args.src
    out = args.out
    if not os.path.isdir(src):
        print('Pasta de origem não encontrada:', src)
        sys.exit(1)
    ensure_dir(out)
    exts = ('.jpg','.jpeg','.png')
    for fname in os.listdir(src):
        if fname.lower().endswith(exts):
            path = os.path.join(src, fname)
            process_image(path, out)

if __name__ == '__main__':
    main()
