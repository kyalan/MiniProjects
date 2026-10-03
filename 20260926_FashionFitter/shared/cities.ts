export interface CityOption {
  id: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  aliases?: string[];
}

export const EAST_ASIA_CITIES: CityOption[] = [
  { id: "tokyo", city: "Tokyo", region: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo" },
  { id: "yokohama", city: "Yokohama", region: "Kanagawa", country: "Japan", latitude: 35.4437, longitude: 139.638, timezone: "Asia/Tokyo" },
  { id: "osaka", city: "Osaka", region: "Osaka", country: "Japan", latitude: 34.6937, longitude: 135.5023, timezone: "Asia/Tokyo" },
  { id: "kyoto", city: "Kyoto", region: "Kyoto", country: "Japan", latitude: 35.0116, longitude: 135.7681, timezone: "Asia/Tokyo" },
  { id: "nagoya", city: "Nagoya", region: "Aichi", country: "Japan", latitude: 35.1815, longitude: 136.9066, timezone: "Asia/Tokyo" },
  { id: "sapporo", city: "Sapporo", region: "Hokkaido", country: "Japan", latitude: 43.0618, longitude: 141.3545, timezone: "Asia/Tokyo" },
  { id: "fukuoka", city: "Fukuoka", region: "Fukuoka", country: "Japan", latitude: 33.5902, longitude: 130.4017, timezone: "Asia/Tokyo" },
  { id: "kobe", city: "Kobe", region: "Hyogo", country: "Japan", latitude: 34.6901, longitude: 135.1955, timezone: "Asia/Tokyo" },
  { id: "hiroshima", city: "Hiroshima", region: "Hiroshima", country: "Japan", latitude: 34.3853, longitude: 132.4553, timezone: "Asia/Tokyo" },
  { id: "sendai", city: "Sendai", region: "Miyagi", country: "Japan", latitude: 38.2682, longitude: 140.8694, timezone: "Asia/Tokyo" },
  { id: "okinawa", city: "Okinawa", region: "Okinawa", country: "Japan", latitude: 26.2124, longitude: 127.6809, timezone: "Asia/Tokyo" },
  { id: "seoul", city: "Seoul", region: "Seoul", country: "South Korea", latitude: 37.5665, longitude: 126.978, timezone: "Asia/Seoul" },
  { id: "busan", city: "Busan", region: "Busan", country: "South Korea", latitude: 35.1796, longitude: 129.0756, timezone: "Asia/Seoul", aliases: ["Pusan"] },
  { id: "incheon", city: "Incheon", region: "Incheon", country: "South Korea", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" },
  { id: "daegu", city: "Daegu", region: "Daegu", country: "South Korea", latitude: 35.8714, longitude: 128.6014, timezone: "Asia/Seoul", aliases: ["Taegu"] },
  { id: "daejeon", city: "Daejeon", region: "Daejeon", country: "South Korea", latitude: 36.3504, longitude: 127.3845, timezone: "Asia/Seoul" },
  { id: "gwangju", city: "Gwangju", region: "Gwangju", country: "South Korea", latitude: 35.1595, longitude: 126.8526, timezone: "Asia/Seoul" },
  { id: "beijing", city: "Beijing", region: "Beijing", country: "China", latitude: 39.9042, longitude: 116.4074, timezone: "Asia/Shanghai", aliases: ["Peking"] },
  { id: "shanghai", city: "Shanghai", region: "Shanghai", country: "China", latitude: 31.2304, longitude: 121.4737, timezone: "Asia/Shanghai" },
  { id: "guangzhou", city: "Guangzhou", region: "Guangdong", country: "China", latitude: 23.1291, longitude: 113.2644, timezone: "Asia/Shanghai", aliases: ["Canton"] },
  { id: "shenzhen", city: "Shenzhen", region: "Guangdong", country: "China", latitude: 22.5431, longitude: 114.0579, timezone: "Asia/Shanghai" },
  { id: "chengdu", city: "Chengdu", region: "Sichuan", country: "China", latitude: 30.5728, longitude: 104.0668, timezone: "Asia/Shanghai" },
  { id: "hangzhou", city: "Hangzhou", region: "Zhejiang", country: "China", latitude: 30.2741, longitude: 120.1551, timezone: "Asia/Shanghai" },
  { id: "wuhan", city: "Wuhan", region: "Hubei", country: "China", latitude: 30.5928, longitude: 114.3055, timezone: "Asia/Shanghai" },
  { id: "xian", city: "Xi'an", region: "Shaanxi", country: "China", latitude: 34.3416, longitude: 108.9398, timezone: "Asia/Shanghai", aliases: ["Xian"] },
  { id: "nanjing", city: "Nanjing", region: "Jiangsu", country: "China", latitude: 32.0603, longitude: 118.7969, timezone: "Asia/Shanghai" },
  { id: "chongqing", city: "Chongqing", region: "Chongqing", country: "China", latitude: 29.4316, longitude: 106.9123, timezone: "Asia/Shanghai" },
  { id: "tianjin", city: "Tianjin", region: "Tianjin", country: "China", latitude: 39.3434, longitude: 117.3616, timezone: "Asia/Shanghai" },
  { id: "qingdao", city: "Qingdao", region: "Shandong", country: "China", latitude: 36.0671, longitude: 120.3826, timezone: "Asia/Shanghai" },
  { id: "dalian", city: "Dalian", region: "Liaoning", country: "China", latitude: 38.914, longitude: 121.6147, timezone: "Asia/Shanghai" },
  { id: "xiamen", city: "Xiamen", region: "Fujian", country: "China", latitude: 24.4798, longitude: 118.0894, timezone: "Asia/Shanghai" },
  { id: "suzhou", city: "Suzhou", region: "Jiangsu", country: "China", latitude: 31.2989, longitude: 120.5853, timezone: "Asia/Shanghai" },
  { id: "harbin", city: "Harbin", region: "Heilongjiang", country: "China", latitude: 45.8038, longitude: 126.5349, timezone: "Asia/Shanghai" },
  { id: "kunming", city: "Kunming", region: "Yunnan", country: "China", latitude: 25.0389, longitude: 102.7183, timezone: "Asia/Shanghai" },
  { id: "shenyang", city: "Shenyang", region: "Liaoning", country: "China", latitude: 41.8057, longitude: 123.4315, timezone: "Asia/Shanghai" },
  { id: "hong-kong", city: "Hong Kong", region: "Hong Kong", country: "Hong Kong", latitude: 22.3193, longitude: 114.1694, timezone: "Asia/Hong_Kong" },
  { id: "macau", city: "Macau", region: "Macau", country: "Macau", latitude: 22.1987, longitude: 113.5439, timezone: "Asia/Macau", aliases: ["Macao"] },
  { id: "taipei", city: "Taipei", region: "Taipei", country: "Taiwan", latitude: 25.033, longitude: 121.5654, timezone: "Asia/Taipei" },
  { id: "kaohsiung", city: "Kaohsiung", region: "Kaohsiung", country: "Taiwan", latitude: 22.6273, longitude: 120.3014, timezone: "Asia/Taipei" },
  { id: "taichung", city: "Taichung", region: "Taichung", country: "Taiwan", latitude: 24.1477, longitude: 120.6736, timezone: "Asia/Taipei" },
  { id: "tainan", city: "Tainan", region: "Tainan", country: "Taiwan", latitude: 22.9997, longitude: 120.227, timezone: "Asia/Taipei" },
  { id: "hualien", city: "Hualien", region: "Hualien", country: "Taiwan", latitude: 23.9871, longitude: 121.6016, timezone: "Asia/Taipei" },
  { id: "alishan", city: "Alishan", region: "Chiayi", country: "Taiwan", latitude: 23.5083, longitude: 120.8036, timezone: "Asia/Taipei" },
  { id: "ulaanbaatar", city: "Ulaanbaatar", region: "Ulaanbaatar", country: "Mongolia", latitude: 47.8864, longitude: 106.9057, timezone: "Asia/Ulaanbaatar" },
  { id: "pyongyang", city: "Pyongyang", region: "Pyongyang", country: "North Korea", latitude: 39.0392, longitude: 125.7625, timezone: "Asia/Pyongyang" },
];

const BY_ID = new Map(EAST_ASIA_CITIES.map((city) => [city.id, city]));

export function getCity(id: string): CityOption | undefined {
  return BY_ID.get(id.trim());
}

export function citiesByCountry(): Array<{ country: string; cities: CityOption[] }> {
  const groups: Array<{ country: string; cities: CityOption[] }> = [];
  for (const city of EAST_ASIA_CITIES) {
    const last = groups.at(-1);
    if (last?.country === city.country) last.cities.push(city);
    else groups.push({ country: city.country, cities: [city] });
  }
  return groups;
}

export function matchCityId(placeLabel: string): string {
  const hay = placeLabel.toLowerCase();
  const matches = EAST_ASIA_CITIES.filter((city) =>
    [city.city, ...(city.aliases ?? [])].some((name) => hay.includes(name.toLowerCase())),
  );
  matches.sort((a, b) => b.city.length - a.city.length);
  return matches[0]?.id ?? "";
}
