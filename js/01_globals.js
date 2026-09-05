/**
 * Moonkin Simulation - File 1: Global State & Constants
 */

// ============================================================================
// 1. GLOBAL STATE
// ============================================================================
var SIM_LIST = [];
var ACTIVE_SIM_INDEX = 0;
var SIM_DATA = null;
var CURRENT_VIEW = 'median';
var CURRENT_MODULE = 'SINGLE';
var toastTimer = null;

var GLOBAL_DPS_MIN = 0;
var GLOBAL_DPS_MAX = 0;

var ITEM_DB = [];
var ENCHANT_DB = [];
var GEAR_SELECTION = {};
var ENCHANT_SELECTION = {};

// ============================================================================
// GEAR PRESETS (BiS Lists)
// ============================================================================
var GEAR_PRESETS = {
    "Phase 0 (MC/ONY/K10)": {
        gear: {
            "Head": 16900, // Ersetze 0 durch die tatsächliche Item-ID
            "Neck": 18814,
            "Shoulder": 16836,
            "Back": 18510,
            "Chest": 13346,
            "Wrist": 18263,
            "Hands": 20717,
            "Waist": 19162,
            "Legs": 18875,
            "Feet": 61297,
            "Finger 1": 13143,
            "Finger 2": 19140,
            "Trinket 1": 19288,
            "Trinket 2": 61451,
            "Main Hand": 33148,
            "Off Hand": "",
            "Idol": 22398
        },
        enchants: {
            "Head": 22844,
            "Neck": 51038,
            "Shoulder": 57156,
            "Back": 25084,
            "Chest": 57135,
            "Wrist": 50431,
            "Hands": 25079,
            "Waist": "",
            "Legs": 22844,
            "Feet": 57135,
            "Finger 1": 51038,
            "Finger 2": 51038,
            "Main Hand": 22750,
        }
    },
    "Phase 1 (ZG)": {
        gear: {
            "Head": 22720, // Ersetze 0 durch die tatsächliche Item-ID
            "Neck": 19885,
            "Shoulder": 19928,
            "Back": 18510,
            "Chest": 13346,
            "Wrist": 50431,
            "Hands": 20717,
            "Waist": 19162,
            "Legs": 18875,
            "Feet": 61297,
            "Finger 1": 13143,
            "Finger 2": 19140,
            "Trinket 1": 19288,
            "Trinket 2": 61451,
            "Main Hand": 33148,
            "Off Hand": "",
            "Idol": 22398
        },
        enchants: {
            "Head": 22844,
            "Neck": 51038,
            "Shoulder": 57156,
            "Back": 25084,
            "Chest": 57135,
            "Wrist": 23802,
            "Hands": 25079,
            "Waist": "",
            "Legs": 22844,
            "Feet": 57135,
            "Finger 1": 51038,
            "Finger 2": 51038,
            "Main Hand": 22750,
        }
    },
    "Phase 2 (BWL)": {
        gear: {
            "Head": 16900,
            "Neck": 19885,
            "Shoulder": 16902,
            "Back": 19430,
            "Chest": 13346,
            "Wrist": 16904,
            "Hands": 16899,
            "Waist": 19162,
            "Legs": 16901,
            "Feet": 19437,
            "Finger 1": 13143,
            "Finger 2": 19140,
            "Trinket 1": 19288,
            "Trinket 2": 19395,
            "Main Hand": 33148,
            "Off Hand": "",
            "Idol": 22398
        },
        enchants: {
            "Head": 22844,
            "Neck": 51038,
            "Shoulder": 57156,
            "Back": 25084,
            "Chest": 57135,
            "Wrist": 23802,
            "Hands": 25079,
            "Waist": "",
            "Legs": 22844,
            "Feet": 57135,
            "Finger 1": 51038,
            "Finger 2": 51038,
            "Main Hand": 22750,
        }
    }
};

var CONFIG_IDS = [
    "sim_duration_mode", "weight_haste_steps", "sim_patch", "maxTime", "simCount", "rng_seed", "avcd", "calcMethod",
    "statHit", "statCrit", "statHaste",
    "sp_gen", "sp_nature", "sp_arcane", "sp_pen",
    "stat_override_eclipse", "stat_proc_nature", "stat_proc_arcane",
    "enemy_level", "res_arcane", "res_nature", "enemy_cos", "enemy_ext_mf", "enemy_ext_is",
    "start_boat", "wrath_flight",
    "rota_interrupt", "rota_interrupt_thresh",
    "stag_5p", "t3_4p", "t3_6p", "t3_8p", "t35_3p", "t35_5p",
    "idolEoF", "idolMoon", "idolProp", "idolMoonfang", "idolAcidity", "idolEquilibrium", "idolEquilibriumV2", "idolEquilibriumV3",
    "item_binding", "item_scythe", "item_nobility", "item_thane", "item_sulfuras", "item_sigil", "item_chromie", "item_kelp", "item_sphere",
    "item_reos", "item_toep", "item_roop", "item_zhc", "item_decay", "item_droplet", "item_markali",
    "char_race",
    // BUFFS
    "buff_tree", "buff_moonkin", "buff_atiesh_druid", "buff_atiesh_mage", "buff_atiesh_warlock",
    "buff_arcane_brilliance", "buff_bok", "buff_emerald", "buff_gotw",
    "buff_flask_wisdom", "buff_elixir_dreamshard", "buff_cerebral",
    "buff_weapon_none", "buff_weapon_manaOil", "buff_weapon_wizardOil",
    "buff_food_none", "buff_food_nightfin", "buff_food_sagefish", "buff_food_telabim", "buff_food_lobster",
    "buff_drink_none", "buff_drink_sunfruit", "buff_drink_alterac",
    "buff_alcohol_none", "buff_alcohol_merlot",
    "aoe_targets", "aoe_mode",
    "weight_calc_time", "tank_preset_select", "tank_dmg", "tank_attack_speed"
];

