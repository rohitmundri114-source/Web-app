import { Cache,Id } from "./state.js";
import { openProfile } from "../profile.js";
import { supabaseClient } from "../services/supabase.js";

console.log("videofeed loaded");

/*****
       Video-feed         
                   *****/
                   
//const DEV_STOP_FEED = true;

const CURRENT_USER_ID = Id.CURRENT_USER_ID;

const Videocontainer = document.getElementById("video-container");

const flashcards = document.getElementById("flashcards");




      //Record-Views.
const viewedVideos = new Set();
async function recordView(videoId) {
  await supabaseClient.rpc("increment_view", {
    video_id: videoId
  });
}




    // video observer
 window.shortObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const video = entry.target;

    if (
      entry.isIntersecting &&
      entry.intersectionRatio > 0.6
    ) {
      const wrapper = video.closest(".short");
      const videoId = wrapper.dataset.videoId;

      if (!viewedVideos.has(videoId)) {
        viewedVideos.add(videoId);
        recordView(videoId);
      }

      video.play().catch(() => {});
      preloadNextVideo(video);
    } else {
      video.pause();
    }
  });
}, { threshold: 0.6 });


  //preload-function.
 function preloadNextVideo(currentVideo){

  const nextWrapper = currentVideo.closest(".short")?.nextElementSibling;

  if(!nextWrapper) return;

  const nextVideo = nextWrapper.querySelector("video");

  if(nextVideo && nextVideo.preload !== "auto"){

    nextVideo.preload = "auto";

  }

}




     //scroll observer
  const infiniteObserver = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      loadVideoFeed();
    }
  },
  {
    root: document.querySelector(".Container-design") || null,
    threshold: 1
  }
);

     let sentinel = document.getElementById("scroll-sentinel");

     if (!sentinel) {
  sentinel = document.createElement("div");
  sentinel.id = "scroll-sentinel";
  sentinel.style.height = "1px";
  if (Videocontainer){
  Videocontainer.appendChild(sentinel);}
}

// NOW observe
infiniteObserver.observe(sentinel);





//pagnation-data.

let PAGE_SIZE = 5;
let page = 0 ;
let isLoading = false;
let hasMore = true;


//load-video-DATA.
async function loadVideoFeed(){
  
  //if(DEV_STOP_FEED) return;
  
  if (isLoading || !hasMore) return;

  isLoading = true;

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabaseClient
  .from("video_posts")
  .select(`
  id,
  user_id,
  video_url,
  caption,
  profiles (
    username,
    avatar_url
  )
`)
  .order("created_at", { ascending: false })
  .range(from, to);
  
  if (error) {
    console.error("Load failed:", error);
    isLoading = false;
    return;
  }
  
  if (data && data.length > 0) {
  Cache.feedCache.push(...data);
}

  if (data.length < PAGE_SIZE) {
    hasMore = false; // no more videos
  }

  renderVideos(data);

  page++;
  isLoading = false;
}

//trim-old-videos.
function trimOldVideos(){

  const videos = document.querySelectorAll(".short");

  while(videos.length > 6){

    videos[0].remove();

  }

}

//Render-videos
function renderVideos(posts) {
  posts.forEach(post => {
    const wrapper = document.createElement("div");
    wrapper.className = "short";
    wrapper.dataset.videoId = post.id;

    /* ================= VIDEO ================= */
    const video = document.createElement("video");
    video.src = post.video_url;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "metadata";

    /* ================= ACTIONS ================= */
    const actions = document.createElement("div");
    actions.className = "video-actions";
    
    actions.innerHTML = `
  <button class="action-btn like-btn" data-id="${post.id}">
    <i class="ri-heart-line"></i>
    <span class="like-count">0</span>
  </button>
  
  <button class="action-btn comment-btn" data-id="${post.id}">
    <i class="ri-chat-3-line"></i>
    <span class="comment-count">0</span>
  </button>
  
  <button class="action-btn share-btn">
    <i class="ri-share-forward-line"></i>
  </button>
`;

    /* ================= BOTTOM USER INFO ================= */
    const bottomInfo = document.createElement("div");
    bottomInfo.className="video-bottom-info";
    bottomInfo.innerHTML = `
  <div class="user-row">
    <img class="user-avatar clickable-avatar"
         src="${post.profiles?.avatar_url || 'default.png'}"
         loading="lazy">
    <span class="username">
      ${post.profiles?.username || "user"}
    </span>
  </div>

  <div class="video-caption">
    ${post.caption || ""}
  </div>
`;

    /* ================= APPEND ================= */
    wrapper.append(video, actions, bottomInfo);
    Videocontainer.insertBefore(wrapper, sentinel);
    trimOldVideos();
    const likeBtn = wrapper.querySelector(".like-btn");
    const countSpan = wrapper.querySelector(".like-count");

    loadLikeData(post.id, likeBtn, countSpan);
    
    const commentCountSpan = wrapper.querySelector(".comment-count");
    loadCommentCount(post.id, commentCountSpan);
    
    window.shortObserver.observe(video);
    wrapper.querySelector(".clickable-avatar").addEventListener("click", () => {
  openProfile(post.user_id, post.profiles);
});
  });
  
  

  console.log("renderVideos working");
}

 // Cache-Logic
