let tasks = [];
let taskStorageAvailable = true;
const taskStorageKey = "todoTasks";

let taskInput = document.getElementById("taskInput");
let categoryInput = document.getElementById("categoryInput");
let priorityInput = document.getElementById("priorityInput");
let dateInput = document.getElementById("dateInput");
let addTaskBtn = document.getElementById("addTaskBtn");
let taskList = document.getElementById("taskList");
let clearCompletedBtn = document.getElementById("clearCompletedBtn");
let taskStats = document.getElementById("taskStats");

let editBox = document.getElementById("editBox");
let editName = document.getElementById("editName");
let editCategory = document.getElementById("editCategory");
let editPriority = document.getElementById("editPriority");
let editDate = document.getElementById("editDate");
let saveEdit = document.getElementById("saveEdit");
let cancelEdit = document.getElementById("cancelEdit");

let currentEditIndex = -1;
let notification = document.getElementById("notification");
let dueNotification = document.getElementById("dueNotification");
let dueNotificationMessage = document.getElementById("dueNotificationMessage");
let dismissDueNotification = document.getElementById("dismissDueNotification");
let confirmBox = document.getElementById("confirmBox");
let confirmMessage = document.getElementById("confirmMessage");
let confirmYes = document.getElementById("confirmYes");
let confirmNo = document.getElementById("confirmNo");
let confirmAction = null;
let dueNotificationQueue = [];
let queuedReminderKeys = new Set();
let isShowingDueNotification = false;
let dueNotificationTimer = null;
let reminderRecords = {};
let reminderStorageAvailable = true;
const reminderStorageKey = "todoDueReminderRecords";

function showNotification(message) {
    notification.textContent = message;
    notification.style.display = "block";

    setTimeout(function() {
        notification.style.display = "none";
    }, 2500);
}

function loadReminderRecords() {
    try {
        const savedRecords = localStorage.getItem(reminderStorageKey);
        reminderRecords = savedRecords ? JSON.parse(savedRecords) : {};
        if (!reminderRecords || typeof reminderRecords !== "object" || Array.isArray(reminderRecords)) {
            throw new Error("Invalid reminder records");
        }
    } catch (error) {
        reminderStorageAvailable = false;
        reminderRecords = {};
        showNotification("Reminder history could not be loaded. Some reminders may repeat.");
    }
}

function loadTasks() {
    try {
        const savedTasks = localStorage.getItem(taskStorageKey);
        if (!savedTasks) {
            return [];
        }

        const parsedTasks = JSON.parse(savedTasks);
        if (!Array.isArray(parsedTasks)) {
            throw new Error("Invalid saved tasks");
        }

        return parsedTasks;
    } catch (error) {
        taskStorageAvailable = false;
        showNotification("Saved tasks could not be loaded.");
        return [];
    }
}

function saveTasks() {
    if (!taskStorageAvailable) {
        return;
    }

    try {
        localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
    } catch (error) {
        taskStorageAvailable = false;
        showNotification("Tasks could not be saved. Changes may be lost when you close the app.");
    }
}

function saveReminderRecord(recordKey) {
    reminderRecords[recordKey] = true;

    if (!reminderStorageAvailable) {
        return;
    }

    try {
        localStorage.setItem(reminderStorageKey, JSON.stringify(reminderRecords));
    } catch (error) {
        reminderStorageAvailable = false;
        showNotification("Reminder history could not be saved. Some reminders may repeat.");
    }
}

function showDueNotification(task, message, reminderKey) {
    if (reminderRecords[reminderKey] || queuedReminderKeys.has(reminderKey)) {
        return;
    }

    queuedReminderKeys.add(reminderKey);
    dueNotificationQueue.push({
        taskName: task[0],
        dueDate: task[3],
        message: message,
        reminderKey: reminderKey
    });
    displayNextDueNotification();
}