var SLOT_LAYOUT = {
    left: ["Head", "Neck", "Shoulder", "Back", "Chest", "Wrist"],
    right: ["Hands", "Waist", "Legs", "Feet", "Finger 1", "Finger 2", "Trinket 1", "Trinket 2"],
    bottom: ["Main Hand", "Off Hand", "Idol"]
};

// Base 3.38% Crit for Druids, Base Hit 0
const RACE_STATS = {
    "Tauren": { hit: 0, crit: 3.33, haste: 0, stam: 72, int: 95, spirit: 112 },
    "NightElf": { hit: 0, crit: 3.33, haste: 1, stam: 69, int: 100, spirit: 112 }
};

// ============================================================================
// RESTO DRUID SPELL & TALENT DATABASE
// ============================================================================

const SPELL_DB = {
    "HealingTouch": {
        name: "Healing Touch",
        type: "Direct",
        hasRanks: true,
        baseGcd: 1.5,
        ranks: {
            1: { min: 40, max: 55, cast: 1.5, mana: 25, coeff: 0.12, level: 1 },
            2: { min: 94, max: 119, cast: 2.0, mana: 55, coeff: 0.31, level: 8 },
            3: { min: 204, max: 253, cast: 2.5, mana: 110, coeff: 0.57, level: 14 },
            4: { min: 376, max: 459, cast: 3.0, mana: 185, coeff: 0.85, level: 20 },
            5: { min: 589, max: 712, cast: 3.5, mana: 270, coeff: 1.00, level: 26 },
            6: { min: 762, max: 914, cast: 3.5, mana: 335, coeff: 1.00, level: 32 },
            7: { min: 958, max: 1143, cast: 3.5, mana: 405, coeff: 1.00, level: 38 },
            8: { min: 1225, max: 1453, cast: 3.5, mana: 495, coeff: 1.00, level: 44 },
            9: { min: 1545, max: 1826, cast: 3.5, mana: 600, coeff: 1.00, level: 50 },
            10: { min: 1916, max: 2257, cast: 3.5, mana: 720, coeff: 1.00, level: 56 },
            11: { min: 2267, max: 2678, cast: 3.5, mana: 800, coeff: 1.00, level: 60 }
        }
    },
    "Regrowth": {
        name: "Regrowth",
        type: "Mixed",
        hasRanks: true,
        baseGcd: 1.5,
        ranks: {
            1: { min: 93, max: 107, hot: 100, duration: 20, cast: 2.0, mana: 96, coeffDir: 0.200, coeffHot: 0.340, level: 12 },
            2: { min: 176, max: 201, hot: 170, duration: 20, cast: 2.0, mana: 164, coeffDir: 0.264, coeffHot: 0.450, level: 18 },
            3: { min: 255, max: 290, hot: 250, duration: 20, cast: 2.0, mana: 224, coeffDir: 0.286, coeffHot: 0.480, level: 24 },
            4: { min: 336, max: 378, hot: 330, duration: 20, cast: 2.0, mana: 280, coeffDir: 0.286, coeffHot: 0.550, level: 30 },
            5: { min: 425, max: 478, hot: 410, duration: 20, cast: 2.0, mana: 336, coeffDir: 0.286, coeffHot: 0.624, level: 36 },
            6: { min: 534, max: 599, hot: 520, duration: 20, cast: 2.0, mana: 408, coeffDir: 0.286, coeffHot: 0.624, level: 42 },
            7: { min: 672, max: 751, hot: 660, duration: 20, cast: 2.0, mana: 492, coeffDir: 0.286, coeffHot: 0.624, level: 48 },
            8: { min: 839, max: 935, hot: 820, duration: 20, cast: 2.0, mana: 592, coeffDir: 0.286, coeffHot: 0.624, level: 54 },
            9: { min: 1003, max: 1119, hot: 1020, duration: 20, cast: 2.0, mana: 704, coeffDir: 0.286, coeffHot: 0.624, level: 60 }
        }
    },
    "Rejuvenation": {
        name: "Rejuvenation",
        type: "HoT",
        hasRanks: true,
        baseGcd: 1.5,
        ranks: {
            1: { hot: 36, duration: 12, cast: 0, mana: 25, coeff: 0.32, level: 4 },
            2: { hot: 60, duration: 12, cast: 0, mana: 40, coeff: 0.50, level: 10 },
            3: { hot: 120, duration: 12, cast: 0, mana: 75, coeff: 0.68, level: 16 },
            4: { hot: 180, duration: 12, cast: 0, mana: 105, coeff: 0.80, level: 22 },
            5: { hot: 246, duration: 12, cast: 0, mana: 135, coeff: 0.80, level: 28 },
            6: { hot: 306, duration: 12, cast: 0, mana: 160, coeff: 0.80, level: 34 },
            7: { hot: 390, duration: 12, cast: 0, mana: 195, coeff: 0.80, level: 40 },
            8: { hot: 492, duration: 12, cast: 0, mana: 235, coeff: 0.80, level: 46 },
            9: { hot: 612, duration: 12, cast: 0, mana: 280, coeff: 0.80, level: 52 },
            10: { hot: 756, duration: 12, cast: 0, mana: 335, coeff: 0.80, level: 58 }
        }
    },
    "Swiftmend": {
        name: "Swiftmend",
        type: "Direct",
        hasRanks: false,
        baseGcd: 1.5,
        cast: 0,
        mana: 199, // Consumes HoT, 0 Base Cost
        cooldown: 15
    },
    "NaturesSwiftness": {
        name: "Nature's Swiftness",
        type: "Utility",
        hasRanks: false,
        baseGcd: 0,
        cast: 0,
        mana: 0,
        cooldown: 180
    },
    "Tranquility": {
        name: "Tranquility",
        type: "Channel",
        hasRanks: true,
        baseGcd: 1.5,
        ranks: {
            1: { hot: 352, duration: 4, cast: 4, mana: 750, coeff: 0.66, level: 30 },
            2: { hot: 528, duration: 6, cast: 6, mana: 1010, coeff: 0.66, level: 40 },
            3: { hot: 704, duration: 8, cast: 8, mana: 1390, coeff: 0.66, level: 50 },
            4: { hot: 880, duration: 10, cast: 10, mana: 1850, coeff: 0.66, level: 60 }
        }
    },
    "Innervate": {
        name: "Innervate",
        type: "Utility",
        hasRanks: false,
        baseGcd: 1.5,
        cast: 0,
        mana: 0,
        cooldown: 360
    },
    "MajorManaPotion": {
        name: "Major Mana Potion",
        type: "Consumable",
        hasRanks: false,
        baseGcd: 0,
        cast: 0,
        mana: 0, // Restores Mana
        cooldown: 120
    },
    "DemonicRune": {
        name: "Demonic Rune",
        type: "Consumable",
        hasRanks: false,
        baseGcd: 0,
        cast: 0,
        mana: 0, // Restores Mana, Costs HP
        cooldown: 120
    },
    "JujuFlurry": {
        name: "Juju Flurry", type: "Consumable", hasRanks: false, baseGcd: 0, cast: 0, mana: 0, cooldown: 60
    },
    "PotionOfQuickness": {
        name: "Potion of Quickness", type: "Consumable", hasRanks: false, baseGcd: 0, cast: 0, mana: 0, cooldown: 120
    },
    "Trinket1": {
        name: "Use Trinket 1", type: "Utility", hasRanks: false, baseGcd: 0, cast: 0, mana: 0, cooldown: 0
    },
    "Trinket2": {
        name: "Use Trinket 2", type: "Utility", hasRanks: false, baseGcd: 0, cast: 0, mana: 0, cooldown: 0
    }
};

