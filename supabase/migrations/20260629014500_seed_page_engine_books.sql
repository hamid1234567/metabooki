do $$
declare
  admin_user_id uuid;
  admin_publisher_id uuid;
  edu_book_id uuid := '11111111-1111-4111-8111-111111111111';
  large_book_id uuid := '22222222-2222-4222-8222-222222222222';
begin
  select id into admin_user_id from auth.users where email = 'mohammadi219@gmail.com' limit 1;
  if admin_user_id is null then
    return;
  end if;

  insert into public.publisher_profiles(user_id, slug, bio, is_trusted)
  values (admin_user_id, 'metabooki-admin-studio', 'استودیوی محتوای متابوکی برای کتاب‌های نمونه و آموزشی سامانه.', true)
  on conflict (user_id) do update
    set slug = coalesce(public.publisher_profiles.slug, excluded.slug),
        bio = coalesce(public.publisher_profiles.bio, excluded.bio),
        is_trusted = true
  returning id into admin_publisher_id;

  insert into public.books(
    id, title, subtitle, description, cover_url, pages, preview_pages, price, status, review_status,
    publisher_id, language, tags, metadata, content_updated_at
  )
  values (
    edu_book_id,
    'راهنمای تصویری متابوکی',
    'آموزش قابلیت‌های کتابخوان، ادیتور و انتشار دیجیتال',
    'این کتاب آموزشی، مسیر کار با متابوکی را از ورود کتاب Word تا طراحی کال‌اوت، رسانه، ابزارهای تعاملی، کتابخوان و مدیریت انتشار نشان می‌دهد.',
    '/metabooki-logo.png',
    '[]'::jsonb,
    array[0,1,2],
    0,
    'draft',
    'pending',
    admin_publisher_id,
    'fa',
    array['آموزش سامانه','متابوکی','ادیتور','کتابخوان'],
    jsonb_build_object(
      'category','راهنما و آموزش',
      'author','تیم متابوکی',
      'publisher_name','متابوکی',
      'book_type', jsonb_build_array('تألیف','راهنمای سامانه'),
      'page_count', 18,
      'editor_v2_page_engine', true,
      'editor_v2_schema_version', '2.0-page',
      'opening_sample','این کتاب، قابلیت‌های اصلی متابوکی را با نمونه‌های واقعی از خود سامانه معرفی می‌کند.'
    ),
    now()
  )
  on conflict (id) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    cover_url = excluded.cover_url,
    publisher_id = excluded.publisher_id,
    metadata = excluded.metadata,
    content_updated_at = now(),
    updated_at = now();

  insert into public.books(
    id, title, subtitle, description, cover_url, pages, preview_pages, price, status, review_status,
    publisher_id, language, tags, metadata, content_updated_at
  )
  values (
    large_book_id,
    'هموگلوبینوپاتی و دانش‌های پیوسته',
    'کتاب بزرگ ۲۵۰۰ صفحه‌ای برای آزمون موتور صفحه‌ای متابوکی',
    'کتاب بزرگ آزمایشی بر پایه مباحث هموگلوبینوپاتی، ژنتیک، ریاضیات، هنر، برنامه‌نویسی و علوم میان‌رشته‌ای برای سنجش لود صفحه‌ای، جستجو، رسانه و ذخیره تفاضلی.',
    'https://picsum.photos/seed/metabooki-hemoglobinopathy-large-cover/900/1200',
    '[]'::jsonb,
    array[0,1,2],
    0,
    'draft',
    'pending',
    admin_publisher_id,
    'fa',
    array['هماتولوژی','ژنتیک','ریاضیات','هنر','برنامه‌نویسی','کتاب بزرگ'],
    jsonb_build_object(
      'category','علوم پزشکی و میان‌رشته‌ای',
      'author','تیم محتوای متابوکی',
      'publisher_name','متابوکی',
      'book_type', jsonb_build_array('تألیف','گردآوری آموزشی'),
      'page_count', 2500,
      'editor_v2_page_engine', true,
      'editor_v2_schema_version', '2.0-page',
      'opening_sample','این کتاب برای سنجش کتاب‌های بسیار بزرگ طراحی شده و هر بخش آن موضوع، تصویر، فرمول یا نمونه تعاملی متفاوت دارد.'
    ),
    now()
  )
  on conflict (id) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    cover_url = excluded.cover_url,
    publisher_id = excluded.publisher_id,
    metadata = excluded.metadata,
    content_updated_at = now(),
    updated_at = now();
