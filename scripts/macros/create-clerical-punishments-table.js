// ============================================================
// SDX Macro: Create Clerical Punishments Rollable Table
// Run this macro in FoundryVTT to generate a RollTable
// with 100 penances and acts of contrition for Clerics
// who have fallen from their deity's favor.
// ============================================================

const TABLE_NAME = "Clerical Punishments";

// Check if a table with this name already exists and delete it
const existing = game.tables.getName(TABLE_NAME);
if (existing) {
    await existing.delete();
    ui.notifications.info(`SDX | Replaced existing "${TABLE_NAME}" table.`);
}

const punishments = [
    "All food must be eaten cold — no cooked meals until a senior priest declares the penance fulfilled",
    "All prayers must be spoken while kneeling on bare stone, regardless of weather or surface",
    "An iron circlet engraved with penitent runes must be worn visibly on the brow at all times",
    "Any gold earned must be divided equally among beggars before you may keep a single coin",
    "Any healing you receive from divine magic is halved until you complete a task set by the temple",
    "Ashes of a burnt holy text must be mixed into every drink you consume for one full moon cycle",
    "At dawn and dusk you must stand facing the nearest temple and recite every transgression aloud",
    "At every crossroads you must stop and offer a prayer before choosing your path — no exceptions",
    "Attend to the washing and preparation of the dead in the temple mortuary for a full season",
    "Before entering any building you must kneel at the threshold and ask permission of the divine",
    "Blessed salt must be rubbed into your palms each morning until the skin cracks and heals over",
    "Carry a clay tablet inscribed with your sin — if it breaks you must fire a new one and start over",
    "Carry a lantern filled with sanctified oil that must never be allowed to go out, day or night",
    "Carry a stone from the temple grounds in each shoe until the stones are worn smooth",
    "Cast no shadow upon any altar — you must remain outside during services, listening from the door",
    "Catch and release a living creature each day while speaking a prayer of mercy over it",
    "Clean the boots or sandals of every member of your order you encounter, without being asked",
    "Collect rainwater in a blessed vessel and pour it over your head while reciting dawn prayers",
    "Compose and deliver a sermon to an empty room each evening — the walls are your congregation",
    "Confess your failing to every stranger you share a meal with before eating",
    "Construct a shrine from found materials at every campsite and dismantle it upon departure",
    "Deny yourself the comfort of a roof — sleep outdoors even when shelter is freely offered",
    "Dig a grave-sized pit each morning, lie in it for one hour of reflection, then fill it back in",
    "Do not look upon your own reflection until the penance is lifted — cover or avoid all mirrors",
    "Do not speak the name of your deity — refer to them only through epithets and titles",
    "Drink only from cupped hands — no vessels, cups, waterskins, or containers of any kind",
    "Each morning, tie a new knot in a consecrated rope — when it holds a hundred knots, you are forgiven",
    "Eat only what others leave behind or discard — accept no fresh portion offered directly to you",
    "Embroider your transgressions in thread upon your vestments for all to read",
    "Every coin you spend must first be pressed against your holy symbol and held there for a full minute",
    "Every weapon you carry must be bound in cloth wrappings blessed by a different cleric",
    "Cover your face with melted wax from your temple's candles",
    "Find a wounded animal and nurse it back to full health before any other obligation",
    "For each lie you told, you must speak an uncomfortable truth to someone who does not wish to hear it",
    "Forge a new set of prayer beads from scratch — carving, stringing, and blessing each one yourself",
    "Gift your most prized possession to an enemy or rival of your faith as an act of humility",
    "Go unarmored until you have taken a blow meant for an innocent and survived it",
    "Guard a sacred flame in a temple hearth for seven consecutive nights without sleeping",
    "Hand-copy a holy manuscript onto fresh vellum using ink mixed with your own tears",
    "Harvest and dry herbs for the temple infirmary — a full bushel required before release",
    "Hold silence from sunset to sunrise — gestures only, no written communication either",
    "If you draw blood in combat, you must tend to your opponent's wounds afterward if they survive",
    "Immerse yourself completely in a sacred spring or river three times while confessing three failures",
    "Journey to the highest local peak and leave an offering at the summit, returning without looking back",
    "Keep a tally of every kind act you witness and report them to your confessor weekly",
    "Keep a vigil candle burning beside you at all hours — it must be lit from a temple flame",
    "Kneel and offer a prayer whenever you hear a bell ring, regardless of circumstance",
    "Labor in the fields of a temple farm until the harvest is brought in, taking no share for yourself",
    "Lead a lost traveler safely to their destination before pursuing any of your own goals",
    "Lend your weapon arm to the defense of any temple you encounter, for no fewer than three days",
    "Make a circuit of the temple walls on your hands and knees once per day at high noon",
    "Mark each day of penance by pressing a heated holy symbol briefly against your forearm",
    "Mend torn or damaged holy texts with your own needle and thread — no magic permitted",
    "Must walk at the rear of any group and may not lead or give orders until absolved",
    "Never be the first to eat or the last to rise — practice humility in every communal act",
    "No armor heavier than leather may be worn — your faith must serve as your shield",
    "No meat may pass your lips — subsist on bread, root vegetables, and water only",
    "No shelter may be taken in any building that charges for lodging — inns and taverns are forbidden",
    "Offer your services freely as a laborer to any community you pass through for at least one day",
    "Only speak when spoken to — never initiate conversation until the penance is complete",
    "Paint or chalk a holy symbol on every door you pass through, asking blessing upon the household within",
    "Perform last rites for every corpse you encounter regardless of faith, race, or allegiance",
    "Pour a measure of clean water onto bare earth each morning as an offering before drinking any yourself",
    "Pray while holding a heavy stone above your head — arms may not lower until the prayer is finished",
    "Present yourself to the nearest temple of your faith and submit to whatever labor they assign",
    "Purchase and free a caged animal or bonded servant — the cost must come from your own funds",
    "Read aloud from a holy text at every rest stop, whether others wish to hear it or not",
    "Refuse all magical healing directed at you — only natural rest and mundane medicine are permitted",
    "Remove all dye and color from your clothing — wear only undyed cloth until restoration",
    "Renounce one comfort you currently enjoy and live without it for a full turning of the moon",
    "Replace every meal with a single mouthful of sanctified bread and a sip of blessed wine",
    "Return to the site of your transgression and maintain a vigil there for three days and nights",
    "Scrub the floors of a temple using only a brush made from thorns and your own effort",
    "Seek out a hermit of your faith and serve them in isolation until they declare you worthy again",
    "Shave your head and keep it bare — hair may not be allowed to grow until forgiveness is granted",
    "Sleep with your holy symbol clutched in both hands — if you wake without holding it, add another day",
    "Speak a public apology at the next gathering of faithful — holding nothing back about your failure",
    "Spend a full day caring for the elderly in a poor quarter, attending to whatever they need",
    "Stitch shut your coin purse — you may not access personal wealth until the penance concludes",
    "Surrender your holy symbol to a superior and earn a replacement through acts of devotion",
    "Sweep the steps of every shrine you encounter, no matter how clean or how filthy",
    "Take no action to defend yourself for one full day — trust entirely in divine protection",
    "The next creature you slay must be offered as a burnt sacrifice with proper ritual and prayer",
    "Travel to a crossroads at midnight and bury a written confession beneath a cairn of white stones",
    "Undertake a three-day fast broken only by water blessed at a consecrated font",
    "Visit the sick in every settlement you enter and lay hands upon them, praying for their recovery",
    "Vow to undertake the next dangerous task presented to you, regardless of personal risk or reward",
    "Wade upstream in a river while reciting prayers — each step taken against the current is a step toward grace",
    "Walk barefoot for seven days while carrying a vessel of sanctified water that must not spill",
    "Wash the feet of seven strangers and speak a blessing over each before you may rest",
    "Wear a rough hemp cord tied tightly around each wrist as a constant reminder of your binding oath",
    "Wear your clothing inside-out so that all may see the unfinished seams of your repentance",
    "Weave a burial shroud from raw flax with your own hands and deliver it to a temple of the dead",
    "Whisper a prayer of forgiveness into a clay jar each night, then seal it — deliver the filled jar to a priest",
    "Write the name of every person you have wronged on a strip of parchment, burn it, and scatter the ash at a temple gate",
    "You may carry no more possessions than fit in your two hands until the faith is restored",
    "You may not pass through a doorway at the same time as another — always yield and enter last",
    "You must answer honestly any question put to you by a child, no matter how inconvenient the truth",
    "You must greet every dawn with arms outstretched and face upturned, standing motionless until the sun fully clears the horizon",
    "Your bedding must be the bare ground — no blanket, mat, or padding of any kind until absolved"
];

// Build the table results
const results = punishments.map((text, i) => ({
    type: 0,
    text: text,
    weight: 1,
    range: [i + 1, i + 1],
    drawn: false
}));

// Create the RollTable
const table = await RollTable.create({
    name: TABLE_NAME,
    formula: `1d${punishments.length}`,
    results: results,
    description: "100 penances and acts of contrition for Clerics who have fallen from divine favor.",
    replacement: true,
    displayRoll: true
});

ui.notifications.info(`SDX | "${TABLE_NAME}" rollable table created with ${punishments.length} entries!`);

// Open the table sheet for the user
table.sheet.render(true);
