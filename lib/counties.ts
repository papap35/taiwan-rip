// 22 個縣市：網址代稱、名稱、地圖中心（概略）與縮放層級。

export interface County {
  slug: string;
  name: string;
  /** 英文名，用於分享圖 */
  en: string;
  lat: number;
  lng: number;
  zoom: number;
}

export const COUNTIES: County[] = [
  { slug: 'taipei', name: '臺北市', en: 'Taipei City', lat: 25.0375, lng: 121.5637, zoom: 11.5 },
  { slug: 'new-taipei', name: '新北市', en: 'New Taipei City', lat: 25.012, lng: 121.465, zoom: 10 },
  { slug: 'taoyuan', name: '桃園市', en: 'Taoyuan City', lat: 24.93, lng: 121.25, zoom: 10.5 },
  { slug: 'taichung', name: '臺中市', en: 'Taichung City', lat: 24.2, lng: 120.8, zoom: 10 },
  { slug: 'tainan', name: '臺南市', en: 'Tainan City', lat: 23.1, lng: 120.3, zoom: 10 },
  { slug: 'kaohsiung', name: '高雄市', en: 'Kaohsiung City', lat: 22.75, lng: 120.45, zoom: 10 },
  { slug: 'keelung', name: '基隆市', en: 'Keelung City', lat: 25.128, lng: 121.742, zoom: 12 },
  { slug: 'hsinchu-city', name: '新竹市', en: 'Hsinchu City', lat: 24.804, lng: 120.968, zoom: 12 },
  { slug: 'hsinchu-county', name: '新竹縣', en: 'Hsinchu County', lat: 24.7, lng: 121.1, zoom: 10.5 },
  { slug: 'miaoli', name: '苗栗縣', en: 'Miaoli County', lat: 24.5, lng: 120.9, zoom: 10.5 },
  { slug: 'changhua', name: '彰化縣', en: 'Changhua County', lat: 24.0, lng: 120.5, zoom: 10.5 },
  { slug: 'nantou', name: '南投縣', en: 'Nantou County', lat: 23.85, lng: 120.95, zoom: 9.8 },
  { slug: 'yunlin', name: '雲林縣', en: 'Yunlin County', lat: 23.7, lng: 120.4, zoom: 10.5 },
  { slug: 'chiayi-city', name: '嘉義市', en: 'Chiayi City', lat: 23.48, lng: 120.449, zoom: 12.5 },
  { slug: 'chiayi-county', name: '嘉義縣', en: 'Chiayi County', lat: 23.45, lng: 120.45, zoom: 10 },
  { slug: 'pingtung', name: '屏東縣', en: 'Pingtung County', lat: 22.5, lng: 120.6, zoom: 9.8 },
  { slug: 'yilan', name: '宜蘭縣', en: 'Yilan County', lat: 24.65, lng: 121.7, zoom: 10.3 },
  { slug: 'hualien', name: '花蓮縣', en: 'Hualien County', lat: 23.75, lng: 121.45, zoom: 9.3 },
  { slug: 'taitung', name: '臺東縣', en: 'Taitung County', lat: 22.95, lng: 121.1, zoom: 9.3 },
  { slug: 'penghu', name: '澎湖縣', en: 'Penghu County', lat: 23.57, lng: 119.6, zoom: 10.5 },
  { slug: 'kinmen', name: '金門縣', en: 'Kinmen County', lat: 24.44, lng: 118.35, zoom: 11.5 },
  { slug: 'lienchiang', name: '連江縣', en: 'Lienchiang County', lat: 26.16, lng: 119.95, zoom: 11 },
];

/** 「台北市」「臺北市政府警察局」等寫法都對應到標準縣市名稱；對不到回傳 null */
export function normalizeCounty(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/台/g, '臺');
  const hit = COUNTIES.find((c) => s.startsWith(c.name));
  return hit ? hit.name : null;
}

export const countyBySlug = (slug: string) => COUNTIES.find((c) => c.slug === slug);
export const countyByName = (name: string) => COUNTIES.find((c) => c.name === name);
