import { Id,Voice } from "../state.js";

const APP_ID =
"c0aaefec9bad469eaa9f3d5562bf8dc0";


let client = null;
let localAudioTrack
let isMuted = false;
const micBtn = document.getElementById("micBtn");




/*********AGORA-FUNCTIONS********/



//Join-channel
export async function Joinvoicechannel(docId) {

  if(!client){
  client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
}

  // ⭐ enable speaking detection
  client.enableAudioVolumeIndicator();

  // ⭐ speaking event
  client.on("volume-indicator", (volumes) => {

    console.log("VOLUME EVENT:", volumes);

    volumes.forEach(v => {
      const speaking = v.level > 3;
      updateSpeakingUI(v.uid, speaking);
    });

  });

  // ⭐ remote audio
  client.on("user-published", async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === "audio") {
      user.audioTrack.play();
    }
  });

  // ⭐ join
  const channel = getSafeChannelName(docId);
  await client.join(APP_ID, channel, null, Id.CURRENT_USER_ID);

  console.log("Joined Agora:", channel);
}
  
  
  //safe-channel-name.
  function getSafeChannelName(roomId) {
  return roomId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
}

  

  
  
  function updateSpeakingUI(uid, speaking) {

  const slot = document.querySelector(`.avatar[data-uid="${uid}"]`);
  if (!slot) return;

  const currentlySpeaking = slot.classList.contains("speaking");

  if (speaking && !currentlySpeaking) {
    slot.classList.add("speaking");
  }

  if (!speaking && currentlySpeaking) {
    slot.classList.remove("speaking");
  }

}
  
  
 //Leave-Voice-channel
 export  async function leaveVoicechannel() {

  try {

    // ⭐ unpublish mic first
    if (client && localAudioTrack) {
      await client.unpublish([localAudioTrack]);
    }

    // ⭐ stop mic
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
      localAudioTrack = null;
    }

    // ⭐ leave channel
    if (client) {
      await client.leave();
      client = null;
    }

    console.log("Left Agora");

  } catch (err) {
    console.error("Agora leave error:", err);
  }
  console.log("leaveVoicechannel");
}
     
     
  //Mute-and-Unmute.

async function toggleMute() {

  try {

    // ⭐ FIRST TAP → Create mic & publish
    if (!localAudioTrack) {

      localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

      await client.publish([localAudioTrack]);

      isMuted = false;

      updateMicUI(false);

      console.log("Mic started");
      return;
    }

    // ⭐ AFTER → Toggle mute
    isMuted = !isMuted;

    await localAudioTrack.setEnabled(!isMuted);

    updateMicUI(isMuted);

    console.log("Mic toggled:", isMuted);

  } catch (err) {
    console.error("Mic toggle error:", err);
  }
}

micBtn?.addEventListener("click", toggleMute);

export function updateMicUI(muted) {

  const btn = document.getElementById("micBtn");
  const icon = document.getElementById("micIcon");

  if (muted) {
    btn.classList.add("muted");
    icon.className = "ri-mic-off-line";
  } else {
    btn.classList.remove("muted");
    icon.className = "ri-mic-line";
  }
  console.log("updateMic")
}

