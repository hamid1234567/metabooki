# Cardiac Cycle — برنامه جامع سیستم مدیریت مطب قلب کودکان

> **نسخه**: ۱.۰  
> **تاریخ**: ۱۴۰۵/۰۴/۰۱  
> **وضعیت**: تأیید اولیه، آماده اجرا

---

## فهرست مطالب
1. [معماری کلی سیستم](#1-معماری-کلی-سیستم)
2. [مدل دیتابیس کامل](#2-مدل-دیتابیس-کامل)
3. [ساختار چندمطبعه‌ای (Multi-Tenant)](#3-ساختار-چندمطبعه‌ای-multi-tenant)
4. [فرم اکوکاردیوگرافی کودکان (۵۰۰+ متغیر)](#4-فرم-اکوکاردیوگرافی-کودکان-۵۰۰-متغیر)
5. [Segmental Approach (Van Praagh)](#5-segmental-approach-van-praagh)
6. [فرم آنژیوگرافی کودکان](#6-فرم-آنژیوگرافی-کودکان)
7. [کدینگ استاندارد (ICD-10-CM / SNOMED CT)](#7-کدینگ-استاندارد-icd-10-cm--snomed-ct)
8. [AI Diagnosis Suggester](#8-ai-diagnosis-suggester)
9. [Clinical Decision Support (دارو + درمان)](#9-clinical-decision-support-دارو--درمان)
10. [خروجی گزارش‌ها (PDF + خلاصه)](#10-خروجی-گزارش‌ها-pdf--خلاصه)
11. [Reference Library & Guidelines](#11-reference-library--guidelines)
12. [قابلیت‌های پژوهشی](#12-قابلیت‌های-پژوهشی)
13. [Admin Panel](#13-admin-panel)
14. [UI/UX Design](#14-uiux-design)
15. [تکنولوژی‌ها و Stack](#15-تکنولوژی‌ها-و-stack)
16. [برنامه اجرایی فازبندی](#16-برنامه-اجرایی-فازبندی)
17. [فایل‌ها و مسیرهای پروژه](#17-فایل‌ها-و-مسیرهای-پروژه)

---

## ۱. معماری کلی سیستم

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Cardiac Cycle System                         │
├──────────────────┬──────────────────┬───────────────────────────────┤
│   Frontend       │    Gateway       │         Backend                │
│   React + Vite   │   Node/Express   │      Python FastAPI            │
│   (پورت ۳۰۰۰)     │   (اختیاری)      │      (پورت ۸۰۰۰)              │
├──────────────────┴──────────────────┴───────────────────────────────┤
│                          PostgreSQL 16                                │
│                    (JSONB + GIN Index + Full-Text Search)             │
├──────────────────────────────────────────────────────────────────────┤
│    MinIO (S3)        │    Redis         │    Celery Worker             │
│   (تصاویر/فایل‌ها)   │   (کش/صف)        │   (PDF/AI پس‌زمینه)         │
└──────────────────────────────────────────────────────────────────────┘
```

### لایه‌های معماری

1. **Presentation Layer**: React 18 + Vite + MUI 5 + Tailwind
2. **API Gateway** (اختیاری): Node.js/Express برای ریت لیمیتینگ و routing
3. **Business Logic**: Python FastAPI با SQLAlchemy 2.0
4. **Data Layer**: PostgreSQL 16 با JSONB و GIN Index
5. **Storage**: MinIO برای تصاویر اکو، آنژیو، اسکن‌ها
6. **Async Tasks**: Celery + Redis برای تولید PDF و پردازش AI
7. **AI**: OpenAI API + LangChain + Pattern Matching Engine

---

## ۲. مدل دیتابیس کامل

### ۲.۱. Core Schema (هسته اصلی)

```sql
-- ============================================
-- ORGANIZATIONS & CLINICS (Multi-Tenant Core)
-- ============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_fa VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    slug VARCHAR(100) UNIQUE NOT NULL,
    license_type VARCHAR(50) DEFAULT 'basic',
    settings_json JSONB DEFAULT '{}',
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name_fa VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    slug VARCHAR(100) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    settings_json JSONB DEFAULT '{}',
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS & ROLES (RBAC)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE,
    national_code VARCHAR(20) UNIQUE,
    first_name_fa VARCHAR(100),
    last_name_fa VARCHAR(100),
    first_name_en VARCHAR(100),
    last_name_en VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    medical_license_number VARCHAR(50), -- شماره نظام پزشکی
    specialty VARCHAR(100), -- فوق تخصص قلب کودکان, ...
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_fa VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    is_system_role BOOLEAN DEFAULT false,
    organization_id UUID REFERENCES organizations(id),
    description TEXT
);

-- نقش‌های سیستمی پیش‌فرض
INSERT INTO roles (name_fa, name_en, is_system_role) VALUES
('مدیر ارشد سیستم', 'SuperAdmin', true),
('مدیر سازمان', 'OrgAdmin', true),
('مدیر مطب', 'ClinicAdmin', true),
('پزشک', 'Doctor', true),
('منشی', 'Secretary', true),
('پرستار', 'Nurse', true),
('دستیار', 'Assistant', true),
('محقق', 'Researcher', true);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key VARCHAR(100) UNIQUE NOT NULL,
    name_fa VARCHAR(255),
    module VARCHAR(50), -- patients, echo, angio, ecg, medications, reports, admin
    action VARCHAR(50), -- view, create, edit, delete, approve, export
    description TEXT
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_clinic_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, clinic_id, role_id)
);

-- ============================================
-- PATIENTS
-- ============================================
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id),
    created_by UUID REFERENCES users(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    national_code VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    blood_type VARCHAR(5),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    insurance_type VARCHAR(100),
    insurance_code VARCHAR(100),
    referring_physician VARCHAR(200),
    notes TEXT,
    is_deceased BOOLEAN DEFAULT false,
    death_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_national_code ON patients(national_code);
CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_patients_name_search ON patients 
    USING GIN (to_tsvector('simple', first_name || ' ' || last_name));

-- ============================================
-- VISITS (ویزیت‌ها)
-- ============================================
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id),
    doctor_id UUID REFERENCES users(id),
    visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    visit_type VARCHAR(50) CHECK (visit_type IN ('new', 'followup', 'emergency', 'post_op', 'telemedicine')),
    chief_complaint TEXT, -- شکایت اصلی
    history_of_present_illness TEXT, -- شرح حال
    physical_exam JSONB, -- معاینات فیزیکی
    vital_signs JSONB, -- علائم حیاتی
    assessment TEXT,
    plan TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLINICAL DOCUMENTS
-- ============================================
CREATE TABLE clinical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id),
    clinic_id UUID REFERENCES clinics(id),
    document_type VARCHAR(50) CHECK (document_type IN ('echo', 'angio', 'ecg', 'holter', 'mri', 'lab', 'other')),
    title VARCHAR(255),
    document_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'reviewed', 'approved', 'rejected')),
    operator_id UUID REFERENCES users(id),
    reviewer_id UUID REFERENCES users(id),
    data JSONB, -- محتوای اصلی (برای اکو ۵۰۰+ فیلد)
    summary TEXT,
    ai_suggestions JSONB, -- پیشنهادات AI
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clinical_docs_patient ON clinical_documents(patient_id);
CREATE INDEX idx_clinical_docs_type ON clinical_documents(document_type);
CREATE INDEX idx_clinical_docs_data_gin ON clinical_documents USING GIN (data jsonb_path_ops);

-- ============================================
-- ECHOCARDIOGRAPHY (جداول اختصاصی اکو)
-- ============================================
CREATE TABLE echo_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_fa VARCHAR(255),
    name_en VARCHAR(255),
    description TEXT,
    category VARCHAR(50) DEFAULT 'pediatric' CHECK (category IN ('pediatric', 'neonatal', 'fetal', 'adult')),
    is_default BOOLEAN DEFAULT false,
    clinic_id UUID REFERENCES clinics(id),
    module_config JSONB NOT NULL, -- تعریف ماژول‌ها و فیلدها
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE echo_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES clinical_documents(id) ON DELETE CASCADE UNIQUE,
    template_id UUID REFERENCES echo_templates(id),
    -- Segmental Approach (هر ۵ گام)
    segmental_atrial_situs VARCHAR(50), -- solitus, inversus, ambiguous
    segmental_av_connection VARCHAR(50), -- concordant, discordant, etc
    segmental_ventricular_looping VARCHAR(50), -- d_loop, l_loop
    segmental_va_connection VARCHAR(50), -- concordant, discordant, dorv, etc
    segmental_conclusion TEXT, -- خلاصه سگمنتال
    -- Z-Scores storage
    z_scores JSONB, -- { "lv_edd": { "value": 38, "z_score": 1.2, "mean": 32, "std": 5, "bsa": 0.7 }, ... }
    -- خلاصه
    interpretation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANGIOGRAPHY
-- ============================================
CREATE TABLE angiography_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES clinical_documents(id) ON DELETE CASCADE UNIQUE,
    catheterization_date TIMESTAMPTZ,
    -- Hemodynamics
    hemodynamics JSONB, -- { pressures: {}, saturations: {}, calculations: { qp_qs, pvr, svr } }
    -- Injections
    injections JSONB, -- [{ site, view, contrast_volume, findings, image_refs }]
    -- Coronary anatomy
    coronary_anatomy JSONB,
    -- Interventions
    interventions JSONB, -- [{ type, vessel, pre_diameter, post_diameter, ... }]
    -- AI analysis
    ai_analysis JSONB,
    conclusion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ECG
-- ============================================
CREATE TABLE ecg_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES clinical_documents(id) ON DELETE CASCADE UNIQUE,
    machine_type VARCHAR(100),
    ecg_file_url TEXT, -- فایل تصویر یا PDF نوار
    parameters JSONB, -- { heart_rate, pr_interval, qrs_duration, qtc, axis, ... }
    interpretation TEXT,
    ai_interpretation JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEDICATIONS
-- ============================================
CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_fa VARCHAR(255),
    name_en VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    category VARCHAR(100), -- ACEi, BB, Diuretic, Anticoagulant, Antiarrhythmic, etc
    unit VARCHAR(50), -- mg, mcg, mg/kg
    forms JSONB, -- ["tablet", "syrup", "injection", "suspension"]
    pediatric_safe BOOLEAN DEFAULT false,
    min_age_months INT,
    max_daily_dose_mg_per_kg DECIMAL
);

CREATE TABLE patient_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    medication_id UUID REFERENCES medications(id),
    visit_id UUID REFERENCES visits(id),
    prescribed_by UUID REFERENCES users(id),
    dose_mg_per_kg DECIMAL,
    dose_mg DECIMAL,
    frequency VARCHAR(50), -- q12h, q8h, qd, bid, tid
    route VARCHAR(50), -- oral, IV, IM, sublingual
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DIAGNOSES (ICD-10-CM / SNOMED CT)
-- ============================================
CREATE TABLE standard_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_system VARCHAR(20) CHECK (code_system IN ('ICD-10-CM', 'SNOMED-CT')),
    code VARCHAR(20) NOT NULL,
    parent_code VARCHAR(20),
    label_fa TEXT NOT NULL,
    label_en TEXT NOT NULL,
    category VARCHAR(50),
    metadata JSONB, -- synonyms, criteria, management_guidelines
    is_active BOOLEAN DEFAULT true,
    UNIQUE(code_system, code)
);

CREATE INDEX idx_codes_search ON standard_codes 
    USING GIN (to_tsvector('simple', label_fa || ' ' || label_en || ' ' || code));
CREATE INDEX idx_codes_parent ON standard_codes(parent_code);

CREATE TABLE diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    code_id UUID REFERENCES standard_codes(id),
    visit_id UUID REFERENCES visits(id),
    echo_id UUID REFERENCES echo_studies(id),
    angio_id UUID REFERENCES angiography_studies(id),
    diagnosis_type VARCHAR(20) CHECK (diagnosis_type IN ('primary', 'secondary', 'associated', 'rule_out')),
    is_confirmed BOOLEAN DEFAULT false,
    is_suggested_by_ai BOOLEAN DEFAULT false,
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RESEARCH MODULE
-- ============================================
CREATE TABLE research_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_fa TEXT NOT NULL,
    title_en TEXT,
    description TEXT,
    lead_researcher_id UUID REFERENCES users(id),
    lead_clinic_id UUID REFERENCES clinics(id),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'recruiting', 'active', 'completed', 'cancelled')),
    ethics_approval_doc TEXT,
    start_date DATE,
    end_date DATE,
    inclusion_criteria JSONB,
    exclusion_criteria JSONB,
    required_fields JSONB,
    is_multi_center BOOLEAN DEFAULT false,
    is_anonymized BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE research_project_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id),
    assigned_researcher_id UUID REFERENCES users(id),
    target_patients INT DEFAULT 0,
    recruited_patients INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'invited',
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE research_project_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id),
    clinic_id UUID REFERENCES clinics(id),
    enrolled_by UUID REFERENCES users(id),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    consent_id UUID,
    is_anonymized BOOLEAN DEFAULT false,
    encoded_patient_ref VARCHAR(100) UNIQUE
);

CREATE TABLE research_data_exchange_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES research_projects(id),
    source_clinic_id UUID REFERENCES clinics(id),
    target_clinic_id UUID REFERENCES clinics(id),
    patient_ref VARCHAR(100),
    data_schema_version VARCHAR(20),
    exchanged_at TIMESTAMPTZ DEFAULT NOW(),
    access_log JSONB
);

-- ============================================
-- CLINICAL REFERENCES
-- ============================================
CREATE TABLE clinical_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_fa TEXT,
    title_en TEXT NOT NULL,
    source VARCHAR(50) CHECK (source IN ('AHA', 'ACC', 'ESC', 'AAP', 'NEJM', 'JACC', 'Circulation', 'Uptodate', 'Other')),
    category VARCHAR(50) CHECK (category IN ('guideline', 'trial', 'review', 'drug_info', 'textbook')),
    related_diagnoses UUID[],
    summary_fa TEXT,
    url TEXT,
    pdf_document TEXT,
    tags TEXT[],
    is_free_full_text BOOLEAN DEFAULT false,
    published_year INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOM FIELDS (Dynamic Forms)
-- ============================================
CREATE TABLE custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- echo, angio, ecg, physical_exam
    field_key VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) CHECK (field_type IN ('text', 'number', 'select', 'multi_select', 'date', 'boolean', 'json', 'range')),
    label_fa VARCHAR(255) NOT NULL,
    label_en VARCHAR(255),
    options_json JSONB, -- برای select, multi_select
    default_value JSONB,
    is_required BOOLEAN DEFAULT false,
    validation_json JSONB,
    ai_suggestion_enabled BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(clinic_id, category, field_key)
);

