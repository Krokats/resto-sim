// ============================================================================
// UI SETUP & EVENT LISTENERS
// ============================================================================
var CURRENT_LOG_PAGE = 0;
var LOG_ENTRIES_PER_PAGE = 50;

/**
 * Resto Druid Simulation - File 4: State & Listeners
 */

function setupUIListeners() {
    setupCollapsibleCards();

    // Race Change Listener
    var raceSel = document.getElementById('char_race');
    if (raceSel) {
        raceSel.addEventListener('change', function () {
            calculateGearStats();
            saveCurrentState();
        });
    }

    // Config Listeners
    CONFIG_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function () {
                if (id.startsWith("buff_") || id.startsWith("weight_")) {
                    calculateGearStats();
                }
                saveCurrentState();
            });

            // Live Update for weights
            if (id.startsWith("weight_")) {
                el.addEventListener('input', function () {
                    calculateGearStats();
                    recalcItemScores();
                });
            }
        }
    });

    // Modal Close Listeners (Escape Key & Outside Click)
    document.addEventListener('keydown', function (e) {
        if (e.key === "Escape") {
            if (typeof closeItemModal === 'function') closeItemModal();
            if (typeof closeEnchantModal === 'function') closeEnchantModal();
        }
    });

    var modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(function (modal) {
        modal.addEventListener('mousedown', function (e) {
            if (e.target === modal) {
                if (typeof closeItemModal === 'function') closeItemModal();
                if (typeof closeEnchantModal === 'function') closeEnchantModal();
            }
        });
    });
}

function setupCollapsibleCards() {
    var headers = document.querySelectorAll('.card-header');
    headers.forEach(function (header) {
        if (header.classList.contains('clickable') || header.querySelector('h2')) {
            header.addEventListener('click', function (e) {
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
                var card = header.closest('.card');
                if (card) card.classList.toggle('collapsed');
            });
        }
    });
}


// ============================================================================
// MANAGEMENT & STATE
// ============================================================================

function getCurrentConfigFromUI() {
    var cfg = {};
    CONFIG_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox' || el.type === 'radio') cfg[id] = el.checked ? 1 : 0;
            else cfg[id] = el.value;
        }
    });

    cfg.gearSelection = typeof GEAR_SELECTION !== 'undefined' ? structuredClone(GEAR_SELECTION) : {};
    cfg.enchantSelection = typeof ENCHANT_SELECTION !== 'undefined' ? structuredClone(ENCHANT_SELECTION) : {};
    cfg.custom_rotation = typeof CUSTOM_ROTATION !== 'undefined' ? structuredClone(CUSTOM_ROTATION) : { steps: [] };

    // NEU: Aktuellen Talentbaum mit ins Profil speichern
    cfg.talents = typeof TALENT_CONFIG !== 'undefined' ? structuredClone(TALENT_CONFIG) : {};

    return cfg;
}

function applyConfigToUI(cfg) {
    if (!cfg) return;

    for (var id in cfg) {
        // NEU: 'talents' überspringen, damit es nicht als HTML-Element gesucht wird
        if (id === 'gearSelection' || id === 'enchantSelection' || id === 'custom_rotation' || id === 'module' || id === 'talents') continue;
        var el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = (cfg[id] == 1);
            else el.value = cfg[id];
        }
    }

    GEAR_SELECTION = cfg.gearSelection ? structuredClone(cfg.gearSelection) : {};
    ENCHANT_SELECTION = cfg.enchantSelection ? structuredClone(cfg.enchantSelection) : {};

    if (typeof initGearPlannerUI === 'function') initGearPlannerUI();

    // DOM Update for Item Icons
    if (GEAR_SELECTION && Object.keys(GEAR_SELECTION).length > 0) {
        for (var slot in GEAR_SELECTION) {
            var id = GEAR_SELECTION[slot];
            if (id && id !== 0) {
                var item = ITEM_ID_MAP ? ITEM_ID_MAP[id] : null;
                if (item && item.icon) {
                    var el = document.getElementById(slot);
                    if (el) {
                        var iconUrl = "https://wow.zamimg.com/images/wow/icons/large/" + item.icon + ".jpg";
                        el.style.backgroundImage = "url('" + iconUrl + "')";
                        el.classList.add("has-item");
                    }
                }
            }
        }
    }

    // NEU: Talente laden und den Baum visuell aktualisieren
    if (cfg.talents) {
        TALENT_CONFIG = structuredClone(cfg.talents);
    } else {
        // Fallback für alte Speicherstände ohne Talente: Alles auf 0 setzen
        if (typeof TALENT_CONFIG !== 'undefined') {
            for (var key in TALENT_CONFIG) { TALENT_CONFIG[key] = 0; }
        }
    }
    if (typeof renderTalentTree === 'function') renderTalentTree();

    calculateGearStats();

    if (cfg.custom_rotation) {
        CUSTOM_ROTATION = structuredClone(cfg.custom_rotation);
    } else {
        CUSTOM_ROTATION = structuredClone(PRESET_ROTATIONS["Basic Tank Heal"]);
    }

    if (typeof renderRotationList === 'function') renderRotationList();
}

