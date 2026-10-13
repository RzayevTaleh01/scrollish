# Scrollish

Qısa videoları scroll edərək dil öyrənmək üçün tətbiq (Next.js 15, App Router, Tailwind v4, Postgres).
Canlı ünvan: https://scrollish-50524487911.us-east4.run.app
Videolar YouTube Shorts-dan gəlir, altyazıdakı hər söz və ifadə toxunulandır və Azərbaycanca izah olunur.
Hazırda iki dil var: ingilis və slovak. Dil və səviyyə başlıqdakı Settings-dən seçilir.
Google ilə giriş (One Tap): sayta girən kimi sağ yuxarıda Google-un giriş pəncərəsi çıxır, əvvəl daxil olmuş istifadəçi avtomatik daxil olur.
Bunun üçün `GOOGLE_CLIENT_ID` lazımdır (Google Cloud Console → APIs & Services → Credentials → OAuth client ID, "Web application").
Boş olanda giriş göstərilmir və tətbiq əvvəlki kimi işləyir.