if (Array.isArray(data) && data.length > 0) {
  Cache.feedCache.push(...data);
  renderVideos(data);
}


async function loadLikeData(postId, btn, countSpan) {

  // Get like count
  const { count } = await supabaseClient
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  countSpan.innerText = count || 0;

  // Check if current user liked
  const { data } = await supabaseClient
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", Id.CURRENT_USER_ID)
    .single();

  if (data) {
    btn.classList.add("liked");
    btn.querySelector("i").classList.replace("ri-heart-line", "ri-heart-fill");
    btn.querySelector("i").style.color = "#ff3b5c";
  }
  console.log("loadLikeData")
}







/*

      LIKE-UNLIKE.

*/

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".like-btn");
  if (!btn) return;

  const postId = btn.dataset.id;
  const icon = btn.querySelector("i");
  const countSpan = btn.querySelector(".like-count");

  let count = parseInt(countSpan.innerText);

  btn.style.pointerEvents = "none";

  // Check existing like
  const { data: existing } = await supabaseClient
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", Id.CURRENT_USER_ID)
    .single();

  if (!existing) {
    // LIKE
    await supabaseClient.from("likes").insert({
      post_id: postId,
      user_id: Id.CURRENT_USER_ID
    });

    btn.classList.add("liked");
    icon.classList.replace("ri-heart-line", "ri-heart-fill");
    icon.style.color = "#ff3b5c";

    countSpan.innerText = count + 1;

    heartBurst(btn);

  } else {
    // UNLIKE
    await supabaseClient
      .from("likes")
      .delete()
      .eq("id", existing.id);

    btn.classList.remove("liked");
    icon.classList.replace("ri-heart-fill", "ri-heart-line");
    icon.style.color = "white";

    countSpan.innerText = Math.max(0, count - 1);
  }

  btn.style.pointerEvents = "auto";
});

//Heart-Burst-Animation.
function heartBurst(btn) {
  const rect = btn.getBoundingClientRect();
  const container = btn.closest(".short");

  for (let i = 0; i < 6; i++) {
    const heart = document.createElement("div");
    heart.className = "heart-burst";
    heart.innerText = "❤️";

    // Random burst direction
    const x = (Math.random() - 0.5) * 80;
    const y = (Math.random() - 1) * 80;

    heart.style.left = rect.left - container.getBoundingClientRect().left + "px";
    heart.style.top = rect.top - container.getBoundingClientRect().top + "px";
    heart.style.setProperty("--x", `${x}px`);
    heart.style.setProperty("--y", `${y}px`);

    container.appendChild(heart);

    // Remove after animation
    setTimeout(() => heart.remove(), 700);
  }
}

//Double-Tap
let lastTap = 0;
document.addEventListener("click", (e) => {
  const video = e.target.closest("video");
  if (!video) return;

  const now = Date.now();
  if (now - lastTap < 300) {
    const btn = video.closest(".short").querySelector(".like-btn");
    if (btn && !btn.classList.contains("liked")) {
      btn.click();
    }
  }
  lastTap = now;
});





/* 

       Comments

*/


   //loadcomment
async function loadCommentCount(postId, countSpan) {

  const { count } = await supabaseClient
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  countSpan.innerText = count || 0;
}

let currentCommentPostId = null;

 //open-comments
document.addEventListener("click", (e) => {

  const btn = e.target.closest(".comment-btn");
  if (!btn) return;

  const postId = btn.dataset.id;

  currentCommentPostId = postId;

  openComments(postId);
});
async function openComments(postId) {

  const modal = document.getElementById("commentModal");

  modal.classList.remove("hidden");

  setTimeout(() => {
    modal.classList.add("active");
  }, 10);

  loadComments(postId);
}

    //close-comment.
