import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { MeetupPoint } from './meetup-location';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './meetup-map.css';

type Props = { point: MeetupPoint | null; onSelect?: (point: MeetupPoint) => void };

export default function MeetupMap({ point, onSelect }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!element.current) return;
    const initial: L.LatLngExpression = point ? [point.lat, point.lng] : [10.12, 122.87];
    const instance = L.map(element.current, {
      zoomControl: false, scrollWheelZoom: false, minZoom: 2, maxZoom: 19,
    }).setView(initial, point ? 16 : 8);
    map.current = instance;
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    // Vector map uses MapLibre on the Leaflet map; older devices fall back to
    // raster tiles when WebGL is unavailable. Both require no vendor API key.
    let webgl = false;
    try {
      const canvas = document.createElement('canvas');
      webgl = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch { /* No WebGL context in this browser. */ }
    if (webgl) {
      try {
        setWorkerUrl(workerUrl);
        maplibreGL({ style: 'https://tiles.openfreemap.org/styles/liberty' }).addTo(instance);
        instance.attributionControl.addAttribution(
          '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
        );
      } catch { webgl = false; }
    }
    if (!webgl) {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(instance);
    }
    if (point) {
      pin.current = L.circleMarker([point.lat, point.lng], {
        radius: 9, color: 'var(--color-card)', weight: 3, fillColor: 'var(--color-primary)', fillOpacity: 1,
      }).addTo(instance);
    }
    if (selectRef.current) {
      instance.on('click', event => {
        const next = { lat: event.latlng.lat, lng: event.latlng.lng };
        selectRef.current?.(next);
      });
    }
    const frame = window.requestAnimationFrame(() => instance.invalidateSize());
    return () => {
      window.cancelAnimationFrame(frame);
      instance.remove();
      map.current = null;
      pin.current = null;
    };
    // Initialize once per open map; selections update the marker without resetting zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (!point) { pin.current?.remove(); pin.current = null; return; }
    if (pin.current) pin.current.setLatLng([point.lat, point.lng]);
    else pin.current = L.circleMarker([point.lat, point.lng], {
      radius: 9, color: 'var(--color-card)', weight: 3, fillColor: 'var(--color-primary)', fillOpacity: 1,
    }).addTo(map.current);
  }, [point?.lat, point?.lng]);

  return <div className="meetup-map-wrap">
    <div ref={element} className="meetup-map" role="application" tabIndex={0}
      aria-label={onSelect ? 'Interactive map. Click or tap to place a meetup pin. Use the button below for keyboard access.' : 'Map showing the saved meetup pin.'} />
    {onSelect && <button type="button" className="btn ghost" onClick={() => {
      const center = map.current?.getCenter();
      if (center) selectRef.current?.({ lat: center.lat, lng: center.lng });
    }}>Pin map center</button>}
  </div>;
}
