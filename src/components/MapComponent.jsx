// src/components/MapComponent.jsx
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MapComponent({ onAreaSelect, isSelecting }) {
  let mapContainer;
  const [map, setMap] = createSignal();
  const [fetchedEarthquakes, setEarthquakes] = createSignal([]);
  const [filteredEarthquakes, setFilteredEarthquakes] = createSignal([]);
  const [selectionRectangle, setSelectionRectangle] = createSignal(null);
  // New filter state
  const [filters, setFilters] = createSignal({
    minMagnitude: 0,
    maxMagnitude: 10,
    minDepth: -10,
    maxDepth: 700,
    startDate: '2014-01-01',
    endDate: '2014-01-02'
  });
  let startPoint = null;

  onMount(() => {
    if (mapContainer && !map()) {
      const newMap = L.map(mapContainer, { zoomControl: false }).setView([0, 0], 2);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }).addTo(newMap);

      L.control.zoom({
        position: 'bottomright'
      }).addTo(newMap);

      setMap(newMap);

      fetchEarthquakeData();

      newMap.on('mousedown', startSelection);
      newMap.on("mousemove", inProgressSelection);
      newMap.on("mouseup", endSelection);
      
      // Add filter control to the map
      createFilterControl(newMap);
    }
  });

  async function fetchEarthquakeData() {
    try {
      const { startDate, endDate } = filters();
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startDate}&endtime=${endDate}`;
      const response = await fetch(url);
      const data = await response.json();
      setEarthquakes(data.features);
      applyFilters(); // Apply filters after fetching
    } catch (error) {
      console.error("Error fetching earthquake data:", error);
    }
  }

  function applyFilters() {
    const { minMagnitude, maxMagnitude, minDepth, maxDepth } = filters();
    
    const filtered = fetchedEarthquakes().filter(feature => {
      const depth = feature.geometry.coordinates[2];
      const magnitude = feature.properties.mag;
      
      return (
        magnitude >= minMagnitude && 
        magnitude <= maxMagnitude &&
        depth >= minDepth &&
        depth <= maxDepth
      );
    });
    
    setFilteredEarthquakes(filtered);
    plotEarthquakeData();
  }

  function createFilterControl(mapInstance) {
    // Create a custom control for filters
    const FilterControl = L.Control.extend({
      options: {
        position: 'topright'  // Changed from 'topleft' to 'topright'
      },
      
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-filter');
        container.style.backgroundColor = 'white';
        container.style.padding = '10px';
        container.style.width = '250px';
        container.style.maxHeight = '80vh';
        container.style.overflowY = 'auto';
        
        container.innerHTML = `
          <h4 style="margin-top: 0;">Earthquake Filters</h4>
          
          <div style="margin-bottom: 10px;">
            <label>Magnitude Range:</label><br>
            <div style="display: flex; justify-content: space-between;">
              <input id="min-mag" type="number" min="0" max="10" step="0.1" value="${filters().minMagnitude}" style="width: 45%;">
              <span>to</span>
              <input id="max-mag" type="number" min="0" max="10" step="0.1" value="${filters().maxMagnitude}" style="width: 45%;">
            </div>
          </div>
          
          <div style="margin-bottom: 10px;">
            <label>Depth Range (km):</label><br>
            <div style="display: flex; justify-content: space-between;">
              <input id="min-depth" type="number" min="-10" max="700" step="1" value="${filters().minDepth}" style="width: 45%;">
              <span>to</span>
              <input id="max-depth" type="number" min="-10" max="700" step="1" value="${filters().maxDepth}" style="width: 45%;">
            </div>
          </div>
          
          <div style="margin-bottom: 10px;">
            <label>Date Range:</label><br>
            <div style="display: flex; justify-content: space-between;">
              <input id="start-date" type="date" value="${filters().startDate}" style="width: 45%;">
              <span>to</span>
              <input id="end-date" type="date" value="${filters().endDate}" style="width: 45%;">
            </div>
          </div>
          
          <button id="apply-filters" style="width: 100%; padding: 5px;">Apply Filters</button>
        `;
        
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        setTimeout(() => {
          const applyButton = document.getElementById('apply-filters');
          if (applyButton) {
            applyButton.addEventListener('click', () => {
              const newFilters = {
                minMagnitude: parseFloat(document.getElementById('min-mag').value),
                maxMagnitude: parseFloat(document.getElementById('max-mag').value),
                minDepth: parseFloat(document.getElementById('min-depth').value),
                maxDepth: parseFloat(document.getElementById('max-depth').value),
                startDate: document.getElementById('start-date').value,
                endDate: document.getElementById('end-date').value
              };
              
              setFilters(newFilters);
              
              if (newFilters.startDate !== filters().startDate || 
                  newFilters.endDate !== filters().endDate) {
                // If date range changed, fetch new data
                fetchEarthquakeData();
              } else {
                // Otherwise just apply filters to existing data
                applyFilters();
              }
            });
          }
        }, 0);
        
        return container;
      }
    });
    
    new FilterControl().addTo(mapInstance);
  }

  function plotEarthquakeData() {
    const currentMap = map();
    if (currentMap) {
      currentMap.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
          currentMap.removeLayer(layer);
        }
      });
  
      // Use filtered earthquakes instead of all earthquakes
      const earthquakesToPlot = filteredEarthquakes();
      
      if (earthquakesToPlot.length === 0) {
        // Display a message when no earthquakes match filters
        const noDataMessage = L.control({position: 'bottomleft'});
        noDataMessage.onAdd = function() {
          const div = L.DomUtil.create('div', 'no-data-message');
          div.innerHTML = '<div style="background: white; padding: 5px; border-radius: 3px;">No earthquakes match the current filters</div>';
          return div;
        };
        noDataMessage.addTo(currentMap);
        setTimeout(() => noDataMessage.remove(), 3000);
        return;
      }
      
      const minDepth = Math.min(...earthquakesToPlot.map(e => e.geometry.coordinates[2]));
      const maxDepth = Math.max(...earthquakesToPlot.map(e => e.geometry.coordinates[2]));
  
      earthquakesToPlot.forEach((feature) => {
        const [longitude, latitude, depth] = feature.geometry.coordinates;
        const { mag, place, time, updated, url, status, tsunami, sig, magType, title } = feature.properties;
  
        // Format timestamps
        const formattedTime = new Date(time).toLocaleString();
        const formattedUpdated = updated ? new Date(updated).toLocaleString() : "N/A";
  
        // Map depth to a [0, 1] range
        const colorValue = 1 - (depth - minDepth) / (maxDepth - minDepth || 1);
  
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
  
  // Rest of your existing functions (startSelection, inProgressSelection, etc.)
  
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

    if (selectionRectangle()) {
      selectionRectangle().setBounds(bounds);
    } else {
      setSelectionRectangle(L.rectangle(bounds, { color: "#3388ff", weight: 1, interactive: false }));
      selectionRectangle().addTo(map());
    }
  }

  function endSelection() {
    if (selectionRectangle()) {
      const bounds = selectionRectangle().getBounds();
      console.log("Selected bounds:", bounds);

      // Filter earthquakes within the selected bounds
      const selectedEarthquakes = filteredEarthquakes().filter(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        return bounds.contains(L.latLng(lat, lng));
      });
      // Call onAreaSelect with the selected earthquakes
      onAreaSelect({ earthquakes: selectedEarthquakes, bounds });
    }

    startPoint = null;
    map() && selectionRectangle() && selectionRectangle().remove();
    setSelectionRectangle(null);
  }

  createEffect(() => {
    if (map()) {
      if (isSelecting()) {
        map().dragging.disable();
        map().getContainer().style.cursor = 'crosshair';
      } else {
        map().dragging.enable();
        map().getContainer().style.cursor = '';
      }
    }
  });

  return (
      <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
        <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(255,255,255,0.8)', padding: '5px', borderRadius: '4px' }}>
          Showing {filteredEarthquakes().length} of {fetchedEarthquakes().length} earthquakes
        </div>
      </div>
  );
}

export default MapComponent;
