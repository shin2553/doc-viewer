# Release Notes - SmartViewer

## v1.1.3 (2026-01-16)
- **New Features**:
    - **PPSX Support**: Added support for `.ppsx` (PowerPoint Slide Show) files. They can now be opened in the system default application.
- **Improvements**:
    - **UI Refinement**: The "Info" button is now hidden for external files (Office, Archives) to reduce clutter, as these files always show the details view initially.

## v1.1.2 (2026-01-16)
- **New Features**:
    - **File Info Toggle**: Added an "Info" button (i icon) to the viewer to toggle detailed file information for any file.
    - **Internal File Details**: You can now view metadata (Size, Created/Modified Date, Path) for internally viewable files (PDF, Text included) and switch back to content view with a "View Content" button.
    - **Enhanced External File Support**: External files (Office, Archives) now display a details page with an "Open in System Application" button, preventing accidental opening dialogs.
    - **Created Date**: Added "Created Date" to the file details view.
    - **Manage Folders**: (Previous update recap) Added interface to add/remove search paths.

## v1.1.1 (2026-01-16)
- **Fixes**:
    - Fixed "Unexpected token '<'" error when opening text files.
    - Improved internal file path handling.

## v1.0.0 (2026-01-15)
- **Initial Release**
- Features:
    - PDF, Image, Text, CSV Viewer
    - Adobe PDF Embed API integration
    - Dark Mode UI
    - System Tray Icon
    - Single Instance Check
    - About Popup
