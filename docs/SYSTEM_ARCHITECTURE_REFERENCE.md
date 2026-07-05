# Metabooki System Architecture Reference

نسخه مرجع: `APP_VERSION = 1.0.656`  
تاریخ بازبینی: 2026-07-05  
هدف سند: هر برنامه‌نویس یا عامل هوش مصنوعی بتواند بدون خواندن کل تاریخچه چت، ساختار فعلی متابوکی را بفهمد و تغییر بعدی را از محل درست شروع کند.

## 1. اصل‌های معماری

1. Supabase منبع معتبر داده است. localStorage فقط fallback توسعه‌ای یا cache موقت است و نباید source of truth تولیدی تلقی شود.
2. ادیتور عملیاتی فقط Editor V2 است. ادیتور legacy و route مربوط به آن حذف شده‌اند.
3. محتوای کتاب باید از مدل مشترک `BookDocumentV2`، موتور صفحه‌ای و renderer مشترک عبور کند؛ رندر جداگانه برای کپشن، کال‌اوت، متن، تعاملی، پاورقی یا رفرنس ممنوع است مگر اینکه استثنا در همین سند ثبت شود.
4. کتاب‌های بزرگ نباید به‌صورت payload کامل ذخیره یا لود شوند. مسیر استاندارد، manifest + page window + dirty page save است.
5. نسخه سایت فقط از `src/lib/version.ts` خوانده می‌شود و هنگام انتشار باید با `public/version.json` و `public/sw.js` همگام بماند.

## 2. تکنولوژی‌ها

| لایه | تکنولوژی | نقش |
| --- | --- | --- |
| Frontend | React 19، TypeScript، Vite | SPA اصلی |
| Routing | react-router-dom | مسیرهای hash/history در local و GitHub Pages |
| UI | CSS اختصاصی، Radix UI، lucide-react، sonner | کامپوننت‌ها، modal/toast، آیکون‌ها |
| Editor | Editor V2 اختصاصی + مدل ساختاری V2 | ویرایش پیوسته متن و بلوک‌های کتاب |
| Import | Web Worker، JSZip، fast-xml-parser، OPFS/IndexedDB در مسیر محلی | تحلیل Word پیش از آپلود |
| Backend | Supabase Postgres، Auth، RLS، Realtime، Edge Functions | داده، نقش، محتوای صفحه‌ای، AI gateway |
| AI | `supabase/functions/ai-gateway` | نگهداری امن کلیدها، اجرای متن/تصویر، محاسبه هزینه |
| Deploy | GitHub Pages + Service Worker | نسخه آنلاین static |

## 3. Entry Points و مسیرها

| مسیر | فایل/کامپوننت | توضیح |
| --- | --- | --- |
| `/` | `src/pages/Landing.tsx` | لندینگ و پیشنهاد کتاب‌ها |
| `/store` | `src/pages/Store.tsx` | فروشگاه عمومی، بدون نیاز به login برای مشاهده |
| `/library` | `src/pages/Library.tsx` | قفسه من و پیش‌نویس‌های ناشر |
| `/publisher/:id` | `src/pages/Publisher.tsx` | مرکز کاری ناشر؛ فقط کتاب‌های همان ناشر |
| `/upload` | `src/pages/Upload.tsx` | import محلی Word و ساخت بسته |
| `/edit/:id` | `src/features/editor-v2/EditorV2Page.tsx` | ادیتور اصلی و تنها ادیتور |
| `/edit-v2/:id` | `src/features/editor-v2/EditorV2Page.tsx` | alias سازگار با لینک‌های قبلی V2 |
| `/read/:id` | `src/pages/Reader.tsx` | کتابخوان و preview |
| `/publish/:id` | `src/pages/Publish.tsx` | قیمت، سهام و انتشار |
| `/admin` | `src/pages/Admin.tsx` | مدیریت سیستم، کاربران، AI، مالی و گزارش‌ها |
| `/profile` | `src/pages/Profile.tsx` | پروفایل و اطلاعات مالی/کاربری |

## 4. درخت کد مهم

