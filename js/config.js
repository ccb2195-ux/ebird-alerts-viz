/**
 * Configuration for eBird Alerts Map
 */

const CONFIG = {
    // Default map center and zoom
    // Will be overridden by data bounds if sightings are available
    defaultCenter: [40.0, -75.0],
    defaultZoom: 8,

    // Tile layer configuration
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

    // Data source
    // Uses relative path to work both locally and on GitHub Pages
    dataUrl: './data/birds.json',

    // Marker colors by rarity level
    markerColors: {
        'notable': '#FFA500',     // Orange
        'rare': '#FF0000',        // Red
        'review': '#800080',      // Purple
        'default': '#3388ff'      // Default blue
    },

    // Marker cluster options
    clusterOptions: {
        chunkedLoading: true,
        chunkInterval: 200,
        chunkDelay: 50,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        maxClusterRadius: 80,
        disableClusteringAtZoom: 15  // Show individual markers when zoomed in close
    },

    // Auto-refresh interval (in milliseconds)
    // Set to null to disable auto-refresh
    autoRefreshInterval: null, // 5 * 60 * 1000 = 5 minutes

    // Map bounds padding
    boundsPadding: [50, 50],

    // Maximum zoom level
    maxZoom: 18,

    // Minimum zoom level
    minZoom: 3
};
