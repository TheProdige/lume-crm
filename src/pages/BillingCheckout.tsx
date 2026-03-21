import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';

// ─── Plan definitions ───────────────────────────────────────────
interface UnlockHighlight {
  icon: React.ElementType;
  title_en: string;
  title_fr: string;
  desc_en: string;
  desc_fr: string;
  color: string;
}

interface PlanDef {
  id: string;
  name: string;
  name_fr: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features_en: string[];
  features_fr: string[];
  recommended?: boolean;
  unlocks_en: UnlockHighlight[];
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: 'Starter',
    name_fr: 'Débutant',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features_en: ['3 clients', '10 jobs per month', 'Basic invoicing', 'Email support'],
    features_fr: ['3 clients', '10 travaux par mois', 'Facturation de base', 'Support par courriel'],
    unlocks_en: [
      { icon: Rocket, title_en: 'Get started free', title_fr: 'Commencez gratuitement', desc_en: 'Try Lume CRM with no commitment', desc_fr: 'Essayez Lume CRM sans engagement', color: 'text-text-tertiary' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    name_fr: 'Pro',
    monthlyPrice: 29,
    yearlyPrice: 290,
    recommended: true,
    features_en: ['Unlimited clients', 'Unlimited jobs', 'All integrations', 'Priority support', 'Custom fields', 'Automations', 'Team management'],
    features_fr: ['Clients illimités', 'Travaux illimités', 'Toutes les intégrations', 'Support prioritaire', 'Champs personnalisés', 'Automatisations', 'Gestion d\'équipe'],
    unlocks_en: [
      { icon: Zap, title_en: 'Unlimited growth', title_fr: 'Croissance illimitée', desc_en: 'No caps on clients, jobs, or invoices', desc_fr: 'Aucune limite sur les clients, travaux ou factures', color: 'text-text-secondary' },
      { icon: Sparkles, title_en: 'All integrations', title_fr: 'Toutes les intégrations', desc_en: 'Connect Stripe, QuickBooks, Twilio & 30+ apps', desc_fr: 'Connectez Stripe, QuickBooks, Twilio et 30+ apps', color: 'text-text-secondary' },
      { icon: Star, title_en: 'Automations', title_fr: 'Automatisations', desc_en: 'Auto-reminders, follow-ups, and workflows', desc_fr: 'Rappels automatiques, suivis et flux de travail', color: 'text-text-secondary' },
      { icon: Crown, title_en: 'Priority support', title_fr: 'Support prioritaire', desc_en: 'Get help within hours, not days', desc_fr: 'Obtenez de l\'aide en heures, pas en jours', color: 'text-text-secondary' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    name_fr: 'Entreprise',
    monthlyPrice: 99,
    yearlyPrice: 990,
    features_en: ['Everything in Pro', 'SSO / SAML', 'Dedicated API access', 'Custom onboarding', 'Dedicated account manager', 'SLA guarantee', 'Audit logs'],
    features_fr: ['Tout dans Pro', 'SSO / SAML', 'Accès API dédié', 'Intégration personnalisée', 'Gestionnaire de compte dédié', 'Garantie SLA', 'Journaux d\'audit'],
    unlocks_en: [
      { icon: Shield, title_en: 'Enterprise security', title_fr: 'Sécurité entreprise', desc_en: 'SSO/SAML, audit logs, and compliance controls', desc_fr: 'SSO/SAML, journaux d\'audit et contrôles de conformité', color: 'text-text-secondary' },
      { icon: Crown, title_en: 'Dedicated account manager', title_fr: 'Gestionnaire de compte dédié', desc_en: 'Your own success partner for onboarding & beyond', desc_fr: 'Votre propre partenaire de succès', color: 'text-text-secondary' },
      { icon: Zap, title_en: 'API access', title_fr: 'Accès API', desc_en: 'Full REST API for custom integrations', desc_fr: 'API REST complète pour intégrations personnalisées', color: 'text-text-secondary' },
      { icon: Star, title_en: 'SLA guarantee', title_fr: 'Garantie SLA', desc_en: '99.9% uptime with contractual SLA', desc_fr: '99,9% de disponibilité avec SLA contractuel', color: 'text-text-secondary' },
    ],
  },
];

// ─── Main Component ─────────────────────────────────────────────
export default function BillingCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useTranslation();
  const isFr = language === 'fr';

  const planParam = searchParams.get('plan') || 'pro';
  const intervalParam = (searchParams.get('interval') || 'monthly') as 'monthly' | 'yearly';

  const [selectedPlanId, setSelectedPlanId] = useState(planParam);
  const [interval, setInterval] = useState<'monthly' | 'yearly'>(intervalParam);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('Canada');
  const [postalCode, setPostalCode] = useState('');

  const plan = useMemo(() => PLANS.find((p) => p.id === selectedPlanId) || PLANS[1], [selectedPlanId]);
  const price = interval === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const features = isFr ? plan.features_fr : plan.features_en;
  const savings = interval === 'yearly' ? Math.round((plan.monthlyPrice * 12 - plan.yearlyPrice) / (plan.monthlyPrice * 12) * 100) : 0;

  const formatCard = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const isFormValid = cardName.trim() && cardNumber.replace(/\s/g, '').length >= 15 && cardExpiry.length >= 4 && cardCvc.length >= 3 && billingEmail.includes('@');

  const handleSubmit = async () => {
    if (!isFormValid || plan.id === 'free') return;
    setProcessing(true);
    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 2000));
    setProcessing(false);
    toast.success(isFr ? `Abonnement ${plan.name_fr} activé !` : `${plan.name} subscription activated!`);
    navigate('/settings?tab=billing');
  };

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/settings?tab=billing')}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} /> {isFr ? 'Retour à la facturation' : 'Back to billing'}
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <CreditCard size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-text-primary tracking-tight">
            {isFr ? 'Finaliser l\'abonnement' : 'Complete your subscription'}
          </h1>
          <p className="text-[12px] text-text-tertiary">
            {isFr ? 'Débloquez les fonctionnalités premium pour votre entreprise.' : 'Unlock premium features for your business.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Plan summary ── */}
        <div className="lg:w-[380px] shrink-0 space-y-4">
          {/* Interval toggle */}
          <div className="section-card p-1.5 inline-flex gap-1">
            {(['monthly', 'yearly'] as const).map((int) => (
              <button
                key={int}
                onClick={() => setInterval(int)}
                className={cn(
                  'px-4 py-2 rounded-lg text-[12px] font-semibold transition-all',
                  interval === int
                    ? 'bg-text-primary text-surface'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {int === 'monthly' ? (isFr ? 'Mensuel' : 'Monthly') : (isFr ? 'Annuel' : 'Yearly')}
                {int === 'yearly' && savings > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold text-success">-{savings}%</span>
                )}
              </button>
            ))}
          </div>

          {/* Plan cards */}
          <div className="space-y-2">
            {PLANS.map((p) => {
              const pPrice = interval === 'yearly' ? p.yearlyPrice : p.monthlyPrice;
              const isSelected = selectedPlanId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={cn(
                    'w-full section-card p-4 text-left transition-all',
                    isSelected ? '!border-primary ring-2 ring-primary/20' : 'hover:border-outline'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                        isSelected ? 'border-primary bg-primary' : 'border-outline-subtle'
                      )}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-bold text-text-primary">{isFr ? p.name_fr : p.name}</span>
                          {p.recommended && <span className="text-[9px] font-bold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">{isFr ? 'Recommandé' : 'Recommended'}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[16px] font-bold text-text-primary tabular-nums">${pPrice}</span>
                      <span className="text-[10px] text-text-tertiary">/{interval === 'yearly' ? (isFr ? 'an' : 'yr') : (isFr ? 'mois' : 'mo')}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected plan features */}
          <div className="section-card p-5 space-y-3">
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              {isFr ? 'Inclus dans' : 'Included in'} {isFr ? plan.name_fr : plan.name}
            </p>
            <div className="space-y-2">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <Check size={12} className="text-success shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* What you unlock */}
          {plan.unlocks_en.length > 1 && (
            <div className="section-card p-5 space-y-4 bg-surface-secondary">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-primary" />
                <p className="text-[12px] font-bold text-text-primary">
                  {isFr ? `Ce que vous débloquez avec ${plan.name_fr}` : `What you unlock with ${plan.name}`}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {plan.unlocks_en.map((u, i) => {
                  const Icon = u.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={cn('mt-0.5 shrink-0', u.color)}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-text-primary leading-tight">
                          {isFr ? u.title_fr : u.title_en}
                        </p>
                        <p className="text-[11px] text-text-tertiary leading-snug mt-0.5">
                          {isFr ? u.desc_fr : u.desc_en}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Billing summary */}
          <div className="section-card p-5 space-y-3">
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              {isFr ? 'Résumé' : 'Billing summary'}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-text-secondary">{isFr ? plan.name_fr : plan.name} ({interval === 'yearly' ? (isFr ? 'annuel' : 'yearly') : (isFr ? 'mensuel' : 'monthly')})</span>
                <span className="font-semibold text-text-primary tabular-nums">${price}</span>
              </div>
              {interval === 'yearly' && savings > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-success">{isFr ? 'Économie annuelle' : 'Annual savings'}</span>
                  <span className="font-semibold text-success tabular-nums">-${plan.monthlyPrice * 12 - plan.yearlyPrice}</span>
                </div>
              )}
              <div className="border-t border-outline-subtle/40 pt-2 flex justify-between text-[14px]">
                <span className="font-semibold text-text-primary">{isFr ? 'Total dû aujourd\'hui' : 'Total due today'}</span>
                <span className="font-bold text-text-primary tabular-nums">${price}</span>
              </div>
            </div>
            <p className="text-[10px] text-text-tertiary">
              {interval === 'yearly'
                ? (isFr ? `Renouvellement annuel de $${price}. Annulable en tout temps.` : `Renews annually at $${price}. Cancel anytime.`)
                : (isFr ? `Renouvellement mensuel de $${price}. Annulable en tout temps.` : `Renews monthly at $${price}. Cancel anytime.`)}
            </p>
          </div>
        </div>

        {/* ── Right: Payment form ── */}
        <div className="flex-1 max-w-lg">
          {plan.id === 'free' ? (
            <div className="section-card p-8 text-center">
              <Check size={32} className="text-success mx-auto mb-3" />
              <h3 className="text-[15px] font-bold text-text-primary">
                {isFr ? 'Le plan Débutant est gratuit !' : 'Starter plan is free!'}
              </h3>
              <p className="text-[13px] text-text-tertiary mt-1">
                {isFr ? 'Aucun paiement requis. Vous êtes déjà prêt.' : 'No payment required. You\'re all set.'}
              </p>
              <button
                onClick={() => navigate('/settings?tab=billing')}
                className="glass-button-primary !text-[12px] mt-4 inline-flex items-center gap-1.5"
              >
                {isFr ? 'Retour' : 'Go back'}
              </button>
            </div>
          ) : (
            <div className="section-card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-text-tertiary" />
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                  {isFr ? 'Paiement sécurisé' : 'Secure payment'}
                </p>
              </div>

              <div className="space-y-4">
                {/* Billing email */}
                <div>
                  <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                    {isFr ? 'Courriel de facturation' : 'Billing email'} *
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="glass-input w-full mt-1"
                    placeholder="billing@company.com"
                  />
                </div>

                {/* Company (optional) */}
                <div>
                  <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                    {isFr ? 'Nom de l\'entreprise' : 'Company name'} <span className="normal-case font-normal">({isFr ? 'optionnel' : 'optional'})</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="glass-input w-full mt-1"
                    placeholder="Acme Corp"
                  />
                </div>

                {/* Card */}
                <div className="border border-outline-subtle/60 rounded-xl p-4 space-y-3 bg-surface-secondary/30">
                  <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard size={12} /> {isFr ? 'Informations de carte' : 'Card information'}
                  </p>

                  <div>
                    <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                      {isFr ? 'Nom sur la carte' : 'Cardholder name'} *
                    </label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="glass-input w-full mt-1"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                      {isFr ? 'Numéro de carte' : 'Card number'} *
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCard(e.target.value))}
                      className="glass-input w-full mt-1 tabular-nums"
                      placeholder="4242 4242 4242 4242"
                      maxLength={19}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                        {isFr ? 'Expiration' : 'Expiry'} *
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        className="glass-input w-full mt-1 tabular-nums"
                        placeholder="MM/YY"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">CVC *</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="glass-input w-full mt-1 tabular-nums"
                        placeholder="123"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>

                {/* Country + Postal */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                      {isFr ? 'Pays' : 'Country'}
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="glass-input w-full mt-1"
                    >
                      <option>Canada</option>
                      <option>United States</option>
                      <option>France</option>
                      <option>United Kingdom</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                      {isFr ? 'Code postal' : 'Postal code'}
                    </label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="glass-input w-full mt-1"
                      placeholder="H2X 1Y4"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!isFormValid || processing}
                className="glass-button-primary w-full !text-[13px] !py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <><Loader2 size={14} className="animate-spin" /> {isFr ? 'Traitement en cours...' : 'Processing...'}</>
                ) : (
                  <><Zap size={14} /> {isFr ? `S'abonner au plan ${plan.name_fr} — $${price}` : `Subscribe to ${plan.name} — $${price}`}</>
                )}
              </button>

              {/* Trust signals */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
                  <Shield size={11} /> {isFr ? 'Paiement sécurisé' : 'Secure checkout'}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
                  <Check size={11} /> {isFr ? 'Annulable en tout temps' : 'Cancel anytime'}
                </div>
              </div>

              <p className="text-[10px] text-text-tertiary text-center leading-relaxed">
                {isFr
                  ? 'En cliquant « S\'abonner », vous acceptez nos conditions de service. Votre carte sera débitée immédiatement et renouvelée automatiquement.'
                  : 'By clicking "Subscribe", you agree to our terms of service. Your card will be charged immediately and renewed automatically.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
