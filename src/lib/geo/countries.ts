// Canonical ISO 3166 country names — keep in sync with combatlink/src/lib/fight-data.ts

export const COUNTRIES: string[] = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso",
  "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic",
  "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia",
  "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti",
  "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea",
  "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India",
  "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica",
  "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova",
  "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine",
  "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
  "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
  "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen",
  "Zambia", "Zimbabwe",
];

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  us: "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  uae: "United Arab Emirates",
  "czech republic": "Czechia",
  "cape verde": "Cabo Verde",
  macedonia: "North Macedonia",
};

const COUNTRY_LOOKUP = new Map(COUNTRIES.map((c) => [c.toLowerCase(), c]));

export function normalizeCountry(raw: string | undefined | null): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  if (COUNTRY_LOOKUP.has(key)) return COUNTRY_LOOKUP.get(key)!;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  for (const country of COUNTRIES) {
    if (key.includes(country.toLowerCase())) return country;
  }
  return "";
}

export type ContinentId =
  | "africa"
  | "asia"
  | "europe"
  | "north-america"
  | "south-america"
  | "oceania";

export const CONTINENTS: { id: ContinentId; label: string; countries: string[] }[] = [
  {
    id: "europe",
    label: "Europe",
    countries: [
      "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina",
      "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France",
      "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia",
      "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro",
      "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia",
      "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland",
      "Ukraine", "United Kingdom", "Vatican City",
    ],
  },
  {
    id: "asia",
    label: "Asia",
    countries: [
      "Afghanistan", "Armenia", "Azerbaijan", "Bahrain", "Bangladesh", "Bhutan", "Brunei",
      "Cambodia", "China", "Georgia", "India", "Indonesia", "Iran", "Iraq", "Israel", "Japan",
      "Jordan", "Kazakhstan", "Kuwait", "Kyrgyzstan", "Laos", "Lebanon", "Malaysia", "Maldives",
      "Mongolia", "Myanmar", "Nepal", "North Korea", "Oman", "Pakistan", "Palestine",
      "Philippines", "Qatar", "Saudi Arabia", "Singapore", "South Korea", "Sri Lanka", "Syria",
      "Taiwan", "Tajikistan", "Thailand", "Timor-Leste", "Turkey", "Turkmenistan",
      "United Arab Emirates", "Uzbekistan", "Vietnam", "Yemen",
    ],
  },
  {
    id: "africa",
    label: "Africa",
    countries: [
      "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde",
      "Cameroon", "Central African Republic", "Chad", "Comoros", "Congo",
      "Democratic Republic of the Congo", "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea",
      "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau",
      "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali",
      "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria",
      "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
      "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia",
      "Zimbabwe",
    ],
  },
  {
    id: "north-america",
    label: "N. America",
    countries: [
      "Antigua and Barbuda", "Bahamas", "Barbados", "Belize", "Canada", "Costa Rica", "Cuba",
      "Dominica", "Dominican Republic", "El Salvador", "Grenada", "Guatemala", "Haiti",
      "Honduras", "Jamaica", "Mexico", "Nicaragua", "Panama", "Saint Kitts and Nevis",
      "Saint Lucia", "Saint Vincent and the Grenadines", "Trinidad and Tobago", "United States",
    ],
  },
  {
    id: "south-america",
    label: "S. America",
    countries: [
      "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay",
      "Peru", "Suriname", "Uruguay", "Venezuela",
    ],
  },
  {
    id: "oceania",
    label: "Oceania",
    countries: [
      "Australia", "Fiji", "Kiribati", "Marshall Islands", "Micronesia", "Nauru", "New Zealand",
      "Palau", "Papua New Guinea", "Samoa", "Solomon Islands", "Tonga", "Tuvalu", "Vanuatu",
    ],
  },
];

export function getCountriesForContinent(id: ContinentId): string[] {
  return CONTINENTS.find((c) => c.id === id)?.countries ?? [];
}

export function detectContinent(countries: string[]): ContinentId | undefined {
  if (!countries.length) return undefined;
  for (const continent of CONTINENTS) {
    const set = new Set(continent.countries);
    if (
      countries.length === continent.countries.length &&
      countries.every((c) => set.has(c))
    ) {
      return continent.id;
    }
  }
  return undefined;
}

export function resolveLocationCountries(
  countries?: string[],
  continent?: string
): string[] | null {
  if (countries?.length) return countries;
  if (continent) {
    const list = getCountriesForContinent(continent as ContinentId);
    return list.length ? list : null;
  }
  return null;
}