document.getElementById("closeComment")
  .addEventListener("click", closeComments);

document.querySelector(".comment-backdrop")
  .addEventListener("click", closeComments);

function closeComments() {

  const modal = document.getElementById("commentModal");
  
  const list = document.getElementById("commentList");
  list.innerHTML = "";
  modal.classList.remove("active");

  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
}
function renderComment(comment){

  const list = document.getElementById("commentList");

  const div = document.createElement("div");
  div.className="comment-item";
  div.dataset.id=comment.id;

  div.innerHTML=`

    <img class="comment-avatar"
    src="${comment.profiles?.avatar_url || "default.png"}">

    <div class="comment-body">

      <span class="comment-username">
        ${comment.profiles?.username || "user"}
      </span>

      <p class="comment-text">${comment.content}</p>

      <div class="comment-actions">

        <button class="reply-btn"
          data-id="${comment.id}">
          Reply
        </button>

        <button class="comment-like-btn"
          data-id="${comment.id}">
          ❤️ <span class="comment-like-count">0</span>
        </button>

      </div>

      <div class="reply-container"></div>

    </div>
  `;

  list.appendChild(div);
  
  loadCommentLikes(comment.id, div);

  loadReplies(comment.id, div);

}
 //load-comments-data.
async function loadComments(postId){

  const { data, error } = await supabaseClient
  .from("comments")
  .select(`
    id,
    content,
    created_at,
    user_id,
    parent_id,
    profiles(username, avatar_url)
  `)
  .eq("post_id", postId)
  .is("parent_id", null)
  .order("created_at",{ascending:false});

  if(error){
    console.error("Load comments error:", error);
    return;
  }

  const list = document.getElementById("commentList");

  if(!list) return;

  list.innerHTML = "";

  data.forEach(renderComment);
}

   /*Replies-comments*/
   
    //load-replies.
async function loadReplies(commentId, commentElement){

  const { data } = await supabaseClient
  .from("comments")
  .select(`
    id,
    content,
    user_id,
    parent_id,
    profiles(username, avatar_url)
  `)
  .eq("parent_id", commentId)
  .order("created_at",{ascending:true});

  const container = commentElement.querySelector(".reply-container");

  data.forEach(reply=>{

    const div=document.createElement("div");
    div.className="reply-item";

    div.innerHTML=`
      <img class="reply-avatar"
      src="${reply.profiles?.avatar_url || "default.png"}">

      <div class="reply-body">
        <span class="reply-username">
          ${reply.profiles?.username}
        </span>

        <p>${reply.content}</p>
      </div>
    `;

    container.appendChild(div);

  });

}

 //comments-reply-Logic.
 let replyingTo = null;
 document.addEventListener("click",(e)=>{

  const btn = e.target.closest(".reply-btn");
  if(!btn) return;

  replyingTo = btn.dataset.id;

  const input = document.getElementById("commentInput");

  input.placeholder="Reply to comment...";
  input.focus();

});

//load-likes-in-comments.
async function loadCommentLikes(commentId, commentElement) {

  const { count } = await supabaseClient
    .from("comment_likes")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId);

  const span = commentElement.querySelector(".comment-like-count");
  span.innerText = count || 0;

  const { data } = await supabaseClient
    .from("comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", Id.CURRENT_USER_ID)
    .single();

  if (data) {
    commentElement.querySelector(".comment-like-btn").classList.add("liked");
  }
}

// toggle-like-comments
document.addEventListener("click", async (e) => {

  const btn = e.target.closest(".comment-like-btn");
  if (!btn) return;

  const commentId = btn.dataset.id;

  const { data } = await supabaseClient
    .from("comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", Id.CURRENT_USER_ID)
    .single();

  if (!data) {

    await supabaseClient
      .from("comment_likes")
      .insert({
        comment_id: commentId,
        user_id: Id.CURRENT_USER_ID
      });

  } else {

    await supabaseClient
      .from("comment_likes")
      .delete()
      .eq("id", data.id);

  }

  loadComments(currentCommentPostId);
});

//write-comments
document.getElementById("sendComment")
  .addEventListener("click", async () => {

    const input = document.getElementById("commentInput");
    const text = input.value.trim();

    if (!text || !currentCommentPostId) return;

    await supabaseClient
    .from("comments")
    .insert({
      post_id: currentCommentPostId,
      user_id: Id.CURRENT_USER_ID,
      content: text,
      parent_id: replyingTo
});

    input.value = "";

    loadComments(currentCommentPostId);
    
    replyingTo = null;
    input.placeholder="Write a comment...";
});




