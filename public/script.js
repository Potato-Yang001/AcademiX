// ============================================
// LOGIN FUNCTIONALITY
// ============================================
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

// ============================================
// COLOR CONFIGURATION
// ============================================
const moduleColors = {
    AAA: "#e74c3c",
    BBB: "#3498db",
    CCC: "#2ecc71",
    DDD: "#f39c12",
    EEE: "#9b59b6",
    FFF: "#1abc9c",
    GGG: "#d35400"
};

function getColorForModule(module) {
    return moduleColors[module] || "#95a5a6";
}

// ============================================
// STUDENT DASHBOARD
// ============================================
let progressChartInstance = null;
let activityChartInstance = null;
let deadlineChartInstance = null;

async function loadStudentData(studentId = "11391") {
    try {
        const res = await fetch(`/api/student/${studentId}`);
        const data = await res.json();

        if (!data.student) {
            document.getElementById("studentProfile").innerHTML =
                `<div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    No student found with ID: ${studentId}
                </div>`;
            return;
        }

        // ✅ TEMPORARY: Generate missing data from existing data
        if (!data.assessments && data.scores) {
            data.assessments = generateAssessmentsFromScores(data.scores);
        }
        if (!data.currentDay) {
            data.currentDay = calculateCurrentDay(data.scores);
        }
        if (!data.vle && data.activity) {
            data.vle = generateVLEFromActivity(data.activity);
        }

        /* Render all sections
        renderStudentProfile(data.student);
        renderAcademicProgress(data.scores);
        renderEngagementChart(data.activity);*/

        // New Features - now with fallback data
        // 1️⃣ Performance summary + risk alerts first (Overview)
        if (data.scores) {
            renderPerformanceSummary(data.scores);
            checkAtRiskStatus(data.scores);
        }

        // 2️⃣ Academic progress + module completion
        renderAcademicProgress(data.scores);
        renderModuleProgress(data.scores, data.assessments);

        // 3️⃣ Upcoming deadlines (reminders)
        renderUpcomingDeadlines(data.assessments || [], data.currentDay || 0);

        // 4️⃣ Recent updates and notifications
        renderRecentUpdates(data);

        // 5️⃣ Engagement charts and stats
        renderEngagementChart(data.activity);
        renderVLEEngagement(data.vle || [], data.activity || []);

        // 6️⃣ Student profile at bottom
        renderStudentProfile(data.student);

    } catch (error) {
        console.error("Error loading student data:", error);
        document.getElementById("studentProfile").innerHTML =
            `<div class="alert alert-danger">
                <i class="bi bi-x-circle me-2"></i>
                Error loading data. Please try again.
            </div>`;
    }
}

// ============================================
// TEMPORARY: GENERATE MISSING STUDENT DATA
// ============================================
function generateAssessmentsFromScores(scores) {
    // Generate future assessments based on existing scores
    if (!scores || scores.length === 0) return [];

    const assessments = [];
    const modules = [...new Set(scores.map(s => s.code_module))];

    modules.forEach(module => {
        const moduleScores = scores.filter(s => s.code_module === module);
        const maxDate = Math.max(...moduleScores.map(s => Number(s.date_submitted)));
        const presentation = moduleScores[0].code_presentation;

        // Add 2-3 future assessments per module
        for (let i = 1; i <= 3; i++) {
            assessments.push({
                code_module: module,
                code_presentation: presentation,
                assessment_type: i === 3 ? 'Exam' : 'TMA',
                date: maxDate + (i * 15) // 15 days apart
            });
        }
    });

    return assessments;
}

function calculateCurrentDay(scores) {
    // Calculate current day as max submission date + 5
    if (!scores || scores.length === 0) return 50;
    const maxDate = Math.max(...scores.map(s => Number(s.date_submitted)));
    return maxDate + 5;
}

function generateVLEFromActivity(activity) {
    // Generate VLE materials from activity data
    if (!activity || activity.length === 0) return [];

    const uniqueSites = [...new Set(activity.map(a => a.id_site))].filter(id => id);
    return uniqueSites.map(id => ({
        id_site: id,
        activity_type: 'resource'
    }));
}

