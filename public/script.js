// ---------------- Login ----------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        if (!username || !password) {
            alert("Please enter username and password");
            return;
        }

        if (username.toLowerCase().includes("student")) {
            window.location.href = "student.html";
        } else if (username.toLowerCase().includes("lecturer")) {
            window.location.href = "lecturer.html";
        } else if (username.toLowerCase().includes("admin")) {
            window.location.href = "admin.html";
        } else {
            alert("Role not recognized. Please enter a valid username.");
        }
    });
}

// ---------------- Colors ----------------
const moduleColors = {
    AAA: "red",
    BBB: "blue",
    CCC: "green",
    DDD: "orange",
    EEE: "purple",
    FFF: "teal",
    GGG: "brown"
};
function getColorForModule(module) {
    return moduleColors[module] || "gray";
}

// ---------------- Student ----------------
let progressChartInstance = null;
let activityChartInstance = null;

async function loadStudentData(studentId = "11391") {
    const res = await fetch(`/api/student/${studentId}`);
    const data = await res.json();

    if (!data.student) {
        document.getElementById("studentProfile").innerHTML =
            `<p>No student found with ID: ${studentId}</p>`;
        return;
    }

    // Profile
    document.getElementById("studentProfile").innerHTML = `
        <p><strong>ID:</strong> ${data.student.id_student}</p>
        <p><strong>Gender:</strong> ${data.student.gender}</p>
        <p><strong>Final Result:</strong> ${data.student.final_result}</p>
    `;

    // Group scores by course + presentation
    const courseGroups = {};
    data.scores.forEach(s => {
        const key = `${s.code_module}_${s.code_presentation}`;
        if (!courseGroups[key]) courseGroups[key] = [];
        courseGroups[key].push({ x: Number(s.date_submitted), y: Number(s.score) });
    });

    // Create datasets
    const datasets = Object.entries(courseGroups).map(([key, points]) => {
        const module = key.split("_")[0];
        return {
            label: key,
            data: points.sort((a, b) => a.x - b.x),
            borderColor: getColorForModule(module),
            fill: false,
            tension: 0.2
        };
    });

    if (progressChartInstance) progressChartInstance.destroy();
    progressChartInstance = new Chart(document.getElementById("progressChart"), {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            scales: {
                x: { type: 'linear', title: { display: true, text: "Days since course start" } },
                y: { min: 0, max: 100, title: { display: true, text: "Score" } }
            }
        }
    });

    // Engagement chart
    if (activityChartInstance) activityChartInstance.destroy();
    activityChartInstance = new Chart(document.getElementById("activityChart"), {
        type: 'bar',
        data: {
            labels: data.activity.map(a => a.date),
            datasets: [{
                label: 'Engagement (VLE Clicks)',
                data: data.activity.map(a => Number(a.sum_click)),
                backgroundColor: 'orange'
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: "Days since course start" } },
                y: { title: { display: true, text: "Number of interactions" } }
            }
        }
    });
}

// ---------------- Lecturer ----------------
let classChartInstance = null;
let currentRiskStudents = [];
let participationChartInstance = null;

