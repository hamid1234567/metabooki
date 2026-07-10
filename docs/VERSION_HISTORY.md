# Metabooki Version History and Decision Log

نسخه فعلی فایل رسمی: `1.0.687`
منبع نسخه: `src/lib/version.ts`

این فایل تاریخچه محصولی کامل نیست؛ هدف آن ثبت تصمیم‌های معماری و علت تغییرات مهم است تا برنامه‌نویس بعدی بداند چرا مسیر فعلی انتخاب شده است.

## قواعد نگهداری نسخه

1. عدد معتبر نسخه فقط `APP_VERSION` در `src/lib/version.ts` است.
2. قبل از deploy، `public/version.json` و `public/sw.js` باید با آن هماهنگ باشند.
3. هر تغییر معماری یا تغییر رفتار cache/save/render باید در این فایل ثبت شود.
4. اگر تغییری فقط UI کوچک است، ثبت در commit کافی است.
5. با هر افزایش نسخه سایت، علت افزایش نسخه باید در همین فایل یا در بخش تصمیم‌های معماری مرتبط ثبت شود.

## خلاصه مسیر نسخه‌ها

### 1.0.687 - Storytelling direction and empty-title polish

- Storytelling previous/next controls now place the next button at the visual end of the inherited text direction: left for RTL and right for LTR.
- Storytelling no longer creates artificial step titles when a step title is empty.
- The dedicated storytelling reader markup still uses the shared Interactive V3 block wrapper, item normalization, and direction utilities.

### 1.0.686 - Storytelling reader redesign

- Interactive V3 storytelling now uses a dedicated reader layout with separated image and text areas.
- Story images have rounded framed media treatment, while text cards use colored step accents for the active story stage.
- Step navigation was redesigned with clearer side step buttons, progress dots, and cleaner previous/next controls.

### 1.0.685 - Gallery thumbnail and visual state polish

- Gallery thumbnails now change the active gallery image without bubbling to the global image zoom handler.
- Gallery empty image space now uses a frosted glass surface instead of a flat gray fill.
- Caption toggle on/off state and the active thumbnail frame are now visually clearer.

### 1.0.684 - Gallery RTL motion direction

- Gallery RTL slide order now keeps the first image on the right and moves to the next image from left to right.
- The paused play icon now points in the actual gallery movement direction.
- The caption visibility control now uses a `CC` label.

### 1.0.683 - Simple gallery motion and captions

- Simple Interactive V3 gallery now moves between images with an eased horizontal transition instead of a flash-style swap.
- Gallery autoplay interval changed from three seconds to five seconds.
- Captions now render over the image with a bottom gradient and can be hidden or shown from an in-image control next to play/pause.

### 1.0.682 - Restore simple gallery with timer

- Restored the Interactive V3 gallery to the simpler pre-redesign layout so the reader route can load the gallery component again.
- Added default 3-second autoplay to the simple gallery, with a small pause/play control in the existing navigation row.
- Removed the failed carousel-shell styling from the active gallery CSS path.

### 1.0.681 - Interactive nav row placement

- Gallery, timeline, and storytelling previous/next controls now render together in a bottom action row instead of flanking the content.
- Previous and next arrow glyphs were swapped to match the RTL reading flow and actual slide movement.

### 1.0.680 - Interactive nav arrow centering

- Circular previous/next buttons in Interactive V3 gallery, timeline, and storytelling views now center their arrow glyphs reliably.
- Nav buttons use grid centering, fixed flex basis, zero padding, and LTR icon direction so RTL page alignment does not shift the markers.

### 1.0.679 - Hotspot popover clipping and image sizing

- Reader hotspot popovers no longer clip at the image border and use physical left/right placement so RTL direction does not push edge labels off-screen.
- Hotspot images now keep an `imageWidthPercent` payload value and render at that width in editor and reader.
- Editor hotspot blocks now include the same width range control pattern used for regular images.

### 1.0.678 - Hotspot fixed editor text panel

- Hotspot marker clicks now open the matching point editor in a fixed card area below the image.
- Newly added points open the fixed text card immediately and focus the description field.
- Edge points no longer place editable fields outside the editor canvas.

### 1.0.677 - Hotspot editor click-to-add fix

- Hotspot blocks no longer render the generic interactive add-item button.
- New hotspot blocks start with an image placeholder and no forced point; users add points by clicking the selected image.
- Clicking a hotspot marker in the editor opens only that compact edit card, and deleting the final point is allowed.

### 1.0.676 - Interactive V3 hotspot redesign

- Hotspot editor blocks now show the full image as the click target and add new points at the clicked image coordinate.
- Hotspot points can be added and removed without the normal interactive item limit.
- Reader hotspots now render as compact red plus markers with animated popovers, automatic inward placement, connector lines, a show/hide-all control, and smaller text when many points exist.

