import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  UserGroupIcon, BriefcaseIcon, BuildingOfficeIcon, DocumentTextIcon,
  PhoneIcon, ClipboardDocumentListIcon, ArrowRightIcon,
  ServerIcon, CircleStackIcon, ShieldCheckIcon, CubeTransparentIcon,
  CodeBracketIcon, ArrowPathIcon, LockClosedIcon, CloudArrowUpIcon,
} from '@heroicons/react/24/outline'

// ─── colour tokens ────────────────────────────────────────────────────────────
const C = {
  lead:       { border: '#93c5fd', bg: '#eff6ff', icon: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700' },
  deal:       { border: '#a5b4fc', bg: '#eef2ff', icon: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700' },
  account:    { border: '#86efac', bg: '#f0fdf4', icon: 'text-green-600',   badge: 'bg-green-100 text-green-700' },
  quote:      { border: '#c4b5fd', bg: '#faf5ff', icon: 'text-purple-600',  badge: 'bg-purple-100 text-purple-700' },
  activity:   { border: '#fcd34d', bg: '#fffbeb', icon: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700' },
  contact:    { border: '#5eead4', bg: '#f0fdfa', icon: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700' },
  attachment: { border: '#d1d5db', bg: '#f9fafb', icon: 'text-gray-500',    badge: 'bg-gray-100 text-gray-600' },
}

// ─── Pipeline phases ──────────────────────────────────────────────────────────
const PHASES = [
  { label: 'Prospecting',  color: 'bg-blue-100 text-blue-700',    stages: ['lead_received','lead_qualification','account_created','needs_assessment'] },
  { label: 'Evaluation',   color: 'bg-indigo-100 text-indigo-700', stages: ['feasibility_check','quote_preparation','quote_sent','negotiation'] },
  { label: 'Order',        color: 'bg-purple-100 text-purple-700', stages: ['order_confirmed','order_created_erp','artwork_approval'] },
  { label: 'Production',   color: 'bg-orange-100 text-orange-700', stages: ['production_planning','in_production','quality_check'] },
  { label: 'Closing',      color: 'bg-green-100 text-green-700',   stages: ['shipped','invoice_created','payment_received','deal_closed_won'] },
  { label: 'Terminal',     color: 'bg-gray-100 text-gray-600',     stages: ['lost','on_hold'] },
]

const STAGE_LABEL = {
  lead_received:'Lead Received', lead_qualification:'Lead Qualification', account_created:'Account Created',
  needs_assessment:'Needs Assessment', feasibility_check:'Feasibility Check', quote_preparation:'Quote Preparation',
  quote_sent:'Quote Sent', negotiation:'Negotiation', order_confirmed:'Order Confirmed',
  order_created_erp:'Order in ERP', artwork_approval:'Artwork Approval', production_planning:'Production Planning',
  in_production:'In Production', quality_check:'Quality Check', shipped:'Shipped',
  invoice_created:'Invoice Created', payment_received:'Payment Received', deal_closed_won:'Closed Won',
  lost:'Lost', on_hold:'On Hold',
}

// ─── Entity flowchart ─────────────────────────────────────────────────────────
function FlowChart() {
  return (
    <svg viewBox="0 0 880 490" className="w-full" style={{ minWidth: 600 }}>
      <defs>
        <marker id="arr-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
        <marker id="arr-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#86efac" />
        </marker>
      </defs>

      {/* SOURCES */}
      <rect x="10" y="40" width="135" height="190" rx="10" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2"/>
      <rect x="10" y="40" width="135" height="28" rx="10" fill="#93c5fd" opacity="0.7"/>
      <rect x="10" y="58" width="135" height="10" fill="#93c5fd" opacity="0.7"/>
      <text x="77" y="59" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">LEAD SOURCES</text>
      {['Email','Website','Event','Referral','Manual'].map((s, i) => (
        <g key={s}>
          <circle cx="24" cy={84 + i * 26} r="3" fill="#93c5fd"/>
          <text x="34" y={89 + i * 26} fontSize="11" fill="#475569" fontFamily="system-ui,sans-serif">{s}</text>
        </g>
      ))}
      <path d="M 146 135 L 178 135" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gray)"/>

      {/* LEAD */}
      <rect x="180" y="55" width="148" height="165" rx="10" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2"/>
      <rect x="180" y="55" width="148" height="28" rx="10" fill="#93c5fd" opacity="0.7"/>
      <rect x="180" y="73" width="148" height="10" fill="#93c5fd" opacity="0.7"/>
      <text x="254" y="74" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">LEAD</text>
      {['Company + contact info','Source tracked','Status: new → qualified','↓ Convert → Deal + Account'].map((s, i) => (
        <text key={i} x="190" y={99 + i * 18} fontSize="10.5" fill="#475569" fontFamily="system-ui,sans-serif">{s}</text>
      ))}
      <path d="M 329 137 L 378 137" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gray)"/>

      {/* DEAL */}
      <rect x="380" y="35" width="168" height="205" rx="10" fill="#eef2ff" stroke="#a5b4fc" strokeWidth="2.5"/>
      <rect x="380" y="35" width="168" height="28" rx="10" fill="#a5b4fc" opacity="0.7"/>
      <rect x="380" y="53" width="168" height="10" fill="#a5b4fc" opacity="0.7"/>
      <text x="464" y="54" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">DEAL</text>
      {['20 pipeline stages','Value + probability','Product type, quantity','Feasibility · Artwork · Payment','Linked to Account + Contact'].map((s, i) => (
        <text key={i} x="392" y={80 + i * 19} fontSize="10.5" fill="#475569" fontFamily="system-ui,sans-serif">{s}</text>
      ))}
      <path d="M 549 137 L 598 137" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gray)"/>

      {/* QUOTE */}
      <rect x="600" y="55" width="148" height="155" rx="10" fill="#faf5ff" stroke="#c4b5fd" strokeWidth="2"/>
      <rect x="600" y="55" width="148" height="28" rx="10" fill="#c4b5fd" opacity="0.7"/>
      <rect x="600" y="73" width="148" height="10" fill="#c4b5fd" opacity="0.7"/>
      <text x="674" y="74" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">QUOTE</text>
      {['Line items + pricing','Shipping & production cost','Versioned (v1, v2 …)','Status: draft → accepted'].map((s, i) => (
        <text key={i} x="612" y={99 + i * 18} fontSize="10.5" fill="#475569" fontFamily="system-ui,sans-serif">{s}</text>
      ))}
      <path d="M 749 137 L 790 137" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gray)"/>

      {/* PDF */}
      <rect x="792" y="108" width="68" height="58" rx="8" fill="#fef2f2" stroke="#fca5a5" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="826" y="133" textAnchor="middle" fontSize="13" fontWeight="800" fill="#dc2626" fontFamily="system-ui,sans-serif">PDF</text>
      <text x="826" y="151" textAnchor="middle" fontSize="10" fill="#ef4444" fontFamily="system-ui,sans-serif">Export</text>

      {/* Deal → down */}
      <path d="M 464 241 L 464 278" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gray)"/>
      <text x="470" y="263" fontSize="9.5" fill="#94a3b8" fontFamily="system-ui,sans-serif">creates / links</text>

      {/* ACCOUNT */}
      <rect x="230" y="280" width="155" height="155" rx="10" fill="#f0fdf4" stroke="#86efac" strokeWidth="2"/>
      <rect x="230" y="280" width="155" height="28" rx="10" fill="#86efac" opacity="0.7"/>
      <rect x="230" y="298" width="155" height="10" fill="#86efac" opacity="0.7"/>
      <text x="307" y="299" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">ACCOUNT</text>
      {['B2B or B2B2C','Industry, country, region','Website, address, notes','Has Contacts & Deals'].map((s, i) => (
        <text key={i} x="242" y={324 + i * 18} fontSize="10.5" fill="#475569" fontFamily="system-ui,sans-serif">{s}</text>
      ))}
      <path d="M 386 357 L 418 357" stroke="#86efac" strokeWidth="1.5" fill="none" markerEnd="url(#arr-green)"/>

      {/* CONTACTS */}
      <rect x="420" y="305" width="148" height="105" rx="10" fill="#f0fdfa" stroke="#5eead4" strokeWidth="2"/>
      <rect x="420" y="305" width="148" height="28" rx="10" fill="#5eead4" opacity="0.5"/>
      <rect x="420" y="323" width="148" height="10" fill="#5eead4" opacity="0.5"/>
      <text x="494" y="324" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">CONTACTS</text>
      {['Person at the account','Email, phone, role','Linked to deals'].map((s, i) => (
        <text key={i} x="432" y={350 + i * 18} fontSize="10.5" fill="#475569" fontFamily="system-ui,sans-serif">{s}</text>
      ))}

      {/* ACTIVITIES */}
      <rect x="590" y="280" width="162" height="160" rx="10" fill="#fffbeb" stroke="#fcd34d" strokeWidth="2"/>
      <rect x="590" y="280" width="162" height="28" rx="10" fill="#fcd34d" opacity="0.5"/>
      <rect x="590" y="298" width="162" height="10" fill="#fcd34d" opacity="0.5"/>
      <text x="671" y="299" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">ACTIVITIES</text>
      {['📞 Call','✉ Email','📝 Note','📅 Meeting','💬 WhatsApp','User + timestamp tracked'].map((s, i) => (
        <text key={i} x="604" y={324 + i * 18} fontSize="10.5" fill="#475569" fontFamily="system-ui,sans-serif">{s}</text>
      ))}
      <path d="M 580 241 Q 671 260 671 278" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gray)"/>

      {/* ATTACHMENTS */}
      <rect x="772" y="305" width="92" height="100" rx="10" fill="#f9fafb" stroke="#d1d5db" strokeWidth="2"/>
      <rect x="772" y="305" width="92" height="28" rx="10" fill="#d1d5db" opacity="0.7"/>
      <rect x="772" y="323" width="92" height="10" fill="#d1d5db" opacity="0.7"/>
      <text x="818" y="324" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">FILES</text>
      {['Attachments','Thumbnails','Per deal/account'].map((s, i) => (
        <text key={i} x="782" y={350 + i * 18} fontSize="10.5" fill="#475569" fontFamily="system-ui,sans-serif">{s}</text>
      ))}
      <path d="M 548 235 Q 818 252 818 303" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gray)"/>

      {/* legend */}
      {[
        { color: '#93c5fd', label: 'Lead' },
        { color: '#a5b4fc', label: 'Deal' },
        { color: '#86efac', label: 'Account' },
        { color: '#5eead4', label: 'Contact' },
        { color: '#c4b5fd', label: 'Quote' },
        { color: '#fcd34d', label: 'Activities' },
        { color: '#d1d5db', label: 'Attachments' },
      ].map(({ color, label }, i) => (
        <g key={label} transform={`translate(${10 + i * 115}, 458)`}>
          <rect width="12" height="12" rx="3" fill={color} opacity="0.8"/>
          <text x="16" y="11" fontSize="10" fill="#64748b" fontFamily="system-ui,sans-serif">{label}</text>
        </g>
      ))}
    </svg>
  )
}

