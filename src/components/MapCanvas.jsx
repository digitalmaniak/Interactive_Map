"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Pre-defined visited travel locations
const initialPins = [
  { id: "p1", name: "Tokyo Outing", city: "Tokyo, Japan", lat: 35.6762, lon: 139.6503, date: "2025-01-29", details: "Explored Tsukiji Outer Market early morning. Incredible sushi and street food options!" },
  { id: "p2", name: "Paris Memories", city: "Paris, France", lat: 48.8566, lon: 2.3522, date: "2024-09-15", details: "Bistro lunch near Notre Dame. Visited the Louvre museum and walked along the Seine at sunset." },
  { id: "p3", name: "Manhattan Outing", city: "New York, USA", lat: 40.7128, lon: -74.0060, date: "2024-11-04", details: "Walked across the Brooklyn Bridge. Explored West Village cozy restaurants and jazz clubs." },
  { id: "p4", name: "Rome Journal", city: "Rome, Italy", lat: 41.9028, lon: 12.4964, date: "2024-06-20", details: "Amazing pasta carbonara in Trastevere. Visited the Colosseum and Roman Forum early in the morning." },
  { id: "p5", name: "Sydney Coastal Walk", city: "Sydney, Australia", lat: -33.8688, lon: 151.2093, date: "2025-03-10", details: "Bondi to Bronte coastal walk. Saw humpback whales migrating from the cliffs. Spectacular views!" }
];

// Pastel color palette for countries (paper-craft map look)
const countryColors = [
  "#d8e2dc", // Soft sage
  "#ffe5d9", // Pale peach
  "#ffcad4", // Soft rose pink
  "#f4acb7", // Warm pinkish-cream
  "#eae2b7", // Soft parchment/sand
  "#b5e2fa", // Soft sky blue
  "#c5dedd"  // Soft light teal
];

