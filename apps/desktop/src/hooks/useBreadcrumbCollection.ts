/**
 * useBreadcrumbCollection - Geolocation-based breadcrumb collection
 * 
 * Uses @tauri-apps/plugin-geolocation to get GPS coordinates
 * and calls drop_breadcrumb Rust command to store them.
 * 
 * PRIVACY: Raw coordinates are only passed to Rust backend
 * where they're converted to H3 cells. Never stored or exposed as lat/lng.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  getCurrentPosition,
  watchPosition,
  clearWatch,
  checkPermissions,
  requestPermissions,
} from '@tauri-apps/plugin-geolocation';

interface BreadcrumbCollectionState {
  isCollecting: boolean;
  lastH3Cell: string | null;  // Only expose H3 cell, not raw coords
  lastCollectedAt: Date | null;
  error: string | null;
  permissionStatus: 'unknown' | 'granted' | 'denied' | 'prompt';
}

interface DropBreadcrumbResult {
  success: boolean;
  count: number;
  h3_cell: string;
}

const MIN_DISTANCE_METERS = 50; // Minimum distance between breadcrumbs
const COLLECTION_INTERVAL_MS = 30000; // 30 seconds

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 * Used internally only - not exposed
 */
function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useBreadcrumbCollection(enabled: boolean = false) {
  const [state, setState] = useState<BreadcrumbCollectionState>({
    isCollecting: false,
    lastH3Cell: null,
    lastCollectedAt: null,
    error: null,
    permissionStatus: 'unknown',
  });

  const watchIdRef = useRef<number | null>(null);
  // Store last position internally only for distance calculation
  const lastPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Check and request permissions
  const ensurePermissions = useCallback(async (): Promise<boolean> => {
    try {
      let status = await checkPermissions();

      if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
        status = await requestPermissions(['location']);
      }

      const granted = status.location === 'granted';
      setState(s => ({
        ...s,
        permissionStatus: granted ? 'granted' : 'denied'
      }));

      return granted;
    } catch (error) {
      console.error('Permission check failed:', error);
      setState(s => ({ ...s, error: 'Failed to check permissions' }));
      return false;
    }
  }, []);

  // Drop a breadcrumb at current location
  const dropBreadcrumb = useCallback(async (
    latitude: number,
    longitude: number,
    accuracy?: number
  ) => {
    const now = Date.now();
    const last = lastPositionRef.current;

    // Check minimum distance
    if (last) {
      const distance = calculateDistance(last.lat, last.lng, latitude, longitude);
      if (distance < MIN_DISTANCE_METERS) {
        console.log(`Skipping: only ${distance.toFixed(0)}m from last (need ${MIN_DISTANCE_METERS}m)`);
        return;
      }
    }

    // Check minimum time
    if (last && (now - last.time) < COLLECTION_INTERVAL_MS) {
      console.log('Skipping: too soon since last collection');
      return;
    }

    try {
      // Pass to Rust - coordinates converted to H3 there, not stored as lat/lng
      const result = await invoke<DropBreadcrumbResult>('drop_breadcrumb', {
        latitude,
        longitude,
        accuracy,
      });

      if (result.success) {
        // Store internally for distance calculation only
        lastPositionRef.current = { lat: latitude, lng: longitude, time: now };

        // Only expose H3 cell, not raw coordinates
        setState(s => ({
          ...s,
          lastH3Cell: result.h3_cell,
          lastCollectedAt: new Date(),
          error: null,
        }));

        console.log(`✅ Breadcrumb #${result.count} at H3: ${result.h3_cell}`);
      }
    } catch (error) {
      console.error('Failed to drop breadcrumb:', error);
      setState(s => ({ ...s, error: String(error) }));
    }
  }, []);

  // Start watching position
  const startCollection = useCallback(async () => {
    const hasPermission = await ensurePermissions();
    if (!hasPermission) {
      setState(s => ({ ...s, error: 'Location permission denied' }));
      return;
    }

    try {
      // Get initial position
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      await dropBreadcrumb(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy
      );

      // Start watching
      const watchId = await watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
        (position, error) => {
          if (error) {
            console.error('Watch position error:', error);
            setState(s => ({ ...s, error: typeof error === 'object' && 'message' in error ? (error as any).message : String(error) }));
            return;
          }

          if (position) {
            dropBreadcrumb(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy
            );
          }
        }
      );

      watchIdRef.current = watchId;
      setState(s => ({ ...s, isCollecting: true, error: null }));
      console.log('🛰️ Breadcrumb collection started');

    } catch (error) {
      console.error('Failed to start collection:', error);
      setState(s => ({ ...s, error: String(error) }));
    }
  }, [ensurePermissions, dropBreadcrumb]);

  // Stop watching
  const stopCollection = useCallback(async () => {
    if (watchIdRef.current !== null) {
      await clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState(s => ({ ...s, isCollecting: false }));
    console.log('🛑 Breadcrumb collection stopped');
  }, []);

  // Manual drop (for "DROP NOW" button)
  const dropNow = useCallback(async () => {
    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      // Force drop regardless of distance/time
      lastPositionRef.current = null;

      await dropBreadcrumb(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy
      );
    } catch (error) {
      console.error('Drop now failed:', error);
      setState(s => ({ ...s, error: String(error) }));
    }
  }, [dropBreadcrumb]);

  // Effect to start/stop based on enabled prop
  useEffect(() => {
    if (enabled && !state.isCollecting) {
      startCollection();
    } else if (!enabled && state.isCollecting) {
      stopCollection();
    }

    return () => {
      if (watchIdRef.current !== null) {
        clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, state.isCollecting, startCollection, stopCollection]);

  return {
    ...state,
    startCollection,
    stopCollection,
    dropNow,
    ensurePermissions,
  };
}
