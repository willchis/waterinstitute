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
    
    // Load GeoJSON data with proper error handling
    fetch('./data/data.geojson')
        .then(response => {
            console.log('Fetch response status:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(geojsonData => {
            console.log('GeoJSON data loaded:', geojsonData);
            console.log('Number of features:', geojsonData.features ? geojsonData.features.length : 'No features property');
            
            // Add the GeoJSON data as a source
            map.addSource('geojson-data', {
                type: 'geojson',
                data: geojsonData
            });
            
            // Add a layer to display the GeoJSON points
            map.addLayer({
                id: 'geojson-layer',
                type: 'circle',
                source: 'geojson-data',
                layout: {},
                paint: {
                    'circle-color': '#088',
                    'circle-radius': 8,
                    'circle-stroke-color': '#000',
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.8
                }
            });
            
            console.log('Layers added successfully');
            
            // Fit map to data bounds if features exist
            if (geojsonData.features && geojsonData.features.length > 0) {
                const bounds = new mapboxgl.LngLatBounds();
                geojsonData.features.forEach(feature => {
                    if (feature.geometry.type === 'Point') {
                        bounds.extend(feature.geometry.coordinates);
                    } else if (feature.geometry.type === 'Polygon') {
                        feature.geometry.coordinates[0].forEach(coord => bounds.extend(coord));
                    } else if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates.forEach(polygon => {
                            polygon[0].forEach(coord => bounds.extend(coord));
                        });
                    }
                });
                
                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { padding: 50 });
                    console.log('Map fitted to data bounds:', bounds.toArray());
                } else {
                    console.log('Bounds are empty, keeping current view');
                }
            } else {
                console.log('No features found to fit bounds to');
            }
        })
        .catch(error => {
            console.error('Error loading GeoJSON data:', error);
            console.error('Make sure you\'re running this from a web server (not file://) and the data file exists');
        });
    
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
    
    // Add error handlers for debugging
    map.on('error', (e) => {
        console.error('Map error:', e);
    });
    
    map.on('sourcedata', (e) => {
        if (e.sourceId === 'geojson-data' && e.isSourceLoaded) {
            console.log('Source data loaded for geojson-data');
            const source = map.getSource('geojson-data');
            if (source && source._data) {
                console.log('Source data available:', source._data);
            }
        }
    });
    
    map.on('sourcedataloading', (e) => {
        if (e.sourceId === 'geojson-data') {
            console.log('Loading source data for geojson-data');
        }
    });
});
