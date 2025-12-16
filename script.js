const MAPBOX_ACCESS_TOKEN_PLACEHOLDER = 'pk.eyJ1Ijoid2lsbGNoaXMiLCJhIjoiY21pdWY2dDIzMXdybjNrb3Z4ZnpldW94YSJ9.DsafjLG-L13IoDJb6N5SaQ'
const CLUSTER_MAX_ZOOM = 12;
const CLUSTER_RADIUS = 50;
// Color Constants
const COLORS = {
    LIGHT_BLUE: '#4fc3f7',
    YELLOW: '#ffeb3b', 
    ORANGE_RED: '#ff5722',
    WHITE: '#ffffff',
    BLACK: '#000000',
    TEAL: '#00acc1',
    LIGHT_GRAY: '#ddd',
    VERY_LIGHT_GRAY: '#f0f0f0',
    DARK_GRAY: '#333',
    DARKER_GRAY: '#2d2d2d',
    SELECTION_BLUE: 'rgba(79, 195, 247, 0.2)',
    SEMI_WHITE: 'rgba(255, 255, 255, 0.9)',
    SEMI_BLACK: 'rgba(0,0,0,0.1)'
};

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN_PLACEHOLDER;

function loadThumbnail(thumbnailId) {
    const img = document.getElementById(thumbnailId);
    if (img && img.dataset.src) {
        const actualSrc = img.dataset.src;
        if (actualSrc) {
            const tempImg = new Image();
            tempImg.onload = function() {
                img.src = actualSrc;
                img.style.background = 'none';
            };
            tempImg.onerror = function() {
                img.alt = 'Image not available';
                img.style.background = COLORS.LIGHT_GRAY;
            };
            tempImg.src = actualSrc;
        }
    }
}

function showImageModal(imageSrc) {
    if (!imageSrc || imageSrc.includes('data:image/svg')) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'image-modal-overlay';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = 'Enlarged view';
    
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', () => {
        overlay.remove();
    });
    
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [-89.6, 29.5],
    zoom: 6.5,
    pitch: 60,
    bearing: -17.6,
    antialias: true
});

map.addControl(new mapboxgl.NavigationControl({
    visualizePitch: true
}));


async function loadAndFilterGeoData() {
    const response = await fetch('./data/data.geojson');
    console.log('Fetch response status:', response.status, response.statusText);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const geojsonData = await response.json();
    console.log('GeoJSON data loaded:', geojsonData);
    console.log('Number of features:', geojsonData.features ? geojsonData.features.length : 'No features property');
    
    const filteredData = {
        ...geojsonData,
        features: geojsonData.features.filter(feature => {
            const colonies = feature.properties.species_colonies;
            if (Array.isArray(colonies)) {
                return colonies.length > 0;
            } else if (typeof colonies === 'string') {
                try {
                    const parsed = JSON.parse(colonies);
                    return Array.isArray(parsed) && parsed.length > 0;
                } catch (e) {
                    return false;
                }
            }
            return false;
        })
    };
    
    console.log('Filtered features with species_colonies:', filteredData.features.length);
    return filteredData;
}

function createMapLayers(data) {
    map.addSource('geojson-data', {
        type: 'geojson',
        data: data,
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS
    });
    
    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'geojson-data',
        filter: ['has', 'point_count'],
        paint: {
            'circle-color': [
                'step',
                ['get', 'point_count'],
                COLORS.LIGHT_BLUE,
                100,
                COLORS.YELLOW,
                750,
                COLORS.ORANGE_RED
            ],
            'circle-radius': [
                'step',
                ['get', 'point_count'],
                20,
                100,
                30,
                750,
                40
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': COLORS.WHITE
        }
    });

    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'geojson-data',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
        },
        paint: {
            'text-color': COLORS.BLACK,
            'text-halo-color': COLORS.WHITE,
            'text-halo-width': 1
        }
    });

    map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'geojson-data',
        filter: ['!', ['has', 'point_count']],
        paint: {
            'circle-color': COLORS.TEAL,
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': COLORS.WHITE
        }
    });
    
    console.log('Layers added successfully');
}

