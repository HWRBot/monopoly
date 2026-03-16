const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}))
app.options('*', cors())

app.get('/', (req, res) => res.send('Monopoly server running!'))

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false,
  },
  allowEIO3: true,
  transports: ['polling', 'websocket'],
})

const rooms = {}

io.on('connection', (socket) => {
  console.log('Подключился:', socket.id)

  socket.on('join_room', ({ roomId, playerName }) => {
    if (!rooms[roomId]) rooms[roomId] = { players: [], gameState: null, started: false }
    const room = rooms[roomId]

    if (room.started) { socket.emit('error', 'Игра уже началась!'); return }
    if (room.players.length >= 6) { socket.emit('error', 'Комната заполнена!'); return }
    if (room.players.find(p => p.id === socket.id)) return

    const player = { id: socket.id, name: playerName, index: room.players.length }
    room.players.push(player)
    socket.join(roomId)
    socket.data.roomId = roomId

    io.to(roomId).emit('room_update', { players: room.players, started: room.started })
    console.log(`${playerName} вошёл в комнату ${roomId}`)
  })

  socket.on('start_game', ({ roomId, gameState }) => {
    if (!rooms[roomId]) return
    rooms[roomId].gameState = gameState
    rooms[roomId].started = true
    io.to(roomId).emit('game_started', { gameState, players: rooms[roomId].players })
  })

  socket.on('game_update', ({ roomId, gameState }) => {
    if (!rooms[roomId]) return
    rooms[roomId].gameState = gameState
    socket.to(roomId).emit('game_updated', { gameState })
  })

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