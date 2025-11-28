from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from google.transit import gtfs_realtime_pb2
import requests
import pandas as pd
import os
import math
import time
import uuid
import json
from typing import Dict, List, Optional
from pydantic import BaseModel
from collections import defaultdict
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import blockchain service (optional)
try:
    from blockchain_service import blockchain_service
except ImportError:
    # Create a mock blockchain service if not available
    class MockBlockchainService:
        def log_ride_created(self, data): return None
        def log_booking_created(self, data): return None
        def log_booking_confirmed(self, bid, rid): return None
        def log_ride_completed(self, rid): return None
    blockchain_service = MockBlockchainService()

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
OTD_API_KEY = os.getenv("OTD_API_KEY", "Njl90zyCwKNqpVkuyF8K0ZNpwTkAbdX4")
OTD_URL = f"https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb?key={OTD_API_KEY}"
GTFS_FOLDER = os.getenv("GTFS_FOLDER", "../GTFS")

# Global variables for GTFS data
TRIP_TO_ROUTE_MAP = {}
ROUTE_ID_TO_NAME_MAP = {}
STOPS_DF = None
TRIP_STOPS = {}

# ========== VIRTUAL BUS DATA MODELS ==========
class UserReport(BaseModel):
    user_id: str
    route_id: str
    lat: float
    lng: float
    timestamp: float
    speed: float = 0.0
    last_stop_id: str = None
    last_stop_time: float = None
    role: str = "passenger"  # passenger or driver

class VirtualBus(BaseModel):
    id: str
    route_id: str
    route_name: str
    lat: float
    lng: float
    passenger_count: int
    confidence: float  # 0.0 to 1.0
    last_updated: float
    delay_minutes: float = 0.0
    status: str = "On Time"  # On Time, Late, Early
    is_driver_bus: bool = False

# In-memory stores for virtual buses
USER_REPORTS: List[UserReport] = []
VIRTUAL_BUSES: List[VirtualBus] = []

# ========== GTFS DATA LOADING ==========
def load_gtfs_data():
    global TRIP_TO_ROUTE_MAP, ROUTE_ID_TO_NAME_MAP, STOPS_DF, TRIP_STOPS
    try:
        print("Loading Static GTFS Data... this might take a few seconds.")
        
        # Load Final Merged Stops
        stops_csv_path = "../final_merged_with_stops.csv"
        if os.path.exists(stops_csv_path):
            print(f"Loading {stops_csv_path}...")
            STOPS_DF = pd.read_csv(stops_csv_path)
            STOPS_DF = STOPS_DF.sort_values(by=['trip_id', 'arrival_time'])
            
            grouped = STOPS_DF.groupby('trip_id')
            for trip_id, group in grouped:
                TRIP_STOPS[str(trip_id)] = group.to_dict('records')
                
            print(f"Loaded {len(TRIP_STOPS)} trips with stop sequences.")
        else:
            print(f"Warning: {stops_csv_path} not found. Enhanced features will be disabled.")

        if not os.path.exists(GTFS_FOLDER):
            print(f"Warning: GTFS folder not found at {GTFS_FOLDER}. Skipping static data load.")
            return

        # Load Routes
        routes_path = os.path.join(GTFS_FOLDER, 'routes.txt')
        trips_path = os.path.join(GTFS_FOLDER, 'trips.txt')

        if not os.path.exists(routes_path) or not os.path.exists(trips_path):
            print("Warning: routes.txt or trips.txt not found. Skipping static data load.")
            return

        if os.path.getsize(routes_path) < 200 or os.path.getsize(trips_path) < 200:
            print("Warning: GTFS files appear to be Git LFS pointers. Skipping static data load.")
            raise Exception("GTFS files are LFS pointers")

        routes_df = pd.read_csv(routes_path, usecols=['route_id', 'route_short_name', 'route_long_name'])
        routes_df['route_name'] = routes_df['route_short_name'].fillna(routes_df['route_long_name'])
        routes_df['route_id'] = routes_df['route_id'].astype(str)
        ROUTE_ID_TO_NAME_MAP = dict(zip(routes_df.route_id, routes_df.route_name))
        
        # Load Trips
        trips_df = pd.read_csv(trips_path, usecols=['trip_id', 'route_id'])
        trips_df['route_id'] = trips_df['route_id'].astype(str)
        trips_df['bus_number'] = trips_df['route_id'].map(ROUTE_ID_TO_NAME_MAP)
        TRIP_TO_ROUTE_MAP = dict(zip(trips_df.trip_id, trips_df.bus_number))
        
        print(f"Loaded {len(TRIP_TO_ROUTE_MAP)} trip mappings. Ready to serve!")
        
    except Exception as e:
        print(f"Error loading GTFS data: {e}")
        if STOPS_DF is not None and not ROUTE_ID_TO_NAME_MAP:
            print("Populating Route Map from Stops Data (Fallback)...")
            unique_routes = STOPS_DF['route_id'].unique()
            for rid in unique_routes:
                ROUTE_ID_TO_NAME_MAP[str(rid)] = f"Route {rid}"
            print(f"Fallback: Loaded {len(ROUTE_ID_TO_NAME_MAP)} routes.")

