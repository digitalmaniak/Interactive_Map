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

// Seedable 2D Perlin Noise generator (Ken Perlin's Improved Noise)
function createNoise2D(seed = 12345) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  
  let currentSeed = seed;
  const nextRand = () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
  };
  
  // Shuffle table deterministically
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const temp = p[i];
    p[i] = p[j];
    p[j] = temp;
  }
  
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
  }
  
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (hash, x, y) => {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  };
  
  return (x, y) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = fade(x);
    const v = fade(y);
    
    const A = perm[X] + Y;
    const B = perm[X + 1] + Y;
    
    return lerp(v, lerp(u, grad(perm[A], x, y),
                             grad(perm[B], x - 1, y)),
                   lerp(u, grad(perm[A + 1], x, y - 1),
                             grad(perm[B + 1], x - 1, y - 1)));
  };
}

const noise = createNoise2D(12345);

// fBM height sampler
const sampleHeight = (x, z) => {
  const nX = x * 0.005;
  const nZ = z * 0.005;
  
  let h = 0;
  h += noise(nX, nZ) * 8.0;
  h += noise(nX * 2.5, nZ * 2.5) * 3.0;
  h += noise(nX * 6.0, nZ * 6.0) * 0.8;
  
  if (h < 0) h *= 0.3;
  else h = Math.pow(h, 1.2) * 1.5;
  
  return h;
};

// Dynamic 2D subdivision
function subdivide2D(vertices, faces, iterations) {
  let currentVerts = [...vertices];
  let currentFaces = [...faces];
  
  for (let iter = 0; iter < iterations; iter++) {
    const nextFaces = [];
    const midpointCache = new Map();
    
    const getMidpoint = (a, b) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (midpointCache.has(key)) {
        return midpointCache.get(key);
      }
      const pA = currentVerts[a];
      const pB = currentVerts[b];
      const mid = new THREE.Vector2((pA.x + pB.x) / 2, (pA.y + pB.y) / 2);
      currentVerts.push(mid);
      const index = currentVerts.length - 1;
      midpointCache.set(key, index);
      return index;
    };
    
    for (let i = 0; i < currentFaces.length; i++) {
      const [v0, v1, v2] = currentFaces[i];
      const m01 = getMidpoint(v0, v1);
      const m12 = getMidpoint(v1, v2);
      const m20 = getMidpoint(v2, v0);
      
      nextFaces.push([v0, m01, m20]);
      nextFaces.push([v1, m12, m01]);
      nextFaces.push([v2, m20, m12]);
      nextFaces.push([m01, m12, m20]);
    }
    currentFaces = nextFaces;
  }
  return { vertices: currentVerts, faces: currentFaces };
}

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

const getBiome = (lat, x, z) => {
  if (lat > 65 || lat < -60) return 'glacial';
  
  if (Math.abs(lat) >= 15 && Math.abs(lat) <= 35) {
    const dNoise = noise(x * 0.01, z * 0.01);
    if (dNoise > 0.0) return 'desert';
  }
  
  return 'forest';
};

