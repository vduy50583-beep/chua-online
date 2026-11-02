const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
});

const MAX_PLAYERS = 200;
const players = {};          // socketId -> player object
const occupiedSeats = {};    // seatId -> socketId

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log(`[+] Kết nối mới: ${socket.id} | Tổng hiện tại: ${Object.keys(players).length}`);

    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit('temple_full', { message: 'Chùa đã đủ 200 người tham gia. Vui lòng quay lại sau!' });
        socket.disconnect(true);
        return;
    }

    // ===== 1. Người chơi bước vào chùa =====
    socket.on('join_temple', (data) => {
        if (players[socket.id]) return;

        const player = {
            id: socket.id,
            name: (data && data.name) ? String(data.name).substring(0, 40) : 'Phật Tử',
            role: (data && data.role === 'abbot') ? 'abbot' : 'user',
            style: (data && data.style) || 'lay_male',
            x: (data && typeof data.x === 'number') ? data.x : 535 + Math.random() * 80,
            y: (data && typeof data.y === 'number') ? data.y : 610,
            dir: (data && data.dir) || 'up',
            state: 'walking',
            seatId: null,
            glow: !!(data && data.glow),
            prayer: '',
            prayerTimer: 0,
            animFrame: 0,
            lastSeen: Date.now()
        };

        players[socket.id] = player;

        // Gửi trạng thái hiện tại cho người mới
        socket.emit('init_state', {
            players: players,
            occupiedSeats: occupiedSeats,
            maxPlayers: MAX_PLAYERS,
            myId: socket.id
        });

        // Báo cho mọi người khác
        socket.broadcast.emit('player_joined', player);

        // Cập nhật số người
        io.emit('update_count', Object.keys(players).length);

        console.log(`[JOIN] ${player.name} (${socket.id}) | Online: ${Object.keys(players).length}`);
    });

    // ===== 2. Đồng bộ di chuyển / trạng thái =====
    socket.on('player_move', (pos) => {
        const p = players[socket.id];
        if (!p) return;

        if (pos) {
            if (typeof pos.x === 'number') p.x = pos.x;
            if (typeof pos.y === 'number') p.y = pos.y;
            if (pos.dir) p.dir = pos.dir;
            if (pos.state) p.state = pos.state;
            if (pos.seatId !== undefined) p.seatId = pos.seatId;
            if (pos.prayer !== undefined) p.prayer = String(pos.prayer).substring(0, 60);
            if (typeof pos.prayerTimer === 'number') p.prayerTimer = pos.prayerTimer;
            if (typeof pos.animFrame === 'number') p.animFrame = pos.animFrame;
            if (pos.glow !== undefined) p.glow = !!pos.glow;
            p.lastSeen = Date.now();
        }

        socket.broadcast.emit('player_moved', {
            id: socket.id,
            x: p.x,
            y: p.y,
            dir: p.dir,
            state: p.state,
            seatId: p.seatId,
            prayer: p.prayer,
            prayerTimer: p.prayerTimer,
            animFrame: p.animFrame,
            glow: p.glow,
            name: p.name,
            role: p.role,
            style: p.style
        });
    });

    // ===== 3. Ngồi thiền / Đứng dậy =====
    socket.on('toggle_meditate', (seatId) => {
        const p = players[socket.id];
        if (!p) return;

        if (p.state === 'meditating') {
            if (p.seatId) delete occupiedSeats[p.seatId];
            p.state = 'walking';
            p.seatId = null;
            io.emit('seat_updated', {
                playerId: socket.id,
                state: 'walking',
                seatId: null,
                occupiedSeats
            });
            socket.broadcast.emit('player_moved', { ...p });
        } else if (seatId && !occupiedSeats[seatId]) {
            occupiedSeats[seatId] = socket.id;
            p.state = 'meditating';
            p.seatId = seatId;
            io.emit('seat_updated', {
                playerId: socket.id,
                state: 'meditating',
                seatId,
                occupiedSeats
            });
            socket.broadcast.emit('player_moved', { ...p });
        }
    });

    // ===== 4. Cầu nguyện =====
    socket.on('send_prayer', (prayerText) => {
        const p = players[socket.id];
        if (!p) return;
        p.prayer = String(prayerText || '').substring(0, 60);
        p.prayerTimer = 550;
        io.emit('player_prayed', {
            id: socket.id,
            prayer: p.prayer,
            prayerTimer: p.prayerTimer
        });
    });

    // ===== 5. Thỉnh chuông (Trụ trì) =====
    socket.on('ring_bell', (data) => {
        const p = players[socket.id];
        if (!p || p.role !== 'abbot') return;
        const name = (data && data.abbotName) ? data.abbotName : p.name;
        io.emit('ring_bell', { abbotName: name });
    });

    // ===== 6. Rời chùa =====
    socket.on('leave_temple', () => {
        cleanupPlayer(socket);
    });

    // ===== 7. Disconnect =====
    socket.on('disconnect', (reason) => {
        cleanupPlayer(socket);
        console.log(`[-] Ngắt kết nối: ${socket.id} (${reason}) | Online: ${Object.keys(players).length}`);
    });
});

function cleanupPlayer(socket) {
    const p = players[socket.id];
    if (!p) return;

    if (p.seatId) {
        delete occupiedSeats[p.seatId];
    }
    delete players[socket.id];

    io.emit('player_left', socket.id);
    io.emit('update_count', Object.keys(players).length);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server Chùa Online đang chạy tại http://localhost:${PORT}`);
    console.log(`Giới hạn tối đa: ${MAX_PLAYERS} người`);
});
