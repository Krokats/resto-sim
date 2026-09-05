var ITEM_ID_MAP = {}; // Performance cache for lookups

// ============================================================================
// GEAR PLANNER LOGIC
// ============================================================================

async function loadDatabase() {
    showProgress("Loading Database...");
    try {
        updateProgress(20);

        // Load Items (JSONL) and Enchants (JSON)
        const [rItems, rEnchants] = await Promise.all([
            fetch('data/items.jsonl'), // Pfad zur .jsonl-Datei geändert
            fetch('data/enchants.jsonl')
        ]);

        if (!rItems.ok) throw new Error("Items DB Error " + rItems.status);
        if (!rEnchants.ok) throw new Error("Enchants DB Error " + rEnchants.status);

       // 1. JSONL einlesen: Als Text laden, in Zeilen aufteilen und jede Zeile parsen
        const itemsText = await rItems.text();
        const items = itemsText
            .split(/\r?\n/) // Berücksichtigt Windows (\r\n) und Linux (\n) Zeilenumbrüche
            .filter(line => line.trim() !== '') // Leere Zeilen (z.B. am Ende der Datei) ignorieren
            .map(line => JSON.parse(line)); // Jede einzelne Zeile als JSON parsen

        // ---> NEU: Dynamische Trennung von Instances und Raids <---
        const raidList = [
            "Blackwing Lair", 
            "Emerald Sanctum", 
            "Lower Karazhan Halls", 
            "Molten Core", 
            "Naxxramas",
            "Onyxia's Lair", 
            "Ruins of Ahn'Qiraj", 
            "Temple of Ahn'Qiraj", 
            "Timbermaw Hold", 
            "Upper Karazhan Halls", 
            "Zul'Gurub"
        ];

        items.forEach(item => {
            if (item.sources) {
                item.sources.forEach(src => {
                    // Wenn es als Instance deklariert ist, aber in der Raid-Liste steht -> Kategorie ändern
                    if (src.category === "Instances" && raidList.includes(src.subCategory)) {
                        src.category = "Raids";
                    }
                });
            }
        });

        const enchantsText = await rEnchants.text();
        const enchants = enchantsText
            .split(/\r?\n/) // Berücksichtigt Windows (\r\n) und Linux (\n) Zeilenumbrüche
            .filter(line => line.trim() !== '') // Leere Zeilen (z.B. am Ende der Datei) ignorieren
            .map(line => JSON.parse(line)); // Jede einzelne Zeile als JSON parsen    

        // 2. Enchants weiterhin als reguläres JSON einlesen
        //const enchants = await rEnchants.json();

        updateProgress(60);

        ITEM_DB = items.filter(i => {
            return true;
        });

        // Build Map for O(1) lookup
        ITEM_ID_MAP = {};
        ITEM_DB.forEach(i => { ITEM_ID_MAP[i.id] = i; });
        ENCHANT_DB = enchants;
        if (typeof initSourceTree === "function") initSourceTree();
        initGearPlannerUI();
        var statusEl = document.getElementById("dbStatus");
        if (statusEl) {
            statusEl.innerText = "Loaded (" + ITEM_DB.length + " items, " + ENCHANT_DB.length + " enchants)";
            statusEl.style.color = "#4caf50";
        }
        updateProgress(100);
    } catch (e) {
        console.error("DB Load Failed:", e);
        var statusEl = document.getElementById("dbStatus");
        if (statusEl) statusEl.innerText = "Error loading database files.";
    } finally {
        hideProgress();
    }
}

// ============================================================================
// GEAR UI
// ============================================================================

function initGearPlannerUI() {
    if (!document.getElementById('charLeftCol')) return;
    renderSlotColumn("left", "charLeftCol");
    renderSlotColumn("right", "charRightCol");
    renderSlotColumn("bottom", "charBottomRow");
    calculateGearStats();
}

function getIconUrl(iconName) {
    if (!iconName) return "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg";
    var cleanName = iconName.replace(/\\/g, "/").split("/").pop().replace(/\.jpg|\.png/g, "").toLowerCase();
    // Use local folder
    return "data/wow-icons/" + cleanName + ".jpg";
}

function getItemColor(q) {
    var colors = ["#9d9d9d", "#ffffff", "#1eff00", "#0070dd", "#a335ee", "#ff8000"];
    return colors[q] || "#9d9d9d";
}

function renderSlotColumn(pos, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    var currentWeights = getStatWeights();

    SLOT_LAYOUT[pos].forEach(function (slotName) {
        var itemId = GEAR_SELECTION[slotName];
        // Handle ID or Object (Legacy Safety)
        if (itemId && typeof itemId === 'object' && itemId.id) itemId = itemId.id;

        var item = itemId ? ITEM_ID_MAP[itemId] : null;
        var enchantId = ENCHANT_SELECTION[slotName];
        var enchant = enchantId ? ENCHANT_DB.find(e => e.id == enchantId) : null;

        var div = document.createElement("div");
        div.className = "char-slot";

        // Simple Tooltip logic
        div.onmouseenter = function (e) { showTooltip(e, item); };
        div.onmousemove = function (e) { moveTooltip(e); };
        div.onmouseleave = function () { hideTooltip(); };

        var iconUrl = "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg";
        var rarityClass = "q0";
        var displayName = slotName;
        var statText = "Empty Slot";
        var linkHtml = "";

        if (item) {
            iconUrl = getIconUrl(item.icon);
            rarityClass = "q" + (item.quality || 1);
            displayName = item.name;
            var s = calculateItemScore(item, slotName, currentWeights);
            statText = "Score: " + s.toFixed(1) + (item.requiredLevel ? " | Req: " + item.requiredLevel : "");

            if (item.url) {
                linkHtml = '<a href="' + item.url + '" target="_blank" class="slot-link-btn" title="Open in Database" onclick="event.stopPropagation()">🔗</a>';
            }
        }

        // --- ENCHANT RENDER LOGIC ---
        var canEnchant = true;
        if (slotName.includes("Trinket") || slotName.includes("Idol") || slotName.includes("Relic") || slotName.includes("Off")) canEnchant = false;

        var enchantHtml = "";
        if (canEnchant) {
            var enchName = enchant ? enchant.name : "+ Enchant";
            var enchStyle = enchant ? "color:#0f0; font-size:0.75rem;" : "color:#555; font-size:0.7rem; font-style:italic;";
            var eIdPass = enchant ? enchant.id : 0;
            // Add hover events for enchant tooltip
            enchantHtml = '<div class="slot-enchant-click" onmouseenter="showEnchantTooltip(event, ' + eIdPass + ')" onmousemove="moveTooltip(event)" onmouseleave="hideTooltip()" onclick="event.stopPropagation(); openEnchantSelector(\'' + slotName + '\')" style="' + enchStyle + '; margin-top:2px; cursor:pointer;">' + enchName + '</div>';
        }

        var html = '<div class="slot-icon ' + rarityClass + '" onclick="openItemSelector(\'' + slotName + '\')"><img src="' + iconUrl + '" style="width:100%; height:100%; border-radius:3px;"></div>' +
            '<div class="slot-info">' +
            '<div class="slot-name" onclick="openItemSelector(\'' + slotName + '\')" style="color: ' + getItemColor(item ? item.quality : 0) + '; cursor:pointer;">' + displayName + '</div>' +
            '<span class="slot-stats">' + statText + '</span>' +
            enchantHtml +
            '</div>' +
            linkHtml;
        div.innerHTML = html;
        container.appendChild(div);
    });
}

