// ============================================================================
// VIEW RENDERING (RESTO DRUID)
// ============================================================================
var CURRENT_LOG_PAGE = 0;
var LOG_ENTRIES_PER_PAGE = 100;
var COMBAT_LOG_SEARCH = ""; // NEU: Speichert den Suchbegriff

// NEU: Diese Funktion feuert bei jedem Tippen im Suchfeld
window.filterCombatLog = function() {
    var input = document.getElementById("logSearchInput");
    if (input) {
        COMBAT_LOG_SEARCH = input.value.toLowerCase();
        CURRENT_LOG_PAGE = 0; // Zurück auf Seite 1, wenn man sucht
        if (SIM_DATA && CURRENT_VIEW && SIM_DATA[CURRENT_VIEW]) {
            renderCombatLog(SIM_DATA[CURRENT_VIEW].log);
        }
    }
};

function switchView(type) {
    if (!SIM_DATA) return;
    CURRENT_LOG_PAGE = 0;
    CURRENT_VIEW = type;
    document.getElementById("resultsArea").classList.remove("hidden");

    updateGlobalHpsRange();
    renderHPSDistribution(SIM_DATA);

    var btns = document.querySelectorAll('.view-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');

    if (type === 'median') document.getElementById('viewMedian').classList.add('active');
    if (type === 'p5') document.getElementById('viewP5').classList.add('active');
    if (type === 'p95') document.getElementById('viewP95').classList.add('active');

    var data = SIM_DATA[type];
    if (!data) return;

    // --- Top Stats ---
    setText("out_hps_main", data.hps.toFixed(1));
    setText("out_total_heal", Math.floor(data.stats.effectiveHeal).toLocaleString());
    setText("out_total_mana", Math.floor(data.stats.totalManaSpent).toLocaleString());

    var runDuration = data.duration > 0 ? data.duration : getVal("maxTime");
    var mps = data.stats.totalManaSpent / runDuration;
    var hpm = data.stats.totalManaSpent > 0 ? (data.stats.effectiveHeal / data.stats.totalManaSpent) : 0;

    setText("out_mps", mps.toFixed(1) + " MPS");
    var hpmEl = document.getElementById("out_hpm");
    if (hpmEl) hpmEl.innerText = hpm.toFixed(2) + " HPM (Heal per Mana)";

    // --- NEU: Dynamische OOM-Anzeige im Results Area ---
    var oomEl = document.getElementById("out_time_oom");
    var oomTypeEl = document.getElementById("out_time_type");

    // KORREKTUR: Der Wert ist unter 'sim_duration_mode' gespeichert!
    var simMode = SIM_LIST[ACTIVE_SIM_INDEX].config.sim_duration_mode;

    if (oomEl && oomTypeEl) {
        oomEl.innerText = runDuration.toFixed(1) + "s";
        if (simMode === "oom") {
            oomTypeEl.innerText = "Time-to-OOM";
            oomEl.style.color = "#ffb74d";
        } else {
            oomTypeEl.innerText = "Fixed Limit Hit";
            oomEl.style.color = "#fff";
        }
    }

    var weightResBox = document.getElementById("weightResults");
    if (weightResBox) {
        if (data && SIM_LIST[ACTIVE_SIM_INDEX].results && SIM_LIST[ACTIVE_SIM_INDEX].results.statWeights) {
            weightResBox.classList.remove("hidden");
            var sw = SIM_LIST[ACTIVE_SIM_INDEX].results.statWeights;
            if (document.getElementById("val_spirit")) document.getElementById("val_spirit").innerHTML = sw.spirit;
            if (document.getElementById("val_mp5")) document.getElementById("val_mp5").innerHTML = sw.mp5;
            if (document.getElementById("val_int")) document.getElementById("val_int").innerHTML = sw.int;
            if (document.getElementById("val_crit")) document.getElementById("val_crit").innerHTML = sw.crit;
        } else {
            weightResBox.classList.add("hidden");
        }
    }

    var tbody = document.getElementById("tbl_body");
    if (tbody) {
        tbody.innerHTML = "";

        // Tabellenkopf anpassen (Casts und Overheal hinzugefügt)
        var thead = document.querySelector(".result-table thead");
        if (thead) {
            thead.innerHTML = '<tr><th class="text-left">Source</th><th class="text-right">Casts</th><th class="text-right">Effective</th><th class="text-right" style="color:#f44336">Overheal</th><th class="text-right" style="color:#ffeb3b">Crit %</th><th class="text-right">% Eff</th><th class="bar-col"></th></tr>';
        }

        // Neue addRow Funktion mit 2-farbigem Balken und Cast-Zähler
        function addRow(label, effHeal, overHeal, maxRawHeal, crits, count) {
            var totalEffAllSpells = data.stats.effectiveHeal;
            var rawPct = (totalEffAllSpells > 0) ? (effHeal / totalEffAllSpells * 100) : 0;

            var barColor = "var(--nature-green)";
            if (label.includes("Rejuvenation")) barColor = "#a5d6a7";
            if (label.includes("Regrowth")) barColor = "#81c784";
            var ohColor = "#f44336";

            var maxScale = maxRawHeal > 0 ? maxRawHeal : (effHeal + overHeal);
            var effWidth = (maxScale > 0) ? (effHeal / maxScale * 100) : 0;
            var ohWidth = (maxScale > 0) ? (overHeal / maxScale * 100) : 0;

            var critPctStr = "-";
            var countStr = count > 0 ? count : "-"; // Zeigt "-" an, wenn keine Casts registriert wurden (z.B. HoT Ticks)
            if (count > 0) {
                var critPct = (crits / count) * 100;
                critPctStr = critPct.toFixed(1) + "%";
            }

            var row = '<tr><td class="text-left" style="font-weight:500">' + label + '</td>' +
                '<td class="text-right" style="color:#aaa">' + countStr + '</td>' + // NEU: Casts Spalte
                '<td class="text-right" style="color:#fff">' + Math.floor(effHeal).toLocaleString() + '</td>' +
                '<td class="text-right" style="color:#f44336">' + Math.floor(overHeal).toLocaleString() + '</td>' +
                '<td class="text-right" style="color:#ffeb3b">' + critPctStr + '</td>' + 
                '<td class="text-right" style="color:var(--text-muted)">' + rawPct.toFixed(1) + '%</td>' +
                '<td class="bar-col"><div class="bar-bg" style="display:flex; width:100%; height:8px; background:#333; border-radius:4px; overflow:hidden;">' +
                '<div style="width: ' + effWidth + '%; background-color: ' + barColor + '"></div>' +
                '<div style="width: ' + ohWidth + '%; background-color: ' + ohColor + '; opacity: 0.8;"></div>' +
                '</div></td></tr>';
            tbody.innerHTML += row;
        }

        function addStatRow(label, valString, subVal, isHeader) {
            if (isHeader) {
                // Colspan auf 7 gesetzt
                tbody.innerHTML += '<tr class="section-header"><td colspan="7">' + label + '</td></tr>';
                return;
            }
            var row = '<tr><td class="text-left" style="font-weight:500; color:#aaa;">' + label + '</td>' +
                '<td class="text-right stat-value">' + valString + '</td>' +
                '<td class="text-right" style="color:var(--text-muted)">' + (subVal || "") + '</td>' +
                '<td colspan="4"></td></tr>'; // Colspan auf 4 gesetzt, damit es aufgeht (1+1+1+4 = 7)
            tbody.innerHTML += row;
        }

        // --- SECTION 1: HEALING SOURCES ---
        addStatRow("Healing Breakdown", "", "", true);

        var spells = Object.keys(data.stats.spellStats).sort(function (a, b) {
            return data.stats.spellStats[b].eff - data.stats.spellStats[a].eff;
        });

        // Finde den maximalen raw Output für die Skalierung der Balken
        var maxRaw = 0;
        spells.forEach(function (s) {
            var total = data.stats.spellStats[s].eff + data.stats.spellStats[s].over;
            if (total > maxRaw) maxRaw = total;
        });

        spells.forEach(function (spellName) {
            var s = data.stats.spellStats[spellName];
            if (s.eff > 0 || s.over > 0) {
                addRow(spellName, s.eff, s.over, maxRaw, s.crits || 0, s.count || 0); // NEU: crits und count übergeben
            }
        });

        // --- SECTION 2: PERFORMANCE METRICS ---
        addStatRow("Performance Metrics", "", "", true);
        var totalOverheal = data.stats.totalHeal - data.stats.effectiveHeal;
        var totalOHPct = data.stats.totalHeal > 0 ? (totalOverheal / data.stats.totalHeal * 100) : 0;

        addStatRow("Total Overhealing", Math.floor(totalOverheal).toLocaleString(), totalOHPct.toFixed(1) + "%");
        addStatRow("Critical Heals", data.stats.crits.toString(), "Direct Casts");
        addStatRow("Tank Deaths", data.stats.tankDeaths.toString(), "Times HP hit 0");
    }

    // --- SECTION 3: PROC & ITEM TRACKER ---
    if (typeof renderProcsTable === 'function' && data.stats && data.stats.procStats) {
        renderProcsTable(data.stats.procStats);
    }

    var logLabel = document.getElementById("logTypeLabel");
    if (logLabel) {
        if (!data.log || data.log.length === 0) {
            logLabel.innerText = "(No Log)";
            if (document.getElementById("logBody")) document.getElementById("logBody").innerHTML = "<tr><td colspan='22' style='text-align:center; padding:20px; color:#666;'>Log available in Min/Max view or Single runs.</td></tr>";
        } else {
            var labelSuffix = type === 'median' ? "REPRESENTATIVE RUN" : (type === 'p5' ? "5% HPS (LOWER BOUND)" : type.toUpperCase());
            logLabel.innerText = "(" + labelSuffix + ")";

            // DIAGRAMM AUFRUFEN:
            renderCombatChart(data.log);

            renderCombatLog(data.log);
        }
        var logSec = document.getElementById("combatLogSection");
        if (logSec) logSec.classList.remove("hidden");
    }
}

