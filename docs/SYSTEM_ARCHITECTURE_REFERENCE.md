# Metabooki System Architecture Reference

تاریخ تهیه: 2026-06-27  
نسخه بررسی شده: `APP_VERSION = 1.0.496`  
هدف سند: این فایل مرجع فنی متابوکی است تا هر برنامه نویس بتواند معماری، مسیرهای کد، جریان داده، نقاط حساس و محل اعمال تغییرات را سریع پیدا کند.

سندهای مرتبط:

- `docs/DFD_ERD_SECURITY_REFERENCE.md`: نمودارهای DFD، ERD و نقشه کدهای حساس

## 1. خلاصه معماری

متابوکی یک برنامه وب تک صفحه ای است که با `React`, `TypeScript` و `Vite` ساخته شده و برای داده های واقعی از `Supabase` استفاده می کند. بخش های اصلی سیستم این ها هستند:

- فرانت اند: React SPA در پوشه `src`
- دیتابیس، Auth، Storage، Realtime و RPC: Supabase
- Edge Functions: پوشه `supabase/functions`
- تبدیل اولیه Word: Web Worker در مرورگر، سپس آپلود مرحله ای به Supabase
- ادیتور کتاب: Editor V2 با مدل سند ساختاریافته
- کتابخوان: نمایش همان مدل سند با رندر مشترک محتوا
- هوش مصنوعی: Edge Function امن با کلیدهای ذخیره شده روی سرور
- انتشار آنلاین: GitHub Pages با workflow داخل `.github/workflows/deploy-pages.yml`

اصل مهم پروژه: محتوای کتاب نباید در چند نسخه جداگانه رندر یا پردازش شود. قوانین نمایش متن، پاورقی، رفرنس، فرمول، ZWS/ZWNJ، کپشن، کال اوت، تعاملی ها و صفحه چاپی باید از لایه مشترک `book-content` و رندرهای V2 خوانده شوند.

## 2. تکنولوژی ها

### Frontend

- `React 19`
- `TypeScript`
- `Vite`
- `React Router`
- `TanStack React Query`
- `Tiptap`
- `Lucide React`
- `Radix UI`
- CSS معمولی پروژه در `src/index.css` و فایل های ماژول/ویژگی

### Backend و دیتابیس

- `Supabase Postgres`
- `Supabase Auth`
- `Supabase Storage`
- `Supabase Realtime`
- `Supabase Edge Functions` با Deno و TypeScript

### پردازش فایل Word

- `Web Worker`
- `JSZip`
- `fast-xml-parser`
- پردازش XML داخلی DOCX
- تبدیل تصاویر قابل تبدیل در مرورگر
- نگهداری موقت محلی با IndexedDB و storage مرورگر

### انتشار

- GitHub
- GitHub Pages
- Vite build
- Service Worker و version cache

## 3. نقشه پوشه ها

```text
src/
  App.tsx                         مسیرهای اصلی برنامه و lazy loading صفحات
  main.tsx                        بوت React، نسخه، cache recovery
  index.css                       استایل های عمومی، منوها، layout، glass UI
  components/
    admin/                        پنل های ادمین مثل تنظیمات AI
    book-content-v2/              رندر مشترک کتاب، متن، کال اوت، تعاملی، صفحه چاپی
    navbar/                       نوار بالای سایت و منوها
    navigation/                   ابزارهای route/scroll
    offline/                      وضعیت آفلاین
    ui/                           اجزای عمومی مثل button، error boundary، role guard
  features/
    editor/                       ادیتور قدیمی و legacy
    editor-v2/                    ادیتور جدید کتاب
  hooks/                          هوک های Auth, Roles, Credits, Grid/Page size
  integrations/
    supabase/                     کلاینت Supabase و typeهای تولید شده
  lib/                            منطق اصلی دامنه پروژه
  pages/                          صفحات route شده برنامه
  workers/                        Web Worker تبدیل DOCX

supabase/
  functions/
    ai-gateway/                   درگاه امن AI و محاسبه هزینه
    admin-users/                  عملیات مدیریتی کاربران
  migrations/                     اسکیمای دیتابیس، RLS، RPC و realtime

public/
  sw.js                           Service Worker
  version.json                    نسخه منتشر شده
  manifest.webmanifest            PWA manifest

scripts/
  auto-sync.ps1                   build، افزایش نسخه، commit و push خودکار

docs/
  *.md                            اسناد طراحی و گزارش ها
```

## 4. مسیرهای اصلی برنامه

فایل مرجع routeها: `src/App.tsx`

