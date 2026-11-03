# Interior notes

How the built interiors relate to the two sources: the HDB brochure plans and `reference/interior-design.pdf` (Appendix A of the spec). Furniture is never scaled. Where something does not fit, it is listed here.

HDB measurements below are read from low-resolution brochure images, so treat them as approximate.

Regenerate the comparison images in `docs/phase2/`:

```bash
pnpm --filter @bair/showroom exec vite --port 5199
```

```bash
pnpm --filter @bair/showroom exec node scripts/plan-compare.mjs
```

Open `#/dev/plan/<type>` (add `/m` for the mirrored variant) to see one type, or add `?debug=1` in the unit view for the measured plan.

## Clearances that cannot be met as written

`packages/project-data/src/interiors/exceptions.ts` lists these. The tests fail on any new violation, and also if one of these stops happening.

| Type | Where | Required | Actual | Why |
|---|---|---|---|---|
| 2RF_T1 | Between coffee table and TV console | 90 cm | 70 cm | 2.90 m room minus sofa 85, gap 45, table 50, console 40 |
| 2RF_T2 | Between coffee table and TV console | 90 cm | 80 cm | 3.00 m room, same furniture depths |
| 4R | Behind the three dining chairs on the kitchen side | 75 cm | 20 cm | Table and chairs with two walkways need 3.40 m; the room is 3.00 m. The hall side keeps its 90 cm walkway |

One more is outside the automated rules. Appendix A.4 asks for 1.6 m clear in front of the 4R master wardrobe. With the bed on the side wall there is 1.3 m, which still meets the 70 cm A.5 minimum.

## Where the plan differs from the PDF diagram, and why

**All types**
- Beds have their headboards on side walls, by decision of the design owner, instead of on the top wall as the PDF draws them. The top wall is the facade, so a headboard there would stand in front of the W1 window. The sage accent wall moves with the headboard. Appendix A phrases that describe the old position, such as "bed against the top wall" and "85 cm at the foot", no longer apply.
- Side-wall windows from the earlier build are gone. The brochure labels W1 only on the long facades, and the thin side lines on the plans are not clearly windows.

- Tall kitchen fittings no longer cover windows, which a new automated check enforces. In the 2-room types the hob and hood moved to the solid end of the window wall and the window is shorter. In the 3R the window moved to the utility end, clear of the 2.6 m wall cabinets. The 4R kitchen has no window of its own, as on the HDB plan; it gets daylight through the service yard.

**2RF_T1**
- The bedroom closes with a sliding panel, because the HDB plan shows one. The PDF draws a solid wall. The wall stays solid for the first 2.0 m so the TV has somewhere to go.
- The kitchen is open to the hall, as on the HDB plan.
- Bathroom fixtures take the HDB positions: the door is on the hall side, which is where the PDF puts the vanity.
- The headboard is on the solid part of the wall shared with the living room, so the TV and the bed use opposite faces of it. The bed runs along the window wall with its 80 cm path on the room side. The room is too shallow for a path on both long sides.
- The wardrobe moved to the far wall, opposite the bed.

**2RF_T2**
- Bedroom and Flexi are slightly L-shaped. HDB reaches the bedroom through a short passage below the TV wall, and a 1.6 m console does not fit otherwise.
- The living room starts 1.0 m below the bedroom's top wall, against about 1.4 m on the plans, for the same reason.
- The bedroom has no door leaf. The HDB plan draws an opening there.
- The bedroom is 3.25 m wide, not 3.20 m (within the ±10–15 cm tolerance), which gives the sliding wardrobe its full 70 cm in front. Wardrobe and bed now also clear the 60 cm minimum along both sides of the bed.
- The bathroom door sits 55 cm lower than on the HDB plan so the PDF's vanity and shower fit.
- The HDB bathroom looks close to 2.2 × 1.7 m against 1.6 × 1.5 m in Appendix A. The Appendix size is used.

**3R**
- The master bedroom is 4.0 m deep, not 3.9 m, to fit a 0.8 m door from the corridor.
- The common bathroom door is on its corridor side. HDB has it on the top wall, which in these room sizes would open into the master bedroom.
- The dining table sits about 0.7 m further up than on the PDF, and the coffee table is off-centre from the sofa. On the PDF position the table blocks the way from the entrance to the living room at 90 cm.
- The master headboard is on the east wall. HDB uses the west wall, but there the second nightstand would collide with the wardrobe. The dressing table moved to the west wall.
- In bedroom 2 the headboard is on the east wall, as on the HDB plan, the desk is in the top-left corner, and the window is narrowed to the right part of the wall, clear of the shelf above the desk.
- The optional sliding glass kitchen partition is 2.1 m wide, not 2.4 m as in Appendix A, because the counter takes the rest of the wall. A checkbox in the flat panel shows or hides it.

**4R**
- Living is 4.5 m deep (4.4 m in Appendix A) and the corridor 6.2 m long (6.0 m), so they meet the dining area with no leftover wall.
- The master ensuite is 1.7 m deep (1.6 m), because the WC front clearance does not fit otherwise.
- Kitchen counters are on the left and far walls, as HDB draws them. The PDF's right-hand run would block the service yard door. The fridge moved to the top of the left wall.
- In bedrooms 2 and 3, headboards are on the outer side walls and the doors sit beside the shared wall, as on the HDB plan. Wardrobes therefore take the HDB position, at the other end of the far wall from where the PDF draws them. Windows are narrowed to stay clear of the shelves above the desks.
- Single beds keep one free long side, the room side. The other side, toward the window wall, has about 60 cm but is partly closed by the desk corner.
- The master headboard is on the east wall and the dressing table moved to the west wall.
- The AC ledge is below the ensuite, as on the HDB plan. The PDF puts it to the right.
- Common bathroom fixtures are rearranged: vanity 60 + WC 38 + shower 80 is 1.78 m along a 1.70 m wall.

## Open questions

1. **2-room living rooms.** Accept the 70 and 80 cm paths, or use a smaller coffee table than Appendix A specifies?
2. **2RF_T2 folding door.** The PDF says it separates Flexi from the bedroom and is about 160 cm wide. The HDB plan has a wall there and suggests the door is on the living-room side, where the opening is 95 cm in this build. It is currently on the living-room side.
3. **Appendix sizes against HDB walls.** The spec says HDB walls win, but the ±10% area test uses Appendix A. This build follows Appendix A sizes and HDB topology. Is that the right reading?

## Doors

Doors are not drawn: every doorway is a clean opening, so buyers can see between rooms and nothing stands in the way. The door positions, widths and swings stay in the data, because they set the openings and the clearance checks still use them. No corridor is modelled outside the flats, so inside a flat the front doorway is filled with plain wall. Floor plans still show its gap.

## Not built yet

- Light fittings are in the data with their colour temperatures. Rendering uses warm room lights placed per room, not one light per fitting.
- Furniture is clean modelled geometry at exact sizes, with flat colours and no photoreal fabric or wood detail (Phase 9).
- Top-view plans are real-time renders with simple plants and plain figures. The hyper-realistic version comes from the Unreal pipeline (Phase 10).
- People are stylised figures made from simple forms. They read as people at a distance, and are not photoreal up close.
