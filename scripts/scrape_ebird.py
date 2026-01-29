#!/usr/bin/env python3
"""
eBird Alert Scraper
Scrapes notable bird sightings from eBird alert page and saves as JSON.
"""

import asyncio
from playwright.async_api import async_playwright
import json
import os
import hashlib
from datetime import datetime, timezone
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
EBIRD_ALERT_URL = "https://ebird.org/alert/summary?sid=SN35466"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "birds.json")


async def login(page):
    """Handle eBird authentication"""
    logger.info("Attempting login...")

    try:
        # Wait for login form to appear
        await page.wait_for_selector("input[type='text'], input[type='email']", timeout=10000)

        # Fill credentials
        # eBird may use different input selectors, adjust as needed
        username_input = await page.query_selector("input[type='text'], input[type='email']")
        password_input = await page.query_selector("input[type='password']")

        if username_input and password_input:
            await username_input.fill(os.environ.get("EBIRD_USERNAME", ""))
            await password_input.fill(os.environ.get("EBIRD_PASSWORD", ""))

            # Find and click submit button
            submit_button = await page.query_selector("button[type='submit'], input[type='submit']")
            if submit_button:
                await submit_button.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
                logger.info("Login successful")
                return True

        logger.warning("Could not find login form elements")
        return False

    except Exception as e:
        logger.error(f"Login error: {e}")
        return False


async def verify_logged_in(page):
    """Check if login was successful"""
    try:
        # Check for user-specific elements (adjust selector based on actual page)
        # Common patterns: user menu, account button, "Sign Out" link
        await page.wait_for_selector("text=/Sign Out|Logout|Account/i", timeout=5000)
        return True
    except:
        return False


async def extract_sighting_data(card):
    """Extract data from a single observation card"""
    try:
        sighting = {}

        # Species name - adjust selectors based on actual page structure
        species_elem = await card.query_selector(".Heading-main, .species-name, h3, h4")
        sighting["species_common_name"] = await species_elem.inner_text() if species_elem else "Unknown"

        # Scientific name - often in italics or specific class
        scientific_elem = await card.query_selector("em, .scientific-name, .species-scientific")
        sighting["species_scientific_name"] = await scientific_elem.inner_text() if scientific_elem else ""

        # Location
        location_elem = await card.query_selector(".Observation-location, .location, [class*='location']")
        sighting["location"] = await location_elem.inner_text() if location_elem else "Unknown"

        # Date
        date_elem = await card.query_selector(".Observation-meta-date, .date, [class*='date']")
        date_text = await date_elem.inner_text() if date_elem else ""
        sighting["date"] = date_text.strip()

        # Time (may not always be available)
        time_elem = await card.query_selector(".time, [class*='time']")
        sighting["time"] = await time_elem.inner_text() if time_elem else ""

        # Observer
        observer_elem = await card.query_selector(".Observation-meta-user, .observer, [class*='user']")
        sighting["observer"] = await observer_elem.inner_text() if observer_elem else "Unknown"

        # Count
        count_elem = await card.query_selector(".count, [class*='count']")
        sighting["count"] = await count_elem.inner_text() if count_elem else "1"

        # Rarity level - look for badges or special indicators
        rarity_elem = await card.query_selector(".rare, .notable, .review, [class*='rarity']")
        sighting["rarity_level"] = await rarity_elem.inner_text() if rarity_elem else "notable"
        sighting["rarity_level"] = sighting["rarity_level"].lower().strip()

        # Checklist URL - often in a link
        checklist_link = await card.query_selector("a[href*='checklist']")
        if checklist_link:
            href = await checklist_link.get_attribute("href")
            sighting["checklist_url"] = f"https://ebird.org{href}" if href and not href.startswith("http") else href
        else:
            sighting["checklist_url"] = ""

        # Coordinates - may be in data attributes or need to be parsed from map links
        lat_elem = await card.get_attribute("data-lat")
        lng_elem = await card.get_attribute("data-lng")
        sighting["latitude"] = float(lat_elem) if lat_elem else None
        sighting["longitude"] = float(lng_elem) if lng_elem else None

        # If coordinates are in a Google Maps link
        if sighting["latitude"] is None:
            map_link = await card.query_selector("a[href*='google.com/maps'], a[href*='maps.google']")
            if map_link:
                href = await map_link.get_attribute("href")
                coords = parse_coordinates_from_url(href)
                if coords:
                    sighting["latitude"], sighting["longitude"] = coords

        # Generate unique ID
        id_string = f"{sighting['species_common_name']}{sighting['location']}{sighting['date']}"
        sighting["id"] = hashlib.md5(id_string.encode()).hexdigest()[:12]

        return sighting

    except Exception as e:
        logger.warning(f"Failed to extract sighting data: {e}")
        return None


