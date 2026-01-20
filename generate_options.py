from PIL import Image, ImageDraw, ImageFilter

def create_button_gradient(draw, rect, color_start, color_end):
    """Draws a vertical gradient."""
    for i in range(rect[1], rect[3]):
        # Calculate ratio
        ratio = (i - rect[1]) / (rect[3] - rect[1])
        r = int(color_start[0] * (1 - ratio) + color_end[0] * ratio)
        g = int(color_start[1] * (1 - ratio) + color_end[1] * ratio)
        b = int(color_start[2] * (1 - ratio) + color_end[2] * ratio)
        draw.line([rect[0], i, rect[2], i], fill=(r, g, b))

def create_option_1(filename):
    """Option 1: Modern Folder & Document (Professional & Trusted)"""
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Layered Folder
    # Back flap
    draw.rounded_rectangle([150, 200, 874, 800], radius=50, fill=(0, 90, 160))
    # Tab
    draw.rounded_rectangle([150, 150, 450, 250], radius=30, fill=(0, 90, 160))
    
    # Document inside
    draw.rounded_rectangle([250, 100, 774, 700], radius=20, fill=(245, 245, 245))
    # Lines on document
    for i in range(180, 600, 60):
        draw.line([320, i, 700, i], fill=(200, 200, 200), width=10)

    # Front flap with gradient
    front_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(front_img)
    f_draw.rounded_rectangle([150, 300, 874, 874], radius=50, fill=(0, 122, 204))
    img.alpha_composite(front_img)
    
    img.save(filename)

def create_option_2(filename):
    """Option 2: The Indigo Insight (Modern, Abstract, Smart)"""
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Rounded Square Base
    draw.rounded_rectangle([128, 128, 896, 896], radius=180, fill=(45, 45, 48))
    
    # Centered 'S' for Smart or Document symbol
    # Let's do a glowing document outline
    draw.rounded_rectangle([300, 250, 724, 774], radius=40, outline=(0, 168, 232), width=40)
    
    # Inner "Pulse" or Spark
    draw.ellipse([450, 450, 574, 574], fill=(0, 255, 255))
    
    img.save(filename)

def create_option_3(filename):
    """Option 3: The Crystal Lens (Clean, Minimalist, Viewer Focus)"""
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background
    draw.rounded_rectangle([128, 128, 896, 896], radius=200, fill=(0, 122, 204))
    
    # Large Document Grid
    for x in range(300, 800, 150):
        for y in range(300, 800, 150):
            draw.rounded_rectangle([x, y, x+100, y+100], radius=10, fill=(255,100,0)) # Color chips

    # Overlay Glass Lens (Glassmorphism effect)
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    o_draw = ImageDraw.Draw(overlay)
    o_draw.ellipse([200, 200, 824, 824], fill=(255, 255, 255, 60), outline=(255, 255, 255, 150), width=10)
    img.alpha_composite(overlay)

    img.save(filename)

if __name__ == "__main__":
    create_option_1("option_1_folder.png")
    create_option_2("option_2_smart.png")
    create_option_3("option_3_lens.png")
    print("Generated 3 icon options successfully.")
