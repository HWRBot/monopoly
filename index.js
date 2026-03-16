const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

// Хранилище комнат
const rooms = {}

function createRoom() {
  return {
    players: [],
    gameState: null,
    started: false,
  }
}

io.on('connection', (socket) => {
  console.log('Подключился:', socket.id)

  // Присоединиться к комнате
  socket.on('join_room', ({ roomId, playerName }) => {
    if (!rooms[roomId]) rooms[roomId] = createRoom()
    const room = rooms[roomId]

    if (room.started) {
      socket.emit('error', 'Игра уже началась!')
      return
    }
    if (room.players.length >= 6) {
      socket.emit('error', 'Комната заполнена!')
      return
    }

    const player = { id: socket.id, name: playerName, index: room.players.length }
    room.players.push(player)
    socket.join(roomId)
    socket.data.roomId = roomId
    socket.data.playerIndex = player.index

    io.to(roomId).emit('room_update', { players: room.players, started: room.started })
    console.log(`${playerName} вошёл в комнату ${roomId}`)
  })

  // Начать игру (только первый игрок)
  socket.on('start_game', ({ roomId, gameState }) => {
    if (!rooms[roomId]) return
    rooms[roomId].gameState = gameState
    rooms[roomId].started = true
    io.to(roomId).emit('game_started', { gameState, players: rooms[roomId].players })
  })

  // Синхронизировать состояние игры
  socket.on('game_update', ({ roomId, gameState }) => {
    if (!rooms[roomId]) return
    rooms[roomId].gameState = gameState
    socket.to(roomId).emit('game_updated', { gameState })
  })

  // Отключение
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId
    if (!roomId || !rooms[roomId]) return
    rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id)
    io.to(roomId).emit('room_update', { players: rooms[roomId].players, started: rooms[roomId].started })
    console.log('Отключился:', socket.id)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`))