-- ============================================
-- PATIENT SHARING (Cross-Clinic)
-- ============================================
CREATE TABLE patient_sharing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    source_clinic_id UUID REFERENCES clinics(id),
    target_clinic_id UUID REFERENCES clinics(id),
    shared_by UUID REFERENCES users(id),
    consent_type VARCHAR(50) DEFAULT 'research' CHECK (consent_type IN ('research', 'referral', 'emergency')),
    consent_doc_url TEXT,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ۳. ساختار چندمطبعه‌ای (Multi-Tenant)

### سلسله‌مراتب

```
Organization (سازمان)
  └── Clinics (مطب‌ها/بیمارستان‌ها)
        ├── Users (کاربران با نقش‌های مختلف)
        ├── Patients (بیماران اختصاصی مطب)
        ├── Appointments (نوبت‌ها)
        ├── Clinical Data (اکو، آنژیو، ...)
        └── Custom Fields (فیلدهای سفارشی مطب)
```

### اصول جداسازی داده

۱. **هر بیمار به یک کلینیک تعلق دارد** (creator_clinic_id)
۲. **داده‌های بالینی (اکو، آنژیو، ...) به clinic_id مقید هستند**
۳. **کاربران می‌توانند در چند کلینیک نقش داشته باشند** از طریق `user_clinic_roles`
۴. **اشتراک‌گذاری بین کلینیکی** از طریق `patient_sharing` با رضایت‌نامه
۵. **SuperAdmin** کل سیستم را می‌بیند. **OrgAdmin** سازمان خود را. **ClinicAdmin** مطب خود را.

