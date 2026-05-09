from flask import Flask, render_template, jsonify
import random
import datetime
import requests

app = Flask(__name__)

# ─────────────────────────────────────────────
#  CONFIG API
# ─────────────────────────────────────────────

API_KEY = "acc9da4d355fbf47498cb77372f9102f"

LAT_RABAT = 34.0209
LON_RABAT = -6.8416

# ─────────────────────────────────────────────
#  Simulation intelligente selon l'heure
# ─────────────────────────────────────────────

def heure():
    return datetime.datetime.now().hour

def facteur_trafic():
    h = heure()

    if 7 <= h <= 9 or 17 <= h <= 19:
        return random.uniform(0.80, 0.95)

    elif 12 <= h <= 14:
        return random.uniform(0.55, 0.70)

    elif 0 <= h <= 5:
        return random.uniform(0.05, 0.18)

    else:
        return random.uniform(0.30, 0.55)

# ─────────────────────────────────────────────
#  DONNÉES
# ─────────────────────────────────────────────

ZONES = [
    {"nom": "Agdal",       "score_base": 91, "lat": 33.9911, "lng": -6.8527},
    {"nom": "Souissi",     "score_base": 88, "lat": 33.9878, "lng": -6.8267},
    {"nom": "Hay Riad",    "score_base": 63, "lat": 33.9600, "lng": -6.8700},
    {"nom": "Hassan II",   "score_base": 55, "lat": 34.0130, "lng": -6.8326},
    {"nom": "Akkari",      "score_base": 75, "lat": 34.0200, "lng": -6.8650},
    {"nom": "Takaddoum",   "score_base": 68, "lat": 34.0050, "lng": -6.8200},
    {"nom": "Océan",       "score_base": 82, "lat": 34.0060, "lng": -6.8600},
    {"nom": "Rabat Ville", "score_base": 78, "lat": 34.0209, "lng": -6.8416},
]

AXES_TRAFIC = [
    {
        "nom": "Avenue Hassan II",
        "sat_base": 85,
        "lat": 34.0130,
        "lng": -6.8326
    },
    {
        "nom": "Route de Casablanca",
        "sat_base": 70,
        "lat": 33.9750,
        "lng": -6.8500
    },
    {
        "nom": "Boulevard Al Amir Fal",
        "sat_base": 60,
        "lat": 34.0080,
        "lng": -6.8550
    },
    {
        "nom": "Avenue Mohamed V",
        "sat_base": 35,
        "lat": 34.0150,
        "lng": -6.8380
    },
    {
        "nom": "Autoroute A1 — Salé",
        "sat_base": 20,
        "lat": 34.0400,
        "lng": -6.8100
    },
    {
        "nom": "Avenue Fal Ould Oumeir",
        "sat_base": 50,
        "lat": 33.9950,
        "lng": -6.8450
    },
]

ALERTES_POOL = [
    {
        "type": "danger",
        "icone": "🔴",
        "titre": "Incendie signalé",
        "lieu": "Av. Allal El Fassi, Agdal",
        "ia": "94%"
    },
    {
        "type": "danger",
        "icone": "🔴",
        "titre": "Accident — blessés légers",
        "lieu": "Avenue Hassan II",
        "ia": "88%"
    },
    {
        "type": "warning",
        "icone": "🟡",
        "titre": "Pluies fortes prévues",
        "lieu": "Hay Riad, Takaddoum",
        "ia": ""
    },
    {
        "type": "warning",
        "icone": "🟡",
        "titre": "Travaux — circulation",
        "lieu": "Boulevard Al Amir Fal",
        "ia": ""
    },
    {
        "type": "info",
        "icone": "🔵",
        "titre": "Rassemblement détecté",
        "lieu": "Place du Méchouar",
        "ia": "79%"
    },
    {
        "type": "success",
        "icone": "🟢",
        "titre": "Panne électrique résolue",
        "lieu": "Quartier Akkari",
        "ia": ""
    },
]