```text
src/
  App.tsx                         تعریف routeها، preload و tooltip جهانی citation
  main.tsx                        bootstrap React
  integrations/supabase/
    client.ts                     Supabase client + retry محدود read/auth
    types.ts                      Typeهای تولید شده از schema
  lib/
    version.ts                    نسخه رسمی سایت
    version-cache.ts              پاکسازی cache/chunk قدیمی
    auth-context.tsx              session و user
    book-content.ts               قواعد مرجع نمایش متن، ZWS/ZWNJ، tooltip و payload
    book-document-v2/             schema، normalize، toc، pagination و تبدیل legacy
    page-content-engine.ts        manifest/page window/dirty page save
    book-repository.ts            دریافت کتاب برای reader/editor/store
    publisher-books.ts            عملیات نشر و fallback توسعه‌ای
    publisher-delete.ts           حذف کامل کتاب و وابسته‌ها
    ai-gateway.ts                 client-side wrapper برای Edge Function
    ai-image-prompts.ts           قانون واحد prompt تصویر
  components/book/
    BookContentBlocks.tsx         renderer مشترک callout/interactive/gallery/timeline
  features/editor-v2/
    EditorV2Page.tsx              ادیتور فعلی
    editor-v2.css                 UI ادیتور، پنل‌ها، toolbar، scrollbar
  pages/
    Reader.tsx                    کتابخوان با page window و realtime
    Upload.tsx                    تبدیل Word پیش از آپلود
    Publisher.tsx                 پنل نشر
supabase/
  migrations/                     schema، RLS، seeds، page engine
  functions/ai-gateway/index.ts   gateway امن AI
docs/
  SYSTEM_ARCHITECTURE_REFERENCE.md
  DFD_ERD_SECURITY_REFERENCE.md
  VERSION_HISTORY.md
```

## 5. مدل محتوای کتاب

مدل اصلی در `src/lib/book-document-v2/schema.ts` تعریف شده است.

واحدهای اصلی:

- `BookDocumentV2`: سند کامل، metadata، pages، toc، assets.
- `BookPageV2`: یک صفحه چاپی/منطقی با `index`, `printNumber`, `blocks`.
- `BookBlockV2`: انواع `paragraph`, `heading`, `image`, `table`, `list`, `math`, `callout`, `interactive`, `pageBreak`.
- `BookTocItemV2`: فهرست مستقل از صفحات لود شده.
- `BookAssetV2`: خلاصه دارایی‌های رسانه‌ای برای پنل مدیا و جستجو؛ از نسخه 1.0.599 شامل `blockId` هم هست تا assetهای خارج از window فعلی قابل پرش باشند.

قواعد normalize در `src/lib/book-document-v2/normalize.ts` و `src/lib/book-content.ts` متمرکز هستند. هر تغییری درباره فارسی، ZWS/ZWNJ، پاورقی، رفرنس، اعداد، یونانی، subscript/superscript و لینک باید ابتدا همینجا بررسی شود.

## 6. Page-Based Content Engine

فایل اصلی: `src/lib/page-content-engine.ts`  
migration اصلی: `supabase/migrations/20260629012000_page_based_content_engine.sql`

ثابت‌ها:

- `PAGE_ENGINE_INITIAL_LOAD_COUNT = 50`
- `PAGE_ENGINE_WINDOW_BEFORE = 10`
- `PAGE_ENGINE_WINDOW_AFTER = 40`
- `PAGE_ENGINE_SCHEMA_VERSION = '2.0-page'`

جدول‌ها:

- `book_content_manifests`: manifest جهانی شامل `page_count`, `toc`, `assets_summary`, `search_ready`.
- `book_pages`: محتوای هر صفحه با `blocks`, `plain_text`, `asset_ids`.
- `book_assets`: دارایی‌های رسانه‌ای، کپشن، status و issue.
- `book_search_index`: متن ساده هر صفحه و headingها برای جستجو.

رفتار:

