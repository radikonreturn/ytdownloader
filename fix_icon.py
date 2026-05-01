from PIL import Image
import sys

try:
    img = Image.open("app-icon.png")
    img.save("app-icon-fixed.png", "PNG")
    print("Success")
except Exception as e:
    print(f"Error: {e}")
