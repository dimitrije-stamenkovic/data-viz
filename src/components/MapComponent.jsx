// src/components/MapComponent.jsx
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MapComponent({ onAreaSelect, isSelecting }) {
  let mapContainer;
  const [map, setMap] = createSignal();
  const [fetchedEarthquakes, setEarthquakes] = createSignal([]);
  const [selectionRectangle, setSelectionRectangle] = createSignal(null);
  let startPoint = null;

  onMount(() => {
    if (mapContainer && !map()) {
      const newMap = L.map(mapContainer, { zoomControl: false }).setView([0, 0], 2);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }).addTo(newMap);

      // L.tileLayer.here({ apiKey: 'abcde' }).addTo(newMap);


      L.control.zoom({
        position: 'bottomright'
      }).addTo(newMap);

      setMap(newMap);



      fetchEarthquakeData();

      newMap.on('mousedown', startSelection);
      newMap.on("mousemove", inProgressSelection);
      newMap.on("mouseup", endSelection);
    }
  });

  async function fetchEarthquakeData() {
    try {
      const response = await fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2014-01-01&endtime=2014-01-02');
      const data = await response.json();
      setEarthquakes(data.features);
      plotEarthquakeData();
    } catch (error) {
      console.error("Error fetching earthquake data:", error);
    }
  }

  function plotEarthquakeData() {
    const currentMap = map();
    if (currentMap) {
      currentMap.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Rectangle) {
          currentMap.removeLayer(layer);
        }
      });
  
      const minDepth = Math.min(...fetchedEarthquakes().map(e => e.geometry.coordinates[2]));
      const maxDepth = Math.max(...fetchedEarthquakes().map(e => e.geometry.coordinates[2]));
  
      fetchedEarthquakes().forEach((feature) => {
        const [longitude, latitude, depth] = feature.geometry.coordinates;
        const { mag, place, time, updated, url, status, tsunami, sig, magType, title } = feature.properties;
  
        // Format timestamps
        const formattedTime = new Date(time).toLocaleString();
        const formattedUpdated = updated ? new Date(updated).toLocaleString() : "N/A";
  
        // Map depth to a [0, 1] range
        const colorValue = 1 - (depth - minDepth) / (maxDepth - minDepth);
  
        // Convert colorValue to HSL for a gradient from blue (deep) to red (shallow)
        const fillColor = `hsl(${Math.round(colorValue * 240)}, 100%, 50%)`;
  
        // Set radius based on magnitude
        const radius = mag * 2;
  
        // Create a circle marker
        const marker = L.circleMarker([latitude, longitude], {
          radius: radius,
          fillColor: fillColor,
          color: fillColor,
          fillOpacity: 0.5,
        }).addTo(currentMap);
  
        // Construct the popup content
        const popupContent = `
          <div>
            <strong>${title}</strong><br>
            <strong>Magnitude:</strong> ${mag} (${magType})<br>
            <strong>Depth:</strong> ${depth.toFixed(2)} km<br>
            <strong>Location:</strong> ${place}<br>
            <strong>Time:</strong> ${formattedTime}<br>
            <strong>Last Updated:</strong> ${formattedUpdated}<br>
            <strong>Status:</strong> ${status}<br>
            <strong>Tsunami Warning:</strong> ${tsunami === 1 ? "Yes" : "No"}<br>
            <strong>Significance:</strong> ${sig}<br>
            <a href="${url}" target="_blank">More Info</a>
          </div>
        `;
        marker.bindPopup(popupContent);
      });
    }
  }
  
  function startSelection(e) {
    startPoint = e.latlng;
  }

  function inProgressSelection(e) {
    if (!startPoint) return;

    let latDiff = Math.abs(startPoint.lat - e.latlng.lat);
    let lngDiff = Math.abs(startPoint.lng - e.latlng.lng);

    // Define maximum and aspect ratio limits
    const maxLatDiff = 20;
    const maxLngDiff = 40;
    const aspectRatio = 1 / 2; // Height to width ratio of 1:2

    // Apply max limits
    latDiff = Math.min(latDiff, maxLatDiff);
    lngDiff = Math.min(lngDiff, maxLngDiff);

    // Adjust differences to maintain aspect ratio
    if (latDiff / lngDiff > aspectRatio) {
      // If latDiff is too large relative to lngDiff, adjust it
      latDiff = lngDiff * aspectRatio;
    } else {
      // If lngDiff is too large relative to latDiff, adjust it
      lngDiff = latDiff / aspectRatio;
    }

    // Create adjusted LatLng based on the limited and aspect ratio-constrained differences
    const adjustedLatLng = L.latLng(
        startPoint.lat + (e.latlng.lat > startPoint.lat ? latDiff : -latDiff),
        startPoint.lng + (e.latlng.lng > startPoint.lng ? lngDiff : -lngDiff)
    );

    const bounds = L.latLngBounds(startPoint, adjustedLatLng);
    console.log("Latitude Difference:", latDiff, "Longitude Difference:", lngDiff);

    if (selectionRectangle()) {
      selectionRectangle().setBounds(bounds);
    } else {
      setSelectionRectangle(L.rectangle(bounds, { color: "#3388ff", weight: 1, interactive: false }));
      selectionRectangle().addTo(map());
    }
  }



  // function endSelection() {
  //   if (selectionRectangle()) {
  //     const bounds = selectionRectangle().getBounds();
  //     console.log("Selected bounds:", bounds);
  //   }
  //
  //   startPoint = null;
  //   selectionRectangle(null);
  // }


  function endSelection() {
    if (selectionRectangle()) {
      const bounds = selectionRectangle().getBounds();
      console.log("Selected bounds:", bounds);

      // Filter earthquakes within the selected bounds
      const selectedEarthquakes = fetchedEarthquakes().filter(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        return bounds.contains(L.latLng(lat, lng));
      });
      // Call onAreaSelect with the selected earthquakes
      // onAreaSelect(selectedEarthquakes);
      onAreaSelect({ earthquakes: selectedEarthquakes, bounds });
    }

    startPoint = null;
    selectionRectangle(null);
  }


  createEffect(() => {
    if (isSelecting()) {
      map().dragging.disable();
      map().getContainer().style.cursor = 'crosshair';
    } else {
      map().dragging.enable();
      map().getContainer().style.cursor = '';
    }
  });

  return (
      <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
        <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />
        {/*{selectedEarthquakes()?.length > 0 && (*/}
        {/*    <div className="selection-info">*/}
        {/*      Selected Earthquakes: {selectedEarthquakes()?.length}*/}
        {/*    </div>*/}
        {/*)}*/}
      </div>
  );
}

export default MapComponent;
