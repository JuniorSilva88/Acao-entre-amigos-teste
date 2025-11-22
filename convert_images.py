#!/usr/bin/env python3
"""
convert_images.py

Script para gerar versões WebP e múltiplas larguras (responsive) a partir das imagens em `assets/`.
Requisitos: Pillow

Melhorias:
- preserva orientação via EXIF
- evita regenerar arquivos quando já existem e são mais novos
- aceita parâmetros de qualidade e tamanhos via CLI

Uso:
  python3 convert_images.py --src assets --out assets --sizes 800 1200 --quality 80
"""
import os
import sys
import argparse
from PIL import Image, ImageOps


def ensure_dir(p):
    os.makedirs(p, exist_ok=True)


def should_skip(src_path, out_path):
    if not os.path.exists(out_path):
        return False
    return os.path.getmtime(out_path) >= os.path.getmtime(src_path)


def process_image(path, outdir, sizes=(800, 1200), quality=80, skip_jpg=False):
    name, _ext = os.path.splitext(os.path.basename(path))
    try:
        img = Image.open(path)
    except Exception as e:
        print(f"Erro abrindo {path}: {e}")
        return

    # Apply EXIF orientation if present
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    for w in sizes:
        if img.width <= w:
            # don't upscale; use original width for this size
            w_target = img.width
        else:
            w_target = w

        ratio = w_target / img.width
        h = int(img.height * ratio)
        im2 = img.resize((w_target, h), Image.LANCZOS)

        out_webp = os.path.join(outdir, f"{name}-{w_target}.webp")
        if should_skip(path, out_webp):
            print(f"Pulando (já existe): {out_webp}")
        else:
            try:
                if im2.mode in ("RGBA","LA"):
                     im2.save(out_webp, 'WEBP', quality=quality, method=6, lossless=False)
                else:
                     im2.save(out_webp, 'WEBP', quality=quality, method=6)
                print(f"Gerado: {out_webp}")
            except Exception as e:
                print(f"Erro salvando {out_webp}: {e}")

        if not skip_jpg:
            out_jpg = os.path.join(outdir, f"{name}-{w_target}.jpg")
            if should_skip(path, out_jpg):
                print(f"Pulando (já existe): {out_jpg}")
            else:
                try:
                    # JPEG não suporta alfa — converter para RGB antes de salvar
                    im_jpg = im2.convert("RGB")
                    im_jpg.save(out_jpg, 'JPEG', quality=85, optimize=True, progressive=True)
                    print(f"Gerado: {out_jpg}")
                except Exception as e:
                    print(f"Erro salvando {out_jpg}: {e}")


def main():
    p = argparse.ArgumentParser(description='Gerar WebP e redimensionamentos responsivos')
    p.add_argument('--src', default='assets', help='pasta com imagens originais')
    p.add_argument('--out', default='assets', help='pasta para salvar as versões')
    p.add_argument('--sizes', nargs='+', type=int, default=[800, 1200], help='larguras alvo (px)')
    p.add_argument('--quality', type=int, default=80, help='qualidade WebP (0-100)')
    p.add_argument('--skip-jpg', action='store_true', help='não gerar fallback JPEG')
    args = p.parse_args()

    src = args.src
    out = args.out
    sizes = tuple(sorted(set(args.sizes)))

    if not os.path.isdir(src):
        print('Pasta de origem não encontrada:', src)
        sys.exit(1)
    ensure_dir(out)

    exts = ('.jpg', '.jpeg', '.png')
    for fname in os.listdir(src):
        if fname.lower().endswith(exts):
            path = os.path.join(src, fname)
            process_image(path, out, sizes=sizes, quality=args.quality, skip_jpg=args.skip_jpg)


if __name__ == '__main__':
    main()
