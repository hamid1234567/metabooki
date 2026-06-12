import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

type Language = 'fa' | 'en'

interface I18nContextType {
  lang: Language
  dir: 'rtl' | 'ltr'
  setLang: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<string, Record<Language, string>> = {
  nav_home: { fa: 'خانه', en: 'Home' },
  nav_store: { fa: 'فروشگاه', en: 'Store' },
  nav_library: { fa: 'کتابخانه', en: 'Library' },
  nav_upload: { fa: 'آپلود کتاب', en: 'Upload Book' },
  nav_credits: { fa: 'اعتبار', en: 'Credits' },
  nav_admin: { fa: 'مدیریت', en: 'Admin' },
  nav_profile: { fa: 'پروفایل', en: 'Profile' },
  nav_publisher: { fa: 'ناشر', en: 'Publisher' },
  nav_install: { fa: 'نصب اپ', en: 'Install App' },
  nav_login: { fa: 'ورود', en: 'Login' },
  nav_logout: { fa: 'خروج', en: 'Logout' },
  nav_editor_requests: { fa: 'درخواست‌های ویراستاری', en: 'Editor Requests' },
  book_price: { fa: 'قیمت', en: 'Price' },
  book_free: { fa: 'رایگان', en: 'Free' },
  book_purchase: { fa: 'خرید کتاب', en: 'Purchase Book' },
  book_read: { fa: 'خواندن', en: 'Read' },
  book_preview: { fa: 'پیش‌نمایش', en: 'Preview' },
  book_pages: { fa: 'صفحات', en: 'Pages' },
  book_chapters: { fa: 'فصل‌ها', en: 'Chapters' },
  book_comments: { fa: 'نظرات', en: 'Comments' },
  book_reviews: { fa: 'امتیازات', en: 'Reviews' },
  search: { fa: 'جستجو...', en: 'Search...' },
  loading: { fa: 'در حال بارگذاری...', en: 'Loading...' },
  error: { fa: 'خطا', en: 'Error' },
  success: { fa: 'موفق', en: 'Success' },
  save: { fa: 'ذخیره', en: 'Save' },
  cancel: { fa: 'لغو', en: 'Cancel' },
  delete: { fa: 'حذف', en: 'Delete' },
  edit: { fa: 'ویرایش', en: 'Edit' },
  create: { fa: 'ایجاد', en: 'Create' },
  submit: { fa: 'ارسال', en: 'Submit' },
  confirm: { fa: 'تأیید', en: 'Confirm' },
  close: { fa: 'بستن', en: 'Close' },
  back: { fa: 'بازگشت', en: 'Back' },
  next: { fa: 'بعدی', en: 'Next' },
  previous: { fa: 'قبلی', en: 'Previous' },
  credits_balance: { fa: 'موجودی اعتبار', en: 'Credit Balance' },
  credits_topup: { fa: 'افزایش اعتبار', en: 'Top Up Credits' },
  credits_history: { fa: 'تاریخچه تراکنش‌ها', en: 'Transaction History' },
  credits_no_transactions: { fa: 'تراکنشی یافت نشد', en: 'No transactions found' },
  profile_title: { fa: 'پروفایل من', en: 'My Profile' },
  profile_display_name: { fa: 'نام نمایشی', en: 'Display Name' },
  profile_username: { fa: 'نام کاربری', en: 'Username' },
  profile_phone: { fa: 'شماره تلفن', en: 'Phone Number' },
  profile_national_id: { fa: 'کد ملی', en: 'National ID' },
  profile_bio: { fa: 'بیوگرافی', en: 'Bio' },
  profile_avatar: { fa: 'تصویر پروفایل', en: 'Avatar' },
  publisher_dashboard: { fa: 'داشبورد ناشر', en: 'Publisher Dashboard' },
  publisher_books: { fa: 'کتاب‌های من', en: 'My Books' },
  publisher_sales: { fa: 'آمار فروش', en: 'Sales Stats' },
  publisher_revenue: { fa: 'سهم‌ها', en: 'Revenue Shares' },
  publisher_comments: { fa: 'مدیریت نظرات', en: 'Comment Moderation' },
  publisher_settings: { fa: 'تنظیمات ناشر', en: 'Publisher Settings' },
  publisher_upgrade: { fa: 'درخواست ناشر شدن', en: 'Request Publisher Upgrade' },
  admin_dashboard: { fa: 'داشبورد مدیریت', en: 'Admin Dashboard' },
  admin_users: { fa: 'کاربران', en: 'Users' },
  admin_treasury: { fa: 'خزانه', en: 'Treasury' },
  admin_ai_usage: { fa: 'مصرف هوش مصنوعی', en: 'AI Usage' },
  admin_sms: { fa: 'تنظیمات پیامک', en: 'SMS Settings' },
  admin_comments: { fa: 'تنظیمات نظرات', en: 'Comment Settings' },
  admin_errors: { fa: 'خطاهای سیستم', en: 'Error Logs' },
  reader_highlight: { fa: 'هایلایت', en: 'Highlight' },
  reader_underline: { fa: 'خط کشی', en: 'Underline' },
  reader_add_note: { fa: 'افزودن یادداشت', en: 'Add Note' },
  reader_ai_panel: { fa: 'دستیار هوش مصنوعی', en: 'AI Assistant' },
  reader_chat: { fa: 'گفتگو با کتاب', en: 'Chat with Book' },
  reader_toc: { fa: 'فهرست مطالب', en: 'Table of Contents' },
  reader_progress: { fa: 'پیشرفت', en: 'Progress' },
  reader_lock: { fa: 'این کتاب در دستگاه دیگری در حال خوانده شدن است', en: 'This book is being read on another device' },
  builder_title: { fa: 'ویرایشگر کتاب', en: 'Book Editor' },
  builder_cover: { fa: 'طراحی جلد', en: 'Cover Designer' },
  builder_toc: { fa: 'مدیریت فهرست', en: 'TOC Management' },
  builder_ai_suggest: { fa: 'پیشنهادات هوش مصنوعی', en: 'AI Suggestions' },
  builder_images: { fa: 'مدیریت تصاویر', en: 'Image Management' },
  builder_preview: { fa: 'پیش‌نمایش', en: 'Preview' },
  builder_publish: { fa: 'انتشار', en: 'Publish' },
  builder_save: { fa: 'ذخیره تغییرات', en: 'Save Changes' },
  upload_title: { fa: 'آپلود کتاب', en: 'Upload Book' },
  upload_docx: { fa: 'فایل DOCX را انتخاب کنید', en: 'Select DOCX File' },
  upload_drag: { fa: 'فایل را اینجا رها کنید', en: 'Drop file here' },
  upload_processing: { fa: 'در حال پردازش...', en: 'Processing...' },
  upload_validation: { fa: 'گزارش اعتبارسنجی', en: 'Validation Report' },
  upload_preview: { fa: 'پیش‌نمایش وب', en: 'Web Preview' },
  upload_toc: { fa: 'فهرست مطالب', en: 'Table of Contents' },
  audio_studio: { fa: 'استودیو صوتی', en: 'Audio Studio' },
  audio_chapters: { fa: 'فصل‌های صوتی', en: 'Audio Chapters' },
  audio_upload: { fa: 'آپلود فایل صوتی', en: 'Upload Audio' },
  audio_preview: { fa: 'پیش‌نمایش', en: 'Preview' },
  audio_bookmarks: { fa: 'نشانک‌ها', en: 'Bookmarks' },
  audio_progress: { fa: 'پیشرفت پخش', en: 'Playback Progress' },
  offline_download: { fa: 'دانلود برای آفلاین', en: 'Download for Offline' },
  offline_installed: { fa: 'نصب شده', en: 'Installed' },
  offline_devices: { fa: 'دستگاه‌های مجاز', en: 'Authorized Devices' },
  theme_silver: { fa: 'نقره‌ای', en: 'Sandblasted Silver' },
  theme_sky: { fa: 'آسمانی', en: 'Sky' },
  theme_paper: { fa: 'کاغذی', en: 'Paper' },
  theme_midnight: { fa: 'نیمه‌شب', en: 'Midnight' },
  language_fa: { fa: 'فارسی', en: 'Persian' },
  language_en: { fa: 'انگلیسی', en: 'English' },
  notifications: { fa: 'اعلان‌ها', en: 'Notifications' },
  notifications_empty: { fa: 'اعلانی وجود ندارد', en: 'No notifications' },
  notifications_mark_read: { fa: 'علامت به عنوان خوانده شده', en: 'Mark as read' },
  offline_banner: { fa: 'شما آفلاین هستید', en: 'You are offline' },
  version_new: { fa: 'نسخه جدید در دسترس است', en: 'New version available' },
  version_reload: { fa: 'بارگذاری مجدد', en: 'Reload' },
  auth_login: { fa: 'ورود', en: 'Login' },
  auth_register: { fa: 'ثبت‌نام', en: 'Register' },
  auth_email: { fa: 'ایمیل', en: 'Email' },
  auth_password: { fa: 'رمز عبور', en: 'Password' },
  auth_phone: { fa: 'شماره تلفن', en: 'Phone Number' },
  auth_otp: { fa: 'کد تأیید', en: 'OTP Code' },
  auth_send_otp: { fa: 'ارسال کد', en: 'Send OTP' },
  auth_google: { fa: 'ورود با گوگل', en: 'Sign in with Google' },
  auth_no_account: { fa: 'حساب کاربری ندارید؟', en: "Don't have an account?" },
  auth_has_account: { fa: 'حساب کاربری دارید؟', en: 'Already have an account?' },
  auth_forgot: { fa: 'رمز عبور را فراموش کرده‌اید؟', en: 'Forgot password?' },
  install_title: { fa: 'نصب برنامه', en: 'Install App' },
  install_description: { fa: 'Metabooki را روی دستگاه خود نصب کنید', en: 'Install Metabooki on your device' },
  install_button: { fa: 'نصب', en: 'Install' },
  install_pwa: { fa: 'نصب به عنوان PWA', en: 'Install as PWA' },
  install_native: { fa: 'نسخه اندروید و iOS', en: 'Android & iOS Version' },
  landing_title: { fa: 'متابوکی', en: 'Metabooki' },
  landing_subtitle: { fa: 'پلتفرم نشر و مطالعه دیجیتال', en: 'Digital Publishing & Reading Platform' },
  landing_start: { fa: 'شروع کنید', en: 'Get Started' },
  landing_explore: { fa: 'کاوش در فروشگاه', en: 'Explore Store' },
  not_found: { fa: 'صفحه مورد نظر یافت نشد', en: 'Page Not Found' },
  not_found_desc: { fa: 'متأسفیم، صفحه‌ای که به دنبال آن هستید وجود ندارد.', en: 'Sorry, the page you are looking for does not exist.' },
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('metabooki_lang')
    return (saved === 'en' || saved === 'fa') ? saved : 'fa'
  })

  const dir = lang === 'fa' ? 'rtl' : 'ltr'

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang)
    localStorage.setItem('metabooki_lang', newLang)
  }, [])

  const t = useCallback((key: string): string => {
    return translations[key]?.[lang] || translations[key]?.['fa'] || key
  }, [lang])

  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = lang
  }, [dir, lang])

  return (
    <I18nContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}