// Major capital city coordinates dictionary
const capitals = {
  "AFG": { lat: 34.5553, lon: 69.1775 }, // Kabul
  "AGO": { lat: -8.8368, lon: 13.2343 }, // Luanda
  "ALB": { lat: 41.3275, lon: 19.8187 }, // Tirana
  "ARE": { lat: 24.4539, lon: 54.3773 }, // Abu Dhabi
  "ARG": { lat: -34.6037, lon: -58.3816 }, // Buenos Aires
  "ARM": { lat: 40.1792, lon: 44.4991 }, // Yerevan
  "ATA": { lat: -75.2509, lon: 0.0380 }, // Amundsen-Scott (Antarctica)
  "AUS": { lat: -35.2809, lon: 149.1300 }, // Canberra
  "AUT": { lat: 48.2082, lon: 16.3738 }, // Vienna
  "AZE": { lat: 40.4093, lon: 49.8671 }, // Baku
  "BDI": { lat: -3.3822, lon: 29.3644 }, // Bujumbura
  "BEL": { lat: 50.8503, lon: 4.3517 }, // Brussels
  "BEN": { lat: 6.4969, lon: 2.6281 }, // Porto-Novo
  "BFA": { lat: 12.3714, lon: -1.5197 }, // Ouagadougou
  "BGD": { lat: 23.8103, lon: 90.4125 }, // Dhaka
  "BGR": { lat: 42.6977, lon: 23.3219 }, // Sofia
  "BHS": { lat: 25.0475, lon: -77.3554 }, // Nassau
  "BIH": { lat: 43.8563, lon: 18.4131 }, // Sarajevo
  "BLR": { lat: 53.9006, lon: 27.5590 }, // Minsk
  "BLZ": { lat: 17.2510, lon: -88.7669 }, // Belmopan
  "BMU": { lat: 32.2948, lon: -64.7814 }, // Hamilton
  "BOL": { lat: -16.4897, lon: -68.1193 }, // La Paz
  "BRA": { lat: -15.7938, lon: -47.8828 }, // Brasilia
  "BRN": { lat: 4.8903, lon: 114.9404 }, // Bandar Seri Begawan
  "BTN": { lat: 27.4728, lon: 89.6393 }, // Thimphu
  "BWA": { lat: -24.6282, lon: 25.9231 }, // Gaborone
  "CAF": { lat: 4.3947, lon: 18.5582 }, // Bangui
  "CAN": { lat: 45.4215, lon: -75.6972 }, // Ottawa
  "CHE": { lat: 46.9480, lon: 7.4474 }, // Bern
  "CHL": { lat: -33.4489, lon: -70.6693 }, // Santiago
  "CHN": { lat: 39.9042, lon: 116.4074 }, // Beijing
  "CIV": { lat: 6.8276, lon: -5.2797 }, // Yamoussoukro
  "CMR": { lat: 3.8480, lon: 11.5021 }, // Yaounde
  "COD": { lat: -4.4419, lon: 15.2663 }, // Kinshasa
  "COG": { lat: -4.2634, lon: 15.2832 }, // Brazzaville
  "COL": { lat: 4.7110, lon: -74.0721 }, // Bogota
  "CRI": { lat: 9.9281, lon: -84.0907 }, // San Jose
  "CUB": { lat: 23.1136, lon: -82.3666 }, // Havana
  "CYP": { lat: 35.1856, lon: 33.3823 }, // Nicosia
  "CZE": { lat: 50.0755, lon: 14.4378 }, // Prague
  "DEU": { lat: 52.5200, lon: 13.4050 }, // Berlin
  "DJI": { lat: 11.5880, lon: 43.1450 }, // Djibouti
  "DNK": { lat: 55.6761, lon: 12.5683 }, // Copenhagen
  "DOM": { lat: 18.4861, lon: -69.9312 }, // Santo Domingo
  "DZA": { lat: 36.7538, lon: 3.0588 }, // Algiers
  "ECU": { lat: -0.1807, lon: -78.4678 }, // Quito
  "EGY": { lat: 30.0444, lon: 31.2357 }, // Cairo
  "ERI": { lat: 15.3229, lon: 38.8812 }, // Asmara
  "ESP": { lat: 40.4168, lon: -3.7038 }, // Madrid
  "EST": { lat: 59.4370, lon: 24.7536 }, // Tallinn
  "ETH": { lat: 9.0300, lon: 38.7400 }, // Addis Ababa
  "FIN": { lat: 60.1699, lon: 24.9384 }, // Helsinki
  "FJI": { lat: -18.1248, lon: 178.4501 }, // Suva
  "FLK": { lat: -51.6978, lon: -57.8517 }, // Stanley
  "FRA": { lat: 48.8566, lon: 2.3522 }, // Paris
  "GAB": { lat: 0.4162, lon: 9.4673 }, // Libreville
  "GBR": { lat: 51.5074, lon: -0.1278 }, // London
  "GEO": { lat: 41.7151, lon: 44.8271 }, // Tbilisi
  "GHA": { lat: 5.6037, lon: -0.1870 }, // Accra
  "GIN": { lat: 9.6412, lon: -13.5784 }, // Conakry
  "GMB": { lat: 13.4549, lon: -16.5790 }, // Banjul
  "GNB": { lat: 11.8817, lon: -15.6178 }, // Bissau
  "GNQ": { lat: 3.7504, lon: 8.7832 }, // Malabo
  "GRC": { lat: 37.9838, lon: 23.7275 }, // Athens
  "GRL": { lat: 64.1743, lon: -51.7373 }, // Nuuk
  "GTM": { lat: 14.6349, lon: -90.5069 }, // Guatemala City
  "GUY": { lat: 6.8013, lon: -58.1551 }, // Georgetown
  "HND": { lat: 14.0723, lon: -87.1921 }, // Tegucigalpa
  "HRV": { lat: 45.8150, lon: 15.9819 }, // Zagreb
  "HTI": { lat: 18.5944, lon: -72.3074 }, // Port-au-Prince
  "HUN": { lat: 47.4979, lon: 19.0402 }, // Budapest
  "IDN": { lat: -6.2088, lon: 106.8456 }, // Jakarta
  "IND": { lat: 28.6139, lon: 77.2090 }, // New Delhi
  "IRL": { lat: 53.3498, lon: -6.2603 }, // Dublin
  "IRN": { lat: 35.6892, lon: 51.3890 }, // Tehran
  "IRQ": { lat: 33.3152, lon: 44.3661 }, // Baghdad
  "ISL": { lat: 64.1466, lon: -21.9426 }, // Reykjavik
  "ISR": { lat: 31.7683, lon: 35.2137 }, // Jerusalem
  "ITA": { lat: 41.9028, lon: 12.4964 }, // Rome
  "JAM": { lat: 17.9712, lon: -76.7928 }, // Kingston
  "JOR": { lat: 31.9522, lon: 35.9101 }, // Amman
  "JPN": { lat: 35.6762, lon: 139.6503 }, // Tokyo
  "KAZ": { lat: 51.1694, lon: 71.4491 }, // Astana
  "KEN": { lat: -1.2921, lon: 36.8219 }, // Nairobi
  "KGZ": { lat: 42.8746, lon: 74.5698 }, // Bishkek
  "KHM": { lat: 11.5449, lon: 104.8922 }, // Phnom Penh
  "KOR": { lat: 37.5665, lon: 126.9780 }, // Seoul
  "KWT": { lat: 29.3759, lon: 47.9774 }, // Kuwait City
  "LAO": { lat: 17.9757, lon: 102.6331 }, // Vientiane
  "LBN": { lat: 33.8938, lon: 35.5018 }, // Beirut
  "LBR": { lat: 6.3156, lon: -10.8074 }, // Monrovia
  "LBY": { lat: 32.8790, lon: 13.1903 }, // Tripoli
  "LKA": { lat: 6.9271, lon: 79.8612 }, // Colombo
  "LSO": { lat: -29.3134, lon: 27.4844 }, // Maseru
  "LTU": { lat: 54.6872, lon: 25.2797 }, // Vilnius
  "LUX": { lat: 49.6116, lon: 6.1319 }, // Luxembourg
  "LVA": { lat: 56.9496, lon: 24.1052 }, // Riga
  "MAR": { lat: 34.0209, lon: -6.8416 }, // Rabat
  "MDA": { lat: 47.0105, lon: 28.8638 }, // Chisinau
  "MDG": { lat: -18.8792, lon: 47.5079 }, // Antananarivo
  "MEX": { lat: 19.4326, lon: -99.1332 }, // Mexico City
  "MKD": { lat: 41.9973, lon: 21.4280 }, // Skopje
  "MLI": { lat: 12.6500, lon: -8.0000 }, // Bamako
  "MMR": { lat: 19.7633, lon: 96.0785 }, // Naypyidaw
  "MNG": { lat: 47.8864, lon: 106.9057 }, // Ulaanbaatar
  "MOZ": { lat: -25.9692, lon: 32.5732 }, // Maputo
  "MRT": { lat: 18.0735, lon: -15.9582 }, // Nouakchott
  "MWI": { lat: -13.9626, lon: 33.7741 }, // Lilongwe
  "MYS": { lat: 3.1390, lon: 101.6869 }, // Kuala Lumpur
  "NAM": { lat: -22.5609, lon: 17.0658 }, // Windhoek
  "NCL": { lat: -22.2758, lon: 166.4580 }, // Noumea
  "NER": { lat: 13.5116, lon: 2.1254 }, // Niamey
  "NGA": { lat: 9.0765, lon: 7.3986 }, // Abuja
  "NIC": { lat: 12.1150, lon: -86.2362 }, // Managua
  "NLD": { lat: 52.3676, lon: 4.9041 }, // Amsterdam
  "NOR": { lat: 59.9139, lon: 10.7522 }, // Oslo
  "NPL": { lat: 27.7172, lon: 85.3240 }, // Kathmandu
  "NZL": { lat: -41.2865, lon: 174.7762 }, // Wellington
  "OMN": { lat: 23.5859, lon: 58.4059 }, // Muscat
  "PAK": { lat: 33.6844, lon: 73.0479 }, // Islamabad
  "PAN": { lat: 8.9824, lon: -79.5199 }, // Panama City
  "PER": { lat: -12.0464, lon: -77.0428 }, // Lima
  "PHL": { lat: 14.5995, lon: 120.9842 }, // Manila
  "PNG": { lat: -9.4438, lon: 147.1803 }, // Port Moresby
  "POL": { lat: 52.2297, lon: 21.0122 }, // Warsaw
  "PRI": { lat: 18.4655, lon: -66.1057 }, // San Juan
  "PRT": { lat: 38.7223, lon: -9.1393 }, // Lisbon
  "PRY": { lat: -25.2637, lon: -57.5759 }, // Asuncion
  "QAT": { lat: 25.2854, lon: 51.5310 }, // Doha
  "ROU": { lat: 44.4268, lon: 26.1025 }, // Bucharest
  "RUS": { lat: 55.7558, lon: 37.6173 }, // Moscow
  "RWA": { lat: -1.9403, lon: 30.0619 }, // Kigali
  "SAU": { lat: 24.7136, lon: 46.6753 }, // Riyadh
  "SDN": { lat: 15.5007, lon: 32.5599 }, // Khartoum
  "SEN": { lat: 14.7167, lon: -17.4667 }, // Dakar
  "SLB": { lat: -9.4280, lon: 159.9560 }, // Honiara
  "SLE": { lat: 8.4840, lon: -13.2299 }, // Freetown
  "SLV": { lat: 13.6988, lon: -89.1914 }, // San Salvador
  "SOM": { lat: 2.0408, lon: 45.3426 }, // Mogadishu
  "SRB": { lat: 44.7866, lon: 20.4489 }, // Belgrade
  "SUR": { lat: 5.8664, lon: -55.1668 }, // Paramaribo
  "SVK": { lat: 48.1486, lon: 17.1077 }, // Bratislava
  "SVN": { lat: 46.0569, lon: 14.5058 }, // Ljubljana
  "SWE": { lat: 59.3293, lon: 18.0686 }, // Stockholm
  "SWZ": { lat: -26.3055, lon: 31.1367 }, // Mbabane
  "SYR": { lat: 33.5138, lon: 36.2913 }, // Damascus
  "Tcd": { lat: 12.1348, lon: 15.0557 }, // N'Djamena
  "TGO": { lat: 6.1375, lon: 1.2123 }, // Lome
  "THA": { lat: 13.7563, lon: 100.5018 }, // Bangkok
  "TJK": { lat: 38.5358, lon: 68.7791 }, // Dushanbe
  "TKM": { lat: 37.9509, lon: 58.3820 }, // Ashgabat
  "TLS": { lat: -8.5579, lon: 125.5736 }, // Dili
  "TTO": { lat: 10.6667, lon: -61.5167 }, // Port of Spain
  "TUN": { lat: 36.8065, lon: 10.1815 }, // Tunis
  "TUR": { lat: 39.9334, lon: 32.8597 }, // Ankara
  "TZA": { lat: -6.1630, lon: 35.7516 }, // Dodoma
  "UGA": { lat: 0.3476, lon: 32.5825 }, // Kampala
  "UKR": { lat: 50.4501, lon: 30.5234 }, // Kyiv
  "URY": { lat: -34.9011, lon: -56.1645 }, // Montevideo
  "USA": { lat: 38.9072, lon: -77.0369 }, // Washington D.C.
  "UZB": { lat: 41.2995, lon: 69.2401 }, // Tashkent
  "VEN": { lat: 10.4806, lon: -66.9036 }, // Caracas
  "VNM": { lat: 21.0285, lon: 105.8542 }, // Hanoi
  "VUT": { lat: -17.7333, lon: 168.3270 }, // Port Vila
  "YEM": { lat: 15.3694, lon: 44.1910 }, // Sana'a
  "ZAF": { lat: -25.7479, lon: 28.1878 }, // Pretoria
  "ZMB": { lat: -15.3875, lon: 28.3228 }, // Lusaka
  "ZWE": { lat: -17.8252, lon: 31.0335 }  // Harare
};