// Tooltips
function showTooltip(e, item) {
    if (!item) return;
    var tt = document.getElementById("wowTooltip");
    if (!tt) return;
    tt.style.position = "fixed";
    tt.style.display = "block";

    var qualityColor = getItemColor(item.quality);
    var iconUrl = getIconUrl(item.icon);

    var html = '<div class="tt-header"><div class="tt-icon-small" style="background-image:url(\'' + iconUrl + '\')"></div><div style="flex:1"><div class="tt-name" style="color:' + qualityColor + '">' + item.name + '</div></div></div>';

    // UPDATED: Use requiredLevel instead of itemLevel
    if (item.requiredLevel) html += '<div class="tt-white">Requires Level ' + item.requiredLevel + '</div>';

    // UPDATED: Slot + ArmorType/WeaponType aligned right
    if (item.slot) {
        html += '<div class="tt-white" style="display:flex; justify-content:space-between;">';
        html += '<span>' + item.slot + '</span>';

        // Nutze armorType oder weaponType als Klartext (z.B. "Leather", "Polearm")
        var typeText = item.armorType || item.weaponType || "";
        if (typeText) html += '<span>' + typeText + '</span>';

        html += '</div>';
    }

    if (item.armor) html += '<div class="tt-white">' + item.armor + ' Armor</div>';
    html += '<div class="tt-spacer"></div>';

    if (item.stamina) html += '<div class="tt-white">+' + item.stamina + ' Stamina</div>';
    if (item.intellect) html += '<div class="tt-white">+' + item.intellect + ' Intellect</div>';
    if (item.spirit) html += '<div class="tt-white">+' + item.spirit + ' Spirit</div>';
    if (item.agility) html += '<div class="tt-white">+' + item.agility + ' Agility</div>';
    if (item.strength) html += '<div class="tt-white">+' + item.strength + ' Strength</div>';

    html += '<div class="tt-spacer"></div>';

    // Additional Resistances
    if (item.fireRes) html += '<div class="tt-white">+' + item.fireRes + ' Fire Resistance</div>';
    if (item.natureRes) html += '<div class="tt-white">+' + item.natureRes + ' Nature Resistance</div>';
    if (item.frostRes) html += '<div class="tt-white">+' + item.frostRes + ' Frost Resistance</div>';
    if (item.shadowRes) html += '<div class="tt-white">+' + item.shadowRes + ' Shadow Resistance</div>';
    if (item.arcaneRes) html += '<div class="tt-white">+' + item.arcaneRes + ' Arcane Resistance</div>';

    html += '<div class="tt-spacer"></div>';

    if (item.effects) {
        var eff = item.effects;
        // Custom Texts
        if (eff.custom && Array.isArray(eff.custom)) {
            eff.custom.forEach(function (line) {
                html += '<div class="tt-green">' + line + '</div>';
            });
        }
    }

    // Set Info
    if (item.setName) {
        html += '<div class="tt-spacer"></div>';
        var siblings = ITEM_DB.filter(function (i) { return i.setName === item.setName; });
        var equippedCount = 0;
        for (var slot in GEAR_SELECTION) {
            var gid = GEAR_SELECTION[slot];
            if (gid && (typeof gid === 'number' || typeof gid === 'string') && gid != 0) {
                var gItem = ITEM_ID_MAP[gid];
                if (gItem && gItem.setName === item.setName) equippedCount++;
            }
        }
        html += '<div class="tt-gold">' + item.setName + ' (' + equippedCount + '/' + siblings.length + ')</div>';
        siblings.forEach(function (sItem) {
            var isEquipped = false;
            for (var slot in GEAR_SELECTION) {
                if (GEAR_SELECTION[slot] == sItem.id) isEquipped = true;
            }
            var color = isEquipped ? '#ffff99' : '#888';
            html += '<div style="color:' + color + '; margin-left:10px;">' + sItem.name + '</div>';
        });
        html += '<div class="tt-spacer"></div>';
        if (item.setBonuses) {
            if (typeof item.setBonuses === 'object' && !Array.isArray(item.setBonuses)) {
                var keys = Object.keys(item.setBonuses).sort(function (a, b) { return a - b });
                keys.forEach(function (thresholdStr) {
                    var threshold = parseInt(thresholdStr);
                    var bonusData = item.setBonuses[thresholdStr];
                    var isActive = (equippedCount >= threshold);
                    var color = isActive ? '#0f0' : '#888';

                    if (bonusData.custom && Array.isArray(bonusData.custom)) {
                        bonusData.custom.forEach(function (c) { html += '<div style="color:' + color + '">(' + threshold + ') Set: ' + c + '</div>'; });
                    }
                    else {
                        var parts = [];
                        if (bonusData.attackPower) parts.push("+" + bonusData.attackPower + " AP");
                        if (bonusData.crit) parts.push(bonusData.crit + "% Crit");
                        if (parts.length > 0) html += '<div style="color:' + color + '">(' + threshold + ') Set: ' + parts.join(", ") + '</div>';
                    }
                });
            } else if (Array.isArray(item.setBonuses)) {
                item.setBonuses.forEach(function (bonusText) {
                    var threshold = 0;
                    var match = bonusText.match(/^(\d+)|\((\d+)\)/);
                    if (match) threshold = parseInt(match[1] || match[2]);
                    var isActive = (threshold > 0) ? (equippedCount >= threshold) : false;
                    var color = isActive ? '#0f0' : '#888';
                    html += '<div style="color:' + color + '">' + bonusText + '</div>';
                });
            }
        }
    }

    // ---> NEU: Source Info anzeigen <---
    if (item.sources && item.sources.length > 0) {
        html += '<div class="tt-spacer"></div>';
        html += '<div class="tt-white" style="color: #00ccff;">Sources:</div>';
        
        item.sources.forEach(function(src) {
            var srcText = "";
            if (src.category) srcText += src.category;
            if (src.subCategory) srcText += (srcText ? " > " : "") + src.subCategory;
            if (src.detail) srcText += (srcText ? " > " : "") + src.detail;
            
            html += '<div class="tt-white" style="margin-left:10px; color: #88ccff;">' + srcText + '</div>';
        });
    }

    tt.innerHTML = html;
    moveTooltip(e);
}

// NEW: Enchant Tooltip with Text
function showEnchantTooltip(e, enchantId) {
    if (!enchantId || enchantId === 0) return;
    var ench = ENCHANT_DB.find(x => x.id == enchantId);
    if (!ench) return;

    var tt = document.getElementById("wowTooltip");
    if (!tt) return;
    tt.style.display = "block";

    var html = '<div class="tt-header"><div style="flex:1"><div class="tt-name" style="color:#1eff00">' + ench.name + '</div></div></div>';
    html += '<div class="tt-white">Enchant</div>';
    html += '<div class="tt-spacer"></div>';

    // Description from 'text' property (Green)
    if (ench.text) {
        html += '<div class="tt-green">' + ench.text + '</div>';
    }
    // Fallback if 'text' is missing but 'effects' exist
    else if (ench.effects) {
        var ef = ench.effects;
        if (ef.spellPower) html += '<div class="tt-green">+' + ef.spellPower + ' Spell Power</div>';
        if (ef.intellect) html += '<div class="tt-green">+' + ef.intellect + ' Intellect</div>';
        // Add others if needed
    }

    tt.innerHTML = html;
    moveTooltip(e);
}

function moveTooltip(e) {
    var tt = document.getElementById("wowTooltip");
    if (!tt) return;

    var width = tt.offsetWidth;
    var height = tt.offsetHeight;

    var x = e.clientX + 15;
    var y = e.clientY + 15;

    // X Logic
    if (x + width > window.innerWidth) {
        x = e.clientX - width - 15;
    }

    // Y Logic: Prefer down, if not enough space check up, if neither pin to top
    if (y + height > window.innerHeight) {
        // Check if fits above
        var yUp = e.clientY - height - 10;
        if (yUp < 0) {
            y = 10; // Pin to top
        } else {
            y = yUp;
        }
    }

    tt.style.left = x + "px";
    tt.style.top = y + "px";
}

function hideTooltip() { var tt = document.getElementById("wowTooltip"); if (tt) tt.style.display = "none"; }

// --- ITEM MODAL ---
var CURRENT_SELECTING_SLOT = null;
var CURRENT_MH_FILTER = null; // NEU: Speichert den aktiven Main-Hand Filter

function openItemSelector(slotName) {
    CURRENT_SELECTING_SLOT = slotName;
    CURRENT_MH_FILTER = null; // Reset Filter beim Öffnen
    
    var modal = document.getElementById("itemSelectorModal");
    var title = document.getElementById("modalTitle");
    var input = document.getElementById("itemSearchInput");
    var mhContainer = document.getElementById("mhFilterContainer"); // NEU
    
    if (modal && title && input) {
        title.innerText = "Select " + slotName;
        
        // NEU: Zeige Filter-Buttons nur bei Main-Hand
        if (mhContainer) {
            if (slotName === "Main Hand") mhContainer.classList.remove("hidden");
            else mhContainer.classList.add("hidden");
        }
        updateMHFilterButtons(); // Optischer Reset der Buttons

        modal.classList.remove("hidden");
        input.value = ""; input.focus();
        renderItemList();
    }
}

function closeItemModal() { 
    var modal = document.getElementById("itemSelectorModal"); 
    if (modal) modal.classList.add("hidden"); 
    CURRENT_SELECTING_SLOT = null; 
}

