const MAPBOX_ACCESS_TOKEN_PLACEHOLDER = ''
// Set your Mapbox access token
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN_PLACEHOLDER;

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-89.6, 29.5], // New Orleans coast area
    zoom: 6.5
});

// Add console log when map loads
map.on('load', () => {
    console.log('Map has successfully loaded and is ready for custom GeoJSON data');
});