function fitMapToBounds(data) {
    if (!data.features || data.features.length === 0) {
        console.log('No features found to fit bounds to');
        return;
    }
    
    const bounds = new mapboxgl.LngLatBounds();
    data.features.forEach(feature => {
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
        map.fitBounds(bounds, { 
            padding: 50,
            pitch: 60,
            bearing: -17.6
        });
        console.log('Map fitted to data bounds:', bounds.toArray());
    } else {
        console.log('Bounds are empty, keeping current view');
    }
}

function generateCSV(speciesData, type = 'individual', locationInfo = {}) {
    const headers = ['Species Name', 'Species Code', 'Count', 'Longitude', 'Latitude', 'Date'];
    const rows = [];
    
    if (type === 'individual') {
        speciesData.forEach(species => {
            rows.push([
                species.SpeciesName || 'Unknown',
                species.SpeciesCode || 'N/A',
                '1',
                locationInfo.longitude || 'N/A',
                locationInfo.latitude || 'N/A',
                locationInfo.date || 'N/A'
            ]);
        });
    } else if (type === 'summary') {
        if (Array.isArray(speciesData)) {
            // Group species by name, code, and location
            const groupedData = {};
            
            speciesData.forEach(species => {
                const name = species.SpeciesName || 'Unknown';
                const code = species.SpeciesCode || 'N/A';
                const lng = species._longitude?.toFixed(6) || 'N/A';
                const lat = species._latitude?.toFixed(6) || 'N/A';
                const date = species._observationDate || 'N/A';
                
                // Create a unique key for species + location combination
                const key = `${name}|${code}|${lng}|${lat}`;
                
                if (!groupedData[key]) {
                    groupedData[key] = {
                        name: name,
                        code: code,
                        longitude: lng,
                        latitude: lat,
                        count: 0,
                        dates: new Set()
                    };
                }
                
                groupedData[key].count++;
                if (date !== 'N/A') {
                    groupedData[key].dates.add(date);
                }
            });
            
            // Convert grouped data to CSV rows
            Object.values(groupedData).forEach(group => {
                const datesArray = Array.from(group.dates);
                let dateRange;
                
                if (datesArray.length === 0) {
                    dateRange = 'N/A';
                } else if (datesArray.length === 1) {
                    dateRange = datesArray[0];
                } else {
                    const sortedDates = datesArray.sort();
                    dateRange = `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`;
                }
                
                rows.push([
                    group.name,
                    group.code,
                    group.count.toString(),
                    group.longitude,
                    group.latitude,
                    dateRange
                ]);
            });
        } else {
            // Fallback for aggregated data (should not be used anymore)
            Object.values(speciesData).forEach(species => {
                rows.push([
                    species.name || 'Unknown',
                    species.code || 'N/A',
                    species.count.toString(),
                    'Selected Area',
                    '',
                    species.dateRange || 'Multiple dates'
                ]);
            });
        }
    }
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    return csvContent;
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function downloadLocationCSV(speciesData, longitude, latitude, date) {
    const csvContent = generateCSV(speciesData, 'individual', { longitude, latitude, date });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    downloadCSV(csvContent, `species-location-${timestamp}.csv`);
}

function downloadSummaryCSV(speciesData, bounds) {
    const csvContent = generateCSV(speciesData, 'summary', { bounds });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    downloadCSV(csvContent, `species-summary-${timestamp}.csv`);
}

function createSpeciesPopupContent(properties) {
    const speciesColonies = Array.isArray(properties.species_colonies) 
        ? properties.species_colonies 
        : (properties.species_colonies ? JSON.parse(properties.species_colonies) : []);
    
    let popupContent = `
        <div class="species-popup">
            <div class="popup-header">
                <div class="header-top">
                    <h3>Species Found</h3>
                    <button class="csv-download-btn" onclick="downloadLocationCSV(${JSON.stringify(speciesColonies).replace(/"/g, '&quot;')}, ${properties.longitude}, ${properties.latitude}, '${properties.Date || 'N/A'}')" title="Download CSV">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            <path d="M12,11L16,15H13V19H11V15H8L12,11Z"/>
                        </svg>
                        CSV
                    </button>
                </div>
                <div class="location-info">
                    <small>Location: ${properties.longitude?.toFixed(4)}, ${properties.latitude?.toFixed(4)}</small>
                </div>
            </div>
            <div class="species-list">
    `;
    
    speciesColonies.forEach((species, index) => {
        const thumbnailId = `thumbnail-${Date.now()}-${index}`;
        const thumbnailSrc = species.bird_info?.bird_thumbnail || '';
        popupContent += `
            <div class="species-item">
                <div class="species-info">
                    <div class="species-name">${species.SpeciesName || 'Unknown'}</div>
                    <div class="species-code">Code: ${species.SpeciesCode || 'N/A'}</div>
                </div>
                <div class="species-thumbnail">
                    <img id="${thumbnailId}" 
                         src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA2MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Im0zMCAyMCA2IDZoLTEybDYtNnoiIGZpbGw9IiNjY2MiLz4KPC9zdmc+" 
                         alt="Loading..." 
                         width="60" 
                         height="40"
                            style="background: ${COLORS.VERY_LIGHT_GRAY}; border-radius: 4px;"
                         data-src="${thumbnailSrc}"
                         onclick="showImageModal('${thumbnailSrc}')"
                         onload="loadThumbnail('${thumbnailId}')" />
                </div>
            </div>
        `;
    });
    
    popupContent += `
            </div>
            ${properties.Date ? `<div class="date-info"><small>Date: ${properties.Date}</small></div>` : ''}
        </div>
    `;
    
    return popupContent;
}

function setupEventHandlers() {
    map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
    });
    
    map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
    });
    
    map.on('click', 'clusters', (e) => {
        const features = e.features[0];
        const clusterId = features.properties.cluster_id;
        const source = map.getSource('geojson-data');
        
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            
            map.easeTo({
                center: features.geometry.coordinates,
                zoom: zoom
            });
        });
    });
    
    map.on('click', 'unclustered-point', (e) => {
        if (!e.features || e.features.length === 0) {
            return;
        }
        
        const features = e.features[0];
        const properties = features.properties;
        
        console.log('species_colonies type:', typeof properties.species_colonies);
        console.log('species_colonies value:', properties.species_colonies);
        
        const popupContent = createSpeciesPopupContent(properties);
        
        new mapboxgl.Popup({ className: 'species-popup-container' })
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map);
    });
    
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
}

