# 🎲 Tavla Turnuvası - Çekilişler Sistemi

Canlı yayın için web tabanlı, gösterişli tavla turnuvası çekilişi sistemi!

## 🎯 Özellikler

✨ **Web Tabanlı**: GitHub Pages'de barındırılabilir
📅 **Tarih Bazlı**: Belirlenen tarihlerde otomatik çekilişler
🎮 **Canlı Eşleştirmeler**: Gerçek zamanlı maç takibi
🏆 **Puan Tablosu**: Otomatik skor hesaplama
📊 **Multi-Tur Sistemi**: Ardışık turlar ve winner bracket
💾 **JSON Depolama**: LocalStorage'de veri saklama
🎨 **Gösterişli UI**: Animasyonlar ve canlı sayaçlar
📥 **Veri İthalatı/İhracatı**: JSON dosyaları ile veri yönetimi

## 🚀 Kullanım

### 1. Sayfayı Açma
`index.html` dosyasını bir web tarayıcısında açın.

### 2. Katılımcı Ekleme
- **Yönetim** sekmesine gidin
- Katılımcı adları girin ve ekleyin
- Maksimum 30+ katılımcı desteklenir

### 3. Turnuva Turlarını Oluşturma
- **data.json** dosyasını düzenleyin veya
- Yönetim panelinden turnuva tarihlerini ayarlayın
- Her tur için çekilişi yapılacak tarihi belirleyin

### 4. Çekilişler
- Sistem, belirlenen tarihte otomatik olarak eşleştirmeler yapar
- Varsa bildirimleri alırsınız 🔔
- Sayfayı açık tutun, sistem her 10 saniyede kontrol eder

### 5. Sonuçlar
- Maç sonuçlarını **Yönetim** bölümünden girin
- Sistem otomatik olarak skor tablosunu güncelleyen

### 6. Galipler
- Tur tamamlandıktan sonra otomatik olarak sonraki tur oluşturulur
- Galipleri seçip yazıp, bir sonraki çekiliş için hazırlayın
- Sistem kazananları otomatik olarak ileri turlara taşır

## 📁 Dosya Yapısı

```
tavla_cekilis/
├── index.html       # Ana HTML sayfası
├── style.css        # Gösterişli tasarım
├── app.js           # Ana JavaScript mantığı
├── data.json        # Turnuva ve katılımcı verileri
└── README.md        # Bu dosya
```

## 📊 JSON Yapısı

```json
{
  "name": "Tavla Turnuvası",
  "currentRound": 1,
  "participants": [
    {
      "id": 1,
      "name": "Katılımcı Adı",
      "wins": 0,
      "losses": 0,
      "eliminated": false
    }
  ],
  "rounds": [
    {
      "id": 1,
      "name": "1. Tur",
      "drawDate": "2026-04-05T20:00:00Z",
      "completed": false,
      "matches": [
        {
          "id": 1,
          "player1Id": 1,
          "player2Id": 2,
          "result": {
            "player1Score": 15,
            "player2Score": 10,
            "winner": 1
          }
        }
      ]
    }
  ]
}
```

## 🎨 Özelleştirme

### Renkler Değiştirme
`style.css` dosyasında renk kodlarını değiştirin:
- `#667eea` - Ana renk (mor/mavi)
- `#764ba2` - İkinci renk (koyu mor)

### Tur Sayısı
`app.js` içinde `createNextRound()` fonksiyonunda `roundNumber < 5` değerini değiştirin

### Otomatik Kontrol Aralığı
`app.js` içinde `setInterval(checkAndRun, 10000)` değerini değiştirin (ms cinsinden)

## 💾 Veri Yönetimi

### Yedekleme
1. **Yönetim** → **Veri İşlemleri** → **Veri Kopyası İndir**
2. Çıktı dosyasını güvenli bir yerde saklayın

### Geri Yükleme
1. **Yönetim** → **Veri İşlemleri** → **Veri Yükle**
2. Kayıtlı JSON dosyasını seçin

## 🌐 GitHub Pages'de Yayınlama

1. Repository'yi oluşturun: `tavla_cekilis`
2. Tüm dosyaları push edin
3. Settings → Pages → Main branch seçin
4. `https://username.github.io/tavla_cekilis/` üzerinden erişin

## ⏰ Canlı Yayın İçin İpuçları

- Sayfa açık tutun, sayaç güncellenir
- Sonuçları canlı yayında anounce edin
- Galipler otomatik olarak ileri taşınır
- Yönetim panelinden veri indirip, yenilerini yükleyebilirsiniz

## 🎮 Keyboard Kısayolları

- `Ctrl+Shift+I` - DevTools açma (hata kontrol için)

## 📝 Notlar

- Veriler **LocalStorage**'da saklanır
- Tarayıcıyı temizlerseniz veriler silinir
- Her zaman **Veri Kopyası İndir** ile yedek alın!
- ISO 8601 tarih formatı kullanılır

## 🔧 Sorun Giderme

**Çekilişler otomatik yapılmıyor?**
- Sayfayı yenileyin
- Tarih doğru mu kontrol edin (UTC zaman dilimi)
- Console'da hata var mı kontrol edin (F12)

**Veriler kaydolmuyor?**
- LocalStorage aktif mi kontrol edin
- Private/Incognito modda değil misiniz?
- Veri indirip yükleyerek elle ekleyin

**Animasyonlar çalışmıyor?**
- CSS4 destekleyen tarayıcı kullanın
- Chrome/Firefox/Edge önerilir

## 📞 İletişim

Sorular veya öneriler için GitHub Issues açın!

---

**Hazırlandı**: 2026 Tavla Turnuvası | **Versiyon**: 1.0
