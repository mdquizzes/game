/* ==========================================================
   MD QUIZZES & GAMES - CENTRAL GAME BRIDGE ENGINE
   Handles Auth, Individual Game Leaderboards & Day/Month/Year Scores
   ========================================================== */

// 1. Firebase Initialization Config
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

// 2. Auto-Detect and Lock Current Logged-in User
auth.onAuthStateChanged((user) => {
  const playerField = document.getElementById("playerName");
  const loginStatus = document.getElementById("authStatusNotice");

  if (user) {
    activePlayer = user;
    activePlayerName = user.displayName || user.email.split("@")[0];

    // Name field lock taaki koi dusre ka naam na likh sake
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
      loginStatus.innerHTML = `<span style="color:#ef4444;">⚠ Not logged in. Points will not be saved. <a href="https://cbsesir.com/p/login.html" target="_blank" style="color:#38bdf8; text-decoration:underline;">Login here</a></span>`;
    }
  }
});

// 3. Individual Game Live Leaderboard Subscriber (Per Game High Score)
function subscribeToGameLeaderboard(gameId, containerElementId, limitCount = 10) {
  const listEl = document.getElementById(containerElementId);
  if (!listEl) return;

  db.collection("gameLeaderboards")
    .where("gameId", "==", gameId)
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
      console.warn("Individual leaderboard error:", err.message);
    });
}

// 4. Save Final Score (Updates Game High Score + Day/Month/Year Global Scores)
async function submitFinalGameScore(gameId, finalScore) {
  const statusBox = document.getElementById("cloudSaveStatus");

  // Without login check
  if (!activePlayer) {
    if (statusBox) {
      statusBox.innerHTML = `<span style="color:#ef4444;">Score not saved (Login required).</span>`;
    }
    return;
  }

  try {
    if (statusBox) statusBox.textContent = "Syncing score to leaderboard...";

    const points = Number(finalScore);
    const now = new Date();

    // Day, Month, Year Keys formatting
    const dayKey = now.toISOString().slice(0, 10);  // e.g. "2026-09-05"
    const monthKey = now.toISOString().slice(0, 7); // e.g. "2026-09"
    const yearKey = now.getFullYear().toString();   // e.g. "2026"

    const userGameDocId = `${activePlayer.uid}_${gameId}`;
    const gameLeaderboardRef = db.collection("gameLeaderboards").doc(userGameDocId);
    const profileRef = db.collection("gameProfiles").doc(activePlayer.uid);

    // Step A: Update this Game's Personal High Score
    const existingGameDoc = await gameLeaderboardRef.get();
    if (!existingGameDoc.exists || (existingGameDoc.data().highScore || 0) < points) {
      await gameLeaderboardRef.set({
        uid: activePlayer.uid,
        name: activePlayerName,
        gameId: gameId,
        highScore: points,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Step B: Calculate Day, Month, Year running totals for Dashboard
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

    // Step C: Save to Student's Global Profile
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
  } catch (error) {
    console.error("Firestore score sync error:", error);
    if (statusBox) statusBox.textContent = "Error saving score online.";
  }
}
