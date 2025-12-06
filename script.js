const MAPBOX_ACCESS_TOKEN_PLACEHOLDER = 'pk.eyJ1Ijoid2lsbGNoaXMiLCJhIjoiY21pdWY2dDIzMXdybjNrb3Z4ZnpldW94YSJ9.DsafjLG-L13IoDJb6N5SaQ'
// Set your Mapbox access token
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN_PLACEHOLDER;

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-89.6, 29.5], // New Orleans coast area
    zoom: 6.5
});

// Add GeoJSON data when map loads
map.on('load', () => {
    console.log('Map has successfully loaded and is ready for custom GeoJSON data');
    
    // Add the GeoJSON data as a source
    map.addSource('geojson-data', {
        type: 'geojson',
        data: './data/data.geojson'
    });
    
    // Add a layer to display the GeoJSON data
    map.addLayer({
        id: 'geojson-layer',
        type: 'fill',
        source: 'geojson-data',
        layout: {},
        paint: {
            'fill-color': '#088',
            'fill-opacity': 0.8
        }
    });
    
    // Add a stroke/outline layer
    map.addLayer({
        id: 'geojson-outline',
        type: 'line',
        source: 'geojson-data',
        layout: {},
        paint: {
            'line-color': '#000',
            'line-width': 2
        }
    });
    
    console.log('GeoJSON data loaded successfully');
    
    // Add hover effect
    map.on('mouseenter', 'geojson-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'geojson-layer', () => {
        map.getCanvas().style.cursor = '';
    });
    
    // Add click event for popups
    map.on('click', 'geojson-layer', (e) => {
        if (!e.features || e.features.length === 0) {
            return;
        }
        
        const features = e.features[0];
        const properties = features.properties;
        
        // Create popup content from properties
        let popupContent = '<div style="max-width: 300px;">';
        for (const [key, value] of Object.entries(properties)) {
            if (value !== null && value !== undefined && value !== '') {
                popupContent += `<strong>${key}:</strong> ${value}<br>`;
            }
        }
        popupContent += '</div>';
        
        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map);
    });
});
