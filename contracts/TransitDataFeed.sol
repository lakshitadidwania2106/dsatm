// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TransitDataFeed
 * @dev A smart contract for recording and logging transit events
 * such as delays, crowd reports, and accessibility issues for Delhi transit system.
 * This contract provides transparency and immutability for transit data.
 */
contract TransitDataFeed {
    // Defines the structure for a single transit report
    struct TransitReport {
        uint256 timestamp;          // The time the report was submitted
        address reporter;           // The wallet address that submitted the report
        string reportType;          // e.g., "Delay", "Crowd", "Accessibility", "Route Change"
        string locationDetails;     // e.g., "Bus 304A near Majestic", "KR Market Metro"
        uint256 severity;           // Severity level (1=Low, 5=High)
        string description;         // Additional details about the report
    }

    // Array to store all submitted reports
    TransitReport[] public reports;

    // Mapping to track reports by location
    mapping(string => uint256[]) public reportsByLocation;

    // Event emitted when a new report is submitted
    event ReportSubmitted(
        uint256 indexed reportId,
        address indexed reporter,
        string reportType,
        string locationDetails,
        uint256 severity
    );

    /**
     * @dev Allows any user to submit a new transit report.
     * @param _reportType The category of the report (e.g., "Delay", "Crowd", "Accessibility").
     * @param _locationDetails Specific location or route information.
     * @param _severity The urgency/impact of the issue (1 to 5).
     * @param _description Additional details about the report.
     */
    function submitReport(
        string memory _reportType,
        string memory _locationDetails,
        uint256 _severity,
        string memory _description
    ) public {
        // Ensure severity is within a valid range
        require(_severity >= 1 && _severity <= 5, "Severity must be between 1 and 5.");

        uint256 reportId = reports.length;
        
        reports.push(TransitReport(
            block.timestamp,
            msg.sender,
            _reportType,
            _locationDetails,
            _severity,
            _description
        ));

        // Index by location for easier querying
        reportsByLocation[_locationDetails].push(reportId);

        emit ReportSubmitted(
            reportId,
            msg.sender,
            _reportType,
            _locationDetails,
            _severity
        );
    }

    /**
     * @dev Returns the total number of reports submitted.
     * @return The count of reports.
     */
    function getReportCount() public view returns (uint256) {
        return reports.length;
    }

    /**
     * @dev Retrieves a specific report by its index.
     * @param _index The index of the report in the array.
     * @return The report details.
     */
    function getReport(uint256 _index) public view returns (
        uint256 timestamp,
        address reporter,
        string memory reportType,
        string memory locationDetails,
        uint256 severity,
        string memory description
    ) {
        require(_index < reports.length, "Index out of bounds.");
        TransitReport storage report = reports[_index];
        return (
            report.timestamp,
            report.reporter,
            report.reportType,
            report.locationDetails,
            report.severity,
            report.description
        );
    }

    /**
     * @dev Gets the latest N reports.
     * @param _count Number of recent reports to retrieve.
     * @return An array of report indices (most recent first).
     */
    function getRecentReports(uint256 _count) public view returns (uint256[] memory) {
        uint256 totalReports = reports.length;
        uint256 count = _count > totalReports ? totalReports : _count;
        uint256[] memory indices = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            indices[i] = totalReports - 1 - i;
        }
        
        return indices;
    }

    // ========== CARPOOL EXTENSIONS ==========
    
    // Carpool Ride Structure
    struct CarpoolRide {
        uint256 timestamp;
        address driver;
        string rideId;
        string startLocation;
        string endLocation;
        uint256 availableSeats;
        uint256 costPerPerson;
        string busRoute;
        string busTripId;
        bool isActive;
    }

    // Carpool Booking Structure
    struct CarpoolBooking {
        uint256 timestamp;
        address passenger;
        string bookingId;
        string rideId;
        string fromLocation;
        string toLocation;
        uint256 members;
        uint256 totalCost;
        string status; // "pending", "confirmed", "completed", "cancelled"
    }

    // Arrays to store carpool data
    CarpoolRide[] public carpoolRides;
    CarpoolBooking[] public carpoolBookings;

    // Mappings for quick lookups
    mapping(string => uint256) public rideIdToIndex;
    mapping(string => uint256) public bookingIdToIndex;
    mapping(address => uint256[]) public ridesByDriver;
    mapping(string => uint256[]) public ridesByBusRoute;

    // Carpool Events
    event CarpoolRideCreated(
        uint256 indexed rideIndex,
        address indexed driver,
        string rideId,
        string startLocation,
        string endLocation,
        uint256 availableSeats,
        string busRoute
    );

    event CarpoolBookingCreated(
        uint256 indexed bookingIndex,
        address indexed passenger,
        string bookingId,
        string rideId,
        string status
    );

    event CarpoolBookingConfirmed(
        uint256 indexed bookingIndex,
        string bookingId,
        string rideId
    );

    event CarpoolRideCompleted(
        uint256 indexed rideIndex,
        string rideId,
        uint256 totalPassengers
    );

    /**
     * @dev Create a new carpool ride
     */
    function createCarpoolRide(
        string memory _rideId,
        string memory _startLocation,
        string memory _endLocation,
        uint256 _availableSeats,
        uint256 _costPerPerson,
        string memory _busRoute,
        string memory _busTripId
    ) public {
        uint256 rideIndex = carpoolRides.length;
        
        carpoolRides.push(CarpoolRide(
            block.timestamp,
            msg.sender,
            _rideId,
            _startLocation,
            _endLocation,
            _availableSeats,
            _costPerPerson,
            _busRoute,
            _busTripId,
            true
        ));

        rideIdToIndex[_rideId] = rideIndex;
        ridesByDriver[msg.sender].push(rideIndex);
        ridesByBusRoute[_busRoute].push(rideIndex);

        emit CarpoolRideCreated(
            rideIndex,
            msg.sender,
            _rideId,
            _startLocation,
            _endLocation,
            _availableSeats,
            _busRoute
        );
    }

    /**
     * @dev Create a booking request
     */
    function createCarpoolBooking(
        string memory _bookingId,
        string memory _rideId,
        string memory _fromLocation,
        string memory _toLocation,
        uint256 _members
    ) public {
        require(rideIdToIndex[_rideId] > 0 || carpoolRides.length > 0, "Ride not found");
        
        uint256 rideIndex = rideIdToIndex[_rideId];
        CarpoolRide storage ride = carpoolRides[rideIndex];
        require(ride.isActive, "Ride is not active");
        require(ride.availableSeats >= _members, "Not enough seats available");

        uint256 totalCost = ride.costPerPerson * _members;
        
        uint256 bookingIndex = carpoolBookings.length;
        
        carpoolBookings.push(CarpoolBooking(
            block.timestamp,
            msg.sender,
            _bookingId,
            _rideId,
            _fromLocation,
            _toLocation,
            _members,
            totalCost,
            "pending"
        ));

        bookingIdToIndex[_bookingId] = bookingIndex;

        emit CarpoolBookingCreated(
            bookingIndex,
            msg.sender,
            _bookingId,
            _rideId,
            "pending"
        );
    }

    /**
     * @dev Confirm a booking (only ride driver can call this)
     */
    function confirmCarpoolBooking(
        string memory _bookingId,
        string memory _rideId
    ) public {
        require(bookingIdToIndex[_bookingId] > 0 || carpoolBookings.length > 0, "Booking not found");
        require(rideIdToIndex[_rideId] > 0 || carpoolRides.length > 0, "Ride not found");
        
        uint256 bookingIndex = bookingIdToIndex[_bookingId];
        uint256 rideIndex = rideIdToIndex[_rideId];
        
        CarpoolBooking storage booking = carpoolBookings[bookingIndex];
        CarpoolRide storage ride = carpoolRides[rideIndex];
        
        require(ride.driver == msg.sender, "Only driver can confirm booking");
        require(keccak256(bytes(booking.rideId)) == keccak256(bytes(_rideId)), "Booking does not match ride");
        require(keccak256(bytes(booking.status)) == keccak256(bytes("pending")), "Booking is not pending");
        
        booking.status = "confirmed";
        ride.availableSeats -= booking.members;

        emit CarpoolBookingConfirmed(bookingIndex, _bookingId, _rideId);
    }

    /**
     * @dev Mark a ride as completed
     */
    function completeCarpoolRide(string memory _rideId) public {
        require(rideIdToIndex[_rideId] > 0 || carpoolRides.length > 0, "Ride not found");
        
        uint256 rideIndex = rideIdToIndex[_rideId];
        CarpoolRide storage ride = carpoolRides[rideIndex];
        
        require(ride.driver == msg.sender, "Only driver can complete ride");
        require(ride.isActive, "Ride is not active");
        
        ride.isActive = false;
        
        // Count total passengers from confirmed bookings
        uint256 totalPassengers = 0;
        for (uint256 i = 0; i < carpoolBookings.length; i++) {
            if (keccak256(bytes(carpoolBookings[i].rideId)) == keccak256(bytes(_rideId)) &&
                keccak256(bytes(carpoolBookings[i].status)) == keccak256(bytes("confirmed"))) {
                totalPassengers += carpoolBookings[i].members;
            }
        }

        emit CarpoolRideCompleted(rideIndex, _rideId, totalPassengers);
    }

    /**
     * @dev Get carpool ride count
     */
    function getCarpoolRideCount() public view returns (uint256) {
        return carpoolRides.length;
    }

    /**
     * @dev Get carpool booking count
     */
    function getCarpoolBookingCount() public view returns (uint256) {
        return carpoolBookings.length;
    }

    /**
     * @dev Get rides by bus route
     */
    function getCarpoolRidesByBusRoute(string memory _busRoute) public view returns (uint256[] memory) {
        return ridesByBusRoute[_busRoute];
    }
}

