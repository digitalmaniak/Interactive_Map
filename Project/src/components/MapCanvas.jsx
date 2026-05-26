"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Dynamically import post-processing to avoid SSR errors
let EffectComposer, RenderPass, UnrealBloomPass;

export default function MapCanvas() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingLog, setLoadingLog] = useState("INITIALIZING VECTOR MATRIX...");
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeCoords, setActiveCoords] = useState({ x: 0, z: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Loader simulation logs
    const logs = [
      "ESTABLISHING SECURE SATLINK...",
      "CALIBRATING NEON MATRIX POINTS...",
      "RESOLVING SPATIAL COORDINATES...",
      "GENERATING LOW-POLY TERRAIN GRID...",
      "MATERIALIZING WORLD GEOMETRIES...",
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
        
        // Randomly update logs based on progress thresholds
        const step = Math.floor(prev / 18);
        if (step > logIndex && logIndex < logs.length - 1) {
          logIndex = step;
          setLoadingLog(logs[logIndex]);
        }

        return prev + Math.floor(Math.random() * 8) + 2;
      });
    }, 150);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded) return;

    // Ensure container exists
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Renderer Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020617");
    scene.fog = new THREE.FogExp2("#020617", 0.005);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Camera Setup (Orthographic for stylized top-down)
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
    // Position camera at isometric angle
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);

    // 3. Light Rigging (Cyberpunk lighting)
    const ambientLight = new THREE.AmbientLight("#0f172a", 1.5);
    scene.add(ambientLight);

    // Main light simulating sharp morning shadows
    const dirLight = new THREE.DirectionalLight("#38bdf8", 3.0);
    dirLight.position.set(80, 150, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Sub-lights for neon highlights (rim lights)
    const pinkLight = new THREE.PointLight("#f43f5e", 10.0, 150);
    pinkLight.position.set(-60, 40, -40);
    scene.add(pinkLight);

    const blueLight = new THREE.PointLight("#38bdf8", 8.0, 150);
    blueLight.position.set(60, 20, -60);
    scene.add(blueLight);

    // Helper Grid
    const gridHelper = new THREE.GridHelper(200, 40, "rgba(56, 189, 248, 0.15)", "rgba(56, 189, 248, 0.05)");
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // 4. Procedural Low-Poly Terrain Generation
    const terrainSize = 180;
    const terrainSegments = 45;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    terrainGeo.rotateX(-Math.PI / 2); // align flat with ground

    // Perturb vertices to create islands, valleys, and mountains
    const pos = terrainGeo.attributes.position;
    const vertexCount = pos.count;
    
    // Add vertex color attributes to define biomes dynamically
    const colors = [];
    const colorWater = new THREE.Color("#090f26");
    const colorSand = new THREE.Color("#112448");
    const colorForest = new THREE.Color("#162d54");
    const colorMountain = new THREE.Color("#35183d");
    const colorPinkPeak = new THREE.Color("#f43f5e");

    for (let i = 0; i < vertexCount; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Distance from center factor to create a natural island look
      const distFromCenter = Math.sqrt(x * x + z * z);
      const islandFactor = Math.max(0, 1 - distFromCenter / (terrainSize * 0.55));

      // Layered sine/cosine waves for procedural noise elevation
      let heightVal = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 12;
      heightVal += Math.sin(x * 0.09) * Math.cos(z * 0.09) * 4;
      heightVal += Math.sin(x * 0.2) * Math.sin(z * 0.2) * 1.5;
      heightVal *= islandFactor; // force edges to slope down

      // Flatten oceans
      if (heightVal < -2) {
        heightVal = -3 + Math.sin(x * 0.5) * 0.2; // deep water ripple
      }

      pos.setY(i, heightVal);

      // Select biome color based on height
      let vertexColor = colorForest;
      if (heightVal < -1.8) {
        vertexColor = colorWater;
      } else if (heightVal < 0) {
        vertexColor = colorSand;
      } else if (heightVal > 7) {
        // High peaks are neon magenta
        vertexColor = colorPinkPeak;
      } else if (heightVal > 3) {
        vertexColor = colorMountain;
      }

      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }

    terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      flatShading: true,
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);

    // 5. Populate Scattered Objects (Low-Poly Pine Trees, Obelisks, Structures)
    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);

    const scatterObjects = () => {
      const treeGeo = new THREE.ConeGeometry(1.5, 5, 4);
      const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 4);
      const obeliskGeo = new THREE.ConeGeometry(1, 10, 4);
      
      const treeMat = new THREE.MeshStandardMaterial({ color: "#065f46", flatShading: true, roughness: 0.9 });
      const trunkMat = new THREE.MeshStandardMaterial({ color: "#1e293b", flatShading: true });
      const obeliskMat = new THREE.MeshStandardMaterial({ 
        color: "#f43f5e", 
        emissive: "#881337", 
        flatShading: true,
        roughness: 0.2,
        metalness: 0.8
      });

      // Scatter random trees & obelisks
      for (let i = 0; i < 180; i++) {
        const x = (Math.random() - 0.5) * (terrainSize - 20);
        const z = (Math.random() - 0.5) * (terrainSize - 20);

        // Find terrain elevation at this point
        const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrainMesh);

        if (intersects.length > 0) {
          const y = intersects[0].point.y;

          // Only place objects on land
          if (y > 0.5 && y < 6.0) {
            if (Math.random() > 0.1) {
              // Place tree
              const treeMesh = new THREE.Mesh(treeGeo, treeMat);
              const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
              
              treeMesh.position.y = 2.5;
              treeMesh.castShadow = true;
              trunkMesh.position.y = 0.75;
              trunkMesh.castShadow = true;

              const singleTree = new THREE.Group();
              singleTree.add(trunkMesh);
              singleTree.add(treeMesh);
              singleTree.position.set(x, y, z);
              
              // Random rotation & scaling
              const scale = 0.7 + Math.random() * 0.6;
              singleTree.scale.set(scale, scale, scale);
              singleTree.rotation.y = Math.random() * Math.PI;

              objectsGroup.add(singleTree);
            } else if (Math.random() > 0.85) {
              // Place neon obelisk
              const obelisk = new THREE.Mesh(obeliskGeo, obeliskMat);
              obelisk.position.set(x, y + 4.5, z);
              obelisk.castShadow = true;
              obelisk.rotation.y = Math.random() * Math.PI;
              obelisk.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.6, 0.8 + Math.random() * 0.4);
              objectsGroup.add(obelisk);
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
        // Track hover coordinates for styling HUD
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

      // Translate camera target based on screen pan
      // In isometric view, panning X maps to diagonal camera movement
      const factor = camera.zoom * 15;
      const moveX = (-deltaX + deltaY) / factor;
      const moveZ = (-deltaX - deltaY) / factor;

      cameraTarget.x += moveX;
      cameraTarget.z += moveZ;

      // Enforce bounds
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
      // Zoom logic
      let zoomAmount = e.deltaY * -0.001;
      camera.zoom = Math.max(0.4, Math.min(2.5, camera.zoom + zoomAmount));
      camera.updateProjectionMatrix();
    };

    const canvasElement = canvasRef.current;
    canvasElement.addEventListener("mousedown", handleMouseDown);
    canvasElement.addEventListener("mousemove", handleMouseMove);
    canvasElement.addEventListener("mouseup", handleMouseUp);
    canvasElement.addEventListener("wheel", handleWheel, { passive: false });

    // Touch support
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

    // 7. Resize Handler
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

    // 8. Animation & Render Loop
    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smoothly camera translation interpolate to cameraTarget
      const cameraPositionTarget = new THREE.Vector3(
        cameraTarget.x + 100,
        100,
        cameraTarget.z + 100
      );
      camera.position.lerp(cameraPositionTarget, 0.08);

      const lookTarget = camera.position.clone().add(new THREE.Vector3(-100, -100, -100));
      camera.lookAt(lookTarget);

      // Micro-animations: make mountains/water pulse gently
      // Obelisk rotation/floating
      objectsGroup.children.forEach((obj, idx) => {
        if (obj.geometry && obj.geometry.type === "ConeGeometry" && obj.scale.y > 1.2) {
          // Obelisk bounce/rotate
          obj.rotation.y += 0.005;
          obj.position.y += Math.sin(elapsedTime * 2 + idx) * 0.003;
        } else {
          // Trees sway
          obj.rotation.z = Math.sin(elapsedTime * 1.5 + idx) * 0.02;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup on unmount
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
      {/* 1. Neon Grid Loader (Simulated Matrix Canvas Setup) */}
      <div className={`loader-overlay ${isLoaded ? "hidden" : ""}`}>
        {/* Fine coordinate nodes backing grid */}
        <div className="cyber-grid-overlay"></div>
        <div className="scanner-line"></div>

        <div className="loader-container">
          <div className="loader-ring-wrapper">
            <div className="loader-ring-outer"></div>
            <div className="loader-ring-inner"></div>
            <div className="loader-crosshair"></div>
          </div>
          
          <div>
            <h2 className="loader-status-title glow-text-pink">SYSTEM MATRIX</h2>
            <div className="loader-status-text">{loadingLog}</div>
          </div>

          {/* Glowing bar */}
          <div style={{
            width: "220px",
            height: "4px",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "2px",
            overflow: "hidden",
            marginTop: "10px",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)"
          }}>
            <div style={{
              width: `${loadingProgress}%`,
              height: "100%",
              background: "linear-gradient(90deg, #f43f5e, #38bdf8)",
              boxShadow: "0 0 10px #f43f5e",
              transition: "width 0.15s ease-out"
            }}></div>
          </div>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-orbitron)" }}>
            {loadingProgress}% SYSTEM INTEGRITY
          </span>
        </div>
      </div>

      {/* 2. Main High-Density Low-Poly Canvas Map Container */}
      <div ref={containerRef} className="canvas-container">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      {/* 3. Cyberpunk Sidebar HUD Layout */}
      <nav className="sidebar-panel">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">
            LEDGER <span className="logo-dot"></span>
          </h1>
          <span style={{ fontSize: "0.6rem", color: "var(--accent-blue)", letterSpacing: "0.2em", fontFamily: "var(--font-orbitron)" }}>
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
          <span className="glow-text-blue">SYS_ACTIVE</span>
        </div>
      </nav>

      {/* 4. Active Spatial Hover Tracker HUD Panel */}
      <div className="overlay-panel">
        <h3 className="panel-title">
          <span>ACTIVE COORDINATES</span>
          <span className="logo-dot" style={{ margin: 0, backgroundColor: "var(--accent-blue)", boxShadow: "0 0 8px var(--accent-blue)" }}></span>
        </h3>
        <div className="panel-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontFamily: "var(--font-orbitron)", fontSize: "0.8rem", color: "var(--text-main)" }}>
            <div>X: <span className="glow-text-pink">{activeCoords.x}</span></div>
            <div>Z: <span className="glow-text-blue">{activeCoords.z}</span></div>
          </div>
          <p style={{ marginTop: "0.75rem", fontSize: "0.75rem" }}>
            Drag to pan the spatial grid. Scroll to scale zoom levels. Click nodes to initialize documentation blocks.
          </p>
          <button className="cyber-btn">TRIGGER SCAN</button>
        </div>
      </div>
    </div>
  );
}
