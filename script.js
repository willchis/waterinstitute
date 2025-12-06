const MAPBOX_ACCESS_TOKEN_PLACEHOLDER = 'pk.eyJ1Ijoid2lsbGNoaXMiLCJhIjoiY21pdWY2dDIzMXdybjNrb3Z4ZnpldW94YSJ9.DsafjLG-L13IoDJb6N5SaQ'
// Set your Mapbox access token
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN_PLACEHOLDER;

// Function to lazy load thumbnails
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
                img.style.background = '#ddd';
            };
            tempImg.src = actualSrc;
        }
    }
}

// Make loadThumbnail globally available
window.loadThumbnail = loadThumbnail;

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
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
            
            // Filter to only show features with species_colonies
            const filteredData = {
                ...geojsonData,
                features: geojsonData.features.filter(feature => {
                    const colonies = feature.properties.species_colonies;
                    // Handle both array and string cases during filtering
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
            
            // Add the filtered GeoJSON data as a source with clustering enabled
            map.addSource('geojson-data', {
                type: 'geojson',
                data: filteredData,
                cluster: true,
                clusterMaxZoom: 14, // Max zoom to cluster points on
                clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
            });
            
            // Add cluster layer
            map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'geojson-data',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': [
                        'step',
                        ['get', 'point_count'],
                        '#4fc3f7',
                        100,
                        '#ffeb3b',
                        750,
                        '#ff5722'
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
                    'circle-stroke-color': '#ffffff'
                }
            });

            // Add cluster count labels
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
                    'text-color': '#000000',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1
                }
            });

            // Add unclustered points layer
            map.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: 'geojson-data',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': '#00acc1',
                    'circle-radius': 8,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });
            
            console.log('Layers added successfully');
            
            // Fit map to data bounds if features exist
            if (filteredData.features && filteredData.features.length > 0) {
                const bounds = new mapboxgl.LngLatBounds();
                filteredData.features.forEach(feature => {
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
    
    // Add hover effects for clusters
    map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
    });
    
    // Add hover effects for unclustered points
    map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
    });
    
    // Cluster click event - expand clusters
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
    
    // Add click event for individual points popups
    map.on('click', 'unclustered-point', (e) => {
        if (!e.features || e.features.length === 0) {
            return;
        }
        
        const features = e.features[0];
        const properties = features.properties;
        
        // Debug: Check if species_colonies is already an array or needs parsing
        console.log('species_colonies type:', typeof properties.species_colonies);
        console.log('species_colonies value:', properties.species_colonies);
        
        const speciesColonies = Array.isArray(properties.species_colonies) 
            ? properties.species_colonies 
            : (properties.species_colonies ? JSON.parse(properties.species_colonies) : []);
        
        // Create popup content focused on species information
        let popupContent = `
            <div class="species-popup">
                <div class="popup-header">
                    <h3>Species Found</h3>
                    <div class="location-info">
                        <small>Location: ${properties.longitude?.toFixed(4)}, ${properties.latitude?.toFixed(4)}</small>
                    </div>
                </div>
                <div class="species-list">
        `;
        
        speciesColonies.forEach((species, index) => {
            const thumbnailId = `thumbnail-${Date.now()}-${index}`;
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
                             style="background: #f0f0f0; border-radius: 4px;"
                             data-src="${species.bird_info?.bird_thumbnail || ''}"
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
        
        new mapboxgl.Popup({ className: 'species-popup-container' })
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

    // Rectangle selection functionality
    let isDrawing = false;
    let startPoint = null;
    let startLngLat = null;

    // Create a canvas element for drawing the selection rectangle
    const canvas = map.getCanvasContainer();
    const selectionBox = document.createElement('div');
    selectionBox.classList.add('selection-box');
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = '2px dashed #4fc3f7';
    selectionBox.style.backgroundColor = 'rgba(79, 195, 247, 0.2)';
    selectionBox.style.display = 'none';
    selectionBox.style.pointerEvents = 'none';
    canvas.appendChild(selectionBox);

    // Add selection mode indicator
    const selectionIndicator = document.createElement('div');
    selectionIndicator.innerHTML = 'Hold Shift + Drag to select area';
    selectionIndicator.style.position = 'absolute';
    selectionIndicator.style.top = '10px';
    selectionIndicator.style.left = '10px';
    selectionIndicator.style.background = 'rgba(255, 255, 255, 0.9)';
    selectionIndicator.style.color = '#333';
    selectionIndicator.style.padding = '8px 12px';
    selectionIndicator.style.borderRadius = '6px';
    selectionIndicator.style.fontSize = '12px';
    selectionIndicator.style.zIndex = '1000';
    selectionIndicator.style.border = '1px solid rgba(0,0,0,0.1)';
    canvas.appendChild(selectionIndicator);

    // Track shift key state
    let shiftPressed = false;
    
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
            // Cancel any ongoing selection
            if (isDrawing) {
                isDrawing = false;
                selectionBox.style.display = 'none';
                map.dragPan.enable();
                map.scrollZoom.enable();
                map.doubleClickZoom.enable();
            }
        }
    });

    // Use Mapbox mouse events
    map.on('mousedown', (e) => {
        if (!shiftPressed) return;
        
        // Prevent default map behavior
        e.preventDefault();
        isDrawing = true;
        startPoint = e.point;
        startLngLat = e.lngLat;
        
        // Disable map interactions
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.doubleClickZoom.disable();
        
        // Show selection box
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
        
        // Hide selection box
        selectionBox.style.display = 'none';
        
        // Re-enable map interactions
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.doubleClickZoom.enable();
        
        // Check minimum selection size
        const minSize = 5;
        if (Math.abs(endPoint.x - startPoint.x) < minSize || Math.abs(endPoint.y - startPoint.y) < minSize) {
            return; // Selection too small
        }
        
        // Create bounding box
        const bounds = [
            [Math.min(startLngLat.lng, endLngLat.lng), Math.min(startLngLat.lat, endLngLat.lat)],
            [Math.max(startLngLat.lng, endLngLat.lng), Math.max(startLngLat.lat, endLngLat.lat)]
        ];
        
        // Query features within the selection rectangle
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
            // Show message if no features found
            new mapboxgl.Popup({ className: 'no-data-popup' })
                .setLngLat([(startLngLat.lng + endLngLat.lng) / 2, (startLngLat.lat + endLngLat.lat) / 2])
                .setHTML('<div style="padding: 10px; text-align: center; background-color: #2d2d2d; color: #ffffff; border-radius: 6px;">No species data found in selection</div>')
                .addTo(map);
        }
    });

    // Function to process selected features and show species summary
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
                console.log(`Added ${species.length} species from individual point ${pointId}`);
                allSpecies.push(...species);
            } else if (processedPointIds.has(pointId)) {
                console.log(`Skipping duplicate point ${pointId}`);
            }
        });
        
        console.log(`Final count: ${totalPoints} unique locations with ${allSpecies.length} total species observations`);
        
        // Aggregate species counts
        const speciesCounts = {};
        allSpecies.forEach(species => {
            const name = species.SpeciesName || 'Unknown';
            const code = species.SpeciesCode || 'N/A';
            const key = `${name} (${code})`;
            
            if (!speciesCounts[key]) {
                speciesCounts[key] = {
                    name: name,
                    code: code,
                    count: 0,
                    thumbnail: species.bird_info?.bird_thumbnail
                };
            }
            speciesCounts[key].count++;
        });
        
        // Show summary popup
        showSpeciesSummary(speciesCounts, totalPoints, bounds);
    }

    // Function to show species summary popup
    function showSpeciesSummary(speciesCounts, totalPoints, bounds) {
        const centerLng = (bounds[0][0] + bounds[1][0]) / 2;
        const centerLat = (bounds[0][1] + bounds[1][1]) / 2;
        
        let popupContent = `
            <div class="selection-summary">
                <div class="summary-header">
                    <h3>Selection Summary</h3>
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
});

