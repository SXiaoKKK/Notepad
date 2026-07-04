class NoteApp {
    constructor() {
        this.notes = [];
        this.currentNoteId = null;
        this.isEditing = false;

        // DOM元素
        this.listView = document.getElementById('listView');
        this.editorView = document.getElementById('editorView');
        this.notesList = document.getElementById('notesList');
        this.emptyState = document.getElementById('emptyState');
        this.noteTitle = document.getElementById('noteTitle');
        this.noteContent = document.getElementById('noteContent');
        this.searchInput = document.getElementById('searchInput');
        this.backBtn = document.getElementById('backBtn');
        this.newNoteBtn = document.getElementById('newNoteBtn');
        this.syncBtn = document.getElementById('syncBtn');
        this.deleteNoteBtn = document.getElementById('deleteNoteBtn');
        this.syncModal = document.getElementById('syncModal');
        this.closeSyncBtn = document.getElementById('closeSyncBtn');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.joinCodeInput = document.getElementById('joinCodeInput');
        this.roomInfo = document.getElementById('roomInfo');
        this.roomCode = document.getElementById('roomCode');
        this.connectionStatus = document.getElementById('connectionStatus');
    }

    init() {
        this.loadNotes();
        this.bindEvents();
        this.updateNotesList();
    }

    bindEvents() {
        // 新建笔记
        this.newNoteBtn.addEventListener('click', () => this.createNewNote());

        // 返回列表
        this.backBtn.addEventListener('click', () => this.showListView());

        // 搜索
        this.searchInput.addEventListener('input', () => this.updateNotesList());

        // 删除笔记
        this.deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());

        // 同步对话框
        this.syncBtn.addEventListener('click', () => this.toggleSyncModal());
        this.closeSyncBtn.addEventListener('click', () => this.toggleSyncModal());

        // P2P同步
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());

        // 自动保存
        let saveTimeout;
        const autoSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (this.currentNoteId) {
                    this.saveCurrentNote();
                }
            }, 500);
        };

        this.noteTitle.addEventListener('input', autoSave);
        this.noteContent.addEventListener('input', autoSave);

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentNoteId) {
                this.showListView();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                this.createNewNote();
            }
        });
    }

    loadNotes() {
        try {
            const stored = localStorage.getItem('memos');
            this.notes = stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('加载笔记失败:', e);
            this.notes = [];
        }
    }

    saveNotes() {
        try {
            localStorage.setItem('memos', JSON.stringify(this.notes));
        } catch (e) {
            console.error('保存笔记失败:', e);
        }
    }

    createNewNote() {
        const note = {
            id: this.generateId(),
            title: '',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.showEditorView(note.id);
    }

    showListView() {
        this.listView.style.display = 'flex';
        this.editorView.style.display = 'none';
        this.backBtn.style.display = 'none';
        this.currentNoteId = null;
        this.isEditing = false;
        this.updateNotesList();
    }

    showEditorView(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        this.currentNoteId = noteId;
        this.isEditing = true;
        this.noteTitle.value = note.title;
        this.noteContent.value = note.content;

        this.listView.style.display = 'none';
        this.editorView.style.display = 'flex';
        this.backBtn.style.display = 'flex';

        setTimeout(() => {
            if (!note.title) {
                this.noteTitle.focus();
            } else {
                this.noteContent.focus();
            }
        }, 100);
    }

    saveCurrentNote() {
        const note = this.notes.find(n => n.id === this.currentNoteId);
        if (!note) return;

        note.title = this.noteTitle.value.trim();
        note.content = this.noteContent.value;
        note.updatedAt = new Date().toISOString();

        // 如果笔记为空，考虑删除
        if (!note.title && !note.content) {
            this.deleteNote(this.currentNoteId);
            return;
        }

        this.saveNotes();

        // 如果启用了同步，发送更新
        if (window.syncManager && window.syncManager.isConnected) {
            window.syncManager.syncNote(note);
        }
    }

    deleteNote(noteId) {
        this.notes = this.notes.filter(n => n.id !== noteId);
        this.saveNotes();

        if (this.currentNoteId === noteId) {
            this.showListView();
        }

        // 如果启用了同步，发送删除
        if (window.syncManager && window.syncManager.isConnected) {
            window.syncManager.deleteNote(noteId);
        }
    }

    deleteCurrentNote() {
        if (!this.currentNoteId) return;

        if (confirm('确定要删除这个备忘录吗？')) {
            this.deleteNote(this.currentNoteId);
        }
    }

    updateNotesList() {
        const searchTerm = this.searchInput.value.toLowerCase();
        let filteredNotes = this.notes;

        if (searchTerm) {
            filteredNotes = this.notes.filter(note =>
                note.title.toLowerCase().includes(searchTerm) ||
                note.content.toLowerCase().includes(searchTerm)
            );
        }

        // 排序：最新的在前
        filteredNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        this.notesList.innerHTML = '';

        if (filteredNotes.length === 0) {
            this.emptyState.classList.add('show');
        } else {
            this.emptyState.classList.remove('show');

            filteredNotes.forEach(note => {
                const noteElement = this.createNoteElement(note);
                this.notesList.appendChild(noteElement);
            });
        }
    }

    createNoteElement(note) {
        const div = document.createElement('div');
        div.className = 'note-item';

        const title = note.title || '新备忘录';
        const preview = note.content ? note.content.substring(0, 50) : '没有附加内容';
        const date = new Date(note.updatedAt);
        const dateStr = this.formatDate(date);

        div.innerHTML = `
            <div class="note-item-title">${this.escapeHtml(title)}</div>
            <div class="note-item-preview">${this.escapeHtml(preview)}</div>
            <div class="note-item-date">${dateStr}</div>
        `;

        div.addEventListener('click', () => this.showEditorView(note.id));

        // 滑动删除（移动端）
        let touchStartX = 0;
        div.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });

        div.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;

            if (diff > 100) { // 向左滑动超过100px
                if (confirm('确定要删除这个备忘录吗？')) {
                    this.deleteNote(note.id);
                }
            }
        });

        return div;
    }

    toggleSyncModal() {
        if (this.syncModal.style.display === 'none') {
            this.syncModal.style.display = 'flex';
        } else {
            this.syncModal.style.display = 'none';
        }
    }

    async createRoom() {
        try {
            const code = await p2p.createRoom();

            // 设置P2P回调
            this.setupP2PCallbacks();

            // 显示房间信息
            this.roomCode.textContent = code;
            this.roomInfo.style.display = 'block';
            this.connectionStatus.textContent = '等待设备加入...';
            this.connectionStatus.style.color = '#8E8E93';

        } catch (error) {
            alert('创建房间失败: ' + error.message);
            console.error(error);
        }
    }

    async joinRoom() {
        const code = this.joinCodeInput.value.trim();
        if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
            alert('请输入6位数字密码');
            return;
        }

        try {
            await p2p.joinRoom(code);

            // 设置P2P回调
            this.setupP2PCallbacks();

            // 更新UI状态
            this.connectionStatus.textContent = '已连接';
            this.connectionStatus.style.color = '#34C759';
            this.roomInfo.style.display = 'block';
            this.roomCode.textContent = code;

        } catch (error) {
            alert('加入房间失败: ' + error.message);
            console.error(error);
        }
    }

    setupP2PCallbacks() {
        // 数据接收回调
        p2p.onDataReceived = (msg) => {
            console.log('收到P2P消息:', msg);

            switch (msg.type) {
                case 'sync-all':
                    // 接收到房主全量数据 → 智能合并
                    this.receiveNotesFromSync(msg.data);
                    this.updateNotesList();
                    alert(`已同步，共 ${msg.data.length} 条笔记`);
                    break;

                case 'request-sync':
                    // 对方请求本地数据 → 发送本地数据
                    if (p2p.connections) {
                        const myData = this.notes;
                        Object.values(p2p.connections).forEach(conn => {
                            if (conn.open) {
                                conn.send({
                                    type: 'sync-response',
                                    data: myData
                                });
                            }
                        });
                    }
                    break;

                case 'sync-response':
                case 'merge-remote':
                    // 收到对方的数据 → 智能合并
                    this.receiveNotesFromSync(msg.data);
                    this.updateNotesList();
                    break;

                case 'sync-note':
                    // 接收单个笔记更新
                    this.receiveSingleNote(msg.note);
                    this.updateNotesList();
                    break;

                case 'delete-note':
                    // 接收删除笔记指令
                    this.handleRemoteDelete(msg.noteId);
                    break;
            }
        };

        // 发送全量数据回调
        p2p.onSendAllData = () => this.notes;

        // 状态变化回调
        p2p.onStatusChange = (status) => {
            this.connectionStatus.textContent = status;
            if (status.includes('已连接')) {
                this.connectionStatus.style.color = '#34C759';
            } else if (status.includes('断开') || status.includes('失败')) {
                this.connectionStatus.style.color = '#FF3B30';
            } else {
                this.connectionStatus.style.color = '#8E8E93';
            }
        };

        // 房间创建成功回调
        p2p.onRoomCreated = (roomId) => {
            console.log('房间创建成功:', roomId);
        };

        // 初始化同步管理器（使用全局p2p实例）
        window.syncManager = new SyncManager(p2p, this);
    }

    receiveSingleNote(remoteNote) {
        const localIndex = this.notes.findIndex(n => n.id === remoteNote.id);

        if (localIndex === -1) {
            // 新笔记，直接添加
            this.notes.push(remoteNote);
        } else {
            // 比较更新时间，保留最新版本
            const localNote = this.notes[localIndex];
            if (new Date(remoteNote.updatedAt) > new Date(localNote.updatedAt)) {
                this.notes[localIndex] = remoteNote;
            }
        }

        this.saveNotes();
    }

    handleRemoteDelete(noteId) {
        this.notes = this.notes.filter(n => n.id !== noteId);
        this.saveNotes();

        if (this.currentNoteId === noteId) {
            this.showListView();
        }
    }

    receiveNotesFromSync(notes) {
        // 接收来自同步的笔记
        const mergedNotes = this.mergeNotes(this.notes, notes);
        this.notes = mergedNotes;
        this.saveNotes();
        this.updateNotesList();
    }

    mergeNotes(localNotes, remoteNotes) {
        const merged = [...localNotes];

        remoteNotes.forEach(remoteNote => {
            const localIndex = merged.findIndex(n => n.id === remoteNote.id);

            if (localIndex === -1) {
                // 本地没有，添加
                merged.push(remoteNote);
            } else {
                // 本地有，比较更新时间
                const localNote = merged[localIndex];
                if (new Date(remoteNote.updatedAt) > new Date(localNote.updatedAt)) {
                    merged[localIndex] = remoteNote;
                }
            }
        });

        return merged;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return '昨天';
        } else if (days < 7) {
            const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            return weekdays[date.getDay()];
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}