// ============================================
// STUDENT PROFILE RENDERING
// ============================================
function renderStudentProfile(student) {
    const resultClass = {
        'Pass': 'success',
        'Distinction': 'primary',
        'Fail': 'danger',
        'Withdrawn': 'warning'
    }[student.final_result] || 'secondary';

    const profileHTML = `
        <div class="profile-info">
            <p>
                <strong><i class="bi bi-person-badge me-2"></i>Student ID:</strong>
                <span class="badge bg-secondary">${student.id_student}</span>
            </p>
            <p>
                <strong><i class="bi bi-gender-ambiguous me-2"></i>Gender:</strong>
                <span>${student.gender === 'M' ? 'Male' : 'Female'}</span>
            </p>
            <p>
                <strong><i class="bi bi-trophy me-2"></i>Final Result:</strong>
                <span class="badge bg-${resultClass}">${student.final_result}</span>
            </p>
            ${student.region ? `
            <p>
                <strong><i class="bi bi-geo-alt me-2"></i>Region:</strong>
                <span>${student.region}</span>
            </p>` : ''}
            ${student.age_band ? `
            <p>
                <strong><i class="bi bi-calendar me-2"></i>Age Band:</strong>
                <span>${student.age_band}</span>
            </p>` : ''}
            ${student.highest_education ? `
            <p>
                <strong><i class="bi bi-mortarboard me-2"></i>Education:</strong>
                <span>${student.highest_education}</span>
            </p>` : ''}
        </div>
    `;

    document.getElementById("studentProfile").innerHTML = profileHTML;
}

// ============================================
// ACADEMIC PROGRESS CHART
// ============================================
function renderAcademicProgress(scores) {
    if (!scores || scores.length === 0) {
        document.getElementById("progressChart").parentElement.innerHTML =
            '<p class="text-muted text-center">No assessment data available</p>';
        return;
    }

    // Group scores by course + presentation
    const courseGroups = {};
    scores.forEach(s => {
        const key = `${s.code_module}_${s.code_presentation}`;
        if (!courseGroups[key]) courseGroups[key] = [];
        courseGroups[key].push({
            x: Number(s.date_submitted),
            y: Number(s.score),
            assessment: s.assessment_type || 'Assessment'
        });
    });

    // Create datasets
    const datasets = Object.entries(courseGroups).map(([key, points]) => {
        const module = key.split("_")[0];
        return {
            label: key,
            data: points.sort((a, b) => a.x - b.x),
            borderColor: getColorForModule(module),
            backgroundColor: getColorForModule(module) + '20',
            fill: false,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7
        };
    });

    if (progressChartInstance) progressChartInstance.destroy();

    const ctx = document.getElementById("progressChart");
    if (!ctx) return;

    progressChartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Score: ${context.parsed.y}% (Day ${context.parsed.x})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: "Days since course start",
                        font: { weight: 'bold' }
                    },
                    grid: { display: true, color: 'rgba(0,0,0,0.05)' }
                },
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: "Score (%)",
                        font: { weight: 'bold' }
                    },
                    grid: { display: true, color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: function (value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// ENGAGEMENT CHART
// ============================================
function renderEngagementChart(activity) {
    if (!activity || activity.length === 0) {
        document.getElementById("activityChart").parentElement.innerHTML =
            '<p class="text-muted text-center">No engagement data available</p>';
        return;
    }

    if (activityChartInstance) activityChartInstance.destroy();

    const ctx = document.getElementById("activityChart");
    if (!ctx) return;

    activityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: activity.map(a => `Day ${a.date}`),
            datasets: [{
                label: 'VLE Interactions',
                data: activity.map(a => Number(a.sum_click)),
                backgroundColor: 'rgba(255, 159, 64, 0.7)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Clicks: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Days since course start",
                        font: { weight: 'bold' }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Number of interactions",
                        font: { weight: 'bold' }
                    }
                }
            }
        }
    });
}

// ============================================
// NEW FEATURE: UPCOMING DEADLINES
// ============================================
function renderUpcomingDeadlines(assessments, currentDay = 0) {
    const container = document.getElementById("deadlinesList");
    if (!container) return;

    const upcoming = assessments
        .filter(a => a.date > currentDay)
        .sort((a, b) => a.date - b.date)
        .slice(0, 5);

    if (upcoming.length === 0) {
        container.innerHTML = `
            <div class="alert alert-success mb-0">
                <i class="bi bi-check-circle me-2"></i>
                No upcoming deadlines! You're all caught up.
            </div>`;
        return;
    }

    const html = upcoming.map(a => {
        const daysLeft = a.date - currentDay;
        const urgency = daysLeft < 3 ? 'danger' : daysLeft < 7 ? 'warning' : 'success';
        const icon = a.assessment_type === 'Exam' ? 'clipboard-check' :
            a.assessment_type === 'TMA' ? 'file-text' : 'laptop';

        return `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <i class="bi bi-${icon} me-2 text-${urgency}"></i>
                    <strong>${a.assessment_type}</strong>
                    <br>
                    <small class="text-muted">${a.code_module} - ${a.code_presentation}</small>
                </div>
                <span class="badge bg-${urgency} rounded-pill">
                    ${daysLeft} day${daysLeft !== 1 ? 's' : ''}
                </span>
            </li>
        `;
    }).join('');

    container.innerHTML = html;
}