end $$;

delete from public.book_pages where book_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
delete from public.book_assets where book_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
delete from public.book_search_index where book_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');

with edu_pages(page_index, title, blocks, plain_text, asset_ids) as (
  values
  (0, 'شروع سریع متابوکی', jsonb_build_array(
    jsonb_build_object('id','edu-h1-1','type','heading','level',1,'text','شروع سریع متابوکی','anchor','edu-start'),
    jsonb_build_object('id','edu-p-1','type','paragraph','text','متابوکی یک مسیر کامل برای تبدیل Word، ویرایش وب، افزودن رسانه و انتشار کتاب دیجیتال فراهم می‌کند.'),
    jsonb_build_object('id','edu-img-logo','type','image','url','/metabooki-logo.png','caption','لوگوی رسمی متابوکی و هویت بصری سامانه','imageId','edu-logo','widthPercent',42),
    jsonb_build_object('id','edu-callout-1','type','callout','variant','key','title','نکته کلیدی','icon','💡','blocks',jsonb_build_array(jsonb_build_object('id','edu-callout-p-1','type','paragraph','text','هر کتاب در متابوکی می‌تواند متن، تصویر، کال‌اوت، فهرست، پاورقی و محتوای تعاملی را یکپارچه نگه دارد.')))
  ), 'متابوکی یک مسیر کامل برای تبدیل Word، ویرایش وب، افزودن رسانه و انتشار کتاب دیجیتال فراهم می‌کند.', array['edu-logo']),
  (1, 'ورود کتاب Word', jsonb_build_array(
    jsonb_build_object('id','edu-h1-2','type','heading','level',1,'text','ورود کتاب Word','anchor','edu-import'),
    jsonb_build_object('id','edu-p-2','type','paragraph','text','در صفحه ورود کتاب، تحلیل اولیه تا حد ممکن روی دستگاه کاربر انجام می‌شود و پیش‌نمایش پیش از آپلود نمایش داده می‌شود.'),
    jsonb_build_object('id','edu-callout-2','type','callout','variant','warning','title','اشتباه رایج','icon','⚠','blocks',jsonb_build_array(jsonb_build_object('id','edu-callout-p-2','type','paragraph','text','قبل از تأیید، فایل Word به سرور ارسال نمی‌شود؛ بنابراین ناشر می‌تواند فایل را اصلاح و دوباره محلی بررسی کند.')))
  ), 'در صفحه ورود کتاب، تحلیل اولیه تا حد ممکن روی دستگاه کاربر انجام می‌شود.', array[]::text[]),
  (2, 'ادیتور متن و فهرست', jsonb_build_array(
    jsonb_build_object('id','edu-h1-3','type','heading','level',1,'text','ادیتور متن و فهرست','anchor','edu-editor'),
    jsonb_build_object('id','edu-p-3','type','paragraph','text','ادیتور V2 متن را مثل سند پیوسته نمایش می‌دهد، اما از پشت صحنه صفحه‌های چاپی و فهرست را ساختاریافته نگه می‌دارد.'),
    jsonb_build_object('id','edu-list-3','type','list','ordered',false,'items',jsonb_build_array(
      jsonb_build_object('id','edu-li-1','text','هدینگ‌ها با فهرست کتاب هماهنگ می‌شوند.'),
      jsonb_build_object('id','edu-li-2','text','شماره صفحه چاپی در جداکننده صفحه حفظ می‌شود.'),
      jsonb_build_object('id','edu-li-3','text','ذخیره صفحه‌ای فقط صفحات تغییرکرده را می‌فرستد.')
    ))
  ), 'ادیتور V2 متن را مثل سند پیوسته نمایش می‌دهد.', array[]::text[]),
  (3, 'کال‌اوت‌ها', jsonb_build_array(
    jsonb_build_object('id','edu-h1-4','type','heading','level',1,'text','کال‌اوت‌ها','anchor','edu-callouts'),
    jsonb_build_object('id','edu-callout-4a','type','callout','variant','question','title','مکث و فکر کن','icon','؟','blocks',jsonb_build_array(jsonb_build_object('id','edu-callout-p-4a','type','paragraph','text','کدام بخش از متن شما برای درگیر کردن خواننده بهتر است به سؤال کوتاه تبدیل شود؟'))),
    jsonb_build_object('id','edu-callout-4b','type','callout','variant','data','title','داده و منبع','icon','📊','blocks',jsonb_build_array(jsonb_build_object('id','edu-callout-p-4b','type','paragraph','text','کال‌اوت داده برای اعداد، رفرنس‌ها و نکات آماری مناسب است.')))
  ), 'کال‌اوت‌ها به متن روح می‌دهند و خواننده را درگیر می‌کنند.', array[]::text[]),
  (4, 'رسانه و تصویر', jsonb_build_array(
    jsonb_build_object('id','edu-h1-5','type','heading','level',1,'text','رسانه و تصویر','anchor','edu-media'),
    jsonb_build_object('id','edu-p-5','type','paragraph','text','تصاویر از سه مسیر وارد می‌شوند: آپلود، انتخاب از تصاویر کتاب و تولید با هوش مصنوعی.'),
    jsonb_build_object('id','edu-img-icon','type','image','url','/icon-512.png','caption','آیکون اپلیکیشن متابوکی در اندازه بزرگ','imageId','edu-icon','widthPercent',30)
  ), 'تصاویر از سه مسیر وارد می‌شوند: آپلود، انتخاب از تصاویر کتاب و تولید با هوش مصنوعی.', array['edu-icon']),
  (5, 'ابزارهای تعاملی', jsonb_build_array(
    jsonb_build_object('id','edu-h1-6','type','heading','level',1,'text','ابزارهای تعاملی','anchor','edu-interactive'),
    jsonb_build_object('id','edu-interactive-timeline','type','interactive','kind','timeline','title','نمونه تایم‌لاین','payload',jsonb_build_object('title','مسیر انتشار کتاب','events',jsonb_build_array(
      jsonb_build_object('title','ورود Word','description','تحلیل محلی و پیش‌نمایش.','image','/icon-192.png'),
      jsonb_build_object('title','ادیت وب','description','ویرایش متن، فهرست، رسانه و کال‌اوت.','image','/metabooki-logo.png'),
      jsonb_build_object('title','انتشار','description','تأیید نهایی، قیمت‌گذاری و ورود به فروشگاه.','image','/icon-512.png')
    )))
  ), 'نمونه تایم‌لاین مسیر انتشار کتاب را نشان می‌دهد.', array[]::text[]),
  (6, 'کتابخوان', jsonb_build_array(
    jsonb_build_object('id','edu-h1-7','type','heading','level',1,'text','کتابخوان','anchor','edu-reader'),
    jsonb_build_object('id','edu-p-7','type','paragraph','text','کتابخوان صفحه چاپی، فهرست درختی، ابزار هایلایت، جستجو، دستیار هوشمند و بزرگنمایی تصویر را کنار هم نگه می‌دارد.')
  ), 'کتابخوان صفحه چاپی، فهرست درختی، ابزار هایلایت، جستجو و دستیار هوشمند دارد.', array[]::text[]),
  (7, 'هوش مصنوعی', jsonb_build_array(
    jsonb_build_object('id','edu-h1-8','type','heading','level',1,'text','هوش مصنوعی','anchor','edu-ai'),
    jsonb_build_object('id','edu-p-8','type','paragraph','text','دستیار هوشمند می‌تواند خلاصه، سؤال، پیشنهاد کال‌اوت، پیشنهاد تعاملی و تصویر آموزشی بسازد؛ هزینه قبل از اجرا به کاربر اعلام می‌شود.')
  ), 'دستیار هوشمند می‌تواند خلاصه، سؤال، کال‌اوت، تعاملی و تصویر آموزشی بسازد.', array[]::text[]),
  (8, 'ذخیره صفحه‌ای', jsonb_build_array(
    jsonb_build_object('id','edu-h1-9','type','heading','level',1,'text','ذخیره صفحه‌ای','anchor','edu-page-engine'),
    jsonb_build_object('id','edu-p-9','type','paragraph','text','در معماری جدید، صفحه‌ها جدا ذخیره می‌شوند و برای تغییر کوچک، کل کتاب دوباره به سرور ارسال نمی‌شود.'),
    jsonb_build_object('id','edu-callout-9','type','callout','variant','deep','title','عمیق‌تر بخوان','icon','🔍','blocks',jsonb_build_array(jsonb_build_object('id','edu-callout-p-9','type','paragraph','text','Manifest کتاب شامل فهرست، تعداد صفحه و خلاصه رسانه است؛ متن کامل در رکوردهای صفحه ذخیره می‌شود.')))
  ), 'در معماری جدید، صفحه‌ها جدا ذخیره می‌شوند و کل کتاب دوباره ارسال نمی‌شود.', array[]::text[])
),
edu_expanded as (
  select page_index, title, blocks, plain_text, asset_ids from edu_pages
  union all
  select n, 'تمرین عملی ' || (n - 8),
    jsonb_build_array(
      jsonb_build_object('id','edu-h-practice-'||n,'type','heading','level',2,'text','تمرین عملی ' || (n - 8),'anchor','edu-practice-'||n),
      jsonb_build_object('id','edu-p-practice-'||n,'type','paragraph','text','در این صفحه یک سناریوی کوتاه برای تمرین ویرایش، افزودن تصویر، ساخت کال‌اوت و تست پیش‌نمایش کتابخوان ارائه شده است.'),
      jsonb_build_object('id','edu-callout-practice-'||n,'type','callout','variant','practice','title','تمرین سریع','icon','✓','blocks',jsonb_build_array(jsonb_build_object('id','edu-callout-practice-p-'||n,'type','paragraph','text','یک پاراگراف انتخاب کنید و آن را به کال‌اوت مناسب تبدیل کنید.')))
    ),
    'در این صفحه یک سناریوی کوتاه برای تمرین ویرایش، افزودن تصویر، ساخت کال‌اوت و تست پیش‌نمایش کتابخوان ارائه شده است.',
    array[]::text[]
  from generate_series(9,17) n
)
insert into public.book_pages(book_id,page_index,page_id,print_number,title,blocks,plain_text,asset_ids,content_hash,updated_at)
select '11111111-1111-4111-8111-111111111111', page_index, 'edu-page-' || (page_index + 1), (page_index + 1)::text, title, blocks, plain_text, asset_ids, md5(blocks::text), now()
from edu_expanded
on conflict (book_id,page_index) do update set
  page_id=excluded.page_id, print_number=excluded.print_number, title=excluded.title, blocks=excluded.blocks,
  plain_text=excluded.plain_text, asset_ids=excluded.asset_ids, content_hash=excluded.content_hash, updated_at=now();