// ============================================================================
// TALENT TREE DATA 
// ============================================================================

var TALENT_CONFIG = {
    // Balance
    impWrath: 0, naturesGrasp: 0, impNaturesGrasp: 0, sylvanBlessing: 0,
    guidanceOfTheDream: 0, impMoonfire: 0, naturalWeapons: 0, naturalShapeshifter: 0,
    moonfury: 0, omenOfClarity: 0, naturesReach: 0, vengeance: 0, moonglow: 0,
    owlkinFrenzy: 0, moonkinForm: 0, naturesGrace: 0, impStarfire: 0,
    balanceOfAllThings: 0, galeWinds: 0, eclipse: 0,

    // Feral
    ferocity: 0, feralAggression: 0, feralInstinct: 0, brutalImpact: 0,
    thickHide: 0, openWounds: 0, feralSwiftness: 0, feralCharge: 0,
    sharpenedClaws: 0, primalFury: 0, predatoryStrikes: 0, bloodFrenzy: 0,
    impShred: 0, ancientBrutality: 0, berserk: 0, heartOfTheWild: 0,
    carnage: 0, leaderOfThePack: 0,

    // Restoration
    impMarkOfTheWild: 0, furor: 0, impHealingTouch: 0, naturesFocus: 0, subtlety: 0,
    swiftmend: 0, genesis: 0, reflection: 0, giftOfNature: 0, tranquilSpirit: 0,
    aessinasBloom: 0, natureSwiftness: 0, preservation: 0, impRegrowth: 0,
    impTranquility: 0, treeOfLife: 0
};

