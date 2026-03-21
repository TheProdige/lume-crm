/**
 * Template validation script.
 * Run with: npx tsx scripts/test-templates.ts
 */

import { BUILT_IN_TEMPLATES } from '../src/lib/director-panel/config/templates';
import { getNodeDef } from '../src/lib/director-panel/config/node-registry';

let totalErrors = 0;
let totalWarnings = 0;

for (const tpl of BUILT_IN_TEMPLATES) {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Testing: ${tpl.title} (${tpl.id})`);
  console.log(`Nodes: ${tpl.nodes.length} | Edges: ${tpl.edges.length}`);
  console.log('═'.repeat(60));

  // 1. Check all nodes have valid types
  for (let i = 0; i < tpl.nodes.length; i++) {
    const node = tpl.nodes[i];
    const def = getNodeDef(node.type);
    if (!def) {
      errors.push(`Node ${i} ("${node.title}"): unknown type "${node.type}"`);
    }
  }

  // 2. Check all edges reference valid nodes
  for (let i = 0; i < tpl.edges.length; i++) {
    const edge = tpl.edges[i];

    // Parse __node_X index
    const srcMatch = edge.source_node_id.match(/^__node_(\d+)$/);
    const tgtMatch = edge.target_node_id.match(/^__node_(\d+)$/);

    if (!srcMatch) {
      errors.push(`Edge ${i}: invalid source "${edge.source_node_id}"`);
      continue;
    }
    if (!tgtMatch) {
      errors.push(`Edge ${i}: invalid target "${edge.target_node_id}"`);
      continue;
    }

    const srcIdx = parseInt(srcMatch[1]);
    const tgtIdx = parseInt(tgtMatch[1]);

    if (srcIdx >= tpl.nodes.length) {
      errors.push(`Edge ${i}: source __node_${srcIdx} doesn't exist (only ${tpl.nodes.length} nodes)`);
      continue;
    }
    if (tgtIdx >= tpl.nodes.length) {
      errors.push(`Edge ${i}: target __node_${tgtIdx} doesn't exist (only ${tpl.nodes.length} nodes)`);
      continue;
    }

    // 3. Check handles match node registry ports
    const srcNode = tpl.nodes[srcIdx];
    const tgtNode = tpl.nodes[tgtIdx];
    const srcDef = getNodeDef(srcNode.type);
    const tgtDef = getNodeDef(tgtNode.type);

    if (srcDef) {
      const srcPort = srcDef.outputs.find(p => p.id === edge.source_handle);
      if (!srcPort) {
        warnings.push(`Edge ${i}: source handle "${edge.source_handle}" not found in "${srcNode.title}" (${srcNode.type}) outputs: [${srcDef.outputs.map(p => p.id).join(', ')}]`);
      }
    }

    if (tgtDef) {
      const tgtPort = tgtDef.inputs.find(p => p.id === edge.target_handle);
      if (!tgtPort) {
        warnings.push(`Edge ${i}: target handle "${edge.target_handle}" not found in "${tgtNode.title}" (${tgtNode.type}) inputs: [${tgtDef.inputs.map(p => p.id).join(', ')}]`);
      }
    }
  }

  // 4. Check for unconnected providerBound nodes (they need a prompt)
  for (let i = 0; i < tpl.nodes.length; i++) {
    const node = tpl.nodes[i];
    const def = getNodeDef(node.type);
    if (!def) continue;

    if (def.providerBound) {
      const hasPromptInput = tpl.edges.some(
        e => e.target_node_id === `__node_${i}` && e.target_handle === 'prompt'
      );
      const hasRefInput = tpl.edges.some(
        e => e.target_node_id === `__node_${i}` && (e.target_handle === 'reference_image' || e.target_handle === 'image')
      );
      if (!hasPromptInput && !hasRefInput) {
        warnings.push(`Node ${i} ("${node.title}"): providerBound but has no prompt or image input connected`);
      }
    }
  }

  // Print results
  if (errors.length === 0 && warnings.length === 0) {
    console.log('  ✓ ALL CHECKS PASSED');
  }
  for (const e of errors) {
    console.log(`  ✗ ERROR: ${e}`);
    totalErrors++;
  }
  for (const w of warnings) {
    console.log(`  ⚠ WARNING: ${w}`);
    totalWarnings++;
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`TOTAL: ${BUILT_IN_TEMPLATES.length} templates | ${totalErrors} errors | ${totalWarnings} warnings`);
if (totalErrors === 0) {
  console.log('✓ All templates structurally valid!');
} else {
  console.log('✗ Fix errors above before deploying.');
  process.exit(1);
}