// Country average elevations and primary biomes metadata (gathered from standard geography data)
const countryMetadata = {
  // North America
  "USA": { height: 1.2, biome: "forest" },
  "CAN": { height: 1.0, biome: "forest" },
  "MEX": { height: 1.4, biome: "desert" },
  "GRL": { height: 1.8, biome: "glacial" },

  // South America
  "BRA": { height: 0.8, biome: "forest" },
  "ARG": { height: 0.9, biome: "grassland" },
  "CHL": { height: 1.8, biome: "forest" },
  "PER": { height: 2.1, biome: "forest" },
  "COL": { height: 1.2, biome: "forest" },
  "VEN": { height: 0.9, biome: "forest" },
  "BOL": { height: 2.0, biome: "savanna" },
  "ECU": { height: 1.5, biome: "forest" },
  "PRY": { height: 0.6, biome: "savanna" },
  "URY": { height: 0.5, biome: "grassland" },
  "SUR": { height: 0.6, biome: "forest" },
  "GUY": { height: 0.7, biome: "forest" },

  // Europe
  "FRA": { height: 0.7, biome: "grassland" },
  "DEU": { height: 0.7, biome: "forest" },
  "GBR": { height: 0.6, biome: "grassland" },
  "ITA": { height: 1.0, biome: "forest" },
  "ESP": { height: 1.1, biome: "savanna" },
  "UKR": { height: 0.6, biome: "grassland" },
  "POL": { height: 0.6, biome: "forest" },
  "ROU": { height: 0.9, biome: "forest" },
  "NLD": { height: 0.3, biome: "grassland" },
  "BEL": { height: 0.5, biome: "grassland" },
  "CHE": { height: 2.2, biome: "glacial" },
  "AUT": { height: 1.5, biome: "forest" },
  "SWE": { height: 1.0, biome: "forest" },
  "NOR": { height: 1.5, biome: "glacial" },
  "FIN": { height: 0.7, biome: "forest" },
  "DNK": { height: 0.4, biome: "grassland" },
  "ISL": { height: 1.3, biome: "glacial" },
  "IRL": { height: 0.5, biome: "grassland" },
  "PRT": { height: 0.8, biome: "savanna" },
  "GRC": { height: 1.1, biome: "savanna" },

  // Asia
  "RUS": { height: 1.0, biome: "forest" },
  "CHN": { height: 1.8, biome: "forest" },
  "IND": { height: 0.9, biome: "savanna" },
  "JPN": { height: 1.5, biome: "forest" },
  "KOR": { height: 1.1, biome: "forest" },
  "KAZ": { height: 1.0, biome: "grassland" },
  "MNG": { height: 1.7, biome: "grassland" },
  "SAU": { height: 0.9, biome: "desert" },
  "IRN": { height: 1.5, biome: "desert" },
  "TUR": { height: 1.4, biome: "savanna" },
  "PAK": { height: 1.2, biome: "savanna" },
  "AFG": { height: 2.0, biome: "desert" },
  "NPL": { height: 2.8, biome: "glacial" },
  "BTN": { height: 2.8, biome: "forest" },
  "THA": { height: 0.5, biome: "forest" },
  "VNM": { height: 0.6, biome: "forest" },
  "IDN": { height: 0.7, biome: "forest" },
  "PHL": { height: 0.6, biome: "forest" },
  "MYS": { height: 0.8, biome: "forest" },
  "BGD": { height: 0.4, biome: "savanna" },
  "LKA": { height: 0.6, biome: "forest" },
  "IRQ": { height: 0.5, biome: "desert" },
  "SYR": { height: 0.8, biome: "desert" },
  "JOR": { height: 1.2, biome: "desert" },
  "ARE": { height: 0.5, biome: "desert" },
  "YEM": { height: 1.4, biome: "desert" },
  "OMN": { height: 0.9, biome: "desert" },

  // Africa
  "EGY": { height: 0.5, biome: "desert" },
  "ZAF": { height: 1.3, biome: "savanna" },
  "DZA": { height: 1.1, biome: "desert" },
  "LBY": { height: 0.6, biome: "desert" },
  "SDN": { height: 0.7, biome: "savanna" },
  "COD": { height: 0.8, biome: "forest" },
  "AGO": { height: 1.2, biome: "savanna" },
  "MDG": { height: 0.9, biome: "forest" },
  "ETH": { height: 2.1, biome: "savanna" },
  "KEN": { height: 1.4, biome: "savanna" },
  "TZA": { height: 1.2, biome: "savanna" },
  "NGA": { height: 0.7, biome: "forest" },
  "MAR": { height: 1.2, biome: "desert" },
  "MOZ": { height: 0.6, biome: "savanna" },
  "CIV": { height: 0.6, biome: "forest" },
  "GHA": { height: 0.5, biome: "forest" },
  "CMR": { height: 0.9, biome: "forest" },
  "SEN": { height: 0.4, biome: "savanna" },

  // Oceania
  "AUS": { height: 0.6, biome: "desert" },
  "NZL": { height: 1.4, biome: "forest" },
  "PNG": { height: 1.2, biome: "forest" },

  // Antarctica
  "ATA": { height: 2.5, biome: "glacial" }
};

const biomeColors = {
  glacial: "#f1f5f9",   // Polar white
  desert: "#fde047",    // Sunny desert yellow
  forest: "#4ade80",    // Vibrant forest green
  grassland: "#a7f3d0", // Soft mint green
  savanna: "#fed7aa"    // Warm peach/savanna
};

// Retrieve country height, color, and biome metadata
const getCountryMetadata = (countryCode, centroidLat) => {
  const meta = countryMetadata[countryCode];
  if (meta) {
    return {
      height: meta.height,
      color: new THREE.Color(biomeColors[meta.biome]),
      biome: meta.biome
    };
  }
  
  // Fallback based on latitude
  let biome = "forest";
  let height = 0.9;
  
  if (centroidLat > 55 || centroidLat < -50) {
    biome = "glacial";
    height = 1.1;
  } else if (Math.abs(centroidLat) >= 15 && Math.abs(centroidLat) <= 35) {
    biome = "desert";
    height = 0.7;
  } else if (Math.abs(centroidLat) < 15) {
    biome = "savanna";
    height = 0.8;
  }
  
  return {
    height,
    color: new THREE.Color(biomeColors[biome]),
    biome
  };
};

const createMountainGeometry = () => {
  const geom = new THREE.ConeGeometry(0.7, 1.4, 4);
  geom.translate(0, 0.7, 0); // pivot at base
  geom.rotateY(Math.PI / 4); // align corners nicely
  
  // Assign mountain rock color with white snow cap using vertex colors
  const count = geom.attributes.position.count;
  const colors = [];
  const pos = geom.attributes.position;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (y > 0.9) {
      colors.push(0.95, 0.95, 0.95); // White snow cap
    } else {
      colors.push(0.45, 0.50, 0.60); // Slate gray rock
    }
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geom;
};

const setMeshEmissive = (mesh, colorHex) => {
  if (!mesh || !mesh.material) return;
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => {
      if (mat.emissive) mat.emissive.setHex(colorHex);
    });
  } else {
    if (mesh.material.emissive) mesh.material.emissive.setHex(colorHex);
  }
};

