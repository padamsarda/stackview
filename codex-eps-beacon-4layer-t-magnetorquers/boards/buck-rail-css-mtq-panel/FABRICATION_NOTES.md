# Buck / Rail / CSS / MTQ — solid board for manual cutting

Current release: **gerber_Buck_Rail_CSS_MTQ.zip**. This revision replaces the routed/tab/mouse-bite releases.

The fabricator makes **one solid rectangular 99.90 × 99.90 mm PCB**, two layers, 1.6 mm FR-4, 1 oz copper. Edge.Cuts contains only the outer rectangle. **No internal routing, tabs, mouse bites or V-scoring.** Measured envelope including the 0.05 mm outline stroke is 99.95 × 99.95 mm.

## Cutting layout and markings

Rail is upper left, Buck lower left, CSS upper right, and MTQ lower right. CSS is shifted **5.00 mm right** from the initial manual-cut layout. Buck is aligned with the bottom of MTQ. The main left/MTQ cutting lane and CSS/MTQ separation are 2.00 mm; Rail/Buck separation is **19.89 mm**, and Rail/CSS separation is now **7.00 mm**.

Both silkscreen layers contain:

- **Unlabelled dashed vertical guide:** full-height separator between the left and right groups.
- **Unlabelled dashed upper horizontal guide:** between CSS and MTQ, across the separated right group.
- **Unlabelled dashed lower-left horizontal guide:** through the wide Rail/Buck gap.
- **Solid contours:** the nominal finished border of every individual board, including its rounded corners. Buck/Rail/MTQ retain R1.0 mm corners; CSS retains its original outline.

All added cutting text and legends have been removed from both silk layers; only the dotted guides and solid board borders remain. Existing circuit labels are unchanged.

**Cut the bare board before fitting components/modules.** First follow the full-height vertical guide, then the two horizontal guides to separate the units. These cuts leave sacrificial FR-4 around the nominal unit contours. Trim the surplus toward the solid contour from the scrap side; finish the corners to the contour. The contours are silkscreen guides, not factory routing. Lines coinciding with the outer manufactured edge may be clipped by the fabricator; the actual panel edge already defines those straight sides.

The 2 mm lanes give 1 mm from each cut centreline to the nominal board edge. Select a cutting method/kerf that stays within that lane and allow for positioning error. A wider lane cannot fit beside the 77.58 mm-wide MTQ board and 20.32 mm-wide left boards while keeping the overall width below 100 mm.

## Electrical and fabrication verification

All source boards, schematics, components, routing and project rules are unchanged. The combined board preserves **all 586 tracks/vias, 298 source pads and every filled copper polygon** after rigid placement. There are no inter-board electrical connections; grounds remain separate by board. Zone outlines are bounded to their own units, and a copper keepout covers the cutting lanes and scrap.

The panel has one closed outer outline and **265 PTH / 4 NPTH holes**. The four NPTH holes are existing CSS mounting holes; there are **zero added separation holes**. Nine manufacturing layer Gerbers, separate drills/maps/report, Gerber job, notes and checksum manifest are in the ZIP.

Remaining assembly DRC errors are MTQ module overhang conflicts with the CSS area. Separate the units before assembly. Outer-edge border silk generates expected edge-clearance warnings; no rules have been suppressed. Exact counts, source checks and refill diagnostics are under verification/. Panel schematic parity is not applicable because its four source schematics are independent.

The previously discussed MTQ INA226 negative switching-node voltage risk remains unresolved; fabrication export was explicitly authorized despite it. This mechanical revision does not qualify or redesign the source circuits.

Open the panel for viewing, but **do not update it from a schematic or globally refill it**. Rebuild with build_panel.py, check with verify_panel.py, export, then package with finish_panel.py. Source CAD is uncommitted.
