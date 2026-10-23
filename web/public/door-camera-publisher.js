(function () {
  window.createDoorCameraPublisher = function (onError) {
    var id = null, stream = null, timer = null, peers = new Map(), generation = 0;
    async function post(body) {
      var response = await fetch("/api/door-camera", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), keepalive: body.action === "stop",
      });
      if (!response.ok) {
        var error = await response.json();
        throw new Error(error.error || "Door camera sharing failed.");
      }
    }
    async function stop() {
      generation++;
      clearTimeout(timer);
      peers.forEach(function (entry) { entry.pc.close(); });
      peers.clear();
      var previous = id;
      id = null;
      stream = null;
      if (previous) await post({ role: "camera", action: "stop", id: previous });
    }
    async function start(cameraStream) {
      await stop();
      var current = ++generation;
      var publisherId = crypto.randomUUID();
      await post({ role: "camera", action: "start", id: publisherId });
      if (current !== generation) {
        await post({ role: "camera", action: "stop", id: publisherId });
        return;
      }
      id = publisherId;
      stream = cameraStream;
      async function tick() {
        try {
          if (current !== generation) return;
          await post({ role: "camera", action: "heartbeat", id: publisherId });
          var response = await fetch("/api/door-camera?publisher=" + publisherId, { cache: "no-store" });
          if (!response.ok) throw new Error("Camera viewers could not be loaded.");
          var data = await response.json();
          if (current !== generation) return;
          var active = new Set(data.peers.map(function (p) { return p.id; }));
          peers.forEach(function (entry, key) { if (!active.has(key)) { entry.pc.close(); peers.delete(key); } });
          for (var remote of data.peers) {
            if (current !== generation) return;
            var entry = peers.get(remote.id);
            if (!entry) {
              var pc = new RTCPeerConnection({ iceServers: data.iceServers });
              entry = { pc: pc, ice: 0 };
              peers.set(remote.id, entry);
              stream.getVideoTracks().forEach(function (track) { pc.addTrack(track, stream); });
              (function (connection, viewerId) {
                connection.onicecandidate = function (event) {
                  if (event.candidate && current === generation) {
                    post({ role: "camera", action: "ice", id: publisherId, viewerId: viewerId, candidate: event.candidate.toJSON() })
                      .catch(function (error) { if (current === generation) onError(error.message); });
                  }
                };
              })(pc, remote.id);
              await pc.setRemoteDescription(remote.offer);
              await pc.setLocalDescription(await pc.createAnswer());
              await post({ role: "camera", action: "answer", id: publisherId, viewerId: remote.id, sdp: pc.localDescription });
            }
            for (; entry.ice < remote.viewerIce.length; entry.ice++) await entry.pc.addIceCandidate(remote.viewerIce[entry.ice]);
          }
        } catch (error) {
          if (current === generation) onError(error.message || "The door camera could not update.");
        } finally {
          if (current === generation) timer = setTimeout(tick, 800);
        }
      }
      void tick();
    }
    return { start: start, stop: stop };
  };
})();
