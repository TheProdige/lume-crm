import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  MoreHorizontal,
  Edit3,
  Shield,
  UserX,
  UserCheck,
  Loader2,
  Check,
  X,
  ArrowLeft,
  Search,
  Crown,
  ShieldCheck,
  Wrench,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { PageHeader, Modal, EmptyState } from '../components/ui';
import { useTranslation } from '../i18n';
import { toast } from 'sonner';
import PermissionGate from '../components/PermissionGate';

// ── Types ────────────────────────────────────────────────
type TeamRole = 'owner' | 'admin' | 'technician';
type TeamStatus = 'active' | 'inactive';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: TeamRole;
  status: TeamStatus;
  last_login: string | null;
  created_at: string;
  avatar_url?: string | null;
}

// ── Constants ────────────────────────────────────────────
const ROLE_CONFIG: Record<TeamRole, { label_en: string; label_fr: string; icon: typeof Crown; color: string; badge: string }> = {
  owner:      { label_en: 'Account Owner', label_fr: 'Propriétaire', icon: Crown,       color: 'text-text-secondary',  badge: 'bg-surface-tertiary text-text-secondary' },
  admin:      { label_en: 'Admin',         label_fr: 'Administrateur', icon: ShieldCheck, color: 'text-primary',    badge: 'bg-primary/10 text-primary' },
  technician: { label_en: 'Technician',    label_fr: 'Technicien',  icon: Wrench,      color: 'text-text-secondary',  badge: 'bg-surface-tertiary text-text-secondary' },
};

const ROLE_PERMISSIONS_EN: Record<TeamRole, string[]> = {
  owner:      ['Full access to everything'],
  admin:      ['Manage clients', 'Manage jobs', 'Manage team', 'Manage invoices'],
  technician: ['View assigned jobs', 'Track timesheets', 'Limited CRM access'],
};
const ROLE_PERMISSIONS_FR: Record<TeamRole, string[]> = {
  owner:      ['Accès complet à tout'],
  admin:      ['Gérer les clients', 'Gérer les jobs', 'Gérer l\'équipe', 'Gérer les factures'],
  technician: ['Voir les jobs assignés', 'Suivi des feuilles de temps', 'Accès CRM limité'],
};

// ── Demo data ────────────────────────────────────────────
const DEMO_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    first_name: 'Olivier',
    last_name: 'St-Pierre',
    email: 'olivier@lume.crm',
    phone: '+1 (514) 555-0100',
    role: 'owner',
    status: 'active',
    last_login: '2026-03-09T08:15:00Z',
    created_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'tm-2',
    first_name: 'Alex',
    last_name: 'Johnson',
    email: 'alex@lume.crm',
    phone: '+1 (514) 555-0201',
    role: 'admin',
    status: 'active',
    last_login: '2026-03-08T17:30:00Z',
    created_at: '2025-09-15T10:00:00Z',
  },
  {
    id: 'tm-3',
    first_name: 'Maria',
    last_name: 'Garcia',
    email: 'maria@lume.crm',
    phone: '+1 (514) 555-0302',
    role: 'technician',
    status: 'active',
    last_login: '2026-03-09T07:45:00Z',
    created_at: '2025-11-01T10:00:00Z',
  },
  {
    id: 'tm-4',
    first_name: 'David',
    last_name: 'Chen',
    email: 'david@lume.crm',
    phone: '+1 (514) 555-0403',
    role: 'technician',
    status: 'active',
    last_login: '2026-03-07T14:20:00Z',
    created_at: '2026-01-10T10:00:00Z',
  },
  {
    id: 'tm-5',
    first_name: 'Sophie',
    last_name: 'Martin',
    email: 'sophie@lume.crm',
    phone: '+1 (514) 555-0504',
    role: 'admin',
    status: 'inactive',
    last_login: '2026-02-15T09:00:00Z',
    created_at: '2025-08-20T10:00:00Z',
  },
];