// NEU: Filter-Steuerung für die Buttons
function setMainHandFilter(filterType) {
    // Wenn derselbe Filter geklickt wird, deaktiviere ihn (Toggle)
    if (CURRENT_MH_FILTER === filterType) {
        CURRENT_MH_FILTER = null;
    } else {
        CURRENT_MH_FILTER = filterType;
    }
    updateMHFilterButtons();
    filterItemList(); // Liste neu laden
}

// NEU: Optische Anpassung der Buttons (welcher ist aktiv)
function updateMHFilterButtons() {
    var btnOne = document.getElementById("btnFilterOneHand");
    var btnTwo = document.getElementById("btnFilterTwoHand");
    
    if (btnOne) {
        btnOne.style.background = (CURRENT_MH_FILTER === "One-Hand") ? "rgba(129, 199, 132, 0.2)" : "#2a2a2a";
        btnOne.style.borderColor = (CURRENT_MH_FILTER === "One-Hand") ? "var(--druid-orange)" : "var(--border-color)";
    }
    if (btnTwo) {
        btnTwo.style.background = (CURRENT_MH_FILTER === "Two-Hand") ? "rgba(129, 199, 132, 0.2)" : "#2a2a2a";
        btnTwo.style.borderColor = (CURRENT_MH_FILTER === "Two-Hand") ? "var(--druid-orange)" : "var(--border-color)";
    }
}
function renderItemList(filterText) {
    var list = document.getElementById("modalItemList");
    if (!list) return;
    list.innerHTML = "";
    var unequipDiv = document.createElement("div");
    unequipDiv.className = "item-row";
    unequipDiv.onclick = function () { selectItem(0); };
    unequipDiv.innerHTML = '<div class="item-row-icon" style="background:#333;"></div><div class="item-row-details"><div class="item-row-name" style="color:#888;">- Unequip -</div></div>';
    list.appendChild(unequipDiv);
    var slotKey = CURRENT_SELECTING_SLOT;
    if (slotKey.includes("Finger")) slotKey = "Finger";
    if (slotKey.includes("Trinket")) slotKey = "Trinket";
    if (slotKey === "Idol") slotKey = "Relic";

    var relevantItems = ITEM_DB.filter(function (i) {
        // --- 1. SLOT LOGIK (Speziell für Resto) ---
        let slotMatches = false;
        if (CURRENT_SELECTING_SLOT === "Main Hand") {
            var s = i.slot.toLowerCase().replace(/[\s-]/g, "");
            if (s === "mainhand" || s === "onehand" || s === "twohand") {
                // NEU: Greift die Button-Filterung für Waffen auf
                if (CURRENT_MH_FILTER === "One-Hand" && s !== "mainhand" && s !== "onehand") return false;
                if (CURRENT_MH_FILTER === "Two-Hand" && s !== "twohand") return false;
                slotMatches = !!i.weaponType;
            }
        } else if (CURRENT_SELECTING_SLOT === "Finger 1") {
            slotMatches = (i.slot === slotKey && GEAR_SELECTION["Finger 2"] != i.id);
        } else if (CURRENT_SELECTING_SLOT === "Finger 2") {
            slotMatches = (i.slot === slotKey && GEAR_SELECTION["Finger 1"] != i.id);
        } else if (CURRENT_SELECTING_SLOT === "Trinket 1") {
            slotMatches = (i.slot === slotKey && GEAR_SELECTION["Trinket 2"] != i.id);
        } else if (CURRENT_SELECTING_SLOT === "Trinket 2") {
            slotMatches = (i.slot === slotKey && GEAR_SELECTION["Trinket 1"] != i.id);
        } else if (CURRENT_SELECTING_SLOT === "Off Hand") {
            slotMatches = (i.slot === "Held In Off-Hand");
        } else if (CURRENT_SELECTING_SLOT === "Idol") {
            slotMatches = (i.slot === "Relic" || i.slot === "Idol"); 
        } else {
            slotMatches = (i.slot === slotKey);
        }

        if (!slotMatches) return false;

        // --- 2. SOURCE FILTER LOGIK ---
        let isSourceEnabled = false;
        if (!i.sources || i.sources.length === 0) {
            isSourceEnabled = WORLD_DROPS_ENABLED;
        } else {
            // Checkt, ob mindestens EINE Quelle des Items im Filter aktiv ist
            isSourceEnabled = i.sources.some(function(src) {
                let cat = src.category || "Unknown";
                let sub = src.subCategory || "Unknown";
                let det = src.detail || "";
                
                if (SOURCE_TREE[cat] && SOURCE_TREE[cat][sub] && SOURCE_TREE[cat][sub][det] !== undefined) {
                    return SOURCE_TREE[cat][sub][det] === true;
                }
                return true;
            });
        }

        return isSourceEnabled;
    });

    // Calculate Score with Context (Slot Name) for Set Bonuses
    var currentWeights = getStatWeights();
    relevantItems.forEach(function (i) { i.simScore = calculateItemScore(i, CURRENT_SELECTING_SLOT, currentWeights); });
    relevantItems.sort(function (a, b) { return b.simScore - a.simScore; });

    if (filterText) {
        var ft = filterText.toLowerCase();
        relevantItems = relevantItems.filter(function (i) { return i.name.toLowerCase().includes(ft); });
    }

    // --- MARGINAL SCORE LOGIC ---
    // 1. Score des aktuell ausgerüsteten Items in diesem Slot ermitteln
    var currentEquippedId = GEAR_SELECTION[CURRENT_SELECTING_SLOT];
    // Legacy Safety
    if (currentEquippedId && typeof currentEquippedId === 'object' && currentEquippedId.id) currentEquippedId = currentEquippedId.id;

    var currentEquippedScore = 0;
    if (currentEquippedId && currentEquippedId !== 0) {
        var currentItem = ITEM_ID_MAP[currentEquippedId];
        if (currentItem) {
            currentEquippedScore = calculateItemScore(currentItem, CURRENT_SELECTING_SLOT, currentWeights);
        }
    }

    relevantItems.slice(0, 100).forEach(function (item) {
        var iconUrl = getIconUrl(item.icon);
        var row = document.createElement("div");
        row.className = "item-row";
        row.onclick = function () { selectItem(item.id); };
        row.onmouseenter = function (e) { showTooltip(e, item); };
        row.onmousemove = function (e) { moveTooltip(e); };
        row.onmouseleave = function () { hideTooltip(); };
        var levelText = item.requiredLevel ? 'Req: ' + item.requiredLevel : '';

        // 2. Delta (Differenz) berechnen und HTML formatieren
        var delta = item.simScore - currentEquippedScore;
        var deltaHtml = "";

        // Kleine Rundungsfehler ignorieren
        if (delta > 0.05) {
            deltaHtml = ' <span style="color:#1eff00; font-size:0.85em; margin-left: 5px;">(+' + delta.toFixed(1) + ')</span>';
        } else if (delta < -0.05) {
            deltaHtml = ' <span style="color:#f44336; font-size:0.85em; margin-left: 5px;">(' + delta.toFixed(1) + ')</span>';
        } else {
            deltaHtml = ' <span style="color:#888; font-size:0.85em; margin-left: 5px;">(0.0)</span>';
        }

        var html = '<div class="item-row-icon"><img src="' + iconUrl + '" style="width:100%; height:100%; border-radius:3px;"></div>' +
            '<div class="item-row-details"><div class="item-row-name" style="color: ' + getItemColor(item.quality) + '">' + item.name + '</div><div class="item-row-sub">' + levelText + '</div></div>' +
            '<div class="item-score-badge" style="display:flex; align-items:center;"><span class="score-label" style="margin-right: 4px;">SCORE</span>' + item.simScore.toFixed(1) + deltaHtml + '</div>';

        row.innerHTML = html;
        list.appendChild(row);
    });
}
function filterItemList() { var txt = document.getElementById("itemSearchInput").value; renderItemList(txt); }

