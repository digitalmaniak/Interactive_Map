"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function MapCanvas() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingLog, setLoadingLog] = useState("INITIALIZING VECTOR MATRIX...");
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeCoords, setActiveCoords] = useState({ x: 0, z: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Soft minimalist loader logs
    const logs = [
      "CONNECTING TO SPATIAL LEDGER...",
      "CALIBRATING MAP COORDINATES...",
      "GENERATING ORGANIC BIOMES...",
      "RENDERING LOW-POLY CONTINENTS...",
      "MATERIALIZING LANDSCAPES...",
      "SYSTEM OPERATIONAL."
    ];

    let logIndex = 0;
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => setIsLoaded(true), 800);
          return 100;
        }
        
        const step = Math.floor(prev / 18);
        if (step > logIndex && logIndex < logs.length - 1) {
          logIndex = step;
          setLoadingLog(logs[logIndex]);
        }

        return prev + Math.floor(Math.random() * 8) + 3;
      });
    }, 120);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded) return;

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Bright Background/Fog Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f5f9"); // Bright slate grey/white
    scene.fog = new THREE.FogExp2("#f1f5f9", 0.005);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Camera Setup (Orthographic for stylized top-down isometric)
    const aspect = width / height;
    const frustumSize = 80;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      1,
      1000
    );
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);

    // 3. Bright Natural Light Rigging (Hemisphere + Sun Directional)
    const ambientLight = new THREE.AmbientLight("#ffffff", 1.8);
    scene.add(ambientLight);

    // Hemisphere light adds sky reflections to shadows for a natural bright aesthetic
    const hemiLight = new THREE.HemisphereLight("#bae6fd", "#e2e8f0", 1.2); // sky blue to ground gray
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);

    // Sunny directional light for crisp warm shadows
    const dirLight = new THREE.DirectionalLight("#fffbeb", 2.2); // soft warm sunlight
    dirLight.position.set(90, 140, 60);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.bias = -0.0006;
    scene.add(dirLight);

    // Subtle helper grid (barely visible for spacing)
    const gridHelper = new THREE.GridHelper(200, 40, "rgba(99, 102, 241, 0.05)", "rgba(99, 102, 241, 0.02)");
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // 4. Procedural Low-Poly Terrain Generation (Bright Lively Biomes)
    const terrainSize = 180;
    const terrainSegments = 45;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const vertexCount = pos.count;
    
    // Warm natural color palette
    const colors = [];
    const colorDeepWater = new THREE.Color("#0ea5e9"); // Vibrant sky blue
    const colorShallowWater = new THREE.Color("#38bdf8"); // Clear cyan
    const colorSand = new THREE.Color("#fef08a"); // Cream beach sand
    const colorGrass = new THREE.Color("#10b981"); // Rich organic emerald green
    const colorForest = new THREE.Color("#059669"); // Rich green
    const colorMountain = new THREE.Color("#cbd5e1"); // Clean grey rock
    const colorSnowPeak = new THREE.Color("#ffffff"); // Snowy peaks

    for (let i = 0; i < vertexCount; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const distFromCenter = Math.sqrt(x * x + z * z);
      const islandFactor = Math.max(0, 1 - distFromCenter / (terrainSize * 0.55));

      let heightVal = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 12;
      heightVal += Math.sin(x * 0.09) * Math.cos(z * 0.09) * 4;
      heightVal += Math.sin(x * 0.2) * Math.sin(z * 0.2) * 1.5;
      heightVal *= islandFactor;

      if (heightVal < -2) {
        heightVal = -3 + Math.sin(x * 0.5) * 0.15;
      }

      pos.setY(i, heightVal);

      // Biome mapping
      let vertexColor = colorGrass;
      if (heightVal < -2.1) {
        vertexColor = colorDeepWater;
      } else if (heightVal < -1.7) {
        vertexColor = colorShallowWater;
      } else if (heightVal < 0) {
        vertexColor = colorSand;
      } else if (heightVal > 7) {
        vertexColor = colorSnowPeak;
      } else if (heightVal > 3.5) {
        vertexColor = colorMountain;
      } else if (heightVal > 1.8) {
        vertexColor = colorForest;
      }

      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }

    terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      flatShading: true,
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.05,
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);

    // 5. Populate Scattered Trees & Golden Monuments
    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);

    const scatterObjects = () => {
      const treeGeo = new THREE.ConeGeometry(1.5, 4.5, 4);
      const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.2, 4);
      const monumentGeo = new THREE.ConeGeometry(1, 9, 4);
      
      const treeMat = new THREE.MeshStandardMaterial({ color: "#16a34a", flatShading: true, roughness: 0.85 }); // Lively tree green
      const trunkMat = new THREE.MeshStandardMaterial({ color: "#78350f", flatShading: true }); // Wood brown
      const monumentMat = new THREE.MeshStandardMaterial({ 
        color: "#fbbf24", // Golden yellow
        emissive: "#d97706", // Soft warm amber glow
        flatShading: true,
        roughness: 0.25,
        metalness: 0.95
      });

      for (let i = 0; i < 185; i++) {
        const x = (Math.random() - 0.5) * (terrainSize - 25);
        const z = (Math.random() - 0.5) * (terrainSize - 25);

        const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrainMesh);

        if (intersects.length > 0) {
          const y = intersects[0].point.y;

          if (y > 0.4 && y < 6.5) {
            if (Math.random() > 0.1) {
              // Create clean low-poly tree
              const treeMesh = new THREE.Mesh(treeGeo, treeMat);
              const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
              
              treeMesh.position.y = 2.25;
              treeMesh.castShadow = true;
              trunkMesh.position.y = 0.6;
              trunkMesh.castShadow = true;

              const singleTree = new THREE.Group();
              singleTree.add(trunkMesh);
              singleTree.add(treeMesh);
              singleTree.position.set(x, y, z);
              
              const scale = 0.75 + Math.random() * 0.55;
              singleTree.scale.set(scale, scale, scale);
              singleTree.rotation.y = Math.random() * Math.PI;

              objectsGroup.add(singleTree);
            } else if (Math.random() > 0.88) {
              // Create golden monument prism
              const monument = new THREE.Mesh(monumentGeo, monumentMat);
              monument.position.set(x, y + 4.0, z);
              monument.castShadow = true;
              monument.rotation.y = Math.random() * Math.PI;
              monument.scale.set(0.9 + Math.random() * 0.3, 0.8 + Math.random() * 0.5, 0.9 + Math.random() * 0.3);
              objectsGroup.add(monument);
            }
          }
        }
      }
    };
    scatterObjects();

    // 6. Camera Orbit, Pan & Zoom Custom Implementation
    let isDragging = false;
    const previousMousePosition = { x: 0, y: 0 };
    const cameraTarget = new THREE.Vector3(0, 0, 0);

    const handleMouseDown = (e) => {
      isDragging = true;
      previousMousePosition.x = e.clientX;
      previousMousePosition.y = e.clientY;
    };

    const handleMouseMove = (e) => {
      if (!isDragging) {
        // Track hover coordinates for HUD
        const rect = renderer.domElement.getBoundingClientRect();
        const hoverX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const hoverY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(hoverX, hoverY), camera);
        const intersects = raycaster.intersectObject(terrainMesh);
        if (intersects.length > 0) {
          setActiveCoords({
            x: parseFloat(intersects[0].point.x.toFixed(2)),
            z: parseFloat(intersects[0].point.z.toFixed(2)),
          });
        }
        return;
      }

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      const factor = camera.zoom * 15;
      const moveX = (-deltaX + deltaY) / factor;
      const moveZ = (-deltaX - deltaY) / factor;

      cameraTarget.x += moveX;
      cameraTarget.z += moveZ;

      // Restrict camera pan bounds
      cameraTarget.x = Math.max(-80, Math.min(80, cameraTarget.x));
      cameraTarget.z = Math.max(-80, Math.min(80, cameraTarget.z));

      previousMousePosition.x = e.clientX;
      previousMousePosition.y = e.clientY;
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      let zoomAmount = e.deltaY * -0.001;
      camera.zoom = Math.max(0.4, Math.min(2.5, camera.zoom + zoomAmount));
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
        previousMousePosition.x = e.touches[0].clientX;
        previousMousePosition.y = e.touches[0].clientY;
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
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;

        const factor = camera.zoom * 15;
        const moveX = (-deltaX + deltaY) / factor;
        const moveZ = (-deltaX - deltaY) / factor;

        cameraTarget.x += moveX;
        cameraTarget.z += moveZ;

        previousMousePosition.x = e.touches[0].clientX;
        previousMousePosition.y = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchStartDist;
        camera.zoom = Math.max(0.4, Math.min(2.5, camera.zoom * factor));
        camera.updateProjectionMatrix();
        touchStartDist = dist;
      }
    };

    canvasElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvasElement.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvasElement.addEventListener("touchend", handleMouseUp);

    // 7. Resize Observer
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

    // 8. Animation & Main Render Loop
    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Lerp camera target
      const cameraPositionTarget = new THREE.Vector3(
        cameraTarget.x + 100,
        100,
        cameraTarget.z + 100
      );
      camera.position.lerp(cameraPositionTarget, 0.08);

      const lookTarget = camera.position.clone().add(new THREE.Vector3(-100, -100, -100));
      camera.lookAt(lookTarget);

      // Micro-animations: tree swaying & monument hovering
      objectsGroup.children.forEach((obj, idx) => {
        if (obj.geometry && obj.geometry.type === "ConeGeometry" && obj.scale.y > 1.1) {
          // Monument slow float
          obj.rotation.y += 0.003;
          obj.position.y += Math.sin(elapsedTime * 1.5 + idx) * 0.003;
        } else {
          // Tree natural sway
          obj.rotation.z = Math.sin(elapsedTime * 1.2 + idx) * 0.015;
        }
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
        canvasElement.removeEventListener("touchend", handleMouseUp);
      }
      renderer.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
    };
  }, [isLoaded]);

  return (
    <div className="app-container">
      {/* 1. Animated Pastel Gradient Loader Overlay */}
      <div className={`loader-overlay ${isLoaded ? "hidden" : ""}`}>
        <div className="loader-container">
          <div>
            <h2 className="loader-status-title">LOADING LEDGER</h2>
          </div>

          {/* Minimalist Progress Line */}
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

      {/* 2. Main High-Density Low-Poly Canvas Map Container */}
      <div ref={containerRef} className="canvas-container">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      {/* 3. Frosted-glass sidebar Panel */}
      <nav className="sidebar-panel">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">
            LEDGER <span className="logo-dot"></span>
          </h1>
          <span style={{ fontSize: "0.65rem", color: "var(--accent-indigo)", letterSpacing: "0.15em", fontFamily: "var(--font-orbitron)", fontWeight: 700 }}>
            SPATIAL NODE READER
          </span>
        </div>

        <ul className="sidebar-menu">
          <li>
            <div className="menu-item active">
              <span>OVERVIEW MAP</span>
            </div>
          </li>
          <li>
            <div className="menu-item">
              <span>LOCATION LEDGER</span>
            </div>
          </li>
          <li>
            <div className="menu-item">
              <span>PHOTO INGESTION</span>
            </div>
          </li>
          <li>
            <div className="menu-item">
              <span>SYSTEM SETTINGS</span>
            </div>
          </li>
        </ul>

        <div className="sidebar-footer">
          <span>SECURE.NODE</span>
          <span>SYS_ACTIVE</span>
        </div>
      </nav>

      {/* 4. Active Spatial Hover Tracker HUD Panel */}
      <div className="overlay-panel">
        <h3 className="panel-title">
          <span>ACTIVE COORDINATES</span>
          <span className="logo-dot" style={{ margin: 0, backgroundColor: "var(--accent-indigo)", boxShadow: "none" }}></span>
        </h3>
        <div className="panel-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontFamily: "var(--font-orbitron)", fontSize: "0.8rem", color: "var(--text-main)", fontWeight: 700 }}>
            <div>X: <span>{activeCoords.x}</span></div>
            <div>Z: <span>{activeCoords.z}</span></div>
          </div>
          <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Drag to pan the spatial grid. Scroll to scale zoom levels. Click nodes to initialize documentation blocks.
          </p>
          <button className="cyber-btn">TRIGGER SCAN</button>
        </div>
      </div>
    </div>
  );
}
