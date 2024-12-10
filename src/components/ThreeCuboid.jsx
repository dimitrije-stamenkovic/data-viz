import { createSignal, onCleanup, onMount } from "solid-js";
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";

export default function ThreeCuboid(props) {
  let container;
  const { earthquakes, bounds } = props.earthquakeData || {};
  const [mode, setMode] = createSignal("explain");
  const [selectedEarthquakes, setSelectedEarthquakes] = createSignal([]);
  const [info, setInfo] = createSignal("");

  const toggleMode = () => {
    setMode(mode() === "explain" ? "compare" : "explain");
    setSelectedEarthquakes([]);
    setInfo("");
  };

  onMount(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const points = [];

    const geometry = new THREE.BoxGeometry(2, 1, 3);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x0077ff });
    const cuboid = new THREE.LineSegments(edges, material);
    scene.add(cuboid);

    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 2);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    camera.position.z = 5;

    if (earthquakes && bounds) {
      const latRange = bounds._northEast.lat - bounds._southWest.lat;
      const lngRange = bounds._northEast.lng - bounds._southWest.lng;

      const maxDepth = Math.max(...earthquakes.map((eq) => eq.geometry.coordinates[2]));
      const minDepth = Math.min(...earthquakes.map((eq) => eq.geometry.coordinates[2]));
      const maxMagnitude = Math.max(...earthquakes.map((eq) => eq.properties.mag));

      earthquakes.forEach((feature, index) => {
        const [lng, lat, depth] = feature.geometry.coordinates;
        const magnitude = feature.properties.mag;

        const z = ((lng - bounds._southWest.lng) / lngRange) * 2 - 1;
        const y = 0.5 + (depth / maxDepth) * -1;
        const x = ((lat - bounds._southWest.lat) / latRange) * 1 - 0.5;

        const colorValue = 1 - (depth - minDepth) / (maxDepth - minDepth);
        const color = new THREE.Color(
          `hsl(${Math.round(colorValue * 240)}, 100%, 50%)`
        );

        const size = (magnitude / maxMagnitude) * 0.06 + 0.01;

        const pointGeometry = new THREE.SphereGeometry(size);
        const pointMaterial = new THREE.MeshBasicMaterial({ color });
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        point.position.set(x, y, z);
        point.userData = { index, feature };
        scene.add(point);
        points.push(point);
      });
    }

    let comparisonLine;

    const handlePointClick = (point) => {
      const selected = [...selectedEarthquakes()];
      const feature = point.userData.feature;
    
      if (mode() === "explain") {
        setInfo(
          `Earthquake Details:       Magnitude: ${feature.properties.mag}       Depth: ${feature.geometry.coordinates[2]} km`
        );
      } else if (mode() === "compare") {
        if (selected.length < 2) {
          selected.push(feature);
          setSelectedEarthquakes(selected);
    
          point.material.color.set(0xffffff); // Turn selected points white
    
          if (selected.length === 2) {
            const [eq1, eq2] = selected;
            const dist = calculateDistance(
              eq1.geometry.coordinates,
              eq2.geometry.coordinates
            );
            const magDiff = Math.abs(
              eq1.properties.mag - eq2.properties.mag
            );
            const depthDiff = Math.abs(
              eq1.geometry.coordinates[2] - eq2.geometry.coordinates[2]
            );
            setInfo(
              `Comparison:       Distance: ${dist.toFixed(
                2
              )} km       Magnitude Difference: ${magDiff.toFixed(
                2
              )}       Depth Difference: ${depthDiff.toFixed(2)} km`
            );          
    
            // Draw line between the two points
            drawLine(eq1, eq2);
          }
        }
      }
    };
    
    const drawLine = (eq1, eq2) => {
      if (comparisonLine) {
        // Remove existing line
        scene.remove(comparisonLine);
      }
    
      // Get 3D positions of the points
      const [lng1, lat1, depth1] = eq1.geometry.coordinates;
      const [lng2, lat2, depth2] = eq2.geometry.coordinates;
    
      const latRange = bounds._northEast.lat - bounds._southWest.lat;
      const lngRange = bounds._northEast.lng - bounds._southWest.lng;
      const maxDepth = Math.max(...earthquakes.map((eq) => eq.geometry.coordinates[2]));
    
      const pos1 = new THREE.Vector3(
        ((lat1 - bounds._southWest.lat) / latRange) * 1 - 0.5,
        0.5 + (depth1 / maxDepth) * -1,
        ((lng1 - bounds._southWest.lng) / lngRange) * 2 - 1
      );
    
      const pos2 = new THREE.Vector3(
        ((lat2 - bounds._southWest.lat) / latRange) * 1 - 0.5,
        0.5 + (depth2 / maxDepth) * -1,
        ((lng2 - bounds._southWest.lng) / lngRange) * 2 - 1
      );
    
      // Create geometry and material for the line
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([pos1, pos2]);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
      comparisonLine = new THREE.Line(lineGeometry, lineMaterial);
    
      // Add line to the scene
      scene.add(comparisonLine);
    };

    const calculateDistance = (coords1, coords2) => {
      const [lon1, lat1] = coords1;
      const [lon2, lat2] = coords2;

      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const onMouseClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(points);

      if (intersects.length > 0) {
        handlePointClick(intersects[0].object);
      }
    };

    container.addEventListener("click", onMouseClick);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0);
    controls.update();

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    onCleanup(() => {
      container.removeEventListener("click", onMouseClick);
      renderer.dispose();
      controls.dispose();
    });

    window.addEventListener("resize", () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    });
  });

  return (
    <div>
      <div ref={container} style={{ width: "100%", height: "100vh" }} />
      <button
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
        }}
        onClick={toggleMode}
      >
        {mode() === "explain" ? "Switch to Compare" : "Switch to Explain"}
      </button>
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: info() ? "#ffffff" : "transparent",
          padding: info() ? "15px" : "0",
          border: info() ? "1px solid #ccc" : "none",
          borderRadius: "8px",
          boxShadow: info()
            ? "0px 4px 6px rgba(0, 0, 0, 0.1)"
            : "none",
          width: "300px",
          height: "auto",
          whiteSpace: "pre-wrap",
          color: info() ? "#333" : "transparent",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          fontSize: "14px",
          lineHeight: "1.5",
          transition: "all 0.3s ease-in-out",
        }}
      >
        {info() ? info() : ""}
      </div>
    </div>
  );
}
