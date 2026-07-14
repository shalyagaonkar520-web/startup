import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X, Loader2, Search, Crosshair } from 'lucide-react';
import { useLocationStore } from '../store/locationStore';
import { haversineDistance, reverseGeocode } from '../lib/location';

import toast from 'react-hot-toast';

export default function LocationPicker() {
  const { isLocationPickerOpen, closeLocationPicker, setDeliveryLocation, deliveryLocation, restaurantLocation, maxDeliveryRange } = useLocationStore();
  
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);

  useEffect(() => {
    if (!isLocationPickerOpen) {
      setSearchQuery('');
      setSearchResults([]);
    } else if (!deliveryLocation && !isGeolocating) {
      // Automatically request location access on startup
      handleGeolocate();
    }
  }, [isLocationPickerOpen, deliveryLocation]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
    setIsSearching(false);
  };

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    // Calculate distance
    const dist = haversineDistance(restaurantLocation.lat, restaurantLocation.lng, lat, lon);
    
    setDeliveryLocation({ lat, lng: lon, address: result.display_name, distance: parseFloat(dist.toFixed(1)), isDeliverable: dist <= maxDeliveryRange });
    toast.success('Location updated!');
    closeLocationPicker();
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          const dist = haversineDistance(restaurantLocation.lat, restaurantLocation.lng, latitude, longitude);
          setDeliveryLocation({ lat: latitude, lng: longitude, address, distance: parseFloat(dist.toFixed(1)), isDeliverable: dist <= maxDeliveryRange });
          toast.success('Location detected!');
          closeLocationPicker();
        } catch (error) {
          toast.error('Failed to get address. Try manual search.');
        } finally {
          setIsGeolocating(false);
        }
      },
      (err) => {
        setIsGeolocating(false);
        if (err.code === 1) toast.error('Please allow location access.');
        else toast.error('Failed to detect location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (!isLocationPickerOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          onClick={deliveryLocation ? closeLocationPicker : undefined} 
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-orange-500" />
                Delivery Location
              </h2>
              {deliveryLocation && (
                <button onClick={closeLocationPicker} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <button
              onClick={handleGeolocate}
              disabled={isGeolocating}
              className="w-full flex items-center justify-center gap-2 bg-orange-50 text-orange-600 font-bold py-4 rounded-xl border border-orange-200 hover:bg-orange-100 transition-colors mb-6 disabled:opacity-50"
            >
              {isGeolocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crosshair className="w-5 h-5" />}
              {isGeolocating ? 'Detecting Location...' : 'Auto-Detect My Location'}
            </button>

            <div className="relative flex items-center mb-6">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">OR ENTER MANUALLY</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search your area, street, building..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:border-orange-500 pl-11 transition-colors"
                />
                <div className="absolute left-4 top-4 text-gray-400">
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-60 overflow-y-auto">
                  {searchResults.map((res: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => selectSearchResult(res)}
                      className="px-4 py-3 border-b border-gray-50 hover:bg-orange-50 cursor-pointer flex flex-col"
                    >
                      <span className="font-bold text-sm text-gray-900 truncate">{res.display_name.split(',')[0]}</span>
                      <span className="text-xs text-gray-500 truncate mt-0.5">{res.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {searchQuery.length >= 3 && searchResults.length === 0 && !isSearching && (
                 <div className="mt-2 p-4 text-center text-gray-500 text-sm font-medium">
                    No matching locations found.
                 </div>
              )}
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