# Load GTFS data on startup
load_gtfs_data()

# ========== VIRTUAL BUS HELPER FUNCTIONS ==========
def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters"""
    R = 6371000  # Radius of Earth in meters
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
    """Convert HH:MM:SS to seconds"""
    try:
        h, m, s = map(int, time_str.split(':'))
        return h * 3600 + m * 60 + s
    except:
        return 0

def validate_user_and_calculate_delay(report: UserReport):
    """Validate user location and calculate delay"""
    if not TRIP_STOPS:
        return None, 0.0
        
    if STOPS_DF is None:
        return None, 0.0

    route_stops = STOPS_DF[STOPS_DF['route_id'].astype(str) == str(report.route_id)]
    
    if route_stops.empty:
        return None, 0.0
        
    min_dist = float('inf')
    nearest_stop = None
    
    for _, stop in route_stops.iterrows():
        dist = haversine_distance(report.lat, report.lng, stop['stop_lat'], stop['stop_lon'])
        if dist < min_dist:
            min_dist = dist
            nearest_stop = stop
            
    # Geofence Trap (50 meters)
    if min_dist <= 50:
        current_dt = datetime.fromtimestamp(report.timestamp)
        current_seconds = current_dt.hour * 3600 + current_dt.minute * 60 + current_dt.second
        
        scheduled_seconds = get_seconds_from_time(nearest_stop['arrival_time'])
        delay_seconds = current_seconds - scheduled_seconds
        delay_minutes = delay_seconds / 60.0
        
        return nearest_stop['stop_id'], delay_minutes
        
    return None, 0.0

def cluster_reports():
    """Cluster user reports into virtual buses"""
    global VIRTUAL_BUSES, USER_REPORTS
    current_time = time.time()
    
    # Cleanup old reports (> 5 minutes)
    USER_REPORTS = [r for r in USER_REPORTS if current_time - r.timestamp < 300]
    
    # Group by Route ID
    reports_by_route = {}
    for report in USER_REPORTS:
        if report.route_id not in reports_by_route:
            reports_by_route[report.route_id] = []
        reports_by_route[report.route_id].append(report)
        
    new_virtual_buses = []
    
    # Cluster within each route
    for route_id, reports in reports_by_route.items():
        # Separate drivers and passengers
        drivers = [r for r in reports if r.role == 'driver']
        passengers = [r for r in reports if r.role != 'driver']
        
        processed_passengers = set()
        
        # Create buses for Drivers (High Confidence)
        for i, driver in enumerate(drivers):
            cluster = [driver]
            for j, p in enumerate(passengers):
                if j in processed_passengers:
                    continue
                dist = haversine_distance(driver.lat, driver.lng, p.lat, p.lng)
                if dist < 100:  # 100m radius for driver
                    cluster.append(p)
                    processed_passengers.add(j)
            
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
                passenger_count=len(cluster) - 1,
                confidence=1.0,
                last_updated=current_time,
                delay_minutes=delay,
                status=status,
                is_driver_bus=True
            )
            new_virtual_buses.append(v_bus)

        # Cluster remaining passengers
        for i, r1 in enumerate(passengers):
            if i in processed_passengers:
                continue
                
            cluster = [r1]
            processed_passengers.add(i)
            
            for j, r2 in enumerate(passengers):
                if j in processed_passengers:
                    continue
                
                dist = haversine_distance(r1.lat, r1.lng, r2.lat, r2.lng)
                if dist < 50:  # 50 meters
                    cluster.append(r2)
                    processed_passengers.add(j)
            
            if len(cluster) >= 1: 
                avg_lat = sum(r.lat for r in cluster) / len(cluster)
                avg_lng = sum(r.lng for r in cluster) / len(cluster)
                
                confidence = 1.0 if len(cluster) >= 2 else 0.5
                
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

# ========== CARPOOL DATA MODELS ==========
class Ride(BaseModel):
    id: str
    user_id: str
    start_location: str
    start_lat: float
    start_lng: float
    end_location: str
    end_lat: float
    end_lng: float
    available_seats: int
    total_seats: int
    cost_per_person: float
    status: str = "active"
    is_tracking: bool = False
    created_at: float
    bus_id: Optional[str] = None
    bus_trip_id: Optional[str] = None
    bus_route: Optional[str] = None

class Booking(BaseModel):
    id: str
    ride_id: str
    passenger_id: str
    from_location: str
    from_lat: float
    from_lng: float
    to_location: str
    to_lat: float
    to_lng: float
    members: int
    cost: float
    status: str = "pending"
    created_at: float

class PassengerRequest(BaseModel):
    id: str
    user_id: str
    from_location: str
    from_lat: float
    from_lng: float
    to_location: str
    to_lat: float
    to_lng: float
    members: int
    bus_id: Optional[str] = None
    bus_trip_id: Optional[str] = None
    bus_route: Optional[str] = None
    status: str = "active"
    created_at: float

# In-memory stores for carpool
CARPOOL_RIDES: Dict[str, Ride] = {}
CARPOOL_BOOKINGS: Dict[str, Booking] = {}
PASSENGER_REQUESTS: Dict[str, PassengerRequest] = {}
BUS_PASSENGERS: Dict[str, List[str]] = defaultdict(list)  # bus_id -> [user_ids]
WEBSOCKET_CONNECTIONS: Dict[str, WebSocket] = {}  # user_id -> WebSocket

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/api/data")
def get_data():
    return {"message": "Data from FastAPI backend"}

@app.get("/api/routes")
def get_routes():
    """Return list of available routes"""
    routes = [{"id": k, "name": v} for k, v in ROUTE_ID_TO_NAME_MAP.items()]
    return sorted(routes, key=lambda x: x['name'])

@app.post("/api/broadcast-location")
def broadcast_location(report: UserReport):
    """Broadcast user location for virtual bus clustering"""
    global USER_REPORTS
    
    # Filter: Ignore high speed (e.g. > 100 km/h) - likely a car
    if report.speed > 100:
        return {"status": "ignored", "reason": "speed_too_high", "active_reports": len(USER_REPORTS)}

    # Add server timestamp if not provided
    report.timestamp = time.time()
    
    # Remove existing report from this user to prevent duplicates
    USER_REPORTS = [r for r in USER_REPORTS if r.user_id != report.user_id]
    
    USER_REPORTS.append(report)
    
    # Trigger clustering
    cluster_reports()
    
    return {"status": "success", "active_reports": len(USER_REPORTS)}

@app.get("/api/virtual-buses")
def get_virtual_buses():
    """Return virtual buses created from user reports"""
    return VIRTUAL_BUSES

@app.get("/api/shapes")
def get_shapes():
    """Return route shapes"""
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
    """Get live buses from OTD API with route name mapping"""
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
                
                # Strategy 2: Extract Route ID from Trip ID
                if not route_name:
                    try:
                        parts = live_trip_id.split('_')
                        if len(parts) > 0:
                            potential_route_id = parts[0]
                            route_name = ROUTE_ID_TO_NAME_MAP.get(potential_route_id)
                            
                            if not route_name:
                                for part in parts:
                                    if part in ROUTE_ID_TO_NAME_MAP:
                                        route_name = ROUTE_ID_TO_NAME_MAP[part]
                                        break
                            
                            if not route_name and potential_route_id:
                                route_name = f"Route {potential_route_id}"
                    except Exception as e:
                        print(f"Error parsing trip ID '{live_trip_id}': {e}")
                
                if not route_name:
                    route_name = "Unknown Route"
                
                if pd.isna(route_name):
                    route_name = "Unknown Route"

                if route_name == "Unknown Route":
                    try:
                        with open("unknown_routes.log", "a") as f:
                            f.write(f"{datetime.now().isoformat()} - Unmatched Live Trip ID: '{live_trip_id}'\n")
                    except:
                        pass

                bus_data = {
                    "id": entity.id,
                    "lat": entity.vehicle.position.latitude,
                    "lng": entity.vehicle.position.longitude,
                    "speed": round(entity.vehicle.position.speed * 3.6, 1) if entity.vehicle.position.speed else 0,
                    "trip_id": live_trip_id,
                    "route": str(route_name),
                    "displayName": str(route_name)
                }
                bus_list.append(bus_data)
                
        return bus_list
        
    except Exception as e:
        print(f"Error fetching data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========== CARPOOL HELPER FUNCTIONS ==========
def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in km using Haversine formula"""
    R = 6371  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def distance_to_line_segment(point_lat: float, point_lng: float, 
                            line_start_lat: float, line_start_lng: float,
                            line_end_lat: float, line_end_lng: float) -> float:
    """Calculate distance from point to line segment"""
    dist_to_start = calculate_distance(point_lat, point_lng, line_start_lat, line_start_lng)
    dist_to_end = calculate_distance(point_lat, point_lng, line_end_lat, line_end_lng)
    mid_lat = (line_start_lat + line_end_lat) / 2
    mid_lng = (line_start_lng + line_end_lng) / 2
    dist_to_mid = calculate_distance(point_lat, point_lng, mid_lat, mid_lng)
    return min(dist_to_start, dist_to_end, dist_to_mid)

