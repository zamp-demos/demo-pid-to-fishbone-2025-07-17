const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "PID_002";
const CASE_NAME = "Heat Exchanger HX-301 — Cooling Deviation";

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const updateProcessLog = (processId, logEntry, keyDetailsUpdate = {}) => {
    const processFile = path.join(PUBLIC_DATA_DIR, `process_${processId}.json`);
    let data = { logs: [], keyDetails: {}, sidebarArtifacts: [] };
    if (fs.existsSync(processFile)) data = readJson(processFile);
    if (logEntry) {
        const existingIdx = logEntry.id ? data.logs.findIndex(l => l.id === logEntry.id) : -1;
        if (existingIdx !== -1) {
            data.logs[existingIdx] = { ...data.logs[existingIdx], ...logEntry };
        } else {
            data.logs.push(logEntry);
        }
    }
    if (keyDetailsUpdate && Object.keys(keyDetailsUpdate).length > 0) {
        data.keyDetails = { ...data.keyDetails, ...keyDetailsUpdate };
    }
    writeJson(processFile, data);
};

const updateProcessListStatus = async (processId, status, currentStatus) => {
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        const response = await fetch(`${apiUrl}/api/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: processId, status, currentStatus })
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
    } catch (e) {
        try {
            const processes = JSON.parse(fs.readFileSync(PROCESSES_FILE, 'utf8'));
            const idx = processes.findIndex(p => p.id === String(processId));
            if (idx !== -1) {
                processes[idx].status = status;
                processes[idx].currentStatus = currentStatus;
                fs.writeFileSync(PROCESSES_FILE, JSON.stringify(processes, null, 4));
            }
        } catch (err) { }
    }
};

const waitForSignal = async (signalId) => {
    console.log(`Waiting for human signal: ${signalId}...`);
    const signalFile = path.join(__dirname, '../interaction-signals.json');

    for (let i = 0; i < 15; i++) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (!content) continue;
                const signals = JSON.parse(content);
                if (signals[signalId]) {
                    delete signals[signalId];
                    const tempSignal = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                    fs.writeFileSync(tempSignal, JSON.stringify(signals, null, 4));
                    fs.renameSync(tempSignal, signalFile);
                }
                break;
            }
        } catch (e) { await delay(Math.floor(Math.random() * 200) + 100); }
    }

    while (true) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (content) {
                    const signals = JSON.parse(content);
                    if (signals[signalId]) {
                        console.log(`Signal ${signalId} received!`);
                        delete signals[signalId];
                        const tempSignal = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                        fs.writeFileSync(tempSignal, JSON.stringify(signals, null, 4));
                        fs.renameSync(tempSignal, signalFile);
                        return true;
                    }
                }
            }
        } catch (e) { }
        await delay(1000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    writeJson(path.join(PUBLIC_DATA_DIR, `process_${PROCESS_ID}.json`), {
        logs: [],
        keyDetails: {
            equipmentTag: "HX-301",
            eventType: "OOS Result — Cooling Temperature",
            site: "Indianapolis Plant 4",
            line: "Sterile Fill Line 1",
            severity: "Critical"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Receiving quality event notification via email...",
            title_s: "Quality event QE-2025-042 received — cooling deviation on fill line",
            reasoning: [
                "Source: Sterile Fill Line 1 temperature monitoring",
                "Event ID: QE-2025-042 — Fill batch F-20250717-003",
                "Description: Drug solution exiting HX-301 at 12°C instead of target 4°C",
                "Impact: Product stability at risk — 8°C above spec limit",
                "Triggered by: Automated OOS alert from TT-102 downstream sensor",
                "Priority: Critical — filling operations halted"
            ],
            artifacts: [{
                id: "email-incoming-2",
                type: "file",
                label: "Quality Event Notification Email",
                pdfPath: "/data/qe_notification_email.pdf"
            }]
        },
        {
            id: "step-2",
            title_p: "Ingesting P&ID drawing for Heat Exchanger HX-301 area...",
            title_s: "P&ID drawing parsed — 9 equipment tags extracted",
            reasoning: [
                "Drawing: PID-SFL1-HX301-REV2.dwg",
                "OCR + CV extracted 9 equipment components",
                "Heat exchanger HX-301: Shell-and-tube, counter-flow",
                "Flow control valve FCV-05 on chilled water supply",
                "Temperature transmitters: TT-101 (inlet), TT-102 (outlet)",
                "Additional: CWP-01 (chilled water pump), SV-301 (safety valve)",
                "Confidence: 96.8% across all tags"
            ],
            artifacts: [{
                id: "parse-results-2",
                type: "json",
                label: "P&ID Parse Results",
                data: {
                    drawing: "PID-SFL1-HX301-REV2.dwg",
                    equipment_tags: ["HX-301", "FCV-05", "TT-101", "TT-102", "CWP-01", "SV-301", "PI-301", "FI-301", "TV-05"],
                    pipe_connections: 4,
                    control_loops: ["TT-102→TC-301→FCV-05", "PI-301→SV-301"],
                    ocr_confidence: "96.8%"
                }
            }]
        },
        {
            id: "step-3",
            title_p: "Building process connectivity map for cooling circuit...",
            title_s: "Connectivity map built — chilled water loop and product flow resolved",
            reasoning: [
                "Product side: Drug solution inlet → HX-301 tubes → outlet to filler",
                "Utility side: Chilled water from CWP-01 → FCV-05 → HX-301 shell → return",
                "Control loop: TT-102 measures outlet temp → TC-301 adjusts FCV-05 opening",
                "Flow indicator FI-301 on chilled water return line",
                "Pressure indicator PI-301 on shell side",
                "Safety valve SV-301 for overpressure protection"
            ]
        },
        {
            id: "step-4",
            title_p: "Mapping components to fishbone categories...",
            title_s: "Fishbone populated — 9 components across 6M branches",
            reasoning: [
                "Machine: HX-301, FCV-05, CWP-01, SV-301, TV-05 (5 items)",
                "Measurement: TT-101, TT-102, PI-301, FI-301 (4 items)",
                "Material: Chilled water supply (glycol mix), Drug solution batch F-003",
                "Method: SOP-HX301-COOL-v2.1, Setpoint 4°C ± 1°C",
                "Man: Operator on duty, Maintenance last performed 2025-06-01",
                "Environment: Ambient temp 23°C, Chiller plant operating status"
            ]
        },
        {
            id: "step-5",
            title_p: "Analyzing primary suspect — TT-101 inlet sensor shows anomaly...",
            title_s: "Anomaly detected: TT-101 reading 2.1°C but cross-check shows 9.8°C — needs engineer review",
            reasoning: [
                "TT-101 (inlet) reads 2.1°C — this would mean product is already cold entering HX-301",
                "But TT-102 (outlet) reads 12°C — product is WARMER after the heat exchanger?",
                "This is physically impossible if TT-101 is correct",
                "Cross-reference: Upstream batch record shows product at ~22°C before HX-301",
                "Conclusion: TT-101 is miscalibrated — reading ~7.7°C too low",
                "Impact: TC-301 sees already-cold product → reduces FCV-05 opening → insufficient cooling",
                "ACTION REQUIRED: Engineer must confirm TT-101 miscalibration before proceeding with CAPA"
            ],
            artifacts: [{
                id: "anomaly-data",
                type: "json",
                label: "Sensor Cross-Check Analysis",
                data: {
                    sensor: "TT-101",
                    reported_reading: "2.1°C",
                    expected_reading: "~9.8°C (based on upstream batch data)",
                    offset: "-7.7°C",
                    impact: "TC-301 under-drives FCV-05 → insufficient chilled water flow",
                    confidence: "High — corroborated by TT-102 and batch records",
                    recommendation: "Confirm TT-101 miscalibration with field check"
                }
            }]
        },
        {
            id: "step-6",
            title_p: "Running 5-Why analysis on confirmed root cause...",
            title_s: "Root cause confirmed — TT-101 miscalibration traced to installation error",
            reasoning: [
                "Why 1: Product too warm → Insufficient cooling by HX-301",
                "Why 2: Insufficient cooling → FCV-05 only 15% open (should be 80%+)",
                "Why 3: FCV-05 under-driven → TC-301 receiving false low temp from TT-101",
                "Why 4: TT-101 miscalibrated → Replaced during last maintenance, post-install cal not verified",
                "Why 5: Cal not verified → Work order closed without independent verification step",
                "Root cause: Maintenance procedure gap — no independent cal verification after sensor replacement"
            ]
        },
        {
            id: "step-7",
            title_p: "Generating CAPA documentation...",
            title_s: "CAPA generated — immediate recalibration + procedure update",
            reasoning: [
                "CAPA ID: CAPA-2025-042",
                "Immediate: Recalibrate TT-101, resume filling after 3 consecutive batches at 4°C ± 1°C",
                "Preventive: Add mandatory post-replacement calibration verification to all sensor WOs",
                "Systemic: Update CMMS to auto-generate verification step for critical instrument replacements",
                "Effectiveness: Monitor TT-101 vs TT-102 delta for 30 days, target ≤0.5°C drift",
                "Document compliant with FDA 21 CFR Part 211"
            ]
        },
        {
            id: "step-8",
            title_p: "Finalizing and sending CAPA report via email...",
            title_s: "Investigation complete — CAPA submitted, fill line cleared for restart",
            reasoning: [
                "Total investigation time: 1.8 hours (event to CAPA)",
                "Traditional: 2-3 days with manual fishbone creation",
                "Key insight: AI flagged TT-101 anomaly via cross-sensor logic",
                "Without P&ID-driven fishbone, team might have checked HX-301 fouling first (wrong path)",
                "CAPA emailed to Quality and Maintenance leads",
                "Fill line restart authorized after TT-101 recalibration"
            ],
            artifacts: [{
                id: "capa-email-2",
                type: "file",
                label: "CAPA Report Email",
                pdfPath: "/data/capa_report_email.pdf"
            }]
        }
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;

        updateProcessLog(PROCESS_ID, {
            id: step.id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: step.title_p,
            status: "processing"
        });
        await updateProcessListStatus(PROCESS_ID, "In Progress", step.title_p);
        await delay(2000);

        if (step.id === "step-5") {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: "warning",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", "Engineer review required: TT-101 miscalibration suspected");

            await waitForSignal("APPROVE_SENSOR_FINDING");
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Engineer confirmed TT-101 miscalibration — proceeding");
            await delay(1200);
        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: isFinal ? "completed" : "success",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, isFinal ? "Done" : "In Progress", step.title_s);
            await delay(1400);
        }
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