// ============================================
// NEW FEATURE: MODULE PROGRESS TRACKING
// ============================================
function renderModuleProgress(scores, assessments) {
    const container = document.getElementById("progressBars");
    if (!container) return;

    // Group by module
    const moduleData = {};
    scores.forEach(s => {
        const mod = s.code_module;
        if (!moduleData[mod]) {
            moduleData[mod] = { scores: [], total: 0 };
        }
        moduleData[mod].scores.push(Number(s.score));
    });

    // Calculate total assessments per module
    if (assessments) {
        assessments.forEach(a => {
            if (moduleData[a.code_module]) {
                moduleData[a.code_module].total++;
            }
        });
    }

    const html = Object.entries(moduleData).map(([mod, data]) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const completion = data.total > 0 ? (data.scores.length / data.total) * 100 : 0;
        const color = getColorForModule(mod);

        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                    <span style="color: ${color};">
                        <i class="bi bi-book me-1"></i>
                        <strong>${mod}</strong>
                    </span>
                    <span class="text-muted">
                        ${data.scores.length}/${data.total || '?'} completed
                    </span>
                </div>
                <div class="progress" style="height: 28px;">
                    <div class="progress-bar" 
                         style="width: ${completion}%; background-color: ${color};">
                        <strong>${avgScore.toFixed(1)}% avg</strong>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html || '<p class="text-muted">No module data available</p>';
}

// ============================================
// NEW FEATURE: AT-RISK WARNING
// ============================================
function checkAtRiskStatus(scores) {
    const failing = scores.filter(s => Number(s.score) < 40);
    const container = document.getElementById("atRiskWarning");

    if (!container) return;

    if (failing.length > 0) {
        const modules = [...new Set(failing.map(s => s.code_module))];
        container.innerHTML = `
            <div class="alert alert-danger d-flex align-items-start">
                <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                <div>
                    <strong>Attention Needed!</strong>
                    <p class="mb-1">You have ${failing.length} assessment(s) below passing grade (40%).</p>
                    <small>Affected modules: ${modules.join(', ')}</small>
                    <br>
                    <small>Consider seeking help or tutoring support.</small>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="alert alert-success d-flex align-items-center">
                <i class="bi bi-check-circle-fill me-2"></i>
                <span>Great job! All assessments are above passing grade.</span>
            </div>
        `;
    }
}

// ============================================
// NEW FEATURE: PERFORMANCE SUMMARY CARDS
// ============================================
function renderPerformanceSummary(scores) {
    const container = document.getElementById("performanceSummary");
    if (!container) return;

    const totalAssessments = scores.length;
    const avgScore = scores.reduce((a, b) => a + Number(b.score), 0) / totalAssessments;
    const passed = scores.filter(s => Number(s.score) >= 40).length;
    const highest = Math.max(...scores.map(s => Number(s.score)));

    container.innerHTML = `
        <div class="row g-3">
            <div class="col-6 col-md-3">
                <div class="card border-0 bg-primary text-white h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-clipboard-data fs-2"></i>
                        <h3 class="mt-2 mb-0">${totalAssessments}</h3>
                        <small>Total Assessments</small>
                    </div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card border-0 bg-success text-white h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-graph-up-arrow fs-2"></i>
                        <h3 class="mt-2 mb-0">${avgScore.toFixed(1)}%</h3>
                        <small>Average Score</small>
                    </div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card border-0 bg-info text-white h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-check-circle fs-2"></i>
                        <h3 class="mt-2 mb-0">${passed}</h3>
                        <small>Passed</small>
                    </div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card border-0 bg-warning text-dark h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-trophy fs-2"></i>
                        <h3 class="mt-2 mb-0">${highest}%</h3>
                        <small>Best Score</small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// NEW FEATURE: RECENT UPDATES FEED
// ============================================
function renderRecentUpdates(data) {
    const container = document.getElementById("updatesFeed");
    if (!container) return;

    const updates = [];

    // Recent submission
    if (data.scores && data.scores.length > 0) {
        const recent = data.scores.sort((a, b) => b.date_submitted - a.date_submitted)[0];
        updates.push({
            icon: 'check-circle',
            text: `Submitted ${recent.assessment_type} in ${recent.code_module}`,
            subtext: `Score: ${recent.score}%`,
            time: `Day ${recent.date_submitted}`,
            type: recent.score >= 40 ? 'success' : 'danger'
        });
    }

    // Recent activity
    if (data.activity && data.activity.length > 0) {
        const recentActivity = data.activity.sort((a, b) => b.date - a.date)[0];
        updates.push({
            icon: 'mouse',
            text: `Active on VLE materials`,
            subtext: `${recentActivity.sum_click} interactions`,
            time: `Day ${recentActivity.date}`,
            type: 'info'
        });
    }

    // Upcoming deadline
    if (data.assessments) {
        const nextDeadline = data.assessments
            .filter(a => a.date > (data.currentDay || 0))
            .sort((a, b) => a.date - b.date)[0];

        if (nextDeadline) {
            const daysLeft = nextDeadline.date - (data.currentDay || 0);
            updates.push({
                icon: 'exclamation-triangle',
                text: `${nextDeadline.assessment_type} deadline approaching`,
                subtext: nextDeadline.code_module,
                time: `${daysLeft} days left`,
                type: daysLeft < 7 ? 'warning' : 'secondary'
            });
        }
    }

    const html = updates.map(u => `
        <div class="alert alert-${u.type} d-flex align-items-start py-2 mb-2">
            <i class="bi bi-${u.icon} me-2 mt-1"></i>
            <div class="flex-grow-1">
                <div><strong>${u.text}</strong></div>
                <small class="text-muted">${u.subtext}</small>
                <div><small class="text-muted"><i class="bi bi-clock me-1"></i>${u.time}</small></div>
            </div>
        </div>
    `).join('');

    container.innerHTML = html || '<p class="text-muted">No recent updates</p>';
}

// ============================================
// NEW FEATURE: VLE ENGAGEMENT ANALYSIS
// ============================================
function renderVLEEngagement(vleData, activityData) {
    const container = document.getElementById("vleEngagement");
    if (!container) return;

    const totalMaterials = vleData ? vleData.length : 0;
    const accessedMaterials = activityData ? [...new Set(activityData.map(a => a.id_site))].length : 0;
    const totalClicks = activityData ? activityData.reduce((sum, a) => sum + Number(a.sum_click), 0) : 0;

    const engagementRate = totalMaterials > 0 ? (accessedMaterials / totalMaterials) * 100 : 0;
    const rateColor = engagementRate >= 75 ? 'success' : engagementRate >= 50 ? 'warning' : 'danger';

    container.innerHTML = `
        <div class="row g-3">
            <div class="col-md-4">
                <div class="text-center">
                    <div class="display-6 text-${rateColor}">
                        ${engagementRate.toFixed(0)}%
                    </div>
                    <small class="text-muted">Material Access Rate</small>
                </div>
            </div>
            <div class="col-md-4">
                <div class="text-center">
                    <div class="display-6 text-primary">
                        ${accessedMaterials}/${totalMaterials}
                    </div>
                    <small class="text-muted">Materials Accessed</small>
                </div>
            </div>
            <div class="col-md-4">
                <div class="text-center">
                    <div class="display-6 text-info">
                        ${totalClicks}
                    </div>
                    <small class="text-muted">Total Clicks</small>
                </div>
            </div>
        </div>
        <div class="progress mt-3" style="height: 30px;">
            <div class="progress-bar bg-${rateColor}" 
                 style="width: ${engagementRate}%"
                 role="progressbar">
                <strong>${engagementRate.toFixed(1)}% Engaged</strong>
            </div>
        </div>
    `;
}

// ============================================
// LECTURER DASHBOARD
// ============================================
let classChartInstance = null;
let currentRiskStudents = [];
let participationChartInstance = null;

async function loadLecturerData(moduleCode) {
    if (!moduleCode) {
        moduleCode = document.getElementById("module").value;
    }

    const loadingEl = document.getElementById("loadingMessage");
    if (loadingEl) {
        loadingEl.style.display = "flex";
        loadingEl.innerHTML = `
            <div class="spinner-border spinner-border-sm text-info me-2" role="status"></div>
            <span>Loading lecturer data for ${moduleCode}...</span>
        `;
    }

    try {
        const res = await fetch(`/api/lecturer/${moduleCode}`);
        const data = await res.json();

        renderLecturerSummary(data);
        renderClassPerformance(data.scores, moduleCode);
        renderRiskStudents(data.scores);
        renderParticipationTrends(data.trends);

        if (loadingEl) {
            loadingEl.innerHTML = "✅ Lecturer data loaded";
            setTimeout(() => { loadingEl.style.display = "none"; }, 2000);
        }
    } catch (error) {
        console.error("Error loading lecturer data:", error);
        if (loadingEl) {
            loadingEl.innerHTML = "❌ Error loading data";
        }
    }
}

function renderLecturerSummary(data) {
    const scores = data.scores.map(s => Number(s.score));
    const totalStudents = Array.isArray(data.students) ? data.students.length : data.students;
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    document.getElementById("totalStudents").innerText = totalStudents;
    document.getElementById("avgClassScore").innerText = avgScore.toFixed(2) + "%";

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

    const topStudents = [...data.scores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    document.getElementById("topStudents").innerHTML =
        topStudents.map(s =>
            `<li class="list-group-item d-flex justify-content-between">
                <span>${s.id_student}</span>
                <span class="badge bg-success">${s.score}%</span>
            </li>`
        ).join("");
}

function renderClassPerformance(scores, moduleCode) {
    const perfScores = scores.map(s => Number(s.score));
    const ranges = {
        "0-39 (Fail)": perfScores.filter(s => s >= 0 && s <= 39).length,
        "40-59 (Pass)": perfScores.filter(s => s >= 40 && s <= 59).length,
        "60-79 (Merit)": perfScores.filter(s => s >= 60 && s <= 79).length,
        "80-100 (Distinction)": perfScores.filter(s => s >= 80 && s <= 100).length
    };

    if (classChartInstance) classChartInstance.destroy();

    const ctx = document.getElementById("classChart");
    if (!ctx) return;

    classChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                label: `Assessments in ${moduleCode}`,
                data: Object.values(ranges),
                backgroundColor: ["#dc3545", "#ffc107", "#0d6efd", "#198754"],
                borderWidth: 2,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Count: ${context.parsed.y}`;
                        }
                    }
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
        }
    });
}

