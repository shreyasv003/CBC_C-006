from flask import Flask, jsonify
from flask_cors import CORS
import json
import urllib.request
import os
from datetime import datetime, timedelta
import re
import spacy
import random

app = Flask(__name__)
CORS(app)

# Major locations in and around Kashmir region
INDIAN_LOCATIONS = {
    # Major Cities in Kashmir
    "Pahalgam": {"lat": 34.0159, "lng": 75.3187},
    "Srinagar": {"lat": 34.0837, "lng": 74.7973},
    "Anantnag": {"lat": 33.7311, "lng": 75.1547},
    "Baramulla": {"lat": 34.1980, "lng": 74.3636},
    "Gulmarg": {"lat": 34.0487, "lng": 74.3805},
    "Sopore": {"lat": 34.2990, "lng": 74.4707},
    "Kupwara": {"lat": 34.5310, "lng": 74.2660},
    "Pulwama": {"lat": 33.8741, "lng": 74.8996},
    "Budgam": {"lat": 33.7231, "lng": 74.7782},
    "Ganderbal": {"lat": 34.2269, "lng": 74.7769},
    "Kulgam": {"lat": 33.6444, "lng": 75.0192},
    "Shopian": {"lat": 33.7167, "lng": 74.8333},
    "Bandipora": {"lat": 34.4178, "lng": 74.6433},
    "Handwara": {"lat": 34.4000, "lng": 74.2833},
    "Awantipora": {"lat": 33.9167, "lng": 75.0167},
    
    # Tourist and Religious Sites
    "Sonamarg": {"lat": 34.2833, "lng": 75.3000},
    "Betaab Valley": {"lat": 34.0167, "lng": 75.3167},
    "Aru Valley": {"lat": 34.0833, "lng": 75.2667},
    "Dachigam": {"lat": 34.1333, "lng": 74.9000},
    "Hazratbal": {"lat": 34.1167, "lng": 74.8500},
    "Shankaracharya Temple": {"lat": 34.0833, "lng": 74.8333},
    "Dal Lake": {"lat": 34.1167, "lng": 74.8667},
    "Wular Lake": {"lat": 34.3667, "lng": 74.5667},
    "Mansar Lake": {"lat": 32.7000, "lng": 75.1500},
    "Vaishno Devi": {"lat": 33.0167, "lng": 74.9500},
    
    # Strategic and Border Areas
    "Uri": {"lat": 34.0833, "lng": 74.0333},
    "Tangdhar": {"lat": 34.4167, "lng": 74.0167},
    "Keran": {"lat": 34.6500, "lng": 74.0167},
    "Gurez": {"lat": 34.6333, "lng": 74.8333},
    "Karnah": {"lat": 34.4167, "lng": 74.0167},
    "Machil": {"lat": 34.7833, "lng": 74.1667},
    "Kupwara": {"lat": 34.5310, "lng": 74.2660},
    "Tral": {"lat": 33.9333, "lng": 75.1000},
    "Kokernag": {"lat": 33.5833, "lng": 75.3333},
    "Verinag": {"lat": 33.5500, "lng": 75.2500},
    
    # Nearby Important Locations
    "Jammu": {"lat": 32.7266, "lng": 74.8570},
    "Udhampur": {"lat": 32.9167, "lng": 75.1333},
    "Kathua": {"lat": 32.3833, "lng": 75.5167},
    "Rajouri": {"lat": 33.3833, "lng": 74.3000},
    "Poonch": {"lat": 33.7667, "lng": 74.1000},
    "Doda": {"lat": 33.1500, "lng": 75.5500},
    "Kishtwar": {"lat": 33.3167, "lng": 75.7667},
    "Ramban": {"lat": 33.2500, "lng": 75.2500},
    "Reasi": {"lat": 33.0833, "lng": 74.8333},
    "Samba": {"lat": 32.5667, "lng": 75.1167},
    
    # Airports and Military Installations
    "Srinagar Airport": {"lat": 33.9871, "lng": 74.7740},
    "Jammu Airport": {"lat": 32.6891, "lng": 74.8374},
    "Awantipora Air Force Station": {"lat": 33.9167, "lng": 75.0167},
    "Udhampur Air Force Station": {"lat": 32.9167, "lng": 75.1333},
    
    # Border Checkpoints
    "Wagah Border": {"lat": 31.6047, "lng": 74.5733},
    "Attari": {"lat": 31.6047, "lng": 74.5733},
    "Salamabad": {"lat": 34.0833, "lng": 74.0333},
    "Chakan Da Bagh": {"lat": 33.7667, "lng": 74.1000},
    
    # Hill Stations and Passes
    "Pir Panjal Pass": {"lat": 33.9167, "lng": 74.3667},
    "Banihal Pass": {"lat": 33.4833, "lng": 75.2000},
    "Zojila Pass": {"lat": 34.2833, "lng": 75.4833},
    "Patnitop": {"lat": 33.1167, "lng": 75.3167},
    "Sanasar": {"lat": 33.1167, "lng": 75.3167},
    "Bhaderwah": {"lat": 32.9833, "lng": 75.7167}
}

