export const EXTERNAL_AIRLINES_CONFIG = {
  "frontier": {
    "key": "frontier",
    "name": "Frontier Airlines",
    "code": "F9",
    "keywords": [
      "frontier",
      "flyfrontier",
      "f9"
    ],
    "mainUrl": "https://www.flyfrontier.com",
    "badgeText": "Frontier Direct Web Fare",
    "buttonText": "Book with Frontier Airlines",
    "noticeText": "This ultra-low fare is hosted directly on Frontier Airlines (flyfrontier.com)."
  },
  "spirit": {
    "key": "spirit",
    "name": "Spirit Airlines",
    "code": "NK",
    "keywords": [
      "spirit",
      "spirit.com",
      "nk"
    ],
    "mainUrl": "https://www.spirit.com",
    "badgeText": "Spirit Direct Web Fare",
    "buttonText": "Book with Spirit Airlines",
    "noticeText": "This ultra-low fare is hosted directly on Spirit Airlines (spirit.com)."
  },
  "ryanair": {
    "key": "ryanair",
    "name": "Ryanair",
    "code": "FR",
    "keywords": [
      "ryanair",
      "fr"
    ],
    "mainUrl": "https://www.ryanair.com",
    "badgeText": "Ryanair Direct Web Fare",
    "buttonText": "Book with Ryanair",
    "noticeText": "This ultra-low fare is hosted directly on Ryanair (ryanair.com)."
  },
  "wizz": {
    "key": "wizz",
    "name": "Wizz Air",
    "code": "W6",
    "keywords": [
      "wizz",
      "wizzair",
      "w6"
    ],
    "mainUrl": "https://wizzair.com",
    "badgeText": "Wizz Air Direct Web Fare",
    "buttonText": "Book with Wizz Air",
    "noticeText": "This ultra-low fare is hosted directly on Wizz Air (wizzair.com)."
  },
  "breeze": {
    "key": "breeze",
    "name": "Breeze Airways",
    "code": "MX",
    "keywords": [
      "breeze",
      "flybreeze",
      "mx"
    ],
    "mainUrl": "https://www.flybreeze.com",
    "badgeText": "Breeze Direct Web Fare",
    "buttonText": "Book with Breeze Airways",
    "noticeText": "This ultra-low fare is hosted directly on Breeze Airways (flybreeze.com)."
  },
  "allegiant": {
    "key": "allegiant",
    "name": "Allegiant Air",
    "code": "G4",
    "keywords": [
      "allegiant",
      "allegiantair",
      "g4"
    ],
    "mainUrl": "https://www.allegiantair.com",
    "badgeText": "Allegiant Direct Web Fare",
    "buttonText": "Book with Allegiant Air",
    "noticeText": "This ultra-low fare is hosted directly on Allegiant Air (allegiantair.com)."
  }
};

export function getExternalAirlineConfig(airlineNameOrCode) {
  if (!airlineNameOrCode) return null;
  const target = String(airlineNameOrCode).toLowerCase().trim();
  for (const [key, cfg] of Object.entries(EXTERNAL_AIRLINES_CONFIG)) {
    if (cfg.key === target || cfg.code.toLowerCase() === target || cfg.name.toLowerCase() === target) return cfg;
    if (cfg.keywords.some((kw) => target.includes(kw) || kw.includes(target))) return cfg;
  }
  return null;
}

export function isExternalWebFareAirline(airlineNameOrCode) {
  return Boolean(getExternalAirlineConfig(airlineNameOrCode));
}