function displayNextDueNotification() {
    if (isShowingDueNotification || dueNotificationQueue.length === 0) {
        return;
    }

    isShowingDueNotification = true;
    const reminder = dueNotificationQueue.shift();
    queuedReminderKeys.delete(reminder.reminderKey);
    saveReminderRecord(reminder.reminderKey);
    const dueDate = new Date(reminder.dueDate + "T00:00:00");
    const formattedDueDate = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
    }).format(dueDate);
    dueNotificationMessage.textContent = reminder.message + " " + reminder.taskName + " — Due: " + formattedDueDate;
    dueNotification.style.display = "block";

    dueNotificationTimer = window.setTimeout(dismissCurrentDueNotification, 8000);
}

function dismissCurrentDueNotification() {
    if (dueNotificationTimer !== null) {
        window.clearTimeout(dueNotificationTimer);
        dueNotificationTimer = null;
    }

    dueNotification.style.display = "none";
    isShowingDueNotification = false;
    displayNextDueNotification();
}

function showConfirmation(message, action) {
    confirmMessage.textContent = message;
    confirmAction = action;
    confirmBox.style.display = "block";
}

function updateTaskStats() {
    const remaining = tasks.filter(function(task) {
        return !task[4];
    }).length;

    taskStats.textContent = remaining + " task" + (remaining === 1 ? "" : "s") + " left • " + tasks.length + " total";
}

function getDueStatus(task) {
    if (!task[3]) {
        return { label: "No date", isOverdue: false };
    }

    const today = new Date();
    const dueDate = new Date(task[3] + "T00:00:00");
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (dueDate < todayStart && !task[4]) {
        return { label: "Overdue", isOverdue: true };
    }

    return { label: "Due: " + task[3], isOverdue: false };
}

function checkDueTaskReminder() {
    if (tasks.length === 0) {
        return;
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayUtc = Date.UTC(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate());
    const taskOccurrences = {};

    tasks.forEach(function(task) {
        if (!task[3]) {
            return;
        }

        const taskIdentity = JSON.stringify([task[0], task[3]]);
        const occurrence = taskOccurrences[taskIdentity] || 0;
        taskOccurrences[taskIdentity] = occurrence + 1;

        if (task[4]) {
            return;
        }

        const dueDate = new Date(task[3] + "T00:00:00");
        if (Number.isNaN(dueDate.getTime())) {
            return;
        }

        const dueUtc = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const daysUntilDue = Math.round((dueUtc - todayUtc) / 86400000);
        const reminders = {
            3: "Your task is due in 3 days!",
            2: "Your task is due in 2 days!",
            1: "Your task is due tomorrow!",
            0: "Your task is due today!"
        };

        if (!Object.prototype.hasOwnProperty.call(reminders, daysUntilDue)) {
            return;
        }

        const reminderKey = JSON.stringify([taskIdentity, occurrence, daysUntilDue]);

        if (!reminderRecords[reminderKey]) {
            showDueNotification(task, reminders[daysUntilDue], reminderKey);
        }
    });
}

loadReminderRecords();
tasks = loadTasks();
dismissDueNotification.addEventListener("click", dismissCurrentDueNotification);

confirmYes.addEventListener("click", function() {
    if (confirmAction !== null) {
        confirmAction();
    }

    confirmBox.style.display = "none";
    confirmAction = null;
});

confirmNo.addEventListener("click", function() {
    confirmBox.style.display = "none";
    confirmAction = null;
});

saveEdit.addEventListener("click", function() {
    let newName = editName.value.trim();

    if (newName === "") {
        showNotification("💗 Please enter a task name!");
        return;
    }

    if (currentEditIndex !== -1) {
        tasks[currentEditIndex][0] = newName;
        tasks[currentEditIndex][1] = editCategory.value || "other";
        tasks[currentEditIndex][2] = editPriority.value || "Medium";
        tasks[currentEditIndex][3] = editDate.value;

        displayTasks();
        editBox.style.display = "none";
        currentEditIndex = -1;

        showNotification("Task updated successfully! ✨");
    }
});

cancelEdit.addEventListener("click", function() {
    editBox.style.display = "none";
    currentEditIndex = -1;
});

addTaskBtn.addEventListener("click", addTask);

taskInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        addTask();
    }
});

clearCompletedBtn.addEventListener("click", function() {
    const incompleteTasks = tasks.filter(function(task) {
        return !task[4];
    });

    if (incompleteTasks.length === tasks.length) {
        showNotification("No completed tasks to clear.");
        return;
    }

    showConfirmation("Remove all completed tasks?", function() {
        tasks = incompleteTasks;
        displayTasks();
        showNotification("Completed tasks were cleared.");
    });
});

