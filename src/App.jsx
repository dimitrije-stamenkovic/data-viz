// src/App.jsx
import './App.css';
import { createSignal, Show } from 'solid-js';
import MapComponent from './components/MapComponent';
import ThreeCuboid from './components/ThreeCuboid';

function App() {
  const [selectedAreaData, setSelectedAreaData] = createSignal({
      earthquakes:[],
      bounds: null

  });
  const [show3DView, setShow3DView] = createSignal(false);
  const [isSelecting, setIsSelecting] = createSignal(false);

  const handleSelection = (selectedEarthquakes) => {
    setSelectedAreaData(selectedEarthquakes);
    console.log("selectedAreaData", selectedAreaData());
  };

  const toggle3DView = () => {
    setShow3DView(!show3DView());
  };

  const toggleSelection = () => {
    setIsSelecting(!isSelecting());
  };

  return (
      <div>
        <div className="button-container">
          <button onClick={toggleSelection}>
            {isSelecting() ? "Reset Selection" : "Select Area"}
          </button>
          <button onClick={toggle3DView}>
            {show3DView() ? "View Map" : "View 3D"}
          </button>
        </div>
        <Show when={!show3DView()} fallback={<ThreeCuboid earthquakeData={selectedAreaData()} />}>
        <MapComponent
              onAreaSelect={handleSelection}
              isSelecting={isSelecting}
          />
          <div className="selection-count-label">
              {selectedAreaData() != null ? "Selected Earthquakes:" + selectedAreaData().earthquakes.length : "Selected Earthquakes: 0" }
              {/*{if (selectedAreaData() == null){*/}
              {/*    "Selected Earthquakes: 0"*/}
              {/*}else{*/}
              {/*    "Selected Earthquakes:" + selectedAreaData().earthquakes.length*/}
              {/*}}*/}
          </div>
        </Show>
      </div>
  );
}

export default App;