// ─── Architecture SVG ─────────────────────────────────────────────────────────
function ArchDiagram() {
  const Box = ({ x, y, w, h, fill, stroke, title, lines, fontSize = 11 }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={fill} stroke={stroke} strokeWidth="2"/>
      <rect x={x} y={y} width={w} height="26" rx="10" fill={stroke} opacity="0.5"/>
      <rect x={x} y={y+16} width={w} height="10" fill={stroke} opacity="0.5"/>
      <text x={x + w/2} y={y+17} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b" fontFamily="system-ui,sans-serif">{title}</text>
      {lines.map((l, i) => (
        <text key={i} x={x+10} y={y+36+i*16} fontSize={fontSize} fill="#475569" fontFamily="system-ui,sans-serif">{l}</text>
      ))}
    </g>
  )

  const Arr = ({ x1, y1, x2, y2, label, bend }) => {
    const d = bend
      ? `M ${x1} ${y1} C ${bend[0]} ${bend[1]}, ${bend[2]} ${bend[3]}, ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x2} ${y2}`
    const mx = (x1+x2)/2, my = (y1+y2)/2
    return (
      <>
        <path d={d} stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#a2)"/>
        {label && <text x={mx+4} y={my-4} fontSize="9.5" fill="#94a3b8" fontFamily="system-ui,sans-serif">{label}</text>}
      </>
    )
  }

  return (
    <svg viewBox="0 0 900 520" className="w-full" style={{ minWidth: 640 }}>
      <defs>
        <marker id="a2" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/>
        </marker>
      </defs>

      <Box x={10} y={10} w={200} h={130} fill="#eff6ff" stroke="#93c5fd"
        title="Browser (React SPA)"
        lines={['React 18 + Vite','TailwindCSS v3','Zustand (state)','React Router v6','axios (HTTP client)']}
      />
      <Box x={280} y={10} w={210} h={190} fill="#eef2ff" stroke="#a5b4fc"
        title="FastAPI Backend"
        lines={['Python 3.12','Pydantic v2 validation','JWT Bearer auth','Rate limiting middleware','CORS + security headers','Async request handling','Alembic DB migrations']}
      />
      <Box x={560} y={10} w={185} h={160} fill="#f0fdf4" stroke="#86efac"
        title="PostgreSQL"
        lines={['SQLAlchemy async ORM','12 entity tables','Audit log table','Attachment metadata','Enum types','JSON columns (custom fields)']}
      />
      <Box x={560} y={200} w={185} h={100} fill="#faf5ff" stroke="#c4b5fd"
        title="File Storage"
        lines={['Local filesystem (dev)','Supabase S3 (prod)','20 MB max / file','Magic byte validation','Thumbnail generation (Pillow)']}
      />
      <Box x={280} y={240} w={210} h={100} fill="#fff7ed" stroke="#fb923c"
        title="Microsoft Graph API"
        lines={['OAuth2 flow','Email sync (Outlook)','Calendar / meetings','Token refresh handling']}
      />
      <Box x={10} y={200} w={200} h={90} fill="#fef2f2" stroke="#fca5a5"
        title="PDF Generator"
        lines={['WeasyPrint','Jinja2 HTML template','Quote PDF export','Served via /quotes/{id}/pdf']}
      />
      <Box x={10} y={320} w={860} h={80} fill="#f8fafc" stroke="#cbd5e1"
        title="Backend Routers  (/api/v1/…)"
        lines={['auth · users · accounts · contacts · leads · deals · quotes · activities · tasks · reports · settings · uploads · gdpr · audit-log · ms_graph']}
        fontSize={10.5}
      />

      <Arr x1={210} y1={75} x2={278} y2={75} label="REST + JWT" />
      <Arr x1={491} y1={75} x2={558} y2={75} label="SQLAlchemy async" />
      <Arr x1={491} y1={120} x2={558} y2={230} label="storage_svc" bend={[530,120,530,230]} />
      <Arr x1={385} y1={201} x2={385} y2={238} label="OAuth2" />
      <Arr x1={280} y1={160} x2={210} y2={220} label="WeasyPrint" bend={[240,160,240,220]} />
      <path d="M 385 201 L 385 318" stroke="#a5b4fc" strokeWidth="1.5" strokeDasharray="4 2" fill="none" markerEnd="url(#a2)"/>

      <text x="10" y="425" fontSize="10" fill="#94a3b8" fontFamily="system-ui,sans-serif">
        ── HTTP/REST   · · · internal dispatch   → data flow
      </text>
    </svg>
  )
}

