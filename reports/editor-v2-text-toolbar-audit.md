# گزارش کنترل دکمه‌های نوار ابزار متن ادیتور V2

تاریخ بررسی: 2026-06-24

مبنای بررسی:
- اعمال روی متن: مسیر `execTextCommand` / `formatCurrentBlock` / `setCurrentBlockDirection`
- ذخیره: تبدیل DOM به `BookDocumentV2` در `documentFromEditorDomV2`
- نمایش کتابخوان: خواندن `metadata.editor_v2_document` و نمایش با `BookRendererV2`
- تست فنی: `npm.cmd run build`

## تغییرات اصلاحی این مرحله

- چرخه قرمز دکمه ذخیره متوقف شد؛ خطای sync ریموت دیگر autosave را وارد loop نمی‌کند.
- ذخیره محلی ادیتور مسیر اصلی شد و sync ریموت best-effort است.
- autosave در حالت `error` خودکار تکرار نمی‌شود و فقط با اقدام کاربر دوباره تلاش می‌کند.
- خواندن alignment از DOM مقاوم‌تر شد؛ اگر مرورگر `text-align` را روی child بگذارد، هنگام ذخیره از دست نمی‌رود.
- style قبلی بلاک هنگام ذخیره حفظ می‌شود و فقط مقدارهای جدید روی آن merge می‌شوند.

## جدول وضعیت ابزارهای متن

| ابزار | اعمال روی متن | ذخیره در سند | نمایش در کتابخوان | توضیح |
|---|---|---|---|---|
| Undo | نیازمند تست تعاملی مرورگر | وابسته به DOM پس از undo | وابسته به ذخیره بعد از undo | `execCommand('undo')` استفاده می‌شود؛ history مرورگر باید در محیط واقعی تست شود. |
| Redo | نیازمند تست تعاملی مرورگر | وابسته به DOM پس از redo | وابسته به ذخیره بعد از redo | مشابه Undo و وابسته به history مرورگر. |
| متن عادی P | پاس کدی | پاس کدی | پاس کدی | `formatBlock('p')` و تبدیل به paragraph. |
| H1-H6 | پاس کدی | پاس کدی | پاس کدی | با تغییر heading، فهرست از headingهای سند بازسازی می‌شود. |
| Font name | پاس کدی | پاس کدی | پاس کدی | خروجی `<font face>` یا style به inline style تبدیل و ذخیره می‌شود. |
| Font size | پاس کدی | پاس کدی | پاس کدی | map اندازه‌های `execCommand('fontSize')` به font-size ذخیره می‌شود. |
| Text color | پاس کدی | پاس کدی | پاس کدی | `foreColor` به inline style تبدیل می‌شود. |
| Bold | پاس کدی | پاس کدی | پاس کدی | `<b>/<strong>` و font-weight تشخیص داده می‌شود. |
| Italic | پاس کدی | پاس کدی | پاس کدی | `<i>/<em>` و font-style تشخیص داده می‌شود. |
| Underline | پاس کدی | پاس کدی | پاس کدی | `<u>` و text-decoration تشخیص داده می‌شود. |
| Strike | پاس کدی | پاس کدی | پاس کدی | `<s>/<strike>` و line-through تشخیص داده می‌شود. |
| Superscript | پاس کدی | پاس کدی | پاس کدی | `<sup>` و vertical-align super تشخیص داده می‌شود. |
| Subscript | پاس کدی | پاس کدی | پاس کدی | `<sub>` و vertical-align sub تشخیص داده می‌شود. |
| Link | پاس کدی | پاس کدی | پاس کدی | `href` در inline ذخیره و با `InlineTextV2` نمایش داده می‌شود. |
| Remove format | پاس کدی | پاس کدی | پاس کدی | فرمت DOM پاک می‌شود و parser inlineهای باقی‌مانده را ذخیره می‌کند. |
| Bullet list | پاس کدی | پاس کدی | پاس کدی | `<ul><li>` به block نوع `list` با `ordered=false` تبدیل می‌شود. |
| Numbered list | پاس کدی | پاس کدی | پاس کدی | `<ol><li>` به block نوع `list` با `ordered=true` تبدیل می‌شود. |
| Align right | پاس کدی | پاس کدی | پاس کدی | `text-align:right` حتی اگر روی child باشد ذخیره می‌شود. |
| Align center | پاس کدی | پاس کدی | پاس کدی | `text-align:center` ذخیره و در `BookRendererV2` اعمال می‌شود. |
| Align left | پاس کدی | پاس کدی | پاس کدی | `text-align:left` ذخیره و نمایش داده می‌شود. |
| Justify | پاس کدی | پاس کدی | پاس کدی | `text-align:justify` ذخیره و نمایش داده می‌شود. |
| Direction RTL | پاس کدی | پاس کدی | پاس کدی | `dir="rtl"` روی بلاک ذخیره می‌شود. |
| Direction LTR | پاس کدی | پاس کدی | پاس کدی | `dir="ltr"` روی بلاک ذخیره می‌شود. |
| Table ساده | پاس کدی | پاس کدی | پاس کدی | جدول از DOM به block نوع `table` تبدیل می‌شود. |

## محدودیت تست

این بررسی با build و مسیر کد انجام شد. تست تعاملی واقعی مرورگر برای Undo/Redo هنوز لازم است، چون رفتار آن‌ها به history داخلی contenteditable در مرورگر وابسته است.