insert into public.book_assets(book_id,asset_id,page_index,block_id,url,caption,status,metadata,updated_at)
values
('11111111-1111-4111-8111-111111111111','edu-logo',0,'edu-img-logo','/metabooki-logo.png','لوگوی رسمی متابوکی و هویت بصری سامانه','ready','{}'::jsonb,now()),
('11111111-1111-4111-8111-111111111111','edu-icon',4,'edu-img-icon','/icon-512.png','آیکون اپلیکیشن متابوکی در اندازه بزرگ','ready','{}'::jsonb,now())
on conflict (book_id,asset_id) do update set page_index=excluded.page_index, block_id=excluded.block_id, url=excluded.url, caption=excluded.caption, status=excluded.status, updated_at=now();

with topics as (
  select * from (values
    (1, 1, 360, 'هموگلوبینوپاتی و ژنتیک خون', 'هماتولوژی', 'α2β2، HbF: α2γ2 و HbA2 نمونه‌هایی از فرمول‌های هموگلوبین هستند.'),
    (2, 361, 720, 'ریاضیات، مدل‌سازی و نمودارها', 'ریاضیات', 'مدل نمونه: y = ax^2 + bx + c و ماتریس تصمیم AᵀA.'),
    (3, 721, 1080, 'هنر، تصویر و روایت بصری', 'هنر', 'تحلیل ترکیب‌بندی، رنگ، ریتم و نور در تصویر آموزشی.'),
    (4, 1081, 1440, 'برنامه‌نویسی و تفکر الگوریتمی', 'برنامه‌نویسی', 'نمونه کد: if (risk > threshold) return review;'),
    (5, 1441, 1800, 'فیزیک، شیمی و سنجش', 'علوم پایه', 'انرژی، یونیزاسیون، pH، دوز و واحدهای Gy و mSv بررسی می‌شوند.'),
    (6, 1801, 2160, 'یادگیری، طراحی آموزشی و تعامل', 'آموزش', 'هدف این بخش تبدیل متن سنگین به مسیر یادگیری فعال است.'),
    (7, 2161, 2500, 'مطالعات موردی و جمع‌بندی میان‌رشته‌ای', 'مطالعه موردی', 'مطالعه موردی، داده، تصویر و تصمیم‌گیری مرحله‌ای کنار هم قرار می‌گیرند.')
  ) as t(chapter, start_page, end_page, chapter_title, domain, seed_text)
),
large_pages as (
  select
    n - 1 as page_index,
    t.chapter,
    t.chapter_title,
    t.domain,
    case when n = t.start_page then t.chapter_title else t.domain || ' - صفحه ' || n end as title,
    jsonb_build_array(
      case when n = t.start_page
        then jsonb_build_object('id','large-h1-'||t.chapter,'type','heading','level',1,'text',t.chapter_title,'anchor','large-chapter-'||t.chapter)
        else jsonb_build_object('id','large-h2-'||n,'type','heading','level',2,'text',t.domain || ' / مبحث ' || ((n - t.start_page) % 12 + 1),'anchor','large-page-'||n)
      end,
      jsonb_build_object('id','large-p-main-'||n,'type','paragraph','text',
        'این صفحه از فصل «' || t.chapter_title || '» برای آزمون موتور صفحه‌ای ساخته شده است. ' ||
        t.seed_text || ' نمونه صفحه ' || n || ' شامل توضیح مفهومی، عبارت علمی و مسیر آموزشی مستقل است.'
      ),
      jsonb_build_object('id','large-list-'||n,'type','list','ordered',true,'items',jsonb_build_array(
        jsonb_build_object('id','large-li-'||n||'-1','text','تعریف مسئله در زمینه ' || t.domain),
        jsonb_build_object('id','large-li-'||n||'-2','text','مشاهده داده، فرمول یا تصویر مرتبط'),
        jsonb_build_object('id','large-li-'||n||'-3','text','جمع‌بندی یادگیری و کاربرد عملی')
      )),
      case when n % 5 = 0 then
        jsonb_build_object('id','large-img-'||n,'type','image','url','https://picsum.photos/seed/metabooki-large-'||n||'/1000/620','caption','شکل '||n||': تصویر آموزشی مرتبط با '||t.domain,'imageId','large-img-'||n,'widthPercent',72)
      else
        jsonb_build_object('id','large-callout-'||n,'type','callout','variant',case when n % 4 = 0 then 'data' when n % 4 = 1 then 'key' when n % 4 = 2 then 'question' else 'deep' end,'title',case when n % 4 = 0 then 'داده و منبع' when n % 4 = 1 then 'نکته کلیدی' when n % 4 = 2 then 'مکث و فکر کن' else 'عمیق‌تر بخوان' end,'icon',case when n % 4 = 0 then '📊' when n % 4 = 1 then '💡' when n % 4 = 2 then '؟' else '🔍' end,'blocks',jsonb_build_array(jsonb_build_object('id','large-callout-p-'||n,'type','paragraph','text','این نکته برای برجسته‌سازی مفهوم صفحه '||n||' در حوزه '||t.domain||' استفاده می‌شود.')))
      end,
      case when n % 37 = 0 then
        jsonb_build_object('id','large-interactive-'||n,'type','interactive','kind','timeline','title','مسیر یادگیری '||t.domain,'payload',jsonb_build_object('title','مسیر یادگیری '||t.domain,'events',jsonb_build_array(
          jsonb_build_object('title','مشاهده','description','خواننده ابتدا تصویر یا مسئله را مشاهده می‌کند.','image','https://picsum.photos/seed/metabooki-large-step-a-'||n||'/720/420'),
          jsonb_build_object('title','تحلیل','description','داده یا فرمول با متن صفحه مقایسه می‌شود.','image','https://picsum.photos/seed/metabooki-large-step-b-'||n||'/720/420'),
          jsonb_build_object('title','کاربرد','description','نتیجه در تصمیم یا تمرین بعدی استفاده می‌شود.','image','https://picsum.photos/seed/metabooki-large-step-c-'||n||'/720/420')
        )))
      else jsonb_build_object('id','large-p-extra-'||n,'type','paragraph','text','یادداشت تکمیلی: ارتباط این صفحه با فهرست کتاب از طریق شماره صفحه چاپی و هدینگ همان صفحه حفظ می‌شود.')
      end
    ) as blocks,
    (
      t.chapter_title || ' ' || t.domain || ' ' || t.seed_text || ' صفحه ' || n || ' تعریف مسئله، مشاهده داده، جمع‌بندی یادگیری و کاربرد عملی.'
    ) as plain_text,
    case when n % 5 = 0 then array['large-img-'||n] else array[]::text[] end as asset_ids
  from generate_series(1,2500) n
  join topics t on n between t.start_page and t.end_page
)
insert into public.book_pages(book_id,page_index,page_id,print_number,title,blocks,plain_text,asset_ids,content_hash,updated_at)
select '22222222-2222-4222-8222-222222222222', page_index, 'large-page-' || (page_index + 1), (page_index + 1)::text, title, blocks, plain_text, asset_ids, md5(blocks::text), now()
from large_pages
on conflict (book_id,page_index) do update set
  page_id=excluded.page_id, print_number=excluded.print_number, title=excluded.title, blocks=excluded.blocks,
  plain_text=excluded.plain_text, asset_ids=excluded.asset_ids, content_hash=excluded.content_hash, updated_at=now();