const getBiomeColor = (x, y, z, latLonConverter) => {
  const { lat } = latLonConverter(new THREE.Vector3(x, y, z));
  
  // High elevation snow cap & rock peaks
  if (y > 6.8) return new THREE.Color("#ffffff"); // Snow cap
  if (y > 4.2) return new THREE.Color("#64748b"); // Mountain rock grey
  
  const biome = getBiome(lat, x, z);
  if (biome === 'glacial') {
    return new THREE.Color("#f8fafc"); // Crisp snow white
  } else if (biome === 'desert') {
    const dNoise = noise(x * 0.01, z * 0.01);
    if (dNoise > 0.15) return new THREE.Color("#fcd34d"); // Sand yellow
    return new THREE.Color("#fda4af"); // Dry clay red
  } else {
    // Forest / Jungle
    const fNoise = noise(x * 0.02, z * 0.02);
    if (fNoise > 0.1) return new THREE.Color("#15803d"); // Deep forest green
    return new THREE.Color("#22c55e"); // Vibrant grass green
  }
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
    scene.background = new THREE.Color("#f1f5f9"); // Bright off-white background
    scene.fog = new THREE.FogExp2("#f1f5f9", 0.0004);

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

    const hemiLight = new THREE.HemisphereLight("#bae6fd", "#f1f5f9", 1.4); // Light blue sky sky-glow to grey ground
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

    // 4. Flat Ocean Base Plane
    const oceanGeo = new THREE.PlaneGeometry(360 * mapScale + 400, 180 * mapScale + 400);
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

    // Grid helper (faint design reference, increased divisions for more grid squares)
    const gridHelper = new THREE.GridHelper(360 * mapScale, 360, "rgba(99, 102, 241, 0.05)", "rgba(99, 102, 241, 0.02)");
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Groups to organize extruded landmasses and borders
    const countriesGroup = new THREE.Group();
    scene.add(countriesGroup);

    const borderLines = []; // Collect border coordinate pairs
    const extrudeHeight = 1.2;

    // 5. Generate Custom Procedural Low-Poly Countries from GeoJSON
    const pineTreeInstances = [];
    const palmTreeInstances = [];
    const cityBuildingInstances = [];

    const landMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.75,
      metalness: 0.05
    });

    const shelfMat = new THREE.MeshBasicMaterial({
      color: "#22d3ee",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });

    geoJsonData.features.forEach((feature) => {
      const countryName = feature.properties.name || "Unknown";
      const countryCode = feature.id || "UNK";
      const geometryType = feature.geometry.type;
      const coordinates = feature.geometry.coordinates;

      try {
        const processPolygon = (polygonCoords) => {
          const outerRing = polygonCoords[0];
          const contour = outerRing.map(coord => new THREE.Vector2(coord[0] * mapScale, coord[1] * mapScale));
          
          const holes = [];
          for (let h = 1; h < polygonCoords.length; h++) {
            const holeCoords = polygonCoords[h];
            const hole = holeCoords.map(coord => new THREE.Vector2(coord[0] * mapScale, coord[1] * mapScale));
            holes.push(hole);
          }

          const combinedPoints = [...contour];
          const holePoints = [];
          holes.forEach(hole => {
            holePoints.push(hole);
            combinedPoints.push(...hole);
          });

          const faceIndices = THREE.ShapeUtils.triangulateShape(contour, holePoints);
          if (!faceIndices || faceIndices.length === 0) return;

          let subdivisions = 3;
          if (faceIndices.length > 150) subdivisions = 1;
          else if (faceIndices.length > 40) subdivisions = 2;

          const subdivided = subdivide2D(combinedPoints, faceIndices, subdivisions);

          const positions = [];
          const colors = [];
          const sideColor = new THREE.Color("#a89f91"); // Sandstone side walls

          // 1. Top Cap Faces
          subdivided.faces.forEach(face => {
            const pA = subdivided.vertices[face[0]];
            const pB = subdivided.vertices[face[1]];
            const pC = subdivided.vertices[face[2]];

            const yA = sampleHeight(pA.x, pA.y) + extrudeHeight;
            const yB = sampleHeight(pB.x, pB.y) + extrudeHeight;
            const yC = sampleHeight(pC.x, pC.y) + extrudeHeight;

            const vA = new THREE.Vector3(pA.x, yA, -pA.y);
            const vB = new THREE.Vector3(pB.x, yB, -pB.y);
            const vC = new THREE.Vector3(pC.x, yC, -pC.y);

            const cx = (vA.x + vB.x + vC.x) / 3;
            const cy = (vA.y + vB.y + vC.y) / 3;
            const cz = (vA.z + vB.z + vC.z) / 3;

            const col = getBiomeColor(cx, cy, cz, vector3ToLatLon);

            positions.push(vA.x, vA.y, vA.z);
            positions.push(vB.x, vB.y, vB.z);
            positions.push(vC.x, vC.y, vC.z);

            colors.push(col.r, col.g, col.b);
            colors.push(col.r, col.g, col.b);
            colors.push(col.r, col.g, col.b);

            const { lat } = vector3ToLatLon(new THREE.Vector3(cx, cy, cz));
            const biome = getBiome(lat, cx, -cz);
            if (biome === 'forest') {
              const hash = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
              const rand = Math.abs(hash - Math.floor(hash));
              if (rand < 0.08) {
                if (Math.abs(lat) > 35) {
                  pineTreeInstances.push({ x: cx, y: cy, z: cz, rand });
                } else if (Math.abs(lat) < 25) {
                  palmTreeInstances.push({ x: cx, y: cy, z: cz, rand });
                }
              }
            }
          });

          // 2. Extruded Side Walls & Borders
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
            const pA = seg.a;
            const pB = seg.b;

            const yA = sampleHeight(pA.x, pA.y) + extrudeHeight;
            const yB = sampleHeight(pB.x, pB.y) + extrudeHeight;

            const tA = [pA.x, yA, -pA.y];
            const tB = [pB.x, yB, -pB.y];
            const bB = [pB.x, 0, -pB.y];
            const bA = [pA.x, 0, -pA.y];

            // Triangle 1: tA, tB, bB
            positions.push(...tA, ...tB, ...bB);
            colors.push(sideColor.r, sideColor.g, sideColor.b);
            colors.push(sideColor.r, sideColor.g, sideColor.b);
            colors.push(sideColor.r, sideColor.g, sideColor.b);

            // Triangle 2: tA, bB, bA
            positions.push(...tA, ...bB, ...bA);
            colors.push(sideColor.r, sideColor.g, sideColor.b);
            colors.push(sideColor.r, sideColor.g, sideColor.b);
            colors.push(sideColor.r, sideColor.g, sideColor.b);

            // Populate contour borders
            borderLines.push(
              pA.x, yA + 0.02, -pA.y,
              pB.x, yB + 0.02, -pB.y
            );
          });

          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
          geom.computeVertexNormals();

          const mesh = new THREE.Mesh(geom, landMaterial);
          mesh.name = countryName;
          mesh.userData = { countryCode, countryName };
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          countriesGroup.add(mesh);

          // 3. Neon Cyan Water Shelf
          const centroid = new THREE.Vector2(0, 0);
          contour.forEach(p => centroid.add(p));
          centroid.divideScalar(contour.length);

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
          countriesGroup.add(shelfMesh);
        };

        if (geometryType === "Polygon") {
          processPolygon(coordinates);
        } else if (geometryType === "MultiPolygon") {
          coordinates.forEach((polyCoords) => {
            processPolygon(polyCoords);
          });
        }

        // 4. City scatter at capital location
        let capLat = feature.properties.capital_lat;
        let capLon = feature.properties.capital_lon;
        if (capLat === undefined || capLon === undefined) {
          const cap = capitals[countryCode] || capitals[countryName];
          if (cap) {
            capLat = cap.lat;
            capLon = cap.lon;
          } else {
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
            if (ptCount > 0) {
              capLat = sumLat / ptCount;
              capLon = sumLon / ptCount;
            }
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
            const by = sampleHeight(bx, -bz) + extrudeHeight;

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

    // 6. Add InstancedMesh layers for Pine Trees, Palm Trees, and Capital Buildings
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
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      
      // Calculate 3D position slightly above country surface level (Y=extrudeHeight + 0.1)
      const pinPos = latLonToVector3(pinData.lat, pinData.lon, extrudeHeight + 0.1);
      pinMesh.position.copy(pinPos);
      pinMesh.castShadow = true;
      pinMesh.userData = { isPin: true, ...pinData };
      
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
              if (hoveredMesh) hoveredMesh.material.emissive.setHex(0x000000);
              hoveredMesh = intersectedCountry;
              hoveredMesh.material.emissive.setHex(0x1e1b4b); // Soft indigo glow
              setHoveredCountry(hoveredMesh.userData.countryName);
            }
          } else {
            if (hoveredMesh) {
              hoveredMesh.material.emissive.setHex(0x000000);
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

      // Animate visited pin markers (hover floating & pulsing)
      pinGroup.children.forEach((pin, idx) => {
        pin.rotation.y += 0.015;
        // Bouncing motion
        pin.position.y = extrudeHeight + 0.25 + Math.sin(elapsedTime * 2.5 + idx) * 0.15;
      });

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
      renderer.dispose();
      oceanGeo.dispose();
      oceanMat.dispose();
      countriesGroup.children.forEach((child) => {
        child.geometry.dispose();
        child.material.dispose();
      });
      pinGeom.dispose();
      pinMat.dispose();
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
