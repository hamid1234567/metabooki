# Metabooki Version History and Decision Log

نسخه فعلی فایل رسمی: `1.0.717`
منبع نسخه: `src/lib/version.ts`

این فایل تاریخچه محصولی کامل نیست؛ هدف آن ثبت تصمیم‌های معماری و علت تغییرات مهم است تا برنامه‌نویس بعدی بداند چرا مسیر فعلی انتخاب شده است.

## قواعد نگهداری نسخه

1. عدد معتبر نسخه فقط `APP_VERSION` در `src/lib/version.ts` است.
2. قبل از deploy، `public/version.json` و `public/sw.js` باید با آن هماهنگ باشند.
3. هر تغییر معماری یا تغییر رفتار cache/save/render باید در این فایل ثبت شود.
4. اگر تغییری فقط UI کوچک است، ثبت در commit کافی است.
5. با هر افزایش نسخه سایت، علت افزایش نسخه باید در همین فایل یا در بخش تصمیم‌های معماری مرتبط ثبت شود.

## خلاصه مسیر نسخه‌ها

### 1.0.717 - Local route preload relief

- Development builds now skip background preloading of heavy route chunks such as Reader, Editor V2, and Upload.
- This avoids compiling/loading Reader in the background while opening Editor V2 on localhost, reducing perceived local slowness.
- Production route preloading remains unchanged.

### 1.0.716 - AI heading-section source

- Editor V2 AI editorial/callout suggestions now use the user's current heading section as the default input instead of only the active page.
- The source range starts at the nearest previous/current heading and stops at the next same-or-higher-level heading or 8,000 characters, whichever comes first.
- Explicit text selections remain honored as the exact AI input, still capped at 8,000 characters.

### 1.0.715 - AI approval modal closes on run

- The Editor V2 AI editorial suggestion approval modal now closes immediately when the user confirms generation instead of staying visible during or after generation.
- The approved estimate payload is captured locally before clearing approval state, so generation continues safely after the modal closes.
- Current AI source selection remains selection, then selected block, then current page fallback; heading-section input should be considered as a capped option because token use depends on section length.

### 1.0.714 - Temporary AI cost formula display

- The Editor V2 AI approval modal now temporarily displays detailed cost-estimate math for editorial/callout suggestions.
- The AI gateway text estimate response now includes `estimateDetails` with input tokens, min/max/weighted output tokens, provider rates, multiplier, USD-to-toman conversion, credit value, and final charged credits.
- The approval modal copy was updated to describe mixed formatting/callout suggestions instead of saying the operation only creates callouts.

### 1.0.713 - AI formatting-first suggestion balance

- AI editorial suggestion classification now honors explicit `suggestionType: formatting` before checking callout-like action/title text, preventing formatting suggestions from turning into callouts.
- The editor normalizes AI suggestion batches so at most two items remain `educational_callout`; the rest are routed as formatting suggestions.
- The Edge Function callout suggestion prompt now explicitly asks for 70-80% formatting suggestions and at most one or two educational callouts.

### 1.0.712 - AI callout detection fix

- AI callout suggestion detection now prioritizes explicit callout signals such as `educational_callout`, `callout`, and Persian callout titles before checking formatting labels.
- Legacy or mixed model outputs that include both formatting and callout wording no longer get routed through formatting, so educational callout cards can convert into real callout blocks again.
- The AI gateway prompt schema now tells models to return exactly one suggestionType value and not a combined value.

### 1.0.711 - AI suggestion applied state

- Applied AI editorial suggestion cards now remain visible as green completed items with a disabled apply button and an applied status message.
- AI suggestion application now computes the document change before committing instead of depending on a mutable flag inside the React state updater, preventing later suggestions from getting stuck after one item is applied.
- Generated AI suggestions now store their likely target block so follow-up suggestions can still apply even after the first change updates the editor surface.

### 1.0.710 - Complete AI formatting application

- AI formatting suggestions now apply inline styles to the exact source text in the document model instead of relying only on DOM selection.
- Supported AI formatting actions now include bold, italic, underline, strike, highlight/background color, text color, font-size changes, and clear-format handling.
- Block-level AI formatting can apply alignment and simple block text styling without converting the suggestion into a callout.
- AI estimate preflight now uses the requested weighted range rule for bounded output usage: `(2 * minimum + maximum) / 3`; completed requests still charge by actual provider token usage.

### 1.0.709 - AI suggestion cost and formatting actions