var TALENT_TREES = {
    "Balance": [
        { id: "impWrath", name: "Improved Wrath", icon: "spell_nature_abolishmagic", max: 5, row: 0, col: 0, req: null, desc: "Reduces the cast time and global cooldown of your Wrath spell by 0.1/0.2/0.3/0.4/0.5 sec." },
        { id: "naturesGrasp", name: "Nature's Grasp", icon: "spell_nature_natureswrath", max: 1, row: 0, col: 1, req: null, desc: "While active, any time an enemy strikes the caster they have a 35% chance to become afflicted by Entangling Roots (Rank 1). Only useable outdoors. 1 charge. Lasts 45 sec." },
        { id: "impNaturesGrasp", name: "Improved Nature's Grasp", icon: "spell_nature_natureswrath", max: 4, row: 0, col: 2, req: "naturesGrasp", desc: "Increases the chance for your Nature's Grasp to entangle an enemy by 15/30/45/65%." },
        { id: "sylvanBlessing", name: "Sylvan Blessing", icon: "inv_misc_gem_emerald_01", max: 2, row: 0, col: 3, req: null, desc: "Gives you a 50/100% chance after killing a target that yields experience or honor to allow your Mana to regenerate at a 100% rate while casting. Lasts 15 sec." },
        { id: "guidanceOfTheDream", name: "Guidance of the Dream", icon: "spell_nature_sleep", max: 3, row: 1, col: 0, req: null, desc: "Gives you a 23/46/70% chance to avoid interruption caused by damage while casting your Balance spells." },
        { id: "impMoonfire", name: "Improved Moonfire", icon: "spell_nature_starfall", max: 2, row: 1, col: 1, req: null, desc: "Increases the damage and critical strike chance of your Moonfire spell by 5/10%." },
        { id: "naturalWeapons", name: "Natural Weapons", icon: "inv_staff_01", max: 3, row: 1, col: 2, req: null, desc: "Increases the damage you deal with physical attacks in all forms by 3/6/10%. Also increases chance to hit with melee attacks and spells by 1/2/3%." },
        { id: "naturalShapeshifter", name: "Natural Shapeshifter", icon: "spell_nature_wispsplode", max: 3, row: 1, col: 3, req: null, desc: "Reduces the mana cost of all shapeshifting by 10/20/30%." },
        { id: "moonfury", name: "Moonfury", icon: "spell_nature_moonglow", max: 3, row: 2, col: 0, req: null, desc: "Increases the damage of your Starfire, Moonfire, Hurricane, Insect Swarm, and Wrath spells by 4/8/12%." },
        { id: "omenOfClarity", name: "Omen of Clarity", icon: "spell_nature_crystalball", max: 1, row: 2, col: 2, req: "naturalWeapons", desc: "Imbues the Druid with natural energy. Each of the Druid's melee attacks or offensive spell casts has a chance of causing the caster to enter a Clearcasting state. The Clearcasting state reduces the Mana, Rage or Energy cost of your next damage or healing spell or offensive ability by 100%." },
        { id: "naturesReach", name: "Nature's Reach", icon: "spell_nature_naturetouchgrow", max: 2, row: 2, col: 3, req: null, desc: "Increases the range of your Wrath, Entangling Roots, Faerie Fire, Moonfire, Starfire, Insect Swarm, Hurricane, Remove Curse, Abolish Poison, and Cure Poison spells by 10/20%." },
        { id: "vengeance", name: "Vengeance", icon: "spell_nature_purge", max: 5, row: 3, col: 1, req: "impMoonfire", desc: "Increases the critical strike damage bonus of your Starfire, Moonfire, and Wrath spells by 20/40/60/80/100%." },
        { id: "moonglow", name: "Moonglow", icon: "spell_nature_sentinal", max: 3, row: 3, col: 2, req: null, desc: "Reduces the Mana cost of your Moonfire, Starfire, Wrath, Hurricane, Insect Swarm, Healing Touch, Regrowth and Rejuvenation spells by 3/6/9%." },
        { id: "owlkinFrenzy", name: "Owlkin Frenzy", icon: "ability_druid_owlkinfrenzy", max: 3, row: 4, col: 0, req: "moonkinForm", desc: "Damage taken while in Moonkin Form has a 10% chance to enrage you, granting a 30% chance to avoid interruption caused by damage while casting and regenerating 1% of your maximum mana per second for 10 sec. This effect can only trigger once every 30/25/20 seconds." },
        { id: "moonkinForm", name: "Moonkin Form", icon: "spell_nature_forceofnature", max: 1, row: 4, col: 1, req: null, desc: "Transforms the Druid into Moonkin Form. While in this form the armor contribution from items is increased by 180%, the Mana cost of your Balance spells is reduced by 20%, and all party members within 30 yards have their spell critical chance increased by 3%." },
        { id: "naturesGrace", name: "Nature's Grace", icon: "spell_nature_naturesblessing", max: 1, row: 4, col: 2, req: "moonglow", desc: "All spell criticals grace you with a blesisng of nature, reducing the casting time of your next spell by 0.5 sec." },
        { id: "impStarfire", name: "Improved Starfire", icon: "spell_arcane_starfire", max: 3, row: 4, col: 3, req: null, desc: "Reduces the cast time of Starfire by 0.2/0.3/0.5 sec and gives it a 5/10/15% chance to stun the target for 3 sec." },
        { id: "balanceOfAllThings", name: "Balance of All Things", icon: "ability_druid_manatree", max: 3, row: 5, col: 1, req: null, desc: "Damaging a target afflicted by Insect Swarm with Wrath refunds 10/20/30% of its mana cost. Starfire has a 3/6/9% increased chance to critically strike against targets affected by Moonfire." },
        { id: "galeWinds", name: "Gale Winds", icon: "ability_druid_galewinds", max: 2, row: 5, col: 2, req: null, desc: "Reduces the mana cost of Hurricane by 10/20% and causes it to reduce the attack speed of affected enemies by 12/25%." },
        { id: "eclipse", name: "Eclipse", icon: "ability_druid_eclipse", max: 1, row: 6, col: 1, req: null, desc: "Aligns natural and astral energies. Damage from Wrath has a 40% chance to grant Arcane Eclipse, increasing Arcane damage dealt. Damage from Starfire has a 60% chance to grant Nature Eclipse, increasing Nature damage dealt. The damage bonus is 10% plus 60% of your spell critical strike chance. Each effect lasts 15 sec and has its own 30 sec cooldown. Only one Eclipse can be active at a time." }
    ],
    "Feral": [
        { id: "ferocity", name: "Ferocity", icon: "ability_hunter_pet_hyena", max: 5, row: 0, col: 1, req: null, desc: "Reduces the cost of your Maul, Swipe, Savage Bite, Claw, and Rake abilities by 1/2/3/4/5 Rage or Energy." },
        { id: "feralAggression", name: "Feral Aggression", icon: "ability_druid_demoralizingroar", max: 5, row: 0, col: 2, req: null, desc: "Increases the Attack Power reduction of your Demoralizing Roar by 8/16/24/32/40% and the damage caused by your Ferocious Bite by 3/6/9/12/15%." },
        { id: "feralInstinct", name: "Feral Instinct", icon: "ability_ambush", max: 3, row: 1, col: 0, req: null, desc: "Increases threat caused in Bear and Dire Bear Form by 5/10/15% and reduces the chance enemies have to detect you while Prowling." },
        { id: "brutalImpact", name: "Brutal Impact", icon: "ability_druid_bash", max: 2, row: 1, col: 1, req: null, desc: "Increases the stun duration of your Bash and Pounce abilities by 0.5/1 sec." },
        { id: "thickHide", name: "Thick Hide", icon: "inv_misc_pelt_bear_03", max: 3, row: 1, col: 2, req: null, desc: "Increases your Armor contribution from items by 3/6/10%." },
        { id: "openWounds", name: "Open Wounds", icon: "ability_druid_disembowel", max: 3, row: 1, col: 3, req: null, desc: "Increases the damage of Rip by 5/10/15%. In addition, increases the damage of Claw by 10/20/30% for each of your active Bleed effects on the target." },
        { id: "feralSwiftness", name: "Feral Swiftness", icon: "spell_nature_spiritwolf", max: 2, row: 2, col: 0, req: null, desc: "Increases your movement speed by 15/30% while outdoors in Cat Form and increases your chance to dodge while in Bear, Dire Bear and Cat Form by 2/4%." },
        { id: "feralCharge", name: "Feral Charge", icon: "ability_hunter_pet_bear", max: 1, row: 2, col: 1, req: null, desc: "Causes you to charge an enemy, immobilizing and interrupting any spell being cast for 4 sec." },
        { id: "sharpenedClaws", name: "Sharpened Claws", icon: "inv_misc_monsterclaw_04", max: 3, row: 2, col: 2, req: null, desc: "Increases your critical strike chance while in Bear, Dire Bear or Cat Form by 2/4/6%." },
        { id: "primalFury", name: "Primal Fury", icon: "ability_racial_cannibalize", max: 2, row: 2, col: 3, req: "sharpenedClaws", desc: "Gives you a 50/100% chance to gain an additional 5 Rage anytime you get a critical strike while in Bear and Dire Bear Form and your critical strikes from Cat Form abilities that add combo points have a chance to add an additional combo point." },
        { id: "predatoryStrikes", name: "Predatory Strikes", icon: "ability_hunter_pet_cat", max: 3, row: 3, col: 1, req: null, desc: "Increases your melee attack power in Cat, Bear, and Dire Bear Forms by 3/6/10%. In addition, increases the damage caused by your Claw, Rake, Maul, Swipe, and Savage Bite abilities by 7/14/20%." },
        { id: "bloodFrenzy", name: "Blood Frenzy", icon: "ability_ghoulfrenzy", max: 2, row: 3, col: 2, req: "sharpenedClaws", desc: "Increases the duration of Tiger's Fury by 6/12 sec, and causes Enrage to instantly generate 5/10 Rage. In addition, Tiger's Fury and Enrage increase your attack speed by 10/20% for 9/18 sec." },
        { id: "impShred", name: "Improved Shred", icon: "spell_shadow_vampiricaura", max: 2, row: 3, col: 3, req: null, desc: "Increases the damage of Shred by 5/10% and reduces its Energy cost by 6/12." },
        { id: "ancientBrutality", name: "Ancient Brutality", icon: "spell_shadow_unholyfrenzy", max: 2, row: 4, col: 0, req: null, desc: "Dodging an attack while in Bear or Dire Bear Form imbues you with the spirit of the Ancients, generating 2/4 Rage per second for 5 sec. This effect can only occur once every 9 seconds. While in Cat Form, periodic ticks of your Bleed effects restore 3/5 Energy." },
        { id: "berserk", name: "Berserk", icon: "ability_druid_berserk", max: 1, row: 4, col: 2, req: null, desc: "Removes all Fear effects and increases your energy regeneration rate by 100% while in Cat form, and increases your total health by 20% while in Bear form. After the effect ends, the health is lost. Effect lasts 20 seconds." },
        { id: "heartOfTheWild", name: "Heart of the Wild", icon: "spell_holy_blessingofagility", max: 5, row: 5, col: 1, req: "predatoryStrikes", desc: "Increases your Intellect by 4/8/12/16/20%. In addition, while in Bear or Dire Bear Form your Stamina is increased by 4/8/12/16/20% and while in Cat Form your Strength is increased by 4/8/12/16/20%." },
        { id: "carnage", name: "Carnage", icon: "ability_druid_rake", max: 2, row: 5, col: 2, req: null, desc: "Your Maul, Swipe, and Savage Bite abilities return 5/10% of their damage as healing to you. In addition, gives your Ferocious Bite a 10/20% chance per combo point spent to refresh your active Rake and Rip effects and to add an additional combo point." },
        { id: "leaderOfThePack", name: "Leader of the Pack", icon: "spell_nature_unyeildingstamina", max: 1, row: 6, col: 1, req: null, desc: "While in Cat, Bear or Dire Bear Form, the Leader of the Pack increases ranged and melee critical chance of all party members within 45 yards by 3%." }
    ],
    "Restoration": [
        { id: "impMarkOfTheWild", name: "Improved Mark of the Wild", icon: "spell_nature_regeneration", max: 5, row: 0, col: 1, req: null, desc: "Increases the effects of your Mark of the Wild and Gift of the Wild spells by 7/14/21/28/35%." },
        { id: "furor", name: "Furor", icon: "spell_holy_blessingofstamina", max: 5, row: 0, col: 2, req: null, desc: "Gives you 20/40/60/80/100% chance to gain 10 Rage when you shapeshift into Bear and Dire Bear Form or 40 Energy when you shapeshift into Cat Form." },
        { id: "impHealingTouch", name: "Improved Healing Touch", icon: "spell_nature_healingtouch", max: 5, row: 1, col: 0, req: null, desc: "Reduces the cast time of your Healing Touch spell by 0.1/0.2/0.3/0.4/0.5 sec." },
        { id: "naturesFocus", name: "Nature's Focus", icon: "spell_nature_healingwavegreater", max: 5, row: 1, col: 1, req: null, desc: "Gives you a 14/28/42/56/70% chance to avoid interruption caused by damage while casting the Healing Touch, Regrowth, and Tranquility spells." },
        { id: "subtlety", name: "Subtlety", icon: "ability_eyeoftheowl", max: 5, row: 1, col: 2, req: null, desc: "Reduces the threat generated by your spells by 4/8/12/16/20%." },
        { id: "swiftmend", name: "Swiftmend", icon: "inv_relics_idolofrejuvenation", max: 1, row: 2, col: 1, req: null, desc: "Consumes a Rejuvenation or Regrowth effect on a friendly target to instantly heal them an amount equal to 12 sec. of Rejuvenation or 18 sec. of Regrowth." },
        { id: "genesis", name: "Genesis", icon: "spell_nature_starfall", max: 3, row: 2, col: 2, req: null, desc: "Increases the damage and healing of your periodic magical spells and effects by 5/10/15%." },
        { id: "reflection", name: "Reflection", icon: "spell_frost_windwalkon", max: 3, row: 2, col: 3, req: null, desc: "Allows 5/10/15% of your Mana regeneration to continue while casting." },
        { id: "giftOfNature", name: "Gift of Nature", icon: "spell_nature_protectionformnature", max: 5, row: 3, col: 1, req: null, desc: "Increases the effectiveness of all healing spells by 2/4/6/8/10%." },
        { id: "tranquilSpirit", name: "Tranquil Spirit", icon: "spell_holy_elunesgrace", max: 5, row: 3, col: 3, req: null, desc: "Reduces the mana cost of your Healing Touch, Regrowth and Tranquility spells by 2/4/6/8/10%." },
        { id: "aessinasBloom", name: "Aessina's Bloom", icon: "inv_misc_herb_02", max: 2, row: 4, col: 0, req: "impHealingTouch", desc: "Healing a target affected by Regrowth or Rejuvenation with your Healing Touch spells reduces the casting time of your next Healing Touch spell by 0.15/0.30 sec and refunds 5/10% of its mana cost within 20 sec." },
        { id: "natureSwiftness", name: "Nature's Swiftness", icon: "spell_nature_ravenform", max: 1, row: 4, col: 2, req: "genesis", desc: "When activated, your next Nature spell becomes an instant cast spell." },
        { id: "preservation", name: "Preservation", icon: "inv_relics_idolofhealth", max: 3, row: 4, col: 3, req: null, desc: "Increases the periodic healing of Regrowth by 10/20/30% if the friendly target is affected by Rejuvenation." },
        { id: "impRegrowth", name: "Improved Regrowth", icon: "spell_nature_resistnature", max: 5, row: 5, col: 1, req: "giftOfNature", desc: "Increases the critical effect chance of your Regrowth spell by 10/20/30/40/50%." },
        { id: "impTranquility", name: "Improved Tranquility", icon: "spell_nature_tranquility", max: 2, row: 5, col: 2, req: null, desc: "Increases the healing done by your Tranquility spell by 20/40%." },
        { id: "treeOfLife", name: "Tree of Life Form", icon: "ability_druid_treeoflife", max: 1, row: 6, col: 1, req: null, desc: "Shapeshift into the Tree of Life. While in this form armor contribution from items is increased by 180%, the healing power of nearby party members is increased by an amount equal to 20% of your spirit, your movement speed is reduced by 20%, and you cannot cast damaging spells or Healing Touch, but the mana cost of heal over time spells is reduced by 20%." }
    ]
};

