#!/usr/bin/env ts-node
/**
 * Test script for task dashboard
 */
import { generateTaskDashboard } from './task-dashboard.js';
import { initDatabase } from './db.js';

async function test() {
  console.log('Testing task dashboard generator...\n');

  // Initialize database first
  initDatabase();

  const message = generateTaskDashboard();

  console.log('Generated dashboard:\n');
  console.log(message);
  console.log('\n✅ Test complete!');
}

test().catch(console.error);
