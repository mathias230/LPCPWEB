#!/usr/bin/env python3
from flask import Flask, request, jsonify, send_from_directory
import os
import json
from datetime import datetime

app = Flask(__name__)

# Configuration
PORT = 8000
DATA_FILE = 'clips_data.json'
STANDINGS_FILE = 'standings_data.json'
MATCHES_FILE = 'matches_data.json'
SETTINGS_FILE = 'league_settings.json'

def load_clips_data():
    """Load clips data from JSON file"""
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading clips data: {e}")
        return []

def save_clips_data(data):
    """Save clips data to JSON file"""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving clips data: {e}")
        return False

def load_standings_data():
    """Load standings data from JSON file"""
    try:
        if os.path.exists(STANDINGS_FILE):
            with open(STANDINGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return initialize_default_standings()
    except Exception as e:
        print(f"Error loading standings data: {e}")
        return initialize_default_standings()

def save_standings_data(data):
    """Save standings data to JSON file"""
    try:
        with open(STANDINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving standings data: {e}")
        return False

def load_matches_data():
    """Load matches data from JSON file"""
    try:
        if os.path.exists(MATCHES_FILE):
            with open(MATCHES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading matches data: {e}")
        return []

def save_matches_data(data):
    """Save matches data to JSON file"""
    try:
        with open(MATCHES_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving matches data: {e}")
        return False

def load_settings_data():
    """Load league settings from JSON file"""
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            'seasonName': 'Temporada 2025',
            'pointsWin': 3,
            'pointsDraw': 1,
            'pointsLoss': 0
        }
    except Exception as e:
        print(f"Error loading settings data: {e}")
        return {
            'seasonName': 'Temporada 2025',
            'pointsWin': 3,
            'pointsDraw': 1,
            'pointsLoss': 0
        }

def save_settings_data(data):
    """Save league settings to JSON file"""
    try:
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving settings data: {e}")
        return False

def initialize_default_standings():
    """Initialize default standings with LPCP teams"""
    teams = [
        {'id': 1, 'name': 'ACP 507', 'stadium': 'Estadio ACP'},
        {'id': 2, 'name': 'Coiner FC', 'stadium': 'Campo Coiner'},
        {'id': 3, 'name': 'FC WEST SIDE', 'stadium': 'West Side Arena'},
        {'id': 4, 'name': 'Humacao Fc', 'stadium': 'Estadio Humacao'},
        {'id': 5, 'name': 'Punta Coco Fc', 'stadium': 'Punta Coco Field'},
        {'id': 6, 'name': 'Pura Vibra', 'stadium': 'Vibra Stadium'},
        {'id': 7, 'name': 'Raven Law', 'stadium': 'Law Arena'},
        {'id': 8, 'name': 'Rayos X Fc', 'stadium': 'Rayos Stadium'},
        {'id': 9, 'name': 'Tiki Taka Fc', 'stadium': 'Tiki Taka Field'},
        {'id': 10, 'name': 'fly city', 'stadium': 'Fly City Arena'}
    ]
    
    standings = []
    for i, team in enumerate(teams):
        standings.append({
            'position': i + 1,
            'team': team['name'],
            'teamId': team['id'],
            'played': 0,
            'won': 0,
            'drawn': 0,
            'lost': 0,
            'goalsFor': 0,
            'goalsAgainst': 0,
            'goalDifference': 0,
            'points': 0
        })
    
    return standings

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory('uploads', filename)

@app.route('/uploads/videos/<filename>')
def serve_video(filename):
    return send_from_directory('uploads/videos', filename)

@app.route('/uploads/thumbnails/<filename>')
def serve_thumbnail(filename):
    return send_from_directory('uploads/thumbnails', filename)

@app.route('/api/clips', methods=['GET'])
def get_clips():
    """Get all clips with pagination and filtering"""
    try:
        clips = load_clips_data()
        
        # Filter by category if specified
        category = request.args.get('category', 'all')
        if category and category != 'all':
            clips = [clip for clip in clips if clip.get('type') == category]
        
        # Sort by date (newest first)
        clips.sort(key=lambda x: x.get('upload_date', ''), reverse=True)
        
        # Simple pagination
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 12))
        start = (page - 1) * per_page
        end = start + per_page
        
        result = {
            'clips': clips[start:end],
            'total': len(clips),
            'page': page,
            'per_page': per_page,
            'has_more': end < len(clips)
        }
        
        print(f"📤 Enviando respuesta API: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return jsonify(result)
    except Exception as e:
        print(f"Error in get_clips: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    try:
        clips = load_clips_data()
        
        total_clips = len(clips)
        total_views = sum(clip.get('views', 0) for clip in clips)
        total_likes = sum(clip.get('likes', 0) for clip in clips)
        
        return jsonify({
            'total_clips': total_clips,
            'total_views': total_views,
            'total_likes': total_likes
        })
    except Exception as e:
        print(f"Error in get_stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/clips/<clip_id>', methods=['GET'])
def get_clip_details(clip_id):
    """Get details for a specific clip"""
    try:
        clips = load_clips_data()
        clip = next((c for c in clips if c['id'] == clip_id), None)
        
        if not clip:
            return jsonify({'error': 'Clip not found'}), 404
        
        # Increment view count
        clip['views'] = clip.get('views', 0) + 1
        save_clips_data(clips)
        
        print(f"📹 Clip details requested: {clip['title']} (views: {clip['views']})")
        return jsonify(clip)
        
    except Exception as e:
        print(f"Error in get_clip_details: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/clips/<clip_id>/like', methods=['POST'])
def like_clip(clip_id):
    """Toggle like on a clip"""
    try:
        clips = load_clips_data()
        clip = next((c for c in clips if c['id'] == clip_id), None)
        
        if not clip:
            return jsonify({'error': 'Clip not found'}), 404
        
        clip['likes'] = clip.get('likes', 0) + 1
        
        if save_clips_data(clips):
            return jsonify({'success': True, 'likes': clip['likes']})
        else:
            return jsonify({'error': 'Failed to save data'}), 500
            
    except Exception as e:
        print(f"Error in like_clip: {e}")
        return jsonify({'error': str(e)}), 500

# Standings API endpoints
@app.route('/api/standings', methods=['GET'])
def get_standings():
    """Get current standings table"""
    try:
        standings = load_standings_data()
        
        # Sort standings by points, then goal difference
        standings.sort(key=lambda x: (-x['points'], -x['goalDifference'], -x['goalsFor']))
        
        # Update positions
        for i, team in enumerate(standings):
            team['position'] = i + 1
        
        print(f"📊 Standings requested: {len(standings)} teams")
        return jsonify(standings)
        
    except Exception as e:
        print(f"Error in get_standings: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/standings', methods=['PUT'])
def update_standings():
    """Update entire standings table"""
    try:
        new_standings = request.json
        
        if not isinstance(new_standings, list):
            return jsonify({'error': 'Invalid data format'}), 400
        
        if save_standings_data(new_standings):
            print(f"📊 Standings updated: {len(new_standings)} teams")
            return jsonify({'success': True, 'message': 'Standings updated successfully'})
        else:
            return jsonify({'error': 'Failed to save standings'}), 500
            
    except Exception as e:
        print(f"Error in update_standings: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/standings/reset', methods=['POST'])
def reset_standings():
    """Reset standings to default state"""
    try:
        default_standings = initialize_default_standings()
        
        if save_standings_data(default_standings):
            print("📊 Standings reset to default")
            return jsonify({'success': True, 'message': 'Standings reset successfully', 'standings': default_standings})
        else:
            return jsonify({'error': 'Failed to reset standings'}), 500
            
    except Exception as e:
        print(f"Error in reset_standings: {e}")
        return jsonify({'error': str(e)}), 500

# Matches API endpoints
@app.route('/api/matches', methods=['GET'])
def get_matches():
    """Get all matches with optional filtering"""
    try:
        matches = load_matches_data()
        
        # Filter by matchday if specified
        matchday = request.args.get('matchday')
        if matchday and matchday != 'all':
            matches = [m for m in matches if m.get('matchday') == int(matchday)]
        
        # Filter by status if specified
        status = request.args.get('status')
        if status and status != 'all':
            matches = [m for m in matches if m.get('status') == status]
        
        # Sort by date and matchday
        matches.sort(key=lambda x: (x.get('matchday', 0), x.get('date', '')))
        
        print(f"⚽ Matches requested: {len(matches)} matches")
        return jsonify(matches)
        
    except Exception as e:
        print(f"Error in get_matches: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/matches', methods=['POST'])
def create_match():
    """Create a new match"""
    try:
        match_data = request.json
        matches = load_matches_data()
        
        # Add ID and timestamp
        match_data['id'] = int(datetime.now().timestamp() * 1000)
        
        matches.append(match_data)
        
        if save_matches_data(matches):
            print(f"⚽ Match created: {match_data.get('homeTeam')} vs {match_data.get('awayTeam')}")
            return jsonify({'success': True, 'match': match_data})
        else:
            return jsonify({'error': 'Failed to save match'}), 500
            
    except Exception as e:
        print(f"Error in create_match: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/matches/<int:match_id>', methods=['PUT'])
def update_match(match_id):
    """Update an existing match"""
    try:
        match_data = request.json
        matches = load_matches_data()
        
        # Find and update the match
        match_index = next((i for i, m in enumerate(matches) if m['id'] == match_id), None)
        
        if match_index is None:
            return jsonify({'error': 'Match not found'}), 404
        
        matches[match_index].update(match_data)
        
        if save_matches_data(matches):
            print(f"⚽ Match updated: {matches[match_index].get('homeTeam')} vs {matches[match_index].get('awayTeam')}")
            return jsonify({'success': True, 'match': matches[match_index]})
        else:
            return jsonify({'error': 'Failed to save match'}), 500
            
    except Exception as e:
        print(f"Error in update_match: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/matches/<int:match_id>', methods=['DELETE'])
def delete_match(match_id):
    """Delete a match"""
    try:
        matches = load_matches_data()
        
        # Find and remove the match
        match_index = next((i for i, m in enumerate(matches) if m['id'] == match_id), None)
        
        if match_index is None:
            return jsonify({'error': 'Match not found'}), 404
        
        deleted_match = matches.pop(match_index)
        
        if save_matches_data(matches):
            print(f"⚽ Match deleted: {deleted_match.get('homeTeam')} vs {deleted_match.get('awayTeam')}")
            return jsonify({'success': True, 'message': 'Match deleted successfully'})
        else:
            return jsonify({'error': 'Failed to save matches'}), 500
            
    except Exception as e:
        print(f"Error in delete_match: {e}")
        return jsonify({'error': str(e)}), 500

# Settings API endpoints
@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Get league settings"""
    try:
        settings = load_settings_data()
        print(f"⚙️ Settings requested")
        return jsonify(settings)
        
    except Exception as e:
        print(f"Error in get_settings: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    """Update league settings"""
    try:
        settings_data = request.json
        
        if save_settings_data(settings_data):
            print(f"⚙️ Settings updated")
            return jsonify({'success': True, 'settings': settings_data})
        else:
            return jsonify({'error': 'Failed to save settings'}), 500
            
    except Exception as e:
        print(f"Error in update_settings: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f"🚀 Servidor Flask simple iniciado en http://localhost:{PORT}")
    print(f"📁 Sirviendo archivos desde: {os.getcwd()}")
    print(f"📄 Archivo de datos: {DATA_FILE}")
    print("⏹️  Presiona Ctrl+C para detener el servidor")
    
    try:
        app.run(host='127.0.0.1', port=PORT, debug=False)
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido")
    except Exception as e:
        print(f"\n❌ Error del servidor: {e}")
