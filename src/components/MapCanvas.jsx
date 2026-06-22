"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase/client";
import WorldMap from "./WorldMap";

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

const continentColors = {
  NorthAmerica: "#ffcad4", // Soft rose pink
  SouthAmerica: "#f4acb7", // Warm pinkish-cream
  Europe: "#b5e2fa",       // Soft sky blue
  Asia: "#d8e2dc",         // Soft sage
  Africa: "#ffe5d9",       // Pale peach
  Oceania: "#c5dedd",      // Soft light teal
  Antarctica: "#eae2b7"    // Soft parchment/sand
};

const getCountryContinent = (countryCode, lat, lon) => {
  const mapping = {
    "USA": "NorthAmerica", "CAN": "NorthAmerica", "MEX": "NorthAmerica", "GRL": "NorthAmerica",
    "CUB": "NorthAmerica", "HTI": "NorthAmerica", "DOM": "NorthAmerica", "JAM": "NorthAmerica",
    "GTM": "NorthAmerica", "HND": "NorthAmerica", "SLV": "NorthAmerica", "NIC": "NorthAmerica",
    "CRI": "NorthAmerica", "PAN": "NorthAmerica", "BHS": "NorthAmerica", "BLZ": "NorthAmerica",
    
    "BRA": "SouthAmerica", "ARG": "SouthAmerica", "CHL": "SouthAmerica", "PER": "SouthAmerica", 
    "COL": "SouthAmerica", "VEN": "SouthAmerica", "BOL": "SouthAmerica", "ECU": "SouthAmerica",
    "PRY": "SouthAmerica", "URY": "SouthAmerica", "SUR": "SouthAmerica", "GUY": "SouthAmerica",
    "GUF": "SouthAmerica", "FLK": "SouthAmerica",

    "FRA": "Europe", "DEU": "Europe", "GBR": "Europe", "ITA": "Europe", "ESP": "Europe",
    "UKR": "Europe", "POL": "Europe", "ROU": "Europe", "NLD": "Europe", "BEL": "Europe",
    "CHE": "Europe", "AUT": "Europe", "SWE": "Europe", "NOR": "Europe", "FIN": "Europe",
    "DNK": "Europe", "ISL": "Europe", "IRL": "Europe", "PRT": "Europe", "GRC": "Europe",
    "ALB": "Europe", "AND": "Europe", "BIH": "Europe", "BGR": "Europe", "BLR": "Europe",
    "HRV": "Europe", "CZE": "Europe", "EST": "Europe", "HUN": "Europe", "LVA": "Europe",
    "LTU": "Europe", "MDA": "Europe", "MKD": "Europe", "MNE": "Europe", "SRB": "Europe",
    "SVK": "Europe", "SVN": "Europe", "KOS": "Europe",

    "AUS": "Oceania", "NZL": "Oceania", "PNG": "Oceania", "FJI": "Oceania", "SLB": "Oceania",
    "VUT": "Oceania", "NCL": "Oceania",

    "ATA": "Antarctica", "ATF": "Antarctica",

    "EGY": "Africa", "ZAF": "Africa", "DZA": "Africa", "LBY": "Africa", "SDN": "Africa",
    "COD": "Africa", "AGO": "Africa", "MDG": "Africa", "ETH": "Africa", "KEN": "Africa",
    "TZA": "Africa", "NGA": "Africa", "MAR": "Africa", "MOZ": "Africa", "CIV": "Africa",
    "GHA": "Africa", "CMR": "Africa", "SEN": "Africa", "TUN": "Africa", "SSD": "Africa",
    "SOM": "Africa", "CAF": "Africa", "TCD": "Africa", "NER": "Africa", "MLI": "Africa",
    "MRT": "Africa", "ESH": "Africa", "GIN": "Africa", "GNB": "Africa", "SLE": "Africa",
    "LBR": "Africa", "TGO": "Africa", "BEN": "Africa", "GAB": "Africa", "COG": "Africa",
    "NAM": "Africa", "BWA": "Africa", "ZWE": "Africa", "ZMB": "Africa", "MWI": "Africa",
    "RWA": "Africa", "BDI": "Africa", "UGA": "Africa", "ERI": "Africa", "DJI": "Africa",
    "LSO": "Africa", "SWZ": "Africa", "GMB": "Africa", "GNQ": "Africa",

    "RUS": "Asia", "CHN": "Asia", "IND": "Asia", "JPN": "Asia", "KOR": "Asia",
    "KAZ": "Asia", "MNG": "Asia", "SAU": "Asia", "IRN": "Asia", "TUR": "Asia",
    "PAK": "Asia", "AFG": "Asia", "NPL": "Asia", "BTN": "Asia", "THA": "Asia",
    "VNM": "Asia", "IDN": "Asia", "PHL": "Asia", "MYS": "Asia", "BGD": "Asia",
    "LKA": "Asia", "IRQ": "Asia", "SYR": "Asia", "JOR": "Asia", "ARE": "Asia",
    "YEM": "Asia", "OMN": "Asia", "PRK": "Asia", "TWN": "Asia", "KHM": "Asia",
    "LAO": "Asia", "MMR": "Asia", "KGZ": "Asia", "TJK": "Asia", "TKM": "Asia",
    "UZB": "Asia", "GEO": "Asia", "AZE": "Asia", "ARM": "Asia", "ISR": "Asia",
    "LBN": "Asia", "PSE": "Asia", "KWT": "Asia", "QAT": "Asia", "BHR": "Asia",
    "CYP": "Asia", "TLS": "Asia"
  };

  if (mapping[countryCode]) return mapping[countryCode];

  if (lat < -60) return "Antarctica";
  if (lon > 110 && lat < 0) return "Oceania";
  if (lon > -180 && lon < -30) {
    return lat > 12 ? "NorthAmerica" : "SouthAmerica";
  }
  if (lon >= -30 && lon <= 60) {
    return lat > 35 ? "Europe" : "Africa";
  }
  return "Asia";
};

