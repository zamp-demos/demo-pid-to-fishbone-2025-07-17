const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const url = require('url');

try { require('dotenv').config(); } catch(e) {}

const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.VITE_MODEL || 'gemini-2.5-flash';

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const BASE_PROCESSES_FILE = path.join(DATA_DIR, 'base_processes.json');
const PROCESSES_FILE = path.join(DATA_DIR, 'processes.json');
const SIGNAL_FILE = path.join(__dirname, 'interaction-signals.json');
const FEEDBACK_QUEUE_PATH = path.join(__dirname, 'feedbackQueue.json');
const KB_VERSIONS_PATH = path.join(DATA_DIR, 'kbVersions.json');
const KB_PATH = path.join(__dirname, 'src', 'data', 'knowledgeBase.md');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');

let state = { sent: false, confirmed: false, signals: {} };
const runningProcesses = new Map();

// Initialize files on startup
if (!fs.existsSync(PROCESSES_FILE) && fs.existsSync(BASE_PROCESSES_FILE)) {
    fs.copyFileSync(BASE_PROCESSES_FILE, PROCESSES_FILE);
}
if (!fs.existsSync(SIGNAL_FILE)) {
    fs.writeFileSync(SIGNAL_FILE, JSON.stringify({ APPROVE_SENSOR_FINDING: false }, null, 4));
}
if (!fs.existsSync(FEEDBACK_QUEUE_PATH)) {
    fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
}
if (!fs.existsSync(KB_VERSIONS_PATH)) {
    fs.writeFileSync(KB_VERSIONS_PATH, '[]');
}
if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.pdf': 'application/pdf', '.webm': 'video/webm', '.mp4': 'video/mp4',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.md': 'text/markdown'
};

const parseBody = (req) => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
    });
    req.on('error', reject);
});

