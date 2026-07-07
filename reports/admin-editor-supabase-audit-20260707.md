# گزارش ایرادهای ادمین، ادیتور و اتصال Supabase

تاریخ بررسی: 2026-07-07

## خلاصه

مشکل اصلی دیده شده این است که ادیتور هنگام ذخیره، اول روی موتور صفحه‌ای جدید ذخیره می‌کند:

- `book_content_manifests`
- `book_pages`
- `book_search_index`
- `book_assets`

اگر این مرحله خطا بدهد، نسخه قبلی کد خطا را پنهان می‌کرد و فقط تلاش می‌کرد روی جدول `books` ذخیره کند. بنابراین علت واقعی مثل RLS، migrate نشدن جدول‌ها، مالک نبودن ناشر، منتشر/خریداری شدن کتاب، یا مشکل شبکه در UI مشخص نمی‌شد.

## ایراد 1: خطای اصلی ذخیره ادیتور پنهان می‌شد

محل: `src/features/editor-v2/EditorV2Page.tsx`

نشانه:
- کاربر می‌بیند ذخیره انجام نمی‌شود یا پیام کلی Supabase می‌گیرد.
- ولی علت اصلی مشخص نیست.

پاسخ هوش مصنوعی:
احتمال زیاد مشکل از یکی از عملیات‌های `upsert` روی جدول‌های page-engine یا `update` روی جدول `books` است. قبلا خطای page-engine در `catch {}` حذف می‌شد؛ بنابراین حتی اگر Supabase جواب دقیق می‌داد، کاربر آن را نمی‌دید.

اقدام انجام‌شده:
- خطای Supabase حالا با `code`, `message`, `details`, `hint`, `status` و `statusText` نمایش داده می‌شود.
- اگر ذخیره page-engine خطا بدهد ولی ذخیره fallback روی `books` موفق شود، پیام هشدار نمایش داده می‌شود.
- اگر کل ذخیره شکست بخورد، خطای اصلی و خطای page-engine هر دو در toast نمایش داده می‌شوند.

چیزهایی که باید چک شود:
- آیا migration `20260629012000_page_based_content_engine.sql` روی پروژه Supabase اجرا شده؟
- آیا جدول‌های `book_content_manifests`, `book_pages`, `book_assets`, `book_search_index` وجود دارند؟
- آیا کاربر واردشده واقعا مالک `publisher_profiles.user_id` کتاب است؟
- آیا کتاب منتشر شده و خریداری شده است؟ تابع `can_write_book_content` برای کتاب‌های published که خرید دارند اجازه ویرایش نمی‌دهد.
- آیا policyهای RLS روی جدول‌های page-engine فعال و درست هستند؟

## ایراد 2: ادمین نمی‌تواند همه کتاب‌ها را از کلاینت ویرایش کند

محل migration: `supabase/migrations/20260626173500_restrict_publisher_asset_writes.sql`

نشانه:
- ادمین ممکن است در داشبورد داده‌ها را ببیند، اما ویرایش مستقیم کتاب ناشر دیگر از کلاینت مجاز نیست.

پاسخ هوش مصنوعی:
این رفتار از روی migration عمدی است. policy جدید روی `books` فقط ناشر مالک را مجاز کرده و دسترسی admin برای ویرایش مستقیم کتاب از کلاینت حذف شده است. اگر انتظار داری ادمین همه کتاب‌ها را تغییر دهد، باید یا policy تغییر کند یا عملیات مدیریتی از Edge Function با service role انجام شود.

چیزهایی که باید چک شود:
- آیا هدف محصول این است که ادمین بتواند محتوای کتاب ناشران را از کلاینت تغییر دهد؟
- اگر بله، امن‌تر است این کار از Edge Function انجام شود، نه مستقیم با anon key در مرورگر.
- اگر نه، پیام UI باید واضح بگوید «فقط ناشر مالک می‌تواند ذخیره کند».

## ایراد 3: ذخیره تنظیمات فیلتر ادمین فقط برای admin واقعی مجاز است

محل:
- `src/lib/filter-settings.ts`
- `supabase/migrations/20260618100000_book_filter_settings.sql`

نشانه:
- تنظیمات فیلتر در localStorage ذخیره می‌شود، اما ذخیره سروری ممکن است خطای RLS بدهد.