function renderRiskStudents(scores) {
    currentRiskStudents = scores.filter(s => Number(s.score) < 40);
    renderRiskTable(currentRiskStudents);
}

let sortDirection = { id: "asc", score: "asc" };

function renderRiskTable(students) {
    const tableHeader = `
        <tr>
            <th onclick="sortRiskTable('id')" style="cursor: pointer;">
                ID <i class="bi bi-arrow-down-up"></i>
            </th>
            <th onclick="sortRiskTable('score')" style="cursor: pointer;">
                Score <i class="bi bi-arrow-down-up"></i>
            </th>
        </tr>`;

    const tableRows = students
        .map(s => `
            <tr>
                <td>${s.id_student}</td>
                <td><span class="badge bg-danger">${s.score}%</span></td>
            </tr>
        `).join("");

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

function renderParticipationTrends(trends) {
    if (participationChartInstance) participationChartInstance.destroy();

    const ctx = document.getElementById("participationChart");
    if (!ctx) return;

    participationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trends.map(t => `Day ${t.day}`),
            datasets: [{
                label: "Total Clicks",
                data: trends.map(t => t.clicks),
                borderColor: "#3498db",
                backgroundColor: "rgba(52, 152, 219, 0.1)",
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: "Days since course start" } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Total Clicks" }
                }
            }
        }
    });
}

