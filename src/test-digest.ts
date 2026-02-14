#!/usr/bin/env ts-node
/**
 * Test script for digest generator
 */
import { generateDailyDigest } from './digest-generator.js';

async function test() {
  console.log('Testing digest generator...\n');

  // Test with the /tmp test file
  const message = await generateDailyDigest(['/tmp']);

  console.log('Generated digest:\n');
  console.log(message);
  console.log('\n✅ Test complete!');
}

test().catch(console.error);