insert into public.book_assets(book_id, asset_id, page_index, block_id, url, caption, status, metadata, updated_at)
select
  '22222222-2222-4222-8222-222222222222',
  'large-img-'||n,
  n - 1,
  'large-img-'||n,
  'https://picsum.photos/seed/metabooki-large-'||n||'/1000/620',
  'شکل '||n||': تصویر آموزشی مرتبط با کتاب بزرگ متابوکی',
  'ready',
  jsonb_build_object('autoSeed', true),
  now()
from generate_series(5,2500,5) n
on conflict (book_id,asset_id) do update set page_index=excluded.page_index, block_id=excluded.block_id, url=excluded.url, caption=excluded.caption, status=excluded.status, metadata=excluded.metadata, updated_at=now();

insert into public.book_search_index(book_id,page_index,plain_text,headings,updated_at)
select book_id,page_index,plain_text,title,now()
from public.book_pages
where book_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')
on conflict (book_id,page_index) do update set plain_text=excluded.plain_text, headings=excluded.headings, updated_at=now();

with manifest_source as (
  select
    b.id as book_id,
    count(p.*)::int as page_count,
    jsonb_agg(
      jsonb_build_object(
        'id','toc-' || (p.blocks->0->>'id'),
        'title',p.blocks->0->>'text',
        'level',coalesce((p.blocks->0->>'level')::int, 1),
        'blockId',p.blocks->0->>'id',
        'anchor',p.blocks->0->>'anchor',
        'pageIndex',p.page_index,
        'printNumber',p.print_number
      )
      order by p.page_index
    ) filter (where p.blocks->0->>'type' = 'heading') as toc,
    coalesce((
      select jsonb_agg(jsonb_build_object('id',a.asset_id,'type','image','url',a.url,'caption',a.caption,'printNumber',a.metadata->>'printNumber','status',a.status,'issue',a.issue) order by a.page_index)
      from public.book_assets a
      where a.book_id = b.id
    ), '[]'::jsonb) as assets_summary
  from public.books b
  join public.book_pages p on p.book_id = b.id
  where b.id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')
  group by b.id
)
insert into public.book_content_manifests(book_id,schema_version,page_count,toc,assets_summary,search_ready,content_hash,updated_at)
select book_id, '2.0-page', page_count, coalesce(toc,'[]'::jsonb), assets_summary, true, md5(coalesce(toc,'[]'::jsonb)::text || assets_summary::text), now()
from manifest_source
on conflict (book_id) do update set
  schema_version=excluded.schema_version,
  page_count=excluded.page_count,
  toc=excluded.toc,
  assets_summary=excluded.assets_summary,
  search_ready=true,
  content_hash=excluded.content_hash,
  updated_at=now();
