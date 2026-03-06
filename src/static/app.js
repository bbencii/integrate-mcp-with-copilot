document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const currentUserDiv = document.getElementById("current-user");

  let authToken = localStorage.getItem("sessionToken") || null;
  let currentUser = null;

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function authHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  function updateAuthUI() {
    if (currentUser) {
      currentUserDiv.textContent = `${currentUser.username} (${currentUser.role})`;
      currentUserDiv.classList.remove("hidden");
      logoutBtn.classList.remove("hidden");
      loginForm.classList.add("hidden");
    } else {
      currentUserDiv.textContent = "";
      currentUserDiv.classList.add("hidden");
      logoutBtn.classList.add("hidden");
      loginForm.classList.remove("hidden");
    }
  }

  function canUnregister() {
    return currentUser && ["teacher", "admin"].includes(currentUser.role);
  }

  function canSignup() {
    return currentUser && ["student", "teacher", "admin"].includes(currentUser.role);
  }

  function updateSignupAccessHint() {
    const submitButton = signupForm.querySelector("button[type='submit']");
    if (!canSignup()) {
      submitButton.disabled = true;
      submitButton.title = "Login as a student, teacher, or admin to sign up";
    } else {
      submitButton.disabled = false;
      submitButton.title = "";
    }
  }

  async function loadCurrentUser() {
    if (!authToken) {
      currentUser = null;
      updateAuthUI();
      updateSignupAccessHint();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          ...authHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Session expired");
      }

      currentUser = await response.json();
    } catch (error) {
      authToken = null;
      currentUser = null;
      localStorage.removeItem("sessionToken");
    }

    updateAuthUI();
    updateSignupAccessHint();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        canUnregister()
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      if (canUnregister()) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!canUnregister()) {
      showMessage("Only teachers or admins can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            ...authHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle login
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem("sessionToken", authToken);

      loginForm.reset();
      updateAuthUI();
      updateSignupAccessHint();
      fetchActivities();
      showMessage(`Logged in as ${currentUser.username}`, "success");
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  // Handle logout
  logoutBtn.addEventListener("click", async () => {
    try {
      if (authToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            ...authHeaders(),
          },
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }

    authToken = null;
    currentUser = null;
    localStorage.removeItem("sessionToken");
    updateAuthUI();
    updateSignupAccessHint();
    fetchActivities();
    showMessage("You have been logged out.", "info");
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!canSignup()) {
      showMessage("Please login before signing up for activities.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  loadCurrentUser().then(fetchActivities);
});