### دسترسی‌های دقیق (Permission Keys)

| Permission Key | توضیح |
|----------------|-------|
| `patients.view` | مشاهده بیماران |
| `patients.create` | ثبت بیمار جدید |
| `patients.edit` | ویرایش اطلاعات بیمار |
| `patients.delete` | حذف بیمار |
| `patients.export` | خروجی گرفتن از اطلاعات بیمار |
| `patients.share` | اشتراک‌گذاری بیمار با کلینیک دیگر |
| `echo.view` | مشاهده اکوها |
| `echo.create` | ثبت اکو جدید |
| `echo.edit` | ویرایش اکو |
| `echo.approve` | تأیید نهایی اکو |
| `echo.delete` | حذف اکو |
| `echo.export_pdf` | خروجی PDF از اکو |
| `angio.view` | مشاهده آنژیوگرافی |
| `angio.create` | ثبت آنژیوگرافی |
| `angio.edit` | ویرایش آنژیوگرافی |
| `angio.approve` | تأیید نهایی آنژیوگرافی |
| `ecg.view` | مشاهده نوار قلب |
| `ecg.create` | ثبت نوار قلب |
| `medications.prescribe` | تجویز دارو |
| `medications.view` | مشاهده داروها |
| `reports.view` | مشاهده گزارش‌ها |
| `reports.export` | خروجی گزارش |
| `research.view` | مشاهده بخش پژوهش |
| `research.create_project` | ایجاد طرح پژوهشی |
| `research.participate` | مشارکت در طرح پژوهشی |
| `admin.users` | مدیریت کاربران |
| `admin.clinics` | مدیریت مطب‌ها |
| `admin.roles` | مدیریت نقش‌ها |
| `admin.settings` | تنظیمات سیستم |
| `admin.custom_fields` | مدیریت فیلدهای سفارشی |

---

## ۴. فرم اکوکاردیوگرافی کودکان (۵۰۰+ متغیر)

### ساختار ماژولار

فرم اکو از **ماژول‌های مجزا** تشکیل شده که هر کدام گروهی از فیلدهای مرتبط را شامل می‌شوند:

```typescript
interface EchoTemplate {
  id: string;
  name_fa: string;
  category: 'pediatric' | 'neonatal' | 'fetal';
  modules: EchoModule[];
}

interface EchoModule {
  id: string;
  title_fa: string;
  icon: string; // آیکون ماژول
  fields: EchoField[];
  is_segmental: boolean; // آیا این ماژول بخشی از Segmental Approach است؟
  order: number;
}

interface EchoField {
  key: string;
  label_fa: string;
  label_en: string;
  type: 'number' | 'select' | 'multi_select' | 'boolean' | 'text' | 'range' | 'z_score' | 'percentile';
  unit?: string;
  normal_range?: { min: number; max: number; };
  z_score_formula?: string; // نام فرمول محاسبه Z-Score
  options?: { value: string; label_fa: string; }[];
  is_required: boolean;
  validation?: { min?: number; max?: number; pattern?: string; };
  ai_suggestion: boolean; // AI پیشنهاد دهد؟
  conditional_on?: { field: string; value: string; }; // فقط در صورت شرط نمایش
}
```

### ماژول‌های استاندارد اکو کودکان

| # | ماژول | فیلدها | توضیح |
|---|-------|--------|-------|
| ۰ | **Patient Info** | ۱۰ | BSA, HR, BP, Height, Weight, Age |
| ۱ | **Segmental Approach** | ۵۰+ | Situs, AV Connection, Looping, VA Connection, Anomalies |
| ۲ | **LV (M-Mode & 2D)** | ۳۵ | EDD, ESD, IVS, LVPW, Mass, Volume |
| ۳ | **LV Systolic Function** | ۲۰ | EF (Biplane), FS, LVOT VTI, dP/dt |
| ۴ | **LV Diastolic Function** | ۲۵ | E, A, E/A, E', E/E', DT, PV flow |
| ۵ | **RV** | ۳۰ | Basal diameter, Area, TAPSE, FAC, S', RIMP |
| ۶ | **LA** | ۱۵ | Diameter, Area, Volume, LAA |
| ۷ | **RA** | ۱۰ | Area, Pressure estimation |
| ۸ | **Mitral Valve** | ۳۰ | Morphology, Stenosis, Regurgitation, Prolapse |
| ۹ | **Aortic Valve** | ۳۰ | Cusps, Stenosis, Regurgitation, Bicuspid |
| ۱۰ | **Tricuspid Valve** | ۲۵ | Morphology, Stenosis, Regurgitation, Ebstein |
| ۱۱ | **Pulmonary Valve** | ۲۵ | Morphology, Stenosis, Regurgitation, Dysplasia |
| ۱۲ | **Aorta** | ۲۰ | Root, Ascending, Arch, Isthmus, Coarctation |
| ۱۳ | **Pulmonary Arteries** | ۱۵ | Main, RPA, LPA, Confluence, Branch stenosis |
| ۱۴ | **Pulmonary Veins** | ۱۰ | Connection, Stenosis, TAPVC |
| ۱۵ | **Coronary Arteries** | ۱۵ | Origin, Course, ALCAPA, Fistula |
| ۱۶ | **Septum** | ۳۰ | VSD, ASD, AVSD, type, size, shunt |
| ۱۷ | **Congenital Anomalies** | ۵۰ | TOF, TGA, DORV, Truncus, HLHS, etc |
| ۱۸ | **Doppler (PW/CW)** | ۴۰ | Velocities, Gradients, Valve areas |
| ۱۹ | **Color Doppler** | ۱۵ | Regurgitation jets, Shunt jets |
| ۲۰ | **TEE** | ۲۰ | Transesophageal views |
| ۲۱ | **3D Echo** | ۱۵ | Volumes, Valve morphology |
| ۲۲ | **Strain/Strain Rate** | ۲۵ | GLS, GRS, Segmental strain |
| ۲۳ | **Stress Echo** | ۲۰ | Wall motion, Dobutamine, Exercise |
| ۲۴ | **Post-Op Evaluation** | ۳۰ | Fontan, Glenn, Switch, RVOT patch, etc |
| | **مجموع** | **~۵۵۰+** | |