/*
          Realtime
*/

  //comments
  supabaseClient
 .channel("realtime-comments")
 .on(
  "postgres_changes",
  {
    event:"INSERT",
    schema:"public",
    table:"comments"
  },
  async payload => {

    const newComment = payload.new;

    if(currentCommentPostId !== newComment.post_id) return;

    const { data } = await supabaseClient
      .from("comments")
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles(username, avatar_url)
      `)
      .eq("id", newComment.id)
      .single();

    renderComment(data);
  }
)
 .subscribe();

  //likes
   supabaseClient
  .channel("realtime-comment-likes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "comment_likes"
    },
    payload => {

      const commentId =
        payload.new?.comment_id || payload.old?.comment_id;

      if (!commentId) return;

      const commentElement = document.querySelector(
        `.comment-like-btn[data-id="${commentId}"]`
      );

      if (!commentElement) return;

      const container = commentElement.closest(".comment-item");

      // reload like count
      loadCommentLikes(commentId, container);

    }
  )
  .subscribe();




// One-tap unlock for Android Chrome-Rules.
document.body.addEventListener(
  "touchstart",
  () => {
    document.querySelectorAll("video").forEach(v => {
      v.muted = true;
      v.play().catch(() => {});
    });
  },
  { once: true }
);



/*

         UPLOAD-LOGIC.

*/




   //Upload-open-Logic

const uploadSection = document.getElementById("upload-section");
const floatingUploadBtn = document.getElementById("template");
const closeUploadBtn = document.getElementById("closeUploadBtn");

floatingUploadBtn.addEventListener("click", () => {
  uploadSection.classList.add("active");
});

closeUploadBtn.addEventListener("click", () => {
  uploadSection.classList.remove("active");
  resetUploadUI();
});



   //Upload-container.
const videoInput = document.getElementById("videoInput");
const selectVideoBtn = document.getElementById("selectVideoBtn");
const previewVideo = document.getElementById("previewVideo");
const confirmUploadBtn = document.getElementById("confirmUploadBtn");
const captionInput = document.getElementById("captionInput");
let selectedFile = null; 




//select-video.
selectVideoBtn.addEventListener("click", () => {
  videoInput.click();
});

//video-file
videoInput.addEventListener("change", (e) => {
  selectedFile = e.target.files[0];

  if (!selectedFile) return;

  // show preview
  previewVideo.src = URL.createObjectURL(selectedFile);
  previewVideo.style.display = "block";
  previewVideo.muted = true;
  previewVideo.play().catch(()=>{});
});

//confirm-upload
confirmUploadBtn.addEventListener("click", async () => {

  if (!selectedFile) {
    alert("Select video first");
    return;
  }

  confirmUploadBtn.textContent = "Sharing...";
  confirmUploadBtn.disabled = true;

  try {

    // unique file name
    const fileName = `public/${Date.now()}_${selectedFile.name}`;

    // 1️⃣ Upload to storage
    const { error: uploadError } = await supabaseClient.storage
      .from("Video")
      .upload(fileName, selectedFile);

    if (uploadError) throw uploadError;

    // 2️⃣ Get public url
    const { data: publicUrlData } = supabaseClient.storage
      .from("Video")
      .getPublicUrl(fileName);

    const videoUrl = publicUrlData.publicUrl;

    // 3️⃣ Insert into DB
    const { error: insertError } = await supabaseClient
      .from("video_posts")
      .insert({
       user_id : Id. CURRENT_USER_ID,
        video_url: videoUrl,
        caption: captionInput.value
      });

    if (insertError) throw insertError;

    alert("Posted 🎉");

    // reset UI
    resetUploadUI();

  } catch (err) {
    console.error(err);
    alert("Upload failed");
  }

  confirmUploadBtn.textContent = "Share";
  confirmUploadBtn.disabled = false;

});

//reset-Upload-UI.
function resetUploadUI() {
  previewVideo.src = "";
  previewVideo.style.display = "none";
  captionInput.value = "";
  videoInput.value = "";
  selectedFile = null;
}

//ReloadFeed
function reloadFeed() {
  page = 0;
  hasMore = true;
  loadVideoFeed();
  console.log("video-realoded")
}



export function initVideoFeed() {

  console.log("Initializing video feed...");

  // if cached feed exists, render it
  if (Cache.feedCache.length > 0) {

    console.log("Loading feed from cache");

    renderVideos(Cache.feedCache);

    return;

  }

  // otherwise load from database
  loadVideoFeed();

}
