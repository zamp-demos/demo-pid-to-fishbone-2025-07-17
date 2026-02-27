# P&ID to Fishbone — Process Knowledge Base

## Overview

The P&ID to Fishbone process automates the creation of pre-populated Ishikawa (fishbone) diagrams for root cause investigations in pharmaceutical manufacturing. Instead of starting with a blank template, the system reads existing CAD/P&ID drawings using computer vision and OCR, extracts all equipment tags and their connections, and maps them onto the 6M fishbone categories when a quality event is triggered.

## Process Flow

1. **Quality Event Triggered** — A batch failure, OOS result, or equipment breakdown is reported
2. **P&ID Ingestion** — The relevant P&ID drawing is loaded and parsed using OCR + computer vision
3. **Equipment Extraction** — All equipment tags, sensors, valves, pipes, and control loops are identified
4. **Connectivity Mapping** — The system builds a process map showing what connects to what, flow direction, and control relationships
5. **Fishbone Population** — Extracted components are automatically mapped to the 6M categories (Machine, Measurement, Material, Method, Man, Environment)
6. **Engineer Review** — The pre-populated fishbone is presented to the investigation team for validation
7. **Root Cause Analysis** — Engineers run 5-Why analysis on suspect components, guided by the P&ID data
8. **CAPA Documentation** — Corrective and preventive actions are documented and submitted

## 6M Fishbone Categories

### Machine
Physical equipment and mechanical components: reactors, heat exchangers, pumps, valves, agitators, columns, condensers, reboilers.

### Measurement
Instruments and sensors: temperature transmitters (TT), pressure transmitters (PT), level transmitters (LT), flow transmitters (FT), analyzers (AT), controllers (TC, PC, LC, FC).

### Material
Raw materials, intermediates, utilities: solvents, APIs, heating/cooling fluids, steam, compressed air, cleaning agents.

### Method
Procedures and operating parameters: SOPs, batch recipes, temperature profiles, pressure setpoints, reflux ratios, ramp rates.

### Man
Human factors: operator training, shift handover, experience level, workload, compliance with procedures.

### Environment
External conditions: ambient temperature, humidity, clean room classification, utility supply conditions (chiller performance, steam header pressure).

## P&ID Reading Capabilities

- **OCR Engine**: Tesseract 5.0 with custom equipment tag recognition model
- **Computer Vision**: Symbol detection for ISA instrument symbols, valve types, equipment outlines
- **Supported Formats**: AutoCAD DWG, DXF, PDF scans of printed P&IDs
- **Multi-Sheet Support**: Can stitch multiple drawing sheets for complex systems
- **Average Confidence**: 95-98% depending on drawing quality and complexity

## Equipment Tag Standards

Tags follow ISA-5.1 instrument identification standards:
- **First letter**: Measured variable (T=Temperature, P=Pressure, L=Level, F=Flow, A=Analysis)
- **Subsequent letters**: Function (T=Transmitter, C=Controller, V=Valve, I=Indicator)
- **Numbers**: Loop number and instrument number

Examples:
- TT-201 = Temperature Transmitter, Loop 2, Instrument 01
- FCV-05 = Flow Control Valve, Loop 05
- LC-04 = Level Controller, Loop 04
- PT-101 = Pressure Transmitter, Loop 1, Instrument 01

## Investigation Timeline Comparison

| Metric | Traditional | P&ID to Fishbone |
|--------|------------|------------------|
| Fishbone creation | 2-4 hours | 5 minutes |
| Equipment identification | 1-2 days | Automated |
| Total investigation time | 2-5 days | 2-4 hours |
| Components missed | Common | Near zero |
| Audit readiness | Manual formatting | Auto-generated |

## Compliance

- FDA 21 CFR Part 211 (cGMP)
- FDA 21 CFR Part 11 (Electronic Records)
- ICH Q10 (Pharmaceutical Quality System)
- ISO 14224 (Equipment reliability data)
- CAPA documentation follows GAMP 5 guidelines
