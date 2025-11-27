import pandas as pd
import requests
import polyline
import json
import os
import time

GTFS_FOLDER = "../GTFS"
OUTPUT_FILE = "route_shapes.json"

def generate_shapes():
    print("Loading GTFS data...")
    try:
        routes_df = pd.read_csv(os.path.join(GTFS_FOLDER, 'routes.txt'))
        trips_df = pd.read_csv(os.path.join(GTFS_FOLDER, 'trips.txt'))
        stop_times_df = pd.read_csv(os.path.join(GTFS_FOLDER, 'stop_times.txt'))
        stops_df = pd.read_csv(os.path.join(GTFS_FOLDER, 'stops.txt'))
    except Exception as e:
        print(f"Error loading GTFS files: {e}")
        return

    # Create a map of stop_id -> (lat, lon)
    stops_map = stops_df.set_index('stop_id')[['stop_lat', 'stop_lon']].to_dict('index')

    # Get unique routes
    unique_route_ids = routes_df['route_id'].unique()
    print(f"Found {len(unique_route_ids)} routes.")

    shapes_data = {}
    
    # Limit for testing/demo to avoid hitting OSRM rate limits too hard
    # In production, we might run this slowly over time or for all routes
    # Let's try to do it for a reasonable number, or all if we add delays
    
    count = 0
    total = len(unique_route_ids)
    
    for route_id in unique_route_ids:
        count += 1
        route_id_str = str(route_id)
        
        # Find a representative trip for this route
        # We prefer a trip with the most stops to get the full shape
        route_trips = trips_df[trips_df['route_id'] == route_id]
        if route_trips.empty:
            continue
            
        # Pick the first trip for now (optimally, pick the longest one)
        trip_id = route_trips.iloc[0]['trip_id']
        
        # Get stops for this trip
        trip_stops = stop_times_df[stop_times_df['trip_id'] == trip_id].sort_values('stop_sequence')
        
        if trip_stops.empty:
            continue
            
        coords = []
        for stop_id in trip_stops['stop_id']:
            if stop_id in stops_map:
                lat = stops_map[stop_id]['stop_lat']
                lon = stops_map[stop_id]['stop_lon']
                coords.append(f"{lon},{lat}") # OSRM expects Lon,Lat
        
        if len(coords) < 2:
            continue
            
        # OSRM URL
        # Split into chunks if too long (OSRM usually handles ~100 points, but let's be safe)
        # For simplicity, we'll try sending all. If it fails, we might need to simplify.
        # Actually, standard OSRM demo server might reject very long URLs.
        # Let's take a subsample if it's huge, or just try.
        
        # Optimization: Take every nth stop if there are too many, to keep URL short
        # But we want precision.
        
        coordinates_string = ";".join(coords)
        url = f"http://router.project-osrm.org/route/v1/driving/{coordinates_string}?overview=full&geometries=polyline"
        
        try:
            # Be nice to the free API
            time.sleep(0.2) 
            
            r = requests.get(url)
            if r.status_code != 200:
                print(f"[{count}/{total}] Failed for route {route_id}: {r.status_code}")
                continue
                
            data = r.json()
            
            if 'routes' in data and len(data['routes']) > 0:
                encoded_geometry = data['routes'][0]['geometry']
                decoded_path = polyline.decode(encoded_geometry) # [(lat, lng), ...]
                shapes_data[route_id_str] = decoded_path
                print(f"[{count}/{total}] Generated shape for route {route_id} ({len(decoded_path)} points)")
            else:
                print(f"[{count}/{total}] No route found for {route_id}")
                
        except Exception as e:
            print(f"[{count}/{total}] Error for route {route_id}: {e}")
            
        # Save periodically
        if count % 10 == 0:
            with open(OUTPUT_FILE, 'w') as f:
                json.dump(shapes_data, f)
                
    # Final save
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(shapes_data, f)
    
    print(f"Finished! Saved shapes for {len(shapes_data)} routes to {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_shapes()