### 1.0.675 - Reader page-engine loading placeholder

- Reader no longer shows the intentional empty-page message while a page-engine page is still a loading placeholder.
- BookRenderer V2 now treats `pageEnginePlaceholder` pages as loading pages, not empty content pages.
- Page-engine window loading in Reader reruns when the current placeholder state changes, reducing cases where navigation was needed to refresh image-heavy pages.

### 1.0.674 - Interactive V3 inherited direction

- Interactive V3 reader blocks now derive RTL/LTR from the first strong character in the actual entered item text.
- Empty-title/empty-text interactive blocks no longer force LTR; they inherit the surrounding book direction for tabs, buttons, and layout alignment.
- Interactive text and controls use logical `text-align: start` so Persian content aligns right and English content aligns left.

### 1.0.673 - Interactive V3 editor and reader polish

- Interactive image selection now reuses the editor media/reference image list and shared book-image modal, with multi-select support for interactive placeholders.
- Interactive uploads accept multiple files, compress oversized images before server upload, and notify the user when compression happens.
- Interactive blocks can be removed from Editor V2, empty interactive titles stay hidden in the reader, and tabs now render with their own reader component.
- Reader-side interactive blocks now sit transparently in the book flow, use smaller typography, top-align text beside images, and animate item transitions.

### 1.0.672 - prevent route preload refresh loops

- Background route preloads no longer trigger dynamic-import recovery reloads.
- Dynamic import recovery now ignores `appVersion` and `recover` query parameters when creating its once-per-route marker.
- This prevents non-home routes from entering a reload loop when a stale chunk, cache, or service worker is still present.

### 1.0.671 - اصلاح شناسه و payload مدل‌های Nano Banana در KIE

- شناسه‌های تصویری Google Nano Banana از `google/nano-banana-*` به `nano-banana-*` تغییر کردند.
- payload مدل‌های Nano Banana با مسیر عمومی KIE هماهنگ شد و دیگر مثل Qwen با `image_size` ارسال نمی‌شود.

### 1.0.670 - تبدیل تولید تصویر KIE به task polling

- تولید تصویر KIE از انتظار طولانی داخل Edge Function به start/poll کوتاه منتقل شد تا خطای compute resources رخ ندهد.
- استخراج task id برای پاسخ‌های مختلف KIE مقاوم‌تر شد.
- هزینه تصویر فقط بعد از دریافت URL نهایی تصویر کسر می‌شود.

### 1.0.669 - اصلاح مسیر مدل‌های KIE

- مسیر فراخوانی KIE برای خانواده‌های مختلف مدل جدا شد تا مدل انتخاب‌شده در پنل ادمین دقیقاً همان مدل ارسال‌شده به KIE باشد.
- مسیرهای Codex responses، GPT 5.2 chat completions، Claude messages، Gemini chat completions و Grok responses از هم تفکیک شدند.
- شناسه‌های مدل تصویر KIE به شناسه‌های معتبر مثل `qwen/text-to-image` اصلاح شدند.
- Edge Function `ai-gateway` بعد از اصلاح routeها مجدداً روی Supabase deploy شد.

### 1.0.3xx - شروع Editor V2

- ادیتور جدید با بوم مرکزی و پنل سمت راست طراحی شد.
- هدف: جایگزینی ادیتور قدیمی و پایان دادن به patchهای پراکنده.
- گزارش اولیه در `docs/editor-v2-implementation-report.md` باقی مانده است.

### 1.0.4xx - عملیاتی‌سازی نشر و Supabase

- پنل نشر، قفسه من، فروشگاه و Admin به Supabase نزدیک‌تر شدند.
- مشکل اختلاف local/GitHub/VS Code browser شناسایی شد.
- تصمیم معماری: Supabase باید source of truth باشد و local fallback فقط dev/demo بماند.

### 1.0.50x - یکپارچه‌سازی نمایش محتوا

- `book-content.ts` و `BookContentBlocks.tsx` به‌عنوان مسیر مشترک نمایش متن، callout، interactive، caption و tooltip تثبیت شدند.
- ZWS/ZWNJ، پاورقی، رفرنس، لینک، subscript/superscript و فرمول‌ها باید از همین مسیرها کنترل شوند.

### 1.0.54x - بهبود ادیتور متن و رسانه

- toolbar متن کوچک‌تر و عملیاتی‌تر شد.
- autosave از رفتار مزاحم به ذخیره زمان‌بندی‌شده نزدیک شد.
- کپشن تصویر، zoom modal، تشخیص خودکار کپشن و media panel اصلاح شدند.
- تصمیم: media edit باید داخل همان بلوک/بوم یا پنل مرتبط انجام شود، نه در مسیرهای جداگانه.

