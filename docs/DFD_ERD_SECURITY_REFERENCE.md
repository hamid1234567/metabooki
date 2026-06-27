# Metabooki DFD, ERD and Sensitive Code Map

تاریخ تهیه: 2026-06-27  
نسخه بررسی شده: `APP_VERSION = 1.0.497`  
سند وابسته: `docs/SYSTEM_ARCHITECTURE_REFERENCE.md`

این سند سه چیز را یک جا نگه می دارد:

1. DFD یا نمودار جریان داده برای فهم مسیر حرکت داده ها
2. ERD یا نقشه موجودیت ها و رابطه های دیتابیس Supabase
3. نقشه کدهای حساس، یعنی فایل هایی که امنیت، پول، مالکیت کتاب، کلیدهای AI یا داده کاربر را کنترل می کنند

نکته امنیتی: این سند هیچ secret، API key، service role key یا مقدار حساس واقعی را ثبت نمی کند. فقط محل و مسئولیت کدهای حساس را نشان می دهد.

## 1. مرزهای اعتماد سیستم

```mermaid
flowchart LR
  user[کاربر / ناشر / ادمین]
  browser[مرورگر کاربر<br/>React SPA]
  local[حافظه محلی مرورگر<br/>IndexedDB / localStorage / Cache]
  supabase[Supabase<br/>Auth + Postgres + Storage + Realtime]
  edge[Supabase Edge Functions<br/>ai-gateway / admin-users]
  ai[AI Providers<br/>OpenAI / Gemini / Custom]
  github[GitHub Pages<br/>Static Hosting]

  user --> browser
  browser <--> local
  browser <--> supabase
  browser --> edge
  edge <--> supabase
  edge --> ai
  github --> browser

  subgraph trusted_server[مرز قابل اعتماد سرور]
    supabase
    edge
  end

  subgraph untrusted_client[مرز غیرقابل اعتماد کاربر]
    browser
    local
  end
```

اصل طراحی:

- مرورگر کاربر قابل اعتماد کامل نیست.
- RLS و Edge Function باید مالکیت و دسترسی را enforce کنند.
- کلیدهای AI و service role فقط سمت سرور/Edge Function مجاز هستند.
- localStorage و IndexedDB فقط cache یا داده موقت هستند، نه منبع حقیقت عملیاتی.
- Supabase منبع حقیقت داده های عملیاتی است.

## 2. DFD سطح صفر

```mermaid
flowchart TB
  E1[کاربر عمومی]
  E2[کاربر وارد شده]
  E3[ناشر]
  E4[ادمین]
  P1((متابوکی SPA))
  P2((Supabase Backend))
  P3((AI Gateway Edge Function))
  P4((Admin Users Edge Function))
  D1[(Postgres Database)]
  D2[(Supabase Storage)]
  D3[(Realtime Channels)]
  X1[AI Provider خارجی]
  X2[GitHub Pages]

  X2 -->|HTML/CSS/JS| P1
  E1 -->|مشاهده فروشگاه و کتاب منتشر شده| P1
  E2 -->|خواندن، خرید، هایلایت، AI| P1
  E3 -->|آپلود Word، ویرایش، انتشار| P1
  E4 -->|مدیریت کاربران، فیلترها، AI، گزارش ها| P1

  P1 -->|Auth، Query، Mutation| P2
  P2 --> D1
  P2 --> D2
  P2 --> D3

  P1 -->|درخواست AI امن| P3
  P3 -->|خواندن تنظیمات و کسر اعتبار| D1
  P3 -->|درخواست مدل| X1

  P1 -->|عملیات ادمین کاربران| P4
  P4 -->|Admin API و service role| D1
```

## 3. DFD سطح یک: جریان های اصلی