async function populateModuleDropdown() {
    try {
        const res = await fetch("/api/modules");
        const modules = await res.json();
        const select = document.getElementById("module");

        select.innerHTML = modules.map(m => `<option value="${m}">${m}</option>`).join("");

        if (modules.length > 0) {
            loadLecturerData(modules[0]);
        }

        select.onchange = () => loadLecturerData(select.value);
    } catch (error) {
        console.error("Error loading modules:", error);
    }
}

// ============================================
// ADMIN DASHBOARD
// ============================================
let allStudentsData = [];
let allSubjectsData = [];
let currentPage = 1;
const studentsPerPage = 10;

async function loadAdminData() {
    try {
        const res = await fetch("/api/admin");
        const data = await res.json();

        // ✅ TEMPORARY: Generate subjects from enrolments data if not provided
        if (!data.subjects && data.enrolments) {
            allSubjectsData = generateSubjectsFromEnrolments(data.enrolments);
        } else {
            allSubjectsData = data.subjects || [];
        }

        // ✅ TEMPORARY: Generate mock students if not provided
        if (!data.students) {
            allStudentsData = generateMockStudents(data);
        } else {
            allStudentsData = data.students;
        }

        // Render all sections
        renderAdminSummary(data);
        renderEnrolmentChart(data.enrolments);
        renderSubjectsTable(allSubjectsData);
        renderStudentsTable(allStudentsData);
        renderGenderChart(data.gender);
        renderAgeChart(data.age);
        renderOutcomeChart(data.outcomes);

        // Setup search and filters
        setupAdminFilters();
    } catch (error) {
        console.error("Error loading admin data:", error);
    }
}

