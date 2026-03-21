import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle as LeafletCircle, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  RefreshCw, Loader2, MapPin, Battery, Navigation, Clock,
  Wifi, WifiOff, ChevronLeft, Users, Crosshair,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';
import { useNavigate } from 'react-router-dom';
import {
  type TechnicianLocation, type Geofence, type GpsProviderConfig,
  getLatestLocations, getActiveProvider, syncProviderLocations,
  updateSyncStatus, getGeofences,
} from '../lib/locationApi';

const DEFAULT_CENTER: L.LatLngTuple = [45.5017, -73.5673];
const DEFAULT_ZOOM = 11;
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

// ── Technician marker icon ──────────────────────────────────────
function createTechIcon(color: string, initials: string): L.DivIcon {
  const svg = `
    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="18" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="600" font-family="system-ui">${initials}</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'dispatch-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const TECH_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5', '#be123c'];

function getInitials(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

// ── Auto-fit bounds ──
function FitBounds({ locations }: { locations: TechnicianLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    map.invalidateSize({ animate: false });
    if (locations.length === 1) {
      map.flyTo([locations[0].latitude, locations[0].longitude], 14, { duration: 0.6 });
      return;
    }
    const bounds = L.latLngBounds(locations.map((l) => [l.latitude, l.longitude]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
  }, [locations, map]);
  return null;
}

// ── Zoom control ──
function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    const ctrl = L.control.zoom({ position: 'topright' });
    ctrl.addTo(map);
    return () => { ctrl.remove(); };
  }, [map]);
  return null;
}

export default function DispatchMap() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<TechnicianLocation[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [provider, setProvider] = useState<GpsProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedTech, setSelectedTech] = useState<TechnicianLocation | null>(null);
  const [showGeofences, setShowGeofences] = useState(true);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [locs, fences, prov] = await Promise.all([
        getLatestLocations(),
        getGeofences(),
        getActiveProvider(),
      ]);
      setLocations(locs);
      setGeofences(fences);
      setProvider(prov);
    } catch (e) {
      console.error('Failed to load dispatch data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    autoRefreshRef.current = setInterval(loadData, 30_000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [loadData]);

  const handleSync = async () => {
    if (!provider || syncing) return;
    setSyncing(true);
    try {
      await updateSyncStatus(provider.id, 'syncing');
      await syncProviderLocations(provider);
      await updateSyncStatus(provider.id, 'ok');
      await loadData();
    } catch (e: any) {
      await updateSyncStatus(provider.id, 'error', e.message);
    } finally {
      setSyncing(false);
    }
  };

  const icons = useMemo(() => {
    return locations.map((loc, i) => ({
      userId: loc.user_id,
      icon: createTechIcon(TECH_COLORS[i % TECH_COLORS.length], getInitials(loc.user_name)),
    }));
  }, [locations]);

  const formatAge = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings?tab=location')}
            className="p-1.5 rounded-lg hover:bg-surface-tertiary text-text-tertiary hover:text-text-primary transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-[17px] font-bold text-text-primary flex items-center gap-2">
              <MapPin size={18} />
              Dispatch Map
            </h1>
            <p className="text-[12px] text-text-tertiary">
              {locations.length} technician{locations.length !== 1 ? 's' : ''} on the map
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Provider status */}
          {provider ? (
            <div className="flex items-center gap-1.5 text-[11px] text-success font-medium bg-success/10 px-2.5 py-1 rounded-full">
              <Wifi size={11} />
              {provider.provider === 'traccar' ? 'Traccar' : 'Life360'}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary font-medium bg-surface-tertiary px-2.5 py-1 rounded-full">
              <WifiOff size={11} />
              No provider
            </div>
          )}

          {/* Geofence toggle */}
          <button
            onClick={() => setShowGeofences(!showGeofences)}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1',
              showGeofences ? 'bg-warning/15 text-warning' : 'bg-surface-tertiary text-text-tertiary'
            )}
          >
            <Crosshair size={11} />
            Geofences
          </button>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={!provider || syncing}
            className="btn-secondary text-[12px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="relative overflow-hidden rounded-2xl border border-outline bg-surface-tertiary h-[calc(100vh-220px)]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-text-tertiary" />
          </div>
        ) : (
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
            <FitBounds locations={locations} />
            <ZoomControl />

            {/* Geofence circles */}
            {showGeofences && geofences.map((fence) => (
              <LeafletCircle
                key={fence.id}
                center={[fence.latitude, fence.longitude]}
                radius={fence.radius_m}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.08,
                  weight: 1.5,
                  dashArray: '4 4',
                }}
              >
                <Popup>
                  <div className="text-[12px]">
                    <p className="font-semibold">{fence.name}</p>
                    <p className="text-gray-500">{fence.radius_m}m radius</p>
                  </div>
                </Popup>
              </LeafletCircle>
            ))}

            {/* Technician markers */}
            {locations.map((loc, i) => {
              const iconSet = icons[i];
              return (
                <Marker
                  key={loc.user_id}
                  position={[loc.latitude, loc.longitude]}
                  icon={iconSet.icon}
                  eventHandlers={{
                    click: () => setSelectedTech(selectedTech?.user_id === loc.user_id ? null : loc),
                  }}
                >
                  <Popup>
                    <div className="text-[12px] min-w-[160px]">
                      <p className="font-semibold text-[13px]">{loc.user_name || 'Unknown'}</p>
                      {loc.address && <p className="text-gray-500 mt-0.5">{loc.address}</p>}
                      <div className="mt-2 space-y-1 text-gray-600">
                        {loc.speed_kmh != null && (
                          <p className="flex items-center gap-1">
                            <Navigation size={10} /> {Math.round(loc.speed_kmh)} km/h
                          </p>
                        )}
                        {loc.battery_pct != null && (
                          <p className="flex items-center gap-1">
                            <Battery size={10} /> {loc.battery_pct}%
                          </p>
                        )}
                        <p className="flex items-center gap-1">
                          <Clock size={10} /> {formatAge(loc.recorded_at)}
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}

        {/* Technician sidebar list */}
        <div className="absolute top-3 left-3 z-[1000] bg-surface rounded-xl border border-outline shadow-lg max-h-[calc(100%-24px)] overflow-y-auto w-[200px]">
          <div className="px-3 py-2.5 border-b border-outline flex items-center gap-1.5">
            <Users size={13} className="text-text-tertiary" />
            <span className="text-[12px] font-semibold text-text-primary">Team</span>
            <span className="ml-auto text-[11px] text-text-tertiary">{locations.length}</span>
          </div>
          {locations.length === 0 ? (
            <p className="text-[11px] text-text-tertiary text-center py-4 px-3">
              No technicians tracked yet. Connect a GPS provider in Settings.
            </p>
          ) : (
            <div className="py-1">
              {locations.map((loc, i) => (
                <button
                  key={loc.user_id}
                  onClick={() => setSelectedTech(loc)}
                  className={cn(
                    'w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface-secondary transition-colors',
                    selectedTech?.user_id === loc.user_id && 'bg-surface-tertiary'
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: TECH_COLORS[i % TECH_COLORS.length] }}
                  >
                    {getInitials(loc.user_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-text-primary truncate">
                      {loc.user_name || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-text-tertiary">{formatAge(loc.recorded_at)}</p>
                  </div>
                  {loc.battery_pct != null && (
                    <span className={cn(
                      'text-[10px] font-medium',
                      loc.battery_pct > 20 ? 'text-success' : 'text-danger'
                    )}>
                      {loc.battery_pct}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        {showGeofences && geofences.length > 0 && (
          <div className="absolute bottom-3 right-3 z-[1000] bg-surface rounded-xl border border-outline shadow-md px-3 py-2">
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-warning bg-warning/10" />
                <span className="text-text-secondary">Geofence (100m)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