// Load data for a module
async function loadLecturerData(moduleCode) {
    if (!moduleCode) {
        moduleCode = document.getElementById("module").value;
    }

    // Show loading spinner
    const loadingEl = document.getElementById("loadingMessage");
    if (loadingEl) {
        loadingEl.style.display = "flex";
        loadingEl.innerHTML = `
            <div class="spinner-border spinner-border-sm text-info me-2" role="status"></div>
            <span>Loading lecturer data for ${moduleCode}...</span>
        `;
    }

    const res = await fetch(`/api/lecturer/${moduleCode}`);
    const data = await res.json();

    // ---------------- Summary Cards ----------------
    const scores = data.scores.map(s => Number(s.score));

    // ✅ total students (support number OR array)
    let totalStudents;
    if (Array.isArray(data.students)) {
        totalStudents = data.students.length;
    } else {
        totalStudents = data.students; // assume it's already a number
    }

    // avg class score
    const avgScore = scores.length
        ? (scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    // pass / fail / withdrawn breakdown
    /* const pass = scores.filter(s => s >= 40).length;
     const fail = scores.filter(s => s < 40).length;
     const withdrawn = data.scores.filter(s => s.status === "Withdrawn").length || 0;*/

    document.getElementById("totalStudents").innerText = totalStudents;
    /*document.getElementById("totalDetails").innerText =
        `Pass: ${pass} | Fail: ${fail} | Withdrawn: ${withdrawn}`; */

    // avg class score
    document.getElementById("avgClassScore").innerText = avgScore.toFixed(2) + "%";

    // update badge meaning
    const badge = document.querySelector("#avgClassScore + .badge");
    if (badge) {
        if (avgScore >= 80) {
            badge.textContent = "Excellent";
            badge.className = "badge bg-success";
        } else if (avgScore >= 60) {
            badge.textContent = "Good";
            badge.className = "badge bg-info";
        } else if (avgScore >= 40) {
            badge.textContent = "Moderate";
            badge.className = "badge bg-warning";
        } else {
            badge.textContent = "Poor";
            badge.className = "badge bg-danger";
        }
    }

    // top 3 students
    const topStudents = [...data.scores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    document.getElementById("topStudents").innerHTML =
        topStudents.map(s => `<li class="list-group-item">${s.id_student} - ${s.score}%</li>`).join("");

    // ---------------- Class Performance (Distribution) ----------------
    let perfScores = data.scores.map(s => Number(s.score));  // ✅ simple array

    const ranges = {
        "0-39": perfScores.filter(s => s >= 0 && s <= 39).length,
        "40-59": perfScores.filter(s => s >= 40 && s <= 59).length,
        "60-79": perfScores.filter(s => s >= 60 && s <= 79).length,
        "80-100": perfScores.filter(s => s >= 80 && s <= 100).length
    };

    if (classChartInstance) classChartInstance.destroy();

    classChartInstance = new Chart(document.getElementById("classChart"), {
        type: 'bar',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                label: `Assessment Count in ${moduleCode} `,
                data: Object.values(ranges),
                backgroundColor: ["#dc3545", "#ffc107", "#0d6efd", "#198754"]
            }]
        },
        options: {
            plugins: {
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: 'black',
                    font: { weight: 'bold' },
                    formatter: (value) => value
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Number of Assessments" }
                },
                x: {
                    title: { display: true, text: "Score Ranges" }
                }
            }
        },
        plugins: [ChartDataLabels]
    });


    // ---------------- At-risk students ----------------
    currentRiskStudents = data.scores.filter(s => Number(s.score) < 40);
    renderRiskTable(currentRiskStudents);

    // ---------------- Participation Trends ----------------
    if (participationChartInstance) participationChartInstance.destroy();
    participationChartInstance = new Chart(document.getElementById("participationChart"), {
        type: 'line',
        data: {
            labels: data.trends.map(t => t.day),
            datasets: [{
                label: "Total Clicks",
                data: data.trends.map(t => t.clicks),
                borderColor: "blue",
                fill: false,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: "Days since course start" } },
                y: { title: { display: true, text: "Total Clicks" } }
            }
        }
    });

    // Hide spinner
    if (loadingEl) {
        loadingEl.innerHTML = "✅ Lecturer data loaded";
        setTimeout(() => { loadingEl.style.display = "none"; }, 2000);
    }
}

// ---------------- Risk Table ----------------
let sortDirection = { id: "asc", score: "asc" };

function renderRiskTable(students) {
    const tableHeader = `
        <tr>
            <th onclick="sortRiskTable('id')">ID ▲▼</th>
            <th onclick="sortRiskTable('score')">Score ▲▼</th>
        </tr>`;
    const tableRows = students
        .map(s => `<tr><td>${s.id_student}</td><td>${s.score}</td></tr>`)
        .join("");
    document.getElementById("riskTable").innerHTML = tableHeader + tableRows;
}

function sortRiskTable(by) {
    if (by === "id") {
        currentRiskStudents.sort((a, b) =>
            sortDirection.id === "asc"
                ? Number(a.id_student) - Number(b.id_student)
                : Number(b.id_student) - Number(a.id_student)
        );
        sortDirection.id = sortDirection.id === "asc" ? "desc" : "asc";
    } else if (by === "score") {
        currentRiskStudents.sort((a, b) =>
            sortDirection.score === "asc"
                ? Number(a.score) - Number(b.score)
                : Number(b.score) - Number(a.score)
        );
        sortDirection.score = sortDirection.score === "asc" ? "desc" : "asc";
    }
    renderRiskTable(currentRiskStudents);
}

