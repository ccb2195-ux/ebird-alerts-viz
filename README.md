# eBird Alerts Visualization

An automated bird watching visualization tool that scrapes eBird alert data and displays notable bird sightings on an interactive map.

## Features

- 🗺️ Interactive Leaflet.js map with bird sighting markers
- 🐦 Displays notable/rare bird species
- 🔄 Automatically updates 2x daily (6 AM & 6 PM UTC)
- 📱 Mobile-responsive design
- 🎨 Color-coded markers by rarity level

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript with Leaflet.js
- **Scraping**: Playwright (Python)
- **Automation**: GitHub Actions
- **Hosting**: GitHub Pages

## Setup

### 1. Prerequisites

- Python 3.11+
- eBird account
- GitHub account

### 2. Local Development

```bash
# Install dependencies
cd scripts
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Set environment variables
export EBIRD_USERNAME="your_email@example.com"
export EBIRD_PASSWORD="your_password"

# Run scraper
python scrape_ebird.py
```

### 3. GitHub Setup

1. **Create Repository Secrets:**
   - Go to Settings → Secrets and variables → Actions
   - Add `EBIRD_USERNAME` and `EBIRD_PASSWORD`

2. **Enable GitHub Pages:**
   - Go to Settings → Pages
   - Source: Deploy from branch
   - Branch: `main` or `gh-pages`
   - Folder: `/` (root)

3. **Trigger Workflow:**
   - Go to Actions tab
   - Select "Scrape eBird and Update Map"
   - Click "Run workflow"

## Project Structure

```
ebird-alerts-viz/
├── .github/
│   └── workflows/
│       └── scrape_and_deploy.yml  # Automation workflow
├── scripts/
│   ├── scrape_ebird.py           # Playwright scraper
│   └── requirements.txt          # Python dependencies
├── js/
│   ├── map.js                    # Map logic
│   └── config.js                 # Configuration
├── css/
│   └── styles.css                # Styling
├── data/
│   └── birds.json                # Bird sighting data
├── index.html                    # Main page
└── README.md
```

## Data Structure

The `birds.json` file contains:

```json
{
  "metadata": {
    "location_code": "SN35466",
    "location_name": "Alert Location",
    "last_updated": "2026-01-29T06:00:00Z",
    "scrape_status": "success",
    "total_sightings": 15
  },
  "sightings": [
    {
      "id": "unique_hash",
      "species_common_name": "African Grey Parrot",
      "species_scientific_name": "Psittacus erithacus",
      "location": "Djoudj National Bird Sanctuary",
      "latitude": 16.5,
      "longitude": -16.2,
      "date": "2026-01-29",
      "count": "3",
      "observer": "John Doe",
      "rarity_level": "notable"
    }
  ]
}
```

## Deployment

The GitHub Actions workflow automatically:
1. Scrapes eBird at 6 AM and 6 PM UTC
2. Updates `birds.json` with new sightings
3. Commits changes to the repository
4. Deploys to GitHub Pages

View your site at: `https://[your-username].github.io/ebird-alerts-viz/`

## License

MIT License - Feel free to use and modify!

## Acknowledgments

- Data sourced from [eBird](https://ebird.org)
- Maps powered by [Leaflet.js](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/)
- Not affiliated with eBird or Cornell Lab of Ornithology
