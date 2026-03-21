import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '../i18n';
import {
  formatMoneyFromCents,
  getCompanySettings,
  getInvoiceById,
  getOrgBillingSettings,
  listInvoiceTemplates,
  listVisualTemplates,
  saveInvoiceDraft,
  sendInvoice,
} from '../lib/invoicesApi';
import InvoiceRenderer from './invoice/InvoiceRenderer';
import { buildRenderData } from './invoice/buildRenderData';
import InvoiceTemplatePicker from './invoice/InvoiceTemplatePicker';
import type { InvoiceLayoutType } from './invoice/types';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  invoiceId: string | null;
  onClose: () => void;
  onSent?: () => void | Promise<void>;
}

export default function InvoicePreviewModal({ isOpen, invoiceId, onClose, onSent }: InvoicePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getInvoiceById>>>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [billingSettings, setBillingSettings] = useState<any>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailTo, setEmailTo] = useState('');
  const [phoneTo, setPhoneTo] = useState('');
  const [company, setCompany] = useState<any>(null);
  const [visualTemplates, setVisualTemplates] = useState<any[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<InvoiceLayoutType>('classic');
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen || !invoiceId) return;
    setLoading(true);
    Promise.all([getInvoiceById(invoiceId), listInvoiceTemplates(), getOrgBillingSettings(), getCompanySettings(), listVisualTemplates()])
      .then(([invoiceDetail, templateRows, settings, companyInfo, visTpls]) => {
        setDetail(invoiceDetail);
        setTemplates(templateRows || []);
        setBillingSettings(settings || null);
        setCompany(companyInfo || null);
        setVisualTemplates(visTpls || []);
        setEmailTo(invoiceDetail?.client?.email || '');
        setPhoneTo(invoiceDetail?.client?.phone || '');
        setEmailEnabled(Boolean(invoiceDetail?.client?.email));
        setSmsEnabled(Boolean(invoiceDetail?.client?.phone));
        // Pick layout from invoice template if set
        const tplId = (invoiceDetail?.invoice as any)?.template_id;
        if (tplId) {
          const tpl = visTpls?.find((t: any) => t.id === tplId);
          if (tpl?.layout_type) setSelectedLayout(tpl.layout_type as InvoiceLayoutType);
        }
      })
      .catch((error: any) => {
        toast.error(error?.message || t.modals.failedLoadPreview);
      })
      .finally(() => setLoading(false));
  }, [invoiceId, isOpen]);

  const taxCents = detail?.invoice?.tax_cents || 0;
  const subtotalCents = detail?.invoice?.subtotal_cents || 0;
  const totalCents = detail?.invoice?.total_cents || 0;
  const companyName = String(billingSettings?.company_name || 'Lume').trim() || 'Lume';

  const channels = useMemo(() => {
    const next: string[] = [];
    if (emailEnabled && emailTo.trim()) next.push('email');
    if (smsEnabled && phoneTo.trim()) next.push('sms');
    return next;
  }, [emailEnabled, emailTo, phoneTo, smsEnabled]);

  async function handleTemplateApply(templateId: string) {
    setSelectedTemplateId(templateId);
    const selected = templates.find((template) => template.id === templateId);
    if (!selected || !detail?.invoice?.id) return;
    const content = selected.content || {};
    const items = Array.isArray(content.items) ? content.items : [];
    const tax = Number(content.tax_cents || content.tax || taxCents || 0);
    try {
      await saveInvoiceDraft({
        invoiceId: detail.invoice.id,
        subject: content.subject || detail.invoice.subject || null,
        dueDate: detail.invoice.due_date || null,
        taxCents: tax,
        items: items.map((item: any) => ({
          description: String(item.description || ''),
          qty: Number(item.qty || 1),
          unit_price_cents: Number(item.unit_price_cents || 0),
        })),
      });
      const refreshed = await getInvoiceById(detail.invoice.id);
      setDetail(refreshed);
      toast.success(t.modals.templateApplied);
    } catch (error: any) {
      toast.error(error?.message || t.modals.unableApplyTemplate);
    }
  }

  async function handleImportTemplate(file: File) {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if (!detail?.invoice?.id) return;
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      await saveInvoiceDraft({
        invoiceId: detail.invoice.id,
        subject: parsed.subject || detail.invoice.subject || null,
        dueDate: detail.invoice.due_date || null,
        taxCents: Number(parsed.tax_cents || parsed.tax || 0),
        items: items.map((item: any) => ({
          description: String(item.description || ''),
          qty: Number(item.qty || 1),
          unit_price_cents: Number(item.unit_price_cents || 0),
        })),
      });
      const refreshed = await getInvoiceById(detail.invoice.id);
      setDetail(refreshed);
      toast.success(t.modals.templateImported);
    } catch (error: any) {
      toast.error(error?.message || t.modals.invalidTemplateFile);
    }
  }

  async function handleSend() {
    if (!detail?.invoice?.id || sending) return;
    if (channels.length === 0) {
      toast.info(t.modals.noContactFallback);
    }
    setSending(true);
    try {
      const result = await sendInvoice({
        invoiceId: detail.invoice.id,
        channels,
        toEmail: emailTo,
        toPhone: phoneTo,
      });
      toast.success(t.modals.invoiceSent);
      if (result.payment_link && channels.length === 0) {
        await navigator.clipboard.writeText(result.payment_link);
        toast.info(t.modals.paymentLinkCopied);
      }
      await onSent?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || t.modals.unableToSend);
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal-content max-h-[92vh] w-full max-w-5xl overflow-y-auto" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <FileText size={18} />
                <h3 className="text-2xl font-semibold tracking-tight">{t.modals.invoicePreview}</h3>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 hover:bg-surface-secondary"><X size={16} /></button>
            </div>

            {loading ? <p className="mt-4 text-sm text-text-secondary">{t.modals.loadingPreview}</p> : null}

            {!loading && detail ? (
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Visual Invoice Preview */}
                <div className="lg:col-span-2">
                  <div className="rounded-xl bg-gray-100 p-4">
                    <div className="mx-auto max-w-[540px] rounded-lg bg-white p-6 shadow-md">
                      <InvoiceRenderer
                        data={buildRenderData(detail, company, visualTemplates.find((t) => t.layout_type === selectedLayout)?.branding)}
                        layout={selectedLayout}
                      />
                    </div>
                  </div>
                </div>

                {/* Sidebar controls */}
                <div className="space-y-4">
                  {/* Template picker */}
                  <div className="rounded-xl border border-border bg-surface/70 p-4">
                    <InvoiceTemplatePicker
                      selectedLayout={selectedLayout}
                      onSelect={(l) => setSelectedLayout(l)}
                      templates={visualTemplates}
                    />
                  </div>

                  {/* Data template apply */}
                  <div className="space-y-2 rounded-xl border border-border bg-surface/70 p-4">
                    <p className="text-sm font-semibold">{t.modals.template} (Data)</p>
                    <select value={selectedTemplateId} onChange={(event) => void handleTemplateApply(event.target.value)} className="glass-input w-full">
                      <option value="">{t.modals.selectTemplate}</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Send channels */}
                  <div className="space-y-3 rounded-xl border border-border bg-surface/70 p-4">
                    <p className="text-sm font-semibold">{t.modals.sendChannels}</p>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} />
                      {t.common.email}
                    </label>
                    <input value={emailTo} onChange={(event) => setEmailTo(event.target.value)} className="glass-input w-full" placeholder="Client email" />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={smsEnabled} onChange={(event) => setSmsEnabled(event.target.checked)} />
                      SMS
                    </label>
                    <input value={phoneTo} onChange={(event) => setPhoneTo(event.target.value)} className="glass-input w-full" placeholder="Client phone" />
                    <button onClick={() => void handleSend()} className="glass-button-primary inline-flex w-full items-center justify-center gap-2" disabled={sending}>
                      <Send size={14} />
                      {sending ? t.jobDetails.sending : t.modals.sendInvoice}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
