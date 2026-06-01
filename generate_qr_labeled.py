#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QR Code Generator dengan Label - E-Catalog Pameran Seni
- QR hitam
- Header: "Pameran Seni Ngawiti 2: Tilas ing Jagad"
- Footer: Judul Karya + Nama Seniman
"""

import qrcode
import json
import os
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

# ============================================
# KONFIGURASI
# ============================================

# ⚠️ GANTI DENGAN URL HOSTING ANDA
BASE_URL = "https://e-catalogngawiti2.vercel.app/"

# Folder output
QR_FOLDER = "qr_codes_labeled"

# File data
DATA_FILE = "data.json"

# Teks Header (atas QR)
HEADER_LABEL = "Pameran Seni"
HEADER_TEXT = "Ngawiti 2"
HEADER_SUBTEXT = "Tilas ing Jagad"

# Warna
COLOR_BLACK = "#000000"
COLOR_WHITE = "#FFFFFF"
COLOR_GRAY = "#64748b"

# Ukuran
QR_SIZE = 480          # Ukuran QR code (pixels)
PADDING = 42           # Padding dalam gambar
LABEL_MARGIN = 22      # Jarak teks ke QR
FONT_HEADER_SIZE = 28  # Ukuran font header
FONT_TITLE_SIZE = 20   # Ukuran font judul karya
FONT_ARTIST_SIZE = 16  # Ukuran font nama seniman
FONT_SMALL_SIZE = 12   # Ukuran font kecil

# ============================================
# FUNGSI FONT (Support Bahasa Indonesia)
# ============================================

def get_font(size, bold=False):
    """
    Dapatkan font yang tersedia (prioritas: font lokal → system → default)
    """
    # Coba font yang umum tersedia di Windows/Mac/Linux
    font_candidates = [
        "BebasNeue-Bold.ttf",
        "BebasNeue-Regular.ttf",
        "arial.ttf",
        "Arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "Helvetica.ttf",
        "segoeui.ttf",  # Windows Segoe UI
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
        "/System/Library/Fonts/Helvetica.ttc",  # Mac
    ]
    
    for font_path in font_candidates:
        try:
            return ImageFont.truetype(font_path, size)
        except (IOError, OSError):
            continue
    
    # Fallback ke font default (mungkin tidak support unicode penuh)
    try:
        return ImageFont.load_default()
    except:
        return None

# ============================================
# FUNGSI UTAMA: BUAT QR + LABEL
# ============================================

def create_labeled_qr(data, title, artist, filename, qr_size=QR_SIZE):
    """
    Buat gambar QR code dengan:
    - Header di atas: Exhibition title
    - QR code hitam di tengah
    - Footer di bawah: Judul karya + nama seniman
    """
    # 1. Generate QR code (hitam-putih)
    # Generate QR code with dynamic box size for sharper output
    temp_qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=1,
        border=4,
    )
    temp_qr.add_data(data)
    temp_qr.make(fit=True)
    matrix_size = len(temp_qr.get_matrix())
    box_size = max(10, qr_size // (matrix_size + 8))

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=box_size,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    qr_img = qr.make_image(
        fill_color=COLOR_BLACK,
        back_color=COLOR_WHITE
    ).convert("RGB")

    # Resize QR ke ukuran yang diinginkan jika diperlukan
    resample_filter = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
    if qr_img.size != (qr_size, qr_size):
        qr_img = qr_img.resize((qr_size, qr_size), resample_filter)
    
    # 2. Hitung ukuran canvas total
    # Header + QR + Footer + Padding
    font_label = get_font(FONT_SMALL_SIZE, bold=True)
    font_header = get_font(FONT_HEADER_SIZE, bold=True)
    font_subtext = get_font(FONT_ARTIST_SIZE)
    font_title = get_font(FONT_TITLE_SIZE, bold=True)
    font_artist = get_font(FONT_ARTIST_SIZE)
    font_small = get_font(FONT_SMALL_SIZE)
    
    # Buat dummy draw untuk mengukur teks
    dummy = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    
    # Ukur tinggi teks
    label_bbox = dummy.textbbox((0, 0), HEADER_LABEL, font=font_label)
    title_bbox = dummy.textbbox((0, 0), HEADER_TEXT, font=font_header)
    subtext_bbox = dummy.textbbox((0, 0), HEADER_SUBTEXT, font=font_subtext)
    header_height = (label_bbox[3] - label_bbox[1]) + (title_bbox[3] - title_bbox[1]) + (subtext_bbox[3] - subtext_bbox[1]) + 16
    
    # Footer: 2 baris (judul + artist)
    title_bbox = dummy.textbbox((0, 0), title, font=font_title)
    artist_bbox = dummy.textbbox((0, 0), artist, font=font_small)
    footer_height = (title_bbox[3] - title_bbox[1]) + (artist_bbox[3] - artist_bbox[1]) + 18
    
    # Total dimensi
    total_width = qr_size + (PADDING * 2)
    total_height = PADDING + header_height + LABEL_MARGIN + qr_size + LABEL_MARGIN + footer_height + PADDING
    
    # 3. Buat canvas putih
    canvas = Image.new('RGB', (total_width, total_height), COLOR_WHITE)
    draw = ImageDraw.Draw(canvas)
    
    # 4. Gambar Header (tengah atas)
    header_y = PADDING
    # Center text horizontally
    label_bbox = draw.textbbox((0, 0), HEADER_LABEL.upper(), font=font_label)
    label_width = label_bbox[2] - label_bbox[0]
    label_x = (total_width - label_width) // 2
    draw.text((label_x, header_y), HEADER_LABEL.upper(), font=font_label, fill="#8B1A1A")

    const_title_y = header_y + (label_bbox[3] - label_bbox[1]) + 6
    header_bbox = draw.textbbox((0, 0), HEADER_TEXT, font=font_header)
    header_width = header_bbox[2] - header_bbox[0]
    header_x = (total_width - header_width) // 2
    draw.text((header_x, const_title_y), HEADER_TEXT, font=font_header, fill="#8B1A1A")

    subtext_y = const_title_y + (header_bbox[3] - header_bbox[1]) + 4
    subtext_bbox = draw.textbbox((0, 0), HEADER_SUBTEXT.upper(), font=font_subtext)
    subtext_width = subtext_bbox[2] - subtext_bbox[0]
    subtext_x = (total_width - subtext_width) // 2
    draw.text((subtext_x, subtext_y), HEADER_SUBTEXT.upper(), font=font_subtext, fill="#5C4A1E")
    
    # 5. Gambar QR code (tengah)
    qr_y = PADDING + header_height + LABEL_MARGIN
    qr_x = PADDING
    canvas.paste(qr_img, (qr_x, qr_y))
    
    # 6. Gambar Footer (tengah bawah)
    footer_y = qr_y + qr_size + LABEL_MARGIN
    
    # Judul karya (bold, center)
    title_bbox = draw.textbbox((0, 0), title, font=font_title)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (total_width - title_width) // 2
    draw.text((title_x, footer_y), title, font=font_title, fill="#1a1a1a")
    
    # Nama seniman (regular, center, gray)
    artist_y = footer_y + (title_bbox[3] - title_bbox[1]) + 5
    artist_bbox = draw.textbbox((0, 0), artist, font=font_artist)
    artist_width = artist_bbox[2] - artist_bbox[0]
    artist_x = (total_width - artist_width) // 2
    draw.text((artist_x, artist_y), artist, font=font_artist, fill="#5C4A1E")
    
    # 7. Simpan file
    canvas.save(filename, optimize=True, quality=95)
    print(f"✅ {os.path.basename(filename)}")

# ============================================
# FUNGSI GENERATE SEMUA QR
# ============================================

def generate_all_qr_codes():
    """
    Generate semua QR codes dengan label
    """
    print("\n" + "="*70)
    print("🎨 QR CODE GENERATOR (LABELED) - PAMERAN SENI NGAWITI 2")
    print("="*70)
    print(f"\n📁 Base URL: {BASE_URL}")
    print(f"📂 Output folder: {QR_FOLDER}/")
    print(f"🏷️  Header: '{HEADER_TEXT}'")
    
    # Buat folder output
    if not os.path.exists(QR_FOLDER):
        os.makedirs(QR_FOLDER)
        print(f"📁 Folder '{QR_FOLDER}' dibuat")
    
    # Load data.json
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"📄 Data loaded: {len(data)} karya ditemukan\n")
    except FileNotFoundError:
        print(f"❌ Error: File '{DATA_FILE}' tidak ditemukan!")
        return
    except json.JSONDecodeError:
        print(f"❌ Error: File '{DATA_FILE}' tidak valid JSON!")
        return
    
    # ============================================
    # 1. QR UTAMA (KATALOG) - Tanpa footer karya
    # ============================================
    print("\n📌 GENERATING MAIN QR CODE...")
    print("-"*70)
    
    main_url = BASE_URL
    main_qr_file = f"{QR_FOLDER}/qr-utama.png"
    
    # QR utama: header + QR + footer "Katalog Utama"
    create_labeled_qr(
        data=main_url,
        title="Katalog Utama",
        artist="Scan untuk akses semua karya",
        filename=main_qr_file,
        qr_size=350  # Sedikit lebih besar
    )
    print(f"   URL: {main_url}")
    
    # ============================================
    # 2. QR PER KARYA
    # ============================================
    print(f"\n📌 GENERATING {len(data)} ARTWORK QR CODES...")
    print("-"*70)
    
    for i, karya in enumerate(data, 1):
        karya_id = karya.get('id')
        title = karya.get('title', 'Tanpa Judul')
        artist = karya.get('artist', 'Seniman Tidak Diketahui')
        
        # URL untuk karya ini
        artwork_url = f"{BASE_URL}/detail.html?id={karya_id}"
        
        # Nama file: qr-{id:03d}-{safe-title}.png
        safe_title = title.replace(' ', '-').replace('/', '-').replace(':', '').lower()[:30]
        filename = f"{QR_FOLDER}/qr-{str(karya_id).zfill(3)}-{safe_title}.png"
        
        create_labeled_qr(
            data=artwork_url,
            title=title,
            artist=f"oleh {artist}",
            filename=filename,
            qr_size=QR_SIZE
        )
        
        # Progress setiap 10 karya
        if i % 10 == 0:
            print(f"   ⏳ Progress: {i}/{len(data)} karya...")
    
    # ============================================
    # 3. QR INDEX
    # ============================================
    print(f"\n📌 GENERATING INDEX QR CODE...")
    print("-"*70)
    
    index_url = f"{BASE_URL}/index.html"
    index_qr_file = f"{QR_FOLDER}/qr-index.png"
    
    create_labeled_qr(
        data=index_url,
        title="Daftar Karya",
        artist="Kembali ke halaman utama",
        filename=index_qr_file,
        qr_size=300
    )
    print(f"   URL: {index_url}")
    
    # ============================================
    # 4. BUAT README
    # ============================================
    print(f"\n📌 CREATING README FILE...")
    print("-"*70)
    readme_content = f"""# QR Codes Labeled - E-Catalog Ngawiti 2

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Output Folder
- {QR_FOLDER}/

## Files Included
- qr-utama.png : QR utama menuju katalog utama
- qr-index.png : QR index ke daftar karya
- qr-XXX-*.png : QR karya dengan judul dan nama seniman

## Petunjuk
1. Buka folder `{QR_FOLDER}`
2. Cetak file PNG sesuai kebutuhan
3. QR berwarna hitam dan memiliki header event serta footer informasi karya

## Base URL
- {BASE_URL}
"""

    with open(f"{QR_FOLDER}/README.md", 'w', encoding='utf-8') as f:
        f.write(readme_content)
    print(f"   ✅ {QR_FOLDER}/README.md created")


if __name__ == '__main__':
    generate_all_qr_codes()
    