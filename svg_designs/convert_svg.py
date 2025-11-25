import os
import sys

try:
    import cairosvg
except ImportError:
    print("Ошибка: Библиотека cairosvg не найдена.")
    print("Установите её командой: pip install cairosvg")
    print("Примечание для Windows: Вам также может понадобиться установить GTK3 Runtime.")
    sys.exit(1)

def convert_all():
    source_dir = '.'
    target_dir = 'png'
    
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)

    files = [f for f in os.listdir(source_dir) if f.endswith('.svg')]
    
    if not files:
        print("SVG файлы не найдены.")
        return

    print(f"Найдено {len(files)} файлов. Начинаю конвертацию...")

    for f in files:
        name = os.path.splitext(f)[0]
        svg_path = os.path.join(source_dir, f)
        png_path = os.path.join(target_dir, f"{name}.png")
        
        try:
            cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=1920, output_height=1080)
            print(f"[OK] {f} -> {png_path}")
        except Exception as e:
            print(f"[ERROR] Не удалось конвертировать {f}: {e}")

if __name__ == "__main__":
    convert_all()