function renderSidebar() {
    var c = document.getElementById('sidebar');
    if (!c) return;
    var isComp = !document.getElementById('comparisonView').classList.contains('hidden');
    var html = '<div class="sidebar-btn btn-overview ' + (isComp ? 'active' : '') + '" onclick="showOverview()">📊</div><div class="sidebar-separator"></div>';
    SIM_LIST.forEach(function (sim, idx) {
        var a = (idx === ACTIVE_SIM_INDEX && !isComp) ? 'active' : '';
        html += '<div class="sidebar-btn ' + a + '" onclick="switchSim(' + idx + ')" title="' + sim.name + '">' + (idx + 1) + '</div>';
    });
    html += '<div class="sidebar-btn btn-add" onclick="addSim(false)">+</div>';
    c.innerHTML = html;
}

function showOverview() {
    saveCurrentState();
    updateGlobalHpsRange();
    document.getElementById('singleSimView').classList.add('hidden');
    document.getElementById('comparisonView').classList.remove('hidden');

    var n = document.getElementById('simName');
    n.value = "Overview"; n.disabled = true; n.style.color = "#888";
    renderComparisonTable();
    renderSidebar();
}

function renderComparisonTable() {
    var b = document.getElementById('comparisonBody');
    if (!b) return;
    
    var compHtml = ""; // <-- Puffer

    SIM_LIST.forEach(function (s, i) {
        var c = s.config;
        var r = s.results;

        // HPS-Werte (Falls bereits simuliert)
        var avgHps = r ? r.median.hps.toFixed(1) : "-";
        var minHps = (r && r.p5) ? r.p5.hps.toFixed(1) : "-";
        var maxHps = (r && r.p95) ? r.p95.hps.toFixed(1) : "-";

        // Dauer & Modus
        var simModeValue = c.sim_duration_mode || "fixed";
        var durText = simModeValue === "oom" ? (r ? r.median.duration.toFixed(1) + "s (OOM)" : "OOM") : (c.maxTime + "s");

        // Rota Name
        var rName = c.custom_rotation ? c.custom_rotation.name : "Custom";
        var rotaText = '<div style="font-size:0.85em; color:#bbb;">' + rName + '</div>';

        // Gear & Specials Zusammenfassung generieren
        var gearText = "";
        var sp = c.specials;
        if (sp) {
            // Zeige wichtige T-Set Boni an
            if (sp.stormrage8) gearText += '<span style="color:#ffff99">T2(8)</span> ';
            else if (sp.stormrage5) gearText += '<span style="color:#ffff99">T2(5)</span> ';
            else if (sp.stormrage3) gearText += '<span style="color:#ffff99">T2(3)</span> ';

            if (sp.dreamwalker8) gearText += '<span style="color:#ffff99">T3(8)</span> ';
            else if (sp.dreamwalker4) gearText += '<span style="color:#ffff99">T3(4)</span> ';

            if (sp.talon5) gearText += '<span style="color:#ffff99">T1(5)</span> ';

            // Zeige die Trinkets abgekürzt an
            if (c.trinket1) gearText += "<br><span style='font-size:0.75em; color:#a335ee'>" + c.trinket1.split(" ")[0] + "</span>";
            if (c.trinket2) gearText += "<br><span style='font-size:0.75em; color:#a335ee'>" + c.trinket2.split(" ")[0] + "</span>";
        }
        if (gearText === "") gearText = "Custom";

        // Stats auslesen (mit Fallback, falls Config unvollständig)
        var hpCell = c.stats ? c.stats.hp : 0;
        var spiCell = c.stats ? c.stats.spirit : 0;
        var intCell = c.stats ? c.stats.int : 0;
        var mp5Cell = c.stats ? c.stats.mp5 : 0;

        // Zeile bauen
        var html = '<tr onclick="switchSim(' + i + ')" style="cursor:pointer">' +
            '<td><strong>' + s.name + '</strong></td>' +
            '<td>' + durText + '</td>' +
            '<td>' + (c.iterations || 0) + '</td>' +
            '<td>' + hpCell + '</td>' +
            '<td>' + spiCell + '</td>' +
            '<td>' + intCell + '</td>' +
            '<td>' + mp5Cell + '</td>' +
            '<td>' + rotaText + '</td>' +
            '<td>' + gearText + '</td>' +
            '<td style="color:#90caf9; text-align:right;">' + minHps + '</td>' +
            '<td style="color:#4caf50; font-weight:bold; font-size:1.1em; text-align:right;">' + avgHps + '</td>' +
            '<td style="color:#a5d6a7; text-align:right;">' + maxHps + '</td>' +
            '<td style="text-align:center"><button class="btn-icon-delete" onclick="event.stopPropagation(); deleteSim(' + i + ')">🗑️</button></td>' +
            '</tr>';
        compHtml += html; // <-- An Puffer anhängen
    });
    b.innerHTML = compHtml;
}

// ============================================================================
// PROC & ITEM TRACKER RENDERING
// ============================================================================
window.renderProcsTable = function (procStats) {
    var tbody = document.getElementById("tbl_procs_body");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Falls keine Procs aufgetreten sind oder keine Items equippt waren
    if (!procStats || Object.keys(procStats).length === 0) {
        tbody.innerHTML = "<tr><td colspan='3' style='text-align:center; color:#666; padding: 15px;'>No active Procs or Uses during this run.</td></tr>";
        return;
    }

    var keys = Object.keys(procStats).sort();
    var procsHtml = ""; 

    keys.forEach(function (name) {
        var data = procStats[name];
        var amountStr = data.amount > 0 ? Math.floor(data.amount).toLocaleString() : "-";

        var color = "#00b0ff"; // Blau für Mana standardmäßig

        // Wenn das Item Heilung verursacht, färben wir den Wert Grün
        if (name.includes("Loop of Infused") || name.includes("Talon") ||
            name.includes("Eye of the Dead") || name.includes("Zandalarian") ||
            name.includes("Ephemeral") || name.includes("Draconic") ||
            name.includes("Hibernation") || name.includes("Scarab") ||
            name.includes("Ascendance")) {
            color = "#4caf50";
        }

        // ANGEPASST: white-space: normal und vertical-align hinzugefügt, 
        // damit lange Itemnamen mehrzeilig werden und das Layout nicht verschieben.
        var row = "<tr>" +
            "<td class='text-left' style='font-weight:500; color:#aaa; white-space: normal; word-break: break-word; line-height: 1.4;'>" + name + "</td>" +
            "<td class='text-right' style='color:var(--text-muted); vertical-align: middle;'>" + data.count + "</td>" +
            "<td class='text-right stat-value' style='color:" + color + "; vertical-align: middle;'>" + amountStr + "</td>" +
            "</tr>";
        procsHtml += row; 
    });
    tbody.innerHTML = procsHtml; 
};

