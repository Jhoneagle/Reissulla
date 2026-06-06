/**
 * Raw Open-Meteo Air Quality response shape plus the public adapter output
 * types consumed by the weather composition service. Only the fields we
 * actually request are typed; extra payload is ignored at runtime.
 */

export interface OpenMeteoAirQualityResponse {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    european_aqi: number;
    pm10: number;
    pm2_5: number;
    nitrogen_dioxide: number;
    sulphur_dioxide: number;
    ozone: number;
    carbon_monoxide: number;
  };
  hourly: {
    time: string[];
    alder_pollen: Array<number | null>;
    birch_pollen: Array<number | null>;
    grass_pollen: Array<number | null>;
    mugwort_pollen: Array<number | null>;
    olive_pollen: Array<number | null>;
    ragweed_pollen: Array<number | null>;
  };
}

export interface AirQualitySnapshot {
  europeanAqi: number;
  pm10: number;
  pm2_5: number;
  nitrogenDioxide: number;
  sulphurDioxide: number;
  ozone: number;
  carbonMonoxide: number;
  timestamp: string;
}

export interface PollenSnapshot {
  alder?: number;
  birch?: number;
  grass?: number;
  mugwort?: number;
  olive?: number;
  ragweed?: number;
  timestamp: string;
}
