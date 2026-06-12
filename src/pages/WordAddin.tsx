import { FileText, PlugZap, ShieldCheck, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function WordAddin() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <section className="menu-glass-70 rounded-3xl p-8">
        <p className="text-sm text-muted-foreground">Office Companion</p>
        <h1 className="text-3xl font-black font-display mt-1">افزونه Word متابوکی</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed max-w-3xl">برای ناشرانی که متن را در Word آماده می‌کنند، افزونه Word امکان ارسال مستقیم متن، تصاویر، فرمول‌ها و فهرست را به کارگاه متابوکی فراهم می‌کند.</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Button className="gap-2"><PlugZap className="w-4 h-4" />دریافت manifest افزونه</Button>
          <Button variant="outline" className="gap-2"><UploadCloud className="w-4 h-4" />راهنمای اتصال</Button>
        </div>
      </section>
      <section className="grid md:grid-cols-3 gap-4">
        {[
          { icon: FileText, title: 'ارسال ساختار فصل‌ها', desc: 'Headingها و فهرست Word به فصل‌های کتاب تبدیل می‌شود.' },
          { icon: UploadCloud, title: 'انتقال تصاویر', desc: 'تصاویر و کپشن‌ها برای کتابخانه رسانه آماده می‌شوند.' },
          { icon: ShieldCheck, title: 'اعتبارسنجی محتوا', desc: 'پیش از انتشار، فرمول‌ها، جدول‌ها و خطاهای رایج بررسی می‌شوند.' },
        ].map(item => <div key={item.title} className="menu-glass-70 rounded-2xl p-6"><item.icon className="w-7 h-7 text-primary mb-3" /><h3 className="font-bold">{item.title}</h3><p className="text-sm text-muted-foreground mt-1">{item.desc}</p></div>)}
      </section>
    </div>
  )
}
