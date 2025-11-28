import React, { useState, useEffect, useRef } from 'react';
import { Radio, Bus, X, Loader2 } from 'lucide-react';
import { fetchRoutes, broadcastLocation } from '../api/busService';

const BroadcastButton = () => {
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [routes, setRoutes] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [loadingRoutes, setLoadingRoutes] = useState(false);
    const [activeReports, setActiveReports] = useState(0);

    const watchIdRef = useRef(null);

    // Load routes when modal opens
    useEffect(() => {
        if (showModal) {
            setLoadingRoutes(true);
            fetchRoutes().then(data => {
                setRoutes(data);
                setLoadingRoutes(false);
            });
        }
    }, [showModal]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    const startBroadcasting = () => {
        if (!selectedRoute) return;

        setIsBroadcasting(true);
        setShowModal(false);

        // Generate a session ID for this trip
        const userId = `user_${Math.random().toString(36).substr(2, 9)}`;

        if (navigator.geolocation) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const report = {
                        user_id: userId,
                        route_id: selectedRoute.id,
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        timestamp: Date.now() / 1000
                    };

                    broadcastLocation(report).then(res => {
                        if (res && res.active_reports) {
                            setActiveReports(res.active_reports);
                        }
                    });
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    alert("Error getting location. Broadcasting stopped.");
                    stopBroadcasting();
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    };

    const stopBroadcasting = () => {
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsBroadcasting(false);
        setSelectedRoute(null);
        setActiveReports(0);
    };

    // Debug mount
    useEffect(() => {
        console.log("BroadcastButton mounted");
    }, []);

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => isBroadcasting ? stopBroadcasting() : setShowModal(true)}
                className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all ${isBroadcasting
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
            >
                {isBroadcasting ? <Radio className="w-5 h-5" /> : <Bus className="w-5 h-5" />}
                <span className="font-medium">
                    {isBroadcasting ? 'Stop Broadcasting' : 'I am on a Bus'}
                </span>
                {isBroadcasting && (
                    <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                        Live
                    </span>
                )}
            </button>

            {/* Route Selection Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[1001] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Select Your Route</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-200 rounded-full">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1">
                            <p className="text-sm text-slate-500 mb-4">
                                Help others by broadcasting your location. Select the bus route you are currently on.
                            </p>

                            {loadingRoutes ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {routes.map(route => (
                                        <button
                                            key={route.id}
                                            onClick={() => setSelectedRoute(route)}
                                            className={`p-3 rounded-lg text-left border transition-all ${selectedRoute?.id === route.id
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                                                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="font-bold">{route.name}</div>
                                            <div className="text-xs text-slate-400">Route ID: {route.id}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-slate-50">
                            <button
                                onClick={startBroadcasting}
                                disabled={!selectedRoute}
                                className={`w-full py-3 rounded-lg font-bold text-white transition-all ${selectedRoute
                                    ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200'
                                    : 'bg-slate-300 cursor-not-allowed'
                                    }`}
                            >
                                Start Broadcasting
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BroadcastButton;