def parse_coordinates_from_url(url):
    """Extract latitude and longitude from Google Maps URL"""
    import re
    if not url:
        return None

    # Pattern: @lat,lng or q=lat,lng
    pattern = r'[@q=](-?\d+\.\d+),(-?\d+\.\d+)'
    match = re.search(pattern, url)
    if match:
        return float(match.group(1)), float(match.group(2))
    return None


def validate_sighting(sighting):
    """Validate required fields"""
    if not sighting:
        return False
    required = ["species_common_name", "location", "date"]
    return all(sighting.get(field) and sighting.get(field) != "Unknown" for field in required)


async def scrape_alerts(page, max_retries=3):
    """Scrape bird alert data with retry logic"""
    for attempt in range(max_retries):
        try:
            logger.info(f"Navigating to {EBIRD_ALERT_URL} (attempt {attempt + 1})")

            await page.goto(EBIRD_ALERT_URL, wait_until="domcontentloaded", timeout=30000)

            # Check if redirected to login
            if "login" in page.url.lower() or "signin" in page.url.lower():
                logger.info("Redirected to login page")
                login_success = await login(page)
                if not login_success:
                    raise Exception("Login failed")

                # Navigate to alert page again
                await page.goto(EBIRD_ALERT_URL, wait_until="domcontentloaded", timeout=30000)

            # Wait for page to load completely
            await page.wait_for_load_state("networkidle", timeout=30000)

            # Wait for observations to load - try multiple possible selectors
            try:
                await page.wait_for_selector(
                    ".Observation, .observation, .sighting, [class*='bird-card'], [class*='observation']",
                    timeout=15000
                )
            except:
                logger.warning("Could not find observation elements with standard selectors")
                # Take screenshot for debugging
                await page.screenshot(path="debug_screenshot.png")
                logger.info("Screenshot saved as debug_screenshot.png")
                return []

            # Extract sightings
            sightings = []

            # Try different possible selectors for observation cards
            observation_cards = await page.query_selector_all(
                ".Observation, .observation, .sighting, [class*='bird-card'], [class*='observation']"
            )

            logger.info(f"Found {len(observation_cards)} observation cards")

            for card in observation_cards:
                sighting = await extract_sighting_data(card)
                if sighting and validate_sighting(sighting):
                    sightings.append(sighting)
                    logger.info(f"Extracted: {sighting['species_common_name']} at {sighting['location']}")

            return sightings

        except Exception as e:
            logger.error(f"Scraping attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(5)  # Wait before retry

    return []


def create_output_json(sightings, status="success", error_message=None):
    """Create final JSON structure"""
    return {
        "metadata": {
            "location_code": "SN35466",
            "location_name": "eBird Alert Location",
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "scrape_status": status,
            "total_sightings": len(sightings),
            "error_message": error_message
        },
        "sightings": sightings
    }


async def main():
    """Main scraping function"""
    logger.info("Starting eBird scraper...")

    # Validate environment variables
    if not os.environ.get("EBIRD_USERNAME") or not os.environ.get("EBIRD_PASSWORD"):
        logger.error("EBIRD_USERNAME and EBIRD_PASSWORD environment variables must be set")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,  # Set to False for debugging
            args=['--disable-blink-features=AutomationControlled']
        )

        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        )

        page = await context.new_page()

        try:
            sightings = await scrape_alerts(page)

            if sightings:
                output = create_output_json(sightings, status="success")
                logger.info(f"Successfully scraped {len(sightings)} sightings")
            else:
                output = create_output_json([], status="warning", error_message="No sightings found")
                logger.warning("No valid sightings found")

            # Ensure output directory exists
            os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

            # Write JSON
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2, ensure_ascii=False)

            logger.info(f"Data saved to {OUTPUT_FILE}")

        except Exception as e:
            logger.error(f"Scraping failed: {e}")
            # Write error state
            error_output = create_output_json(
                [],
                status="error",
                error_message=str(e)
            )

            os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(error_output, f, indent=2)

            logger.info("Error state saved to JSON")

        finally:
            await context.close()
            await browser.close()
            logger.info("Browser closed")


if __name__ == "__main__":
    asyncio.run(main())
