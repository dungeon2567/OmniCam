const path = require('path')
const fs = require('fs')
const express = require('express')
const app = express()
const server = require('http').Server(app)
const port = process.env.PORT || 5001
const bodyParser = require('body-parser')
const io = require('socket.io')(server)

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.use(bodyParser.urlencoded({ extended: true }))

// Set public folder as root
app.use('/', express.static(__dirname + '/public'))

// Provide access to node_modules folder
app.use('/scripts', express.static(__dirname + '/node_modules/'))

// Redirect all traffic to index.ejs
app.get('/', (req, res) => {
  res.render('stream')
})

// Pass params to index.ejs
app.get('/watch/:token', (req, res) => {
  res.render('watch', {
    token: req.params.token
  })
})

app.get('/room/:hash', (req, res) => {

  let broadcaster

  const nsp = io.of('/' + req.params.hash)

  console.log(`Created namespace ${req.params.hash}`)
  
  nsp.on("error", e => console.log(e))
  nsp.on("connection", socket => {

    // webrtc connection
    socket.on("broadcaster", () => {
      broadcaster = socket.id
      socket.broadcast.emit("broadcaster")
    })

    socket.on("watcher", () => {
      socket.to(broadcaster).emit("watcher", socket.id)
    })

    socket.on("offer", (id, message) => {
      socket.to(id).emit("offer", socket.id, message)
    })

    socket.on("answer", (id, message) => {
      socket.to(id).emit("answer", socket.id, message)
    })

    socket.on("candidate", (id, message) => {
      socket.to(id).emit("candidate", socket.id, message)
    })

    socket.on("disconnect", () => {
      if(broadcaster == socket.id)
        socket.broadcast.emit('disconnectBroadcaster')
      socket.to(broadcaster).emit("disconnectPeer", socket.id)
    })

    // save video record
    socket.on('saveVideoStream', (filename, buffer) => {
      if(writeToDisk(filename, buffer) == true)
        socket.broadcast.emit('savedVideoStream')
    })
  })

  //rend status 200
  res.sendStatus(200)
})

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.info('listening on %d', server.address().port)
})

function writeToDisk(filename, buffer) {
  //path to store uploaded files (NOTE: presumed you have created the folders)
  const uploadedFile = __dirname + '/uploads/' + filename + '.webm'

  fs.open(uploadedFile, 'a', 0755, (err, fd) => {
    if (err) throw err

    fs.write(fd, buffer, null, 'Binary', (err, written, buff) => {
      fs.close(fd, () => {
        console.log('File saved successfully!') 
      })
    })
  })

  return true
}