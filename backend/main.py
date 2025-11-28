from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from google.transit import gtfs_realtime_pb2
import requests
import pandas as pd
import os
from pydantic import BaseModel
from typing import List, Dict
import time
import math
import json
from datetime import datetime

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5176",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REPLACE WITH YOUR ACTUAL KEY
OTD_URL = "https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb?key=Njl90zyCwKNqpVkuyF8K0ZNpwTkAbdX4"
GTFS_FOLDER = "../GTFS" # Relative to backend directory

# Global variable to store the map
TRIP_TO_ROUTE_MAP = {}
ROUTE_ID_TO_NAME_MAP = {}
STOPS_DF = None # Pandas DataFrame
TRIP_STOPS = {} # Dict[trip_id, List[Dict]]

# --- Virtual Bus Stores ---
class UserReport(BaseModel):
    user_id: str
    route_id: str
    lat: float
    lng: float
    timestamp: float
    speed: float = 0.0 # Optional, default 0
    last_stop_id: str = None # Optional, for sequence check
    last_stop_time: float = None # Optional
    role: str = "passenger" # passenger or driver

class VirtualBus(BaseModel):
    id: str
    route_id: str
    route_name: str
    lat: float
    lng: float
    passenger_count: int
    confidence: float # 0.0 to 1.0
    last_updated: float
    delay_minutes: float = 0.0 # Estimated delay
    status: str = "On Time" # On Time, Late, Early
    is_driver_bus: bool = False

# In-memory stores
USER_REPORTS: List[UserReport] = []
VIRTUAL_BUSES: List[VirtualBus] = []

def load_gtfs_data():
    global TRIP_TO_ROUTE_MAP, ROUTE_ID_TO_NAME_MAP, STOPS_DF, TRIP_STOPS
    try:
        print("Loading Static GTFS Data... this might take a few seconds.")
        
        # 1. Load Final Merged Stops (The "Gold" Data)
        stops_csv_path = "../final_merged_with_stops.csv"
        if os.path.exists(stops_csv_path):
            print(f"Loading {stops_csv_path}...")
            STOPS_DF = pd.read_csv(stops_csv_path)
            
            # Create optimized lookup: trip_id -> list of stops
            # We group by trip_id and convert to list of dicts for fast iteration
            # Ensure sorting by arrival_time if not already
            STOPS_DF = STOPS_DF.sort_values(by=['trip_id', 'arrival_time'])
            
            # Grouping
            grouped = STOPS_DF.groupby('trip_id')
            for trip_id, group in grouped:
                TRIP_STOPS[str(trip_id)] = group.to_dict('records')
                
            print(f"Loaded {len(TRIP_STOPS)} trips with stop sequences.")
        else:
            print(f"Warning: {stops_csv_path} not found. Enhanced features will be disabled.")

        if not os.path.exists(GTFS_FOLDER):
            print(f"Warning: GTFS folder not found at {GTFS_FOLDER}. Skipping static data load.")
            return

        # A. Load Routes (Maps route_id -> "505")
        routes_path = os.path.join(GTFS_FOLDER, 'routes.txt')
        trips_path = os.path.join(GTFS_FOLDER, 'trips.txt')

        if not os.path.exists(routes_path) or not os.path.exists(trips_path):
             print("Warning: routes.txt or trips.txt not found. Skipping static data load.")
             return

        # Check for LFS pointer (simple check: file size < 200 bytes)
        if os.path.getsize(routes_path) < 200 or os.path.getsize(trips_path) < 200:
             print("Warning: GTFS files appear to be Git LFS pointers. Skipping static data load.")
             # Raise exception to trigger fallback
             raise Exception("GTFS files are LFS pointers")

        routes_df = pd.read_csv(routes_path, usecols=['route_id', 'route_short_name', 'route_long_name'])
        
        # Handle missing short names
        routes_df['route_name'] = routes_df['route_short_name'].fillna(routes_df['route_long_name'])
        
        # Convert to dictionary: {'route_101': '505', ...}
        # Ensure route_id is string for consistent lookup
        routes_df['route_id'] = routes_df['route_id'].astype(str)
        ROUTE_ID_TO_NAME_MAP = dict(zip(routes_df.route_id, routes_df.route_name))
        
        # B. Load Trips (Maps trip_id -> route_id)
        trips_df = pd.read_csv(trips_path, usecols=['trip_id', 'route_id'])
        
        # C. CREATE THE MASTER LOOKUP (trip_id -> "505")
        trips_df['route_id'] = trips_df['route_id'].astype(str)
        trips_df['bus_number'] = trips_df['route_id'].map(ROUTE_ID_TO_NAME_MAP)
        
        # Convert to final dictionary
        TRIP_TO_ROUTE_MAP = dict(zip(trips_df.trip_id, trips_df.bus_number))
        
        print(f"Loaded {len(TRIP_TO_ROUTE_MAP)} trip mappings. Ready to serve!")
        
    except Exception as e:
        print(f"Error loading GTFS data: {e}")
        # Fallback: If we have STOPS_DF but failed to load routes/trips, 
        # populate ROUTE_ID_TO_NAME_MAP from STOPS_DF unique route_ids
        if STOPS_DF is not None and not ROUTE_ID_TO_NAME_MAP:
            print("Populating Route Map from Stops Data (Fallback)...")
            unique_routes = STOPS_DF['route_id'].unique()
            for rid in unique_routes:
                ROUTE_ID_TO_NAME_MAP[str(rid)] = f"Route {rid}"
            print(f"Fallback: Loaded {len(ROUTE_ID_TO_NAME_MAP)} routes.")

