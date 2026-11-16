const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 8080;
const FREEMODEL_KEY = process.env.FREEMODEL_API_KEY || 'fm_6e8554bd3701f71dffff6ece1e11ace37c88017dda1c8e03';
const SITES_DIR = path.join(__dirname, 'public', 'sites');
const METADATA_FILE = path.join(__dirname, 'sites_meta.json');

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

if (!fs.existsSync(SITES_DIR)) {
  fs.mkdirSync(SITES_DIR, { recursive: true });
}

function loadMetadata() {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading metadata:', e);
  }
  return {};
}

function saveMetadata(meta) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving metadata:', e);
  }
}

function callClaudeOpus(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'claude-opus-5-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const req = https.request({
      hostname: 'freemodel.in',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FREEMODEL_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 90000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            resolve(parsed.choices[0].message.content || '');
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${data}`));
          }
        } catch (err) {
          reject(new Error(`JSON Parse Error: ${err.message} - Body: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 90s'));
    });

    req.write(postData);
    req.end();
  });
}

function cleanHtmlCode(raw) {
  if (!raw) return '';
  let clean = raw.trim();
  if (clean.startsWith('```html')) {
    clean = clean.slice(7);
  } else if (clean.startsWith('```')) {
    clean = clean.slice(3);
  }
  if (clean.endsWith('```')) {
    clean = clean.slice(0, -3);
  }
  return clean.trim();
}