| مسیر | صفحه | کاربرد |
|---|---|---|
| `/` | `Landing` | صفحه اول و پیشنهاد کتاب ها |
| `/auth` | `Auth` | ورود و ثبت نام |
| `/store` | `Store` | فروشگاه عمومی، بدون وابستگی به لاگین |
| `/library` | `Library` | قفسه من، نیازمند ورود |
| `/read/:id` | `Reader` | کتابخوان |
| `/b/:id` | `BookLanding` | صفحه معرفی کتاب |
| `/upload` | `Upload` | ورود و تبدیل فایل Word |
| `/edit-legacy/:id` | `Edit` | ادیتور قدیمی |
| `/edit/:id` | `EditorV2Page` | ادیتور جدید V2 |
| `/edit-v2/:id` | `EditorV2Page` | alias ادیتور جدید |
| `/publish/:id` | `Publish` | تنظیمات انتشار |
| `/publisher/:id` | `Publisher` | صفحه ناشر عمومی |
| `/publisher/:id/settings` | `PublisherSettings` | تنظیمات ناشر |
| `/admin` | `Admin` | پنل مدیریت |
| `/credits` | `Credits` | اعتبار کاربر |
| `/profile` | `Profile` | پروفایل کاربر |
| `/audio-studio/:id` | `AudioStudioPage` | استودیوی صوت |
| `/audio/:editionId` | `AudioReader` | کتابخوان صوتی |

نکته: routeها lazy load می شوند. خطاهای chunk و dynamic import از طریق `src/lib/version-cache.ts` و `ErrorBoundary` مدیریت می شوند.

## 5. داده و Supabase

### کلاینت Supabase

فایل: `src/integrations/supabase/client.ts`

این فایل بر اساس envها کلاینت واقعی Supabase را می سازد. اگر `VITE_SUPABASE_URL` معتبر نباشد، پروژه به mock client برمی گردد. برای نسخه عملیاتی، منبع معتبر داده باید فقط Supabase باشد و mock/local فقط برای fallback توسعه ای استفاده شود.

متغیرهای مهم:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

کلیدهای حساس مثل service role و کلیدهای AI نباید در فرانت اند قرار بگیرند.

### جدول های اصلی

اسکیمای اصلی از migrations خوانده می شود. جدول های مهم:

- `profiles`: پروفایل کاربران، اعتبار، اطلاعات پستی، بیو، علایق و موارد تکمیلی
- `user_roles`: نقش ها مثل admin, publisher, reader
- `publisher_profiles`: مشخصات ناشر و مالکیت ناشر
- `books`: کتاب ها، وضعیت انتشار، محتوای کتاب، metadata، document V2
- `user_books`: خریدها و قفسه کاربران
- `book_comments`: دیدگاه ها
- `credit_transactions`: تراکنش های اعتبار
- `platform_fee_settings`: تنظیمات مالی پایه
- `reader_highlights`: هایلایت های کاربر
- `reader_states`: آخرین وضعیت خواندن
- `ai_saved_outputs`: خروجی های ذخیره شده AI
- `ai_gateway_settings`: تنظیمات عمومی AI
- `ai_provider_settings`: providerها، مدل ها، base URL و کلیدهای AI
- `ai_usage_logs`: لاگ مصرف AI
- `book_import_projects`: پروژه های تبدیل Word
- `book_import_jobs`: پردازش های سمت سرور برای import
- `book_filter_settings`: تنظیمات فیلترهای قابل مدیریت ادمین
- `user_active_sessions`: کنترل تک نشست فعال کاربر

### migrations مهم

| فایل | نقش |
|---|---|
| `20260612150000_core_schema.sql` | اسکیمای پایه، profiles، books، roles، RLS اولیه |
| `20260612160000_ai_gateway.sql` | تنظیمات و لاگ های AI |
| `20260612190000_reader_persistence.sql` | هایلایت، وضعیت خواندن، خرید، شارژ اعتبار |
| `20260614160000_word_import_pipeline.sql` | پروژه import، jobها و storage خصوصی |
| `20260618100000_book_filter_settings.sql` | فیلترهای قابل تنظیم ادمین |
| `20260619173000_extend_user_profiles.sql` | توسعه پروفایل و avatar |
| `20260620110000_ai_image_model.sql` | مدل تصویر AI |
| `20260624191000_books_realtime_publication.sql` | realtime روی books |
| `20260625120000_unique_word_import_instances.sql` | جلوگیری از قاطی شدن importهای هم نام |
| `20260626173500_restrict_publisher_asset_writes.sql` | محدودیت امنیتی مالکیت ناشر |
| `20260626190500_fast_publisher_book_list.sql` | RPC سریع فهرست کتاب های ناشر |
| `20260626200000_single_active_user_session.sql` | تک نشست فعال کاربر |
| `20260626203000_enable_books_realtime.sql` | فعال سازی realtime کتاب ها |

### اصل امنیتی مالکیت کتاب

هر کتاب باید شناسه یکتا داشته باشد و حتی اگر عنوان، فایل Word، نویسنده و مشخصاتش با کتاب دیگر یکی باشد، نباید با کتاب دیگر merge شود. مالکیت و دسترسی ویرایش باید بر اساس `books.id`, `publisher_id` و سیاست های RLS باشد، نه عنوان یا نام فایل.

ادمین در پنل ادمین می تواند وضعیت کلی کتاب ها را ببیند، اما در صفحه انتشارات خودش نباید دارایی ناشران دیگر را ببیند یا ویرایش کند.