```mermaid
flowchart TB
  user[کاربر]
  publisher[ناشر]
  admin[ادمین]

  subgraph app[React SPA]
    authUI[Auth UI]
    storeUI[Store / Landing / BookLanding]
    readerUI[Reader]
    uploadUI[Word Upload]
    editorUI[Editor V2]
    publisherUI[Publisher Center]
    adminUI[Admin Panel]
  end

  subgraph browserLocal[Local Browser Stores]
    importCache[(Import Temp Cache)]
    appCache[(App Cache / SW)]
  end

  subgraph supa[Supabase]
    auth[Auth]
    db[(Postgres)]
    storage[(Storage)]
    realtime[(Realtime)]
  end

  subgraph edge[Edge Functions]
    aiGateway[ai-gateway]
    adminUsers[admin-users]
  end

  aiProvider[AI Provider]

  user --> authUI --> auth
  user --> storeUI --> db
  user --> readerUI --> db
  readerUI <--> realtime

  publisher --> uploadUI
  uploadUI <--> importCache
  uploadUI --> storage
  uploadUI --> db
  publisher --> editorUI --> db
  editorUI <--> realtime
  publisher --> publisherUI --> db

  admin --> adminUI --> db
  adminUI --> adminUsers --> auth
  adminUI --> aiGateway --> db

  readerUI --> aiGateway
  editorUI --> aiGateway
  aiGateway --> aiProvider
  aiGateway --> db

  appCache --> storeUI
```

## 4. DFD سطح دو: تبدیل Word

```mermaid
flowchart LR
  publisher[ناشر]
  uploadPage[Upload Page<br/>src/pages/Upload.tsx]
  worker[DOCX Worker<br/>src/workers/docx-import.worker.ts]
  localStore[Local Import Store<br/>src/lib/local-import-store.ts]
  preview[Local Preview]
  uploadLib[confirmAndUploadImport<br/>src/lib/import-upload.ts]
  storage[(Storage bucket: book-imports)]
  importProjects[(book_import_projects)]
  importJobs[(book_import_jobs)]
  books[(books)]
  editor[Editor V2]

  publisher -->|انتخاب فایل Word| uploadPage
  uploadPage -->|File object| worker
  worker -->|analysis, styles, toc, images, issues| uploadPage
  uploadPage <--> localStore
  uploadPage --> preview
  publisher -->|تایید و تکمیل مشخصات| uploadPage
  uploadPage --> uploadLib
  uploadLib -->|فایل اصلی، تصاویر، manifest| storage
  uploadLib -->|project row| importProjects
  uploadLib -->|book draft + metadata.editor_v2_document| books
  importProjects -->|status queued| importJobs
  books --> editor
```

داده های حساس در این جریان:

- فایل Word اصلی
- تصاویر کتاب
- metadata کتاب
- گزارش مشکلات import
- شناسه ناشر و مالک

کنترل امنیتی:

- تا قبل از تایید ناشر، فایل نباید به سرور ارسال شود.
- Storage bucket `book-imports` خصوصی است.
- path فایل ها باید با `auth.uid()` شروع شود.
- هر import باید `id` مستقل داشته باشد و checksum نباید شناسه یکتای کتاب باشد.

## 5. DFD سطح دو: ادیتور، ذخیره و کتابخوان

```mermaid
flowchart TB
  editor[Editor V2<br/>EditorV2Page.tsx]
  dom[Editable DOM]
  parser[DOM to BookDocumentV2]
  renderer[BookRendererV2]
  books[(books)]
  realtime[(Supabase Realtime)]
  broadcast[BroadcastChannel / Storage Event]
  reader[Reader.tsx]

  books -->|metadata.editor_v2_document| editor
  editor --> dom
  dom --> parser
  parser -->|save document V2| books
  books --> realtime
  editor --> broadcast
  realtime --> reader
  broadcast --> reader
  books -->|getBook reload| reader
  reader --> renderer
```

قانون مهم:

- ادیتور و کتابخوان باید از مدل محتوای مشترک استفاده کنند.
- اگر تغییری در نمایش متن، پاورقی، کپشن، رفرنس، callout یا interactive لازم است، اول `book-content.ts` و `components/book-content-v2` بررسی شود.
- autosave نباید DOM فعال کاربر را وسط تایپ reset کند.

## 6. DFD سطح دو: هوش مصنوعی و هزینه

