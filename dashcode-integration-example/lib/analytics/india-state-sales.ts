export type IndiaStateDefinition = {
  code: string;
  name: string;
  aliases: string[];
};

export type IndiaStateSalesItem = IndiaStateDefinition & {
  total: number;
  orderCount: number;
  percentage: number;
};

export type IndiaStateSalesData = {
  states: IndiaStateSalesItem[];
  topStates: IndiaStateSalesItem[];
  totalRevenue: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  monthGrowthPercent: number | null;
  orderCount: number;
  unknownOrderCount: number;
  maxStateRevenue: number;
  generatedAt: string;
};

export const INDIA_STATES: IndiaStateDefinition[] = [
  { code: "IN-AN", name: "Andaman and Nicobar Islands", aliases: ["andaman", "andaman and nicobar", "andaman and nicobar islands"] },
  { code: "IN-AP", name: "Andhra Pradesh", aliases: ["andhra", "andhra pradesh", "ap"] },
  { code: "IN-AR", name: "Arunachal Pradesh", aliases: ["arunachal", "arunachal pradesh"] },
  { code: "IN-AS", name: "Assam", aliases: ["assam"] },
  { code: "IN-BR", name: "Bihar", aliases: ["bihar"] },
  { code: "IN-CH", name: "Chandigarh", aliases: ["chandigarh"] },
  { code: "IN-CT", name: "Chhattisgarh", aliases: ["chhattisgarh", "chattisgarh", "ct"] },
  { code: "IN-DD", name: "Daman and Diu", aliases: ["daman", "diu", "daman and diu"] },
  { code: "IN-DL", name: "Delhi NCR", aliases: ["delhi", "new delhi", "nct delhi", "nct of delhi", "delhi ncr"] },
  { code: "IN-DN", name: "Dadra and Nagar Haveli", aliases: ["dadra", "nagar haveli", "dadra and nagar haveli"] },
  { code: "IN-GA", name: "Goa", aliases: ["goa"] },
  { code: "IN-GJ", name: "Gujarat", aliases: ["gujarat", "gj"] },
  { code: "IN-HP", name: "Himachal Pradesh", aliases: ["himachal", "himachal pradesh", "hp"] },
  { code: "IN-HR", name: "Haryana", aliases: ["haryana", "hr"] },
  { code: "IN-JH", name: "Jharkhand", aliases: ["jharkhand"] },
  { code: "IN-JK", name: "Jammu and Kashmir", aliases: ["jammu", "jammu and kashmir", "j and k", "jk", "kashmir", "ladakh"] },
  { code: "IN-KA", name: "Karnataka", aliases: ["karnataka", "ka"] },
  { code: "IN-KL", name: "Kerala", aliases: ["kerala", "kl"] },
  { code: "IN-LD", name: "Lakshadweep", aliases: ["lakshadweep"] },
  { code: "IN-MH", name: "Maharashtra", aliases: ["maharashtra", "mh"] },
  { code: "IN-ML", name: "Meghalaya", aliases: ["meghalaya"] },
  { code: "IN-MN", name: "Manipur", aliases: ["manipur"] },
  { code: "IN-MP", name: "Madhya Pradesh", aliases: ["madhya pradesh", "mp"] },
  { code: "IN-MZ", name: "Mizoram", aliases: ["mizoram"] },
  { code: "IN-NL", name: "Nagaland", aliases: ["nagaland"] },
  { code: "IN-OR", name: "Odisha", aliases: ["odisha", "orissa"] },
  { code: "IN-PB", name: "Punjab", aliases: ["punjab", "pb"] },
  { code: "IN-PY", name: "Puducherry", aliases: ["puducherry", "pondicherry"] },
  { code: "IN-RJ", name: "Rajasthan", aliases: ["rajasthan", "rj"] },
  { code: "IN-SK", name: "Sikkim", aliases: ["sikkim"] },
  { code: "IN-TG", name: "Telangana", aliases: ["telangana", "tg"] },
  { code: "IN-TN", name: "Tamil Nadu", aliases: ["tamil nadu", "tamilnadu", "tn"] },
  { code: "IN-TR", name: "Tripura", aliases: ["tripura"] },
  { code: "IN-UP", name: "Uttar Pradesh", aliases: ["uttar pradesh", "up"] },
  { code: "IN-UT", name: "Uttarakhand", aliases: ["uttarakhand", "uttaranchal", "ut"] },
  { code: "IN-WB", name: "West Bengal", aliases: ["west bengal", "bengal", "wb"] },
];

const CITY_STATE_ALIASES: Record<string, string> = {
  agra: "IN-UP",
  ahmedabad: "IN-GJ",
  bangalore: "IN-KA",
  bengaluru: "IN-KA",
  bhopal: "IN-MP",
  chandigarh: "IN-CH",
  chennai: "IN-TN",
  delhi: "IN-DL",
  faridabad: "IN-HR",
  ghaziabad: "IN-UP",
  gurgaon: "IN-HR",
  gurugram: "IN-HR",
  hyderabad: "IN-TG",
  jaipur: "IN-RJ",
  kolkata: "IN-WB",
  lucknow: "IN-UP",
  mumbai: "IN-MH",
  noida: "IN-UP",
  pune: "IN-MH",
  surat: "IN-GJ",
  vadodara: "IN-GJ",
};

function normalizeLocationValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STATE_LOOKUP = new Map<string, IndiaStateDefinition>();

for (const state of INDIA_STATES) {
  STATE_LOOKUP.set(normalizeLocationValue(state.code), state);
  STATE_LOOKUP.set(normalizeLocationValue(state.code.replace("IN-", "")), state);
  STATE_LOOKUP.set(normalizeLocationValue(state.name), state);

  for (const alias of state.aliases) {
    STATE_LOOKUP.set(normalizeLocationValue(alias), state);
  }
}

export function findIndianStateByCode(code: string) {
  return INDIA_STATES.find((state) => state.code === code) ?? null;
}

export function normalizeIndianState(stateValue?: string | null, cityValue?: string | null) {
  const stateKey = normalizeLocationValue(stateValue ?? "");
  const stateMatch = STATE_LOOKUP.get(stateKey);

  if (stateMatch) return stateMatch;

  const cityKey = normalizeLocationValue(cityValue ?? "");
  const cityCode = CITY_STATE_ALIASES[cityKey];

  return cityCode ? findIndianStateByCode(cityCode) : null;
}

export function getIndiaStateSalesFill(total: number, maxTotal: number) {
  if (!total || !maxTotal) return "#2d4665";

  const ratio = Math.max(0, Math.min(1, total / maxTotal));
  if (ratio >= 0.85) return "#38bdf8";
  if (ratio >= 0.6) return "#60a5fa";
  if (ratio >= 0.35) return "#6794dc";
  if (ratio >= 0.15) return "#4f7fbd";
  return "#3f638f";
}