# Load data on startup
load_gtfs_data()

# --- Helper Functions ---
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000 # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def get_seconds_from_time(time_str):
    # HH:MM:SS -> seconds
    try:
        h, m, s = map(int, time_str.split(':'))
        return h * 3600 + m * 60 + s
    except:
        return 0

def validate_user_and_calculate_delay(report: UserReport):
    """
    Strategy A: Check if user is near a stop (Geofence).
    Strategy B: Calculate delay based on scheduled arrival.
    """
    if not TRIP_STOPS:
        return None, 0.0 # No data
        
    # Find potential trips for this route
    # Since we only have route_id from user, we need to find a trip that matches 
    # the current time roughly or just check all trips for this route?
    # For simplicity/demo: We assume the user might be on ANY trip of this route.
    # But checking ALL stops of ALL trips is expensive.
    # Optimization: Filter by route_id first.
    
    # We need a Route -> Trips lookup. 
    # Let's build it on the fly or cache it? Cache is better but for now:
    
    potential_matches = []
    
    # We iterate through all trips (expensive!) -> TODO: Optimize this lookup
    # Better: Use STOPS_DF filtered by route_id
    
    # Let's try to find the CLOSEST stop in the entire dataset for this route
    # This is "Geofence Trap"
    
    if STOPS_DF is None:
        return None, 0.0

    # Filter for this route
    route_stops = STOPS_DF[STOPS_DF['route_id'].astype(str) == str(report.route_id)]
    
    if route_stops.empty:
        return None, 0.0
        
    # Find nearest stop
    # Vectorized distance calculation would be faster, but let's iterate for now (simpler code)
    min_dist = float('inf')
    nearest_stop = None
    
    for _, stop in route_stops.iterrows():
        dist = haversine_distance(report.lat, report.lng, stop['stop_lat'], stop['stop_lon'])
        if dist < min_dist:
            min_dist = dist
            nearest_stop = stop
            
    # Strategy A: Geofence Trap (50 meters)
    if min_dist <= 50:
        # User is at a stop!
        # Strategy B: Delta Calculation
        # Calculate Delay
        
        # Current time in HH:MM:SS format? No, we have timestamp.
        # We need to convert current timestamp to HH:MM:SS relative to today?
        # Or just compare seconds if we assume the schedule is for "today".
        
        current_dt = datetime.fromtimestamp(report.timestamp)
        current_seconds = current_dt.hour * 3600 + current_dt.minute * 60 + current_dt.second
        
        scheduled_seconds = get_seconds_from_time(nearest_stop['arrival_time'])
        
        # Delay = Actual - Scheduled
        delay_seconds = current_seconds - scheduled_seconds
        delay_minutes = delay_seconds / 60.0
        
        # Normalize delay (e.g. if it's negative, maybe they are early, or it's the wrong trip)
        # For this MVP, we take it as is.
        
        return nearest_stop['stop_id'], delay_minutes
        
    return None, 0.0

