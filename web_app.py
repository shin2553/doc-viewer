from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import fitz  # PyMuPDF

import sys
from _version import VERSION, BUILD_DATE

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

# Global list of paths to search
SEARCH_PATHS = [BASE_DIR]

@app.route('/')
def index():
    return render_template('index.html', version=VERSION, build_date=BUILD_DATE)

@app.route('/api/add_folder')
def add_folder():
    """Opens a folder picker dialog to add a new search path."""
    import tkinter as tk
    from tkinter import filedialog
    
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
                return jsonify({"status": "success", "path": folder_selected})
            else:
                 return jsonify({"status": "exists", "path": folder_selected})
        return jsonify({"status": "cancelled"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/get_folders')
def get_folders():
    """Returns the list of current search paths."""
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
            return jsonify({"status": "success", "path": path_to_remove})
        else:
            return jsonify({"status": "error", "message": "Path not found in list"}), 404
            
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/files')
def list_files():
    """Returns a hierarchical structure of files from all search paths."""
    # System/Internal folders to exclude
    EXCLUDED_DIRS = {
        'static', 'templates', '__pycache__', 'build', 'dist', 
        '_internal', '.git', '.idea', '.vscode'
    }
    
    all_files = []
    
    for search_path in SEARCH_PATHS:
        if not os.path.exists(search_path):
            continue

        # Get display name for the root folder
        norm_search_path = os.path.normpath(search_path)
        root_name = os.path.basename(norm_search_path)
        if not root_name: # Handle drive roots like C:\
            root_name = norm_search_path.rstrip(os.sep)

        for root, dirs, files in os.walk(search_path):
            # Modify dirs in-place to exclude unwanted directories from walk
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith('.')]
            dirs.sort()
            files.sort()
            
            for file in files:
                # Optional: Exclude the executable itself if desired, or specific system files
                if file.lower() in ['smartviewer.exe', 'smartviewer.spec'] or file.startswith('.'):
                    continue
                    
                try:
                    ext = os.path.splitext(file)[1].lower()
                    full_path = os.path.join(root, file)
                    
                    rel_path = os.path.relpath(full_path, search_path)
                    rel_path_web = rel_path.replace("\\", "/") 
                    
                    # Tree Path includes the root folder name to group files under it
                    tree_path = f"{root_name}/{rel_path_web}"
                    
                    mtime = 0
                    ctime = 0
                    size = 0
                    try:
                        stat = os.stat(full_path)
                        mtime = stat.st_mtime
                        ctime = stat.st_ctime
                        size = stat.st_size
                    except:
                        pass

                    all_files.append({
                        "name": rel_path_web,
                        "path": rel_path_web, # Currently used for serving
                        "tree_path": tree_path, # New field for tree grouping
                        "root": search_path,
                        "type": ext[1:] if len(ext) > 1 else "txt",
                        "mtime": mtime,
                        "ctime": ctime,
                        "size": size
                    })
                except Exception as e:
                    print(f"Skipping {file}: {e}")
                    continue
    
    return jsonify(all_files)

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
    
    full_path = None
    for search_path in SEARCH_PATHS:
        candidate_path = os.path.join(search_path, rel_path)
        candidate_path = os.path.abspath(candidate_path)
        if os.path.exists(candidate_path) and candidate_path.startswith(os.path.abspath(search_path)):
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
        # Create a simple icon
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
