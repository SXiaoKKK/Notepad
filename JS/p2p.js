class P2PManager {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.localStream = null;
        this.isHost = false;
        this.roomCode = null;
        this.onConnectionStateChange = null;
        this.onDataReceived = null;
        
        // STUN服务器配置
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }
    
    async createRoom() {
        this.isHost = true;
        
        // 生成6位数字密码
        this.roomCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 创建RTCPeerConnection
        await this.createPeerConnection();
        
        // 创建数据通道
        this.dataChannel = this.peerConnection.createDataChannel('memos-sync', {
            ordered: true
        });
        
        this.setupDataChannel(this.dataChannel);
        
        // 创建offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        
        // 将offer保存到信令服务器（这里使用简单的复制粘贴或二维码方案）
        console.log('Room created:', this.roomCode);
        console.log('Offer:', JSON.stringify(offer));
        
        return this.roomCode;
    }
    
    async joinRoom(code) {
        this.isHost = false;
        this.roomCode = code;
        
        // 创建RTCPeerConnection
        await this.createPeerConnection();
        
        // 监听数据通道
        this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel(this.dataChannel);
        };
        
        // 这里需要从信令服务器获取offer
        // 在实际应用中，需要通过信令服务器交换SDP
        // 简化实现：使用手动交换或简单的WebSocket信令
        console.log('Joining room:', code);
        
        // 模拟：在实际应用中，这里需要实现信令交换
        // 可以通过复制粘贴、二维码或简单的信令服务器来实现
    }
    
    async createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.configuration);
        
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE candidate:', event.candidate);
                // 在实际应用中，需要将candidate发送给对方
            }
        };
        
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Connection state:', state);
            
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }
        };
        
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
        };
    }
    
    setupDataChannel(channel) {
        channel.onopen = () => {
            console.log('Data channel opened');
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange('connected');
            }
        };
        
        channel.onclose = () => {
            console.log('Data channel closed');
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange('disconnected');
            }
        };
        
        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received data:', data);
                
                if (this.onDataReceived) {
                    this.onDataReceived(data);
                }
            } catch (error) {
                console.error('Error parsing received data:', error);
            }
        };
        
        channel.onerror = (error) => {
            console.error('Data channel error:', error);
        };
    }
    
    sendData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(data));
        } else {
            console.warn('Data channel not open');
        }
    }
    
    async setRemoteOffer(offer) {
        if (!this.peerConnection) {
            await this.createPeerConnection();
        }
        
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        return answer;
    }
    
    async addIceCandidate(candidate) {
        if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }
    
    disconnect() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        this.dataChannel = null;
        this.peerConnection = null;
    }
}