// ============================================================================
// TALENT PRESETS
// ============================================================================
var TALENT_PRESETS = {
    "Full Resto (0/0/51)": {
        // Balance
        impWrath: 0, naturesGrasp: 0, impNaturesGrasp: 0, sylvanBlessing: 0,
        guidanceOfTheDream: 0, impMoonfire: 0, naturalWeapons: 0, naturalShapeshifter: 0,
        moonfury: 0, omenOfClarity: 0, naturesReach: 0,
        vengeance: 0, moonglow: 0,
        owlkinFrenzy: 0, moonkinForm: 0, naturesGrace: 0, impStarfire: 0,
        balanceOfAllThings: 0, galeWinds: 0,
        eclipse: 0,
        // Feral
        ferocity: 0, feralAggression: 0, feralInstinct: 0, brutalImpact: 0,
        thickHide: 0, openWounds: 0, feralSwiftness: 0, feralCharge: 0,
        sharpenedClaws: 0, primalFury: 0, predatoryStrikes: 0, bloodFrenzy: 0,
        impShred: 0, ancientBrutality: 0, berserk: 0, heartOfTheWild: 0,
        carnage: 0, leaderOfThePack: 0,
        // Restoration
        impMarkOfTheWild: 5, furor: 0,
        impHealingTouch: 5, naturesFocus: 5, subtlety: 5,
        swiftmend: 1, genesis: 3, reflection: 3,
        giftOfNature: 5, tranquilSpirit: 5,
        aessinasBloom: 2, natureSwiftness: 1, preservation: 3,
        impRegrowth: 5, impTranquility: 2,
        treeOfLife: 1
    },
    "Moonglow (18/0/33)": {
        // Balance
        impWrath: 0, naturesGrasp: 1, impNaturesGrasp: 4, sylvanBlessing: 0,
        guidanceOfTheDream: 0, impMoonfire: 1, naturalWeapons: 3, naturalShapeshifter: 3,
        moonfury: 0, omenOfClarity: 1, naturesReach: 2,
        vengeance: 0, moonglow: 3,
        owlkinFrenzy: 0, moonkinForm: 0, naturesGrace: 0, impStarfire: 0,
        balanceOfAllThings: 0, galeWinds: 0,
        eclipse: 0,
        // Feral
        ferocity: 0, feralAggression: 0, feralInstinct: 0, brutalImpact: 0,
        thickHide: 0, openWounds: 0, feralSwiftness: 0, feralCharge: 0,
        sharpenedClaws: 0, primalFury: 0, predatoryStrikes: 0, bloodFrenzy: 0,
        impShred: 0, ancientBrutality: 0, berserk: 0, heartOfTheWild: 0,
        carnage: 0, leaderOfThePack: 0,
        // Restoration
        impMarkOfTheWild: 5, furor: 0,
        impHealingTouch: 0, naturesFocus: 5, subtlety: 0,
        swiftmend: 1, genesis: 3, reflection: 3,
        giftOfNature: 5, tranquilSpirit: 4,
        aessinasBloom: 0, natureSwiftness: 1, preservation: 0,
        impRegrowth: 5, impTranquility: 0,
        treeOfLife: 1
    },
    "Natures Grace/Regrowth (21/0/30)": {
        // Balance
        impWrath: 0, naturesGrasp: 1, impNaturesGrasp: 4, sylvanBlessing: 0,
        guidanceOfTheDream: 0, impMoonfire: 2, naturalWeapons: 3, naturalShapeshifter: 3,
        moonfury: 1, omenOfClarity: 1, naturesReach: 2,
        vengeance: 0, moonglow: 3,
        owlkinFrenzy: 0, moonkinForm: 0, naturesGrace: 1, impStarfire: 0,
        balanceOfAllThings: 0, galeWinds: 0,
        eclipse: 0,
        // Feral
        ferocity: 0, feralAggression: 0, feralInstinct: 0, brutalImpact: 0,
        thickHide: 0, openWounds: 0, feralSwiftness: 0, feralCharge: 0,
        sharpenedClaws: 0, primalFury: 0, predatoryStrikes: 0, bloodFrenzy: 0,
        impShred: 0, ancientBrutality: 0, berserk: 0, heartOfTheWild: 0,
        carnage: 0, leaderOfThePack: 0,
        // Restoration
        impMarkOfTheWild: 5, furor: 0,
        impHealingTouch: 0, naturesFocus: 5, subtlety: 0,
        swiftmend: 1, genesis: 1, reflection: 3,
        giftOfNature: 5, tranquilSpirit: 5,
        aessinasBloom: 0, natureSwiftness: 0, preservation: 0,
        impRegrowth: 5, impTranquility: 0,
        treeOfLife: 0
    },
    "Raid Healing (NS) (18/0/33)": {
        // Balance
        impWrath: 5, naturesGrasp: 1, impNaturesGrasp: 0, sylvanBlessing: 0,
        guidanceOfTheDream: 0, impMoonfire: 0, naturalWeapons: 3, naturalShapeshifter: 3,
        moonfury: 0, omenOfClarity: 1, naturesReach: 2,
        vengeance: 0, moonglow: 3,
        owlkinFrenzy: 0, moonkinForm: 0, naturesGrace: 0, impStarfire: 0,
        balanceOfAllThings: 0, galeWinds: 0,
        eclipse: 0,
        // Feral
        ferocity: 0, feralAggression: 0, feralInstinct: 0, brutalImpact: 0,
        thickHide: 0, openWounds: 0, feralSwiftness: 0, feralCharge: 0,
        sharpenedClaws: 0, primalFury: 0, predatoryStrikes: 0, bloodFrenzy: 0,
        impShred: 0, ancientBrutality: 0, berserk: 0, heartOfTheWild: 0,
        carnage: 0, leaderOfThePack: 0,
        // Restoration
        impMarkOfTheWild: 5, furor: 0,
        impHealingTouch: 0, naturesFocus: 5, subtlety: 0,
        swiftmend: 1, genesis: 3, reflection: 2,
        giftOfNature: 5, tranquilSpirit: 0,
        aessinasBloom: 0, natureSwiftness: 1, preservation: 3,
        impRegrowth: 5, impTranquility: 2,
        treeOfLife: 1
    },
    "Raid Healing (No NS) (18/0/33)": {
        // Balance
        impWrath: 5, naturesGrasp: 1, impNaturesGrasp: 0, sylvanBlessing: 0,
        guidanceOfTheDream: 0, impMoonfire: 0, naturalWeapons: 3, naturalShapeshifter: 3,
        moonfury: 0, omenOfClarity: 1, naturesReach: 2,
        vengeance: 0, moonglow: 3,
        owlkinFrenzy: 0, moonkinForm: 0, naturesGrace: 0, impStarfire: 0,
        balanceOfAllThings: 0, galeWinds: 0,
        eclipse: 0,
        // Feral
        ferocity: 0, feralAggression: 0, feralInstinct: 0, brutalImpact: 0,
        thickHide: 0, openWounds: 0, feralSwiftness: 0, feralCharge: 0,
        sharpenedClaws: 0, primalFury: 0, predatoryStrikes: 0, bloodFrenzy: 0,
        impShred: 0, ancientBrutality: 0, berserk: 0, heartOfTheWild: 0,
        carnage: 0, leaderOfThePack: 0,
        // Restoration
        impMarkOfTheWild: 5, furor: 0,
        impHealingTouch: 0, naturesFocus: 5, subtlety: 0,
        swiftmend: 1, genesis: 3, reflection: 0,
        giftOfNature: 5, tranquilSpirit: 2,
        aessinasBloom: 0, natureSwiftness: 0, preservation: 3,
        impRegrowth: 5, impTranquility: 2,
        treeOfLife: 1
    },
};