const isPointInPolygon = (point, vs) => {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const isPointInFeature = (lon, lat, feature) => {
  const geometryType = feature.geometry.type;
  const coordinates = feature.geometry.coordinates;

  if (geometryType === "Polygon") {
    return isPointInPolygon([lon, lat], coordinates[0]);
  } else if (geometryType === "MultiPolygon") {
    return coordinates.some(polygon => isPointInPolygon([lon, lat], polygon[0]));
  }
  return false;
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




export default function MapCanvas() {
  // React States
  const [loadingProgress, setLoadingProgress] = useState(10);
  const [loadingLog, setLoadingLog] = useState("CONNECTING TO WORLD GEOMETRY ATLAS...");
  const [isLoaded, setIsLoaded] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [statesData, setStatesData] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pins, setPins] = useState([]);
  const [newPinName, setNewPinName] = useState("");
  const [newPinCity, setNewPinCity] = useState("");
  const [newPinDetails, setNewPinDetails] = useState("");
  const [newPinStartDate, setNewPinStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newPinEndDate, setNewPinEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [newLogTitle, setNewLogTitle] = useState("");
  const [newLogContent, setNewLogContent] = useState("");
  const [newLogCategory, setNewLogCategory] = useState("Experience");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Inline edit states for updating an existing pin and its logs
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [editPin, setEditPin] = useState({ title: "", location_name: "", start_date: "", end_date: "", latitude: 0, longitude: 0 });
  const [editingLogId, setEditingLogId] = useState(null);
  const [editLog, setEditLog] = useState({ title: "", content: "", category: "Experience", log_date: "" });
  
  // Auth States
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFlightPaths, setShowFlightPaths] = useState(false);
  const [activeTab, setActiveTab] = useState("Interactive Map");

  // Interactive HUD States
  const [hoveredCountry, setHoveredCountry] = useState("Hover over map");
  const [clickedCoords, setClickedCoords] = useState({ lat: 0, lon: 0 });
  const [activePin, setActivePin] = useState(null);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [flyTo, setFlyTo] = useState(null);

  // Three.js Element Refs

  const activePinRef = useRef(activePin);
  const isAddingEntryRef = useRef(isAddingEntry);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activePinRef.current = activePin;
  }, [activePin]);

  useEffect(() => {
    isAddingEntryRef.current = isAddingEntry;
  }, [isAddingEntry]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Close the Travel Journals panel and reset the nav to Interactive Map
  const closeJournalPanel = () => {
    setActiveTab("Interactive Map");
    setActivePin(null);
    setIsAddingEntry(false);
    setIsConfirmingDelete(false);
    setIsAddingLog(false);
    setIsEditingPin(false);
    setEditingLogId(null);
  };

  // --- WorldMap callbacks ---
  const handlePinClick = (pin) => {
    setFlyTo({ lat: pin.latitude, lon: pin.longitude });
    setActivePin(pin);
    setActiveTab("Travel Journals");
    setIsAddingLog(false);
    setIsAddingEntry(false);
    setIsConfirmingDelete(false);
  };

  // Clicking the map closes the panel when open; clicking land (when closed)
  // starts a new memory at that spot; clicking open ocean does nothing.
  const handleMapClick = ({ lat, lon, isLand }) => {
    if (activeTab === "Travel Journals") {
      closeJournalPanel();
      return;
    }
    if (isLand) {
      setClickedCoords({ lat: parseFloat(lat.toFixed(4)), lon: parseFloat(lon.toFixed(4)) });
      setActiveTab("Travel Journals");
      setIsAddingEntry(true);
    }
  };

  const handleHoverRegion = (name) => {
    setHoveredCountry(name || "Hover over map");
  };

  // Reset inline edit modes whenever the active pin changes
  useEffect(() => {
    setIsEditingPin(false);
    setEditingLogId(null);
  }, [activePin?.id]);


  // Safely format a stored date string as "MMM YYYY"; returns null for missing/invalid
  // values so callers can fall back instead of rendering the Unix epoch ("Dec 1969").
  const formatPinDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
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

    Promise.all([
      fetch("/data/countries.json").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch countries GeoJSON");
        return res.json();
      }),
      fetch("/data/us-states.json").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch US states GeoJSON");
        return res.json();
      })
    ])
      .then(([countries, states]) => {
        isDataFetched = true;
        setGeoJsonData(countries);
        setStatesData(states);
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
  // Fetch pins from Supabase
  useEffect(() => {
    if (!session) return;
    const loadPins = async () => {
      const { data, error } = await supabase.from('pins').select('*, pin_logs(*)');
      if (error) {
        console.error("Failed to load pins from Supabase", error);
      } else if (data) {
        const mappedPins = data.map(pin => ({
          ...pin,
          logs: pin.pin_logs || []
        }));
        setPins(mappedPins);
      }
    };
    loadPins();
  }, [session]);


  // ----------------------------------------------------
  // DYNAMIC PIN MANAGEMENT
  // ----------------------------------------------------
  const handleAddPin = async () => {
    if (!newPinName || !newPinCity) return; // Basic validation
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("You must be logged in to add a pin.");
      return;
    }

    try {
      const { data: insertedPin, error: pinError } = await supabase.from('pins').insert({
        user_id: userData.user.id,
        title: newPinName,
        location_name: newPinCity,
        latitude: clickedCoords.lat,
        longitude: clickedCoords.lon,
        start_date: newPinStartDate,
        end_date: newPinEndDate,
        trip_type: "Unknown",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select().single();

      if (pinError) throw pinError;

      const { data: insertedLog, error: logError } = await supabase.from('pin_logs').insert({
        pin_id: insertedPin.id,
        log_date: newPinStartDate,
        title: "Initial Entry",
        content: newPinDetails,
        category: "Experience",
        media_urls: [],
        created_at: new Date().toISOString()
      }).select().single();

      if (logError) throw logError;

      const addedPin = { ...insertedPin, logs: [insertedLog] };

      setPins((prev) => [...prev, addedPin]);
      setIsAddingEntry(false);
      setActivePin(addedPin);
      setNewPinName("");
      setNewPinCity("");
      setNewPinDetails("");
      setNewPinStartDate(new Date().toISOString().split("T")[0]);
      setNewPinEndDate(new Date().toISOString().split("T")[0]);

    } catch (err) {
      console.error(err);
      alert("Error adding pin.");
    }
  };

  const handleAddLog = async () => {
    if (!activePin || !newLogTitle || !newLogContent) return;
    try {
      const { data: insertedLog, error } = await supabase.from('pin_logs').insert({
        pin_id: activePin.id,
        log_date: new Date().toISOString().split("T")[0],
        title: newLogTitle,
        content: newLogContent,
        category: newLogCategory,
        media_urls: [],
        created_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;
      
      const updatedLogs = [...(activePin.logs || []), insertedLog];
      const savedPin = { ...activePin, logs: updatedLogs };
      
      setPins((prev) => prev.map(p => p.id === savedPin.id ? savedPin : p));
      setActivePin(savedPin);

      setIsAddingLog(false);
      setNewLogTitle("");
      setNewLogContent("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemovePin = async () => {
    if (!activePin) return;

    try {
      const { error } = await supabase.from('pins').delete().eq('id', activePin.id);
      if (error) throw error;

      // Remove from state
      setPins((prev) => prev.filter((p) => p.id !== activePin.id));
      setActivePin(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper: merge an updated pin into every place it's tracked (list, active card, journal view)
  const applyPinUpdate = (savedPin) => {
    setPins((prev) => prev.map((p) => (p.id === savedPin.id ? savedPin : p)));
    setActivePin((prev) => (prev && prev.id === savedPin.id ? savedPin : prev));
  };

  const startEditingPin = () => {
    if (!activePin) return;
    setEditPin({
      title: activePin.title || "",
      location_name: activePin.location_name || "",
      start_date: activePin.start_date || "",
      end_date: activePin.end_date || "",
      latitude: activePin.latitude ?? 0,
      longitude: activePin.longitude ?? 0,
    });
    setEditingLogId(null);
    setIsAddingLog(false);
    setIsEditingPin(true);
  };

  const handleUpdatePin = async () => {
    if (!activePin) return;
    if (!editPin.title || !editPin.location_name) {
      alert("Title and location are required.");
      return;
    }
    const lat = parseFloat(editPin.latitude);
    const lon = parseFloat(editPin.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert("Latitude must be between -90 and 90, and longitude between -180 and 180.");
      return;
    }
    try {
      const { data: updatedPin, error } = await supabase.from('pins').update({
        title: editPin.title,
        location_name: editPin.location_name,
        start_date: editPin.start_date || null,
        end_date: editPin.end_date || null,
        latitude: lat,
        longitude: lon,
        updated_at: new Date().toISOString(),
      }).eq('id', activePin.id).select().single();

      if (error) throw error;

      applyPinUpdate({ ...activePin, ...updatedPin, logs: activePin.logs || [] });
      setIsEditingPin(false);
    } catch (err) {
      console.error(err);
      alert("Error updating pin. (Make sure your Supabase 'pins' table has an UPDATE policy enabled.)");
    }
  };

  const startEditingLog = (log) => {
    setEditLog({
      title: log.title || "",
      content: log.content || "",
      category: log.category || "Experience",
      log_date: log.log_date || "",
    });
    setIsAddingLog(false);
    setEditingLogId(log.id);
  };

  const handleUpdateLog = async () => {
    if (!activePin || !editingLogId) return;
    if (!editLog.title || !editLog.content) {
      alert("Log title and details are required.");
      return;
    }
    try {
      const { data: updatedLog, error } = await supabase.from('pin_logs').update({
        title: editLog.title,
        content: editLog.content,
        category: editLog.category,
        log_date: editLog.log_date || null,
      }).eq('id', editingLogId).select().single();

      if (error) throw error;

      const updatedLogs = (activePin.logs || []).map((l) => (l.id === editingLogId ? { ...l, ...updatedLog } : l));
      applyPinUpdate({ ...activePin, logs: updatedLogs });
      setEditingLogId(null);
    } catch (err) {
      console.error(err);
      alert("Error updating log. (Make sure your Supabase 'pin_logs' table has an UPDATE policy enabled.)");
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!activePin) return;
    try {
      const { error } = await supabase.from('pin_logs').delete().eq('id', logId);
      if (error) throw error;

      const updatedLogs = (activePin.logs || []).filter((l) => l.id !== logId);
      applyPinUpdate({ ...activePin, logs: updatedLogs });
      if (editingLogId === logId) setEditingLogId(null);
    } catch (err) {
      console.error(err);
      alert("Error deleting log.");
    }
  };

  const handleMigrateData = async () => {
    try {
      const res = await fetch('/api/pins');
      const localPins = await res.json();
      if (!localPins || localPins.length === 0) {
        alert("No local pins found to migrate!");
        return;
      }
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      for (const pin of localPins) {
        const { data: insertedPin, error: pinError } = await supabase.from('pins').insert({
          user_id: userData.user.id,
          title: pin.title,
          location_name: pin.location_name,
          latitude: pin.latitude,
          longitude: pin.longitude,
          start_date: pin.start_date,
          end_date: pin.end_date,
          trip_type: pin.trip_type,
          created_at: pin.created_at || new Date().toISOString(),
          updated_at: pin.updated_at || new Date().toISOString()
        }).select().single();

        if (pinError) { console.error(pinError); continue; }

        if (pin.logs && pin.logs.length > 0) {
          const logsToInsert = pin.logs.map(log => ({
            pin_id: insertedPin.id,
            log_date: log.log_date,
            title: log.title,
            content: log.content,
            category: log.category,
            media_urls: log.media_urls || [],
            created_at: log.created_at || new Date().toISOString()
          }));
          await supabase.from('pin_logs').insert(logsToInsert);
        }
      }
      alert("Migration complete! Refreshing map data...");
      const { data, error } = await supabase.from('pins').select('*, pin_logs(*)');
      if (!error && data) {
        setPins(data.map(p => ({ ...p, logs: p.pin_logs || [] })));
      }
    } catch (e) {
      console.error(e);
      alert("Migration failed.");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) alert(error.message);
      else alert("Check your email for the login link!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) alert(error.message);
    }
    setAuthLoading(false);
  };

  return (
    <div className="app-container">
      {/* Auth Overlay */}
      {authLoading ? (
        <div style={{ position: "absolute", zIndex: 9999, width: "100vw", height: "100vh", background: "#0f172a" }} />
      ) : !session ? (
        <div style={{ position: "absolute", zIndex: 9999, width: "100vw", height: "100vh", background: "rgba(15, 23, 42, 0.8)", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", fontFamily: "sans-serif", backdropFilter: "blur(5px)" }}>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "2rem", borderRadius: "12px", width: "300px", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 4px 30px rgba(0,0,0,0.1)" }}>
            <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>{isSignUp ? "Create Account" : "Login"}</h2>
            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ padding: "0.75rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.8)", color: "#000" }} />
              <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: "0.75rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.8)", color: "#000" }} />
              <button type="submit" disabled={authLoading} style={{ background: "var(--accent)", color: "white", padding: "0.75rem", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                {authLoading ? "Loading..." : (isSignUp ? "Sign Up" : "Login")}
              </button>
            </form>
            <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem" }}>
              <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}>
                {isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

      {/* 2. Flat 2D world map (D3-geo SVG) */}
      <div className="canvas-container">
        {isLoaded && geoJsonData && (
          <WorldMap
            geoJson={geoJsonData}
            statesGeoJson={statesData}
            pins={pins}
            activePinId={activePin?.id || null}
            showPaths={showFlightPaths && !activePin}
            flyTo={flyTo}
            onPinClick={handlePinClick}
            onMapClick={handleMapClick}
            onHoverRegion={handleHoverRegion}
          />
        )}
      </div>

      {/* --- UI Layer Overlay --- */}
      <div className="ui-layer">
        
        {/* Top Left */}
        <div className="top-left-group">
          <div className="glass-base icon-button hamburger-container">
            <div className="hamburger-icon">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        {/* Top Center */}
        <div className="top-center-group">
          <div className="glass-base glass-pill nav-bar" style={{ position: "relative" }}>
            <div 
              className="nav-active-pill"
              style={{
                position: "absolute",
                top: "4px",
                bottom: "4px",
                width: "145px",
                left: activeTab === "Interactive Map" ? "4px" : activeTab === "Travel Journals" ? "152px" : "302px",
                background: "rgba(255, 255, 255, 0.15)",
                borderRadius: "20px",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                zIndex: 0
              }}
            />
            <div 
              className={`nav-item ${activeTab === "Interactive Map" ? "active" : ""}`}
              onClick={() => setActiveTab("Interactive Map")}
              style={{ cursor: "pointer", position: "relative", zIndex: 1, background: "transparent" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
              Interactive Map
            </div>
            <div 
              className={`nav-item ${activeTab === "Travel Journals" ? "active" : ""}`}
              onClick={() => setActiveTab("Travel Journals")}
              style={{ cursor: "pointer", position: "relative", zIndex: 1, background: "transparent" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              Travel Journals
            </div>
            <div className="nav-item" style={{ position: "relative", zIndex: 1, background: "transparent" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              Memory Gallery
            </div>
            <div className="nav-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              AI Trip Planner
            </div>
          </div>
          
          <div className="glass-base glass-pill exploring-badge-pill">
            <span className="label">EXPLORING REGION</span>
            <span className="value">{hoveredCountry || "World"}</span>
          </div>
        </div>

        {/* Travel Journals Sidebar */}
        {session && (
          <div className="glass-base" style={{
            position: "absolute",
            top: "0px",
            right: "0px",
            width: "350px",
            bottom: "0px",
            display: "flex",
            flexDirection: "column",
            padding: "1rem",
            zIndex: 100,
            overflow: "hidden",
            gap: "1rem",
            backdropFilter: "blur(20px)",
            borderRadius: "0px",
            borderRight: "none",
            borderBottom: "none",
            borderTop: "none",
            background: "rgba(255, 255, 255, 0.85)",
            boxShadow: "-12px 0 40px rgba(0,0,0,0.18)",
            transform: activeTab === "Travel Journals" ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            pointerEvents: activeTab === "Travel Journals" ? "auto" : "none"
          }}>
            {isAddingEntry ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <h2 style={{ fontSize: "1.25rem", margin: "0 0 1rem 0", fontWeight: 700, color: "#111827", flexShrink: 0 }}>New Memory Point</h2>
                <div className="sidebar-scrollbar" style={{ overflowY: "auto", paddingRight: "0.5rem", flexGrow: 1 }}>
                  <label className="panel-label">Title</label>
                  <input type="text" placeholder="Title (e.g. Skiing)" className="panel-input" value={newPinName} onChange={(e) => setNewPinName(e.target.value)} />
                  <label className="panel-label">Location</label>
                  <input type="text" placeholder="Location (e.g. Alps)" className="panel-input" value={newPinCity} onChange={(e) => setNewPinCity(e.target.value)} />
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <label className="panel-label">Start Date</label>
                      <input type="date" className="panel-input" value={newPinStartDate} onChange={(e) => setNewPinStartDate(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="panel-label">End Date</label>
                      <input type="date" className="panel-input" value={newPinEndDate} onChange={(e) => setNewPinEndDate(e.target.value)} />
                    </div>
                  </div>
                  <label className="panel-label">Initial Log</label>
                  <textarea placeholder="Initial log entry details..." className="panel-textarea" value={newPinDetails} onChange={(e) => setNewPinDetails(e.target.value)} />
                  <div style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>
                    Lat: {clickedCoords.lat.toFixed(4)} · Lon: {clickedCoords.lon.toFixed(4)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexShrink: 0 }}>
                  <button className="glass-pill btn-green" style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={handleAddPin}>ADD MEMORY</button>
                  <button className="glass-pill icon-button" style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#374151" }} onClick={closeJournalPanel}>CANCEL</button>
                </div>
              </div>
            ) : activePin ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <button
                  onClick={() => { setActivePin(null); setIsEditingPin(false); setEditingLogId(null); setIsAddingLog(false); setIsConfirmingDelete(false); }}
                  style={{ background: "transparent", border: "none", color: "#4b5563", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", marginBottom: "0.5rem", flexShrink: 0 }}
                  onMouseOver={(e) => e.currentTarget.style.color = "#111827"}
                  onMouseOut={(e) => e.currentTarget.style.color = "#4b5563"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
                  Back to Journals
                </button>

                {isConfirmingDelete ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem 0" }}>
                    <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700, color: "#111827" }}>Remove this memory?</h2>
                    <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: 0, lineHeight: 1.5 }}>This will permanently remove &quot;{activePin.title}&quot; and all of its logs.</p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="glass-pill icon-button" style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#374151" }} onClick={() => setIsConfirmingDelete(false)}>CANCEL</button>
                      <button className="glass-pill btn-red" style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={handleRemovePin}>REMOVE</button>
                    </div>
                  </div>
                ) : isEditingPin ? (
                  <div className="sidebar-scrollbar" style={{ overflowY: "auto", paddingRight: "0.5rem", flexGrow: 1 }}>
                    <h3 style={{ fontSize: "0.85rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", marginTop: 0, marginBottom: "1rem" }}>Edit Memory Point</h3>
                    <label className="panel-label">Title</label>
                    <input type="text" className="panel-input" value={editPin.title} onChange={(e) => setEditPin({ ...editPin, title: e.target.value })} />
                    <label className="panel-label">Location</label>
                    <input type="text" className="panel-input" value={editPin.location_name} onChange={(e) => setEditPin({ ...editPin, location_name: e.target.value })} />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">Start Date</label>
                        <input type="date" className="panel-input" value={editPin.start_date || ""} onChange={(e) => setEditPin({ ...editPin, start_date: e.target.value })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">End Date</label>
                        <input type="date" className="panel-input" value={editPin.end_date || ""} onChange={(e) => setEditPin({ ...editPin, end_date: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">Latitude</label>
                        <input type="number" step="0.0001" className="panel-input" value={editPin.latitude} onChange={(e) => setEditPin({ ...editPin, latitude: e.target.value })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">Longitude</label>
                        <input type="number" step="0.0001" className="panel-input" value={editPin.longitude} onChange={(e) => setEditPin({ ...editPin, longitude: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button className="glass-pill btn-green" style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={handleUpdatePin}>SAVE</button>
                      <button className="glass-pill icon-button" style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#374151" }} onClick={() => setIsEditingPin(false)}>CANCEL</button>
                    </div>
                  </div>
                ) : (
                  <div className="sidebar-scrollbar" style={{ overflowY: "auto", paddingRight: "0.5rem", flexGrow: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.25rem" }}>
                          {formatPinDate(activePin.start_date) || "Undated"}{activePin.end_date && activePin.end_date !== activePin.start_date ? ` – ${formatPinDate(activePin.end_date)}` : ""}
                        </div>
                        <h2 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem 0", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{activePin.location_name}</h2>
                        <p style={{ fontSize: "0.95rem", color: "#374151", margin: "0 0 1rem 0", lineHeight: 1.4 }}>{activePin.title}</p>
                      </div>
                      <button title="Edit pin" onClick={startEditingPin} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0, padding: "0.25rem", display: "flex" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                    </div>

                    <h3 style={{ fontSize: "0.85rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>Log Entries</h3>

                    {(activePin.logs || []).map((log, idx) => (
                      editingLogId === log.id ? (
                        <div key={log.id || idx} style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>
                          <input type="text" placeholder="Log Title" className="panel-input" value={editLog.title} onChange={(e) => setEditLog({ ...editLog, title: e.target.value })} />
                          <textarea placeholder="Experience details..." className="panel-textarea" value={editLog.content} onChange={(e) => setEditLog({ ...editLog, content: e.target.value })} />
                          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <select value={editLog.category} onChange={(e) => setEditLog({ ...editLog, category: e.target.value })} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", fontSize: "0.8rem", color: "#111827", background: "#fff" }}>
                              <option value="Experience">Experience</option>
                              <option value="Restaurant">Restaurant</option>
                              <option value="Lodging">Lodging</option>
                              <option value="Transit">Transit</option>
                            </select>
                            <input type="date" value={editLog.log_date || ""} onChange={(e) => setEditLog({ ...editLog, log_date: e.target.value })} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", fontSize: "0.8rem", color: "#111827", background: "#fff" }} />
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button className="glass-pill btn-green" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", display: "flex", justifyContent: "center" }} onClick={handleUpdateLog}>SAVE LOG</button>
                            <button className="glass-pill icon-button" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", background: "rgba(0,0,0,0.05)", color: "#374151", display: "flex", justifyContent: "center" }} onClick={() => setEditingLogId(null)}>CANCEL</button>
                          </div>
                        </div>
                      ) : (
                        <div key={log.id || idx} style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", color: "#111827", marginBottom: "0.5rem" }}>
                            <span style={{ flex: 1 }}>{log.title}</span>
                            <span style={{ fontSize: "0.65rem", background: "rgba(0, 0, 0, 0.05)", color: "var(--muted)", padding: "0.2rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>{log.category}</span>
                            <button title="Edit log" onClick={() => startEditingLog(log)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", padding: 0, display: "flex" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button title="Delete log" onClick={() => handleDeleteLog(log.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: 0, display: "flex" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                          <p style={{ fontSize: "0.85rem", margin: 0, whiteSpace: "pre-wrap", color: "#374151", lineHeight: 1.6 }}>{log.content}</p>
                        </div>
                      )
                    ))}

                    {(activePin.logs || []).length === 0 && !isAddingLog && (
                      <div style={{ fontSize: "0.9rem", color: "#6b7280", fontStyle: "italic", textAlign: "center", padding: "1rem 0" }}>No logs recorded for this trip yet.</div>
                    )}

                    {isAddingLog ? (
                      <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>
                        <input type="text" placeholder="Log Title (e.g., Best Dinner)" className="panel-input" value={newLogTitle} onChange={(e) => setNewLogTitle(e.target.value)} />
                        <textarea placeholder="Experience details..." className="panel-textarea" value={newLogContent} onChange={(e) => setNewLogContent(e.target.value)} />
                        <select value={newLogCategory} onChange={(e) => setNewLogCategory(e.target.value)} style={{ width: "100%", padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", marginBottom: "0.5rem", fontSize: "0.8rem", color: "#111827", background: "#fff" }}>
                          <option value="Experience">Experience</option>
                          <option value="Restaurant">Restaurant</option>
                          <option value="Lodging">Lodging</option>
                          <option value="Transit">Transit</option>
                        </select>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="glass-pill btn-green" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", display: "flex", justifyContent: "center" }} onClick={handleAddLog}>SAVE LOG</button>
                          <button className="glass-pill icon-button" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", background: "rgba(0,0,0,0.05)", color: "#374151", display: "flex", justifyContent: "center" }} onClick={() => setIsAddingLog(false)}>CANCEL</button>
                        </div>
                      </div>
                    ) : (
                      <button className="glass-pill" style={{ width: "100%", background: "rgba(0,0,0,0.04)", border: "1px dashed #cbd5e1", color: "#475569", fontSize: "0.75rem", marginBottom: "1rem", padding: "0.5rem", cursor: "pointer" }} onClick={() => setIsAddingLog(true)}>+ ADD LOG ENTRY</button>
                    )}

                    <button className="glass-pill btn-red" style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "0.5rem" }} onClick={() => setIsConfirmingDelete(true)}>REMOVE PIN</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  Travel Journals
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: 0, flexShrink: 0 }}>
                  Chronological history of your adventures.
                </p>

                <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {[...pins].sort((a, b) => (a.start_date ? new Date(a.start_date).getTime() : Infinity) - (b.start_date ? new Date(b.start_date).getTime() : Infinity)).map((pin, index) => (
                    <div 
                      key={pin.id} 
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        padding: "1rem",
                        cursor: "pointer",
                        borderRadius: "8px",
                        border: "1px solid rgba(0,0,0,0.05)",
                        background: "rgba(0,0,0,0.02)",
                        transition: "all 0.2s ease"
                      }}
                      onClick={() => {
                        setFlyTo({ lat: pin.latitude, lon: pin.longitude });
                        setActivePin(pin);
                        setIsAddingLog(false);
                        setIsAddingEntry(false);
                        setIsConfirmingDelete(false);
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {formatPinDate(pin.start_date) || "Undated"}
                      </div>
                      <div style={{ fontSize: "1.1rem", color: "#111827", fontWeight: 600, margin: "0.25rem 0" }}>
                        {pin.location_name}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
                        {pin.title}
                      </div>
                    </div>
                  ))}
                  {pins.length === 0 && (
                    <div style={{ textAlign: "center", color: "#4b5563", fontSize: "0.9rem", padding: "2rem 0" }}>
                      No travel journals yet. Add a memory pin to the globe!
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom Left */}
        <div className="bottom-left-group">
          {pins.length === 0 && (
            <button className="glass-pill btn-green" style={{ width: "200px" }} onClick={handleMigrateData}>
              MIGRATE OLD DATA
            </button>
          )}
          {showProfileMenu && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "200px" }}>
              <button
                className="glass-pill"
                style={{fontSize: "0.6rem", width: "100%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: showFlightPaths ? "var(--accent)" : "#94a3b8", cursor: "pointer", padding: "0.5rem", borderRadius: "8px"}}
                onClick={() => setShowFlightPaths(!showFlightPaths)}
              >
                {showFlightPaths ? "HIDE FLIGHT PATHS" : "SHOW FLIGHT PATHS"}
              </button>
              <button
                className="glass-pill"
                style={{fontSize: "0.6rem", width: "100%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", padding: "0.5rem", borderRadius: "8px"}}
                onClick={() => supabase.auth.signOut()}
              >
                SIGN OUT
              </button>
            </div>
          )}
          <div
            className="glass-base glass-pill profile-widget"
            style={{ cursor: "pointer" }}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="profile-avatar">👨‍🚀</div>
            <div className="profile-info">
              <span className="name">{session?.user?.email?.split('@')[0].toUpperCase() || "WANDERER"}</span>
              <span className="status">ONLINE</span>
            </div>
            <div className="status-dot"></div>
          </div>
        </div>

        {/* Bottom Right */}
        <div className="bottom-right-group">
          <button className="glass-base glass-pill icon-button btn-icon-right" onClick={() => {
                setClickedCoords({ lat: 40.7128, lon: -74.0060 });
                setActivePin(null);
                setActiveTab("Travel Journals");
                setIsAddingEntry(true);
              }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            <span style={{fontSize: "0.8rem", fontWeight: "700", color: "#0f172a"}}>ADD ENTRY</span>
          </button>
        </div>
      </div>
    </div>
  );
}
