// ============================================================================
// ROTATION BUILDER LOGIC (RESTO DRUID - DRAG & DROP & INLINE EDITING)
// ============================================================================
var draggedSkillId = null;
var draggedStepIndex = null;

function initRotationBuilder() {
    try {
        console.log("Starte Resto Rotation Builder...");
        renderRotationToolbox();
        renderRotationList();

        var dropzone = document.getElementById("rbDropzone");
        if (dropzone) {
            dropzone.addEventListener("dragover", function (e) {
                e.preventDefault();
                dropzone.classList.add("drag-over");
            });
            dropzone.addEventListener("dragleave", function (e) {
                dropzone.classList.remove("drag-over");
            });
            dropzone.addEventListener("drop", function (e) {
                e.preventDefault();
                dropzone.classList.remove("drag-over");

                if (draggedSkillId) {
                    addRotationStep(draggedSkillId);
                } else if (draggedStepIndex !== null) {
                    var steps = CUSTOM_ROTATION.steps || [];
                    moveRotationStep(draggedStepIndex, steps.length);
                }
                draggedSkillId = null;
                draggedStepIndex = null;
            });
        }
        console.log("Rotation Builder erfolgreich geladen!");
    } catch (e) {
        console.error("Fehler im Rotation Builder:", e);
        showToast("UI Fehler: " + e.message);
    }
}

function updateRotationMeta(field, val) {
    if (!CUSTOM_ROTATION) CUSTOM_ROTATION = { name: "", desc: "", steps: [] };
    CUSTOM_ROTATION[field] = val;
    saveCurrentState();
}

function renderRotationToolbox() {
    var tb = document.getElementById("rbSkillsList");
    if (!tb) return;
    tb.innerHTML = "";

    ROTATION_SKILLS.forEach(skill => {
        // NEU: Prüfen ob das Talent fehlt
        var isMissingTalent = false;
        if (skill.id === "Swiftmend" && (!TALENT_CONFIG || !TALENT_CONFIG.swiftmend)) isMissingTalent = true;
        if (skill.id === "NaturesSwiftness" && (!TALENT_CONFIG || !TALENT_CONFIG.natureSwiftness)) isMissingTalent = true;

        var el = document.createElement("div");
        el.className = "rb-skill";

        if (isMissingTalent) {
            el.draggable = false;
            el.style.opacity = "0.4";
            el.style.cursor = "not-allowed";
        } else {
            el.draggable = true;
            el.addEventListener("dragstart", function (e) {
                draggedSkillId = skill.id;
                draggedStepIndex = null;
            });
        }

        var iconUrl = skill.icon.includes("/") ? skill.icon : `https://wow.zamimg.com/images/wow/icons/large/${skill.icon}.jpg`;
        var warningText = isMissingTalent ? `<span style="color:#f44336; font-size:10px; margin-left:auto;">(Need Talent)</span>` : "";
        el.innerHTML = `<img src="${iconUrl}" class="rb-skill-icon" alt=""> ${skill.name} ${warningText}`;

        tb.appendChild(el);
    });
}

// NEU: Globale Funktion, um den Rang eines Spells zu aktualisieren
function updateStepRank(idx, val) {
    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || !CUSTOM_ROTATION.steps[idx]) return;
    CUSTOM_ROTATION.steps[idx].rank = (val === "max" || val === "") ? null : parseInt(val);
    CUSTOM_ROTATION.name = "Custom Rotation";
    saveCurrentState();
    generateAutoDescription();
}

