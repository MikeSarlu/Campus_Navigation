# Genera los íconos de la PWA: pin blanco sobre azul (el color de la ruta).
# Uso: python scripts/make-icons.py
from PIL import Image, ImageDraw

BLUE = (0, 64, 193, 255)
WHITE = (255, 255, 255, 255)

def icon(size, maskable=False):
    scale = 4  # dibujar grande y reducir para suavizar bordes
    s = size * scale
    img = Image.new('RGBA', (s, s), BLUE if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not maskable:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BLUE)
    # En los íconos "maskable" el contenido debe caber en el 80 % central.
    k = 0.62 if maskable else 0.78
    cx, cy = s / 2, s * 0.46
    r = s * 0.22 * k / 0.78
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    tip = cy + r * 2.05
    d.polygon([(cx - r * 0.86, cy + r * 0.5), (cx + r * 0.86, cy + r * 0.5), (cx, tip)], fill=WHITE)
    hole = r * 0.42
    d.ellipse([cx - hole, cy - hole, cx + hole, cy + hole], fill=BLUE)
    return img.resize((size, size), Image.LANCZOS)

icon(192).save('public/icons/icon-192.png')
icon(512).save('public/icons/icon-512.png')
icon(512, maskable=True).save('public/icons/icon-maskable-512.png')
icon(180, maskable=True).convert('RGB').save('public/icons/apple-touch-icon.png')