### Z-Score Calculator

محاسبه خودکار Z-Score برای تمام اندازه‌های کودکان:

```python
Z_SCORE_FORMULAS = {
    'lv_edd': {
        'params': {'bsa': 'bsa'},
        'formula': 'mean = 1.02 + 3.14 * bsa - 0.47 * bsa**2; std = 0.18 + 0.04 * bsa',
        'unit': 'mm'
    },
    'lv_esd': {
        'params': {'bsa': 'bsa'},
        'formula': 'mean = 0.65 + 2.18 * bsa - 0.32 * bsa**2; std = 0.12 + 0.03 * bsa',
        'unit': 'mm'
    },
    'rv_basal_diameter': {
        'params': {'bsa': 'bsa'},
        'formula': 'mean = 9 + 15 * bsa; std = 3 + 2 * bsa',
        'unit': 'mm'
    },
    'la_volume_index': {
        'params': {},
        'formula': 'mean = 22; std = 6',
        'unit': 'ml/m²'
    },
    'aortic_root': {
        'params': {'bsa': 'bsa'},
        'formula': 'mean = 6 + 10 * bsa; std = 1.5 + 1.5 * bsa',
        'unit': 'mm'
    },
    'main_pa': {
        'params': {'bsa': 'bsa'},
        'formula': 'mean = 5 + 8 * bsa; std = 1.2 + 1.5 * bsa',
        'unit': 'mm'
    },
}
```

Z-Score در سه رنگ نمایش داده می‌شود:
- **سبز**: -۲ ≤ Z ≤ +۲ (نرمال)
- **زرد**: -۳ ≤ Z < -۲ یا +۲ < Z ≤ +۳ (مرزی)
- **قرمز**: Z < -۳ یا Z > +۳ (غیرطبیعی)

---

## ۵. Segmental Approach (Van Praagh)

### گام‌های ۵‌گانه - ویزارد گرافیکی

```
گام ۱: تعیین موقعیت احشا و دهلیزها
گام ۲: تعیین اتصال دهلیزی-بطنی (AV Connection)
گام ۳: تعیین لوپینگ بطنی
گام ۴: تعیین اتصال بطنی-شریانی (VA Connection)
گام ۵: آنومالی‌های همراه و تشخیص نهایی
```

### گام ۱: Atrial Situs

فیلدهای تعیین‌کننده:
```
Atrial Situs:
  ○ Situs Solitus (S)
  ○ Situs Inversus (I)
  ○ Situs Ambiguus (A)
      └─ Right Isomerism
      └─ Left Isomerism

Bronchial Pattern:
  ○ Normal (Right longer, Left shorter)
  ○ Inverted
  ○ Right Isomerism (both long)
  ○ Left Isomerism (both short)

Abdominal Situs:
  ○ Normal (Stomach Left, Liver Right)
  ○ Inverted (Stomach Right, Liver Left)
  ○ Heterotaxy

AI Suggestion: بر اساس موقعیت اندام‌ها، پیشنهاد می‌دهد
```

### گام ۲: AV Connection

```
AV Connection:
  ○ Concordant (RA→RV, LA→LV) ← نرمال
  ○ Discordant (RA→LV, LA→RV)
  ○ Ambiguous (Heterotaxy)
  ○ Univentricular
      ├─ Double Inlet LV
      ├─ Double Inlet RV
      └─ Common Inlet (Single Ventricle)
  
AI Suggestion: بر اساس morphology دریچه‌ها
```

### گام ۳: Ventricular Looping

```
Looping:
  ○ D-Loop (RV right of LV) ← نرمال
  ○ L-Loop (RV left of LV)
  
RV Morphology:
  ○ Coarse trabeculation, Moderator Band: ✓
LV Morphology:
  ○ Fine trabeculation, Smooth septum
```

### گام ۴: VA Connection

```
VA Connection:
  ○ Concordant (RV→PA, LV→Ao) ← نرمال
  ○ Discordant (RV→Ao, LV→PA) = TGA
  ○ Double Outlet RV (DORV)
  ○ Double Outlet LV (DOLV)
  ○ Single Outlet
      ├─ Truncus Arteriosus
      └─ Single Ao with PA Atresia

Great Arteries Relationship:
  ○ Normal (Ao posterior-right, PA anterior-left)
  ○ D-Malposition (Ao anterior-right)
  ○ L-Malposition (Ao anterior-left)
  ○ Side-by-Side
```

### گام ۵: تشخیص نهایی سگمنتال

```
Diagnostic Sequence (Van Praagh Notation):
[Situs, AV Connection, VA Connection] + Associated Anomalies
مثال: {S,D,S} + VSD (perimembranous) + PDA

خروجی نهایی:
"Situs solitus, AV concordant, D-looping, VA concordant with 
 perimembranous VSD (8mm) and small PDA"
```

### نمایش شماتیک قلب

بعد از تکمیل Segmental Approach، یک نمودار SVG تعاملی از قلب با وضعیت فعلی نمایش داده می‌شود:
- رنگ‌گذاری: خون اکسیژن‌دار (قرمز)، بدون اکسیژن (آبی)، مخلوط (بنفش)
- شانت‌ها با فلش نشان داده می‌شوند
- تنگی‌ها با علامت تنگی مشخص می‌شوند

---

## ۶. فرم آنژیوگرافی کودکان

### ماژول‌های آنژیوگرافی

| ماژول | توضیح |
|-------|-------|
| **شروع کاتتریسم** | تاریخ، پزشک، روش دسترسی (Femoral, Jugular, Radial) |
| **همودینامیک** | فشارها و اشباع‌ها در تمام اتاقک‌ها |
| **محاسبات** | Qp/Qs, PVR, SVR, AVO₂ Diff, شانت‌ها |
| **OXimetry Run** | سری کامل اشباع از SVC تا PA |
| **اینفلیوشن‌ها** | محل، نمای، حجم کنتراست، یافته‌ها |
| **آناتومی کورونری** | Dominance, Anomalies, Origin |
| **اینترونشن‌ها** | Balloon, Stent, Coil, Valvuloplasty, Septostomy |
| **عوارض** | عوارض حین و بعد از پروسیجر |
| **نتیجه** | خلاصه و توصیه‌ها |

### فرمول‌های همودینامیک

