/* ═══════════════════════════════════════════════════════════════
   AI Tools — Dashboard / Performance
   ═══════════════════════════════════════════════════════════════ */

import type { ToolDefinition } from '../types';
import { getDashboardData } from '../../dashboardApi';

export const dashboardTools: ToolDefinition[] = [
  {
    id: 'dashboard.overview',
    label: 'Dashboard Overview',
    description: 'Get a complete overview of today: appointments, workflow status, revenue, leads, receivables, and performance metrics.',
    category: 'read',
    requiredPermissions: [],
    parameters: [],
    execute: async () => {
      try {
        const data = await getDashboardData();
        return {
          success: true,
          data: {
            appointments: {
              total: data.appointments.total,
              completed: data.appointments.completed,
              remaining: data.appointments.remaining,
              overdue: data.appointments.overdue,
              items: data.appointments.items.map((a) => ({
                title: a.title,
                clientName: a.clientName,
                startAt: a.startAt,
                endAt: a.endAt,
                status: a.status,
                propertyAddress: a.propertyAddress,
              })),
            },
            workflow: data.workflow,
            performance: {
              revenue: data.performance.revenue,
              newLeadsToday: data.performance.newLeadsToday,
              conversionRate: data.performance.conversionRate,
              receivables: data.performance.receivables,
              outstanding: data.performance.outstanding,
            },
          },
          summary: 'Dashboard overview retrieved.',
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to get dashboard data' };
      }
    },
  },
];
