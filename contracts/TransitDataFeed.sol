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
}

