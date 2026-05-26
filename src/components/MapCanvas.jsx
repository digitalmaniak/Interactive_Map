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

// Deterministic color assignment based on country code hash
const getCountryColor = (code) => {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash += code.charCodeAt(i);
  }
  return countryColors[hash % countryColors.length];
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
    scene.fog = new THREE.FogExp2("#f1f5f9", 0.004);

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
      1000
    );
    camera.zoom = initialZoom;
    camera.updateProjectionMatrix();
    camera.position.set(0, 110, 85); // Isometric camera tilt looking north-east
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
      color: "#e0f2fe", // Soft bright baby blue ocean
      roughness: 0.25,
      metalness: 0.05
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

    // Helper to generate THREE.Shape from coordinates ring
    const createShape = (ring) => {
      const shape = new THREE.Shape();
      for (let i = 0; i < ring.length; i++) {
        const lon = ring[i][0];
        const lat = ring[i][1];
        
        const x = lon * mapScale;
        const y = lat * mapScale; // temporary 2D representation
        
        if (i === 0) {
          shape.moveTo(x, y);
        } else {
          shape.lineTo(x, y);
        }

        // Collect boundary lines for border overlay (paired points)
        if (i < ring.length - 1) {
          const nextLon = ring[i+1][0];
          const nextLat = ring[i+1][1];
          borderLines.push(
            lon * mapScale, extrudeHeight + 0.02, -lat * mapScale,
            nextLon * mapScale, extrudeHeight + 0.02, -nextLat * mapScale
          );
        }
      }
      return shape;
    };

    // 5. Generate Extruded Countries Landmasses from GeoJSON
    const extrudeSettings = {
      depth: extrudeHeight,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.04,
      bevelSegments: 2
    };

    geoJsonData.features.forEach((feature) => {
      const countryName = feature.properties.name || "Unknown";
      const countryCode = feature.id || "UNK";
      const geometryType = feature.geometry.type;
      const coordinates = feature.geometry.coordinates;

      const shapes = [];

      try {
        if (geometryType === "Polygon") {
          const shape = createShape(coordinates[0]);
          // Add holes if any exist
          for (let h = 1; h < coordinates.length; h++) {
            const holePath = new THREE.Path();
            const holeCoords = coordinates[h];
            for (let i = 0; i < holeCoords.length; i++) {
              const x = holeCoords[i][0] * mapScale;
              const y = holeCoords[i][1] * mapScale;
              if (i === 0) {
                holePath.moveTo(x, y);
              } else {
                holePath.lineTo(x, y);
              }
            }
            shape.holes.push(holePath);
          }
          shapes.push(shape);
        } else if (geometryType === "MultiPolygon") {
          coordinates.forEach((polygonCoords) => {
            const shape = createShape(polygonCoords[0]);
            for (let h = 1; h < polygonCoords.length; h++) {
              const holePath = new THREE.Path();
              const holeCoords = polygonCoords[h];
              for (let i = 0; i < holeCoords.length; i++) {
                const x = holeCoords[i][0] * mapScale;
                const y = holeCoords[i][1] * mapScale;
                if (i === 0) {
                  holePath.moveTo(x, y);
                } else {
                  holePath.lineTo(x, y);
                }
              }
              shape.holes.push(holePath);
            }
            shapes.push(shape);
          });
        }

        if (shapes.length > 0) {
          const geom = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
          // Rotate shapes from XY to lie flat in XZ plane
          geom.rotateX(-Math.PI / 2);

          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(getCountryColor(countryCode)),
            flatShading: true,
            roughness: 0.75,
            metalness: 0.05
          });

          const mesh = new THREE.Mesh(geom, mat);
          mesh.name = countryName;
          mesh.userData = { countryCode, countryName };
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          countriesGroup.add(mesh);
        }
      } catch (err) {
        console.error(`Error extruding ${countryName}:`, err);
      }
    });

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
        cameraTarget.y + 110,
        cameraTarget.z + 85
      );
      camera.position.copy(cameraPositionTarget);

      const lookTarget = camera.position.clone().add(new THREE.Vector3(0, -110, -85));
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
