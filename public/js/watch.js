let peerConnection
const config = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302']
    }
  ]
}

const room = document.getElementById('room').value
const video = document.querySelector("video")

document.getElementById('broadcast-btn').onclick = (e) => {
  e.preventDefault()
  e.srcElement.disabled = true

  const socket = io.connect('/' + room)
  window.socket = socket

  socket.on("offer", (id, description) => {
    peerConnection = new RTCPeerConnection(config)
    peerConnection
      .setRemoteDescription(description)
      .then(() => peerConnection.createAnswer())
      .then(sdp => peerConnection.setLocalDescription(sdp))
      .then(() => {
        socket.emit("answer", id, peerConnection.localDescription)
      })
    peerConnection.ontrack = event => {
      video.srcObject = event.streams[0]
    }
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit("candidate", id, event.candidate)
      }
    }
  })

  socket.on("candidate", (id, candidate) => {
      peerConnection
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => console.error(e))
    })

  socket.on("connect", () => {
    socket.emit("watcher")
  })

  socket.on("broadcaster", () => {
    socket.emit("watcher")
  })
  
  socket.on("disconnectPeer", () => {
    peerConnection.close()
  })

  socket.on("disconnectBroadcaster", () => {
    
    //generate white noise
    const stream = whiteNoise().captureStream()
    video.srcObject = stream
  })
  
  window.onunload = window.onbeforeunload = () => {
    socket.close()
  }
}

function whiteNoise() {
  let canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 300

  let ctx = canvas.getContext('2d')
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  let p = ctx.getImageData(0, 0, canvas.width, canvas.height)
  requestAnimationFrame(function draw(){
    for (var i = 0; i < p.data.length; i++) {
      p.data[i++] = p.data[i++] = p.data[i++] = Math.random() * 255
    }
    ctx.putImageData(p, 0, 0)
    requestAnimationFrame(draw)
  })
  return canvas;
}