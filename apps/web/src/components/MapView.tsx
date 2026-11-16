'use client';

import React, { useEffect, useRef } from 'react';
import type { Port, Vessel, Voyage } from '@/lib/api';

interface MapViewProps {
  vessels: Vessel[];
  ports?: Port[];
  voyages?: Voyage[];
  heightClass?: string;
}

export function MapView({ vessels, ports = [], voyages = [], heightClass = 'h-[420px]' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current) return;
      const L = (await import('leaflet')).default;

      if (cancelled) return;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          center: [10.48, 106.45],
          zoom: 9,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        // OpenSeaMap seamark overlay for river/coastal navigation buoys
        L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenSeaMap',
        }).addTo(map);

        mapRef.current = map;
      }

      const map = mapRef.current;

      // Clear existing feature layers
      map.eachLayer((layer: any) => {
        if (layer.options?.pane === 'markerPane' || layer.options?.pane === 'overlayPane') {
          if (!layer._url) map.removeLayer(layer);
        }
      });

      // Draw ports
      ports.forEach((p) => {
        if (!p.lat || !p.lng) return;
        const portIcon = L.divIcon({
          className: 'custom-port-icon',
          html: `<div style="background:#0f172a;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;border:1px solid #38bdf8;box-shadow:0 2px 4px rgba(0,0,0,.3)">⚓ ${p.code}</div>`,
          iconSize: [70, 22],
          iconAnchor: [35, 11],
        });
        L.marker([p.lat, p.lng], { icon: portIcon })
          .bindPopup(`<strong>${p.name}</strong><br/>Khu vực: ${p.region}<br/>Loại: ${p.port_type}`)
          .addTo(map);
      });

      // Draw voyage planned lines
      voyages.forEach((vy) => {
        if (vy.origin_lat && vy.origin_lng && vy.dest_lat && vy.dest_lng && vy.status === 'IN_TRANSIT') {
          L.polyline(
            [
              [vy.origin_lat, vy.origin_lng],
              [vy.dest_lat, vy.dest_lng],
            ],
            { color: '#0284c7', weight: 2.5, dashArray: '6, 6', opacity: 0.7 },
          ).addTo(map);
        }
      });

      // Draw vessels
      vessels.forEach((v) => {
        if (!v.lat || !v.lng) return;
        const color =
          v.status === 'IN_VOYAGE'
            ? '#0284c7'
            : v.status === 'AVAILABLE'
            ? '#059669'
            : '#d97706';

        const icon = L.divIcon({
          className: 'custom-vessel-icon',
          html: `<div style="display:flex;align-items:center;gap:4px;background:${color};color:#fff;padding:3px 8px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35)">🚢 ${v.code}</div>`,
          iconSize: [96, 26],
          iconAnchor: [48, 13],
        });

        L.marker([v.lat, v.lng], { icon })
          .bindPopup(
            `<div style="min-width:180px">
              <div style="font-weight:700;font-size:13px;color:#0f172a">${v.name} (${v.code})</div>
              <div style="font-size:12px;margin-top:4px">
                <div>Thuyền trưởng: <b>${v.captain_name || 'N/A'}</b></div>
                <div>Tốc độ: <b>${Number(v.current_speed_knots || 0)} hải lý/h</b></div>
                <div>Dầu tồn (ROB): <b>${Number(v.current_fuel_liters || 0).toLocaleString('vi-VN')} lít</b></div>
                ${v.nearby_port ? `<div style="color:#0284c7">Vùng cảng: ${v.nearby_port}</div>` : ''}
              </div>
            </div>`,
          )
          .addTo(map);
      });
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, [vessels, ports, voyages]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={containerRef} className={`w-full ${heightClass}`} />
    </div>
  );
}
