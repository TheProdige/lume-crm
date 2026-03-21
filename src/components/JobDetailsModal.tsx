import React, { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  FileText,
  Users,
  Briefcase
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { getJobLineItems, type JobLineItem } from '../lib/jobsApi';
import type { Job } from '../types';

interface JobDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  job: Job | null;
}

export default function JobDetailsModal({ isOpen, onClose, onEdit, onDelete, job }: JobDetailsModalProps) {
  const { t } = useTranslation();
  const [lineItems, setLineItems] = useState<JobLineItem[]>([]);

  useEffect(() => {
    if (!isOpen || !job?.id) {
      setLineItems([]);
      return;
    }
    getJobLineItems(job.id).then(setLineItems).catch(() => setLineItems([]));
  }, [isOpen, job?.id]);

  if (!job) return null;

  const handleDelete = () => {
    if (window.confirm(t.modals.deleteJobConfirm)) {
      onDelete(job.id);
    }
  };

  const jobAddress = job.property_address || job.address || null;
  const scheduledDate = job.scheduled_at ? new Date(job.scheduled_at) : null;
  const endDate = job.end_at ? new Date(job.end_at) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8 bg-black/40 backdrop-blur-md overflow-hidden">
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="bg-surface w-full max-w-2xl max-h-full flex flex-col shadow-2xl border border-border rounded-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-8 border-b border-border flex justify-between items-start bg-surface-secondary/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-black">
                  <Briefcase size={28} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold tracking-tight text-text-primary">{job.title}</h2>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      job.status === 'Completed' ? "bg-success-light text-success border-success" :
                      job.status === 'Scheduled' ? "bg-info-light text-info border-info" :
                      job.status === 'Cancelled' ? "bg-danger-light text-danger border-danger" :
                      "bg-warning-light text-warning border-warning"
                    )}>
                      {job.status || 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-text-tertiary flex items-center gap-2">
                    Job #{job.job_number || job.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface-tertiary rounded-full transition-colors text-text-tertiary hover:text-black"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-surface">
              {/* Client Info Section */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary flex items-center gap-2">
                  <User size={12} /> {t.modals.clientInfo}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-secondary p-6 rounded-2xl border border-border">
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-text-primary">{job.client_name || t.modals.unassigned}</p>
                    <div className="flex items-start gap-2 text-xs text-text-secondary">
                      <MapPin size={14} className="mt-0.5 text-text-tertiary" />
                      <span>{jobAddress || t.modals.noAddress}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Schedule & Team Section */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary flex items-center gap-2">
                  <Calendar size={12} /> {t.modals.scheduleAssignment}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">{t.modals.date}</p>
                    <p className="text-sm font-bold text-text-primary">
                      {scheduledDate ? format(scheduledDate, 'EEEE, MMM d, yyyy') : 'Not scheduled'}
                    </p>
                  </div>
                  <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">{t.modals.timeWindow}</p>
                    <p className="text-sm font-bold text-text-primary">
                      {scheduledDate ? format(scheduledDate, 'HH:mm') : '--:--'} - {endDate ? format(endDate, 'HH:mm') : '--:--'}
                    </p>
                  </div>
                  <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">{t.modals.assignedTeam}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                        <Users size={10} className="text-white" />
                      </div>
                      <p className="text-sm font-bold text-text-primary">{job.team_id ? 'Assigned' : t.modals.unassigned}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Financials & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <section className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary flex items-center gap-2">
                    <DollarSign size={12} /> {t.modals.financials}
                  </h3>
                  <div className="bg-black p-6 rounded-2xl shadow-xl">
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">{t.modals.totalJobValue}</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency((job.total_cents || 0) / 100)}</p>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary flex items-center gap-2">
                    <FileText size={12} /> {t.modals.internalNotes}
                  </h3>
                  <div className="bg-warning-light/50 border border-warning p-6 rounded-2xl min-h-[100px]">
                    <p className="text-xs text-text-secondary leading-relaxed italic">
                      {job.notes || job.description || t.modals.noNotesProvided}
                    </p>
                  </div>
                </section>
              </div>

              {/* Line Items */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary flex items-center gap-2">
                  <Briefcase size={12} /> {t.modals.servicesIncluded}
                </h3>
                <div className="border border-border rounded-2xl overflow-hidden">
                  {lineItems.length > 0 ? (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-secondary border-b border-border">
                        <tr>
                          <th className="px-6 py-3 font-bold text-text-secondary uppercase tracking-widest text-[10px]">{t.modals.service}</th>
                          <th className="px-6 py-3 font-bold text-text-secondary uppercase tracking-widest text-[10px] text-center">Qty</th>
                          <th className="px-6 py-3 font-bold text-text-secondary uppercase tracking-widest text-[10px] text-right">{t.payments.amount}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {lineItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 font-medium text-text-primary">{item.name || 'Unnamed item'}</td>
                            <td className="px-6 py-4 text-center text-text-secondary">{item.qty}</td>
                            <td className="px-6 py-4 text-right font-bold text-text-primary">
                              {formatCurrency(item.total_cents / 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-6 py-5 text-xs font-medium text-text-tertiary">
                      {t.modals.noServicesListed}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Footer Action Bar */}
            <div className="p-8 border-t border-border flex justify-between items-center bg-surface-secondary/50">
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 text-danger hover:text-danger text-sm font-bold transition-all px-4 py-2 rounded-xl hover:bg-danger-light"
              >
                <Trash2 size={18} /> {t.modals.deleteJob}
              </button>
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-sm font-bold text-text-secondary hover:text-black transition-all"
                >
                  {t.common.close}
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                  className="bg-black text-white hover:bg-text-primary px-8 py-3 text-sm font-bold rounded-2xl flex items-center gap-2 transition-all shadow-xl hover:-translate-y-0.5"
                >
                  <Edit2 size={18} /> {t.modals.editJob}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