```mermaid
flowchart LR
  user[کاربر]
  editorOrReader[Reader / Editor]
  clientGateway[src/lib/ai-gateway.ts]
  edgeGateway[supabase/functions/ai-gateway]
  settings[(ai_gateway_settings)]
  providers[(ai_provider_settings)]
  credits[(credit_transactions)]
  logs[(ai_usage_logs)]
  profile[(profiles)]
  aiProvider[AI Provider]

  user -->|درخواست متن یا تصویر| editorOrReader
  editorOrReader -->|estimate_text / estimate_image| clientGateway
  clientGateway --> edgeGateway
  edgeGateway --> settings
  edgeGateway --> providers
  edgeGateway -->|برآورد هزینه| editorOrReader
  user -->|تایید هزینه| editorOrReader
  editorOrReader -->|run/generate| clientGateway
  clientGateway --> edgeGateway
  edgeGateway --> aiProvider
  edgeGateway -->|کسر اعتبار| credits
  edgeGateway --> logs
  edgeGateway --> profile
  edgeGateway -->|خروجی| editorOrReader
```

داده های حساس:

- API key provider
- هزینه واقعی و ضریب شارژ
- اعتبار کاربر
- متن انتخاب شده کاربر
- prompt تصویر

کنترل امنیتی:

- API key از فرانت عبور نمی کند.
- عملیات admin فقط با نقش admin/super_admin انجام شود.
- هزینه باید قبل از مصرف به کاربر اعلام شود.
- کسر اعتبار باید سمت سرور و با transaction/lock انجام شود.

## 7. DFD سطح دو: خرید کتاب و اعتبار

```mermaid
flowchart LR
  user[کاربر]
  store[Store / BookLanding]
  rpc[purchase_book RPC]
  books[(books)]
  userBooks[(user_books)]
  credits[(credit_transactions)]
  reader[Reader]

  user --> store
  store -->|درخواست خرید| rpc
  rpc -->|بررسی published + approved| books
  rpc -->|بررسی موجودی| credits
  rpc -->|ثبت مالکیت| userBooks
  rpc -->|ثبت تراکنش منفی| credits
  userBooks --> reader
```

کنترل امنیتی:

- کتاب فقط اگر `status = published` و `review_status = approved` باشد قابل خرید است.
- خرید تکراری نباید دوباره اعتبار کم کند.
- ناشر قبل از انتشار کامل فقط کتاب خودش را می بیند و نباید بتواند کتاب ناشر دیگر را ویرایش کند.

## 8. ERD اصلی