// ─── Entity quick-reference ───────────────────────────────────────────────────
const ENTITIES = [
  { color: 'lead',     icon: UserGroupIcon,            title: 'Lead',
    desc: 'First touchpoint from email, website, event, referral or manual entry. Gets qualified and converted into a Deal + Account.',
    badges: ['email','website','event','referral','manual'] },
  { color: 'account',  icon: BuildingOfficeIcon,        title: 'Account',
    desc: 'A company/client. Created automatically when a lead converts. One account can have many deals and contacts.',
    badges: ['B2B','B2B2C'] },
  { color: 'deal',     icon: BriefcaseIcon,             title: 'Deal',
    desc: 'Core sales record. Moves through 20 pipeline stages. Holds product specs, value, probability, and logistics info.',
    badges: ['standard','barter','custom'] },
  { color: 'quote',    icon: DocumentTextIcon,          title: 'Quote',
    desc: 'Versioned pricing document for a deal. Line items + shipping + production costs. Exportable as PDF.',
    badges: ['draft','sent','accepted','rejected'] },
  { color: 'activity', icon: ClipboardDocumentListIcon, title: 'Activities',
    desc: 'Contact history log. Every call, email, note, meeting or WhatsApp recorded with user + timestamp.',
    badges: ['call','email','note','meeting','whatsapp'] },
  { color: 'contact',  icon: PhoneIcon,                 title: 'Contacts',
    desc: 'Individual people at an account. Linked to leads and deals so you always know who you talked to.',
    badges: [] },
]

// ─── Tech stack data ──────────────────────────────────────────────────────────
const STACK = {
  frontend: [
    { name: 'React 18',           role: 'UI framework with concurrent rendering' },
    { name: 'Vite 5',             role: 'Build tool & dev server (ESM, HMR)' },
    { name: 'TailwindCSS v3',     role: 'Utility-first CSS framework' },
    { name: 'React Router v6',    role: 'Client-side routing (nested routes, guards)' },
    { name: 'Zustand',            role: 'Lightweight global state (sidebar, view modes)' },
    { name: 'axios',              role: 'HTTP client with Bearer token interceptor' },
    { name: 'React Hook Form',    role: 'Performant form state & validation' },
    { name: 'framer-motion',      role: 'Animations & page transitions' },
    { name: '@dnd-kit',           role: 'Drag-and-drop for pipeline stages' },
    { name: 'i18next',            role: 'Internationalisation (DE / EN)' },
    { name: 'date-fns',           role: 'Date formatting & calculation' },
    { name: 'Heroicons',          role: 'SVG icon set' },
    { name: 'react-hot-toast',    role: 'Toast notifications' },
    { name: 'clsx',               role: 'Conditional className merging' },
  ],
  backend: [
    { name: 'Python 3.12',        role: 'Runtime' },
    { name: 'FastAPI',            role: 'Async REST API framework (OpenAPI, Pydantic)' },
    { name: 'SQLAlchemy 2 async', role: 'ORM with async engine (asyncpg driver)' },
    { name: 'Alembic',            role: 'Schema migrations (versioned upgrade/downgrade)' },
    { name: 'PostgreSQL',         role: 'Primary relational database' },
    { name: 'Pydantic v2',        role: 'Request/response schema validation' },
    { name: 'python-jose',        role: 'JWT creation & verification (HS256)' },
    { name: 'passlib[bcrypt]',    role: 'Password hashing' },
    { name: 'WeasyPrint',         role: 'HTML→PDF rendering for quotes' },
    { name: 'Pillow',             role: 'Image thumbnail generation (300×300 JPEG)' },
    { name: 'msal / httpx',       role: 'Microsoft Graph OAuth2 flow & REST calls' },
    { name: 'Supabase Storage',   role: 'Optional cloud file storage (local fallback)' },
    { name: 'difflib',            role: 'Fuzzy name matching for duplicate detection' },
  ],
}

// ─── Backend module tree ──────────────────────────────────────────────────────
const MODULES = [
  {
    path: 'app/',
    desc: 'FastAPI application root',
    children: [
      { path: 'main.py',          desc: 'App factory, middleware chain, router registration' },
      { path: 'config.py',        desc: 'Env-based settings (DATABASE_URL, SECRET_KEY, CORS_ORIGINS, …)' },
      { path: 'database.py',      desc: 'Async engine, session factory, declarative Base' },
      { path: 'models/',          desc: 'SQLAlchemy ORM models', children: [
        { path: 'user.py',        desc: 'User, UserRole enum, MS Graph token fields' },
        { path: 'account.py',     desc: 'Account, AccountType, AccountStatus' },
        { path: 'contact.py',     desc: 'Contact, is_primary flag' },
        { path: 'lead.py',        desc: 'Lead, LeadStatus, LeadSource, conversion fields' },
        { path: 'deal.py',        desc: 'Deal, DealStage (varchar), DealType, stage gate fields' },
        { path: 'quote.py',       desc: 'Quote, QuoteLineItem, QuoteStatus, versioning' },
        { path: 'activity.py',    desc: 'Activity, ActivityType, RelatedToType (polymorphic FK)' },
        { path: 'task.py',        desc: 'Task, TaskStatus, TaskPriority, due_date' },
        { path: 'attachment.py',  desc: 'Attachment metadata (entity_type, entity_id, stored_name, …)' },
        { path: 'audit_log.py',      desc: 'AuditLog, AuditAction — change history per record' },
        { path: 'notification.py',   desc: 'Notification — in-app notifications per user' },
        { path: 'saved_view.py',     desc: 'SavedView — named filter presets per user/entity' },
        { path: 'settings.py',    desc: 'PipelineStage, CustomField, RolePermission, QuoteTemplate' },
      ]},
      { path: 'schemas/',         desc: 'Pydantic v2 request/response models (per entity)' },
      { path: 'routers/',         desc: 'FastAPI route handlers', children: [
        { path: 'auth.py',        desc: 'POST /auth/login — JWT issue, POST /auth/refresh' },
        { path: 'users.py',       desc: 'CRUD for CRM users (admin only for write)' },
        { path: 'accounts.py',    desc: 'CRUD + duplicate detection + merge + audit logging' },
        { path: 'contacts.py',    desc: 'CRUD + duplicate detection + merge + audit logging' },
        { path: 'leads.py',       desc: 'CRUD + convert → Deal + Account' },
        { path: 'deals.py',       desc: 'CRUD + stage change with gate validation' },
        { path: 'quotes.py',      desc: 'CRUD + send/accept + PDF endpoint' },
        { path: 'activities.py',  desc: 'CRUD — polymorphic (lead/deal/contact/account)' },
        { path: 'tasks.py',       desc: 'CRUD + overdue filter' },
        { path: 'reports.py',     desc: 'Aggregated stats for dashboard' },
        { path: 'settings.py',    desc: 'Pipeline stages, custom fields, permissions, quote template' },
        { path: 'uploads.py',     desc: 'File upload with magic-byte validation, thumbnails, storage_svc' },
        { path: 'gdpr.py',        desc: 'Art.15 data export + Art.17 anonymization endpoints' },
        { path: 'audit_log.py',    desc: 'GET /audit-log + log_event() helper' },
        { path: 'search.py',       desc: 'GET /search?q= — cross-entity full-text search' },
        { path: 'notifications.py',desc: 'CRUD /notifications + create_notification() helper' },
        { path: 'saved_views.py',  desc: 'GET/POST/DELETE /saved-views — per-user filter presets' },
        { path: 'import_data.py',  desc: 'CSV import (accounts/contacts/leads) + CSV/JSON export' },
      ]},
      { path: 'services/',        desc: 'Business logic layer', children: [
        { path: 'auth_service.py',  desc: 'get_current_user, require_admin (FastAPI dependencies)' },
        { path: 'deal_service.py',  desc: 'validate_stage_transition — enforces stage gates' },
        { path: 'quote_service.py', desc: 'create_quote_version, calculate_total' },
        { path: 'storage.py',       desc: 'Abstraction over local filesystem / Supabase' },
      ]},
      { path: 'middleware/',      desc: 'Custom ASGI middleware', children: [
        { path: 'security.py',    desc: 'SecurityHeadersMiddleware, LoginRateLimitMiddleware, GlobalRateLimitMiddleware' },
      ]},
      { path: 'integrations/',   desc: 'External API clients', children: [
        { path: 'ms_graph.py',    desc: 'Microsoft Graph OAuth2 callback, token storage, email/event sync' },
      ]},
      { path: 'reports/',        desc: 'PDF rendering', children: [
        { path: 'pdf_generator.py', desc: 'generate_quote_pdf() using Jinja2 + WeasyPrint' },
      ]},
    ],
  },
]