function setupRectangleSelection() {
    let isDrawing = false;
    let startPoint = null;
    let startLngLat = null;
    let shiftPressed = false;

    const canvas = map.getCanvasContainer();
    const selectionBox = document.createElement('div');
    selectionBox.classList.add('selection-box');
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = `2px dashed ${COLORS.LIGHT_BLUE}`;
    selectionBox.style.backgroundColor = COLORS.SELECTION_BLUE;
    selectionBox.style.display = 'none';
    selectionBox.style.pointerEvents = 'none';
    canvas.appendChild(selectionBox);

    const selectionIndicator = document.createElement('div');
    selectionIndicator.innerHTML = 'Hold Shift + Drag to select area';
    selectionIndicator.style.position = 'absolute';
    selectionIndicator.style.top = '10px';
    selectionIndicator.style.left = '10px';
    selectionIndicator.style.background = COLORS.SEMI_WHITE;
    selectionIndicator.style.color = COLORS.DARK_GRAY;
    selectionIndicator.style.padding = '8px 12px';
    selectionIndicator.style.borderRadius = '6px';
    selectionIndicator.style.fontSize = '12px';
    selectionIndicator.style.zIndex = '1000';
    selectionIndicator.style.border = `1px solid ${COLORS.SEMI_BLACK}`;
    canvas.appendChild(selectionIndicator);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            shiftPressed = true;
            map.getCanvas().style.cursor = 'crosshair';
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            shiftPressed = false;
            map.getCanvas().style.cursor = '';
            if (isDrawing) {
                isDrawing = false;
                selectionBox.style.display = 'none';
                map.dragPan.enable();
                map.scrollZoom.enable();
                map.doubleClickZoom.enable();
            }
        }
    });

    map.on('mousedown', (e) => {
        if (!shiftPressed) return;
        
        e.preventDefault();
        isDrawing = true;
        startPoint = e.point;
        startLngLat = e.lngLat;
        
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.doubleClickZoom.disable();
        
        selectionBox.style.left = startPoint.x + 'px';
        selectionBox.style.top = startPoint.y + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
    });

    map.on('mousemove', (e) => {
        if (!isDrawing) return;
        
        const currentPoint = e.point;
        
        const left = Math.min(startPoint.x, currentPoint.x);
        const top = Math.min(startPoint.y, currentPoint.y);
        const width = Math.abs(currentPoint.x - startPoint.x);
        const height = Math.abs(currentPoint.y - startPoint.y);
        
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    });

    map.on('mouseup', (e) => {
        if (!isDrawing) return;
        
        isDrawing = false;
        const endPoint = e.point;
        const endLngLat = e.lngLat;
        
        selectionBox.style.display = 'none';
        
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.doubleClickZoom.enable();
        
        const minSize = 5;
        if (Math.abs(endPoint.x - startPoint.x) < minSize || Math.abs(endPoint.y - startPoint.y) < minSize) {
            return;
        }
        
        const bounds = [
            [Math.min(startLngLat.lng, endLngLat.lng), Math.min(startLngLat.lat, endLngLat.lat)],
            [Math.max(startLngLat.lng, endLngLat.lng), Math.max(startLngLat.lat, endLngLat.lat)]
        ];
        
        const features = map.queryRenderedFeatures([
            [Math.min(startPoint.x, endPoint.x), Math.min(startPoint.y, endPoint.y)],
            [Math.max(startPoint.x, endPoint.x), Math.max(startPoint.y, endPoint.y)]
        ], {
            layers: ['unclustered-point', 'clusters']
        });
        
        console.log('Selected features:', features.length);
        
        if (features.length > 0) {
            processSelectedFeatures(features, bounds);
        } else {
            new mapboxgl.Popup({ className: 'no-data-popup' })
                .setLngLat([(startLngLat.lng + endLngLat.lng) / 2, (startLngLat.lat + endLngLat.lat) / 2])
                .setHTML(`<div style="padding: 10px; text-align: center; background-color: ${COLORS.DARKER_GRAY}; color: ${COLORS.WHITE}; border-radius: 6px;">No species data found in selection</div>`)
                .addTo(map);
        }
    });
}

