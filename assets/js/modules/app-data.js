const API_BASE_URL = "http://localhost:5001";

const currentUser = JSON.parse(localStorage.getItem("user") || "null");

function requireUser() {
  if (currentUser?.id) {
    return currentUser;
  }

  const main = document.querySelector(".main");

  if (main) {
    main.insertAdjacentHTML(
      "afterbegin",
      `<div class="app-message">Log in to save and view your own Uni-Plan data.</div>`
    );
  }

  return null;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[char];
  });
}

function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(value) {
  if (!value) {
    return "All day";
  }

  return value.slice(0, 5);
}

function badgeClass(priority = "") {
  const normalized = priority.toLowerCase();

  if (normalized === "high" || normalized === "urgent") {
    return "high";
  }

  if (normalized === "low") {
    return "low";
  }

  return "medium";
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function setupCourses() {
  const courseForm = document.getElementById("courseForm");
  const courseList = document.getElementById("userCourses");

  if (!courseForm || !courseList) {
    return;
  }

  const user = requireUser();

  if (!user) {
    return;
  }

  const renderCourse = (course) => {
    courseForm.closest(".card").insertAdjacentHTML(
      "afterend",
      `<article class="card course-card">
        <h3>${escapeHTML(course.name)}</h3>
        <p>Instructor: ${escapeHTML(course.instructor || "Not set")}</p>
        <p>Progress: ${Number(course.progress) || 0}%</p>
        <div class="stats">
          <div class="stat">
            <h2>${Number(course.assignments) || 0}</h2>
            <p>Assignments</p>
          </div>
          <div class="stat">
            <h2>${Number(course.exams) || 0}</h2>
            <p>Exams</p>
          </div>
          <div class="stat">
            <h2>${Number(course.credits) || 0}</h2>
            <p>Credits</p>
          </div>
        </div>
      </article>`
    );
  };

  apiRequest(`/users/${user.id}/courses`)
    .then((courses) => courses.forEach(renderCourse))
    .catch((error) => alert(error.message));

  courseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData(courseForm);
      const course = await apiRequest("/courses", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          name: formData.get("name"),
          instructor: formData.get("instructor"),
          progress: formData.get("progress"),
          assignments: formData.get("assignments"),
          exams: formData.get("exams"),
          credits: formData.get("credits"),
        }),
      });

      renderCourse(course);
      courseForm.reset();
    } catch (error) {
      alert(error.message);
    }
  });
}

function setupTasks() {
  const taskForm = document.getElementById("taskForm");
  const taskList = document.getElementById("userTaskList");

  if (!taskForm || !taskList) {
    return;
  }

  const user = requireUser();

  if (!user) {
    return;
  }

  const renderTask = (task) => {
    taskList.insertAdjacentHTML(
      "afterbegin",
      `<li>
        <label>
          <input type="checkbox" ${task.completed ? "checked" : ""}>
          <span>
            ${escapeHTML(task.title)}
            <small>${escapeHTML(task.course || "General")} • Due ${formatDate(task.due_date)}</small>
          </span>
        </label>
        <span class="status-badge ${badgeClass(task.priority)}">${escapeHTML(task.priority || "Medium")}</span>
      </li>`
    );
  };

  apiRequest(`/users/${user.id}/tasks`)
    .then((tasks) => tasks.forEach(renderTask))
    .catch((error) => alert(error.message));

  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData(taskForm);
      const task = await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          title: formData.get("title"),
          course: formData.get("course"),
          due_date: formData.get("due_date"),
          priority: formData.get("priority"),
        }),
      });

      renderTask(task);
      taskForm.reset();
    } catch (error) {
      alert(error.message);
    }
  });
}

function setupAssignments() {
  const assignmentForm = document.getElementById("assignmentForm");
  const assignmentList = document.getElementById("userAssignmentList");

  if (!assignmentForm || !assignmentList) {
    return;
  }

  const user = requireUser();

  if (!user) {
    return;
  }

  const renderAssignment = (assignment) => {
    assignmentList.insertAdjacentHTML(
      "afterbegin",
      `<li>
        <div>
          <strong>${escapeHTML(assignment.title)}</strong>
          <p>${escapeHTML(assignment.course || "General")} • Due ${formatDate(assignment.due_date)}</p>
        </div>
        <span class="status-badge ${badgeClass(assignment.priority)}">${escapeHTML(assignment.priority || "Medium")}</span>
      </li>`
    );
  };

  apiRequest(`/users/${user.id}/assignments`)
    .then((assignments) => assignments.forEach(renderAssignment))
    .catch((error) => alert(error.message));

  assignmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData(assignmentForm);
      const assignment = await apiRequest("/assignments", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          title: formData.get("title"),
          course: formData.get("course"),
          due_date: formData.get("due_date"),
          priority: formData.get("priority"),
          status: formData.get("status"),
        }),
      });

      renderAssignment(assignment);
      assignmentForm.reset();
    } catch (error) {
      alert(error.message);
    }
  });
}

function setupEvents() {
  const eventForm = document.getElementById("eventForm");
  const eventGrid = document.getElementById("userEventGrid");
  const reminderList = document.getElementById("userEventReminders");

  if (!eventForm || !eventGrid || !reminderList) {
    return;
  }

  const user = requireUser();

  if (!user) {
    return;
  }

  const renderEvent = (event) => {
    const time = formatTime(event.event_time);

    eventGrid.insertAdjacentHTML(
      "beforeend",
      `<div class="calendar-cell">
        <span>${escapeHTML(event.event_day || "Any day")} • ${escapeHTML(time)}</span>
        <p>${escapeHTML(event.title)}</p>
      </div>`
    );

    reminderList.insertAdjacentHTML(
      "afterbegin",
      `<li>
        <div>
          <strong>${escapeHTML(event.title)}</strong>
          <p>${escapeHTML(event.event_day || "Any day")} • ${escapeHTML(time)}</p>
        </div>
        <span class="status-badge medium">${escapeHTML(event.event_type || "Event")}</span>
      </li>`
    );
  };

  apiRequest(`/users/${user.id}/events`)
    .then((events) => events.forEach(renderEvent))
    .catch((error) => alert(error.message));

  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData(eventForm);
      const calendarEvent = await apiRequest("/events", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          title: formData.get("title"),
          event_day: formData.get("event_day"),
          event_time: formData.get("event_time"),
          event_type: formData.get("event_type"),
        }),
      });

      renderEvent(calendarEvent);
      eventForm.reset();
    } catch (error) {
      alert(error.message);
    }
  });
}

setupCourses();
setupTasks();
setupAssignments();
setupEvents();