// ─── Request lifecycle ────────────────────────────────────────────────────────
const LIFECYCLE = [
  { step: '1', label: 'Browser',             color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    desc: 'React component calls e.g. accountsApi.list(params). axios adds Authorization: Bearer <JWT> header.' },
  { step: '2', label: 'Middleware chain',    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    desc: 'TrustedHostMiddleware → CORS → SecurityHeadersMiddleware → GlobalRateLimitMiddleware (50 req/s per IP) → LoginRateLimitMiddleware (on /auth/login).' },
  { step: '3', label: 'Router',              color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    desc: 'FastAPI matches path + method. Dependency injection runs: get_db() opens async session, get_current_user() decodes JWT and loads User from DB.' },
  { step: '4', label: 'Handler',             color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    desc: 'Route function executes SQLAlchemy query, applies filters/pagination. For writes, calls log_event() to append an AuditLog entry in the same transaction.' },
  { step: '5', label: 'Session commit',      color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
    desc: 'get_db() context manager calls await session.commit() on success, await session.rollback() on exception.' },
  { step: '6', label: 'Response',            color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    desc: 'Pydantic response_model serialises ORM object → JSON. Security headers are added by middleware before the bytes leave the server.' },
]

// ─── Security overview ────────────────────────────────────────────────────────
const SECURITY = [
  { icon: LockClosedIcon,     label: 'JWT Authentication',      desc: 'HS256 tokens issued at login. Expiry configurable via .env. Decoded on every protected route via Depends(get_current_user).' },
  { icon: ShieldCheckIcon,    label: 'Role-based permissions',   desc: 'Four roles: admin, sales_manager, account_manager, viewer. Per-role permission matrix stored in DB, checked via PermissionsContext on the frontend and require_admin / _require_gdpr_role on the backend.' },
  { icon: ArrowPathIcon,      label: 'Rate limiting',            desc: 'GlobalRateLimitMiddleware: 50 req/s per IP. LoginRateLimitMiddleware: 5 failed attempts per minute → 60 s lockout. In-memory counters (reset on restart).' },
  { icon: CubeTransparentIcon,label: 'File validation',         desc: 'Magic-byte check (JPEG, PNG, GIF, WebP, PDF, XLSX, CSV) against declared MIME type. 20 MB size cap. Allowed extensions whitelist. Stored with UUID filenames (no user-controlled paths).' },
  { icon: CodeBracketIcon,    label: 'CORS',                    desc: 'Explicit origin allowlist via CORS_ORIGINS env var. Credentials allowed only from listed origins. No wildcard in production.' },
  { icon: ServerIcon,         label: 'Security headers',        desc: 'X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy set on every response by SecurityHeadersMiddleware.' },
  { icon: CloudArrowUpIcon,   label: 'GDPR / DSGVO',           desc: 'Art. 15/20: full personal data export as JSON download. Art. 17: field-level anonymisation (SHA-256 email hash, NULL on PII fields) — business records preserved. User deletion anonymises login credentials.' },
  { icon: CircleStackIcon,    label: 'Audit trail',             desc: 'Every create/update/delete on accounts and contacts writes an AuditLog row with actor, timestamp, and JSON field diff. Queryable via GET /api/v1/audit-log.' },
]

// ─── DB tables overview ───────────────────────────────────────────────────────
const TABLES = [
  { name: 'users',             pk: 'id', fks: [], note: 'CRM user accounts, roles, MS Graph tokens' },
  { name: 'accounts',          pk: 'id', fks: ['account_manager_id → users'], note: 'Companies (B2B/B2B2C)' },
  { name: 'contacts',          pk: 'id', fks: ['account_id → accounts'], note: 'People at an account' },
  { name: 'leads',             pk: 'id', fks: ['assigned_to → users', 'contact_id → contacts', 'account_id → accounts'], note: 'Inbound inquiries' },
  { name: 'deals',             pk: 'id', fks: ['account_id → accounts', 'contact_id → contacts', 'assigned_to → users'], note: 'Core sales records, 20 stages' },
  { name: 'quotes',            pk: 'id', fks: ['deal_id → deals'], note: 'Versioned pricing, QuoteLineItem rows' },
  { name: 'quote_line_items',  pk: 'id', fks: ['quote_id → quotes'], note: 'Product lines in a quote' },
  { name: 'activities',        pk: 'id', fks: ['assigned_to → users'], note: 'Polymorphic: related_to_type + related_to_id' },
  { name: 'tasks',             pk: 'id', fks: ['assigned_to → users'], note: 'To-do items, priority, due_date' },
  { name: 'attachments',       pk: 'id', fks: ['uploaded_by → users'], note: 'Polymorphic: entity_type + entity_id' },
  { name: 'pipeline_stages',   pk: 'id', fks: [], note: 'Configurable deal stages (label_en, label_de, color, order)' },
  { name: 'custom_fields',     pk: 'id', fks: [], note: 'User-defined fields per entity type' },
  { name: 'role_permissions',  pk: 'id', fks: [], note: 'Permission matrix: role × permission_key → bool' },
  { name: 'quote_template',    pk: 'id', fks: [], note: 'Singleton: company info, footer text for PDF' },
  { name: 'audit_logs',        pk: 'id', fks: [], note: 'entity_type, entity_id, action, user_name, changes (JSON)' },
  { name: 'notifications',     pk: 'id', fks: ['user_id → users'], note: 'type, title, body, entity_type, entity_id, read_at' },
  { name: 'saved_views',       pk: 'id', fks: ['user_id → users'], note: 'entity_type, name, filters (JSON) – per-user filter presets' },
]

