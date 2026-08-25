// ============================================================================
// CORE SIMULATION WRAPPERS (RESTO DRUID)
// ============================================================================

function getInputs() {
    var rawSims = getVal("simCount");
    var tankDmg = getVal("tank_dmg") || 1500;
    var tankSpeed = getVal("tank_attack_speed") || 2.0;

    // Base Stats
    var inHP = getVal("statHP") || 0;
    var inSpirit = getVal("statSpirit") || 100;
    var inInt = getVal("statIntellect") || 150;
    var inMP5 = getVal("statMP5") || 0;
    var inMana = getVal("statMana") || 3000;

    // Haste Mult & Crit
    var hasteInput = document.getElementById("statHaste");
    var hasteMultVal = hasteInput && hasteInput.getAttribute("data-mult") ? parseFloat(hasteInput.getAttribute("data-mult")) : 1.0;
    var inCrit = getVal("statCrit") || 5.0;

    // Simulation Mode auslesen (Fixed oder OOM)
    var simModeSelect = document.getElementById("sim_duration_mode");
    var simMode = simModeSelect ? simModeSelect.value : "fixed";

    // --- NEU: Wir klonen die Rotation und filtern blockierte Talente direkt aus, 
    // bevor die Engine sie überhaupt zu Gesicht bekommt! ---
    var rotClone = (typeof CUSTOM_ROTATION !== 'undefined') ? JSON.parse(JSON.stringify(CUSTOM_ROTATION)) : { steps: [] };
    if (rotClone.steps) {
        rotClone.steps = rotClone.steps.filter(function (step) {
            if (step.skill === "Swiftmend" && (!TALENT_CONFIG || !TALENT_CONFIG.swiftmend)) return false;
            if (step.skill === "NaturesSwiftness" && (!TALENT_CONFIG || !TALENT_CONFIG.natureSwiftness)) return false;
            return true;
        });
    }

    // --- SPECIALS AUS GEAR AUSLESEN ---
    var eqNames = [];
    var eqSets = {};
    for (var slot in GEAR_SELECTION) {
        var itmId = GEAR_SELECTION[slot];
        if (itmId && typeof ITEM_ID_MAP !== 'undefined') {
            var itm = ITEM_ID_MAP[itmId];
            if (itm) {
                eqNames.push(itm.name.toLowerCase());
                if (itm.setName) eqSets[itm.setName] = (eqSets[itm.setName] || 0) + 1;
            }
        }
    }
    var hasItem = (str) => eqNames.some(n => n.includes(str.toLowerCase()));
    var hasSet = (name, count) => (eqSets[name] && eqSets[name] >= count);

    var specials = {
        staffDreamer: hasItem("Staff of the Dreamer"),
        beacon: hasItem("Beacon of the Emeral"),
        rodOfResuscitation: hasItem("Rod of Resuscitation"),
        alartar: hasItem("Alar'tar"),
        idolRejuv: hasItem("Idol of Rejuvenation"),
        idolHealth: hasItem("Idol of Health"),
        idolLongevity: hasItem("Idol of Longevity"),
        loopOfInfused: hasItem("Loop of Infused Renewal"),
        vanguardRing: hasItem("Vanguard's Ring"),
        deepSapphire: hasItem("Deep Sapphire Circlet"),
        manaBinding: hasItem("Mana Binding Signet"),
        blueDragon: hasItem("Darkmoon Card: Blue Dragon"),
        shardOfDreams: hasItem("Shard of Dreams") || hasItem("Shard of the Dreams"),
        vanguardBrooch: hasItem("Vanguard's Brooch"),
        breathOfSolnius: hasItem("Breath of Solnius"),
        remainsOfLost: hasItem("Remains of the Lost"),
        feyDreamcatcher: hasItem("Fey Dreamcatcher"),
        talon3: hasSet("Raiment of the Talon", 3),
        talon5: hasSet("Raiment of the Talon", 5),
        dreamwalker4: hasSet("Dreamwalker Raiment", 4),
        dreamwalker8: hasSet("Dreamwalker Raiment", 8),
        wisdomDeer3: hasSet("Wisdom of the Deer", 3),
        genesis3: hasSet("Genesis Raiment", 3),
        genesis5: hasSet("Genesis Raiment", 5),
        stormrage3: hasSet("Stormrage Raiment", 3),
        stormrage5: hasSet("Stormrage Raiment", 5),
        stormrage8: hasSet("Stormrage Raiment", 8)
    };

    var t1Name = (GEAR_SELECTION["Trinket 1"] && ITEM_ID_MAP[GEAR_SELECTION["Trinket 1"]]) ? ITEM_ID_MAP[GEAR_SELECTION["Trinket 1"]].name : "";
    var t2Name = (GEAR_SELECTION["Trinket 2"] && ITEM_ID_MAP[GEAR_SELECTION["Trinket 2"]]) ? ITEM_ID_MAP[GEAR_SELECTION["Trinket 2"]].name : "";

    return {
        simMode: simMode,
        iterations: (rawSims > 0 ? rawSims : 1),
        maxTime: getVal("maxTime") || 120,
        rng_seed: document.getElementById("rng_seed") ? document.getElementById("rng_seed").value : "",
        tank: { dmg: tankDmg, speed: tankSpeed, maxHp: 8000 },
        custom_rotation: rotClone,
        stats: { hp: inHP, spirit: inSpirit, int: inInt, mp5: inMP5, maxMana: inMana, crit: inCrit, hasteFactor: hasteMultVal },
        talents: TALENT_CONFIG,
        specials: specials,
        trinket1: t1Name,
        trinket2: t2Name
    };
}

async function runSimulation() {
    var config = getInputs();
    showProgress("Simulating...");

    var allResults = [];
    var i = 0;
    var batchSize = Math.max(1, Math.floor(config.iterations / 20));

    var baseSeed = 0;
    if (config.rng_seed && config.rng_seed.toString().trim().length > 0) {
        var str = config.rng_seed.toString().trim();
        for (var k = 0; k < str.length; k++) {
            baseSeed = ((baseSeed << 5) - baseSeed) + str.charCodeAt(k);
            baseSeed |= 0;
        }
    } else {
        baseSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    }

    function processBatch() {
        try {
            var target = Math.min(config.iterations, i + batchSize);

            for (; i < target; i++) {
                var currentConfig = Object.assign({}, config);
                currentConfig.seed = baseSeed + i;

                var res = runSingleTargetSimulation(currentConfig);
                allResults.push(res);
            }

            if (typeof updateProgress === "function") updateProgress((i / config.iterations) * 100);

            if (i < config.iterations) {
                setTimeout(processBatch, 0);
            } else {
                var aggregated = aggregateResults(allResults, config);

                SIM_LIST[ACTIVE_SIM_INDEX].results = aggregated;
                SIM_DATA = aggregated;

                var btnMedian = document.getElementById("viewMedian");
                if (btnMedian) btnMedian.innerText = "Median (" + aggregated.median.hps.toFixed(1) + ")";

                var btnP5 = document.getElementById("viewP5");
                if (btnP5) btnP5.innerText = "5% HPS (" + aggregated.p5.hps.toFixed(1) + ")";

                var btnP95 = document.getElementById("viewP95");
                if (btnP95) btnP95.innerText = "95% HPS (" + aggregated.p95.hps.toFixed(1) + ")";

                if (typeof switchView === 'function') switchView(CURRENT_VIEW);

                var btnW = document.getElementById("btnWeights");
                if (btnW) btnW.disabled = false;

                showToast("Simulation Complete!");
                hideProgress();
            }
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
            hideProgress();
        }
    }
    setTimeout(processBatch, 50);
}

