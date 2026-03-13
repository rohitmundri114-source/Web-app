import { Id, Voice } from "./state.js";
import { openProfile } from "./modules/profile.js";
import { Joinvoicechannel,leaveVoicechannel, updateMicUI} from "./services/agora.js";
import { db } from "../services/firebase.js";
import { supabaseClient } from "./services/supabase.js";


const CURRENT_USER_ID = Id.CURRENT_USER_ID;


const participants = new Map();


const createbtn = document.getElementById("create-room");
const container = document.getElementById("input-container");
const confirmbtn = document.getElementById("Confirm-btn");
const Data = document.getElementById("data");
 const raiseBtn = document.getElementById("raiseHandBtn");

/* -------------------------------
      INIT MODULE
--------------------------------*/

export function initVoiceRooms(){

  

  createbtn?.addEventListener("click", showCreateUI);
  confirmbtn?.addEventListener("click", handleConfirm);

  raiseBtn?.addEventListener("click", raiseHand);
  
  //toggle-for-request-panel.
  document.getElementById("requestBtn")?.onclick = () => {
  document.getElementById("requestPanel")
    ?.classList.toggle("hidden");
};


  loadRooms();
  
  

}




/*********ROOM-CREATE***********/

async function createRoom() {

  
  Voice.isRoomAdmin = true;

 const UserInput = Data.value.trim();

  if (!UserInput || UserInput.length > 30) {
    alert("Invalid room name");
    return;
  }

  try {

    // ⭐ fetch avatar from Supabase profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("avatar_url")
      .eq("id", CURRENT_USER_ID)
      .single();

    const avatarUrl = profile?.avatar_url || null;

    // ⭐ create firebase room
    const docRef = await db.collection("rooms").add({
      name: UserInput,
      createdBy: CURRENT_USER_ID,
      adminAvatar: avatarUrl,   // snapshot for fast UI
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    
    Data.value = "";
    container.classList.add("hidden");
    createbtn.classList.remove("hidden");

    joinRoomAsAdmin(docRef.id);


  } catch (err) {
    console.error(err);
  }
  console.log("createroom")
}

function loadRooms() {

  const VoiceContainer = document.getElementById("voice-card");
  if(!VoiceContainer) return;

  db.collection("rooms")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {

      if (!snapshot) return;

      VoiceContainer.replaceChildren();

      snapshot.forEach((doc) => {

        const data = doc.data();

        const roomId = doc.id;
        const roomName = data?.name || "Room";
        const avatar = data?.adminAvatar || "default.png";
        const createdBy = data?.createdBy || null;

        voicecard(roomId, roomName, avatar, createdBy);
      });

    });
    console.log("room-loaded")
}




/*********JOINING-FTN***********/

async function joinRoomAsAdmin(roomId) {

  Voice.currentRoomId = roomId;
  Voice.isRoomAdmin = true;

  try {

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", CURRENT_USER_ID)
      .single();

    const name = profile?.username || "User";
    const avatarUrl = profile?.avatar_url || null;

    await db.collection("rooms")
      .doc(roomId)
      .collection("users")
      .doc(CURRENT_USER_ID)
      .set({
        name,
        avatarUrl,
        role: "admin",
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    // ⭐ START VOICE (FIX)
    await Joinvoicechannel(roomId);

    // ⭐ UI
    roomUI();
    
    //request-panel
    document.getElementById("requestPanel").classList.add("hidden")
    
    //rasie-hand
    document.getElementById("raiseHandBtn").classList.add("hidden");
    
    listenForRequests(roomId);

    // ⭐ listeners
    Voice.unsubscribeRoom = listeners(roomId);
    Voice.roomDeleteUnsub = watchRoomDeletion(roomId);

  } catch (err) {
    console.error(err);
  }

  console.log("joinRoomAsAdmin");
}

async function joinRoom(docId) {

  Voice.isRoomAdmin = false;

  // ⭐ prevent rejoin
  if (Voice.currentRoomId === docId) return;

  // ⭐ cleanup previous listeners
  if (Voice.unsubscribeRoom) Voice.unsubscribeRoom();
  if (Voice.roomDeleteUnsub) Voice .roomDeleteUnsub();

  // ⭐ cleanup previous voice (NEW)
  await leaveVoicechannel();

  Voice.currentRoomId = docId;

  try {

    // ⭐ ensure participant
    await ensureUserJoined(docId);

    // ⭐ load metadata
    await roomData(docId);

    // ⭐ JOIN VOICE (FIXED)
    await Joinvoicechannel(docId);

    // ⭐ show UI
    roomUI();
    
    //raise-Hand
    if (!Voice.isRoomAdmin) {
  document.getElementById("raiseHandBtn").classList.remove("hidden");
}

    // ⭐ listeners
    Voice.unsubscribeRoom = listeners(docId);
    Voice.roomDeleteUnsub = watchRoomDeletion(docId);

    // ⭐ pause feed
    pauseAllVideos?.();

  } catch (err) {
    console.error(err);
  }

  console.log("joinroom");
}




/******************************
         UI-FUNCTIONS
*******************************/

function showCreateUI(){
  
  createbtn.classList.add("hidden");
  container.classList.remove("hidden");
  Data.focus();



}

function voicecard(docId, roomName, avatarUrl, createdBy) {

  const Container = document.getElementById("voice-card");
  if(!Container) return;

  const card = document.createElement("div");
  card.className = "voice-card";
  card.dataset.roomId = docId;

  card.innerHTML = `
    <div class="vc-left">
      <img class="vc-avatar"
           src="${avatarUrl || "default.png"}"
           loading="lazy"
           decoding="async"
           onerror="this.src='default.png'">
    </div>

    <div class="vc-right">
      <div class="vc-top">
        <div class="live-dot"></div>
        <span class="live-text">Live now</span>
        <i class="ri-group-fill">
          <span class="member-count">0</span>
        </i>
      </div>

      <p class="room-name">${roomName}</p>
      <button class="join-btn">Join</button>
    </div>
  `;

  Container.appendChild(card);

  // ⭐ join button
  card.querySelector(".join-btn")
    .addEventListener("click", () => joinRoom(docId));

  // ⭐ member count realtime
  const countEl = card.querySelector(".member-count");
  db.collection("rooms")
    .doc(docId)
    .collection("users")
    .onSnapshot((snap) => {
      countEl.textContent = snap.size;
    });

  // ⭐ avatar → creator profile
  if (createdBy) {
    card.querySelector(".vc-avatar")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        openProfile(createdBy);
      });
  }
  console.log("voice-card")
}

function roomUI() {
  document.getElementById("roomUI").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  document.querySelector(".nav-container").classList.add("hidden");
  
  const raiseBtn = document.getElementById("raiseHandBtn");

if (!Voice.isRoomAdmin) {
  raiseBtn.classList.remove("hidden");
} else {
  raiseBtn.classList.add("hidden");
}
  
  Voice.isMuted = true;
updateMicUI(true);
}

function showmessage(name, actionText, avatarUrl, type = "join") {

  const Msgcontainer = document.getElementById("room-messages");
  if (!Msgcontainer) return;

  const msg = document.createElement("div");
  msg.className = `room-msg ${type}`;

  msg.innerHTML = `
    <img src="${avatarUrl || "default.png"}" onerror="this.src='default.png'">
    <span><b>${name}</b> ${actionText}</span>
  `;
  if (Msgcontainer.children.length > 3) {
  Msgcontainer.firstChild.remove();
}

  Msgcontainer.appendChild(msg);

  // ⭐ auto remove with fade
  setTimeout(() => {
    msg.style.animation = "msgExit 1500ms ease forwards";
    setTimeout(() => msg.remove(), 1500);
  }, 15000);
}

function resetUI() {
  document.getElementById("roomUI").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.querySelector(".nav-container").classList.remove("hidden");
}



/***********ROOM-DATA************/

async function ensureUserJoined(roomId) {

  const ref = db.collection("rooms")
    .doc(roomId)
    .collection("users")
    .doc(CURRENT_USER_ID);

  const snap = await ref.get();

  if (!snap.exists) {

    // fetch profile snapshot
    const { data } = await supabaseClient
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", CURRENT_USER_ID)
      .single();

    await ref.set({
      name: data?.username || "User",
      avatarUrl: data?.avatar_url || null,
      role: "listener",
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function roomData(docId) {

  try {

    // ⭐ fetch profile snapshot
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", CURRENT_USER_ID)
      .single();

    const name = profile?.username || "User";
    const avatarUrl = profile?.avatar_url || null;

    // ⭐ write participant snapshot
    return db.collection("rooms")
      .doc(docId)
      .collection("users")
      .doc(CURRENT_USER_ID)
      .set({
        name,
        avatarUrl,
        role: "audience",
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

  } catch (err) {
    console.error(err);
  }
  console.log("room-Data")
}

async function raiseHand() {

  if (!Voice.currentRoomId) return;

  try {
    const { data } = await supabaseClient
  .from("profiles")
  .select("username, avatar_url")
  .eq("id", CURRENT_USER_ID)
  .single();

 await db.collection("rooms")
  .doc(Voice.currentRoomId)
  .collection("requests")
  .doc(CURRENT_USER_ID)
  .set({
    name: data?.username || "User",
    avatarUrl: data?.avatar_url || null,
    requestedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
    
  } catch (e) {
    console.error(e);
  }
}

function listenForRequests(roomId) {

  const panel = document.getElementById("requestPanel");
  if(!panel) return;

  db.collection("rooms")
    .doc(roomId)
    .collection("requests")
    .onSnapshot(snapshot => {

      panel.innerHTML = "";

      snapshot.forEach(doc => {

        const data = doc.data();
        const uid = doc.id;

        const item = document.createElement("div");
        item.className = "request-item";

        item.innerHTML = `
          <img src="${data.avatarUrl || 'default.png'}">
          <span>${data.name}</span>
          <button class="approve">Accept</button>
        `;

        item.querySelector(".approve")
          .onclick = () => approveRequest(uid);

        panel.appendChild(item);
      });
    });
}

async function approveRequest(uid) {

  const roomRef = db.collection("rooms").doc(Voice.currentRoomId);

  try {

    // ⭐ promote to speaker
    await roomRef
      .collection("users")
      .doc(uid)
      .update({ role: "speaker" });

    // ⭐ remove request
    await roomRef
      .collection("requests")
      .doc(uid)
      .delete();

    console.log("Approved");

  } catch (e) {
    console.error(e);
  }
}

function listeners(docId) {

  console.log("listeners-Started");

  return db.collection("rooms")
    .doc(docId)
    .collection("users")
    .onSnapshot(snapshot => {

      snapshot.docChanges().forEach(change => {

        const data = change.doc.data();
        const id = change.doc.id;
        const avatar = data?.avatarUrl || "default.png";

        // ⭐ store UID WITH data
        if (change.type === "added") {
          participants.set(id, {
            uid: id,
            ...data
          });
        }

        if (change.type === "removed") {
          participants.delete(id);
        }

        // ⭐ join/leave messages
        if (!Voice.initialLoad) {

          if (change.type === "added") {
            showmessage(data.name, "joined the room", avatar, "join");
          }

          if (change.type === "removed") {
            showmessage(data.name, "left the room", avatar, "leave");
          }
        }
      });

      // ⭐ now UID exists
      renderParticipants(Array.from(participants.values()));

      Voice.initialLoad = false;
    });
}

function renderParticipants(users) {

  const slots = document.querySelectorAll(".avatar");

  // ⭐ clear all
  slots.forEach(slot => {
    slot.innerHTML = "";
    slot.style.backgroundImage = "";
    slot.dataset.uid = "";
  });

  // ⭐ ORDER USERS (THIS IS THE NEW PART)

  const stageUsers = users.filter(
    u => u.role === "admin" || u.role === "speaker"
  );

  const audienceUsers = users.filter(
    u => !u.role || u.role === "audience"
  );

  const orderedUsers = [...stageUsers, ...audienceUsers];

  console.log("orderedUsers:", orderedUsers);

  // ⭐ fill slots
  orderedUsers.forEach((user, index) => {

    if (index >= slots.length) return;

    const slot = slots[index];

    // ⭐ speaking detection mapping
    slot.dataset.uid = user.uid || user.id;

    if (user.avatarUrl) {
      slot.style.backgroundImage = `url(${user.avatarUrl})`;
      slot.style.backgroundSize = "cover";
      slot.style.backgroundPosition = "center";
    } else {
      slot.textContent = user.name?.[0] || "U";
    }
  });
}

function watchRoomDeletion(roomId) {

  return db.collection("rooms")
    .doc(roomId)
    .onSnapshot(doc => {

      if (!doc.exists) {

        // ⭐ show system message
        showmessage("System", "room ended", null, "leave");

        // ⭐ cleanup listeners
        Voice.unsubscribeRoom?.();
        Voice.roomDeleteUnsub?.();

        // ⭐ remove self (optional cleanup)
        db.collection("rooms")
          .doc(roomId)
          .collection("users")
          .doc(CURRENT_USER_ID)
          .delete()
          .catch(()=>{});

        // ⭐ reset UI after delay
        setTimeout(() => {
          resetUI();
        }, 1500);
      }
    });
}

function leaveroom() {

  if (!Voice.currentRoomId) return;
  
  leaveVoicechannel();

  // ⭐ show leave message
  showmessage("You", "left the room", null, "leave");

  // ⭐ remove self from participants
  db.collection("rooms")
    .doc(Voice.currentRoomId)
    .collection("users")
    .doc(CURRENT_USER_ID)
    .delete()
    .catch(console.error);

  // ⭐ cleanup listeners
  if (Voice.unsubscribeRoom) {
    Voice.unsubscribeRoom();
    Voice.unsubscribeRoom = null;
  }

  if (Voice.roomDeleteUnsub) {
    Voice.roomDeleteUnsub();
    Voice.roomDeleteUnsub = null;
  }

  // ⭐ clear state
  Voice.currentRoomId = null;

  // ⭐ reset UI with slight delay
  setTimeout(() => {
    resetUI();
  }, 800);
}

async function adminLeaveRoom(roomId) {

  if (!roomId) return;
  
  leaveVoicechannel();

  try {

    // ⭐ UX message
    showmessage("You", "ended the room", null, "leave");

    const roomRef = db.collection("rooms").doc(roomId);
    const usersSnap = await roomRef.collection("users").get();

    const batch = db.batch();

    usersSnap.forEach(doc => batch.delete(doc.ref));
    batch.delete(roomRef);

    await batch.commit();

    // ⭐ cleanup listeners
    Voice.unsubscribeRoom?.();
    Voice.roomDeleteUnsub?.();

    Voice.currentRoomId = null;

    // ⭐ delay UI reset
    setTimeout(() => {
      resetUI();
    }, 800);

  } catch (err) {
    console.error(err);
  }
}



/***** VOICE ROOM HELPERS *****/



//exit-Logic
const exitBtn = document.getElementById("close");
exitBtn?.addEventListener("click", () => {

  // ⭐ if admin → end room
  if (Voice.isRoomAdmin) {
    adminLeaveRoom(Voice.currentRoomId);
  } 
  // ⭐ else → normal leave
  else {
    leaveroom();
  }

});

//handle-loader.
async function handleConfirm() {

  try {

    showLoader("Creating...");

    await createRoom();

  } catch (err) {

    console.error("Create room error:", err);

  } finally {

    hideLoader();   // ⭐ always hide even if error
  }
}
//Loader-function.
function showLoader(text = "Loading...") {

  const loader = document.getElementById("loader");
  const btntext = document.querySelector(".btn-text")

  if (!loader) return;   // safety check

  loader.textContent = text;
  loader.classList.remove("hidden");
  btntext.classList.add("hidden")
}
function hideLoader() {

  const loader = document.getElementById("loader");

  if (!loader) return;

  loader.classList.add("hidden");
}