// ─── Tree renderer ────────────────────────────────────────────────────────────
function Tree({ nodes, depth = 0 }) {
  return (
    <div className={clsx('space-y-0.5', depth > 0 && 'ml-5 border-l border-gray-200 dark:border-gray-700 pl-4')}>
      {nodes.map(node => (
        <div key={node.path}>
          <div className="flex items-baseline gap-2 py-0.5">
            <code className={clsx(
              'text-xs font-mono flex-shrink-0',
              node.children ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-gray-700 dark:text-gray-300'
            )}>
              {node.path}
            </code>
            <span className="text-xs text-gray-400 dark:text-gray-500 leading-snug">{node.desc}</span>
          </div>
          {node.children && <Tree nodes={node.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  )
}

// ─── Bilingual feature data ───────────────────────────────────────────────────
const FEATURES = {
  en: [
    { title: 'Sales Pipeline', icon: '🎯', items: [
      '20+ configurable pipeline stages (Lead Received to Deal Closed Won)',
      'Kanban view with drag & drop between stages',
      'Table view with sorting and filtering',
      'Stage transitions with business rule validation (e.g. no Quote Sent without a quote)',
      'Deal types: Standard, Barter, Custom',
      'Probability, value (EUR), quantity, product type, close date',
      'Lost reason required on loss',
      'Deal detail page with full activity timeline',
    ]},
    { title: 'Lead Management', icon: '🔍', items: [
      'Lead capture with source tracking (email, website, event, referral, manual)',
      'Status workflow: New → Contacted → Qualified → Converted',
      'Lead-to-Deal conversion with optional account creation',
      'Search by company name, contact name and email',
      'Assignment to sales reps with notification',
      'Date filters (created after / created before)',
      'Bulk actions: delete, assign, update status',
      'Saved filter views',
    ]},
    { title: 'Account Management', icon: '🏢', items: [
      'Account types: B2B, B2B2C',
      'Status: Active, Inactive, Prospect',
      'Fields: industry, country, region, website, address',
      'Account detail page with linked deals, contacts, activities',
      'Attachments per account (file upload with MIME validation)',
      'Fuzzy duplicate detection on creation',
      'Bulk actions: delete, update status',
      'Saved filter views',
    ]},
    { title: 'Contact Management', icon: '👤', items: [
      'Contacts linked to accounts',
      'Primary contact flag per account',
      'Fields: first name, last name, email, phone, title',
      'Search by name and email',
      'Duplicate detection and merge',
      'GDPR export (Art. 15) and anonymization (Art. 17)',
      'Bulk actions: delete',
      'Saved filter views',
    ]},
    { title: 'Quotes', icon: '📄', items: [
      'Quote builder with line items (product, quantity, unit price, shipping, production)',
      'Multiple versions per deal (automatic versioning)',
      'Status workflow: Draft → Sent → Negotiating → Accepted / Rejected',
      'PDF generation with company logo and branding',
      'Configurable quote template (logo, brand color, sections)',
      'Filter by status and date',
      'Direct PDF download with token auth',
    ]},
    { title: 'Tasks', icon: '✅', items: [
      'Tasks with priority (High / Medium / Low) and due date',
      'Status: Open / Completed',
      'Assignment to users with automatic notification',
      'Overdue detection',
      'Status tabs: Open / Completed / All',
      'Search, priority filter, date filter',
      'Bulk actions: delete, assign, update status',
      'Saved filter views',
    ]},
    { title: 'Activities', icon: '💬', items: [
      'Activity types: Email, Call, Meeting, Note, Task, WhatsApp',
      'Links to account, deal, lead or contact',
      'Subject, description, due date',
      'Activity feed on account and deal detail pages',
      'Chronological timeline view',
      'Assignment to users',
    ]},
    { title: 'Global Search', icon: '🔎', items: [
      'Search across all entities simultaneously (accounts, contacts, leads, deals, tasks)',
      'Keyboard shortcut ⌘K / Ctrl+K',
      'Debounced live search (300 ms)',
      'Results grouped by entity type with icons',
      'Click navigates directly to the record',
      'Escape closes the search',
    ]},
    { title: 'Notifications', icon: '🔔', items: [
      'In-app notifications with real-time badge (red count)',
      'Automatic triggers: task assigned, lead assigned',
      'Polling every 60 seconds for new notifications',
      'Mark individual or all as read',
      'Relative timestamps (e.g. "2 minutes ago")',
      'Individual notification deletion',
    ]},
    { title: 'Saved Views', icon: '🔖', items: [
      'Save filter presets per entity type and user',
      'Bookmark icon on all filter bars (Leads, Deals, Accounts, Contacts, Tasks)',
      'Load a saved view → all filters are instantly restored',
      'Delete views individually',
      'Views are user-specific (not shared)',
    ]},
    { title: 'Bulk Actions', icon: '⚡', items: [
      'Checkboxes on all list views (Leads, Deals, Accounts, Contacts, Tasks)',
      '"Select all" with indeterminate state',
      'Bulk delete with confirmation dialog',
      'Bulk assign: assign to user (Leads, Deals, Tasks)',
      'Bulk status update (Leads, Accounts, Tasks)',
      'Action bar appears dynamically when selection is active',
    ]},
    { title: 'Reports & Analytics', icon: '📊', items: [
      'Pipeline report: deals by stage (count + value)',
      'Lead report: leads by source and status',
      'Performance report: activities per sales rep',
      'Channel report: revenue by channel',
      'Account overview: top accounts by value',
      'Interactive charts via Recharts',
    ]},
    { title: 'Admin & User Management', icon: '👥', items: [
      '4 roles: Sales Rep, Account Manager, Sales Manager, Admin',
      'Fine-grained permissions per role (view, create, edit, delete)',
      'Create, edit, deactivate users',
      'Role and permission management in admin UI',
      'Permissions control sidebar visibility and button access',
    ]},
    { title: 'Settings', icon: '⚙️', items: [
      'Pipeline stages: drag & drop reordering, custom names',
      'Custom fields: define own fields per entity type',
      'Quote template: configure logo, brand color, sections',
      'Data import: Salesforce CSV/XLSX for accounts, contacts, leads, opportunities',
      'Data export: CSV download for all entities',
      'Duplicate detection and merge UI',
      'GDPR tab: data export (Art. 15) and anonymization (Art. 17) per contact',
      'Audit log: change history with before/after values',
    ]},
    { title: 'Security & Compliance', icon: '🔒', items: [
      'JWT authentication (HS256, 8 h expiry)',
      'Login rate limiting: 5/min + 20/15min per IP',
      'Global API rate limiting: 300/min per IP',
      'OWASP security headers on all responses',
      'Magic bytes validation on file uploads',
      'CORS with explicit origins (no wildcard in production)',
      'Audit log for all create/update/delete operations',
      'GDPR-compliant data export and anonymization',
    ]},
    { title: 'UX & Interface', icon: '🎨', items: [
      'Dark mode / light mode toggle (saved in localStorage)',
      'Multilingual: German and English (react-i18next)',
      'Responsive layout with collapsible sidebar',
      'Page transition animations (Framer Motion)',
      'Toast notifications for success and errors',
      'Pagination with 50 entries per page on all lists',
      'Date filters (from / to) on all lists',
      'Keyboard shortcut ⌘K for global search',
    ]},
  ],
  de: [
    { title: 'Sales Pipeline', icon: '🎯', items: [
      '20+ konfigurierbare Pipeline-Stufen (von Lead Received bis Deal Closed Won)',
      'Kanban-Ansicht mit Drag & Drop zwischen Stufen',
      'Tabellenansicht mit Sortierung und Filterung',
      'Stufenwechsel mit Business-Rule-Validierung (z.B. kein Quote Sent ohne Quote)',
      'Deal-Typen: Standard, Barter, Custom',
      'Wahrscheinlichkeit, Wert (EUR), Menge, Produkttyp, Close-Date',
      'Lost-Reason-Pflichtfeld bei Verlust',
      'Deal-Detailseite mit vollständiger Aktivitäts-Timeline',
    ]},
    { title: 'Lead Management', icon: '🔍', items: [
      'Lead-Erfassung mit Quellen-Tracking (E-Mail, Website, Event, Referral, Manuell)',
      'Status-Workflow: New → Contacted → Qualified → Converted',
      'Lead-to-Deal-Konvertierung mit optionaler Account-Erstellung',
      'Suche über Firmenname, Kontaktname und E-Mail',
      'Zuweisung an Sales-Reps mit Benachrichtigung',
      'Datum-Filter (created_after / created_before)',
      'Bulk-Aktionen: Löschen, Zuweisen, Status setzen',
      'Gespeicherte Filter-Views',
    ]},
    { title: 'Account Management', icon: '🏢', items: [
      'Account-Typen: B2B, B2B2C',
      'Status: Active, Inactive, Prospect',
      'Felder: Industrie, Land, Region, Website, Adresse',
      'Account-Detailseite mit verknüpften Deals, Contacts, Aktivitäten',
      'Anhänge pro Account (Dateiupload mit MIME-Validierung)',
      'Fuzzy-Duplikatserkennung beim Anlegen',
      'Bulk-Aktionen: Löschen, Status setzen',
      'Gespeicherte Filter-Views',
    ]},
    { title: 'Contact Management', icon: '👤', items: [
      'Kontakte verknüpft mit Accounts',
      'Primär-Kontakt-Flag pro Account',
      'Felder: Vorname, Nachname, E-Mail, Telefon, Titel',
      'Suche über Name und E-Mail',
      'Duplikat-Erkennung und Merge-Funktion',
      'GDPR-Export (Art. 15) und Anonymisierung (Art. 17)',
      'Bulk-Aktionen: Löschen',
      'Gespeicherte Filter-Views',
    ]},
    { title: 'Quotes / Angebote', icon: '📄', items: [
      'Quote Builder mit Zeilenartikeln (Produkt, Menge, Einzelpreis, Versand, Produktion)',
      'Mehrere Versionen pro Deal (automatische Versionierung)',
      'Status-Workflow: Draft → Sent → Negotiating → Accepted / Rejected',
      'PDF-Generierung mit Firmenlogo und Branding',
      'Konfigurierbares Quote-Template (Logo, Markenfarbe, Sektionen)',
      'Filter nach Status und Datum',
      'Direkter PDF-Download mit Token-Auth',
    ]},
    { title: 'Tasks', icon: '✅', items: [
      'Aufgaben mit Priorität (High / Medium / Low) und Fälligkeitsdatum',
      'Status: Open / Completed',
      'Zuweisung an Benutzer mit automatischer Benachrichtigung',
      'Überfälligkeits-Erkennung',
      'Status-Tabs: Open / Completed / All',
      'Suche, Prioritäts-Filter, Datum-Filter',
      'Bulk-Aktionen: Löschen, Zuweisen, Status setzen',
      'Gespeicherte Filter-Views',
    ]},
    { title: 'Aktivitäten', icon: '💬', items: [
      'Aktivitäts-Typen: E-Mail, Anruf, Meeting, Notiz, Task, WhatsApp',
      'Verknüpfung mit Account, Deal, Lead oder Contact',
      'Betreff, Beschreibung, Fälligkeitsdatum',
      'Aktivitäts-Feed auf Account- und Deal-Detailseiten',
      'Chronologische Timeline-Ansicht',
      'Zuweisung an Benutzer',
    ]},
    { title: 'Global Search', icon: '🔎', items: [
      'Suche über alle Entitäten gleichzeitig (Accounts, Contacts, Leads, Deals, Tasks)',
      'Tastaturkürzel ⌘K / Ctrl+K',
      'Debounced Live-Suche (300 ms)',
      'Ergebnisse gruppiert nach Entitäts-Typ mit Icons',
      'Klick auf Ergebnis navigiert direkt zum Datensatz',
      'Escape schließt die Suche',
    ]},
    { title: 'Notifications', icon: '🔔', items: [
      'In-App-Benachrichtigungen mit Echtzeit-Badge (rote Zahl)',
      'Automatische Auslöser: Task zugewiesen, Lead zugewiesen',
      'Polling alle 60 Sekunden für neue Benachrichtigungen',
      'Einzel- oder Alle-als-gelesen markieren',
      'Relativer Zeitstempel (z.B. „2 minutes ago")',
      'Benachrichtigungen einzeln löschbar',
    ]},
    { title: 'Saved Views', icon: '🔖', items: [
      'Filter-Presets pro Entitäts-Typ und Benutzer speichern',
      'Bookmark-Icon auf allen Filterleisten (Leads, Deals, Accounts, Contacts, Tasks)',
      'Gespeicherte View laden → alle Filter werden sofort wiederhergestellt',
      'Views einzeln löschbar',
      'Views sind benutzerspezifisch (nicht geteilt)',
    ]},
    { title: 'Bulk Actions', icon: '⚡', items: [
      'Checkboxen auf allen Listenansichten (Leads, Deals, Accounts, Contacts, Tasks)',
      '„Select All" mit Indeterminate-State',
      'Bulk Delete mit Bestätigungsdialog',
      'Bulk Assign: Zuweisung an Benutzer (Leads, Deals, Tasks)',
      'Bulk Status Update (Leads, Accounts, Tasks)',
      'Action-Bar erscheint dynamisch bei Auswahl',
    ]},
    { title: 'Reports & Analytics', icon: '📊', items: [
      'Pipeline-Report: Deals nach Stufe (Anzahl + Wert)',
      'Lead-Report: Leads nach Quelle und Status',
      'Performance-Report: Aktivitäten pro Sales-Rep',
      'Channel-Report: Umsatz nach Kanal',
      'Account-Übersicht: Top-Accounts nach Wert',
      'Interaktive Charts via Recharts',
    ]},
    { title: 'Admin & Benutzerverwaltung', icon: '👥', items: [
      '4 Rollen: Sales Rep, Account Manager, Sales Manager, Admin',
      'Feingranulare Berechtigungen pro Rolle (view, create, edit, delete)',
      'Benutzer anlegen, bearbeiten, deaktivieren',
      'Rollen- und Berechtigungsverwaltung in der Admin-UI',
      'Permissions steuern Sidebar-Sichtbarkeit und Button-Zugriff',
    ]},
    { title: 'Einstellungen', icon: '⚙️', items: [
      'Pipeline-Stufen: Drag & Drop Reihenfolge, Namen anpassen',
      'Custom Fields: Eigene Felder pro Entitäts-Typ definieren',
      'Quote-Template: Logo, Markenfarbe, Sektionen konfigurieren',
      'Daten-Import: Salesforce CSV/XLSX für Accounts, Contacts, Leads, Opportunities',
      'Daten-Export: CSV-Download aller Entitäten',
      'Duplikate-Erkennung und Merge-UI',
      'GDPR-Tab: Datenexport (Art. 15) und Anonymisierung (Art. 17) pro Kontakt',
      'Audit-Log: Änderungshistorie mit Vorher/Nachher-Werten',
    ]},
    { title: 'Sicherheit & Compliance', icon: '🔒', items: [
      'JWT-Authentifizierung (HS256, 8h Ablauf)',
      'Login-Rate-Limiting: 5/min + 20/15min pro IP',
      'Globales API-Rate-Limiting: 300/min pro IP',
      'OWASP Security Headers auf allen Responses',
      'Magic-Bytes-Validierung bei Datei-Uploads',
      'CORS mit expliziten Origins (kein Wildcard in Prod)',
      'Audit-Log für alle Create/Update/Delete-Operationen',
      'GDPR-konformer Datenexport und Anonymisierung',
    ]},
    { title: 'UX & Interface', icon: '🎨', items: [
      'Dark Mode / Light Mode Toggle (gespeichert in localStorage)',
      'Mehrsprachigkeit: Deutsch und Englisch (react-i18next)',
      'Responsive Layout mit collapsible Sidebar',
      'Seitenübergangs-Animationen (Framer Motion)',
      'Toast-Notifications für Erfolg und Fehler',
      'Pagination mit 50 Einträgen pro Seite auf allen Listen',
      'Datum-Filter (Von / Bis) auf allen Listen',
      'Tastaturkürzel ⌘K für Global Search',
    ]},
  ],
}

const PRODUCTIVITY = {
  en: [
    { icon: '🔎', title: 'Global Search (⌘K)',
      desc: 'Search across accounts, contacts, leads, deals and tasks simultaneously. Keyboard shortcut ⌘K / Ctrl+K opens it instantly from any page.' },
    { icon: '🔔', title: 'Notifications',
      desc: 'In-app notifications with red badge. Automatic triggers on task or lead assignment. Polling every 60 seconds.' },
    { icon: '🔖', title: 'Saved Views',
      desc: 'Save active filters on any list page as a named view. Restore with one click — per user and entity type.' },
    { icon: '⚡', title: 'Bulk Actions',
      desc: 'Select multiple records and delete, assign or update status at once. Available on all five list pages.' },
  ],
  de: [
    { icon: '🔎', title: 'Global Search (⌘K)',
      desc: 'Sucht gleichzeitig über Accounts, Contacts, Leads, Deals und Tasks. Tastaturkürzel ⌘K / Ctrl+K öffnet die Suche sofort aus jeder Seite.' },
    { icon: '🔔', title: 'Notifications',
      desc: 'In-App-Benachrichtigungen mit rotem Badge. Automatische Auslöser bei Task- oder Lead-Zuweisung. Polling alle 60 Sekunden.' },
    { icon: '🔖', title: 'Saved Views',
      desc: 'Aktive Filter auf jeder Listenseite als benannte View speichern. Per Klick sofort wiederherstellen – pro Benutzer und Entitäts-Typ.' },
    { icon: '⚡', title: 'Bulk Actions',
      desc: 'Mehrere Datensätze gleichzeitig auswählen und löschen, zuweisen oder Status ändern. Auf allen fünf Listenseiten verfügbar.' },
  ],
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Help() {
  const { i18n } = useTranslation()
  const isDE = i18n.language.startsWith('de')
  const [tab, setTab] = useState('usage')

  const features = isDE ? FEATURES.de : FEATURES.en
  const productivity = isDE ? PRODUCTIVITY.de : PRODUCTIVITY.en

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {[
          { key: 'usage',    label: isDE ? 'Wie es funktioniert' : 'How it works' },
          { key: 'features', label: isDE ? 'Feature-Liste' : 'Feature List' },
          { key: 'tech',     label: 'Technical Architecture' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('px-4 py-2 text-sm font-medium rounded-lg transition-all',
              tab === t.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ HOW IT WORKS ══════════ */}
      {tab === 'usage' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isDE ? 'Wie das CRM funktioniert' : 'How the CRM works'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isDE ? 'Visuelle Übersicht aller Entitäten und ihrer Verbindungen' : 'Visual overview of all entities and how they connect'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 overflow-x-auto">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-6">
              {isDE ? 'Entitäts-Beziehungen' : 'Entity Relationships'}
            </h2>
            <FlowChart />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-6">
              {isDE ? 'Deal Pipeline Stufen' : 'Deal Pipeline Stages'}
            </h2>
            <div className="space-y-3">
              {PHASES.map(phase => (
                <div key={phase.label} className="flex items-start gap-3">
                  <span className={clsx('flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full w-28 text-center', phase.color)}>
                    {phase.label}
                  </span>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {phase.stages.map((stage, i) => (
                      <div key={stage} className="flex items-center gap-1.5">
                        <span className="text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {STAGE_LABEL[stage]}
                        </span>
                        {i < phase.stages.length - 1 && (
                          <ArrowRightIcon className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <p className="sm:col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {isDE ? 'Stufenbedingungen' : 'Stage gates'}
              </p>
              {[
                ['≥ Negotiation', isDE ? 'Quote muss verknüpft sein' : 'Quote must be linked'],
                ['≥ Order Confirmed', isDE ? 'Feasibility muss geprüft sein' : 'Feasibility must be checked'],
                ['≥ Production Planning', isDE ? 'Artwork muss genehmigt sein' : 'Artwork must be approved'],
                ['Payment Received / Closed Won', isDE ? 'Invoice-Referenz erforderlich' : 'Invoice reference required'],
                ['Lost', isDE ? 'Lost Reason muss angegeben werden' : 'Lost reason must be provided'],
              ].map(([gate, rule]) => (
                <div key={gate} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 mt-0.5 w-2 h-2 rounded-full bg-amber-400" />
                  <span><span className="font-semibold text-gray-700 dark:text-gray-200">{gate}:</span>{' '}<span className="text-gray-500 dark:text-gray-400">{rule}</span></span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-6">
              {isDE ? 'Entitäts-Kurzreferenz' : 'Entity Quick Reference'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ENTITIES.map(({ color, icon: Icon, title, desc, badges }) => {
                const c = C[color]
                return (
                  <div key={title} className="rounded-xl border-2 p-4" style={{ borderColor: c.border, backgroundColor: c.bg }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm">
                        <Icon className={clsx('w-4 h-4', c.icon)} />
                      </div>
                      <span className="font-semibold text-gray-800 text-sm">{title}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{desc}</p>
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {badges.map(b => (
                          <span key={b} className={clsx('inline-block text-xs px-1.5 py-0.5 rounded font-medium', c.badge)}>{b}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Productivity Features */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-5">
              {isDE ? 'Produktivitäts-Features' : 'Productivity Features'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {productivity.map(f => (
                <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                  <span className="text-2xl leading-none flex-shrink-0">{f.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{f.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ FEATURE LIST ══════════ */}
      {tab === 'features' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isDE ? 'Feature-Liste' : 'Feature List'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isDE
                ? 'Vollständige Übersicht aller enthaltenen CRM-Funktionen'
                : 'Complete overview of all included CRM features'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
            {features.map(({ title, icon, items }) => (
              <div key={title} className="p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-base leading-none">{icon}</span>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 pl-7">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-500 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ TECHNICAL ARCHITECTURE ══════════ */}
      {tab === 'tech' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Technical Architecture</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isDE
                ? 'Vollständige technische Dokumentation — Stack, Modulstruktur, Request-Lifecycle, Sicherheit und Datenbankschema'
                : 'Full technical documentation — stack, module structure, request lifecycle, security and database schema'}
            </p>
          </div>

          {/* ── System Architecture Diagram ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 overflow-x-auto">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <ServerIcon className="w-4 h-4" /> System Architecture
            </h2>
            <ArchDiagram />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600 dark:text-gray-400">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Entry point</p>
                <code className="text-brand-600 dark:text-brand-400">uvicorn app.main:app</code>
                <p className="mt-1">FastAPI serves all API endpoints under <code>/api/v1/</code>. The React frontend is built separately and served as static files (or via Vite dev server on port 5173).</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Async I/O</p>
                <p>All DB access uses SQLAlchemy 2 with the <code>asyncpg</code> driver. Each HTTP request gets its own session from the connection pool (pool_size=10, max_overflow=20).</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Storage strategy</p>
                <p>In dev mode files are stored locally under <code>backend/uploads/</code>. In production Supabase Storage (S3-compatible) takes over. The abstraction lives in <code>services/storage.py</code>.</p>
              </div>
            </div>
          </div>

          {/* ── Tech Stack ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-5 flex items-center gap-2">
              <CubeTransparentIcon className="w-4 h-4" /> Tech Stack
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { title: '⚛️  Frontend', items: STACK.frontend },
                { title: '🐍  Backend', items: STACK.backend },
              ].map(({ title, items }) => (
                <div key={title}>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{title}</h3>
                  <div className="space-y-1.5">
                    {items.map(({ name, role }) => (
                      <div key={name} className="flex items-baseline gap-2 text-sm">
                        <code className="text-xs font-mono text-brand-600 dark:text-brand-400 w-44 flex-shrink-0">{name}</code>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Backend Module Structure ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-5 flex items-center gap-2">
              <CodeBracketIcon className="w-4 h-4" /> Backend Module Structure
            </h2>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 text-xs font-mono overflow-x-auto">
              <Tree nodes={MODULES} />
            </div>
          </div>

          {/* ── Request Lifecycle ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-5 flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4" /> Request Lifecycle
            </h2>
            <div className="space-y-3">
              {LIFECYCLE.map(({ step, label, color, desc }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold', color)}>
                      {step}
                    </span>
                    {step !== '6' && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 my-1 h-4" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Security ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-5 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4" /> Security
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SECURITY.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center">
                    <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Database Schema ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-5 flex items-center gap-2">
              <CircleStackIcon className="w-4 h-4" /> Database Tables
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                    <th className="pb-2 pr-4 font-semibold uppercase tracking-wide">Table</th>
                    <th className="pb-2 pr-4 font-semibold uppercase tracking-wide">Foreign Keys</th>
                    <th className="pb-2 font-semibold uppercase tracking-wide">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {TABLES.map(({ name, fks, note }) => (
                    <tr key={name} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                      <td className="py-2 pr-4">
                        <code className="font-mono text-brand-600 dark:text-brand-400 font-semibold">{name}</code>
                      </td>
                      <td className="py-2 pr-4 text-gray-400 dark:text-gray-500 font-mono">
                        {fks.length ? fks.join(', ') : '—'}
                      </td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              Migrations managed with Alembic. Current head revision: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">c2d3e4f5a6b7</code> (v4: notifications + saved_views tables).
              Apply changes: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">alembic upgrade head</code>
            </p>
          </div>

          {/* ── Frontend Structure ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-5 flex items-center gap-2">
              <CubeTransparentIcon className="w-4 h-4" /> Frontend Structure
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              {[
                { folder: 'src/pages/', desc: 'One component per route. Each page manages its own data fetching, filter state, and pagination. Pages do NOT share state — they talk only to the API layer.' },
                { folder: 'src/components/', desc: 'Reusable UI components: ActivityFeed, AttachmentGallery, Pipeline (Kanban), QuoteBuilder, GlobalSearch, NotificationsPanel, SavedViewsDropdown, BulkActionBar, Sidebar, Layout, ThemeToggle, …' },
                { folder: 'src/hooks/', desc: 'Custom hooks: useBulkSelect (checkbox selection state + toggleAll / toggleItem / clearSelection) — returns selectedIds, hasSelection, count, allSelected, someSelected.' },
                { folder: 'src/api/', desc: 'Thin API wrapper modules (leads.js, deals.js, search.js, notifications.js, saved_views.js, users.js, …). Each exports a named object with typed methods. All calls go through axios client.js with automatic JWT injection.' },
                { folder: 'src/contexts/', desc: 'React Context providers: AuthContext (user + token), ThemeContext (dark/light), PermissionsContext (role-based permission lookup via can(perm)).' },
                { folder: 'src/store.js', desc: 'Zustand store for UI-only state: sidebarOpen, dealViewMode. Persisted to localStorage.' },
                { folder: 'src/i18n/', desc: 'i18next translation files (en.json, de.json). Language is detected from browser and falls back to EN. Keys follow entity.field naming.' },
              ].map(({ folder, desc }) => (
                <div key={folder} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                  <code className="text-brand-600 dark:text-brand-400 font-semibold font-mono">{folder}</code>
                  <p className="mt-1.5 text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Environment Variables ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <ServerIcon className="w-4 h-4" /> Key Environment Variables
            </h2>
            <div className="bg-gray-900 rounded-xl p-4 text-xs font-mono text-green-400 space-y-1 overflow-x-auto">
              {[
                ['DATABASE_URL',          'postgresql+asyncpg://user:pass@host/db'],
                ['SECRET_KEY',            '32+ byte random string for JWT signing'],
                ['ALGORITHM',             'HS256'],
                ['ACCESS_TOKEN_EXPIRE',   'Minutes until JWT expires (e.g. 480)'],
                ['CORS_ORIGINS',          'https://crm.example.com,http://localhost:5173'],
                ['DEBUG',                 'false in production (disables /api/docs)'],
                ['SUPABASE_URL',          'https://xxx.supabase.co  (optional)'],
                ['SUPABASE_KEY',          'service_role key for storage (optional)'],
                ['MS_CLIENT_ID',          'Azure AD app ID for Graph integration (optional)'],
                ['MS_CLIENT_SECRET',      'Azure AD client secret (optional)'],
                ['MS_TENANT_ID',          'Azure AD tenant ID (optional)'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-4">
                  <span className="text-amber-400 w-52 flex-shrink-0">{k}</span>
                  <span className="text-gray-400"># {v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