```python
# Qp/Qs (Shunt Ratio)
Qp_Qs = (Ao_Sat - MV_Sat) / (PV_Sat - PA_Sat)
# نرمال: ~۱.۰
# L→R shunt: >۱.۵
# R→L shunt: <۱.۰

# PVR (Pulmonary Vascular Resistance) - Wood Units
PVR = (mean_PA - PCWP) / Qp  # Wood Units
# نرمال: <۳
# Mild PHTN: ۳-۵
# Moderate: ۵-۸
# Severe: >۸

# SVR (Systemic Vascular Resistance)
SVR = (mean_Ao - RA) / Qs

# Valve Area (Gorlin Formula)
Ao_Valve_Area = SV / (44.3 * sqrt(mean_Gradient))
```

### AI در آنژیوگرافی

```
💡 AI Insights در آنژیوگرافی:

۱. Oximetry Analysis:
   "Step-up در RV → LV indicates VSD با شانت چپ به راست"
   "Qp/Qs = 2.1 → شانت قابل توجه"

۲. Pressure Analysis:
   "RVSP = 65 mmHg → تخمین PHTN، بررسی PVR ضروری است"

۳. پیشنهاد سایز Balloon/Stent:
   "بر اساس آناتومی، بالن ۱۸mm توصیه می‌شود"
   "Stent 36mm×10mm مناسب به نظر می‌رسد"

۴. تشخیص آنومالی:
   "کورونری چپ از سینوس راست منشأ گرفته (Anomalous origin)"
```

---

## ۷. کدینگ استاندارد (ICD-10-CM / SNOMED CT)

### دسته‌بندی کدهای مادرزادی قلب (CHD)

| ICD-10-CM | SNOMED CT | نام فارسی | گروه |
|-----------|-----------|-----------|------|
| Q20.0 | 204306003 | Common truncus arteriosus | Conotruncal |
| Q20.1 | 253545001 | D-TGA (Complete) | Conotruncal |
| Q20.3 | 373360003 | Discordant AV connection | AV Connection |
| Q20.5 | 204286000 | AVSD (complete/incomplete) | Septal |
| Q21.0 | 72955002 | VSD | Septal |
| Q21.1 | 253545001 | ASD Secundum | Septal |
| Q21.2 | 86299006 | AVSD | Septal |
| Q21.3 | 86299006 | Tetralogy of Fallot (TOF) | Conotruncal |
| Q21.4 | 204306003 | DORV | Conotruncal |
| Q22.0 | 49816008 | Pulmonary valve atresia | RVOT |
| Q22.1 | 49816008 | Pulmonary valve stenosis | RVOT |
| Q22.5 | 49816008 | Ebstein anomaly | TV |
| Q23.0 | 204286000 | Congenital aortic stenosis | LVOT |
| Q23.1 | 204286000 | Bicuspid aortic valve | LVOT |
| Q23.2 | 204286000 | Mitral stenosis congenital | MV |
| Q24.0 | 373360003 | Dextrocardia | Positional |
| Q24.1 | 373360003 | Levocardia | Positional |
| Q24.2 | 373360003 | Cor triatriatum | Atrial |
| Q24.4 | 373360003 | Congenital subaortic stenosis | LVOT |
| Q25.0 | 86299006 | Patent ductus arteriosus (PDA) | Arterial |
| Q25.1 | 86299006 | Coarctation of aorta (CoA) | Arterial |
| Q25.4 | 86299006 | Anomalous pulmonary venous return | Venous |
| Q26.2 | 373360003 | TAPVC | Venous |
| Q89.3 | 204306003 | Situs inversus | Positional |

### AI Auto-Suggest Diagnosis

```python
# الگوریتم پیشنهاد تشخیص
# ۱. Feature Vector از تمام داده‌های وارد شده
# ۲. تطبیق با Patternهای شناخته شده CHD
# ۳. رتبه‌بندی بر اساس احتمال

# مثال:
Input Features:
  - Segmental: {S,D,S}
  - VSD perimembranous: 8mm
  - LV dilated (Z-score: +2.3)
  - LA dilated
  - PA pressure: 45mmHg
  - Qp/Qs: 2.1
  - No RVOT obstruction
  - PDA: closed

AI Suggestions:
  1. VSD (Q21.0) — ۹۵٪
     شواهد: perimembranous VSD + LV volume overload
  2. VSD + mild PHTN (I27.0) — ۴۰٪
     شواهد: RVSP=45mmHg
  3. VSD + AI (I35.1) — ۱۰٪
     شواهد: AR jet (اگر ثبت شود)
```

---

## ۸. AI Diagnosis Suggester

### معماری AI Engine

```
┌────────────────────────────────────────────────────────────┐
│                      AI Service Layer                        │
├────────────────────────────────────────────────────────────┤
│  1. Pattern Matching Engine  (Rule-based + ML)              │
│     └─ Knowledge Base: 100+ CHD patterns                   │
│     └─ Feature Extraction از داده‌های اکو/آنژیو             │
│     └─ Similarity Scoring                                  │
│                                                            │
│  2. LLM Integration (OpenAI / Local)                        │
│     └─ Auto-fill پیشنهادی فیلدها                           │
│     └─ تفسیر به زبان طبیعی                                  │
│     └─ خلاصه لای‌سامری (برای بیمار)                         │
│     └─ پاسخ به سوالات بالینی                                │
│                                                            │
│  3. Validation Engine                                       │
│     └─ بررسی consistency داده‌ها                             │
│     └─ هشدار مقادیر غیرطبیعی                                │
│     └─ محاسبه خودکار (Z-Score, Qp/Qs, ...)                 │
└────────────────────────────────────────────────────────────┘
```

### Medical Knowledge Base (100+ CHD Patterns)

```python
CHD_PATTERNS = {
    'VSD': {
        'segmental_required': {'atrial_situs': 'solitus', 'av_connection': 'concordant', 'va_connection': 'concordant'},
        'required_findings': ['vsd_present'],
        'supporting_findings': ['lv_dilated', 'la_dilated', 'qp_qs_gt_1.5'],
        'contradicting_findings': ['rvot_obstruction', 'pulmonary_atresia'],
        'probability_weight': 0.95
    },
    'TOF': {
        'segmental_required': {'atrial_situs': 'solitus', 'av_connection': 'concordant'},
        'required_findings': ['vsd_present', 'rvot_obstruction', 'aorta_override'],
        'supporting_findings': ['rv_hypertrophy', 'right_aortic_arch'],
        'contradicting_findings': [],
        'probability_weight': 0.95
    },
    'TGA': {
        'segmental_required': {'atrial_situs': 'solitus', 'av_connection': 'concordant', 'va_connection': 'discordant'},
        'required_findings': ['aorta_from_rv', 'pa_from_lv'],
        'supporting_findings': ['vsd_present', 'lvot_obstruction'],
        'contradicting_findings': [],
        'probability_weight': 0.98
    },
    'DORV': {
        'segmental_required': {'va_connection': 'double_outlet_rv'},
        'required_findings': ['both_great_arteries_from_rv'],
        'supporting_findings': ['vsd_present', 'sub_aortic_conus', 'pulmonary_stenosis'],
        'contradicting_findings': ['aorta_from_lv'],
        'probability_weight': 0.95
    },
    # ... 100+ more patterns
}
```

### AI Assistant در فرم‌ها