async function callGemini(messages, systemPrompt) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const chat = model.startChat({
        history: messages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        })),
        systemInstruction: systemPrompt || undefined
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const cleanPath = parsedUrl.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    // ========== RESET ==========
    if (cleanPath === '/reset') {
        state = { sent: false, confirmed: false, signals: {} };
        console.log('Demo Reset Triggered');

        fs.writeFileSync(SIGNAL_FILE, JSON.stringify({
            APPROVE_SENSOR_FINDING: false
        }, null, 4));

        runningProcesses.forEach((proc, id) => {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { }
        });
        runningProcesses.clear();

        exec('pkill -9 -f "node(.*)simulation_scripts" || true', (err) => {
            setTimeout(() => {
                const cases = [
                    {
                        id: "PID_001",
                        name: "Reactor R-101 \u2014 Batch Degradation Event",
                        category: "P&ID to Fishbone",
                        stockId: "QE-2025-041",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        equipmentTag: "R-101",
                        eventType: "Batch Failure",
                        site: "Indianapolis Plant 4"
                    },
                    {
                        id: "PID_002",
                        name: "Heat Exchanger HX-301 \u2014 Cooling Deviation",
                        category: "P&ID to Fishbone",
                        stockId: "QE-2025-042",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        equipmentTag: "HX-301",
                        eventType: "OOS Result",
                        site: "Indianapolis Plant 4"
                    },
                    {
                        id: "PID_003",
                        name: "Distillation Column DC-500 \u2014 Purity Drop",
                        category: "P&ID to Fishbone",
                        stockId: "QE-2025-043",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        equipmentTag: "DC-500",
                        eventType: "OOS Result",
                        site: "Indianapolis Plant 4"
                    }
                ];
                fs.writeFileSync(PROCESSES_FILE, JSON.stringify(cases, null, 4));

                // Reset process logs
                cases.forEach(c => {
                    fs.writeFileSync(path.join(DATA_DIR, `process_${c.id}.json`),
                        JSON.stringify({ logs: [], keyDetails: {}, sidebarArtifacts: [] }, null, 4));
                });

                fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
                fs.writeFileSync(KB_VERSIONS_PATH, '[]');

                const scripts = [
                    { file: 'pid_story_1_happy_path.cjs', id: 'PID_001' },
                    { file: 'pid_story_2_needs_attention.cjs', id: 'PID_002' },
                    { file: 'pid_story_3_needs_review.cjs', id: 'PID_003' }
                ];

                let totalDelay = 0;
                scripts.forEach((script) => {
                    setTimeout(() => {
                        const scriptPath = path.join(__dirname, 'simulation_scripts', script.file);
                        const child = exec(
                            `node "${scriptPath}" > "${scriptPath}.log" 2>&1`,
                            (error) => {
                                if (error && error.code !== 0) {
                                    console.error(`${script.file} error:`, error.message);
                                }
                                runningProcesses.delete(script.id);
                            }
                        );
                        runningProcesses.set(script.id, child);
                    }, totalDelay * 1000);
                    totalDelay += 2;
                });
            }, 1000);
        });

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // ========== EMAIL STATUS ==========
    if (cleanPath === '/email-status') {
        if (req.method === 'GET') {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sent: state.sent }));
            return;
        }
        if (req.method === 'POST') {
            const body = await parseBody(req);
            state.sent = body.sent || false;
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
            return;
        }
    }

    // ========== SIGNAL ==========
    if (cleanPath === '/signal-status' && req.method === 'GET') {
        try {
            const signals = JSON.parse(fs.readFileSync(SIGNAL_FILE, 'utf8'));
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify(signals));
        } catch {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({}));
        }
        return;
    }

    if (cleanPath === '/signal' && req.method === 'POST') {
        const body = await parseBody(req);
        try {
            const signals = JSON.parse(fs.readFileSync(SIGNAL_FILE, 'utf8'));
            signals[body.signal] = true;
            const tmp = SIGNAL_FILE + '.' + Math.random().toString(36).substring(7) + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(signals, null, 4));
            fs.renameSync(tmp, SIGNAL_FILE);
        } catch (e) { console.error('Signal write error:', e); }
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // ========== UPDATE STATUS ==========
    if (cleanPath === '/api/update-status' && req.method === 'POST') {
        const body = await parseBody(req);
        try {
            const processes = JSON.parse(fs.readFileSync(PROCESSES_FILE, 'utf8'));
            const idx = processes.findIndex(p => p.id === String(body.id));
            if (idx !== -1) {
                processes[idx].status = body.status;
                processes[idx].currentStatus = body.currentStatus;
                fs.writeFileSync(PROCESSES_FILE, JSON.stringify(processes, null, 4));
            }
        } catch (e) { console.error('Update status error:', e); }
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // ========== CHAT (dual contract) ==========
    if (cleanPath === '/api/chat' && req.method === 'POST') {
        const parsed = await parseBody(req);
        try {
            let messages, systemPrompt;
            if (parsed.messages && parsed.systemPrompt) {
                messages = parsed.messages;
                systemPrompt = parsed.systemPrompt;
            } else {
                const history = (parsed.history || []).map(h => ({
                    role: h.role === 'assistant' ? 'assistant' : 'user',
                    content: h.content
                }));
                messages = [...history, { role: 'user', content: parsed.message }];
                systemPrompt = `You are a knowledgeable AI assistant. Answer questions based on this knowledge base:\n\n${parsed.knowledgeBase}`;
            }
            const response = await callGemini(messages, systemPrompt);
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ response }));
        } catch (e) {
            console.error('Chat error:', e);
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ========== FEEDBACK QUESTIONS ==========
    if (cleanPath === '/api/feedback/questions' && req.method === 'POST') {
        const parsed = await parseBody(req);
        try {
            const prompt = `Based on this feedback about our knowledge base, generate exactly 3 clarifying questions to better understand what changes are needed.\n\nFeedback: ${parsed.feedback}\n\nCurrent Knowledge Base:\n${parsed.knowledgeBase}\n\nReturn ONLY a JSON array of 3 question strings. Example: ["Question 1?", "Question 2?", "Question 3?"]`;
            const response = await callGemini([{ role: 'user', content: prompt }], 'You are a helpful assistant that generates clarifying questions. Always return valid JSON.');
            const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const questions = JSON.parse(cleaned);
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ questions }));
        } catch (e) {
            console.error('Questions error:', e);
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ========== FEEDBACK SUMMARIZE ==========
    if (cleanPath === '/api/feedback/summarize' && req.method === 'POST') {
        const parsed = await parseBody(req);
        try {
            const qaPairs = parsed.questions.map((q, i) => `Q: ${q}\nA: ${parsed.answers[i] || 'No answer'}`).join('\n\n');
            const prompt = `Summarize this feedback and the clarifying Q&A into a concise, actionable proposal for updating the knowledge base.\n\nOriginal Feedback: ${parsed.feedback}\n\nClarifying Q&A:\n${qaPairs}\n\nCurrent Knowledge Base:\n${parsed.knowledgeBase}\n\nWrite a clear 2-3 sentence summary of what should change.`;
            const response = await callGemini([{ role: 'user', content: prompt }], 'You are a helpful assistant that summarizes feedback into actionable proposals.');
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ summary: response }));
        } catch (e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ========== FEEDBACK QUEUE ==========
    if (cleanPath === '/api/feedback/queue') {
        if (req.method === 'GET') {
            try {
                const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ queue }));
            } catch {
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ queue: [] }));
            }
            return;
        }
        if (req.method === 'POST') {
            const item = await parseBody(req);
            try {
                const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
                queue.push({ ...item, status: 'pending', timestamp: new Date().toISOString() });
                fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            } catch (e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }
    }

    // ========== FEEDBACK QUEUE DELETE ==========
    if (cleanPath.startsWith('/api/feedback/queue/') && req.method === 'DELETE') {
        const id = cleanPath.split('/').pop();
        try {
            let queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            queue = queue.filter(item => item.id !== id);
            fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        } catch (e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ========== FEEDBACK APPLY ==========
    if (cleanPath === '/api/feedback/apply' && req.method === 'POST') {
        const parsed = await parseBody(req);
        try {
            let queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            const item = queue.find(i => i.id === parsed.feedbackId);
            if (!item) throw new Error('Feedback item not found');

            const currentKB = fs.readFileSync(KB_PATH, 'utf8');
            const prompt = `Apply this feedback to update the knowledge base. Return ONLY the updated knowledge base content (full markdown), no explanations.\n\nFeedback: ${item.summary || item.feedback}\n\nCurrent Knowledge Base:\n${currentKB}`;
            const updatedKB = await callGemini([{ role: 'user', content: prompt }], 'You update knowledge base documents based on feedback. Return only the updated markdown content.');

            // Save snapshots
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const prevFile = `kb_before_${timestamp}.md`;
            const snapFile = `kb_after_${timestamp}.md`;
            fs.writeFileSync(path.join(SNAPSHOTS_DIR, prevFile), currentKB);
            fs.writeFileSync(path.join(SNAPSHOTS_DIR, snapFile), updatedKB);
            fs.writeFileSync(KB_PATH, updatedKB);

            // Update versions
            const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
            versions.push({
                id: versions.length + 1,
                timestamp: new Date().toISOString(),
                snapshotFile: snapFile,
                previousFile: prevFile,
                changes: [item.summary || item.feedback]
            });
            fs.writeFileSync(KB_VERSIONS_PATH, JSON.stringify(versions, null, 4));

            // Mark item as applied
            queue = queue.map(i => i.id === parsed.feedbackId ? { ...i, status: 'applied' } : i);
            fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));

            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, content: updatedKB }));
        } catch (e) {
            console.error('Apply error:', e);
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ========== KB CONTENT ==========
    if (cleanPath === '/api/kb/content' && req.method === 'GET') {
        try {
            const versionId = parsedUrl.query.versionId;
            if (versionId) {
                const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
                const version = versions.find(v => String(v.id) === String(versionId));
                if (version) {
                    const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, version.snapshotFile), 'utf8');
                    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ content }));
                    return;
                }
            }
            const content = fs.readFileSync(KB_PATH, 'utf8');
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content }));
        } catch (e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ========== KB VERSIONS ==========
    if (cleanPath === '/api/kb/versions' && req.method === 'GET') {
        try {
            const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ versions }));
        } catch {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ versions: [] }));
        }
        return;
    }

    // ========== KB SNAPSHOT ==========
    if (cleanPath.startsWith('/api/kb/snapshot/') && req.method === 'GET') {
        const filename = cleanPath.split('/').pop();
        try {
            const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, filename), 'utf8');
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/markdown' });
            res.end(content);
        } catch {
            res.writeHead(404, corsHeaders);
            res.end('Not found');
        }
        return;
    }

    // ========== KB UPDATE ==========
    if (cleanPath === '/api/kb/update' && req.method === 'POST') {
        const parsed = await parseBody(req);
        try {
            fs.writeFileSync(KB_PATH, parsed.content);
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        } catch (e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ========== DEBUG ==========
    if (cleanPath === '/debug-paths' && req.method === 'GET') {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            dataDir: DATA_DIR,
            exists: fs.existsSync(DATA_DIR),
            files: fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : []
        }));
        return;
    }

    // ========== STATIC FILES ==========
    let filePath = path.join(PUBLIC_DIR, cleanPath === '/' ? 'index.html' : cleanPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': contentType });
        res.end(content);
    } catch {
        res.writeHead(404, corsHeaders);
        res.end('Not found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`P&ID to Fishbone demo server running on port ${PORT}`);
});
