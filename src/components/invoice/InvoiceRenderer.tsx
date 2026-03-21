import React from 'react';
import type { InvoiceRenderData, InvoiceLayoutType } from './types';
import ClassicTemplate from './templates/ClassicTemplate';
import ModernTemplate from './templates/ModernTemplate';
import MinimalTemplate from './templates/MinimalTemplate';

interface InvoiceRendererProps {
  data: InvoiceRenderData;
  layout?: InvoiceLayoutType;
  className?: string;
}

/**
 * Core invoice renderer. Switches between visual template layouts.
 * Used by: preview modal, detail page, PDF generation, print view.
 */
export default function InvoiceRenderer({ data, layout = 'classic', className }: InvoiceRendererProps) {
  return (
    <div className={className}>
      {layout === 'modern' ? (
        <ModernTemplate data={data} />
      ) : layout === 'minimal' ? (
        <MinimalTemplate data={data} />
      ) : (
        <ClassicTemplate data={data} />
      )}
    </div>
  );
}