// Laden aus dem LocalStorage (falls der User eigene gespeichert hat)
try {
    var storedTalents = localStorage.getItem("resto_talent_presets");
    if (storedTalents) {
        Object.assign(TALENT_PRESETS, JSON.parse(storedTalents));
    }
} catch (e) { console.warn("Could not load talent presets", e); }

// ============================================================================
// ROTATION BUILDER STATE & DICTIONARIES
// ============================================================================

// Skills für Drag & Drop (mit Rängen, die später im UI wählbar gemacht werden)
var CONDITION_TYPES = [
    { id: "target_hp_pct", label: "Target HP %", hasOp: true, hasVal: true },
    { id: "target_hp_deficit", label: "Target HP Deficit", hasOp: true, hasVal: true },
    { id: "hot_missing", label: "Target Missing HoT", hasTarget: ["Rejuvenation", "Regrowth"] },
    { id: "hot_active", label: "Target Has HoT", hasTarget: ["Rejuvenation", "Regrowth"] },
    { id: "hot_rem", label: "Target HoT Rem. (s)", hasTarget: ["Rejuvenation", "Regrowth"], hasOp: true, hasVal: true },
    { id: "mana_pct", label: "Own Mana %", hasOp: true, hasVal: true },
    { id: "mana_abs", label: "Own Mana (Abs)", hasOp: true, hasVal: true },
    { id: "mana_deficit", label: "Own Mana Deficit", hasOp: true, hasVal: true },
    { id: "ns_ready", label: "Nature's Swiftness Ready", hasBool: true }
];

