/**
 * Moonkin Simulation - File 2: Utilities
 */

// ============================================================================
// 2. UTILS
// ============================================================================
function getVal(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    if (el.type === "checkbox") return el.checked ? 1 : 0;
    if (el.tagName === "SELECT") return el.value;
    return parseFloat(el.value) || 0;
}

function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.innerText = text;
}

function showToast(msg) {
    var t = document.getElementById("toast");
    if (t) {
        if (toastTimer) clearTimeout(toastTimer);
        t.innerText = msg || "Action Successful!";
        t.classList.add("show");
        toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3000);
    }
}
// ============================================================================
// PROGRESS OVERLAY & ANIMATION LOGIC
// ============================================================================
var progressAnimFrame = null;

function showProgress(text) {
    var overlay = document.getElementById("progressOverlay");
    var textEl = document.getElementById("progressText");
    var fillEl = document.getElementById("progressFill");

    if (overlay) overlay.classList.remove("hidden");
    if (textEl) textEl.innerText = text || "Loading...";
    if (fillEl) fillEl.style.width = "0%";

    // Starte die Druiden-Canvas-Animation
    startCanvasAnimation();
}

function updateProgress(percent) {
    var fillEl = document.getElementById("progressFill");
    if (fillEl) {
        // Begrenzt den Wert sicher zwischen 0 und 100
        fillEl.style.width = Math.min(100, Math.max(0, percent)) + "%";
    }
}

function hideProgress() {
    var overlay = document.getElementById("progressOverlay");
    if (overlay) overlay.classList.add("hidden");

    // Stoppe die Animation, um CPU zu sparen, wenn das Overlay weg ist
    if (progressAnimFrame) {
        cancelAnimationFrame(progressAnimFrame);
        progressAnimFrame = null;
    }
}

// Eine kleine, performante Natur-Zauber-Animation für das Canvas
function startCanvasAnimation() {
    var canvas = document.getElementById("animCanvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var time = 0;
    var particles = [];

    // Erstelle ein paar aufsteigende Partikel ("Heilende Blätter/Funken")
    for (var i = 0; i < 20; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: 0.5 + Math.random(),
            size: 1 + Math.random() * 2
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var pulse = Math.sin(time * 0.05) * 5; // Sanftes Pulsieren

        // 1. Hintergrund-Glow (Natur-Grün)
        var gradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 40 + pulse);
        gradient.addColorStop(0, "rgba(76, 175, 80, 0.6)"); // Druid Green
        gradient.addColorStop(1, "rgba(76, 175, 80, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 50 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // 2. Innerer Kern (Heilende Energie)
        ctx.fillStyle = "rgba(165, 214, 167, 0.9)";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12 + pulse / 2, 0, Math.PI * 2);
        ctx.fill();

        // 3. Aufsteigende Partikel
        ctx.fillStyle = "rgba(165, 214, 167, 0.8)";
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            // Partikel nach oben schweben lassen
            p.y -= p.speed;
            p.x += Math.sin(time * 0.02 + i) * 0.5; // Leichtes hin- und herwackeln

            // Wenn Partikel oben rausfliegen, unten wieder neu spawnen
            if (p.y < 0) {
                p.y = canvas.height;
                p.x = Math.random() * canvas.width;
            }
        }

        time++;
        progressAnimFrame = requestAnimationFrame(draw);
    }

    if (progressAnimFrame) cancelAnimationFrame(progressAnimFrame);
    draw();
}
// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR (Mulberry32)
// ============================================================================
/**
 * Returns a function that generates random numbers between 0 and 1 based on a seed.
 * Usage: var rng = mulberry32(12345); var rand = rng();
 */
function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