CAMERAS = [
    {
        "id": "Cam-01",
        "lieu": "Place du Méchouar",
        "detection": "Foule dense détectée",
        "statut": "warning"
    },
    {
        "id": "Cam-02",
        "lieu": "Avenue Hassan II",
        "detection": "Accident — IA confidence 88%",
        "statut": "danger"
    },
    {
        "id": "Cam-03",
        "lieu": "Agdal Centre",
        "detection": "Aucun incident — Normal",
        "statut": "safe"
    },
    {
        "id": "Cam-04",
        "lieu": "Souissi",
        "detection": "Aucun incident — Normal",
        "statut": "safe"
    },
    {
        "id": "Cam-05",
        "lieu": "Hay Riad",
        "detection": "Véhicule suspect signalé",
        "statut": "warning"
    },
]

INCIDENTS = [
    "Accident signalé",
    "Circulation dense",
    "Travaux en cours",
    "Flux normal",
    "Ralentissement",
    "Embouteillage",
    "Route fluide"
]

# ─────────────────────────────────────────────
#  ROUTE PRINCIPALE
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

# ─────────────────────────────────────────────
#  STATS GLOBALES
# ─────────────────────────────────────────────

@app.route("/api/stats")
def stats():

    # Météo réelle
    weather_url = (
        f"https://api.openweathermap.org/data/2.5/weather"
        f"?lat={LAT_RABAT}&lon={LON_RABAT}"
        f"&units=metric&appid={API_KEY}"
    )

    weather_data = requests.get(weather_url).json()

    temperature = round(weather_data["main"]["temp"])
    humidite = weather_data["main"]["humidity"]

    # Pollution réelle
    pollution_url = (
        f"https://api.openweathermap.org/data/2.5/air_pollution"
        f"?lat={LAT_RABAT}&lon={LON_RABAT}"
        f"&appid={API_KEY}"
    )

    pollution_data = requests.get(pollution_url).json()

    air = pollution_data["list"][0]

    aqi_openweather = air["main"]["aqi"]

    iqa = {
        1: 25,
        2: 50,
        3: 75,
        4: 100,
        5: 130
    }.get(aqi_openweather, 50)

    # Simulation intelligente sécurité
    tf = facteur_trafic()

    score = round(
        100 - tf * 28 - iqa * 0.18 + random.uniform(-2, 2)
    )

    score = max(40, min(99, score))

    return jsonify({
        "score_securite": score,
        "trafic_pct": round(tf * 100),
        "alertes_actives": random.randint(3, 7),
        "iqa": iqa,
        "temperature": temperature,
        "humidite": humidite,
        "heure": datetime.datetime.now().strftime("%H:%M:%S"),
    })

# ─────────────────────────────────────────────
#  ZONES
# ─────────────────────────────────────────────

@app.route("/api/zones")
def zones():

    result = []

    for z in ZONES:

        score = max(
            35,
            min(100, z["score_base"] + random.randint(-4, 4))
        )

        statut = (
            "safe"
            if score >= 75
            else ("warning" if score >= 55 else "danger")
        )

        result.append({
            "nom": z["nom"],
            "score": score,
            "statut": statut,
            "lat": z["lat"],
            "lng": z["lng"]
        })

    return jsonify(result)

# ─────────────────────────────────────────────
#  TRAFIC
# ─────────────────────────────────────────────

@app.route("/api/trafic")
def trafic():

    tf = facteur_trafic()

    result = []

    for a in AXES_TRAFIC:

        sat = round(
            min(
                100,
                max(
                    5,
                    a["sat_base"] * tf / 0.6 + random.uniform(-8, 8)
                )
            )
        )

        statut = (
            "bloqué"
            if sat >= 78
            else ("lent" if sat >= 52 else "fluide")
        )

        result.append({
            "nom": a["nom"],
            "saturation": sat,
            "statut": statut,
            "incident": random.choice(INCIDENTS),
            "lat": a["lat"],
            "lng": a["lng"]
        })

    return jsonify(result)

