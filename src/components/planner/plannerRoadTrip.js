/**
 * Planner Trip Mode Quick Filter Module
 * Provides Road Trip vs Fly & Drive mode controls and payload mapping for AI Trip Planner.
 */

/**
 * Initializes the trip mode radio controls (Road Trip vs Fly & Drive).
 */
export function initPlannerRoadTripControls() {
  const form = document.getElementById('ai-planner-form');
  if (!form) return;

  const tripModeRadios = form.querySelectorAll('input[name="planner_trip_mode"]');

  tripModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const flightsCheckbox = form.querySelector('[name="include_flights"]');
      const carsCheckbox = form.querySelector('[name="include_cars"]');

      if (e.target.value === 'road_trip') {
        // Road trip: uncheck flights by default, keep car rentals
        if (flightsCheckbox) flightsCheckbox.checked = false;
        if (carsCheckbox) carsCheckbox.checked = true;
      } else if (e.target.value === 'fly_and_drive') {
        // Fly & Drive: check flights and car rentals by default
        if (flightsCheckbox) flightsCheckbox.checked = true;
        if (carsCheckbox) carsCheckbox.checked = true;
      }
    });
  });

  // Apply default state on initialization: Road Trip is selected by default
  const activeMode = form.querySelector('input[name="planner_trip_mode"]:checked')?.value || 'road_trip';
  if (activeMode === 'road_trip') {
    const flightsCheckbox = form.querySelector('[name="include_flights"]');
    if (flightsCheckbox) flightsCheckbox.checked = false;
  }
}

/**
 * Returns current trip mode flags for payload.
 * @returns {{road_trip: boolean, fly_and_drive: boolean, isRoadTrip: boolean, isFlyAndDrive: boolean}}
 */
export function getRoadTripSelection() {
  const form = document.getElementById('ai-planner-form');
  const selectedMode = form?.querySelector('input[name="planner_trip_mode"]:checked')?.value || 'road_trip';
  const isRoadTrip = selectedMode === 'road_trip';
  const isFlyAndDrive = selectedMode === 'fly_and_drive';

  return {
    road_trip: isRoadTrip,
    fly_and_drive: isFlyAndDrive,
    isRoadTrip,
    isFlyAndDrive
  };
}

/**
 * Programmatically restores Road Trip / Fly & Drive selection state.
 * @param {{road_trip?: boolean, fly_and_drive?: boolean, isRoadTrip?: boolean}} state
 */
export function setRoadTripSelection({ road_trip, fly_and_drive, isRoadTrip } = {}) {
  const form = document.getElementById('ai-planner-form');
  if (!form) return;

  const isFly = fly_and_drive !== undefined ? Boolean(fly_and_drive) : false;
  const isRoad = road_trip !== undefined ? Boolean(road_trip) : (isRoadTrip !== undefined ? Boolean(isRoadTrip) : !isFly);

  const roadRadio = form.querySelector('#planner-mode-roadtrip');
  const flyRadio = form.querySelector('#planner-mode-flydrive');

  if (roadRadio && flyRadio) {
    if (isFly && !isRoad) {
      flyRadio.checked = true;
    } else {
      roadRadio.checked = true;
    }
  }
}