// Geometry generators for trees
const createPineTreeGeometry = () => {
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 4);
  trunkGeo.translate(0, 0.3, 0);
  const trunkCount = trunkGeo.attributes.position.count;
  const trunkColors = [];
  for (let i = 0; i < trunkCount; i++) {
    trunkColors.push(0.47, 0.21, 0.06); // Brown
  }
  trunkGeo.setAttribute('color', new THREE.Float32BufferAttribute(trunkColors, 3));

  const leavesGeo = new THREE.ConeGeometry(0.35, 1.2, 4);
  leavesGeo.translate(0, 1.0, 0);
  const leavesCount = leavesGeo.attributes.position.count;
  const leavesColors = [];
  for (let i = 0; i < leavesCount; i++) {
    leavesColors.push(0.09, 0.39, 0.20); // Deep green
  }
  leavesGeo.setAttribute('color', new THREE.Float32BufferAttribute(leavesColors, 3));

  const trunkNonIndexed = trunkGeo.toNonIndexed();
  const leavesNonIndexed = leavesGeo.toNonIndexed();

  const mergedPos = new Float32Array(trunkNonIndexed.attributes.position.array.length + leavesNonIndexed.attributes.position.array.length);
  mergedPos.set(trunkNonIndexed.attributes.position.array);
  mergedPos.set(leavesNonIndexed.attributes.position.array, trunkNonIndexed.attributes.position.array.length);

  const mergedColor = new Float32Array(trunkNonIndexed.attributes.color.array.length + leavesNonIndexed.attributes.color.array.length);
  mergedColor.set(trunkNonIndexed.attributes.color.array);
  mergedColor.set(leavesNonIndexed.attributes.color.array, trunkNonIndexed.attributes.color.array.length);

  const mergedGeo = new THREE.BufferGeometry();
  mergedGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  mergedGeo.setAttribute('color', new THREE.BufferAttribute(mergedColor, 3));
  mergedGeo.computeVertexNormals();

  trunkGeo.dispose(); leavesGeo.dispose();
  trunkNonIndexed.dispose(); leavesNonIndexed.dispose();
  return mergedGeo;
};

const createPalmTreeGeometry = () => {
  const seg1 = new THREE.CylinderGeometry(0.08, 0.1, 0.4, 4);
  seg1.translate(0, 0.2, 0);
  
  const seg2 = new THREE.CylinderGeometry(0.07, 0.08, 0.4, 4);
  seg2.rotateZ(0.12);
  seg2.translate(0.02, 0.55, 0);

  const seg3 = new THREE.CylinderGeometry(0.06, 0.07, 0.4, 4);
  seg3.rotateZ(0.24);
  seg3.translate(0.08, 0.9, 0);

  const t1 = seg1.toNonIndexed();
  const t2 = seg2.toNonIndexed();
  const t3 = seg3.toNonIndexed();

  const trunkPos = new Float32Array(t1.attributes.position.array.length + t2.attributes.position.array.length + t3.attributes.position.array.length);
  trunkPos.set(t1.attributes.position.array);
  trunkPos.set(t2.attributes.position.array, t1.attributes.position.array.length);
  trunkPos.set(t3.attributes.position.array, t1.attributes.position.array.length + t2.attributes.position.array.length);

  const trunkColors = new Float32Array(trunkPos.length);
  for (let i = 0; i < trunkColors.length; i += 3) {
    trunkColors[i] = 0.63;
    trunkColors[i+1] = 0.38;
    trunkColors[i+2] = 0.03;
  }

  const frondGeos = [];
  for (let i = 0; i < 5; i++) {
    const frond = new THREE.BoxGeometry(0.6, 0.02, 0.15);
    frond.translate(0.25, 0, 0);
    frond.rotateY((i * Math.PI * 2) / 5);
    frond.rotateZ(-0.2);
    frond.translate(0.12, 1.1, 0);
    frondGeos.push(frond.toNonIndexed());
  }

  let frondsPosLength = 0;
  frondGeos.forEach(g => frondsPosLength += g.attributes.position.array.length);
  const frondsPos = new Float32Array(frondsPosLength);
  let offset = 0;
  frondGeos.forEach(g => {
    frondsPos.set(g.attributes.position.array, offset);
    offset += g.attributes.position.array.length;
  });

  const frondsColors = new Float32Array(frondsPos.length);
  for (let i = 0; i < frondsColors.length; i += 3) {
    frondsColors[i] = 0.13;
    frondsColors[i+1] = 0.77;
    frondsColors[i+2] = 0.36;
  }

  const finalPos = new Float32Array(trunkPos.length + frondsPos.length);
  finalPos.set(trunkPos);
  finalPos.set(frondsPos, trunkPos.length);

  const finalColor = new Float32Array(trunkColors.length + frondsColors.length);
  finalColor.set(trunkColors);
  finalColor.set(frondsColors, trunkColors.length);

  const mergedGeo = new THREE.BufferGeometry();
  mergedGeo.setAttribute('position', new THREE.BufferAttribute(finalPos, 3));
  mergedGeo.setAttribute('color', new THREE.BufferAttribute(finalColor, 3));
  mergedGeo.computeVertexNormals();

  seg1.dispose(); seg2.dispose(); seg3.dispose();
  t1.dispose(); t2.dispose(); t3.dispose();
  frondGeos.forEach(g => g.dispose());
  return mergedGeo;
};



