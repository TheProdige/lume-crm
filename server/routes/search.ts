import { Router } from 'express';
import { requireAuthedClient } from '../lib/supabase';
import {
  sanitizeQuery,
  clampInt,
  parseTab,
  mapSearchRows,
  parseCountRows,
  toEntityType,
  emptyPage,
  searchByType,
  SearchRow,
  SearchEntityType,
} from '../lib/helpers';

const router = Router();

async function handleSuggestions(req: import('express').Request, res: import('express').Response) {
  const q = sanitizeQuery(String(req.query.q || ''));
  const limit = clampInt(req.query.limit, 8, 1, 8);

  if (!q) {
    return res.json({ query: q, items: [], grouped: { clients: [], jobs: [], leads: [] } });
  }

  try {
    const auth = await requireAuthedClient(req, res);
    if (!auth) return;

    const { client, orgId } = auth;
    const { data, error } = await client.rpc('search_global', {
      p_org: orgId,
      p_q: q,
      p_limit: Math.max(24, limit),
      p_offset: 0,
    });

    if (error) throw error;

    const mapped = mapSearchRows((data || []) as SearchRow[]);
    const grouped = {
      clients: mapped.filter((item) => item.type === 'client').slice(0, limit),
      jobs: mapped.filter((item) => item.type === 'job').slice(0, limit),
      leads: mapped.filter((item) => item.type === 'lead').slice(0, limit),
    };

    const items = [...grouped.clients, ...grouped.jobs, ...grouped.leads]
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit);

    return res.json({ query: q, items, grouped });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Search suggestion request failed.' });
  }
}

router.get('/search', handleSuggestions);
router.get('/search/suggestions', handleSuggestions);

router.get('/search/results', async (req, res) => {
  const q = sanitizeQuery(String(req.query.q || ''));
  const tab = parseTab(req.query.tab);
  const pageSize = clampInt(req.query.pageSize, 20, 1, 20);

  if (!q) {
    return res.json({
      query: q,
      tab,
      counts: { clients: 0, jobs: 0, leads: 0, all: 0 },
      groups: {
        clients: emptyPage(pageSize),
        jobs: emptyPage(pageSize),
        leads: emptyPage(pageSize),
      },
    });
  }

  try {
    const auth = await requireAuthedClient(req, res);
    if (!auth) return;

    const { client, orgId } = auth;
    const { data: countRows, error: countError } = await client.rpc('search_global_counts', {
      p_org: orgId,
      p_q: q,
    });

    if (countError) throw countError;

    const counts = parseCountRows((countRows || []) as Array<{ entity_type: SearchEntityType; total: number }>);

    if (tab === 'all') {
      const clientsPage = clampInt(req.query.clientsPage, 1, 1, 10_000);
      const jobsPage = clampInt(req.query.jobsPage, 1, 1, 10_000);
      const leadsPage = clampInt(req.query.leadsPage, 1, 1, 10_000);

      const [clients, jobs, leads] = await Promise.all([
        searchByType(client, orgId, q, 'client', pageSize, clientsPage, counts.clients),
        searchByType(client, orgId, q, 'job', pageSize, jobsPage, counts.jobs),
        searchByType(client, orgId, q, 'lead', pageSize, leadsPage, counts.leads),
      ]);

      return res.json({
        query: q,
        tab,
        counts,
        groups: { clients, jobs, leads },
      });
    }

    const page = clampInt(req.query.page, 1, 1, 10_000);
    const targetType = toEntityType(tab);
    const selectedTotal = tab === 'clients' ? counts.clients : tab === 'jobs' ? counts.jobs : counts.leads;
    const selectedGroup = await searchByType(client, orgId, q, targetType, pageSize, page, selectedTotal);

    return res.json({
      query: q,
      tab,
      counts,
      groups: {
        clients: tab === 'clients' ? selectedGroup : emptyPage(pageSize, counts.clients),
        jobs: tab === 'jobs' ? selectedGroup : emptyPage(pageSize, counts.jobs),
        leads: tab === 'leads' ? selectedGroup : emptyPage(pageSize, counts.leads),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Search results request failed.' });
  }
});

export default router;
