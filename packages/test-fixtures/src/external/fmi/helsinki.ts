/**
 * Canonical FMI WFS warnings fixture for the Uusimaa region. The XML
 * mirrors the shape FMI's `fmi::warnings::regional` stored query
 * returns — `wfs:FeatureCollection` containing one `wfs:member`, a
 * `Warning` element carrying id/severity/type/timeRange/region and a
 * localized description (fi/en) plus an exterior gml polygon. Real FMI
 * responses are 10× larger; this trimmed shape is enough to exercise
 * the parser without bloating the fixture.
 */

const helsinkiUusimaaWarningsXml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0"
                       xmlns:gml="http://www.opengis.net/gml/3.2"
                       xmlns:fmi="http://xml.fmi.fi/schema/wfs/2.0">
  <wfs:member>
    <fmi:Warning gml:id="warning-uusimaa-wind-001">
      <fmi:severity>Severe</fmi:severity>
      <fmi:type>Wind</fmi:type>
      <fmi:region>FI:Uusimaa</fmi:region>
      <fmi:timeRange>
        <fmi:startTime>2026-06-06T09:00:00Z</fmi:startTime>
        <fmi:endTime>2026-06-06T18:00:00Z</fmi:endTime>
      </fmi:timeRange>
      <fmi:description lang="fi">Voimakas tuuli, puuskat jopa 25 m/s rannikolla.</fmi:description>
      <fmi:description lang="en">Strong wind, gusts up to 25 m/s along the coast.</fmi:description>
      <fmi:bounds>
        <gml:Polygon srsName="EPSG:4326">
          <gml:exterior>
            <gml:LinearRing>
              <gml:posList>60.10 24.80 60.10 25.20 60.40 25.20 60.40 24.80 60.10 24.80</gml:posList>
            </gml:LinearRing>
          </gml:exterior>
        </gml:Polygon>
      </fmi:bounds>
    </fmi:Warning>
  </wfs:member>
</wfs:FeatureCollection>`;

const emptyWarningsXml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0"
                       xmlns:gml="http://www.opengis.net/gml/3.2"
                       xmlns:fmi="http://xml.fmi.fi/schema/wfs/2.0">
</wfs:FeatureCollection>`;

import type { FmiFixture } from "./index.js";

export const warningsByRegion: Record<string, FmiFixture<string>> = {
  "FI:Uusimaa": helsinkiUusimaaWarningsXml,
  "": helsinkiUusimaaWarningsXml,
  "FI:Empty": emptyWarningsXml,
  "FI:Error": { httpError: 503 },
  "FI:NetworkError": { httpError: 0 },
};

export interface RadarFrameFixture {
  timestamp: number;
  tileUrlTemplate: string;
}

function buildRadarTimeline(): RadarFrameFixture[] {
  // Fixed reference timestamp so the fixture is deterministic across runs.
  // Picks 2026-06-06T12:00:00Z as the latest frame, 12 frames @ 5min.
  const latest = Math.floor(Date.UTC(2026, 5, 6, 12, 0, 0) / 1000);
  const intervalSeconds = 5 * 60;
  const frames: RadarFrameFixture[] = [];
  for (let i = 11; i >= 0; i--) {
    const timestamp = latest - i * intervalSeconds;
    const iso = new Date(timestamp * 1000).toISOString();
    const encodedTime = encodeURIComponent(iso);
    frames.push({
      timestamp,
      tileUrlTemplate: `https://openwms.fmi.fi/geoserver/wms/{z}/{x}/{y}.png?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Radar%3Asuomi_rr_eureffin&FORMAT=image%2Fpng&TRANSPARENT=true&TIME=${encodedTime}&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}`,
    });
  }
  return frames;
}

export const radarTimelineByKey: Record<
  string,
  FmiFixture<RadarFrameFixture[]>
> = {
  latest: buildRadarTimeline(),
};
