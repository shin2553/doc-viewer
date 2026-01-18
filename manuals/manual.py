import os
import fitz  # PyMuPDF
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QHBoxLayout, QWidget, QLineEdit, QPushButton, QTreeWidget, QTreeWidgetItem, QLabel, QSplitter, QScrollArea, QSpinBox
from PyQt5.QtGui import QImage, QPixmap, QPainter
from PyQt5.QtCore import Qt

class PDFManualViewer(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PDF Manual Viewer")
        self.setGeometry(100, 100, 1000, 700)

        # Main layout
        main_layout = QVBoxLayout()

        # Left side: Folder tree and search bar
        left_layout = QVBoxLayout()

        # Search layout for manuals (top bar)
        search_layout = QHBoxLayout()
        self.search_bar = QLineEdit(self)
        self.search_bar.setPlaceholderText("Search manuals...")
        self.search_bar.returnPressed.connect(self.search_manuals)
        search_layout.addWidget(self.search_bar)

        self.search_button = QPushButton("Search")
        self.search_button.clicked.connect(self.search_manuals)
        search_layout.addWidget(self.search_button)

        left_layout.addLayout(search_layout)

        # Folder tree for manuals (with folders at the top and files below)
        self.manual_tree = QTreeWidget()
        self.manual_tree.setHeaderLabel("Manuals")
        self.manual_tree.itemClicked.connect(self.load_manual)
        left_layout.addWidget(self.manual_tree)

        # Right side: PDF viewer (using QScrollArea)
        self.pdf_area = QScrollArea(self)
        self.pdf_label = QLabel(self)
        self.pdf_area.setWidget(self.pdf_label)
        self.pdf_area.setWidgetResizable(True)

        # Splitter to allow resizing of both panels
        splitter = QSplitter(Qt.Horizontal)
        left_widget = QWidget()
        left_widget.setLayout(left_layout)
        splitter.addWidget(left_widget)
        splitter.addWidget(self.pdf_area)

        # Set default split ratio 2:8 (left: right)
        splitter.setSizes([200, 800])

        # Set splitter as the central widget
        container = QWidget()
        container.setLayout(main_layout)
        self.setCentralWidget(container)

        main_layout.addWidget(splitter)

        # Right layout for buttons (Page navigation and zoom options)
        right_layout = QVBoxLayout()

        # First row: Page navigation buttons and number input
        self.nav_layout = QHBoxLayout()
        self.prev_page_button = QPushButton("Previous Page")
        self.prev_page_button.setFixedWidth(self.width() // 4)
        self.prev_page_button.clicked.connect(self.prev_page)
        self.nav_layout.addWidget(self.prev_page_button)

        self.next_page_button = QPushButton("Next Page")
        self.next_page_button.setFixedWidth(self.width() // 4)
        self.next_page_button.clicked.connect(self.next_page)
        self.nav_layout.addWidget(self.next_page_button)

        self.page_input = QSpinBox(self)
        self.page_input.setRange(1, 1)  # Start with 1 page
        self.page_input.valueChanged.connect(self.jump_to_page)
        self.page_input.setFixedWidth(self.width() // 4)
        self.nav_layout.addWidget(self.page_input)

        right_layout.addLayout(self.nav_layout)

        # Second row: Zoom and layout options
        self.zoom_layout = QHBoxLayout()

        self.zoom_in_button = QPushButton("Zoom In")
        self.zoom_in_button.setFixedWidth(self.width() // 4)
        self.zoom_in_button.clicked.connect(self.zoom_in)
        self.zoom_layout.addWidget(self.zoom_in_button, alignment=Qt.AlignRight)

        self.zoom_out_button = QPushButton("Zoom Out")
        self.zoom_out_button.setFixedWidth(self.width() // 4)
        self.zoom_out_button.clicked.connect(self.zoom_out)
        self.zoom_layout.addWidget(self.zoom_out_button, alignment=Qt.AlignRight)

        self.fit_button = QPushButton("Fit")
        self.fit_button.setFixedWidth(self.width() // 4)
        self.fit_button.clicked.connect(self.fit_to_window)
        self.zoom_layout.addWidget(self.fit_button, alignment=Qt.AlignRight)

        right_layout.addLayout(self.zoom_layout)

        # Third row: Layout options for page view (single/double)
        self.page_layout_option = QHBoxLayout()

        self.single_page_button = QPushButton("Single Page")
        self.single_page_button.setFixedWidth(self.width() // 4)
        self.single_page_button.clicked.connect(self.set_single_page_layout)
        self.page_layout_option.addWidget(self.single_page_button)

        self.double_page_button = QPushButton("Double Page")
        self.double_page_button.setFixedWidth(self.width() // 4)
        self.double_page_button.clicked.connect(self.set_double_page_layout)
        self.page_layout_option.addWidget(self.double_page_button)

        right_layout.addLayout(self.page_layout_option)

        main_layout.addLayout(right_layout)

        # Search bar for document text (second row)
        self.doc_search_layout = QVBoxLayout()
        self.doc_search_bar = QLineEdit(self)
        self.doc_search_bar.setPlaceholderText("Search in document...")
        self.doc_search_button = QPushButton("Search")
        self.doc_search_button.clicked.connect(self.search_in_document)

        self.doc_search_layout.addWidget(self.doc_search_bar)
        self.doc_search_layout.addWidget(self.doc_search_button)

        left_layout.addLayout(self.doc_search_layout)

        # Initialize PDF-related variables
        self.pdf_path = ""
        self.doc = None
        self.current_page = 1
        self.search_results = []
        self.zoom_factor = 1.0  # Initial zoom factor
        self.max_zoom_factor = 5.0  # Max zoom factor
        self.is_double_page_layout = False

        # Load manuals on start
        self.load_manuals()

        # Maximize window on startup
        self.showMaximized()


    def get_full_path(self, item):
        parts = []
        while item is not None:
            parts.insert(0, item.text(0))
            item = item.parent()
        return os.path.join(*parts)

    def load_manuals(self):
        self.manual_tree.clear()
        manual_dir = "manuals/"

        if not os.path.exists(manual_dir):
            os.makedirs(manual_dir)

        # First, process directories and then files
        for root, dirs, files in os.walk(manual_dir):
            relative_path = os.path.relpath(root, manual_dir)
            parent_item = self.get_parent_item(relative_path)

            # Add directories first, so they appear at the top
            for dir_name in dirs:
                dir_item = QTreeWidgetItem(parent_item, [dir_name])

            # Then add files below the directories
            for file_name in files:
                if file_name.endswith(".pdf"):
                    item = QTreeWidgetItem(parent_item, [file_name])

    def get_parent_item(self, relative_path):
        if relative_path == ".":
            return self.manual_tree.invisibleRootItem()

        parts = relative_path.split(os.sep)
        parent_item = self.manual_tree.invisibleRootItem()
        for part in parts:
            match = None
            for i in range(parent_item.childCount()):
                if parent_item.child(i).text(0) == part:
                    match = parent_item.child(i)
                    break
            if match is None:
                match = QTreeWidgetItem(parent_item, [part])
            parent_item = match
        return parent_item

    def search_manuals(self):
        query = self.search_bar.text().lower()
        self.manual_tree.clear()  # 이전 검색 결과를 지운다
        manual_dir = "manuals/"

        for root, dirs, files in os.walk(manual_dir):
            relative_path = os.path.relpath(root, manual_dir)
            parent_item = self.get_parent_item(relative_path)

            # 파일명을 검색하여 매칭되는 파일을 표시
            for file_name in files:
                if file_name.endswith(".pdf") and query in file_name.lower():
                    # 파일명이 검색어를 포함하는 경우
                    item = QTreeWidgetItem(parent_item, [file_name])


    def load_manual(self, item):
        manual_path = os.path.join("manuals", self.get_full_path(item))
        absolute_path = os.path.abspath(manual_path)

        if os.path.isdir(absolute_path):
            self.load_manuals()
        elif os.path.isfile(absolute_path) and absolute_path.endswith(".pdf"):
            print(f"Loading PDF: {absolute_path}")
            self.pdf_path = absolute_path
            self.current_page = 1
            self.load_pdf_pages()

    def load_pdf_pages(self):
        if not self.pdf_path:
            return

        self.doc = fitz.open(self.pdf_path)
        total_pages = self.doc.page_count
        self.page_input.setRange(1, total_pages)
        self.display_page(self.current_page)

    def display_page(self, page_num):
        if self.doc is None or page_num < 1 or page_num > self.doc.page_count:
            return

        if self.is_double_page_layout:
            if page_num + 1 <= self.doc.page_count:
                pixmap1 = self.render_page(page_num)
                pixmap2 = self.render_page(page_num + 1)
                combined_pixmap = self.combine_pages(pixmap1, pixmap2)
                self.pdf_label.setPixmap(combined_pixmap)
        else:
            pixmap = self.render_page(page_num)
            self.pdf_label.setPixmap(pixmap)
            self.pdf_label.setAlignment(Qt.AlignCenter)

    def render_page(self, page_num):
        page = self.doc.load_page(page_num - 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(self.zoom_factor, self.zoom_factor))  # Apply zoom factor
        img = QImage(pix.samples, pix.width, pix.height, pix.stride, QImage.Format_RGB888)
        return QPixmap.fromImage(img)

    def combine_pages(self, pixmap1, pixmap2):
        width = pixmap1.width() + pixmap2.width()
        height = max(pixmap1.height(), pixmap2.height())
        combined_pixmap = QPixmap(width, height)
        combined_pixmap.fill(Qt.white)

        painter = QPainter(combined_pixmap)
        painter.drawPixmap(0, 0, pixmap1)
        painter.drawPixmap(pixmap1.width(), 0, pixmap2)
        painter.end()

        return combined_pixmap

    def prev_page(self):
        # Ensure that a PDF document is loaded
        if self.doc is None:
            print("No PDF document loaded.")
            return  # Prevent moving to the next page if no document is loaded
        if self.current_page > 1:
            self.current_page -= 1
            self.display_page(self.current_page)

    def next_page(self):
        # Ensure that a PDF document is loaded
        if self.doc is None:
            print("No PDF document loaded.")
            return  # Prevent moving to the next page if no document is loaded

        if self.current_page < self.doc.page_count:
            self.current_page += 1
            self.display_page(self.current_page)



    def zoom_in(self):
        if self.zoom_factor < self.max_zoom_factor:
            self.zoom_factor *= 1.1
        self.display_page(self.current_page)

    def zoom_out(self):
        if self.zoom_factor > 1:
            self.zoom_factor /= 1.1
        self.display_page(self.current_page)

    def fit_to_window(self):
        self.zoom_factor = 1.0
        self.display_page(self.current_page)

    def set_single_page_layout(self):
        self.is_double_page_layout = False
        self.display_page(self.current_page)

    def set_double_page_layout(self):
        self.is_double_page_layout = True
        self.display_page(self.current_page)

    def jump_to_page(self):
        self.current_page = self.page_input.value()
        self.display_page(self.current_page)

    def search_in_document(self):
        search_term = self.doc_search_bar.text().lower()
        if self.doc is None:
            return

        self.search_results = []
        for page_num in range(self.doc.page_count):
            page = self.doc.load_page(page_num)
            text = page.get_text("text")
            if search_term in text.lower():
                self.search_results.append(page_num + 1)

        print(f"Found occurrences of '{search_term}' on pages: {self.search_results}")
        self.highlight_search_terms(search_term)

    def highlight_search_terms(self, search_term):
        if self.doc is None:
            return

        for page_num in self.search_results:
            page = self.doc.load_page(page_num - 1)
            text_instances = page.search_for(search_term)

            # Ensure text_instances is not None and contains results
            if text_instances:
                for inst in text_instances:
                    page.add_highlight_annot(inst)

        self.display_page(self.current_page)


if __name__ == "__main__":
    app = QApplication([])
    window = PDFManualViewer()
    window.show()
    app.exec_()
