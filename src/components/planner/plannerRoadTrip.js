/**
 * Planner Road Trip Quick Filter Module
 * Provides Road Trip toggle controls and prompt augmentation for AI Trip Planner.
 */

/**
 * Initializes the Road Trip checkbox controls.
 */
export function initPlannerRoadTripControls() {
  const form = document.getElementById('ai-planner-form');
  if (!form) return;

  const roadTripCheckbox = form.querySelector('#planner-roadtrip-checkbox');

  // Handle Road Trip checkbox interaction: uncheck flights option by default when selected
  if (roadTripCheckbox) {
    roadTripCheckbox.addEventListener('change', (e) => {
      const flightsCheckbox = form.querySelector('[name="include_flights"]');
      if (e.target.checked) {
        if (flightsCheckbox) {
          flightsCheckbox.checked = false;
        }
      } else {
        if (flightsCheckbox) {
          flightsCheckbox.checked = true;
        }
      }
    });
  }
}

/**
 * Returns current Road Trip checkbox state.
 * @returns {{isRoadTrip: boolean}}
 */
export function getRoadTripSelection() {
  const form = document.getElementById('ai-planner-form');
  const isRoadTrip = Boolean(form?.querySelector('#planner-roadtrip-checkbox')?.checked);
  return {
    isRoadTrip
  };
}

/**
 * Internally appends "Road Trip" to the entered search text with a space
 * if selected and not already in the query.
 * @param {string} enteredText
 * @returns {string}
 */
export function augmentPromptWithRoadTrip(enteredText) {
  const { isRoadTrip } = getRoadTripSelection();
  let result = (enteredText || '').trim();

  if (isRoadTrip && !/\broad\s*trip\b/i.test(result)) {
    result = result ? `${result} Road Trip` : 'Road Trip';
  }

  return result;
}

/**
 * Programmatically restores Road Trip selection state.
 * @param {{isRoadTrip?: boolean}} state
 */
export function setRoadTripSelection({ isRoadTrip } = {}) {
  const form = document.getElementById('ai-planner-form');
  const checkbox = form?.querySelector('#planner-roadtrip-checkbox');
  if (checkbox) {
    checkbox.checked = Boolean(isRoadTrip);
  }
}
