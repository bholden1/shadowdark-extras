// ============================================================
// SDX Macro: Create Ship Events Rollable Table
// Run this macro in FoundryVTT to generate a RollTable
// with 100 ship events for seafaring adventures.
// ============================================================

const TABLE_NAME = "Ship Events";

// Check if a table with this name already exists and delete it
const existing = game.tables.getName(TABLE_NAME);
if (existing) {
    await existing.delete();
    ui.notifications.info(`SDX | Replaced existing "${TABLE_NAME}" table.`);
}

const events = [
    "A thick greenish film coats the waterline overnight — the Hull Doctor insists it's alive and growing",
    "Anchor chain goes taut in open water where charts show no bottom for miles",
    "Barrel of salt pork bursts open revealing nothing but clean white sand packed tight inside",
    "Below decks, someone has scratched tally marks into a beam — far more than the days since departure",
    "Bilge pump handle snaps clean off during routine drainage, water rising steadily",
    "Bird lands on the bowsprit carrying a strip of cloth with coordinates stitched into the hem",
    "Bosun discovers that every compass aboard now points in a slightly different direction",
    "Bow lookout swears the horizon line bends the wrong way — upward instead of down",
    "Cabin boy found sleepwalking the bowsprit at midnight, has no memory of climbing out",
    "Captain receives a sealed bottle from the sea — the handwriting inside is unmistakably their own",
    "Cargo manifest doesn't match what's actually in the hold: an extra unmarked crate appeared",
    "Charts in the navigation room have been redrawn overnight in a hand no one recognizes",
    "Cleat rips clean out of the deck under normal strain, revealing the wood beneath is rotten to the core",
    "Cook discovers that the freshwater barrel tastes faintly of honey and no one can explain it",
    "Cook's galley fire refuses to light no matter what fuel or tinder is used — resolved only by singing to it",
    "Crew finds a glass bottle wedged in the keel during hull inspection containing a tiny perfect ship model",
    "Crew member claims to have seen themselves standing at the stern rail from the crow's nest",
    "Crew member's hammock is slashed in the night — they were sleeping in it and felt nothing",
    "Crew wakes to find every knot on the ship has been untied and carefully coiled beside each line",
    "Dead calm sea reflects the stars so perfectly that the helmsman cannot tell which way is up",
    "Dense fog rolls in from a single point on the horizon like smoke from an unseen chimney",
    "Distinct smell of woodsmoke and roasting meat drifts across open water with no land in sight",
    "Dredging the anchor brings up a mud-caked strongbox that is warm to the touch",
    "Drinking water develops an iridescent sheen — still tastes fine, but nobody wants to be the one to test it",
    "During a calm night, the ship drifts backward three leagues despite no current or wind",
    "During a squall, lightning strikes the mainmast and leaves behind a perfect glass sculpture fused to the wood",
    "During hull scraping, divers find words carved into the underside of the keel in an ancient script",
    "Every candle and lantern aboard flickers in unison for exactly one minute, then stops",
    "Every fishing line cast off the stern comes back bitten clean through at exactly the same length",
    "Every mirror and reflective surface below decks fogs over simultaneously for no apparent reason",
    "Figurehead's expression seems to have changed — crew disagrees on whether it was always frowning",
    "First mate develops an obsessive need to polish brass fittings, neglecting all other duties",
    "Flock of small black birds circles the ship for exactly one hour then veers off due south",
    "Fog horn sounds from somewhere ahead — but the ship carries no fog horn",
    "Galley cat deposits a very dead and extremely unusual fish at the captain's cabin door",
    "Glass pane in the captain's cabin cracks in a perfect spiral pattern during calm weather",
    "Grappling hook found embedded in the stern rail — nobody aboard claims to have thrown it",
    "Green flash at sunset lasts far too long — a full thirty seconds instead of an instant",
    "Hammock nails keep working themselves loose in a specific section of the crew quarters",
    "Helmsman reports the wheel fought against a course correction as if something below preferred the old heading",
    "Hull groans and flexes in a rhythmic pattern that matches the breathing of everyone sleeping below",
    "Impossible sight: a campfire burning on the surface of the open ocean, about two hundred yards out",
    "Iron fittings throughout the ship develop rust overnight in the shape of tiny handprints",
    "Jellyfish bloom so dense and luminous it turns the surrounding sea into a field of pale blue light",
    "Keel shudders as if the ship scraped something massive just beneath the surface — depth check shows nothing",
    "Lantern oil consumption has tripled this week despite reduced night watches",
    "Large dark shape paces the ship beneath the waterline — visible only when the sun is directly overhead",
    "Lookout reports another vessel on a parallel course that vanishes whenever anyone else looks",
    "Loose plank in the deck reveals a hidden compartment containing a previous captain's journal, final entry mid-sentence",
    "Magnetic anomaly causes every piece of iron on the ship to become briefly magnetized, sticking together",
    "Map in the chart room has developed a new island that wasn't there yesterday — the ink is still wet",
    "Masthead pennant wraps itself into a perfect knot despite steady wind — rigger says it's physically impossible",
    "Message carved into the inside of the ship's bell reads 'do not ring at midnight' in the common tongue",
    "Moonlight hits the deck at an angle that creates the shadow of a ship much larger than this one",
    "Morning muster reveals a sailor no one recognizes — claims to have been aboard since departure",
    "Music drifts up from the bilge — faint strings, almost too quiet to hear, stopping whenever someone listens closely",
    "Mysterious sticky residue coats the starboard gunwale — smells of pine resin but the nearest forest is weeks away",
    "Navigator's sextant gives readings that place the ship on dry land three hundred miles inland",
    "Net cast for fish brings up a bundle of waterlogged letters addressed to people on this very ship",
    "Night watch reports the wake behind the ship glows faintly orange instead of the usual bioluminescence",
    "No wind for three days, yet the sails remain taut and the ship holds course perfectly",
    "Noon shadow of the mainmast falls in the wrong direction for a full ten minutes before correcting itself",
    "Old sailor recognizes a reef formation and insists it shouldn't be here — it's from waters a thousand miles south",
    "One of the lifeboats has been lowered, used, and re-secured overnight — the oarlocks are still damp",
    "Overnight the ship's name on the stern has changed by one letter — records confirm the original spelling",
    "Paint on the port side peels away in sheets revealing a different color underneath than what was originally applied",
    "Perfectly calm seas, yet the ship slowly rotates in place as if sitting on a lazy turntable",
    "Piece of driftwood hauled aboard for fuel won't burn — instead it weeps clear sap that smells of cloves",
    "Planks in the officer's mess warp upward forming a ridge that looks disturbingly like a sleeping face",
    "Porthole below the waterline shows clear bright sky instead of ocean — looking from outside shows only water",
    "Quarterdeck stairs creak out a recognizable melody when climbed in sequence, but only at dawn",
    "Rain falls exclusively on the ship while the sea around it remains dry under a cloudless sky",
    "Rigging produces a low harmonic tone in certain winds that puts crew members into a light trance",
    "Rope locker is found arranged with every line coiled identically — three crew members swear they left it a mess",
    "Row of barnacles on the hull forms a line of symbols that the ship's scholar says resemble an old trade language",
    "Rudder chain develops a rhythmic clinking that sounds like it's spelling something in ship's code",
    "Salt crystals form geometric patterns on the deck overnight that dissolve the moment someone touches them",
    "Sandbar appears directly ahead in waters charted as deep — navigation confirms position is correct",
    "Sea chest belonging to a deceased former crewmate washes up against the hull, rope still knotted to the handles",
    "Seabird deposits a gold ring on the deck, circles the ship three times, and flies directly into the sunset",
    "Severed figurehead from another vessel bumps against the hull all night despite currents moving the other way",
    "Ship's bell rings once by itself in the dead of night — the clapper was tied down",
    "Ship's dog stares at a fixed point in the empty ocean and whimpers for the entire middle watch",
    "Ship's log from the previous captain is found behind a loose panel — final entry warns about this exact stretch of water",
    "Ship's wake curves behind the vessel in a slow spiral instead of a straight line",
    "Small whirlpool forms off the port bow, barely three feet across, and follows the ship at exact pace for an hour",
    "Sounding line comes up smelling of sulfur from what should be cold deep water",
    "Stars reflected in the sea don't match the stars in the sky — they show a different season's constellations",
    "Stern lantern glass turns deep red without cause and casts the aft deck in an eerie crimson glow",
    "Storage locker that was definitely locked is found standing open with everything inside neatly re-organized",
    "Streak of bioluminescence spells out a word in the ship's wake — most crew dismiss it as coincidence",
    "Supply count reveals exactly one more barrel of hardtack than was loaded at port",
    "Temperature in the cargo hold drops sharply enough to see breath, while the deck bakes in tropical heat",
    "The crow's nest rope ladder has gained three additional rungs overnight — they're made of a different wood",
    "Tide mark on the hull suggests the ship rode six feet higher in the water during the night",
    "Trail of wet footprints leads from the gunwale to the hold and back — they are barefoot and far too large",
    "Two previously hostile crew members are suddenly best friends and neither can explain why",
    "Water around the hull turns briefly transparent to an impossible depth — shapes move far below",
    "Whale surfaces alongside and matches speed for hours, its eye tracking specific crew members as they move",
    "Wheel spins hard to starboard on its own during the graveyard watch — the helmsman was not touching it",
    "Wooden spoon in the galley has sprouted a single green leaf overnight"
];

// Build the table results
const results = events.map((text, i) => ({
    type: 0,
    text: text,
    weight: 1,
    range: [i + 1, i + 1],
    drawn: false
}));

// Create the RollTable
const table = await RollTable.create({
    name: TABLE_NAME,
    formula: `1d${events.length}`,
    results: results,
    description: "100 atmospheric ship events for seafaring adventures — strange occurrences, crew troubles, and nautical mysteries.",
    replacement: true,
    displayRoll: true
});

ui.notifications.info(`SDX | "${TABLE_NAME}" rollable table created with ${events.length} entries!`);

// Open the table sheet for the user
table.sheet.render(true);