function runAllSims() {
    if (!SIM_LIST || SIM_LIST.length === 0) return;
    showProgress("Simulating All Configs...");

    var originalSimIndex = ACTIVE_SIM_INDEX;
    var currentSimIndex = 0;

    function processNextSim() {
        if (currentSimIndex >= SIM_LIST.length) {
            // Wenn alle fertig sind, springen wir zum ursprünglich ausgewählten Profil zurück
            switchSim(originalSimIndex);
            hideProgress();
            showToast("All Simulations Complete!");
            if (typeof renderComparisonTable === 'function') renderComparisonTable();
            if (typeof updateGlobalHpsRange === 'function') updateGlobalHpsRange();
            return;
        }

        var sim = SIM_LIST[currentSimIndex];

        // GANZ WICHTIG: Das Profil in die UI laden, damit calculateGearStats()
        // alle Werte (HP, Mana, Crit, Set-Boni) korrekt berechnet und aufbaut!
        applyConfigToUI(sim.config);

        // Jetzt holen wir uns die fixfertig aufbereitete Engine-Config
        var engineConfig = getInputs();
        var allResults = [];
        var iteration = 0;
        var batchSize = Math.max(1, Math.floor(engineConfig.iterations / 20));

        var baseSeed = 0;
        if (engineConfig.rng_seed && engineConfig.rng_seed.toString().trim().length > 0) {
            var str = engineConfig.rng_seed.toString().trim();
            for (var k = 0; k < str.length; k++) {
                baseSeed = ((baseSeed << 5) - baseSeed) + str.charCodeAt(k);
                baseSeed |= 0;
            }
        } else {
            baseSeed = Math.floor(Math.random() * 0xFFFFFFFF);
        }

        function processBatch() {
            try {
                var target = Math.min(engineConfig.iterations, iteration + batchSize);
                for (; iteration < target; iteration++) {
                    var runCfg = Object.assign({}, engineConfig);
                    runCfg.seed = baseSeed + iteration;
                    var res = runSingleTargetSimulation(runCfg);
                    allResults.push(res);
                }

                // Globaler Fortschritt über alle Simulationen hinweg
                var totalProgress = ((currentSimIndex * engineConfig.iterations) + iteration) / (SIM_LIST.length * engineConfig.iterations) * 100;
                if (typeof updateProgress === "function") updateProgress(totalProgress);

                if (iteration < engineConfig.iterations) {
                    setTimeout(processBatch, 0);
                } else {
                    // Aggregation durchführen und speichern
                    var aggregated = aggregateResults(allResults, engineConfig);
                    sim.results = aggregated;

                    // Nächste Sim anstoßen
                    currentSimIndex++;
                    setTimeout(processNextSim, 0);
                }
            } catch (e) {
                console.error(e);
                alert("Error in Sim '" + sim.name + "': " + e.message);
                hideProgress();
            }
        }

        // Text-Update für den Ladebildschirm
        var pt = document.getElementById("progressText");
        if (pt) pt.innerText = "Simulating: " + sim.name + "...";

        setTimeout(processBatch, 50);
    }

    processNextSim();
}

// ============================================================================
// HELPER: RESULT AGGREGATION & RNG
// ============================================================================

function aggregateResults(results, cfg) {
    if (!results || results.length === 0) return null;

    var n = results.length;
    var totalHeal = 0;
    var hpsDistribution = [];

    for (var i = 0; i < n; i++) {
        var r = results[i];
        var d = r.effectiveHeal;

        // HIER ÄNDERN: Wir teilen jetzt durch die TATSÄCHLICHE Dauer (r.duration) statt durch cfg.maxTime
        var runDuration = r.duration > 0 ? r.duration : 1;
        var currentHPS = d / runDuration;

        hpsDistribution.push(currentHPS);
        totalHeal += d;
    }

    var sortedResults = results.slice().sort(function (a, b) {
        return a.effectiveHeal - b.effectiveHeal;
    });

    var idxP5 = Math.floor(n * 0.05);
    var idxMedian = Math.floor(n * 0.50);
    var idxP95 = Math.floor(n * 0.95);

    if (idxP5 >= n) idxP5 = n - 1;
    if (idxMedian >= n) idxMedian = n - 1;
    if (idxP95 >= n) idxP95 = n - 1;

    var p5Run = sortedResults[idxP5];
    var medianRun = sortedResults[idxMedian];
    var p95Run = sortedResults[idxP95];

    return {
        median: { stats: medianRun.stats, hps: medianRun.effectiveHeal / medianRun.duration, log: medianRun.log, duration: medianRun.duration },
        p5: { stats: p5Run.stats, hps: p5Run.effectiveHeal / p5Run.duration, log: p5Run.log, duration: p5Run.duration },
        p95: { stats: p95Run.stats, hps: p95Run.effectiveHeal / p95Run.duration, log: p95Run.log, duration: p95Run.duration },
        seed: { stats: results[0].stats, hps: results[0].effectiveHeal / results[0].duration, log: results[0].log, duration: results[0].duration },
        hpsDistribution: hpsDistribution
    };
}


// ============================================================================
// MATH CORE (SINGLE TARGET SIMULATION)
// ============================================================================