var ROTATION_SKILLS = [
    { id: "Rejuvenation", name: "Rejuvenation", icon: "spell_nature_rejuvenation", hasRanks: true, maxRank: 10 },
    { id: "Regrowth", name: "Regrowth", icon: "spell_nature_resistnature", hasRanks: true, maxRank: 9 },
    { id: "HealingTouch", name: "Healing Touch", icon: "spell_nature_healingtouch", hasRanks: true, maxRank: 11 },
    { id: "Swiftmend", name: "Swiftmend", icon: "inv_relics_idolofrejuvenation", hasRanks: false },
    { id: "NaturesSwiftness", name: "Nature's Swiftness", icon: "spell_nature_ravenform", hasRanks: false }, // <--- NEU
    { id: "Innervate", name: "Innervate", icon: "spell_nature_lightning", hasRanks: false },
    { id: "MajorManaPotion", name: "Mana Potion", icon: "inv_potion_76", hasRanks: false },
    { id: "DemonicRune", name: "Demonic Rune", icon: "inv_misc_rune_04", hasRanks: false },
    { id: "JujuFlurry", name: "Juju Flurry", icon: "inv_misc_monsterscales_30", hasRanks: false },
    { id: "PotionOfQuickness", name: "Potion of Quickness", icon: "inv_potion_31", hasRanks: false },
    { id: "Trinket1", name: "Use Trinket 1", icon: "inv_jewelry_trinket_04", hasRanks: false },
    { id: "Trinket2", name: "Use Trinket 2", icon: "inv_jewelry_trinket_04", hasRanks: false }
];

