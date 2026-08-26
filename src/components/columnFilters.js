import { state, $ } from '../core/state.js';
import { renderOffers } from './offerTable.js';
import { money } from '../utils/formatters.js';

export function getHourFromStr(timeStr) {
  if (!timeStr) return 12;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 12;
  let hour = parseInt(match[1], 10);
  const ampm = match[3] ? match[3].toUpperCase() : '';
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour;
}

export function initColumnFilters() {
  document.addEventListener('click', (e) => {
    // 1. Handle filter trigger button clicks
    const trigger = e.target.closest('[data-filter-trigger]');
    if (trigger) {
      e.stopPropagation();
      e.preventDefault();
      const filterName = trigger.dataset.filterTrigger;
      const targetPopover = document.querySelector(`[data-filter-popover="${filterName}"]`);

      document.querySelectorAll('.col-filter-popover').forEach((pop) => {
        if (pop !== targetPopover) pop.classList.add('hidden');
      });

      if (targetPopover) {
        targetPopover.classList.toggle('hidden');
        console.log(`✨ [FILTER POPOVER TOGGLE] ${filterName} -> Hidden: ${targetPopover.classList.contains('hidden')}`);
      }
      return;
    }

    // 2. Close active popovers if clicking outside
    if (!e.target.closest('[data-col-filter-wrap]')) {
      document.querySelectorAll('.col-filter-popover').forEach((pop) => pop.classList.add('hidden'));
    }
  });

  // Attach ESC key listener to close popovers
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.col-filter-popover').forEach((pop) => pop.classList.add('hidden'));
    }
  });
}


/**
 * Dynamically builds and updates option lists inside popovers based on state.offers data
 */
export function updateColumnFilterPopovers() {
  const offers = state.offers || [];
  if (!offers.length) return;

  // 1. Unique Airlines
  const distinctAirlines = [...new Set(offers.map((o) => o.airline).filter(Boolean))].sort();
  
  // 2. Unique Date Ranges
  const distinctDates = [...new Set(offers.map((o) => o.dateRangeText).filter(Boolean))].sort();

  // Render/Update DATES Popover
  renderPopoverHTML('dates', 'Filter Dates', [
    ...distinctDates.map((d) => ({ id: `date_${d}`, label: d, type: 'dates', val: d })),
    { id: 'date_round', label: 'Round trip', type: 'dates', val: 'Round trip' },
    { id: 'date_oneway', label: 'One way', type: 'dates', val: 'One way' }
  ]);

  // Render/Update DEPARTURE Popover
  renderPopoverHTML('departure', 'Filter Departure & Airlines', [
    ...distinctAirlines.map((a) => ({ id: `air_${a}`, label: a, type: 'airlines', val: a })),
    { id: 'dep_morning', label: '🌅 Morning (Before 12 PM)', type: 'depTimes', val: 'morning' },
    { id: 'dep_afternoon', label: '☀️ Afternoon (12 PM - 6 PM)', type: 'depTimes', val: 'afternoon' },
    { id: 'dep_evening', label: '🌙 Evening (After 6 PM)', type: 'depTimes', val: 'evening' }
  ]);

  // Render/Update RETURN Popover
  renderPopoverHTML('return', 'Filter Return Times', [
    { id: 'ret_morning', label: '🌅 Morning (Before 12 PM)', type: 'retTimes', val: 'morning' },
    { id: 'ret_afternoon', label: '☀️ Afternoon (12 PM - 6 PM)', type: 'retTimes', val: 'afternoon' },
    { id: 'ret_evening', label: '🌙 Evening (After 6 PM)', type: 'retTimes', val: 'evening' }
  ]);

  // Render/Update DURATION Popover
  renderPopoverHTML('duration', 'Filter Flight Duration', [
    { id: 'dur_under3', label: '⚡ Under 3 hours', type: 'durations', val: 'under3' },
    { id: 'dur_3to6', label: '⏱️ 3 to 6 hours', type: 'durations', val: '3to6' },
    { id: 'dur_6to9', label: '⏱️ 6 to 9 hours', type: 'durations', val: '6to9' },
    { id: 'dur_over9', label: '⏱️ 9+ hours', type: 'durations', val: 'over9' }
  ]);

  // Render/Update STOPS Popover
  renderPopoverHTML('stops', 'Filter Stops', [
    { id: 'stop_0', label: '✈️ Nonstop (0 stops)', type: 'stopsList', val: '0' },
    { id: 'stop_1', label: '🏷️ 1 Stop', type: 'stopsList', val: '1' },
    { id: 'stop_2plus', label: '🏷️ 2+ Stops', type: 'stopsList', val: '2plus' }
  ]);

  // Render/Update PRICE Popover
  renderPopoverHTML('price', 'Filter Price Tier', [
    { id: 'price_under100', label: '💵 Under $100', type: 'priceRanges', val: 'under100' },
    { id: 'price_100to200', label: '💵 $100 – $200', type: 'priceRanges', val: '100to200' },
    { id: 'price_200to500', label: '💵 $200 – $500', type: 'priceRanges', val: '200to500' },
    { id: 'price_over500', label: '💵 $500+', type: 'priceRanges', val: 'over500' }
  ]);

  updateFilterTriggerBadges();
}

