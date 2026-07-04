class SyncManager {
    constructor(p2pManager, noteApp) {
        this.p2pManager = p2pManager;
        this.noteApp = noteApp;
        this.isConnected = false;
        
        this.setupSync();
    }
    
    setupSync() {
        // 监听连接状态
        const originalStatusChange = this.p2pManager.onStatusChange;
        this.p2pManager.onStatusChange = (status) => {
            this.isConnected = status.includes('已连接');
            
            // 调用原始的状态变化回调
            if (originalStatusChange) {
                originalStatusChange(status);
            }
        };
    }
    
    syncAllNotes() {
        if (!this.isConnected) return;
        
        const data = {
            type: 'sync-all',
            data: this.noteApp.notes,
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