# Keywords indicating potential security threats
THREAT_KEYWORDS = {
    'attack': 2,
    'terror': 2,
    'bomb': 2,
    'explosion': 2,
    'shooting': 2,
    'gunfire': 2,
    'hostage': 2,
    'threat': 1,
    'alert': 1,
    'warning': 1,
    'danger': 1,
    'suspicious': 1,
    'security': 1,
    'emergency': 1,
    'evacuation': 1,
    'protest': 1,
    'riot': 2,
    'violence': 2,
    'strike': 1,
    'blockade': 1
}

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except Exception as e:
    print(f"Error loading spaCy model: {str(e)}")
    nlp = None

# GNews API configuration
GNEWS_API_KEY = "96c089523205c25d97b6a868842f87d2"
GNEWS_URL = f"https://gnews.io/api/v4/search?q=threat&lang=en&country=in&max=1000&apikey={GNEWS_API_KEY}"

def extract_location(text):
    """Extract location from text focusing on Kashmir region"""
    if not nlp:
        return random.choice(["Pahalgam", "Srinagar", "Anantnag"])
    
    # Convert text to lowercase for case-insensitive matching
    text = text.lower()
    
    # First, try to find exact matches from our location list
    for location in INDIAN_LOCATIONS.keys():
        if location.lower() in text:
            print(f"Found exact match: {location}")
            return location
    
    # If no exact match, use spaCy NER
    doc = nlp(text)
    locations = []
    
    # Extract GPE (Geo-Political Entities) and LOC (Locations)
    for ent in doc.ents:
        if ent.label_ in ['GPE', 'LOC']:
            # Check if the entity matches any of our known locations
            for location in INDIAN_LOCATIONS.keys():
                if location.lower() in ent.text.lower():
                    print(f"Found NER match: {location}")
                    return location
            locations.append(ent.text)
    
    # If we found locations but none matched our list, try to find the most relevant one
    if locations:
        # Look for region keywords
        region_keywords = {
            "kashmir": "Srinagar",
            "jammu": "Jammu",
            "valley": "Srinagar",
            "north": "Baramulla",
            "south": "Anantnag",
            "central": "Srinagar",
            "border": "Poonch",
            "airport": "Srinagar Airport",
            "temple": "Shankaracharya Temple",
            "lake": "Dal Lake",
            "pass": "Banihal Pass",
            "hill": "Gulmarg",
            "tourist": "Pahalgam",
            "military": "Awantipora Air Force Station"
        }
        
        for keyword, city in region_keywords.items():
            if keyword in text:
                print(f"Found region reference: {city}")
                return city
    
    # If still no match, look for context clues
    context_keywords = {
        "terror": "Pahalgam",
        "attack": "Pahalgam",
        "security": "Srinagar",
        "military": "Baramulla",
        "border": "Poonch",
        "temple": "Srinagar",
        "tourist": "Gulmarg",
        "militant": "Pulwama",
        "airport": "Srinagar Airport",
        "lake": "Dal Lake",
        "pass": "Banihal Pass",
        "valley": "Betaab Valley",
        "religious": "Hazratbal",
        "strategic": "Uri"
    }
    
    for keyword, city in context_keywords.items():
        if keyword in text:
            print(f"Found context reference: {city}")
            return city
    
    # If all else fails, return a location near Pahalgam
    default_locations = ["Pahalgam", "Anantnag", "Srinagar", "Gulmarg", "Baramulla"]
    default_city = random.choice(default_locations)
    print(f"No specific location found, using default near Pahalgam: {default_city}")
    return default_city

