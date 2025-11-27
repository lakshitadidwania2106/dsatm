from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8000"
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data
TRANSIT_DATA_PATH = "../transit-data-export.json"
transit_data = {}

@app.on_event("startup")
async def load_data():
    global transit_data
    if os.path.exists(TRANSIT_DATA_PATH):
        with open(TRANSIT_DATA_PATH, "r", encoding="utf-8") as f:
            transit_data = json.load(f)
        print("Transit data loaded successfully")
    else:
        print(f"Warning: Transit data file not found at {TRANSIT_DATA_PATH}")

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/api/data")
def get_data():
    return {"message": "Data from FastAPI backend"}

@app.get("/api/stops")
def get_stops(city: str = "blr"):
    if not transit_data:
        raise HTTPException(status_code=503, detail="Data not loaded")
    
    try:
        stops = transit_data["cities"][city]["data"]["stops"]
        # Convert to list of objects for easier frontend consumption
        stops_list = []
        for stop_id, data in stops.items():
            stops_list.append({
                "id": stop_id,
                "lng": data[0],
                "lat": data[1],
                "name": data[2]
            })
        return stops_list
    except KeyError:
        raise HTTPException(status_code=404, detail=f"City {city} not found")

@app.get("/api/routes")
def get_routes(city: str = "blr"):
    if not transit_data:
        raise HTTPException(status_code=503, detail="Data not loaded")
    
    try:
        routes = transit_data["cities"][city]["data"]["routes"]
        print(f"Routes type: {type(routes)}")
        # Return simplified routes list
        routes_list = []
        for route_id, data in routes.items():
            try:
                routes_list.append({
                    "id": route_id,
                    "color": data.get("color", "#000000") if isinstance(data, dict) else "#000000"
                })
            except Exception as e:
                print(f"Error processing route {route_id}: {e}")
        return routes_list
    except KeyError:
        raise HTTPException(status_code=404, detail=f"City {city} not found")
    except Exception as e:
        print(f"Error in get_routes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/routes/{route_id}")
def get_route_details(route_id: str, city: str = "blr"):
    if not transit_data:
        raise HTTPException(status_code=503, detail="Data not loaded")
    
    try:
        route = transit_data["cities"][city]["data"]["routes"][route_id]
        # Return route data directly
        return route
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Route {route_id} not found")

@app.get("/api/stops/{stop_id}/timings")
def get_stop_timings(stop_id: str, city: str = "blr"):
    if not transit_data:
        raise HTTPException(status_code=503, detail="Data not loaded")
    
    try:
        timings = transit_data["cities"][city]["data"]["firstlast"].get(stop_id)
        if not timings:
            return []
        return timings
    except KeyError:
        raise HTTPException(status_code=404, detail=f"City {city} not found")
