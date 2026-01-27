#!/usr/bin/env node

/**
 * Startup script for Next.js standalone server on Railway
 * Ensures the server binds to 0.0.0.0 and uses Railway's PORT
 */

const { spawn } = require('child_process');
const path = require('path');

// Get PORT from environment (Railway sets this) or default to 3001
const PORT = process.env.PORT || '3001';
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

// Set environment variables for the Next.js server
process.env.PORT = PORT;
process.env.HOSTNAME = HOSTNAME;

console.log(`Starting Next.js server on ${HOSTNAME}:${PORT}`);

// Start the Next.js standalone server
// In standalone mode, server.js is in the root of the copied standalone directory
const serverPath = path.join(__dirname, 'server.js');

// Check if server.js exists, if not, it might be in a subdirectory
const fs = require('fs');
if (!fs.existsSync(serverPath)) {
  console.error(`Server file not found at ${serverPath}`);
  process.exit(1);
}

console.log(`Starting server from: ${serverPath}`);

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT,
    HOSTNAME,
  },
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code || 0);
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.kill('SIGINT');
});