function selectItem(itemId) {
    if (CURRENT_SELECTING_SLOT) {
        // --- 2H / OFFHAND LOGIC START ---

        // Check if we are selecting Main Hand
        if (CURRENT_SELECTING_SLOT === "Main Hand" && itemId != 0) {
            var item = ITEM_ID_MAP[itemId];
            // If item is Two-Handed, clear Off Hand
            if (item) {
                var s = item.slot ? item.slot.toLowerCase().replace(/[\s-]/g, "") : "";
                if (s === "twohand" || s === "staff" || s === "polearm") {
                    GEAR_SELECTION["Off Hand"] = 0;
                }
            }
        }

        // Check if we are selecting Off Hand
        if (CURRENT_SELECTING_SLOT === "Off Hand" && itemId != 0) {
            // Check if Main Hand is Two-Handed
            var mhId = GEAR_SELECTION["Main Hand"];
            if (mhId) {
                var mhItem = ITEM_ID_MAP[mhId];
                if (mhItem) {
                    var s = mhItem.slot ? mhItem.slot.toLowerCase().replace(/[\s-]/g, "") : "";
                    if (s === "twohand" || s === "staff" || s === "polearm") {
                        GEAR_SELECTION["Main Hand"] = 0; // Unequip 2H
                    }
                }
            }
        }
        // --- 2H / OFFHAND LOGIC END ---

        GEAR_SELECTION[CURRENT_SELECTING_SLOT] = itemId;
    }
    closeItemModal();
    initGearPlannerUI();
    saveCurrentState();
    // FORCE UI UPDATE AFTER GEAR CHANGE
    if (typeof updatePlayerStats === 'function') updatePlayerStats();
    if (typeof updateEnemyInfo === 'function') updateEnemyInfo();
}

// --- ENCHANT MODAL (NEW) ---
function openEnchantSelector(slotName) {
    CURRENT_SELECTING_SLOT = slotName;
    var modal = document.getElementById("enchantSelectorModal");
    var title = document.getElementById("enchantModalTitle");
    if (modal && title) {
        title.innerText = "Enchant " + slotName;
        modal.classList.remove("hidden");
        renderEnchantList();
    }
}

function closeEnchantModal() {
    var modal = document.getElementById("enchantSelectorModal");
    if (modal) modal.classList.add("hidden");
    CURRENT_SELECTING_SLOT = null;
}

function renderEnchantList() {
    var list = document.getElementById("modalEnchantList");
    if (!list) return;
    list.innerHTML = "";

    // Remove Enchant Option
    var unequipDiv = document.createElement("div");
    unequipDiv.className = "item-row";
    unequipDiv.onclick = function () { selectEnchant(0); };
    unequipDiv.innerHTML = '<div class="item-row-details"><div class="item-row-name" style="color:#888;">- No Enchant -</div></div>';
    list.appendChild(unequipDiv);

    var slotKey = CURRENT_SELECTING_SLOT;
    // Map Slots for DB query (Assume DB uses generic keys or check multiple)
    // E.g. "Finger 1" -> "Finger"
    if (slotKey.includes("Finger")) slotKey = "Finger";
    if (slotKey.includes("Trinket")) slotKey = "Trinket";
    if (slotKey === "Main Hand") slotKey = "Two Hand"; // Or One Hand, depends on logic. Enchants are usually "Weapon"

    var relevantEnchants = ENCHANT_DB.filter(function (e) {
        // 1. Class Filter (New)
        // 512 = Druid
        if (e.allowableClasses && e.allowableClasses !== -1) {
            // If the bitmask does not contain the Druid bit, skip it
            if ((e.allowableClasses & 512) === 0) return false;
        }

        // 2. Slot Filter (Existing)
        if (CURRENT_SELECTING_SLOT === "Main Hand") return (e.slot === "Weapon" || e.slot === "Two-hand" || e.slot === "Mainhand"); // NEW: Mainhand
        if (CURRENT_SELECTING_SLOT === "Off Hand") return (e.slot === "Shield"); // Only Shield Enchants
        if (CURRENT_SELECTING_SLOT === "Feet") return (e.slot === "Boots" || e.slot === "Feet");
        if (CURRENT_SELECTING_SLOT === "Hands") return (e.slot === "Gloves" || e.slot === "Hands");
        if (CURRENT_SELECTING_SLOT === "Waist") return (e.slot === "Belt" || e.slot === "Waist");
        if (CURRENT_SELECTING_SLOT === "Wrist") return (e.slot === "Bracer" || e.slot === "Wrist");
        if (CURRENT_SELECTING_SLOT === "Back") return (e.slot === "Cloak" || e.slot === "Back");
        if (CURRENT_SELECTING_SLOT.includes("Finger")) return (e.slot === "Finger"); // NEW: Finger (Neck cat in DB)

        return e.slot === CURRENT_SELECTING_SLOT || e.slot === slotKey;
    });
    var currentWeights = getStatWeights();
    relevantEnchants.forEach(function (e) { e.simScore = calculateEnchantScore(e, currentWeights); });
    relevantEnchants.sort(function (a, b) { return b.simScore - a.simScore; });

    relevantEnchants.forEach(function (ench) {
        var row = document.createElement("div");
        row.className = "item-row";
        row.onclick = function () { selectEnchant(ench.id); };
        row.onmouseenter = function (e) { showEnchantTooltip(e, ench.id); };
        row.onmousemove = function (e) { moveTooltip(e); };
        row.onmouseleave = function () { hideTooltip(); };

        var desc = ench.text || ""; // Show text description in list

        var html = '<div class="item-row-details"><div class="item-row-name" style="color: #1eff00;">' + ench.name + '</div><div class="item-row-sub">' + desc + '</div></div>' +
            '<div class="item-score-badge"><span class="score-label">SCORE</span>' + ench.simScore.toFixed(1) + '</div>';

        row.innerHTML = html;
        list.appendChild(row);
    });
}

function selectEnchant(enchId) {
    if (CURRENT_SELECTING_SLOT) {
        ENCHANT_SELECTION[CURRENT_SELECTING_SLOT] = enchId;
    }
    closeEnchantModal();
    initGearPlannerUI();
    saveCurrentState(); // Fix: Instant Save
}

// ===========================================================================
// GEAR CALCULATION LOGIC
// ===========================================================================

// Berechnet geschätzte Durchschnitts-Stats für On-Use & Procs (mit live Spirit-Skalierung)
function getSpecialItemEquivalents(itemName, currentSpirit) {
    var eq = { hp: 0, mp5: 0, haste: 0 };
    if (!itemName) return eq;
    var name = itemName.toLowerCase();

    // Basis Spirit-Regen in MP5 umrechnen: ((Spirit / 5) + 15) * 2.5
    var spirit = currentSpirit || 100;
    var fullRegenMp5 = ((spirit / 5) + 15) * 2.5;

    // Hilfsfunktion für "% Mana Regen while casting"
    var addCastRegen = function (pct) { eq.mp5 += (fullRegenMp5 * pct); };

    // Weapons & Idols
    if (name.includes("staff of the dreamer")) addCastRegen(0.05);
    if (name.includes("beacon of the emeral")) { addCastRegen(0.06); eq.hp += 20; }
    if (name.includes("rod of resuscitation")) eq.hp += 15;
    if (name.includes("alar'tar")) eq.mp5 += 24; // Fester Proc
    if (name.includes("idol of rejuvenation")) eq.hp += 20;
    if (name.includes("idol of health")) { eq.hp += 20; eq.haste += 1.5; }
    if (name.includes("idol of longevity")) eq.mp5 += 15;

    // Rings
    if (name.includes("loop of infused renewal")) { eq.hp += 25; eq.mp5 += 10; }
    if (name.includes("vanguard's ring")) addCastRegen(0.05);
    if (name.includes("deep sapphire circlet")) addCastRegen(0.05);
    if (name.includes("mana binding signet")) eq.mp5 += 8;
    if (name.includes("mark of the dragon lord")) eq.mp5 += 22;

    // Trinkets
    if (name.includes("blue dragon")) eq.mp5 += 40;
    if (name.includes("eye of the dead")) eq.hp += 35;
    if (name.includes("warmth of forgiveness")) eq.mp5 += 19;
    if (name.includes("shard of dreams") || name.includes("shard of the dreams")) { addCastRegen(0.10); eq.haste += 1.0; }
    if (name.includes("vanguard's brooch")) addCastRegen(0.10);
    if (name.includes("breath of solnius")) eq.haste += 3.0;
    if (name.includes("second wind")) eq.mp5 += 5;
    if (name.includes("burst of knowledge")) eq.mp5 += 12;
    if (name.includes("remains of the lost")) addCastRegen(0.05);
    if (name.includes("fey dreamcatcher")) addCastRegen(0.03);

    // On-Use Heal Trinkets
    if (name.includes("talisman of ascendance")) eq.hp += 25;
    if (name.includes("ephemeral power")) eq.hp += 29;
    if (name.includes("draconic infused emblem")) eq.hp += 38;
    if (name.includes("zandalarian hero charm")) eq.hp += 45;
    if (name.includes("hibernation crystal")) eq.hp += 58;
    if (name.includes("wushoolay")) { eq.hp += 30; eq.mp5 += 10; }
    if (name.includes("scarab brooch")) eq.hp += 40;

    return eq;
}

