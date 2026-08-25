// ============================================================================
// ARMORY IMPORT LOGIC (HTML PARSING)
// ============================================================================

function openArmoryModal() {
    var m = document.getElementById("armoryImportModal");
    if (m) m.classList.remove("hidden");
    document.getElementById("armoryName").focus();
}

function closeArmoryModal() {
    var m = document.getElementById("armoryImportModal");
    if (m) m.classList.add("hidden");
    setText("armoryStatus", "");
}

async function runArmoryImport() {
    var name = document.getElementById("armoryName").value.trim();
    var realm = document.getElementById("armoryRealm").value;
    var status = document.getElementById("armoryStatus");

    if (!name) {
        status.innerText = "Please enter a character name.";
        status.style.color = "#f44336";
        return;
    }

    status.innerText = "Fetching HTML ...";
    status.style.color = "#aaa";

    var targetUrl = `https://turtlecraft.gg/armory/${realm}/${name}`;

    // HIER DEINE WORKER URL EINTRAGEN:
    var workerUrl = `https://turtle-armory.johnrdoe89.workers.dev/?url=`;
    var finalUrl = workerUrl + encodeURIComponent(targetUrl);

    try {
        var response = await fetch(finalUrl);

        if (!response.ok) {
            throw new Error("Network Error or Character not found (Status " + response.status + ")");
        }

        var htmlText = await response.text();
        var parser = new DOMParser();
        var doc = parser.parseFromString(htmlText, 'text/html');

        // Rasse aus dem HTML/JSON extrahieren
        var raceString = "Tauren";
        var raceMatch = htmlText.match(/&quot;race&quot;:(\d+)/) || htmlText.match(/"race":(\d+)/);
        if (raceMatch) {
            var rId = parseInt(raceMatch[1]);
            if (rId === 4) raceString = "NightElf";
            if (rId === 6) raceString = "Tauren";
        }

        // Extract Data
        var uniqueFoundItems = extractItemsFromHtml(doc);
        if (uniqueFoundItems.length === 0) {
            throw new Error("No items found on page. Character might be naked or parsing failed.");
        }

        // Apply Data & Get Match Statistics
        var results = applyImportData(uniqueFoundItems, raceString, name);
        var msg = "Armory Scan: Found " + uniqueFoundItems.length + " unique Item-IDs.<br>";

        if (results.matched > 0) {
            msg += "<span style='color:#4caf50'>Successfully imported " + results.matched + " items.</span>";
        } else {
            msg += "<span style='color:#f44336'>No items matched your local DB.</span>";
        }

        if (results.matched < uniqueFoundItems.length) {
            msg += "<br><span style='font-size:0.8em; color:#888;'>(" + (uniqueFoundItems.length - results.matched) + " items skipped - not in local DB)</span>";
        }

        status.innerHTML = msg;
        if (results.matched > 0) {
            setTimeout(closeArmoryModal, 3000);
        }

    } catch (e) {
        console.error(e);
        status.innerText = "Error: " + e.message;
        status.style.color = "#f44336";
    }
}

/**
 * Scans HTML for item links and returns a UNIQUE list of objects.
 */
function extractItemsFromHtml(doc) {
    var foundMap = new Map(); // Use Map to deduplicate by ItemID immediately

    // 1. Vorhandene Logik: Items aus den Links auslesen
    var links = doc.querySelectorAll('a[href*="item="]');
    links.forEach(function (a) {
        var href = a.getAttribute('href');
        var itemMatch = href.match(/item=(\d+)/);

        if (itemMatch) {
            var iId = parseInt(itemMatch[1]);
            // Only add if not already present 
            if (!foundMap.has(iId)) {
                foundMap.set(iId, {
                    itemId: iId
                });
            }
        }
    });

    // 2. NEU: Quelltext nach dem versteckten JSON (itemEntry & enchantments) durchsuchen
    var htmlString = doc.documentElement.innerHTML;
    // Regex sucht nach &quot;itemEntry&quot;:ID ... &quot;enchantments&quot;:EFFECT_ID
    var regex = /&quot;itemEntry&quot;:(\d+)[^}]*?&quot;enchantments&quot;:(\d+)/g;
    var match;

    while ((match = regex.exec(htmlString)) !== null) {
        var iId = parseInt(match[1]);
        var eId = parseInt(match[2]);

        // Trage die effectId bei dem Item ein (oder lege es neu an, falls der Link es verpasst hat)
        if (foundMap.has(iId)) {
            foundMap.get(iId).effectId = eId;
        } else {
            foundMap.set(iId, { itemId: iId, effectId: eId });
        }
    }

    return Array.from(foundMap.values());
}

function applyImportData(importedItems, race, charName) {
    var matchCount = 0;

    // 1. NEU: Rasse im UI setzen, falls erkannt
    if (race) {
        var raceSel = document.getElementById('char_race');
        if (raceSel) {
            raceSel.value = race;
        }
    }

    // 2. Clear current gear
    GEAR_SELECTION = {};
    ENCHANT_SELECTION = {}; // NEU: Auch die Enchants zurücksetzen

    // 3. Map Items
    importedItems.forEach(function (entry) {
        var dbItem = ITEM_ID_MAP[entry.itemId];

        // Skip if not in DB
        if (!dbItem) {
            return;
        }

        var slotToAssign = null;
        var slotKey = dbItem.slot; // e.g. "Head", "Two-Hand", "Trinket"

        // Handle Multi-Slots & Mapping Logic
        if (slotKey === "Finger" || slotKey === "Ring") {
            if (!GEAR_SELECTION["Finger 1"]) slotToAssign = "Finger 1";
            else slotToAssign = "Finger 2";
        }
        else if (slotKey === "Trinket") {
            if (!GEAR_SELECTION["Trinket 1"]) slotToAssign = "Trinket 1";
            else slotToAssign = "Trinket 2";
        }
        // FIXED: Added "Two-Hand" and "Mainhand" for Staves/Maces/Polearms
        else if (slotKey === "Two-hand" || slotKey === "One-hand") {
            slotToAssign = "Main Hand";
        }
        else if (slotKey === "Held In Off-Hand") {
            slotToAssign = "Off Hand";
        }
        else if (slotKey === "Relic") {
            slotToAssign = "Idol";
        }
        else {
            // Direct Match (Head, Chest, Hands, etc.)
            slotToAssign = slotKey;
        }

        if (slotToAssign) {
            GEAR_SELECTION[slotToAssign] = entry.itemId;
            matchCount++;

            // NEU: Enchantment zuweisen, falls eine effectId gefunden wurde
            if (entry.effectId && entry.effectId !== 0) {
                // prüfe, ob slotToAssign beinhaltet e.slot Wert (z.B. slotToAssign "Finger 1" und e.slot "Finger")
                var enchant = ENCHANT_DB.find(function (e) { return e.effectId === entry.effectId && slotToAssign.includes(e.slot); });
                if (enchant) {
                    ENCHANT_SELECTION[slotToAssign] = enchant.id;
                }
            }
        }
    });

    // 4. Update UI
    initGearPlannerUI();
    saveCurrentState();
    showToast("Imported data for " + charName);

    return { matched: matchCount };
}