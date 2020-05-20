var app = require('express')();
var http = require('http').createServer(app);
var io = require("socket.io")(http);
const GameService = require("./game-service.js");

app.get('/', function (req, res){
    res.sendFile(__dirname + '/index.html');
});

var rooms = [];
var gameService = null;
var username = ''
var roomCode = '';

function getNewNeighbor(name, socketId) {
    return {
        name: name,
        ready: false,
        strikeCount: 0,
        socketId: socketId
    };
}

function getNeighbor(gameCode, name) {
    let room = getRoom(gameCode.toUpperCase());
    if (room.neighbors) {
        return room.neighbors.filter(n => n.name === name)[0];
    }
}

function getRoom(gameCode) {
    return rooms.filter(r => r.name === gameCode.toUpperCase())[0];
}

io.on('connection', (socket) => {
    io.emit('admin-update', { rooms });

    socket.on('disconnect', () => {
        leaveGame();
    });

    socket.on('create', (gameCode, neighborhoodName) => {
        
        var newRoom = { name: gameCode, neighbors: [] };
        rooms.push(newRoom);

        gameService = new GameService();
        gameService.start();

        joinGame(gameCode, neighborhoodName, newRoom)

    });

    socket.on('join', (gameCode, neighborhoodName) => {
        var  room = getRoom(gameCode);

        if (!room || !room.neighbors) {
            io.emit('error', `Game not found with code ${gameCode}`)
            return;
        }
        
        joinGame(gameCode, neighborhoodName, room);
    });

    socket.on('leave', () => {
        leaveGame();
    });

    socket.on('ready', (gameCode, neighborhoodName) => {

        getNeighbor(gameCode, neighborhoodName).ready = true;

        let room = getRoom(gameCode);

        if (room.neighbors.every(n => n.ready))
        {
            gameService.deal();
            io.in(gameCode.toUpperCase()).emit('game-state', gameService.table );
            room.neighbors.forEach(n => n.ready = false);
        }
        
        io.in(gameCode.toUpperCase()).emit('user-update', room.neighbors);
    });

    socket.on('strike', (gameCode, neighborhoodName) => {

        getNeighbor(gameCode, neighborhoodName).strikeCount ++;

        let room = getRoom(gameCode);

        if (room.neighbors.some(n => n.strikeCount === 3))
        {
            io.in(gameCode.toUpperCase()).emit('game-over');
        }
        
        io.in(gameCode.toUpperCase()).emit('user-update', room.neighbors);
    });

    socket.on('goal-accomplished', (index) => {
        gameService.progressGoal(index);
    });

    function joinGame(gameCode, neighborhoodName, room) {
        gameCode = gameCode.toUpperCase();
        socket.join(gameCode);
        username = neighborhoodName;
        roomCode = gameCode;
    
        room.neighbors.push(getNewNeighbor(neighborhoodName, socket.id));
        
        io.in(gameCode.toUpperCase()).emit('user-update', room.neighbors);
        io.in(gameCode.toUpperCase()).emit('game-state', gameService.table);
        io.to(socket.id).emit('game-confirmation', { neighborhoodName, gameCode });
        io.emit('admin-update', { rooms });
    }

    function leaveGame() {
        var room = getRoom(roomCode);
        if (room) {
            socket.leave(roomCode);
            room.neighbors = room.neighbors.filter(n => n.name !== username);
            destroyIfEmpty(room);
            io.in(roomCode).emit('user-update', room.neighbors);
        }
        roomCode = null;
        username = null;
        io.emit('admin-update', { rooms });
    }

});

function destroyIfEmpty(room) {
    if (room.neighbors.length <= 0) {
        rooms = rooms.filter(r => r.name !== room.name);
    }
}

function logList(array) {
    array.forEach(item => console.log(item));
}

http.listen(process.env.PORT || 5000);