class SyncManager {
    constructor(p2pManager, noteApp) {
        this.p2pManager = p2pManager;
        this.noteApp = noteApp;
        this.isConnected = false;
        
        this.setupSync();
    }
    
    setupSync() {
        // 监听P2P数据接收
        this.p2pManager.onDataReceived = (data) => {
            this.handleIncomingData(data);
        };
        
        // 监听连接状态
        this.p2pManager.onConnectionStateChange = (state) => {
            this.isConnected = state === 'connected';
            
            if (state === 'connected') {
                // 连接建立后，立即同步所有笔记
                this.syncAllNotes();
            }
        };
    }
    
    handleIncomingData(data) {
        switch (data.type) {
            case 'sync-all':
                // 接收全部笔记同步
                this.handleSyncAll(data.notes);
                break;
                
            case 'sync-note':
                // 接收单个笔记同步
                this.handleSyncNote(data.note);
                break;
                
            case 'delete-note':
                // 接收删除笔记指令
                this.handleDeleteNote(data.noteId);
                break;
                
            case 'request-sync':
                // 对方请求同步
                this.syncAllNotes();
                break;
        }
    }
    
    handleSyncAll(remoteNotes) {
        const mergedNotes = this.noteApp.mergeNotes(this.noteApp.notes, remoteNotes);
        this.noteApp.notes = mergedNotes;
        this.noteApp.saveNotes();
        this.noteApp.updateNotesList();
    }
    
    handleSyncNote(remoteNote) {
        const localIndex = this.noteApp.notes.findIndex(n => n.id === remoteNote.id);
        
        if (localIndex === -1) {
            // 新笔记，直接添加
            this.noteApp.notes.push(remoteNote);
        } else {
            // 比较更新时间，保留最新版本
            const localNote = this.noteApp.notes[localIndex];
            if (new Date(remoteNote.updatedAt) > new Date(localNote.updatedAt)) {
                this.noteApp.notes[localIndex] = remoteNote;
            }
        }
        
        this.noteApp.saveNotes();
        this.noteApp.updateNotesList();
    }
    
    handleDeleteNote(noteId) {
        this.noteApp.notes = this.noteApp.notes.filter(n => n.id !== noteId);
        this.noteApp.saveNotes();
        
        if (this.noteApp.currentNoteId === noteId) {
            this.noteApp.showListView();
        }
        
        this.noteApp.updateNotesList();
    }
    
    syncAllNotes() {
        if (!this.isConnected) return;
        
        const data = {
            type: 'sync-all',
            notes: this.noteApp.notes,
            timestamp: new Date().toISOString()
        };
        
        this.p2pManager.sendData(data);
    }
    
    syncNote(note) {
        if (!this.isConnected) return;
        
        const data = {
            type: 'sync-note',
            note: note,
            timestamp: new Date().toISOString()
        };
        
        this.p2pManager.sendData(data);
    }
    
    deleteNote(noteId) {
        if (!this.isConnected) return;
        
        const data = {
            type: 'delete-note',
            noteId: noteId,
            timestamp: new Date().toISOString()
        };
        
        this.p2pManager.sendData(data);
    }
}