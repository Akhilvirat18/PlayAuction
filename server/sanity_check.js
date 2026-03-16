const http = require('http');
const { spawn } = require('child_process');

console.log('🚀 Starting Pre-Deployment Sanity Check...');

const serverProcess = spawn('node', ['index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '5050' }
});

let serverRunning = false;

serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Server]: ${output.trim()}`);
    if (output.includes('Server running on port 5050')) {
        serverRunning = true;
        checkHealth();
    }
});

serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data.toString()}`);
});

function checkHealth() {
    console.log('📡 Testing /ping endpoint...');
    http.get('http://localhost:5050/ping', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (data === 'pong') {
                console.log('✅ Health Check Passed! Server is responsive.');
                finalize(0);
            } else {
                console.error(`❌ Health Check Failed: Expected "pong", got "${data}"`);
                finalize(1);
            }
        });
    }).on('error', (err) => {
        console.error('❌ Health Check Failed: Could not connect to server.');
        finalize(1);
    });
}

function finalize(code) {
    serverProcess.kill();
    process.exit(code);
}

setTimeout(() => {
    if (!serverRunning) {
        console.error('❌ Timeout: Server took too long to start.');
        finalize(1);
    }
}, 10000);