```mermaid
erDiagram
  AUTH_USERS {
    uuid id PK
    text email
  }

  PROFILES {
    uuid id PK
    text display_name
    text username
    text avatar_url
    text bio
    text phone
    text national_id
    boolean is_active
    boolean phone_verified
    text address_province
    text address_city
    text address_district
    text address_street
    text address_alley
    text address_plaque
    text address_unit
    text postal_code
    text address_notes
    text_array reading_interests
    text bank_card_number
    text bank_iban
    timestamptz created_at
    timestamptz updated_at
  }

  USER_ROLES {
    uuid id PK
    uuid user_id FK
    text role
    uuid granted_by FK
    timestamptz created_at
  }

  USER_ACTIVE_SESSIONS {
    uuid user_id PK
    text session_id
    text user_agent
    timestamptz last_seen_at
    timestamptz claimed_at
    timestamptz created_at
  }

  PUBLISHER_PROFILES {
    uuid id PK
    uuid user_id FK
    text slug
    text theme
    text bio
    boolean is_trusted
    timestamptz created_at
  }

  BOOK_SERIES {
    uuid id PK
    text title
    text description
    uuid publisher_id FK
    timestamptz created_at
  }

  BOOKS {
    uuid id PK
    text title
    text subtitle
    text description
    text cover_url
    text back_cover_url
    text cover_spread_url
    jsonb cover_crop
    jsonb pages
    int_array preview_pages
    int price
    text status
    text review_status
    uuid publisher_id FK
    int content_version
    timestamptz content_updated_at
    boolean first_published_paid
    numeric publish_complexity_factor
    uuid series_id FK
    int series_order
    text language
    text_array tags
    jsonb metadata
    timestamptz created_at
    timestamptz updated_at
  }

  USER_BOOKS {
    uuid id PK
    uuid user_id FK
    uuid book_id FK
    timestamptz purchased_at
  }

  BOOK_COMMENTS {
    uuid id PK
    uuid book_id FK
    uuid user_id FK
    uuid parent_id FK
    text content
    boolean is_hidden
    timestamptz created_at
    timestamptz updated_at
  }

  CREDIT_TRANSACTIONS {
    uuid id PK
    uuid user_id FK
    int amount
    text type
    text description
    uuid reference_id
    timestamptz created_at
  }

  PLATFORM_FEE_SETTINGS {
    int id PK
    numeric platform_fee_percent
    int min_platform_fee
    int publish_fee
    int ai_text_cost
    int ai_image_cost
    int publisher_signup_fee
    numeric credits_per_toman
    timestamptz updated_at
  }

  READER_HIGHLIGHTS {
    uuid id PK
    uuid user_id FK
    text book_key
    int page_index
    text text_content
    text color
    text source
    timestamptz created_at
  }

  READER_STATES {
    uuid user_id PK
    text book_key PK
    int current_page
    int total_pages
    text background
    text highlight_color
    timestamptz updated_at
  }

  AI_SAVED_OUTPUTS {
    uuid id PK
    uuid user_id FK
    text book_id
    int page_index
    text action
    jsonb content
    timestamptz created_at
  }

  AI_GATEWAY_SETTINGS {
    int id PK
    text active_provider
    numeric usd_to_toman
    numeric charge_multiplier
    timestamptz updated_at
  }

  AI_PROVIDER_SETTINGS {
    text provider PK
    text label
    boolean enabled
    text api_key
    text base_url
    text model
    text image_model
    numeric input_cost_per_1k_usd
    numeric output_cost_per_1k_usd
    timestamptz updated_at
  }

  AI_USAGE_LOGS {
    uuid id PK
    uuid user_id FK
    text provider
    text model
    text action
    int input_tokens
    int output_tokens
    numeric raw_usd
    numeric charged_usd
    int charged_toman
    int charged_credits
    timestamptz created_at
  }

  BOOK_IMPORT_PROJECTS {
    uuid id PK
    uuid owner_id FK
    uuid publisher_id FK
    uuid book_id FK
    text title
    text status
    text source_name
    bigint source_size
    text source_checksum
    jsonb local_analysis
    jsonb server_analysis
    jsonb conversion_diff
    int complexity_score
    text complexity_grade
    int estimated_credits
    int final_credits
    text error_message
    timestamptz uploaded_at
    timestamptz created_at
    timestamptz updated_at
  }

  BOOK_IMPORT_JOBS {
    uuid id PK
    uuid project_id FK
    text job_type
    text status
    int progress
    int attempts
    jsonb payload
    jsonb result
    text error_message
    timestamptz locked_at
    timestamptz created_at
    timestamptz updated_at
  }

  BOOK_FILTER_SETTINGS {
    int id PK
    jsonb categories
    jsonb tags
    jsonb book_types
    timestamptz updated_at
  }

  AUTH_USERS ||--|| PROFILES : owns
  AUTH_USERS ||--o{ USER_ROLES : has
  AUTH_USERS ||--|| USER_ACTIVE_SESSIONS : active_session
  AUTH_USERS ||--o| PUBLISHER_PROFILES : may_own
  AUTH_USERS ||--o{ USER_BOOKS : purchases
  AUTH_USERS ||--o{ BOOK_COMMENTS : writes
  AUTH_USERS ||--o{ CREDIT_TRANSACTIONS : has
  AUTH_USERS ||--o{ READER_HIGHLIGHTS : creates
  AUTH_USERS ||--o{ READER_STATES : stores
  AUTH_USERS ||--o{ AI_SAVED_OUTPUTS : saves
  AUTH_USERS ||--o{ AI_USAGE_LOGS : consumes
  AUTH_USERS ||--o{ BOOK_IMPORT_PROJECTS : owns

  PUBLISHER_PROFILES ||--o{ BOOK_SERIES : owns
  PUBLISHER_PROFILES ||--o{ BOOKS : publishes
  PUBLISHER_PROFILES ||--o{ BOOK_IMPORT_PROJECTS : imports

  BOOK_SERIES ||--o{ BOOKS : contains
  BOOKS ||--o{ USER_BOOKS : purchased_as
  BOOKS ||--o{ BOOK_COMMENTS : has
  BOOKS ||--o{ BOOK_IMPORT_PROJECTS : created_from
  BOOK_COMMENTS ||--o{ BOOK_COMMENTS : replies
  BOOK_IMPORT_PROJECTS ||--o{ BOOK_IMPORT_JOBS : queues
```

