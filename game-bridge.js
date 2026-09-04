<!-- Firebase SDKs -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>

<script>
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

  let activePlayer = null;
  let activePlayerName = "Guest";

  // 1. Auto-Fetch Login User
  auth.onAuthStateChanged((user) => {
    const playerField = document.getElementById("playerName");
    const loginStatus = document.getElementById("authStatusNotice");

    if (user) {
      activePlayer = user;
      activePlayerName = user.displayName || user.email.split("@")[0];
      
      // Auto-fill and lock name input so users cannot forge someone else's name
      if (playerField) {
        playerField.value = activePlayerName;
        playerField.disabled = true;
      }
      if (loginStatus) {
        loginStatus.innerHTML = `<span style="color:#22c55e;">✓ Logged in as: <b>${activePlayerName}</b></span>`;
      }
    } else {
      activePlayer = null;
      activePlayerName = "Guest";
      if (playerField) {
        playerField.value = "Guest (No Save)";
        playerField.disabled = true;
      }
      if (loginStatus) {
        loginStatus.innerHTML = `<span style="color:#ef4444;">⚠ Not logged in. Score will not be saved. <a href="https://cbsesir.com/p/login.html" target="_blank" style="color:#38bdf8;">Login here</a></span>`;
      }
    }
  });

  // 2. Separate Live Leaderboard for this specific Game
  function subscribeToGameLeaderboard(gameId, containerElementId, limit = 10) {
    const listEl = document.getElementById(containerElementId);
    if (!listEl) return;

    db.collection("gameLeaderboards")
      .where("gameId", "==", gameId)
      .orderBy("highScore", "desc")
      .limit(limit)
      .onSnapshot((snapshot) => {
        let html = "";
        let rank = 1;

        snapshot.forEach((doc) => {
          const item = doc.data();
          html += `
            <li style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid rgba(255,255,255,0.15);">
              <span>#${rank} ${item.name}</span>
              <span style="color:#facc15; font-weight:bold;">${item.highScore}</span>
            </li>
          `;
          rank++;
        });

        listEl.innerHTML = html || "<li style='text-align:center;'>No high scores yet!</li>";
      }, (err) => {
        console.warn("Leaderboard error:", err);
      });
  }

  // 3. Save Score & Update Global Profile
  async function submitFinalGameScore(gameId, finalScore) {
    const statusBox = document.getElementById("cloudSaveStatus");

    // If without login -> Do not save
    if (!activePlayer) {
      if (statusBox) {
        statusBox.innerHTML = `<span style="color:#ef4444;">Score not saved (Login required).</span>`;
      }
      return;
    }

    try {
      if (statusBox) statusBox.textContent = "Syncing score...";

      const userDocKey = `${activePlayer.uid}_${gameId}`;
      const boardRef = db.collection("gameLeaderboards").doc(userDocKey);
      const profileRef = db.collection("gameProfiles").doc(activePlayer.uid);

      const existingRecord = await boardRef.get();
      let pointsToAdd = Number(finalScore);

      if (existingRecord.exists) {
        const oldHighScore = existingRecord.data().highScore || 0;
        // Check if current run is a new high score for this game
        if (finalScore > oldHighScore) {
          await boardRef.set({
            uid: activePlayer.uid,
            name: activePlayerName,
            gameId: gameId,
            highScore: Number(finalScore),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      } else {
        // First time playing this specific game
        await boardRef.set({
          uid: activePlayer.uid,
          name: activePlayerName,
          gameId: gameId,
          highScore: Number(finalScore),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      // Add points to Total All Games Score for the main Dashboard
      await profileRef.set({
        name: activePlayerName,
        email: activePlayer.email,
        totalAllGamesScore: firebase.firestore.FieldValue.increment(pointsToAdd),
        lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (statusBox) {
        statusBox.innerHTML = `<span style="color:#22c55e;">✓ Score & Dashboard updated!</span>`;
      }
    } catch (error) {
      console.error("Firestore save error:", error);
      if (statusBox) statusBox.textContent = "Error syncing score.";
    }
  }
</script>