function renderRotationList() {
    var dz = document.getElementById("rbDropzone");
    var empty = document.getElementById("rbEmptyState");
    if (!dz) return;

    var nInput = document.getElementById("rb_meta_name");
    var dInput = document.getElementById("rb_meta_desc");
    if (nInput) nInput.value = CUSTOM_ROTATION.name || "";
    if (dInput) dInput.value = CUSTOM_ROTATION.desc || "";

    document.querySelectorAll(".rb-step").forEach(el => el.remove());

    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || CUSTOM_ROTATION.steps.length === 0) {
        if (empty) empty.style.display = "block";
        return;
    }
    if (empty) empty.style.display = "none";

    CUSTOM_ROTATION.steps.forEach((step, idx) => {
        var skillDef = ROTATION_SKILLS.find(s => s.id === step.skill) || { name: step.skill, icon: "inv_misc_questionmark", hasRanks: false };

        // Prüfen, ob eine Vorbedingung (Talent) fehlt
        var isMissingTalent = false;
        if (step.skill === "Swiftmend" && (!TALENT_CONFIG || !TALENT_CONFIG.swiftmend)) isMissingTalent = true;
        if (step.skill === "NaturesSwiftness" && (!TALENT_CONFIG || !TALENT_CONFIG.natureSwiftness)) isMissingTalent = true;

        // HIER WAR DER FEHLER: Wir verändern step.disabled NICHT mehr permanent. 
        // Wir nutzen isMissingTalent nur noch für die visuelle Darstellung.

        var stepEl = document.createElement("div");
        stepEl.className = "rb-step";

        // Visuell ausgrauen, wenn der Step deaktiviert ist ODER das Talent fehlt
        if (step.disabled || isMissingTalent) stepEl.classList.add("is-disabled");
        if (isMissingTalent) stepEl.style.borderLeft = "4px solid #f44336";

        stepEl.draggable = true;

        stepEl.addEventListener("dragstart", function (e) {
            draggedStepIndex = idx;
            draggedSkillId = null;
            e.stopPropagation();
        });
        stepEl.addEventListener("dragover", function (e) {
            e.preventDefault();
            stepEl.classList.add("drag-over");
        });
        stepEl.addEventListener("dragleave", function (e) {
            stepEl.classList.remove("drag-over");
        });
        stepEl.addEventListener("drop", function (e) {
            e.preventDefault();
            stepEl.classList.remove("drag-over");
            e.stopPropagation();

            if (draggedSkillId) {
                addRotationStep(draggedSkillId, idx);
            } else if (draggedStepIndex !== null) {
                moveRotationStep(draggedStepIndex, idx);
            }
            draggedSkillId = null;
            draggedStepIndex = null;
        });

        var exactCount = 0;
        if (typeof SIM_DATA !== 'undefined' && SIM_DATA && SIM_DATA.median && SIM_DATA.median.stats && SIM_DATA.median.stats.stepCounts && SIM_DATA.median.stats.stepCounts[step.id]) {
            exactCount = Math.round(SIM_DATA.median.stats.stepCounts[step.id]);
        }
        var countHtml = `<span class="rb-step-count" id="badge_step_${step.id}" style="${exactCount > 0 ? '' : 'display:none;'}">${exactCount}x</span>`;

        var rankHtml = "";
        if (skillDef.hasRanks) {
            var maxR = skillDef.maxRank || 10;
            var options = `<option value="max" ${!step.rank ? 'selected' : ''}>Max Rank (${maxR})</option>`;
            for (var r = maxR - 1; r >= 1; r--) {
                options += `<option value="${r}" ${step.rank === r ? 'selected' : ''}>Rank ${r}</option>`;
            }
            rankHtml = `<select class="rb-rank-select" onchange="updateStepRank(${idx}, this.value)" style="margin-left:10px; padding:2px 5px; font-size:0.75rem; background:rgba(0,0,0,0.5); color:#a5d6a7; border:1px solid #444; border-radius:3px; outline:none; cursor:pointer;" ${isMissingTalent ? 'disabled' : ''}>${options}</select>`;
        }

        var iconUrl = skillDef.icon.includes("/") ? skillDef.icon : `https://wow.zamimg.com/images/wow/icons/large/${skillDef.icon}.jpg`;
        var warningHtml = isMissingTalent ? `<span style="color:#f44336; font-size:0.75rem; margin-left:10px;">⚠️ Requires Talent</span>` : "";

        // Das Icon des Toggle-Buttons zeigt optisch 🚫 an, wenn das Talent fehlt.
        var toggleIcon = (step.disabled || isMissingTalent) ? '🚫' : '✅';

        var html = `
            <div class="rb-step-header">
                <div class="rb-step-title" style="display:flex; align-items:center;">
                    <img src="${iconUrl}" class="rb-skill-icon" alt="">
                    ${idx + 1}. ${skillDef.name} ${rankHtml} ${warningHtml}
                </div>
                <div style="display:flex; align-items:center;">
                    ${countHtml}
                    <button class="rb-toggle-btn" onclick="toggleStepDisabled(${idx})" title="Enable/Disable Step" ${isMissingTalent ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>${toggleIcon}</button>
                    <button class="rb-delete-btn" onclick="removeRotationStep(${idx})">✖</button>
                </div>
            </div>
            <div class="rb-conditions" id="rb_conds_${idx}"></div>
        `;
        stepEl.innerHTML = html;
        dz.appendChild(stepEl);

        var condContainer = document.getElementById(`rb_conds_${idx}`);
        if (step.conditions && step.conditions.length > 0) {
            step.conditions.forEach((cond, cIdx) => {
                condContainer.appendChild(createConditionRow(idx, cIdx, cond));
            });
        }

        var addBtn = document.createElement("button");
        addBtn.className = "rb-add-condition";
        addBtn.innerText = "+ Add Condition";
        addBtn.onclick = function () { addCondition(idx); };
        if (isMissingTalent) addBtn.style.display = "none"; // Hide Add button if disabled

        condContainer.appendChild(addBtn);
    });

    saveCurrentState();
    generateAutoDescription();
}