```typescript
interface AIAssistantService {
  // ۱. Auto-complete: پر کردن خودکار فیلدها
  autoComplete: {
    triggerOn: 'field_focus' | 'module_change';
    suggestions: Array<{
      fieldKey: string;
      value: any;
      confidence: number; // 0-1
      reason: string; // دلیل پیشنهاد
    }>;
  };

  // ۲. Validation هشدارهای بالینی
  clinicalWarnings: Array<{
    severity: 'info' | 'warning' | 'critical';
    message_fa: string;
    relatedFields: string[];
    guideline: string; // ارجاع به گایدلاین
  }>;

  // ۳. Interpretation تولید تفسیر
  generateEchoInterpretation: (echoData: EchoStudy) => string;
  generateAngioInterpretation: (angioData: AngioStudy) => string;

  // ۴. Measurement suggestion
  suggestMeasurement: (fieldKey: string, context: EchoContext) => number;

  // ۵. NL Query (اعمال در بخش پژوهش)
  naturalLanguageQuery: (question_fa: string) => QueryResult;
  // مثال: "بیماران با TOF که Z-Score LV > 2 دارند و سن < ۱ سال"
}
```

---

## ۹. Clinical Decision Support (دارو + درمان)

### داروهای رایج در قلب کودکان

```sql
-- نمونه داروها
INSERT INTO medications (name_fa, name_en, category, unit, pediatric_safe) VALUES
('فوروزماید', 'Furosemide', 'Diuretic', 'mg/kg', true),
('اسپیرونولاکتون', 'Spironolactone', 'Diuretic', 'mg/kg', true),
('کاپتوپریل', 'Captopril', 'ACEi', 'mg/kg', true),
('انالاپریل', 'Enalapril', 'ACEi', 'mg/kg', true),
('پروپرانولول', 'Propranolol', 'Beta Blocker', 'mg/kg', true),
('دیگوکسین', 'Digoxin', 'Inotrope', 'mcg/kg', true),
('وارفارین', 'Warfarin', 'Anticoagulant', 'mg', false),
('انوکساپارین', 'Enoxaparin', 'Anticoagulant', 'mg/kg', true),
('آسپیرین', 'Aspirin', 'Antiplatelet', 'mg/kg', true),
('ایبوپروفن', 'Ibuprofen', 'NSAID (PDA closure)', 'mg/kg', true),
('پروستاگلاندین E1', 'Alprostadil (PGE1)', 'Prostaglandin', 'mcg/kg/min', true),
('سیلدنافیل', 'Sildenafil', 'PHTN', 'mg/kg', true),
('بوزنتان', 'Bosentan', 'PHTN', 'mg/kg', false),
('آدنوزین', 'Adenosine', 'Antiarrhythmic', 'mcg/kg', true),
('آمیودارون', 'Amiodarone', 'Antiarrhythmic', 'mg/kg', true);
```

### AI توصیه‌های درمانی

```python
class ManagementSuggestor:
    def get_recommendations(self, diagnoses, patient, echo, angio):
        recs = []
        
        for dx in diagnoses:
            # VSD Management
            if dx.code == 'Q21.0':
                if echo.lv.volume_overload and patient.age_months < 12:
                    recs.append({
                        'type': 'medication',
                        'drug': 'Furosemide',
                        'dose': f"{patient.weight_kg * 1}mg q12h",
                        'guideline': 'AHA HF Guidelines §4.2',
                        'evidence': 'Class I'
                    })
                if echo.rvsp > 50 and angio.pvr > 6:
                    recs.append({
                        'type': 'referral',
                        'to': 'Pediatric Cardiac Surgery',
                        'urgency': 'elective',
                        'reason': 'Pulmonary hypertension + high PVR'
                    })
                if echo.vsd_size < 5 and not echo.lv.volume_overload:
                    recs.append({
                        'type': 'follow_up',
                        'frequency': 'yearly',
                        'note': 'Small VSD, no intervention needed'
                    })
            
            # PDA Management
            elif dx.code == 'Q25.0':
                if patient.age_days < 14 and echo.pda_size > 1.5:
                    recs.append({
                        'type': 'medication',
                        'drug': 'Ibuprofen or Indomethacin',
                        'dose': 'Per NICU protocol',
                        'guideline': 'AAP PDA Management Guideline'
                    })
                if echo.ductus.size > 3 and echo.la_ao_ratio > 1.5:
                    recs.append({
                        'type': 'procedure',
                        'procedure': 'Device closure or surgical ligation',
                        'timing': 'before 1 year'
                    })
        
        return recs
```

### Patient Education Handout (خروجی برای بیمار)

AI یک برگه راهنمای بیمار به فارسی ساده تولید می‌کند:

```
┌─────────────────────────────────────────────────┐
│           مرکز قلب و عروق دکتر ...               │
│                                                  │
│   راهنمای بیماری: VSD (سوراخ بین بطنی)          │
│   برای: [نام بیمار]                             │
│                                                  │
│   ─── بیماری چیست؟ ───                         │
│   بین دو حفره پایینی قلب فرزند شما یک سوراخ     │
│   وجود دارد. این سوراخ باعث می‌شود خون اضافی   │
│   به ریه‌ها برود و قلب مجبور شود سخت‌تر کار کند │
│                                                  │
│   ─── داروها ───                                │
│   • فوروزماید ۵mg (هر ۱۲ ساعت) - قبل از شیر     │
│   • انالاپریل ۱mg (هر ۱۲ ساعت)                  │
│                                                  │
│   ─── نکات مهم ───                               │
│   • وزن را هر هفته چک کنید                      │
│   • در صورت تنگی نفس یا کبودی به اورژانس مراجعه │
│                                                  │
│   ─── ویزیت بعدی ───                             │
│   • ۳ ماه بعد - اکو کنترول                      │
│   • ۱ سال بعد - مشاوره جراحی (در صورت نیاز)    │
│                                                  │
│   ─── IE Prophylaxis ───                         │
│   ❌ نیاز به آنتی‌بیوتیک قبل از دندانپزشکی ندارد│
│                                                  │
│   ─── علائم هشدار ───                            │
│   🔴 تنگی نفس شدید                               │
│   🔴 کبودی لب‌ها و نوک انگشتان                   │
│   🔴 عدم تحمل شیرخوردن                          │
│                                                  │
│   [تاریخ] [امضای پزشک]                           │
└─────────────────────────────────────────────────┘
```

---

## ۱۰. خروجی گزارش‌ها (PDF + خلاصه)

### انواع گزارش

| نوع گزارش | محتوا | مخاطب |
|-----------|-------|-------|
| **Echo Report** | Full measurements + Z-Scores + Interpretation + Segmental | Cardiologist |
| **Echo Lay Summary** | توضیح ساده + دیاگرام | Patient / Family |
| **Angio Report** | Hemodynamics + Injections + Interventions | Cardiologist |
| **ECG Report** | ECG parameters + AI Interpretation | General |
| **Visit Summary** | HPI + Physical Exam + Assessment + Plan | Referring MD |
| **Patient Summary** | خلاصه کامل پرونده (قابل انتخاب) | Any |
| **Discharge Summary** | خلاصه بستری و ترخیص | Patient / Family |
| **Research Export** | CSV / Excel / SPSS / JSON | Researcher |

### قالب PDF

