/**
 * Schema Visualizer Organizer — Round 5
 * Handles OAuth redirect properly
 */
const puppeteer = require('puppeteer');
const path = require('path');

const REF = 'bbzcuzqfgsdvjsymfwmr';
const VIZ_URL = `https://supabase.com/dashboard/project/${REF}/database/schemas`;

const LAYOUT = {
  memberships:{x:0,y:0}, orgs:{x:280,y:0}, profiles:{x:0,y:300}, company_settings:{x:280,y:300}, user_settings:{x:560,y:300},
  leads:{x:900,y:0}, clients:{x:1180,y:0}, contacts:{x:1460,y:0},
  pipeline_deals:{x:900,y:300}, pipeline_stages:{x:1180,y:300}, job_intents:{x:1460,y:300},
  notes:{x:900,y:600}, notes_files:{x:1180,y:600}, notes_tags:{x:1460,y:600},
  notes_checklist:{x:900,y:900}, note_history:{x:1180,y:900}, note_boards:{x:1460,y:900},
  custom_columns:{x:900,y:1200}, custom_column_values:{x:1180,y:1200},
  jobs:{x:1800,y:0}, job_line_items:{x:2080,y:0}, teams:{x:1800,y:300}, team_members:{x:2080,y:300},
  schedule_events:{x:1800,y:600}, tasks:{x:2080,y:600},
  availabilities:{x:1800,y:900}, team_availability:{x:2080,y:900}, team_date_slots:{x:2360,y:900}, predefined_services:{x:2360,y:600},
  invoices:{x:0,y:650}, invoice_items:{x:280,y:650}, invoice_sequences:{x:560,y:650},
  payments:{x:0,y:950}, payment_providers:{x:280,y:950}, payment_provider_settings:{x:560,y:950},
  payment_provider_secrets:{x:0,y:1250}, payment_settings:{x:280,y:1250}, invoice_templates:{x:560,y:1250},
  notifications:{x:900,y:1500}, email_templates:{x:1180,y:1500}, conversations:{x:900,y:1800}, messages:{x:1180,y:1800},
  communication_messages:{x:1460,y:1500}, communication_channels:{x:1460,y:1800}, communication_settings:{x:900,y:2100},
  automation_rules:{x:1800,y:1200}, automation_scheduled_tasks:{x:2080,y:1200}, automation_execution_logs:{x:2360,y:1200},
  activity_log:{x:1800,y:1500}, audit_events:{x:2080,y:1500}, satisfaction_surveys:{x:1800,y:1800}, review_requests:{x:2080,y:1800},
  workflows:{x:2700,y:0}, workflow_nodes:{x:2980,y:0}, workflow_edges:{x:2700,y:300}, workflow_runs:{x:2980,y:300}, workflow_logs:{x:2700,y:600},
  ai_conversations:{x:2700,y:900}, ai_messages:{x:2980,y:900},
  technician_locations:{x:2700,y:1200}, technician_device_mappings:{x:2980,y:1200}, geofences:{x:2700,y:1500},
  proof_of_presence:{x:2980,y:1500}, gps_providers:{x:2700,y:1800},
  attachments:{x:0,y:1550}, client_link_backfill_ambiguous:{x:0,y:1850}, quote_views:{x:280,y:1850},
};