var PRESET_ROTATIONS = {
    "Basic Tank Heal": {
        name: "Basic Tank Heal",
        desc: "Maintains Rejuv, uses HT Rank 4 as efficient filler, pops Mana Potion early.",
        steps: [
            { id: 1, skill: "Trinket1", rank: null, conditions: [], disabled: false },
            { id: 2, skill: "Trinket2", rank: null, conditions: [], disabled: false },
            { id: 3, skill: "DemonicRune", rank: null, conditions: [{ type: "mana_pct", op: "<=", val: "80" }], disabled: false },
            { id: 4, skill: "MajorManaPotion", rank: null, conditions: [{ type: "mana_pct", op: "<=", val: "60" }], disabled: false },
            { id: 5, skill: "Innervate", rank: null, conditions: [{ type: "mana_pct", op: "<=", val: "40" }], disabled: false },
            { id: 6, skill: "Rejuvenation", rank: 10, conditions: [{ type: "hot_missing", target: "Rejuvenation" }, { type: "target_hp_deficit", op: ">=", val: "250" }], disabled: false },
            { id: 7, skill: "Swiftmend", rank: null, conditions: [{ type: "target_hp_deficit", op: ">=", val: "1500" }, { type: "hot_active", target: "Rejuvenation" }], disabled: false },
            { id: 8, skill: "NaturesSwiftness", rank: null, conditions: [{ type: "target_hp_deficit", op: ">=", val: "1500" }, { type: "hot_active", target: "Rejuvenation" }], disabled: false },
            { id: 9, skill: "Regrowth", rank: null, conditions: [{ type: "target_hp_deficit", op: ">=", val: "2000" }, { type: "hot_active", target: "Rejuvenation" }], disabled: false }
        ]
    }
};

// Aktiver Rotation-State
var CUSTOM_ROTATION = JSON.parse(JSON.stringify(PRESET_ROTATIONS["Basic Tank Heal"]));

function SimObject(id, name) {
    this.id = id;
    this.name = name;
    this.config = {};
    this.customRotation = JSON.parse(JSON.stringify(PRESET_ROTATIONS["Basic Tank Heal"]));
    this.results = null;
}

