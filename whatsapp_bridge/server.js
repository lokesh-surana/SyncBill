const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Determine Chrome or Edge executable on Windows
function getBrowserExecutablePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined; // Let puppeteer pick default if bundled
}

const chromePath = getBrowserExecutablePath();
console.log('[WhatsApp Bridge] Using browser at:', chromePath || 'Default Puppeteer');

// Global Bridge State
let bridgeState = {
  status: 'INITIALIZING', // 'INITIALIZING' | 'SCAN_QR' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED'
  connected: false,
  phone: null,
  name: null,
  qrRaw: null,
  qrImage: null,
  lastUpdated: new Date().toISOString(),
  error: null,
};

let client = null;

function initializeWhatsAppClient() {
  bridgeState.status = 'INITIALIZING';
  bridgeState.connected = false;
  bridgeState.qrRaw = null;
  bridgeState.qrImage = null;
  bridgeState.error = null;

  const puppeteerOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  };

  if (chromePath) {
    puppeteerOptions.executablePath = chromePath;
  }

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth'),
    }),
    puppeteer: puppeteerOptions,
  });

  client.on('qr', async (qr) => {
    bridgeState.status = 'SCAN_QR';
    bridgeState.connected = false;
    bridgeState.qrRaw = qr;
    bridgeState.lastUpdated = new Date().toISOString();

    console.log('\n========================================================');
    console.log('   SCAN THIS QR CODE WITH YOUR WHATSAPP TO CONNECT:');
    console.log('========================================================\n');
    qrcodeTerminal.generate(qr, { small: true });

    try {
      bridgeState.qrImage = await QRCode.toDataURL(qr, {
        width: 320,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    } catch (err) {
      console.error('Failed to generate base64 QR code:', err);
    }
  });

  client.on('authenticated', () => {
    bridgeState.status = 'AUTHENTICATED';
    bridgeState.lastUpdated = new Date().toISOString();
    console.log('[WhatsApp Bridge] WhatsApp Authenticated Successfully!');
  });

  client.on('auth_failure', (msg) => {
    bridgeState.status = 'AUTH_FAILURE';
    bridgeState.connected = false;
    bridgeState.error = msg;
    bridgeState.lastUpdated = new Date().toISOString();
    console.error('[WhatsApp Bridge] WhatsApp Auth Failure:', msg);
  });

  client.on('ready', () => {
    bridgeState.status = 'READY';
    bridgeState.connected = true;
    bridgeState.qrRaw = null;
    bridgeState.qrImage = null;
    bridgeState.phone = client.info && client.info.wid ? client.info.wid.user : null;
    bridgeState.name = client.info && client.info.pushname ? client.info.pushname : 'SyncBill WhatsApp';
    bridgeState.lastUpdated = new Date().toISOString();
    console.log(`\n========================================================`);
    console.log(` [READY] WhatsApp Bridge is LIVE! Connected as: +${bridgeState.phone} (${bridgeState.name})`);
    console.log(`========================================================\n`);
  });

  client.on('disconnected', (reason) => {
    bridgeState.status = 'DISCONNECTED';
    bridgeState.connected = false;
    bridgeState.phone = null;
    bridgeState.name = null;
    bridgeState.error = reason;
    bridgeState.lastUpdated = new Date().toISOString();
    console.warn('[WhatsApp Bridge] Client disconnected:', reason);
  });

  client.initialize().catch((err) => {
    bridgeState.status = 'ERROR';
    bridgeState.error = err.message;
    console.error('[WhatsApp Bridge] Client initialization error:', err);
  });
}

// Clean and sanitize phone number to WhatsApp format (e.g. 919876543210@c.us)
function formatToChatId(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[^\d]/g, '');
  if (!cleaned) return null;
  // If standard 10 digit Indian number without country code, prefix 91
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned + '@c.us';
}

// ──────────────── API ENDPOINTS ────────────────

// 1. Health & Status
app.get('/status', (req, res) => {
  res.json({
    ...bridgeState,
    service: 'SyncBill Free WhatsApp Web Bridge',
    port: PORT,
  });
});

