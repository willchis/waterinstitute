#!/usr/bin/env python3
"""
Clean GeoJSON file by removing features with null/invalid coordinates
"""

import json
import sys
from datetime import datetime

def clean_geojson(input_file, output_file=None):
    """Clean GeoJSON file by removing invalid features."""
    
    if output_file is None:
        output_file = input_file
    
    print(f"Loading {input_file}...")
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading file: {e}")
        return False
    
    if 'features' not in data:
        print("No features found in GeoJSON")
        return False
    
    original_count = len(data['features'])
    print(f"Original feature count: {original_count:,}")
    
    # Clean features
    cleaned_features = []
    removed_reasons = {
        'null_longitude': 0,
        'null_latitude': 0,
        'invalid_longitude_type': 0,
        'invalid_latitude_type': 0,
        'missing_properties': 0,
        'no_date': 0
    }
    
    for i, feature in enumerate(data['features']):
        if i % 10000 == 0:  # Progress indicator for large files
            print(f"Processing feature {i:,}...")
        
        # Check if feature has properties
        if not feature.get('properties'):
            removed_reasons['missing_properties'] += 1
            continue
        
        props = feature['properties']
        
        # Check longitude
        longitude = props.get('longitude')
        if longitude is None:
            removed_reasons['null_longitude'] += 1
            continue
        
        if not isinstance(longitude, (int, float)):
            removed_reasons['invalid_longitude_type'] += 1
            continue
        
        # Check latitude
        latitude = props.get('latitude')
        if latitude is None:
            removed_reasons['null_latitude'] += 1
            continue
        
        if not isinstance(latitude, (int, float)):
            removed_reasons['invalid_latitude_type'] += 1
            continue
        
        
        # Feature passed all checks - keep it
        cleaned_features.append(feature)
    
    # Update the data
    data['features'] = cleaned_features
    cleaned_count = len(cleaned_features)
    total_removed = original_count - cleaned_count
    
    # Print statistics
    print(f"\n=== CLEANING RESULTS ===")
    print(f"Original features: {original_count:,}")
    print(f"Cleaned features: {cleaned_count:,}")
    print(f"Removed features: {total_removed:,} ({(total_removed/original_count)*100:.1f}%)")
    
    if total_removed > 0:
        print(f"\n=== REMOVAL BREAKDOWN ===")
        for reason, count in removed_reasons.items():
            if count > 0:
                percentage = (count / original_count) * 100
                print(f"{reason.replace('_', ' ').title()}: {count:,} ({percentage:.1f}%)")
    
    # Write cleaned data
    if cleaned_count > 0:
        print(f"\nWriting cleaned data to {output_file}...")
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, separators=(',', ':'))  # Compact JSON
            
            print(f"✅ Successfully cleaned and saved {cleaned_count:,} features")
            
            # Show file size difference
            import os
            if input_file != output_file:
                original_size = os.path.getsize(input_file)
                cleaned_size = os.path.getsize(output_file)
                size_reduction = original_size - cleaned_size
                print(f"File size reduced by {size_reduction:,} bytes ({(size_reduction/original_size)*100:.1f}%)")
            
        except Exception as e:
            print(f"❌ Error writing file: {e}")
            return False
    else:
        print("❌ No valid features found - not writing output file")
        return False
    
    return True

def main():
    input_file = 'data/data.geojson'
    
    # Create backup automatically
    backup_file = f'data/data_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.geojson'
    print(f"Creating backup: {backup_file}")
    
    import shutil
    try:
        shutil.copy2(input_file, backup_file)
        print(f"✅ Backup created successfully")
    except Exception as e:
        print(f"⚠️  Warning: Could not create backup: {e}")
    
    success = clean_geojson(input_file, input_file)
    
    if success:
        print(f"\n🎉 Data cleaning completed!")
        print(f"Your cleaned GeoJSON file is ready at: {input_file}")
        print(f"Original data backed up to: {backup_file}")
    else:
        print(f"\n❌ Data cleaning failed")
        sys.exit(1)

if __name__ == "__main__":
    main()