function runSingleTargetSimulation(cfg) {
    var rngHandler = new RNGHandler(cfg.seed);
    var RNG = {
        check: function (chance) { return rngHandler.check(chance); },
        rand: function () { return rngHandler.rand(); }
    };

    // --- NEU: ZENTRALE STAT-BERECHNUNG ---
    var getCurrentStats = function (time) {
        var currentHP = cfg.stats.hp;
        var currentMP5 = cfg.stats.mp5;
        var currentHaste = cfg.stats.hasteFactor;
        var currentCrit = cfg.stats.crit;
        var currentSpirit = cfg.stats.spirit;

        // Heal Power Buffs
        if (time < State.eyeOfDeadEnd && State.eyeOfDeadStacks > 0) currentHP += 450;
        if (time < State.toepEnd) currentHP += 175;
        if (time < State.draconicEnd) currentHP += 190;
        if (time < State.hibernationEnd) currentHP += 350;
        if (time < State.zhcEnd) currentHP += State.zhcBonus;
        if (time < State.ascendanceEnd && State.ascendanceStacks > 0) currentHP += (State.ascendanceStacks * 75);

        // MP5 Buffs
        if (time < State.alartarEnd) currentMP5 += 80;

        // Haste Buffs
        if (time < State.jujuEnd) currentHaste *= 1.03;
        if (time < State.potQuickEnd) currentHaste *= 1.05;
        if (time < State.solniusEnd) currentHaste *= 1.20;
        if (time < State.shardDreamsEnd && State.shardDreamsStacks > 0) currentHaste *= (1.0 + (0.05 * State.shardDreamsStacks));

        return {
            hp: currentHP,
            mp5: currentMP5,
            haste: currentHaste,
            crit: currentCrit,
            spirit: currentSpirit
        };
    };

    var State = {
        t: 0.0, gcdEnd: 0.0, castEnd: 0.0, casting: false, currentSpellId: null,
        mana: cfg.stats.maxMana, lastMana: cfg.stats.maxMana,
        fsrEnd: 0.0, nextRegenTick: 2.0, tankHp: cfg.tank.maxHp, nextTankAttack: cfg.tank.speed,
        activeHoTs: {}, pendingImpacts: [],
        innervateEnd: 0.0, innervateCdReady: 0.0,
        nsReadyTime: 0.0, potCdReady: 0.0, runeCdReady: 0.0, ng: false,
        swiftmendCdReady: 0.0, nsActive: false, nsCdReady: 0.0,
        hotCounter: 0,
        jujuCdReady: 0.0, jujuEnd: 0.0,
        potQuickEnd: 0.0,
        t1Cd: 0.0, t2Cd: 0.0,
        eyeOfDeadEnd: 0.0, eyeOfDeadStacks: 0,
        shardDreamsBuffEnd: 0.0, shardDreamsEnd: 0.0, shardDreamsStacks: 0,
        secondWindEnd: 0.0, burstKnowledgeEnd: 0.0,
        ascendanceEnd: 0.0, ascendanceStacks: 0, ascendanceCastCount: 0,
        toepEnd: 0.0, draconicEnd: 0.0,
        zhcEnd: 0.0, zhcBonus: 0,
        hibernationEnd: 0.0, wushoolayEnd: 0.0, scarabBroochEnd: 0.0,
        blueDragonEnd: 0.0, alartarEnd: 0.0, solniusEnd: 0.0, wisdomDeerEnd: 0.0,
        talonBuffer: 0
    };

    var RunLog = [];
    var RunStats = { totalHeal: 0, effectiveHeal: 0, totalManaSpent: 0, casts: 0, crits: 0, tankDeaths: 0, stepCounts: {}, spellStats: {}, procStats: {} };

    var recordItemAction = function (name, amount) {
        if (!RunStats.procStats[name]) RunStats.procStats[name] = { count: 0, amount: 0 };
        RunStats.procStats[name].count++;
        if (amount) RunStats.procStats[name].amount += amount;
    };

    var log = function (time, evt, spell, healNorm, healOver, crit, info) {
        var fsrActive = (State.t < State.fsrEnd) ? "YES" : "NO";
        var rejuv = State.activeHoTs["Rejuvenation"];
        var rejuvRem = (rejuv && rejuv.exp > time) ? (rejuv.exp - time).toFixed(1) : "-";
        var regrowth = State.activeHoTs["Regrowth"];
        var rgRem = (regrowth && regrowth.exp > time) ? (regrowth.exp - time).toFixed(1) : "-";

        var currentMana = State.mana;
        var manaDelta = currentMana - State.lastMana;
        State.lastMana = currentMana;

        var stats = getCurrentStats(time);
        var hastePct = ((stats.haste - 1.0) * 100).toFixed(1);

        RunLog.push({
            t: time.toFixed(2), evt: evt, spell: spell,
            healNorm: healNorm ? Math.floor(healNorm) : 0, healOver: healOver ? Math.floor(healOver) : 0,
            crit: crit ? "YES" : "", mana: Math.floor(currentMana),
            manaDelta: Math.floor(manaDelta), fsr: fsrActive, rejuvRem: rejuvRem, rgRem: rgRem,
            info: info || "", tankHp: Math.floor(State.tankHp),
            ng: State.ng ? "Activ" : "",
            ns: State.nsActive ? "Activ" : "",
            // NEU: Diese Werte übergeben wir jetzt an die Log-Tabelle
            hp: Math.floor(stats.hp),
            mp5: Math.floor(stats.mp5),
            haste: hastePct
        });
    };

    var addEvt = function (time, type, data) {
        State.pendingImpacts.push({ t: time, type: type, data: data });
        // Absteigend sortieren, damit das Event mit der KLEINSTEN Zeit ganz am ENDE des Arrays liegt
        State.pendingImpacts.sort(function (a, b) { return b.t - a.t; }); 
    };

    var getSpellData = function (skillId, rank) {
        var baseSpell = SPELL_DB[skillId];
        if (!baseSpell) return null;
        var r = rank || baseSpell.maxRank;
        var rankData = baseSpell.ranks ? baseSpell.ranks[r] : baseSpell;
        if (!rankData && baseSpell.ranks) { // NEU: Fallback, falls der angegebene Rang nicht existiert
            var keys = Object.keys(baseSpell.ranks);
            r = keys[keys.length - 1]; 
            rankData = baseSpell.ranks[r];
        }
        return { base: baseSpell, rank: rankData, rNum: r || "" }; // NEU: Leerer String statt undefined
    };

    var getCastTime = function (spellDef) {
        var base = spellDef.rank.cast !== undefined ? spellDef.rank.cast : 1.5;
        if (base === 0) return 0;

        if (spellDef.base.name === "Regrowth"){
            console.log("Regrowth Cast Time: " + base + "s");
        }

        // KORREKTUR: .base.name statt .base.id verwenden
        if (State.nsActive && (spellDef.base.name === "Healing Touch" || spellDef.base.name === "Regrowth")) return 0;
        if (State.ng && (spellDef.base.name === "Healing Touch" || spellDef.base.name === "Regrowth")) {
             base -= 0.5; 
             State.ng = false; 
        }

        if (spellDef.base.name === "Healing Touch") {
            base -= (cfg.talents.impHealingTouch * 0.1);
            if (cfg.specials.idolHealth) base -= 0.15;
            if (cfg.specials.genesis3) base -= 0.3;
            if (State.t < State.wushoolayEnd) base *= 0.60;
        }

        if (spellDef.base.name === "Regrowth"){
            console.log("Regrowth Cast Time: " + base + "s");
        }

        if (spellDef.base.name === "Regrowth" && cfg.specials.stormrage5){
            base -= 0.2;  
        } 
        if (base < 0) base = 0;

        if (spellDef.base.name === "Regrowth"){
            console.log("Regrowth Cast Time: " + base + "s");
        }

        var totalHaste = getCurrentStats(State.t).haste;
        return Math.max(0, base / totalHaste);
    };

    var getManaCost = function (spellDef) {
        var cost = spellDef.rank.mana || 0;
        var reduction = 0;

        // KORREKTUR: .base.name statt .base.id verwenden
        if (spellDef.base.name === "Healing Touch" || spellDef.base.name === "Regrowth" || spellDef.base.name === "Tranquility") reduction += (cfg.talents.tranquilSpirit * 0.02);
        if (spellDef.base.name === "Healing Touch" || spellDef.base.name === "Regrowth" || spellDef.base.name === "Rejuvenation") reduction += (cfg.talents.moonglow * 0.03);

        cost = cost * (1.0 - reduction);
        if (cfg.specials.dreamwalker4) cost *= 0.97;
        if (State.t < State.wushoolayEnd) cost *= 0.95;
        if (State.t < State.burstKnowledgeEnd) cost = Math.max(0, cost - 100);
        return Math.floor(cost);
    };

    var applyHeal = function (spellName, amount, isCrit, isHoT) {
        var multiplier = 1.0 + (cfg.talents.giftOfNature * 0.02);
        if (isHoT) multiplier += (cfg.talents.genesis * 0.05);

        if (cfg.specials.genesis5 && spellName === "Healing Touch" && (State.activeHoTs["Rejuvenation"] || State.activeHoTs["Regrowth"])) {
            multiplier += 0.10;
        }
        var finalAmount = amount * multiplier;

        if (!isHoT && cfg.specials.rodOfResuscitation && (State.tankHp / cfg.tank.maxHp) < 0.50) {
            finalAmount += (80 + RNG.rand() * 20);
        }

        if (isCrit) {
            finalAmount += (finalAmount * 0.5);
            RunStats.crits++; State.ng = true;
        }
        if (State.t < State.scarabBroochEnd) finalAmount += (finalAmount * 0.15); // Adds Shield as effective heal

        var deficit = cfg.tank.maxHp - State.tankHp;
        var effective = Math.min(finalAmount, deficit);
        var overheal = finalAmount - effective;
        State.tankHp += effective; RunStats.totalHeal += finalAmount; RunStats.effectiveHeal += effective;

        if (!RunStats.spellStats[spellName]) RunStats.spellStats[spellName] = { eff: 0, over: 0, count: 0, crits: 0 }; // NEU: crits: 0
        RunStats.spellStats[spellName].eff += effective; RunStats.spellStats[spellName].over += overheal;
        if (!isHoT) {
            RunStats.spellStats[spellName].count++;
            if (isCrit) RunStats.spellStats[spellName].crits++; // NEU: Zähle Crits pro Cast
        }

        return { eff: effective, over: overheal, total: finalAmount };
    };

    // --- ANGEPASST: OOM Check ignoriert nun Utility-Skills wie Swiftmend ---
    var checkOOM = function () {
        if (cfg.simMode !== "oom") return false;

        for (var hotId in State.activeHoTs) {
            if (State.activeHoTs[hotId] && State.activeHoTs[hotId].exp > State.t) return false;
        }

        var canCastHeal = false;
        var hasManaCDReady = false;

        if (cfg.custom_rotation && cfg.custom_rotation.steps) {
            for (var i = 0; i < cfg.custom_rotation.steps.length; i++) {
                var step = cfg.custom_rotation.steps[i];
                if (step.disabled) continue;

                if (step.skill === "MajorManaPotion") {
                    if (State.t >= State.potCdReady) hasManaCDReady = true;
                } else if (step.skill === "DemonicRune") {
                    if (State.t >= State.runeCdReady) hasManaCDReady = true;
                } else if (step.skill === "Innervate") {
                    if (State.t >= State.innervateCdReady) hasManaCDReady = true;
                } else if (step.skill === "Swiftmend" || step.skill === "NaturesSwiftness" || step.skill === "PotionOfQuickness" || step.skill === "JujuFlurry") {
                    // Utility Skills ohne aktive Manakosten überspringen wir beim OOM Check
                    continue;
                } else {
                    var sDef = getSpellData(step.skill, step.rank);
                    if (sDef) {
                        var cost = getManaCost(sDef);
                        if (State.mana >= cost) canCastHeal = true;
                    }
                }
            }
        }
        return !(canCastHeal || hasManaCDReady);
    };

    var evaluateOp = function (left, op, right) {
        if (op === '>') return left > right; if (op === '<') return left < right;
        if (op === '>=') return left >= right; if (op === '<=') return left <= right;
        if (op === '==') return left == right; return false;
    };

    var checkCondition = function (step) {
        if (!step.conditions || step.conditions.length === 0) return true;
        for (var i = 0; i < step.conditions.length; i++) {
            var c = step.conditions[i];
            var left = 0; var right = parseFloat(c.val) || 0; var isValid = false;
            switch (c.type) {
                case 'target_hp_pct': left = (State.tankHp / cfg.tank.maxHp) * 100; isValid = evaluateOp(left, c.op, right); break;
                case 'target_hp_deficit': left = cfg.tank.maxHp - State.tankHp; isValid = evaluateOp(left, c.op, right); break;
                case 'mana_pct': left = (State.mana / cfg.stats.maxMana) * 100; isValid = evaluateOp(left, c.op, right); break;
                case 'mana_abs': left = State.mana; isValid = evaluateOp(left, c.op, right); break;
                case 'mana_deficit': left = cfg.stats.maxMana - State.mana; isValid = evaluateOp(left, c.op, right); break;
                case 'hot_active': isValid = State.activeHoTs[c.target] && State.activeHoTs[c.target].exp > State.t; break;
                case 'hot_missing': isValid = !State.activeHoTs[c.target] || State.activeHoTs[c.target].exp <= State.t; break;
                case 'hot_rem': left = (State.activeHoTs[c.target] && State.activeHoTs[c.target].exp > State.t) ? State.activeHoTs[c.target].exp - State.t : 0; isValid = evaluateOp(left, c.op, right); break;
                case 'ns_ready': isValid = (State.t >= State.nsReadyTime) === (c.bool === "true"); break;
                default: isValid = true;
            }
            if (!isValid) return false;
        }
        return true;
    };

    var decideSpell = function () {
        if (!cfg.custom_rotation || !cfg.custom_rotation.steps) return null;
        for (var i = 0; i < cfg.custom_rotation.steps.length; i++) {
            var step = cfg.custom_rotation.steps[i];

            // 1. Hilfsfunktion für Trinkets
            var checkTrinket = function (slot, tName, cdVar) {
                if (!tName || State.t < State[cdVar]) return false;
                var used = false;
                var val = 0;

                if (tName.includes("Eye of the Dead")) { State.eyeOfDeadEnd = State.t + 30; State.eyeOfDeadStacks = 5; State[cdVar] = State.t + 120; used = true; }
                else if (tName.includes("Warmth of Forgiveness")) { val = 700; State.mana = Math.min(cfg.stats.maxMana, State.mana + val); State[cdVar] = State.t + 180; used = true; }
                else if (tName.includes("Shard of the Dreams")) { State.shardDreamsBuffEnd = State.t + 12; State.shardDreamsStacks = 0; State[cdVar] = State.t + 180; used = true; }
                else if (tName.includes("Second Wind")) { val = 300; State.secondWindEnd = State.t + 10; State[cdVar] = State.t + 300; for (var s = 1; s <= 10; s++) addEvt(State.t + s, "SECOND_WIND", {}); used = true; }
                else if (tName.includes("Burst of Knowledge")) { State.burstKnowledgeEnd = State.t + 10; State[cdVar] = State.t + 300; used = true; }
                else if (tName.includes("Talisman of Ascendance")) { State.ascendanceEnd = State.t + 20; State.ascendanceStacks = 1; State.ascendanceCastCount = 1; State[cdVar] = State.t + 60; used = true; }
                else if (tName.includes("Ephemeral Power")) { State.toepEnd = State.t + 15; State[cdVar] = State.t + 90; used = true; }
                else if (tName.includes("Draconic Infused Emblem")) { State.draconicEnd = State.t + 15; State[cdVar] = State.t + 75; used = true; }
                else if (tName.includes("Zandalarian Hero Charm")) { State.zhcEnd = State.t + 20; State.zhcBonus = 408; State[cdVar] = State.t + 120; used = true; }
                else if (tName.includes("Hibernation Crystal")) { State.hibernationEnd = State.t + 15; State[cdVar] = State.t + 90; used = true; }
                else if (tName.includes("Wushoolay")) { State.wushoolayEnd = State.t + 15; State[cdVar] = State.t + 180; used = true; }
                else if (tName.includes("Scarab Brooch")) { State.scarabBroochEnd = State.t + 30; State[cdVar] = State.t + 180; used = true; }

                if (used) {
                    log(State.t, "USE", slot + " (" + tName + ")", 0, 0, false, "Activated");
                    recordItemAction(tName + " (Use)", val);
                }
                return used;
            }

            // 3. Talente überprüfen
            if (step.skill === "Swiftmend" && (!cfg.talents || !cfg.talents.swiftmend)) continue;
            if (step.skill === "NaturesSwiftness" && (!cfg.talents || !cfg.talents.natureSwiftness)) continue;

            // 4. Eigene Konditionen aus dem Rotations-Builder (HP, Mana) abfragen
            if (step.disabled || !checkCondition(step)) continue;

            // 4b. Aktive Trinkets abfragen & mitzählen (NACH den Konditionen!)
            if (step.skill === "Trinket1") {
                if (checkTrinket("Trinket 1", cfg.trinket1, "t1Cd")) RunStats.stepCounts[step.id] = (RunStats.stepCounts[step.id] || 0) + 1;
                continue;
            }
            if (step.skill === "Trinket2") {
                if (checkTrinket("Trinket 2", cfg.trinket2, "t2Cd")) RunStats.stepCounts[step.id] = (RunStats.stepCounts[step.id] || 0) + 1;
                continue;
            }

            // 5. Utility & Consumables abfragen & mitzählen
            if (step.skill === "NaturesSwiftness") {
                if (State.t >= State.nsCdReady) {
                    State.nsActive = true; State.nsCdReady = State.t + 180.0;
                    log(State.t, "USE", "Nature's Swiftness", 0, 0, false, "Next Nature spell instant");
                    RunStats.stepCounts[step.id] = (RunStats.stepCounts[step.id] || 0) + 1;
                }
                continue;
            }
            if (step.skill === "PotionOfQuickness") {
                if (State.t >= State.potCdReady) {
                    State.potQuickEnd = State.t + 30.0; State.potCdReady = State.t + 120.0;
                    log(State.t, "USE", "Potion of Quickness", 0, 0, false, "5% Haste for 30s"); recordItemAction("Potion of Quickness", 0);
                    RunStats.stepCounts[step.id] = (RunStats.stepCounts[step.id] || 0) + 1;
                }
                continue;
            }
            if (step.skill === "JujuFlurry") {
                if (State.t >= State.jujuCdReady) {
                    State.jujuEnd = State.t + 20.0; State.jujuCdReady = State.t + 60.0;
                    log(State.t, "USE", "Juju Flurry", 0, 0, false, "3% Haste for 20s"); recordItemAction("Juju Flurry", 0);
                    RunStats.stepCounts[step.id] = (RunStats.stepCounts[step.id] || 0) + 1;
                }
                continue;
            }
            if (step.skill === "MajorManaPotion") {
                if (State.t >= State.potCdReady) {
                    var restore = Math.floor(1350 + RNG.rand() * 901); State.mana = Math.min(cfg.stats.maxMana, State.mana + restore); State.potCdReady = State.t + 120.0;
                    log(State.t, "USE", "Major Mana Potion", 0, 0, false, "Restored Mana"); recordItemAction("Major Mana Potion", restore);
                    RunStats.stepCounts[step.id] = (RunStats.stepCounts[step.id] || 0) + 1;
                }
                continue;
            }
            if (step.skill === "DemonicRune") {
                if (State.t >= State.runeCdReady) {
                    var restore = Math.floor(900 + RNG.rand() * 601); State.mana = Math.min(cfg.stats.maxMana, State.mana + restore); State.runeCdReady = State.t + 120.0;
                    log(State.t, "USE", "Demonic Rune", 0, 0, false, "Restored Mana"); recordItemAction("Demonic Rune", restore);
                    RunStats.stepCounts[step.id] = (RunStats.stepCounts[step.id] || 0) + 1;
                }
                continue;
            }

            // 6. Abfragen, ob Skills in diesem Moment logisch Sinn machen
            if (step.skill === "Swiftmend") {
                if (State.t < State.swiftmendCdReady) continue;
                var hasRejuv = State.activeHoTs["Rejuvenation"] && State.activeHoTs["Rejuvenation"].exp > State.t;
                var hasRegrowth = State.activeHoTs["Regrowth"] && State.activeHoTs["Regrowth"].exp > State.t;
                if (!hasRejuv && !hasRegrowth) continue;
            }
            if (step.skill === "Innervate") { if (State.t < State.innervateCdReady) continue; }

            // 7. Echte Zauber (wie HT, Rejuv) aus der Datenbank holen
            var spellData = getSpellData(step.skill, step.rank);
            if (!spellData) continue;

            var cost = getManaCost(spellData);
            if (State.mana < cost) continue;

            // 8. ID ZUWEISEN: Extrem wichtig, damit die Benutzeroberfläche weiß, welcher Block gerendert wird!
            spellData.stepId = step.id;
            return spellData;
        }
        return null;
    };

    var performCast = function (sDef) {
        var ct = getCastTime(sDef);
        var cost = getManaCost(sDef);

        State.casting = true;
        State.castEnd = State.t + ct;
        State.gcdEnd = State.t + 1.5;

        // NEU: Nur noch einen Rang dranhängen, wenn auch wirklich einer existiert
        var nameStr = sDef.base.name;
        if (sDef.rNum && sDef.rNum !== "") nameStr += " (R" + sDef.rNum + ")";
        
        var castStr = ct > 0 ? ct.toFixed(2) + "s" : "Instant";
        log(State.t, "CAST_START", nameStr, 0, 0, false, castStr);

        if (sDef.stepId) RunStats.stepCounts[sDef.stepId] = (RunStats.stepCounts[sDef.stepId] || 0) + 1;
        RunStats.casts++;

        addEvt(State.castEnd, "CAST_FINISH", { spell: sDef, cost: cost });
    };

    var loopGuard = 0;
    while (State.t < cfg.maxTime && loopGuard < 50000) {
        loopGuard++;

        if (checkOOM()) {
            log(State.t, "OOM", "Out of Mana", 0, 0, false, "Simulation stopped");
            break;
        }

        // Wir prüfen das letzte Element im Array (length - 1)
        while (State.pendingImpacts.length > 0 && State.pendingImpacts[State.pendingImpacts.length - 1].t <= State.t + 0.001) {
            // .pop() ist O(1) und entfernt extrem schnell das letzte Element
            var evt = State.pendingImpacts.pop();

            if (evt.type === "CAST_FINISH") {
                State.casting = false;
                State.fsrEnd = State.t + 5.0;
                var sDef = evt.data.spell;
                var sName = sDef.base.name;
                var cost = evt.data.cost || 0;
                var cStats = getCurrentStats(State.t); // <--- Wir holen 1x die exakten Stats für DIESEN Cast

                State.mana -= cost;
                RunStats.totalManaSpent += cost;

                if (State.nsActive && (sName === "Healing Touch" || sName === "Regrowth")) {
                    State.nsActive = false;
                    log(State.t, "CONSUME", "Nature's Swiftness", 0, 0, false, "Consumed by " + sName);
                }

                var isHealingSpell = (sName === "Healing Touch" || sName === "Regrowth" || sName === "Rejuvenation" || sName === "Swiftmend");

                if (sName === "Healing Touch") {
                    if (cfg.specials.idolLongevity) { State.mana = Math.min(cfg.stats.maxMana, State.mana + 25); recordItemAction("Idol of Longevity", 25); }
                    var baseHeal = sDef.rank.min + RNG.rand() * (sDef.rank.max - sDef.rank.min);
                    var isCrit = RNG.check(cStats.crit); // Nutzt cStats.crit
                    if (cfg.specials.dreamwalker8 && isCrit) { var dwMana = cost * 0.3; State.mana = Math.min(cfg.stats.maxMana, State.mana + dwMana); recordItemAction("Dreamwalker (8/9)", dwMana); }
                    
                    var res = applyHeal(sName, baseHeal + (sDef.rank.coeff * cStats.hp), isCrit, false);
                    log(State.t, "HEAL", sName, res.eff, res.over, isCrit, "Direct Heal");
                }
                else if (sName === "Rejuvenation" || sName === "Regrowth") {
                    State.hotCounter++;
                    if (sName === "Rejuvenation") {
                        if (!RunStats.spellStats[sName]) RunStats.spellStats[sName] = { eff: 0, over: 0, count: 0, crits: 0 };
                        RunStats.spellStats[sName].count++;
                    }
                    
                    // --- HOT SNAPSHOTTING MIT cStats.hp ---
                    var totalHot = sDef.rank.hot + ((sName === "Regrowth" ? sDef.rank.coeffHot : sDef.rank.coeff) * cStats.hp);
                    if (sName === "Rejuvenation" && cfg.specials.idolRejuv) totalHot += 50;

                    var ticks = sName === "Rejuvenation" ? 6 : 10;
                    var dur = sName === "Rejuvenation" ? 12.0 : 20.0;

                    if (sName === "Rejuvenation" && cfg.specials.stormrage8) { dur += 3.0; ticks += 1; }
                    var tickAmnt = totalHot / (sName === "Rejuvenation" ? 6 : 10);

                    if (cfg.specials.beacon) {
                        dur -= 2.0; ticks -= 1;
                        var r = applyHeal(sName + " (Beacon)", tickAmnt * 0.75, false, true);
                        log(State.t, "HEAL", sName, r.eff, r.over, false, "Instant Beacon");
                    }

                    if (sName === "Regrowth") {
                        var baseHeal = sDef.rank.min + RNG.rand() * (sDef.rank.max - sDef.rank.min);
                        var isCrit = RNG.check(cStats.crit + (cfg.talents.impRegrowth * 10.0));
                        var r2 = applyHeal(sName, baseHeal + (sDef.rank.coeffDir * cStats.hp), isCrit, false);
                        log(State.t, "HEAL", sName, r2.eff, r2.over, isCrit, "Direct Heal");
                    }

                    State.activeHoTs[sName] = { exp: State.t + dur, tickHeal: tickAmnt, name: sName, instanceId: State.hotCounter };
                    log(State.t, "APPLY", sName, 0, 0, false, "HoT Applied");
                    for (var p = 1; p <= ticks; p++) addEvt(State.t + (p * 2.0), "HOT_TICK", { id: sName, instanceId: State.hotCounter });
                }
                else if (sName === "Swiftmend") {
                    var healAmount = 0;
                    if (State.activeHoTs["Rejuvenation"] && State.activeHoTs["Rejuvenation"].exp > State.t) {
                        healAmount = State.activeHoTs["Rejuvenation"].tickHeal * 6; State.activeHoTs["Rejuvenation"] = null;
                        log(State.t, "CONSUME", "Rejuvenation", 0, 0, false, "Consumed by Swiftmend");
                    } else if (State.activeHoTs["Regrowth"] && State.activeHoTs["Regrowth"].exp > State.t) {
                        healAmount = State.activeHoTs["Regrowth"].tickHeal * 10; State.activeHoTs["Regrowth"] = null; 
                        log(State.t, "CONSUME", "Regrowth", 0, 0, false, "Consumed by Swiftmend");
                    }
                    if (healAmount > 0) {
                        var isCrit = RNG.check(cStats.crit);
                        var finalAmount = isCrit ? healAmount * 1.5 : healAmount;
                        if (isCrit) { RunStats.crits++; State.ng = true; }

                        var deficit = cfg.tank.maxHp - State.tankHp;
                        var effective = Math.min(finalAmount, deficit);
                        var overheal = finalAmount - effective;
                        State.tankHp += effective; RunStats.totalHeal += finalAmount; RunStats.effectiveHeal += effective;

                        if (!RunStats.spellStats["Swiftmend"]) RunStats.spellStats["Swiftmend"] = { eff: 0, over: 0, count: 0, crits: 0 };
                        RunStats.spellStats["Swiftmend"].eff += effective; RunStats.spellStats["Swiftmend"].over += overheal; RunStats.spellStats["Swiftmend"].count++;
                        if (isCrit) RunStats.spellStats["Swiftmend"].crits++; 
                        log(State.t, "HEAL", sName, effective, overheal, isCrit, "Direct Heal");
                    }
                    State.swiftmendCdReady = State.t + (cfg.specials.talon3 ? 14.7 : 15.0);
                    if (cfg.specials.talon5) State.talonBuffer = 5;
                }
                else if (sName === "Innervate") {
                    State.innervateEnd = State.t + 20.0; State.innervateCdReady = State.t + 360.0;
                    log(State.t, "BUFF", "Innervate", 0, 0, false, "400% Regen for 20s");
                }

                // --- NEU: ZENTRALER STACK-ABZUG (NACH dem Zauber) ---
                if (isHealingSpell) {
                    if (State.t < State.eyeOfDeadEnd && State.eyeOfDeadStacks > 0) {
                        State.eyeOfDeadStacks--;
                    }
                    if (State.t < State.zhcEnd && State.zhcBonus > 0) {
                        State.zhcBonus = Math.max(0, State.zhcBonus - 34);
                    }
                    if (State.t < State.ascendanceEnd && State.ascendanceStacks > 0) {
                        State.ascendanceCastCount++;
                        if (State.ascendanceCastCount <= 5) State.ascendanceStacks++;
                        if (State.ascendanceCastCount >= 6) { State.ascendanceEnd = 0; State.ascendanceStacks = 0; }
                    }
                }


                // Global Procs on Cast
                if (cfg.specials.blueDragon && RNG.check(2.0)) {
                    State.blueDragonEnd = State.t + 15.0; log(State.t, "PROC", "Blue Dragon", 0, 0, false, "100% Regen");
                    recordItemAction("Blue Dragon (Proc)", 0);
                }
                if (cfg.specials.manaBinding && RNG.check(2.0)) {
                    var mVal = 75 + RNG.rand() * 10; State.mana = Math.min(cfg.stats.maxMana, State.mana + mVal); log(State.t, "PROC", "Mana Binding", 0, 0, false, "Mana Restored");
                    recordItemAction("Mana Binding (Proc)", mVal);
                }
                if (cfg.specials.alartar && RNG.check(8.0)) {
                    State.alartarEnd = State.t + 20.0; log(State.t, "PROC", "Alar'tar", 0, 0, false, "80 MP5");
                    recordItemAction("Alar'tar, Born from Hope (Proc)", 0);
                }
                if (cfg.specials.breathOfSolnius && RNG.check(5.0)) {
                    State.solniusEnd = State.t + 20.0; log(State.t, "PROC", "Breath of Solnius", 0, 0, false, "20% Haste");
                    recordItemAction("Breath of Solnius (Proc)", 0);
                }
                if (cfg.specials.wisdomDeer3 && RNG.check(8.0)) {
                    State.wisdomDeerEnd = State.t + 15.0; log(State.t, "PROC", "Wisdom of the Deer", 0, 0, false, "20% Regen");
                    recordItemAction("Wisdom of the Deer (Proc)", 0);
                }

                if (State.t < State.shardDreamsBuffEnd) { State.shardDreamsStacks = Math.min(6, State.shardDreamsStacks + 1); State.shardDreamsEnd = State.t + 6.0; }

                if (cfg.specials.loopOfInfused && RNG.check(10.0)) {
                    State.hotCounter++;
                    var loopHealTotal = 388 + (0.8 * cfg.stats.hp);
                    State.activeHoTs["LoopRejuv"] = { exp: State.t + 12.0, tickHeal: loopHealTotal / 6, name: "Rejuvenation (Loop)", instanceId: State.hotCounter };
                    for (var i = 1; i <= 6; i++) addEvt(State.t + (i * 2.0), "HOT_TICK", { id: "LoopRejuv", instanceId: State.hotCounter });
                    log(State.t, "PROC", "Loop of Infused", 0, 0, false, "Free Rejuv");
                    recordItemAction("Loop of Infused (Proc)", loopHealTotal);
                }
            }
            else if (evt.type === "HOT_TICK") {
                var hot = State.activeHoTs[evt.data.id];
                // NEU: Nur Ticks heilen, die zur exakt aktuellen Instanz (instanceId) gehören
                if (hot && hot.instanceId === evt.data.instanceId && hot.exp >= State.t - 0.001) {
                    var res = applyHeal(hot.name, hot.tickHeal, false, true);
                    log(State.t, "TICK", hot.name, res.eff, res.over, false, "HoT Tick");
                }
            }
            else if (evt.type === "SECOND_WIND") {
                State.mana = Math.min(cfg.stats.maxMana, State.mana + 30);
                log(State.t, "REGEN", "Second Wind", 0, 0, false, "+30 Mana");
            }
        }

        var nextTick = State.nextRegenTick;
        var nextAttack = State.nextTankAttack;
        var playerReady = (State.gcdEnd > State.castEnd) ? State.gcdEnd : State.castEnd;
        var nextAct = State.casting ? 99999 : (State.t < playerReady ? playerReady : State.t);
        //var nextEvt = (State.pendingImpacts.length > 0) ? State.pendingImpacts[0].t : 99999;
        // Das nächste Event liegt nun am Ende des Arrays
        var nextEvt = (State.pendingImpacts.length > 0) ? State.pendingImpacts[State.pendingImpacts.length - 1].t : 99999;

        var jump = Math.min(nextTick, nextAttack, nextAct, nextEvt);
        if (jump > cfg.maxTime) jump = cfg.maxTime;
        if (jump <= State.t) jump = State.t + 0.1;

        State.t = jump;

        // --- ANGEPASST: Tank HP Reset auf 75% ---
        if (State.t >= State.nextTankAttack - 0.001) {
            State.tankHp -= cfg.tank.dmg;
            State.nextTankAttack += cfg.tank.speed;

            if (State.tankHp <= 0) {
                RunStats.tankDeaths++; State.tankHp = cfg.tank.maxHp * 0.75;
            } else if (State.talonBuffer > 0) {
                State.tankHp += 240; State.talonBuffer--;
                RunStats.totalHeal += 240; RunStats.effectiveHeal += 240;
                log(State.t, "HEAL", "Talon Empower", 240, 0, false, "Buffer left: " + State.talonBuffer);
                recordItemAction("Talon (5/6) Shield", 240);
            }
        }

        if (State.t >= State.nextRegenTick - 0.001) {
            var cStats = getCurrentStats(State.t);
            var regen = (cStats.mp5 * 2) / 5;
            var spiritRegen = (cStats.spirit / 5) + 15;
            var castRegenPct = cfg.talents.reflection * 0.05;

            if (cfg.specials.staffDreamer) castRegenPct += 0.05;
            if (cfg.specials.beacon) castRegenPct += 0.06;
            if (cfg.specials.vanguardRing) castRegenPct += 0.05;
            if (cfg.specials.deepSapphire) castRegenPct += 0.05;
            if (cfg.specials.shardOfDreams) castRegenPct += 0.10;
            if (cfg.specials.vanguardBrooch) castRegenPct += 0.10;
            if (cfg.specials.remainsOfLost) castRegenPct += 0.05;
            if (cfg.specials.feyDreamcatcher) castRegenPct += 0.03;
            if (cfg.specials.stormrage3) castRegenPct += 0.15;
            if (State.t < State.wisdomDeerEnd) castRegenPct += 0.20;
            if (State.t < State.shardDreamsEnd && State.shardDreamsStacks > 0) castRegenPct += (0.20 * State.shardDreamsStacks);

            var isInnervate = (State.t < State.innervateEnd);

            // Neue, saubere Multiplikator-Logik
            if (isInnervate) {
                spiritRegen *= 4.0;
            } else if (State.t < State.blueDragonEnd) {
                spiritRegen *= 1.0; // 100% Regen während Blue Dragon 
            } else if (State.t < State.fsrEnd) {
                spiritRegen *= castRegenPct;
            }

            regen += spiritRegen;

            if (regen > 0 && State.mana < cfg.stats.maxMana) {
                var actualRegen = Math.min(regen, cfg.stats.maxMana - State.mana);
                State.mana += actualRegen;
                log(State.t, "REGEN", isInnervate ? "Innervate Tick" : "Mana Tick", 0, 0, false, "Regen");
            } else {
                State.mana = Math.min(cfg.stats.maxMana, State.mana + regen);
            }
            State.nextRegenTick += 2.0;
        }

        var gcdReady = State.t >= (State.gcdEnd - 0.001) && State.t >= (State.castEnd - 0.001);
        if (!State.casting && gcdReady && State.t < cfg.maxTime) {
            var decision = decideSpell();
            if (decision) performCast(decision);
        }
    }

    return {
        stats: RunStats,
        effectiveHeal: RunStats.effectiveHeal,
        log: RunLog,
        duration: State.t
    };
}
// Seeded PRNG (Mulberry32)
function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

