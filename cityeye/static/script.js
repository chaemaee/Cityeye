// ═══════════════════════════════════════════════════════
//  CityEye — script.js
//  Logique complète : carte Leaflet, graphiques, API
// ═══════════════════════════════════════════════════════

// ─── Variables globales ─────────────────────────────────
let carteRabat     = null;   // carte dashboard
let carteTrafic    = null;   // carte trafic
let chartSecurite  = null;   // graphique 7 jours
let chartAir       = null;   // graphique pollution
let marqueurZones  = [];     // marqueurs sur carte
let marqueurTrafic = [];     // marqueurs trafic

// ─── Utilitaire fetch ───────────────────────────────────
async function fetchAPI(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error("Erreur API :", url, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
//  HORLOGE
// ═══════════════════════════════════════════════════════
function demarrerHorloge() {
  function maj() {
    const el = document.getElementById("clock");
    if (el) el.textContent = new Date().toLocaleTimeString("fr-FR");
  }
  maj();
  setInterval(maj, 1000);
}

// ═══════════════════════════════════════════════════════
//  NAVIGATION — onglets
// ═══════════════════════════════════════════════════════
function showTab(nom, btn) {
  document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + nom).classList.remove("hidden");
  btn.classList.add("active");

  // Initialiser la carte trafic uniquement quand on arrive sur cet onglet
  if (nom === "trafic" && !carteTrafic) {
    setTimeout(() => initialiserCarteTrafic(), 100);
  }
}

// ═══════════════════════════════════════════════════════
//  KPI — statistiques globales
// ═══════════════════════════════════════════════════════
async function chargerStats() {
  const data = await fetchAPI("/api/stats");
  if (!data) return;

  // Score sécurité
  const elScore = document.getElementById("kpi-score");
  const elNote  = document.getElementById("kpi-score-note");
  if (elScore) elScore.textContent = data.score_securite;
  if (elNote) {
    if (data.score_securite >= 80)      elNote.textContent = "↑ Niveau élevé";
    else if (data.score_securite >= 60) elNote.textContent = "→ Niveau moyen";
    else                                elNote.textContent = "↓ Niveau faible";
  }

  // Trafic
  const elTrafic     = document.getElementById("kpi-trafic");
  const elTraficNote = document.getElementById("kpi-trafic-note");
  if (elTrafic) elTrafic.textContent = data.trafic_pct + "%";
  if (elTraficNote) {
    if (data.trafic_pct >= 75)      elTraficNote.textContent = "⚠ Trafic critique";
    else if (data.trafic_pct >= 50) elTraficNote.textContent = "→ Trafic modéré";
    else                            elTraficNote.textContent = "✓ Trafic fluide";
  }

  // Alertes
  const elAlertes = document.getElementById("kpi-alertes");
  if (elAlertes) elAlertes.textContent = data.alertes_actives;
  const navBadge = document.getElementById("nav-badge-alertes");
  if (navBadge) navBadge.textContent = data.alertes_actives;

  // IQA
  const elIqa     = document.getElementById("kpi-iqa");
  const elIqaNote = document.getElementById("kpi-iqa-note");
  if (elIqa) elIqa.textContent = data.iqa;
  if (elIqaNote) {
    if (data.iqa <= 50)       elIqaNote.textContent = "🟢 Bon";
    else if (data.iqa <= 100) elIqaNote.textContent = "🟡 Modéré";
    else                      elIqaNote.textContent = "🔴 Mauvais";
  }

  // Température & humidité dans le header
  const elTemp = document.getElementById("h-temp");
  const elHum  = document.getElementById("h-hum");
  if (elTemp) elTemp.textContent = data.temperature + "°C";
  if (elHum)  elHum.textContent  = data.humidite + "%";

  // Heure de mise à jour
  const elUpdate = document.getElementById("last-update");
  if (elUpdate) elUpdate.textContent = "Mis à jour à " + data.heure;
}

// ═══════════════════════════════════════════════════════
//  CARTE RABAT — Leaflet (dashboard)
// ═══════════════════════════════════════════════════════
function initialiserCarte() {
  const el = document.getElementById("map");
  if (!el || carteRabat) return;

  // Centrer sur Rabat
  carteRabat = L.map("map", {
    center: [34.0209, -6.8416],
    zoom: 13,
    zoomControl: true,
    attributionControl: false,
  });

  // Tuile sombre (style proche de Google Maps dark)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(carteRabat);

  // Charger les zones dessus
  chargerZonesCarte();
}

async function chargerZonesCarte() {
  const zones = await fetchAPI("/api/zones");
  if (!zones || !carteRabat) return;

  // Supprimer anciens marqueurs
  marqueurZones.forEach(m => carteRabat.removeLayer(m));
  marqueurZones = [];

  zones.forEach(zone => {
    const couleur = zone.statut === "safe"
      ? "#2FFFB4"
      : zone.statut === "warning"
      ? "#FFB830"
      : "#FF4B6E";

    const icone = L.divIcon({
      className: "",
      html: `
        <div style="
          background:${couleur}22;
          border:2px solid ${couleur};
          border-radius:10px;
          padding:5px 10px;
          color:${couleur};
          font-size:11px;
          font-weight:700;
          font-family:Inter,sans-serif;
          white-space:nowrap;
          box-shadow:0 0 12px ${couleur}44;
          backdrop-filter:blur(4px);
        ">
          ${zone.nom}<br>
          <span style="font-family:Orbitron,monospace;font-size:13px;">${zone.score}</span>
        </div>`,
      iconAnchor: [45, 20],
    });

    const m = L.marker([zone.lat, zone.lng], { icon: icone })
      .addTo(carteRabat)
      .bindPopup(`
        <b>${zone.nom}</b><br>
        Score sécurité : <b>${zone.score}/100</b><br>
        Statut : <b style="color:${couleur}">${zone.statut}</b>
      `);

    marqueurZones.push(m);
  });
}

// ═══════════════════════════════════════════════════════
//  CARTE TRAFIC — Leaflet (onglet trafic)
// ═══════════════════════════════════════════════════════
function initialiserCarteTrafic() {
  const el = document.getElementById("map-trafic");
  if (!el || carteTrafic) return;

  carteTrafic = L.map("map-trafic", {
    center: [34.0209, -6.8416],
    zoom: 13,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(carteTrafic);

  chargerMarqueursTrafic();
}

async function chargerMarqueursTrafic() {
  const axes = await fetchAPI("/api/trafic");
  if (!axes || !carteTrafic) return;

  marqueurTrafic.forEach(m => carteTrafic.removeLayer(m));
  marqueurTrafic = [];

  axes.forEach(axe => {
    const couleur = axe.statut === "fluide"
      ? "#2FFFB4"
      : axe.statut === "lent"
      ? "#FFB830"
      : "#FF4B6E";

    const emoji = axe.statut === "fluide" ? "🟢" : axe.statut === "lent" ? "🟡" : "🔴";

    const icone = L.divIcon({
      className: "",
      html: `
        <div style="
          background:${couleur}22;
          border:2px solid ${couleur};
          border-radius:8px;
          padding:4px 9px;
          color:${couleur};
          font-size:10px;
          font-weight:700;
          font-family:Inter,sans-serif;
          white-space:nowrap;
          box-shadow:0 0 10px ${couleur}44;
        ">
          ${emoji} ${axe.saturation}%
        </div>`,
      iconAnchor: [30, 15],
    });

    const m = L.marker([axe.lat, axe.lng], { icon: icone })
      .addTo(carteTrafic)
      .bindPopup(`
        <b>${axe.nom}</b><br>
        Saturation : <b>${axe.saturation}%</b><br>
        État : <b style="color:${couleur}">${axe.statut}</b><br>
        ${axe.incident ? "⚠ " + axe.incident : ""}
      `);

    marqueurTrafic.push(m);
  });
}

// ═══════════════════════════════════════════════════════
//  ALERTES
// ═══════════════════════════════════════════════════════
const ICONES_TYPE = {
  danger:  "ti-flame",
  warning: "ti-cloud-storm",
  info:    "ti-users",
  success: "ti-circle-check",
};

function creerAlerte(a) {
  const div = document.createElement("div");
  div.className = "alerte " + a.type;
  const icone = ICONES_TYPE[a.type] || "ti-alert-circle";
  const ia    = a.ia ? `<span>· IA : ${a.ia}</span>` : "";
  div.innerHTML = `
    <i class="ti ${icone}"></i>
    <div class="alerte-body">
      <strong>${a.icone} ${a.titre}</strong>
      ${a.lieu}
      <div class="alerte-meta">${a.age} ${ia}</div>
    </div>`;
  return div;
}

async function chargerAlertesDash() {
  const alertes = await fetchAPI("/api/alertes");
  if (!alertes) return;
  const el = document.getElementById("alertes-dash");
  if (!el) return;
  el.innerHTML = "";
  alertes.slice(0, 3).forEach(a => el.appendChild(creerAlerte(a)));
}

async function chargerAlertesAll() {
  const alertes = await fetchAPI("/api/alertes");
  if (!alertes) return;
  const el = document.getElementById("alertes-all");
  if (!el) return;
  el.innerHTML = "";
  alertes.forEach(a => el.appendChild(creerAlerte(a)));
}

// ═══════════════════════════════════════════════════════
//  GRAPHIQUE SÉCURITÉ — 7 jours
// ═══════════════════════════════════════════════════════
async function creerGraphiqueSecurite() {
  const canvas = document.getElementById("safetyChart");
  if (!canvas) return;

  const data = await fetchAPI("/api/historique_securite");
  const labels = data ? data.jours   : ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const scores = data ? data.scores  : [74, 78, 75, 80, 79, 83, 84];

  if (chartSecurite) chartSecurite.destroy();

  chartSecurite = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Score sécurité",
        data: scores,
        borderColor: "#2FFFB4",
        backgroundColor: "rgba(47,255,180,0.07)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#2FFFB4",
        pointBorderColor: "#0D1B2E",
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 9,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(13,27,46,0.95)",
          borderColor: "rgba(77,217,232,0.4)",
          borderWidth: 1,
          titleColor: "#4DD9E8",
          bodyColor: "#E8F4F8",
        },
      },
      scales: {
        y: {
          min: 55, max: 100,
          grid: { color: "rgba(77,217,232,0.07)" },
          ticks: { color: "#7A9BB0", font: { size: 11 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#7A9BB0", font: { size: 11 } },
        },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════
//  TRAFIC — liste + barres
// ═══════════════════════════════════════════════════════
async function chargerTrafic() {
  const axes = await fetchAPI("/api/trafic");
  if (!axes) return;

  // ── Liste
  const liste = document.getElementById("traffic-list");
  if (liste) {
    liste.innerHTML = "";
    const couleurs = { fluide: "#2FFFB4", lent: "#FFB830", "bloqué": "#FF4B6E" };
    axes.forEach(a => {
      const c   = couleurs[a.statut] || "#888";
      const div = document.createElement("div");
      div.className = "traf-item";
      div.innerHTML = `
        <i class="ti ti-road traf-icon" style="color:${c}"></i>
        <div class="traf-info">
          <div class="traf-nom">${a.nom}</div>
          <div class="traf-sub">${a.incident || "Aucun incident signalé"}</div>
        </div>
        <span class="badge ${a.statut === "bloqué" ? "bloque" : a.statut}">
          ${a.statut.charAt(0).toUpperCase() + a.statut.slice(1)}
        </span>`;
      liste.appendChild(div);
    });
  }

  // ── Barres
  const barres = document.getElementById("traffic-bars");
  if (barres) {
    barres.innerHTML = "";
    axes.forEach(a => {
      const c   = a.saturation >= 78 ? "#FF4B6E" : a.saturation >= 52 ? "#FFB830" : "#2FFFB4";
      const nom = a.nom.split(" ").slice(0, 3).join(" ");
      const div = document.createElement("div");
      div.className = "bar-row";
      div.innerHTML = `
        <div class="bar-label">${nom}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${a.saturation}%;background:linear-gradient(90deg,${c}99,${c});box-shadow:0 0 8px ${c}66;"></div>
        </div>
        <div class="bar-val" style="color:${c}">${a.saturation}%</div>`;
      barres.appendChild(div);
    });
  }

  // Mettre à jour la carte trafic si elle existe
  if (carteTrafic) chargerMarqueursTrafic();
}

// ═══════════════════════════════════════════════════════
//  SÉCURITÉ — zones + caméras
// ═══════════════════════════════════════════════════════
async function chargerZonesSecurite() {
  const zones = await fetchAPI("/api/zones");
  if (!zones) return;
  const el = document.getElementById("zones-list");
  if (!el) return;
  el.innerHTML = "";

  zones.forEach(z => {
    const couleur = z.statut === "safe" ? "#2FFFB4" : z.statut === "warning" ? "#FFB830" : "#FF4B6E";
    const icone   = z.statut === "safe" ? "ti-circle-check" : z.statut === "warning" ? "ti-alert-circle" : "ti-circle-x";
    const div = document.createElement("div");
    div.className = "zone-row";
    div.innerHTML = `
      <i class="ti ${icone}" style="color:${couleur}"></i>
      <div class="zone-nom">${z.nom}</div>
      <div class="zone-bar">
        <div class="zone-bar-fill" style="width:${z.score}%;background:${couleur};"></div>
      </div>
      <div class="zone-score" style="color:${couleur}">${z.score}</div>`;
    el.appendChild(div);
  });
}

async function chargerCameras() {
  const cameras = await fetchAPI("/api/cameras");
  if (!cameras) return;
  const el = document.getElementById("cameras-list");
  if (!el) return;
  el.innerHTML = "";

  const statuts = {
    safe:    { badge: "fluide",  label: "Normal",    couleur: "#2FFFB4" },
    warning: { badge: "lent",    label: "Attention",  couleur: "#FFB830" },
    danger:  { badge: "bloque",  label: "Actif",      couleur: "#FF4B6E" },
  };

  cameras.forEach(c => {
    const s = statuts[c.statut] || statuts.safe;
    const div = document.createElement("div");
    div.className = "cam-row";
    div.innerHTML = `
      <i class="ti ti-video"></i>
      <div class="cam-info">
        <div class="cam-id">${c.id} — ${c.lieu}</div>
        <div class="cam-det" style="color:${s.couleur}">${c.detection}</div>
      </div>
      <span class="badge ${s.badge}">${s.label}</span>`;
    el.appendChild(div);
  });
}

// ═══════════════════════════════════════════════════════
//  POLLUTION
// ═══════════════════════════════════════════════════════
async function chargerPollution() {
  const data = await fetchAPI("/api/pollution");
  if (!data) return;

  const elIqa     = document.getElementById("poll-iqa");
  const elNote    = document.getElementById("poll-iqa-note");
  const elPm      = document.getElementById("poll-pm25");
  const elEnergie = document.getElementById("poll-energie");

  if (elIqa)     elIqa.textContent     = data.iqa_global;
  if (elPm)      elPm.textContent      = data.pm25;
  if (elEnergie) elEnergie.textContent = data.energie_pct + "%";
  if (elNote) {
    if (data.iqa_global <= 50)       elNote.textContent = "🟢 Bon";
    else if (data.iqa_global <= 100) elNote.textContent = "🟡 Modéré";
    else                             elNote.textContent = "🔴 Mauvais";
  }

  // Graphique
  const canvas = document.getElementById("airChart");
  if (canvas) {
    if (chartAir) chartAir.destroy();
    chartAir = new Chart(canvas, {
      type: "line",
      data: {
        labels: data.historique.heures,
        datasets: [{
          label: "IQA",
          data: data.historique.iqa,
          borderColor: "#4DA6FF",
          backgroundColor: "rgba(77,166,255,0.07)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#4DA6FF",
          pointBorderColor: "#0D1B2E",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(13,27,46,0.95)",
            borderColor: "rgba(77,217,232,0.4)",
            borderWidth: 1,
            titleColor: "#4DD9E8",
            bodyColor: "#E8F4F8",
          },
        },
        scales: {
          y: {
            min: 0, max: 100,
            grid: { color: "rgba(77,217,232,0.07)" },
            ticks: { color: "#7A9BB0", font: { size: 11 } },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#7A9BB0", font: { size: 11 } },
          },
        },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════
//  BOUTON SOS
// ═══════════════════════════════════════════════════════
async function envoyerSOS(type) {
  const data = await fetchAPI("/api/sos/" + encodeURIComponent(type));
  const el   = document.getElementById("sos-confirm");
  if (!el) return;
  el.textContent = data
    ? `✓ ${data.message} (Réf: ${data.reference})`
    : "✓ Alerte envoyée !";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

// ═══════════════════════════════════════════════════════
//  MISE À JOUR AUTOMATIQUE toutes les 10 secondes
// ═══════════════════════════════════════════════════════
async function rafraichir() {
  await chargerStats();
  await chargerAlertesDash();
  await chargerAlertesAll();
  await chargerTrafic();
  await chargerZonesSecurite();
  await chargerZonesCarte();       // met à jour les marqueurs sur la carte
}

// ═══════════════════════════════════════════════════════
//  INITIALISATION AU CHARGEMENT
// ═══════════════════════════════════════════════════════
async function init() {
  demarrerHorloge();

  // Dashboard
  await chargerStats();
  await chargerAlertesDash();
  await creerGraphiqueSecurite();

  // Initialiser la vraie carte Rabat
  initialiserCarte();

  // Trafic (liste + barres)
  await chargerTrafic();

  // Alertes
  await chargerAlertesAll();

  // Sécurité
  await chargerZonesSecurite();
  await chargerCameras();

  // Pollution
  await chargerPollution();

  // Mise à jour automatique toutes les 10 secondes
  setInterval(rafraichir, 10000);
}

// Lancer quand la page est chargée
document.addEventListener("DOMContentLoaded", init);