# ─────────────────────────────────────────────
#  ALERTES
# ─────────────────────────────────────────────

@app.route("/api/alertes")
def alertes():

    result = []

    for i, a in enumerate(ALERTES_POOL):

        mins = i * 7 + random.randint(0, 5)

        age = (
            f"il y a {mins} min"
            if mins < 60
            else f"il y a {mins//60}h{mins%60:02d}"
        )

        entry = dict(a)
        entry["age"] = age

        result.append(entry)

    return jsonify(result)

# ─────────────────────────────────────────────
#  CAMÉRAS
# ─────────────────────────────────────────────

@app.route("/api/cameras")
def cameras():
    return jsonify(CAMERAS)

# ─────────────────────────────────────────────
#  POLLUTION + MÉTÉO RÉELLES
# ─────────────────────────────────────────────

@app.route("/api/pollution")
def pollution():

    pollution_url = (
        f"https://api.openweathermap.org/data/2.5/air_pollution"
        f"?lat={LAT_RABAT}&lon={LON_RABAT}&appid={API_KEY}"
    )

    pollution_data = requests.get(pollution_url).json()

    air = pollution_data["list"][0]

    pm25 = round(air["components"]["pm2_5"])
    no2 = round(air["components"]["no2"])

    aqi_openweather = air["main"]["aqi"]

    iqa_global = {
        1: 25,
        2: 50,
        3: 75,
        4: 100,
        5: 130
    }.get(aqi_openweather, 50)

    # météo réelle
    weather_url = (
        f"https://api.openweathermap.org/data/2.5/weather"
        f"?lat={LAT_RABAT}&lon={LON_RABAT}"
        f"&units=metric&appid={API_KEY}"
    )

    weather_data = requests.get(weather_url).json()

    temperature = round(weather_data["main"]["temp"])
    humidite = weather_data["main"]["humidity"]

    heures = ["3h","6h","9h","12h","15h","18h","21h","23h"]

    vals = [
        max(
            10,
            min(
                140,
                iqa_global + random.randint(-15, 15)
            )
        )
        for _ in range(8)
    ]

    return jsonify({
        "iqa_global": iqa_global,
        "pm25": pm25,
        "no2": no2,
        "temperature": temperature,
        "humidite": humidite,
        "energie_pct": random.randint(72, 91),
        "historique": {
            "heures": heures,
            "iqa": vals
        }
    })

# ─────────────────────────────────────────────
#  SOS
# ─────────────────────────────────────────────

@app.route("/api/sos/<type_urgence>")
def sos(type_urgence):

    heure_str = datetime.datetime.now().strftime("%H:%M:%S")

    ref = f"SOS-{random.randint(1000,9999)}"

    print(f"🚨 [{heure_str}] SOS : {type_urgence} — Réf {ref}")

    return jsonify({
        "statut": "reçu",
        "message": f"Alerte '{type_urgence}' transmise.",
        "heure": heure_str,
        "reference": ref
    })

# ─────────────────────────────────────────────
#  HISTORIQUE SÉCURITÉ
# ─────────────────────────────────────────────

@app.route("/api/historique_securite")
def historique_securite():

    jours = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"]

    scores = [
        max(
            60,
            min(99, s + random.randint(-2, 2))
        )
        for s in [74,78,75,80,79,83,84]
    ]

    return jsonify({
        "jours": jours,
        "scores": scores
    })

# ─────────────────────────────────────────────
#  LANCEMENT
# ─────────────────────────────────────────────

if __name__ == "__main__":

    print("=" * 52)
    print("  🌆 CityEye — Serveur démarré")
    print("  👉 http://127.0.0.1:5000")
    print("=" * 52)

    app.run(debug=True)