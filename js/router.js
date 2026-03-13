import { AppState,Id } from "./state.js";
import { openProfile, openEditProfile } from "./modules/profile.js";

const CURRENT_USER_ID = Id.CURRENT_USER_ID;

let navButtons = [];

let isNavigating = false;

// hide all pages
function hideAllPages() {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
  });
}

/* NAVIGATION */

export function navigate(targetId) {

  if (isNavigating) return;

  isNavigating = true;

  const nextPage = document.getElementById(targetId);
  if (!nextPage) {
  isNavigating = false;
  return;
}

  hideAllPages();

  nextPage.classList.add("active");

  AppState.currentPage = nextPage;

  navButtons.forEach(btn => btn.classList.remove("active-btn"));

  document
    .querySelector(`[data-target="${targetId}"]`)
    ?.classList.add("active-btn");

  history.pushState({}, "", `#${targetId}`);

  // unlock navigation
  setTimeout(() => {
    isNavigating = false;
  }, 200);
}

/* INIT ROUTER */

 export function initRouter(){

  navButtons = document.querySelectorAll(".nav-container button");

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {

      if (btn.classList.contains("profile")) {
        openProfile(CURRENT_USER_ID);
        return;
      }

      navigate(btn.dataset.target);
    });
  });

}


/* BROWSER SUPPORT */

window.addEventListener("popstate", () => {

  const route = location.hash.replace("#", "") || "flashcards";

  if (route === "profile") {
    openProfile(CURRENT_USER_ID);
    return;
  }

  if (route === "edit-profile") {
    openEditProfile();
    return;
  }

  navigate(route);
});


window.addEventListener("load", () => {

  initRouter();

  const route = location.hash.replace("#", "") || "flashcards";

  hideAllPages();

  if (route === "profile") {
    openProfile(CURRENT_USER_ID);
    return;
  }

  if (route === "edit-profile") {
    openEditProfile();
    return;
  }

  navigate(route);
});