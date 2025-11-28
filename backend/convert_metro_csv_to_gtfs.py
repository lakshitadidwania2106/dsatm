import pandas as pd
import os
import zipfile
from datetime import datetime, timedelta

def create_gtfs_from_csv(csv_path, output_zip):
    df = pd.read_csv(csv_path)
    
    # Clean column names
    df.columns = [c.strip() for c in df.columns]
    
    # 1. agency.txt
    agency = pd.DataFrame({
        'agency_id': ['DMRC'],
        'agency_name': ['Delhi Metro Rail Corporation'],
        'agency_url': ['http://www.delhimetrorail.com/'],
        'agency_timezone': ['Asia/Kolkata']
    })
    
    # 2. stops.txt
    # Create unique stop_id: Line + ID
    df['stop_id'] = df['Metro Line'].str.replace(' ', '_') + '_' + df['ID (Station ID)'].astype(str)
    
    stops = df[['stop_id', 'Station Names', 'Latitude', 'Longitude']].copy()
    stops.columns = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon']
    stops = stops.drop_duplicates(subset=['stop_id'])
    
    # 3. routes.txt
    routes_list = df['Metro Line'].unique()
    routes = pd.DataFrame({
        'route_id': [r.replace(' ', '_') for r in routes_list],
        'agency_id': 'DMRC',
        'route_short_name': [r.split(' ')[0] for r in routes_list],
        'route_long_name': routes_list,
        'route_type': 1 # Subway/Metro
    })
    
    # 4. calendar.txt
    calendar = pd.DataFrame({
        'service_id': ['daily'],
        'monday': [1], 'tuesday': [1], 'wednesday': [1], 'thursday': [1], 'friday': [1], 'saturday': [1], 'sunday': [1],
        'start_date': ['20230101'],
        'end_date': ['20251231']
    })
    
    # 5. trips.txt & 6. stop_times.txt & 7. frequencies.txt
    trips = []
    stop_times = []
    frequencies = []
    
    AVG_SPEED_KMPH = 35
    AVG_SPEED_MPM = AVG_SPEED_KMPH / 60.0 # km per minute
    
    for route_name in routes_list:
        route_id = route_name.replace(' ', '_')
        route_data = df[df['Metro Line'] == route_name].sort_values('Dist. From First Station(km)')
        
        # Forward Trip (Direction 0)
        trip_id_fwd = f"{route_id}_FWD"
        trips.append({
            'route_id': route_id,
            'service_id': 'daily',
            'trip_id': trip_id_fwd,
            'trip_headsign': route_data.iloc[-1]['Station Names'],
            'direction_id': 0
        })
        
        # Frequencies (06:00 to 23:00, every 5 mins)
        frequencies.append({
            'trip_id': trip_id_fwd,
            'start_time': '06:00:00',
            'end_time': '23:00:00',
            'headway_secs': 300
        })
        
        # Stop Times FWD
        start_time_min = 6 * 60 # 6:00 AM
        for i, row in route_data.iterrows():
            dist = row['Dist. From First Station(km)']
            travel_time_min = dist / AVG_SPEED_MPM
            arrival_min = start_time_min + travel_time_min
            
            # Format HH:MM:SS
            h = int(arrival_min // 60)
            m = int(arrival_min % 60)
            s = int((arrival_min * 60) % 60)
            time_str = f"{h:02d}:{m:02d}:{s:02d}"
            
            stop_times.append({
                'trip_id': trip_id_fwd,
                'arrival_time': time_str,
                'departure_time': time_str,
                'stop_id': row['stop_id'],
                'stop_sequence': i + 1
            })
            
        # Backward Trip (Direction 1)
        trip_id_bwd = f"{route_id}_BWD"
        trips.append({
            'route_id': route_id,
            'service_id': 'daily',
            'trip_id': trip_id_bwd,
            'trip_headsign': route_data.iloc[0]['Station Names'],
            'direction_id': 1
        })
        
        frequencies.append({
            'trip_id': trip_id_bwd,
            'start_time': '06:00:00',
            'end_time': '23:00:00',
            'headway_secs': 300
        })
        
        # Stop Times BWD (Reverse order)
        route_data_rev = route_data.iloc[::-1].reset_index(drop=True)
        total_dist = route_data.iloc[-1]['Dist. From First Station(km)']
        
        for i, row in route_data_rev.iterrows():
            # Distance from end
            dist_from_start = row['Dist. From First Station(km)']
            dist_traveled = total_dist - dist_from_start
            
            travel_time_min = dist_traveled / AVG_SPEED_MPM
            arrival_min = start_time_min + travel_time_min
            
            h = int(arrival_min // 60)
            m = int(arrival_min % 60)
            s = int((arrival_min * 60) % 60)
            time_str = f"{h:02d}:{m:02d}:{s:02d}"
            
            stop_times.append({
                'trip_id': trip_id_bwd,
                'arrival_time': time_str,
                'departure_time': time_str,
                'stop_id': row['stop_id'],
                'stop_sequence': i + 1
            })

    trips_df = pd.DataFrame(trips)
    stop_times_df = pd.DataFrame(stop_times)
    frequencies_df = pd.DataFrame(frequencies)
    
    # Write to ZIP
    with zipfile.ZipFile(output_zip, 'w') as zf:
        zf.writestr('agency.txt', agency.to_csv(index=False))
        zf.writestr('stops.txt', stops.to_csv(index=False))
        zf.writestr('routes.txt', routes.to_csv(index=False))
        zf.writestr('calendar.txt', calendar.to_csv(index=False))
        zf.writestr('trips.txt', trips_df.to_csv(index=False))
        zf.writestr('stop_times.txt', stop_times_df.to_csv(index=False))
        zf.writestr('frequencies.txt', frequencies_df.to_csv(index=False))
        
    print(f"Created {output_zip}")

if __name__ == "__main__":
    create_gtfs_from_csv("../Delhi metro.csv", "../otp/data/delhi-metro.gtfs.zip")
