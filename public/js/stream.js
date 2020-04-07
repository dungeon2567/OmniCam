const peerConnections = {}
const config = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302']
    }
  ]
}

// generate stream id
const hash = generateHash()

var mediaRecorder,
    recordedChunks = []

// Get camera
const videoElement = document.querySelector("video")
const stopBtn = document.getElementById('stop-broadcast-btn')

document.getElementById('broadcast-btn').onclick = async (e) => {
  e.preventDefault()
  e.srcElement.disabled = true

  // get camera stream
  await getStream()

  const isCreatedNamespace = await createNamespace(hash)

  if(isCreatedNamespace !== 'OK'){
    alert('Não foi possível criar a transmissão! Reinicie a página e tente novamente')
    return
  }

  const socket = io.connect('/' + hash)
  window.socket = socket

  socket.on("answer", (id, description) => {
    peerConnections[id].setRemoteDescription(description)
  })

  socket.on("watcher", id => {
    const peerConnection = new RTCPeerConnection(config)
    peerConnections[id] = peerConnection

    let stream = videoElement.srcObject
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))

    peerConnection
      .createOffer()
      .then(sdp => peerConnection.setLocalDescription(sdp))
      .then(() => {
        socket.emit("offer", id, peerConnection.localDescription)
      })

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit("candidate", id, event.candidate)
      }
    }
  })

  socket.on("candidate", (id, candidate) => {
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate))
  })

  socket.on("disconnectPeer", id => {
    peerConnections[id].close()
    delete peerConnections[id]
  })

  window.onunload = window.onbeforeunload = () => {
    socket.close()
    upload()
  }
}

stopBtn.onclick = (e) => {
  e.srcElement.disabled = true
  stopStream(window.stream)
  play()
  upload()
}

async function getStream() {

  stopStream(window.stream)
  
  var mediaConstraints

  return DetectRTC.load(function () {

    if (DetectRTC.browser.name !== 'Safari' || DetectRTC.browser.name !== 'Chrome') {

      const camera = DetectRTC.videoInputDevices[1] || DetectRTC.videoInputDevices[0];

      mediaConstraints = {
        audio: true,
        video: {
          mandatory: {},
          optional: [{
            sourceId: camera.id
          }]
        }
      }

      if (DetectRTC.browser.name === 'Firefox') {
        mediaConstraints = {
          audio: true,
          video: {
            deviceId: camera.id
          }
        }
      }

    } else {
      mediaConstraints = {
        audio: true,
        video: {
          facingMode: 'environment'
        }
      }
    }

    console.log(mediaConstraints)

    return navigator.mediaDevices.getUserMedia(mediaConstraints)
      .then(gotStream)
      .catch(handleError)
  })
}

function gotStream(stream) {
  
  window.stream = stream
  videoElement.srcObject = stream

  // create whatsapp share link
  const a = document.createElement('a')
  a.href = encodeURIComponent(window.location.href) + `watch/${hash}`
  a.setAttribute('class', 'text-success font-weight-bold')
  a.setAttribute('target', '_blank')
  a.innerHTML = encodeURIComponent(window.location.href) + `watch/${hash}`;

  const shareLink = document.getElementById('share-link')
  shareLink.appendChild(a)

  window.socket.emit("broadcaster")

  // enable stop button
  stopBtn.style.display = 'block';

  record(stream)
}

function handleError(error) {
  console.error("Error: ", error)
}

function stopStream(stream) {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop()
    })
  }
}

async function createNamespace(room) {
  return axios.get(`/room/${room}`).then(response => response.data)
}

function generateHash() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function handleDataAvailable(event) {
  if (event.data.size > 0) {
    recordedChunks.push(event.data)
  }
}

function record(stream) {
  DetectRTC.load(function () {
    if(DetectRTC.browser.name !== 'Safari') {
      // record stream
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8'
      })
      mediaRecorder.ondataavailable = handleDataAvailable
      mediaRecorder.start(5000)
    }
  })
}

function play() {
  const superBuffer = new Blob(recordedChunks)
  const replay = document.createElement('video')
  replay.setAttribute('class', 'img-fluid')
  replay.src = window.URL.createObjectURL(superBuffer)
  replay.controls = true

  // chrome duration workaround
  replay.play().then(() => {
    replay.currentTime = 10e99
    replay.onseeked = () => {
      replay.currentTime = 0
      replay.pause()
      replay.onseeked = null
    }
  })
  // hide the other elements
  videoElement.style.display = 'none'
  stopBtn.style.display = 'none'
  // append to container
  document.getElementById('videosContainer').appendChild(replay)
}

function upload() {
  if(recordedChunks.length) {
    const blob = new Blob(recordedChunks, {
      type: 'video/webm'
    })
    socket.emit('saveVideoStream', hash, blob)
  }
}