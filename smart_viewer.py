import sys
import os
import fitz  # PyMuPDF
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QVBoxLayout, QHBoxLayout, QWidget, QLineEdit,
    QPushButton, QTreeWidget, QTreeWidgetItem, QLabel, QSplitter, QScrollArea,
    QSpinBox, QTextEdit, QToolBar, QStatusBar, QFileDialog, QDockWidget, QMessageBox
)
from PyQt6.QtGui import QAction, QIcon, QPixmap, QImage, QPainter, QColor, QTextCursor, QTextCharFormat
from PyQt6.QtCore import Qt, QSize, QTimer

# -----------------------------------------------------------------------------
# Stylesheet for a modern look
# -----------------------------------------------------------------------------
STYLESHEET = """
QMainWindow {
    background-color: #2b2b2b;
    color: #ffffff;
}
QWidget {
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
    color: #e0e0e0;
}
QTreeWidget, QTextEdit, QScrollArea {
    background-color: #363636;
    border: 1px solid #555555;
    border-radius: 4px;
}
QHeaderView::section {
    background-color: #444444;
    padding: 4px;
    border: 1px solid #555555;
}
QLineEdit {
    background-color: #363636;
    border: 1px solid #555555;
    border-radius: 4px;
    padding: 5px;
    color: #ffffff;
}
QLineEdit:focus {
    border: 1px solid #007acc;
}
QPushButton {
    background-color: #007acc;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
}
QPushButton:hover {
    background-color: #008be6;
}
QPushButton:pressed {
    background-color: #005a96;
}
QSplitter::handle {
    background-color: #555555;
    width: 2px;
}
QLabel {
    color: #e0e0e0;
}
QScrollBar:vertical {
    background: #2b2b2b;
    width: 12px;
}
QScrollBar::handle:vertical {
    background: #555555;
    min-height: 20px;
    border-radius: 6px;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    background: none;
}
"""

