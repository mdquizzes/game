<!-- Firebase SDKs -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>

<script>
  // 1. Same Firebase Config jo cbsesir.com par use hoti hai
  const firebaseConfig = {
    apiKey: "AIzaSyC0dDCPvN4L96ye0YuxippaIUHnEUwnT90",
    authDomain: "mdquizzes-c255a.firebaseapp.com",
    projectId: "mdquizzes-c255a",
    storageBucket: "mdquizzes-c255a.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  // 2. Global Player State
  window.currentPlayer = null;

  auth.onAuthStateChanged((user) => {
    if (user) {
      window.currentPlayer = user;
      console.log("Logged in user:", user.email);
      // Agar page par user display name ya points container hai to update karein
      if (document.getElementById("userDisplay")) {
        document.getElementById("userDisplay").innerText = user.displayName || user.email.split("@")[0];
      }
    } else {
      window.currentPlayer = null;
    }
  });

  // 3. Score Save Function (Har game ke Game Over par call hoga)
  window.submitGameScore = async function(gameName, finalScore) {
    if (!window.currentPlayer) {
      alert("Aap login nahi hain! Points save karne ke liye kripya pehle login karein.");
      window.location.href = "https://cbsesir.com/p/login.html";
      return;
    }

    const uid = window.currentPlayer.uid;
    const name = window.currentPlayer.displayName || window.currentPlayer.email.split("@")[0];

    try {
      // Game score record add karein
      await db.collection("gameScores").add({
        uid: uid,
        name: name,
        game: gameName,
        score: Number(finalScore),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Total overall game points update karein
      const profileRef = db.collection("gameProfiles").doc(uid);
      await profileRef.set({
        name: name,
        email: window.currentPlayer.email,
        totalScore: firebase.firestore.FieldValue.increment(Number(finalScore)),
        lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log("Score successfully saved!");
    } catch (err) {
      console.error("Error saving score:", err);
    }
  };

  // 4. Live Leaderboard Fetch Function
  window.loadLiveLeaderboard = function(targetElementId, limitCount = 10) {
    const listEl = document.getElementById(targetElementId);
    if (!listEl) return;

    // Realtime listener (snapshot) live rank update ke liye
    db.collection("gameProfiles")
      .orderBy("totalScore", "desc")
      .limit(limitCount)
      .onSnapshot((snapshot) => {
        let html = "";
        let rank = 1;

        snapshot.forEach((doc) => {
          const data = doc.data();
          html += `
            <div style="display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #334155; color:#f8fafc;">
              <span><strong>#${rank}</strong> ${data.name || "Player"}</span>
              <span style="color:#facc15; font-weight:bold;">${data.totalScore || 0} pts</span>
            </div>
          `;
          rank++;
        });

        listEl.innerHTML = html || "<p style='color:#94a3b8; text-align:center;'>No scores recorded yet.</p>";
      }, (error) => {
        console.error("Leaderboard error:", error);
      });
  };
</script>
