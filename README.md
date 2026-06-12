# Metabooki

فروشگاه، قفسه و کتابخوان تعاملی فارسی با اتصال واقعی Supabase و Edge Function هوش مصنوعی.

## اجرای محلی

```bash
npm install
npm run dev
```

متغیرهای لازم را مطابق `.env.example` در فایل `.env` قرار دهید.

## انتشار GitHub Pages

Workflow موجود در `.github/workflows/deploy-pages.yml` پس از هر push به شاخه `main` سایت را build و منتشر می‌کند.

در تنظیمات مخزن GitHub، این Secrets را اضافه کنید:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

سپس در `Settings > Pages`، منبع انتشار را روی `GitHub Actions` قرار دهید.