// Berechnet geschätzte Durchschnitts-Stats für Set-Boni (mit live Spirit-Skalierung)
function getSetBonusEquivalents(setName, newCount, currentSpirit) {
    var eq = { hp: 0, mp5: 0, haste: 0 };
    if (!setName) return eq;

    var spirit = currentSpirit || 100;
    var fullRegenMp5 = ((spirit / 5) + 15) * 2.5;
    var addCastRegen = function (pct) { eq.mp5 += (fullRegenMp5 * pct); };

    if (setName === "Raiment of the Talon") {
        if (newCount === 3) eq.hp += 10;
        if (newCount === 5) eq.hp += 30;
    } else if (setName === "Dreamwalker Raiment") {
        if (newCount === 4) eq.mp5 += 20;
        if (newCount === 8) eq.mp5 += 25;
    } else if (setName === "Wisdom of the Deer") {
        if (newCount === 3) eq.mp5 += 15; // Proc-basiert
    } else if (setName === "Genesis Raiment") {
        if (newCount === 3) eq.haste += 2.0;
        if (newCount === 5) eq.hp += 40;
    } else if (setName === "Stormrage Raiment") {
        if (newCount === 3) addCastRegen(0.15); // Exakt 15% skaliert mit Spirit!
        if (newCount === 5) eq.haste += 2.0;
        if (newCount === 8) eq.hp += 45;
    } else if (setName === "Haruspex's Garb") {
        if (newCount === 2) eq.mp5 += 4;
    } else if (setName === "Prayer of the Primal") {
        if (newCount === 2) eq.hp += 33;
    }

    return eq;
}

function resetGear() { GEAR_SELECTION = {}; ENCHANT_SELECTION = {}; initGearPlannerUI(); }

function recalcItemScores() {
    if (!document.getElementById("itemSelectorModal").classList.contains("hidden")) {
        renderItemList(document.getElementById("itemSearchInput").value);
    }
    if (!document.getElementById("enchantSelectorModal").classList.contains("hidden")) {
        renderEnchantList();
    }
    initGearPlannerUI();
}

// Liest die Stat-Gewichtungen EINMALIG aus dem DOM
function getStatWeights() {
    return {
        hp: parseFloat(document.getElementById("weight_hp") ? document.getElementById("weight_hp").value : 1.0),
        spirit: parseFloat(document.getElementById("weight_spirit") ? document.getElementById("weight_spirit").value : 0.46),
        int: parseFloat(document.getElementById("weight_int") ? document.getElementById("weight_int").value : 0.30),
        mp5: parseFloat(document.getElementById("weight_mp5") ? document.getElementById("weight_mp5").value : 3.0),
        crit: parseFloat(document.getElementById("weight_spell_crit") ? document.getElementById("weight_spell_crit").value : 1.0),
        haste: parseFloat(document.getElementById("weight_spell_haste") ? document.getElementById("weight_spell_haste").value : 1.0)
    };
}

function calculateItemScore(item, slotNameOverride, weights) {
    if (!item) return 0;

    // Verwende übergebene Weights oder hole sie als Fallback einmalig
    var w = weights || getStatWeights();

    var score = 0;
    var e = item.effects || {};

    var hp = e.healPower || 0;
    var spirit = item.spirit || 0;
    var intellect = item.intellect || 0;
    var mp5 = e.mp5 || 0;
    var crit = e.spellCrit || 0;
    var haste = e.spellHaste || 0;

    var score = 0;
    var e = item.effects || {};

    var hp = e.healPower || 0;
    var spirit = item.spirit || 0;
    var intellect = item.intellect || 0;
    var mp5 = e.mp5 || 0;
    var crit = e.spellCrit || 0;
    var haste = e.spellHaste || 0;

    // --- ADD EP FOR PROCS AND ON-USE ---
    // Den aktuellen Base-Spirit aus dem UI auslesen und ggf. den Item-Spirit dazurechnen
    var baseSpirit = parseFloat(document.getElementById("statSpirit") ? document.getElementById("statSpirit").value : 100);
    var testSpirit = baseSpirit + (item.spirit || 0);

    var eq = getSpecialItemEquivalents(item.name, testSpirit);
    hp += eq.hp;
    mp5 += eq.mp5;
    haste += eq.haste;

    // --- ADD EP FOR SET BONUSES ---
    if (item.setName && typeof GEAR_SELECTION !== 'undefined' && slotNameOverride) {
        var countWithoutSlot = 0;
        for (var slot in GEAR_SELECTION) {
            if (slot === slotNameOverride) continue;
            var gId = GEAR_SELECTION[slot];
            if (gId && typeof gId === 'object' && gId.id) gId = gId.id;
            if (gId && gId != 0) {
                var gItem = ITEM_ID_MAP[gId];
                if (gItem && gItem.setName === item.setName) countWithoutSlot++;
            }
        }
        var newCount = countWithoutSlot + 1;
        var th = getSetBonusEquivalents(item.setName, newCount, testSpirit);
        hp += th.hp;
        mp5 += th.mp5;
        haste += th.haste;
    }

    // Finale Multiplikation mit den Gewichtungen
    score += (hp * w.hp);
    score += (spirit * w.spirit);
    score += (intellect * w.int);
    score += (mp5 * w.mp5);
    score += (crit * w.crit);
    score += (haste * w.haste);

    return score;
}

function calculateEnchantScore(ench, weights) {
    if (!ench) return 0;

    var w = weights || getStatWeights();
    var score = 0;
    var e = ench.effects || {};

    var hp = (e.healPower || 0) + (e.spellPower || 0);
    var spirit = e.spirit || 0;
    var intellect = e.intellect || 0;
    var mp5 = e.mp5 || 0;
    var crit = e.spellCrit || 0;
    var haste = e.spellHaste || 0;

    score += (hp * w.hp);
    score += (spirit * w.spirit);
    score += (intellect * w.int);
    score += (mp5 * w.mp5);
    score += (crit * w.crit);
    score += (haste * w.haste);

    return score;
}