## 6. مدل محتوای کتاب V2

فایل اسکیمای اصلی: `src/lib/book-document-v2/schema.ts`

ساختار سند:

- `BookDocumentV2`
- `BookPageV2`
- `BookBlockV2`
- `BookInlineV2`
- `BookTocItemV2`
- `BookAssetV2`

انواع block:

- `paragraph`
- `heading`
- `image`
- `table`
- `list`
- `math`
- `callout`
- `interactive`
- `page-break`

هر تغییر جدی در مدل سند باید در این فایل شروع شود و بعد در این فایل ها اعمال شود:

- `src/lib/book-document-v2/normalize.ts`
- `src/lib/book-document-v2/from-legacy.ts`
- `src/lib/book-document-v2/pagination.ts`
- `src/lib/book-document-v2/toc.ts`
- `src/components/book-content-v2/BookRendererV2.tsx`
- `src/features/editor-v2/EditorV2Page.tsx`

## 7. قانون مرجع نمایش محتوا

فایل مرجع دامنه محتوا: `src/lib/book-content.ts`

این فایل باید محل اصلی قوانین مشترک باشد:

- `BOOK_CONTENT_REFERENCE_RULES`: توضیح سیاست های مرجع نمایش
- `CALLOUT_PRESETS`: تعریف انواع کال اوت
- `INTERACTIVE_TYPES`: تعریف انواع محتوای تعاملی
- `normalizeBookText`: اصلاح متن، ZWS/ZWNJ، فاصله های فارسی، اعداد و موارد خاص
- `bookDisplayTextHtml`: خروجی HTML امن برای نمایش متن
- `inlineToHtml`: تبدیل inline spans به HTML
- `bookTextDirection`: تشخیص جهت متن
- `citationTooltipAttributes`: tooltip رفرنس و پاورقی
- `pageBreakHtml`, `pageDividerHtml`: نمایش خط و شماره صفحه چاپی
- `blockToHtml`, `blockToReaderBlock`: تبدیل بلاک های import/legacy برای نمایش

فایل مرتبط با فونت Symbol و کاراکترهای یونانی:

- `src/lib/symbol-font.ts`

قواعدی که باید همیشه از این لایه بخوانند:

- ZWS/ZWNJ و کاراکتر `¬`
- پاورقی ها
- رفرنس های درون متنی
- هایپرلینک ها
- subscript و superscript
- فرمول های درون متن
- فرمول های شیمیایی و یونانی
- عددهای فارسی و انگلیسی بدون تغییر ناخواسته
- کپشن ها
- page break و شماره صفحه چاپی
- callout و interactive rendering

صفحات و بخش هایی که باید از این قوانین مشترک پیروی کنند:

- تبدیل Word
- پیش نمایش تبدیل Word
- ادیتور
- پیش نمایش ادیتور
- کتابخوان
- صفحه معرفی کتاب
- نمونه کتاب
- خلاصه کتاب
- یادداشت ها
- خروجی های AI
- هایلایت ها
- کپشن تصاویر
- متن داخل کال اوت ها و تعاملی ها

## 8. رندر مشترک Book Content V2

پوشه: `src/components/book-content-v2`

| فایل | مسئولیت |
|---|---|
| `BookRendererV2.tsx` | رندر سند V2 برای کتابخوان، preview و بخش های مشترک |
| `InlineTextV2.tsx` | رندر inlineها، markها، لینک، cite، sub/sup و متن |
| `CalloutBlockV2.tsx` | رندر کال اوت ها |
| `InteractiveBlockV2.tsx` | رندر بلاک های تعاملی |
| `PageBreakV2.tsx` | نمایش جداکننده صفحه چاپی |
| `book-content-v2.css` | ظاهر مشترک محتوا |
| `index.ts` | exportهای عمومی |

اگر تغییری در ظاهر کال اوت، تعاملی، کپشن، tooltip یا page break لازم است، اول این پوشه را بررسی کنید. اگر همان قابلیت در ادیتور و کتابخوان باید یکسان باشد، نباید جداگانه در صفحه ها کپی شود.

## 9. ادیتور V2

فایل اصلی: `src/features/editor-v2/EditorV2Page.tsx`  
استایل: `src/features/editor-v2/editor-v2.css`

مسئولیت ها:

- بارگذاری کتاب از Supabase/مخزن کتاب
- تبدیل سند V2 به HTML قابل ویرایش
- تبدیل DOM ادیتور به سند V2
- ذخیره خودکار و ذخیره دستی
- ارسال update برای realtime و BroadcastChannel
- پنل فهرست
- پنل ارتقا متن و کال اوت
- پنل رسانه
- پنل تعاملی
- پنل AI
- نوار ابزار متن
- مدیریت page breakهای غیرقابل حذف
- مدیریت caption و image selection

توابع مهم که در همین فایل دیده می شوند:

- `documentToEditorHtmlV2`
- `blockToEditorHtmlV2`
- `documentFromEditorDomV2`
- `editorNodeToBlockV2`
- `elementToBlockV2`
- `rebuildDocumentTocV2`
- `updateBlockInDocumentV2`
- `insertBlockAfterV2`
- `collectMediaReferencesV2`
- `collectInlineReferencesV2`
- `TextToolbarV2`
- `TocTreeV2`
- `RightPanelV2`
- `SaveIndicator`

نکته مهم: ادیتور V2 هنوز یک فایل بزرگ است. برای توسعه آینده بهتر است این اجزا به فایل های جدا منتقل شوند:

- `editor-document-html.ts`
- `editor-dom-parser.ts`
- `editor-save.ts`
- `EditorTextToolbar.tsx`
- `EditorTocPanel.tsx`
- `EditorMediaPanel.tsx`
- `EditorCalloutPanel.tsx`
- `EditorInteractivePanel.tsx`
- `EditorAiPanel.tsx`

اما تا زمان refactor، تغییرات ادیتور باید با دقت داخل همین فایل و با حفظ مسیر ذخیره و تبدیل DOM انجام شود.

### قانون های ادیتور که نباید شکسته شوند

- متن مرکزی باید مثل سند Word پیوسته باشد، نه کارت کارت و نه هر خط یک بلوک.
- page break چاپی نباید توسط کاربر حذف شود.
- اگر page break حذف شد باید در save یا normalize برگردد.
- تغییر heading باید ToC را هماهنگ کند.
- خارج کردن متن از heading باید همان مورد را از ToC حذف کند.
- list, alignment, bold, italic, regular, direction, link, color, sub/sup و clear format باید در هر سه مرحله درست باشند:
  1. در ادیتور اعمال شوند
  2. در سند ذخیره شوند
  3. در کتابخوان دیده شوند
- ذخیره خودکار نباید DOM ادیتور را وسط تایپ کاربر reset کند.
- خروجی ذخیره باید source of truth باشد، نه cache محلی قدیمی.

## 10. کتابخوان

فایل اصلی: `src/pages/Reader.tsx`

مسئولیت ها:

- دریافت کتاب با `getBook`
- نمایش صفحات چاپی و فهرست
- navigation صفحه/فصل
- رندر محتوا با `BookRendererV2` یا تبدیل legacy
- مدیریت هایلایت ها
- مدیریت ابزارهای مطالعه
- ذخیره وضعیت خواندن
- دریافت realtime تغییرات کتاب از ادیتور
- نمایش کپشن، tooltip، تصویر بزرگ، گالری، تایم لاین و تعاملی ها
- نمایش AI assistant خروجی های summary, quiz, mindmap و learning path

توابع مهم:

- `legacyListFromText`
- `buildReaderTocTreeRows`
- `ReaderLoading`

نکته: بیشتر منطق Reader در بدنه کامپوننت است. هر تغییری که به نمایش محتوا مربوط است باید ابتدا در `book-content-v2` یا `book-content.ts` انجام شود، سپس Reader فقط آن را مصرف کند.

## 11. ورود کتاب از Word

صفحه شروع: `src/pages/Upload.tsx`  
Worker: `src/workers/docx-import.worker.ts`

جریان کار:

1. کاربر فایل Word را انتخاب می کند.
2. فایل در مرورگر و داخل Web Worker تحلیل می شود.
3. متن، styleها، headingها، تصویرها، tableها، footnoteها، hyperlinkها و page breakها استخراج می شوند.
4. پیش نمایش محلی تولید می شود.
5. کاربر mapping استایل ها و فهرست را تایید می کند.
6. مشخصات کتاب شناسی تکمیل می شود.
7. با تایید کاربر، بسته آماده انتشار ساخته می شود.
8. بسته به Supabase Storage و جدول های import/books آپلود می شود.
9. کتاب وارد ادیتور V2 می شود.

فایل های مرتبط:

- `src/lib/word-import-types.ts`
- `src/lib/word-style-mapping.ts`
- `src/lib/local-import-store.ts`
- `src/lib/import-document.ts`
- `src/lib/import-upload.ts`
- `src/workers/docx-import.worker.ts`

توابع مهم worker:

- `analyze`
- `parseStyles`
- `parseNumbering`
- `normalizeParagraph`
- `parseInline`
- `parseFootnotes`
- `tableBlock`
- `convertImageLocally`
- `calculateComplexity`

قانون مهم: تا قبل از تایید ناشر، تحلیل و پیش نمایش باید محلی باشد و فایل به سرور ارسال نشود.

## 12. انتشار، ناشر و کتاب های ناشر

صفحات:

- `src/pages/Publisher.tsx`
- `src/pages/PublisherSettings.tsx`
- `src/pages/Publish.tsx`

منطق:

- `src/lib/publisher-books.ts`: fallback/local publisher books و رویدادهای تغییر کتاب
- `src/lib/publisher-remote-sync.ts`: sync کتاب های محلی به Supabase
- `src/lib/publisher-delete.ts`: حذف کامل کتاب و دارایی ها
- `src/lib/book-repository.ts`: دریافت کتاب ها از Supabase، فروشگاه، کتابخانه، کتاب ناشر و published books

نکته: نسخه عملیاتی باید به Supabase متکی باشد. `publisher-books.ts` هنوز localStorage fallback دارد و می تواند منبع اختلاف بین local، VS Code browser و GitHub Pages شود. در توسعه آینده بهتر است fallback فقط برای dev demo فعال باشد و در production به عنوان source of truth استفاده نشود.

## 13. فروشگاه، قفسه من و لیست ها

صفحات:

- `src/pages/Store.tsx`
- `src/pages/Library.tsx`
- `src/pages/Landing.tsx`
- `src/pages/BookLanding.tsx`

منطق مشترک فهرست:

- `src/lib/book-listing.ts`

توابع:

- `BOOK_LIST_MAX_ROWS = 15`
- `searchBooks`
- `filterByValue`
- `sortBooks`
- `paginate`
- `pageNumbers`

تنظیمات فیلتر قابل مدیریت ادمین:

- `src/lib/filter-settings.ts`
- جدول `book_filter_settings`

قانون نمایش:

- فروشگاه و landing عمومی هستند و نباید به لاگین وابسته باشند.
- قفسه من، خریدها، ناشر و مدیریت به نقش/لاگین وابسته اند.
- کتاب های منتشر نشده فقط برای ناشر مالک و در بخش های مناسب دیده شوند.

## 14. Auth، نقش ها و نشست فعال

فایل ها:

- `src/lib/auth-context.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/useRoles.ts`
- `src/components/ui/role-guard.tsx`

رفتار:

- اگر Supabase فعال باشد، ورود با Supabase Auth انجام می شود.
- اگر Supabase فعال نباشد، سیستم mock/local فعال می شود.
- نقش ها از `user_roles` خوانده می شوند.
- `RoleGuard` برای routeهای حساس استفاده می شود.
- `ActiveSessionGuard` با جدول `user_active_sessions` فقط یک نشست فعال برای هر کاربر نگه می دارد.

هشدار فنی: در `auth-context.tsx` چند رشته فارسی mojibake دیده می شود. این باید در یک پاکسازی جداگانه با UTF-8 درست شود و از تکرار آن در پیام های جدید جلوگیری شود.

## 15. هوش مصنوعی

### سمت فرانت

فایل اصلی: `src/lib/ai-gateway.ts`

کاربرد:

- بارگذاری تنظیمات AI
- ذخیره تنظیمات ادمین
- تست provider
- تخمین هزینه متن
- اجرای درخواست متن
- تخمین هزینه تصویر
- تولید تصویر

فایل های مرتبط:

- `src/lib/ai-image-prompts.ts`: قانون مرکزی prompt تولید تصویر
- `src/lib/book-cover-ai.ts`: تولید/حل تصویر کاور کتاب
- `src/components/admin/AiGatewaySettingsPanel.tsx`: تنظیمات AI در ادمین
- `src/hooks/useCredits.ts`: دریافت اعتبار کاربر
- `src/lib/credits-bus.ts`: رویداد بروزرسانی credit در UI

### سمت سرور

Edge Function:

- `supabase/functions/ai-gateway/index.ts`

عملیات:

- `admin_get_settings`
- `admin_save_settings`
- `admin_test_provider`
- `estimate_text`
- `estimate_image`
- اجرای درخواست های متنی
- تولید تصویر از endpoint image provider
- محاسبه هزینه خام و هزینه شارژ شده
- ثبت مصرف و کم کردن اعتبار از کاربر

تنظیمات هزینه:

- نرخ دلار: `ai_gateway_settings.usd_to_toman`
- ضریب شارژ کاربر: `ai_gateway_settings.charge_multiplier`
- هزینه input/output هر provider: `ai_provider_settings`
- ارزش هر credit از تنظیمات مالی و محاسبه سمت server

قانون مهم: کلیدهای AI فقط باید در Supabase و Edge Function نگهداری شوند. فرانت فقط مقدار masked یا وضعیت ذخیره شده را می بیند.

## 16. Service Worker، نسخه و cache

فایل ها:

- `src/lib/version.ts`
- `src/lib/version-cache.ts`
- `public/version.json`
- `public/sw.js`
- `src/main.tsx`
- `src/App.tsx`
- `src/components/ui/error-boundary.tsx`

رفتار:

- نسخه برنامه از `src/lib/version.ts` خوانده می شود.
- build نسخه را در `public/version.json` و Service Worker منعکس می کند.
- اگر chunkهای قدیمی در GitHub Pages لود نشوند، `recoverFromDynamicImportError` cache و service worker را پاک می کند و صفحه را با پارامتر نسخه reload می کند.
- `ensureLatestOnlineVersion` نسخه آنلاین را چک می کند.
- `refreshVersionedCaches` با تغییر نسخه cacheهای `metabooki-*` را پاک می کند.

