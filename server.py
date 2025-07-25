#!/usr/bin/env python3
from flask import Flask, request, jsonify, send_from_directory, render_template_string
import os
import json
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
import webbrowser
import threading
import time

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Configuration
UPLOAD_FOLDER = 'uploads/videos'
THUMBNAILS_FOLDER = 'uploads/thumbnails'
DATA_FILE = 'clips_data.json'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}
PORT = 8000

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(THUMBNAILS_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_clips_data():
    """Load clips data from JSON file"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_clips_data(data):
    """Save clips data to JSON file"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

@app.route('/uploads/videos/<filename>')
def serve_video(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/uploads/thumbnails/<filename>')
def serve_thumbnail(filename):
    return send_from_directory(THUMBNAILS_FOLDER, filename)

@app.route('/api/clips', methods=['GET'])
def get_clips():
    """Get all clips with pagination and filtering"""
    clips = load_clips_data()
    
    # Filter by category if specified
    category = request.args.get('category')
    if category and category != 'all':
        clips = [clip for clip in clips if clip.get('category') == category]
    
    # Sort by date (newest first)
    clips.sort(key=lambda x: x.get('upload_date', ''), reverse=True)
    
    # Pagination
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 12))
    start = (page - 1) * per_page
    end = start + per_page
    
    return jsonify({
        'clips': clips[start:end],
        'total': len(clips),
        'page': page,
        'per_page': per_page,
        'has_more': end < len(clips)
    })

@app.route('/api/clips/<clip_id>', methods=['GET'])
def get_clip(clip_id):
    """Get specific clip details"""
    clips = load_clips_data()
    clip = next((c for c in clips if c['id'] == clip_id), None)
    
    if not clip:
        return jsonify({'error': 'Clip not found'}), 404
    
    # Increment view count
    clip['views'] = clip.get('views', 0) + 1
    save_clips_data(clips)
    
    return jsonify(clip)

@app.route('/api/clips/<clip_id>/like', methods=['POST'])
def like_clip(clip_id):
    """Toggle like on a clip"""
    clips = load_clips_data()
    clip = next((c for c in clips if c['id'] == clip_id), None)
    
    if not clip:
        return jsonify({'error': 'Clip not found'}), 404
    
    clip['likes'] = clip.get('likes', 0) + 1
    save_clips_data(clips)
    
    return jsonify({'likes': clip['likes']})

@app.route('/api/upload', methods=['POST'])
def upload_clip():
    """Upload a new video clip"""
    if 'clipFile' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['clipFile']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    # Generate unique filename
    clip_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    file_extension = filename.rsplit('.', 1)[1].lower()
    new_filename = f"{clip_id}.{file_extension}"
    
    # Save file
    file_path = os.path.join(UPLOAD_FOLDER, new_filename)
    file.save(file_path)
    
    # Create clip data
    clip_data = {
        'id': clip_id,
        'title': request.form.get('clipTitle', ''),
        'description': request.form.get('clipDescription', ''),
        'club': request.form.get('clubSelect', ''),
        'filename': new_filename,
        'original_filename': filename,
        'upload_date': datetime.now().isoformat(),
        'views': 0,
        'likes': 0,
        'category': 'goals',  # Default category
        'duration': '0:00',   # Would need video processing to get real duration
        'file_size': os.path.getsize(file_path)
    }
    
    # Save to data file
    clips = load_clips_data()
    clips.append(clip_data)
    save_clips_data(clips)
    
    return jsonify({
        'success': True,
        'clip_id': clip_id,
        'message': 'Clip uploaded successfully!'
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    clips = load_clips_data()
    
    total_clips = len(clips)
    total_views = sum(clip.get('views', 0) for clip in clips)
    total_likes = sum(clip.get('likes', 0) for clip in clips)
    
    return jsonify({
        'total_clips': total_clips,
        'total_views': total_views,
        'total_likes': total_likes
    })

def open_browser():
    """Open browser after a short delay"""
    time.sleep(1.5)
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == '__main__':
    print(f"🚀 Servidor Flask iniciado en http://localhost:{PORT}")
    print(f"📁 Sirviendo archivos desde: {os.getcwd()}")
    print(f"📹 Videos se guardarán en: {UPLOAD_FOLDER}")
    print("🌐 Abriendo navegador...")
    print("⏹️  Presiona Ctrl+C para detener el servidor")
    
    # Open browser in a separate thread
    threading.Thread(target=open_browser, daemon=True).start()
    
    try:
        app.run(host='0.0.0.0', port=PORT, debug=True, use_reloader=False)
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido")
