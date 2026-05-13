// ============================================================
// SDX Macro: Create Wilderness Inn Hooks Rollable Table
// Run this macro in FoundryVTT to generate a RollTable
// with 20 original hooks for roadside inns, crossroads taverns,
// and wilderness waypoints.
// ============================================================

const TABLE_NAME = "Wilderness Inn Hooks";

// Check if a table with this name already exists and delete it
const existing = game.tables.getName(TABLE_NAME);
if (existing) {
    await existing.delete();
    ui.notifications.info(`SDX | Replaced existing "${TABLE_NAME}" table.`);
}

const hooks = [
    "The innkeeper explains that the road ahead 'closes at sundown' — not by any official authority, but because every traveler who has pushed on after dark in the past month has turned up back at the inn by morning, shaken and unable to explain how.",
    "A lone rider arrived two nights ago, took a room, prepaid a week in advance, and has not emerged since. No sound comes from the room. The innkeeper slid food under the door on the first day. It was not touched.",
    "A group of pilgrims heading to a distant shrine have stopped for the night. Their leader insists the route marked on their holy map passes through somewhere that — according to every other map in the inn — simply does not exist.",
    "A traveling mail courier is distributing letters to everyone in the inn tonight — every guest has one, each sealed with the same plain black wax. The courier has no idea who sent them and picked up the pouch at a relay post that had no record of accepting it.",
    "The inn's well has begun producing water that is completely pure, odorless, and perfect — but it makes every fire it is used to boil gutter out immediately. The innkeeper is very confused and slightly worried.",
    "A merchant caravan has stopped here for repairs. The lead merchant is quietly, desperately hiring anyone available to ride ahead and check whether the bridge at the valley crossing is still standing.",
    "A child is sitting on the fence outside the inn, watching the road from both directions simultaneously by turning her head at regular intervals. She will not come in. She says she is 'waiting for the thing that's following the last group.'",
    "An older couple running a modest cart have taken the last room. Over supper, pieces of their conversation suggest they know rather more about the local area than travelers passing through should — including events that happened yesterday in a village three days' ride away.",
    "The road sign at the crossroads has been turned around. All of the signs are pointing in the wrong direction. The innkeeper says it happens every few months and shrugs. She's never bothered to find out who does it or why.",
    "A patrol of soldiers arrived at midday, requisitioned the inn's entire stock of preserved food, paid fairly, and left heading north. A second patrol arrived an hour later heading the same direction, also wanted provisions, and was confused to hear the first group had come through — they should have intercepted them on the road.",
    "The inn's stable master refuses to stable a particular horse that arrived with a recent guest. The horse is calm, healthy, and well-behaved. The stable master will not explain his objection and is clearly frightened.",
    "A bounty hunter is eating alone, has said nothing, and has a bounty board's worth of folded papers visible in her coat pocket. She has been making small marks on the edge of her plate with a knife since she arrived.",
    "The inn roof is covered in ravens. Only this inn — every other rooftop at the crossroads is clear. They have not made a sound since they arrived this morning. The innkeeper says they came in with yesterday's sunset and roosted as a group.",
    "A heavily loaded pack mule arrived at the inn without a rider, saddlebags full, reins trailing. It walked up to the trough, drank, and stopped. Its saddlebags contain trade goods, personal effects, and a letter that is addressed to the first person to find this animal.",
    "An elderly mapmaker is spending several days here, claiming the crossroads is not where any of her maps say it should be. She is recalculating. She looks like she has been recalculating for some time.",
    "The fireplace in the common room has not required new wood since dawn despite burning steadily all day. The innkeeper attributes this to 'a good cut of oak.' The fire is not consuming the logs visibly.",
    "Travelers coming from the west report a ruined inn two days up the road — same name, same signage, same floor plan as this one, but clearly abandoned for years. The innkeeper has no knowledge of a second location.",
    "A messenger arrived at speed, handed a sealed document to a guest in the corner, and departed immediately. The guest read it, placed it in the fire, finished their meal calmly, paid in advance for a week, and went to bed at the seventh hour.",
    "A trapper who uses this inn as a seasonal base is back earlier than anyone expected. He won't say what drove him in from the deep woods. He keeps looking at the door. He asked the innkeeper to bolt all the shutters before full dark.",
    "The inn has no sign of its original name — the board is blank and weathered clean. The innkeeper says it's always been that way. She refers to the place only as 'here,' and deflects every question about what it was called when it was built."
];

// Build the table results
const results = hooks.map((text, i) => ({
    type: 0,
    text: text,
    weight: 1,
    range: [i + 1, i + 1],
    drawn: false
}));

// Create the RollTable
const table = await RollTable.create({
    name: TABLE_NAME,
    formula: `1d${hooks.length}`,
    results: results,
    description: "20 original hooks for roadside inns, crossroads waypoints, and wilderness resting places.",
    replacement: true,
    displayRoll: true
});

ui.notifications.info(`SDX | "${TABLE_NAME}" rollable table created with ${hooks.length} entries!`);

// Open the table sheet for the user
table.sheet.render(true);