export default function MapCanvas() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  // React States
  const [loadingProgress, setLoadingProgress] = useState(10);
  const [loadingLog, setLoadingLog] = useState("CONNECTING TO WORLD GEOMETRY ATLAS...");
  const [isLoaded, setIsLoaded] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState(null);
  
  // Interactive HUD States
  const [hoveredCountry, setHoveredCountry] = useState("Hover over map");
  const [clickedCoords, setClickedCoords] = useState({ lat: 0, lon: 0 });
  const [activePin, setActivePin] = useState(null);
  const [isAddingEntry, setIsAddingEntry] = useState(false);

  // Map Scale conversion factor (scaled up for higher resolution details)
  const mapScale = 8.0;

  // Coordinate Conversion Utility Functions
  const latLonToVector3 = (lat, lon, y = 0.8) => {
    const x = lon * mapScale;
    const z = -lat * mapScale;
    return new THREE.Vector3(x, y, z);
  };

  const vector3ToLatLon = (vec) => {
    const lon = vec.x / mapScale;
    const lat = -vec.z / mapScale;
    return { 
      lat: parseFloat(lat.toFixed(4)), 
      lon: parseFloat(lon.toFixed(4)) 
    };
  };

  // 1. Fetch GeoJSON Data on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isDataFetched = false;
    let progress = 10;

    const timer = setInterval(() => {
      progress += Math.floor(Math.random() * 5) + 2;
      if (progress >= 50 && !isDataFetched) {
        progress = 50; // Pause at 50% until data is fetched
      }
      if (progress > 95) {
        progress = 95;
      }
      setLoadingProgress(progress);
    }, 150);

    fetch("/data/countries.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch countries GeoJSON");
        return res.json();
      })
      .then((data) => {
        isDataFetched = true;
        setGeoJsonData(data);
        setLoadingLog("PARSING WORLD BOUNDARIES...");
        
        // Finish progress
        clearInterval(timer);
        let finalProgress = Math.max(50, progress);
        const finalTimer = setInterval(() => {
          finalProgress += 10;
          setLoadingProgress(Math.min(100, finalProgress));
          if (finalProgress >= 100) {
            clearInterval(finalTimer);
            setLoadingLog("ATLAS READY.");
            setTimeout(() => setIsLoaded(true), 600);
          }
        }, 80);
      })
      .catch((err) => {
        console.error(err);
        isDataFetched = true;
        setLoadingLog("ERROR LOADING WORLD DATA. USING FALLBACK.");
        clearInterval(timer);
        setLoadingProgress(100);
        setTimeout(() => setIsLoaded(true), 1000);
      });

    return () => clearInterval(timer);
  }, []);

  // 2. Initialize Three.js World Map
  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded || !geoJsonData) return;

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Renderer Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0e7490"); // Blend with deep cyan ocean
    scene.fog = new THREE.FogExp2("#0e7490", 0.0004);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Orthographic Camera Setup
    const aspect = width / height;
    const frustumSize = 75;

    // Calculate perfect initial zoom to fit the map with padding
    const mapHeight = 180 * mapScale;
    const mapWidth = 360 * mapScale;
    const verticalZoom = frustumSize / (mapHeight + 40);
    const horizontalZoom = (frustumSize * aspect) / (mapWidth + 80);
    const initialZoom = Math.min(verticalZoom, horizontalZoom);

    // Compute pin scale parameters based on initialZoom
    const minZoom = initialZoom;
    const maxZoom = 45.0;
    const S_max = 2.8;  // Scale of pin when fully zoomed out
    const S_min = 0.55; // Scale of pin when fully zoomed in
    const invMin = 1.0 / minZoom;
    const invMax = 1.0 / maxZoom;
    const pinA = (S_max - S_min) / (invMin - invMax);
    const pinB = S_min - pinA / maxZoom;

    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      1,
      5000
    );
    camera.zoom = initialZoom;
    camera.updateProjectionMatrix();
    camera.position.set(0, 1100, 850); // Isometric camera tilt looking north-east
    camera.lookAt(0, 0, 0);

    // 3. Bright Natural Light Rigging (Hemisphere + Sunlight)
    const ambientLight = new THREE.AmbientLight("#ffffff", 1.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight("#bae6fd", "#0e7490", 1.4); // Light blue sky sky-glow to ocean reflection
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight("#fffbeb", 2.0); // Warm sunny tint
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    // Focused shadow frustum centered at camera target
    const shadowFrustum = 160;
    dirLight.shadow.camera.left = -shadowFrustum;
    dirLight.shadow.camera.right = shadowFrustum;
    dirLight.shadow.camera.top = shadowFrustum;
    dirLight.shadow.camera.bottom = -shadowFrustum;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 400;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
    scene.add(dirLight.target); // Essential for directional light target tracking

    // 4. Flat Ocean Base Plane (extended to avoid edge clipping)
    const oceanGeo = new THREE.PlaneGeometry(10000, 10000);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: "#0e7490", // Deep cyan ocean
      roughness: 0.2,
      metalness: 0.1
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.y = -0.01; // Slightly below ground level
    oceanMesh.receiveShadow = true;
    scene.add(oceanMesh);

    // Grid helper (extended in all directions, matching 8.0 unit squares)
    const gridHelper = new THREE.GridHelper(8000, 1000, 0xffffff, 0xffffff);
    gridHelper.position.y = 0.01;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.0;
    scene.add(gridHelper);

    // Groups to organize extruded landmasses, borders, and water shelves
    const countriesGroup = new THREE.Group();
    scene.add(countriesGroup);

    const shelvesGroup = new THREE.Group();
    scene.add(shelvesGroup);

    const borderLines = []; // Collect border coordinate pairs
    const mountainInstances = [];
    const pineTreeInstances = [];
    const palmTreeInstances = [];
    const cityBuildingInstances = [];

    const shelfMat = new THREE.MeshBasicMaterial({
      color: "#22d3ee",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });

    const sideMaterial = new THREE.MeshStandardMaterial({
      color: "#a89f91", // uniform sandstone side walls
      flatShading: true,
      roughness: 0.85,
      metalness: 0.05
    });

    geoJsonData.features.forEach((feature) => {
      const countryName = feature.properties.name || "Unknown";
      const countryCode = feature.id || "UNK";
      const geometryType = feature.geometry.type;
      const coordinates = feature.geometry.coordinates;

      try {
        // Calculate a centroid to determine latitude for fallback rules and local scaling
        let sumLat = 0, sumLon = 0, ptCount = 0;
        const collectPoints = (coords) => {
          if (typeof coords[0] === "number") {
            sumLon += coords[0];
            sumLat += coords[1];
            ptCount++;
          } else {
            coords.forEach(collectPoints);
          }
        };
        collectPoints(coordinates);
        const centroidLat = ptCount > 0 ? sumLat / ptCount : 0.0;
        const centroidLon = ptCount > 0 ? sumLon / ptCount : 0.0;

        // Retrieve country-specific average elevation and biome colors
        const meta = getCountryMetadata(countryCode, centroidLat);
        const countryHeight = meta.height;
        const topMaterial = new THREE.MeshStandardMaterial({
          color: meta.color,
          flatShading: true,
          roughness: 0.75,
          metalness: 0.05
        });

        const processPolygon = (polygonCoords) => {
          const outerRing = polygonCoords[0];
          const contour = outerRing.map(coord => new THREE.Vector2(coord[0] * mapScale, coord[1] * mapScale));
          
          const shape = new THREE.Shape();
          for (let i = 0; i < contour.length; i++) {
            if (i === 0) shape.moveTo(contour[i].x, contour[i].y);
            else shape.lineTo(contour[i].x, contour[i].y);
          }
          
          const holes = [];
          for (let h = 1; h < polygonCoords.length; h++) {
            const holeCoords = polygonCoords[h];
            const holePath = new THREE.Path();
            const holePoints = holeCoords.map(coord => new THREE.Vector2(coord[0] * mapScale, coord[1] * mapScale));
            for (let i = 0; i < holePoints.length; i++) {
              if (i === 0) holePath.moveTo(holePoints[i].x, holePoints[i].y);
              else holePath.lineTo(holePoints[i].x, holePoints[i].y);
            }
            shape.holes.push(holePath);
            holes.push(holePoints);
          }

          // 1. Create clean flat-top ExtrudeGeometry
          const extrudeSettings = {
            depth: countryHeight,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.03,
            bevelSegments: 2
          };
          const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          geom.rotateX(-Math.PI / 2); // rotate to sit flat in XZ plane

          // Material 0 = top/bottom caps, Material 1 = extruded sides
          const mesh = new THREE.Mesh(geom, [topMaterial, sideMaterial]);
          mesh.name = countryName;
          mesh.userData = { countryCode, countryName };
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          countriesGroup.add(mesh);

          // 2. Add Contour Borders on top of the mesh
          const segments = [];
          for (let i = 0; i < contour.length; i++) {
            const next = (i + 1) % contour.length;
            segments.push({ a: contour[i], b: contour[next] });
          }
          holes.forEach(hole => {
            for (let i = 0; i < hole.length; i++) {
              const next = (i + 1) % hole.length;
              segments.push({ a: hole[i], b: hole[next] });
            }
          });
          segments.forEach(seg => {
            borderLines.push(
              seg.a.x, countryHeight + 0.02, -seg.a.y,
              seg.b.x, countryHeight + 0.02, -seg.b.y
            );
          });

          // 3. Extract top cap centroids to scatter instanced trees and mountains
          const tempGeom = new THREE.ShapeGeometry(shape);
          const posAttr = tempGeom.attributes.position;
          const indexAttr = tempGeom.index;

          if (indexAttr) {
            const arr = indexAttr.array;
            for (let i = 0; i < indexAttr.count; i += 3) {
              const i0 = arr[i], i1 = arr[i+1], i2 = arr[i+2];
              const p0 = new THREE.Vector2(posAttr.getX(i0), posAttr.getY(i0));
              const p1 = new THREE.Vector2(posAttr.getX(i1), posAttr.getY(i1));
              const p2 = new THREE.Vector2(posAttr.getX(i2), posAttr.getY(i2));

              const cx = (p0.x + p1.x + p2.x) / 3;
              const cy = (p0.y + p1.y + p2.y) / 3;
              const cz = -cy;

              const hash = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
              const rand = Math.abs(hash - Math.floor(hash));

              // If country is mountainous, spawn mountains
              if (countryHeight > 1.3 && rand < 0.18) {
                mountainInstances.push({ x: cx, y: countryHeight, z: cz, rand });
              }
              // If forest/savanna biome, spawn trees
              else if (meta.biome === "forest" || meta.biome === "savanna") {
                if (rand < 0.10) {
                  if (centroidLat > 25 || centroidLat < -25) {
                    pineTreeInstances.push({ x: cx, y: countryHeight, z: cz, rand });
                  } else {
                    palmTreeInstances.push({ x: cx, y: countryHeight, z: cz, rand });
                  }
                }
              }
            }
          }
          tempGeom.dispose();

          // 4. Neon Cyan Water Shelf
          const centroid = new THREE.Vector2(centroidLon * mapScale, centroidLat * mapScale);
          const scaledContour = contour.map(p => {
            const sx = centroid.x + 1.025 * (p.x - centroid.x);
            const sy = centroid.y + 1.025 * (p.y - centroid.y);
            return new THREE.Vector2(sx, sy);
          });

          const shelfShape = new THREE.Shape();
          for (let i = 0; i < scaledContour.length; i++) {
            if (i === 0) shelfShape.moveTo(scaledContour[i].x, scaledContour[i].y);
            else shelfShape.lineTo(scaledContour[i].x, scaledContour[i].y);
          }

          const shelfGeom = new THREE.ShapeGeometry(shelfShape);
          shelfGeom.rotateX(-Math.PI / 2);

          const shelfMesh = new THREE.Mesh(shelfGeom, shelfMat);
          shelfMesh.position.y = 0.08;
          shelvesGroup.add(shelfMesh);
        };

        if (geometryType === "Polygon") {
          processPolygon(coordinates);
        } else if (geometryType === "MultiPolygon") {
          coordinates.forEach((polyCoords) => {
            processPolygon(polyCoords);
          });
        }

        // 5. City scatter at capital location
        let capLat = feature.properties.capital_lat;
        let capLon = feature.properties.capital_lon;
        if (capLat === undefined || capLon === undefined) {
          const cap = capitals[countryCode] || capitals[countryName];
          if (cap) {
            capLat = cap.lat;
            capLon = cap.lon;
          } else if (ptCount > 0) {
            capLat = centroidLat;
            capLon = centroidLon;
          }
        }

        if (capLat !== undefined && capLon !== undefined) {
          const basePos = latLonToVector3(capLat, capLon, 0.0);
          
          const buildingColors = [
            new THREE.Color("#fed7aa"), // pastel orange
            new THREE.Color("#fbcfe8"), // pastel pink
            new THREE.Color("#cffafe"), // pastel cyan
            new THREE.Color("#e0e7ff"), // pastel indigo
            new THREE.Color("#fef08a")  // pastel yellow
          ];

          for (let b = 0; b < 3; b++) {
            const bHash = Math.sin(basePos.x * (b + 1) * 31.4 + basePos.z * 7.1) * 43758.5453;
            const bRand = Math.abs(bHash - Math.floor(bHash));
            const dx = (bRand - 0.5) * 1.8;
            const dz = (Math.sin(bHash) * 0.5) * 1.8;

            const bx = basePos.x + dx;
            const bz = basePos.z + dz;
            const by = countryHeight;

            const bw = 0.25 + (bRand * 0.15);
            const bh = 0.5 + (Math.cos(bHash) * 0.2) * 1.8;

            const col = buildingColors[Math.floor(bRand * buildingColors.length)];

            cityBuildingInstances.push({
              x: bx,
              y: by + bh / 2,
              z: bz,
              w: bw,
              h: bh,
              col: col
            });
          }
        }
      } catch (err) {
        console.error(`Error processing custom geometry for ${countryName}:`, err);
      }
    });

    // 6. Add InstancedMesh layers for Mountains, Pine Trees, Palm Trees, and Capital Buildings
    if (mountainInstances.length > 0) {
      const mountainGeo = createMountainGeometry();
      const mountainMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.8,
        metalness: 0.1
      });
      const mountainMesh = new THREE.InstancedMesh(mountainGeo, mountainMat, mountainInstances.length);
      mountainMesh.castShadow = true;
      mountainMesh.receiveShadow = true;
      
      const matrix = new THREE.Matrix4();
      mountainInstances.forEach((inst, idx) => {
        const position = new THREE.Vector3(inst.x, inst.y, inst.z);
        const rotation = new THREE.Euler(0, inst.rand * Math.PI * 2, 0);
        const q = new THREE.Quaternion().setFromEuler(rotation);
        const sVal = 0.7 + Math.abs(inst.rand * 0.5);
        const scale = new THREE.Vector3(sVal, sVal, sVal);
        matrix.compose(position, q, scale);
        mountainMesh.setMatrixAt(idx, matrix);
      });
      scene.add(mountainMesh);
    }

    if (pineTreeInstances.length > 0) {
      const pineGeo = createPineTreeGeometry();
      const pineMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.8,
        metalness: 0.1
      });
      const pineMesh = new THREE.InstancedMesh(pineGeo, pineMat, pineTreeInstances.length);
      pineMesh.castShadow = true;
      pineMesh.receiveShadow = true;
      
      const matrix = new THREE.Matrix4();
      pineTreeInstances.forEach((inst, idx) => {
        const position = new THREE.Vector3(inst.x, inst.y, inst.z);
        const rotation = new THREE.Euler(0, inst.rand * Math.PI * 2, 0);
        const q = new THREE.Quaternion().setFromEuler(rotation);
        const sVal = 0.8 + Math.abs(inst.rand * 0.4);
        const scale = new THREE.Vector3(sVal, sVal, sVal);
        matrix.compose(position, q, scale);
        pineMesh.setMatrixAt(idx, matrix);
      });
      scene.add(pineMesh);
    }

    if (palmTreeInstances.length > 0) {
      const palmGeo = createPalmTreeGeometry();
      const palmMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.8,
        metalness: 0.1
      });
      const palmMesh = new THREE.InstancedMesh(palmGeo, palmMat, palmTreeInstances.length);
      palmMesh.castShadow = true;
      palmMesh.receiveShadow = true;
      
      const matrix = new THREE.Matrix4();
      palmTreeInstances.forEach((inst, idx) => {
        const position = new THREE.Vector3(inst.x, inst.y, inst.z);
        const rotation = new THREE.Euler(0, inst.rand * Math.PI * 2, 0);
        const q = new THREE.Quaternion().setFromEuler(rotation);
        const sVal = 0.8 + Math.abs(inst.rand * 0.4);
        const scale = new THREE.Vector3(sVal, sVal, sVal);
        matrix.compose(position, q, scale);
        palmMesh.setMatrixAt(idx, matrix);
      });
      scene.add(palmMesh);
    }

    if (cityBuildingInstances.length > 0) {
      const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
      const buildingMat = new THREE.MeshStandardMaterial({
        flatShading: true,
        roughness: 0.6,
        metalness: 0.1
      });
      const buildingMesh = new THREE.InstancedMesh(buildingGeo, buildingMat, cityBuildingInstances.length);
      buildingMesh.castShadow = true;
      buildingMesh.receiveShadow = true;
      
      const matrix = new THREE.Matrix4();
      cityBuildingInstances.forEach((inst, idx) => {
        const position = new THREE.Vector3(inst.x, inst.y, inst.z);
        const q = new THREE.Quaternion();
        const scale = new THREE.Vector3(inst.w, inst.h, inst.w);
        matrix.compose(position, q, scale);
        buildingMesh.setMatrixAt(idx, matrix);
        buildingMesh.setColorAt(idx, inst.col);
      });
      scene.add(buildingMesh);
    }

    // 6. Draw Country Borders raised slightly above landmasses
    if (borderLines.length > 0) {
      const borderGeom = new THREE.BufferGeometry();
      borderGeom.setAttribute("position", new THREE.Float32BufferAttribute(borderLines, 3));
      const borderMat = new THREE.LineBasicMaterial({
        color: "#64748b", // slate gray
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      });
      const bordersMesh = new THREE.LineSegments(borderGeom, borderMat);
      scene.add(bordersMesh);
    }

    // 7. AddVisited 3D Memory Pins
    const pinGroup = new THREE.Group();
    scene.add(pinGroup);

    const pinGeom = new THREE.ConeGeometry(1.2, 4.0, 4);
    pinGeom.rotateX(Math.PI); // Point down
    pinGeom.translate(0, 2.0, 0); // Center translation pivot at tip

    const pinMat = new THREE.MeshStandardMaterial({
      color: "#f43f5e", // Rose pink
      roughness: 0.15,
      metalness: 0.8
    });

    initialPins.forEach((pinData) => {
      // Convert lat/lon to X/Z, starting high at Y = 10.0
      const basePos = latLonToVector3(pinData.lat, pinData.lon, 10.0);
      
      // Raycast down to find the country mesh's flat-top elevation
      const ray = new THREE.Raycaster(
        new THREE.Vector3(basePos.x, 15.0, basePos.z),
        new THREE.Vector3(0, -1, 0)
      );
      const intersects = ray.intersectObjects(countriesGroup.children);
      let yHeight = 0.9; // fallback
      if (intersects.length > 0) {
        yHeight = intersects[0].point.y;
      }
      
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      pinMesh.position.set(basePos.x, yHeight + 0.1, basePos.z);
      pinMesh.castShadow = true;
      pinMesh.userData = { isPin: true, ...pinData, countryHeight: yHeight };
      
      pinGroup.add(pinMesh);
    });

    // 8. Interactive Dragging, Pan, and Raycasting Click/Hover Panning
    let isDragging = false;
    let dragMoveCount = 0; // count dragging frames to distinguish click from drag
    const currentMousePosition = { x: 0, y: 0 };
    const previousFrameMousePosition = { x: 0, y: 0 };
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    const dragVelocity = { x: 0, y: 0 };
    const friction = 0.92;
    let hoveredMesh = null;
    let hoveredPin = null;

    const handleMouseDown = (e) => {
      isDragging = true;
      dragMoveCount = 0;
      currentMousePosition.x = e.clientX;
      currentMousePosition.y = e.clientY;
      previousFrameMousePosition.x = e.clientX;
      previousFrameMousePosition.y = e.clientY;
      dragVelocity.x = 0;
      dragVelocity.y = 0;
    };

    const handleMouseMove = (e) => {
      // Initialize Raycasting setup for Hover states
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      if (!isDragging) {
        // A. Check Raycast intersection for Pinned Memory points
        const pinIntersects = raycaster.intersectObjects(pinGroup.children);
        if (pinIntersects.length > 0) {
          document.body.style.cursor = "pointer";
          const collidedPin = pinIntersects[0].object;
          if (hoveredPin !== collidedPin) {
            if (hoveredPin) hoveredPin.material.color.setHex(0xf43f5e);
            hoveredPin = collidedPin;
            hoveredPin.material.color.setHex(0x4f46e5); // Change to Indigo
          }
        } else {
          document.body.style.cursor = "default";
          if (hoveredPin) {
            hoveredPin.material.color.setHex(0xf43f5e);
            hoveredPin = null;
          }

          // B. Check Raycast intersection for Countries to highlight country hover
          const countryIntersects = raycaster.intersectObjects(countriesGroup.children);
          if (countryIntersects.length > 0) {
            const intersectedCountry = countryIntersects[0].object;
            if (hoveredMesh !== intersectedCountry) {
              if (hoveredMesh) setMeshEmissive(hoveredMesh, 0x000000);
              hoveredMesh = intersectedCountry;
              setMeshEmissive(hoveredMesh, 0x1e1b4b); // Soft indigo glow
              setHoveredCountry(hoveredMesh.userData.countryName);
            }
          } else {
            if (hoveredMesh) {
              setMeshEmissive(hoveredMesh, 0x000000);
              hoveredMesh = null;
              setHoveredCountry("Hover over map");
            }
          }
        }
        return;
      }

      currentMousePosition.x = e.clientX;
      currentMousePosition.y = e.clientY;
      dragMoveCount++;
    };

    const handleMouseUp = (e) => {
      isDragging = false;

      // If dragMoveCount is tiny, treat this as a Click!
      if (dragMoveCount < 5) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

        // Check if user clicked a Pin
        const pinIntersects = raycaster.intersectObjects(pinGroup.children);
        if (pinIntersects.length > 0) {
          const pinData = pinIntersects[0].object.userData;
          setActivePin({
            name: pinData.name,
            city: pinData.city,
            lat: pinData.lat,
            lon: pinData.lon,
            date: pinData.date,
            details: pinData.details
          });
          setIsAddingEntry(false);
          return;
        }

        // Raycast against the entire world (ocean or country landmasses)
        const countryIntersects = raycaster.intersectObjects(countriesGroup.children);
        if (countryIntersects.length > 0) {
          const point = countryIntersects[0].point;
          const coords = vector3ToLatLon(point);
          setClickedCoords(coords);
          setActivePin(null); // Clear active memory view
          setIsAddingEntry(true); // Open "Add New Memory" panel
          return;
        }

        const oceanIntersects = raycaster.intersectObject(oceanMesh);
        if (oceanIntersects.length > 0) {
          const point = oceanIntersects[0].point;
          const coords = vector3ToLatLon(point);
          setClickedCoords(coords);
          setActivePin(null);
          setIsAddingEntry(true);
        }
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const minZoom = initialZoom * 0.95;
      const maxZoom = 45.0;
      camera.zoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom * factor));
      camera.updateProjectionMatrix();
    };

    const canvasElement = canvasRef.current;
    canvasElement.addEventListener("mousedown", handleMouseDown);
    canvasElement.addEventListener("mousemove", handleMouseMove);
    canvasElement.addEventListener("mouseup", handleMouseUp);
    canvasElement.addEventListener("wheel", handleWheel, { passive: false });

    // Touch Support
    let touchStartDist = 0;
    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragMoveCount = 0;
        currentMousePosition.x = e.touches[0].clientX;
        currentMousePosition.y = e.touches[0].clientY;
        previousFrameMousePosition.x = e.touches[0].clientX;
        previousFrameMousePosition.y = e.touches[0].clientY;
        dragVelocity.x = 0;
        dragVelocity.y = 0;
      } else if (e.touches.length === 2) {
        isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const handleTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        currentMousePosition.x = e.touches[0].clientX;
        currentMousePosition.y = e.touches[0].clientY;
        dragMoveCount++;
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchStartDist;
        const minZoom = initialZoom * 0.95;
        const maxZoom = 45.0;
        camera.zoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom * factor));
        camera.updateProjectionMatrix();
        touchStartDist = dist;
      }
    };

    canvasElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvasElement.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvasElement.addEventListener("touchend", (e) => handleMouseUp(e.changedTouches[0]));

    // 9. Resize Observer
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const aspect = w / h;

      camera.left = (-frustumSize * aspect) / 2;
      camera.right = (frustumSize * aspect) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // 10. Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      const xLimit = 180 * mapScale + 100;
      const zLimit = 90 * mapScale + 80;

      if (isDragging) {
        const deltaX = currentMousePosition.x - previousFrameMousePosition.x;
        const deltaY = currentMousePosition.y - previousFrameMousePosition.y;

        const clientWidth = renderer.domElement.clientWidth;
        const clientHeight = renderer.domElement.clientHeight;

        const worldWidth = (frustumSize * (clientWidth / clientHeight)) / camera.zoom;
        const worldHeight = frustumSize / camera.zoom;

        const H_u = worldWidth / clientWidth;
        const V_u = worldHeight / clientHeight;

        const moveX = -H_u * deltaX;
        const moveZ = -1.2637 * V_u * deltaY;

        cameraTarget.x += moveX;
        cameraTarget.z += moveZ;

        cameraTarget.x = Math.max(-xLimit, Math.min(xLimit, cameraTarget.x));
        cameraTarget.z = Math.max(-zLimit, Math.min(zLimit, cameraTarget.z));

        // Smooth velocity tracking
        dragVelocity.x = dragVelocity.x * 0.2 + deltaX * 0.8;
        dragVelocity.y = dragVelocity.y * 0.2 + deltaY * 0.8;

        previousFrameMousePosition.x = currentMousePosition.x;
        previousFrameMousePosition.y = currentMousePosition.y;
      } else {
        // Apply drag inertia decay
        const speed = Math.sqrt(dragVelocity.x * dragVelocity.x + dragVelocity.y * dragVelocity.y);
        if (speed > 0.05) {
          const clientWidth = renderer.domElement.clientWidth;
          const clientHeight = renderer.domElement.clientHeight;

          const worldWidth = (frustumSize * (clientWidth / clientHeight)) / camera.zoom;
          const worldHeight = frustumSize / camera.zoom;

          const H_u = worldWidth / clientWidth;
          const V_u = worldHeight / clientHeight;

          const moveX = -H_u * dragVelocity.x;
          const moveZ = -1.2637 * V_u * dragVelocity.y;

          cameraTarget.x += moveX;
          cameraTarget.z += moveZ;

          cameraTarget.x = Math.max(-xLimit, Math.min(xLimit, cameraTarget.x));
          cameraTarget.z = Math.max(-zLimit, Math.min(zLimit, cameraTarget.z));

          dragVelocity.x *= friction;
          dragVelocity.y *= friction;
        } else {
          dragVelocity.x = 0;
          dragVelocity.y = 0;
        }
      }

      // Copy camera target instantly for crisp 1-to-1 tracking and inertia
      const cameraPositionTarget = new THREE.Vector3(
        cameraTarget.x,
        cameraTarget.y + 1100,
        cameraTarget.z + 850
      );
      camera.position.copy(cameraPositionTarget);

      const lookTarget = camera.position.clone().add(new THREE.Vector3(0, -1100, -850));
      camera.lookAt(lookTarget);

      // Keep directional light centered over the camera target for sharp follow-shadows
      dirLight.position.set(cameraTarget.x + 80, cameraTarget.y + 130, cameraTarget.z + 45);
      dirLight.target.position.copy(cameraTarget);
      dirLight.target.updateMatrixWorld();

      // Animate visited pin markers (hover floating & pulsing + dynamic scaling)
      const pinScaleVal = (pinA / camera.zoom) + pinB;
      pinGroup.children.forEach((pin, idx) => {
        pin.rotation.y += 0.015;
        // Bouncing motion
        const baseHeight = pin.userData.countryHeight || 0.9;
        pin.position.y = baseHeight + 0.25 + Math.sin(elapsedTime * 2.5 + idx) * 0.15;
        // Dynamic scale
        pin.scale.set(pinScaleVal, pinScaleVal, pinScaleVal);
      });

      // Dynamic grid opacity based on zoom level:
      // min zoom (initialZoom) -> opacity 0.0
      // 25% of max zoom -> opacity 1.0
      const minZoom = initialZoom;
      const maxZoom = 45.0;
      const targetZoom = maxZoom * 0.25;
      const zoomRange = targetZoom - minZoom;
      let gridOpacity = 0.0;
      if (zoomRange > 0) {
        const rawOpacity = (camera.zoom - minZoom) / zoomRange;
        gridOpacity = Math.max(0.0, Math.min(1.0, rawOpacity));
      }
      gridHelper.material.opacity = gridOpacity;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      resizeObserver.disconnect();
      if (canvasElement) {
        canvasElement.removeEventListener("mousedown", handleMouseDown);
        canvasElement.removeEventListener("mousemove", handleMouseMove);
        canvasElement.removeEventListener("mouseup", handleMouseUp);
        canvasElement.removeEventListener("wheel", handleWheel);
        canvasElement.removeEventListener("touchstart", handleTouchStart);
        canvasElement.removeEventListener("touchmove", handleTouchMove);
      }
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [isLoaded, geoJsonData]);

  return (
    <div className="app-container">
      {/* 1. Animated Pastel Gradient Loader Overlay */}
      <div className={`loader-overlay ${isLoaded ? "hidden" : ""}`}>
        <div className="loader-container">
          <div>
            <h2 className="loader-status-title">MY TRAVEL JOURNAL</h2>
          </div>

          <div className="horizontal-loader-bar">
            <div 
              className="horizontal-loader-fill" 
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          
          <div className="loader-status-text">
            {loadingLog} ({loadingProgress}%)
          </div>
        </div>
      </div>

      {/* 2. Main High-Density World Map Canvas Container */}
      <div ref={containerRef} className="canvas-container">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      {/* 3. Frosted-glass Sidebar Panel */}
      <nav className="sidebar-panel">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">
            ODYSSEY <span className="logo-dot"></span>
          </h1>
          <span style={{ fontSize: "0.65rem", color: "var(--accent-primary)", letterSpacing: "0.05em", fontWeight: 700 }}>
            SPATIAL TRAVEL JOURNAL
          </span>
        </div>

        <ul className="sidebar-menu">
          <li>
            <div className="menu-item active">
              <span>Interactive Map</span>
            </div>
          </li>
          <li>
            <div className="menu-item">
              <span>Travel Journals</span>
            </div>
          </li>
          <li>
            <div className="menu-item">
              <span>Memory Gallery</span>
            </div>
          </li>
          <li>
            <div className="menu-item">
              <span>AI Trip Planner</span>
            </div>
          </li>
        </ul>

        {/* Display current hovered country name */}
        <div style={{ marginTop: "2rem", borderTop: "1px solid rgba(15, 23, 42, 0.05)", paddingTop: "1rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Exploring Region
          </span>
          <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-primary)", marginTop: "0.25rem" }}>
            {hoveredCountry}
          </h4>
        </div>

        <div className="sidebar-footer">
          <span>WANDERER</span>
          <span>ONLINE</span>
        </div>
      </nav>

      {/* 4. Active Spatial Hover Tracker / Memory HUD Panel */}
      <div className="overlay-panel">
        {/* State A: Display Pinned Memory details */}
        {activePin ? (
          <div>
            <h3 className="panel-title">
              <span>{activePin.name}</span>
              <span className="logo-dot" style={{ margin: 0, backgroundColor: "var(--accent-rose)", boxShadow: "none" }}></span>
            </h3>
            <div className="panel-body">
              <span style={{ display: "inline-block", background: "rgba(244, 63, 94, 0.08)", color: "var(--accent-rose)", padding: "0.2rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                {activePin.city}
              </span>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                Visited on: <strong>{activePin.date}</strong>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: 1.5, background: "rgba(15, 23, 42, 0.02)", padding: "0.75rem", borderRadius: "10px", border: "1px solid rgba(15,23,42,0.02)" }}>
                {activePin.details}
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "1rem", fontSize: "0.75rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                <div>Lat: {activePin.lat}</div>
                <div>Lon: {activePin.lon}</div>
              </div>
              <button 
                className="cyber-btn" 
                style={{ backgroundColor: "var(--accent-primary)", color: "#fff" }}
                onClick={() => setActivePin(null)}
              >
                CLOSE DETAIL
              </button>
            </div>
          </div>
        ) : isAddingEntry ? (
          /* State B: Display Clicked Coordinates prompt to Add New Memory */
          <div>
            <h3 className="panel-title">
              <span>NEW MEMORY POINT</span>
              <span className="logo-dot" style={{ margin: 0, backgroundColor: "var(--accent-primary)", boxShadow: "none" }}></span>
            </h3>
            <div className="panel-body">
              <p style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                You have targeted a location on the world map. Would you like to record a memory or trip plan here?
              </p>
              <div style={{ background: "rgba(79, 70, 229, 0.05)", border: "1px solid rgba(79, 70, 229, 0.15)", padding: "0.75rem", borderRadius: "10px", marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent-primary)" }}>TARGET COORDINATES</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginTop: "0.25rem" }}>
                  <div>Lat: <span>{clickedCoords.lat}</span></div>
                  <div>Lon: <span>{clickedCoords.lon}</span></div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button 
                  className="cyber-btn"
                  style={{ flex: 1, margin: 0 }}
                  onClick={() => alert(`Creating memory block at Lat: ${clickedCoords.lat}, Lon: ${clickedCoords.lon}`)}
                >
                  ADD JOURNAL
                </button>
                <button 
                  className="cyber-btn" 
                  style={{ flex: 1, margin: 0, background: "transparent", color: "var(--accent-primary)", border: "1px solid var(--accent-primary)" }}
                  onClick={() => setIsAddingEntry(false)}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* State C: Default Viewport Panning Instructions */
          <div>
            <h3 className="panel-title">
              <span>EXPLORING PATH</span>
              <span className="logo-dot" style={{ margin: 0, backgroundColor: "var(--accent-primary)", boxShadow: "none" }}></span>
            </h3>
            <div className="panel-body">
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.55 }}>
                Drag to explore the world map. Scroll to zoom in and out. Click any country to select coordinates, or click the **floating red pins** to open journal summaries and photos.
              </p>
              <button 
                className="cyber-btn"
                onClick={() => {
                  setClickedCoords({ lat: 40.7128, lon: -74.0060 });
                  setIsAddingEntry(true);
                }}
              >
                ADD ENTRY
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
