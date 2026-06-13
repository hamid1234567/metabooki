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

## همگام‌سازی خودکار با GitHub

تسک `Metabooki: Auto Sync GitHub` هنگام بازشدن پوشه در VS Code اجرا می‌شود. پس از توقف تغییرات، ابتدا build تولید را بررسی می‌کند و فقط در صورت موفقیت، تغییرات را commit و به شاخه `main` push می‌کند.

برای اجرای دستی:

```bash
npm run sync:github
```

فایل‌های `.env`، کلیدهای خصوصی و `public/version.json` وارد commit خودکار نمی‌شوند. هر push موفق، انتشار GitHub Pages را نیز آغاز می‌کند.