// ============================================================================
// COMBAT LOG
// ============================================================================
function renderCombatLog(logData) {
    if (!logData || logData.length === 0) return;

    // NEU: Filtern nach Suchbegriff
    var filteredData = logData;
    if (typeof COMBAT_LOG_SEARCH !== 'undefined' && COMBAT_LOG_SEARCH !== "") {
        filteredData = logData.filter(function(entry) {
            var searchStr = (entry.t + " " + entry.evt + " " + entry.spell + " " + entry.info).toLowerCase();
            return searchStr.includes(COMBAT_LOG_SEARCH);
        });
    }

    var thead = document.getElementById("logHeader");
    var tbody = document.getElementById("logBody");

    // --- ANGEPASST: Neue Spalten NG und NS hinzugefügt ---
    // --- ANGEPASST: Neue Spalten HP, MP5 und Haste hinzugefügt ---
    var baseCols = `<th style="width: 45px;">Time</th>
                    <th style="width: 70px;">Event</th>
                    <th class="col-left" style="width: 120px;">Spell / Action</th>
                    <th style="width: 50px; text-align:right; color:#4caf50;">Eff Heal</th>
                    <th style="width: 45px; text-align:right; color:#f44336;">Over</th>
                    <th style="width: 40px; text-align:center;">Crit</th>
                    <th style="width: 40px; text-align:center; color:#ffd54f;">NG</th>
                    <th style="width: 40px; text-align:center; color:#a5d6a7;">NS</th>
                    <th style="width: 45px; text-align:right; color:#ffb74d;">HP</th>
                    <th style="width: 40px; text-align:right; color:#81d4fa;">MP5</th>
                    <th style="width: 50px; text-align:right; color:#ce93d8;">Haste</th>
                    <th style="width: 40px; text-align:center; color:#a5d6a7;">Rejuv</th>
                    <th style="width: 40px; text-align:center; color:#81c784;">Regr</th>
                    <th style="width: 50px; color:#00b0ff; text-align:right;">Mana</th>
                    <th style="width: 40px; color:#00b0ff; text-align:right;">+/-</th>
                    <th style="width: 55px; color:#fff; text-align:right;">Tank HP</th>
                    <th class="col-left">Info</th>`;
    thead.innerHTML = `<tr>${baseCols}</tr>`;

    // Paginierung auf die gefilterten Daten anwenden!
    var totalPages = Math.ceil(filteredData.length / LOG_ENTRIES_PER_PAGE);
    if (CURRENT_LOG_PAGE >= totalPages && totalPages > 0) CURRENT_LOG_PAGE = totalPages - 1;
    if (CURRENT_LOG_PAGE < 0) CURRENT_LOG_PAGE = 0;
    
    var start = CURRENT_LOG_PAGE * LOG_ENTRIES_PER_PAGE;
    var end = start + LOG_ENTRIES_PER_PAGE;
    var pageData = filteredData.slice(start, end);
    var logHtml = ""; 

    for (var i = 0; i < pageData.length; i++) {
        var entry = pageData[i];
        var rowClass = "";

        if (entry.evt === "HEAL" || entry.evt === "TICK") rowClass = "log-row-impact";
        if (entry.crit === "YES") rowClass = "log-row-crit";
        if (entry.evt === "ENEMY") rowClass = "row-nature";
        if (entry.evt === "DEATH" || entry.evt === "USE") rowClass = "log-row-proc";

        var valEff = entry.healNorm > 0 ? `<span style="color:#4caf50; font-weight:bold;">+${entry.healNorm}</span>` : "-";
        var valOver = entry.healOver > 0 ? `<span style="color:#f44336;">(${entry.healOver})</span>` : "-";

        var mDeltaStr = "";
        if (entry.manaDelta !== 0) {
            var color = entry.manaDelta > 0 ? "#4caf50" : "#f44336";
            var sign = entry.manaDelta > 0 ? "+" : "";
            mDeltaStr = `<span style="color:${color}; font-size:0.85em; font-weight:bold;">${sign}${entry.manaDelta}</span>`;
        } else {
            mDeltaStr = `<span style="color:#555;">-</span>`;
        }
        
        var ngStr = entry.ng === "Activ" ? `<span style="color:#ffd54f; font-weight:bold;">Activ</span>` : "-";
        var nsStr = entry.ns === "Activ" ? `<span style="color:#a5d6a7; font-weight:bold;">Activ</span>` : "-";

        var html = `<tr class="${rowClass}">
            <td class="log-time">${entry.t}</td>
            <td>${entry.evt}</td>
            <td class="col-left">${entry.spell}</td>
            <td class="col-right">${valEff}</td>
            <td class="col-right">${valOver}</td>
            <td style="text-align:center; color:#ffeb3b;">${entry.crit}</td>
            <td style="text-align:center;">${ngStr}</td>
            <td style="text-align:center;">${nsStr}</td>
            <td style="text-align:right; color:#ffb74d;">${entry.hp}</td>
            <td style="text-align:right; color:#81d4fa;">${entry.mp5}</td>
            <td style="text-align:right; color:#ce93d8;">${entry.haste}%</td>
            <td style="text-align:center; color:#a5d6a7; font-weight:bold;">${entry.rejuvRem}</td>
            <td style="text-align:center; color:#81c784; font-weight:bold;">${entry.rgRem}</td>
            <td class="col-right" style="color:#00b0ff;">${entry.mana}</td>
            <td class="col-right">${mDeltaStr}</td>
            <td class="col-right">${entry.tankHp}</td>
            <td class="col-left" style="color:#aaa;">${entry.info}</td>
        </tr>`;
        logHtml += html; 
    }
    
    // Fallback falls nichts gefunden wird (colspan auf 17 erhöht)
    if (filteredData.length === 0) {
        tbody.innerHTML = "<tr><td colspan='17' style='text-align:center; padding:20px; color:#666;'>No matches found for '" + COMBAT_LOG_SEARCH + "'.</td></tr>";
    } else {
        tbody.innerHTML = logHtml; 
    }
    
    renderLogPagination(filteredData.length);
}

// ============================================================================
// COMBAT CHART RENDERING
// ============================================================================
// NEU: Globale Funktion für den Slider (Jetzt mit Scroll-Fokus und Debounce)
window.updateChartZoom = function(val) {
    window.CHART_ZOOM = parseInt(val);
    var container = document.getElementById("combatChartContainer");
    
    // Fixiere die aktuelle Zeitachse in der Mitte, damit wir beim Zoomen nicht an den Anfang zurückgeworfen werden
    if (container && window.CHART_LAST_PXPSEC && window.CHART_CENTER_TIME === undefined) {
        window.CHART_CENTER_TIME = (container.scrollLeft + container.clientWidth / 2) / window.CHART_LAST_PXPSEC;
    }

    // Leichtes Debouncing, damit der Browser beim schnellen Ziehen nicht einfriert
    clearTimeout(window.CHART_ZOOM_TIMER);
    window.CHART_ZOOM_TIMER = setTimeout(function() {
        if (SIM_DATA && CURRENT_VIEW && SIM_DATA[CURRENT_VIEW]) {
            renderCombatChart(SIM_DATA[CURRENT_VIEW].log);
        }
    }, 50); // Zeichnet das Chart erst 50ms nach der Regler-Bewegung neu
};