- **موتور**: WeasyPrint (Python) با قالب‌های Jinja2
- **صفحه**: A4 با حاشیه ۱۵mm
- **جهت**: راست‌به‌چپ (RTL) با فونت Vazirmatn
- **لوگو**: لوگوی مرکز در هدر
- **بخش‌ها**: patient info → table of measurements → z-scores → diagnosis → interpretation → lay summary

### Lay Summary (AI-Generated)

```python
def generate_lay_summary(diagnoses, echo_data):
    # قالب‌های توضیح ساده برای هر تشخیص
    explanation_templates = {
        'VSD': 'در قلب فرزند شما یک سوراخ بین دو حفره پایینی (بطن‌ها) وجود دارد. '
               'این سوراخ باعث می‌شود بخشی از خون به جای رفتن به بدن، به سمت ریه‌ها برگردد.',
        'ASD': 'یک سوراخ بین دو حفره بالایی قلب (دهلیزها) وجود دارد...',
        'PDA': 'یک رگ اضافی در قفسه سینه باز مانده که باید بعد از تولد بسته می‌شد...',
        'TOF': 'قلب فرزند شما چهار مشکل همزمان دارد که با هم دیده می‌شود...',
        'CoA': 'بخشی از آئورت (شریان اصلی) تنگ شده...',
    }
    # + visual diagram (SVG) + next steps + warning signs + medication list
```

---

## ۱۱. Reference Library & Guidelines

### ساختار دیتابیس

```sql
CREATE TABLE clinical_references (
    id UUID PRIMARY KEY,
    title_fa TEXT,
    title_en TEXT NOT NULL,
    source VARCHAR(50) CHECK (source IN ('AHA', 'ACC', 'ESC', 'AAP', 'NEJM', 'JACC', 'Circulation', 'Uptodate', 'Other')),
    category VARCHAR(50),
    related_diagnoses UUID[], -- آرایه‌ای از standard_codes.id
    summary_fa TEXT,
    url TEXT,
    pdf_document TEXT, -- مسیر فایل
    tags TEXT[],
    is_free_full_text BOOLEAN,
    published_year INT
);
```

### ادغام با CDS

هنگام ثبت تشخیص، AI گایدلاین‌های مرتبط را نمایش می‌دهد:

```
📋 مطابق با AHA/ACC 2023 Guidelines for VSD:

I   VSD کوچک (<5mm) بدون شانت: Follow-up سالیانه (Class I)
I   VSD متوسط با شنت L→R: ترمیم قبل از ۱ سالگی (Class I)
IIa VSD بزرگ با PHTN: ترمیم زودهنگام (Class IIa)
I   IE Prophylaxis: فقط ۶ ماه اول پس از ترمیم (Class I)

[📄 مشاهده متن کامل] [⬇ دانلود PDF]
```

---

## ۱۲. قابلیت‌های پژوهشی

### ۱۲.۱. Query Builder پیشرفته

```python
class ResearchQuery:
    """
    ساخت query پویا با قابلیت ترکیب شروط
    """
    patient_criteria: {
        'age_range': [0, 18],        # سال
        'gender': 'any' | 'male' | 'female',
        'diagnosis_codes': ['Q21.0', 'Q21.3'],  # ICD-10 codes
        'clinic_ids': ['uuid1', 'uuid2'],
        'echo_params': [
            {'parameter': 'lv_edd_z_score', 'operator': '>', 'value': 2.0},
            {'parameter': 'lv_ef', 'operator': 'between', 'min': 45, 'max': 55},
            {'parameter': 'rvsp', 'operator': '>', 'value': 40}
        ],
        'angio_params': [
            {'parameter': 'qp_qs', 'operator': '>', 'value': 1.5},
            {'parameter': 'pvr', 'operator': '<', 'value': 3}
        ],
        'logic_operator': 'AND' | 'OR'
    }
    output_fields: [
        'patient.age', 'patient.gender', 
        'echo.lv_edd_z_score', 'echo.lv_ef',
        'angio.qp_qs', 'angio.pvr',
        'diagnosis.chd_types'
    ]
    anonymize: True  # حذف اطلاعات هویتی
```

### ۱۲.۲. Collaborative Research (مطالعات چندمرکزی)

```
۱. Researcher A در کلینیک X یک طرح تحقیقاتی ایجاد می‌کند
۲. سایر مراکز دعوت می‌شوند (Researcher B در کلینیک Y)
۳. هر مرکز بیماران واجد شرایط را ثبت می‌کند
۴. داده‌ها به صورت anonymized و فقط فیلدهای مجاز تبادل می‌شود
۵. AI تحلیل initial روی داده‌های تجمیعی انجام می‌دهد
۶. خروجی SPSS/Excel/CSV/JSON قابل دانلود است
```

### ۱۲.۳. آمار و نمودارها

```typescript
interface ResearchAnalytics {
  // Descriptive statistics
  demographics: { 
    ageDistribution: Histogram; 
    genderRatio: PieChart; 
    diagnosisPrevalence: BarChart; 
  };
  
  // Clinical parameters
  echoParameters: {
    zScoreDistribution: Histogram[]; // برای هر پارامتر
    lvEfDistribution: Histogram;
    regressionPlot: { x: 'age'|'bsa'; y: 'lv_edd'|'rv_size'|'...'; };
  };
  
  // Comparisons
  prePostComparison: { 
    parameter: string; 
    preMean: number; postMean: number; pValue: number; 
  }[];
  
  // Survival / Outcome
  outcomes: { 
    complicationRate: number; 
    successRate: number; 
    followUpStatus: PieChart; 
  };
  
  // Export
  exportFormats: ['CSV', 'Excel (XLSX)', 'SPSS (SAV)', 'JSON', 'PDF'];
}
```

### ۱۲.۴. Natural Language Query

کاربر به فارسی سوال می‌پرسد، AI به SQL تبدیل می‌کند:

```
کاربر: "بیمارانی که VSD دارند و Z-Score LV بزرگتر از ۲ است و سن کمتر از ۱ سال"
→ AI Parse → SQL Query → Result + Chart

کاربر: "توزیع سنی بیماران مبتلا به TOF در دو سال اخیر"
→ AI Parse → Age Histogram + Diagnosis Timeline

کاربر: "مقایسه EF قبل و بعد از جراحی در بیماران با TGA"
→ AI Parse → Matched Pairs Analysis → Box Plot
```

---

## ۱۳. Admin Panel

### ماژول‌های ادمین

| ماژول | قابلیت‌ها |
|-------|-----------|
| **Users** | لیست کاربران، ایجاد، ویرایش، فعال/غیرفعال، تعیین نقش |
| **Clinics** | مدیریت مطب‌ها، تنظیمات اختصاصی |
| **Roles & Permissions** | تعریف نقش جدید، تخصیص دسترسی‌ها |
| **Echo Templates** | تعریف تمپلیت‌های اکو، مدیریت ماژول‌ها و فیلدها |
| **Custom Fields** | فیلدهای سفارشی برای هر کلینیک |
| **Standard Codes** | مدیریت کدهای ICD/SNOMED، افزودن کد جدید |
| **Medications** | مدیریت داروها و دوزهای استاندارد |
| **References** | مدیریت گایدلاین‌ها و رفرنس‌ها |
| **System Settings** | تنظیمات عمومی سیستم |
| **Audit Log** | لاگ فعالیت‌های کاربران |
| **AI Settings** | مدیریت تنظیمات AI (API Key, Model, Prompts) |
| **Backup** | پشتیبان‌گیری و بازیابی |