function RNGHandler(seed) {
    if (seed !== undefined && seed !== null) {
        this.rand = mulberry32(seed);
    } else {
        this.rand = Math.random;
    }
}
RNGHandler.prototype.check = function (chance) {
    if (chance <= 0) return false;
    if (chance >= 100) return true;
    return (this.rand() * 100) < chance;
};

// ============================================================================
// STAT WEIGHTS (HPS GAIN & EQUIVALENCE POINTS)
// ============================================================================
function calculateWeights() {
    showProgress("Calculating Stat Weights...");

    var baseConfig = getInputs();

    // Iterationen erhöhen für glatte HPS-Kurven
    var iterations = Math.max(1000, baseConfig.iterations);
    baseConfig.iterations = iterations;
    var baseSeed = 1337;

    var scenarios = [
        { id: "base", label: "Base", mod: function (c) { }, norm: 1 },
        { id: "hp", label: "+50 Heal Power", mod: function (c) { c.stats.hp += 50; }, norm: 50 },
        { id: "spirit", label: "+50 Spirit", mod: function (c) { c.stats.spirit += 50; }, norm: 50 },
        { id: "mp5", label: "+20 MP5", mod: function (c) { c.stats.mp5 += 20; }, norm: 20 },
        {
            id: "int", label: "+50 Intellect", mod: function (c) {
                c.stats.int += 50;
                c.stats.maxMana += (50 * 15);
                c.stats.crit += (50 / 60);
            }, norm: 50
        },
        { id: "crit", label: "+5% Crit", mod: function (c) { c.stats.crit += 5; }, norm: 5 },
        { id: "haste", label: "+5% Haste", mod: function (c) { c.stats.hasteFactor *= 1.05; }, norm: 5 }
    ];

    // Wir tracken nun BEIDES: Effektive Heilung und Rohe Heilung (Total)
    var baseRunDataEff = [];
    var baseRunDataTot = [];
    var calculatedDeltas = {};
    var currentScenIdx = 0;
    var batchSize = 100;

    function runNextScenario() {
        if (currentScenIdx >= scenarios.length) {
            finalizeWeights();
            hideProgress();
            return;
        }

        var scen = scenarios[currentScenIdx];
        var pText = document.getElementById("progressText");
        if (pText) pText.innerText = "Calculating: " + scen.label + "...";

        var runCfg = JSON.parse(JSON.stringify(baseConfig));
        scen.mod(runCfg);

        var currentRunEff = [];
        var currentRunTot = [];
        var i = 0;

        function processScenarioBatch() {
            try {
                var target = Math.min(iterations, i + batchSize);
                for (; i < target; i++) {
                    var stepConfig = Object.assign({}, runCfg);
                    stepConfig.seed = baseSeed + i;

                    var res = runSingleTargetSimulation(stepConfig);
                    var eff = res.effectiveHeal;
                    var tot = res.stats.totalHeal; // Inklusive Overheal

                    if (scen.id === "base") {
                        baseRunDataEff.push(eff);
                        baseRunDataTot.push(tot);
                    } else {
                        currentRunEff.push(eff);
                        currentRunTot.push(tot);
                    }
                }

                if (typeof updateProgress === 'function') {
                    var totalProgress = ((currentScenIdx * iterations) + i) / (scenarios.length * iterations);
                    updateProgress(totalProgress * 100);
                }

                if (i < iterations) {
                    setTimeout(processScenarioBatch, 0);
                } else {
                    if (scen.id !== "base") {
                        calculateDeltaStats(scen.id, currentRunEff, currentRunTot);
                    }
                    currentScenIdx++;
                    setTimeout(runNextScenario, 0);
                }
            } catch (e) {
                console.error(e);
                alert("Error during weights: " + e.message);
                hideProgress();
            }
        }
        setTimeout(processScenarioBatch, 0);
    }

    function calculateDeltaStats(id, scenEff, scenTot) {
        var n = scenEff.length;
        var sumDiffEff = 0;
        var sumDiffTot = 0;
        for (var k = 0; k < n; k++) {
            sumDiffEff += (scenEff[k] - baseRunDataEff[k]);
            sumDiffTot += (scenTot[k] - baseRunDataTot[k]);
        }
        // Speichere die durchschnittlichen Deltas für beide Metriken
        calculatedDeltas[id] = { eff: sumDiffEff / n, tot: sumDiffTot / n };
    }

    function finalizeWeights() {
        var useRaw = false;
        var hpDelta = calculatedDeltas["hp"].eff;
        var hints = [];

        // Check if Effective Healing gained from +50 HP is basically non-existent
        if (hpDelta < 50) {
            useRaw = true;
            hpDelta = calculatedDeltas["hp"].tot;
        }

        var epValues = { spirit: 0, mp5: 0, int: 0, crit: 0, haste: 0 };

        // THE FIX: If even RAW healing doesn't increase by at least 50 over the whole fight,
        // it means the rotation broke (Druid is idling because the tank is constantly at 100% HP).
        // A denominator near zero causes astronomical stat weights (RNG noise).
        if (hpDelta < 50) {
            hints.push("🚨 <strong>Damage Too Low:</strong> Your extra Heal Power resulted in zero extra healing. This means your Druid is spending time idle because the tank is already topped off. When you don't need more healing, all Stat Weights are mathematically 0. Please increase the Encounter Damage!");

            // All EP values remain 0.
        } else {
            var valRef = hpDelta / 50;

            scenarios.forEach(function (s) {
                if (s.id !== "base") {
                    var delta = useRaw ? calculatedDeltas[s.id].tot : calculatedDeltas[s.id].eff;

                    // Clamp negative deltas to 0 (except Haste, which can genuinely cost HPS if it drains mana too fast)
                    if (delta < 0 && s.id !== "haste") delta = 0;

                    var gainPerStat = delta / s.norm;
                    epValues[s.id] = gainPerStat / valRef;
                }
            });

            // --- EXTREMES & HINTS (100% English) ---
            if (useRaw) {
                hints.push("💡 <strong>Throughput Cap:</strong> Your extra Heal Power resulted in almost zero effective healing (Overhealing). Stat weights for this run were calculated using <i>Raw Healing potential</i> instead.");
            }

            if (epValues["mp5"] <= 0.05 && baseConfig.simMode !== "oom") {
                hints.push("💡 <strong>Sustain Stats:</strong> MP5 and Spirit are valued at 0. You did not run out of mana in the simulated timeframe, making extra regeneration unnecessary.");
            }

            // Extreme: OOM too early inflates Sustain Stats
            if (epValues["mp5"] > 6.0) {
                hints.push("💡 <strong>Mana Starvation:</strong> Your MP5/Spirit weights are exceptionally high. You went Out of Mana very early in the fight. Consider downranking spells or increasing your base Mana pool.");
            }

            if (!useRaw && epValues["crit"] < 0.2) {
                hints.push("💡 <strong>Spell Crit:</strong> Crit is scaling poorly. The incoming damage is relatively low, causing your critical heals to mostly disappear into overhealing.");
            }

            // Extreme: Haste causing Mana Drain
            if (epValues["haste"] !== undefined && epValues["haste"] < 0) {
                hints.push("💡 <strong>Spell Haste:</strong> Haste yielded negative returns and was clamped to 0. Casting faster in this scenario only drained your mana quicker without increasing your overall output.");
            }
        }

        // Format for output
        var outSpirit = Math.max(0, epValues.spirit).toFixed(2);
        var outMp5 = Math.max(0, epValues.mp5).toFixed(2);
        var outInt = Math.max(0, epValues.int).toFixed(2);
        var outCrit = Math.max(0, epValues.crit).toFixed(2);
        var outHaste = Math.max(0, epValues.haste || 0).toFixed(2);

        if (SIM_LIST[ACTIVE_SIM_INDEX].results) {
            SIM_LIST[ACTIVE_SIM_INDEX].results.statWeights = {
                spirit: outSpirit, mp5: outMp5, int: outInt, crit: outCrit, haste: outHaste
            };
        }

        var resBox = document.getElementById("weightResults");
        if (resBox) resBox.classList.remove("hidden");

        var setVal = function (id, val) {
            var el = document.getElementById(id);
            if (el) { el.style.display = "block"; el.innerHTML = val; }
        };

        setVal("val_spirit", outSpirit);
        setVal("val_mp5", outMp5);
        setVal("val_int", outInt);
        setVal("val_crit", outCrit);
        setVal("val_haste", outHaste);

        // Display Hints
        var hintBox = document.getElementById("weight_hints");
        if (hintBox) {
            if (hints.length > 0) {
                hintBox.innerHTML = hints.join("<br><br>");
                hintBox.style.display = "block";
            } else {
                hintBox.style.display = "none";
            }
        }

        showToast("Stat Weights Calculated!");
    }

    runNextScenario();
}

window.applyStatWeights = function () {
    if (!SIM_LIST[ACTIVE_SIM_INDEX].results || !SIM_LIST[ACTIVE_SIM_INDEX].results.statWeights) return;
    var sw = SIM_LIST[ACTIVE_SIM_INDEX].results.statWeights;

    var elSpirit = document.getElementById("weight_spirit"); if (elSpirit) elSpirit.value = sw.spirit;
    var elInt = document.getElementById("weight_int"); if (elInt) elInt.value = sw.int;
    var elMp5 = document.getElementById("weight_mp5"); if (elMp5) elMp5.value = sw.mp5;

    // NEU: Haste und Crit werden nun ebenfalls übernommen
    var elCrit = document.getElementById("weight_spell_crit"); if (elCrit) elCrit.value = sw.crit;
    var elHaste = document.getElementById("weight_spell_haste"); if (elHaste) elHaste.value = sw.haste;

    if (typeof recalcItemScores === 'function') recalcItemScores();
    showToast("Weights applied to Gear Planner!");
};