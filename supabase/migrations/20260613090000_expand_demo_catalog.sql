create or replace function public.build_demo_pages(book_title text, page_count int)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  result jsonb := '[]';
  blocks jsonb;
  interaction jsonb;
  body text;
  n int;
begin
  for n in 1..page_count loop
    body := case when n % 5 = 0
      then repeat('این صفحه برای مطالعه عمیق طراحی شده است. مفهوم اصلی با مثال، تحلیل و کاربرد بررسی می‌شود تا خواننده ارتباط میان ایده‌ها و نتیجه‌گیری را دنبال کند. پرسش‌های متن نیز به ارزیابی یادگیری کمک می‌کنند. ', 15)
      else 'در این بخش مفهوم اصلی به زبان روشن معرفی می‌شود و مثال‌های کاربردی ارتباط موضوع با تجربه‌های واقعی را نشان می‌دهند.'
    end;

    interaction := case n % 4
      when 0 then jsonb_build_object('type','quiz') || jsonb_build_object('question','مهم‌ترین پیام این بخش چیست؟') ||
        jsonb_build_object('options',to_jsonb(array['درک ارتباط مفاهیم','حفظ بدون تحلیل','نادیده گرفتن مثال‌ها','عبور سریع']::text[])) || jsonb_build_object('correct',0)
      when 1 then jsonb_build_object('type','timeline') || jsonb_build_object('events',jsonb_build_array(
        jsonb_build_object('year','مرحله ۱') || jsonb_build_object('title','مشاهده') || jsonb_build_object('description','موضوع را شناسایی کنید.'),
        jsonb_build_object('year','مرحله ۲') || jsonb_build_object('title','تحلیل') || jsonb_build_object('description','ارتباط اجزا را بررسی کنید.')
      ))
      when 2 then jsonb_build_object('type','mindmap') || jsonb_build_object('central',book_title) ||
        jsonb_build_object('nodes',to_jsonb(array['ایده اصلی','مثال کاربردی','ارتباط با فصل قبل','پرسش برای ادامه']::text[]))
      else jsonb_build_object('type','table') || jsonb_build_object('headers',to_jsonb(array['مفهوم','کاربرد','نتیجه']::text[])) ||
        jsonb_build_object('rows',jsonb_build_array(to_jsonb(array['مشاهده','اطلاعات','شناخت']::text[]),to_jsonb(array['تحلیل','مقایسه','تصمیم']::text[])))
    end;

    blocks := jsonb_build_array(
      jsonb_build_object('type','heading') || jsonb_build_object('level',2) || jsonb_build_object('content',book_title || ' - بخش ' || n),
      jsonb_build_object('type','paragraph') || jsonb_build_object('content',body),
      interaction
    );
    result := result || jsonb_build_array(jsonb_build_object('title','فصل ' || n) || jsonb_build_object('blocks',blocks));
  end loop;
  return result;
end $$;

update public.books set
  pages = public.build_demo_pages(title, case when id in (
    '10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004'
  ) then 20 else 8 end),
  preview_pages = array[0,1,2], content_version = content_version + 1, content_updated_at = now();

with publisher as (select id from public.publisher_profiles where slug = 'danesh-no' limit 1)
insert into public.books(title,subtitle,description,cover_url,pages,preview_pages,price,status,review_status,publisher_id,language,tags,metadata)
select 'کتاب تعاملی ' || lpad(n::text,2,'0'), 'مجموعه یادگیری تعاملی',
  'کتابی چندفصلی با متن بلند و ابزارهای تعاملی.',
  'https://picsum.photos/seed/metabooki_' || n || '/400/560',
  public.build_demo_pages('کتاب تعاملی ' || lpad(n::text,2,'0'), case when n <= 4 then 20 else 8 end),
  array[0,1,2], case when n % 7 = 0 then 0 else 100 end, 'published','approved',publisher.id,'fa',
  array['تعاملی'], jsonb_build_object('category','علمی','publisher_name','انتشارات دانش نو')
from generate_series(1,50) n cross join publisher;

drop function public.build_demo_pages(text,int);
