from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.transit import gtfs_realtime_pb2
import requests

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

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/api/data")
def get_data():
    return {"message": "Data from FastAPI backend"}

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
                bus_data = {
                    "id": entity.id,
                    "lat": entity.vehicle.position.latitude,
                    "lng": entity.vehicle.position.longitude,
                    "speed": entity.vehicle.position.speed,
                    "trip_id": entity.vehicle.trip.trip_id
                }
                bus_list.append(bus_data)
                
        return bus_list
        
    except Exception as e:
        print(f"Error fetching data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
