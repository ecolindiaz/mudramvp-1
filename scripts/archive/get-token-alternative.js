#!/usr/bin/env node

// Alternative method to create Firegeo API token using Node.js
// This requires you to be logged in through the browser first to get session cookies

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔑 Alternative API Token Creation Method');
console.log('=====================================\n');

console.log('Since you\'re logged into Firegeo, try this:');
console.log('\n1. In your browser (while logged into Firegeo), open Developer Tools');
console.log('2. Go to Application > Cookies > http://localhost:3001');
console.log('3. Find the session cookie and copy its value');
console.log('4. Then use curl or the browser console method\n');

console.log('Or simply use the updated create-firegeo-token.js script in the browser console.');

rl.question('\nPress Enter to continue...', () => {
  rl.close();
});
