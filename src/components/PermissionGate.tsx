import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { type PermissionKey, hasPermission } from '../lib/permissions';

interface PermissionGateProps {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const DefaultFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mb-4">
      <ShieldAlert size={24} className="text-danger" />
    </div>
    <h2 className="text-[16px] font-bold text-text-primary mb-1">
      Access Restricted
    </h2>
    <p className="text-[13px] text-text-tertiary max-w-sm">
      You don't have permission to view this page. Contact your administrator if you believe this is an error.
    </p>
  </div>
);

export default function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const { permissions, loading } = usePermissions();

  if (loading) return null;

  if (hasPermission(permissions, permission)) {
    return <>{children}</>;
  }

  return <>{fallback ?? <DefaultFallback />}</>;
}