function renderCombatChart(logData) {
    var logSection = document.getElementById("combatLogSection");
    if (!logSection) return;

    // NEU: Pixel-Skalierung auslesen und als Referenz für den nächsten Zoom speichern
    window.CHART_ZOOM = window.CHART_ZOOM || 25;
    var pixelsPerSecond = window.CHART_ZOOM;
    window.CHART_LAST_PXPSEC = pixelsPerSecond; 

    // NEU: Zoom-Control über dem Chart einfügen
    var zoomWrapper = document.getElementById("chartZoomWrapper");
    if (!zoomWrapper) {
        zoomWrapper = document.createElement("div");
        zoomWrapper.id = "chartZoomWrapper";
        zoomWrapper.style.cssText = "display:flex; justify-content:flex-end; align-items:center; margin-bottom: 5px; padding-right: 5px;";
        zoomWrapper.innerHTML = '<span style="color:#aaa; font-size:0.85rem; margin-right:8px;">🔍 Zoom:</span> <input type="range" id="chartZoomSlider" min="10" max="150" value="' + (window.CHART_ZOOM || 25) + '" oninput="window.updateChartZoom(this.value)">';
        
        var header = logSection.querySelector(".results-header");
        if (header && header.nextSibling) {
            logSection.insertBefore(zoomWrapper, header.nextSibling);
        } else {
            logSection.appendChild(zoomWrapper);
        }
    }

    var container = document.getElementById("combatChartContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "combatChartContainer";
        if (zoomWrapper.nextSibling) {
            logSection.insertBefore(container, zoomWrapper.nextSibling);
        } else {
            logSection.appendChild(container);
        }
    }

    container.style.cssText = "height: 260px; background: rgba(0,0,0,0.2); border: 1px dashed #444; border-radius: 8px; overflow-x: auto; overflow-y: hidden; margin-bottom: 20px; scrollbar-width: thin; position: relative;";
    container.innerHTML = "";

    if (!logData || logData.length === 0) {
        container.style.display = "none";
        return;
    }
    container.style.display = "block";

    // NEU: Variable Pixel/Sekunde vom Slider auslesen
    window.CHART_ZOOM = window.CHART_ZOOM || 25;
    var maxTime = parseFloat(logData[logData.length - 1].t) || 1;
    var pixelsPerSecond = window.CHART_ZOOM;
    var timelineWidth = Math.max(container.clientWidth, maxTime * pixelsPerSecond);
    var chartOffsetX = 24;

    var maxTime = parseFloat(logData[logData.length - 1].t) || 1;
    var pixelsPerSecond = 25;
    var timelineWidth = Math.max(container.clientWidth, maxTime * pixelsPerSecond);
    var chartOffsetX = 24;

    var innerContainer = document.createElement("div");
    innerContainer.style.position = "relative";
    innerContainer.style.width = (timelineWidth + chartOffsetX + 20) + "px";
    innerContainer.style.height = "100%";
    container.appendChild(innerContainer);

    var maxHeal = 0;
    var healEvents = [];
    var maxTankHp = 0;
    var tankHpPoints = [];
    var maxMana = 0;
    var manaPoints = [];
    var lastMana = 0;

    var rejuvSegments = []; var isRejuv = false; var startRejuv = 0;
    var rgSegments = []; var isRg = false; var startRg = 0;
    var htCasts = [];
    var rgCasts = [];

    // --- 1. DATEN SAMMELN ---
    logData.forEach(function (entry) {
        var t = parseFloat(entry.t);
        var eff = parseFloat(entry.healNorm || 0);
        var over = parseFloat(entry.healOver || 0);
        var totalHeal = eff + over;

        if (totalHeal > 0 || entry.evt === "CAST_START") {
            if (totalHeal > maxHeal) maxHeal = totalHeal;
            healEvents.push({ entry: entry, t: t, eff: eff, over: over, total: totalHeal, isCastVisual: (totalHeal === 0) });
        }

        var currentRejuv = (entry.rejuvRem !== "-" && parseFloat(entry.rejuvRem) > 0);
        if (currentRejuv && !isRejuv) { isRejuv = true; startRejuv = t; }
        else if (!currentRejuv && isRejuv) { isRejuv = false; rejuvSegments.push({ start: startRejuv, end: t }); }

        var currentRg = (entry.rgRem !== "-" && parseFloat(entry.rgRem) > 0);
        if (currentRg && !isRg) { isRg = true; startRg = t; }
        else if (!currentRg && isRg) { isRg = false; rgSegments.push({ start: startRg, end: t }); }

        if (entry.evt === "CAST_START" && entry.spell) {
            var ctMatch = (entry.info || "").match(/([\d\.]+)s/);
            var ct = ctMatch ? parseFloat(ctMatch[1]) : 0;
            if (ct > 0) {
                if (entry.spell.includes("Healing Touch")) htCasts.push({ start: t, end: t + ct });
                if (entry.spell.includes("Regrowth")) rgCasts.push({ start: t, end: t + ct });
            }
        }

        var tHp = parseFloat(entry.tankHp);
        if (!isNaN(tHp)) {
            if (tHp > maxTankHp) maxTankHp = tHp;
            tankHpPoints.push({ t: t, hp: tHp });
        }

        // Mana Tracking (mit Fallback auf lastMana für lückenlose Linien)
        var mVal = parseFloat(entry.mana);
        if (!isNaN(mVal)) {
            lastMana = mVal;
            if (mVal > maxMana) maxMana = mVal;
        }
        if (lastMana > 0) {
            manaPoints.push({ t: t, mana: lastMana });
        }
    });

    if (maxHeal === 0) maxHeal = 1;
    maxHeal *= 1.05;
    if (maxTankHp === 0) maxTankHp = 8000;
    if (maxMana === 0) maxMana = 3000; // Fallback

    if (isRejuv) rejuvSegments.push({ start: startRejuv, end: maxTime });
    if (isRg) rgSegments.push({ start: startRg, end: maxTime });

    // --- 2. TRACKS LAYOUT ---
    var trackHeight = 12;
    var trackGap = 2;
    var posHT = 8;
    var posRG = posHT + trackHeight + trackGap;
    var posRejuv = posRG + trackHeight + trackGap;
    var posRgHot = posRejuv + trackHeight + trackGap;

    function createTrack(bottomPos, segments, color, iconName, labelText) {
        var track = document.createElement("div");
        track.style.position = "absolute";
        track.style.bottom = bottomPos + "px";
        track.style.left = "0";
        track.style.width = "100%";
        track.style.height = trackHeight + "px";
        track.style.backgroundColor = "rgba(255,255,255,0.03)";
        track.style.borderRadius = "2px";

        var label = document.createElement("div");
        label.style.position = "sticky";
        label.style.left = "2px";
        label.style.zIndex = "1";
        label.style.pointerEvents = "none";
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.height = "100%";

        var iconImg = document.createElement("img");
        iconImg.src = "https://wow.zamimg.com/images/wow/icons/large/" + iconName + ".jpg";
        iconImg.style.width = trackHeight + "px";
        iconImg.style.height = trackHeight + "px";
        iconImg.style.borderRadius = "2px";
        iconImg.style.opacity = "0.9";
        label.appendChild(iconImg);

        track.appendChild(label);
        innerContainer.appendChild(track);

        segments.forEach(function (seg) {
            var sVal = parseFloat(seg.start) || 0;
            var eVal = parseFloat(seg.end) || 0;
            var leftPct = (sVal / maxTime) * 100;
            var widthPct = ((eVal - sVal) / maxTime) * 100;

            var bar = document.createElement("div");
            bar.style.position = "absolute";
            bar.style.top = "0";
            bar.style.left = "calc(" + leftPct + "% + " + chartOffsetX + "px)";
            bar.style.width = widthPct + "%";
            bar.style.height = "100%";
            bar.style.backgroundColor = color;
            bar.style.opacity = "0.5";
            bar.style.borderRadius = "2px";

            bar.title = labelText + ": " + sVal.toFixed(2) + "s - " + eVal.toFixed(2) + "s";
            track.appendChild(bar);
        });
    }

    createTrack(posHT, htCasts, "#4caf50", "spell_nature_healingtouch", "HT Casts");
    createTrack(posRG, rgCasts, "#81c784", "spell_nature_resistnature", "Regrowth Casts");
    createTrack(posRejuv, rejuvSegments, "#a5d6a7", "spell_nature_rejuvenation", "Rejuv HoT");
    createTrack(posRgHot, rgSegments, "#81c784", "spell_nature_resistnature", "Regrowth HoT");

    // --- 3. VERTIKALE BALKEN & LINIEN ---
    var chartAreaBottom = posRgHot + trackHeight + 10;
    var chartAreaHeight = 140;
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.style.position = "absolute";
    svg.style.left = "0px";
    svg.style.bottom = chartAreaBottom + "px";
    svg.style.width = (timelineWidth + chartOffsetX + 20) + "px";
    svg.style.height = chartAreaHeight + "px";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "5";

    // TANK HP AREA CHART (Jetzt in ROT)
    if (tankHpPoints.length > 0) {
        var hpPointsStr = `0,${chartAreaHeight} `;

        tankHpPoints.forEach(function (pt) {
            var x = (pt.t / maxTime) * timelineWidth + chartOffsetX;
            var pct = pt.hp / maxTankHp;
            var y = chartAreaHeight - (pct * chartAreaHeight);
            hpPointsStr += x + "," + y + " ";
        });

        var lastX = (tankHpPoints[tankHpPoints.length - 1].t / maxTime) * timelineWidth + chartOffsetX;
        hpPointsStr += `${lastX},${chartAreaHeight}`;

        var hpArea = document.createElementNS(svgNS, "polygon");
        hpArea.setAttribute("fill", "rgba(244, 67, 54, 0.15)"); // Rot transparent
        hpArea.setAttribute("points", hpPointsStr.trim());
        svg.appendChild(hpArea);

        var hpLine = document.createElementNS(svgNS, "polyline");
        hpLine.setAttribute("fill", "none");
        hpLine.setAttribute("stroke", "rgba(244, 67, 54, 0.8)"); // Rot solid
        hpLine.setAttribute("stroke-width", "3");

        var linePointsStr = "";
        tankHpPoints.forEach(function (pt) {
            var x = (pt.t / maxTime) * timelineWidth + chartOffsetX;
            var pct = pt.hp / maxTankHp;
            var y = chartAreaHeight - (pct * chartAreaHeight);
            linePointsStr += x + "," + y + " ";
        });
        hpLine.setAttribute("points", linePointsStr.trim());
        svg.appendChild(hpLine);

        var hpLabel = document.createElement("div");
        hpLabel.style.position = "absolute";
        hpLabel.style.left = "4px";
        hpLabel.style.top = "4px";
        hpLabel.style.fontSize = "10px";
        hpLabel.style.fontWeight = "bold";
        hpLabel.style.color = "rgba(244, 67, 54, 0.9)";
        hpLabel.innerText = "Tank HP Curve";
        innerContainer.appendChild(hpLabel);
    }

    // MANA CURVE (Jetzt in BLAU)
    if (manaPoints.length > 0) {
        var manaLine = document.createElementNS(svgNS, "polyline");
        manaLine.setAttribute("fill", "none");
        manaLine.setAttribute("stroke", "rgba(0, 176, 255, 0.8)"); // Blau solid
        manaLine.setAttribute("stroke-width", "2");

        var manaPointsStr = "";
        manaPoints.forEach(function (pt) {
            var x = (pt.t / maxTime) * timelineWidth + chartOffsetX;
            var pct = pt.mana / maxMana;
            var y = chartAreaHeight - (pct * chartAreaHeight);
            manaPointsStr += x + "," + y + " ";
        });
        manaLine.setAttribute("points", manaPointsStr.trim());
        svg.appendChild(manaLine);

        var manaLabel = document.createElement("div");
        manaLabel.style.position = "absolute";
        manaLabel.style.left = "4px";
        manaLabel.style.top = "18px"; // Leicht unter dem HP Label
        manaLabel.style.fontSize = "10px";
        manaLabel.style.fontWeight = "bold";
        manaLabel.style.color = "rgba(0, 176, 255, 0.9)";
        manaLabel.innerText = "Mana Curve";
        innerContainer.appendChild(manaLabel);
    }

    // Rolling HPS Curve (Bleibt GRÜN)
    var windowSize = 10;
    var dpsPoints = [];
    var maxRollingHps = 0;
    for (var t = 0; t <= maxTime; t += 0.5) {
        var wStart = Math.max(0, t - windowSize / 2);
        var wEnd = Math.min(maxTime, t + windowSize / 2);
        var actualWindow = wEnd - wStart;
        if (actualWindow <= 0) actualWindow = 1;

        var healInWindow = 0;
        for (var i = 0; i < healEvents.length; i++) {
            if (healEvents[i].t >= wStart && healEvents[i].t <= wEnd && !healEvents[i].isCastVisual) {
                healInWindow += healEvents[i].eff;
            }
        }
        var currentHps = healInWindow / actualWindow;
        if (currentHps > maxRollingHps) maxRollingHps = currentHps;
        dpsPoints.push({ t: t, hps: currentHps });
    }

    if (maxRollingHps > 0) {
        var hpsLine = document.createElementNS(svgNS, "polyline");
        hpsLine.setAttribute("fill", "none");
        hpsLine.setAttribute("stroke", "rgba(76, 175, 80, 0.8)");
        hpsLine.setAttribute("stroke-width", "2");

        var hpsPointsStr = "";
        dpsPoints.forEach(function (pt) {
            var x = (pt.t / maxTime) * timelineWidth + chartOffsetX;
            var pct = pt.hps / maxRollingHps;
            var y = chartAreaHeight - (pct * (chartAreaHeight * 0.9));
            hpsPointsStr += x + "," + y + " ";
        });
        hpsLine.setAttribute("points", hpsPointsStr.trim());
        svg.appendChild(hpsLine);

        var maxLabel = document.createElement("div");
        maxLabel.style.position = "absolute";
        maxLabel.style.left = "4px";
        maxLabel.style.bottom = (chartAreaBottom + chartAreaHeight - 14) + "px";
        maxLabel.style.fontSize = "9px";
        maxLabel.style.color = "rgba(76, 175, 80, 0.8)";
        maxLabel.innerText = "Peak: " + Math.floor(maxRollingHps) + " eHPS";
        innerContainer.appendChild(maxLabel);
    }

    innerContainer.appendChild(svg);

    // Healing Events (Bars)
    healEvents.forEach(function (ev) {
        var entry = ev.entry;
        var leftPos = (entry.t / maxTime) * 100;

        var totalPct = (ev.total / maxHeal) * 100;
        if (totalPct < 4) totalPct = 4;
        if (ev.total <= 0) totalPct = 6;

        var wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = "calc(" + leftPos + "% + " + chartOffsetX + "px)";
        wrapper.style.bottom = chartAreaBottom + "px";
        wrapper.style.transform = "translateX(-50%)";
        wrapper.style.height = chartAreaHeight + "px";
        wrapper.style.width = "20px";
        wrapper.style.zIndex = "10";
        wrapper.style.cursor = "crosshair";

        var isCrit = entry.crit === "YES";
        var tooltip = "Time: " + entry.t + "s\nSpell: " + entry.spell + "\n";
        if (ev.total > 0) {
            tooltip += "Eff Heal: " + Math.floor(ev.eff) + "\nOverheal: " + Math.floor(ev.over) + (isCrit ? " (CRITICAL)" : "") + "\n";
        }
        wrapper.title = tooltip;

        var barArea = document.createElement("div");
        barArea.style.position = "relative";
        barArea.style.height = (chartAreaHeight - 20) + "px";
        barArea.style.width = "100%";

        var effPct = ev.total > 0 ? (ev.eff / ev.total) * totalPct : 0;
        var overPct = ev.total > 0 ? (ev.over / ev.total) * totalPct : 0;

        if (effPct > 0) {
            var effBar = document.createElement("div");
            effBar.style.position = "absolute";
            effBar.style.bottom = "0";
            effBar.style.left = "5px";
            effBar.style.width = "10px";
            effBar.style.height = effPct + "%";
            effBar.style.backgroundColor = "#4caf50";
            effBar.style.opacity = "0.9";
            if (isCrit) { effBar.style.boxShadow = "0 0 5px #ffeb3b"; effBar.style.border = "1px solid #ffca28"; }
            barArea.appendChild(effBar);
        }

        if (overPct > 0) {
            var overBar = document.createElement("div");
            overBar.style.position = "absolute";
            overBar.style.bottom = effPct + "%";
            overBar.style.left = "5px";
            overBar.style.width = "10px";
            overBar.style.height = overPct + "%";
            overBar.style.backgroundColor = "#f44336";
            overBar.style.opacity = "0.6";
            barArea.appendChild(overBar);
        }

        if (ev.isCastVisual) {
            var dummyBar = document.createElement("div");
            dummyBar.style.position = "absolute";
            dummyBar.style.bottom = "0";
            dummyBar.style.left = "5px";
            dummyBar.style.width = "10px";
            dummyBar.style.height = totalPct + "%";
            dummyBar.style.border = "1px dashed #4caf50";
            barArea.appendChild(dummyBar);
        }

        var iconName = "inv_misc_questionmark";
        if (entry.spell.includes("Healing Touch")) iconName = "spell_nature_healingtouch";
        if (entry.spell.includes("Regrowth")) iconName = "spell_nature_resistnature";
        if (entry.spell.includes("Rejuvenation")) iconName = "spell_nature_rejuvenation";
        if (entry.spell.includes("Swiftmend")) iconName = "inv_relics_idolofrejuvenation"; // NEU
        if (entry.spell.includes("Innervate")) iconName = "spell_nature_lightning"; // NEU

        var iconArea = document.createElement("div");
        iconArea.style.height = "16px";
        iconArea.style.marginTop = "4px";
        iconArea.style.display = "flex";
        iconArea.style.justifyContent = "center";

        var iconImg = document.createElement("img");
        iconImg.src = "https://wow.zamimg.com/images/wow/icons/large/" + iconName + ".jpg";
        iconImg.style.width = "14px";
        iconImg.style.height = "14px";
        iconImg.style.borderRadius = "3px";
        iconImg.style.border = "1px solid #333";

        iconArea.appendChild(iconImg);
        wrapper.appendChild(barArea);
        wrapper.appendChild(iconArea);

        wrapper.onmouseenter = function () { wrapper.style.zIndex = "20"; };
        wrapper.onmouseleave = function () { wrapper.style.zIndex = "10"; };

        innerContainer.appendChild(wrapper);
    });
    // NEU: Scroll-Position nach dem Rendern auf die gemerkte Zeitachse zentrieren
    if (window.CHART_CENTER_TIME !== undefined) {
        setTimeout(function() {
            container.scrollLeft = (window.CHART_CENTER_TIME * pixelsPerSecond) - (container.clientWidth / 2);
            window.CHART_CENTER_TIME = undefined; // Reset für den nächsten Klick
        }, 0);
    }
}

