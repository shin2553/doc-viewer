from PIL import Image

def finalize_ico(png_source, output_ico):
    image = Image.open(png_source)
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    image.save(output_ico, format='ICO', sizes=icon_sizes)
    print(f"Final icon.ico generated from {png_source}")

if __name__ == "__main__":
    finalize_ico("icon.png", "icon.ico")
