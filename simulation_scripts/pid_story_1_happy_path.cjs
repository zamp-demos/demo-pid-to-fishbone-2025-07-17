const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "PID_001";
const CASE_NAME = "Reactor R-101 — Batch Degradation Event";

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

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    writeJson(path.join(PUBLIC_DATA_DIR, `process_${PROCESS_ID}.json`), {
        logs: [],
        keyDetails: {
            equipmentTag: "R-101",
            eventType: "Batch Failure — Color Degradation",
            site: "Indianapolis Plant 4",
            line: "API Manufacturing Line 2",
            severity: "Major"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Receiving quality event notification via email...",
            title_s: "Quality event QE-2025-041 received — batch color degradation on R-101",
            reasoning: [
                "Source: Quality Event Management System (QEMS)",
                "Event ID: QE-2025-041 — Batch B-20250717-R101",
                "Description: Drug ingredient batch exhibits abnormal dark coloration",
                "Affected equipment: Reactor vessel R-101, Line 2",
                "Triggered by: QC Lab visual inspection during IPC check",
                "Priority: Major — product cannot proceed to next stage"
            ],
            artifacts: [{
                id: "email-incoming",
                type: "file",
                label: "Quality Event Notification Email",
                pdfPath: "/data/qe_notification_email.pdf"
            }]
        },
        {
            id: "step-2",
            title_p: "Ingesting P&ID drawing for Reactor R-101 area...",
            title_s: "P&ID drawing parsed — 14 equipment tags extracted via OCR + CV",
            reasoning: [
                "Drawing: PID-L2-R101-REV4.dwg (AutoCAD format)",
                "OCR engine: Tesseract 5.0 + custom equipment tag model",
                "Computer vision: Detected 14 unique equipment symbols",
                "Pipe connections: 8 process lines identified",
                "Instrument loops: 3 control loops mapped (TC, PC, LC)",
                "Confidence: 97.2% average across all extracted tags"
            ],
            artifacts: [{
                id: "parse-results",
                type: "json",
                label: "P&ID Parse Results",
                data: {
                    drawing: "PID-L2-R101-REV4.dwg",
                    equipment_tags: ["R-101", "TC-202", "PC-101", "HJ-101", "AG-101", "V-102", "V-103", "TT-201", "TT-202", "PT-101", "LT-101", "FCV-01", "FCV-02", "SV-101"],
                    pipe_connections: 8,
                    control_loops: ["TC-202→TT-201→FCV-01", "PC-101→PT-101→SV-101", "LC-101→LT-101→FCV-02"],
                    ocr_confidence: "97.2%"
                }
            }]
        },
        {
            id: "step-3",
            title_p: "Building process connectivity map from P&ID...",
            title_s: "Process map built — flow direction and control loops resolved",
            reasoning: [
                "Reactor R-101: Central mixing vessel, 500L capacity",
                "Heating jacket HJ-101 → controlled by TC-202",
                "Temperature transmitters TT-201 (jacket) and TT-202 (bulk)",
                "Agitator AG-101 connected via VFD",
                "Feed valves V-102 (solvent inlet), V-103 (API inlet)",
                "Pressure safety valve SV-101 → vents to scrubber",
                "Flow control FCV-01 regulates heating fluid to jacket"
            ],
            artifacts: [{
                id: "connectivity-map",
                type: "json",
                label: "Equipment Connectivity Map",
                data: {
                    central_equipment: "R-101 (Reactor Vessel, 500L)",
                    upstream: ["V-102 (Solvent Feed)", "V-103 (API Feed)"],
                    downstream: ["FCV-02 (Product Discharge)"],
                    instrumentation: {
                        temperature: ["TC-202 (Controller)", "TT-201 (Jacket Sensor)", "TT-202 (Bulk Sensor)"],
                        pressure: ["PC-101 (Controller)", "PT-101 (Transmitter)", "SV-101 (Safety Valve)"],
                        level: ["LT-101 (Level Transmitter)"]
                    },
                    utilities: ["HJ-101 (Heating Jacket)", "AG-101 (Agitator)"]
                }
            }]
        },
        {
            id: "step-4",
            title_p: "Mapping extracted components to fishbone categories...",
            title_s: "Fishbone categories populated — 14 components mapped to 6M branches",
            reasoning: [
                "Machine: R-101, HJ-101, AG-101, FCV-01, FCV-02 (5 items)",
                "Measurement: TC-202, TT-201, TT-202, PT-101, LT-101 (5 items)",
                "Material: Heating fluid (thermal oil), Solvent feed, API feed (3 items)",
                "Method: SOP-R101-BATCH-v3.2, Temperature ramp profile (2 items)",
                "Man: Operator shift log, Training records (2 items)",
                "Environment: Room temp log, Humidity log (2 items)",
                "Mapping confidence: 98.1% — all tags accounted for"
            ],
            artifacts: [{
                id: "fishbone-map",
                type: "json",
                label: "Fishbone Category Mapping",
                data: {
                    Machine: ["R-101 (Reactor)", "HJ-101 (Heating Jacket)", "AG-101 (Agitator)", "FCV-01 (Heat Fluid Valve)", "FCV-02 (Discharge Valve)"],
                    Measurement: ["TC-202 (Temp Controller)", "TT-201 (Jacket Temp)", "TT-202 (Bulk Temp)", "PT-101 (Pressure)", "LT-101 (Level)"],
                    Material: ["Thermal oil (heating fluid)", "Solvent — Batch S-4410", "API — Batch A-7721"],
                    Method: ["SOP-R101-BATCH-v3.2", "Temp ramp: 25°C → 85°C @ 2°C/min"],
                    Man: ["Operator: J. Martinez (Shift B)", "Last training: 2025-03-15"],
                    Environment: ["Room temp: 22.1°C", "RH: 45%"]
                }
            }]
        },
        {
            id: "step-5",
            title_p: "Generating pre-populated fishbone diagram...",
            title_s: "Fishbone diagram generated with real equipment tags from P&ID",
            reasoning: [
                "Template: Standard 6M Ishikawa diagram",
                "Pre-populated: 19 items across 6 branches (not blank)",
                "Primary suspect branch: Machine — TC-202 flagged",
                "Reasoning: TC-202 controls heating jacket temperature",
                "Degradation pattern consistent with over-temperature event",
                "Historian data request: TC-202 trend last 48 hours"
            ]
        },
        {
            id: "step-6",
            title_p: "Running 5-Why analysis on primary suspect TC-202...",
            title_s: "Root cause identified — TC-202 thermocouple drift causing over-temperature",
            reasoning: [
                "Why 1: Batch degraded → Exposed to temperatures above 90°C",
                "Why 2: Temperature exceeded spec → TC-202 read 82°C when actual was 94°C",
                "Why 3: TC-202 reading incorrect → Thermocouple junction drift (+12°C offset)",
                "Why 4: Thermocouple drifted → Last calibration was 14 months ago (SOP says 6 months)",
                "Why 5: Calibration overdue → PM schedule not linked to equipment criticality rating",
                "Root cause: Preventive maintenance gap — TC-202 calibration overdue by 8 months"
            ],
            artifacts: [{
                id: "five-why",
                type: "json",
                label: "5-Why Analysis",
                data: {
                    "Why 1": "Batch degraded → Over-temperature exposure (>90°C)",
                    "Why 2": "Over-temperature → TC-202 reading 12°C below actual",
                    "Why 3": "Sensor error → Thermocouple junction drift",
                    "Why 4": "Drift undetected → Calibration 8 months overdue",
                    "Why 5": "Overdue calibration → PM schedule not risk-based",
                    root_cause: "PM scheduling gap — critical instrument calibration not tied to equipment criticality",
                    time_to_identify: "2.1 hours (vs. typical 2-3 days manual)"
                }
            }]
        },
        {
            id: "step-7",
            title_p: "Generating CAPA documentation...",
            title_s: "CAPA document generated — immediate and preventive actions defined",
            reasoning: [
                "CAPA ID: CAPA-2025-041",
                "Immediate action: Recalibrate TC-202, quarantine affected batch",
                "Preventive action 1: Implement risk-based PM scheduling for all critical instruments",
                "Preventive action 2: Add TC-202 to monthly verification checklist",
                "Effectiveness check: Re-run 3 batches post-calibration, verify ≤1°C offset",
                "Target close date: 2025-08-01",
                "Document is FDA 21 CFR Part 211 compliant"
            ]
        },
        {
            id: "step-8",
            title_p: "Finalizing investigation and sending CAPA report via email...",
            title_s: "Investigation complete — CAPA submitted and audit-ready",
            reasoning: [
                "Total investigation time: 2.3 hours (from event to CAPA)",
                "Traditional timeline: 2-3 days for same scope",
                "Time saved: ~85% reduction",
                "All fishbone branches traced to real P&ID equipment",
                "Root cause confirmed with historian data correlation",
                "CAPA document exported and emailed to Quality team"
            ],
            artifacts: [{
                id: "capa-email",
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
        await delay(2200);

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

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