def find_matching_buses(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> List[Dict]:
    """Find buses near the route from live bus data"""
    try:
        feed = gtfs_realtime_pb2.FeedMessage()
        response = requests.get(OTD_URL)
        response.raise_for_status()
        feed.ParseFromString(response.content)
        
        matching_buses = []
        
        for entity in feed.entity:
            if entity.HasField('vehicle'):
                bus_lat = entity.vehicle.position.latitude
                bus_lng = entity.vehicle.position.longitude
                
                dist = distance_to_line_segment(bus_lat, bus_lng, start_lat, start_lng, end_lat, end_lng)
                dist_to_start = calculate_distance(bus_lat, bus_lng, start_lat, start_lng)
                dist_to_end = calculate_distance(bus_lat, bus_lng, end_lat, end_lng)
                
                # Include buses within 2km of route or 1km of endpoints
                if dist < 2 or dist_to_start < 1 or dist_to_end < 1:
                    matching_buses.append({
                        'id': entity.id,
                        'lat': bus_lat,
                        'lng': bus_lng,
                        'speed': round(entity.vehicle.position.speed * 3.6, 1) if entity.vehicle.position.speed else 0,
                        'trip_id': entity.vehicle.trip.trip_id,
                        'route': entity.vehicle.trip.route_id if entity.vehicle.trip.route_id else 'Unknown',
                        'distance_from_route': round(dist, 2)
                    })
        
        # Sort by distance
        matching_buses.sort(key=lambda x: x['distance_from_route'])
        return matching_buses[:20]  # Return top 20
    except Exception as e:
        print(f"Error finding matching buses: {e}")
        return []

def calculate_route_coverage(ride_start_lat: float, ride_start_lng: float, ride_end_lat: float, ride_end_lng: float,
                             booking_start_lat: float, booking_start_lng: float, booking_end_lat: float, booking_end_lng: float) -> float:
    """Calculate how much of the booking route is covered by the ride route"""
    dist_start = distance_to_line_segment(booking_start_lat, booking_start_lng,
                                          ride_start_lat, ride_start_lng, ride_end_lat, ride_end_lng)
    dist_end = distance_to_line_segment(booking_end_lat, booking_end_lng,
                                        ride_start_lat, ride_start_lng, ride_end_lat, ride_end_lng)
    
    if dist_start < 2 and dist_end < 2:
        total_route_dist = calculate_distance(ride_start_lat, ride_start_lng, ride_end_lat, ride_end_lng)
        booking_dist = calculate_distance(booking_start_lat, booking_start_lng, booking_end_lat, booking_end_lng)
        if total_route_dist > 0:
            coverage = min(100, (booking_dist / total_route_dist) * 100)
            return coverage
    return 0

def find_users_on_same_bus(bus_id: Optional[str], bus_trip_id: Optional[str], bus_route: Optional[str], exclude_user_id: Optional[str] = None) -> List[Dict]:
    """Find all users (rides/requests) on the same bus"""
    same_bus_users = []
    
    # Check rides
    for ride in CARPOOL_RIDES.values():
        if ride.status != "active":
            continue
        if exclude_user_id and ride.user_id == exclude_user_id:
            continue
        if (ride.bus_id == bus_id or 
            ride.bus_trip_id == bus_trip_id or 
            ride.bus_route == bus_route):
            same_bus_users.append({
                'type': 'ride',
                'id': ride.id,
                'user_id': ride.user_id,
                'start_location': ride.start_location,
                'end_location': ride.end_location,
                'available_seats': ride.available_seats,
                'cost_per_person': ride.cost_per_person
            })
    
    # Check passenger requests
    for req in PASSENGER_REQUESTS.values():
        if req.status != "active":
            continue
        if exclude_user_id and req.user_id == exclude_user_id:
            continue
        if (req.bus_id == bus_id or 
            req.bus_trip_id == bus_trip_id or 
            req.bus_route == bus_route):
            same_bus_users.append({
                'type': 'request',
                'id': req.id,
                'user_id': req.user_id,
                'from_location': req.from_location,
                'to_location': req.to_location,
                'members': req.members
            })
    
    return same_bus_users

async def broadcast_to_user(user_id: str, message_type: str, data: Dict):
    """Send WebSocket message to a user"""
    if user_id in WEBSOCKET_CONNECTIONS:
        try:
            ws = WEBSOCKET_CONNECTIONS[user_id]
            await ws.send_json({
                'type': message_type,
                'data': data
            })
        except Exception as e:
            print(f"Error sending WebSocket message to {user_id}: {e}")

# ========== CARPOOL API ENDPOINTS ==========
@app.post("/api/carpool/rides")
async def create_ride(ride_data: dict):
    """Create a new ride offer"""
    try:
        ride_id = str(uuid.uuid4())
        user_id = ride_data.get('user_id', f'user-{int(time.time())}')
        
        # Find nearby buses
        matching_buses = find_matching_buses(
            ride_data['start_lat'], ride_data['start_lng'],
            ride_data['end_lat'], ride_data['end_lng']
        )
        
        bus_match = matching_buses[0] if matching_buses else None
        
        ride = Ride(
            id=ride_id,
            user_id=user_id,
            start_location=ride_data['start_location'],
            start_lat=ride_data['start_lat'],
            start_lng=ride_data['start_lng'],
            end_location=ride_data['end_location'],
            end_lat=ride_data['end_lat'],
            end_lng=ride_data['end_lng'],
            available_seats=ride_data['available_seats'],
            total_seats=ride_data['total_seats'],
            cost_per_person=ride_data['cost_per_person'],
            created_at=time.time(),
            bus_id=bus_match['id'] if bus_match else None,
            bus_trip_id=bus_match.get('trip_id') if bus_match else None,
            bus_route=bus_match.get('route') if bus_match else None
        )
        
        CARPOOL_RIDES[ride_id] = ride
        
        # Log to blockchain
        blockchain_service.log_ride_created(ride.dict())
        
        # Add to bus passengers if matched
        if bus_match:
            bus_key = bus_match.get('trip_id') or bus_match['id']
            if user_id not in BUS_PASSENGERS[bus_key]:
                BUS_PASSENGERS[bus_key].append(user_id)
            
            # Notify users on same bus
            same_bus_users = find_users_on_same_bus(
                bus_match['id'], bus_match.get('trip_id'), bus_match.get('route'), user_id
            )
            for user in same_bus_users:
                await broadcast_to_user(user['user_id'], 'new_ride_available', ride.dict())
        
        return {
            "success": True,
            "ride": ride.dict(),
            "matched_bus": bus_match,
            "nearby_buses": matching_buses[:5]  # Return top 5 nearby buses
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/carpool/rides/{ride_id}")
async def get_ride(ride_id: str):
    """Get ride details"""
    if ride_id not in CARPOOL_RIDES:
        raise HTTPException(status_code=404, detail="Ride not found")
    return CARPOOL_RIDES[ride_id].dict()

@app.post("/api/carpool/rides/{ride_id}/start-tracking")
async def start_tracking(ride_id: str):
    """Start GPS tracking for a ride"""
    if ride_id not in CARPOOL_RIDES:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    ride = CARPOOL_RIDES[ride_id]
    ride.is_tracking = True
    
    return {"success": True, "ride": ride.dict()}

@app.post("/api/carpool/rides/{ride_id}/stop-tracking")
async def stop_tracking(ride_id: str):
    """Stop GPS tracking for a ride"""
    if ride_id not in CARPOOL_RIDES:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    ride = CARPOOL_RIDES[ride_id]
    ride.is_tracking = False
    
    return {"success": True, "ride": ride.dict()}

@app.post("/api/carpool/rides/{ride_id}/location")
async def update_location(ride_id: str, location_data: dict):
    """Update driver location"""
    if ride_id not in CARPOOL_RIDES:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    ride = CARPOOL_RIDES[ride_id]
    
    # Broadcast location update to passengers
    for booking in CARPOOL_BOOKINGS.values():
        if booking.ride_id == ride_id and booking.status == "confirmed":
            await broadcast_to_user(booking.passenger_id, 'location_update', {
                'ride_id': ride_id,
                'lat': location_data['lat'],
                'lng': location_data['lng'],
                'speed': location_data.get('speed', 0),
                'heading': location_data.get('heading', 0)
            })
    
    return {"success": True}

@app.post("/api/carpool/search")
async def search_rides(search_data: dict):
    """Search for available rides"""
    try:
        matching_rides = []
        
        for ride in CARPOOL_RIDES.values():
            if ride.status != "active" or ride.available_seats < search_data.get('members', 1):
                continue
            
            coverage = calculate_route_coverage(
                ride.start_lat, ride.start_lng, ride.end_lat, ride.end_lng,
                search_data['from_lat'], search_data['from_lng'],
                search_data['to_lat'], search_data['to_lng']
            )
            
            if coverage > 50:  # At least 50% route coverage
                matching_rides.append({
                    'id': ride.id,
                    'driver': f'Driver-{ride.user_id[-6:]}',
                    'rating': 5.0,
                    'routeStart': ride.start_location,
                    'routeEnd': ride.end_location,
                    'routeCoverage': round(coverage),
                    'seats': ride.available_seats,
                    'cost': f'₹{ride.cost_per_person}',
                    'eta': 'Calculating...',
                    'bus_route': ride.bus_route,
                    'bus_id': ride.bus_id
                })
        
        return {"rides": matching_rides}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/carpool/search-by-bus")
async def search_by_bus(bus_data: dict):
    """Search for rides/requests on a specific bus"""
    bus_id = bus_data.get('bus_id')
    bus_trip_id = bus_data.get('bus_trip_id')
    bus_route = bus_data.get('bus_route')
    user_id = bus_data.get('user_id')
    
    same_bus_users = find_users_on_same_bus(bus_id, bus_trip_id, bus_route, user_id)
    
    return {
        "success": True,
        "users_on_bus": same_bus_users,
        "bus_id": bus_id,
        "bus_trip_id": bus_trip_id,
        "bus_route": bus_route
    }

@app.get("/api/carpool/buses/{bus_id}/passengers")
async def get_bus_passengers(bus_id: str):
    """Get all passengers on a specific bus"""
    passengers = BUS_PASSENGERS.get(bus_id, [])
    return {"bus_id": bus_id, "passengers": passengers}

@app.post("/api/carpool/bookings")
async def create_booking(booking_data: dict):
    """Create a booking request"""
    try:
        booking_id = str(uuid.uuid4())
        ride_id = booking_data['ride_id']
        
        if ride_id not in CARPOOL_RIDES:
            raise HTTPException(status_code=404, detail="Ride not found")
        
        ride = CARPOOL_RIDES[ride_id]
        passenger_id = booking_data.get('passenger_id', f'user-{int(time.time())}')
        
        # Calculate cost
        members = booking_data.get('members', 1)
        cost = ride.cost_per_person * members
        
        booking = Booking(
            id=booking_id,
            ride_id=ride_id,
            passenger_id=passenger_id,
            from_location=booking_data['from_location'],
            from_lat=booking_data['from_lat'],
            from_lng=booking_data['from_lng'],
            to_location=booking_data['to_location'],
            to_lat=booking_data['to_lat'],
            to_lng=booking_data['to_lng'],
            members=members,
            cost=cost,
            created_at=time.time()
        )
        
        CARPOOL_BOOKINGS[booking_id] = booking
        
        # Log to blockchain
        blockchain_service.log_booking_created(booking.dict())
        
        # Notify driver via WebSocket
        await broadcast_to_user(ride.user_id, 'new_booking_request', booking.dict())
        
        return {
            "success": True,
            "booking": booking.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/carpool/bookings/{booking_id}/confirm")
async def confirm_booking(booking_id: str):
    """Driver confirms a booking"""
    if booking_id not in CARPOOL_BOOKINGS:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = CARPOOL_BOOKINGS[booking_id]
    booking.status = "confirmed"
    
    # Log to blockchain
    blockchain_service.log_booking_confirmed(booking_id, booking.ride_id)
    
    # Update ride available seats
    if booking.ride_id in CARPOOL_RIDES:
        ride = CARPOOL_RIDES[booking.ride_id]
        ride.available_seats -= booking.members
    
    # Notify passenger via WebSocket
    await broadcast_to_user(booking.passenger_id, 'booking_confirmed', booking.dict())
    
    return {"success": True, "booking": booking.dict()}

@app.get("/api/carpool/bookings/current")
async def get_current_bookings():
    """Get current bookings for the user"""
    active_bookings = [
        b.dict() for b in CARPOOL_BOOKINGS.values()
        if b.status in ['pending', 'confirmed', 'in_progress']
    ]
    
    # Add ride details
    for booking in active_bookings:
        if booking['ride_id'] in CARPOOL_RIDES:
            ride = CARPOOL_RIDES[booking['ride_id']]
            booking['rides'] = {
                'id': ride.id,
                'users': {'name': f'Driver-{ride.user_id[-6:]}', 'rating': 5.0}
            }
    
    return {"bookings": active_bookings}

@app.get("/api/carpool/bookings/history")
async def get_booking_history():
    """Get booking history"""
    completed_bookings = [
        b.dict() for b in CARPOOL_BOOKINGS.values()
        if b.status == 'completed'
    ]
    return {"history": completed_bookings}

@app.get("/api/carpool/rides/{ride_id}/requests")
async def get_passenger_requests(ride_id: str):
    """Get passenger requests for a ride"""
    if ride_id not in CARPOOL_RIDES:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    requests = [
        b.dict() for b in CARPOOL_BOOKINGS.values()
        if b.ride_id == ride_id and b.status == 'pending'
    ]
    
    # Format for frontend
    formatted_requests = []
    for req in requests:
        formatted_requests.append({
            'id': req['id'],
            'name': f'Passenger-{req["passenger_id"][-6:]}',
            'members': req['members'],
            'from': req['from_location'],
            'to': req['to_location'],
            'proximity': 'Near route',
            'deviation': 'Minimal'
        })
    
    return {"requests": formatted_requests}

@app.post("/api/carpool/passenger-requests")
async def create_passenger_request(request_data: dict):
    """Create a passenger request (for same-bus matching)"""
    try:
        request_id = str(uuid.uuid4())
        user_id = request_data.get('user_id', f'user-{int(time.time())}')
        
        # Find nearby buses
        matching_buses = find_matching_buses(
            request_data['from_lat'], request_data['from_lng'],
            request_data['to_lat'], request_data['to_lng']
        )
        
        bus_match = matching_buses[0] if matching_buses else None
        
        request = PassengerRequest(
            id=request_id,
            user_id=user_id,
            from_location=request_data['from_location'],
            from_lat=request_data['from_lat'],
            from_lng=request_data['from_lng'],
            to_location=request_data['to_location'],
            to_lat=request_data['to_lat'],
            to_lng=request_data['to_lng'],
            members=request_data.get('members', 1),
            bus_id=bus_match['id'] if bus_match else None,
            bus_trip_id=bus_match.get('trip_id') if bus_match else None,
            bus_route=bus_match.get('route') if bus_match else None,
            created_at=time.time()
        )
        
        PASSENGER_REQUESTS[request_id] = request
        
        # Add to bus passengers if matched
        same_bus_users = []
        if bus_match:
            bus_key = bus_match.get('trip_id') or bus_match['id']
            if user_id not in BUS_PASSENGERS[bus_key]:
                BUS_PASSENGERS[bus_key].append(user_id)
            
            # Notify users on same bus
            same_bus_users = find_users_on_same_bus(
                bus_match['id'], bus_match.get('trip_id'), bus_match.get('route'), user_id
            )
            for user in same_bus_users:
                await broadcast_to_user(user['user_id'], 'passenger_joined_bus', request.dict())
        
        return {
            "success": True,
            "request": request.dict(),
            "matched_bus": bus_match,
            "same_bus_users": same_bus_users,
            "nearby_buses": matching_buses[:5]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== WEBSOCKET ENDPOINT ==========
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    WEBSOCKET_CONNECTIONS[user_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get('type') == 'subscribe_ride':
                ride_id = message.get('ride_id')
                # Subscribe logic can be added here
                
    except WebSocketDisconnect:
        pass
    finally:
        if user_id in WEBSOCKET_CONNECTIONS:
            del WEBSOCKET_CONNECTIONS[user_id]
