import fs from 'fs';

const PROJECT_REF = 'bbzcuzqfgsdvjsymfwmr';
const ACCESS_TOKEN = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  console.error('Usage: node scripts/deploy-functions.mjs <supabase_access_token>');
  console.error('Get a token at: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const schemaPath = new URL('../supabase/complete_schema.sql', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1');

console.log('Reading schema from:', schemaPath);
const sql = fs.readFileSync(schemaPath, 'utf8');

// Extract function definitions, grants, revokes, and drop function statements
const blocks = [];
const lines = sql.split('\n');
let inFunction = false;
let currentBlock = [];
let dollarTag = null;
let depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim().toLowerCase();

  if (!inFunction) {
    if (trimmed.startsWith('create or replace function') || trimmed.startsWith('create function')) {
      inFunction = true;
      currentBlock = [line];
      dollarTag = null;
      depth = 0;
      continue;
    }
    if ((trimmed.startsWith('grant ') || trimmed.startsWith('revoke ')) && trimmed.includes(' function ')) {
      blocks.push(line + (line.trim().endsWith(';') ? '' : ';'));
      continue;
    }
    if (trimmed.startsWith('drop function if exists')) {
      blocks.push(line + (line.trim().endsWith(';') ? '' : ';'));
      continue;
    }
  } else {
    currentBlock.push(line);
    const dollarMatches = line.match(/\$[a-zA-Z_]*\$/g);
    if (dollarMatches) {
      for (const tag of dollarMatches) {
        if (!dollarTag) {
          dollarTag = tag;
          depth++;
        } else if (tag === dollarTag) {
          depth--;
        }
      }
    }
    if (dollarTag && depth === 0 && trimmed.endsWith(';')) {
      blocks.push(currentBlock.join('\n'));
      inFunction = false;
      currentBlock = [];
      continue;
    }
    if (!dollarTag && trimmed.includes('language') && trimmed.endsWith(';')) {
      blocks.push(currentBlock.join('\n'));
      inFunction = false;
      currentBlock = [];
    }
  }
}

console.log(`Found ${blocks.length} SQL blocks to deploy`);

async function runSQL(query) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function deploy() {
  // Test connection
  console.log('Testing API connection...');
  try {
    await runSQL('SELECT 1');
    console.log('API connection OK!');
  } catch (e) {
    console.error('API connection failed:', e.message);
    process.exit(1);
  }

  let success = 0;
  let failed = 0;

  // Deploy in batches of 5 to avoid rate limits
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    try {
      await runSQL(block);
      success++;
      if (block.toLowerCase().includes('create or replace function') || block.toLowerCase().includes('create function')) {
        const fnName = block.match(/function\s+(?:public\.)?(\w+)/i)?.[1] || '?';
        console.log(`  [${i+1}/${blocks.length}] OK: ${fnName}`);
      }
    } catch (err) {
      failed++;
      const fnName = block.match(/function\s+(?:public\.)?(\w+)/i)?.[1] || block.substring(0, 60);
      console.error(`  [${i+1}/${blocks.length}] FAIL: ${fnName} — ${err.message.substring(0, 120)}`);
    }
  }

  console.log(`\nDone! ${success} succeeded, ${failed} failed.`);
}

deploy().catch(err => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