## 9. ERD خلاصه برای مالکیت کتاب

```mermaid
erDiagram
  AUTH_USERS ||--o| PUBLISHER_PROFILES : owns
  PUBLISHER_PROFILES ||--o{ BOOKS : owns
  BOOKS ||--o{ USER_BOOKS : purchased_by_users
  AUTH_USERS ||--o{ USER_BOOKS : owns_library
  BOOKS ||--o{ BOOK_IMPORT_PROJECTS : may_be_created_from
  AUTH_USERS ||--o{ BOOK_IMPORT_PROJECTS : imports

  AUTH_USERS {
    uuid id PK
  }
  PUBLISHER_PROFILES {
    uuid id PK
    uuid user_id FK
  }
  BOOKS {
    uuid id PK
    uuid publisher_id FK
    text status
    text review_status
    jsonb metadata
  }
  USER_BOOKS {
    uuid user_id FK
    uuid book_id FK
  }
  BOOK_IMPORT_PROJECTS {
    uuid id PK
    uuid owner_id FK
    uuid publisher_id FK
    uuid book_id FK
  }
```

قانون مالکیت:

- مالک واقعی کتاب `publisher_profiles.id` است.
- ناشر فقط کتاب هایی را می بیند/ویرایش می کند که `books.publisher_id` به پروفایل ناشر خودش وصل باشد.
- ادمین در پنل ادمین نظارت دارد، اما صفحه انتشارات ادمین نباید کتاب ناشران دیگر را به عنوان دارایی خودش نشان دهد.
- کتاب منتشر شده و خریداری شده نباید بدون قانون مشخص به حالت ویرایش آزاد برگردد.

## 10. نقشه کدهای حساس

| سطح حساسیت | فایل / مسیر | چرا حساس است | کنترل لازم |
|---|---|---|---|
| Secret | `supabase/functions/ai-gateway/index.ts` | کلیدهای AI، محاسبه هزینه، کسر اعتبار | کلیدها فقط server-side، admin check، log مصرف |
| Secret | `supabase/functions/admin-users/index.ts` | تغییر رمز، لیست کاربران، لینک reset | فقط admin/super_admin، عدم افشای اطلاعات اضافی |
| Secret | `.env`, Supabase secrets | URL/keyها و secretها | هرگز commit نشوند |
| Financial | `supabase/migrations/*charge_user_credits*` | کسر اعتبار کاربر | transaction، advisory lock، RLS |
| Financial | `supabase/migrations/*purchase_book*` | خرید کتاب و کم کردن اعتبار | جلوگیری از خرید تکراری، فقط کتاب published |
| Financial | `src/lib/ai-gateway.ts` | تخمین هزینه و درخواست مصرف AI | قبل از مصرف تایید کاربر، sync با Edge |
| Ownership | `supabase/migrations/*Publishers manage own books*` | دسترسی ناشر به کتاب | RLS بر اساس publisher مالک |
| Ownership | `src/lib/book-repository.ts` | دریافت کتاب های عمومی/ناشر/قفسه | جداسازی published/public از draft/private |
| Ownership | `src/lib/publisher-remote-sync.ts` | انتقال کتاب های محلی به Supabase | publisher_id صحیح، عدم overwrite کتاب مشابه |
| Ownership | `src/lib/publisher-delete.ts` | حذف کتاب و storage | فقط مالک و فقط حالت مجاز |
| User Data | `src/lib/auth-context.tsx` | نشست فعال، ورود/خروج | یک نشست فعال، پیام واضح، عدم loop خروج |
| User Data | `src/pages/Profile.tsx` | آدرس، کارت، شبا، علاقه ها | فقط کاربر خودش، masking لازم |
| Private Files | `src/lib/import-upload.ts` | آپلود Word و تصاویر | bucket خصوصی، مسیر بر اساس uid |
| Private Files | `src/workers/docx-import.worker.ts` | استخراج محتوای فایل Word | قبل از تایید فقط محلی |
| Content Integrity | `src/features/editor-v2/EditorV2Page.tsx` | تبدیل DOM به سند، save، مالکیت محتوای کتاب | عدم reset تایپ، حفظ page break، حفظ inline marks |
| Content Integrity | `src/lib/book-content.ts` | قوانین متن، ZWS، پاورقی، لینک، کپشن | مرجع واحد همه نمایش ها |
| Content Integrity | `src/components/book-content-v2/*` | رندر مشترک reader/editor preview | عدم duplicate rendering |
| Cache/Deploy | `src/lib/version-cache.ts` | رفع خطای chunk و cache | clear cache کنترل شده |
| Cache/Deploy | `public/sw.js` | Service Worker و cache assetها | همگام با APP_VERSION |
| Admin Config | `src/components/admin/AiGatewaySettingsPanel.tsx` | تنظیم مدل و کلید AI | masked key، test provider، admin only |
| Admin Config | `src/lib/filter-settings.ts` | فیلترهای فروشگاه | فقط admin برای تغییر |