- AI text cost estimates now use action-specific expected output tokens instead of billing the full generation cap during preflight; callout suggestion estimates no longer include the old 15% max-token padding.
- The callout suggestion generation cap was reduced to better match the stricter editorial prompt while keeping actual post-run credit charging based on real provider token usage.
- Editor V2 now classifies AI suggestions as formatting/editing before checking callout variants, so formatting cards are no longer converted into educational callouts just because `variant` is present.
- Common formatting suggestions can now apply directly as bold text, heading/subheading, list conversion, or paragraph splitting; unsupported formatting suggestions stay non-callout and show a clear message.

### 1.0.708 - Current-page AI source and replacement callouts

- Editor V2 AI text analysis now uses the exact selected text, current selected block, or current editor page instead of falling back to the beginning of the full document.
- Applying an AI educational callout now replaces the matched source text with a callout block, preserving surrounding paragraph text when the quote is inside a larger paragraph.
- AI callout application now uses the original selected/source quote inside the callout body so the author's wording is preserved instead of adding explanatory text under the original passage.

### 1.0.707 - Actionable AI editorial suggestions

- The default admin-editable callout suggestion prompt now uses the user's Persian professional digital-book editor prompt and is applied by default even when the stored setting is empty.
- AI callout/text enhancement output now returns actionable formatting/callout suggestions instead of a generic explanatory paragraph.
- Editor V2 shows the current AI suggestions as a separate list with apply/dismiss actions; educational callouts insert real callout blocks and bold/highlight suggestions can apply directly when the source quote is found.
- The edge prompt schema now asks for suggestion type, exact source quote, proposed action, short reason, importance, and location-ordered suggestions.

### 1.0.706 - AI callout prompt and image history reuse

- The callout suggestion prompt now behaves like an educational editor: it only suggests strong callout-worthy fragments, anchors each suggestion to an exact source quote, and can return no suggestions instead of forcing a weak callout.
- Editor V2 no longer inserts fallback page text when AI returns no strong callout suggestion; it records usage/history and reports that no strong callout was found.
- Reusing an image from AI history now places it in the active interactive placeholder when available, or inserts it as a normal image block in the editor text when no placeholder is active.
- Opening the Editor V2 AI panel refreshes AI history again so old outputs are less likely to appear missing after initial load/session timing issues.

### 1.0.705 - AI history visibility and gateway timeouts

- Editor V2 AI panel now labels the text action as a callout suggestion flow and explains that it inserts a new callout without replacing the original text.
- Saved AI output history now applies the current-book filter before ordering/limiting, has a client-side timeout, and surfaces read errors instead of silently looking empty.
- The user profile AI output section now separates loading, empty, and error states so intermittent Supabase/RLS/network failures are visible.
- AI gateway calls now have client-side timeouts for estimate/run/test/image routes, preventing the UI from staying stuck on cost estimation forever.

### 1.0.704 - User-friendly save failure messages

- Editor V2 save failures caused by `Failed to fetch` now show a Persian user-facing connection message instead of the raw page-engine/full-book fallback text.
- Technical Supabase details are still included under a short `جزئیات فنی` section for debugging, while the main message explains that changes remain in the editor and the user can retry saving.

### 1.0.703 - Interactive AI image placement and history stability

- Interactive image generation approval now closes immediately after user confirmation, while the requested placeholder stays in a visible AI loading state until the image is inserted.
- Generated interactive images are fetched, compressed to the existing 1K interactive-image rule when possible, uploaded, and then inserted from the lighter stored URL.
- Interactive media placeholders now keep a stable target descriptor so images selected from AI history can be inserted even after panel changes or DOM refreshes.
- AI history loading now ignores stale responses when the current-book filter changes quickly, shows loading/empty/error messages, and no longer silently disables image reuse.

### 1.0.702 - Softer AI route fallback states

- Admin AI route fallback no longer marks image/audio as errors when an older single-model test response does not include detailed route results.
- The old successful single-model response is mapped to the text route, while image/audio rows appear as neutral `NOT REPORTED` rows with their selected models.

### 1.0.701 - AI provider route report fallback

- Admin AI provider test results now always display the expected text/image/audio route rows for KIE, even if the deployed edge function returns only the older single-model response.
- The test card now shows a compact route model summary and per-route status/sample text so image and audio models are visible separately from the main text model.

### 1.0.700 - Scoped AI history and KIE route tests

