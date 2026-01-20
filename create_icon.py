from PIL import Image, ImageDraw

def create_professional_icon(output_png, output_ico):
    # Base size for design (high res)
    size = 1024
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    padding = 100
    
    # Colors
    bg_color = (30, 30, 30) # Dark grey background for the icon plate
    doc_color = (240, 240, 240)
    primary_blue = (0, 122, 204) # Professional Blue
    secondary_blue = (0, 168, 232)
    accent_color = (0, 100, 180)

    # 1. Background Plate (Rounded Square)
    radius = 150
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=radius,
        fill=bg_color
    )

    # 2. Document Stack (Stylized)
    doc_w = 400
    doc_h = 550
    doc_x = (size - doc_w) // 2
    doc_y = (size - doc_h) // 2 - 20

    # Back paper (shifted)
    draw.rounded_rectangle(
        [doc_x + 30, doc_y - 20, doc_x + doc_w + 30, doc_y + doc_h - 20],
        radius=10,
        fill=(200, 200, 200)
    )
    
    # Front paper
    draw.rounded_rectangle(
        [doc_x, doc_y, doc_x + doc_w, doc_y + doc_h],
        radius=10,
        fill=doc_color
    )

    # 3. Lines on paper (Placeholder for content)
    line_padding = 60
    line_y = doc_y + 100
    for i in range(5):
        draw.line(
            [doc_x + line_padding, line_y, doc_x + doc_w - line_padding, line_y],
            fill=(200, 200, 200),
            width=15
        )
        line_y += 80

    # 4. "Smart" Lens / Magnifying Glass
    lens_radius = 180
    lens_x = doc_x + doc_w - 50
    lens_y = doc_y + doc_h - 50
    
    # Handle
    handle_w = 40
    handle_h = 150
    # draw handle at angle
    # For simplicity, just a thick line
    draw.line(
        [lens_x, lens_y, lens_x + 100, lens_y + 100],
        fill=primary_blue,
        width=50
    )

    # Lens Outer Circle
    draw.ellipse(
        [lens_x - lens_radius, lens_y - lens_radius, lens_x + lens_radius, lens_y + lens_radius],
        fill=primary_blue,
        outline=(255, 255, 255),
        width=10
    )

    # Lens Inner Glare (Glass effect)
    draw.ellipse(
        [lens_x - lens_radius + 20, lens_y - lens_radius + 20, lens_x + lens_radius - 20, lens_y + lens_radius - 20],
        fill=secondary_blue
    )
    
    # Shine
    draw.ellipse(
        [lens_x - 80, lens_y - 80, lens_x - 20, lens_y - 20],
        fill=(255, 255, 255, 180)
    )

    # Save PNG
    image.save(output_png)
    
    # Save ICO (multi-size)
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    image.save(output_ico, format='ICO', sizes=icon_sizes)
    
    print(f"Icon generated: {output_png} and {output_ico}")

if __name__ == "__main__":
    create_professional_icon("icon.png", "icon.ico")