def get_coordinates_for_location(location):
    """Get coordinates for a location from our predefined list"""
    if location in INDIAN_LOCATIONS:
        return INDIAN_LOCATIONS[location]["lat"], INDIAN_LOCATIONS[location]["lng"]
    return None

def initialize_alerts_file():
    """Initialize alerts.json if it doesn't exist"""
    if not os.path.exists("alerts.json"):
        print("Creating new alerts.json file")
        try:
            with open("alerts.json", "w", encoding="utf-8") as f:
                json.dump([], f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error creating alerts.json: {str(e)}")

def predict_news_safety(text):
    """Predict if news is unsafe using keyword analysis"""
    if not text:
        return False
    
    # Convert text to lowercase for case-insensitive matching
    text = text.lower()
    
    # Calculate threat score based on keywords
    threat_score = 0
    found_keywords = []
    for keyword, weight in THREAT_KEYWORDS.items():
        if keyword in text:
            threat_score += weight
            found_keywords.append(keyword)
    
    # Print debug information
    print(f"\nAnalyzing text: {text[:100]}...")
    print(f"Found keywords: {found_keywords}")
    print(f"Threat score: {threat_score}")
    
    # Consider news unsafe if threat score is above threshold
    is_unsafe = threat_score >= 2
    print(f"Is unsafe: {is_unsafe}")
    return is_unsafe

def add_to_alerts(news_item):
    """Add unsafe news to alerts.json"""
    try:
        print(f"\nProcessing news item: {news_item['title']}")
        
        # Extract location from title, description, and content
        location = extract_location(news_item['title'] + " " + news_item['description'] + " " + news_item['content'])
        print(f"Extracted location: {location}")
        
        if not location:
            print("No location found, skipping alert")
            return
        
        # Get coordinates for the location
        coords = get_coordinates_for_location(location)
        print(f"Got coordinates: {coords}")
        
        if not coords:
            print("No coordinates found, skipping alert")
            return
        
        # Create alert object
        alert = {
            "lat": coords[0],
            "lng": coords[1],
            "severity": "high",
            "description": news_item['title'] + " - " + news_item['description'],
            "city": location
        }
        print(f"Created alert: {alert}")
        
        # Initialize alerts.json if it doesn't exist
        initialize_alerts_file()
        
        # Load existing alerts
        alerts = []
        try:
            with open("alerts.json", "r", encoding="utf-8") as f:
                alerts = json.load(f)
            print(f"Loaded {len(alerts)} existing alerts")
        except json.JSONDecodeError:
            print("Error reading alerts.json, starting with empty list")
            alerts = []
        
        # Check for duplicate alerts based on description
        is_duplicate = any(a['description'] == alert['description'] for a in alerts)
        print(f"Is duplicate: {is_duplicate}")
        
        if not is_duplicate:
            alerts.append(alert)
            print(f"Added new alert, total alerts: {len(alerts)}")
            
            # Save updated alerts
            with open("alerts.json", "w", encoding="utf-8") as f:
                json.dump(alerts, f, indent=2, ensure_ascii=False)
            print("Successfully saved alerts.json")
        else:
            print("Skipping duplicate alert")
            
    except Exception as e:
        print(f"Error adding to alerts: {str(e)}")
        import traceback
        traceback.print_exc()

def process_news_articles(articles):
    """Process news articles to check safety and add unsafe ones to alerts"""
    print(f"\nProcessing {len(articles)} news articles")
    for article in articles:
        # Combine title, description, and content for prediction
        text = f"{article['title']} {article['description']} {article['content']}"
        
        # Check if news is unsafe
        if predict_news_safety(text):
            print(f"\nFound unsafe news: {article['title']}")
            add_to_alerts(article)
        else:
            print(f"Skipping safe news: {article['title']}")

def fetch_and_save_news():
    try:
        print("\nFetching news from GNews API...")
        with urllib.request.urlopen(GNEWS_URL) as response:
            data = json.loads(response.read().decode("utf-8"))
            new_articles = data.get("articles", [])
            print(f"Fetched {len(new_articles)} articles")
            
            # Format new articles
            formatted_new_articles = []
            for article in new_articles:
                try:
                    formatted_article = {
                        "title": article.get("title", ""),
                        "description": article.get("description", ""),
                        "url": article.get("url", ""),
                        "publishedAt": article.get("publishedAt", ""),
                        "source": article.get("source", {}).get("name", ""),
                        "content": article.get("content", "")
                    }
                    formatted_new_articles.append(formatted_article)
                except Exception as e:
                    print(f"Error formatting article: {str(e)}")
                    continue
            
            # Load existing articles if file exists
            existing_articles = []
            if os.path.exists("news.json"):
                try:
                    with open("news.json", "r", encoding="utf-8") as f:
                        existing_articles = json.load(f)
                    print(f"Loaded {len(existing_articles)} existing articles")
                except Exception as e:
                    print(f"Error reading news.json: {str(e)}")
                    existing_articles = []
            
            # Combine existing and new articles, removing duplicates based on URL
            existing_urls = {article["url"] for article in existing_articles}
            unique_new_articles = [article for article in formatted_new_articles if article["url"] not in existing_urls]
            print(f"Found {len(unique_new_articles)} unique new articles")
            
            # Process new articles for safety
            process_news_articles(unique_new_articles)
            
            # Combine and sort by publishedAt
            all_articles = existing_articles + unique_new_articles
            all_articles.sort(key=lambda x: x["publishedAt"], reverse=True)
            
            # Keep only the latest 50 articles
            all_articles = all_articles[:50]
            
            # Save to news.json
            try:
                with open("news.json", "w", encoding="utf-8") as f:
                    json.dump(all_articles, f, indent=2, ensure_ascii=False)
                print("Successfully saved news.json")
            except Exception as e:
                print(f"Error saving news.json: {str(e)}")
            
            return all_articles
    except Exception as e:
        print(f"Error fetching news: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

def process_existing_news():
    """Process existing news.json file and update alerts.json"""
    try:
        print("\nProcessing existing news.json file...")
        if not os.path.exists("news.json"):
            print("news.json not found")
            return
        
        with open("news.json", "r", encoding="utf-8") as f:
            articles = json.load(f)
        
        print(f"Found {len(articles)} articles to process")
        
        # Initialize alerts.json
        initialize_alerts_file()
        
        for article in articles:
            print(f"\nProcessing article: {article['title']}")
            
            # Combine title, description, and content for prediction
            text = f"{article['title']} {article['description']} {article['content']}"
            
            # Check if news is unsafe
            if predict_news_safety(text):
                print(f"Found unsafe news: {article['title']}")
                add_to_alerts(article)
            else:
                print(f"Skipping safe news: {article['title']}")
    
    except Exception as e:
        print(f"Error processing existing news: {str(e)}")
        import traceback
        traceback.print_exc()

@app.route("/api/alerts")
def alerts():
    try:
        with open("alerts.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        print(f"Error reading alerts.json: {str(e)}")
        return jsonify([])

@app.route("/api/news")
def news():
    """Fetch fresh news and process for alerts"""
    try:
        # Always fetch fresh news
        articles = fetch_and_save_news()
        
        # Process the news for alerts
        process_existing_news()
        
        # Return the articles
        return jsonify(articles)
    except Exception as e:
        print(f"Error in news endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/process-news")
def process_news():
    """Endpoint to process existing news and update alerts"""
    try:
        process_existing_news()
        # Verify alerts.json was updated
        if os.path.exists("alerts.json"):
            with open("alerts.json", "r", encoding="utf-8") as f:
                alerts = json.load(f)
            return jsonify({
                "status": "success", 
                "message": "News processing completed",
                "alerts_count": len(alerts)
            })
        else:
            return jsonify({
                "status": "error",
                "message": "alerts.json was not created"
            })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        })

@app.route("/api/force-update")
def force_update():
    """Force update news and process for alerts"""
    try:
        articles = fetch_and_save_news()
        process_existing_news()
        # Verify alerts.json was updated
        if os.path.exists("alerts.json"):
            with open("alerts.json", "r", encoding="utf-8") as f:
                alerts = json.load(f)
            return jsonify({
                "status": "success", 
                "message": "Force update completed",
                "alerts_count": len(alerts)
            })
        else:
            return jsonify({
                "status": "error",
                "message": "alerts.json was not created"
            })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        })

if __name__ == "__main__":
    app.run(debug=True)