### 1.0.57x - Page-Based Content Engine

- برای کتاب‌های بزرگ، لود و ذخیره کل کتاب کنار گذاشته شد.
- `book_content_manifests`, `book_pages`, `book_assets`, `book_search_index` اضافه شدند.
- اولین لود 50 صفحه است و برای پرش‌ها window شامل 10 صفحه قبل و 40 صفحه بعد گرفته می‌شود.
- ذخیره فقط dirty pageها را می‌فرستد؛ manifest فقط هنگام تغییر TOC/assets/search metadata refresh می‌شود.
- Reader و Editor باید TOC کامل را از manifest بخوانند، نه فقط از صفحه‌های لود شده.

### 1.0.578 - پاکسازی مرجع و حذف legacy

- ادیتور legacy (`src/pages/Edit.tsx`) حذف شد.
- route قدیمی `/edit-legacy/:id` حذف شد.
- دکمه «ادیتور قبلی» از پنل نشر حذف شد.
- سند نامرتبط `docs/CARDIAC_CYCLE_PLAN.md` حذف شد.
- مستندات معماری و DFD/ERD/امنیت بر اساس وضعیت فعلی بازنویسی شدند.
- Supabase client دارای retry محدود read/auth است تا timeoutهای مستقیم شبکه‌ای بهتر مدیریت شود، بدون retry برای writeهای ادیتور.

### 1.0.593 - تثبیت صفحه خالی، Undo و فهرست ادیتور

- تشخیص صفحه خالی در Editor V2، Reader و renderer محتوای V2 از `blocks.length` به «محتوای قابل نمایش» تغییر کرد.
- صفحه‌ای که فقط پاراگراف یا heading خالی دارد، در ادیتور placeholder قابل کلیک و در کتابخوان پیام صفحه خالی می‌گیرد.
- Undo/Redo بعد از بازگردانی HTML، مدل `BookDocumentV2` را دوباره از DOM می‌سازد و صفحه‌های لودشده را dirty می‌کند تا save بعدی نتیجه Undo را ذخیره کند.
- تغییر مستقیم متن heading در بوم مرکزی سریع‌تر به مدل سند و فهرست منتقل می‌شود.
- heading بدون متن از TOC حذف می‌شود تا جای خالی عنوان در فهرست باقی نماند.

### 1.0.597 - همگام‌سازی نسخه و checkpoint ادیتور

- `APP_VERSION`، `public/version.json` و `public/sw.js` بعد از sync خودکار تا 1.0.597 بالا رفتند.
- سندهای مرجع معماری و DFD/ERD/امنیت با نسخه واقعی سایت هماهنگ شدند.
- checkpoint وضعیت فعلی Editor V2 برای ادامه کار روی ادیتور ثبت شد.
- از این نسخه به بعد، هر افزایش نسخه باید همراه با علت در همین فایل ثبت شود.

### 1.0.599 - استقلال فهرست و رسانه از window پنجاه صفحه‌ای ادیتور

- شرط recovery فهرست کتاب‌های بزرگ اصلاح شد تا ناقص بودن TOC فقط به 50 صفحه اول محدود تشخیص داده نشود.
- هنگام load ادیتور/کتابخوان، manifest می‌تواند TOC و `assets_summary` را از کل `book_pages` و `book_assets` ترمیم کند.
- `BookAssetV2` اکنون `blockId` را هم نگه می‌دارد تا پنل رسانه بتواند تصویرهای خارج از window فعلی را پیدا کند.
- کلیک روی تصویرهای پنل رسانه یا ارجاعات، اگر بلوک هنوز لود نشده باشد، window همان صفحه را لود می‌کند و سپس به صفحه/تصویر می‌رود.
- ذخیره صفحه‌ای، خلاصه assets صفحه‌های dirty را با خلاصه کامل قبلی merge می‌کند تا save یک صفحه باعث حذف دارایی‌های صفحات دیگر از manifest نشود.

### 1.0.615 - شروع بازطراحی یکپارچه پنل ارجاعات

- فایل مشترک `src/lib/book-references.ts` برای تشخیص نوع ارجاع، کلاس‌های مشترک، tooltip و preview ایجاد شد.
- `InlineTextV2` و HTML ادیتور از قوانین مشترک ارجاعات استفاده می‌کنند.
- پنل ارجاعات ادیتور از لینک ساده به چند آکاردئون برای لینک خارجی، سرفصل، پاورقی، رفرنس داخل متن و اتصال تصویر تبدیل شد.
- کلیک روی ارجاع موجود در بوم ادیتور، پنل ارجاعات را باز می‌کند و همان ارجاع را برای ویرایش فعال می‌کند.
- اعمال/حذف ارجاع از یک مسیر مشترک انجام می‌شود و نتیجه در همان صفحه dirty می‌شود تا ذخیره صفحه‌ای باقی بماند.
- پیش‌نمایش hover لینک تصویر در renderer فقط 20 کاراکتر نخست کپشن را نشان می‌دهد و کلیک روی لینک تصویر زوم همان عکس را بدون جابه‌جایی صفحه باز می‌کند.

