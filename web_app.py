from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
import os
import fitz  # PyMuPDF

import sys
import ctypes # Required for windll
from _version import VERSION, BUILD_DATE

# Try importing tkinter for folder dialog
try:
    import tkinter as tk
    from tkinter import filedialog
    HAS_TKINTER = True
except ImportError:
    HAS_TKINTER = False

if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    app = Flask(__name__)

# Verify if running as executable (frozen)
if getattr(sys, 'frozen', False):
    # If run as exe, we might want manuals relative to the exe, not the temp folder
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

import json

# Global list of paths to search
# Global list of paths to search
SEARCH_PATHS = [BASE_DIR]
EXPLORER_PATHS = [] # Custom paths for Explorer view
CONFIG_FILE = os.path.join(BASE_DIR, 'config.json')

def load_config():
    """Loads configuration from file."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
    return {}

def save_config():
    """Saves current configuration to file."""
    try:
        config = {
            "search_paths": SEARCH_PATHS,
            "explorer_paths": EXPLORER_PATHS
        }
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving config: {e}")

# Initialize Paths from config
config = load_config()

# 1. Search Paths (Libraries)
if "search_paths" in config:
    # Ensure BASE_DIR is always present
    loaded_paths = config["search_paths"]
    if BASE_DIR not in loaded_paths:
        loaded_paths.insert(0, BASE_DIR)
    SEARCH_PATHS = loaded_paths
else:
    SEARCH_PATHS = [BASE_DIR]

# 2. Explorer Paths (Custom Network/Local Paths)
if "explorer_paths" in config:
    EXPLORER_PATHS = config["explorer_paths"]
else:
    EXPLORER_PATHS = [] 

@app.route('/')
def index():
    return render_template('index.html', version=VERSION)

@app.route('/api/browse_folder', methods=['GET'])
def browse_folder():
    """Opens a native folder selection dialog on the server side."""
    if not HAS_TKINTER:
        return jsonify({"status": "error", "message": "Tkinter not available"}), 501
    
    try:
        # Create hidden root window
        root = tk.Tk()
        root.withdraw()
        # Ensure it's on top
        root.attributes('-topmost', True)
        
        path = filedialog.askdirectory(title="Select Folder to Add")
        root.destroy()
        
        if path:
            return jsonify({"status": "success", "path": os.path.normpath(path)})
        else:
            return jsonify({"status": "cancelled", "message": "Selection cancelled"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/add_network_path', methods=['POST'])
def add_network_path():
    """Adds a network path to the explorer paths."""
    try:
        data = request.json
        path = data.get('path')
        if not path:
             return jsonify({"status": "error", "message": "No path provided"}), 400
        
        # Normalize and ensure trailing slash for proper root handling
        path = os.path.normpath(path)
        if not path.endswith(os.sep):
            path += os.sep
            
        if path not in EXPLORER_PATHS:
            EXPLORER_PATHS.append(path)
            save_config()
            return jsonify({"status": "success", "path": path})
        else:
            return jsonify({"status": "exists", "path": path})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/remove_network_path', methods=['POST'])
def remove_network_path():
    """Removes a network path from the explorer paths."""
    try:
        data = request.json
        path = data.get('path')
        if not path:
             return jsonify({"status": "error", "message": "No path provided"}), 400
        
        # Try finding the path with or without trailing slash
        candidates = [path, path + os.sep, path.rstrip(os.sep)]
        
        found = False
        lists_to_check = [EXPLORER_PATHS]
        
        for p_list in lists_to_check:
            for c in candidates:
                if c in p_list:
                    p_list.remove(c)
                    found = True
                    break
            if found: break
            
        if found:
            save_config()
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": "Path not found"}), 404
    except Exception as e:
         return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/get_network_paths')
def get_network_paths():
    """Returns the list of currently added network paths."""
    return jsonify(EXPLORER_PATHS)

@app.route('/api/add_folder', methods=['GET', 'POST'])
def add_folder():
    """
    POST: Adds a provided folder path to search paths.
    GET: Opens a folder picker dialog to add a new search path (Legacy/Direct).
    """
    if request.method == 'POST':
        try:
            data = request.json
            folder_selected = data.get('path')
            
            if not folder_selected:
                return jsonify({"status": "error", "message": "No path provided"}), 400

            folder_selected = os.path.normpath(folder_selected)
            if folder_selected not in SEARCH_PATHS:
                SEARCH_PATHS.append(folder_selected)
                save_config()
                return jsonify({"status": "success", "path": folder_selected})
            else:
                 return jsonify({"status": "exists", "path": folder_selected})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    # GET Request: Browse and Add
    if not HAS_TKINTER:
        return jsonify({"status": "error", "message": "Tkinter not available"}), 501
    
    try:
        root = tk.Tk()
        root.withdraw() # Hide the main window
        root.attributes('-topmost', True) # Bring to front
        
        folder_selected = filedialog.askdirectory(title="Select Document Folder")
        root.destroy()
        
        if folder_selected:
            # Normalize path
            folder_selected = os.path.normpath(folder_selected)
            if folder_selected not in SEARCH_PATHS:
                SEARCH_PATHS.append(folder_selected)
                save_config()
                return jsonify({"status": "success", "path": folder_selected})
            else:
                 return jsonify({"status": "exists", "path": folder_selected})
        return jsonify({"status": "cancelled"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/get_folders')
def get_folders():
    """Returns the list of currently added folder paths."""
    return jsonify(SEARCH_PATHS)

@app.route('/api/remove_folder', methods=['POST'])
def remove_folder():
    """Removes a folder from the search paths."""
    try:
        data = request.json
        path_to_remove = data.get('path')
        
        if not path_to_remove:
            return jsonify({"status": "error", "message": "No path provided"}), 400
            
        path_to_remove = os.path.normpath(path_to_remove)
        
        if path_to_remove in SEARCH_PATHS:
            SEARCH_PATHS.remove(path_to_remove)
            save_config()
            return jsonify({"status": "success", "path": path_to_remove})
        else:
            return jsonify({"status": "error", "message": "Path not found in list"}), 404
            
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/files')
def list_files():
    """Lists all files in the searched paths."""
    file_list = []
    
    for base_path in SEARCH_PATHS:
        if not os.path.exists(base_path):
            continue

        # Get display name for the root folder
        norm_search_path = os.path.normpath(base_path)
        root_name = os.path.basename(norm_search_path)
        if not root_name: # Handle drive roots like C:\
            root_name = norm_search_path.rstrip(os.sep).rstrip(':') + ":" # Ensure C: format

        for root, dirs, files in os.walk(base_path):
            # Exclude internal folders
            EXCLUDED_DIRS = {
                'static', 'templates', '__pycache__', 'build', 'dist', 
                '_internal', '.git', '.idea', '.vscode'
            }
            # Modify dirs in-place to skip walking them
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith('.')]
            
            for file in files:
                # Exclude specific files
                if file.lower() in ['smartviewer.exe', 'smartviewer.spec'] or file.startswith('.'):
                    continue
                    
                full_path = os.path.join(root, file)
                try:
                    stats = os.stat(full_path)
                    
                    # Calculate relative path for tree structure
                    try:
                        rel_path = os.path.relpath(full_path, base_path)
                        rel_path_str = rel_path.replace("\\", "/")
                        tree_path = f"{root_name}/{rel_path_str}"
                    except ValueError:
                        # Fallback if on different drive (shouldn't happen given os.walk)
                        tree_path = f"{root_name}/{file}"

                    file_list.append({
                        "name": file,
                        "path": full_path, # Absolute path for internal usage
                        "tree_path": tree_path, # RESTORED: For UI grouping
                        "root": base_path,
                        "size": stats.st_size,
                        "mtime": stats.st_mtime,
                        "ctime": stats.st_ctime,
                        "type": file.split('.')[-1].lower() if '.' in file else 'unknown'
                    })
                except Exception as e:
                    # Skip files we can't access
                    continue
                    
    return jsonify(file_list)

import string

def get_drives():
    drives = []
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    for letter in string.ascii_uppercase:
        if bitmask & 1:
            drives.append(f"{letter}:\\")
        bitmask >>= 1
    return drives

@app.route('/api/explore')
def explore_path():
    """Returns directory listing for a given path or list of drives if empty."""
    path = request.args.get('path', '')
    
    if not path:
        # Return Drives + Custom Explorer Paths
        drives = get_drives()
        
        # Add Custom Paths
        for p in EXPLORER_PATHS:
            if p not in drives:
                drives.append(p)
                
        return jsonify(drives)
        
    try:
        # Debug print
        print(f"Explore request for: {path}")
        
        # Handle UNC Root (e.g., \\server or \\server\)
        # Python cannot normally listdir a UNC root. We must list shares.
        items = []
        if path.startswith(r'\\') and path.count('\\') == 2 and not path.endswith('\\'):
             # case: \\server -> append \
             path += '\\'

        if path.startswith(r'\\') and path.strip('\\').count('\\') == 0:
            # This looks like a server root like \\server or \\server\
            # Try to list shares using 'net view'
            try:
                import subprocess
                # cmd: net view \\server
                # Remove trailing slash for net view
                server_target = path.rstrip('\\')
                
                # Run net view
                # Note: This might be slow or fail depending on auth
                result = subprocess.run(f'net view "{server_target}"', capture_output=True, text=True, shell=True)
                
                if result.returncode == 0:
                    lines = result.stdout.splitlines()
                    # Parse output. Usually starts with dashes '---'
                    # Share name   Type   ...
                    # Multimedia   Disk   ...
                    start_parsing = False
                    for line in lines:
                        if line.startswith('---'):
                            start_parsing = True
                            continue
                        if not start_parsing: 
                            continue
                        if not line.strip(): 
                            continue
                        if "The command completed successfully" in line:
                            break
                            
                        # Extract share name (first chunk)
                        parts = line.split()
                        if parts:
                            share_name = parts[0]
                            # Construct full path
                            full_share_path = os.path.join(server_target, share_name)
                            items.append({
                                "name": share_name,
                                "path": full_share_path,
                                "is_dir": True,
                                "size": 0,
                                "mtime": 0
                            })
                    if items:
                        return jsonify(items)
            except Exception as e:
                print(f"Failed to list shares for {path}: {e}")
                # Fallthrough to normal method just in case

        if not os.path.exists(path):
             print(f"Path not found: {path}")
             return jsonify({"error": f"Path not found: {path}"}), 404
             
        if not os.path.isdir(path):
             return jsonify({"error": "Not a directory"}), 400
             
        # items already init
        if not items:
            try:
                with os.scandir(path) as it:
                    for entry in it:
                        try:
                            items.append({
                                "name": entry.name,
                                "path": entry.path,
                                "is_dir": entry.is_dir(),
                                "size": entry.stat().st_size if not entry.is_dir() else 0,
                                "mtime": entry.stat().st_mtime
                            })
                        except OSError:
                            continue # Skip items we can't access
            except PermissionError:
                return jsonify({"error": "Access Denied: You do not have permission to view this folder.", "code": "PERMISSION_DENIED"}), 403
                    
        # Sort: Directories first, then files
        items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
        return jsonify(items)
    except Exception as e:
        print(f"Explore error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/serve_file')
def serve_file():
    """Serves a file from an absolute path."""
    path = request.args.get('path')
    if not path or not os.path.exists(path):
        return "File not found", 404
        
    return send_file(path)

@app.route('/api/open_external')
def open_external_file():
    """Opens a file in the default system application."""
    root = request.args.get('root')
    rel_path = request.args.get('path')
    
    if not root or not rel_path:
        return jsonify({"status": "error", "message": "Missing arguments"}), 400
        
    try:
        # Security check: verify root is in SEARCH_PATHS (or close enough logic)
        # For now, simplistic check if root exists
        if not os.path.exists(root):
             return jsonify({"status": "error", "message": "Invalid root"}), 400

        full_path = os.path.normpath(os.path.join(root, rel_path))
        
        if not os.path.exists(full_path):
            return jsonify({"status": "error", "message": "File not found"}), 404
            
        # Open file
        os.startfile(full_path)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/manuals/<path:filename>')
def serve_manual(filename):
    """Serves a file from the configured search paths."""
    # Check all search paths for the file
    for search_path in SEARCH_PATHS:
        safe_path = os.path.join(search_path, filename)
        # Security check: ensure path is within the search_path
        # But wait, send_from_directory does this check.
        # We just need to check if file exists there.
        if os.path.exists(safe_path):
             return send_from_directory(search_path, filename)
    
    return "File not found", 404

@app.route('/api/read_file')
def read_file_chunk():
    """Reads a specific chunk of a text file."""
    rel_path = request.args.get('path')
    start = int(request.args.get('start', 0))
    length = int(request.args.get('length', 1024 * 1024)) # Default 1MB

    if not rel_path:
        return jsonify({"error": "No path provided"}), 400

    if not rel_path:
        return jsonify({"error": "No path provided"}), 400

    # Security check & Normalization
    rel_path = rel_path.replace("\\", "/") # Normalize input to forward slashes
    
    # Check if absolute path provided (for Explorer mode)
    if os.path.isabs(request.args.get('path', '')):
        # Trust the absolute path if it exists
        full_path = os.path.normpath(request.args.get('path'))
    else:
        # Legacy/Search Path logic
        full_path = None
        for search_path in SEARCH_PATHS:
            candidate_path = os.path.join(search_path, rel_path)
            candidate_path = os.path.abspath(candidate_path)
            if os.path.exists(candidate_path):
                full_path = candidate_path
                break
            
    if not full_path or not os.path.exists(full_path):
        return jsonify({"error": f"File not found: {rel_path}"}), 404

    try:
        file_size = os.path.getsize(full_path)
        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            f.seek(start)
            content = f.read(length)
            curr_pos = f.tell()
            
        return jsonify({
            "content": content,
            "start": start,
            "length": curr_pos - start, # Actual bytes read
            "total_size": file_size,
            "eof": curr_pos >= file_size
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/search')
def search_content():
    query = request.args.get('q', '').lower()
    target_file = request.args.get('file_path')
    
    if not query:
        return jsonify([])

    results = []
    
    # helper to process a single file
    def search_file(full_path, rel_path, filename):
        ext = os.path.splitext(filename)[1].lower()
        file_results = []
        
        if ext == '.pdf':
            try:
                doc = fitz.open(full_path)
                for i, page in enumerate(doc):
                    text = page.get_text("text")
                    if query in text.lower():
                        file_results.append({
                            "file": rel_path,
                            "name": filename,
                            "type": "pdf",
                            "location": f"Page {i+1}",
                            "page": i + 1
                        })
            except:
                pass
        elif ext in ['.txt', '.md']:
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                for i, line in enumerate(lines):
                    if query in line.lower():
                        file_results.append({
                            "file": rel_path,
                            "name": filename,
                            "type": "text",
                            "location": f"Line {i+1}",
                            "context": line.strip()[:60] + "...",
                            "line": i + 1
                        })
            except:
                pass
        return file_results

    if target_file:
        # Search specifically this file
        # target_file comes as "relative/path/to/file.ext"
        # We need to find which root it belongs to
        target_full_path = None
        for search_path in SEARCH_PATHS:
             candidate = os.path.join(search_path, target_file)
             if os.path.exists(candidate):
                 target_full_path = candidate
                 break
                 
        if target_full_path and os.path.isfile(target_full_path):
            results.extend(search_file(target_full_path, target_file, os.path.basename(target_file)))
    else:
        # Global search
        for search_path in SEARCH_PATHS:
            if not os.path.exists(search_path): continue
            
            for root, dirs, files in os.walk(search_path):
                # Apply exclusions same as list_files
                EXCLUDED_DIRS = {
                    'static', 'templates', '__pycache__', 'build', 'dist', 
                    '_internal', '.git', '.idea', '.vscode'
                }
                dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith('.')]
                
                for file in files:
                    if file.lower() in ['smartviewer.exe', 'smartviewer.spec'] or file.startswith('.'):
                        continue
                        
                    full_path = os.path.join(root, file)
                    # For search results, we want the path relative to the search path for display/linking
                    # This logic assumes "path" acts as ID in frontend.
                    rel_path = os.path.relpath(full_path, search_path).replace("\\", "/")
                    results.extend(search_file(full_path, rel_path, file))

    return jsonify(results)

@app.route('/api/quit')
def quit_app():
    """Allows the frontend to request application termination."""
    # If running with tray, we should stop the tray icon which will exit the app
    # But since flask is in a thread, we might need a global reference or signal.
    # For simplicity, we can try to find the tray icon or just force exit.
    
    # Best approach: Trigger the tray icon's stop method if possible, 
    # but since 'icon' is local in main, we'll use os._exit for immediate termination
    # or set a flag.
    
    # We will use os._exit(0) which is abrupt but effective for a small tool.
    # To be nicer, we could use a global flag, but os._exit is fine here.
    
    func = request.environ.get('werkzeug.server.shutdown')
    if func:
        func()
    
    # Fallback if not using werkzeug server or for immediate exit
    # We schedule it slightly later to allow the response to return
    from threading import Timer
    def force_exit():
        os._exit(0)
        
    Timer(0.5, force_exit).start()
    return jsonify({"status": "shutdown"})

if __name__ == '__main__':
    # Fix for infinite loading on Windows when frozen
    import multiprocessing
    multiprocessing.freeze_support()

    # Single Instance Check with Warning
    from tendo import singleton
    import sys
    import ctypes
    
    try:
        me = singleton.SingleInstance()
    except singleton.SingleInstanceException:
        # Show specific warning
        APP_NAME = "SmartViewer"
        ctypes.windll.user32.MessageBoxW(0, f"{APP_NAME} is already running!", "Warning", 0x30) # 0x30 = MB_ICONWARNING
        sys.exit(0)

    # Tray Icon Logic
    import pystray
    from PIL import Image, ImageDraw
    import threading
    import webbrowser
    import os
    import time
    
    # Global reference to icon
    tray_icon = None

    def create_icon_image():
        # Try to load high-quality icon if it exists
        icon_path = "icon.png"
        if getattr(sys, 'frozen', False):
            # If running as exe, icon might be in _internal or base dir
            icon_path = os.path.join(sys._MEIPASS, "icon.png") if hasattr(sys, '_MEIPASS') else os.path.join(os.path.dirname(sys.executable), "icon.png")
        
        if os.path.exists(icon_path):
            try:
                return Image.open(icon_path)
            except Exception as e:
                print(f"Error loading icon image: {e}")

        # Fallback: Create a simple icon if png fails/doesn't exist
        width = 64
        height = 64
        color1 = (0, 122, 204)
        color2 = (255, 255, 255)
        
        image = Image.new('RGB', (width, height), color1)
        dc = ImageDraw.Draw(image)
        dc.rectangle((width // 4, height // 4, 3 * width // 4, 3 * height // 4), fill=color2)
        return image

    def on_quit(icon, item):
        icon.stop()
        os._exit(0) # Force exit Flask thread too

    def on_open(icon, item):
        webbrowser.open_new("http://localhost:5000")

    def run_flask():
        # Use simple server, reloader false for threading
        app.run(port=5000, debug=False, use_reloader=False)

    def on_about(icon, item):
        webbrowser.open_new("http://localhost:5000/#about")
        
    def show_notification(icon):
        icon.notify("SmartViewer is running in the background.\nRight-click for options.", "SmartViewer")

    def on_click(icon, item):
        # Default Left Click Action
        show_notification(icon)

    # Menu Definition
    menu = (
        pystray.MenuItem('Open Viewer', on_open, default=False), # default=False ensuring click doesn't trigger this automatically
        pystray.MenuItem('About', on_about),
        pystray.MenuItem('Quit', on_quit)
    )

    # Create Icon
    # We set a distinct action for left click if supported by creating the icon without 'default=True' on menu items effectively, 
    # but to force "Click -> Notify", we can bind a separate listener or rely on menu.
    # pystray doesn't have a direct "on_click" callback in the constructor easily separate from menu default.
    # However, setting menu item default=True makes it the action.
    # Re-reading user request: "Icon click -> Message", "Double Click -> Open".
    # Since double click is hard, we prioritize "Icon Click -> Message".
    # So we should NOT set any menu item as default? OR we make a hidden default item that shows notification?
    
    # Strategy: Hidden default menu item for Notification.
    # Visible menu items for Open/About/Quit.
    
    # Actually, pystray creates a menu. Clicking the icon usually triggers the default menu item.
    # So we add a hidden item (visible=False) that is default=True, and its action is show_notification.
    
    menu_with_default = (
        pystray.MenuItem('Status', on_click, default=True, visible=False),
        pystray.MenuItem('Open Viewer', on_open),
        pystray.MenuItem('About', on_about),
        pystray.MenuItem('Quit', on_quit)
    )

    icon = pystray.Icon("SmartViewer", create_icon_image(), "Smart Document Viewer", menu_with_default)
    tray_icon = icon
    
    # Start Flask in a background thread
    server_thread = threading.Thread(target=run_flask)
    server_thread.daemon = True
    server_thread.start()

    # Open browser initially
    from threading import Timer
    Timer(1, lambda: on_open(icon, None)).start()

    # Run Tray Icon (Blocking)
    icon.run()