function createConditionRow(stepIdx, condIdx, cond) {
    var row = document.createElement("div");
    row.className = "rb-condition-row";

    // Type Select
    var typeSel = document.createElement("select");
    CONDITION_TYPES.forEach(cDef => {
        var opt = document.createElement("option");
        opt.value = cDef.id;
        opt.innerText = cDef.label;
        if (cDef.id === cond.type) opt.selected = true;
        typeSel.appendChild(opt);
    });
    typeSel.onchange = function () { updateCondition(stepIdx, condIdx, "type", this.value); };
    row.appendChild(typeSel);

    var cDef = CONDITION_TYPES.find(c => c.id === cond.type) || CONDITION_TYPES[0];

    // Target Select (e.g. for missing HoT type)
    if (cDef.hasTarget) {
        var targetSel = document.createElement("select");
        cDef.hasTarget.forEach(o => {
            var opt = document.createElement("option");
            opt.value = o; opt.innerText = o;
            if (o === cond.target) opt.selected = true;
            targetSel.appendChild(opt);
        });
        targetSel.onchange = function () { updateCondition(stepIdx, condIdx, "target", this.value); };
        row.appendChild(targetSel);
    }

    // Operator Select
    if (cDef.hasOp) {
        var opSel = document.createElement("select");
        var ops = ["<=", ">=", "<", ">", "=="];
        ops.forEach(o => {
            var opt = document.createElement("option");
            opt.value = o; opt.innerText = o;
            if (o === cond.op) opt.selected = true;
            opSel.appendChild(opt);
        });
        opSel.onchange = function () { updateCondition(stepIdx, condIdx, "op", this.value); };
        row.appendChild(opSel);
    }

    // Value Input
    if (cDef.hasVal) {
        var valInp = document.createElement("input");
        valInp.type = "number";
        valInp.value = cond.val !== undefined ? cond.val : 0;
        valInp.onchange = function () { updateCondition(stepIdx, condIdx, "val", parseFloat(this.value)); };
        row.appendChild(valInp);
    }

    // Boolean Select
    if (cDef.hasBool) {
        var boolSel = document.createElement("select");
        var opts = [{ val: "true", text: "True" }, { val: "false", text: "False" }];
        opts.forEach(o => {
            var opt = document.createElement("option");
            opt.value = o.val; opt.innerText = o.text;
            if (cond.bool === o.val || (cond.bool === undefined && o.val === "true")) opt.selected = true;
            boolSel.appendChild(opt);
        });
        boolSel.onchange = function () { updateCondition(stepIdx, condIdx, "bool", this.value); };
        row.appendChild(boolSel);
    }

    // Delete Button
    var delBtn = document.createElement("button");
    delBtn.className = "rb-delete-btn";
    delBtn.innerText = "✖";
    delBtn.onclick = function () { removeCondition(stepIdx, condIdx); };
    row.appendChild(delBtn);

    return row;
}