map.on('load', async () => {
    console.log('Map has successfully loaded and is ready for custom GeoJSON data');
    
    map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
    });
    
    map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 3 });
    
    map.setFog({});
    
    const canvas = map.getCanvasContainer();
    canvas.style.backgroundColor = '#1a1a2e';
    
    try {
        const filteredData = await loadAndFilterGeoData();
        createMapLayers(filteredData);
        fitMapToBounds(filteredData);
        setupEventHandlers();
        setupRectangleSelection();
    } catch (error) {
        console.error('Error loading GeoJSON data:', error);
        console.error('Make sure you\'re running this from a web server (not file://) and the data file exists');
    }
});

async function processSelectedFeatures(features, bounds) {
        let allSpecies = [];
        let processedPointIds = new Set(); // Track processed points to avoid duplicates
        let totalPoints = 0;
        
        // Separate clusters and individual points
        const clusters = features.filter(f => f.properties.point_count);
        const individuals = features.filter(f => !f.properties.point_count);
        
        console.log(`Processing ${clusters.length} clusters and ${individuals.length} individual points`);
        
        // Process clusters first
        for (const cluster of clusters) {
            const clusterId = cluster.properties.cluster_id;
            const source = map.getSource('geojson-data');
            
            console.log(`Expanding cluster ${clusterId} with ${cluster.properties.point_count} points`);
            
            try {
                const clusterFeatures = await new Promise((resolve, reject) => {
                    source.getClusterLeaves(clusterId, 1000, 0, (error, leaves) => {
                        if (error) reject(error);
                        else resolve(leaves);
                    });
                });
                
                console.log(`Cluster expanded to ${clusterFeatures.length} individual features`);
                
                clusterFeatures.forEach(clusterFeature => {
                    const pointId = clusterFeature.id || `${clusterFeature.geometry.coordinates[0]}_${clusterFeature.geometry.coordinates[1]}`;
                    
                    if (clusterFeature.properties.species_colonies && !processedPointIds.has(pointId)) {
                        processedPointIds.add(pointId);
                        totalPoints++;
                        
                        let species;
                        if (typeof clusterFeature.properties.species_colonies === 'string') {
                            species = JSON.parse(clusterFeature.properties.species_colonies);
                        } else {
                            species = clusterFeature.properties.species_colonies;
                        }
                        
                        // Attach observation metadata to each species
                        const observationDate = clusterFeature.properties.Date || 'N/A';
                        const longitude = clusterFeature.geometry.coordinates[0];
                        const latitude = clusterFeature.geometry.coordinates[1];
                        
                        species.forEach(s => {
                            s._observationDate = observationDate;
                            s._longitude = longitude;
                            s._latitude = latitude;
                        });
                        
                        console.log(`Added ${species.length} species from cluster point ${pointId}`);
                        allSpecies.push(...species);
                    }
                });
            } catch (error) {
                console.error('Error expanding cluster:', error);
            }
        }
        
        // Process individual points only if they weren't already processed in clusters
        individuals.forEach(feature => {
            const pointId = feature.id || `${feature.geometry.coordinates[0]}_${feature.geometry.coordinates[1]}`;
            
            if (feature.properties.species_colonies && !processedPointIds.has(pointId)) {
                processedPointIds.add(pointId);
                totalPoints++;
                
                let species;
                if (typeof feature.properties.species_colonies === 'string') {
                    species = JSON.parse(feature.properties.species_colonies);
                } else {
                    species = feature.properties.species_colonies;
                }
                
                // Attach observation metadata to each species
                const observationDate = feature.properties.Date || 'N/A';
                const longitude = feature.geometry.coordinates[0];
                const latitude = feature.geometry.coordinates[1];
                
                species.forEach(s => {
                    s._observationDate = observationDate;
                    s._longitude = longitude;
                    s._latitude = latitude;
                });
                
                console.log(`Added ${species.length} species from individual point ${pointId}`);
                allSpecies.push(...species);
            } else if (processedPointIds.has(pointId)) {
                console.log(`Skipping duplicate point ${pointId}`);
            }
        });
        
        console.log(`Final count: ${totalPoints} unique locations with ${allSpecies.length} total species observations`);
        
        // Aggregate species counts and dates for display
        const speciesCounts = {};
        allSpecies.forEach(species => {
            const name = species.SpeciesName || 'Unknown';
            const code = species.SpeciesCode || 'N/A';
            const key = `${name} (${code})`;
            const observationDate = species._observationDate || 'N/A';
            
            if (!speciesCounts[key]) {
                speciesCounts[key] = {
                    name: name,
                    code: code,
                    count: 0,
                    thumbnail: species.bird_info?.bird_thumbnail,
                    dates: new Set()
                };
            }
            speciesCounts[key].count++;
            if (observationDate !== 'N/A') {
                speciesCounts[key].dates.add(observationDate);
            }
        });
        
        // Convert dates Set to readable format
        Object.values(speciesCounts).forEach(species => {
            const datesArray = Array.from(species.dates);
            if (datesArray.length === 0) {
                species.dateRange = 'No date available';
            } else if (datesArray.length === 1) {
                species.dateRange = datesArray[0];
            } else {
                // Sort dates and create range
                const sortedDates = datesArray.sort();
                species.dateRange = `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]} (${datesArray.length} dates)`;
            }
            delete species.dates; // Remove Set object before passing to JSON
        });
        
        showSpeciesSummary(speciesCounts, totalPoints, bounds, allSpecies);
}