function saveCurrentState() {
    if (SIM_LIST[ACTIVE_SIM_INDEX]) {
        var isOverview = !document.getElementById('comparisonView').classList.contains('hidden');
        if (!isOverview) {
            SIM_LIST[ACTIVE_SIM_INDEX].config = getCurrentConfigFromUI();
            var nameInput = document.getElementById('simName');
            if (nameInput) SIM_LIST[ACTIVE_SIM_INDEX].name = nameInput.value;
        }
    }
}

function addSim(isFirst) {
    if (!isFirst) saveCurrentState();
    var newId = Date.now();
    var newName = isFirst ? "Simulation 1" : "Simulation " + (SIM_LIST.length + 1);
    var newSim = new SimObject(newId, newName);

    if (!isFirst && SIM_LIST.length > 0) {
        newSim.config = structuredClone(SIM_LIST[ACTIVE_SIM_INDEX].config);
    } else {
        newSim.config = getCurrentConfigFromUI();
    }

    SIM_LIST.push(newSim);
    if (!isFirst) switchSim(SIM_LIST.length - 1);
    else if (typeof renderSidebar === 'function') renderSidebar();
}

function deleteSim(index) {
    if (!confirm("Delete?")) return;
    SIM_LIST.splice(index, 1);
    if (SIM_LIST.length === 0) { addSim(true); return; }
    if (index === ACTIVE_SIM_INDEX) { ACTIVE_SIM_INDEX = Math.max(0, index - 1); } else if (index < ACTIVE_SIM_INDEX) { ACTIVE_SIM_INDEX--; }
    renderSidebar(); renderComparisonTable(); showToast("Deleted");
}

function switchSim(index) {
    if (index < 0 || index >= SIM_LIST.length) return;
    saveCurrentState();
    ACTIVE_SIM_INDEX = index;

    var sim = SIM_LIST[index];
    var nameInput = document.getElementById('simName');

    if (nameInput) {
        nameInput.value = sim.name;
        nameInput.disabled = false;
        nameInput.style.color = "var(--druid-orange)";
    }

    var res = sim.results;
    SIM_DATA = res ? res : null;

    applyConfigToUI(sim.config);

    document.getElementById('comparisonView').classList.add('hidden');
    document.getElementById('singleSimView').classList.remove('hidden');

    var resNameEl = document.getElementById('resultSimName');
    if (resNameEl) resNameEl.innerText = sim.name;

    if (res) {
        document.getElementById('resultsArea').classList.remove('hidden');

        var btnP5 = document.getElementById("viewP5");
        if (btnP5 && res.p5) btnP5.innerText = "5% HPS (" + res.p5.hps.toFixed(1) + ")";

        var btnMedian = document.getElementById("viewMedian");
        if (btnMedian && res.median) btnMedian.innerText = "Median (" + res.median.hps.toFixed(1) + ")";

        var btnP95 = document.getElementById("viewP95");
        if (btnP95 && res.p95) btnP95.innerText = "95% HPS (" + res.p95.hps.toFixed(1) + ")";

        if (typeof switchView === 'function') switchView(CURRENT_VIEW);
    } else {
        document.getElementById('resultsArea').classList.add('hidden');
    }

    if (typeof renderSidebar === 'function') renderSidebar();
}

function addNewSim() { addSim(false); showToast("Duplicated!"); }

function updateSimName() {
    if (SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].name = document.getElementById('simName').value;
        saveCurrentState();
        if (typeof renderSidebar === 'function') renderSidebar();
    }
}

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

function updateEnemyInfo() {
    if (!document.getElementById("info_hit_chance")) return;
    var lvl = getVal("enemy_level");
    var resNat = getVal("res_nature");
    var pen = getVal("sp_pen");
    var baseHit = 96; var needHit = 4;
    if (lvl == 61) { baseHit = 95; needHit = 5; }
    if (lvl == 62) { baseHit = 94; needHit = 6; }
    if (lvl == 63) { baseHit = 83; needHit = 16; }
    setText("info_hit_chance", baseHit + "% (Needs " + needHit + "%)");
    var baseRes = (lvl - 60) * 5; if (baseRes < 0) baseRes = 0;
    setText("info_base_res", baseRes);
    var totalRes = Math.max(0, baseRes + resNat - pen);
    var bTxt = document.getElementById("info_buckets_text");
    if (bTxt) bTxt.innerText = "Resistance: " + totalRes;

    var avgMit = Math.min(0.75, (totalRes / (lvl * 5)) * 0.75);
    var range = avgMit / 0.25;
    var bucket = Math.floor(range);
    var remainder = range - bucket;
    var probs = [0, 0, 0, 0];
    if (bucket < 3) { probs[bucket] = (1 - remainder) * 100; probs[bucket + 1] = remainder * 100; } else { probs[3] = 100; }
    var bar = document.getElementById("bucket_bar_nat");
    if (bar) {
        var barHtml = "";
        if (probs[0] > 0) barHtml += '<div class="bucket-seg seg-0" style="width:' + probs[0] + '%"></div>';
        if (probs[1] > 0) barHtml += '<div class="bucket-seg seg-25" style="width:' + probs[1] + '%"></div>';
        if (probs[2] > 0) barHtml += '<div class="bucket-seg seg-50" style="width:' + probs[2] + '%"></div>';
        if (probs[3] > 0) barHtml += '<div class="bucket-seg seg-75" style="width:' + probs[3] + '%"></div>';
        bar.innerHTML = barHtml;
    }
}