- AI saved output loading now remains explicitly user-scoped and can be filtered to the current book from the Editor V2 AI panel.
- Editor AI history image thumbnails are larger, making generated image reuse easier to inspect before insertion.
- AI saved output RLS is reinforced with an idempotent migration so only the owning user can select their saved AI outputs.
- Admin AI provider testing now reports text, image, and KIE audio routes separately, using the selected text/image/audio models.
- KIE Qwen text-to-image requests remain aligned with the documented `createTask` payload using `model: qwen/text-to-image` and `input.image_size`.

### 1.0.699 - AI output history and interactive image approvals

- AI gateway outputs are now surfaced as reusable saved outputs in the Editor V2 AI panel, with text/image type, creation time, action, and source labels.
- User profiles now list saved AI outputs across books so generated text and images remain available for later reuse and review.
- Interactive image generation now opens an explicit cost approval step before sending the request, keeps the exact clicked placeholder in a loading/disabled state, and inserts the returned image into that same placeholder.
- Interactive generated-image usage now avoids duplicate client-side credit animation when the gateway reports an already charged/polled result.

### 1.0.698 - Interactive item ordering and image captions

- Interactive V3 editor items now include up/down controls beside delete so users can reorder item-based interactive content while keeping each item's full data together.
- Book-image selection for interactive media now carries the source image caption into the matching interactive item description field when that field is empty.
- Gallery images receive the source caption as their caption, while tabs/accordion/timeline/storytelling receive it as description, flashcards as back text, authors as bio, and hotspot images as caption/text where applicable.

### 1.0.697 - Reusable author blocks

- Author interactive editor placeholders now support adding multiple author names from a line-by-line list.
- Saved author data from previous author interactive blocks is shown inside new author placeholders so users can reuse selected authors without recreating their image, role, and bio.
- The earlier author text lookup action was removed in favor of explicit author reuse from saved interactive author data.

### 1.0.696 - Author intro exit and text lookup

- Interactive V3 author intro popovers now keep a short exiting state so their close animation mirrors the opening animation instead of disappearing instantly.
- Author items in the editor now include a direct action to find a matching author name in the editable book text, scroll to it, and select the matched text.

### 1.0.695 - Tabs require item titles

- Interactive V3 tabs are now the exception to the empty-title rule: every tab item gets a title fallback such as `تب 1`.
- New tab blocks start with titled tab items, old empty tab titles render with a fallback, and editor saves fill cleared tab titles back in.

### 1.0.694 - Interactive tabs inherited direction and frosted track

- Interactive V3 tabs now inherit the book/page direction for tab ordering instead of deriving layout direction from tab text.
- Tab media/text layout now follows the inherited book direction, while mobile stays single-column.
- The iOS-style segmented track now uses the site's frosted menu glass surface instead of a flat gray background.

### 1.0.693 - Interactive tabs iOS segmented style

- Interactive V3 tabs now use an iOS-style segmented control with a soft gray rounded track.
- The active tab is a white rounded pill with a subtle iOS-like shadow, while inactive labels remain muted.
- Mobile keeps the same segmented style with horizontal scrolling when tab labels do not fit.

### 1.0.692 - Interactive tabs blue bar reference design

- Interactive V3 tabs now follow the blue top-bar reference style with simple tab labels and a white rounded active marker at the bottom of the active tab.
- The content panel uses a faint blue themed background connected to the tab bar, while mobile keeps the same design with horizontal scrolling when needed.

### 1.0.691 - Interactive tabs height and active contrast polish

- Interactive V3 tab buttons are shorter on desktop and mobile so they read more like tabs than tall cards.
- Active and inactive tab states are now more distinct: inactive tabs are flatter and muted, while the active tab uses a stronger shared accent.

### 1.0.690 - Interactive tabs visual redesign

- Interactive V3 tabs now use square-like tab buttons with rounded top corners and flat bottoms connected to the content panel.
- The active tab and tab content panel share a faint accent theme that changes with the active tab.
- Tab labels are larger than normal body text, and mobile tabs keep the same shape with horizontal scrolling when needed.

### 1.0.689 - Storytelling simultaneous crossfade

- Storytelling stage changes now render outgoing and incoming panels at the same time for a true crossfade.
- The old sequential fade-out then fade-in blank gap was removed to avoid the visible flash/jump between images.

### 1.0.688 - Storytelling mobile tabs and fade transition

- Storytelling mobile step tabs now render as fixed-width horizontal cards with overflow scrolling, so small screens do not squeeze titles into broken narrow columns.
- Storytelling step changes now use a controlled fade-out/fade-in sequence instead of remounting the image panel with a flash-like jump.
- The storytelling navigation and empty-title behavior from 1.0.687 remain unchanged.

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