def cluster_reports():
    global VIRTUAL_BUSES, USER_REPORTS
    current_time = time.time()
    
    # 1. Cleanup old reports (> 5 minutes)
    USER_REPORTS = [r for r in USER_REPORTS if current_time - r.timestamp < 300]
    
    # 2. Group by Route ID
    reports_by_route = {}
    for report in USER_REPORTS:
        if report.route_id not in reports_by_route:
            reports_by_route[report.route_id] = []
        reports_by_route[report.route_id].append(report)
        
    new_virtual_buses = []
    
    # 3. Cluster within each route
    for route_id, reports in reports_by_route.items():
        # Separate drivers and passengers
        drivers = [r for r in reports if r.role == 'driver']
        passengers = [r for r in reports if r.role != 'driver']
        
        processed_passengers = set()
        
        # A. Create buses for Drivers (High Confidence)
        for i, driver in enumerate(drivers):
            # Find passengers near this driver
            cluster = [driver]
            for j, p in enumerate(passengers):
                if j in processed_passengers:
                    continue
                dist = haversine_distance(driver.lat, driver.lng, p.lat, p.lng)
                if dist < 100: # 100m radius for driver
                    cluster.append(p)
                    processed_passengers.add(j)
            
            # Create Virtual Bus from Driver
            # Calculate delay based on driver's location
            stop_id, delay = validate_user_and_calculate_delay(driver)
            
            status = "On Time"
            if delay > 5:
                status = f"Late {int(delay)} min"
            elif delay < -2:
                status = "Early"
            
            route_name = ROUTE_ID_TO_NAME_MAP.get(route_id, f"Route {route_id}")
            
            v_bus = VirtualBus(
                id=f"vbus_driver_{route_id}_{int(current_time)}_{i}",
                route_id=route_id,
                route_name=route_name,
                lat=driver.lat,
                lng=driver.lng,
                passenger_count=len(cluster) - 1, # Exclude driver from passenger count
                confidence=1.0, # Driver = 100% confidence
                last_updated=current_time,
                delay_minutes=delay,
                status=status,
                is_driver_bus=True
            )
            new_virtual_buses.append(v_bus)

        # B. Cluster remaining passengers
        for i, r1 in enumerate(passengers):
            if i in processed_passengers:
                continue
                
            cluster = [r1]
            processed_passengers.add(i)
            
            for j, r2 in enumerate(passengers):
                if j in processed_passengers:
                    continue
                
                dist = haversine_distance(r1.lat, r1.lng, r2.lat, r2.lng)
                if dist < 50: # 50 meters
                    cluster.append(r2)
                    processed_passengers.add(j)
            
            if len(cluster) >= 1: 
                avg_lat = sum(r.lat for r in cluster) / len(cluster)
                avg_lng = sum(r.lng for r in cluster) / len(cluster)
                
                confidence = 1.0 if len(cluster) >= 2 else 0.5
                
                # Calculate average delay from reports in cluster
                total_delay = 0
                delay_count = 0
                
                for r in cluster:
                    stop_id, delay = validate_user_and_calculate_delay(r)
                    if stop_id:
                        total_delay += delay
                        delay_count += 1
                        confidence = min(1.0, confidence + 0.3)
                
                avg_delay = total_delay / delay_count if delay_count > 0 else 0.0
                
                status = "On Time"
                if avg_delay > 5:
                    status = f"Late {int(avg_delay)} min"
                elif avg_delay < -2:
                    status = "Early"
                
                route_name = ROUTE_ID_TO_NAME_MAP.get(route_id, f"Route {route_id}")
                
                v_bus = VirtualBus(
                    id=f"vbus_{route_id}_{int(current_time)}_{i}",
                    route_id=route_id,
                    route_name=route_name,
                    lat=avg_lat,
                    lng=avg_lng,
                    passenger_count=len(cluster),
                    confidence=confidence,
                    last_updated=current_time,
                    delay_minutes=avg_delay,
                    status=status,
                    is_driver_bus=False
                )
                new_virtual_buses.append(v_bus)
                
    VIRTUAL_BUSES = new_virtual_buses