## 11. ماتریس طبقه بندی داده

| داده | طبقه | محل ذخیره | دسترسی مجاز |
|---|---|---|---|
| کتاب منتشر شده | عمومی | `books` | همه کاربران و anon |
| پیش نویس کتاب | خصوصی ناشر | `books` | ناشر مالک، RLS، گاهی admin نظارتی |
| فایل Word اصلی | خصوصی | Storage `book-imports` | owner و admin |
| تصویرهای کتاب پیش نویس | خصوصی/نیمه خصوصی | Storage یا metadata | ناشر مالک |
| تصویرهای کتاب منتشر شده | عمومی | URL/Storage | همه |
| پروفایل عمومی | نیمه عمومی | `profiles`, `publisher_profiles` | بسته به فیلد |
| آدرس، کارت، شبا | حساس کاربر | `profiles` | فقط کاربر و دسترسی ادمین محدود |
| اعتبار کاربر | مالی | `credit_transactions` | کاربر خودش و admin |
| تراکنش خرید | مالی | `credit_transactions`, `user_books` | کاربر خودش و admin |
| کلید AI | Secret | `ai_provider_settings` | Edge/admin، فرانت فقط masked |
| لاگ مصرف AI | مالی/رفتاری | `ai_usage_logs` | کاربر خودش و admin |
| هایلایت و وضعیت خواندن | خصوصی کاربر | `reader_highlights`, `reader_states` | کاربر خودش |
| session فعال | امنیتی | `user_active_sessions` | کاربر خودش |

## 12. نقاطی که قبل از هر تغییر باید چک شوند

### اگر تغییر مربوط به نمایش محتوای کتاب است

اول این ها:

1. `src/lib/book-content.ts`
2. `src/components/book-content-v2/InlineTextV2.tsx`
3. `src/components/book-content-v2/BookRendererV2.tsx`
4. `src/components/book-content-v2/book-content-v2.css`

بعد مصرف کننده ها:

1. `src/pages/Reader.tsx`
2. `src/features/editor-v2/EditorV2Page.tsx`
3. `src/pages/Upload.tsx`

### اگر تغییر مربوط به مالکیت ناشر یا کتاب است

اول این ها:

1. migrations مربوط به RLS روی `books`
2. `src/lib/book-repository.ts`
3. `src/lib/publisher-remote-sync.ts`
4. `src/pages/Publisher.tsx`
5. `src/pages/Library.tsx`

