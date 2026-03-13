export const AppState = {

  user: null,

  currentPage: null,

  videos: [],

  voiceRoom: null,

  profile: null
  
  


};

export const Id = {

  CURRENT_USER_ID: "fba79f77-289e-4a20-a7f8-c0c7316aa399"

};

export const Cache = {

  // feed cache
  feedCache: [],

  feedLoaded: false,

  // profile caches
  profileCache: {},

  profilePostsCache: {}

};

export const Voice = {
  
   currentRoomId : null,
   unsubscribeRoom : null,
   roomDeleteUnsub : null,
   user : null,
   isRoomAdmin : false,
   initialLoad : true,
   
  
}