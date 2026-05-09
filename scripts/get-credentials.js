#!/usr/bin/env node

/**
 * Helper script to retrieve Idle Champions User ID and Hash
 * 
 * Usage:
 *   node scripts/get-credentials.js
 * 
 * This script will guide you through the process of obtaining your credentials
 * from the official Idle Champions server.
 */

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  Idle Champions - Get Your Credentials         ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log('To get your User ID and User Hash:');
  console.log('');
  console.log('1. Visit https://www.idlechampions.com');
  console.log('2. Log in with your account');
  console.log('3. Open your browser\'s Developer Tools (F12 or Ctrl+Shift+I)');
  console.log('4. Go to the Console tab');
  console.log('5. Copy and paste one of the following commands:\n');

  console.log('📋 Option A - Using Fetch (Most Reliable):');
  console.log('───────────────────────────────────────────');
  console.log(`
fetch('https://www.idlechampions.com/api/')
  .then(r => r.text())
  .then(html => {
    const userIdMatch = html.match(/userId["\']?\\s*[:=]\\s*["\']([^"']+)/);
    const userHashMatch = html.match(/userHash["\']?\\s*[:=]\\s*["\']([^"']+)/);
    console.log('USER_ID:', userIdMatch ? userIdMatch[1] : 'NOT FOUND');
    console.log('USER_HASH:', userHashMatch ? userHashMatch[1] : 'NOT FOUND');
  });
  `);

  console.log('\n📋 Option B - Using LocalStorage (Faster):');
  console.log('───────────────────────────────────────────');
  console.log(`
// Try this first:
console.log('USER_ID:', localStorage.getItem('userId'));
console.log('USER_HASH:', localStorage.getItem('userHash'));

// Or check sessionStorage:
console.log('USER_ID:', sessionStorage.getItem('userId'));
console.log('USER_HASH:', sessionStorage.getItem('userHash'));
  `);

  console.log('\n📋 Option C - Network Tab (If others don\'t work):');
  console.log('───────────────────────────────────────────');
  console.log(`
1. Go to Network tab
2. Look for requests to idlechampions.com API
3. Check request payload for 'user_id' and 'hash' parameters
4. Or check response headers for these values
  `);

  console.log('\n✅ Once you have your credentials:');
  console.log('───────────────────────────────────────────');

  const userId = await question('\nEnter your User ID: ');
  const userHash = await question('Enter your User Hash: ');

  if (!userId || !userHash) {
    console.log('\n❌ Error: Both User ID and Hash are required!');
    rl.close();
    process.exit(1);
  }

  console.log('\n✅ Credentials Retrieved:');
  console.log('───────────────────────────────────────────');
  console.log(`User ID: ${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`);
  console.log(`User Hash: ${userHash.substring(0, 4)}...${userHash.substring(userHash.length - 4)}`);

  console.log('\n📝 Use these credentials with the Discord bot:');
  console.log('───────────────────────────────────────────');
  console.log(`/setup user_id:${userId} user_hash:${userHash}\n`);

  rl.close();
}

main().catch(console.error);
