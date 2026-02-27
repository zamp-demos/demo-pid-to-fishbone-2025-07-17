const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "PID_003";
const CASE_NAME = "Distillation Column DC-500 — Purity Drop";

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
            equipmentTag: "DC-500",
            eventType: "OOS Result — Solvent Purity",
            site: "Indianapolis Plant 4",
            line: "Solvent Recovery Unit",
            severity: "Major"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Receiving quality event notification via email...",
            title_s: "Quality event QE-2025-043 received — solvent purity below spec",
            reasoning: [
                "Source: QC Lab GC analysis — solvent recovery output",
                "Event ID: QE-2025-043 — Solvent batch SR-20250717-001",
                "Description: Recovered solvent purity at 96.2% vs. spec ≥99.5%",
                "Impact: Cannot reuse solvent in next batch — waste disposal required",
                "Triggered by: Routine QC release testing",
                "Priority: Major — solvent recovery economics at risk"
            ],
            artifacts: [{
                id: "email-incoming-3",
                type: "file",
                label: "Quality Event Notification Email",
                pdfPath: "/data/qe_notification_email.pdf"
            }]
        },
        {
            id: "step-2",
            title_p: "Ingesting P&ID drawing for Distillation Column DC-500...",
            title_s: "P&ID parsed — 23 equipment tags extracted (most complex system to date)",
            reasoning: [
                "Drawing: PID-SRU-DC500-REV6.dwg (3 sheets)",
                "This is the most complex P&ID in the investigation set",
                "23 unique equipment tags across column, condenser, reboiler, and reflux",
                "15 instrument loops identified",
                "12 pipe connections with flow direction",
                "Multi-sheet OCR required — stitched 3 drawing sheets",
                "Confidence: 95.4% (lower due to drawing complexity)"
            ],
            artifacts: [{
                id: "parse-results-3",
                type: "json",
                label: "P&ID Parse Results — DC-500 System",
                data: {
                    drawing: "PID-SRU-DC500-REV6.dwg (3 sheets)",
                    equipment_tags: [
                        "DC-500 (Column)", "CD-501 (Condenser)", "RB-501 (Reboiler)",
                        "RD-501 (Reflux Drum)", "P-501A (Reflux Pump A)", "P-501B (Reflux Pump B)",
                        "P-502 (Bottoms Pump)", "FCV-10 (Reflux Valve)", "FCV-11 (Distillate Valve)",
                        "FCV-12 (Steam Valve)", "LCV-04 (Reflux Drum Level Valve)",
                        "TT-501...TT-508 (8 tray temps)", "PT-501 (Column Pressure)",
                        "LT-501 (Reflux Drum Level)", "LC-04 (Level Controller)",
                        "FT-501 (Reflux Flow)", "FT-502 (Feed Flow)",
                        "AT-501 (Distillate Analyzer)", "TT-510 (Reboiler Outlet)",
                        "PI-501 (Condenser Pressure)", "SV-501 (Safety Valve)"
                    ],
                    total_tags: 23,
                    instrument_loops: 15,
                    pipe_connections: 12,
                    ocr_confidence: "95.4%"
                }
            }]
        },
        {
            id: "step-3",
            title_p: "Building connectivity map for distillation system...",
            title_s: "Full distillation loop mapped — column, condenser, reboiler, reflux circuit",
            reasoning: [
                "Column DC-500: 20 trays, feed at tray 10",
                "Overhead vapor → CD-501 (condenser) → RD-501 (reflux drum)",
                "Reflux drum → P-501A/B (duty/standby) → FCV-10 → back to column top",
                "Distillate draw: RD-501 → FCV-11 → product tank",
                "Bottoms: DC-500 base → P-502 → reboiler RB-501 → return to column",
                "Steam to reboiler via FCV-12, controlled by TT-510",
                "Level control: LC-04 reads LT-501 → drives LCV-04 on distillate draw",
                "8 tray temperature sensors TT-501 through TT-508 for profile monitoring"
            ]
        },
        {
            id: "step-4",
            title_p: "Mapping 23 components to fishbone categories...",
            title_s: "Fishbone populated — most detailed diagram in investigation history",
            reasoning: [
                "Machine: DC-500, CD-501, RB-501, RD-501, P-501A/B, P-502, FCV-10/11/12, LCV-04, SV-501 (12 items)",
                "Measurement: TT-501-508, PT-501, LT-501, FT-501, FT-502, AT-501, TT-510, PI-501 (15 items)",
                "Material: Feed solvent composition, Steam quality, Cooling water temp",
                "Method: SOP-DC500-DIST-v4.0, Reflux ratio setpoint, Temperature profile",
                "Man: Operator monitoring practices, Response to tray temp alarms",
                "Environment: Ambient temp, Cooling tower performance, Steam header pressure",
                "NOTE: Without the P&ID, the team would spend days identifying which of these 23+ components to investigate"
            ]
        },
        {
            id: "step-5",
            title_p: "Analyzing tray temperature profile for separation anomalies...",
            title_s: "Anomaly found — trays 1-5 show flat temperature profile indicating poor reflux",
            reasoning: [
                "Normal profile: Gradual temp increase from top (tray 1) to bottom (tray 20)",
                "Current: Trays 1-5 all reading 78.2°C ± 0.3°C (should be 65-75°C gradient)",
                "Flat profile = poor liquid-vapor contact = poor separation",
                "This explains the low purity — column is not separating effectively",
                "Root cause is upstream of the trays — in the reflux system",
                "Investigating reflux circuit next: RD-501 → P-501A → FCV-10"
            ]
        },
        {
            id: "step-6",
            title_p: "Tracing reflux circuit — checking LC-04 level controller on reflux drum...",
            title_s: "Root cause identified — LC-04 sending erroneous signal to LCV-04, starving reflux",
            reasoning: [
                "LC-04 (level controller on reflux drum RD-501) output: 85% open on LCV-04",
                "But actual drum level is normal — LT-501 reads 52% (within range)",
                "LC-04 is OVER-driving LCV-04 → drawing too much distillate out",
                "Less liquid in drum → less available for reflux → P-501A pumping less",
                "Reduced reflux → poor separation on upper trays → low purity",
                "KEY: Nobody on the team thought to check LC-04 — it's not an obvious suspect",
                "The AI flagged it because the P&ID shows LC-04 directly controls the reflux/distillate split"
            ],
            artifacts: [{
                id: "root-cause-analysis",
                type: "json",
                label: "LC-04 Root Cause Analysis",
                data: {
                    root_cause_component: "LC-04 (Level Controller)",
                    affected_components: ["LCV-04 (Level Valve)", "RD-501 (Reflux Drum)", "P-501A (Reflux Pump)", "FCV-10 (Reflux Valve)"],
                    mechanism: "LC-04 over-driving LCV-04 → excessive distillate withdrawal → reflux starvation",
                    evidence: {
                        "LCV-04 position": "85% open (normal: 40-50%)",
                        "Reflux flow FT-501": "1.2 m³/hr (normal: 3.5 m³/hr)",
                        "Tray 1-5 profile": "Flat at 78.2°C (abnormal)"
                    },
                    insight: "P&ID-driven fishbone surfaced LC-04 as a suspect — manual investigation would likely have started with column internals (wrong path)"
                }
            }]
        },
        {
            id: "step-7",
            title_p: "Running 5-Why analysis on LC-04 malfunction...",
            title_s: "5-Why complete — LC-04 tuning parameters corrupted during DCS migration",
            reasoning: [
                "Why 1: Purity low → Poor separation on trays 1-5",
                "Why 2: Poor separation → Insufficient reflux (1.2 vs 3.5 m³/hr)",
                "Why 3: Low reflux → LCV-04 over-open (85%), draining reflux drum",
                "Why 4: LCV-04 over-driven → LC-04 PID tuning parameters incorrect (Kp=8.0, should be 2.5)",
                "Why 5: Tuning corrupted → DCS migration 3 weeks ago copied wrong parameter set",
                "Root cause: DCS migration QC gap — controller tuning not verified post-migration"
            ]
        },
        {
            id: "step-8",
            title_p: "Generating CAPA documentation...",
            title_s: "CAPA generated — flagged for additional human review due to system complexity",
            reasoning: [
                "CAPA ID: CAPA-2025-043",
                "Immediate: Restore LC-04 tuning to pre-migration parameters (Kp=2.5, Ti=120s, Td=30s)",
                "Preventive: Mandate controller tuning verification checklist for all DCS migrations",
                "Systemic: Create automated tuning parameter backup/compare tool for DCS changes",
                "FLAGGED FOR REVIEW: System has 23+ components — recommend senior engineer validate",
                "Additional review: Check all 15 controller loops for similar migration artifacts",
                "This investigation found an issue no one would have caught manually for weeks"
            ]
        },
        {
            id: "step-9",
            title_p: "Finalizing investigation and sending CAPA report...",
            title_s: "Investigation complete — CAPA submitted for senior review",
            reasoning: [
                "Total investigation time: 3.1 hours (most complex case)",
                "Traditional estimate: 5-7 days for a 23-component distillation system",
                "Time saved: ~95% reduction for complex investigations",
                "Critical insight: LC-04 was identified because P&ID showed its direct control relationship",
                "Without automated fishbone: team would likely have pulled column for internal inspection first (3-day shutdown)",
                "CAPA sent to Quality team — flagged for senior review due to DCS-wide implications"
            ],
            artifacts: [{
                id: "capa-email-3",
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
        await updateProcessListStatus(PROCESS_ID, isFinal ? "Needs Review" : "In Progress", step.title_s);
        await delay(1400);
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