// 2. Visual QR Code Web Page for Quick Mobile Camera / WhatsApp Scan
app.get('/qr-view', (req, res) => {
  if (bridgeState.connected) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Connected - SyncBill</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 400px; border: 1px solid #334155; }
          .badge { background: #10b981; color: #fff; padding: 6px 14px; border-radius: 20px; font-weight: 700; display: inline-block; margin-bottom: 16px; font-size: 14px; }
          h2 { margin: 0 0 8px; color: #f8fafc; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
          .phone { font-size: 18px; font-weight: 700; color: #38bdf8; margin: 12px 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">✓ CONNECTED</div>
          <h2>WhatsApp Bridge is Active</h2>
          <div class="phone">+${bridgeState.phone || 'Connected'}</div>
          <p>SyncBill can now automatically send invoices, receipts, and ledger statements to customer numbers for free!</p>
        </div>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connect WhatsApp - SyncBill</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 420px; border: 1px solid #334155; }
        h2 { margin: 0 0 8px; color: #f8fafc; font-size: 22px; }
        p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 20px; }
        .qr-box { background: #fff; padding: 12px; border-radius: 12px; display: inline-block; margin: 10px 0; }
        .qr-box img { display: block; max-width: 280px; width: 100%; height: auto; }
        .steps { text-align: left; background: #0f172a; padding: 14px; border-radius: 8px; margin-top: 16px; font-size: 12px; color: #cbd5e1; }
        .steps ol { margin: 0; padding-left: 18px; }
        .steps li { margin-bottom: 6px; }
        .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #38bdf8; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin: 30px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
      <script>
        // Auto-refresh until connected
        setInterval(async () => {
          try {
            const res = await fetch('/status');
            const data = await res.json();
            if (data.connected) {
              window.location.reload();
            } else if (data.qrImage && document.getElementById('qr-img') && document.getElementById('qr-img').src !== data.qrImage) {
              document.getElementById('qr-img').src = data.qrImage;
            }
          } catch(e) {}
        }, 3000);
      </script>
    </head>
    <body>
      <div class="card">
        <h2>Link WhatsApp to SyncBill</h2>
        <p>Zero cost • 100% Free • No Meta API charges</p>
        
        ${bridgeState.qrImage ? `
          <div class="qr-box">
            <img id="qr-img" src="${bridgeState.qrImage}" alt="Scan QR Code" />
          </div>
        ` : `
          <div class="spinner"></div>
          <p style="color: #38bdf8;">Generating fresh QR code... Please wait.</p>
        `}

        <div class="steps">
          <strong>How to link:</strong>
          <ol>
            <li>Open <strong>WhatsApp</strong> on your phone</li>
            <li>Tap <strong>Settings</strong> or <strong>3 Dots</strong> &rarr; <strong>Linked Devices</strong></li>
            <li>Tap <strong>Link a Device</strong> and point your camera at this QR code</li>
          </ol>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 3. Send Text Message
app.post('/send-text', async (req, res) => {
  try {
    if (!bridgeState.connected || !client) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp Bridge is not connected. Please scan QR code first.'
      });
    }

    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Phone and message are required.' });
    }

    const chatId = formatToChatId(phone);
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
    }

    console.log(`[WhatsApp Bridge] Sending message to ${chatId}...`);
    const sent = await client.sendMessage(chatId, message);

    return res.json({
      success: true,
      message_id: sent.id ? sent.id.id : null,
      timestamp: sent.timestamp,
      to: chatId,
    });
  } catch (err) {
    console.error('[WhatsApp Bridge] Error sending text message:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Send Media / Document (PDF, Images, etc.)
app.post('/send-media', async (req, res) => {
  try {
    if (!bridgeState.connected || !client) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp Bridge is not connected. Please scan QR code first.'
      });
    }

    const { phone, message, caption, filename, mimetype, data } = req.body;
    if (!phone || !data) {
      return res.status(400).json({ success: false, error: 'Phone and base64 data are required.' });
    }

    const chatId = formatToChatId(phone);
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
    }

    const media = new MessageMedia(
      mimetype || 'application/pdf',
      data,
      filename || 'Tax_Invoice.pdf'
    );

    const sent = await client.sendMessage(chatId, media, {
      caption: caption || message || '',
    });

    return res.json({
      success: true,
      message_id: sent.id ? sent.id.id : null,
      to: chatId,
    });
  } catch (err) {
    console.error('[WhatsApp Bridge] Error sending media:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Restart / Disconnect Session
app.post('/logout', async (req, res) => {
  try {
    if (client) {
      await client.logout().catch(() => {});
      await client.destroy().catch(() => {});
    }
    // Delete saved session files if requested
    const sessionDir = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    initializeWhatsAppClient();
    return res.json({ success: true, message: 'Logged out. Session cleared.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WhatsApp Bridge Server] Listening on http://localhost:${PORT}`);
  console.log(`[WhatsApp Bridge Web UI] Open http://localhost:${PORT}/qr-view to scan QR code`);
  initializeWhatsAppClient();
});