async function waitForViz(page) {
  console.log('Attente du Schema Visualizer (max 2 min)...');
  for (let i = 0; i < 60; i++) {
    try {
      const status = await page.evaluate(() => ({
        url: window.location.href,
        loading: document.body?.innerText?.includes('Loading tables') || false,
        rfNodes: document.querySelectorAll('.react-flow__node').length,
        svgNodes: document.querySelectorAll('foreignObject').length,
        hasGraph: !!document.querySelector('.react-flow, svg, [class*="schema"]'),
      }));

      if (status.rfNodes > 5 || status.svgNodes > 5) {
        console.log(`Tables chargées: ${status.rfNodes} rf-nodes, ${status.svgNodes} svg-nodes`);
        return true;
      }
      if (i % 5 === 0) console.log(`  ... (rf=${status.rfNodes}, svg=${status.svgNodes}, loading=${status.loading}, graph=${status.hasGraph})`);
    } catch {
      // Context destroyed by navigation — that's OK during OAuth
      if (i % 5 === 0) console.log('  ... page en cours de navigation...');
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function run() {
  console.log('Lancement du navigateur...');
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--start-maximized'] });

  const pages = await browser.pages();
  let page = pages[0] || await browser.newPage();

  // Go to supabase
  await page.goto(VIZ_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

  console.log('\n═══════════════════════════════════════');
  console.log('  Connecte-toi via GitHub si demandé.');
  console.log('  Le script surveille en boucle...');
  console.log('═══════════════════════════════════════\n');

  // Poll until we land on the right page AND it's loaded
  // This survives OAuth redirects because we re-get the page each iteration
  let ready = false;
  for (let attempt = 0; attempt < 90 && !ready; attempt++) {
    await new Promise(r => setTimeout(r, 2000));

    try {
      // Re-get all pages (OAuth might open new tabs)
      const allPages = await browser.pages();
      page = allPages[allPages.length - 1]; // Use the last (most recent) tab

      const currentUrl = await page.url().catch(() => '');

      // If we're on the dashboard but not the schema visualizer, navigate there
      if (currentUrl.includes('/project/') && !currentUrl.includes('/schemas')) {
        console.log('Sur le dashboard — navigation vers Schema Visualizer...');
        await page.goto(VIZ_URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));
      }

      if (currentUrl.includes('/schemas')) {
        // Check if loaded
        const status = await page.evaluate(() => ({
          rfNodes: document.querySelectorAll('.react-flow__node').length,
          loading: document.body?.innerText?.includes('Loading tables'),
        })).catch(() => ({ rfNodes: 0, loading: true }));

        if (status.rfNodes > 5) {
          console.log(`\nVisualiseur chargé avec ${status.rfNodes} tables!`);
          ready = true;
        } else if (attempt % 5 === 0) {
          console.log(`  Sur /schemas mais ${status.rfNodes} nodes, loading=${status.loading}...`);
        }
      } else if (attempt % 10 === 0) {
        console.log(`  En attente... URL: ${currentUrl.slice(0, 60)}`);
      }
    } catch {
      // Navigation in progress, ignore
    }
  }

  if (!ready) {
    console.log('Timeout — le visualiseur ne charge pas.');
    // Take screenshot anyway
    const sp = path.join(process.cwd(), 'schema-visualizer-result.png');
    await page.screenshot({ path: sp }).catch(() => {});
    console.log(`Screenshot: ${sp}`);
    await new Promise(r => setTimeout(r, 60000));
    await browser.close();
    return;
  }

  // Extra wait for full render
  await new Promise(r => setTimeout(r, 4000));

  // DISCOVER node structure
  const discovery = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.react-flow__node');
    return Array.from(nodes).slice(0, 10).map(n => ({
      dataId: n.getAttribute('data-id'),
      text: n.innerText?.slice(0, 60),
    }));
  });
  console.log('\nExemples de nodes:');
  discovery.forEach(d => console.log(`  id="${d.dataId}" → "${d.text}"`));

  // MOVE TABLES
  console.log('\nRepositionnement...');
  const result = await page.evaluate((layout) => {
    const nodes = document.querySelectorAll('.react-flow__node');
    let moved = 0, unmatched = [];

    for (const node of nodes) {
      const dataId = (node.getAttribute('data-id') || '');
      const text = (node.innerText || '').trim();

      let matched = false;
      for (const [tableName, pos] of Object.entries(layout)) {
        if (dataId.toLowerCase().includes(tableName) ||
            text.toLowerCase().startsWith(tableName) ||
            dataId === `public.${tableName}`) {
          node.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
          moved++;
          matched = true;
          break;
        }
      }
      if (!matched) unmatched.push(dataId || text.slice(0, 30));
    }

    return { moved, total: nodes.length, unmatched: unmatched.slice(0, 10) };
  }, LAYOUT);

  console.log(`Résultat: ${result.moved}/${result.total} tables repositionnées`);
  if (result.unmatched.length) console.log('Non matchées:', result.unmatched.join(', '));

  // Screenshot
  await new Promise(r => setTimeout(r, 2000));
  const sp = path.join(process.cwd(), 'schema-visualizer-result.png');
  await page.screenshot({ path: sp });
  console.log(`\nScreenshot: ${sp}`);

  console.log('\n  Navigateur ouvert — Ctrl+C pour fermer.');
  await new Promise(r => setTimeout(r, 300000));
  await browser.close();
}

run().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