// ============================================
// TEMPORARY: GENERATE DATA FROM EXISTING API
// ============================================
function generateSubjectsFromEnrolments(enrolments) {
    // Convert enrolments object into subjects array
    return Object.entries(enrolments).map(([key, count]) => {
        const [module, presentation] = key.split('_');
        return {
            code_module: module,
            code_presentation: presentation,
            module_presentation_length: 'N/A',
            enrolments: count
        };
    });
}

function generateMockStudents(data) {
    // Generate sample students from outcomes data
    const outcomes = data.outcomes || {};
    const students = [];
    let studentId = 10000;

    // Create students for each outcome type
    const outcomeTypes = [
        { type: 'Pass', count: Math.min(outcomes.Pass || 0, 100) },
        { type: 'Fail', count: Math.min(outcomes.Fail || 0, 50) },
        { type: 'Distinction', count: Math.min(outcomes.Distinction || 0, 30) },
        { type: 'Withdrawn', count: Math.min(outcomes.Withdrawn || 0, 50) }
    ];

    outcomeTypes.forEach(outcome => {
        for (let i = 0; i < outcome.count; i++) {
            students.push({
                id_student: String(studentId++),
                modules_enrolled: 'Various',
                studied_credits: Math.floor(Math.random() * 120) + 30,
                final_result: outcome.type
            });
        }
    });

    return students.slice(0, 100); // Limit to 100 for demo
}

// ============================================
// ADMIN SUMMARY CARDS
// ============================================
function renderAdminSummary(data) {
    // Calculate totals
    const totalStudents = allStudentsData.length || Object.values(data.outcomes || {}).reduce((a, b) => a + b, 0);
    const totalCourses = Object.keys(data.enrolments || {}).length;
    const totalEnrolments = Object.values(data.enrolments || {}).reduce((a, b) => a + b, 0);

    // Calculate pass rate
    const outcomes = data.outcomes || {};
    const totalCompleted = (outcomes.Pass || 0) + (outcomes.Fail || 0) + (outcomes.Distinction || 0);
    const passRate = totalCompleted > 0
        ? (((outcomes.Pass || 0) + (outcomes.Distinction || 0)) / totalCompleted * 100).toFixed(1)
        : 0;

    // Update summary cards
    const totalStudentsEl = document.getElementById("totalStudentsCount");
    const totalCoursesEl = document.getElementById("totalCoursesCount");
    const totalEnrolmentsEl = document.getElementById("totalEnrolmentsCount");
    const passRateEl = document.getElementById("passRatePercent");

    if (totalStudentsEl) totalStudentsEl.textContent = totalStudents.toLocaleString();
    if (totalCoursesEl) totalCoursesEl.textContent = totalCourses;
    if (totalEnrolmentsEl) totalEnrolmentsEl.textContent = totalEnrolments.toLocaleString();
    if (passRateEl) passRateEl.textContent = passRate + "%";
}

