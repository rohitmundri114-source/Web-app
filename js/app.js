import { navigate,initRouter } from "./router.js";
import { initVideoFeed } from "./modules/videofeed.js";
import { initVoiceRooms } from "./modules/voiceroom.js";
import { initProfile } from "./modules/profile.js";

function startApp(){

  console.log("App starting...");

  initRouter();
  initVideoFeed();
  initProfile();
  initVoiceRooms();

}

document.addEventListener("DOMContentLoaded", startApp);