function updateCondition(sIdx, cIdx, field, value) {
    var cond = CUSTOM_ROTATION.steps[sIdx].conditions[cIdx];
    cond[field] = value;

    // Reset secondary fields if type changes
    if (field === "type") {
        var def = CONDITION_TYPES.find(c => c.id === value);
        if (def.hasOp) cond.op = "<="; else delete cond.op;
        if (def.hasTarget) cond.target = def.hasTarget[0]; else delete cond.target;
        if (def.hasVal) cond.val = 0; else delete cond.val;
        if (def.hasBool) cond.bool = "true"; else delete cond.bool;
    }

    CUSTOM_ROTATION.name = "Custom Rotation";
    renderRotationList();
}

function toggleStepDisabled(idx) {
    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || !CUSTOM_ROTATION.steps[idx]) return;
    CUSTOM_ROTATION.steps[idx].disabled = !CUSTOM_ROTATION.steps[idx].disabled;
    CUSTOM_ROTATION.name = "Custom Rotation";
    renderRotationList();
}

function addRotationStep(skillId, insertAtIdx) {
    if (!CUSTOM_ROTATION.steps) CUSTOM_ROTATION.steps = [];
    var newStep = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        skill: skillId,
        rank: null, // Default to max rank
        conditions: [],
        disabled: false
    };
    if (insertAtIdx !== undefined && insertAtIdx !== null) {
        CUSTOM_ROTATION.steps.splice(insertAtIdx, 0, newStep);
    } else {
        CUSTOM_ROTATION.steps.push(newStep);
    }
    CUSTOM_ROTATION.name = "Custom Rotation";
    renderRotationList();
}

function removeRotationStep(idx) {
    CUSTOM_ROTATION.steps.splice(idx, 1);
    CUSTOM_ROTATION.name = "Custom Rotation";
    renderRotationList();
}

function moveRotationStep(fromIdx, toIdx) {
    if (toIdx > fromIdx) toIdx--;
    var step = CUSTOM_ROTATION.steps.splice(fromIdx, 1)[0];
    CUSTOM_ROTATION.steps.splice(toIdx, 0, step);
    CUSTOM_ROTATION.name = "Custom Rotation";
    renderRotationList();
}

function addCondition(sIdx) {
    var def = CONDITION_TYPES[0];
    var newCond = { type: def.id };
    if (def.hasTarget) newCond.target = def.hasTarget[0];
    if (def.hasOp) newCond.op = "<=";
    if (def.hasVal) newCond.val = 0;
    if (def.hasBool) newCond.bool = "true";

    CUSTOM_ROTATION.steps[sIdx].conditions.push(newCond);
    CUSTOM_ROTATION.name = "Custom Rotation";
    renderRotationList();
}

function removeCondition(sIdx, cIdx) {
    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || !CUSTOM_ROTATION.steps[sIdx]) return;
    CUSTOM_ROTATION.steps[sIdx].conditions.splice(cIdx, 1);
    CUSTOM_ROTATION.name = "Custom Rotation";
    renderRotationList();
}

function clearRotation() {
    if (confirm("Are you sure you want to clear your custom rotation?")) {
        CUSTOM_ROTATION = { name: "Blank", desc: "", steps: [] };
        document.getElementById("rotation_preset_select").value = "";
        renderRotationList();
    }
}