function addTask() {
    let taskText = taskInput.value.trim();

    if (taskText === "") {
        showNotification("Please enter a task!");
        return;
    }

    let task = [
        taskText,
        categoryInput.value || "other",
        priorityInput.value || "Medium",
        dateInput.value,
        false
    ];

    tasks.push(task);
    displayTasks();

    taskInput.value = "";
    categoryInput.value = "";
    priorityInput.value = "";
    dateInput.value = "";
    taskInput.focus();
}

function displayTasks() {
    saveTasks();
    taskList.innerHTML = "";

    if (tasks.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "empty-state";
        emptyItem.textContent = "No tasks yet. Add your first one above.";
        taskList.appendChild(emptyItem);
        updateTaskStats();
        return;
    }

    for (let i = 0; i < tasks.length; i++) {
        let taskItem = document.createElement("li");
        taskItem.className = tasks[i][4] ? "task-item completed" : "task-item";

        let taskName = document.createElement("strong");
        taskName.textContent = tasks[i][0];

        let taskCheckbox = document.createElement("input");
        taskCheckbox.type = "checkbox";
        taskCheckbox.checked = tasks[i][4];
        taskCheckbox.addEventListener("change", function() {
            tasks[i][4] = taskCheckbox.checked;
            displayTasks();
            checkDueTaskReminder();
        });

        let priorityBadge = document.createElement("span");
        const priorityText = tasks[i][2] || "Medium";
        priorityBadge.textContent = priorityText;
        priorityBadge.className = "priority-badge " + priorityText.toLowerCase();

        let dueInfo = document.createElement("span");
        let dueStatus = getDueStatus(tasks[i]);
        dueInfo.textContent = dueStatus.label;
        dueInfo.className = "due-tag" + (dueStatus.isOverdue ? " overdue" : "");

        let taskMeta = document.createElement("div");
        taskMeta.className = "task-meta";
        taskMeta.textContent = "Category: " + (tasks[i][1] || "Other");
        taskMeta.appendChild(priorityBadge);
        taskMeta.appendChild(dueInfo);

        let taskMenu = document.createElement("div");
        taskMenu.className = "task-menu";

        let editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", function() {
            currentEditIndex = i;
            editName.value = tasks[i][0];
            editCategory.value = tasks[i][1].toLowerCase();
            editPriority.value = tasks[i][2];
            editDate.value = tasks[i][3];
            editBox.style.display = "block";
            taskMenu.style.display = "none";
        });

        let deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", function() {
            showConfirmation("Are you sure you want to delete this task?", function() {
                tasks.splice(i, 1);
                displayTasks();
                showNotification("Task deleted successfully!");
            });
        });

        let menuBtn = document.createElement("button");
        menuBtn.textContent = "⋮";
        menuBtn.className = "menu-btn";
        menuBtn.addEventListener("click", function() {
            taskMenu.style.display = taskMenu.style.display === "flex" ? "none" : "flex";
        });

        taskMenu.appendChild(editBtn);
        taskMenu.appendChild(deleteBtn);

        let taskHeader = document.createElement("div");
        taskHeader.className = "task-header";

        let taskInfo = document.createElement("div");
        taskInfo.className = "task-info";
        taskInfo.appendChild(taskCheckbox);
        taskInfo.appendChild(taskName);

        taskHeader.appendChild(taskInfo);
        taskHeader.appendChild(menuBtn);

        taskItem.appendChild(taskHeader);
        taskItem.appendChild(taskMeta);
        taskItem.appendChild(taskMenu);

        taskList.appendChild(taskItem);
    }

    updateTaskStats();
    checkDueTaskReminder();
}

window.addEventListener("load", function() {
    displayTasks();
    function scheduleNextDayReminderCheck() {
        const now = new Date();
        const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        window.setTimeout(function() {
            checkDueTaskReminder();
            scheduleNextDayReminderCheck();
        }, nextDay.getTime() - now.getTime());
    }

    scheduleNextDayReminderCheck();
});