function updatePatchUI() {
    // 1. Disable BoaT Stacks Input for 1.18.1c (Passiv)
    var boatInput = document.getElementById('start_boat');
    if (boatInput) {
        boatInput.disabled = true;
        boatInput.parentElement.style.opacity = "0.5";
        boatInput.value = 0; // Reset visual value
    }

    // 2. Enable External DoTs
    var extIds = ["enemy_ext_mf", "enemy_ext_is"];
    extIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.disabled = false;
            if (el.parentElement) el.parentElement.style.opacity = "1";
        }
    });

    // 3. Ensure Single Idol Selection
    var idolIds = ["idolEoF", "idolMoon", "idolProp", "idolMoonfang", "idolAcidity", "idolEquilibrium", "idolEquilibriumV2", "idolEquilibriumV3"];
    var found = false;
    idolIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.checked) {
            if (found) el.checked = false; // Deselect others if one is already found
            found = true;
        }
    });

    // 4. Update Eclipse Default Values visually if override is disabled
    var elEclOver = document.getElementById('stat_override_eclipse');
    var elNat = document.getElementById('stat_proc_nature');
    var elArc = document.getElementById('stat_proc_arcane');
    if (elEclOver && !elEclOver.checked && elNat && elArc) {
        elNat.value = 60;
        elArc.value = 40;
    }
}

// ============================================================================
// BUFF TOGGLE LOGIC
// ============================================================================
function toggleBuffs(btnElement, checkState) {
    var titleDiv = btnElement.closest('.gear-section-title');
    if (titleDiv && titleDiv.nextElementSibling && titleDiv.nextElementSibling.classList.contains('checkbox-grid')) {
        var checkboxes = titleDiv.nextElementSibling.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function (cb) {
            if (!cb.disabled) cb.checked = checkState;
        });

        if (typeof calculateGearStats === 'function') calculateGearStats();
        saveCurrentState();
    }
}

// ============================================================================
// HEALING SCALING & EFFICIENCY TABLE
// ============================================================================

window.toggleSpellRanks = function (spellId) {
    var rows = document.querySelectorAll('.rank-row-' + spellId);
    var headerIcon = document.getElementById('icon_toggle_' + spellId);
    var isHidden = false;
    if (rows.length > 0) isHidden = rows[0].style.display === 'none';

    rows.forEach(r => r.style.display = isHidden ? 'table-row' : 'none');
    if (headerIcon) headerIcon.innerText = isHidden ? '▼' : '▶';
};

