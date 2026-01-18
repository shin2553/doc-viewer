import PyInstaller.__main__
import shutil
import os
import zipfile
import time
import subprocess
import sys
from _version import VERSION

APP_NAME = "SmartViewer"
DIST_DIR = "dist"
BUILD_DIR = "build"
OUTPUT_DIR = f"{APP_NAME}_v{VERSION}"

def log(message):
    print(f"[{time.strftime('%H:%M:%S')}] {message}")

def check_process_running(process_name):
    """Check if a process is running using tasklist."""
    try:
        # Use simple check first
        result = subprocess.run(['tasklist', '/FI', f'IMAGENAME eq {process_name}'], capture_output=True, text=True)
        if process_name in result.stdout:
            return True
        return False
    except Exception as e:
        log(f"Warning: Could not check for running process: {e}")
        return False

def safe_remove(path):
    """Safely remove a file or directory with retries."""
    if not os.path.exists(path):
        return
        
    max_retries = 3
    for i in range(max_retries):
        try:
            if os.path.isfile(path):
                os.remove(path)
            else:
                shutil.rmtree(path)
            log(f"Successfully removed: {path}")
            return
        except OSError as e:
            if i < max_retries - 1:
                log(f"Retry {i+1}/{max_retries} removing {path}: {e}")
                time.sleep(1)
            else:
                log(f"Error: Failed to remove {path}: {e}")
                raise

def clean():
    log("Starting clean process...")
    try:
        if os.path.exists(DIST_DIR):
            safe_remove(DIST_DIR)
        if os.path.exists(BUILD_DIR):
            safe_remove(BUILD_DIR)
        spec_file = f"{APP_NAME}.spec"
        if os.path.exists(spec_file):
            safe_remove(spec_file)
    except Exception as e:
        log(f"Error during clean: {e}")
        raise

def build():
    log("Starting build process...")
    
    # PyInstaller arguments
    args = [
        'web_app.py',
        '--name=%s' % APP_NAME,
        '--noconsole',  # Hide console window
        '--onefile',    # Single executable file
        '--add-data=templates;templates',
        '--add-data=static;static',
        '--clean',
        '--hidden-import=pystray',
        '--hidden-import=PIL',
        '--hidden-import=tendo',
        '--hidden-import=win32event', # often needed for pystray on windows
        '--hidden-import=win32api',
        '--exclude-module=matplotlib',
        '--exclude-module=pandas',
        '--exclude-module=numpy',
        '--exclude-module=PyQt5',
        '--exclude-module=PyQt5',
        # '--exclude-module=tkinter', # Needed for folder selection
        '--log-level=WARN',
    ]
    
    log(f"Running PyInstaller with args: {args}")
    # Run PyInstaller via subprocess to ensure a clean state and avoid hangs
    cmd = [sys.executable, '-m', 'PyInstaller'] + args
    log(f"Running command: {' '.join(cmd)}")
    
    try:
        subprocess.run(cmd, check=True)
        log("PyInstaller finished successfully.")
    except subprocess.CalledProcessError as e:
        log(f"PyInstaller failed with exit code {e.returncode}")
        raise
    except Exception as e:
        log(f"PyInstaller failed: {e}")
        raise

def backup_existing():
    """Backups existing distribution if it exists."""
    dist_path = os.path.join(DIST_DIR, OUTPUT_DIR)
    if os.path.exists(dist_path):
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        backup_name = f"{OUTPUT_DIR}_backup_{timestamp}"
        backup_path = os.path.join(DIST_DIR, backup_name)
        log(f"Backing up existing build to {backup_path}...")
        try:
            if os.path.exists(backup_path):
                safe_remove(backup_path)
            shutil.move(dist_path, backup_path)
            
            # Also backup zip if exists
            zip_filename = f"{OUTPUT_DIR}.zip"
            zip_path = os.path.join(DIST_DIR, zip_filename)
            if os.path.exists(zip_path):
                shutil.move(zip_path, os.path.join(DIST_DIR, f"{backup_name}.zip"))
        except Exception as e:
            log(f"Warning: Backup failed: {e}")

def package():
    log("Packaging distribution...")
    
    # Create distribution folder
    dist_path = os.path.join(DIST_DIR, OUTPUT_DIR)
    
    try:
        if not os.path.exists(dist_path):
            os.makedirs(dist_path)
        
        # Move executable
        exe_name = f"{APP_NAME}.exe"
        src_exe = os.path.join(DIST_DIR, exe_name)
        dst_exe = os.path.join(dist_path, exe_name)
        
        if os.path.exists(src_exe):
            log(f"Moving executable from {src_exe} to {dst_exe}")
            shutil.move(src_exe, dst_exe)
        else:
            log(f"Error: Executable {src_exe} not found!")
            return

        # Copy Release Notes and Manuals (Root level files)
        # Copy Manuals
        # Copy Manuals (Root level files) - User requested no documents folder
        manuals_src = "manuals"
        
        if os.path.exists(manuals_src):
            log("Copying welcome document...")
            # Copy only 00_WELCOME.txt to root
            fname = "00_WELCOME.txt"
            src_file = os.path.join(manuals_src, fname)
            if os.path.exists(src_file):
                shutil.copy(src_file, os.path.join(dist_path, fname))
                log(f"Included document: {fname}")
        
        # Copy Release Notes if exists
        if os.path.exists("RELEASE_NOTES.md"):
            log("Copying RELEASE_NOTES.md...")
            shutil.copy("RELEASE_NOTES.md", os.path.join(dist_path, "RELEASE_NOTES.md"))

        # Copy User Manual if exists
        if os.path.exists("MANUAL.md"):
            log("Copying MANUAL.md...")
            shutil.copy("MANUAL.md", os.path.join(dist_path, "MANUAL.md"))
            
            
        # Create Zip archive
        zip_filename = f"{OUTPUT_DIR}.zip"
        zip_path = os.path.join(DIST_DIR, zip_filename)
        
        log(f"Creating archive {zip_path}...")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(dist_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, DIST_DIR)
                    zipf.write(file_path, arcname)

        log(f"Build complete! Distribution available at: {dist_path}")
        log(f"Zip archive: {zip_path}")
        
    except Exception as e:
        log(f"Error during packaging: {e}")
        raise

if __name__ == "__main__":
    if check_process_running(f"{APP_NAME}.exe"):
        log(f"ERROR: {APP_NAME}.exe is currently running. Please close it and try again.")
        sys.exit(1)
        
    try:
        backup_existing() # Backup before cleaning
        clean()
        build()
        package()
    except Exception as e:
        log(f"BUILD FAILED: {e}")
        sys.exit(1)
