# waterinstitute

## Data cleaning

1. Downloaded data from: https://github.com/waterinstitute/avian_data_ingestor/blob/master/doc/examples/metadata.geojson.gz
2. Removed bulky properties from the JSON using clean_geojson.py and optimize_geojson.py. Exif camera metadata was the biggest culprit: reducing JSON size from ~1GB to ~10MB.