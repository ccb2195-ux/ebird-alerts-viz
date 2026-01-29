# Deployment Guide

## Quick Start - Testing Locally

### 1. Test the Frontend (No Python needed)

The easiest way to test the visualization:

```bash
cd C:\Users\craig\Desktop\ebird-alerts-viz

# Using Python's built-in HTTP server
python -m http.server 8000

# OR using Node.js (if you have it installed)
npx http-server -p 8000
```

Then open your browser to: http://localhost:8000

You should see the map with 5 sample bird sightings!

### 2. Test the Scraper (Optional - requires eBird account)

First, set up your environment:

```bash
cd scripts

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Set environment variables (Windows)
set EBIRD_USERNAME=your_email@example.com
set EBIRD_PASSWORD=your_password

# OR for PowerShell
$env:EBIRD_USERNAME="your_email@example.com"
$env:EBIRD_PASSWORD="your_password"

# Run the scraper
python scrape_ebird.py
```

If the scraper encounters issues finding the correct HTML selectors, you can use Playwright's codegen tool to discover them:

```bash
playwright codegen https://ebird.org/alert/summary?sid=SN35466
```

This will open a browser and allow you to click on elements to generate the correct selectors.

## GitHub Deployment

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `ebird-alerts-viz`
3. Description: "Interactive map of notable bird sightings from eBird"
4. Make it **Public** (required for free GitHub Pages)
5. Don't initialize with README (we already have one)
6. Click "Create repository"

### Step 2: Push Your Code

```bash
cd C:\Users\craig\Desktop\ebird-alerts-viz

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: eBird alerts visualization tool"

# Add remote (replace YOUR-USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR-USERNAME/ebird-alerts-viz.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Configure GitHub Secrets

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:
   - Name: `EBIRD_USERNAME`, Value: your eBird email
   - Name: `EBIRD_PASSWORD`, Value: your eBird password

### Step 4: Enable GitHub Pages

1. In your repository, go to **Settings** → **Pages**
2. Under "Source", select **Deploy from a branch**
3. Under "Branch", select **main** and **/ (root)**
4. Click **Save**

Your site will be available at:
`https://YOUR-USERNAME.github.io/ebird-alerts-viz/`

### Step 5: Trigger First Scrape

1. Go to **Actions** tab
2. Click on "Scrape eBird and Update Map" workflow
3. Click **Run workflow** → **Run workflow**
4. Wait for the workflow to complete (2-3 minutes)
5. Check that `data/birds.json` was updated

### Step 6: Verify Deployment

Visit your GitHub Pages URL and verify:
- ✅ Map loads correctly
- ✅ Sample birds are displayed (or real data if scraper ran)
- ✅ Markers are clickable with popups
- ✅ Filters work
- ✅ Mobile responsive

## Automated Updates

The GitHub Actions workflow is configured to run automatically:
- **6 AM UTC** (1 AM EST / 10 PM PST previous day)
- **6 PM UTC** (1 PM EST / 10 AM PST)

To change the schedule, edit `.github/workflows/scrape_and_deploy.yml`:

```yaml
schedule:
  - cron: '0 6 * * *'   # 6 AM UTC
  - cron: '0 18 * * *'  # 6 PM UTC
```

Use [crontab.guru](https://crontab.guru/) to create custom schedules.

## Troubleshooting

### Scraper Issues

**Problem:** Scraper can't find bird data

**Solution:**
1. Check the debug screenshot: `scripts/debug_screenshot.png`
2. Update selectors in `scrape_ebird.py` using Playwright codegen:
   ```bash
   playwright codegen https://ebird.org/alert/summary?sid=SN35466
   ```
3. Click on bird observation cards to see correct selectors
4. Update the selectors in the `extract_sighting_data()` function

**Problem:** Login fails

**Solution:**
1. Verify your eBird credentials work on the website
2. Check if eBird requires 2FA (may need to disable for automation account)
3. Check GitHub Actions logs for specific error messages

### GitHub Pages Issues

**Problem:** Site shows 404

**Solution:**
1. Wait 2-3 minutes after enabling GitHub Pages
2. Verify the repository is **Public**
3. Check Settings → Pages shows "Your site is live at..."
4. Ensure `index.html` is in the root directory

**Problem:** Map doesn't load

**Solution:**
1. Open browser Developer Tools (F12) → Console
2. Check for JavaScript errors
3. Verify `data/birds.json` exists and is valid JSON
4. Check that file paths are relative (`./data/birds.json`)

### Workflow Issues

**Problem:** GitHub Actions workflow fails

**Solution:**
1. Go to Actions tab → Click on failed workflow
2. Check which step failed
3. Common issues:
   - Missing secrets (EBIRD_USERNAME, EBIRD_PASSWORD)
   - Invalid credentials
   - eBird page structure changed
   - Network timeout

## Customization

### Change Location

To scrape a different eBird alert location:

1. Get your location code from eBird (the `sid` parameter in the URL)
2. Update `EBIRD_ALERT_URL` in `scripts/scrape_ebird.py`:
   ```python
   EBIRD_ALERT_URL = "https://ebird.org/alert/summary?sid=YOUR-LOCATION-CODE"
   ```
3. Update `location_code` in the JSON metadata

### Change Colors

Edit `js/config.js`:

```javascript
markerColors: {
    'notable': '#FFA500',  // Change to your preferred color
    'rare': '#FF0000',
    'review': '#800080'
}
```

### Change Map Style

Edit `js/config.js`:

```javascript
// Use a different tile provider
tileLayer: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
```

See [Leaflet Providers](https://leaflet-extras.github.io/leaflet-providers/preview/) for options.

## Monitoring

### Check Workflow Status

Add a status badge to your README.md:

```markdown
[![Scrape Status](https://github.com/YOUR-USERNAME/ebird-alerts-viz/actions/workflows/scrape_and_deploy.yml/badge.svg)](https://github.com/YOUR-USERNAME/ebird-alerts-viz/actions/workflows/scrape_and_deploy.yml)
```

### View Logs

1. Go to **Actions** tab
2. Click on a workflow run
3. Click on "scrape-and-deploy" job
4. Expand steps to see detailed logs

## Advanced Features

### Email Notifications on Failure

Add to `.github/workflows/scrape_and_deploy.yml`:

```yaml
- name: Send failure notification
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.MAIL_USERNAME }}
    password: ${{ secrets.MAIL_PASSWORD }}
    subject: eBird Scraper Failed
    to: your-email@example.com
    body: Check logs at ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

### Store Historical Data

Modify the scraper to append to a history file instead of overwriting:

```python
# Load existing history
with open("data/history.json", "r") as f:
    history = json.load(f)

# Append new sightings
history.extend(new_sightings)

# Save updated history
with open("data/history.json", "w") as f:
    json.dump(history, f)
```

## Support

If you encounter issues:

1. Check the [Playwright documentation](https://playwright.dev/python/)
2. Check the [Leaflet.js documentation](https://leafletjs.com/)
3. Review GitHub Actions logs for error messages
4. Check eBird's website for structure changes

## License

MIT License - Feel free to modify and use!