// 1. Dashboard UI
app.get('/', (req, res) => {
  const meta = loadMetadata();
  const sitesList = Object.values(meta).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const rowsHtml = sitesList.map(s => `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <span style="font-weight: 700; color: #38bdf8; font-size: 16px;">${escapeHtml(s.title || s.id)}</span>
        <span style="font-size: 11px; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px;">${new Date(s.createdAt).toLocaleString()}</span>
      </div>
      <p style="color: #cbd5e1; font-size: 13px; margin: 0; line-height: 1.5;">${escapeHtml(s.instruction || '')}</p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px;">
        <a href="/preview/${s.id}" target="_blank" style="padding: 6px 14px; border-radius: 8px; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff; text-decoration: none; font-size: 12px; font-weight: 600;">📱 Interactive Preview</a>
        <a href="/sites/${s.id}" target="_blank" style="padding: 6px 14px; border-radius: 8px; background: rgba(255,255,255,0.08); color: #e2e8f0; text-decoration: none; font-size: 12px; font-weight: 600;">🌐 Open Live Site</a>
      </div>
    </div>
  `).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RJN Cloud Web Builder • Railway Production</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #090d16; color: #f8fafc; padding: 30px 20px; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 35px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 12px; font-weight: 700; margin-bottom: 12px; border: 1px solid rgba(56, 189, 248, 0.3); }
    h1 { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
    p.subtitle { color: #94a3b8; font-size: 15px; }
    .card { background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 24px; margin-bottom: 30px; backdrop-filter: blur(12px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    input, textarea { width: 100%; padding: 14px 16px; border-radius: 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 14px; margin-bottom: 14px; outline: none; transition: border-color 0.2s; }
    input:focus, textarea:focus { border-color: #38bdf8; }
    button { padding: 14px 24px; border-radius: 12px; background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; transition: transform 0.1s, opacity 0.2s; width: 100%; }
    button:hover { opacity: 0.95; }
    button:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">⚡ POWERED BY CLAUDE OPUS 5.5</div>
      <h1>RJN Web Builder Cloud</h1>
      <p class="subtitle">Autonomous Website Synthesis & Real-Time Production Deployment</p>
    </div>

    <div class="card">
      <h2 style="font-size: 18px; margin-bottom: 16px; color: #e2e8f0;">🚀 Build New Website with Claude Opus 5.5</h2>
      <form id="buildForm">
        <input type="text" id="siteTitle" placeholder="Website Title (e.g. Neo Tokyo Cyberpunk Cafe, SaaS Dashboard)" required />
        <textarea id="sitePrompt" rows="4" placeholder="Describe the website in detail: features, sections, aesthetic, colors, animations, interactive elements..." required></textarea>
        <button type="submit" id="submitBtn">⚡ Generate & Deploy Website (0ms to Live)</button>
      </form>
      <div id="statusBox" style="margin-top: 14px; display: none; padding: 12px; border-radius: 10px; font-size: 13px;"></div>
    </div>

    <div class="card">
      <h2 style="font-size: 18px; margin-bottom: 16px; color: #e2e8f0;">🌐 Generated Websites (${sitesList.length})</h2>
      <div id="sitesList">
        ${rowsHtml || '<p style="color: #64748b; font-size: 14px; text-align: center; padding: 20px;">No websites generated yet. Build one above or ask RJN voice AI!</p>'}
      </div>
    </div>
  </div>

  <script>
    function escapeHtml(text) {
      const d = document.createElement('div');
      d.innerText = text;
      return d.innerHTML;
    }
    const form = document.getElementById('buildForm');
    const statusBox = document.getElementById('statusBox');
    const submitBtn = document.getElementById('submitBtn');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('siteTitle').value.trim();
      const instruction = document.getElementById('sitePrompt').value.trim();
      if (!title || !instruction) return;

      submitBtn.disabled = true;
      submitBtn.innerText = '🧠 Claude Opus 5.5 is Coding Your Website...';
      statusBox.style.display = 'block';
      statusBox.style.background = 'rgba(56, 189, 248, 0.1)';
      statusBox.style.color = '#38bdf8';
      statusBox.innerText = 'Synthesizing layout, CSS animations, JavaScript interactions, and responsive design...';

      try {
        const res = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, instruction })
        });
        const data = await res.json();
        if (data.success) {
          statusBox.style.background = 'rgba(34, 197, 94, 0.15)';
          statusBox.style.color = '#4ade80';
          statusBox.innerHTML = '✔ Website Ready! <a href="' + data.previewUrl + '" target="_blank" style="color: #fff; font-weight: bold; text-decoration: underline; margin-left: 8px;">Open Interactive Preview →</a>';
          setTimeout(() => location.reload(), 2500);
        } else {
          statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
          statusBox.style.color = '#f87171';
          statusBox.innerText = 'Error: ' + (data.error || 'Failed to generate website');
        }
      } catch (err) {
        statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBox.style.color = '#f87171';
        statusBox.innerText = 'Network error: ' + err.message;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = '⚡ Generate & Deploy Website (0ms to Live)';
      }
    };
  </script>
</body>
</html>`);
});

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// 2. Build Website API (Autonomous Claude Opus 5.5 Generation)
app.post('/api/build', async (req, res) => {
  const { instruction, title = 'Generated Website', theme = 'dark' } = req.body;

  if (!instruction) {
    return res.status(400).json({ success: false, error: 'instruction is required' });
  }

  const startTime = Date.now();
  const siteId = 'site_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const siteDir = path.join(SITES_DIR, siteId);
  fs.mkdirSync(siteDir, { recursive: true });

  const systemPrompt = `You are Claude Opus 5.5, the world's most talented principal frontend architect, UI/UX designer, and creative web technologist.
Your task is to build a visually breathtaking, modern, fully functional, production-ready, single-file HTML5 website for the user's specification.

CRITICAL ARCHITECTURAL GUIDELINES:
1. PRODUCE ONLY RAW VALID HTML5. Start directly with <!DOCTYPE html> and end with </html>.
2. Embed all CSS inside <style> and all JavaScript inside <script>.
3. Include modern, high-contrast aesthetics (dark theme by default, glowing accents, glassmorphic cards, smooth gradients, subtle drop shadows).
4. Responsive design: Must look extraordinary on both mobile screens (360px-420px) and wide desktop displays.
5. Interactive features: Include functional state (e.g. tabs, filters, modals, audio/canvas visualizers, accordions, calculator/widgets, smooth animations).
6. Typography: Use clean modern system font stacks (-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif) or Google Fonts (@import).
7. NEVER truncate or write placeholders like "<!-- add more here -->". Write the COMPLETE, polished, ready-to-use codebase!
8. Do NOT wrap in markdown \`\`\` code fences. Return ONLY the raw HTML!`;

  const userPrompt = `Build a complete, stunning, production-ready website for:
Title: ${title}
Theme: ${theme}
Specification: "${instruction}"`;

  try {
    console.log(`[BUILD] Invoking Claude Opus 5.5 for "${title}" (${siteId})...`);
    const rawHtml = await callClaudeOpus(systemPrompt, userPrompt);
    const cleanHtml = cleanHtmlCode(rawHtml);

    if (!cleanHtml || cleanHtml.length < 100) {
      throw new Error('Claude Opus generated empty or invalid HTML output');
    }

    const htmlPath = path.join(siteDir, 'index.html');
    fs.writeFileSync(htmlPath, cleanHtml, 'utf-8');

    const durationMs = Date.now() - startTime;
    const meta = loadMetadata();
    meta[siteId] = {
      id: siteId,
      title,
      instruction,
      createdAt: new Date().toISOString(),
      durationMs,
      sizeBytes: Buffer.byteLength(cleanHtml, 'utf-8')
    };
    saveMetadata(meta);

    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    res.json({
      success: true,
      siteId,
      title,
      liveUrl: `${baseUrl}/sites/${siteId}`,
      previewUrl: `${baseUrl}/preview/${siteId}`,
      codeUrl: `${baseUrl}/api/sites/${siteId}/code`,
      durationMs,
      sizeBytes: Buffer.byteLength(cleanHtml, 'utf-8')
    });
  } catch (err) {
    console.error('[BUILD ERROR]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Edit Existing Site API
app.post('/api/sites/:id/edit', async (req, res) => {
  const siteId = req.params.id;
  const { instruction } = req.body;
  const siteDir = path.join(SITES_DIR, siteId);
  const htmlPath = path.join(siteDir, 'index.html');

  if (!fs.existsSync(htmlPath)) {
    return res.status(404).json({ success: false, error: 'Site not found' });
  }

  const existingCode = fs.readFileSync(htmlPath, 'utf-8');
  const systemPrompt = `You are Claude Opus 5.5, senior frontend engineer. You are iteratively updating an existing HTML5 website.
Apply the user's modifications precisely while preserving existing styles and functionality.
Return ONLY raw HTML5. Start with <!DOCTYPE html> and end with </html>. No markdown fences!`;

  const userPrompt = `Here is the current website code:
${existingCode}

User modification request:
"${instruction}"

Output the complete modified raw HTML:`;

  try {
    const rawHtml = await callClaudeOpus(systemPrompt, userPrompt);
    const cleanHtml = cleanHtmlCode(rawHtml);
    fs.writeFileSync(htmlPath, cleanHtml, 'utf-8');

    const meta = loadMetadata();
    if (meta[siteId]) {
      meta[siteId].updatedAt = new Date().toISOString();
      meta[siteId].lastInstruction = instruction;
      saveMetadata(meta);
    }

    res.json({
      success: true,
      siteId,
      message: 'Website updated successfully',
      previewUrl: `/preview/${siteId}`,
      liveUrl: `/sites/${siteId}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Live Site Direct Serving
app.get('/sites/:id', (req, res) => {
  const siteId = req.params.id;
  const htmlPath = path.join(SITES_DIR, siteId, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('<h1>Site Not Found</h1><p>The requested website does not exist.</p>');
  }
});

// 5. Interactive Device Previewer (Mobile / Tablet / Desktop)
app.get('/preview/:id', (req, res) => {
  const siteId = req.params.id;
  const meta = loadMetadata()[siteId] || { title: siteId, instruction: '' };
  const htmlPath = path.join(SITES_DIR, siteId, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    return res.status(404).send('Site Not Found');
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${escapeHtml(meta.title)} • RJN Web Builder</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b0f19; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    .toolbar { height: 60px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; backdrop-filter: blur(10px); z-index: 10; }
    .title-box { display: flex; align-items: center; gap: 12px; }
    .title { font-weight: 700; font-size: 15px; color: #38bdf8; }
    .device-switcher { display: flex; gap: 6px; background: rgba(0,0,0,0.4); padding: 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); }
    .device-btn { background: transparent; border: none; color: #94a3b8; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .device-btn.active { background: #38bdf8; color: #000; font-weight: 700; }
    .actions { display: flex; gap: 10px; align-items: center; }
    .btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff; border: none; }
    .btn-secondary { background: rgba(255,255,255,0.08); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1); }
    .frame-container { flex: 1; display: flex; align-items: center; justify-content: center; padding: 15px; background: #07090e; overflow: hidden; }
    iframe { border: none; width: 100%; height: 100%; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); background: #fff; }
    .frame-mobile { width: 390px; height: 844px; border: 10px solid #1e293b; border-radius: 36px; }
    .frame-tablet { width: 768px; height: 95%; border: 10px solid #1e293b; border-radius: 24px; }
    .frame-desktop { width: 100%; height: 100%; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="title-box">
      <a href="/" style="color: #94a3b8; text-decoration: none; font-size: 18px; margin-right: 6px;">←</a>
      <span class="title">⚡ ${escapeHtml(meta.title)}</span>
    </div>

    <div class="device-switcher">
      <button class="device-btn" onclick="setDevice('mobile')">📱 Mobile</button>
      <button class="device-btn" onclick="setDevice('tablet')">📲 Tablet</button>
      <button class="device-btn active" onclick="setDevice('desktop')">💻 Desktop</button>
    </div>

    <div class="actions">
      <a href="/sites/${siteId}" target="_blank" class="btn btn-secondary">🌐 Open Tab</a>
      <button onclick="downloadCode()" class="btn btn-primary">⬇ Download HTML</button>
    </div>
  </div>

  <div class="frame-container">
    <iframe id="previewFrame" src="/sites/${siteId}"></iframe>
  </div>

  <script>
    const frame = document.getElementById('previewFrame');
    function setDevice(type) {
      document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      frame.className = 'frame-' + type;
    }
    function downloadCode() {
      window.open('/api/sites/${siteId}/download', '_blank');
    }
  </script>
</body>
</html>`);
});

// 6. Download / Raw Code Endpoints
app.get('/api/sites/:id/code', (req, res) => {
  const siteId = req.params.id;
  const htmlPath = path.join(SITES_DIR, siteId, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(htmlPath);
  } else {
    res.status(404).json({ success: false, error: 'Site not found' });
  }
});

app.get('/api/sites/:id/download', (req, res) => {
  const siteId = req.params.id;
  const htmlPath = path.join(SITES_DIR, siteId, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.download(htmlPath, `${siteId}.html`);
  } else {
    res.status(404).send('Site not found');
  }
});

// 7. Sites List API
app.get('/api/sites', (req, res) => {
  const meta = loadMetadata();
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  const sites = Object.values(meta).map(s => ({
    ...s,
    liveUrl: `${baseUrl}/sites/${s.id}`,
    previewUrl: `${baseUrl}/preview/${s.id}`
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ success: true, count: sites.length, sites });
});

// 8. Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptimeSec: process.uptime(),
    memory: process.memoryUsage(),
    sitesCount: Object.keys(loadMetadata()).length,
    engine: 'Claude Opus 5.5 (FreeModel)'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 RJN Web Builder Production listening on 0.0.0.0:${PORT}`);
});
