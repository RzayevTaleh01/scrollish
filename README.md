# Scrollish

Qısa videoları scroll edərək dil öyrənmək üçün tətbiq (Next.js 15, App Router, Tailwind v4, Postgres).
Canlı ünvan: https://scrollish-50524487911.us-east4.run.app
Videolar YouTube Shorts-dan gəlir, altyazıdakı hər söz və ifadə toxunulandır və Azərbaycanca izah olunur.
Hazırda iki dil var: ingilis və slovak. Dil və səviyyə başlıqdakı Settings-dən seçilir.

## İşə salmaq

`.env.local`:

```
YOUTUBE_API_KEY=...
GEMINI_API_KEY=...
GEMINI_API_KEYS=ehtiyat_acar_1,ehtiyat_acar_2
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=verify-full
```

Baza Neon-dakı Postgres-dir və həm yerli, həm canlı versiya eyni bazanı işlədir. Yəni yerli işləyəndə analiz olunan
video canlı saytda da görünür və heç bir video Gemini-yə iki dəfə getmir. Cədvəllər ilk bağlantıda avtomatik yaranır.

```
npm install
npm run dev
```

Əlavə ayarlar (istəyə görə):

| Dəyişən | Standart | Nə edir |
|---|---|---|
| `GEMINI_API_KEYS` | boş | Vergüllə ayrılmış ehtiyat açarlar |
| `GEMINI_MODEL` | `gemini-3.5-flash,gemini-3.7-flash,gemini-flash-latest,gemini-3.6-flash,gemini-3-flash-preview,gemini-3.5-flash-lite,gemini-3.1-flash-lite` | Sıra ilə sınanan modellər |
| `GEMINI_THINKING` | `minimal` | Modelin düşünmə səviyyəsi, `off` ayarı göndərmir |
| `INGEST_PACK` | `4` | Bir Gemini sorğusuna düşən video sayı |
| `INGEST_PER_TOPIC` | `8` | Hər mövzu üçün hazırlanan video sayı |
| `DATABASE_URL` | (məcburi) | Postgres bağlantısı (Neon) |

## Necə işləyir

1. `src/lib/youtube.ts` kurasiya olunmuş kanalların (`src/lib/channels.ts`) Shorts siyahısını YouTube Data API ilə çəkir.
2. `src/lib/ingest.ts` arxa planda, yalnız baxılan dil üçün:
   - `src/lib/transcript.ts` ilə həmin dildəki altyazını alır (rəsmi olmayan üsul, altyazısı olmayan video kənarlaşdırılır),
   - `src/lib/segments.ts` ilə onu cümlələrə bölür,
   - `src/lib/gemini.ts` ilə bir sorğuda bir neçə videonun cümlə tərcüməsini, söz mənalarını və ifadələrini (collocation, phrasal verb, idiom) alır,
   - nəticəni `src/lib/db.ts` vasitəsilə Postgres bazasına yazır.
   - YouTube serveri "bot yoxlaması" ilə rədd edəndə (bulud IP-lərində olur) video qeyd olunmur, ingest 30 dəqiqə dayanır.
3. Hər video Gemini-yə yalnız bir dəfə göndərilir. Sonrakı baxışlar bazadan oxunur.
4. `GET /api/feed` hazır videoları dilə, mövzuya və səviyyəyə görə sonsuz sıra ilə verir, `GET /api/video/[id]` altyazı məzmununu, `GET /api/dictionary` lüğəti.

## Gemini sərfiyyatı

Pulsuz limit tokenlə deyil, sorğu sayı ilə ölçülür: hər model üçün gündə təxminən 20 sorğu (Lite modellərdə daha çox).
Ona görə sərfiyyat belə azaldılıb:

- Bir sorğuda bir neçə video gedir (`INGEST_PACK`), yəni bir sorğu 4 video hazırlayır.
- Hər söz bir videoda bir dəfə tərcümə olunur, hər cümlədə yenidən yox.
- Əvvəlki videolarda tərcümə olunmuş sözlər (`src/lib/known.ts`) Gemini-dən yenidən istənmir.
- Düşünmə səviyyəsi `minimal`-dır.

Açarlar LangVis-dəki kimi işləyir: əvvəl əsas açar, onun hər modeli sıra ilə. Limiti dolan, məşğul olan və ya silinmiş
(açar, model) cütü bir müddət dincəlir və sıradakı cavab verir. Bir açarın bütün modelləri dolanda növbəti açara keçilir.

## Deploy (Google Cloud Run)

