#!/usr/bin/env python3
"""
Script to remove specific properties from a GeoJSON file to reduce file size.
Removes 'MakerNote' and 'UserComment' properties from all features.
"""

import json
import sys
import os
from pathlib import Path

def clean_feature(feature):
    """Remove unwanted properties from a single feature."""
    if 'properties' in feature and feature['properties']:
        # Remove the specified properties if they exist
        feature['properties'].pop('MakerNote', None)
        feature['properties'].pop('UserComment', None)
    return feature

def clean_geojson_streaming(input_file, output_file):
    """
    Clean GeoJSON file by streaming through it to handle large files.
    """
    print(f"Processing {input_file}...")
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        # Read the file structure
        data = json.load(infile)
    
    # Track how many properties were removed
    removed_count = 0
    
    # Process features
    if 'features' in data:
        for i, feature in enumerate(data['features']):
            if i % 1000 == 0:  # Progress indicator
                print(f"Processed {i:,} features...")
            
            # Count removals before cleaning
            if 'properties' in feature and feature['properties']:
                if 'MakerNote' in feature['properties']:
                    removed_count += 1
                if 'UserComment' in feature['properties']:
                    removed_count += 1
            
            # Clean the feature
            data['features'][i] = clean_feature(feature)
    
    # Write cleaned data to output file
    print(f"Writing cleaned data to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as outfile:
        json.dump(data, outfile, separators=(',', ':'))  # Compact output
    
    return removed_count

def get_file_size_mb(filepath):
    """Get file size in MB."""
    return os.path.getsize(filepath) / (1024 * 1024)

def main():
    input_file = 'metadata.geojson'
    output_file = 'metadata_cleaned.geojson'
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found in current directory")
        return 1
    
    # Show original file size
    original_size = get_file_size_mb(input_file)
    print(f"Original file size: {original_size:.1f} MB")
    
    try:
        # Clean the GeoJSON
        removed_count = clean_geojson_streaming(input_file, output_file)
        
        # Show results
        new_size = get_file_size_mb(output_file)
        size_reduction = original_size - new_size
        
        print("\n" + "="*50)
        print("CLEANUP COMPLETE")
        print("="*50)
        print(f"Properties removed: {removed_count:,}")
        print(f"Original size: {original_size:.1f} MB")
        print(f"New size: {new_size:.1f} MB")
        print(f"Size reduction: {size_reduction:.1f} MB ({(size_reduction/original_size)*100:.1f}%)")
        print(f"Cleaned file saved as: {output_file}")
        
        return 0
        
    except Exception as e:
        print(f"Error processing file: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