1. Reader/Editor ابتدا manifest را می‌گیرند.
2. پنجره صفحه با RPC `get_book_page_window(book_id, center_page, before_count, after_count)` لود می‌شود.
3. ادیتور dirty pageها را در `dirtyPageIndexesRef` نگه می‌دارد.
4. autosave/manual save فقط همان صفحات تغییر یافته را ذخیره می‌کند.
5. اگر heading، فهرست یا assets تغییر کند، manifest هم refresh می‌شود.
6. Realtime روی `book_content_manifests` و `book_pages` فعال است تا reader تغییرات ادیتور را بدون refresh ببیند.

## 7. Editor V2

فایل‌ها:

- `src/features/editor-v2/EditorV2Page.tsx`
- `src/features/editor-v2/editor-v2.css`

مسئولیت‌ها:

- نمایش متن به شکل سند پیوسته، نه block-card.
- toolbar متن: bold, regular, italic, underline, strike, alignment, direction, lists, link, sub/superscript, color swatches, font, heading.
- پنل راست: فهرست، ارتقا متن/callout، رسانه، ارجاعات، تعاملی، هوش مصنوعی.
- ذخیره خودکار 60 ثانیه‌ای با شمارنده؛ ذخیره دستی همان مسیر ذخیره را فوراً اجرا می‌کند.
- دکمه‌های شناور صفحه قبل/بعد به page separatorها اسکرول می‌کنند.
- خط جداکننده صفحه چاپی نباید حذف شود؛ اگر در ویرایش حذف شد باید از مدل صفحه‌ای بازسازی شود.
- با تغییر heading، TOC باید در همان لحظه در state ادیتور به‌روز شود و در save بعدی در manifest ثبت شود.

قانون مهم: هر ویژگی جدید editor باید اول در مدل `BookDocumentV2` و renderer مشترک قابل نمایش باشد؛ سپس UI ادیتور به آن وصل شود.

## 8. Reader

فایل اصلی: `src/pages/Reader.tsx`

مسئولیت‌ها:

- نمایش صفحه چاپی/منطقی با window loading.
- خواندن manifest کامل برای فهرست، assets و page count.
- نگهداری وضعیت دیده‌شدن فصل‌ها برای کاربر در localStorage.
- realtime refresh پس از تغییرات ادیتور.
- جستجو از `book_search_index` و fallback به `book_pages`.
- نمایش callout و interactive از `components/book/BookContentBlocks.tsx`.
- بزرگنمایی تصویر با modal و caption overlay.

## 9. Import Word

فایل‌های مرتبط:

- `src/pages/Upload.tsx`
- workerهای import در `src/workers/`
- انواع و helperها در `src/lib/book-document-v2/`

رفتار مورد انتظار:

1. تحلیل Word تا قبل از تأیید کاربر محلی است.
2. کاربر فهرست، style mapping، کپشن‌ها، تصاویر و 50 صفحه اول را می‌بیند.
3. پس از تأیید، بسته upload می‌شود.
4. کتاب به `BookDocumentV2` تبدیل می‌شود و بعد با page engine backfill می‌شود.
5. ادیت بعدی فقط روی Supabase و page engine ادامه پیدا می‌کند.

## 10. AI و تولید تصویر

فایل‌ها:

- `src/lib/ai-gateway.ts`
- `src/lib/ai-image-prompts.ts`
- `supabase/functions/ai-gateway/index.ts`

قواعد:

- کلیدهای AI هرگز در frontend ذخیره نمی‌شوند.
- تنظیمات provider از پنل Admin به Supabase می‌رود.
- client فقط Edge Function را صدا می‌زند.
- برای تصویر تعاملی، prompt نهایی از قانون واحد `ai-image-prompts.ts` ساخته می‌شود.
- برای Auto-Cover، prompt ساختاری و بدون text روی تصویر است.
- برای Direct Image Gen، prompt کاربر بدون template اضافه ارسال می‌شود.
- credit قبل از مصرف باید برآورد و تأیید شود؛ ضریب شارژ کاربر و نرخ دلار از تنظیمات مالی خوانده می‌شود.

## 11. Supabase Connectivity

فایل: `src/integrations/supabase/client.ts`

از نسخه 1.0.578 یک retry محدود اضافه شده است:

