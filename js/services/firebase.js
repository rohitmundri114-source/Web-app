//firebase....
const firebaseConfig = {
  apiKey: "AIzaSyCPwWhQCM6DdqyseQxxs-KmH7kDlGbCuXo",
  authDomain: "timplets-62493.firebaseapp.com",
  projectId: "timplets-62493",
  storageBucket: "timplets-62493.firebasestorage.app",
  messagingSenderId: "216373115282",
  appId: "1:216373115282:web:a4090eef50f54b756a294b",
  measurementId: "G-LVZ75KXR5Z"
};
// Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  export { db } ;
