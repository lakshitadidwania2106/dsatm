# OTP Data Directory

This directory contains the data files required for OpenTripPlanner.

## Files Present
- `delhi-bus.gtfs.zip`: Generated from the project's GTFS data.
- `router-config.json`: Configuration for real-time updates.

## Files Required (Action Needed)
You need to download the following files and place them in this directory:

1.  **OpenStreetMap Data (.pbf)**
    - Download the Delhi/India extract from Geofabrik.
    - URL: `https://download.geofabrik.de/asia/india.html` (Download `.osm.pbf`)
    - Rename it to `delhi.osm.pbf`.

2.  **Metro GTFS (Optional but recommended)**
    - Search for "Delhi Metro GTFS" or "DMRC GTFS".
    - Save it as `delhi-metro.gtfs.zip`.

## How to Run
1.  Open a terminal in the `otp` directory.
2.  Run `docker-compose up`.
3.  OTP will build the graph (this takes a few minutes) and start the server at `http://localhost:8080`.