- retry فقط برای `GET`, `HEAD`, `OPTIONS` و auth entrypointهای login/signup انجام می‌شود.
- writeهای ادیتور retry نمی‌شوند تا ذخیره صفحه‌ای دوبار اعمال نشود.
- اگر env معتبر نباشد، mock client فقط برای demo/dev فعال می‌شود.

## 12. امنیت و مالکیت داده

قواعد اصلی:

- ناشر فقط draftهای publisher profile خودش را می‌نویسد.
- کتاب published اگر خرید داشته باشد مستقیماً قابل ویرایش نیست.
- Admin در پنل admin وضعیت کل سایت را می‌بیند، اما نباید دارایی‌های draft ناشرهای دیگر را مثل ناشر مالک ویرایش کند.
- محتوای منتشرشده approved برای عموم قابل خواندن است.
- خریدهای کاربر از `user_books` کنترل می‌شود.
- RLS در migrationها enforce می‌شود، نه فقط UI.

## 13. Cache و Version

فایل‌ها:

- `src/lib/version.ts`
- `public/version.json`
- `public/sw.js`
- `src/lib/version-cache.ts`

رفتار:

- با تغییر نسخه، cacheهای `metabooki-*` باید invalidate شوند.
- خطای dynamic import در GitHub Pages با `recoverFromDynamicImportError` پاکسازی و reload می‌شود.
- هر deploy باید version fileها را هماهنگ کند.

## 14. Cleanup نسخه فعلی

در نسخه مرجع 1.0.619:

- `src/pages/Edit.tsx` حذف شده است.
- route قدیمی `/edit-legacy/:id` حذف شده است.
- دکمه «ادیتور قبلی» از پنل نشر حذف شده است.
- `docs/CARDIAC_CYCLE_PLAN.md` حذف شده چون مربوط به پروژه دیگری بود.
- سندهای مرجع معماری و DFD/ERD/امنیت بر اساس Editor V2 و Page Engine بازنویسی شده‌اند.
- تشخیص صفحه خالی در Editor V2 و Reader از شمارش بلوک‌ها به تشخیص «محتوای قابل نمایش» تغییر کرده است؛ بنابراین صفحه‌ای با پاراگراف/هدینگ خالی هم placeholder درست می‌گیرد.
- فهرست و لیست رسانه ادیتور نباید از 50 صفحه لودشده اولیه ساخته شوند؛ manifest در زمان load از کل `book_pages` و `book_assets` قابل ترمیم است و save یک window فقط همان صفحات dirty را در manifest جایگزین می‌کند.
- ارجاعات از نسخه 1.0.615 باید از `src/lib/book-references.ts` عبور کنند. افزودن منطق جداگانه برای لینک، پاورقی، رفرنس، سرفصل یا لینک تصویر در ادیتور/renderer بدون استفاده از این فایل ممنوع است.

## 15. محل شروع تغییرات آینده

| تغییر موردنظر | اول اینجا را ببین |
| --- | --- |
| مشکل نمایش فارسی/ZWS/اعداد/یونانی | `src/lib/book-content.ts`, `src/lib/book-document-v2/normalize.ts` |
| فهرست و heading | `src/lib/book-document-v2/toc.ts`, `src/lib/page-content-engine.ts`, `EditorV2Page.tsx` |
| ذخیره و لود صفحات | `src/lib/page-content-engine.ts`, migration page engine |
| ادیتور متن | `src/features/editor-v2/EditorV2Page.tsx`, `editor-v2.css` |
| callout/interactive مشترک | `src/components/book/BookContentBlocks.tsx`, `src/lib/book-content.ts` |
| رسانه و کپشن | `EditorV2Page.tsx`, `BookContentBlocks.tsx`, `book_assets` |
| ارجاعات و لینک‌ها | `src/lib/book-references.ts`, `InlineTextV2.tsx`, `EditorV2Page.tsx`, `BookRendererV2.tsx` |
| کتابخوان | `src/pages/Reader.tsx` |
| AI و هزینه | `src/lib/ai-gateway.ts`, `supabase/functions/ai-gateway/index.ts` |
| دسترسی ناشر/Admin | migrationهای RLS، `publisher-books.ts`, `Publisher.tsx`, `Admin.tsx` |