// ============================================================================
// COMBAT LOG PAGINATION
// ============================================================================
function renderLogPagination(totalEntries) {
    var nav = document.getElementById("logPaginationNav");
    if (!nav) return; // Ist jetzt fix im HTML verbaut

    var entriesPerPage = typeof LOG_ENTRIES_PER_PAGE !== 'undefined' ? LOG_ENTRIES_PER_PAGE : 50;
    var totalPages = Math.ceil(totalEntries / entriesPerPage);

    // Aktualisiert nur noch die Buttons und den Text (Suchleiste bleibt unangetastet)
    nav.innerHTML = `
        <button class="btn-mini" onclick="changeLogPage(-1)" ${CURRENT_LOG_PAGE === 0 ? 'disabled' : ''}>&lt; Prev</button>
        <span style="color:var(--text-muted)">Page <strong>${CURRENT_LOG_PAGE + 1}</strong> of ${totalPages} (${totalEntries} entries)</span>
        <button class="btn-mini" onclick="changeLogPage(1)" ${CURRENT_LOG_PAGE >= totalPages - 1 || totalPages === 0 ? 'disabled' : ''}>Next &gt;</button>
    `;
}

function changeLogPage(delta) {
    CURRENT_LOG_PAGE += delta;
    if (SIM_DATA && CURRENT_VIEW && SIM_DATA[CURRENT_VIEW]) {
        renderCombatLog(SIM_DATA[CURRENT_VIEW].log);
    }
}