### اگر تغییر مربوط به AI یا هزینه است

اول این ها:

1. `supabase/functions/ai-gateway/index.ts`
2. `src/lib/ai-gateway.ts`
3. `src/components/admin/AiGatewaySettingsPanel.tsx`
4. migrations مربوط به `ai_*` و `credit_transactions`

### اگر تغییر مربوط به import Word است

اول این ها:

1. `src/workers/docx-import.worker.ts`
2. `src/lib/word-import-types.ts`
3. `src/lib/import-document.ts`
4. `src/lib/import-upload.ts`
5. `src/pages/Upload.tsx`

## 13. RLS و سیاست های کلیدی

| جدول | سیاست اصلی |
|---|---|
| `profiles` | کاربر پروفایل خودش را می بیند/ویرایش می کند؛ ادمین می تواند ببیند |
| `user_roles` | کاربر نقش خودش را می بیند؛ ادمین مدیریت می کند |
| `publisher_profiles` | عمومی قابل مشاهده؛ ناشر مالک ویرایش می کند |
| `books` | published/approved عمومی؛ draft فقط ناشر مالک طبق policy |
| `user_books` | فقط کتابخانه کاربر خودش |
| `credit_transactions` | فقط تراکنش های کاربر خودش |
| `reader_highlights` | فقط کاربر مالک |
| `reader_states` | فقط کاربر مالک |
| `book_import_projects` | owner یا admin |
| `book_import_jobs` | owner project یا admin |
| `ai_provider_settings` | فقط admin از طریق Edge/admin |
| `book_filter_settings` | خواندن عمومی؛ مدیریت admin |
| `user_active_sessions` | فقط کاربر خودش |

## 14. ریسک های معماری که باید مراقبشان بود

### 1. مخلوط شدن داده local و Supabase

ریشه خطر:

- `publisher-books.ts`
- mock data
- localStorage fallback
- cache قدیمی browser

قاعده:

- production فقط Supabase را source of truth بداند.
- اگر fallback محلی نمایش داده شد، باید با badge و پیام واضح مشخص باشد.

### 2. قاطی شدن کتاب های هم نام

ریشه خطر:

- استفاده از title، filename یا checksum برای merge

قاعده:

- فقط `books.id` شناسه کتاب است.
- import project هم فقط با `book_import_projects.id` شناخته می شود.
- checksum فقط برای تشخیص فایل مشابه است، نه identity.

### 3. از دست رفتن markهای متن بعد از save

ریشه خطر:

- تبدیل DOM به document V2 در `EditorV2Page.tsx`

قاعده:

- هر تغییر در parser باید با این موارد تست شود: hyperlink، subscript، superscript، list، caption، citation، footnote، Greek symbols.

### 4. افشای کلید AI

ریشه خطر:

- ذخیره یا نمایش `api_key` در فرانت

قاعده:

- فرانت فقط masked key نشان دهد.
- تست و مصرف از Edge Function انجام شود.

### 5. cache ناسازگار GitHub Pages

ریشه خطر:

- Service Worker و فایل های chunk نسخه قبل

قاعده:

- `APP_VERSION`, `version.json`, `sw.js` باید با build همگام باشند.
- خطاهای dynamic import باید مسیر recovery داشته باشند.

## 15. چک لیست امنیتی قبل از deploy

1. `git status --short` هیچ فایل `.env` یا secret نداشته باشد.
2. `npm.cmd run build` پاس شود.
3. RLS برای جدول جدید فعال باشد.
4. جدول جدید policy حداقلی داشته باشد.
5. اگر Edge Function جدید اضافه شد، auth را چک کند.
6. اگر هزینه/credit تغییر کرد، محاسبه سمت server انجام شود.
7. اگر مسیر upload جدید اضافه شد، Storage policy مالکیت داشته باشد.
8. اگر داده ناشر تغییر کرد، publisher_id از کاربر فعلی resolve شود نه از ورودی خام.
9. اگر کتاب تغییر کرد، `books.id` استفاده شود نه title/file name.
10. اگر متن کتاب تغییر کرد، reader و editor هر دو تست شوند.
