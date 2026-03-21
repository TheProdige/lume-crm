/**
 * @deprecated This component is a legacy stub. Job editing is handled by NewJobModal in edit mode.
 * Kept only for backward compatibility — any imports should be migrated to NewJobModal.
 */
export default function EditJobModal(_props: Record<string, any>) {
  console.warn('[EditJobModal] This component is deprecated. Use NewJobModal with initialValues.id for editing.');
  return null;
}
