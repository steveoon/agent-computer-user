# App Icons

This directory contains application icons for different platforms.

## Required Files

| File | Platform | Size | Format |
|------|----------|------|--------|
| `icon.png` | Source | 1024×1024 | PNG (透明背景) |
| `icon.icns` | macOS | 1024×1024 | ICNS (多尺寸打包) |
| `icon.ico` | Windows | 256×256 | ICO (多尺寸打包) |

## How to Generate

### Option 1: Online Tools

1. 准备 1024×1024 PNG 源图 (`icon.png`)
2. macOS `.icns`: https://cloudconvert.com/png-to-icns
3. Windows `.ico`: https://convertico.com/ 或 https://icoconvert.com/

### Option 2: Using electron-icon-builder

```bash
# Install
pnpm add -D electron-icon-builder

# Generate all icons from source PNG
npx electron-icon-builder --input=resources/icons/icon.png --output=resources/icons
```

### Option 3: macOS iconutil (for .icns only)

```bash
# Create iconset directory
mkdir icon.iconset

# Generate all required sizes from source
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# Convert to icns
iconutil -c icns icon.iconset -o icon.icns

# Cleanup
rm -rf icon.iconset
```

## Icon Design Guidelines

- 使用简洁的图形，避免过多细节（小尺寸会模糊）
- 确保透明背景
- macOS 图标建议圆角矩形风格
- Windows 图标可以是任意形状

## After Adding Icons

Icons will be automatically used by electron-builder during packaging.
No additional configuration needed.