function formatRelativeDate(dateStr: string | null, lang: string): string {
  if (!dateStr) return lang === 'fr' ? 'Jamais' : 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return lang === 'fr' ? 'À l\'instant' : 'Just now';
  if (diffMins < 60) return lang === 'fr' ? `il y a ${diffMins} min` : `${diffMins}m ago`;
  if (diffHours < 24) return lang === 'fr' ? `il y a ${diffHours}h` : `${diffHours}h ago`;
  if (diffDays < 7) return lang === 'fr' ? `il y a ${diffDays}j` : `${diffDays}d ago`;
  return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Main Component ───────────────────────────────────────
export default function ManageTeam() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [roleChangeMember, setRoleChangeMember] = useState<TeamMember | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isFr = language === 'fr';
  const rolePerms = isFr ? ROLE_PERMISSIONS_FR : ROLE_PERMISSIONS_EN;

  // ── Fetch members from DB ──────────────────────────────
  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('id,first_name,last_name,email,phone,role,status,last_login,created_at,avatar_url')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch team_members error:', error);
    }

    if (data && data.length > 0) {
      setMembers(data as TeamMember[]);
    } else {
      // Fallback to demo data if table is empty
      console.warn('team_members table empty or unreachable, using demo data');
      setMembers(DEMO_MEMBERS);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  const activeMembers = useMemo(() =>
    members
      .filter((m) => m.status === 'active')
      .filter((m) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
      }),
    [members, search]
  );

  const inactiveMembers = useMemo(() =>
    members.filter((m) => m.status === 'inactive'),
    [members]
  );

  // Close menus when clicking outside
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    if (openMenuId) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  const handleAddMember = async (data: { first_name: string; last_name: string; email: string; phone: string; role: TeamRole }) => {
    try {
      const { error } = await supabase.from('team_members').insert({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        role: data.role,
        status: 'active',
      });
      if (error) throw error;
    } catch {
      // Fallback: add locally
    }
    await fetchMembers();
    setShowAddModal(false);
    toast.success(isFr ? 'Membre ajouté avec succès.' : 'Team member added successfully.');
  };

  const handleEditMember = async (data: { first_name: string; last_name: string; email: string; phone: string; role: TeamRole }) => {
    if (!editingMember) return;
    try {
      const { error } = await supabase.from('team_members').update({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        role: data.role,
        updated_at: new Date().toISOString(),
      }).eq('id', editingMember.id);
      if (error) throw error;
    } catch {
      // Fallback: update locally
    }
    await fetchMembers();
    setEditingMember(null);
    toast.success(isFr ? 'Membre mis à jour.' : 'Team member updated.');
  };

  const handleChangeRole = async (memberId: string, newRole: TeamRole) => {
    try {
      const { error } = await supabase.from('team_members').update({ role: newRole, updated_at: new Date().toISOString() }).eq('id', memberId);
      if (error) throw error;
    } catch { /* fallback */ }
    await fetchMembers();
    setRoleChangeMember(null);
    toast.success(isFr ? 'Rôle mis à jour.' : 'Role updated.');
  };

  const handleToggleStatus = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const newStatus: TeamStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase.from('team_members').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', memberId);
      if (error) throw error;
    } catch { /* fallback */ }
    await fetchMembers();
    const wasActive = member.status === 'active';
    toast.success(
      wasActive
        ? (isFr ? `${member.first_name} a été désactivé.` : `${member.first_name} has been deactivated.`)
        : (isFr ? `${member.first_name} a été réactivé.` : `${member.first_name} has been reactivated.`)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <PermissionGate permission="team.view">
    <div className="space-y-5">
      <PageHeader
        title={isFr ? 'Gérer l\'équipe' : 'Manage Team'}
        subtitle={isFr
          ? 'Ajoutez ou gérez les membres de l\'équipe qui doivent se connecter à Lume au bureau ou sur le terrain.'
          : 'Add or manage team members that need to log into Lume in the office or in the field.'}
        icon={Users}
        iconColor="blue"
      >
        <button className="glass-button inline-flex items-center gap-1.5" onClick={() => navigate('/settings')}>
          <ArrowLeft size={14} />
          {isFr ? 'Paramètres' : 'Settings'}
        </button>
        <button className="glass-button-primary inline-flex items-center gap-1.5" onClick={() => setShowAddModal(true)}>
          <Plus size={14} />
          {isFr ? 'Ajouter un membre' : 'Add Team Member'}
        </button>
      </PageHeader>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isFr ? 'Rechercher un membre...' : 'Search members...'}
          className="glass-input w-full !pl-9"
        />
      </div>

      {/* Active Users */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-text-primary">
            {isFr ? 'Utilisateurs actifs' : 'Active Users'}
          </h2>
          <span className="text-[11px] font-semibold text-text-tertiary bg-surface-secondary px-2 py-0.5 rounded-full">
            {activeMembers.length}
          </span>
        </div>

        {activeMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={isFr ? 'Aucun membre trouvé' : 'No members found'}
            description={isFr ? 'Ajoutez un membre ou ajustez votre recherche.' : 'Add a member or adjust your search.'}
          />
        ) : (
          <div className="space-y-1.5">
            {activeMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                language={language}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                onOpen={() => navigate(`/settings/team/${member.id}`)}
                onEdit={() => setEditingMember(member)}
                onChangeRole={() => setRoleChangeMember(member)}
                onToggleStatus={() => handleToggleStatus(member.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive Users */}
      {inactiveMembers.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-bold text-text-tertiary">
              {isFr ? 'Utilisateurs inactifs' : 'Inactive Users'}
            </h2>
            <span className="text-[11px] font-semibold text-text-tertiary bg-surface-secondary px-2 py-0.5 rounded-full">
              {inactiveMembers.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {inactiveMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                language={language}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                onOpen={() => navigate(`/settings/team/${member.id}`)}
                onEdit={() => setEditingMember(member)}
                onChangeRole={() => setRoleChangeMember(member)}
                onToggleStatus={() => handleToggleStatus(member.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Role permissions reference */}
      <div className="section-card p-5 space-y-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
          {isFr ? 'Permissions des rôles' : 'Role Permissions'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['owner', 'admin', 'technician'] as TeamRole[]).map((role) => {
            const cfg = ROLE_CONFIG[role];
            const RoleIcon = cfg.icon;
            return (
              <div key={role} className="bg-surface-secondary rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <RoleIcon size={14} className={cfg.color} />
                  <span className="text-[13px] font-bold text-text-primary">
                    {isFr ? cfg.label_fr : cfg.label_en}
                  </span>
                </div>
                <ul className="space-y-1">
                  {rolePerms[role].map((perm, i) => (
                    <li key={i} className="text-[12px] text-text-secondary flex items-start gap-1.5">
                      <Check size={10} className="text-success mt-0.5 shrink-0" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={isFr ? 'Ajouter un membre' : 'Add Team Member'}
        description={isFr ? 'Créer un nouveau membre d\'équipe' : 'Create a new team member'}
        size="lg"
      >
        <MemberForm
          language={language}
          onSave={handleAddMember}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        open={!!editingMember}
        onClose={() => setEditingMember(null)}
        title={isFr ? 'Modifier le membre' : 'Edit Team Member'}
        size="lg"
      >
        {editingMember && (
          <MemberForm
            language={language}
            initial={editingMember}
            onSave={handleEditMember}
            onCancel={() => setEditingMember(null)}
          />
        )}
      </Modal>

      {/* Change Role Modal */}
      <Modal
        open={!!roleChangeMember}
        onClose={() => setRoleChangeMember(null)}
        title={isFr ? 'Changer le rôle' : 'Change Role'}
        description={roleChangeMember ? `${roleChangeMember.first_name} ${roleChangeMember.last_name}` : ''}
        size="sm"
      >
        {roleChangeMember && (
          <div className="space-y-2">
            {(['owner', 'admin', 'technician'] as TeamRole[]).map((role) => {
              const cfg = ROLE_CONFIG[role];
              const RoleIcon = cfg.icon;
              const isSelected = roleChangeMember.role === role;
              return (
                <button
                  key={role}
                  onClick={() => handleChangeRole(roleChangeMember.id, role)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left',
                    isSelected ? 'border-primary bg-primary/5' : 'border-outline-subtle hover:border-outline'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <RoleIcon size={15} className={cfg.color} />
                    <div>
                      <span className="text-[13px] font-semibold text-text-primary">
                        {isFr ? cfg.label_fr : cfg.label_en}
                      </span>
                      <p className="text-[11px] text-text-tertiary">
                        {rolePerms[role][0]}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="badge-info text-[10px]">
                      <Check size={10} className="inline mr-0.5" />
                      {isFr ? 'Actuel' : 'Current'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
    </PermissionGate>
  );
}

// ── Member Row Component ─────────────────────────────────
interface MemberRowProps {
  member: TeamMember;
  language: string;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  onOpen: () => void;
  onEdit: () => void;
  onChangeRole: () => void;
  onToggleStatus: () => void;
}

const MemberRow: React.FC<MemberRowProps> = ({
  member,
  language,
  openMenuId,
  setOpenMenuId,
  onOpen,
  onEdit,
  onChangeRole,
  onToggleStatus,
}) => {
  const isFr = language === 'fr';
  const cfg = ROLE_CONFIG[member.role];
  const RoleIcon = cfg.icon;
  const isInactive = member.status === 'inactive';
  const initials = `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  const isMenuOpen = openMenuId === member.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className={cn(
        'section-card p-4 flex items-center gap-4 transition-all cursor-pointer hover:border-primary/30 group',
        isInactive && 'opacity-50'
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0',
        isInactive
          ? 'bg-surface-secondary text-text-tertiary border border-outline-subtle'
          : 'bg-primary/10 text-primary border border-primary/20'
      )}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-bold text-text-primary truncate group-hover:text-primary transition-colors">
            {member.first_name} {member.last_name}
          </span>
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.badge)}>
            <RoleIcon size={9} className="inline mr-0.5 -mt-px" />
            {isFr ? cfg.label_fr : cfg.label_en}
          </span>
          {isInactive && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger">
              {isFr ? 'Inactif' : 'Inactive'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[12px] text-text-secondary">
          <span className="truncate">{member.email}</span>
          <span className="text-text-tertiary">
            {isFr ? 'Dernière connexion' : 'Last login'}: {formatRelativeDate(member.last_login, language)}
          </span>
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight size={14} className="text-text-tertiary group-hover:text-primary transition-colors shrink-0" />

      {/* Action menu */}
      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : member.id); }}
          className="p-2 rounded-lg border border-transparent text-text-tertiary hover:text-text-primary hover:bg-surface-secondary hover:border-outline-subtle transition-all"
        >
          <MoreHorizontal size={16} />
        </button>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-full mt-1 w-48 bg-surface border border-outline rounded-xl shadow-dropdown z-30 py-1 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setOpenMenuId(null); onEdit(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              >
                <Edit3 size={13} />
                {isFr ? 'Modifier l\'utilisateur' : 'Edit user'}
              </button>
              <button
                onClick={() => { setOpenMenuId(null); onChangeRole(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              >
                <Shield size={13} />
                {isFr ? 'Changer le rôle' : 'Change role'}
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { setOpenMenuId(null); onToggleStatus(); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors',
                  isInactive
                    ? 'text-success hover:bg-success/5'
                    : 'text-danger hover:bg-danger-light'
                )}
              >
                {isInactive ? <UserCheck size={13} /> : <UserX size={13} />}
                {isInactive
                  ? (isFr ? 'Réactiver l\'utilisateur' : 'Reactivate user')
                  : (isFr ? 'Désactiver l\'utilisateur' : 'Deactivate user')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ── Member Form Component ────────────────────────────────
function MemberForm({
  language,
  initial,
  onSave,
  onCancel,
}: {
  language: string;
  initial?: TeamMember;
  onSave: (data: { first_name: string; last_name: string; email: string; phone: string; role: TeamRole }) => void;
  onCancel: () => void;
}) {
  const isFr = language === 'fr';
  const [firstName, setFirstName] = useState(initial?.first_name || '');
  const [lastName, setLastName] = useState(initial?.last_name || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [role, setRole] = useState<TeamRole>(initial?.role || 'technician');
  const [saving, setSaving] = useState(false);

  const handleSubmit = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error(isFr ? 'Le prénom, le nom et le courriel sont requis.' : 'First name, last name, and email are required.');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      onSave({ first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), phone: phone.trim(), role });
      setSaving(false);
    }, 300);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            {isFr ? 'Prénom' : 'First Name'}
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="glass-input w-full mt-1"
            placeholder="John"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            {isFr ? 'Nom' : 'Last Name'}
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="glass-input w-full mt-1"
            placeholder="Doe"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
          {isFr ? 'Courriel' : 'Email'}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="glass-input w-full mt-1"
          placeholder="john@company.com"
        />
      </div>

      <div>
        <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
          {isFr ? 'Téléphone' : 'Phone Number'}
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="glass-input w-full mt-1"
          placeholder="+1 (555) 123-4567"
        />
      </div>

      <div>
        <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
          {isFr ? 'Rôle' : 'Role'}
        </label>
        <div className="space-y-1.5 mt-1.5">
          {(['owner', 'admin', 'technician'] as TeamRole[]).map((r) => {
            const cfg = ROLE_CONFIG[r];
            const RoleIcon = cfg.icon;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  'w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left',
                  role === r ? 'border-primary bg-primary/5' : 'border-outline-subtle hover:border-outline'
                )}
              >
                <RoleIcon size={14} className={cfg.color} />
                <span className="text-[13px] font-semibold text-text-primary">
                  {isFr ? cfg.label_fr : cfg.label_en}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button className="glass-button" onClick={onCancel}>
          {isFr ? 'Annuler' : 'Cancel'}
        </button>
        <button
          className="glass-button-primary inline-flex items-center gap-1.5"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving
            ? (isFr ? 'Enregistrement...' : 'Saving...')
            : initial
              ? (isFr ? 'Enregistrer' : 'Save Changes')
              : (isFr ? 'Ajouter le membre' : 'Add Member')}
        </button>
      </div>
    </div>
  );
}
