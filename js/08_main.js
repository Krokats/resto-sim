/**
 * Moonkin Simulation - File 6: Main Init
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    setupUIListeners();
    populateBiSDropdown();
    addSim(true);

    renderTalentTree();

    updateEnemyInfo();
    //updateSpellStats();
    importSettings();
    loadDatabase();

    // NEU: Initialisiert den Feral-Style Drag & Drop Rotation Builder
    if (typeof initRotationBuilder === 'function') {
        initRotationBuilder();
    } else {
        console.error("initRotationBuilder wurde nicht gefunden! Syntax-Fehler in 04_ui.js?");
    }
}

// Start
init();