function calculateGearStats() {
    var raceSel = document.getElementById("char_race");
    var raceName = raceSel ? raceSel.value : "Tauren";
    var baseStats = RACE_STATS[raceName] || RACE_STATS["Tauren"];

    var charStats = {
        hp: 0,
        crit: baseStats.crit,
        hit: baseStats.hit,
        int: baseStats.int,
        spirit: baseStats.spirit || 100, // Fallback if missing
        mp5: 0,
        haste: baseStats.haste,
        hasteMult: 1.0 + (baseStats.haste / 100)
    };

    var gearOnlyStats = { hp: 0, int: 0, spirit: 0, mp5: 0, crit: 0, haste: 0 };
    var setCounts = {};

    // 1. ITEMS SAMMELN
    for (var slot in GEAR_SELECTION) {
        var id = GEAR_SELECTION[slot];
        if (id && typeof id === 'object' && id.id) id = id.id;

        if (id && id !== 0) {
            var item = ITEM_ID_MAP[id] || ITEM_DB.find(i => i.id == id);
            if (item) {
                var e = item.effects || {};
                var intVal = (item.intellect || 0);
                var spiritVal = (item.spirit || 0);
                var hpVal = (e.healPower || 0) + (e.spellPower || 0);
                var mp5Val = (e.mp5 || 0);
                var critVal = (e.spellCrit || 0);
                var hasteVal = (e.spellHaste || 0);

                charStats.int += intVal;
                charStats.spirit += spiritVal;
                charStats.hp += hpVal;
                charStats.mp5 += mp5Val;
                charStats.crit += critVal;
                charStats.haste += hasteVal;

                gearOnlyStats.int += intVal;
                gearOnlyStats.spirit += spiritVal;
                gearOnlyStats.hp += hpVal;
                gearOnlyStats.mp5 += mp5Val;
                gearOnlyStats.crit += critVal;
                gearOnlyStats.haste += hasteVal;


                if (item.setName) {
                    if (!setCounts[item.setName]) setCounts[item.setName] = 0;
                    setCounts[item.setName]++;
                }
            }
        }
    }

    // 2. ENCHANTS SAMMELN
    for (var slot in ENCHANT_SELECTION) {
        var eid = ENCHANT_SELECTION[slot];
        if (eid && eid !== 0) {
            var ench = ENCHANT_DB.find(e => e.id == eid);
            if (ench && ench.effects) {
                charStats.int += (ench.effects.intellect || 0);
                charStats.spirit += (ench.effects.spirit || 0);
                charStats.hp += (ench.effects.healPower || 0) + (ench.effects.spellPower || 0);
                charStats.mp5 += (ench.effects.mp5 || 0);
                charStats.crit += (ench.effects.spellCrit || 0);
            }
        }
    }

    // 3. SET BONUSES
    for (var setName in setCounts) {
        var count = setCounts[setName];
        var refItem = ITEM_DB.find(i => i.setName === setName);
        if (refItem && refItem.setBonuses && !Array.isArray(refItem.setBonuses)) {
            var keys = Object.keys(refItem.setBonuses);
            keys.forEach(function (k) {
                var threshold = parseInt(k);
                if (count >= threshold) {
                    var bonus = refItem.setBonuses[k];
                    charStats.hp += (bonus.healPower || 0) + (bonus.spellPower || 0);
                    charStats.mp5 += (bonus.mp5 || 0);
                    charStats.crit += (bonus.spellCrit || 0);
                    charStats.int += (bonus.intellect || 0);
                    charStats.spirit += (bonus.spirit || 0);
                }
            });
        }

    }

    // 4. BUFFS & CONSUMABLES (Auras & Elixirs)
    var isChecked = function (id) { var e = document.getElementById(id); return e && e.checked; };

    if (isChecked("buff_moonkin")) charStats.crit += 3;
    if (isChecked("buff_atiesh_warlock")) charStats.hp += 33;
    if (isChecked("buff_atiesh_mage")) charStats.crit += 2;

    if (isChecked("buff_arcane_brilliance")) charStats.int += 31;
    if (isChecked("buff_gotw")) { charStats.int += 16; charStats.spirit += 16; }

    if (getVal("buff_bow")) charStats.mp5 += 33;
    if (getVal("buff_mst")) charStats.mp5  += 25;

    if (isChecked("buff_elixir_dreamshard")) { charStats.hp += 15; charStats.crit += 2; }
    if (isChecked("buff_cerebral")) charStats.int += 25;

    // Radios: Weapon
    if (isChecked("buff_weapon_manaOil")) charStats.mp5 += 8;
    if (isChecked("buff_weapon_wizardOil")) charStats.hp += 24;

    // Radios: Food
    if (isChecked("buff_food_nightfin")) charStats.mp5 += 8;
    if (isChecked("buff_food_sagefish")) charStats.mp5 += 6;
    if (isChecked("buff_food_lobster")) charStats.spirit += 14;

    // Radios: Drink
    if (isChecked("buff_drink_sunfruit")) charStats.spirit += 10;
    if (isChecked("buff_drink_alterac")) charStats.spirit += 10;

    // Radios: Alcohol
    if (isChecked("buff_alcohol_merlot")) charStats.int += 15;

    // Blessing of Kings (Multiplikator auf Stats)
    if (isChecked("buff_bok")) {
        charStats.int = Math.floor(charStats.int * 1.10);
        charStats.spirit = Math.floor(charStats.spirit * 1.10);
    }

    // Tree of Life Aura (20% Spirit to Heal Power)
    if (isChecked("buff_tree")) {
        charStats.hp += Math.floor(charStats.spirit * 0.20);
    }

    // Crit Conversion: 60 Int = 1% Crit
    charStats.crit += (charStats.int / 60);

    // Multiplikatives Haste Stacking (Base + Atiesh + Food)
    var hasteMult = 1.0 + (charStats.haste / 100);
    if (isChecked("buff_atiesh_druid")) hasteMult *= 1.02;
    if (isChecked("buff_food_telabim")) hasteMult *= 1.02;
    charStats.hasteMult = hasteMult;

    // --- SPECIAL FLAT STATS (Rings & Sets) ---
    for (var s in GEAR_SELECTION) {
        var idCheck = GEAR_SELECTION[s];
        if (idCheck && idCheck !== 0) {
            var itemCheck = ITEM_ID_MAP[idCheck] || ITEM_DB.find(i => i.id == idCheck);
            if (itemCheck && itemCheck.name) {
                if (itemCheck.name.includes("Mark of the Dragon Lord")) charStats.mp5 += 22;
            }
        }
    }
    if (setCounts["Haruspex's Garb"] && setCounts["Haruspex's Garb"] >= 2) charStats.mp5 += 4;
    if (setCounts["Prayer of the Primal"] && setCounts["Prayer of the Primal"] >= 2) charStats.hp += 33;

    // 5. MANA BERECHNUNG
    var baseMana = 2670;
    var finalMana = baseMana + (charStats.int - baseStats.int) * 15;
    if (isChecked("buff_flask_wisdom")) finalMana += 2000;

    // --- NEU: DYNAMISCHE EP BERECHNUNG (Nachdem der finale Spirit feststeht) ---
    var finalSpirit = charStats.spirit;

    for (var slot in GEAR_SELECTION) {
        var id = GEAR_SELECTION[slot];
        if (id && typeof id === 'object' && id.id) id = id.id;
        if (id && id !== 0) {
            var item = ITEM_ID_MAP[id] || ITEM_DB.find(i => i.id == id);
            if (item) {
                var itemEq = getSpecialItemEquivalents(item.name, finalSpirit);
                gearOnlyStats.hp += itemEq.hp;
                gearOnlyStats.mp5 += itemEq.mp5;
                gearOnlyStats.haste += itemEq.haste;
            }
        }
    }
    for (var setName in setCounts) {
        var count = setCounts[setName];
        for (var c = 1; c <= count; c++) {
            var th = getSetBonusEquivalents(setName, c, finalSpirit);
            gearOnlyStats.hp += th.hp;
            gearOnlyStats.mp5 += th.mp5;
            gearOnlyStats.haste += th.haste;
        }
    }

    // 6. UI UPDATE: GEAR SCORE & STATS PREVIEW
    // 6. UI UPDATE: GEAR SCORE & STATS PREVIEW
    var w = getStatWeights();
    var finalGS = (gearOnlyStats.hp * w.hp) + (gearOnlyStats.spirit * w.spirit) + (gearOnlyStats.int * w.int) + (gearOnlyStats.mp5 * w.mp5) + (gearOnlyStats.crit * w.crit) + (gearOnlyStats.haste * w.haste);
    
    var elGS = document.getElementById("gp_gs"); if (elGS) elGS.innerText = finalGS.toFixed(0);
    var elInt = document.getElementById("gp_int"); if (elInt) { elInt.innerText = charStats.int + " / " + finalMana; elInt.style.fontSize = "0.85rem"; }
    var elHP = document.getElementById("gp_hp"); if (elHP) elHP.innerText = charStats.hp;
    var elSpirit = document.getElementById("gp_spirit"); if (elSpirit) elSpirit.innerText = charStats.spirit;
    var elMp5 = document.getElementById("gp_mp5"); if (elMp5) elMp5.innerText = charStats.mp5;
    var elCrit = document.getElementById("gp_crit"); if (elCrit) elCrit.innerText = charStats.crit.toFixed(2) + "%";
    var elHaste = document.getElementById("gp_haste"); if (elHaste) {
        var effHasteDisplay = (charStats.hasteMult - 1.0) * 100;
        elHaste.innerText = effHasteDisplay.toFixed(2) + "%";
    }

    // 7. INPUTS FÜR DIE ENGINE AKTUALISIEREN
    var inHP = document.getElementById("statHP"); if (inHP) { inHP.value = charStats.hp; inHP.dispatchEvent(new Event('change')); }
    var inSpirit = document.getElementById("statSpirit"); if (inSpirit) { inSpirit.value = charStats.spirit; inSpirit.dispatchEvent(new Event('change')); }
    var inInt = document.getElementById("statIntellect"); if (inInt) { inInt.value = charStats.int; inInt.dispatchEvent(new Event('change')); }
    var inMP5 = document.getElementById("statMP5"); if (inMP5) { inMP5.value = charStats.mp5; inMP5.dispatchEvent(new Event('change')); }
    var inMana = document.getElementById("statMana"); if (inMana) { inMana.value = finalMana; inMana.dispatchEvent(new Event('change')); }
    var inCrit = document.getElementById("statCrit"); if (inCrit) { inCrit.value = charStats.crit.toFixed(2); inCrit.dispatchEvent(new Event('change')); }
    var inHaste = document.getElementById("statHaste"); if (inHaste) {
        inHaste.value = charStats.haste.toFixed(2);
        inHaste.setAttribute("data-mult", charStats.hasteMult);
        inHaste.dispatchEvent(new Event('change'));
    }

    updateSpellStats();
    if (typeof updateActiveGearEffects === 'function') updateActiveGearEffects(setCounts);
}

