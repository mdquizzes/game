/* MD Quizzes - Central Game Bridge (Pure JavaScript) */

// 1. Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyC0dDCPvN4L96ye0YuxippaIUHnEUwnT90",
  authDomain: "mdquizzes-c255a.firebaseapp.com",
  projectId: "mdquizzes-c255a",
  storageBucket: "mdquizzes-c255a.firebasestorage.app",
  messagingSenderId: "510171455812",
  appId: "1:510171455812:web:dcead5207dc1272aa9b711"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let activePlayer = null;
let activePlayerName = "Guest";

// 2. Auth State Detector
auth.onAuthStateChanged((user) => {
  const playerField = document.getElementById("playerName");
  const loginStatus = document.getElementById("authStatusNotice");

  if (user) {
    activePlayer = user;
    activePlayerName = user.displayName || user.email.split("@")[0];

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
      loginStatus.innerHTML = `<span style="color:#ef4444;">⚠ Not logged in. Points will not be saved. <a href="https://cbsesir.com/p/login.html" target="_blank" style="color:#38bdf8;">Login here</a></span>`;
    }
  }
});

// 3. Live Leaderboard (No Composite Index Needed)
window.subscribeToGameLeaderboard = function(gameId, containerElementId, limitCount = 10) {
  const listEl = document.getElementById(containerElementId);
  if (!listEl) return;

  db.collection(`lb_${gameId}`)
    .orderBy("highScore", "desc")
    .limit(limitCount)
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = "<li style='text-align:center; padding:10px; color:#94a3b8;'>No high scores yet!</li>";
        return;
      }

      let html = "";
      let rank = 1;

      snapshot.forEach((doc) => {
        const item = doc.data();
        html += `
          <li style="display:flex; justify-content:space-between; align-items:center; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.15); font-size:14px;">
            <span><b>#${rank}</b> ${item.name || "Player"}</span>
            <span style="color:#facc15; font-weight:bold;">${item.highScore || 0} pts</span>
          </li>
        `;
        rank++;
      });

      listEl.innerHTML = html;
    }, (err) => {
      console.error("Leaderboard Error:", err);
      listEl.innerHTML = `<li style='color:#ef4444; font-size:12px; padding:6px;'>Error: ${err.message}</li>`;
    });
};

// 4. Save Final Score (Updates Game High Score + Day/Month/Year Global Scores)
window.submitFinalGameScore = async function(gameId, finalScore) {
  const statusBox = document.getElementById("cloudSaveStatus");

  if (!activePlayer) {
    if (statusBox) {
      statusBox.innerHTML = `<span style="color:#ef4444;">Score not saved (Login required).</span>`;
    }
    return;
  }

  try {
    if (statusBox) statusBox.textContent = "Syncing score...";

    const points = Number(finalScore);
    const now = new Date();

    const dayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    const yearKey = now.getFullYear().toString();

    // Step A: Game High Score (Dedicated Collection per Game)
    const gameRef = db.collection(`lb_${gameId}`).doc(activePlayer.uid);
    const existingDoc = await gameRef.get();

    if (!existingDoc.exists || (existingDoc.data().highScore || 0) < points) {
      await gameRef.set({
        uid: activePlayer.uid,
        name: activePlayerName,
        highScore: points,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Step B: Update Global Profile
    const profileRef = db.collection("gameProfiles").doc(activePlayer.uid);
    const profileDoc = await profileRef.get();
    let profileData = profileDoc.exists ? profileDoc.data() : {};

    let newDailyScore = (profileData.currentDayKey === dayKey)
      ? (profileData.dailyScore || 0) + points
      : points;

    let newMonthlyScore = (profileData.currentMonthKey === monthKey)
      ? (profileData.monthlyScore || 0) + points
      : points;

    let newYearlyScore = (profileData.currentYearKey === yearKey)
      ? (profileData.yearlyScore || 0) + points
      : points;

    await profileRef.set({
      name: activePlayerName,
      email: activePlayer.email,
      totalAllGamesScore: firebase.firestore.FieldValue.increment(points),

      currentDayKey: dayKey,
      dailyScore: newDailyScore,

      currentMonthKey: monthKey,
      monthlyScore: newMonthlyScore,

      currentYearKey: yearKey,
      yearlyScore: newYearlyScore,

      lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (statusBox) {
      statusBox.innerHTML = `<span style="color:#22c55e;">✓ Score saved to Live Leaderboard!</span>`;
    }
  } catch (err) {
    console.error("Firestore Save Error:", err);
    if (statusBox) statusBox.textContent = "Error syncing score.";
  }
};
