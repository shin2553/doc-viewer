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
        this.bindAboutLogic();
        this.bindManagePathsLogic();
        this.handleHashChange();

        if (window.AdobeDC) this.adobeReady = true;
        else document.addEventListener("adobe_dc_view_sdk.ready", () => this.adobeReady = true);
    },

    cacheDOM() {
        this.dom = {
            sidebarLeft: document.getElementById('sidebar-left'),
            btnToggleLeft: document.getElementById('toggle-sidebar-left'),
            btnAddFolder: document.getElementById('add-folder-btn'), // New Button
            btnManageFolders: document.getElementById('manage-folders-btn'),
            managePathsModal: document.getElementById('manage-paths-modal'),
            managePathsCloseIcon: document.getElementById('manage-paths-close-icon'),
            managePathsBtnClose: document.getElementById('manage-paths-btn-close'),
            folderListContainer: document.getElementById('folder-list-container'),
            fileList: document.getElementById('file-list'),
            fileSearch: document.getElementById('file-search'),
            groupBy: document.getElementById('group-by'),
            sortBy: document.getElementById('sort-by'),
            activeFilterDisplay: document.getElementById('active-filter-display'),
            activeFilterDisplay: document.getElementById('active-filter-display'),
            clearFilterBtn: document.getElementById('clear-filter'),

            // Explorer (Split View)
            tabLibraries: document.getElementById('tab-libraries'),
            tabExplorer: document.getElementById('tab-explorer'),
            viewLibraries: document.getElementById('view-libraries'),
            viewExplorer: document.getElementById('view-explorer'),

            explorerTreeRoot: document.getElementById('explorer-tree-root'),
            explorerSeparator: document.querySelector('.explorer-separator'),
            explorerTreeContainer: document.getElementById('explorer-tree-container'),
            explorerFileContainer: document.getElementById('explorer-file-container'),
            explorerCurrentPath: document.getElementById('explorer-current-path'),
            explorerFileList: document.getElementById('explorer-file-list'),

            // Viewers
            viewerStage: document.getElementById('viewer-stage'),
            pdfContainer: document.getElementById('pdf-container'),
            imageViewer: document.getElementById('image-viewer'),
            textViewer: document.getElementById('text-viewer'),
            csvViewer: document.getElementById('csv-viewer'),
            mediaViewer: document.getElementById('media-viewer'),
            fileDetailsViewer: document.getElementById('file-details-viewer'),
            btnFileInfo: document.getElementById('btn-file-info'),
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

        if (this.dom.btnAddFolder) {
            this.dom.btnAddFolder.addEventListener('click', () => {
                const btn = this.dom.btnAddFolder;
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Selecting...';
                btn.disabled = true;

                fetch('/api/add_folder')
                    .then(response => response.json())
                    .then(data => {
                        btn.innerHTML = originalText;
                        btn.disabled = false;

                        if (data.status === 'success') {
                            // alert('Folder added successfully: ' + data.path); // Optional: Non-blocking toast is better but alert is fine for now
                            this.loadFiles(); // Reload file list
                        } else if (data.status === 'exists') {
                            alert('Folder is already in the list: ' + data.path);
                        } else if (data.status === 'cancelled') {
                            // User cancelled, do nothing
                        } else {
                            alert('Error: ' + (data.message || 'Unknown error'));
                        }
                    })
                    .catch(error => {
                        console.error('Error adding folder:', error);
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        alert('Failed to open folder picker.');
                    });
            });
        }

        this.dom.fileSearch.addEventListener('input', (e) => {
            if (this.state.searchMode === 'content') {
                this.handleContentSearch(e.target.value);
            } else {
                this.renderFileList();
            }
        });

        // Search Mode Toggle
        document.querySelectorAll('input[name="search-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.state.searchMode = e.target.value;
                if (this.dom.fileSearch.value) {
                    if (this.state.searchMode === 'content') this.handleContentSearch(this.dom.fileSearch.value);
                    else this.renderFileList();
                } else {
                    this.renderFileList();
                }
            });
        });

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

        if (this.dom.managePathsCloseIcon) {
            this.dom.managePathsCloseIcon.onclick = () => this.dom.managePathsModal.classList.add('hidden');
        }
        if (this.dom.managePathsBtnClose) {
            this.dom.managePathsBtnClose.onclick = () => this.dom.managePathsModal.classList.add('hidden');
        }

        // Info Button
        if (this.dom.btnFileInfo) {
            this.dom.btnFileInfo.onclick = () => this.toggleFileDetails();
        }

        // Explorer Tabs
        if (this.dom.tabLibraries) {
            this.dom.tabLibraries.addEventListener('click', () => this.switchTab('libraries'));
            this.dom.tabExplorer.addEventListener('click', () => this.switchTab('explorer'));
        }

        // Explorer Resizer
        if (this.dom.explorerSeparator) {
            let isResizing = false;
            this.dom.explorerSeparator.addEventListener('mousedown', (e) => {
                isResizing = true;
                document.body.style.cursor = 'row-resize';
                e.preventDefault(); // Prevent text selection
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const containerRect = this.dom.sidebarLeft.getBoundingClientRect(); // relative to sidebar
                // Actually need relative to view-explorer or sidebar
                // Simple approach: Set flex-basis of tree container based on mouse Y relative to sidebar top
                const sidebarTop = this.dom.sidebarLeft.getBoundingClientRect().top;
                const newHeight = e.clientY - sidebarTop - 48; // aprox header height adjustment

                // Min/Max constraints
                if (newHeight > 100 && newHeight < window.innerHeight - 200) {
                    this.dom.explorerTreeContainer.style.flex = `0 0 ${newHeight}px`;
                }
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = 'default';
                }
            });
        }

        // Add Network Path Button
        const btnAddNet = document.getElementById('add-network-path-btn');
        if (btnAddNet) {
            btnAddNet.addEventListener('click', async () => {
                const path = prompt("Enter Network Path (e.g. \\\\server\\share):");
                if (path) {
                    try {
                        const res = await fetch('/api/add_network_path', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: path })
                        });
                        const data = await res.json();
                        if (data.status === 'success') {
                            this.loadExplorerDrives(); // Refresh
                        } else {
                            alert('Error: ' + (data.message || 'Unknown error'));
                        }
                    } catch (e) {
                        alert('Failed to add path: ' + e.message);
                    }
                }
            });
        }
    },

    state: { groupBy: 'none', sortBy: 'name', activeGroupFilter: null, searchMode: 'name', explorerPath: '', expandedPaths: new Set() },
    explorerLoaded: false,

    // --- EXPLORER UNIFIED TREE VIEW LOGIC ---
    switchTab(tab) {
        if (tab === 'libraries') {
            this.dom.tabLibraries.classList.add('active');
            this.dom.tabExplorer.classList.remove('active');
            // Hide/Show containers
            this.dom.viewLibraries.classList.remove('hidden');
            this.dom.viewLibraries.style.display = 'flex';
            this.dom.viewExplorer.classList.add('hidden');
            this.dom.viewExplorer.style.display = 'none'; // Ensure CSS doesn't override
        } else {
            this.dom.tabLibraries.classList.remove('active');
            this.dom.tabExplorer.classList.add('active');
            // Hide/Show containers
            this.dom.viewLibraries.classList.add('hidden');
            this.dom.viewLibraries.style.display = 'none';
            this.dom.viewExplorer.classList.remove('hidden');
            this.dom.viewExplorer.style.display = 'flex';

            // Load root if empty
            if (!this.explorerLoaded) {
                this.loadExplorerDrives();
                this.explorerLoaded = true;
            }
        }
    },

    async loadExplorerDrives() {
        const root = document.getElementById('explorer-list');
        if (!root) return;

        root.innerHTML = '<li style="padding:10px; color:#aaa;">Loading Drives...</li>';
        try {
            const res = await fetch('/api/explore'); // No path = drives
            if (!res.ok) throw new Error("Failed");
            const drives = await res.json();

            // Render drives as root nodes
            this.renderLazyTreeItems(drives, root);
        } catch (e) {
            root.innerHTML = `<li style="padding:10px; color:red;">${e.message}</li>`;
        }
    },

    // Generic Lazy Tree Renderer
    renderLazyTreeItems(items, containerUl) {
        containerUl.innerHTML = '';
        if (items.length === 0) {
            containerUl.innerHTML = '<li style="padding-left:20px; color:#555; font-style:italic;">(Empty)</li>';
            return;
        }

        // Sort: Folders/Drives first, then Files
        items.sort((a, b) => {
            const isDirA = (typeof a === 'string') || a.is_dir;
            const isDirB = (typeof b === 'string') || b.is_dir;
            if (isDirA !== isDirB) return isDirA ? -1 : 1;

            const nameA = a.name || a;
            const nameB = b.name || b;
            return nameA.localeCompare(nameB);
        });

        items.forEach(item => {
            const isDrive = typeof item === 'string';
            const name = isDrive ? item : item.name;
            const path = isDrive ? item : item.path;
            const isDir = isDrive || item.is_dir;

            const li = document.createElement('li');
            li.className = isDir ? 'tree-node' : 'file-list-item'; // Reuse existing styles
            // Slight style adjustment for unification
            if (!isDir) li.style.paddingLeft = "24px";

            // Content Container
            const contentDiv = document.createElement('div');
            contentDiv.style.display = 'flex';
            contentDiv.style.alignItems = 'center';
            contentDiv.style.cursor = 'pointer';
            contentDiv.style.padding = '4px 0';

            // Icon Logic
            let iconClass = 'fas fa-file';
            if (isDir) {
                iconClass = isDrive ? 'fas fa-hdd' : 'fas fa-folder';
            } else {
                const ext = name.split('.').pop();
                iconClass = this.getFileIcon(ext);
            }

            if (isDir) {
                // Folder Row: [Toggle] [Icon] [Name]
                contentDiv.className = 'tree-content';

                // Toggle Icon
                const toggle = document.createElement('span');
                toggle.className = 'tree-toggle'; // Reuse style
                toggle.innerHTML = '<i class="fas fa-caret-right"></i>';

                // Label
                const icon = document.createElement('i');
                icon.className = `${iconClass} tree-icon`;

                const label = document.createElement('span');
                label.innerText = name;

                contentDiv.appendChild(toggle);
                contentDiv.appendChild(icon);
                contentDiv.appendChild(label);

                // Children Container (Hidden)
                const childrenUl = document.createElement('ul');
                childrenUl.className = 'tree-children'; // Reuse style

                // Toggle Event
                const toggleHandler = (e) => {
                    e.stopPropagation();
                    const isExpanded = childrenUl.classList.contains('expanded');
                    if (isExpanded) {
                        childrenUl.classList.remove('expanded');
                        toggle.innerHTML = '<i class="fas fa-caret-right"></i>';
                    } else {
                        childrenUl.classList.add('expanded');
                        toggle.innerHTML = '<i class="fas fa-caret-down"></i>';
                        // Lazy Load if empty
                        if (!childrenUl.hasChildNodes()) {
                            this.loadLazyTreeLevel(path, childrenUl);
                        }
                    }
                };

                contentDiv.onclick = toggleHandler;

                li.appendChild(contentDiv);
                li.appendChild(childrenUl);
            } else {
                // File Row: [Icon] [Name] (No toggle)
                contentDiv.className = 'file-list-item'; // Reuse
                contentDiv.innerHTML = `<i class="${iconClass}" style="margin-right:8px; color:#a0a0a0;"></i> <span>${name}</span>`;
                contentDiv.onclick = () => {
                    // Open File
                    const ext = name.split('.').pop();
                    this.loadFile({ name: name, path: path, type: ext });
                };
                li.appendChild(contentDiv);
            }

            containerUl.appendChild(li);
        });
    },

    async loadLazyTreeLevel(path, containerUl) {
        containerUl.innerHTML = '<li style="padding-left:20px; color:#777;">Loading...</li>';
        try {
            const res = await fetch(`/api/explore?path=${encodeURIComponent(path)}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Unknown Error");
            }
            const items = await res.json();
            this.renderLazyTreeItems(items, containerUl);
        } catch (e) {
            containerUl.innerHTML = `<li style="padding-left:20px; color:red;">${e.message}</li>`;
        }
    },


    formatSize(bytes) {
        if (!bytes) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

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
            'java': 'fab fa-java', 'go': 'fab fa-google', 'rs': 'fab fa-rust', 'dockerfile': 'fab fa-docker',
            'doc': 'fas fa-file-word', 'docx': 'fas fa-file-word',
            'xls': 'fas fa-file-excel', 'xlsx': 'fas fa-file-excel',
            'ppt': 'fas fa-file-powerpoint', 'pptx': 'fas fa-file-powerpoint', 'ppsx': 'fas fa-file-powerpoint'
        };
        return map[type.toLowerCase()] || 'fas fa-file';
    },

    getSafeUrl(path) {
        return `/api/serve_file?path=${encodeURIComponent(path)}`;
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
            // Use tree_path for grouping if available, fallback to path or name
            const pathForTree = file.tree_path || file.path || file.name;
            const parts = pathForTree.split(/[/\\]/);
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

    // --- GLOBAL CONTENT SEARCH ---
    handleContentSearch(query) {
        if (this._searchTimeout) clearTimeout(this._searchTimeout);
        this._searchTimeout = setTimeout(() => {
            this.performGlobalSearch(query);
        }, 500); // 500ms debounce
    },

    async performGlobalSearch(query) {
        if (!query || query.length < 2) {
            this.renderFileList(); // Reset to normal file list if query too short
            return;
        }

        const list = this.dom.fileList;
        list.innerHTML = '<li style="padding:10px; color:#aaa;"><i class="fas fa-spinner fa-spin"></i> Searching contents...</li>';

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const results = await res.json();

            list.innerHTML = '';
            if (results.length === 0) {
                list.innerHTML = '<li style="padding:10px; color:#aaa;">No matches found in file contents.</li>';
                return;
            }

            // Group by file
            const fileGroups = {};
            results.forEach(match => {
                if (!fileGroups[match.file]) fileGroups[match.file] = [];
                fileGroups[match.file].push(match);
            });

            // Render Results
            for (const [filePath, matches] of Object.entries(fileGroups)) {
                // Determine file type from extension of the first match or path
                const ext = filePath.split('.').pop();
                const fileObj = { name: matches[0].name, path: matches[0].file, type: matches[0].type || ext };

                const li = document.createElement('li');
                const fileHeader = document.createElement('div');
                fileHeader.className = 'tree-item folder-row expanded'; // Reuse folder style for file header
                fileHeader.innerHTML = `<i class="${this.getFileIcon(fileObj.type)} tree-icon"></i><span>${fileObj.name}</span> <span style="font-size:0.8em; color:#888;">(${matches.length})</span>`;
                fileHeader.onclick = () => this.loadFile(fileObj);

                const ul = document.createElement('ul');
                ul.className = 'tree-children open';
                ul.style.paddingLeft = "20px";

                matches.forEach(match => {
                    const matchLi = document.createElement('li');
                    matchLi.style.padding = "4px 0";
                    matchLi.style.fontSize = "0.9em";
                    matchLi.style.color = "#ccc";
                    matchLi.style.cursor = "pointer";
                    matchLi.innerHTML = `<div style="display:flex; flex-direction:column;">
                        <span style="font-family:monospace; color:#4ec9b0; font-size:0.85em;">${match.location}</span>
                        <span style="color:#aaa; font-style:italic;">"${match.context || 'Match found'}"</span>
                    </div>`;

                    // On click, load file and try to scroll/highlight
                    matchLi.onclick = async (e) => {
                        e.stopPropagation();
                        await this.loadFile(fileObj);
                        // Wait a bit for render
                        setTimeout(() => {
                            // Trigger local search for the specific line or context
                            // This is a rough estimation; ideal would be to pass line number to viewer
                            this.dom.textSearchInput.value = query; // Pre-fill local search
                            this.performTextSearch(); // Trigger highlighting
                        }, 500);
                    };
                    ul.appendChild(matchLi);
                });

                li.appendChild(fileHeader);
                li.appendChild(ul);
                list.appendChild(li);
            }

        } catch (e) {
            console.error(e);
            list.innerHTML = `<li style="padding:10px; color:red;">Search error: ${e.message}</li>`;
        }
    },

    // --- VIEWER ---
    hideAllViewers() {
        this.dom.welcomeMsg.classList.add('hidden');
        this.dom.pdfContainer.classList.add('hidden');
        this.dom.imageViewer.classList.add('hidden');
        this.dom.textViewer.classList.add('hidden');
        this.dom.csvViewer.classList.add('hidden');
        this.dom.mediaViewer.classList.add('hidden');
        this.dom.fileDetailsViewer.classList.add('hidden');

        // Also hide controls and sidebar
        if (this.dom.imageControls) this.dom.imageControls.classList.add('hidden');
        if (this.dom.textControls) this.dom.textControls.classList.add('hidden');
        const pdfControls = document.getElementById('pdf-controls');
        if (pdfControls) pdfControls.classList.add('hidden');

        const pdfSidebar = document.getElementById('pdf-sidebar');
        if (pdfSidebar) pdfSidebar.classList.add('hidden');
    },

    loadFile(file, skipDetails = false) {
        console.log("Loading file:", file.name);
        this.currentFile = file;

        // Show Info Button
        const externalFileExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'ppsx', 'zip', 'rar', '7z', 'tar', 'gz'];
        const isExternal = externalFileExtensions.includes(file.type.toLowerCase());

        // Show Info Button only for internal files
        if (this.dom.btnFileInfo) {
            if (isExternal) this.dom.btnFileInfo.classList.add('hidden');
            else this.dom.btnFileInfo.classList.remove('hidden');
        }

        if (!skipDetails && isExternal) {
            // Show details for external files as before
            this.hideAllViewers();
            this.renderFileDetails(file);
            return;
        }

        this.hideAllViewers();

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
        // Reset State for new file
        this.textState = {
            fontSize: this.textState.fontSize, // Preserve font size
            matches: [],
            currentIndex: -1,
            originalText: "",
            currentFile: file,
            currentOffset: 0
        };

        this.dom.textViewer.innerHTML = '<div style="padding:20px; color:#aaa;">Loading...</div>';

        await this.loadTextChunk(file, 0);
    },

    async loadTextChunk(file, startOffset) {
        try {
            const res = await fetch(`/api/read_file?path=${encodeURIComponent(file.path)}&start=${startOffset}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            if (startOffset === 0) {
                this.textState.originalText = data.content;
            } else {
                this.textState.originalText += data.content;
            }
            this.textState.currentOffset = data.start + data.length;

            this.renderTextContent(file, this.textState.originalText);

            // Handle Load More
            const existingBtn = document.getElementById('btn-load-more');
            if (existingBtn) existingBtn.remove();

            const remaining = data.total_size - this.textState.currentOffset;
            if (!data.eof && remaining > 0) {
                const btn = document.createElement('button');
                btn.id = 'btn-load-more';
                const kbRemaining = Math.max(1, Math.ceil(remaining / 1024));
                btn.innerText = `Load more (${kbRemaining} KB remaining)`;
                btn.onclick = () => this.loadTextChunk(file, this.textState.currentOffset);
                btn.style.cssText = "display:block; margin: 20px auto; padding: 10px 20px; background: #3e3e42; color: white; border: none; cursor: pointer; border-radius: 4px;";

                // Append button to end of viewer
                this.dom.textViewer.appendChild(btn);

                // Show loading progress in stats only if still loading
                this.dom.textSearchStats.innerText = `${Math.round(this.textState.currentOffset / 1024)} KB / ${Math.round(data.total_size / 1024)} KB`;
            } else {
                // If fully loaded, reset stats to match count (or empty)
                this.dom.textSearchStats.innerText = "0/0";
            }

        } catch (e) {
            this.dom.textViewer.innerHTML = `<div style="padding:20px; color:red;">Error loading file: ${e.message}</div>`;
        }
    },

    renderTextContent(file, text) {
        const ext = file.type.toLowerCase();

        // Markdown Rendering
        if (ext === 'md') {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'markdown-body';
            contentDiv.innerHTML = marked.parse(text);

            this.dom.textViewer.innerHTML = '';
            this.dom.textViewer.appendChild(contentDiv);
            this.dom.textViewer.style.whiteSpace = "normal";
        }
        // Syntax Highlighting
        else if (['py', 'js', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'bash', 'c', 'cpp', 'java', 'go', 'rs', 'sql', 'dockerfile'].includes(ext)) {
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.className = `language-${ext}`;
            code.textContent = text;
            pre.appendChild(code);

            this.dom.textViewer.innerHTML = '';
            this.dom.textViewer.appendChild(pre);
            this.dom.textViewer.style.whiteSpace = "normal";

            if (window.hljs) hljs.highlightElement(code);
        }
        // Plain Text
        else {
            const div = document.createElement('div');
            div.textContent = text;
            div.style.whiteSpace = "pre-wrap";

            this.dom.textViewer.innerHTML = '';
            this.dom.textViewer.appendChild(div);
        }

        this.dom.textViewer.style.fontSize = this.textState.fontSize + 'px';
        this.dom.fontDisplay.innerText = this.textState.fontSize + 'px';
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

    // --- PDF CONTROLS ---
    // --- PDF CONTROLS ---
    pdfState: {
        scale: 1.5,
        currentFile: null,
        pdfDoc: null,
        twoPageMode: false,
        showSidebar: false,
        matches: [],
        currentMatchIndex: -1
    },

    async loadPDF(file) {
        this.dom.pdfContainer.classList.remove('hidden');
        this.dom.pdfContainer.innerHTML = '';

        // Setup UI
        const pdfControls = document.getElementById('pdf-controls');
        if (pdfControls) pdfControls.classList.remove('hidden');
        this.dom.imageControls.classList.add('hidden');
        this.dom.textControls.classList.add('hidden');

        // Sidebar reset
        const sidebar = document.getElementById('pdf-sidebar');
        if (sidebar) {
            sidebar.innerHTML = '';
            if (!this.pdfState.showSidebar) sidebar.classList.add('hidden');
            else sidebar.classList.remove('hidden');
        }

        try {
            this.pdfState.currentFile = file;
            const url = this.getSafeUrl(file.path);
            const loadingTask = pdfjsLib.getDocument(url);
            this.pdfState.pdfDoc = await loadingTask.promise;

            await this.fitPDFWidth(); // Default to Fit Width
            this.renderPDFThumbnails();

            // Re-bind buttons
            document.getElementById('pdf-zoom-in').onclick = () => this.changePDFZoom(0.25);
            document.getElementById('pdf-zoom-out').onclick = () => this.changePDFZoom(-0.25);
            document.getElementById('pdf-fit-width').onclick = () => this.fitPDFWidth();
            document.getElementById('pdf-fit-height').onclick = () => this.fitPDFHeight();
            document.getElementById('pdf-toggle-sidebar').onclick = () => this.togglePDFSidebar();

            document.getElementById('pdf-view-1page').onclick = () => this.setSinglePageView();
            document.getElementById('pdf-view-2page').onclick = () => this.setTwoPageView();
            document.getElementById('pdf-rotate').onclick = () => this.rotatePDF();

            // Search Binding
            document.getElementById('pdf-search-btn').onclick = () => this.searchPDF();
            document.getElementById('pdf-search-input').onkeydown = (e) => { if (e.key === 'Enter') this.searchPDF(); };

            const prevBtn = document.getElementById('pdf-search-prev');
            const nextBtn = document.getElementById('pdf-search-next');
            if (prevBtn) prevBtn.onclick = () => this.navigatePDFSearch(-1);
            if (nextBtn) nextBtn.onclick = () => this.navigatePDFSearch(1);

        } catch (e) {
            console.error("PDF Load Error:", e);
            this.dom.pdfContainer.innerHTML = `<div style="padding:20px; color:red;">Failed to load PDF: ${e.message}</div>`;
        }
    },

    async renderPDFPages() {
        this.dom.pdfContainer.innerHTML = '';
        const pdf = this.pdfState.pdfDoc;
        const scale = this.pdfState.scale;
        const twoPage = this.pdfState.twoPageMode;
        const rotation = this.pdfState.rotation || 0;

        const zoomLevelDisplay = document.getElementById('pdf-zoom-level');
        if (zoomLevelDisplay) zoomLevelDisplay.innerText = Math.round(scale * 100) + "%";

        if (twoPage) {
            this.dom.pdfContainer.style.display = 'grid';
            this.dom.pdfContainer.style.gridTemplateColumns = 'repeat(2, max-content)';
            this.dom.pdfContainer.style.justifyContent = 'center';
            this.dom.pdfContainer.style.gap = '20px';
        } else {
            this.dom.pdfContainer.style.display = 'block';
            this.dom.pdfContainer.style.textAlign = 'center';
        }

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale, rotation });

            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-container';
            pageContainer.id = `pdf-page-${pageNum}`;
            pageContainer.style.position = 'relative';
            pageContainer.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
            pageContainer.style.backgroundColor = 'white';

            if (twoPage) {
                // Grid handles layout
                pageContainer.style.marginBottom = '0';
            } else {
                // Block handles layout
                pageContainer.style.marginBottom = '20px';
                pageContainer.style.display = 'block';
                pageContainer.style.margin = '0 auto 20px auto';
                pageContainer.style.width = 'fit-content'; // Prevent white background from stretching
            }

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Text Layer
            const textContent = await page.getTextContent();
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;
            textLayerDiv.style.position = 'absolute';
            textLayerDiv.style.top = '0';
            textLayerDiv.style.left = '0';
            textLayerDiv.style.setProperty('--scale-factor', scale);

            // Text layer needs correct rotation handling
            // PDF.js utility normally handles this if viewport is correct
            pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
            });

            pageContainer.appendChild(canvas);
            pageContainer.appendChild(textLayerDiv);
            this.dom.pdfContainer.appendChild(pageContainer);
        }
    },

    async renderPDFThumbnails() {
        const sidebar = document.getElementById('pdf-sidebar');
        if (!sidebar) return;

        sidebar.innerHTML = '';
        const pdf = this.pdfState.pdfDoc;
        const rotation = this.pdfState.rotation || 0;

        // Render first 20 thumbnails
        const limit = Math.min(pdf.numPages, 50);

        for (let pageNum = 1; pageNum <= limit; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.15, rotation });

            const thumbContainer = document.createElement('div');
            thumbContainer.style.marginBottom = "15px";
            thumbContainer.style.cursor = "pointer";
            thumbContainer.style.textAlign = "center";
            thumbContainer.title = `Go to page ${pageNum}`;
            thumbContainer.onclick = () => {
                const target = document.getElementById(`pdf-page-${pageNum}`);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            };

            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.border = "1px solid #444";

            await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;

            const label = document.createElement('div');
            label.innerText = pageNum;
            label.style.color = "#aaa";
            label.style.fontSize = "12px";
            label.style.marginTop = "4px";

            thumbContainer.appendChild(canvas);
            thumbContainer.appendChild(label);
            sidebar.appendChild(thumbContainer);
        }
    },

    togglePDFSidebar() {
        this.pdfState.showSidebar = !this.pdfState.showSidebar;
        const sidebar = document.getElementById('pdf-sidebar');
        if (sidebar) {
            if (this.pdfState.showSidebar) sidebar.classList.remove('hidden');
            else sidebar.classList.add('hidden');
        }
    },

    setSinglePageView() {
        this.pdfState.twoPageMode = false;
        this.fitPDFWidth(); // Auto-fit width when switching to single
    },

    setTwoPageView() {
        this.pdfState.twoPageMode = true;
        this.fitPDFWidth(); // Use fitPDFWidth which handles 2-page logic now
    },

    rotatePDF() {
        this.pdfState.rotation = (this.pdfState.rotation || 0) + 90;
        if (this.pdfState.rotation >= 360) this.pdfState.rotation = 0;
        this.renderPDFPages();
        this.renderPDFThumbnails(); // Re-render thumbnails as well
    },

    async searchPDF() {
        const query = document.getElementById('pdf-search-input').value.trim().toLowerCase();
        if (!query) return;

        const pdf = this.pdfState.pdfDoc;
        const btn = document.getElementById('pdf-search-btn');
        const stats = document.getElementById('pdf-search-stats');
        const originalIcon = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.pdfState.matches = [];
        this.pdfState.currentMatchIndex = -1;
        stats.innerText = "Scanning...";

        try {
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                // Iterate individual items to find ALL matches
                for (let j = 0; j < textContent.items.length; j++) {
                    const item = textContent.items[j];
                    if (item.str.toLowerCase().includes(query)) {
                        this.pdfState.matches.push({
                            page: i,
                            text: item.str,
                            itemIndex: j // Store index to pinpoint the item later
                        });
                    }
                }
            }

            if (this.pdfState.matches.length > 0) {
                this.navigatePDFSearch(1); // Go to first match
            } else {
                alert("No matches found.");
                stats.innerText = "0/0";
            }
        } catch (e) {
            console.error("Search error:", e);
            alert("Search error: " + e.message);
        } finally {
            btn.innerHTML = originalIcon;
        }
    },

    async navigatePDFSearch(direction) {
        if (this.pdfState.matches.length === 0) return;

        if (direction === 1) {
            this.pdfState.currentMatchIndex++;
            if (this.pdfState.currentMatchIndex >= this.pdfState.matches.length) this.pdfState.currentMatchIndex = 0;
        } else {
            this.pdfState.currentMatchIndex--;
            if (this.pdfState.currentMatchIndex < 0) this.pdfState.currentMatchIndex = this.pdfState.matches.length - 1;
        }

        const match = this.pdfState.matches[this.pdfState.currentMatchIndex];
        const stats = document.getElementById('pdf-search-stats');
        stats.innerText = `${this.pdfState.currentMatchIndex + 1}/${this.pdfState.matches.length}`;

        const target = document.getElementById(`pdf-page-${match.page}`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Highlight exact text
            const query = document.getElementById('pdf-search-input').value.trim().toLowerCase();
            await this.highlightTextOnPage(match.page, query, match.itemIndex);
        }
    },

    async highlightTextOnPage(pageNum, query, targetItemIndex) {
        // Clear previous highlights
        document.querySelectorAll('.pdf-search-highlight').forEach(el => el.remove());

        const page = await this.pdfState.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: this.pdfState.scale, rotation: this.pdfState.rotation || 0 });

        const pageContainer = document.getElementById(`pdf-page-${pageNum}`);
        if (!pageContainer) return;

        // If targetItemIndex is provided, only highlight that specific match instance
        // If not, highlight all (legacy behavior or fallback)
        const itemsToHighlight = (targetItemIndex !== undefined)
            ? [textContent.items[targetItemIndex]]
            : textContent.items.filter(item => item.str.toLowerCase().includes(query));

        itemsToHighlight.forEach(item => {
            if (!item) return;
            const text = item.str.toLowerCase();
            if (!text.includes(query)) return;

            // Calculate Approximate Position of the Substring
            const startIndex = text.indexOf(query);
            const endIndex = startIndex + query.length; // Unused but good for ref
            const totalLength = text.length;

            // Improved precise positioning using Canvas measurement
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const fontStyle = "16px sans-serif"; // Heuristic font
            ctx.font = fontStyle;

            const fullTextWidth = ctx.measureText(text).width;
            const startTextWidth = ctx.measureText(text.substring(0, startIndex)).width;
            const queryTextWidth = ctx.measureText(query).width;

            // Ratios based on visual width heuristic
            const startRatio = (fullTextWidth > 0) ? (startTextWidth / fullTextWidth) : 0;
            const widthRatio = (fullTextWidth > 0) ? (queryTextWidth / fullTextWidth) : 0;

            const tx = item.transform;
            const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
            let x = tx[4];
            const y = tx[5];
            const fullWidth = item.width;
            const height = item.height || fontSize;

            // Adjusted X and Width using visual ratios
            const substringX = x + (fullWidth * startRatio);
            const substringWidth = fullWidth * widthRatio;

            const rect = viewport.convertToViewportRectangle([substringX, y, substringX + substringWidth, y + height]);

            const minX = Math.min(rect[0], rect[2]);
            const maxX = Math.max(rect[0], rect[2]);
            const minY = Math.min(rect[1], rect[3]);
            const maxY = Math.max(rect[1], rect[3]);

            const div = document.createElement('div');
            div.className = 'pdf-search-highlight';
            div.style.left = `${minX}px`;
            div.style.top = `${minY}px`;
            div.style.width = `${maxX - minX}px`;
            div.style.height = `${maxY - minY}px`;
            div.style.position = 'absolute';
            div.style.backgroundColor = 'rgba(255, 215, 0, 0.5)'; // Stronger Gold/Yellow
            div.style.border = '2px solid red'; // Red border for high visibility
            div.style.boxShadow = '0 0 5px rgba(255, 0, 0, 0.5)'; // Glow effect
            div.style.boxSizing = 'border-box';
            div.style.pointerEvents = 'none';
            div.style.zIndex = '10'; // Ensure it's on top

            pageContainer.appendChild(div);
        });
    },


    toggleTwoPageView() {
        // Deprecated, keeping just in case or mapping to new logic
        if (this.pdfState.twoPageMode) this.setSinglePageView();
        else this.setTwoPageView();
    },

    async changePDFZoom(delta) {
        this.pdfState.scale += delta;
        if (this.pdfState.scale < 0.1) this.pdfState.scale = 0.1; // Lowered min limit
        if (this.pdfState.scale > 5.0) this.pdfState.scale = 5.0; // Raised max limit
        await this.renderPDFPages();
    },

    async fitPDFWidth() {
        if (this.pdfState.pdfDoc) {
            const page = await this.pdfState.pdfDoc.getPage(1);
            const containerWidth = this.dom.pdfContainer.clientWidth - 60;
            const rotation = this.pdfState.rotation || 0;
            const viewport = page.getViewport({ scale: 1, rotation });

            if (this.pdfState.twoPageMode) {
                // Fit 2 pages within width
                this.pdfState.scale = (containerWidth / 2) / viewport.width;
            } else {
                // Fit 1 page within width
                this.pdfState.scale = containerWidth / viewport.width;
            }
            await this.renderPDFPages();
        }
    },

    async fitPDFHeight() {
        if (this.pdfState.pdfDoc) {
            const page = await this.pdfState.pdfDoc.getPage(1);
            const containerHeight = this.dom.pdfContainer.clientHeight - 40;
            const rotation = this.pdfState.rotation || 0;
            const viewport = page.getViewport({ scale: 1, rotation });

            // Height fitting is usually the same for 1 or 2 page view (side-by-side)
            this.pdfState.scale = containerHeight / viewport.height;
            await this.renderPDFPages();
        }
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

        // Preserve layout by wrapping in pre/code if it was code
        const ext = this.textState.currentFile ? this.textState.currentFile.type : 'txt';
        if (['py', 'js', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'bash', 'c', 'cpp', 'java', 'go', 'rs', 'sql', 'dockerfile'].includes(ext)) {
            this.dom.textViewer.innerHTML = `<pre><code class="language-${ext}">${highlighted}</code></pre>`;
        } else {
            // For others, use pre-wrap or just pre to respect newlines
            this.dom.textViewer.innerHTML = `<div style="white-space: pre-wrap; font-family: 'Consolas', monospace;">${highlighted}</div>`;
        }

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
    },

    // --- ABOUT MODAL & HASH HANDLING ---
    bindAboutLogic() {
        // Hash Change
        window.addEventListener('hashchange', () => this.handleHashChange());

        // Close Buttons
        const closeBtn = document.getElementById('about-btn-close');
        const quitBtn = document.getElementById('about-btn-quit');
        const closeIcon = document.getElementById('about-close-icon');
        const modal = document.getElementById('about-modal');

        const closeModal = () => {
            // Remove hash without jumping
            history.pushState("", document.title, window.location.pathname + window.location.search);
            this.handleHashChange();
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeIcon) closeIcon.addEventListener('click', closeModal);

        if (quitBtn) quitBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to quit?")) {
                fetch('/api/quit')
                    .then(() => window.close()) // Try checking close
                    .catch(() => window.close());
            }
        });

        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    },

    bindManagePathsLogic() {
        if (this.dom.btnManageFolders) {
            this.dom.btnManageFolders.addEventListener('click', () => {
                this.openManagePathsModal();
            });
        }

        if (this.dom.managePathsCloseIcon) {
            this.dom.managePathsCloseIcon.addEventListener('click', () => {
                this.dom.managePathsModal.classList.add('hidden');
            });
        }

        if (this.dom.managePathsBtnClose) {
            this.dom.managePathsBtnClose.addEventListener('click', () => {
                this.dom.managePathsModal.classList.add('hidden');
            });
        }

        // Close on clean outside click
        this.dom.managePathsModal.addEventListener('click', (e) => {
            if (e.target === this.dom.managePathsModal) {
                this.dom.managePathsModal.classList.add('hidden');
            }
        });
    },

    openManagePathsModal() {
        this.dom.managePathsModal.classList.remove('hidden');
        this.fetchAndRenderFolders();
    },

    async fetchAndRenderFolders() {
        const container = this.dom.folderListContainer;
        container.innerHTML = '<li style="color:#aaa;">Loading...</li>';

        try {
            const res = await fetch('/api/get_folders');
            const data = await res.json(); // returns array of strings

            container.innerHTML = '';

            if (data.length === 0) {
                container.innerHTML = '<li style="color:#aaa;">No folders added.</li>';
                return;
            }

            data.forEach(path => {
                const li = document.createElement('li');
                li.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #3e3e42; color: #d4d4d4;";

                const span = document.createElement('span');
                span.innerText = path;
                span.title = path;
                span.style.cssText = "white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 10px; font-family: monospace; font-size: 0.9em; flex: 1;";

                const btnRemove = document.createElement('button');
                btnRemove.innerHTML = '<i class="fas fa-trash"></i>';
                btnRemove.title = "Remove Folder";
                btnRemove.style.cssText = "background: transparent; border: none; color: #d9534f; cursor: pointer; font-size: 1.1em; padding: 5px;";

                btnRemove.onclick = () => this.removeFolder(path);

                li.appendChild(span);
                li.appendChild(btnRemove);
                container.appendChild(li);
            });

        } catch (e) {
            container.innerHTML = `<li style="color:red;">Error: ${e.message}</li>`;
        }
    },

    async removeFolder(path) {
        if (!confirm(`Are you sure you want to remove this folder from the viewer?\n\n${path}`)) {
            return;
        }

        try {
            const res = await fetch('/api/remove_folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path })
            });
            const data = await res.json();

            if (data.status === 'success') {
                // Refresh list and file tree
                this.fetchAndRenderFolders();
                this.loadFiles();
            } else {
                alert('Error removing folder: ' + data.message);
            }
        } catch (e) {
            alert('Error removing folder: ' + e.message);
        }
    },

    toggleFileDetails() {
        if (!this.currentFile) return;

        const isDetailsVisible = !this.dom.fileDetailsViewer.classList.contains('hidden');

        if (isDetailsVisible) {
            // Restore previous view
            this.dom.fileDetailsViewer.classList.add('hidden');
            this.loadFile(this.currentFile, true);
        } else {
            // Show details
            this.hideAllViewers();
            this.renderFileDetails(this.currentFile);
        }
    },

    renderFileDetails(file) {
        this.dom.fileDetailsViewer.classList.remove('hidden');

        const sizeFormatted = this.formatBytes(file.size);
        const dateModified = new Date(file.mtime * 1000).toLocaleString();
        const dateCreated = file.ctime ? new Date(file.ctime * 1000).toLocaleString() : '-';
        const iconClass = this.getFileIcon(file.type);

        const externalFileExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'ppsx', 'zip', 'rar', '7z', 'tar', 'gz'];
        const isExternal = externalFileExtensions.includes(file.type.toLowerCase());

        let actionButtonHtml = '';
        if (isExternal) {
            actionButtonHtml = `
                <button id="btn-open-external" style="
                    padding: 12px 30px; margin-right: 10px;
                    font-size: 16px; background-color: #0e639c; color: white; border: none; 
                    border-radius: 4px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: background 0.2s;">
                    <i class="fas fa-external-link-alt" style="margin-right:8px;"></i> Open in System Application
                </button>`;
        } else {
            // Internal file: Add a "View Content" button
            actionButtonHtml = `
                <button id="btn-view-content" style="
                    padding: 12px 30px; margin-right: 10px;
                    font-size: 16px; background-color: #2da44e; color: white; border: none; 
                    border-radius: 4px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: background 0.2s;">
                    <i class="fas fa-eye" style="margin-right:8px;"></i> View Content
                </button>`;
        }

        this.dom.fileDetailsViewer.innerHTML = `
            <div style="margin-bottom: 30px;">
                <i class="${iconClass}" style="font-size: 80px; color: #007acc; text-shadow: 0 4px 10px rgba(0,0,0,0.3);"></i>
            </div>
            <h2 style="margin-bottom: 30px; font-weight: 500; font-size: 1.8em; word-break: break-all;">${file.name}</h2>
            
            <div style="display: inline-block; width: 100%; max-width: 600px; text-align: left; background: #252526; padding: 25px; border-radius: 8px; border: 1px solid #3e3e42; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <div style="display:grid; grid-template-columns: 120px 1fr; gap: 10px; margin-bottom: 10px;">
                    <span style="color: #888;">Type:</span>
                    <span style="color: #9cdcfe; font-weight: bold;">${file.type.toUpperCase()} File</span>
                    
                    <span style="color: #888;">Size:</span>
                    <span style="color: #ce9178;">${sizeFormatted}</span>
                    
                    <span style="color: #888;">Modified:</span>
                    <span style="color: #6a9955;">${dateModified}</span>

                    <span style="color: #888;">Created:</span>
                    <span style="color: #6a9955;">${dateCreated}</span>
                    
                    <span style="color: #888;">Location:</span>
                    <span style="font-family: monospace; color: #d4d4d4; word-break: break-all;">${file.path}</span>

                    <span style="color: #888;">Root Folder:</span>
                    <span style="font-family: monospace; color: #d4d4d4; word-break: break-all;">${file.root}</span>
                </div>
            </div>
            
            <div style="margin-top: 40px;">
                ${actionButtonHtml}
                <div style="height: 10px;"></div>
                <p style="color: #888; font-style: italic; margin-top: 5px; font-size: 0.9em;">
                    ${isExternal ? 'This file format is not supported for direct viewing.' : 'Click button to view file content.'}
                </p>
            </div>
        `;

        // Bind buttons
        const btnOpen = document.getElementById('btn-open-external');
        if (btnOpen) {
            btnOpen.onclick = () => {
                if (confirm(`이 파일(${file.name})은 뷰어에서 직접 열 수 없습니다.\n시스템 기본 응용 프로그램으로 여시겠습니까?`)) {
                    fetch(`/api/open_external?root=${encodeURIComponent(file.root)}&path=${encodeURIComponent(file.path)}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.status !== 'success') {
                                alert('Failed to open file: ' + (data.message || 'Unknown error'));
                            }
                        })
                        .catch(e => alert('Error: ' + e));
                }
            };
            btnOpen.onmouseover = () => btnOpen.style.backgroundColor = "#1177bb";
            btnOpen.onmouseout = () => btnOpen.style.backgroundColor = "#0e639c";
        }

        const btnView = document.getElementById('btn-view-content');
        if (btnView) {
            btnView.onclick = () => {
                this.dom.fileDetailsViewer.classList.add('hidden');
                this.loadFile(file, true);
            };
            btnView.onmouseover = () => btnView.style.backgroundColor = "#3fb950";
            btnView.onmouseout = () => btnView.style.backgroundColor = "#2da44e";
        }
    },

    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },

    handleHashChange() {
        const modal = document.getElementById('about-modal');
        if (!modal) return;

        if (location.hash === '#about') {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    },

    getSafeUrl(path) {
        return `/api/serve_file?path=${encodeURIComponent(path)}`;
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
