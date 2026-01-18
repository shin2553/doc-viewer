/* ADOBE PDF EMBED API IMPLEMENTATION */
const ADOBE_CLIENT_ID = "f1b3bafa151c4641ad35c1cf7bac60db"; // Active Key

const app = {
    // Image State
    imgState: { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0 },
    // Text State
    textState: { fontSize: 14, matches: [], currentIndex: -1, originalText: "" },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadFiles();

        if (window.AdobeDC) this.adobeReady = true;
        else document.addEventListener("adobe_dc_view_sdk.ready", () => this.adobeReady = true);
    },

    cacheDOM() {
        this.dom = {
            sidebarLeft: document.getElementById('sidebar-left'),
            btnToggleLeft: document.getElementById('toggle-sidebar-left'),
            fileList: document.getElementById('file-list'),
            fileSearch: document.getElementById('file-search'),
            groupBy: document.getElementById('group-by'),
            sortBy: document.getElementById('sort-by'),
            activeFilterDisplay: document.getElementById('active-filter-display'),
            clearFilterBtn: document.getElementById('clear-filter'),

            // Viewers
            viewerStage: document.getElementById('viewer-stage'),
            pdfContainer: document.getElementById('pdf-container'),
            imageViewer: document.getElementById('image-viewer'),
            textViewer: document.getElementById('text-viewer'),
            csvViewer: document.getElementById('csv-viewer'),
            mediaViewer: document.getElementById('media-viewer'),
            welcomeMsg: document.getElementById('welcome-message'),

            // Controls
            imageControls: document.getElementById('image-controls'),
            textControls: document.getElementById('text-controls'),

            // Image Buttons
            btnZoomIn: document.getElementById('zoom-in'),
            btnZoomOut: document.getElementById('zoom-out'),
            btnZoomReset: document.getElementById('zoom-reset'),

            // Text Buttons
            textSearchInput: document.getElementById('text-search-input'),
            btnTextPrev: document.getElementById('text-search-prev'),
            btnTextNext: document.getElementById('text-search-next'),
            textSearchStats: document.getElementById('text-search-stats'),
            btnFontDec: document.getElementById('font-decrease'),
            btnFontInc: document.getElementById('font-increase'),
            fontDisplay: document.getElementById('font-size-display'),
        };
    },

    bindEvents() {
        this.dom.btnToggleLeft.addEventListener('click', () => {
            this.dom.sidebarLeft.classList.toggle('collapsed');
        });

        this.dom.fileSearch.addEventListener('input', () => this.renderFileList());

        this.dom.groupBy.addEventListener('change', (e) => {
            this.state.groupBy = e.target.value;
            this.renderFileList();
        });

        this.dom.sortBy.addEventListener('change', (e) => {
            this.state.sortBy = e.target.value;
            this.renderFileList();
        });

        this.dom.clearFilterBtn.addEventListener('click', () => {
            this.dom.fileSearch.value = "";
            this.renderFileList();
        });

        // Image Controls
        this.dom.btnZoomIn.addEventListener('click', () => this.zoomImage(0.2));
        this.dom.btnZoomOut.addEventListener('click', () => this.zoomImage(-0.2));
        this.dom.btnZoomReset.addEventListener('click', () => this.resetImage());

        const imgView = this.dom.imageViewer;
        imgView.addEventListener('wheel', (e) => {
            if (imgView.classList.contains('hidden')) return;
            e.preventDefault();
            this.zoomImage(e.deltaY * -0.001);
        });
        imgView.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.imgState.start = { x: e.clientX - this.imgState.pointX, y: e.clientY - this.imgState.pointY };
            this.imgState.panning = true;
            imgView.style.cursor = 'grabbing';
        });
        imgView.addEventListener('mousemove', (e) => {
            if (!this.imgState.panning) return;
            e.preventDefault();
            this.imgState.pointX = e.clientX - this.imgState.start.x;
            this.imgState.pointY = e.clientY - this.imgState.start.y;
            this.updateImageTransform();
        });
        imgView.addEventListener('mouseup', () => { this.imgState.panning = false; imgView.style.cursor = 'grab'; });
        imgView.addEventListener('mouseleave', () => { this.imgState.panning = false; imgView.style.cursor = 'grab'; });

        // Text Controls
        this.dom.textSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) this.navigateSearch(-1);
                else this.navigateSearch(1);
            }
        });
        this.dom.textSearchInput.addEventListener('input', () => this.performTextSearch());
        this.dom.btnTextNext.addEventListener('click', () => this.navigateSearch(1));
        this.dom.btnTextPrev.addEventListener('click', () => this.navigateSearch(-1));
        this.dom.btnFontInc.addEventListener('click', () => this.changeFontSize(2));
        this.dom.btnFontDec.addEventListener('click', () => this.changeFontSize(-2));
    },

    state: { groupBy: 'none', sortBy: 'name', activeGroupFilter: null },

    async loadFiles() {
        try {
            // Add cache buster to prevent browser from serving stale JSON
            const res = await fetch('/api/files?t=' + new Date().getTime());
            this.files = await res.json();
            this.renderFileList();
        } catch (e) {
            console.error("Failed to load files:", e);
        }
    },

    getFileIcon(type) {
        const map = {
            'pdf': 'fas fa-file-pdf',
            'png': 'fas fa-file-image', 'jpg': 'fas fa-file-image', 'jpeg': 'fas fa-file-image', 'gif': 'fas fa-file-image',
            'mp4': 'fas fa-file-video', 'mp3': 'fas fa-file-audio', 'wav': 'fas fa-file-audio',
            'txt': 'fas fa-file-alt', 'md': 'fab fa-markdown',
            'py': 'fab fa-python', 'js': 'fab fa-js', 'html': 'fab fa-html5', 'css': 'fab fa-css3-alt',
            'csv': 'fas fa-file-csv', 'json': 'fas fa-file-code', 'zip': 'fas fa-file-archive', 'log': 'fas fa-file-alt',
            'java': 'fab fa-java', 'go': 'fab fa-google', 'rs': 'fab fa-rust', 'dockerfile': 'fab fa-docker'
        };
        return map[type.toLowerCase()] || 'fas fa-file';
    },

    getSafeUrl(path) {
        return "/manuals/" + path.split('/').map(encodeURIComponent).join('/');
    },

    // --- RENDERING ---
    renderFileList() {
        const list = this.dom.fileList;
        list.innerHTML = '';
        list.className = 'file-tree';

        if (!this.files) return;

        let files = this.files.filter(f => f.name.toLowerCase().includes(this.dom.fileSearch.value.toLowerCase()));

        this.sortFiles(files);

        if (this.state.groupBy !== 'none' && this.state.groupBy !== 'folder') {
            this.renderGroupedList(files, list);
        } else if (this.dom.fileSearch.value) {
            // Search active -> Flat list
            this.renderFlatList(files, list);
        } else {
            // Default Folder Tree
            const tree = this.buildFileTree(files);
            this.renderTree(tree, list);
        }
    },

    sortFiles(files) {
        const s = this.state.sortBy;
        files.sort((a, b) => {
            if (s === 'name') return a.name.localeCompare(b.name);
            if (s === 'size') return (b.size || 0) - (a.size || 0);
            if (s === 'date') return (b.mtime || 0) - (a.mtime || 0);
            return 0;
        });
    },

    buildFileTree(files) {
        const root = {};
        files.forEach(file => {
            const parts = (file.path || file.name).split(/[/\\]/);
            let current = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) current[part] = { __children: {} };
                current = current[part].__children;
            }
            const fileName = parts[parts.length - 1];
            current[fileName] = { __file: file };
        });
        return root;
    },

    renderTree(node, container) {
        const keys = Object.keys(node).sort((a, b) => {
            const itemA = node[a];
            const itemB = node[b];
            const isFolderA = !!itemA.__children;
            const isFolderB = !!itemB.__children;

            if (isFolderA && !isFolderB) return -1;
            if (!isFolderA && isFolderB) return 1;

            if (!isFolderA && !isFolderB) {
                const fA = itemA.__file;
                const fB = itemB.__file;
                if (this.state.sortBy === 'size') return (fB.size || 0) - (fA.size || 0);
                if (this.state.sortBy === 'date') return (fB.mtime || 0) - (fA.mtime || 0);
                return a.localeCompare(b);
            }
            return a.localeCompare(b);
        });

        keys.forEach(key => {
            const item = node[key];
            const li = document.createElement('li');

            if (item.__file) {
                const file = item.__file;
                const iconClass = this.getFileIcon(file.type);
                const div = document.createElement('div');
                div.className = 'tree-item leaf';
                div.addEventListener('click', (e) => { this.loadFile(file); });
                div.innerHTML = `<i class="${iconClass} tree-icon"></i><span>${key}</span>`;
                li.appendChild(div);
            } else {
                const div = document.createElement('div');
                div.className = 'tree-item folder-row';
                div.innerHTML = `<span class="tree-toggle"><i class="fas fa-chevron-right"></i></span>
                                 <i class="fas fa-folder tree-icon"></i><span>${key}</span>`;
                const ul = document.createElement('ul');
                ul.className = 'tree-children';
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    ul.classList.toggle('open');
                    div.classList.toggle('expanded');
                    const icon = div.querySelector('.tree-toggle i');
                    icon.className = ul.classList.contains('open') ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
                });
                li.appendChild(div);
                li.appendChild(ul);
                this.renderTree(item.__children, ul);
            }
            container.appendChild(li);
        });
    },

    renderFlatList(files, container) {
        files.forEach(file => {
            const li = document.createElement('li');
            const div = document.createElement('div');
            div.className = 'tree-item leaf';
            div.addEventListener('click', () => this.loadFile(file));
            div.innerHTML = `<i class="${this.getFileIcon(file.type)} tree-icon"></i><span>${file.name}</span>`;
            li.appendChild(div);
            container.appendChild(li);
        });
    },

    renderGroupedList(files, container) {
        const groups = {};
        files.forEach(file => {
            let key = "Other";
            if (this.state.groupBy === 'type') {
                key = file.type.toUpperCase() || "UNKNOWN";
            } else if (this.state.groupBy === 'date') {
                const date = new Date(file.mtime * 1000);
                key = date.toLocaleDateString();
            } else if (this.state.groupBy === 'size') {
                const kb = file.size / 1024;
                if (kb < 10) key = "Small (<10KB)";
                else if (kb < 1000) key = "Medium (<1MB)";
                else key = "Large (>1MB)";
            }
            if (!groups[key]) groups[key] = [];
            groups[key].push(file);
        });

        const sortedKeys = Object.keys(groups).sort();
        sortedKeys.forEach(groupName => {
            const groupHeader = document.createElement('div');
            groupHeader.className = 'file-group-header';
            groupHeader.innerHTML = `<span>${groupName}</span> <span class="group-count">${groups[groupName].length}</span>`;
            container.appendChild(groupHeader);

            const ul = document.createElement('ul');
            ul.style.paddingLeft = '10px';
            this.renderFlatList(groups[groupName], ul);
            container.appendChild(ul);
        });
    },

    // --- VIEWER ---
    loadFile(file) {
        console.log("Loading file:", file.name);
        this.dom.welcomeMsg.classList.add('hidden');
        this.dom.pdfContainer.classList.add('hidden');
        this.dom.imageViewer.classList.add('hidden');
        this.dom.textViewer.classList.add('hidden');
        this.dom.csvViewer.classList.add('hidden');
        this.dom.mediaViewer.classList.add('hidden');

        this.dom.imageControls.classList.add('hidden');
        this.dom.textControls.classList.add('hidden');

        const safeUrl = this.getSafeUrl(file.path);
        const textExtensions = ['txt', 'py', 'js', 'md', 'html', 'css', 'json', 'log', 'xml', 'yaml', 'yml', 'ini', 'conf', 'sh', 'bat', 'c', 'cpp', 'h', 'hpp', 'java', 'go', 'rs', 'sql', 'gradle', 'properties', 'dockerfile', 'gitignore'];

        if (file.type === 'pdf') {
            this.loadPDF(file);
        } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(file.type)) {
            this.dom.imageViewer.classList.remove('hidden');
            this.dom.imageControls.classList.remove('hidden');
            this.resetImage();

            // Ensuring img container has size and img is visible
            this.dom.imageViewer.innerHTML = `<img src="${safeUrl}" 
                style="display: block; max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none;"
                class="zoomable-image"
                draggable="false"
                onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding:20px; color:#ff6b6b; font-weight:bold;\\'>Image Load Failed.<br>URL: '+ this.src + '</div>'">`;
        } else if (['csv'].includes(file.type)) {
            this.dom.csvViewer.classList.remove('hidden');
            this.loadCSV(file);
        } else if (textExtensions.includes(file.type)) {
            this.dom.textViewer.classList.remove('hidden');
            this.dom.textControls.classList.remove('hidden');
            this.loadText(file);
        } else if (['mp4', 'webm'].includes(file.type)) {
            this.dom.mediaViewer.classList.remove('hidden');
            this.dom.mediaViewer.innerHTML = `<video controls src="${safeUrl}" style="width:100%"></video>`;
        } else {
            // Default fallback to text for ANY other file (like .log if missed by checklist)
            this.dom.textViewer.classList.remove('hidden');
            this.dom.textControls.classList.remove('hidden');
            this.loadText(file);
        }
    },

    async loadText(file) {
        try {
            const res = await fetch(this.getSafeUrl(file.path));
            if (!res.ok) throw new Error(res.statusText + " (" + res.status + ")");
            const text = await res.text();

            this.textState.originalText = text;
            this.dom.textViewer.innerHTML = this.escapeHtml(text);
            this.dom.textViewer.style.fontSize = this.textState.fontSize + 'px';
            this.dom.fontDisplay.innerText = this.textState.fontSize + 'px';

            this.dom.textSearchInput.value = "";
            this.dom.textSearchStats.innerText = "0/0";
        } catch (e) {
            this.dom.textViewer.innerText = "Error loading text file: " + e.message;
        }
    },

    async loadCSV(file) {
        try {
            const res = await fetch(this.getSafeUrl(file.path));
            const text = await res.text();

            const rows = text.split('\n').map(row => row.split(','));
            let html = `
            <table style="width: 100%; border-collapse: collapse; color: #ddd; font-family: sans-serif; font-size: 14px;">
                <thead style="background: #252526; position: sticky; top: 0;">`;

            if (rows.length > 0) {
                html += "<tr>";
                rows[0].forEach(col => {
                    html += `<th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #3e3e3e; font-weight: 600;">${col.trim()}</th>`;
                });
                html += "</tr></thead><tbody>";
                for (let i = 1; i < rows.length; i++) {
                    if (!rows[i].join('').trim()) continue;
                    html += `<tr style="border-bottom: 1px solid #333;">`;
                    rows[i].forEach(col => {
                        html += `<td style="padding: 8px 12px; border-bottom: 1px solid #333;">${col.trim()}</td>`;
                    });
                    html += "</tr>";
                }
                html += "</tbody></table>";
            }
            this.dom.csvViewer.innerHTML = `<div style="padding: 20px; overflow: auto; height: 100%; box-sizing: border-box;">${html}</div>`;
        } catch (e) {
            this.dom.csvViewer.innerHTML = "Error loading CSV: " + e.message;
        }
    },

    loadPDF(file) {
        this.dom.pdfContainer.classList.remove('hidden');
        if (!this.adobeReady) {
            if (!this._retryAdobe) {
                this._retryAdobe = true;
                setTimeout(() => this.loadPDF(file), 1000);
                return;
            }
            return;
        }
        this._retryAdobe = false;

        const adobeDCView = new AdobeDC.View({
            clientId: ADOBE_CLIENT_ID,
            divId: "pdf-container"
        });

        adobeDCView.previewFile({
            content: { location: { url: this.getSafeUrl(file.path) } },
            metaData: { fileName: file.name }
        }, {
            embedMode: "FULL_WINDOW",
            defaultViewMode: "FIT_WIDTH",
            showAnnotationTools: true,
            showLeftHandPanel: true,
            showDownloadPDF: true,
            showPrintPDF: true,
        });
    },

    changeFontSize(delta) {
        this.textState.fontSize += delta;
        if (this.textState.fontSize < 8) this.textState.fontSize = 8;
        if (this.textState.fontSize > 40) this.textState.fontSize = 40;
        this.dom.textViewer.style.fontSize = this.textState.fontSize + 'px';
        this.dom.fontDisplay.innerText = this.textState.fontSize + 'px';
    },

    escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    performTextSearch() {
        const query = this.dom.textSearchInput.value;
        const content = this.textState.originalText;

        if (!query) {
            this.dom.textViewer.innerHTML = this.escapeHtml(content);
            this.textState.matches = [];
            this.textState.currentIndex = -1;
            this.dom.textSearchStats.innerText = "0/0";
            return;
        }
        const safeContent = this.escapeHtml(content);
        const safeQuery = this.escapeHtml(query);
        const regex = new RegExp(`(${safeQuery})`, 'gi');

        let matchCount = 0;
        const highlighted = safeContent.replace(regex, (match) => {
            matchCount++;
            return `<mark class="search-match" id="match-${matchCount - 1}">${match}</mark>`;
        });

        this.dom.textViewer.innerHTML = highlighted;
        this.textState.matches = matchCount;
        this.textState.currentIndex = -1;

        if (matchCount > 0) {
            this.navigateSearch(1);
        } else {
            this.dom.textSearchStats.innerText = "0/0";
        }
    },

    navigateSearch(direction) {
        if (this.textState.matches === 0) return;
        if (this.textState.currentIndex >= 0) {
            const curr = document.getElementById(`match-${this.textState.currentIndex}`);
            if (curr) curr.classList.remove('active');
        }
        if (direction === 1) {
            this.textState.currentIndex++;
            if (this.textState.currentIndex >= this.textState.matches) this.textState.currentIndex = 0;
        } else {
            this.textState.currentIndex--;
            if (this.textState.currentIndex < 0) this.textState.currentIndex = this.textState.matches - 1;
        }
        const next = document.getElementById(`match-${this.textState.currentIndex}`);
        if (next) {
            next.classList.add('active');
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.dom.textSearchStats.innerText = `${this.textState.currentIndex + 1}/${this.textState.matches}`;
        }
    },

    // --- ZOOM LOGIC ---
    zoomImage(delta) {
        this.imgState.scale += delta;
        if (this.imgState.scale < 0.1) this.imgState.scale = 0.1;
        if (this.imgState.scale > 5) this.imgState.scale = 5;
        this.updateImageTransform();
    },

    resetImage() {
        this.imgState = { scale: 1, panning: false, pointX: 0, pointY: 0 };
        this.updateImageTransform();
    },

    updateImageTransform() {
        const img = this.dom.imageViewer.querySelector('img');
        if (img) {
            img.style.transform = `translate(${this.imgState.pointX}px, ${this.imgState.pointY}px) scale(${this.imgState.scale})`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
