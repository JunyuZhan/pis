#!/bin/bash
# 修复字体文件下载脚本
# 使用正确的 Google Fonts URL

set -e

FONTS_DIR="apps/web/src/app/fonts"
cd "$(dirname "$0")/.."
FONTS_DIR_FULL="$(pwd)/$FONTS_DIR"

echo "PIS 字体文件修复下载"
echo "===================="
echo "目标目录: $FONTS_DIR_FULL"
echo ""

mkdir -p "$FONTS_DIR_FULL"

if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    echo "错误: 需要 curl 或 wget"
    exit 1
fi

download() {
    local filename=$1
    local url=$2
    local force=${3:-false}
    
    if [ "$force" != "true" ] && [ -f "$FONTS_DIR_FULL/$filename" ]; then
        local size=$(stat -f%z "$FONTS_DIR_FULL/$filename" 2>/dev/null || stat -c%s "$FONTS_DIR_FULL/$filename" 2>/dev/null || echo "0")
        # 如果文件小于 5KB，认为是损坏的，需要重新下载
        if [ "$size" -gt 5000 ]; then
            echo "已存在且有效: $filename ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo ${size}B))"
            return 0
        else
            echo "文件可能损坏 ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo ${size}B))，重新下载: $filename..."
        fi
    else
        echo "下载: $filename..."
    fi
    
    if command -v curl &> /dev/null; then
        if curl -L -f -o "$FONTS_DIR_FULL/$filename" "$url" 2>/dev/null; then
            local size=$(stat -f%z "$FONTS_DIR_FULL/$filename" 2>/dev/null || stat -c%s "$FONTS_DIR_FULL/$filename" 2>/dev/null || echo "0")
            echo "  ✓ 成功 ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo ${size}B))"
            return 0
        else
            echo "  ✗ 失败"
            return 1
        fi
    else
        if wget -q -O "$FONTS_DIR_FULL/$filename" "$url" 2>&1; then
            local size=$(stat -f%z "$FONTS_DIR_FULL/$filename" 2>/dev/null || stat -c%s "$FONTS_DIR_FULL/$filename" 2>/dev/null || echo "0")
            echo "  ✓ 成功 ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo ${size}B))"
            return 0
        else
            echo "  ✗ 失败"
            return 1
        fi
    fi
}

echo "正在下载字体文件..."
echo ""

# Inter 字体 (使用 Google Fonts API)
echo "Inter 字体:"
download "Inter-Regular.woff2" "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2" true || true
download "Inter-SemiBold.woff2" "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" true || true
download "Inter-Bold.woff2" "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" true || true

# Noto Serif SC 字体
echo ""
echo "Noto Serif SC 字体:"
# 使用 Google Fonts API 下载（需要指定 subset）
download "NotoSerifSC-Regular.woff2" "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" true || \
download "NotoSerifSC-Regular.woff2" "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400&display=swap" true || true

download "NotoSerifSC-SemiBold.woff2" "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" true || true
download "NotoSerifSC-Bold.woff2" "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" true || true

# Playfair Display 字体
echo ""
echo "Playfair Display 字体:"
download "PlayfairDisplay-Regular.woff2" "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" true || true
download "PlayfairDisplay-SemiBold.woff2" "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" true || true
download "PlayfairDisplay-Bold.woff2" "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" true || true

echo ""
echo "检查文件大小..."
missing=0
check_file() {
    local f=$1
    if [ ! -f "$FONTS_DIR_FULL/$f" ]; then
        echo "✗ 缺失: $f"
        missing=1
    else
        local size=$(stat -f%z "$FONTS_DIR_FULL/$f" 2>/dev/null || stat -c%s "$FONTS_DIR_FULL/$f" 2>/dev/null || echo "0")
        if [ "$size" -lt 5000 ]; then
            echo "⚠ 文件可能损坏: $f ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo ${size}B))"
            missing=1
        else
            echo "✓ $f ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo ${size}B))"
        fi
    fi
}

for f in Inter-Regular.woff2 Inter-SemiBold.woff2 Inter-Bold.woff2 NotoSerifSC-Regular.woff2 NotoSerifSC-SemiBold.woff2 NotoSerifSC-Bold.woff2 PlayfairDisplay-Regular.woff2 PlayfairDisplay-SemiBold.woff2 PlayfairDisplay-Bold.woff2; do
    check_file "$f"
done

echo ""
if [ $missing -eq 0 ]; then
    echo "✓ 所有字体文件已就绪！"
else
    echo "⚠ 部分字体文件缺失或损坏"
    echo ""
    echo "手动下载方式："
    echo "1. 访问 https://google-webfonts-helper.herokuapp.com/"
    echo "2. 搜索并下载以下字体："
    echo "   - Inter (weights: 400, 600, 700)"
    echo "   - Noto Serif SC (weights: 400, 600, 700)"
    echo "   - Playfair Display (weights: 400, 600, 700)"
    echo "3. 选择 woff2 格式"
    echo "4. 将文件放到: $FONTS_DIR_FULL"
fi