// ============================================
// SUBJECTS OFFERED TABLE
// ============================================
function renderSubjectsTable(subjects) {
    const tbody = document.getElementById("subjectsTableBody");
    if (!tbody) return;

    if (!subjects || subjects.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                    No subjects data available
                </td>
            </tr>`;
        return;
    }

    const html = subjects.map(subject => {
        const statusClass = subject.enrolments > 50 ? 'success' :
            subject.enrolments > 20 ? 'warning' : 'danger';
        const statusText = subject.enrolments > 50 ? 'High' :
            subject.enrolments > 20 ? 'Moderate' : 'Low';

        return `
            <tr>
                <td><strong>${subject.code_module}</strong></td>
                <td><span class="badge bg-secondary">${subject.code_presentation}</span></td>
                <td>${subject.module_presentation_length || 'N/A'}</td>
                <td><strong>${subject.enrolments || 0}</strong> students</td>
                <td><span class="status-badge bg-${statusClass}">${statusText} Demand</span></td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

// ============================================
// STUDENT REGISTRY TABLE
// ============================================
function renderStudentsTable(students, page = 1) {
    const tbody = document.getElementById("studentsTableBody");
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    <i class="bi bi-person-x fs-1 d-block mb-2"></i>
                    No students data available
                </td>
            </tr>`;
        return;
    }

    // Pagination
    const startIndex = (page - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    const paginatedStudents = students.slice(startIndex, endIndex);

    const html = paginatedStudents.map(student => {
        const statusClass = {
            'Pass': 'success',
            'Distinction': 'primary',
            'Fail': 'danger',
            'Withdrawn': 'warning'
        }[student.final_result] || 'secondary';

        const isActive = student.final_result !== 'Withdrawn';
        const statusBadge = isActive ?
            '<span class="status-badge bg-success">Active</span>' :
            '<span class="status-badge bg-warning">Withdrawn</span>';

        return `
            <tr>
                <td><strong>${student.id_student}</strong></td>
                <td>${student.modules_enrolled || 'N/A'}</td>
                <td>${student.studied_credits || 0}</td>
                <td><span class="badge bg-${statusClass}">${student.final_result}</span></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;

    // Update pagination info
    const studentsCountEl = document.getElementById("studentsCount");
    const currentPageEl = document.getElementById("currentPage");
    if (studentsCountEl) studentsCountEl.textContent = students.length;
    if (currentPageEl) currentPageEl.textContent = page;

    // Update pagination buttons
    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");
    if (prevBtn) prevBtn.disabled = page === 1;
    if (nextBtn) nextBtn.disabled = endIndex >= students.length;
}

// ============================================
// SEARCH AND FILTER FUNCTIONALITY
// ============================================
function setupAdminFilters() {
    // Subject search
    const searchSubjects = document.getElementById("searchSubjects");
    if (searchSubjects) {
        searchSubjects.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allSubjectsData.filter(subject =>
                subject.code_module.toLowerCase().includes(query) ||
                subject.code_presentation.toLowerCase().includes(query)
            );
            renderSubjectsTable(filtered);
        }, 300));
    }

    // Student search
    const searchStudents = document.getElementById("searchStudents");
    if (searchStudents) {
        searchStudents.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allStudentsData.filter(student =>
                student.id_student.toString().includes(query)
            );
            currentPage = 1;
            renderStudentsTable(filtered, currentPage);
        }, 300));
    }

    // Status filter
    const filterStatus = document.getElementById("filterStatus");
    if (filterStatus) {
        filterStatus.addEventListener('change', (e) => {
            const status = e.target.value;
            let filtered = allStudentsData;

            if (status === 'active') {
                filtered = allStudentsData.filter(s => s.final_result !== 'Withdrawn');
            } else if (status === 'withdrawn') {
                filtered = allStudentsData.filter(s => s.final_result === 'Withdrawn');
            } else if (status === 'completed') {
                filtered = allStudentsData.filter(s =>
                    ['Pass', 'Distinction', 'Fail'].includes(s.final_result)
                );
            }

            currentPage = 1;
            renderStudentsTable(filtered, currentPage);
        });
    }

    // Pagination
    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderStudentsTable(allStudentsData, currentPage);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const maxPages = Math.ceil(allStudentsData.length / studentsPerPage);
            if (currentPage < maxPages) {
                currentPage++;
                renderStudentsTable(allStudentsData, currentPage);
            }
        });
    }
}

function renderEnrolmentChart(enrolments) {
    const ctx = document.getElementById("enrolChart");
    if (!ctx) return;

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(enrolments),
            datasets: [{
                label: "Enrolments",
                data: Object.values(enrolments),
                backgroundColor: "rgba(52, 152, 219, 0.7)",
                borderColor: "#3498db",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "top"
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Course (Module-Presentation)"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Number of Enrolments"
                    }
                }
            }
        }
    });
}

function renderGenderChart(gender) {
    const ctx = document.getElementById("genderChart");
    if (!ctx) return;

    new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["Male", "Female"],
            datasets: [{
                data: [gender["M"] || 0, gender["F"] || 0],
                backgroundColor: ["#2196f3", "#e91e63"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: "Gender Distribution"
                }
            }
        }
    });

    // Update counts
    const maleCount = document.getElementById("maleCount");
    const femaleCount = document.getElementById("femaleCount");
    if (maleCount) maleCount.textContent = gender["M"] || 0;
    if (femaleCount) femaleCount.textContent = gender["F"] || 0;
}

