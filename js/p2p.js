// ==================== P2P 实时同步 (基于PeerJS) ====================

// 使用 PeerJS 官方免费信令服务器
const PEER_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    debug: 0
};

class P2PManager {
    constructor() {
        this.peer = null;
        this.connections = {};
        this.roomId = null;
        this.isHost = false;
        this.onDataReceived = null;
        this.onSendAllData = null;
        this.onStatusChange = null;
        this.onRoomCreated = null;
        this.reconnectTimer = null;
        this.status = '未连接';
    }

    // 创建房间（设备A - 房主）
    async createRoom() {
        this.isHost = true;
        this.roomId = this.generateRoomId();

        try {
            await this.initPeer();

            // 监听连接请求（房主接收加入者的连接）
            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.updateStatus('等待设备加入...');

            // 回调通知房间创建成功
            if (this.onRoomCreated) {
                this.onRoomCreated(this.roomId);
            }

            return this.roomId;
        } catch (err) {
            console.error('创建房间失败:', err);
            this.updateStatus('创建失败: ' + err.message);
            throw err;
        }
    }

    // 加入房间（设备B - 加入者）
    async joinRoom(roomId) {
        this.isHost = false;
        this.roomId = roomId;

        try {
            await this.initPeer();

            this.updateStatus('正在连接房间 ' + roomId + '...');

            // 连接到主机
            const conn = this.peer.connect(roomId, {
                reliable: true,
                serialization: 'json'
            });

            conn.on('open', () => {
                console.log('已连接到主机');
                this.connections[conn.peer] = conn;
                this.updateStatus('已连接 ✅');

                // 加入者连接成功后，请求同步数据
                conn.send({
                    type: 'request-sync'
                });
            });

            conn.on('data', (data) => {
                console.log('收到数据:', data);
                if (this.onDataReceived) {
                    this.onDataReceived(data);
                }
            });

            conn.on('close', () => {
                delete this.connections[conn.peer];
                this.updateStatus('连接断开');
                this.scheduleReconnect(roomId);
            });

            conn.on('error', (err) => {
                console.error('连接错误:', err);
                this.updateStatus('连接失败，请检查房间码');
            });

            return true;
        } catch (err) {
            console.error('加入房间失败:', err);
            this.updateStatus('加入失败: ' + err.message);
            throw err;
        }
    }

    // 初始化 Peer
    async initPeer() {
        return new Promise((resolve, reject) => {
            // 房主使用房间ID作为Peer ID，加入者使用随机ID
            const peerId = this.isHost ? this.roomId : this.generateId();

            console.log('初始化Peer, ID:', peerId, '角色:', this.isHost ? '房主' : '加入者');

            this.peer = new Peer(peerId, PEER_CONFIG);

            this.peer.on('open', (id) => {
                console.log('Peer 已连接, 实际ID:', id);
                // 更新实际的Peer ID
                if (this.isHost && id !== this.roomId) {
                    this.roomId = id;
                }
                resolve();
            });

            this.peer.on('error', (err) => {
                console.error('Peer 错误:', err);
                if (err.type === 'peer-unavailable') {
                    reject(new Error('房间不存在或主机已离线'));
                } else if (err.type === 'unavailable-id') {
                    // ID已被占用，尝试使用随机ID
                    if (this.isHost) {
                        this.roomId = this.generateRoomId();
                        this.peer.destroy();
                        this.initPeer().then(resolve).catch(reject);
                        return;
                    }
                    reject(new Error('房间ID不可用，请重试'));
                } else if (err.type === 'network') {
                    reject(new Error('网络连接失败，请检查网络'));
                } else if (err.type === 'server-error') {
                    reject(new Error('信令服务器错误，请稍后重试'));
                } else {
                    reject(new Error(err.message || '连接失败'));
                }
            });

            this.peer.on('disconnected', () => {
                console.log('Peer断开连接');
                this.updateStatus('连接断开，尝试重连...');
                this.scheduleReconnect();
            });
        });
    }

    // 处理连接（房主端处理加入者的连接）
    handleConnection(conn) {
        console.log('收到新连接:', conn.peer);

        conn.on('open', () => {
            console.log('新设备已连接:', conn.peer);
            this.connections[conn.peer] = conn;
            const count = Object.keys(this.connections).length;
            this.updateStatus('已连接 ✅ (共 ' + count + ' 台设备)');

            // 房主发送当前所有数据给新设备
            if (this.isHost && this.onSendAllData) {
                const allData = this.onSendAllData();
                conn.send({
                    type: 'sync-all',
                    data: allData
                });
                console.log('已发送全量数据:', allData.length, '条');

                // 请求新设备也发送它的数据给房主（双向同步）
                conn.send({
                    type: 'request-sync'
                });
            }
        });

        conn.on('data', (raw) => {
            console.log('房主收到数据:', raw);
            
            // 房主处理加入者发送的数据
            if (this.isHost && raw.type === 'sync-response') {
                // 房主自己先合并
                if (this.onDataReceived) {
                    this.onDataReceived({ 
                        type: 'merge-remote', 
                        data: raw.data 
                    });
                }
                // 再广播给其他设备（排除发送者）
                Object.values(this.connections).forEach(otherConn => {
                    if (otherConn.peer !== conn.peer && otherConn.open) {
                        otherConn.send({
                            type: 'merge-remote',
                            data: raw.data
                        });
                    }
                });
            }
            
            // 转发其他类型的数据
            if (this.onDataReceived && raw.type !== 'sync-response') {
                this.onDataReceived(raw);
            }
        });

        conn.on('close', () => {
            console.log('设备断开连接:', conn.peer);
            delete this.connections[conn.peer];
            const count = Object.keys(this.connections).length;
            this.updateStatus(count > 0 ? '已连接 ✅ (共 ' + count + ' 台设备)' : '等待设备加入...');
        });

        conn.on('error', (err) => {
            console.error('连接错误:', err);
        });
    }

    // 广播消息给所有连接
    broadcast(msg) {
        Object.values(this.connections).forEach(conn => {
            if (conn.open) {
                conn.send(msg);
            }
        });
    }

    // 发送数据给所有连接的对等端
    sendData(data) {
        if (this.isHost) {
            // 房主广播给所有加入者
            this.broadcast(data);
        } else {
            // 加入者发送给房主
            const hostConn = Object.values(this.connections)[0];
            if (hostConn && hostConn.open) {
                hostConn.send(data);
            }
        }
    }

    // 离开房间
    leaveRoom() {
        clearTimeout(this.reconnectTimer);
        Object.values(this.connections).forEach(conn => conn.close());
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections = {};
        this.roomId = null;
        this.isHost = false;
        this.updateStatus('未连接');
    }

    // 重连
    scheduleReconnect(roomId) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(async () => {
            if (this.peer && !this.peer.destroyed) {
                this.peer.reconnect();
            } else if (roomId) {
                try {
                    await this.joinRoom(roomId);
                } catch (e) {
                    console.error('重连失败:', e);
                }
            }
        }, 3000);
    }

    updateStatus(msg) {
        this.status = msg;
        console.log('P2P状态:', msg);
        if (this.onStatusChange) {
            this.onStatusChange(msg);
        }
    }

    // 生成6位数字房间码
    generateRoomId() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // 获取连接状态
    get isConnected() {
        return Object.keys(this.connections).length > 0;
    }
}

// 创建全局P2P实例
const p2p = new P2PManager();