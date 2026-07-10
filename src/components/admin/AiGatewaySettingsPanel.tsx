import { AlertTriangle, CheckCircle, KeyRound, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CREDIT_VALUE_TOMAN } from '@/lib/mock-data'
import {
  KIE_AUDIO_MODEL_OPTIONS,
  KIE_IMAGE_MODEL_OPTIONS,
  KIE_TEXT_MODEL_OPTIONS,
  maskApiKey,
  type AiGatewaySettings,
  type AiProviderConfig,
  type AiProviderTestResult,
} from '@/lib/ai-gateway'

type ProviderTestState = {
  state: 'idle' | 'testing' | 'ok' | 'error'
  message: string
  sample?: string
  routes?: AiProviderTestResult['routes']
}

type AiGatewaySettingsPanelProps = {
  settings: AiGatewaySettings
  tests: Record<string, ProviderTestState>
  message?: string
  onSettingsChange: (settings: AiGatewaySettings) => void
  onProviderChange: (providerId: AiProviderConfig['id'], patch: Partial<AiProviderConfig>) => void
  onProviderTest: (provider: AiProviderConfig) => void
  onSave: () => void
}

export function AiGatewaySettingsPanel({
  settings,
  tests,
  message,
  onSettingsChange,
  onProviderChange,
  onProviderTest,
  onSave,
}: AiGatewaySettingsPanelProps) {
  const enabledCount = settings.providers.filter(provider => provider.enabled).length
  const activeProvider = settings.providers.find(provider => provider.id === settings.activeProvider)
  const activeProviderLabel = activeProvider?.label || settings.activeProvider

  const updateKieTextModel = (provider: AiProviderConfig, modelId: string) => {
    const option = KIE_TEXT_MODEL_OPTIONS.find(item => item.id === modelId)
    onProviderChange(provider.id, {
      model: modelId,
      ...(option ? {
        inputCostPer1kUsd: option.inputCostPer1kUsd,
        outputCostPer1kUsd: option.outputCostPer1kUsd,
      } : {}),
    })
  }
  const promptFields: Array<[keyof AiGatewaySettings['promptSettings'], string, string]> = [
    ['textGlobal', 'پرامپت تکمیلی عمومی متن', 'به همه درخواست‌های متنی اضافه می‌شود.'],
    ['readerSummary', 'کتابخوان: خلاصه', 'راهنمای اختصاصی تولید خلاصه صفحه.'],
    ['readerQuiz', 'کتابخوان: سؤال', 'راهنمای اختصاصی تولید سؤال چندگزینه‌ای.'],
    ['readerMindmap', 'کتابخوان: Mindmap', 'راهنمای اختصاصی تولید نقشه ذهنی.'],
    ['readerLearningPath', 'کتابخوان: مسیر یادگیری', 'راهنمای اختصاصی تولید مسیر مرحله‌ای.'],
    ['readerExplain', 'کتابخوان: شرح عمیق', 'راهنمای اختصاصی توضیح عمیق‌تر.'],
    ['readerCalloutSuggestions', 'ادیتور: پیشنهاد Callout', 'راهنمای اختصاصی پیشنهاد کال‌اوت.'],
    ['imageGlobal', 'پرامپت تکمیلی عمومی تصویر', 'به همه درخواست‌های تصویر اضافه می‌شود.'],
    ['imageInteractive', 'تصاویر تعاملی', 'به پرامپت تصاویر تعاملی اضافه می‌شود.'],
    ['imageBookCover', 'کاور کتاب', 'به پرامپت تولید جلد کتاب اضافه می‌شود.'],
    ['imageDirect', 'تصویر مستقیم کاربر', 'در صورت نیاز به پرامپت مستقیم کاربر افزوده می‌شود.'],
  ]
  const updatePromptSetting = (key: keyof AiGatewaySettings['promptSettings'], value: string) => {
    onSettingsChange({
      ...settings,
      promptSettings: { ...settings.promptSettings, [key]: value },
    })
  }

  return (
    <div className="space-y-6">
      <section className="glass rounded-2xl p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              تنظیمات مرکزی هوش مصنوعی
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
              کلیدها در سرور و Edge Function ذخیره می‌شوند. مدل متن/بینایی برای خروجی‌های متنی و تحلیل تصویر است و مدل تولید تصویر جداگانه استفاده می‌شود.
            </p>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:text-left">
            <span className={`rounded-full px-3 py-1 ${activeProvider?.enabled ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
              ارائه‌دهنده فعال: {activeProviderLabel}
              {activeProvider && !activeProvider.enabled ? ' (غیرفعال)' : ''}
            </span>
            <span className="rounded-full bg-muted px-3 py-1">{enabledCount.toLocaleString('fa-IR')} ارائه‌دهنده فعال</span>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm text-muted-foreground">ارائه‌دهنده فعال</span>
            <select
              title="ارائه‌دهنده فعال هوش مصنوعی"
              value={settings.activeProvider}
              onChange={event => onSettingsChange({ ...settings, activeProvider: event.target.value as AiGatewaySettings['activeProvider'] })}
              className="w-full rounded-xl border border-input bg-background p-2.5 text-sm"
            >
              {settings.providers.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted-foreground">نرخ دلار مبنا، تومان</span>
            <input
              title="نرخ دلار مبنا"
              type="number"
              value={settings.usdToToman}
              onChange={event => onSettingsChange({ ...settings, usdToToman: Number(event.target.value) })}
              className="w-full rounded-xl border border-input bg-background p-2.5 text-sm font-bold"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted-foreground">ضریب شارژ کاربر</span>
            <input
              title="ضریب شارژ کاربر"
              type="number"
              step="0.1"
              value={settings.chargeMultiplier}
              onChange={event => onSettingsChange({ ...settings, chargeMultiplier: Number(event.target.value) })}
              className="w-full rounded-xl border border-input bg-background p-2.5 text-sm font-bold"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {settings.providers.map(provider => {
            const test = tests[provider.id] || { state: 'idle' as const, message: '' }
            const active = settings.activeProvider === provider.id
            return (
              <article key={provider.id} className={`rounded-2xl border p-4 ${active ? 'border-primary bg-primary/5' : 'border-border bg-background/55'}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-bold">
                      <KeyRound className="h-4 w-4 text-primary" />
                      {provider.label}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">کلید فعلی: {maskApiKey(provider.apiKey)}</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={provider.enabled} onChange={event => onProviderChange(provider.id, { enabled: event.target.checked })} />
                    فعال
                  </label>
                </div>

                <div className="grid gap-3">
                  <input title="API Key" type="password" value={provider.apiKey} onChange={event => onProviderChange(provider.id, { apiKey: event.target.value })} placeholder="API Key" className="w-full rounded-xl border border-input bg-background p-2.5 text-sm" dir="ltr" />
                  <input title="Base URL" value={provider.baseUrl || ''} onChange={event => onProviderChange(provider.id, { baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" className="w-full rounded-xl border border-input bg-background p-2.5 text-sm" dir="ltr" />
                  {provider.id === 'kie' ? (
                    <>
                      <label className="grid gap-1">
                        <span className="text-xs text-muted-foreground">مدل متنی KIE</span>
                        <select
                          title="مدل متنی KIE"
                          value={provider.model}
                          onChange={event => updateKieTextModel(provider, event.target.value)}
                          className="w-full rounded-xl border border-input bg-background p-2.5 text-sm"
                          dir="ltr"
                        >
                          {KIE_TEXT_MODEL_OPTIONS.map(option => (
                            <option key={option.id} value={option.id}>
                              {option.label} - ${option.inputCostPer1kUsd}/1K in - ${option.outputCostPer1kUsd}/1K out
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs text-muted-foreground">مدل تصویری KIE</span>
                        <select
                          title="مدل تصویری KIE"
                          value={provider.imageModel || KIE_IMAGE_MODEL_OPTIONS[0]?.id || ''}
                          onChange={event => onProviderChange(provider.id, { imageModel: event.target.value })}
                          className="w-full rounded-xl border border-input bg-background p-2.5 text-sm"
                          dir="ltr"
                        >
                          {KIE_IMAGE_MODEL_OPTIONS.map(option => (
                            <option key={option.id} value={option.id}>
                              {option.label} - base ${option.baseCostUsd}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs text-muted-foreground">مدل صوتی KIE / ElevenLabs</span>
                        <select
                          title="مدل صوتی KIE"
                          value={provider.audioModel || KIE_AUDIO_MODEL_OPTIONS[0]?.id || ''}
                          onChange={event => onProviderChange(provider.id, { audioModel: event.target.value })}
                          className="w-full rounded-xl border border-input bg-background p-2.5 text-sm"
                          dir="ltr"
                        >
                          {KIE_AUDIO_MODEL_OPTIONS.map(option => (
                            <option key={option.id} value={option.id}>
                              {option.label} - base ${option.baseCostUsd}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <input title="مدل متن و بینایی" value={provider.model} onChange={event => onProviderChange(provider.id, { model: event.target.value })} placeholder="Text / Vision model, مثل gpt-4o یا gpt-4o-mini" className="w-full rounded-xl border border-input bg-background p-2.5 text-sm" dir="ltr" />
                      <input title="مدل تولید تصویر" value={provider.imageModel || ''} onChange={event => onProviderChange(provider.id, { imageModel: event.target.value })} placeholder="Image generation model, مثل gpt-image-1" className="w-full rounded-xl border border-input bg-background p-2.5 text-sm" dir="ltr" />
                    </>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-muted-foreground">هزینه ورودی / ۱۰۰۰ توکن ($)</span>
                      <input title="هزینه ورودی" type="number" step="0.000001" value={provider.inputCostPer1kUsd} onChange={event => onProviderChange(provider.id, { inputCostPer1kUsd: Number(event.target.value) })} className="w-full rounded-xl border border-input bg-background p-2 text-sm" />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-muted-foreground">هزینه خروجی / ۱۰۰۰ توکن ($)</span>
                      <input title="هزینه خروجی" type="number" step="0.000001" value={provider.outputCostPer1kUsd} onChange={event => onProviderChange(provider.id, { outputCostPer1kUsd: Number(event.target.value) })} className="w-full rounded-xl border border-input bg-background p-2 text-sm" />
                    </label>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onProviderTest(provider)} disabled={test.state === 'testing'} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${test.state === 'testing' ? 'animate-spin' : ''}`} />
                    تست مسیرها
                  </Button>
                  {provider.id === 'kie' && <small className="text-xs text-muted-foreground">متن، تصویر و صدا با مدل‌های انتخاب‌شده تست می‌شوند.</small>}
                  {test.message && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${test.state === 'ok' ? 'bg-success/15 text-success' : test.state === 'error' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                      {test.state === 'ok' ? <CheckCircle className="h-3.5 w-3.5" /> : test.state === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                      {test.message}
                    </span>
                  )}
                </div>
                {test.routes?.length ? (
                  <div className="mt-3 grid gap-2">
                    {test.routes.map(route => (
                      <div key={`${route.kind}-${route.model}`} className={`rounded-xl border px-3 py-2 text-xs ${route.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                        <b className="uppercase">{route.kind}</b>
                        <span className="mx-2" dir="ltr">{route.model}</span>
                        <span>{route.ok ? 'OK' : route.message}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {test.sample && <pre className="mt-3 max-h-24 overflow-auto rounded-xl bg-muted/50 p-3 text-xs leading-6 whitespace-pre-wrap" dir="auto">{test.sample}</pre>}
              </article>
            )
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={onSave} className="gap-2">ذخیره تنظیمات هوش مصنوعی</Button>
          {message && <p className="text-sm font-medium text-success">{message}</p>}
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold">پرامپت‌های تکمیلی سایت</h2>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">
            این متن‌ها به درخواست همان بخش اضافه می‌شوند. اگر خالی باشند، فقط پرامپت تولیدشده توسط سایت یا متن کاربر ارسال می‌شود.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {promptFields.map(([key, label, hint]) => (
            <label key={key} className="grid gap-2">
              <span className="text-sm font-bold">{label}</span>
              <textarea
                value={settings.promptSettings?.[key] || ''}
                onChange={event => updatePromptSetting(key, event.target.value)}
                placeholder={hint}
                className="min-h-24 w-full rounded-xl border border-input bg-background/75 p-3 text-sm leading-7 outline-none focus:border-primary"
                dir="auto"
              />
              <small className="text-xs text-muted-foreground">{hint}</small>
            </label>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-bold">فرمول کسر کردیت</h2>
        <div className="space-y-2 text-sm leading-7 text-muted-foreground">
          <p>۱. هزینه واقعی دلاری بر اساس توکن ورودی، توکن خروجی یا تولید تصویر محاسبه می‌شود.</p>
          <p>۲. مبلغ قابل کسر = هزینه واقعی × {settings.chargeMultiplier.toLocaleString('fa-IR')} × {settings.usdToToman.toLocaleString('fa-IR')} تومان.</p>
          <p>۳. مبلغ تومانی با تنظیمات مالی فعلی به کردیت تبدیل می‌شود: ۱ کردیت = {CREDIT_VALUE_TOMAN.toLocaleString('fa-IR')} تومان.</p>
        </div>
      </section>
    </div>
  )
}