function renderHPSDistribution(data) {
    var chart = document.getElementById('dpsChart'); // DOM ID kept the same for simplicity
    if (!chart || !data || !data.hpsDistribution) return;

    chart.innerHTML = "";
    var hpsValues = data.hpsDistribution;

    var min = GLOBAL_HPS_MIN;
    var max = GLOBAL_HPS_MAX;
    var range = max - min;

    var minLabel = document.getElementById("distMinLabel");
    var maxLabel = document.getElementById("distMaxLabel");
    if (minLabel) minLabel.innerText = Math.floor(min) + " HPS";
    if (maxLabel) maxLabel.innerText = Math.floor(max) + " HPS";

    var bucketCount = 60;
    var buckets = new Array(bucketCount).fill(0);
    var step = (range > 0) ? (range / bucketCount) : 1;

    hpsValues.forEach(function (val) {
        var idx = Math.floor((val - min) / step);
        if (idx >= bucketCount) idx = bucketCount - 1;
        if (idx < 0) idx = 0;
        buckets[idx]++;
    });

    var maxBucket = Math.max(...buckets);
    var medianHps = data.median.hps;
    var p5HpsVal = data.p5.hps;
    var p95HpsVal = data.p95.hps;

    buckets.forEach(function (count, i) {
        var heightPct = (maxBucket > 0) ? (count / maxBucket) * 100 : 0;
        var bar = document.createElement('div');
        bar.className = 'dist-bar';
        bar.style.height = heightPct + "%";
        bar.style.backgroundColor = "var(--nature-green)"; // Healer Green
        bar.style.opacity = "0.7";

        var bucketStart = min + (i * step);
        var bucketEnd = bucketStart + step;

        if (medianHps >= bucketStart && medianHps <= bucketEnd) {
            bar.style.backgroundColor = "#fff";
            bar.style.opacity = "1";
        }
        if (p5HpsVal >= bucketStart && p5HpsVal <= bucketEnd) {
            bar.style.backgroundColor = "#90caf9";
            bar.style.opacity = "1";
        }
        if (p95HpsVal >= bucketStart && p95HpsVal <= bucketEnd) {
            bar.style.backgroundColor = "#ffb74d";
            bar.style.opacity = "1";
        }

        chart.appendChild(bar);
    });
}

function updateGlobalHpsRange() {
    var min = Infinity;
    var max = -Infinity;
    var found = false;

    SIM_LIST.forEach(function (sim) {
        if (sim.results && sim.results.hpsDistribution) {
            found = true;
            sim.results.hpsDistribution.forEach(function (val) {
                if (val < min) min = val;
                if (val > max) max = val;
            });
        }
    });

    if (!found) {
        GLOBAL_HPS_MIN = 0;
        GLOBAL_HPS_MAX = 1000;
    } else {
        var padding = (max - min) * 0.05;
        GLOBAL_HPS_MIN = Math.max(0, min - padding);
        GLOBAL_HPS_MAX = max + padding;
    }
}

// ============================================================================
// IMPORT / EXPORT LOGIC
// ============================================================================

var CONFIG_VERSION = 2; // Version 2: Delta-Encoding aktiv!

// Wörterbuch für die Standardwerte (alles was nicht hier steht, ist standardmäßig 0 oder "")
var DEFAULT_CFG_VALUES = {
    "sim_patch": "1.18.1c",
    "maxTime": 60,
    "simCount": 10000,
    "calcMethod": "S",
    "stat_proc_nature": 60,
    "stat_proc_arcane": 40,
    "enemy_level": 63,
    "char_race": "Tauren"
};

var GEAR_SLOT_ORDER = [
    "Head", "Neck", "Shoulder", "Back", "Chest", "Wrist", "Hands", "Waist", "Legs", "Feet",
    "Finger 1", "Finger 2", "Trinket 1", "Trinket 2", "Main Hand", "Off Hand", "Relic"
];

var OP_MAP = [">", "<", ">=", "<=", "=="];
var TARGET_MAP = [
    "Moonfire", "Insect Swarm", "Nature Eclipse", "Arcane Eclipse",
    "Nature's Grace", "Arcane Solstice", "Natural Solstice", "Starfire", "Wrath"
];


function packConfig(cfg) {
    var packedValues = [];

    // NEU: Delta-Encoding! Speichere nur Werte, die vom Standard abweichen
    CONFIG_IDS.forEach(function (id, idx) {
        var val = cfg[id];
        var def = DEFAULT_CFG_VALUES[id] !== undefined ? DEFAULT_CFG_VALUES[id] : 0;

        if (val != def) { // Nur bei Abweichung speichern (als flaches Paar: Index, Wert)
            packedValues.push(idx, val);
        }
    });

    var gearArr = [];
    var itemCount = 0;
    var enchantArr = [];

    GEAR_SLOT_ORDER.forEach(function (slot) {
        var val = cfg.gearSelection ? cfg.gearSelection[slot] : null;
        var idToSave = (val && typeof val === 'object' && val.id) ? val.id : (val || 0);
        gearArr.push(idToSave);
        if (idToSave != 0) itemCount++;

        var eVal = cfg.enchantSelection ? cfg.enchantSelection[slot] : null;
        var eIdToSave = (eVal && typeof eVal === 'object' && eVal.id) ? eVal.id : (eVal || 0);
        enchantArr.push(eIdToSave);
    });

    while (gearArr.length > 0 && gearArr[gearArr.length - 1] === 0) gearArr.pop();
    while (enchantArr.length > 0 && enchantArr[enchantArr.length - 1] === 0) enchantArr.pop();

    var compactRota = [
        cfg.custom_rotation.name === "Custom Rotation" ? "" : (cfg.custom_rotation.name || ""),
        cfg.custom_rotation.desc || "",
        cfg.custom_rotation.steps.map(function (step) {
            var sIdx = ROTATION_SKILLS.findIndex(function (s) { return s.id === step.skill; });
            var mappedSkill = sIdx !== -1 ? sIdx : step.skill;

            var flatStep = [mappedSkill, step.disabled ? 1 : 0];

            step.conditions.forEach(function (cond) {
                var cIdx = CONDITION_TYPES.findIndex(function (c) { return c.id === cond.type; });
                var mappedType = cIdx !== -1 ? cIdx : cond.type;
                var tIdx = TARGET_MAP.indexOf(cond.target);
                var oIdx = OP_MAP.indexOf(cond.op);
                var bVal = (cond.bool === "true" || cond.bool === true) ? 1 : 0;

                flatStep.push(mappedType, tIdx, oIdx, cond.val || 0, bVal);
            });

            return flatStep;
        })
    ];

    return {
        data: [CONFIG_VERSION, packedValues, gearArr, enchantArr, compactRota],
        itemCount: itemCount
    };
}