اگر خطای `Failed to fetch dynamically imported module` دیدید، اول این فایل ها را بررسی کنید.

## 17. GitHub و build

فایل ها:

- `.github/workflows/deploy-pages.yml`
- `scripts/auto-sync.ps1`
- `vite.config.ts`
- `package.json`

دستورهای مهم:

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
npm.cmd run sync:github -- -Once
```

رفتار `sync:github`:

1. تغییرات meaningful را پیدا می کند.
2. نسخه را در `src/lib/version.ts` یک واحد بالا می برد.
3. build production اجرا می کند.
4. تغییرات را commit می کند.
5. به `origin main` push می کند.

فایل های `.env` و موارد حساس commit نمی شوند.

## 18. Edge Functions

### `ai-gateway`

مسیر: `supabase/functions/ai-gateway/index.ts`

کارها:

- احراز هویت درخواست
- بررسی نقش ادمین برای تنظیمات
- خواندن کلیدهای provider از جدول امن
- تست provider
- اجرای chat/completions یا Gemini
- اجرای image generation برای OpenAI-compatible provider
- parse خروجی JSON
- محاسبه هزینه و credit
- log مصرف

### `admin-users`

مسیر: `supabase/functions/admin-users/index.ts`

کارها:

- فهرست کاربران برای ادمین
- تغییر password کاربر
- تولید لینک reset password
- خواندن profile و نقش ها

## 19. Import Worker سمت سرور

پوشه: `services/import-worker`

این سرویس برای پردازش کانتینری import در نظر گرفته شده است. فایل های موجود:

- `Dockerfile`
- `index.mjs`
- `package.json`
- `README.md`

در وضعیت فعلی بخش مهمی از import در مرورگر انجام می شود. پردازشگر سمت سرور باید فقط برای کارهایی استفاده شود که مرورگر نمی تواند دقیق انجام دهد، مثل فرمت های تصویری خاص یا تطبیق نهایی.

## 20. راهنمای تغییرات رایج

### افزودن route جدید

1. صفحه را در `src/pages` بسازید.
2. در `src/App.tsx` lazy import و route اضافه کنید.
3. اگر منو لازم دارد، `src/components/navbar/Navbar.tsx` را تغییر دهید.
4. اگر route خصوصی است، `RoleGuard` اضافه کنید.

### تغییر نمایش متن کتاب

1. اول `src/lib/book-content.ts` را بررسی کنید.
2. اگر سند V2 است، `src/components/book-content-v2` را تغییر دهید.
3. ادیتور و کتابخوان نباید قوانین متفاوت داشته باشند.

### تغییر کال اوت

1. `CALLOUT_PRESETS` در `src/lib/book-content.ts`
2. `CalloutBlockV2.tsx`
3. CSS در `book-content-v2.css`
4. ابزار انتخاب کال اوت در `EditorV2Page.tsx`

### تغییر بلاک های تعاملی

1. `INTERACTIVE_TYPES` و templateها در `src/lib/book-content.ts`
2. `InteractiveBlockV2.tsx`
3. ابزارهای ساخت/ادیت داخل `EditorV2Page.tsx`
4. اگر AI پیشنهاد می دهد، promptها و parser در `ai-gateway` و `ai-gateway.ts`

### تغییر کپشن تصویر یا zoom image

1. `BookRendererV2.tsx`
2. `book-content-v2.css`
3. پنل media در `EditorV2Page.tsx`
4. اگر caption از Word می آید، worker و `import-document.ts`

### تغییر Word import

1. `src/workers/docx-import.worker.ts`
2. `src/lib/word-import-types.ts`
3. `src/lib/word-style-mapping.ts`
4. `src/lib/import-document.ts`
5. `src/pages/Upload.tsx`

### تغییر اسکیمای دیتابیس

1. migration جدید در `supabase/migrations`
2. RLS policy را همان جا اضافه کنید.
3. اگر type لازم است، `src/integrations/supabase/types.ts` را regenerate/update کنید.
4. کد repository یا RPC مصرف کننده را update کنید.

### تغییر فهرست کتاب های ناشر

1. RPC `get_my_publisher_books` در migration مربوط
2. `src/lib/book-repository.ts`
3. `src/pages/Publisher.tsx`
4. fallbackهای `publisher-books.ts` را فقط با احتیاط تغییر دهید.

### تغییر محاسبه credit/AI cost

1. `supabase/functions/ai-gateway/index.ts`
2. `src/lib/ai-gateway.ts`
3. جدول های `ai_gateway_settings`, `ai_provider_settings`, `credit_transactions`
4. UI ادمین: `AiGatewaySettingsPanel.tsx`

### تغییر cache/version/GitHub Pages

1. `src/lib/version-cache.ts`
2. `public/sw.js`
3. `src/main.tsx`
4. `.github/workflows/deploy-pages.yml`
5. `scripts/auto-sync.ps1`

## 21. جریان های اصلی سیستم

### جریان عمومی فروشگاه

1. کاربر وارد `/store` یا landing می شود.
2. `book-repository.ts` کتاب های منتشر شده را از Supabase می خواند.
3. فیلتر و pagination از `book-listing.ts` اعمال می شود.
4. کارت کتاب به صفحه معرفی `/b/:id` لینک می شود.
5. خرید یا خواندن با توجه به login و مالکیت کاربر ادامه پیدا می کند.

### جریان کتابخوان

1. route `/read/:id`
2. دریافت کتاب با `getBook`
3. اگر document V2 در metadata باشد، به مدل V2 تبدیل/خوانده می شود.
4. محتوا با `BookRendererV2` نمایش داده می شود.
5. state خواندن در `reader_states` ذخیره می شود.
6. highlights در `reader_highlights` ذخیره می شود.
7. تغییرات کتاب از realtime/Broadcast دریافت می شود.

### جریان تبدیل Word

1. `/upload`
2. انتخاب DOCX
3. worker فایل را parse می کند.
4. styleها، headingها، تصویرها، footnoteها، hyperlinkها و page breaks استخراج می شوند.
5. پیش نمایش محلی ساخته می شود.
6. کاربر mapping و metadata را تایید می کند.
7. `confirmAndUploadImport` بسته را آپلود می کند.
8. رکورد book draft ایجاد می شود.
9. ادیتور V2 باز می شود.

### جریان ادیت و ذخیره

1. `/edit/:id`
2. سند V2 از `books.metadata.editor_v2_document` خوانده می شود.
3. HTML ادیتور از سند ساخته می شود.
4. کاربر متن/رسانه/کال اوت/تعاملی را ویرایش می کند.
5. DOM به سند V2 تبدیل می شود.
6. save در جدول `books` ذخیره می کند.
7. update event برای کتابخوان و تب های دیگر ارسال می شود.

### جریان هوش مصنوعی

1. کاربر درخواست AI می دهد.
2. فرانت ابتدا تخمین هزینه می گیرد.
3. کاربر تایید می کند.
4. درخواست به `ai-gateway` می رود.
5. Edge Function provider را می خواند.
6. خروجی متن یا تصویر تولید می شود.
7. هزینه از اعتبار کاربر کم و log ثبت می شود.
8. خروجی به ادیتور یا کتابخوان برمی گردد.

## 22. نقاط حساس و بدهی فنی

### 1. Mojibake و متن های non-unicode

در چند فایل قدیمی رشته های فارسی خراب دیده می شود، مثل `auth-context.tsx`, `ai-gateway.ts`, `publisher-books.ts` و برخی متن های seed. متن های جدید باید مستقیم UTF-8 باشند و هیچ رشته mojibake جدیدی نباید اضافه شود.

### 2. وجود legacy و V2 کنار هم

هنوز `features/editor` و route قدیمی `/edit-legacy/:id` وجود دارد. مسیر آینده باید V2 باشد. اگر قابلیت جدید مربوط به کتاب است، ابتدا بررسی کنید آیا باید فقط V2 تغییر کند یا legacy هم هنوز مصرف کننده دارد.

### 3. fallback محلی و اختلاف داده

چند فایل هنوز localStorage/mock fallback دارند. این موضوع قبلا باعث تفاوت بین VS Code browser، Chrome و GitHub Pages شده است. برای نسخه عملیاتی، Supabase باید source of truth باشد.

### 4. ادیتور V2 بزرگ و پرمسئولیت

`EditorV2Page.tsx` کارهای زیادی انجام می دهد. برای پایداری بهتر باید به اجزای کوچک تر refactor شود، اما قبل از refactor باید تست دستی مسیرهای save, reader, media, callout و ToC انجام شود.

### 5. Service Worker و chunk cache

بعد از deploy ممکن است chunkهای قدیمی باقی بمانند. کد recovery وجود دارد، اما هر تغییر در route/lazy loading باید با GitHub Pages تست شود.

### 6. Performance کتاب های بزرگ

کتاب های بزرگ، تصویر زیاد و DOM ادیتور می توانند کند شوند. راهکارهای آینده:

- render مجازی یا section paging در ادیتور
- lazy loading تصاویر
- chunk کردن سند V2
- cache کنترل شده از Supabase با invalidation نسخه ای
- کاهش work داخل render

## 23. چک لیست برنامه نویس جدید

برای مسلط شدن به پروژه این مسیر را بخوانید:

1. `package.json`
2. `src/App.tsx`
3. `src/integrations/supabase/client.ts`
4. `supabase/migrations/20260612150000_core_schema.sql`
5. `src/lib/book-document-v2/schema.ts`
6. `src/lib/book-content.ts`
7. `src/components/book-content-v2/BookRendererV2.tsx`
8. `src/pages/Reader.tsx`
9. `src/features/editor-v2/EditorV2Page.tsx`
10. `src/workers/docx-import.worker.ts`
11. `src/lib/import-upload.ts`
12. `src/lib/book-repository.ts`
13. `src/lib/ai-gateway.ts`
14. `supabase/functions/ai-gateway/index.ts`
15. `src/lib/version-cache.ts`

بعد از مطالعه این ها، برنامه نویس می تواند مسیر اصلی داده از Word تا ادیتور، کتابخوان، فروشگاه و AI را دنبال کند.

## 24. استاندارد تست دستی بعد از تغییرات

بعد از هر تغییر مهم این موارد باید چک شوند:

1. `npm.cmd run build`
2. اجرای سایت با `npm.cmd run dev`
3. فروشگاه بدون login کتاب ها را نشان دهد.
4. قفسه من فقط با login کار کند.
5. صفحه انتشارات فقط کتاب های ناشر مالک را نشان دهد.
6. ادیتور کتاب را باز کند.
7. save دستی و autosave کار کند.
8. تغییر ادیتور در کتابخوان دیده شود.
9. heading و ToC با هم هماهنگ باشند.
10. page break چاپی حذف نشود.
11. ZWS/ZWNJ، پاورقی، sub/sup، hyperlink و یونانی ها درست دیده شوند.
12. کپشن تصویر در ادیتور و کتابخوان یکسان باشد.
13. کال اوت در ادیتور، save و کتابخوان درست باشد.
14. تعاملی ها در ادیتور و کتابخوان یکسان باشند.
15. AI قبل از مصرف هزینه تایید بگیرد.
16. GitHub Pages بعد از deploy chunk error ندهد.

## 25. دستورهای مفید برای بررسی کد

```powershell
rg --files src
rg "function |export function|export const" src\features\editor-v2\EditorV2Page.tsx
rg "create table|create policy|create or replace function" supabase\migrations
npm.cmd run build
npm.cmd run dev
npm.cmd run sync:github -- -Once
```

برای خواندن وضعیت Git:

```powershell
git status --short
git log --oneline -5
git remote -v
```

## 26. تصمیم های معماری که باید حفظ شوند

- Supabase منبع اصلی داده است.
- هر upload کتاب یک شناسه یکتا دارد و با کتاب هم نام قاطی نمی شود.
- مالکیت کتاب بر اساس publisher و RLS کنترل می شود.
- نمایش محتوا باید از لایه مشترک book-content و renderer V2 عبور کند.
- کلیدهای حساس در فرانت اند ذخیره نمی شوند.
- AI از Edge Function عبور می کند.
- ادیتور نباید هنگام autosave تایپ کاربر را reset کند.
- محتوا باید UTF-8 واقعی باشد، نه mojibake.
- نسخه برنامه باید از `src/lib/version.ts` خوانده شود.
- بعد از تغییرات production باید build و deploy بررسی شود.

## 27. نقشه سریع محل تغییر

| خواسته | محل اصلی |
|---|---|
| تغییر route | `src/App.tsx` |
| تغییر نوار بالا | `src/components/navbar/Navbar.tsx` |
| تغییر فروشگاه | `src/pages/Store.tsx`, `src/lib/book-listing.ts` |
| تغییر قفسه من | `src/pages/Library.tsx`, `book-repository.ts` |
| تغییر صفحه ناشر | `src/pages/Publisher.tsx` |
| تغییر ادیتور | `src/features/editor-v2/EditorV2Page.tsx` |
| تغییر کتابخوان | `src/pages/Reader.tsx` |
| تغییر رندر متن | `src/lib/book-content.ts`, `src/components/book-content-v2` |
| تغییر کال اوت | `book-content.ts`, `CalloutBlockV2.tsx`, `EditorV2Page.tsx` |
| تغییر تعاملی | `book-content.ts`, `InteractiveBlockV2.tsx`, `EditorV2Page.tsx` |
| تغییر رسانه و تصویر | `BookRendererV2.tsx`, `EditorV2Page.tsx` |
| تغییر Word import | `docx-import.worker.ts`, `import-document.ts`, `Upload.tsx` |
| تغییر AI | `ai-gateway.ts`, `supabase/functions/ai-gateway/index.ts` |
| تغییر هزینه AI | Edge Function و tables AI/credit |
| تغییر دیتابیس | migration جدید در `supabase/migrations` |
| تغییر RLS | migrations مربوط |
| تغییر cache | `version-cache.ts`, `public/sw.js` |
| تغییر deploy | `.github/workflows/deploy-pages.yml`, `auto-sync.ps1` |

## 28. یادداشت پایانی

این سند باید همراه پروژه به روز شود. هر بار که یک قابلیت بزرگ اضافه شد، حداقل این سه بخش را اصلاح کنید:

1. نقشه فایل ها و جریان مربوط به قابلیت
2. محل تغییر برای برنامه نویس بعدی
3. نقاط حساس و تست دستی همان قابلیت

اگر بین کد و این سند اختلاف پیدا شد، کد فعلی source of truth است، اما اختلاف باید بلافاصله در این سند اصلاح شود تا سند به مرجع قابل اعتماد پروژه باقی بماند.
