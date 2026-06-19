import { AlertTriangle, BookOpen, CheckCircle2, HelpCircle, Lightbulb, PenLine, Quote, Sparkles, TextQuote, BarChart3 } from 'lucide-react'

export const EDITOR_CALLOUT_TYPES = [
  { value: 'key', label: 'نکته کلیدی', iconText: '💡', Icon: Lightbulb, accent: '#2563eb', description: 'خلاصه نکته مهم' },
  { value: 'ai', label: 'راهنمای هوشمند', iconText: '✨', Icon: Sparkles, accent: '#2563eb', description: 'توضیح ساده‌تر یا پیشنهاد AI' },
  { value: 'question', label: 'مکث و فکر کن', iconText: '؟', Icon: HelpCircle, accent: '#7c3aed', description: 'سؤال برای درگیر کردن خواننده' },
  { value: 'warning', label: 'اشتباه رایج', iconText: '!', Icon: AlertTriangle, accent: '#dc2626', description: 'هشدار درباره برداشت اشتباه' },
  { value: 'quote', label: 'جمله طلایی', iconText: '❝', Icon: Quote, accent: '#c8a75a', description: 'نقل‌قول یا جمله مهم' },
  { value: 'deep', label: 'عمیق‌تر بخوان', iconText: '⌕', Icon: BookOpen, accent: '#173b63', description: 'محتوای تکمیلی و پیشرفته' },
  { value: 'practice', label: 'تمرین سریع', iconText: '✓', Icon: CheckCircle2, accent: '#059669', description: 'فعالیت کوتاه برای خواننده' },
  { value: 'glossary', label: 'تعریف واژه', iconText: 'Aa', Icon: TextQuote, accent: '#7c3aed', description: 'تعریف اصطلاح یا مفهوم' },
  { value: 'data', label: 'داده و منبع', iconText: '#', Icon: BarChart3, accent: '#2563eb', description: 'عدد، آمار یا رفرنس' },
  { value: 'margin', label: 'یادداشت حاشیه‌ای', iconText: '✎', Icon: PenLine, accent: '#c8a75a', description: 'توضیح کوتاه کنار متن' },
] as const

export type EditorCalloutType = (typeof EDITOR_CALLOUT_TYPES)[number]['value']

export function getEditorCalloutType(value?: string) {
  return EDITOR_CALLOUT_TYPES.find(item => item.value === value) || EDITOR_CALLOUT_TYPES[0]
}