// ============================================================================
// AUTO DESCRIPTION LOGIC (HEALER ADAPTED)
// ============================================================================
function generateAutoDescription() {
    var container = document.getElementById("rb_auto_desc");
    var header = document.getElementById("rb_auto_desc_header");
    if (!container) return;

    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || CUSTOM_ROTATION.steps.length === 0) {
        container.innerHTML = "<em>No rotation configured.</em>";
        if (header) header.style.display = "none";
        return;
    }

    // --- NEU: Wir filtern hier nicht nur deaktivierte, sondern auch blockierte Talente aus ---
    var activeSteps = CUSTOM_ROTATION.steps.filter(function (step) {
        if (step.disabled) return false;
        if (step.skill === "Swiftmend" && (!TALENT_CONFIG || !TALENT_CONFIG.swiftmend)) return false;
        if (step.skill === "NaturesSwiftness" && (!TALENT_CONFIG || !TALENT_CONFIG.natureSwiftness)) return false;
        return true;
    });

    if (activeSteps.length === 0) {
        container.innerHTML = "<em>All rotation steps are disabled or missing required talents.</em>";
        if (header) header.style.display = "none";
        return;
    }

    if (header) header.style.display = "flex";

    var text = "<div style='margin-top: 5px;'>";

    function formatSpell(step) {
        var skillId = step.skill;
        var sDef = ROTATION_SKILLS.find(function (s) { return s.id === skillId; }) || { name: skillId };
        var name = sDef.name;
        if (step.rank) name += " (Rank " + step.rank + ")";

        var cls = "desc-spell-nature"; // Standard Heal Color
        if (skillId === "MajorManaPotion" || skillId === "DemonicRune") cls = "desc-spell-item";
        if (skillId === "Innervate") cls = "desc-spell-arcane"; // Utility

        return "<span class='" + cls + "'>" + name + "</span>";
    }

    function formatCond(cond) {
        var target = cond.target ? cond.target : "";
        var val = parseFloat(cond.val) || 0;
        var op = cond.op || "==";

        switch (cond.type) {
            case "target_hp_pct": return "target HP is " + op + " " + val + "%";
            case "target_hp_deficit": return "target is missing " + op + " " + val + " HP";
            case "hot_missing": return "target is missing " + target + " HoT";
            case "hot_active": return "target has " + target + " HoT active";
            case "hot_rem": return "target " + target + " has " + op + " " + val + "s remaining";
            case "mana_pct": return "your Mana is " + op + " " + val + "%";
            case "mana_abs": return "your Mana is " + op + " " + val;
            case "mana_deficit": return "you are missing " + op + " " + val + " Mana";
            case "ns_ready": return (cond.bool === "true" ? "Nature's Swiftness is ready" : "Nature's Swiftness is on cooldown");
            default: return "a specific condition is met";
        }
    }

    var groupedSteps = [];
    activeSteps.forEach(function (step) {
        var identifier = step.skill + (step.rank ? "_r" + step.rank : "_max");
        var lastGroup = groupedSteps[groupedSteps.length - 1];

        if (lastGroup && lastGroup.identifier === identifier) {
            lastGroup.conditionGroups.push(step.conditions || []);
        } else {
            groupedSteps.push({
                identifier: identifier,
                step: step,
                conditionGroups: [step.conditions || []]
            });
        }
    });

    groupedSteps.forEach(function (group, idx) {
        var spellHtml = formatSpell(group.step);
        var isLast = (idx === groupedSteps.length - 1);

        var groupTexts = [];
        var hasUnconditional = false;

        group.conditionGroups.forEach(function (conds) {
            if (!conds || conds.length === 0) {
                hasUnconditional = true;
            } else {
                var condTexts = conds.map(function (c) {
                    return "<span class='desc-condition'>" + formatCond(c) + "</span>";
                });
                groupTexts.push(condTexts.join(" <strong>and</strong> "));
            }
        });

        var condString = "";
        if (!hasUnconditional && groupTexts.length > 0) {
            condString = "<div style='margin-left: 20px; opacity: 0.9; margin-top: 2px;'>&#8627; if " + groupTexts.join(" <strong style='color:var(--text-color);'>OR</strong> if ") + "</div>";
        }

        var stepText = "";
        if (idx === 0) {
            stepText = "Highest Priority: " + spellHtml;
        } else if (isLast && hasUnconditional) {
            stepText = "Otherwise, fallback to " + spellHtml + " as your filler.";
        } else {
            var trans = ["Next, use ", "Then, cast ", "After that, prioritize ", "Followed by "][(idx - 1) % 4];
            stepText = trans + spellHtml;
        }

        text += "<div style='margin-bottom: 8px;'>" + stepText + condString + "</div>";
    });

    text += "</div>";
    container.innerHTML = text;
}

function toggleAutoDesc() {
    var content = document.getElementById("rb_auto_desc");
    var header = document.getElementById("rb_auto_desc_header");
    var icon = document.getElementById("rb_auto_desc_icon");

    if (!content || !header || !icon) return;

    if (content.style.display === "none" || content.style.display === "") {
        content.style.display = "block";
        header.classList.add("is-open");
        icon.innerHTML = "&#9650;";
    } else {
        content.style.display = "none";
        header.classList.remove("is-open");
        icon.innerHTML = "&#9660;";
    }
}