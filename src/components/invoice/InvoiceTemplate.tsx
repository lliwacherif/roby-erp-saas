import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export type InvoiceParty = {
  label: string
  name?: string | null
  lines?: Array<string | null | undefined>
  taxId?: string | null
}

export type InvoiceMetaItem = {
  label: string
  value: ReactNode
}

export type InvoiceColumn = {
  key: string
  header: string
  align?: 'left' | 'center' | 'right'
  className?: string
}

export type InvoiceRow = {
  id: string
  cells: ReactNode[]
}

export type InvoiceTotalRow = {
  label: string
  value: ReactNode
  emphasis?: 'normal' | 'strong' | 'grand'
  tone?: 'default' | 'danger' | 'success'
}

type InvoiceTemplateProps = {
  title: string
  subtitle?: string
  documentNumber?: string
  issueDate?: string
  badge?: string
  logoUrl?: string | null
  company: InvoiceParty
  counterparty: InvoiceParty
  referenceTitle?: string
  referenceItems?: InvoiceMetaItem[]
  columns: InvoiceColumn[]
  rows: InvoiceRow[]
  emptyMessage?: string
  totals: InvoiceTotalRow[]
  currencyLabel?: string
  signatureLabel?: string
  accent?: 'blue' | 'emerald' | 'amber' | 'rose'
}

const accentStyles = {
  blue: {
    chip: 'bg-blue-50 text-blue-700 ring-blue-200',
    total: 'bg-blue-700 text-white',
  },
  emerald: {
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    total: 'bg-emerald-700 text-white',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-700 ring-amber-200',
    total: 'bg-amber-600 text-white',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-700 ring-rose-200',
    total: 'bg-rose-700 text-white',
  },
}

const invoiceStatusLabels: Record<string, string> = {
  annule: 'Annulée',
  cancelled: 'Annulée',
  confirmed: 'Confirmée',
  draft: 'Brouillon',
  disputed: 'Litige',
  matched: 'Rapprochee',
  partiellement_recu: 'Partiellement reçu',
  recu: 'Reçu',
  recorded: 'Enregistrée',
  reservee: 'Réservée',
  returned: 'Retournée',
  validated: 'Validée',
}

const compactLines = (party: InvoiceParty) =>
  [party.name, ...(party.lines || []), party.taxId ? 'MF / RC: ' + party.taxId : null]
    .filter((line): line is string => Boolean(line))

export const formatInvoiceStatusLabel = (status?: string | null) => {
  if (!status) return '-'
  return invoiceStatusLabels[status.trim().toLowerCase()] || status
}

const initialsFrom = (value?: string | null) => {
  const initials = (value || 'RO')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return initials || 'RO'
}