@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/api/data")
def get_data():
    return {"message": "Data from FastAPI backend"}

@app.get("/api/routes")
def get_routes():
    # Return list of available routes for the dropdown
    # Sort by route name
    routes = [{"id": k, "name": v} for k, v in ROUTE_ID_TO_NAME_MAP.items()]
    return sorted(routes, key=lambda x: x['name'])

@app.post("/api/broadcast-location")
def broadcast_location(report: UserReport):
    global USER_REPORTS
    
    # FILTER: Ignore high speed (e.g. > 100 km/h) - likely a car
    if report.speed > 100:
        return {"status": "ignored", "reason": "speed_too_high", "active_reports": len(USER_REPORTS)}

    # Add server timestamp if not provided or trust client? Trust client for now but validate
    report.timestamp = time.time()
    
    # Remove existing report from this user to prevent duplicates
    USER_REPORTS = [r for r in USER_REPORTS if r.user_id != report.user_id]
    
    USER_REPORTS.append(report)
    
    # Trigger clustering
    cluster_reports()
    
    return {"status": "success", "active_reports": len(USER_REPORTS)}

@app.get("/api/virtual-buses")
def get_virtual_buses():
    # Return buses. Optional: Filter by confidence
    return VIRTUAL_BUSES

@app.get("/api/shapes")
def get_shapes():
    try:
        if os.path.exists("route_shapes.json"):
            with open("route_shapes.json", "r") as f:
                return json.load(f)
        return {}
    except Exception as e:
        print(f"Error loading shapes: {e}")
        return {}

@app.get("/api/live-buses")
def get_buses():
    feed = gtfs_realtime_pb2.FeedMessage()
    try:
        response = requests.get(OTD_URL)
        response.raise_for_status()
        feed.ParseFromString(response.content)
        
        bus_list = []
        
        for entity in feed.entity:
            if entity.HasField('vehicle'):
                live_trip_id = entity.vehicle.trip.trip_id
                
                # Strategy 1: Direct Trip ID Lookup
                route_name = TRIP_TO_ROUTE_MAP.get(live_trip_id)
                
                # Strategy 2: Extract Route ID from Trip ID (e.g. "1879_0_6" -> "1879")
                if not route_name:
                    try:
                        # Assuming format is route_id_...
                        potential_route_id = live_trip_id.split('_')[0]
                        route_name = ROUTE_ID_TO_NAME_MAP.get(potential_route_id)
                        
                        # If still not found, use the ID itself as a fallback
                        if not route_name:
                             route_name = f"Route {potential_route_id}"
                    except:
                        pass
                
                if not route_name:
                    route_name = "Unknown Route"
                
                # If route_name is NaN (from pandas), replace it
                if pd.isna(route_name):
                    route_name = "Unknown Route"

                # DEBUG: Log unknown routes for RCA
                if route_name == "Unknown Route":
                     with open("unknown_routes.log", "a") as f:
                        f.write(f"Unmatched Live Trip ID: '{live_trip_id}'\n")

                bus_data = {
                    "id": entity.id,
                    "lat": entity.vehicle.position.latitude,
                    "lng": entity.vehicle.position.longitude,
                    "speed": round(entity.vehicle.position.speed * 3.6, 1), # Convert m/s to km/h
                    "trip_id": live_trip_id,
                    "route": str(route_name) # Ensure string
                }
                bus_list.append(bus_data)
                
        return bus_list
        
    except Exception as e:
        print(f"Error fetching data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
