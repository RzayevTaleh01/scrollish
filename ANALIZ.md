# Socialearn: sistem analizi

Tarix: 2026-10-09. `tsc` və `eslint` təmiz idi.

## Arxitektura

```
YouTube Data API ──► getPool (55 kanal, 6 saat cache)
                         │
/api/feed ──kickIngest──► ingest worker (yaddaşda, fonda)
                         ├─ transcript.ts  (Android player endpoint, rəsmi deyil)
                         ├─ segments.ts    (cümlələrə bölür)
                         ├─ gemini.ts      (4 video = 1 sorğu, açar × model zənciri)
                         └─ db.ts          (SQLite: videos, video_content, dictionary)
Client: Feed → ShortSlide → ShortPlayer (YT iframe) + Subtitles / Transcript → WordSheet
```

## Baza (analiz anında)

| | en | sk |
|---|---|---|
| Hazır video | 25 | 51 |
| Altyazısız | 19 | 33 |
| Çox qısa | 0 | 3 |
| Lüğət: söz / ifadə | 1022 / 180 | 1603 / 78 |

- İngiliscə 25 videonun 13-ü Mark Rober-dir (science+tech).
- İngiliscə Sports və World mövzularında hazır video yoxdur.
- Modellər: gemini-3-flash-preview 51, gemini-3.5-flash 16, digərləri 9.
- Yetim qeyd və `failed` statuslu video yoxdur.

## Ciddi problemlər (hələ düzəldilməyib)

> 1 və 2 düzəldilib (2026-10-09): client artıq təkrarları atmır, aktiv slayd massiv mövqeyi ilə izlənir, server isə keçid sərhədində eyni videonun dalbadal gəlməsinin qarşısını alır.

1. **(Düzəldilib) Feed kiçik hovuzda ilişir.** `src/components/Feed.tsx`, `mode === "more"` hissəsi. Son 20 elementdəki id-lər atılır, hovuz 20-dən azdırsa lentə heç nə əlavə olunmur və lent bitir. Food (en) mövzusunda 1 video var: istifadəçi eyni videonu 8 dəfə görür, sonra lent dayanır.
2. **(Düzəldilib) `item.index` və massiv mövqeyi ayrılır.** `active` dəyəri `data-index`-dən (`item.index`) gəlir, amma `items[active]`, `children[active + delta]` və `index === active + 1` onu massiv indeksi kimi işlədir. Ortadan element atılanda nəticələr: URL-də səhv video, ox düymələri səhv slayda keçir, növbəti player əvvəlcədən yüklənmir.
3. **Kitabxana 8 video/mövzu həddində dayanır.** `src/lib/ingest.ts`, `INGEST_PER_TOPIC`. Bu, kvotanı qoruyur, amma 1-ci problemlə birlikdə lent həmişə kiçik qalır.
4. **Videosu olmayan mövzuda sonsuz spinner.** `src/app/api/feed/route.ts` namizəd qalmasa da 202 qaytarır. Client 404 gözləyir, ona görə "No videos in this topic yet" ekranı heç vaxt görünmür.
5. **(Düzəldilib) Bot yoxlaması bütün hovuzu həmişəlik `no_captions` edə bilər.** `src/lib/transcript.ts`: `playabilityStatus != OK` (`LOGIN_REQUIRED` daxil) halında `NoTranscriptError` atılır. Bu hal müvəqqəti xəta (`failed`) sayılmalıdır. Bazada artıq 2 video "UNPLAYABLE" səbəbi ilə belə işarələnib.
6. **Gemini sorğuları boşa gedə bilər.**
   - `MAX_TOKENS` və ya `SAFETY` cavabı adi `Error` kimi atılır, ikinci dəfə göndərilir, sonra 3 cəhdə qədər təkrarlanır: bir paket 6 sorğuya qədər yandıra bilər. Belə halda paketi yarıya bölmək lazımdır.
   - 429-dan fərqli `GeminiError` (məsələn 400) hər 5 dəqiqədən bir eyni paketlə təkrarlanır və `attempts` artmır.
7. **(Düzəldilib) Fetch timeout yoxdur.** `src/lib/youtube.ts` və `src/lib/transcript.ts`. Bir sorğu ilişsə, `state.running` həmişəlik `true` qalır və ingest dayanır.

## Orta və kiçik qeydlər

- **Deploy:** (həll olunub) Cloud Run-da `max-instances 1` və `no-cpu-throttling` ilə işləyir, baza Neon Postgres-dir.
- **Lüğət axtarışı:** (düzəldilib) `ILIKE` bütün əlifbalarda böyük-kiçik hərfi tanıyır, `%` və `_` hərfi mənada axtarılır.
- **Alternativ tərcümələr:** (düzəldilib) Postgres-də dəqiq uyğunluq (`jsonb ?`) yoxlanır.
- **`Dictionary.loadMore`:** `res.ok` yoxlanmır. Sorğu gedərkən dil dəyişsə, nəticələr qarışa bilər.
- **Layout:** `layout.tsx`-də `lang="en"` və "Learn English" təsviri slovak dili üçün də göstərilir.
- **YouTube qaydaları:** iframe üzərindəki overlay və `controls: 0` embed şərtlərinə ziddir.
- **iOS:** yeni iframe-lərin səslə avtomatik oynaması bloklana bilər, real iPhone-da yoxlamaq lazımdır.
- **Git:** `Socialearn` ev qovluğundakı repo-nun içində izlənməyən qovluqdur. Ayrıca `git init` daha təhlükəsizdir.

## Yaxşı tərəflər

- Gemini qənaəti: paketləmə, `known` sözlər, JSON schema.
- LangVis tipli açar × model zənciri və yararsız açar üçün bloklama.
- Məlumat itirməyən DB miqrasiyası.
- Client-də generation sayğacı ilə race condition qoruması.

## Tövsiyə olunan sıra

1+2 (feed), 4 (spinner), 5 (bot yoxlaması), 6 (kvota), 7 (timeout).
