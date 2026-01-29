/**
 * eBird Alerts Map - Main Application Logic
 */

// Global variables
let map;
let markerClusterGroup;
let allSightings = [];
let currentFilter = 'all';
let autoRefreshTimer = null;

/**
 * Initialize the Leaflet map
 */
function initMap() {
    map = L.map('map', {
        center: CONFIG.defaultCenter,
        zoom: CONFIG.defaultZoom,
        maxZoom: CONFIG.maxZoom,
        minZoom: CONFIG.minZoom
    });

    // Add tile layer
    L.tileLayer(CONFIG.tileLayer, {
        attribution: CONFIG.tileAttribution,
        maxZoom: CONFIG.maxZoom
    }).addTo(map);

    // Initialize marker cluster group
    markerClusterGroup = L.markerClusterGroup(CONFIG.clusterOptions);
    map.addLayer(markerClusterGroup);

    console.log('Map initialized');
}

/**
 * Fetch and display bird data
 */
async function loadBirdData() {
    showLoading(true);

    try {
        const response = await fetch(CONFIG.dataUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update metadata display
        updateMetadata(data.metadata);

        // Check for scraping errors
        if (data.metadata.scrape_status === 'error') {
            showError(`Data scraping error: ${data.metadata.error_message || 'Unknown error'}. Showing cached data.`);
        } else if (data.metadata.scrape_status === 'warning') {
            showError('No sightings found in the latest update.');
        }

        // Store all sightings
        allSightings = data.sightings || [];

        // Apply current filter and display
        applyFilter();

        console.log(`Loaded ${allSightings.length} total sightings`);

    } catch (error) {
        console.error('Error loading bird data:', error);
        showError(`Failed to load bird data: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Apply rarity filter to sightings
 */
function applyFilter() {
    // Clear existing markers
    markerClusterGroup.clearLayers();

    // Filter sightings based on current filter
    let filteredSightings = allSightings;

    if (currentFilter !== 'all') {
        filteredSightings = allSightings.filter(s => s.rarity_level === currentFilter);
    }

    // Only show sightings with valid coordinates
    const validSightings = filteredSightings.filter(
        s => s.latitude !== null && s.longitude !== null &&
             !isNaN(s.latitude) && !isNaN(s.longitude)
    );

    console.log(`Displaying ${validSightings.length} sightings after filtering`);

    // Create markers
    createMarkers(validSightings);

    // Fit map to markers if we have any
    if (validSightings.length > 0) {
        const bounds = markerClusterGroup.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: CONFIG.boundsPadding });
        }
    }

    // Update sighting count
    const countElement = document.getElementById('sighting-count');
    if (countElement) {
        const displayText = currentFilter === 'all'
            ? `${validSightings.length} sightings`
            : `${validSightings.length} ${currentFilter} sightings`;
        countElement.innerHTML = `<strong>Sightings:</strong> ${displayText}`;
    }
}

/**
 * Create markers for all sightings
 */
function createMarkers(sightings) {
    sightings.forEach(sighting => {
        const marker = createMarker(sighting);
        if (marker) {
            markerClusterGroup.addLayer(marker);
        }
    });
}

/**
 * Create a single marker for a sighting
 */
function createMarker(sighting) {
    try {
        const latlng = [sighting.latitude, sighting.longitude];

        // Get marker color based on rarity
        const color = CONFIG.markerColors[sighting.rarity_level] || CONFIG.markerColors.default;

        // Create custom icon
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-dot" style="background-color: ${color};"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -8]
        });

        // Create marker
        const marker = L.marker(latlng, { icon });

        // Create popup content
        const popupContent = createPopupContent(sighting);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'bird-popup'
        });

        return marker;

    } catch (error) {
        console.error('Error creating marker:', error, sighting);
        return null;
    }
}

/**
 * Create HTML content for popup
 */
function createPopupContent(sighting) {
    const parts = [];

    // Header with species name
    parts.push(`<div class="popup-header">`);
    parts.push(`<h3>${escapeHtml(sighting.species_common_name)}</h3>`);
    if (sighting.species_scientific_name) {
        parts.push(`<p class="scientific-name"><em>${escapeHtml(sighting.species_scientific_name)}</em></p>`);
    }
    parts.push(`</div>`);

    // Details
    parts.push(`<div class="popup-details">`);

    if (sighting.location) {
        parts.push(`<p><strong>📍 Location:</strong> ${escapeHtml(sighting.location)}</p>`);
    }

    if (sighting.date) {
        const formattedDate = formatDate(sighting.date);
        parts.push(`<p><strong>📅 Date:</strong> ${formattedDate}</p>`);
    }

    if (sighting.time) {
        parts.push(`<p><strong>🕒 Time:</strong> ${escapeHtml(sighting.time)}</p>`);
    }

    if (sighting.count) {
        parts.push(`<p><strong>🔢 Count:</strong> ${escapeHtml(sighting.count)}</p>`);
    }

    if (sighting.observer) {
        parts.push(`<p><strong>👤 Observer:</strong> ${escapeHtml(sighting.observer)}</p>`);
    }

    if (sighting.rarity_level) {
        const rarityClass = sighting.rarity_level.toLowerCase();
        const rarityText = sighting.rarity_level.charAt(0).toUpperCase() + sighting.rarity_level.slice(1);
        parts.push(`<p><strong>⭐ Status:</strong> <span class="rarity-badge ${rarityClass}">${rarityText}</span></p>`);
    }

    parts.push(`</div>`);

    // Checklist link
    if (sighting.checklist_url) {
        parts.push(`<div class="popup-footer">`);
        parts.push(`<a href="${escapeHtml(sighting.checklist_url)}" target="_blank" rel="noopener" class="checklist-link">View Checklist →</a>`);
        parts.push(`</div>`);
    }

    return parts.join('');
}

/**
 * Update metadata display
 */
function updateMetadata(metadata) {
    if (!metadata) return;

    // Last updated
    const lastUpdatedElement = document.getElementById('last-updated');
    if (lastUpdatedElement && metadata.last_updated) {
        const date = new Date(metadata.last_updated);
        const formattedDate = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        lastUpdatedElement.innerHTML = `<strong>Last updated:</strong> ${formattedDate}`;
    }

    // Location name
    const locationElement = document.getElementById('location-name');
    if (locationElement && metadata.location_name) {
        locationElement.innerHTML = `<strong>Location:</strong> ${escapeHtml(metadata.location_name)}`;
    }
}

/**
 * Show or hide loading overlay
 */
function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorElement = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    if (errorElement && errorText) {
        errorText.textContent = message;
        errorElement.style.display = 'flex';

        // Auto-hide after 10 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 10000);
    }
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString; // Return original if invalid
        }
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return dateString;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Rarity filter
    const filterSelect = document.getElementById('rarity-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            applyFilter();
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadBirdData();
        });
    }

    // Error close button
    const errorClose = document.getElementById('error-close');
    if (errorClose) {
        errorClose.addEventListener('click', () => {
            document.getElementById('error-message').style.display = 'none';
        });
    }

    // Info panel toggle
    const infoToggle = document.getElementById('info-toggle');
    const infoContent = document.getElementById('info-content');
    if (infoToggle && infoContent) {
        infoToggle.addEventListener('click', () => {
            const isVisible = infoContent.style.display === 'block';
            infoContent.style.display = isVisible ? 'none' : 'block';
        });
    }
}

/**
 * Setup auto-refresh if configured
 */
function setupAutoRefresh() {
    if (CONFIG.autoRefreshInterval) {
        autoRefreshTimer = setInterval(() => {
            console.log('Auto-refreshing data...');
            loadBirdData();
        }, CONFIG.autoRefreshInterval);
    }
}

/**
 * Initialize application
 */
function init() {
    console.log('Initializing eBird Alerts Map...');

    // Initialize map
    initMap();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    loadBirdData();

    // Setup auto-refresh
    setupAutoRefresh();

    console.log('Initialization complete');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