Servis `scrollish`, layihə `trdesk-510213`, region `us-east4` (Neon bazası `us-east-2`-dədir, ona yaxın olsun deyə).
Açarlar imicdə deyil, Secret Manager-dədir: `scrollish-database-url`, `scrollish-youtube-api-key`, `scrollish-gemini-api-key`.
`.gcloudignore` `.env*` və `data/` qovluğunu yükləməyə qoymur.

Yeni versiyanı yayımlamaq:

```
gcloud run deploy scrollish --source . --region us-east4 --project trdesk-510213 --quiet
```

Ayarlar ilk deploy-da verilib və saxlanılır:
- `max-instances 1`: ingest yaddaşda işləyir, iki nüsxə Gemini sorğularını ikiqat edərdi.
- `no-cpu-throttling`: cavabdan sonra fon işi yavaşlamasın.
- `min-instances 0`: heç kim girməyəndə servis sönür.

Bir açarı dəyişmək (məsələn Neon parolu yenilənəndə), sonra yenidən deploy:

```
gcloud secrets versions add scrollish-database-url --data-file=- --project trdesk-510213
```

Köhnə yerli SQLite bazasını Postgres-ə köçürən skript: `node --env-file=.env.local scripts/migrate-sqlite-to-postgres.mjs`.

## Yeni dil əlavə etmək

1. `src/lib/languages.ts`-ə dili əlavə et.
2. `src/lib/channels.ts`-ə həmin dildə Shorts yükləyən kanalları `lang` ilə yaz. Video YouTube-da həmin dildə altyazıya malik olmalıdır.
3. `src/lib/segments.ts`-də bağlayıcılar, `src/lib/db.ts`-də lüğətdən kənar sözlər siyahısına dili əlavə et (istəyə görə).

## Dizayn

Düz rənglər və "liquid glass": səthlər yarımşəffafdır, arxasını bulandırır və yuxarı kənarında nazik işıq xətti var. Qradiyent yoxdur.
Rənglər və şüşə stilləri (`glass`, `glass-strong`, `glass-soft`, `liquid`) `src/app/globals.css` faylındadır.
`--accent` brend rəngidir (bənövşəyi), `--translation` Azərbaycanca mətnin rəngidir (sarı).

Video YouTube Shorts-dakı kimi yerləşir: başlığın altından başlayır, 9:16 nisbətindədir.
Telefonda video bütün ekranı tutur (Shorts tətbiqi kimi), başlıq onun üstündə kənarlardan ayrılmış, yuvarlaq künclü üzən kartdır və altyazı kartı ilə eyni şüşə fondadır (`glass`).
Video oynayanda başlıq və mövzu çipləri 3 saniyə sonra gizlənir, video dayandırılanda dərhal qayıdır.
Videonun yuxarısındakı YouTube yazılarını həmişə bulanıq bir zolaq örtür, başlıq görünəndə onun üstündə durur. Eyni zolaq videonun aşağısında da var (bizim kartların arxasında) və YouTube-un kanal, like və share sətrini örtür.
YouTube-un öz altyazısı player-də söndürülür, çünki onun yerini bizim toxunulan altyazı tutur. 9:16 nisbəti qorunur, ortalanır və ekranın formasından asılı olaraq yalnız çıxan kənarlar kəsilir.
Telefonda mövzu çipləri başlıqda deyil: videonun üst hissəsinin üzərində, ortada, şüşə fonla durur.
Desktopda video kəsilmir, mövzu çipləri naviqasiyanın altında ayrıca sətirdə, ortada durur. Geniş ekranda (1024px+) videonun sağında transkript paneli açılır:
danışılan sətir vurğulanır, vaxta toxunanda video oradan oynayır, sözə toxunanda izah paneldə açılır.
Bəyənilmiş videolar ("Liked") brauzerin `localStorage`-ində tam məlumatı ilə saxlanır.
Altyazı kartı kanal və video adı olan kartla eyni görünür (ortaq stil `src/components/overlay.ts`-dədir):
ingiliscə və tərcümə eyni fonda, xətlə ayrılır.

## Qeydlər

- Səsli oynatma üçün brauzer bir toxunuş tələb edir, ona görə açılışda "Start" ekranı var.
- Düymələr və altyazı videonun üstündədir. Bu YouTube embed qaydalarına ziddir, ictimai buraxılışdan əvvəl nəzərə al.
- Slovak videolarının çoxunda altyazı YouTube-un avtomatik altyazısıdır, orada səhv eşidilmiş sözlər ola bilər.
- Ayarlar, saxlanan sözlər və bəyənmələr brauzerin `localStorage`-ində qalır, hesab sistemi hələ yoxdur.
