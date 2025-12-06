#!/usr/bin/env python3
"""
Optimize GeoJSON file with various levels of size reduction
"""

import json
import sys
import os
import gzip
from pathlib import Path

def get_file_size_mb(filepath):
    """Get file size in MB."""
    return os.path.getsize(filepath) / (1024 * 1024)

def optimize_minimal(data):
    """Remove only the largest space consumers."""
    removed_properties = {'exif'}
    
    for feature in data['features']:
        if 'properties' in feature and feature['properties']:
            for prop in removed_properties:
                feature['properties'].pop(prop, None)
    
    return data, removed_properties

def optimize_moderate(data):
    """Remove EXIF and other large properties, keep essential data."""
    removed_properties = {'exif', 'thumbnail', 'name'}
    
    for feature in data['features']:
        if 'properties' in feature and feature['properties']:
            for prop in removed_properties:
                feature['properties'].pop(prop, None)
    
    return data, removed_properties

def optimize_aggressive(data):
    """Keep only essential scientific data."""
    essential_properties = {
        'species_colonies', 'latitude', 'longitude', 'Date', 
        'altitude', 'PhotoNumber', 'CameraNumber', 'location_from'
    }
    
    removed_properties = set()
    
    for feature in data['features']:
        if 'properties' in feature and feature['properties']:
            current_props = set(feature['properties'].keys())
            props_to_remove = current_props - essential_properties
            removed_properties.update(props_to_remove)
            
            for prop in props_to_remove:
                feature['properties'].pop(prop, None)
    
    return data, removed_properties

def reduce_coordinate_precision(data, decimal_places=6):
    """Reduce coordinate precision to specified decimal places."""
    def round_coords(coords):
        if isinstance(coords, list):
            if len(coords) == 2 and all(isinstance(x, (int, float)) for x in coords):
                return [round(coords[0], decimal_places), round(coords[1], decimal_places)]
            else:
                return [round_coords(c) for c in coords]
        return coords
    
    for feature in data['features']:
        if 'geometry' in feature and feature['geometry'] and 'coordinates' in feature['geometry']:
            feature['geometry']['coordinates'] = round_coords(feature['geometry']['coordinates'])
    
    return data

def optimize_geojson(input_file, optimization_level='minimal'):
    """
    Optimize GeoJSON with different levels of optimization.
    
    Levels:
    - minimal: Remove only EXIF data (biggest impact, safest)
    - moderate: Remove EXIF, thumbnails, filenames
    - aggressive: Keep only essential scientific properties
    """
    
    print(f"Loading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    original_size = get_file_size_mb(input_file)
    print(f"Original size: {original_size:.1f} MB")
    
    # Apply optimization
    if optimization_level == 'minimal':
        data, removed_props = optimize_minimal(data)
        suffix = '_minimal'
    elif optimization_level == 'moderate':
        data, removed_props = optimize_moderate(data)
        suffix = '_moderate'
    elif optimization_level == 'aggressive':
        data, removed_props = optimize_aggressive(data)
        suffix = '_aggressive'
    else:
        raise ValueError("Invalid optimization level")
    
    # Reduce coordinate precision
    data = reduce_coordinate_precision(data, decimal_places=6)
    
    # Save optimized version
    output_file = input_file.replace('.geojson', f'{suffix}.geojson')
    print(f"Saving optimized file as {output_file}...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))  # Compact JSON
    
    # Create compressed version
    compressed_file = output_file + '.gz'
    print(f"Creating compressed version: {compressed_file}...")
    
    with open(output_file, 'rb') as f_in:
        with gzip.open(compressed_file, 'wb') as f_out:
            f_out.writelines(f_in)
    
    # Show results
    optimized_size = get_file_size_mb(output_file)
    compressed_size = get_file_size_mb(compressed_file)
    
    print("\n" + "="*60)
    print(f"OPTIMIZATION RESULTS - {optimization_level.upper()} LEVEL")
    print("="*60)
    print(f"Removed properties: {', '.join(sorted(removed_props))}")
    print()
    print(f"Original size:     {original_size:8.1f} MB")
    print(f"Optimized size:    {optimized_size:8.1f} MB ({((original_size-optimized_size)/original_size)*100:.1f}% reduction)")
    print(f"Compressed size:   {compressed_size:8.1f} MB ({((original_size-compressed_size)/original_size)*100:.1f}% reduction)")
    print()
    print(f"Files created:")
    print(f"  - {output_file}")
    print(f"  - {compressed_file}")
    
    return output_file, compressed_file

def main():
    input_file = 'metadata.geojson'
    
    if len(sys.argv) > 1:
        level = sys.argv[1].lower()
        if level not in ['minimal', 'moderate', 'aggressive']:
            print("Usage: python optimize_geojson.py [minimal|moderate|aggressive]")
            print("Default: minimal")
            return 1
    else:
        level = 'minimal'
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found")
        return 1
    
    try:
        optimize_geojson(input_file, level)
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
