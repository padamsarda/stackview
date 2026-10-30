# ADCS final EM fabrication package — 23 October 2026

Final saved EM rev 1.0 package: **gerber_ADCS.zip**. It contains fifteen flat files: nine board Gerbers, the Gerber job, separate plated/nonplated Excellon drills, two drill maps and the drill report. Source and output checksums are in **RELEASE.json**. Purchasing metadata now records the selected parts in the schematic and PCB; routing and placement are preserved.

Verification: **DRC 0 violations / 41 intentional unused-stack connections / 0 schematic parity; ERC 0 active errors / 33 existing warnings / 1 documented VCAP exclusion**. Exact schematic node sets unchanged: 183 nets, 406 nodes. Zones refilled. The actual final Gerber/Excellon files were parsed and rendered; top/bottom copper, soldermask, legends, outline and drill alignment were inspected. Headers, file functions, job stackup, absolute drill coordinates, slots, counts and ZIP integrity passed. Independent review confirmed electrical and geometry preservation.

Board settings: two copper layers,1.6mm nominal FR4,35um (1oz) copper each side. Outline centreline95.89×90.17mm; job-file extents96.04×90.32mm include the outline stroke. Drill report:307plated features including four0.6mm-tool USB shell slots, and two0.65mm NPTH locating holes. Board and IMU mounting holes are plated in this design. Job `Finish: None` is an unspecified finish field; select the intended finish in the fabrication quote.

Selected crystal and remaining order checks:

1. Crystal selection is complete: Y1 is **ECS-250-8-33B-CTN-TR**, DigiKey cut-tape **50-ECS-250-8-33B-CTN-CT-ND**, confirmed by Padam on 23 October 2026 and recorded in the CAD metadata and assembly BOM. Q1 uses **Diodes Incorporated 2N7002-7-F**. Existing 10 pF C0G load capacitors are initial assembly values; frequency/startup tests belong to assembled-board bring-up.
2. Confirm actual USB-C connector,4.5mm switches, headers and original Adafruit2472 module fit the footprints and stack height. The original Adafruit pin/mounting pattern was checked against its vendor Eagle file; installed-part height and supplied connector/switch fit have not been physically measured.
3. In the fabrication upload preview, confirm the vendor recognises the plated USB slots, separate NPTH holes, two layers, 1.6 mm thickness and 1 oz copper. No order has been submitted.

The first assembled EM board needs current-limited bring-up, source-isolation/USB start/replug/temperature tests, clock checks and CAN/I2C/IMU tests. Passing CAD checks does not establish production qualification. Source selector J8 uses one shunt; change it only with power off.

RELEASE.json identifies the exact source PCB, schematic and ZIP hashes. Regenerate the fabrication files after any further PCB edits. Updated previews, the schematic PDF, assembly drawing and assembly BOM are in ../exports/.