function renderAgeChart(age) {
    const ctx = document.getElementById("ageChart");
    if (!ctx) return;

    new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["🧑‍🎓 Young (0-35)", "👨 Adult (36-55)", "👴 Older (55+)"],
            datasets: [{
                label: "Age Distribution",
                data: [
                    age["0-35"] || 0,
                    age["35-55"] || 0,
                    age["55<="] || 0
                ],
                backgroundColor: ["#2196f3", "#4caf50", "#ff9800"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: "Age Band Distribution"
                }
            }
        }
    });

    // Update counts
    const youngCount = document.getElementById("youngCount");
    const adultCount = document.getElementById("adultCount");
    const olderCount = document.getElementById("olderCount");
    if (youngCount) youngCount.textContent = age["0-35"] || 0;
    if (adultCount) adultCount.textContent = age["35-55"] || 0;
    if (olderCount) olderCount.textContent = age["55<="] || 0;
}

function renderOutcomeChart(outcomes) {
    const ctx = document.getElementById("outcomeChart");
    if (!ctx) return;

    new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["✅ Pass", "❌ Fail", "🔄 Withdrawn", "🏆 Distinction"],
            datasets: [{
                label: "Final Outcomes",
                data: [
                    outcomes["Pass"] || 0,
                    outcomes["Fail"] || 0,
                    outcomes["Withdrawn"] || 0,
                    outcomes["Distinction"] || 0
                ],
                backgroundColor: ["#4caf50", "#f44336", "#ff9800", "#2196f3"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: "Final Outcomes Distribution"
                }
            }
        }
    });

    // Update counts
    const passCount = document.getElementById("passCount");
    const failCount = document.getElementById("failCount");
    const withdrawCount = document.getElementById("withdrawCount");
    const distCount = document.getElementById("distCount");
    if (passCount) passCount.textContent = outcomes["Pass"] || 0;
    if (failCount) failCount.textContent = outcomes["Fail"] || 0;
    if (withdrawCount) withdrawCount.textContent = outcomes["Withdrawn"] || 0;
    if (distCount) distCount.textContent = outcomes["Distinction"] || 0;
}

// ============================================
// AUTO-INITIALIZATION
// ============================================
// Student Dashboard
if (document.getElementById("progressChart")) {
    loadStudentData("11391"); // Change to actual logged-in student ID
}

// Lecturer Dashboard
if (document.getElementById("classChart")) {
    populateModuleDropdown();
}

// Admin Dashboard
if (document.getElementById("enrolChart")) {
    loadAdminData();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Format date helper
function formatDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString();
}

// Calculate percentage helper
function calculatePercentage(value, total) {
    return total > 0 ? ((value / total) * 100).toFixed(1) : 0;
}

// Get grade classification
function getGradeClassification(score) {
    if (score >= 80) return { grade: 'Distinction', class: 'success' };
    if (score >= 60) return { grade: 'Merit', class: 'info' };
    if (score >= 40) return { grade: 'Pass', class: 'warning' };
    return { grade: 'Fail', class: 'danger' };
}

// Debounce function for search/filter
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export data to CSV (for future use)
function exportToCSV(data, filename) {
    const csv = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Show toast notification (Bootstrap 5)
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    // Remove from DOM after hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

// Smooth scroll for anchor links
document.addEventListener('DOMContentLoaded', () => {
    // Add smooth scrolling to all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Initialize tooltips if Bootstrap is available
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(
            document.querySelectorAll('[data-bs-toggle="tooltip"]')
        );
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
});

// Handle window resize for charts
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Trigger chart resize if needed
        if (progressChartInstance) progressChartInstance.resize();
        if (activityChartInstance) activityChartInstance.resize();
        if (classChartInstance) classChartInstance.resize();
        if (participationChartInstance) participationChartInstance.resize();
    }, 250);
});

// Print functionality
function printDashboard() {
    window.print();
}

// Refresh data functionality
function refreshDashboard() {
    if (document.getElementById("progressChart")) {
        showToast('Refreshing student data...', 'info');
        loadStudentData("11391");
    } else if (document.getElementById("classChart")) {
        const moduleCode = document.getElementById("module").value;
        showToast('Refreshing lecturer data...', 'info');
        loadLecturerData(moduleCode);
    } else if (document.getElementById("enrolChart")) {
        showToast('Refreshing admin data...', 'info');
        loadAdminData();
    }
}

// Dark mode toggle (optional enhancement)
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
}

// Load dark mode preference on page load
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // You can show a user-friendly error message here
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // You can show a user-friendly error message here
});

// ============================================
// PERFORMANCE MONITORING (Optional)
// ============================================
if ('performance' in window) {
    window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`Page load time: ${pageLoadTime}ms`);
    });
}

// ============================================
// SERVICE WORKER REGISTRATION (Optional - for PWA)
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment if you have a service worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(reg => console.log('Service Worker registered'))
        //     .catch(err => console.log('Service Worker registration failed'));
    });
}