function updateSpellStats() {
    var tbody = document.getElementById("spellCalcBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    var hp = parseFloat(document.getElementById("statHP").value) || 0;
    var hasteMult = parseFloat(document.getElementById("statHaste").getAttribute("data-mult")) || 1.0;
    var talents = TALENT_CONFIG;

    // Tabellen-Kopf generieren (Spalte für Total Heal umbenannt)
    var thead = tbody.previousElementSibling;
    if (thead) {
        thead.innerHTML = `<tr>
            <th class="text-left">Spell / Rank</th>
            <th class="text-right">Base Direct</th>
            <th class="text-right">Base HoT</th>
            <th class="text-right" style="color:var(--nature-green)">+Heal Dir</th>
            <th class="text-right" style="color:#a5d6a7">+Heal HoT</th>
            <th class="text-right">Total (incl. Talents)</th>
            <th class="text-right">Cast</th>
            <th class="text-right" style="color:#00b0ff">Mana</th>
            <th class="text-right">HPS</th>
            <th class="text-right">HPM</th>
        </tr>`;
    }

    var spellsToRender = ["HealingTouch", "Regrowth", "Rejuvenation"];
    var spellStatsHtml = ""; // <-- Puffer

    spellsToRender.forEach(function (skillId) {
        var sDef = SPELL_DB[skillId];
        if (!sDef || !sDef.hasRanks) return;

        var iconStr = "inv_misc_questionmark";
        var rSkill = ROTATION_SKILLS.find(function (s) { return s.id === skillId; });
        if (rSkill && rSkill.icon) iconStr = rSkill.icon;
        var iconUrl = iconStr.includes("/") ? iconStr : `https://wow.zamimg.com/images/wow/icons/large/${iconStr}.jpg`;

        spellStatsHtml += `
            <tr style="cursor:pointer; background:rgba(0,0,0,0.4);" onclick="toggleSpellRanks('${skillId}')">
                <td colspan="10" class="text-left" style="font-weight:bold; color:var(--text-color);">
                    <span id="icon_toggle_${skillId}" style="display:inline-block; width:15px; color:#888;">▶</span> 
                    <img src="${iconUrl}" style="width:16px; height:16px; vertical-align:middle; border-radius:3px; margin-right:5px;">
                    ${sDef.name}
                </td>
            </tr>`;

        var ranks = Object.keys(sDef.ranks).sort(function (a, b) { return b - a; });

        ranks.forEach(function (rank) {
            var rDef = sDef.ranks[rank];

            var baseDirect = (rDef.min && rDef.max) ? (rDef.min + rDef.max) / 2 : 0;
            var baseHoT = rDef.hot || 0;

            var coeffDir = rDef.coeffDir || (baseDirect > 0 ? (rDef.coeff || 0) : 0);
            var coeffHoT = rDef.coeffHot || (baseHoT > 0 ? (rDef.coeff || 0) : 0);

            var bonusDir = coeffDir * hp;
            var bonusHoT = coeffHoT * hp;

            var multDir = 1.0 + (talents.giftOfNature * 0.02);
            var multHoT = 1.0 + (talents.giftOfNature * 0.02) + (talents.genesis * 0.05);

            var totalDirect = (baseDirect + bonusDir) * multDir;
            var totalHoT = (baseHoT + bonusHoT) * multHoT;
            var totalHeal = totalDirect + totalHoT;

            var ct = rDef.cast !== undefined ? rDef.cast : (sDef.baseGcd || 1.5);
            if (skillId === "HealingTouch") ct -= (talents.impHealingTouch * 0.1);
            if (ct < 0) ct = 0;
            var realCt = Math.max(0, ct / hasteMult);
            var gcdOrCast = Math.max(1.5, realCt);

            var mana = rDef.mana || 0;
            var red = 0;
            if (skillId === "HealingTouch" || skillId === "Regrowth") red += (talents.tranquilSpirit * 0.02) + (talents.moonglow * 0.03);
            if (skillId === "Rejuvenation") red += (talents.moonglow * 0.03);
            mana = Math.floor(mana * (1.0 - red));

            var hps = totalHeal / gcdOrCast;
            var hpm = mana > 0 ? totalHeal / mana : 0;

            // NEU: Den Multiplikator für die UI formatieren, um Transparenz zu schaffen
            var multDisplay = "";
            if (skillId === "Regrowth") {
                multDisplay = `<div style="font-size:0.65rem; color:#888; margin-top:2px;">(Dir x${multDir.toFixed(2)} / HoT x${multHoT.toFixed(2)})</div>`;
            } else if (skillId === "Rejuvenation") {
                multDisplay = `<div style="font-size:0.65rem; color:#888; margin-top:2px;">(x${multHoT.toFixed(2)})</div>`;
            } else {
                multDisplay = `<div style="font-size:0.65rem; color:#888; margin-top:2px;">(x${multDir.toFixed(2)})</div>`;
            }

            var fmt = val => val > 0 ? Math.floor(val) : '<span style="color:#555;">-</span>';

            spellStatsHtml += `
                <tr class="rank-row-${skillId}" style="display:none; background:rgba(255,255,255,0.02);">
                    <td class="text-left" style="padding-left: 30px; font-size: 0.85rem; color:#ccc;">Rank ${rank} (Lvl ${rDef.level})</td>
                    <td class="text-right">${fmt(baseDirect)}</td>
                    <td class="text-right">${fmt(baseHoT)}</td>
                    <td class="text-right" style="color:var(--nature-green)">${bonusDir > 0 ? '+' + Math.floor(bonusDir) : '<span style="color:#555;">-</span>'}</td>
                    <td class="text-right" style="color:#a5d6a7">${bonusHoT > 0 ? '+' + Math.floor(bonusHoT) : '<span style="color:#555;">-</span>'}</td>
                    <td class="text-right" style="font-weight:bold; vertical-align:middle;">
                        ${Math.floor(totalHeal)}
                        ${multDisplay}
                    </td>
                    <td class="text-right">${realCt.toFixed(2)}s</td>
                    <td class="text-right" style="color:#00b0ff">${mana}</td>
                    <td class="text-right val-calc" style="color:var(--nature-green); font-weight:bold;">${Math.floor(hps)}</td>
                    <td class="text-right val-calc">${hpm.toFixed(2)}</td>
                </tr>`;
        });
    }); // Ende von spellsToRender.forEach
    
    tbody.innerHTML = spellStatsHtml; // <-- EINMALIG zuweisen
}

// ============================================================================
// TALENT TREE RENDERING & VALIDATION
// ============================================================================

function getTreePoints(treeData) {
    let sum = 0;
    treeData.forEach(t => sum += (TALENT_CONFIG[t.id] || 0));
    return sum;
}

function getTotalPoints() {
    return getTreePoints(TALENT_TREES["Balance"]) +
        getTreePoints(TALENT_TREES["Feral"]) +
        getTreePoints(TALENT_TREES["Restoration"]);
}

function canAddPoint(treeName, talent) {
    if (getTotalPoints() >= 51) return false;
    if ((TALENT_CONFIG[talent.id] || 0) >= talent.max) return false;

    let treeData = TALENT_TREES[treeName];
    if (getTreePoints(treeData) < talent.row * 5) return false;

    if (talent.req) {
        let reqTalent = treeData.find(t => t.id === talent.req);
        if (!reqTalent || (TALENT_CONFIG[talent.req] || 0) < reqTalent.max) return false;
    }
    return true;
}

function isValidTreeState(treeData, testConfig) {
    let maxRow = -1;
    treeData.forEach(t => { if ((testConfig[t.id] || 0) > 0 && t.row > maxRow) maxRow = t.row; });

    for (let r = 0; r <= maxRow; r++) {
        let sumPrev = 0;
        let pointsInThisRow = 0;
        treeData.forEach(t => {
            if (t.row < r) sumPrev += (testConfig[t.id] || 0);
            if (t.row === r) pointsInThisRow += (testConfig[t.id] || 0);
        });
        if (pointsInThisRow > 0 && sumPrev < r * 5) return false;
    }

    for (let i = 0; i < treeData.length; i++) {
        let t = treeData[i];
        if ((testConfig[t.id] || 0) > 0 && t.req) {
            let reqTalent = treeData.find(x => x.id === t.req);
            if ((testConfig[t.req] || 0) < reqTalent.max) return false;
        }
    }
    return true;
}

function canRemovePoint(treeName, talent) {
    if ((TALENT_CONFIG[talent.id] || 0) <= 0) return false;
    let treeData = TALENT_TREES[treeName];
    let testConfig = Object.assign({}, TALENT_CONFIG);
    testConfig[talent.id]--;
    return isValidTreeState(treeData, testConfig);
}

// FORMATIERT DIE BESCHREIBUNG BASIEREND AUF AKTUELLEN PUNKTEN
function formatTalentDesc(desc, currentPts) {
    if (!desc) return "";
    // Sucht nach Mustern wie 2/4/6/8/10 oder 0.1/0.2/0.3
    return desc.replace(/(\d+(?:\.\d+)?(?:(?:\/|-)\d+(?:\.\d+)?)+)/g, function (match) {
        let parts = match.split(/[\/-]/);
        // Wenn 0 Punkte vergeben sind, zeige Rang 1 an. Ansonsten den aktuellen Rang.
        let idx = currentPts === 0 ? 0 : Math.min(currentPts - 1, parts.length - 1);
        return `<span style="color:#fff; font-weight:bold;">${parts[idx]}</span>`;
    });
}

function renderTalentTree() {
    let ptsBal = getTreePoints(TALENT_TREES["Balance"]);
    let ptsFer = getTreePoints(TALENT_TREES["Feral"]);
    let ptsRes = getTreePoints(TALENT_TREES["Restoration"]);
    let total = ptsBal + ptsFer + ptsRes;

    let counterLabel = document.getElementById("talentCounterText");
    if (counterLabel) {
        // Zeigt z.B.: Points Spent: 51 / 51 (24 / 0 / 27)
        counterLabel.innerText = `Points Spent: ${total} / 51 (${ptsBal} / ${ptsFer} / ${ptsRes})`;
    }

    let titleBal = document.getElementById("treeTitleBalance");
    if (titleBal) titleBal.innerText = `Balance (${ptsBal})`;

    let titleFer = document.getElementById("treeTitleFeral");
    if (titleFer) titleFer.innerText = `Feral (${ptsFer})`;

    let titleRes = document.getElementById("treeTitleResto");
    if (titleRes) titleRes.innerText = `Restoration (${ptsRes})`;

    renderGrid("talentGridBalance", "Balance");
    renderGrid("talentGridFeral", "Feral");
    renderGrid("talentGridResto", "Restoration");

    // --- BUFF CHECK (Tree of Life) ---
    // Deaktiviert die Checkbox bei den passiven Buffs, wenn das Talent nicht geskillt ist
    let treeBuff = document.getElementById("buff_tree");
    if (treeBuff) {
        if ((TALENT_CONFIG["treeOfLife"] || 0) === 0) {
            treeBuff.checked = false;
            treeBuff.disabled = true;
            treeBuff.parentElement.style.opacity = "0.5";
        } else {
            treeBuff.disabled = false;
            treeBuff.parentElement.style.opacity = "1";
        }
    }

    // --- ROTATION BUILDER UPDATE ---
    // Aktualisiert die Drag & Drop Liste und die Tool-Box live bei jedem Klick
    if (typeof renderRotationToolbox === 'function') renderRotationToolbox();
    if (typeof renderRotationList === 'function') renderRotationList();

    if (typeof calculateGearStats === 'function') calculateGearStats();
}

function renderGrid(containerId, treeName) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Bereite Container für absolute SVG-Pfeile vor
    container.innerHTML = "";
    container.style.position = "relative";

    var treeData = TALENT_TREES[treeName];

    treeData.forEach(function (talent) {
        var currentPts = TALENT_CONFIG[talent.id] || 0;
        var canAdd = canAddPoint(treeName, talent);
        var canRemove = canRemovePoint(treeName, talent);
        var disabled = !canAdd && currentPts === 0;

        var slot = document.createElement("div");
        slot.className = "talent-slot";
        if (currentPts > 0) slot.classList.add("active");
        if (currentPts >= talent.max) slot.classList.add("maxed");
        if (disabled) slot.classList.add("disabled");

        slot.style.gridRow = talent.row + 1;
        slot.style.gridColumn = talent.col + 1;
        slot.style.zIndex = "2"; // Über den Pfeilen
        slot.style.position = "relative";

        var iconUrl = talent.icon && talent.icon !== "-" && talent.icon !== ""
            ? "https://wow.zamimg.com/images/wow/icons/large/" + talent.icon + ".jpg"
            : "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg";

        slot.style.backgroundImage = "url('" + iconUrl + "')";
        slot.style.backgroundSize = "cover";
        slot.innerHTML = `<div class="talent-points">${currentPts}/${talent.max}</div>`;

        // Tooltip Logik (Mouse Events)
        slot.addEventListener("mouseenter", function (e) {
            let tt = document.getElementById("wowTooltip");
            if (tt) {
                // Nutze position: fixed statt absolute, um Container-Offsets zu umgehen
                tt.style.position = "fixed";
                tt.style.zIndex = "99999";
                tt.style.pointerEvents = "none";
                tt.style.background = "rgba(10, 10, 10, 0.95)";
                tt.style.border = "1px solid #ffca28";
                tt.style.padding = "10px";
                tt.style.borderRadius = "5px";
                tt.style.width = "250px";
                tt.style.boxShadow = "0 4px 8px rgba(0,0,0,0.8)";

                let formattedDesc = formatTalentDesc(talent.desc, currentPts);
                let statusHtml = "";

                let reqPoints = talent.row * 5;
                if (getTreePoints(treeData) < reqPoints) {
                    statusHtml += `<div style="color:#f44336; margin-bottom:5px; font-size:0.85em;">Requires ${reqPoints} points in ${treeName}</div>`;
                }
                if (talent.req) {
                    let reqTalent = treeData.find(x => x.id === talent.req);
                    if ((TALENT_CONFIG[reqTalent.id] || 0) < reqTalent.max) {
                        statusHtml += `<div style="color:#f44336; margin-bottom:5px; font-size:0.85em;">Requires ${reqTalent.max} points in ${reqTalent.name}</div>`;
                    }
                }

                let rankStr = currentPts === 0 ? `<span style="color:#888">Next Rank</span>` : `Rank ${currentPts}/${talent.max}`;

                tt.innerHTML = `
                    <div style="font-weight:bold; color:white; font-size: 1.1em; margin-bottom: 2px;">${talent.name}</div>
                    <div style="color:#ffd100; margin-bottom:8px; font-weight:bold;">${rankStr}</div>
                    ${statusHtml}
                    <div style="color:#ffd100; font-size:0.9em; line-height: 1.3;">${formattedDesc}</div>
                `;

                tt.style.display = "block";

                // ClientX / ClientY für fixierte Positionierung
                let x = e.clientX + 15;
                let y = e.clientY + 15;
                if (x + 270 > window.innerWidth) x = e.clientX - 270;
                if (y + tt.offsetHeight > window.innerHeight) y = e.clientY - tt.offsetHeight - 15;

                tt.style.left = x + "px";
                tt.style.top = y + "px";
            }
        });

        slot.addEventListener("mousemove", function (e) {
            let tt = document.getElementById("wowTooltip");
            if (tt && tt.style.display === "block") {
                let x = e.clientX + 15;
                let y = e.clientY + 15;

                if (x + 270 > window.innerWidth) x = e.clientX - 270;
                if (y + tt.offsetHeight > window.innerHeight) y = e.clientY - tt.offsetHeight - 15;

                tt.style.left = x + "px";
                tt.style.top = y + "px";
            }
        });

        slot.addEventListener("mouseleave", function () {
            let tt = document.getElementById("wowTooltip");
            if (tt) tt.style.display = "none";
        });

        // Click Logic
        slot.addEventListener("click", function () {
            if (canAddPoint(treeName, talent)) {
                TALENT_CONFIG[talent.id]++; renderTalentTree(); saveCurrentState();
            } else if (getTotalPoints() >= 51) {
                showToast("Maximum of 51 Talent Points reached!");
            }
        });

        slot.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            if (canRemovePoint(treeName, talent)) {
                TALENT_CONFIG[talent.id]--; renderTalentTree(); saveCurrentState();
            } else if (currentPts > 0) {
                showToast("Cannot remove point! Required by lower tier or dependency.");
            }
        });

        container.appendChild(slot);
    });

    drawArrows(container, treeData);
}

