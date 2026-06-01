
## 🎨 Desain QR
- **Warna QR:** Hitam (#000000)
- **Background:** Putih (#FFFFFF)
- **Header:** "Pameran Seni Ngawiti 2: Tilas ing Jagad"
- **Footer:** Judul Karya + Nama Seniman
- **Ukuran QR:** {QR_SIZE}x{QR_SIZE} px
- **Error Correction:** High (30% damage tolerance)

## 🖨️ Cara Print
1. Buka folder `{QR_FOLDER}/` di File Explorer
2. Pilih semua file PNG (Ctrl+A)
3. Klik kanan → **Print**
4. Setting printer:
   - Paper size: **A4**
   - Quality: **High / Best**
   - Color: **Color** (meski QR hitam, header/footer butuh warna)
   - Layout: **Multiple pages per sheet** (opsional, untuk hemat kertas)
5. Print

## 📌 Cara Tempel di Pameran
| QR Code | Lokasi Penempatan |
|---------|------------------|
| `qr-utama.png` | Pintu masuk / meja registrasi |
| `qr-index.png` | Peta denah pameran / info booth |
| `qr-XXX-*.png` | Di samping karya yang sesuai (ID cocok) |

## 💡 Tips
- ✅ **Laminating**: Lapisi QR dengan plastik laminating agar tahan lama
- ✅ **Ukuran cetak**: Minimal 5x7 cm agar mudah discan dari jarak 30cm
- ✅ **Pencahayaan**: Pastikan area QR tidak terkena silau/refleksi
- ✅ **Testing**: Scan 3-5 QR acak sebelum print massal

## 🔧 Jika Ada Perubahan Data
- Edit `data.json` → upload ke hosting → **QR tetap bisa dipakai!**
- QR hanya menyimpan URL, konten diambil live dari website.
- Hanya perlu generate ulang jika:
  - Ganti domain/hosting (`BASE_URL`)
  - Ubah `id` karya yang sudah dicetak QR-nya

---
*Dibuat untuk Pameran Seni Ngawiti 2: Tilas ing Jagad*  
*Disporabudpar • 5 Juni 2026*
"""
    
    with open(f"{QR_FOLDER}/README.md", 'w', encoding='utf-8') as f:
        f.write(readme_content)
    print(f"   ✅ {QR_FOLDER}/README.md created")
    
    # ============================================
    # 5. BUAT PREVIEW HTML
    # ============================================
    print(f"\n📌 CREATING PREVIEW HTML...")
    print("-"*70)
    
    html_content = f"""<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview QR - Ngawiti 2</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 20px;
            line-height: 1.5;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        
        header {{
            text-align: center;
            padding: 30px 20px;
            border-bottom: 1px solid #334155;
            margin-bottom: 30px;
        }}
        header h1 {{
            color: #D4AF37;
            font-size: 1.8rem;
            margin-bottom: 8px;
        }}
        header p {{ color: #94a3b8; }}
        
        .qr-main {{
            background: #1e293b;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin-bottom: 40px;
            border: 2px solid #D4AF37;
        }}
        .qr-main img {{
            width: 350px;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }}
        .qr-main p {{ margin-top: 15px; color: #94a3b8; }}
        .qr-main code {{
            display: block;
            margin-top: 10px;
            color: #D4AF37;
            font-family: monospace;
            font-size: 0.9rem;
            word-break: break-all;
        }}
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 20px;
        }}
        
        .card {{
            background: #1e293b;
            border-radius: 10px;
            padding: 15px;
            text-align: center;
            border: 1px solid #334155;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .card:hover {{
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(212, 175, 55, 0.15);
            border-color: #D4AF37;
        }}
        .card img {{
            width: 100%;
            height: auto;
            border-radius: 6px;
            margin-bottom: 12px;
            border: 2px solid #D4AF37;
        }}
        .card h3 {{
            font-size: 0.95rem;
            margin: 8px 0 4px;
            color: white;
            font-weight: 600;
        }}
        .card p {{
            font-size: 0.85rem;
            color: #94a3b8;
        }}
        .badge {{
            display: inline-block;
            background: #D4AF37;
            color: #0f172a;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 8px;
        }}
        
        footer {{
            text-align: center;
            padding: 30px;
            margin-top: 40px;
            border-top: 1px solid #334155;
            color: #64748b;
            font-size: 0.9rem;
        }}
        
        @media print {{
            body {{ background: white; color: black; }}
            .card {{ break-inside: avoid; border: 1px solid #ccc; }}
            .card img {{ border-color: #000; }}
            .badge {{ background: #000; color: white; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎨 Pameran Seni Ngawiti 2: Tilas ing Jagad</h1>
            <p>Preview QR Codes • Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}</p>
        </header>
        
        <div class="qr-main">
            <h2>📱 QR Katalog Utama</h2>
            <img src="qr-utama.png" alt="QR Utama">
            <p>Scan untuk akses seluruh katalog digital</p>
            <code>{BASE_URL}</code>
        </div>
        
        <h2 style="margin: 30px 0 20px; color: #D4AF37;">📄 QR per Karya ({len(data)} karya)</h2>
        <div class="grid">
"""
    
    for karya in data:
        karya_id = karya.get('id')
        title = karya.get('title', 'Tanpa Judul')
        artist = karya.get('artist', 'Seniman')
        year = karya.get('year', '')
        
        # Truncate long titles
        display_title = title if len(title) <= 25 else title[:22] + "..."
        
        safe_title = title.replace(' ', '-').replace('/', '-').replace(':', '').lower()[:30]
        qr_filename = f"qr-{str(karya_id).zfill(3)}-{safe_title}.png"
        
        html_content += f"""
            <div class="card">
                <img src="{qr_filename}" alt="QR {title}">
                <h3>{display_title}</h3>
                <p>{artist}</p>
                <span class="badge">#{karya_id} • {year}</span>
            </div>
"""
    
    html_content += """
        </div>
        
        <footer>
            <p>🖨️ Tips Print: Gunakan kertas A4, kualitas High, laminating untuk daya tahan.</p>
            <p style="margin-top: 10px;">Pameran Seni Ngawiti 2: Tilas ing Jagad • Disporabudpar • 5 Juni 2026</p>
        </footer>
    </div>
</body>
</html>
"""
    
    with open(f"{QR_FOLDER}/preview.html", 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"   ✅ {QR_FOLDER}/preview.html created")
    
    # ============================================
    # SUMMARY
    # ============================================
    print("\n" + "="*70)
    print("✅ GENERATION COMPLETE!")
    print("="*70)
    print(f"""
📊 Summary:
   • Total QR Codes: {len(data) + 2}
   • Main QR: 1 (qr-utama.png)
   • Artwork QRs: {len(data)} (qr-001-*.png s/d qr-080-*.png)
   • Index QR: 1 (qr-index.png)

📁 Files in '{QR_FOLDER}/':
   • qr-utama.png        → Katalog Utama
   • qr-index.png        → Daftar Karya
   • qr-001-*.png        → Karya #1
   • ...
   • qr-080-*.png        → Karya #80
   • README.md           → Panduan print & tempel
   • preview.html        → Preview visual (buka di browser)

🎨 Desain:
   • QR Color: Black (#000000)
   • Background: White (#FFFFFF)
   • Header: "Pameran Seni Ngawiti 2: Tilas ing Jagad"
   • Footer: Judul Karya + Nama Seniman

🖨️ Next Steps:
   1. Buka {QR_FOLDER}/preview.html untuk cek semua QR
   2. Scan 3-5 QR acak untuk testing
   3. Print semua PNG dengan kualitas High
   4. Laminating agar tahan lama
   5. Tempel: qr-utama di pintu masuk, qr-karya di samping karya

✨ Selamat pameran! 🎨🙏
""")

# ============================================
# RUN
# ============================================

if __name__ == "__main__":
    try:
        generate_all_qr_codes()
    except KeyboardInterrupt:
        print("\n\n⚠️  Script dibatalkan oleh user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()