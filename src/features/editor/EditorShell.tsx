import type { CSSProperties, ReactNode } from 'react'
import {
  BookOpen,
  Box,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  LayoutPanelLeft,
  Menu,
  Moon,
  Palette,
  PanelRight,
  Plus,
  Save,
  Settings,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EDITOR_CALLOUT_TYPES } from './data/calloutTypes'
import './editor-shell.css'

export type EditorPanelMode = 'toc' | 'add' | 'media' | 'design' | 'settings'

type EditorHeaderProps = {
  title: string
  subtitle?: string
  saving: boolean
  savedAt: Date | null
  onTitleChange: (value: string) => void
  onBack: ReactNode
  onMetadata: () => void
  onPreview: () => void
  onSave: () => void
}

export function EditorHeader({ title, subtitle, saving, savedAt, onTitleChange, onBack, onMetadata, onPreview, onSave }: EditorHeaderProps) {
  return (
    <header className="mb-editor-header">
      <div className="mb-editor-brand">
        <BookOpen />
        <strong>MetaBooki</strong>
      </div>
      <div className="mb-editor-titlebar">
        <div className="mb-editor-back">{onBack}</div>
        <input value={title} onChange={event => onTitleChange(event.target.value)} aria-label="عنوان کتاب" />
        {subtitle && <span>{subtitle}</span>}
      </div>
      <div className="mb-editor-save-state">
        <Save />
        {saving ? 'در حال ذخیره...' : savedAt ? `ذخیره شد ${savedAt.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : 'ذخیره خودکار فعال است'}
      </div>
      <div className="mb-editor-header-actions">
        <Button variant="outline" onClick={onMetadata}>مشخصات</Button>
        <Button variant="outline" onClick={onPreview}>پیش‌نمایش</Button>
        <Button onClick={onSave}>انتشار</Button>
        <button className="mb-icon-btn" title="حالت شب"><Moon /></button>
        <button className="mb-icon-btn" title="بیشتر"><Menu /></button>
      </div>
    </header>
  )
}

type EditorRailProps = {
  active: EditorPanelMode
  onChange: (mode: EditorPanelMode) => void
}

const railItems: Array<{ mode: EditorPanelMode; label: string; icon: typeof FileText }> = [
  { mode: 'toc', label: 'محتوا', icon: FileText },
  { mode: 'add', label: 'افزودن', icon: Plus },
  { mode: 'media', label: 'رسانه', icon: ImageIcon },
  { mode: 'design', label: 'طراحی', icon: Palette },
  { mode: 'settings', label: 'تنظیمات', icon: Settings },
]

export function EditorRail({ active, onChange }: EditorRailProps) {
  return (
    <nav className="mb-editor-rail" aria-label="ناوبری ادیتور">
      {railItems.map(item => {
        const Icon = item.icon
        return (
          <button key={item.mode} className={active === item.mode ? 'is-active' : ''} onClick={() => onChange(item.mode)} title={item.label}>
            <Icon />
            <span>{item.label}</span>
          </button>
        )
      })}
      <button className="mt-auto" title="راهنما"><HelpCircle /><span>راهنما</span></button>
    </nav>
  )
}

type EditorToolbarFrameProps = {
  children: ReactNode
}

export function EditorToolbarFrame({ children }: EditorToolbarFrameProps) {
  return <div className="mb-editor-toolbar-frame">{children}</div>
}

type EditorWorkspaceProps = {
  rail: ReactNode
  leftPanel: ReactNode
  canvas: ReactNode
  inspector: ReactNode
}

export function EditorWorkspace({ rail, leftPanel, canvas, inspector }: EditorWorkspaceProps) {
  return (
    <section className="mb-editor-workspace">
      {rail}
      {leftPanel}
      <main className="mb-editor-canvas">{canvas}</main>
      {inspector}
    </section>
  )
}

type EditorPanelProps = {
  title: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function EditorPanel({ title, icon, actions, children }: EditorPanelProps) {
  return (
    <aside className="mb-editor-panel">
      <header>
        <h2>{icon}{title}</h2>
        {actions}
      </header>
      {children}
    </aside>
  )
}

type AddBlockPanelProps = {
  onAddImage: () => void
  onShowMedia: () => void
  onAddCallout: (type: string) => void
  onAddInteractive: (kind: string) => void
  onAddTable: () => void
  onAddPage: () => void
}

export function AddBlockPanel({ onAddImage, onShowMedia, onAddCallout, onAddInteractive, onAddTable, onAddPage }: AddBlockPanelProps) {
  return (
    <div className="mb-add-block-panel">
      <label className="mb-search-label">
        <span>جستجوی بلوک‌ها...</span>
        <input aria-label="جستجوی بلوک" />
      </label>
      <section>
        <h3>متن</h3>
        <div className="mb-block-grid">
          <button onClick={() => onAddCallout('key')}><FileText /> متن</button>
          <button onClick={() => onAddCallout('quote')}><Box /> نقل‌قول</button>
          <button onClick={onAddPage}><LayoutPanelLeft /> صفحه جدید</button>
          <button onClick={onAddTable}><PanelRight /> جدول</button>
        </div>
      </section>
      <section>
        <h3>کال‌اوت</h3>
        <div className="mb-callout-palette">
          {EDITOR_CALLOUT_TYPES.map(item => {
            const Icon = item.Icon
            return <button key={item.value} style={{ '--accent': item.accent } as CSSProperties} onClick={() => onAddCallout(item.value)}><Icon /><span>{item.label}</span></button>
          })}
        </div>
      </section>
      <section>
        <h3>رسانه و تعامل</h3>
        <div className="mb-block-grid">
          <button onClick={onAddImage}><ImageIcon /> تصویر</button>
          <button onClick={onShowMedia}><UploadCloud /> کتابخانه</button>
          <button onClick={() => onAddInteractive('quiz')}><Sparkles /> کوییز</button>
          <button onClick={() => onAddInteractive('timeline')}><Sparkles /> تایم‌لاین</button>
        </div>
      </section>
    </div>
  )
}

type BlockSettingsPanelProps = {
  blockLabel: string
  language: string
  direction: string
  onDirection: (dir: 'rtl' | 'ltr') => void
  onShowMedia: () => void
}

export function BlockSettingsPanel({ blockLabel, language, direction, onDirection, onShowMedia }: BlockSettingsPanelProps) {
  return (
    <aside className="mb-editor-inspector">
      <header>
        <button className="is-active">بلوک</button>
        <button>سند</button>
      </header>
      <section>
        <h2>{blockLabel}</h2>
        <p>تنظیمات بلوک انتخاب‌شده از همین‌جا کنترل می‌شود.</p>
      </section>
      <section>
        <h3>زبان و جهت</h3>
        <div className="mb-segmented">
          <button className={direction === 'rtl' ? 'is-active' : ''} onClick={() => onDirection('rtl')}>RTL ←</button>
          <button className={direction === 'ltr' ? 'is-active' : ''} onClick={() => onDirection('ltr')}>LTR →</button>
        </div>
        <small>زبان فعلی: {language}</small>
      </section>
      <section>
        <h3>رسانه</h3>
        <button className="mb-wide-action" onClick={onShowMedia}><ImageIcon /> نمایش تصاویر کتاب</button>
      </section>
      <section>
        <h3>AI Assistant</h3>
        <button className="mb-wide-action"><Sparkles /> پیشنهاد کال‌اوت مناسب</button>
        <button className="mb-wide-action"><Sparkles /> ساده‌سازی متن انتخاب‌شده</button>
      </section>
    </aside>
  )
}

type EditorStatusBarProps = {
  wordCount: number
  language: string
  blockLabel: string
  zoom: number
  savedAt: Date | null
  saving: boolean
}

export function EditorStatusBar({ wordCount, language, blockLabel, zoom, savedAt, saving }: EditorStatusBarProps) {
  return (
    <footer className="mb-editor-status">
      <span>{wordCount.toLocaleString('fa-IR')} کلمه</span>
      <span>{language}</span>
      <span>{blockLabel}</span>
      <span>{zoom.toLocaleString('fa-IR')}%</span>
      <span>{saving ? 'در حال ذخیره' : savedAt ? 'همه تغییرات ذخیره شد' : 'ذخیره خودکار فعال'}</span>
    </footer>
  )
}