function updateActiveGearEffects(setCounts) {
    var container = document.getElementById("activeGearEffectsList");
    if (!container) return;

    var effects = [];
    var eqNames = [];
    var eqSets = setCounts || {};

    for (var slot in GEAR_SELECTION) {
        var itmId = GEAR_SELECTION[slot];
        if (itmId && itmId !== 0) {
            var itm = ITEM_ID_MAP[itmId] || ITEM_DB.find(i => i.id == itmId);
            if (itm) eqNames.push(itm.name.toLowerCase());
        }
    }

    var hasItem = (str) => eqNames.some(n => n.includes(str.toLowerCase()));
    var hasSet = (name, count) => (eqSets[name] && eqSets[name] >= count);

    // Weapons
    if (hasItem("Staff of the Dreamer")) effects.push("<span style='color:#a335ee;'>Staff of the Dreamer:</span> 5% mana regen while casting.");
    if (hasItem("Beacon of the Emeral")) effects.push("<span style='color:#a335ee;'>Beacon of the Emerald Dream:</span> 6% mana regen while casting. HoTs are 1 tick shorter but heal 75% of a tick instantly.");
    if (hasItem("Rod of Resuscitation")) effects.push("<span style='color:#a335ee;'>Rod of Resuscitation:</span> Direct heals on targets below 50% HP heal for +80-100.");
    if (hasItem("Alar'tar")) effects.push("<span style='color:#a335ee;'>Alar'tar, Born from Hope:</span> Direct heals have 8% chance to grant 80 MP5 for 20s.");

    // Idols
    if (hasItem("Idol of Rejuvenation")) effects.push("<span style='color:#0070dd;'>Idol of Rejuvenation:</span> Rejuvenation heals for +50 overall.");
    if (hasItem("Idol of Health")) effects.push("<span style='color:#0070dd;'>Idol of Health:</span> Healing Touch cast time reduced by 0.15s.");
    if (hasItem("Idol of Longevity")) effects.push("<span style='color:#a335ee;'>Idol of Longevity:</span> Gain 25 mana per Healing Touch cast.");

    // Rings
    if (hasItem("Loop of Infused Renewal")) effects.push("<span style='color:#a335ee;'>Loop of Infused Renewal:</span> 10% chance on spellcast to apply a free Rejuvenation (388 heal over 12s).");
    if (hasItem("Vanguard's Ring")) effects.push("<span style='color:#a335ee;'>Vanguard's Ring:</span> 5% mana regen while casting.");
    if (hasItem("Deep Sapphire Circlet")) effects.push("<span style='color:#a335ee;'>Deep Sapphire Circlet:</span> 5% mana regen while casting.");
    if (hasItem("Mana Binding Signet")) effects.push("<span style='color:#a335ee;'>Mana Binding Signet:</span> 2% chance on cast to restore 75-85 mana.");
    if (hasItem("Mark of the Dragon Lord")) effects.push("<span style='color:#a335ee;'>Mark of the Dragon Lord:</span> Passive +22 MP5.");

    // Trinkets (On-Use & Procs)
    if (hasItem("Darkmoon Card: Blue Dragon")) effects.push("<span style='color:#a335ee;'>Blue Dragon:</span> 2% chance on cast to allow 100% mana regen for 15s.");
    if (hasItem("Eye of the Dead")) effects.push("<span style='color:#a335ee;'>Eye of the Dead (Use):</span> +450 Healing for next 5 spells.");
    if (hasItem("Warmth of Forgiveness")) effects.push("<span style='color:#a335ee;'>Warmth of Forgiveness (Use):</span> Restores 700 mana.");
    if (hasItem("Shard of Dreams") || hasItem("Shard of the Dreams")) {
        effects.push("<span style='color:#ff8000;'>Shard of the Dreams:</span> Passive 10% mana regen while casting.");
        effects.push("<span style='color:#ff8000;'>Shard of the Dreams (Use):</span> +20% mana regen and +5% haste for 6s per direct heal (max 6 stacks).");
    }
    if (hasItem("Vanguard's Brooch")) effects.push("<span style='color:#a335ee;'>Vanguard's Brooch:</span> 10% mana regen while casting.");
    if (hasItem("Breath of Solnius")) effects.push("<span style='color:#a335ee;'>Breath of Solnius:</span> 5% chance on heal to gain 20% haste for 20s.");
    if (hasItem("Second Wind")) effects.push("<span style='color:#a335ee;'>Second Wind (Use):</span> Restores 300 mana over 10s.");
    if (hasItem("Burst of Knowledge")) effects.push("<span style='color:#0070dd;'>Burst of Knowledge (Use):</span> Reduces spell mana cost by 100 for 10s.");
    if (hasItem("Remains of the Lost")) effects.push("<span style='color:#a335ee;'>Remains of the Lost:</span> 5% mana regen while casting.");
    if (hasItem("Fey Dreamcatcher")) effects.push("<span style='color:#0070dd;'>Fey Dreamcatcher:</span> 3% mana regen while casting.");
    if (hasItem("Talisman of Ascendance")) effects.push("<span style='color:#a335ee;'>Talisman of Ascendance (Use):</span> +75 Healing stacking up to 5 times for next 6 spells.");
    if (hasItem("Ephemeral Power")) effects.push("<span style='color:#a335ee;'>Talisman of Ephemeral Power (Use):</span> +175 Healing for 15s.");
    if (hasItem("Draconic Infused Emblem")) effects.push("<span style='color:#a335ee;'>Draconic Infused Emblem (Use):</span> +190 Healing for 15s.");
    if (hasItem("Zandalarian Hero Charm")) effects.push("<span style='color:#a335ee;'>Zandalarian Hero Charm (Use):</span> +408 Healing for 20s, reduces by 34 per cast.");
    if (hasItem("Hibernation Crystal")) effects.push("<span style='color:#a335ee;'>Hibernation Crystal (Use):</span> +350 Healing for 15s.");
    if (hasItem("Wushoolay")) effects.push("<span style='color:#a335ee;'>Wushoolay's Charm of Nature (Use):</span> HT cast time -40%, spell cost -5% for 15s.");
    if (hasItem("Scarab Brooch")) effects.push("<span style='color:#a335ee;'>Scarab Brooch (Use):</span> Heals apply a 15% absorb shield for 30s.");

    // Sets
    if (hasSet("Raiment of the Talon", 3)) effects.push("<span style='color:#ffff99;'>Talon (3/6):</span> Swiftmend cooldown reduced by 0.3s.");
    if (hasSet("Raiment of the Talon", 5)) effects.push("<span style='color:#ffff99;'>Talon (5/6):</span> Swiftmend shields target for 240 on next 5 hits.");
    if (hasSet("Dreamwalker Raiment", 4)) effects.push("<span style='color:#ffff99;'>Dreamwalker (4/9):</span> Mana cost of heals reduced by 3%.");
    if (hasSet("Dreamwalker Raiment", 8)) effects.push("<span style='color:#ffff99;'>Dreamwalker (8/9):</span> HT crits refund 30% of base mana cost.");
    if (hasSet("Wisdom of the Deer", 3)) effects.push("<span style='color:#ffff99;'>Wisdom of the Deer (3/6):</span> 8% chance on heal for 20% mana regen while casting for 15s.");
    if (hasSet("Genesis Raiment", 3)) effects.push("<span style='color:#ffff99;'>Genesis (3/5):</span> HT cast time reduced by 0.3s.");
    if (hasSet("Genesis Raiment", 5)) effects.push("<span style='color:#ffff99;'>Genesis (5/5):</span> HT heals +10% on targets with Rejuv or Regrowth.");
    if (hasSet("Stormrage Raiment", 3)) effects.push("<span style='color:#ffff99;'>Stormrage (3/8):</span> 15% mana regen while casting.");
    if (hasSet("Stormrage Raiment", 5)) effects.push("<span style='color:#ffff99;'>Stormrage (5/8):</span> Regrowth cast time reduced by 0.2s.");
    if (hasSet("Stormrage Raiment", 8)) effects.push("<span style='color:#ffff99;'>Stormrage (8/8):</span> Rejuvenation lasts 3s longer (+1 tick).");
    if (hasSet("Prayer of the Primal", 2)) effects.push("<span style='color:#ffff99;'>Prayer of the Primal (2/2):</span> Passive +33 Healing.");
    if (hasSet("Haruspex's Garb", 2)) effects.push("<span style='color:#ffff99;'>Haruspex's Garb (2/5):</span> Passive +4 MP5.");

    if (effects.length === 0) {
        container.innerHTML = "<div style='color:#888; font-style:italic; padding: 10px 0;'>No active gear effects. Equip items with Procs, On-Use or Set-Bonuses to see them here.</div>";
    } else {
        container.innerHTML = "<ul style='margin: 0; padding-left: 20px; color: #ccc; line-height: 1.6; font-size: 0.85rem;'>" +
            effects.map(e => "<li style='margin-bottom: 6px;'>" + e + "</li>").join("") +
            "</ul>";
    }
}