class SmartViewer(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Smart Document Viewer")
        self.resize(1200, 800)
        self.setStyleSheet(STYLESHEET)

        # State
        self.current_file_path = None
        self.pdf_doc = None
        self.zoom_factor = 1.0
        self.current_page_num = 0  # 0-indexed
        self.doc_type = None  # 'pdf', 'image', 'text'

        # Central Widget & Layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Toolbar
        self.create_toolbar()

        # Splitter (Sidebar | Content)
        self.splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(self.splitter)

        # Sidebar (File Tree & Search Results)
        self.sidebar_widget = QWidget()
        self.sidebar_layout = QVBoxLayout(self.sidebar_widget)
        self.sidebar_layout.setContentsMargins(5, 5, 5, 5)
        
        # File Search
        self.file_search_input = QLineEdit()
        self.file_search_input.setPlaceholderText("Search files...")
        self.file_search_input.textChanged.connect(self.filter_file_tree)
        self.sidebar_layout.addWidget(self.file_search_input)

        # File Tree
        self.file_tree = QTreeWidget()
        self.file_tree.setHeaderLabel("Documents")
        self.file_tree.itemClicked.connect(self.on_file_clicked)
        self.sidebar_layout.addWidget(self.file_tree)

        # Content Search
        self.content_search_input = QLineEdit()
        self.content_search_input.setPlaceholderText("Search in document...")
        self.content_search_input.returnPressed.connect(self.search_content)
        self.sidebar_layout.addWidget(self.content_search_input)

        self.search_results_tree = QTreeWidget()
        self.search_results_tree.setHeaderLabel("Search Results")
        self.search_results_tree.itemClicked.connect(self.on_search_result_clicked)
        self.sidebar_layout.addWidget(self.search_results_tree)

        # Add Sidebar to Splitter
        self.splitter.addWidget(self.sidebar_widget)

        # Content Area
        self.content_area = QScrollArea()
        self.content_area.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.content_area.setWidgetResizable(True)
        
        # We will switch widgets inside content_area or use a container
        self.content_container = QWidget()
        self.content_layout = QVBoxLayout(self.content_container)
        self.content_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.content_area.setWidget(self.content_container)

        # Widgets for different types
        self.image_label = QLabel()
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        self.text_editor = QTextEdit()
        self.text_editor.setReadOnly(True)
        
        # Add to splitter
        self.splitter.addWidget(self.content_area)
        self.splitter.setSizes([300, 900])

        # Load Files
        self.root_dir = os.path.join(os.getcwd(), "manuals")
        if not os.path.exists(self.root_dir):
            os.makedirs(self.root_dir)
        self.populate_file_tree()

    def create_toolbar(self):
        toolbar = QToolBar("Main Toolbar")
        self.addToolBar(toolbar)

        # Refresh
        refresh_action = QAction("Refresh", self)
        refresh_action.triggered.connect(self.populate_file_tree)
        toolbar.addAction(refresh_action)

        toolbar.addSeparator()

        # Zoom Controls (mostly for PDF/Image)
        self.zoom_in_act = QAction("Zoom In (+)", self)
        self.zoom_in_act.triggered.connect(lambda: self.change_zoom(0.2))
        toolbar.addAction(self.zoom_in_act)

        self.zoom_out_act = QAction("Zoom Out (-)", self)
        self.zoom_out_act.triggered.connect(lambda: self.change_zoom(-0.2))
        toolbar.addAction(self.zoom_out_act)

        self.fit_width_act = QAction("Reset Zoom", self)
        self.fit_width_act.triggered.connect(lambda: self.reset_zoom())
        toolbar.addAction(self.fit_width_act)

        toolbar.addSeparator()

        # PDF Navigation
        self.prev_page_act = QAction("Previous", self)
        self.prev_page_act.triggered.connect(self.prev_page)
        toolbar.addAction(self.prev_page_act)

        self.page_spin = QSpinBox()
        self.page_spin.setRange(1, 1)
        self.page_spin.valueChanged.connect(self.jump_to_page)
        self.page_spin.setFixedWidth(60)
        toolbar.addWidget(self.page_spin)

        self.total_pages_label = QLabel(" / 1")
        toolbar.addWidget(self.total_pages_label)

        self.next_page_act = QAction("Next", self)
        self.next_page_act.triggered.connect(self.next_page)
        toolbar.addAction(self.next_page_act)

    # -------------------------------------------------------------------------
    # File Management
    # -------------------------------------------------------------------------
    def populate_file_tree(self):
        self.file_tree.clear()
        if not os.path.exists(self.root_dir):
            return

        # root item
        root_item = QTreeWidgetItem(self.file_tree, [os.path.basename(self.root_dir)])
        root_item.setData(0, Qt.ItemDataRole.UserRole, self.root_dir)
        self.file_tree.addTopLevelItem(root_item)
        
        self.add_items_recursive(root_item, self.root_dir)
        root_item.setExpanded(True)

    def add_items_recursive(self, parent_item, path):
        try:
            items = os.listdir(path)
        except PermissionError:
            return

        # Sort: directories first, then files
        items.sort(key=lambda x: (not os.path.isdir(os.path.join(path, x)), x.lower()))

        for item_name in items:
            full_path = os.path.join(path, item_name)
            if os.path.isdir(full_path):
                child_item = QTreeWidgetItem(parent_item, [item_name])
                child_item.setData(0, Qt.ItemDataRole.UserRole, full_path)
                child_item.setIcon(0, self.style().standardIcon(self.style().StandardPixmap.SP_DirIcon))
                self.add_items_recursive(child_item, full_path)
            else:
                ext = os.path.splitext(item_name)[1].lower()
                if ext in ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.txt', '.md', '.py', '.json']:
                    child_item = QTreeWidgetItem(parent_item, [item_name])
                    child_item.setData(0, Qt.ItemDataRole.UserRole, full_path)
                    child_item.setIcon(0, self.style().standardIcon(self.style().StandardPixmap.SP_FileIcon))

    def filter_file_tree(self, text):
        # Improved search: hide/show items based on text
        # This is simple recursion to filter navigation
        iterator = QTreeWidgetItemIterator(self.file_tree)
        while iterator.value():
            item = iterator.value()
            if text.lower() in item.text(0).lower():
                item.setHidden(False)
                # Expand parents
                parent = item.parent()
                while parent:
                    parent.setExpanded(True)
                    parent.setHidden(False)
                    parent = parent.parent()
            else:
                item.setHidden(True)
            iterator += 1
        
        if not text:
            # If empty, just show strict tree again? 
            # Ideally reset hidden state, but let's just re-populate or simple reset
            self.populate_file_tree()

    def on_file_clicked(self, item, col):
        path = item.data(0, Qt.ItemDataRole.UserRole)
        if path and os.path.isfile(path):
            self.load_document(path)

    # -------------------------------------------------------------------------
    # Document Loading & Rendering
    # -------------------------------------------------------------------------
    def load_document(self, path):
        self.current_file_path = path
        ext = os.path.splitext(path)[1].lower()
        
        # Clear previous
        self.clear_content_area()
        self.search_results_tree.clear()
        self.content_search_input.clear()

        if ext == '.pdf':
            self.load_pdf(path)
        elif ext in ['.png', '.jpg', '.jpeg', '.bmp', '.gif']:
            self.load_image(path)
        else:
            self.load_text(path)

    def clear_content_area(self):
        # Remove all widgets from layout
        while self.content_layout.count():
            child = self.content_layout.takeAt(0)
            if child.widget():
                child.widget().setParent(None)

    def load_pdf(self, path):
        self.doc_type = 'pdf'
        try:
            self.pdf_doc = fitz.open(path)
            self.current_page_num = 0
            self.page_spin.setMaximum(len(self.pdf_doc))
            self.page_spin.setValue(1)
            self.total_pages_label.setText(f" / {len(self.pdf_doc)}")
            
            # Enable nav controls
            self.page_spin.setEnabled(True)
            self.prev_page_act.setEnabled(True)
            self.next_page_act.setEnabled(True)
            self.zoom_in_act.setEnabled(True)
            self.zoom_out_act.setEnabled(True)

            self.content_layout.addWidget(self.image_label)
            self.render_pdf_page(self.current_page_num)
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to open PDF: {e}")

    def render_pdf_page(self, page_num):
        if not self.pdf_doc:
            return
        
        page = self.pdf_doc[page_num]
        mat = fitz.Matrix(self.zoom_factor, self.zoom_factor)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to QImage
        fmt = QImage.Format.Format_RGB888
        img = QImage(pix.samples, pix.width, pix.height, pix.stride, fmt)
        pixmap = QPixmap.fromImage(img)
        
        self.image_label.setPixmap(pixmap)
        self.page_spin.blockSignals(True)
        self.page_spin.setValue(page_num + 1)
        self.page_spin.blockSignals(False)

    def load_image(self, path):
        self.doc_type = 'image'
        self.pdf_doc = None
        self.content_layout.addWidget(self.image_label)
        
        pixmap = QPixmap(path)
        if not pixmap.isNull():
            self.original_pixmap = pixmap
            self.update_image_zoom()
        
        # Disable PDF nav
        self.page_spin.setEnabled(False)
        self.prev_page_act.setEnabled(False)
        self.next_page_act.setEnabled(False)
        self.total_pages_label.setText("")

    def update_image_zoom(self):
        if not hasattr(self, 'original_pixmap'):
            return
        w = max(1, int(self.original_pixmap.width() * self.zoom_factor))
        h = max(1, int(self.original_pixmap.height() * self.zoom_factor))
        self.image_label.setPixmap(self.original_pixmap.scaled(w, h, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))

    def load_text(self, path):
        self.doc_type = 'text'
        self.pdf_doc = None
        self.content_layout.addWidget(self.text_editor)
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            self.text_editor.setText(content)
        except Exception as e:
             self.text_editor.setText(f"Could not read text file: {e}")

        # Disable zoom/nav for text (could implement font zoom later)
        self.page_spin.setEnabled(False)
        self.prev_page_act.setEnabled(False)
        self.next_page_act.setEnabled(False)
        self.total_pages_label.setText("")

    # -------------------------------------------------------------------------
    # Actions & Navigation
    # -------------------------------------------------------------------------
    def prev_page(self):
        if self.doc_type == 'pdf' and self.pdf_doc:
            if self.current_page_num > 0:
                self.current_page_num -= 1
                self.render_pdf_page(self.current_page_num)

    def next_page(self):
        if self.doc_type == 'pdf' and self.pdf_doc:
            if self.current_page_num < len(self.pdf_doc) - 1:
                self.current_page_num += 1
                self.render_pdf_page(self.current_page_num)

    def jump_to_page(self, val):
        if self.doc_type == 'pdf' and self.pdf_doc:
            target = val - 1
            if 0 <= target < len(self.pdf_doc):
                self.current_page_num = target
                self.render_pdf_page(self.current_page_num)

    def change_zoom(self, delta):
        self.zoom_factor = max(0.2, min(5.0, self.zoom_factor + delta))
        if self.doc_type == 'pdf':
            self.render_pdf_page(self.current_page_num)
        elif self.doc_type == 'image':
            self.update_image_zoom()
        elif self.doc_type == 'text':
             font = self.text_editor.font()
             size = font.pointInfo().pointSize() if hasattr(font.pointInfo(), 'pointSize') else font.pointSize()
             new_size = max(8, size + int(delta * 5))
             
             # Create new font with new size
             new_font = font
             new_font.setPointSize(new_size)
             self.text_editor.setFont(new_font)

    def reset_zoom(self):
        self.zoom_factor = 1.0
        if self.doc_type == 'pdf':
            self.render_pdf_page(self.current_page_num)
        elif self.doc_type == 'image':
            self.update_image_zoom()
        elif self.doc_type == 'text':
            font = self.text_editor.font()
            font.setPointSize(10) # default
            self.text_editor.setFont(font)

    # -------------------------------------------------------------------------
    # Content Search
    # -------------------------------------------------------------------------
    def search_content(self):
        term = self.content_search_input.text()
        if not term or not self.current_file_path:
            return

        self.search_results_tree.clear()

        if self.doc_type == 'pdf':
            self.search_in_pdf(term)
        elif self.doc_type == 'text':
            self.search_in_text(term)

    def search_in_pdf(self, term):
        if not self.pdf_doc:
            return
        
        for i, page in enumerate(self.pdf_doc):
            text_instances = page.search_for(term)
            if text_instances:
                # Add page item
                page_item = QTreeWidgetItem(self.search_results_tree, [f"Page {i+1} ({len(text_instances)} matches)"])
                page_item.setData(0, Qt.ItemDataRole.UserRole, {"page": i})
                
                # Context snippet is hard in PDF without complex extraction logic,
                # just listing matches is a good first step.
                # Or we can try to extract the text block containing it.
                
                # Expand
                page_item.setExpanded(True)

    def search_in_text(self, term):
        # Simple line scan
        content = self.text_editor.toPlainText()
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if term.lower() in line.lower():
                item = QTreeWidgetItem(self.search_results_tree, [f"Line {i+1}: {line.strip()[:40]}..."])
                item.setData(0, Qt.ItemDataRole.UserRole, {"line": i, "term": term})

    def on_search_result_clicked(self, item, col):
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return
        
        if self.doc_type == 'pdf':
            if "page" in data:
                self.current_page_num = data["page"]
                self.render_pdf_page(self.current_page_num)
                # Ideally, draw highlight rects on the QImage here
                self.highlight_pdf_matches(self.content_search_input.text())

        elif self.doc_type == 'text':
            if "line" in data:
                line_num = data["line"]
                
                # Move cursor
                cursor = self.text_editor.textCursor()
                cursor.movePosition(QTextCursor.MoveOperation.Start)
                cursor.movePosition(QTextCursor.MoveOperation.Down, QTextCursor.MoveMode.MoveAnchor, line_num)
                cursor.select(QTextCursor.SelectionType.LineUnderCursor)
                self.text_editor.setTextCursor(cursor)
                self.text_editor.setFocus()

    def highlight_pdf_matches(self, term):
        # Re-render with highlights
        if not self.pdf_doc:
            return
        
        page = self.pdf_doc[self.current_page_num]
        mat = fitz.Matrix(self.zoom_factor, self.zoom_factor)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to QImage to paint on it
        fmt = QImage.Format.Format_RGB888
        img = QImage(pix.samples, pix.width, pix.height, pix.stride, fmt).copy() # Use copy to ensure we can paint
        
        painter = QPainter(img)
        color = QColor(255, 255, 0, 100) # Yellow transparent
        painter.setBrush(color)
        painter.setPen(Qt.PenStyle.NoPen)

        # Get search quads
        quads = page.search_for(term, quads=True)
        for quad in quads:
            # Transform quad to image coordinates
            # Quad is (ul, ur, ll, lr). We need rect.
            rect = quad.rect
            # Scale rect by zoom
            # fitz.Rect * matrix -> new rect
            scaled_rect = rect * mat
            qrect = scaled_rect.irect # integer rect for Qt
            # Correct format for drawRect is x, y, w, h
            painter.drawRect(qrect.x, qrect.y, qrect.width, qrect.height)
            
        painter.end()

        self.image_label.setPixmap(QPixmap.fromImage(img))

from PyQt6.QtWidgets import QTreeWidgetItemIterator

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = SmartViewer()
    
    # Try to maximize
    window.showMaximized()
    
    sys.exit(app.exec())