function renderPopoverHTML(filterName, titleText, options) {
  const container = document.querySelector(`[data-filter-popover="${filterName}"]`);
  if (!container) return;

  const currentSelection = state.filters;

  // If container is already populated, just sync checkbox states to preserve focus & popover DOM
  const existingList = container.querySelector('.popover-options-list');
  if (existingList) {
    options.forEach((opt) => {
      const chk = container.querySelector(`input[data-filter-type="${opt.type}"][value="${opt.val}"]`);
      if (chk) {
        chk.checked = Array.isArray(currentSelection[opt.type]) && currentSelection[opt.type].includes(opt.val);
      }
    });
    return;
  }

  container.innerHTML = `
    <div class="popover-header">
      <strong>${titleText}</strong>
      <button type="button" class="popover-clear-btn" data-popover-clear="${filterName}">Clear</button>
    </div>
    <div class="popover-options-list">
      ${options.map((opt) => {
        const isChecked = Array.isArray(currentSelection[opt.type]) && currentSelection[opt.type].includes(opt.val);
        return `
          <label class="popover-option-item">
            <input type="checkbox" data-filter-type="${opt.type}" value="${opt.val}" ${isChecked ? 'checked' : ''} />
            <span>${opt.label}</span>
          </label>
        `;
      }).join('')}
    </div>
  `;


  // Attach change listeners to checkboxes
  container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      const type = input.dataset.filterType;
      const val = input.value;

      if (!Array.isArray(state.filters[type])) {
        state.filters[type] = [];
      }

      if (input.checked) {
        if (!state.filters[type].includes(val)) state.filters[type].push(val);
      } else {
        state.filters[type] = state.filters[type].filter((v) => v !== val);
      }

      renderOffers();
      updateFilterTriggerBadges();
    });
  });

  // Attach clear button listener
  container.querySelectorAll('[data-popover-clear]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      options.forEach((opt) => {
        if (Array.isArray(state.filters[opt.type])) {
          state.filters[opt.type] = [];
        }
      });
      container.querySelectorAll('input[type="checkbox"]').forEach((chk) => (chk.checked = false));
      renderOffers();
      updateFilterTriggerBadges();
    });
  });
}

function updateFilterTriggerBadges() {
  const f = state.filters;

  const badgeCounts = {
    dates: (f.dates || []).length,
    departure: (f.airlines || []).length + (f.depTimes || []).length,
    return: (f.retTimes || []).length,
    duration: (f.durations || []).length,
    stops: (f.stopsList || []).length,
    price: (f.priceRanges || []).length
  };

  Object.entries(badgeCounts).forEach(([name, count]) => {
    const trigger = document.querySelector(`[data-filter-trigger="${name}"]`);
    if (trigger) {
      trigger.classList.toggle('has-active-filters', count > 0);
      const badge = trigger.querySelector('.filter-count-badge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.classList.remove('hidden');
        } else {
          badge.textContent = '';
          badge.classList.add('hidden');
        }
      }
    }
  });
}
