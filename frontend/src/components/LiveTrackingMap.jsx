import React, { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation, X } from 'lucide-react';
import debounce from 'lodash/debounce';

const socket = io('https://locationapp-4y3o.onrender.com'); // Change to your server URL

// Custom component to handle map centering and zooming
const MapCenterController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
};

const LiveTrackingMap = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(15);

  // Debounced search function to limit API calls
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.length > 0) {
          setSearchResults(data);
          setIsSearching(true);
        } else {
          setSearchResults([]);
          setIsSearching(false);
        }
      } catch (error) {
        console.error('Error searching location:', error);
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 300),
    []
  );

  // Update search results as user types
  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    // Cleanup function to cancel any pending debounced calls
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const location = { latitude, longitude };
          setUserLocation(location);
          setMapCenter([latitude, longitude]);
          socket.emit('updateLocation', { userId: 'USER123', latitude, longitude });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to a default location if geolocation fails
          setMapCenter([22.5726, 88.3639]);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      // Fallback to a default location if geolocation is not supported
      setMapCenter([22.5726, 88.3639]);
    }
  }, []);

  useEffect(() => {
    socket.on('userLocationUpdate', (data) => {
      setUserLocation({ latitude: data.latitude, longitude: data.longitude });
    });
    return () => socket.off('userLocationUpdate');
  }, []);

  const fetchRoute = async (start, end) => {
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data.routes.length > 0) {
        setRoute(data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]));
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  useEffect(() => {
    if (userLocation && destination) {
      fetchRoute([userLocation.latitude, userLocation.longitude], [destination.latitude, destination.longitude]);
    }
  }, [userLocation, destination]);

  const selectDestination = (result) => {
    const destinationLocation = { 
      latitude: parseFloat(result.lat), 
      longitude: parseFloat(result.lon) 
    };
    
    setDestination(destinationLocation);
    setIsSearching(false);
    setSearchQuery(result.display_name);
    
    // Zoom to the searched location
    setMapCenter([destinationLocation.latitude, destinationLocation.longitude]);
    setMapZoom(15);
  };

  const clearDestination = () => {
    setDestination(null);
    setRoute([]);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    
    // Zoom back to user's location if available
    if (userLocation) {
      setMapCenter([userLocation.latitude, userLocation.longitude]);
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-100 flex flex-col">
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center space-x-2">
        <div className="relative flex-grow">
          <div className="flex items-center bg-white shadow-md rounded-lg overflow-hidden">
            <input 
              type="text" 
              placeholder="Search destination..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full p-3 pl-10 text-gray-700 focus:outline-none"
            />
            <Search className="absolute left-3 text-gray-500" size={20} />
            {(destination || searchQuery) && (
              <button 
                onClick={clearDestination} 
                className="p-2 hover:bg-gray-100"
              >
                <X className="text-gray-500" size={20} />
              </button>
            )}
          </div>
          {isSearching && searchResults.length > 0 && (
            <ul className="absolute top-full left-0 right-0 bg-white shadow-lg max-h-[300px] overflow-y-auto rounded-b-lg divide-y divide-gray-200">
              {searchResults.map((result, index) => (
                <li 
                  key={index} 
                  onClick={() => selectDestination(result)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center"
                >
                  <MapPin className="mr-3 text-blue-500" size={20} />
                  <span className="text-gray-700 text-sm">{result.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {mapCenter && (
        <MapContainer 
          center={mapCenter} 
          zoom={mapZoom} 
          className="flex-grow z-10"
          style={{ height: 'calc(100% - 80px)' }}
        >
          <MapCenterController center={mapCenter} zoom={mapZoom} />
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            className="filter brightness-90"
          />
          {userLocation && (
            <Marker position={[userLocation.latitude, userLocation.longitude]}>
              <Popup>
                <div className="flex items-center">
                  <Navigation className="mr-2 text-green-500" size={16} />
                  Your Current Location
                </div>
              </Popup>
            </Marker>
          )}
          {destination && (
            <Marker position={[destination.latitude, destination.longitude]}>
              <Popup>
                <div className="flex items-center">
                  <MapPin className="mr-2 text-blue-500" size={16} />
                  Destination
                </div>
              </Popup>
            </Marker>
          )}
          {route.length > 0 && <Polyline positions={route} color="#3B82F6" weight={5} />}
        </MapContainer>
      )}
    </div>
  );
};

export default LiveTrackingMap;