function unpackConfig(packed) {
    if (!Array.isArray(packed)) return packed;

    var isVersioned = typeof packed[0] === 'number';
    var version = isVersioned ? packed[0] : 0;

    if (version > CONFIG_VERSION) {
        alert("Achtung: Dieser Link stammt aus einer neueren Version des Simulators und wird möglicherweise nicht korrekt geladen!");
    }

    var valuesData = isVersioned ? packed[1] : packed[0];
    var gearData = isVersioned ? packed[2] : packed[1];
    var enchantData = isVersioned ? packed[3] : packed[2];
    var compactRota = isVersioned ? packed[4] : (packed.length > 3 ? packed[3] : null);

    var cfg = {};

    // 1. Alle CONFIG_IDS initial mit Defaults (oder 0) füllen
    CONFIG_IDS.forEach(function (id) {
        cfg[id] = DEFAULT_CFG_VALUES[id] !== undefined ? DEFAULT_CFG_VALUES[id] : 0;
    });

    // 2. Werte aus dem Link verarbeiten
    if (Array.isArray(valuesData)) {
        if (version >= 2) {
            // NEU: Delta-Array verarbeiten [Index, Wert, Index, Wert, ...]
            for (var i = 0; i < valuesData.length; i += 2) {
                var cId = CONFIG_IDS[valuesData[i]];
                if (cId) cfg[cId] = valuesData[i + 1];
            }
        } else {
            // ALT: Klassisches komplettes Array aus Vorgängerversionen
            CONFIG_IDS.forEach(function (id, idx) {
                if (idx < valuesData.length) cfg[id] = valuesData[idx];
            });
        }
    }

    cfg.gearSelection = {};
    if (gearData) {
        if (Array.isArray(gearData)) {
            gearData.forEach(function (id, idx) {
                if (id != 0 && idx < GEAR_SLOT_ORDER.length) {
                    var item = ITEM_DB.find(function (i) { return String(i.id) === String(id); });
                    if (item) cfg.gearSelection[GEAR_SLOT_ORDER[idx]] = item.id;
                }
            });
        } else {
            for (var slot in gearData) {
                var id = gearData[slot];
                var item = ITEM_DB.find(function (i) { return String(i.id) === String(id); });
                if (item) cfg.gearSelection[slot] = item.id;
            }
        }
    }

    cfg.enchantSelection = {};
    if (enchantData) {
        if (Array.isArray(enchantData)) {
            enchantData.forEach(function (id, idx) {
                if (id != 0 && idx < GEAR_SLOT_ORDER.length) {
                    var ench = ENCHANT_DB.find(function (e) { return String(e.id) === String(id); });
                    if (ench) cfg.enchantSelection[GEAR_SLOT_ORDER[idx]] = ench.id;
                }
            });
        } else {
            for (var slot in enchantData) {
                var id = enchantData[slot];
                var ench = ENCHANT_DB.find(function (e) { return String(e.id) === String(id); });
                if (ench) cfg.enchantSelection[slot] = ench.id;
            }
        }
    }

    if (compactRota) {
        if (Array.isArray(compactRota)) {
            cfg.custom_rotation = {
                name: compactRota[0] || "Custom Rotation",
                desc: compactRota[1] || "",
                steps: compactRota[2].map(function (s, stepIdx) {
                    var isOldNested = Array.isArray(s[s.length - 1]) || (s.length > 2 && Array.isArray(s[2]));
                    var sId = Date.now() + stepIdx + Math.floor(Math.random() * 1000);

                    if (isOldNested) {
                        var isVeryOld = s.length === 4;
                        if (isVeryOld) sId = s[0];
                        var skillData = isVeryOld ? s[1] : s[0];
                        var disData = isVeryOld ? s[2] : s[1];
                        var condsData = isVeryOld ? s[3] : s[2];

                        var skillVal = typeof skillData === 'number' && ROTATION_SKILLS[skillData] ? ROTATION_SKILLS[skillData].id : skillData;

                        var parsedConds = (condsData || []).map(function (c) {
                            if (Array.isArray(c)) {
                                var typeVal = typeof c[0] === 'number' && CONDITION_TYPES[c[0]] ? CONDITION_TYPES[c[0]].id : c[0];
                                var condObj = { type: typeVal };
                                if (c[1] !== undefined && c[1] !== -1 && TARGET_MAP[c[1]]) condObj.target = TARGET_MAP[c[1]];
                                if (c[2] !== undefined && c[2] !== -1 && OP_MAP[c[2]]) condObj.op = OP_MAP[c[2]];
                                condObj.val = c[3] || 0;
                                if (c[4] !== undefined) condObj.bool = c[4] === 1 ? "true" : "false";
                                return condObj;
                            }
                            return c;
                        });

                        return { id: sId, skill: skillVal, disabled: disData === 1, conditions: parsedConds };
                    } else {
                        var skillVal = typeof s[0] === 'number' && ROTATION_SKILLS[s[0]] ? ROTATION_SKILLS[s[0]].id : s[0];
                        var parsedConds = [];

                        for (var i = 2; i < s.length; i += 5) {
                            var typeVal = typeof s[i] === 'number' && CONDITION_TYPES[s[i]] ? CONDITION_TYPES[s[i]].id : s[i];
                            var condObj = { type: typeVal };

                            if (s[i + 1] !== undefined && s[i + 1] !== -1 && TARGET_MAP[s[i + 1]]) condObj.target = TARGET_MAP[s[i + 1]];
                            if (s[i + 2] !== undefined && s[i + 2] !== -1 && OP_MAP[s[i + 2]]) condObj.op = OP_MAP[s[i + 2]];
                            condObj.val = s[i + 3] || 0;
                            if (s[i + 4] !== undefined) condObj.bool = s[i + 4] === 1 ? "true" : "false";

                            parsedConds.push(condObj);
                        }

                        return { id: sId, skill: skillVal, disabled: s[1] === 1, conditions: parsedConds };
                    }
                })
            };
        } else {
            cfg.custom_rotation = {
                name: compactRota.n || "Imported",
                desc: compactRota.d || "",
                steps: compactRota.s.map(function (s) { return { id: s[0], skill: s[1], disabled: s[2] === 1, conditions: s[3] || [] }; })
            };
        }
    } else {
        var defaultRota = PRESET_ROTATIONS["Standard 1"] || PRESET_ROTATIONS["standard"];
        cfg.custom_rotation = JSON.parse(JSON.stringify(defaultRota));
        showToast("Old config imported: Using standard rotation");
    }

    return cfg;
}

// ============================================================================
// IMPORT CONFIG MODAL LOGIC (NEW)
// ============================================================================

// 1. Öffnet das Import-Modal anstelle des Browser-Prompts
function importFromClipboard() {
    var modal = document.getElementById('importConfigModal');
    var textarea = document.getElementById('importConfigInput');
    if (modal && textarea) {
        textarea.value = ""; // Textarea leeren
        modal.classList.remove('hidden');
        textarea.focus();
    }
}

function closeImportConfigModal() {
    var modal = document.getElementById('importConfigModal');
    if (modal) modal.classList.add('hidden');
}

// 2. Führt den eigentlichen Import aus, wenn der User im Modal auf "Import" klickt
function confirmImportConfig() {
    var textarea = document.getElementById('importConfigInput');
    if (!textarea) return;
    var input = textarea.value.trim();
    
    if (!input) {
        showToast("Please paste a valid config string.");
        return;
    }

    if (ITEM_DB.length === 0) {
        alert("Database not loaded yet. Please wait a moment.");
        return;
    }

    var b64 = input;
    if (input.includes("?s=")) { b64 = input.split("?s=")[1]; }

    try {
        var json = null;
        if (typeof LZString !== 'undefined') {
            json = LZString.decompressFromEncodedURIComponent(b64);
        }
        if (!json) {
            try { json = atob(b64); } catch (e) { }
        }

        if (!json) throw new Error("Could not decode string");

        var data = JSON.parse(json);
        if (!Array.isArray(data)) data = [data];

        data.forEach(function (s) {
            var newId = Date.now() + Math.floor(Math.random() * 1000);
            var simName = (Array.isArray(s) ? s[0] : (s.n || s.name || "Simulation")) + " (Imp)";
            var newSim = new SimObject(newId, simName);

            if (Array.isArray(s) && s.length === 2 && Array.isArray(s[1])) {
                newSim.config = unpackConfig(s[1]);
            } else if (s.d) {
                newSim.config = unpackConfig(s.d);
            } else if (s.config) {
                newSim.config = s.config;
            } else {
                newSim.config = unpackConfig(s);
            }

            SIM_LIST.push(newSim);
        });

        closeImportConfigModal();
        renderSidebar();
        switchSim(SIM_LIST.length - 1);
        showToast("Imported successfully!");

    } catch (e) {
        console.error(e);
        alert("Invalid Config String!");
    }
}