### نقش‌های پیش‌فرض و دسترسی‌ها

```
SuperAdmin → همه دسترسی‌ها
OrgAdmin   → همه دسترسی‌های سازمان خود
ClinicAdmin → مدیریت کاربران مطب، تنظیمات مطب، فیلدهای سفارشی
Doctor     → CRUD بالینی + گزارش‌ها
Nurse      → ثبت علائم حیاتی، ECG
Secretary  → پذیرش، نوبت‌دهی، اطلاعات بیمار
Researcher → مشاهده anonymized + پژوهش
Assistant  → دسترسی محدود بر اساس تعریف Doctor
```

---

## ۱۴. UI/UX Design

### اصول طراحی

۱. **Progressive Disclosure**: اطلاعات تدریجی - ابتدا خلاصه، بعد جزئیات
۲. **Medical Minimalism**: آرام، حرفه‌ای، بدون حواس‌پرتی
۳. **Context-Aware**: هر بخش متناسب با نقش کاربر نمایش داده شود
۴. **Keyboard-First**: پزشکان تایپ سریع می‌کنند - میانبرهای صفحه‌کلید
۵. **RTL First**: کاملاً فارسی و راست‌به‌چپ

### پالت رنگی

```css
--primary-50: #EFF6FF;
--primary-100: #DBEAFE;
--primary-200: #BFDBFE;
--primary-500: #3B82F6;
--primary-700: #1D4ED8;
--primary-900: #1E3A5F; /* اصلی */

--success-500: #10B981; /* نرمال - سبز */
--warning-500: #F59E0B; /* مرزی - زرد */
--danger-500: #EF4444;  /* غیرطبیعی - قرمز */

--surface-50: #FAFBFC;
--surface-100: #F0F2F5;
--surface-200: #E4E7EB;
--text-900: #1A202C;
--text-500: #68768A;
```

### صفحات اصلی

| صفحه | توضیح |
|------|-------|
| **Login** | صفحه ورود با دکمه ورود سریع (Quick Access Test Users) |
| **Dashboard** | ویجت‌های: مراجعات امروز، بیماران جدید، هشدارها |
| **Patient Search** | جستجوی پیشرفته بیماران با auto-complete |
| **Patient Profile** | اطلاعات پایه + Timeline ویزیت‌ها |
| **New Visit** | فرم ویزیت با History, Physical Exam, Assessment, Plan |
| **Echo Form** | فرم ۵۰۰+ فیلد با Tab Wizard (Segmental + Modules) |
| **Angio Form** | فرم آنژیوگرافی با محاسبات خودکار |
| **ECG Form** | ثبت نوار قلب + AI تفسیر |
| **Medications** | تجویز دارو با دوز خودکار بر اساس وزن |
| **Reports** | انواع گزارش‌ها با preview + PDF |
| **Research Center** | Query Builder, Projects, Analytics |
| **Admin Panel** | مدیریت کامل سیستم |

### نمونه Layout فرم اکو

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 [جستجوی بیمار]    👤 بیمار: امیرحسین - ۳ ساله ♂     │
├──────────────────────────────────────────────────────────┤
│ [⬅ Registry] [💓 Echo] [📊 Angio] [📈 ECG] [💊 Meds]  │ ← Tabs
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📋 Echo #۳  —  ۱۴۰۵/۰۴/۰۱                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ [گام ۱] [گام ۲] [گام ۳] [گام ۴] [گام ۵]         │   │
│  │ Segmental   LV     RV    Valves  Aorta  Congenital│   │ ← Sub-tabs
│  ├──────────────────────────────────────────────────┤   │
│  │   بطن چپ (LV)                             ۶۰٪    │   │
│  │  ┌────────────────────┐  ┌──────────────────┐   │   │
│  │  │ LV EDD: [38] mm    │  │ Z-Score: +1.2 🟢 │   │   │
│  │  │ LV ESD: [24] mm    │  │ Z-Score: +0.8 🟢 │   │   │
│  │  │ LV EF:  [68] %     │  │ Normal: 55-70%   │   │   │
│  │  │ LV FS:  [36] %     │  │ Normal: 28-44%   │   │   │
│  │  └────────────────────┘  └──────────────────┘   │   │
│  │  💡 AI: مقادیر در محدوده نرمال برای سن         │   │
│  │  ┌─ LV Wall Motion ──────────────────────┐     │   │
│  │  │ ○ Normal  ○ Hypokinesis  ○ Akinesis   │     │   │
│  │  └───────────────────────────────────────┘     │   │
│  │                                                 │   │
│  │  [← Previous Section]       [Next Section →]    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  💬 AI Assistant:                                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │ "بر اساس داده‌های وارد شده، محتمل‌ترین تشخیص:   │   │
│  │ 🏆 VSD (Perimembranous) — احتمال ۹۵٪           │   │
│  │ ✅ تأیید   ❌ رد    ✏️ ویرایش                    │   │
│  │                                                   │   │
│  │ 💊 پیشنهاد دارو: Furosemide 1mg/kg q12h          │   │
│  │ 📋 گایدلاین مرتبط: AHA/ACC 2023 VSD Guideline   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [💾 ذخیره] [🖨 چاپ] [📄 PDF] [🔬 پژوهش]                │
└──────────────────────────────────────────────────────────┘
```

---

## ۱۵. تکنولوژی‌ها و Stack

| لایه | تکنولوژی | نسخه | دلیل انتخاب |
|------|-----------|------|-------------|
| **Backend** | Python FastAPI | 0.110+ | Async, تایپ‌دهی، speed |
| **ORM** | SQLAlchemy 2.0 | 2.0+ | پشتیبانی کامل Postgres JSONB |
| **Validation** | Pydantic v2 | 2.0+ | Validation خودکار |
| **Database** | PostgreSQL | 16 | JSONB, GIN Index, Full-Text Search |
| **Migrations** | Alembic | 1.13+ | مدیریت تغییرات schema |
| **Auth** | JWT + OAuth2 | - | استاندارد و امن |
| **Frontend** | React + Vite | 18 / 5 | سرعت بالا |
| **UI Library** | MUI 5 + Tailwind | 5 / 3 | فرم‌های پیچیده + RTL |
| **State** | Zustand + React Query | 4 / 5 | سبک و قدرتمند |
| **Charts** | Recharts + Plotly | 2 / 2 | نمودارهای تعاملی |
| **PDF** | WeasyPrint + Jinja2 | 60+ | کیفیت بالا |
| **AI** | OpenAI API + LangChain | - | تفسیر + پیشنهاد |
| **File Storage** | MinIO (S3-compatible) | - | تصاویر اکو/آنژیو |
| **Task Queue** | Celery + Redis | 5+ | PDF, AI, Export |
| **Container** | Docker + Docker Compose | - | استقرار یکپارچه |

---

## ۱۶. برنامه اجرایی فازبندی

### فاز ۱: هسته سیستم (هفته ۱)

- [x] راه‌اندازی پروژه FastAPI + PostgreSQL
- [x] مدل‌های اصلی (Users, Patients, Visits, Clinics, Roles)
- [x] احراز هویت JWT + RBAC
- [x] CRUD API برای بیماران
- [x] فرانت‌اند: لاگین + داشبورد
