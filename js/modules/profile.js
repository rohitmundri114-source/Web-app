 import { navigate } from "../router.js";
 import { Cache,Id } from "../state.js";
 import { supabaseClient } from "./services/supabase.js";


  const flashcards = document.getElementById("flashcards");

  
      
      
    /*  
      
      USER-PROFILE.
    
    */




 //Open-Profile
 export async function openProfile(userId) {

  navigate("profile");

  let profile;
  let posts;

const editBtn = document.getElementById("editProfileBtn");
const followBtn = document.getElementById("follow-btn");

 if (editBtn && followBtn) {
  if (userId === Id.CURRENT_USER_ID) {
    editBtn.style.display = "block";
    followBtn.style.display = "none";
  } else {
    editBtn.style.display = "none";
    followBtn.style.display = "block";
  }
}
  /* =========================
        1️⃣ PROFILE CACHE
  ========================= */

  if (Cache.profileCache[userId]) {
   profile = Cache.profileCache[userId];
  } else {
    const { data } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    profile = data;
    Cache.profileCache[userId] = data;
  }

  document.getElementById("profileAvatar").src =
    profile?.avatar_url || "default.png";

  document.getElementById("profileUsername").textContent =
    profile?.username || "User";

  document.getElementById("User-Bio").textContent =
    profile?.bio || "";

  /* =========================
        2️⃣ POSTS CACHE
  ========================= */

  if (Cache.profilePostsCache[userId]) {
    posts = Cache.profilePostsCache[userId];
  } else {
    const { data } = await supabaseClient
      .from("video_posts")
      .select("id, video_url, views")
      .eq("user_id", userId);

    posts = data;
    Cache.profilePostsCache[userId] = data;
  }

  renderProfileVideos(posts);

  /* =========================
        3️⃣ STATS
  ========================= */

  const postCount = posts?.length || 0;
  const viewCount = posts?.reduce((sum, p) => sum + (p.views || 0), 0);

  document.getElementById("postCount").textContent = postCount;
  document.getElementById("viewCount").textContent = viewCount;

  /* =========================
        4️⃣ FOLLOWERS COUNT
  ========================= */

  const { count } = await supabaseClient
    .from("followers")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  document.getElementById("followerCount").textContent = count || 0;
  
  await checkFollowState(userId);
  document.getElementById("follow-btn").dataset.profileId = userId;
}





//checking-follow-state.
 async function checkFollowState(profileId) {

  const { data } = await supabaseClient
    .from("followers")
    .select("*")
    .eq("follower_id",
    Id.CURRENT_USER_ID)
    .eq("following_id", profileId)
    .maybeSingle();

  const btn = document.getElementById("follow-btn");

  if (data) {
    btn.textContent = "Following";
    btn.dataset.following = "true";
  } else {
    btn.textContent = "Follow";
    btn.dataset.following = "false";
  }
}




//toggle-follow-BTN.
document.getElementById("follow-btn").addEventListener("click", async () => {

  const btn = document.getElementById("follow-btn");
  const profileId = btn.dataset.profileId;
  const isFollowing = btn.dataset.following === "true";

  if (isFollowing) {

    // UNFOLLOW
    await supabaseClient
      .from("followers")
      .delete()
      .eq("follower_id",
      Id.CURRENT_USER_ID)
      .eq("following_id", profileId);

    btn.textContent = "Follow";
    btn.dataset.following = "false";

  } else {

    // FOLLOW
    await supabaseClient
      .from("followers")
      .insert({
        follower_id: 
        Id.CURRENT_USER_ID,
        following_id: profileId
      });

    btn.textContent = "Following";
    btn.dataset.following = "true";
  }

  // refresh follower count
  updateFollowerCount(profileId);

});




//followers-Count-Update
async function updateFollowerCount(profileId) {
  const { count } = await supabaseClient
    .from("followers")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profileId);

  document.getElementById("followerCount").textContent = count || 0;
}






//render-Profile

function renderProfileVideos(posts) {

  if (!posts || posts.length === 0) return;

  const container = document.getElementById("profileVideo-cnt");
  if (!container) return;

  container.innerHTML = "";

  posts.forEach(post => {

    const tile = document.createElement("div");
    tile.className = "profile-tile";
    tile.dataset.videoId = post.id;

    const video = document.createElement("video");
    video.src = post.video_url || "";
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "none";
    video.loading = "lazy";

    tile.addEventListener("mouseenter", () => video.play());
    tile.addEventListener("mouseleave", () => video.pause());

    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    overlay.innerHTML = `<i class="ri-play-fill"></i>`;

    overlay.addEventListener("click", (e) => {
      e.stopPropagation();
      openFeedAtVideo(post.id);
    });

    tile.append(video, overlay);
    container.appendChild(tile);
  });
}




//Open-Feed-At-Video
function openFeedAtVideo(videoId) {

  // 1️⃣ Navigate back to feed
  navigate("flashcards");   // your feed page id

  // 2️⃣ Wait for DOM paint
  setTimeout(() => {

    const target = document.querySelector(
      `.short[data-video-id="${videoId}"]`
    );

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } else {
      console.log("Video not loaded yet");
    }

  }, 300);
}






//open-Edit.
document.getElementById("editProfileBtn").addEventListener("click", () => {
  openEditProfile();
});





//Close-Edit.
document.getElementById("exitEditProfile").addEventListener("click", () => {
  openProfile(Id.CURRENT_USER_ID);
});






//Open-Edit-Profile.
export async function openEditProfile() {

  navigate("edit-profile");

  const { data } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id",Id.CURRENT_USER_ID)
    .single();

  document.getElementById("editAvatarPreview").src =
    data?.avatar_url || "default.png";

  document.getElementById("editUsername").value =
    data?.username || "";

  document.getElementById("editBio").value =
    data?.bio || "";
}







//Open-Edit-Profile.
 //1.Avatar-Change.
const avatarInput = document.getElementById("avatarInput");

//change-avatar-btn.
document.getElementById("changeAvatarBtn").addEventListener("click", () => {
  avatarInput.click();
});

//avatar-input
avatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById("editAvatarPreview").src =
    URL.createObjectURL(file);
});

 //Saving-profile.
document.getElementById("saveProfileBtn").addEventListener("click", async () => {

  const username = document.getElementById("editUsername").value.trim();
  const bio = document.getElementById("editBio").value.trim();
  const avatarFile = avatarInput.files[0];

  let avatarUrl;

  try {

    // ⭐ Upload avatar if selected
    if (avatarFile) {

      const fileName = `${Date.now()}_${avatarFile.name}`;

      // Upload file
      const { data: uploadData, error: uploadError } =
        await supabaseClient.storage
          .from("avatars")
          .upload(fileName, avatarFile);

      if (uploadError) {
        console.error("UPLOAD ERROR:", uploadError);
        alert(uploadError.message);
        return;
      }

      // Get public URL
      const { data } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(fileName);

      avatarUrl = data.publicUrl;
    }

    // ⭐ Update profile table
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        username,
        bio,
        ...(avatarUrl && { avatar_url: avatarUrl })
      })
      .eq("id",Id.CURRENT_USER_ID);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      alert(updateError.message);
      return;
    }

    alert("Profile updated successfully ✅");

    // Refresh profile view
    openProfile(Id.CURRENT_USER_ID);

  } catch (err) {
    console.error("Unexpected error:", err);
    alert("Something went wrong");
  }

});



//export-profile
export function initProfile(){

  document.getElementById("exitProfileBtn")
    .addEventListener("click", () => {
      navigate("flashcards");
  });

}