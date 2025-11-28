import requests
import time
import json
import sys
import random
import argparse

# Configuration
API_URL = "http://localhost:8000/api/broadcast-location"
ROUTES_FILE = "route_shapes.json"
STOPS_FILE = "../final_merged_with_stops.csv"

def load_shapes():
    try:
        with open(ROUTES_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: {ROUTES_FILE} not found. Please run generate_shapes.py first.")
        sys.exit(1)

def load_stops(route_id):
    try:
        import pandas as pd
        df = pd.read_csv(STOPS_FILE)
        # Filter by route_id
        route_stops = df[df['route_id'].astype(str) == str(route_id)]
        if route_stops.empty:
            print(f"No stops found for route {route_id}")
            return []
        return route_stops.to_dict('records')
    except Exception as e:
        print(f"Error loading stops: {e}")
        return []

def simulate_trip(user_id, route_id, speed_factor=1.0, offset_lat=0, offset_lng=0, payload_speed=0.0):
    shapes = load_shapes()
    
    # If route_id not provided or not found, pick a random one
    if not route_id or route_id not in shapes:
        available_routes = list(shapes.keys())
        if not available_routes:
            print("No shapes available.")
            return
        route_id = random.choice(available_routes)
        print(f"Randomly selected route: {route_id}")
    else:
        print(f"Using route: {route_id}")

    path = shapes[route_id] # List of [lat, lng]
    stops = load_stops(route_id)
    
    print(f"👻 Ghost Rider '{user_id}' starting trip on Route {route_id}...")
    print(f"   Path length: {len(path)} points")
    print(f"   Stops found: {len(stops)}")
    print(f"   Speed factor: {speed_factor}x")
    print(f"   Payload Speed: {payload_speed} km/h")

    # Simulate movement
    # We'll skip points based on speed_factor to make it faster
    step = int(1 * speed_factor)
    if step < 1: step = 1

    for i in range(0, len(path), step):
        lat, lng = path[i]
        
        # Check if we are near a stop to simulate "stopping"
        # Simple check: if distance to any stop < 50m
        # (This logic is just for visual feedback in the script, the backend does the real check)
        
        # Apply offset (for simulating multiple users on same bus)
        lat += offset_lat
        lng += offset_lng
        
        payload = {
            "user_id": user_id,
            "route_id": route_id,
            "lat": lat,
            "lng": lng,
            "timestamp": time.time(),
            "speed": payload_speed
        }
        
        try:
            r = requests.post(API_URL, json=payload)
            if r.status_code == 200:
                resp = r.json()
                if resp.get("status") == "ignored":
                    print(f"⚠️ [{user_id}] Ignored by server: {resp.get('reason')}")
                else:
                    print(f"📍 [{user_id}] Point {i+1}/{len(path)} sent. Active reports: {resp.get('active_reports')}")
            else:
                print(f"❌ [{user_id}] Failed: {r.status_code} - {r.text}")
        except Exception as e:
            print(f"❌ [{user_id}] Error: {e}")

        # Wait to simulate real time (1 second)
        time.sleep(1)

    print(f"🏁 [{user_id}] Trip Complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Simulate a user on a bus.')
    parser.add_argument('--user', type=str, default=f"ghost_{int(time.time())}", help='User ID')
    parser.add_argument('--route', type=str, help='Route ID (optional)')
    parser.add_argument('--speed', type=float, default=5.0, help='Speed factor (skip points)')
    parser.add_argument('--offset_lat', type=float, default=0.0, help='Latitude offset')
    parser.add_argument('--offset_lng', type=float, default=0.0, help='Longitude offset')
    parser.add_argument('--payload-speed', type=float, default=0.0, help='Speed value to send in payload')

    args = parser.parse_args()
    
    simulate_trip(args.user, args.route, args.speed, args.offset_lat, args.offset_lng, args.payload_speed)