function showSpeciesSummary(speciesCounts, totalPoints, bounds, allSpecies) {
        const centerLng = (bounds[0][0] + bounds[1][0]) / 2;
        const centerLat = (bounds[0][1] + bounds[1][1]) / 2;
        
        // Store individual species data globally for CSV download
        window.selectedSpeciesData = allSpecies;
        
        let popupContent = `
            <div class="selection-summary">
                <div class="summary-header">
                    <div class="header-top">
                        <h3>Selection Summary</h3>
                        <button class="csv-download-btn" onclick="downloadSummaryCSV(window.selectedSpeciesData, '${bounds}')" title="Download CSV">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                <path d="M12,11L16,15H13V19H11V15H8L12,11Z"/>
                            </svg>
                            CSV
                        </button>
                    </div>
                    <div class="summary-stats">
                        <span class="stat-item">${totalPoints} locations selected</span>
                        <span class="stat-item">${Object.keys(speciesCounts).length} unique species</span>
                    </div>
                </div>
                <div class="species-summary-list">
        `;
        
        // Sort species by count (descending)
        const sortedSpecies = Object.values(speciesCounts).sort((a, b) => b.count - a.count);
        
        sortedSpecies.forEach((species, index) => {
            const thumbnailId = `summary-thumbnail-${Date.now()}-${index}`;
            popupContent += `
                <div class="summary-species-item">
                    <div class="summary-species-info">
                        <div class="summary-species-name">${species.name}</div>
                        <div class="summary-species-details">
                            <span class="summary-species-code">${species.code}</span>
                            <span class="summary-species-count">${species.count} observation${species.count > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    ${species.thumbnail ? `
                        <div class="summary-species-thumbnail">
                            <img id="${thumbnailId}" 
                                 src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCA0MCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Im0yMCAxNSA0IDRoLThsNC00eiIgZmlsbD0iI2NjYyIvPgo8L3N2Zz4=" 
                                 alt="Loading..." 
                                 width="40" 
                                 height="30"
                                 data-src="${species.thumbnail}"
                                 onclick="showImageModal('${species.thumbnail}')"
                                 onload="loadThumbnail('${thumbnailId}')" />
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        popupContent += `
                </div>
                <div class="selection-instructions">
                    <small>Hold Shift + drag to select areas</small>
                </div>
            </div>
        `;
        
        new mapboxgl.Popup({ 
            className: 'selection-summary-popup',
            maxWidth: '400px'
        })
            .setLngLat([centerLng, centerLat])
            .setHTML(popupContent)
            .addTo(map);
}
