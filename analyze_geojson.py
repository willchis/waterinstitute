#!/usr/bin/env python3
"""
Analyze GeoJSON file to identify what's taking up space
"""

import json
import sys
from collections import defaultdict, Counter

def analyze_geojson_sample(filename, sample_size=1000):
    """Analyze a sample of features to understand file structure."""
    print(f"Analyzing {filename}...")
    
    with open(filename, 'r') as f:
        data = json.load(f)
    
    if 'features' not in data:
        print("No features found in GeoJSON")
        return
    
    total_features = len(data['features'])
    sample_features = data['features'][:sample_size]
    
    print(f"Total features: {total_features:,}")
    print(f"Analyzing first {len(sample_features):,} features...")
    print()
    
    # Analyze properties
    all_properties = defaultdict(list)
    property_sizes = defaultdict(int)
    geometry_types = Counter()
    coordinate_counts = []
    
    for i, feature in enumerate(sample_features):
        # Geometry analysis
        if 'geometry' in feature and feature['geometry']:
            geom_type = feature['geometry'].get('type', 'Unknown')
            geometry_types[geom_type] += 1
            
            # Count coordinates
            coords = feature['geometry'].get('coordinates', [])
            coord_count = count_coordinates(coords)
            coordinate_counts.append(coord_count)
        
        # Property analysis
        if 'properties' in feature and feature['properties']:
            for key, value in feature['properties'].items():
                all_properties[key].append(value)
                # Estimate size of this property
                property_sizes[key] += len(str(value))
    
    # Report findings
    print("=== GEOMETRY ANALYSIS ===")
    for geom_type, count in geometry_types.most_common():
        percentage = (count / len(sample_features)) * 100
        print(f"{geom_type}: {count:,} ({percentage:.1f}%)")
    
    if coordinate_counts:
        avg_coords = sum(coordinate_counts) / len(coordinate_counts)
        max_coords = max(coordinate_counts)
        print(f"Average coordinates per feature: {avg_coords:.1f}")
        print(f"Maximum coordinates in a feature: {max_coords:,}")
    
    print()
    print("=== PROPERTY ANALYSIS ===")
    print("Top properties by estimated size:")
    
    sorted_props = sorted(property_sizes.items(), key=lambda x: x[1], reverse=True)
    for prop_name, total_size in sorted_props[:15]:
        avg_size = total_size / len(all_properties[prop_name])
        print(f"{prop_name}: {total_size:,} chars total, {avg_size:.1f} avg per feature")
    
    print()
    print("=== SAMPLE PROPERTY VALUES ===")
    for prop_name, total_size in sorted_props[:5]:
        values = all_properties[prop_name]
        sample_value = str(values[0]) if values else "None"
        if len(sample_value) > 100:
            sample_value = sample_value[:100] + "..."
        print(f"{prop_name}: {sample_value}")
    
    print()
    print("=== OPTIMIZATION SUGGESTIONS ===")
    
    # Coordinate precision suggestion
    if coordinate_counts and avg_coords > 100:
        print("1. GEOMETRY SIMPLIFICATION:")
        print("   - Your features have many coordinates (complex geometries)")
        print("   - Consider geometric simplification to reduce coordinate count")
        print("   - Reduce coordinate precision (e.g., 6 decimal places instead of 15)")
    
    # Property suggestions
    if sorted_props:
        print("2. PROPERTY OPTIMIZATION:")
        large_props = [prop for prop, size in sorted_props if size > 1000]
        if large_props:
            print(f"   - Consider removing large properties: {', '.join(large_props[:5])}")
        print("   - Remove null/empty properties")
        print("   - Shorten property names if possible")
    
    print("3. COMPRESSION:")
    print("   - Use gzip compression (can reduce size 60-80%)")
    print("   - Convert to more efficient formats (GeoParquet, FlatGeobuf)")

def count_coordinates(coords):
    """Recursively count coordinate pairs in geometry."""
    if not coords:
        return 0
    
    if isinstance(coords[0], (int, float)):
        return 1
    
    total = 0
    for item in coords:
        total += count_coordinates(item)
    return total

if __name__ == "__main__":
    analyze_geojson_sample('metadata.geojson')