// ============================================================================
// SOURCE FILTER LOGIC (Global Multi-Level Menu)
// ============================================================================
var SOURCE_TREE = {};
var WORLD_DROPS_ENABLED = true;

function initSourceTree() {
    SOURCE_TREE = {};
    WORLD_DROPS_ENABLED = true;

    ITEM_DB.forEach(item => {
        if (!item.sources || item.sources.length === 0) {
            // World drop
        } else {
            item.sources.forEach(src => {
                let cat = src.category || "Unknown";
                let sub = src.subCategory || "Unknown";
                let det = src.detail || ""; 

                if (!SOURCE_TREE[cat]) SOURCE_TREE[cat] = {};
                if (!SOURCE_TREE[cat][sub]) SOURCE_TREE[cat][sub] = {};
                if (SOURCE_TREE[cat][sub][det] === undefined) {
                    SOURCE_TREE[cat][sub][det] = true; // Default: Alles ist anwählbar
                }
            });
        }
    });
    // Menü nur noch EINMAL bauen, statt bei jedem Klick!
    buildSourceMenuDOM(); 
}

function buildSourceMenuDOM() {
    var root = document.getElementById("sourceMenuRoot");
    if (!root) return;
    root.innerHTML = "";

    // 1. Checkbox für World Drops
    root.appendChild(createMenuItem("World Drops / Other", WORLD_DROPS_ENABLED, "world", null, null, null, false));

    // 2. Checkboxen für dynamische Kategorien
    Object.keys(SOURCE_TREE).sort().forEach(cat => {
        let catNode = createMenuItem(cat, isCategoryChecked(cat), "cat", cat, null, null, true);

        let subMenu = document.createElement("ul");
        subMenu.className = "submenu";

        Object.keys(SOURCE_TREE[cat]).sort().forEach(sub => {
            let subNode = createMenuItem(sub, isSubCategoryChecked(cat, sub), "sub", cat, sub, null, true);

            let detMenu = document.createElement("ul");
            detMenu.className = "submenu";

            Object.keys(SOURCE_TREE[cat][sub]).sort().forEach(det => {
                let label = det === "" ? "General / None" : det;
                let detNode = createMenuItem(label, SOURCE_TREE[cat][sub][det], "det", cat, sub, det, false);
                detMenu.appendChild(detNode);
            });

            subNode.appendChild(detMenu);
            subMenu.appendChild(subNode);
        });

        catNode.appendChild(subMenu);
        root.appendChild(catNode);
    });
}

function createMenuItem(label, isChecked, type, cat, sub, det, hasSubmenu) {
    let li = document.createElement("li");
    if (hasSubmenu) li.className = "has-submenu";

    let cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "source-checkbox";
    cb.checked = isChecked;
    
    // Wir speichern die Art der Checkbox als Daten-Attribut im Element
    cb.dataset.type = type;
    if (cat !== null) cb.dataset.cat = cat;
    if (sub !== null) cb.dataset.sub = sub;
    if (det !== null) cb.dataset.det = det;

    cb.onclick = function(e) { e.stopPropagation(); }; 
    cb.onchange = function(e) {
        handleSourceChange(type, cat, sub, det, e.target.checked);
    };

    let span = document.createElement("span");
    span.innerText = label;

    li.onclick = function(e) {
        if (e.target !== cb) {
            e.stopPropagation();
            cb.checked = !cb.checked;
            handleSourceChange(type, cat, sub, det, cb.checked);
        }
    };

    li.appendChild(cb);
    li.appendChild(span);
    return li;
}

function handleSourceChange(type, cat, sub, det, isChecked) {
    // 1. Daten im Hintergrund updaten
    if (type === "world") {
        WORLD_DROPS_ENABLED = isChecked;
    } else if (type === "cat") {
        setCategory(cat, isChecked);
    } else if (type === "sub") {
        setSubCategory(cat, sub, isChecked);
    } else if (type === "det") {
        SOURCE_TREE[cat][sub][det] = isChecked;
    }

    // 2. Optische Darstellung (Haken) live anpassen OHNE das HTML zu löschen
    syncCheckboxesUI();
    
    // 3. Item Liste neu filtern, falls das Modal offen ist
    updateItemListsIfOpen();
}

function syncCheckboxesUI() {
    let checkboxes = document.querySelectorAll(".source-checkbox");
    checkboxes.forEach(cb => {
        let type = cb.dataset.type;
        let cat = cb.dataset.cat;
        let sub = cb.dataset.sub;
        let det = cb.dataset.det;

        // Reset the indeterminate state before re-evaluating
        cb.indeterminate = false;

        if (type === "world") {
            cb.checked = WORLD_DROPS_ENABLED;
        } else if (type === "cat") {
            let checkedState = getCategoryCheckState(cat);
            cb.checked = checkedState.checked;
            cb.indeterminate = checkedState.indeterminate;
        } else if (type === "sub") {
            let checkedState = getSubCategoryCheckState(cat, sub);
            cb.checked = checkedState.checked;
            cb.indeterminate = checkedState.indeterminate;
        } else if (type === "det") {
            cb.checked = SOURCE_TREE[cat][sub][det];
        }
    });
}

// --- NEUE HELPER FUNKTIONEN FÜR INDETERMINATE STATUS ---

// Returnt ein Objekt: { checked: boolean, indeterminate: boolean }
function getCategoryCheckState(cat) {
    let totalSubs = 0;
    let checkedSubs = 0;
    let hasIndeterminateSub = false;

    for (let sub in SOURCE_TREE[cat]) {
        totalSubs++;
        let subState = getSubCategoryCheckState(cat, sub);
        if (subState.checked) checkedSubs++;
        if (subState.indeterminate) hasIndeterminateSub = true;
    }

    if (totalSubs === 0) return { checked: false, indeterminate: false };

    if (checkedSubs === totalSubs && !hasIndeterminateSub) {
        return { checked: true, indeterminate: false }; // Alle an
    } else if (checkedSubs === 0 && !hasIndeterminateSub) {
        return { checked: false, indeterminate: false }; // Alle aus
    } else {
        return { checked: false, indeterminate: true }; // Teilweise
    }
}

function getSubCategoryCheckState(cat, sub) {
    let totalDets = 0;
    let checkedDets = 0;

    for (let det in SOURCE_TREE[cat][sub]) {
        totalDets++;
        if (SOURCE_TREE[cat][sub][det]) checkedDets++;
    }

    if (totalDets === 0) return { checked: false, indeterminate: false };

    if (checkedDets === totalDets) {
        return { checked: true, indeterminate: false }; // Alle an
    } else if (checkedDets === 0) {
        return { checked: false, indeterminate: false }; // Alle aus
    } else {
        return { checked: false, indeterminate: true }; // Teilweise
    }
}

// Wir ersetzen auch die alten isCategoryChecked / isSubCategoryChecked, 
// damit handleSourceChange sauber arbeitet.
function isCategoryChecked(cat) {
    return getCategoryCheckState(cat).checked;
}
function isSubCategoryChecked(cat, sub) {
    return getSubCategoryCheckState(cat, sub).checked;
}

function setCategory(cat, val) {
    for (let sub in SOURCE_TREE[cat]) setSubCategory(cat, sub, val);
}
function setSubCategory(cat, sub, val) {
    for (let det in SOURCE_TREE[cat][sub]) SOURCE_TREE[cat][sub][det] = val;
}
function updateItemListsIfOpen() {
    var modal = document.getElementById("itemSelectorModal");
    if (modal && !modal.classList.contains("hidden")) {
        filterItemList();
    }
}

function toggleSourceMenu(e) {
    if(e) e.stopPropagation();
    var menu = document.getElementById("sourceMenuRoot");
    menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "block" : "none";
}

document.addEventListener("click", function(e) {
    var menu = document.getElementById("sourceMenuRoot");
    var btn = document.getElementById("sourceMenuBtn");
    if (menu && menu.style.display === "block") {
        if (!menu.contains(e.target) && e.target !== btn) {
            menu.style.display = "none";
        }
    }
});