// ---------------- Module Dropdown ----------------
async function populateModuleDropdown() {
    const res = await fetch("/api/modules");
    const modules = await res.json();
    const select = document.getElementById("module");

    select.innerHTML = modules.map(m => `<option value="${m}">${m}</option>`).join("");

    if (modules.length > 0) {
        loadLecturerData(modules[0]); // load first module by default
    }

    // when dropdown changes
    select.onchange = () => loadLecturerData(select.value);
}


// ---------------- Admin ----------------
async function loadAdminData() {
    const res = await fetch("/api/admin");
    const data = await res.json();

    new Chart(document.getElementById("enrolChart"), {
        type: "bar",
        data: {
            labels: Object.keys(data.enrolments),
            datasets: [{
                label: "Enrolments",   // ✅ add dataset label
                data: Object.values(data.enrolments),
                backgroundColor: "skyblue"
            }]
        },
        options: {
            plugins: {
                legend: {
                    display: true,
                    position: "top"
                }
            },
            scales: {
                x: { title: { display: true, text: "Course (Module-Presentation)" } },
                y: { title: { display: true, text: "Number of Enrolments" } }
            }
        }
    });

    // Gender Chart
    new Chart(document.getElementById("genderChart"), {
        type: "pie",   // ✅ switched from doughnut to pie
        data: {
            labels: ["Male", "Female"],
            datasets: [{
                data: [data.gender["M"], data.gender["F"]],
                backgroundColor: ["#2196f3", "#e91e63"],
                borderWidth: 0
            }]
        },
        options: {
            plugins: {
                legend: {
                    display: true // ✅ show legend (common for pie charts)
                },
                title: {
                    display: true,
                    text: "Gender Distribution"
                }
            }
        }
    });

    // ✅ Update counts below chart
    document.getElementById("maleCount").textContent = data.gender["M"] || 0;
    document.getElementById("femaleCount").textContent = data.gender["F"] || 0;

    // Age Chart
    new Chart(document.getElementById("ageChart"), {
        type: "doughnut",
        data: {
            labels: ["🧑‍🎓 Young (0-25)", "👨 Adult (26-35)", "👴 Older (36+)"],
            datasets: [{
                label: "Age Distribution",
                data: [
                    data.age["0-35"] || 0,    // Young
                    data.age["35-55"] || 0,  // Adult
                    data.age["55<="] || 0   // Older
                ],
                backgroundColor: ["#2196f3", "#4caf50", "#ff9800"]
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Age Band Distribution"
                }
            }
        }
    });


    document.getElementById("youngCount").textContent = data.age["0-35"] || 0;
    document.getElementById("adultCount").textContent = data.age["35-55"] || 0;
    document.getElementById("olderCount").textContent = data.age["55<="] || 0;


    new Chart(document.getElementById("outcomeChart"), {
        type: "pie",
        data: {
            labels: ["✅ Pass", "❌ Fail", "🔄 Withdrawn", "🏆 Distinction"],
            datasets: [{
                label: "Final Outcomes",
                data: [
                    data.outcomes["Pass"] || 0,
                    data.outcomes["Fail"] || 0,
                    data.outcomes["Withdrawn"] || 0,
                    data.outcomes["Distinction"] || 0
                ],
                backgroundColor: ["#4caf50", "#f44336", "#ff9800", "#2196f3"]
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Final Outcomes Distribution"
                }
            }
        }
    });


    // Outcomes counts
    document.getElementById("passCount").textContent = data.outcomes["Pass"] || 0;
    document.getElementById("failCount").textContent = data.outcomes["Fail"] || 0;
    document.getElementById("withdrawCount").textContent = data.outcomes["Withdrawn"] || 0;
    document.getElementById("distCount").textContent = data.outcomes["Distinction"] || 0;
}

// ---------------- Auto-run ----------------
if (document.getElementById("progressChart")) {
    loadStudentData("11391"); // change to actual logged-in student
}
if (document.getElementById("classChart")) {
    populateModuleDropdown();
}
if (document.getElementById("enrolChart")) {
    loadAdminData();
}