const alignClass = (align?: InvoiceColumn['align']) => {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

export function InvoicePrintStyles() {
  return (
    <style>{`
      @media print {
        html, body {
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: white !important;
        }
        body * { visibility: hidden !important; }
        .print-area, .print-area * { visibility: visible !important; }
        .print-area {
          position: fixed !important;
          inset: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: white !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-area .invoice-sheet {
          height: 297mm !important;
          padding: 9mm 10mm 8mm !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 4mm !important;
          box-sizing: border-box !important;
        }
        .print-area .invoice-header {
          gap: 4mm !important;
          padding-bottom: 4mm !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .print-area .invoice-title {
          font-size: 22px !important;
          line-height: 1.1 !important;
        }
        .print-area .invoice-company-name {
          font-size: 16px !important;
          line-height: 1.2 !important;
        }
        .print-area .invoice-party-name {
          font-size: 13px !important;
          line-height: 1.15 !important;
        }
        .print-area .invoice-top-grid {
          gap: 0 !important;
          padding: 2.5mm 0 !important;
        }
        .print-area .invoice-card,
        .print-area .invoice-reference,
        .print-area .invoice-table-section,
        .print-area .invoice-summary,
        .print-area .invoice-footer {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .print-area .invoice-meta-panel {
          padding: 2.8mm 3mm !important;
        }
        .print-area .invoice-meta-label {
          font-size: 8px !important;
          letter-spacing: 0.08em !important;
        }
        .print-area .invoice-meta-lines,
        .print-area .invoice-reference-list {
          margin-top: 1.5mm !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
        }
        .print-area .invoice-meta-lines {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .print-area .invoice-reference-list {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
        .print-area .invoice-table-section {
          overflow: hidden !important;
        }
        .print-area .invoice-table-scroller {
          overflow: visible !important;
        }
        .print-area .invoice-table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          font-size: 11px !important;
          color: #0f172a !important;
        }
        .print-area .invoice-table thead tr {
          background: #f8fafc !important;
          color: #0f172a !important;
          border-bottom: 1px solid #cbd5e1 !important;
        }
        .print-area .invoice-table tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .print-area .invoice-table th,
        .print-area .invoice-table td {
          padding: 2.3mm 2.2mm !important;
          word-break: break-word !important;
          color: #0f172a !important;
          background: white !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .print-area .invoice-table th {
          background: #f8fafc !important;
          color: #0f172a !important;
          font-weight: 800 !important;
        }
        .print-area .invoice-table td *,
        .print-area .invoice-table th * {
          color: #0f172a !important;
        }
        .print-area .invoice-table th:first-child,
        .print-area .invoice-table td:first-child {
          width: 34% !important;
        }
        .print-area .invoice-summary {
          margin-top: 4mm !important;
          gap: 4mm !important;
          align-items: end !important;
        }
        .print-area .invoice-totals .invoice-total-row {
          padding: 2.5mm 2.6mm !important;
          font-size: 11px !important;
        }
        .print-area .invoice-footer {
          margin-top: auto !important;
          padding-top: 4mm !important;
        }
        .print-area .invoice-branding {
          font-size: 9px !important;
          line-height: 1.4 !important;
        }
        .print-area .invoice-branding strong {
          font-size: 9px !important;
        }
        .print-hidden { display: none !important; }
        @page { size: A4 portrait; margin: 0; }
      }
    `}</style>
  )
}

export function InvoiceTemplate({
  title,
  subtitle,
  documentNumber,
  issueDate,
  badge,
  logoUrl,
  company,
  counterparty,
  referenceTitle = 'Références',
  referenceItems = [],
  columns,
  rows,
  emptyMessage = 'Aucune ligne à afficher.',
  totals,
  currencyLabel = 'DT',
  signatureLabel = 'Cachet et signature',
  accent = 'blue',
}: InvoiceTemplateProps) {
  const accentStyle = accentStyles[accent]
  const companyLines = compactLines(company)
  const counterpartyLines = compactLines(counterparty)
  const badgeLabel = formatInvoiceStatusLabel(badge)

  return (
    <div className="print-area mx-auto w-full max-w-[210mm] min-h-[297mm] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
      <div className="invoice-sheet flex min-h-[297mm] flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8">
        <header className="invoice-header grid gap-6 border-b border-slate-200 pb-6 md:grid-cols-[1fr_auto]">
          <div className="flex min-w-0 items-start gap-4">
            {logoUrl ? (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-4 ring-slate-100">
                <img src={logoUrl} alt={company.name || 'Logo'} className="h-full w-full object-contain p-1.5" />
              </div>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-lg font-black text-white ring-4 ring-slate-100">
                {initialsFrom(company.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{company.label}</p>
              <h2 className="invoice-company-name mt-1 break-words text-xl font-extrabold text-slate-950">
                {company.name || '-'}
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                {companyLines.slice(1).map((line, index) => (
                  <span key={`${line}-${index}`}>{line}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="text-left md:text-right">
            {badgeLabel !== '-' && (
              <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1', accentStyle.chip)}>
                {badgeLabel}
              </span>
            )}
            <h1 className="invoice-title mt-3 text-3xl font-black uppercase tracking-normal text-slate-950">{title}</h1>
            {subtitle && <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:justify-end">
              <span className="text-slate-400">No</span>
              <span className="font-bold text-slate-900">{documentNumber || '-'}</span>
              <span className="text-slate-400">Date</span>
              <span className="font-bold text-slate-900">{issueDate || '-'}</span>
            </div>
          </div>
        </header>

        <section className="invoice-top-grid grid overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-[1.05fr_0.95fr]">
          <div className="invoice-card invoice-meta-panel border-b border-slate-200 bg-slate-50/70 p-3 md:border-b-0 md:border-r">
            <p className="invoice-meta-label text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{counterparty.label}</p>
            <h3 className="invoice-party-name mt-1 break-words text-base font-bold text-slate-950">{counterparty.name || '-'}</h3>
            <div className="invoice-meta-lines mt-2 grid gap-x-3 gap-y-0.5 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              {counterpartyLines.slice(1).length ? (
                counterpartyLines.slice(1).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
              ) : (
                <p>-</p>
              )}
            </div>
          </div>

          <div className="invoice-reference invoice-meta-panel p-3">
            <p className="invoice-meta-label text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{referenceTitle}</p>
            <div className="invoice-reference-list mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs leading-5 sm:grid-cols-4">
              {referenceItems.length ? (
                referenceItems.map((item) => (
                  <div key={item.label} className="contents">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="break-words text-right font-semibold text-slate-800">{item.value || '-'}</span>
                  </div>
                ))
              ) : (
                <p className="col-span-2 text-slate-500">-</p>
              )}
            </div>
          </div>
        </section>

        <section className="invoice-table-section overflow-hidden rounded-lg border border-slate-200">
          <div className="invoice-table-scroller overflow-x-auto">
            <table className="invoice-table w-full min-w-[680px] text-sm">
              <thead>
                <tr className="bg-slate-950 text-white">
                  {columns.map((column) => (
                    <th key={column.key} className={clsx('px-4 py-3 text-xs font-bold uppercase', alignClass(column.align), column.className)}>
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      {row.cells.map((cell, index) => (
                        <td
                          key={`${row.id}-${columns[index]?.key || index}`}
                          className={clsx('px-4 py-3 text-slate-700', alignClass(columns[index]?.align), columns[index]?.className)}
                        >
                          <div className="invoice-cell-content">{cell}</div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="invoice-summary mt-6 flex justify-end">
          <div className="invoice-totals w-full max-w-[320px] overflow-hidden rounded-lg border border-slate-200">
            {totals.map((row) => (
              <div
                key={row.label}
                className={clsx(
                  'invoice-total-row flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0',
                  row.emphasis === 'grand' ? accentStyle.total : 'bg-white',
                  row.emphasis === 'strong' && 'font-bold text-slate-950',
                  row.tone === 'danger' && row.emphasis !== 'grand' && 'text-red-600',
                  row.tone === 'success' && row.emphasis !== 'grand' && 'text-emerald-700'
                )}
              >
                <span className={clsx(row.emphasis === 'grand' ? 'font-bold' : 'text-slate-500')}>{row.label}</span>
                <span className="whitespace-nowrap font-extrabold">
                  {row.value} {currencyLabel}
                </span>
              </div>
            ))}
          </div>
        </section>

        <footer className="invoice-footer mt-8 border-t border-slate-200 pt-6">
          <div className="invoice-signature">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Validation</p>
            <div className="mt-10 h-px w-56 max-w-full bg-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-800">{signatureLabel}</p>
          </div>
          <div className="invoice-branding mt-3 text-center text-[9px] leading-tight text-slate-400">
            <p className="font-semibold uppercase tracking-[0.14em] text-slate-500">ROBY</p>
            <p className="mt-0.5">Document généré depuis le système de gestion.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