function exportSettings() {
    saveCurrentState();

    if (SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].config = getCurrentConfigFromUI();
    }

    var isOverview = !document.getElementById('comparisonView').classList.contains('hidden');
    var simsToProcess = isOverview ? SIM_LIST : (SIM_LIST[ACTIVE_SIM_INDEX] ? [SIM_LIST[ACTIVE_SIM_INDEX]] : []);

    var hasAnyGear = false;
    /*
    var dataToExport = simsToProcess.map(function (s) {
        var packResult = packConfig(s.config);
        if (packResult.itemCount > 0) hasAnyGear = true;
        return { n: s.name, d: packResult.data };
    });*/

    var dataToExport = simsToProcess.map(function (s) {
        var packResult = packConfig(s.config);
        if (packResult.itemCount > 0) hasAnyGear = true;
        // NEU: Platz sparen, wenn der Name nur "Simulation X" ist
        var exportName = s.name.startsWith("Simulation ") ? "" : s.name;
        return [exportName, packResult.data];
    });

    if (!hasAnyGear) {
        alert("ACHTUNG: Es wurde KEIN Gear gefunden!\nBitte wähle im Simulator erst Items aus, bevor du exportierst.");
        return;
    }

    var jsonStr = JSON.stringify(dataToExport);
    var compressed = "";

    if (typeof LZString !== 'undefined') {
        compressed = LZString.compressToEncodedURIComponent(jsonStr);
    } else {
        compressed = btoa(jsonStr);
    }

    var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?s=' + compressed;
    window.history.pushState({ path: newUrl }, '', newUrl);
    navigator.clipboard.writeText(newUrl);

    var msg = isOverview ? "All Sims Copied!" : "Current Sim Copied!";
    showToast(msg);
}

var importRetries = 0;
function importSettings() {
    var params = new URLSearchParams(window.location.search);
    var b64 = params.get('s');

    if (b64) {
        if (ITEM_DB.length === 0) {
            if (importRetries < 50) {
                console.log("Waiting for Item DB to load (URL Import)...");
                importRetries++;
                setTimeout(importSettings, 200);
                return;
            } else {
                console.error("Database load timeout.");
                showToast("DB Load Timeout");
                return;
            }
        }

        try {
            var json = null;
            if (typeof LZString !== 'undefined') {
                json = LZString.decompressFromEncodedURIComponent(b64);
            }
            if (!json) { try { json = atob(b64); } catch (e) { } }

            if (json) {
                var data = JSON.parse(json);
                if (Array.isArray(data)) {
                    SIM_LIST = [];

                    /*
                    data.forEach(d => {
                        // KORREKTUR: Name explizit aus d.n (vom Export-Objekt) nehmen
                        var simName = d.n || d.name || "Simulation " + (SIM_LIST.length + 1);
                        var s = new SimObject(Date.now() + Math.random(), simName);

                        if (d.d) s.config = unpackConfig(d.d);
                        else s.config = d.config || d;

                        SIM_LIST.push(s);
                    });
                    */

                    data.forEach(d => {
                        var simName = "Simulation " + (SIM_LIST.length + 1);
                        var configData = null;

                        if (Array.isArray(d) && d.length === 2 && Array.isArray(d[1])) {
                            // Neues Format
                            simName = d[0] || simName;
                            configData = unpackConfig(d[1]);
                        } else {
                            // Altes Format
                            simName = d.n || d.name || simName;
                            if (d.d) configData = unpackConfig(d.d);
                            else configData = d.config || d;
                        }

                        var s = new SimObject(Date.now() + Math.random(), simName);
                        s.config = configData;

                        SIM_LIST.push(s);
                    });

                    if (SIM_LIST.length > 0) {
                        ACTIVE_SIM_INDEX = 0;
                        // KORREKTUR: Den Namen auch im UI-Input setzen
                        var nameInput = document.getElementById('simName');
                        if (nameInput) nameInput.value = SIM_LIST[0].name;

                        applyConfigToUI(SIM_LIST[0].config);
                        renderSidebar();
                        showOverview();
                    } else {
                        addSim(true);
                    }
                }
            }
        } catch (e) {
            console.error("Import failed", e);
        }
    }
}

// ============================================================================
// CSV EXPORT (RESTO DRUID)
// ============================================================================
function exportCSV() {
    if (!SIM_DATA || !CURRENT_VIEW || !SIM_DATA[CURRENT_VIEW]) {
        alert("Please run a simulation first.");
        return;
    }

    var logData = SIM_DATA[CURRENT_VIEW].log;
    if (!logData || logData.length === 0) {
        alert("No log data available for " + CURRENT_VIEW + " view.");
        return;
    }

    // Define CSV Headers specifically for Healer
    var header = ["Time", "Event", "Spell", "Eff_Heal", "Overheal", "Crit", "NG", "NS", "HP", "MP5", "Haste_Pct", "FSR_Active", "Mana", "Tank_HP", "Info"];
    var csvContent = "data:text/csv;charset=utf-8,";
    csvContent += header.join(",") + "\r\n";

    // Format Rows
    logData.forEach(function (row) {
        var rowData = [
            row.t,
            row.evt,
            row.spell,
            Math.floor(row.healNorm || 0),
            Math.floor(row.healOver || 0),
            row.crit === "YES" ? 1 : 0,
            row.ng === "Activ" ? 1 : 0,
            row.ns === "Activ" ? 1 : 0,
            row.hp || 0,        // NEU
            row.mp5 || 0,       // NEU
            row.haste || 0,     // NEU
            row.fsr === "YES" ? 1 : 0,
            row.mana !== "-" ? row.mana : 0,
            row.tankHp,
            '"' + (row.info || "") + '"' // Escape commas in info text
        ];
        csvContent += rowData.join(",") + "\r\n";
    });

    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);

    var timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.setAttribute("download", "resto_sim_log_" + CURRENT_VIEW + "_" + timestamp + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================================
// MODAL CONTROLS & GEAR PRESET (FIX)
// ============================================================================

function openOtherSimsModal() {
    var modal = document.getElementById('otherSimsModal');
    if (modal) modal.classList.remove('hidden');
}

function closeOtherSimsModal() {
    var modal = document.getElementById('otherSimsModal');
    if (modal) modal.classList.add('hidden');
}

function openGearPresetModal() {
    var modal = document.getElementById('gearPresetModal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.error("Modal mit der ID 'gearPresetModal' wurde nicht gefunden!");
    }
}

function closeGearPresetModal() {
    var modal = document.getElementById('gearPresetModal');
    if (modal) modal.classList.add('hidden');
}

// 1. Wird beim Klick auf "Load" aufgerufen
window.loadBiSPreset = function() {
    var sel = document.getElementById("bis_preset_select");
    if (!sel || !sel.value) { 
        showToast("Please select a preset from the dropdown first."); 
        return; 
    }
    openGearPresetModal();
};

// 2. Wird beim Klick auf "Yes, replace" im Modal aufgerufen
window.confirmLoadBiSPreset = function() {
    var sel = document.getElementById("bis_preset_select");
    if (!sel) return;
    var val = sel.value;

    var preset = null;
    if (val.startsWith("def_")) {
        var k = val.substring(4);
        preset = GEAR_PRESETS[k];
    } else if (val.startsWith("cus_")) {
        var k = val.substring(4);
        var custom = JSON.parse(localStorage.getItem("boomkin_sim_custom_gear") || "{}");
        preset = custom[k];
    }

    if (!preset) {
        closeGearPresetModal();
        return;
    }

    GEAR_SELECTION = {};
    ENCHANT_SELECTION = {};

    if (preset.gear) {
        for (var slot in preset.gear) {
            if (preset.gear[slot] !== 0 && preset.gear[slot] !== "") {
                GEAR_SELECTION[slot] = preset.gear[slot];
            }
        }
    }
    if (preset.enchants) {
        for (var slot in preset.enchants) {
            if (preset.enchants[slot] !== 0 && preset.enchants[slot] !== "") {
                ENCHANT_SELECTION[slot] = preset.enchants[slot];
            }
        }
    }

    if (typeof initGearPlannerUI === 'function') initGearPlannerUI();
    saveCurrentState();
    
    closeGearPresetModal();
    showToast("Gear Preset loaded!");
};

// Escape-Key schließt sämtliche Modals
document.addEventListener('keydown', function (e) {
    if (e.key === "Escape") {
        closeOtherSimsModal();
        closeGearPresetModal();
        if (typeof closeItemModal === 'function') closeItemModal();
        if (typeof closeEnchantModal === 'function') closeEnchantModal();
        if (typeof closeImportConfigModal === 'function') closeImportConfigModal();
    }
});