// FORMATIERT DIE BESCHREIBUNG BASIEREND AUF AKTUELLEN PUNKTEN
function formatTalentDesc(desc, currentPts) {
    if (!desc) return "";

    // Sucht das Muster 2/4/6/8/10
    return desc.replace(/(\d+(?:\.\d+)?(?:(?:\/|-)\d+(?:\.\d+)?)+)/g, function (match) {
        let parts = match.split(/[\/-]/);
        let idx = currentPts === 0 ? -1 : currentPts - 1;

        let res = [];
        for (let i = 0; i < parts.length; i++) {
            if (i === idx) {
                // Aktiver Rang wird dick & weiß hervorgehoben
                res.push(`<span style="color:#fff; font-weight:bold; font-size:1.15em;">${parts[i]}</span>`);
            } else {
                // Inaktive Ränge werden ausgegraut
                res.push(`<span style="color:#888;">${parts[i]}</span>`);
            }
        }
        return res.join("/");
    });
}


// ZEICHNET DIE ABHÄNGIGKEITS-PFEILE IM GRID
function drawArrows(container, treeData) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = "absolute"; svg.style.top = "0"; svg.style.left = "0";
    svg.style.width = "100%"; svg.style.height = "100%";
    svg.style.pointerEvents = "none"; svg.style.zIndex = "1";

    let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#f44336" />
        </marker>
        <marker id="arrow-yellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#ffd100" />
        </marker>
    `;
    svg.appendChild(defs);

    treeData.forEach(t => {
        if (t.req) {
            let reqT = treeData.find(x => x.id === t.req);
            if (reqT) {
                let startX = 0, startY = 0, endX = 0, endY = 0;
                let pathStr = "";

                if (reqT.row === t.row) {
                    if (reqT.col < t.col) {
                        // Links -> Rechts
                        startX = reqT.col * 60 + 46 + 15; // Rechte Kante Source
                        startY = reqT.row * 60 + 23 + 15; // Mitte vertikal
                        endX = t.col * 60 + 15;           // Linke Kante Target
                        endY = t.row * 60 + 23 + 15;
                        pathStr = `M ${startX} ${startY} L ${endX - 2} ${endY}`;
                    } else {
                        // Rechts -> Links (KORRIGIERT)
                        startX = reqT.col * 60 + 15;      // Linke Kante Source
                        startY = reqT.row * 60 + 23 + 15; // Mitte vertikal
                        endX = t.col * 60 + 46 + 15;      // Rechte Kante Target
                        endY = t.row * 60 + 23 + 15;
                        pathStr = `M ${startX} ${startY} L ${endX + 2} ${endY}`;
                    }
                }
                else if (reqT.col === t.col) {
                    // Oben -> Unten
                    startX = reqT.col * 60 + 23 + 15;
                    startY = reqT.row * 60 + 46 + 15;
                    endX = t.col * 60 + 23 + 15;
                    endY = t.row * 60 + 15;
                    pathStr = `M ${startX} ${startY} L ${endX} ${endY - 2}`;
                }
                else {
                    // L-Form Biegung (Zieht nach unten und biegt dann ab)
                    startX = reqT.col * 60 + 23 + 15;
                    startY = reqT.row * 60 + 46 + 15;
                    endX = t.col * 60 + 23 + 15;
                    endY = t.row * 60 + 15;

                    let bendY = endY - 7;
                    pathStr = `M ${startX} ${startY} L ${startX} ${bendY} L ${endX} ${bendY} L ${endX} ${endY - 2}`;
                }

                // KORRIGIERT: Wird erst Gelb, wenn das ZIEL-Talent mind. 1 Punkt hat
                let isFulfilled = (TALENT_CONFIG[t.id] || 0) > 0;
                let color = isFulfilled ? "#ffd100" : "#f44336";
                let marker = isFulfilled ? "url(#arrow-yellow)" : "url(#arrow-red)";

                let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", pathStr);
                path.setAttribute("stroke", color);
                path.setAttribute("stroke-width", "2");
                path.setAttribute("fill", "none");
                path.setAttribute("marker-end", marker);
                svg.appendChild(path);
            }
        }
    });
    container.appendChild(svg);
}

// ============================================================================
// TALENT PRESET LOGIC
// ============================================================================

function renderTalentPresetDropdown() {
    let select = document.getElementById("talent_preset_select");
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Preset --</option>';
    for (let name in TALENT_PRESETS) {
        select.innerHTML += `<option value="${name}">${name}</option>`;
    }
}

function loadTalentPreset() {
    let name = document.getElementById("talent_preset_select").value;
    if (!name || !TALENT_PRESETS[name]) return;

    TALENT_CONFIG = structuredClone(TALENT_PRESETS[name]);
    renderTalentTree();
    saveCurrentState();
    showToast("Talent Preset Loaded!");
}

function saveTalentPreset() {
    let name = prompt("Enter a name for this Talent Preset:");
    if (!name || name.trim() === "") return;

    TALENT_PRESETS[name] = structuredClone(TALENT_CONFIG);
    localStorage.setItem("resto_talent_presets", JSON.stringify(TALENT_PRESETS));
    renderTalentPresetDropdown();
    document.getElementById("talent_preset_select").value = name;
    showToast("Preset Saved!");
}

function deleteTalentPreset() {
    let name = document.getElementById("talent_preset_select").value;
    if (!name || !TALENT_PRESETS[name]) return;

    if (confirm(`Delete preset '${name}'?`)) {
        delete TALENT_PRESETS[name];
        localStorage.setItem("resto_talent_presets", JSON.stringify(TALENT_PRESETS));
        renderTalentPresetDropdown();
        showToast("Preset Deleted!");
    }
}

function clearTalents() {
    if (confirm("Reset all talent points?")) {
        for (let key in TALENT_CONFIG) {
            TALENT_CONFIG[key] = 0;
        }
        renderTalentTree();
        saveCurrentState();
    }
}

// ============================================================================
// INITIALIZATION ON PAGE LOAD
// ============================================================================
window.addEventListener('DOMContentLoaded', function () {
    renderTalentPresetDropdown();

    // Prüfen, ob der Baum noch komplett leer ist (Verhindert, dass ein 
    // potenzieller URL-Import überschrieben wird)
    if (getTotalPoints() === 0) {
        let presetKeys = Object.keys(TALENT_PRESETS);
        if (presetKeys.length > 0) {
            let firstPreset = presetKeys[0];
            let select = document.getElementById("talent_preset_select");
            if (select) select.value = firstPreset;

            // Config im Hintergrund laden (ohne störenden Popup/Toast)
            TALENT_CONFIG = structuredClone(TALENT_PRESETS[firstPreset]);
            renderTalentTree();
        }
    }
});

// ============================================================================
// ENCOUNTER PRESET LOGIC
// ============================================================================

function applyTankPreset() {
    var preset = document.getElementById("tank_preset_select").value;
    var dmgInput = document.getElementById("tank_dmg");
    var speedInput = document.getElementById("tank_attack_speed");
    var timeInput = document.getElementById("maxTime");
    var modeInput = document.getElementById("sim_duration_mode");

    if (preset === "farm") {
        dmgInput.value = 600; speedInput.value = 2.0;
        timeInput.value = 60; modeInput.value = "fixed";
    }
    else if (preset === "progression") {
        dmgInput.value = 1200; speedInput.value = 2.0;
        timeInput.value = 180; modeInput.value = "fixed";
    }
    else if (preset === "heavy") {
        dmgInput.value = 1800; speedInput.value = 2.0;
        timeInput.value = 120; modeInput.value = "fixed";
    }
    else if (preset === "oom") {
        dmgInput.value = 1200; speedInput.value = 2.0;
        modeInput.value = "oom";
    }

    updateReqHPS();
    if (typeof saveCurrentState === 'function') saveCurrentState();
}

function setCustomPreset() {
    var select = document.getElementById("tank_preset_select");
    if (select) select.value = "custom";
}

function updateReqHPS() {
    var dmg = parseFloat(document.getElementById("tank_dmg").value) || 0;
    var speed = parseFloat(document.getElementById("tank_attack_speed").value) || 1;
    var reqHps = speed > 0 ? (dmg / speed) : 0;

    var reqLabel = document.getElementById("info_req_hps");
    if (reqLabel) {
        reqLabel.innerText = Math.floor(reqHps) + " HPS";
        if (reqHps < 500) reqLabel.style.color = "#a5d6a7";
        else if (reqHps < 1000) reqLabel.style.color = "#ffb74d";
        else reqLabel.style.color = "#f44336";
    }
}

// Beim Laden ausführen
window.addEventListener('DOMContentLoaded', function () {
    updateReqHPS();
});