### 1.0.619 - همگام‌سازی نسخه پس از auto-sync ارجاعات

- auto-sync پس از commitهای ارجاعات، `APP_VERSION`, `public/version.json` و `public/sw.js` را تا 1.0.619 بالا برد.
- این entry فقط برای همگام نگه داشتن سند رسمی نسخه با عدد واقعی برنامه اضافه شد؛ تغییر رفتاری جدیدی نسبت به 1.0.615 ندارد.

### 1.0.620 - ثبت نسخه واقعی پس از همگام‌سازی خودکار

- `APP_VERSION`, `public/version.json` و `public/sw.js` به 1.0.620 رسیده‌اند.
- این entry برای جلوگیری از اختلاف عدد نسخه برنامه با سند رسمی اضافه شد؛ تغییر رفتاری جدیدی نسبت به اصلاحات مستقل‌سازی فهرست/رسانه و پنل ارجاعات ندارد.

### 1.0.630 - تکمیل مرحله اول پنل ارجاعات

- پنل ارجاعات از لیست read-only به مسیر قابل ویرایش نزدیک‌تر شد: آیتم‌های موجود در لیست ارجاعات می‌توانند همان ارجاع را در بوم مرکزی پیدا و فعال کنند.
- با انتخاب یک ارجاع موجود، فرم همان نوع ارجاع در پنل بالا پر می‌شود و اعمال/حذف از همان مسیر مشترک `replaceOrWrapReferenceSelection` و `removeReferenceFromSelection` انجام می‌شود.
- نوار ابزار متن با دکمه لینک همچنان فقط تب ارجاعات را باز می‌کند و منطق لینک/پاورقی/رفرنس/تصویر در همان پنل سمت راست متمرکز می‌ماند.

### 1.0.647 - ساده‌سازی ویرایش ارجاعات

- جستجوی ارجاعات به ابتدای پنل ارجاعات منتقل شد و نتیجه‌های جستجو منبع انتخاب/ویرایش/حذف سریع شدند.
- اسکرول خودکار پنل به بخش «اتصال متن به تصویر» هنگام انتخاب متن حذف شد.
- آکاردئون‌های پنل ارجاعات تک‌حالته شدند تا فقط یک بخش باز بماند.
- لینک داخلی سرفصل‌ها با `href="#anchor"` ذخیره می‌شود تا به URL کامل تبدیل نشود.
- ارجاع تصویری در کتابخوان در صورت نبودن بلوک تصویر در window فعلی، از `document.assets` برای پیش‌نمایش و زوم تصویر استفاده می‌کند.

### 1.0.656 - همگام‌سازی نسخه پس از اصلاح پنل ارجاعات

- auto-sync پس از build، فایل‌های نسخه را تا 1.0.656 بالا برد.
- تغییر رفتاری جدیدی نسبت به 1.0.647 ندارد و فقط سند رسمی را با عدد واقعی برنامه همگام می‌کند.

## تصمیم‌های معماری که نباید نادیده گرفته شوند

### فقط یک ادیتور

هر قابلیت جدید باید در `src/features/editor-v2/EditorV2Page.tsx` و مدل مشترک V2 اضافه شود. ایجاد editor موازی یا route legacy جدید ممنوع است مگر با تصمیم معماری ثبت‌شده.

### فقط یک renderer محتوایی

اگر متن در reader درست است ولی در editor یا preview خراب است، مشکل را با patch محلی حل نکنید. ابتدا `book-content.ts`, `book-document-v2/normalize.ts`, `BookContentBlocks.tsx` و schema را بررسی کنید.

### TOC مستقل از window لود شده

TOC باید از manifest کامل خوانده شود. window فعلی editor/reader فقط برای متن صفحه است، نه ساخت فهرست کامل کتاب.

### ذخیره صفحه‌ای

برای تغییر یک صفحه، کل کتاب نباید ارسال شود. اگر ویژگی جدیدی کل کتاب را بازنویسی می‌کند، قبل از merge باید دلیلش در این فایل ثبت شود.

### امنیت نشر

کتاب draft دارایی ناشر است. Admin می‌تواند وضعیت را ببیند، اما مسیر ویرایش draft ناشر دیگر نباید از پنل نشر admin در دسترس باشد.