پاسخ هوش مصنوعی:
جدول `book_filter_settings` فقط برای کاربری قابل مدیریت است که `public.is_admin(auth.uid())` برایش true باشد. اگر کاربر در UI ادمین دیده می‌شود ولی role واقعی در جدول `user_roles` ندارد، ذخیره remote رد می‌شود.

چیزهایی که باید چک شود:
- رکورد نقش کاربر در `user_roles` وجود دارد؟
- مقدار نقش `admin` یا `super_admin` است؟
- کاربر mock نیست و واقعا session Supabase دارد؟

## ایراد 4: Edge Function های ادمین و AI به secret/server setup وابسته‌اند

محل:
- `src/lib/admin-users.ts`
- `src/lib/ai-gateway.ts`
- `supabase/functions/admin-users/index.ts`
- `supabase/functions/ai-gateway/index.ts`

نشانه:
- لیست کاربران، تغییر رمز، ذخیره تنظیمات AI یا تست provider خطا می‌دهد.

پاسخ هوش مصنوعی:
این بخش‌ها از Edge Function استفاده می‌کنند. اگر function deploy نشده باشد، یا secretهای لازم مثل `SUPABASE_SERVICE_ROLE_KEY` / کلیدهای provider تنظیم نشده باشند، UI ادمین خطا می‌دهد حتی اگر اتصال عادی به جدول `books` کار کند.

چیزهایی که باید چک شود:
- آیا `admin-users` و `ai-gateway` deploy شده‌اند؟
- آیا secrets در Supabase تنظیم شده‌اند؟
- آیا کاربر درخواست‌دهنده در جدول `user_roles` نقش `admin` یا `super_admin` دارد؟
- در logs مربوط به Edge Function چه خطایی ثبت شده؟

## ایراد 5: متن‌های فارسی بعضی فایل‌ها خراب نمایش داده می‌شوند

محل نمونه:
- `src/pages/Admin.tsx`
- `src/lib/ai-gateway.ts`
- `src/lib/filter-settings.ts`

نشانه:
- متن‌هایی مثل `ØªÙ†Ø¸ÛŒÙ…Ø§Øª` به‌جای فارسی دیده می‌شوند.

پاسخ هوش مصنوعی:
این mojibake است و معمولا از ذخیره/خواندن فایل UTF-8 با encoding اشتباه می‌آید. این مورد لزوما اتصال Supabase را خراب نمی‌کند، اما پیام‌های خطا و UI ادمین را گیج‌کننده می‌کند.

چیزهایی که باید چک شود:
- فایل‌ها در editor با UTF-8 ذخیره شده‌اند؟
- آیا قبلا خروجی ترمینال یا ابزار دیگری متن فارسی را با encoding اشتباه داخل فایل نوشته؟
- بهتر است متن‌های فارسی خراب به‌صورت مرحله‌ای ترمیم شوند تا رفتار کد ناخواسته تغییر نکند.

## چک‌لیست سریع Supabase برای ذخیره ادیتور

1. در Supabase SQL Editor اجرا شود:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('books','publisher_profiles','book_content_manifests','book_pages','book_assets','book_search_index');
```

2. مالکیت کتاب چک شود:

```sql
select b.id, b.title, b.status, b.review_status, b.publisher_id, p.user_id as publisher_user_id
from public.books b
join public.publisher_profiles p on p.id = b.publisher_id
where b.id = '<BOOK_ID>';
```

3. نقش کاربر چک شود:

```sql
select user_id, role
from public.user_roles
where user_id = '<USER_ID>';
```

4. اگر خطای ذخیره با `new row violates row-level security policy` آمد:

پاسخ هوش مصنوعی:
تقریبا قطعی است که کاربر فعلی مالک ناشر کتاب نیست، یا کتاب در وضعیتی است که `can_write_book_content` اجازه ویرایش نمی‌دهد، یا migration/policyهای page-engine کامل اجرا نشده‌اند.

5. اگر خطا `relation does not exist` بود:

پاسخ هوش مصنوعی:
migration مربوط به page-engine روی Supabase اجرا نشده یا پروژه اشتباه در `.env` وصل شده است.

6. اگر خطا `Failed to fetch`, `timeout` یا network بود:

پاسخ هوش مصنوعی:
مشکل از شبکه، DNS، فیلترینگ/محدودیت دسترسی به Supabase، یا CORS/Edge Function deployment است. در این حالت باید هم Network tab مرورگر و هم logs Supabase بررسی شود.

