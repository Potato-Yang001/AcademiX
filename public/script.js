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
// STUDENT DASHBOARD - COMPLETE SCRIPT
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
            window.studentData = data;
        }

        // Generate missing data from existing data
        if (!data.assessments && data.scores) {
            data.assessments = generateAssessmentsFromScores(data.scores);
        }
        if (!data.currentDay) {
            data.currentDay = calculateCurrentDay(data.scores);
        }
        if (!data.vle && data.activity) {
            data.vle = generateVLEFromActivity(data.activity);
        }

        // ✅ NEW PRIORITY ORDER (Shaffer-aligned)
        // 1. URGENT ACTIONS FIRST
        renderUrgentActionsPanel(data);

        // 2. ACTIONABLE RECOMMENDATIONS
        renderActionableRecommendations(data);

        // 3. AT-RISK WARNING & PERFORMANCE SUMMARY
        if (data.scores) {
            checkAtRiskStatus(data.scores);
            renderPerformanceSummary(data.scores);
        }

        // 4. GOAL TRACKER (NEW)
        renderGoalTracker(data);

        // 5. WHAT-IF CALCULATOR (NEW)
        renderWhatIfCalculator(data);

        // 6. REST OF DASHBOARD (existing features)
        renderUpcomingDeadlines(data.assessments || [], data.currentDay || 0);
        renderModuleProgress(data.scores, data.assessments);
        renderAcademicProgress(data.scores);
        renderRecentUpdates(data);
        renderEngagementChart(data.activity);
        renderVLEEngagement(data.vle || [], data.activity || []);
        renderConsistencyTracker(data.activity);

        // 7. PROFILE LAST
        renderStudentProfile(data.student);

        // 8. Initialize interactive features
        setTimeout(() => {
            initializeInteractiveFeatures(data);
            makeModuleProgressInteractive();
            makePerformanceCardsInteractive();
        }, 500);

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
// GENERATE MISSING STUDENT DATA
// ============================================
function generateAssessmentsFromScores(scores) {
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
                date: maxDate + (i * 15),
                is_future: true
            });
        }
    });

    return assessments;
}

function calculateCurrentDay(scores) {
    if (!scores || scores.length === 0) return 50;
    const maxDate = Math.max(...scores.map(s => Number(s.date_submitted)));
    return maxDate + 5;
}

function generateVLEFromActivity(activity) {
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

    const courseGroups = {};
    scores.forEach(s => {
        const key = `${s.code_module}_${s.code_presentation}`;
        if (!courseGroups[key]) courseGroups[key] = [];
        courseGroups[key].push({
            x: Number(s.date_submitted),
            y: Number(s.score),
            assessment: 'Assessment'
        });
    });

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
// UPCOMING DEADLINES
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
// MODULE PROGRESS TRACKING
// ============================================
function renderModuleProgress(scores, assessments) {
    const container = document.getElementById("progressBars");
    if (!container) return;

    const moduleData = {};
    scores.forEach(s => {
        const mod = s.code_module;
        if (!moduleData[mod]) {
            moduleData[mod] = { scores: [], completed: 0, total: 0 };
        }
        moduleData[mod].scores.push(Number(s.score));
        moduleData[mod].completed++;
    });

    // Count total assessments (including future ones)
    if (assessments) {
        assessments.forEach(a => {
            if (moduleData[a.code_module]) {
                moduleData[a.code_module].total++;
            }
        });
    }

    const html = Object.entries(moduleData).map(([mod, data]) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const totalAssessments = data.completed + data.total;
        const completion = totalAssessments > 0 ? (data.completed / totalAssessments) * 100 : 0;
        const color = getColorForModule(mod);

        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                    <span style="color: ${color};">
                        <i class="bi bi-book me-1"></i>
                        <strong>${mod}</strong>
                    </span>
                    <span class="text-muted">
                        ${data.completed}/${totalAssessments} completed
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
// AT-RISK WARNING
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
// PERFORMANCE SUMMARY CARDS
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
// RECENT UPDATES FEED
// ============================================
function renderRecentUpdates(data) {
    const container = document.getElementById("updatesFeed");
    if (!container) return;

    const updates = [];

    if (data.scores && data.scores.length > 0) {
        const recent = data.scores.sort((a, b) => b.date_submitted - a.date_submitted)[0];
        updates.push({
            icon: 'check-circle',
            text: `Submitted assessment in ${recent.code_module}`,
            subtext: `Score: ${recent.score}%`,
            time: `${recent.date_submitted} days ago`,
            type: recent.score >= 40 ? 'success' : 'danger'
        });
    }

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
// VLE ENGAGEMENT ANALYSIS
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
// INTERACTIVE STUDY TIMELINE
// ============================================
function initializeInteractiveFeatures(data) {
    const timelineContainer = document.getElementById("studyTimeline");

    if (!data.scores || data.scores.length === 0) {
        if (timelineContainer) {
            timelineContainer.innerHTML = '<p class="text-muted text-center">No timeline data available</p>';
        }
        return;
    }

    // Create timeline events from scores
    const events = data.scores
        .sort((a, b) => a.date_submitted - b.date_submitted)
        .map(score => ({
            date: score.date_submitted,
            module: score.code_module,
            score: score.score,
            passed: score.score >= 40
        }));

    if (timelineContainer) {
        const html = events.map(event => {
            const statusIcon = event.passed ? '✅' : '❌';
            const statusClass = event.passed ? 'success' : 'danger';

            return `
                <div class="timeline-item mb-3 p-3 border-start border-3 border-${statusClass}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>Assessment Submitted</strong>
                            <div class="text-muted">${event.module}</div>
                            <div class="mt-1">
                                <span class="badge bg-${statusClass}">
                                    Score: ${event.score}% | ${event.passed ? 'Passed' : 'Failed'} ${statusIcon}
                                </span>
                            </div>
                        </div>
                        <small class="text-muted">Day ${event.date}</small>
                    </div>
                </div>
            `;
        }).join('');

        timelineContainer.innerHTML = html;
    }
}

function renderConsistencyTracker(activity) {
    const container = document.getElementById('consistencyTracker');
    if (!container || !activity || activity.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No activity data available</p>';
        return;
    }

    // Calculate streak (consecutive days with activity)
    const sortedActivity = [...activity].sort((a, b) => Number(b.date) - Number(a.date));
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 1;

    for (let i = 0; i < sortedActivity.length - 1; i++) {
        const diff = Number(sortedActivity[i].date) - Number(sortedActivity[i + 1].date);
        if (diff === 1) {
            tempStreak++;
        } else {
            if (i === 0) currentStreak = tempStreak;
            maxStreak = Math.max(maxStreak, tempStreak);
            tempStreak = 1;
        }
    }
    maxStreak = Math.max(maxStreak, tempStreak);
    if (currentStreak === 0) currentStreak = tempStreak;

    // Calculate total active days
    const activeDays = activity.length;
    const totalDays = Math.max(...activity.map(a => Number(a.date)));
    const consistency = (activeDays / totalDays * 100);

    let streakIcon, streakColor, message;
    if (currentStreak >= 7) {
        streakIcon = '🔥🔥🔥';
        streakColor = 'success';
        message = 'Amazing! You\'re on fire! Keep this momentum going!';
    } else if (currentStreak >= 3) {
        streakIcon = '🔥';
        streakColor = 'info';
        message = 'Good consistency! Try to maintain your streak!';
    } else {
        streakIcon = '💤';
        streakColor = 'warning';
        message = 'Let\'s build a longer study streak!';
    }

    const html = `
        <div class="text-center mb-4">
            <div class="display-1">${streakIcon}</div>
            <h3 class="mt-3 text-${streakColor}">${currentStreak} Day Streak!</h3>
        </div>
        
        <div class="row text-center mb-4">
            <div class="col-4">
                <div class="p-3 bg-light rounded">
                    <div class="display-6 text-primary">${maxStreak}</div>
                    <small class="text-muted">Best Streak</small>
                </div>
            </div>
            <div class="col-4">
                <div class="p-3 bg-light rounded">
                    <div class="display-6 text-success">${activeDays}</div>
                    <small class="text-muted">Active Days</small>
                </div>
            </div>
            <div class="col-4">
                <div class="p-3 bg-light rounded">
                    <div class="display-6 text-info">${consistency.toFixed(0)}%</div>
                    <small class="text-muted">Consistency</small>
                </div>
            </div>
        </div>
        
        <div class="progress mb-3" style="height: 25px;">
            <div class="progress-bar bg-${streakColor}" style="width: ${consistency}%" role="progressbar">
                ${consistency.toFixed(0)}% of days active
            </div>
        </div>
        
        <div class="alert alert-${streakColor} mb-0">
            <i class="bi bi-lightbulb me-2"></i>
            ${message}
        </div>
    `;

    container.innerHTML = html;
}

// 🚨 1. URGENT ACTIONS PANEL
function renderUrgentActionsPanel(data) {
    const container = document.getElementById("urgentActions");
    if (!container) return;

    const urgentItems = [];
    const currentDay = data.currentDay || 0;

    // Check for urgent deadlines (< 7 days)
    if (data.assessments) {
        const urgent = data.assessments
            .filter(a => a.date > currentDay && (a.date - currentDay) < 7)
            .sort((a, b) => a.date - b.date);

        urgent.forEach(a => {
            const daysLeft = a.date - currentDay;
            urgentItems.push({
                priority: daysLeft < 3 ? 'CRITICAL' : 'HIGH',
                color: daysLeft < 3 ? 'danger' : 'warning',
                icon: 'clock-fill',
                title: `${a.assessment_type} Due in ${daysLeft} Days`,
                description: `${a.code_module} - ${a.code_presentation}`,
                action: 'Submit Now',
                actionLink: '#submissions'
            });
        });
    }

    // Check for failing modules
    if (data.scores) {
        const failingModules = {};
        data.scores.forEach(s => {
            if (s.score < 40) {
                if (!failingModules[s.code_module]) {
                    failingModules[s.code_module] = [];
                }
                failingModules[s.code_module].push(s.score);
            }
        });

        Object.entries(failingModules).forEach(([module, scores]) => {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            urgentItems.push({
                priority: 'HIGH',
                color: 'danger',
                icon: 'exclamation-triangle-fill',
                title: `${module}: Below Passing Grade`,
                description: `Current average: ${avg.toFixed(1)}% (Need 40%)`,
                action: 'Get Help',
                actionLink: '#help'
            });
        });
    }

    if (urgentItems.length === 0) {
        container.innerHTML = `
            <div class="alert alert-success">
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong>All Clear!</strong> No urgent actions required right now.
            </div>
        `;
        return;
    }

    const html = `
        <div class="card border-0 shadow-lg" style="border-left: 5px solid #dc3545;">
            <div class="card-header bg-danger text-white">
                <h5 class="mb-0">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    🚨 Urgent Actions Required
                </h5>
            </div>
            <div class="card-body p-0">
                ${urgentItems.map((item, index) => `
                    <div class="p-3 border-bottom ${index === 0 ? 'bg-light' : ''}">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <span class="badge bg-${item.color} mb-2">${item.priority}</span>
                                <h6 class="mb-1">
                                    <i class="bi bi-${item.icon} text-${item.color} me-2"></i>
                                    ${item.title}
                                </h6>
                                <p class="text-muted mb-2 small">${item.description}</p>
                                <button class="btn btn-sm btn-${item.color}">
                                    <i class="bi bi-arrow-right-circle me-1"></i>
                                    ${item.action}
                                </button>
                            </div>
                            <div class="text-center" style="min-width: 50px;">
                                <div class="badge bg-${item.color} rounded-circle" 
                                     style="width: 40px; height: 40px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;">
                                    ${index + 1}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// 💡 2. ACTIONABLE RECOMMENDATIONS
function renderActionableRecommendations(data) {
    const container = document.getElementById("recommendations");
    if (!container) return;

    const recommendations = [];

    // Analyze scores to find weak modules
    if (data.scores) {
        const modulePerformance = {};
        data.scores.forEach(s => {
            if (!modulePerformance[s.code_module]) {
                modulePerformance[s.code_module] = [];
            }
            modulePerformance[s.code_module].push(Number(s.score));
        });

        Object.entries(modulePerformance).forEach(([module, scores]) => {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (avg < 60) {
                recommendations.push({
                    icon: 'book',
                    color: avg < 40 ? 'danger' : 'warning',
                    title: `Focus on ${module}`,
                    reason: `Current average: ${avg.toFixed(1)}%`,
                    action: 'Review lecture notes and practice problems',
                    priority: avg < 40 ? 1 : 2
                });
            }
        });
    }

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    if (recommendations.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-lightbulb me-2"></i>
                <strong>Looking Good!</strong> No specific recommendations at this time.
            </div>
        `;
        return;
    }

    const html = `
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">
                    <i class="bi bi-lightbulb-fill me-2"></i>
                    💡 Recommended Actions
                </h5>
            </div>
            <div class="card-body">
                <div class="list-group list-group-flush">
                    ${recommendations.map((rec, index) => `
                        <div class="list-group-item px-0">
                            <div class="d-flex align-items-start">
                                <div class="me-3">
                                    <div class="rounded-circle bg-${rec.color} text-white" 
                                         style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                                        <i class="bi bi-${rec.icon}"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1">
                                    <h6 class="mb-1">${index + 1}. ${rec.title}</h6>
                                    <p class="text-muted mb-1 small">${rec.reason}</p>
                                    <p class="mb-0">
                                        <i class="bi bi-arrow-right-circle text-${rec.color} me-1"></i>
                                        <strong>${rec.action}</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// 🎯 3. GOAL TRACKER
function renderGoalTracker(data) {
    const container = document.getElementById("goalTrackerContent");
    if (!container) return;

    if (!data.scores || data.scores.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No assessment data available</p>';
        return;
    }

    const currentAvg = data.scores.reduce((sum, s) => sum + Number(s.score), 0) / data.scores.length;

    const goals = [
        { name: 'Pass All Modules', target: 40, current: currentAvg, icon: 'check-circle' },
        { name: 'Achieve Merit', target: 60, current: currentAvg, icon: 'star' },
        { name: 'Achieve Distinction', target: 80, current: currentAvg, icon: 'trophy' }
    ];

    const html = goals.map(goal => {
        const achieved = goal.current >= goal.target;

        // 🔧 FIX: Calculate progress correctly - don't cap at 100 here
        const rawProgress = (goal.current / goal.target) * 100;
        const displayProgress = Math.min(rawProgress, 100); // Only cap for display

        // 🔧 FIX: Choose color based on achievement, not progress
        let color;
        if (achieved) {
            color = 'success'; // Green if achieved
        } else if (goal.current >= goal.target * 0.75) {
            color = 'info'; // Blue if 75%+ of the way
        } else if (goal.current >= goal.target * 0.5) {
            color = 'warning'; // Yellow if 50%+ of the way
        } else {
            color = 'danger'; // Red if below 50%
        }

        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <i class="bi bi-${goal.icon} text-${color} me-2"></i>
                        <strong>${goal.name}</strong>
                        ${achieved ? '<span class="badge bg-success ms-2">✓ Achieved!</span>' : ''}
                    </div>
                    <span class="badge bg-${color}">${goal.current.toFixed(1)}% / ${goal.target}%</span>
                </div>
                <div class="progress" style="height: 20px;">
                    <div class="progress-bar bg-${color}" 
                         style="width: ${displayProgress}%" 
                         role="progressbar"
                         aria-valuenow="${displayProgress}" 
                         aria-valuemin="0" 
                         aria-valuemax="100">
                        ${displayProgress >= 100 ? '✓ Complete' : displayProgress.toFixed(0) + '%'}
                    </div>
                </div>
                ${!achieved ? `
                    <small class="text-muted mt-1 d-block">
                        <i class="bi bi-arrow-up-right me-1"></i>
                        Need ${(goal.target - goal.current).toFixed(1)}% more to reach this goal
                    </small>
                ` : `
                    <small class="text-success mt-1 d-block">
                        <i class="bi bi-check-circle me-1"></i>
                        Exceeded by ${(goal.current - goal.target).toFixed(1)}%
                    </small>
                `}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// 🧮 4. WHAT-IF CALCULATOR
function renderWhatIfCalculator(data) {
    const container = document.getElementById("whatIfCalculatorContent");
    if (!container) return;

    const modules = data.assessments
        ? [...new Set(data.assessments.map(a => a.code_module))]
        : [];

    const html = `
        <p class="text-muted mb-3">
            <i class="bi bi-info-circle me-2"></i>
            Use this calculator to see how future scores will affect your final grade
        </p>
        
        <div class="row g-3">
            <div class="col-md-6">
                <label class="form-label"><strong>Select Module:</strong></label>
                <select class="form-select" id="calcModule" onchange="updateWhatIfPrediction()">
                    <option value="">-- Choose a module --</option>
                    ${modules.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
            </div>
            
            <div class="col-md-6">
                <label class="form-label"><strong>Predicted Next Score (%):</strong></label>
                <input type="range" class="form-range" min="0" max="100" value="70" 
                       id="calcScore" oninput="updateWhatIfPrediction()">
                <div class="text-center">
                    <span class="badge bg-primary" style="font-size: 1.2rem;" id="calcScoreDisplay">70%</span>
                </div>
            </div>
        </div>
        
        <div id="calcResult" class="mt-4"></div>
    `;

    container.innerHTML = html;
    window.studentData = data; // Store for calculator
}

// Helper function for calculator
function updateWhatIfPrediction() {
    const module = document.getElementById('calcModule')?.value;
    const score = document.getElementById('calcScore')?.value;
    const scoreDisplay = document.getElementById('calcScoreDisplay');
    const resultDiv = document.getElementById('calcResult');

    if (scoreDisplay) scoreDisplay.textContent = score + '%';
    if (!module || !resultDiv) return;

    const data = window.studentData;
    if (!data) return;

    const moduleScores = data.scores.filter(s => s.code_module === module);
    if (moduleScores.length === 0) return;

    const currentAvg = moduleScores.reduce((sum, s) => sum + Number(s.score), 0) / moduleScores.length;
    const predictedAvg = (currentAvg + Number(score)) / 2;

    const passStatus = predictedAvg >= 80 ? 'Distinction' :
        predictedAvg >= 60 ? 'Merit' :
            predictedAvg >= 40 ? 'Pass' : 'Fail';

    const color = predictedAvg >= 80 ? 'primary' :
        predictedAvg >= 60 ? 'info' :
            predictedAvg >= 40 ? 'success' : 'danger';

    resultDiv.innerHTML = `
        <div class="alert alert-${color}">
            <h5 class="mb-3">📊 Prediction for ${module}:</h5>
            <div class="row text-center">
                <div class="col-md-4">
                    <div class="mb-2">Current Average</div>
                    <div class="display-6">${currentAvg.toFixed(1)}%</div>
                </div>
                <div class="col-md-4">
                    <div class="mb-2">Predicted Average</div>
                    <div class="display-6 text-${color}">${predictedAvg.toFixed(1)}%</div>
                </div>
                <div class="col-md-4">
                    <div class="mb-2">Status</div>
                    <div class="display-6">
                        <span class="badge bg-${color}">${passStatus}</span>
                    </div>
                </div>
            </div>
            <hr>
            <p class="mb-0 text-center">
                ${predictedAvg >= 40
            ? `<i class="bi bi-check-circle me-2"></i>Great! You're on track to pass ${module}!`
            : `<i class="bi bi-exclamation-triangle me-2"></i>You need to score higher to pass.`
        }
            </p>
        </div>
    `;
}

function generateAdaptiveRecommendations(data) {
    const trend = calculateTrend(data.scores);

    if (trend === 'declining') {
        // Reduce challenge
        return "Consider seeking tutoring support";
    } else if (trend === 'improving') {
        // Increase challenge
        return "You're doing great! Try tackling advanced problems";
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getColorForModule(module) {
    const colors = {
        'AAA': '#0d6efd',
        'BBB': '#6610f2',
        'CCC': '#6f42c1',
        'DDD': '#d63384',
        'EEE': '#dc3545',
        'FFF': '#fd7e14',
        'GGG': '#198754'
    };
    return colors[module] || '#6c757d';
}
// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener("DOMContentLoaded", function () {
    const studentId = new URLSearchParams(window.location.search).get("id") || "11391";
    loadStudentData(studentId);
});

// ============================================
// LECTURER DASHBOAD
// ============================================
let classChartInstance = null;
let currentRiskStudents = [];
let allStudentScores = [];
let participationChartInstance = null;
let materialUsageChartInstance = null;
let currentModuleCode = null;
let currentRiskFilter = 'all';
let currentFilteredStudents = [];
let sortDirection = { id: "asc", score: "asc" };

async function loadLecturerData(moduleCode) {
    if (!moduleCode) {
        moduleCode = document.getElementById("module").value;
    }

    currentModuleCode = moduleCode;

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

        console.log('📊 Lecturer data received:', data);

        renderLecturerSummary(data);
        renderClassPerformance(data.scores, moduleCode);
        renderRiskStudents(data.scores);
        renderParticipationTrends(data.trends);
        renderModuleDeadlinesEnhanced(data, moduleCode);
        renderEngagementWarningsEnhanced(data, moduleCode);
        renderMaterialUsageEnhanced(data, moduleCode);
        renderTimeAnalysisEnhanced(data, moduleCode);

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
    allStudentScores = data.scores;
    const totalStudents = Array.isArray(data.students) ? data.students.length : data.students;
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // Update Total Students
    document.getElementById("totalStudents").innerText = totalStudents;

    // Update Average Score
    document.getElementById("avgClassScore").innerText = avgScore.toFixed(2) + "%";

    // Update Performance Badge
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

    // NEW: Update At-Risk Students Card
    const atRiskStudents = scores.filter(s => s < 40);
    const criticalStudents = scores.filter(s => s < 30);
    const moderateStudents = scores.filter(s => s >= 30 && s < 40);

    document.getElementById("atRiskCount").innerText = atRiskStudents.length;
    document.getElementById("criticalCount").innerText = criticalStudents.length;
    document.getElementById("moderateCount").innerText = moderateStudents.length;

    // NEW: Update Top Performers Count
    const topPerformers = scores.filter(s => s >= 70);
    document.getElementById("topPerformersCount").innerText = topPerformers.length;
}  // ← This closes renderLecturerSummary

function drillDownAtRisk() {
    if (!allStudentScores || allStudentScores.length === 0) {
        alert('Please load a module first');
        return;
    }

    // Show the hidden sections with smooth reveal (Risk + Engagement focus)
    const sectionsToReveal = ['risk', 'engagement', 'participation', 'materials', 'timeanalysis'];

    sectionsToReveal.forEach((sectionId, index) => {
        const section = document.getElementById(sectionId);
        if (section) {
            setTimeout(() => {
                section.style.display = 'block';
                section.style.opacity = '0';
                section.style.transform = 'translateY(20px)';
                section.style.transition = 'all 0.5s ease';

                // Show close button
                const closeBtn = document.getElementById(`close${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);
                if (closeBtn) closeBtn.style.display = 'inline-block';

                setTimeout(() => {
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                }, 50);
            }, index * 150);
        }
    });

    // Filter to show all at-risk students
    filterRiskLevel('all');
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
    currentRiskFilter = 'all';
    filterRiskLevel('all');
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

function renderModuleDeadlinesEnhanced(data, moduleCode) {
    const container = document.getElementById("moduleDeadlines");
    if (!container) return;

    const assessments = generateModuleAssessments(moduleCode, data);
    const currentDay = data.scores && data.scores.length > 0
        ? Math.max(...data.scores.map(s => Number(s.date_submitted || 0))) + 5
        : 50;

    let totalStudents = 50;
    if (typeof data.students === 'number') {
        totalStudents = data.students;
    } else if (Array.isArray(data.students)) {
        totalStudents = data.students.length;
    } else if (data.scores && data.scores.length > 0) {
        totalStudents = new Set(data.scores.map(s => s.id_student)).size;
    }

    const getSubmissionCount = (assessment, currentDay, totalStudents) => {
        const daysUntilDue = assessment.date - currentDay;
        if (daysUntilDue > 20) {
            return Math.floor(totalStudents * (Math.random() * 0.2));
        } else if (daysUntilDue > 10) {
            return Math.floor(totalStudents * (0.2 + Math.random() * 0.3));
        } else if (daysUntilDue > 3) {
            return Math.floor(totalStudents * (0.5 + Math.random() * 0.25));
        } else if (daysUntilDue > 0) {
            return Math.floor(totalStudents * (0.75 + Math.random() * 0.15));
        } else if (daysUntilDue >= -3) {
            return Math.floor(totalStudents * (0.85 + Math.random() * 0.1));
        } else {
            return Math.floor(totalStudents * (0.9 + Math.random() * 0.08));
        }
    };

    const upcoming = assessments.filter(a => a.date > currentDay);
    const past = assessments.filter(a => a.date <= currentDay);

    let html = '<div class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">';

    if (upcoming.length > 0) {
        html += '<div class="fw-bold text-warning p-2 bg-light"><i class="bi bi-clock me-2"></i>Upcoming Deadlines</div>';
        upcoming.slice(0, 5).forEach(assessment => {
            const daysLeft = assessment.date - currentDay;
            const urgencyClass = daysLeft < 3 ? 'danger' : daysLeft < 7 ? 'warning' : 'success';
            const submitted = getSubmissionCount(assessment, currentDay, totalStudents);
            const submissionRate = totalStudents > 0 ? ((submitted / totalStudents) * 100).toFixed(0) : 0;

            let statusMessage = '';
            if (submissionRate < 30) {
                statusMessage = '<small class="text-muted d-block mt-1">⏳ Early stage</small>';
            } else if (submissionRate < 60) {
                statusMessage = '<small class="text-info d-block mt-1">📈 Submissions increasing</small>';
            } else if (submissionRate < 80) {
                statusMessage = '<small class="text-success d-block mt-1">✅ Good progress</small>';
            }

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <strong>${assessment.type}</strong>
                            <span class="badge bg-secondary ms-2">${assessment.weight}%</span>
                            <br>
                            <small class="text-muted">Due: Day ${assessment.date}</small>
                            ${statusMessage}
                        </div>
                        <span class="badge bg-${urgencyClass} rounded-pill">${daysLeft} days left</span>
                    </div>
                    <div class="progress" style="height: 22px;">
                        <div class="progress-bar ${submissionRate >= 80 ? 'bg-success' : submissionRate >= 50 ? 'bg-warning' : 'bg-danger'}" 
                             style="width: ${submissionRate}%" 
                             role="progressbar">
                            ${submitted}/${totalStudents} (${submissionRate}%)
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        html += `
            <div class="alert alert-success mb-0">
                <i class="bi bi-check-circle me-2"></i>
                No upcoming deadlines - all assessments completed!
            </div>
        `;
    }

    if (past.length > 0) {
        html += '<div class="fw-bold text-muted p-2 bg-light mt-2"><i class="bi bi-check-circle me-2"></i>Recent Assessments</div>';
        past.slice(-3).forEach(assessment => {
            const submitted = getSubmissionCount(assessment, currentDay, totalStudents);
            const submissionRate = totalStudents > 0 ? ((submitted / totalStudents) * 100).toFixed(0) : 0;
            const missing = totalStudents - submitted;

            let warningBadge = '';
            if (missing > totalStudents * 0.2) {
                warningBadge = `<span class="badge bg-danger ms-2">${missing} missing</span>`;
            }

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <strong>${assessment.type}</strong>
                            <span class="badge bg-secondary ms-2">${assessment.weight}%</span>
                            ${warningBadge}
                            <br>
                            <small class="text-muted">Completed: Day ${assessment.date}</small>
                        </div>
                        <span class="badge ${submissionRate >= 90 ? 'bg-success' : submissionRate >= 75 ? 'bg-info' : 'bg-warning'}">
                            ${submissionRate}%
                        </span>
                    </div>
                    <div class="progress mt-2" style="height: 8px;">
                        <div class="progress-bar ${submissionRate >= 90 ? 'bg-success' : submissionRate >= 75 ? 'bg-info' : 'bg-warning'}" 
                             style="width: ${submissionRate}%" 
                             role="progressbar">
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderEngagementWarningsEnhanced(data, moduleCode) {
    const container = document.getElementById("engagementWarnings");
    if (!container) return;

    if (!data.trends || data.trends.length === 0) {
        container.innerHTML = `
            <div class="alert alert-warning mb-0">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>No engagement data available</strong>
                <p class="mb-0 small mt-2">VLE interaction data will appear here</p>
            </div>`;
        return;
    }

    const recentTrends = data.trends.slice(-5);
    const avgRecentClicks = recentTrends.reduce((sum, t) => sum + t.clicks, 0) / recentTrends.length;
    const totalClicks = data.trends.reduce((sum, t) => sum + t.clicks, 0);
    const avgOverall = totalClicks / data.trends.length;

    const declining = avgRecentClicks < avgOverall * 0.7;
    const lowOverall = avgOverall < 30;

    const failingCount = data.scores ? data.scores.filter(s => s.score < 40).length : 0;
    const totalStudents = data.students || 50;
    const highRiskPercent = ((failingCount / totalStudents) * 100).toFixed(0);

    let html = '';

    if (failingCount > 0 && failingCount >= totalStudents * 0.2) {
        html += `
            <div class="alert alert-danger d-flex align-items-start mb-3">
                <i class="bi bi-exclamation-triangle-fill fs-3 me-3"></i>
                <div class="flex-grow-1">
                    <strong class="d-block mb-1">🚨 CRITICAL: ${failingCount} Students Failing</strong>
                    <p class="mb-2 small">${highRiskPercent}% of class below passing grade in ${moduleCode}</p>
                    <button class="btn btn-sm btn-danger" onclick="viewHighRiskStudents()">
                        <i class="bi bi-eye me-1"></i>View Details
                    </button>
                </div>
            </div>
        `;
    }

    if (declining) {
        html += `
            <div class="alert alert-warning d-flex align-items-start mb-3">
                <i class="bi bi-graph-down fs-3 me-3"></i>
                <div class="flex-grow-1">
                    <strong class="d-block mb-1">⚠️ Declining Engagement Detected</strong>
                    <p class="mb-0 small">Recent VLE activity (${avgRecentClicks.toFixed(0)} clicks) is 30% below average</p>
                </div>
            </div>
        `;
    }

    if (lowOverall) {
        html += `
            <div class="alert alert-info d-flex align-items-start mb-3">
                <i class="bi bi-info-circle fs-3 me-3"></i>
                <div class="flex-grow-1">
                    <strong class="d-block mb-1">ℹ️ Low Overall Engagement</strong>
                    <p class="mb-0 small">Average ${avgOverall.toFixed(0)} clicks per day. Consider adding interactive content.</p>
                </div>
            </div>
        `;
    }

    if (html === '') {
        html = `
            <div class="alert alert-success d-flex align-items-center mb-0">
                <i class="bi bi-check-circle-fill fs-3 me-3"></i>
                <div>
                    <strong class="d-block mb-1">✅ Healthy Engagement!</strong>
                    <p class="mb-0 small">No major concerns in ${moduleCode}</p>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderMaterialUsageEnhanced(data, moduleCode) {
    const container = document.getElementById("materialUsageChart");
    if (!container) return;

    if (!data.trends || data.trends.length === 0) {
        container.parentElement.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-file-earmark-bar-graph fs-1 d-block mb-3"></i>
                <p class="mb-2">No material usage data available</p>
                <small class="text-muted">Chart will appear when students access ${moduleCode} materials</small>
            </div>
        `;
        return;
    }

    const ctx = container.getContext('2d');

    const materials = [
        'Course Overview', 'Lecture Notes', 'Video Lectures', 'Practice Problems',
        'Discussion Forum', 'Quiz', 'Assignment Brief', 'Reading Materials',
        'Lab Instructions', 'Past Papers'
    ];

    const totalClicks = data.trends.reduce((sum, t) => sum + t.clicks, 0);
    const materialClicks = materials.map((name, i) => ({
        name: name,
        clicks: Math.floor(totalClicks / materials.length * (0.5 + Math.random() * 1.5))
    }));

    materialClicks.sort((a, b) => b.clicks - a.clicks);
    const top10 = materialClicks.slice(0, 10);

    if (materialUsageChartInstance) {
        materialUsageChartInstance.destroy();
    }

    materialUsageChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(m => m.name),
            datasets: [{
                label: 'Total Clicks',
                data: top10.map(m => m.clicks),
                backgroundColor: [
                    'rgba(108, 117, 125, 0.8)',
                    'rgba(108, 117, 125, 0.75)',
                    'rgba(108, 117, 125, 0.7)',
                    'rgba(108, 117, 125, 0.65)',
                    'rgba(108, 117, 125, 0.6)',
                    'rgba(108, 117, 125, 0.55)',
                    'rgba(108, 117, 125, 0.5)',
                    'rgba(108, 117, 125, 0.45)',
                    'rgba(108, 117, 125, 0.4)',
                    'rgba(108, 117, 125, 0.35)'
                ],
                borderColor: '#6c757d',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Most Accessed Materials in ${moduleCode}`,
                    font: { size: 14, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Total Clicks' },
                    ticks: { precision: 0 }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function renderTimeAnalysisEnhanced(data, moduleCode) {
    const container = document.getElementById("timeAnalysis");
    if (!container) return;

    if (!data.trends || data.trends.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info mb-0">
                <i class="bi bi-info-circle me-2"></i>
                <strong>No engagement data available</strong>
                <p class="mb-0 small mt-2">Time analysis will appear when students interact with ${moduleCode}</p>
            </div>`;
        return;
    }

    let totalStudents = 50;
    if (typeof data.students === 'number') {
        totalStudents = data.students;
    } else if (Array.isArray(data.students)) {
        totalStudents = data.students.length;
    } else if (data.scores && data.scores.length > 0) {
        totalStudents = new Set(data.scores.map(s => s.id_student)).size;
    }

    const totalClicks = data.trends.reduce((sum, t) => sum + t.clicks, 0);
    const avgClicksPerStudent = totalStudents > 0 ? (totalClicks / totalStudents).toFixed(1) : '0';

    const peakTrend = data.trends.reduce((max, t) => t.clicks > max.clicks ? t : max, data.trends[0]);
    const peakDay = peakTrend.day;

    const avgClicks = totalClicks / data.trends.length;
    const engagementLevel = avgClicks > 50 ? 'High' : avgClicks > 25 ? 'Medium' : 'Low';
    const engagementColor = avgClicks > 50 ? 'success' : avgClicks > 25 ? 'warning' : 'danger';

    container.innerHTML = `
        <div class="row g-3">
            <div class="col-md-6">
                <div class="card border-0 bg-light h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-mouse fs-1 text-primary mb-2"></i>
                        <h3 class="mb-1">${totalClicks.toLocaleString()}</h3>
                        <small class="text-muted">Total Interactions</small>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-0 bg-light h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-person-check fs-1 text-info mb-2"></i>
                        <h3 class="mb-1">${avgClicksPerStudent}</h3>
                        <small class="text-muted">Avg per Student</small>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-0 bg-light h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-calendar-event fs-1 text-success mb-2"></i>
                        <h3 class="mb-1">Day ${peakDay}</h3>
                        <small class="text-muted">Peak Activity</small>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-0 bg-light h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-speedometer2 fs-1 text-${engagementColor} mb-2"></i>
                        <h3 class="mb-1">${engagementLevel}</h3>
                        <small class="text-muted">Engagement</small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="alert alert-${engagementColor} mt-3 mb-0">
            <i class="bi bi-lightbulb me-2"></i>
            <strong>Insight:</strong> ${avgClicksPerStudent} avg interactions per student in ${moduleCode}.
            ${avgClicks < 25 ? ' 📉 Consider adding more interactive elements.' :
            avgClicks > 50 ? ' 🎉 Excellent engagement!' : ' 📊 Moderate engagement.'}
        </div>
    `;
}

// ============================================
// DRILL-DOWN FUNCTIONS (SHAFFER'S 4 C'S)
// ============================================

function drillDownTotalStudents() {
    if (!allStudentScores || allStudentScores.length === 0) {
        alert('Please load a module first');
        return;
    }

    // FIRST: Reveal participation/engagement sections
    const sectionsToReveal = ['participation', 'materials', 'timeanalysis', 'engagement'];

    sectionsToReveal.forEach((sectionId, index) => {
        const section = document.getElementById(sectionId);
        if (section) {
            setTimeout(() => {
                section.style.display = 'block';
                section.style.opacity = '0';
                section.style.transform = 'translateY(20px)';
                section.style.transition = 'all 0.5s ease';

                // Show close button
                const closeBtn = document.getElementById(`close${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);
                if (closeBtn) closeBtn.style.display = 'inline-block';

                setTimeout(() => {
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                }, 50);
            }, index * 150);
        }
    });

    setTimeout(() => {
        showStudentBreakdownModal();
    }, 800);
}

// NEW: Separate function for student breakdown modal
function showStudentBreakdownModal() {
    const scores = allStudentScores.map(s => Number(s.score));
    const categories = {
        'Distinction (80-100%)': scores.filter(s => s >= 80).length,
        'Merit (60-79%)': scores.filter(s => s >= 60 && s < 80).length,
        'Pass (40-59%)': scores.filter(s => s >= 40 && s < 60).length,
        'Fail (0-39%)': scores.filter(s => s < 40).length
    };

    const modal = createDrillDownModal(`${currentModuleCode} - Student Performance Breakdown`, `
        <div class="alert alert-primary mb-3">
            <strong>Module: ${currentModuleCode}</strong> | Total Students: ${allStudentScores.length}
        </div>
        <div class="row g-3">
            ${Object.entries(categories).map(([name, count]) => {
        const percentage = ((count / scores.length) * 100).toFixed(1);
        let bgColor, borderColor, iconColor;

        if (name.includes('Distinction')) {
            bgColor = '#d1e7dd';
            borderColor = '#198754';
            iconColor = '#198754';
        } else if (name.includes('Merit')) {
            bgColor = '#cfe2ff';
            borderColor = '#0d6efd';
            iconColor = '#0d6efd';
        } else if (name.includes('Pass')) {
            bgColor = '#fff3cd';
            borderColor = '#ffc107';
            iconColor = '#ffc107';
        } else {
            bgColor = '#f8d7da';
            borderColor = '#dc3545';
            iconColor = '#dc3545';
        }

        return `
                    <div class="col-md-6">
                        <div class="card h-100" style="border: 2px solid ${borderColor}; background-color: ${bgColor};">
                            <div class="card-body text-center">
                                <h5 style="color: ${iconColor};">${name}</h5>
                                <h2 class="display-4" style="color: ${iconColor};">${count}</h2>
                                <p class="text-muted mb-0">${percentage}% of class</p>
                                <div class="progress mt-2" style="height: 8px;">
                                    <div class="progress-bar" style="width: ${percentage}%; background-color: ${iconColor};"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
        <div class="alert alert-info mt-3 mb-0">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Teaching Insight for ${currentModuleCode}:</strong> ${categories['Fail (0-39%)'] > scores.length * 0.2 ?
            'High failure rate detected. Consider review sessions or additional support materials.' :
            'Performance distribution is healthy. Continue current teaching approach.'}
        </div>
    `);

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

function drillDownClassScore() {
    if (!allStudentScores || allStudentScores.length === 0) {
        alert('Please load a module first');
        return;
    }

    // FIRST: Reveal sections with animation (Performance storyline ONLY)
    const sectionsToReveal = ['risk', 'deadlines'];

    sectionsToReveal.forEach((sectionId, index) => {
        const section = document.getElementById(sectionId);
        if (section) {
            setTimeout(() => {
                section.style.display = 'block';
                section.style.opacity = '0';
                section.style.transform = 'translateY(20px)';
                section.style.transition = 'all 0.5s ease';

                // Show close button
                const closeBtn = document.getElementById(`close${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);
                if (closeBtn) closeBtn.style.display = 'inline-block';

                setTimeout(() => {
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                }, 50);
            }, index * 150);
        }
    });

    setTimeout(() => {
        showPerformanceModal();
    }, 800);
}

// NEW: Separate function for the detailed modal
function showPerformanceModal() {
    const topPerformers = [...allStudentScores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    const atRiskStudents = [...allStudentScores]
        .filter(s => Number(s.score) < 40)
        .sort((a, b) => a.score - b.score);

    const avgScore = allStudentScores.reduce((sum, s) => sum + Number(s.score), 0) / allStudentScores.length;

    const modal = createDrillDownModal(`${currentModuleCode} - Performance Deep Dive`, `
        <div class="alert alert-primary mb-3">
            <strong>Module: ${currentModuleCode}</strong> | 
            Class Average: ${avgScore.toFixed(1)}% | 
            Total Students: ${allStudentScores.length}
        </div>
        <div class="row g-4">
            <div class="col-md-6">
                <div class="card border-success h-100">
                    <div class="card-header" style="background-color: #198754; color: white;">
                        <i class="bi bi-trophy me-2"></i>
                        <strong>Top 10 Performers in ${currentModuleCode}</strong>
                        <small class="d-block mt-1">Learn from their success patterns</small>
                    </div>
                    <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                        <div class="list-group list-group-flush">
                            ${topPerformers.map((s, idx) => {
        const score = Number(s.score);
        const bgColor = score >= 80 ? '#d1e7dd' : score >= 60 ? '#cfe2ff' : '#fff3cd';
        const textColor = score >= 80 ? '#198754' : score >= 60 ? '#0d6efd' : '#ffc107';
        return `
                                <div class="list-group-item d-flex justify-content-between align-items-center" style="background-color: ${bgColor};">
                                    <div>
                                        <span class="badge me-2" style="background-color: ${textColor};">#${idx + 1}</span>
                                        <strong>${s.id_student}</strong>
                                    </div>
                                    <span class="badge rounded-pill" style="background-color: ${textColor};">${s.score}%</span>
                                </div>
                            `}).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card border-danger h-100">
                    <div class="card-header" style="background-color: #dc3545; color: white;">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>At-Risk Students (${atRiskStudents.length})</strong>
                        <small class="d-block mt-1">Require immediate intervention</small>
                    </div>
                    <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                        ${atRiskStudents.length > 0 ? `
                            <div class="list-group list-group-flush">
                                ${atRiskStudents.map(s => {
            const score = Number(s.score);
            const isCritical = score < 30;
            const bgColor = isCritical ? '#f8d7da' : '#ffe5d0';
            const badgeColor = isCritical ? '#dc3545' : '#fd7e14';
            const label = isCritical ? 'CRITICAL' : 'MODERATE';

            return `
                                    <div class="list-group-item d-flex justify-content-between align-items-center" style="background-color: ${bgColor};">
                                        <div>
                                            <strong>${s.id_student}</strong>
                                            <span class="badge ms-2" style="background-color: ${badgeColor};">${label}</span>
                                        </div>
                                        <span class="badge rounded-pill" style="background-color: ${badgeColor};">${s.score}%</span>
                                    </div>
                                `;
        }).join('')}
                            </div>
                            <div class="alert alert-warning mt-3 mb-0">
                                <i class="bi bi-lightbulb me-2"></i>
                                <strong>Recommended Actions for ${currentModuleCode}:</strong>
                                <ul class="mb-0 mt-2">
                                    <li>Schedule 1-on-1 consultations</li>
                                    <li>Provide supplementary materials</li>
                                    <li>Enable peer mentoring programs</li>
                                </ul>
                            </div>
                        ` : `
                            <div class="alert alert-success mb-0">
                                <i class="bi bi-check-circle me-2"></i>
                                No students at risk in ${currentModuleCode}! Excellent class performance.
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>

        <div class="alert alert-info mt-3 mb-0">
            <i class="bi bi-graph-up me-2"></i>
            <strong>${currentModuleCode} Statistics:</strong>
            ${topPerformers.length} top performers | 
            ${atRiskStudents.length} need support | 
            ${((atRiskStudents.length / allStudentScores.length) * 100).toFixed(0)}% at risk
        </div>
    `);

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

function drillDownTopPerformers() {
    if (!allStudentScores || allStudentScores.length === 0) {
        alert('Please load a module first');
        return;
    }

    // USE ONLY CURRENT MODULE DATA
    const highPerformers = [...allStudentScores]
        .filter(s => Number(s.score) >= 70)
        .sort((a, b) => b.score - a.score);

    const modal = createDrillDownModal(`${currentModuleCode} - High Performers (${highPerformers.length} students)`, `
        <div class="alert alert-primary mb-3">
            <strong>Module: ${currentModuleCode}</strong> | 
            High Performers (70%+): ${highPerformers.length} out of ${allStudentScores.length} students
        </div>
        <div class="card" style="border: 2px solid #198754;">
            <div class="card-header" style="background-color: #198754; color: white;">
                <i class="bi bi-stars me-2"></i>
                <strong>Students Scoring 70% and Above in ${currentModuleCode}</strong>
                <small class="d-block mt-1">Potential peer mentors and teaching assistants</small>
            </div>
            <div class="card-body" style="max-height: 500px; overflow-y: auto;">
                ${highPerformers.length > 0 ? `
                    <div class="row g-2">
                        ${highPerformers.map(s => {
        const score = Number(s.score);
        // Use shades of GREEN only (consistent colors)
        let bgColor, badgeColor, intensity;

        if (score >= 90) {
            bgColor = '#d1e7dd';  // Light green
            badgeColor = '#198754'; // Dark green
            intensity = 'Exceptional';
        } else if (score >= 80) {
            bgColor = '#d1e7dd';  // Light green
            badgeColor = '#20c997'; // Medium green
            intensity = 'Excellent';
        } else {
            bgColor = '#e7f5ec';  // Very light green
            badgeColor = '#28a745'; // Standard green
            intensity = 'Good';
        }

        return `
                            <div class="col-md-6">
                                <div class="card mb-2" style="border: 1px solid ${badgeColor}; background-color: ${bgColor};">
                                    <div class="card-body p-2 d-flex justify-content-between align-items-center">
                                        <div>
                                            <i class="bi bi-award me-2" style="color: ${badgeColor};"></i>
                                            <strong>${s.id_student}</strong>
                                            <small class="d-block text-muted">${intensity}</small>
                                        </div>
                                        <span class="badge" style="background-color: ${badgeColor};">${s.score}%</span>
                                    </div>
                                </div>
                            </div>
                        `;
    }).join('')}
                    </div>
                    <div class="alert alert-success mt-3 mb-0">
                        <i class="bi bi-lightbulb me-2"></i>
                        <strong>Engagement Ideas for ${currentModuleCode}:</strong>
                        <ul class="mb-0 mt-2">
                            <li>Invite top students to mentor struggling peers</li>
                            <li>Feature their work as exemplars</li>
                            <li>Offer advanced enrichment activities</li>
                        </ul>
                    </div>
                ` : `
                    <div class="alert alert-warning mb-0">
                        No students currently scoring above 70% in ${currentModuleCode}. Consider reviewing assessment difficulty.
                    </div>
                `}
            </div>
        </div>
    `);

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

// Function to collapse/hide sections
function collapseSection(sectionId) {
    const section = document.getElementById(sectionId);
    const closeBtn = document.getElementById(`close${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);

    if (section) {
        section.style.transition = 'all 0.3s ease';
        section.style.opacity = '0';
        section.style.transform = 'translateY(-20px)';

        setTimeout(() => {
            section.style.display = 'none';
            if (closeBtn) closeBtn.style.display = 'none';
        }, 300);
    }
}

// Make it globally available
window.collapseSection = collapseSection;

// ============================================
// EXPORT FUNCTIONS
// ============================================
function exportModuleToExcel() {
    if (!currentModuleCode) {
        alert('Please select a module first');
        return;
    }
    const data = {
        module: currentModuleCode,
        totalStudents: document.getElementById("totalStudents")?.textContent || 0,
        avgScore: document.getElementById("avgClassScore")?.textContent || '0%',
        atRiskCount: currentRiskStudents.length,
        timestamp: new Date().toLocaleString()
    };

    let csv = `Module Performance Report\n\n`;
    csv += `Module Code,${data.module}\n`;
    csv += `Total Students,${data.totalStudents}\n`;
    csv += `Average Score,${data.avgScore}\n`;
    csv += `At-Risk Students,${data.atRiskCount}\n`;
    csv += `Generated,${data.timestamp}\n\n`;

    csv += `\nAt-Risk Students (Score < 40%)\n`;
    csv += `Student ID,Score,Status\n`;
    currentRiskStudents.forEach(s => {
        csv += `${s.id_student},${s.score}%,At Risk\n`;
    });

    downloadCSV(csv, `${currentModuleCode}_Report_${Date.now()}.csv`);
}
function exportAttendanceReport() {
    if (!currentModuleCode) {
        alert('Please select a module first');
        return;
    }
    let csv = `Attendance Report - ${currentModuleCode}\n\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;
    csv += `Student ID,Status,Last Active\n`;
    csv += `Sample attendance data - integrate with your VLE logs\n`;

    downloadCSV(csv, `${currentModuleCode}_Attendance_${Date.now()}.csv`);
}
function viewTeachingLog() {
    const logContainer = document.getElementById("teachingLog");
    if (!logContainer) return;
    const isVisible = logContainer.style.display !== 'none';
    logContainer.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        const tbody = document.getElementById("teachingLogTable");
        if (tbody) {
            tbody.innerHTML = `
            <tr>
                <td>2024-11-01</td>
                <td><span class="badge bg-primary">Uploaded Materials</span></td>
                <td>Week 5 lecture notes for ${currentModuleCode}</td>
            </tr>
            <tr>
                <td>2024-11-03</td>
                <td><span class="badge bg-success">Graded Assessment</span></td>
                <td>TMA 2 - ${currentRiskStudents.length} students</td>
            </tr>
            <tr>
                <td>2024-11-05</td>
                <td><span class="badge bg-info">Updated Content</span></td>
                <td>Added practice problems</td>
            </tr>
            <tr>
                <td>2024-11-07</td>
                <td><span class="badge bg-warning">Sent Notification</span></td>
                <td>Reminder for upcoming deadline</td>
            </tr>
        `;
        }
    }
}
function viewHighRiskStudents() {
    const riskSection = document.getElementById("risk");
    if (riskSection) {
        riskSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        riskSection.style.transition = 'background-color 0.3s ease';
        riskSection.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
        setTimeout(() => {
            riskSection.style.backgroundColor = '';
        }, 2000);
    }
}
function generateModuleAssessments(moduleCode, data) {
    const currentDay = data.scores && data.scores.length > 0
        ? Math.max(...data.scores.map(s => Number(s.date_submitted || 0))) + 5
        : 50;
    return [
        { id: `${moduleCode}_TMA1`, type: 'TMA 1', date: Math.max(10, currentDay - 30), weight: 15 },
        { id: `${moduleCode}_TMA2`, type: 'TMA 2', date: currentDay + 10, weight: 15 },
        { id: `${moduleCode}_CMA`, type: 'Computer Marked Assessment', date: currentDay + 30, weight: 20 },
        { id: `${moduleCode}_TMA3`, type: 'TMA 3', date: currentDay + 50, weight: 15 },
        { id: `${moduleCode}_EXAM`, type: 'Final Exam', date: currentDay + 75, weight: 35 }
    ];
}
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function filterRiskLevel(level) {
    if (!currentRiskStudents || currentRiskStudents.length === 0) {
        return;
    }

    currentRiskFilter = level;

    ['riskAll', 'riskCritical', 'riskModerate'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('active', 'btn-danger', 'btn-warning');
            btn.classList.add('btn-light');
        }
    });

    const activeBtn = document.getElementById(`risk${level.charAt(0).toUpperCase() + level.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.remove('btn-light');
        if (level === 'critical') {
            activeBtn.classList.add('btn-danger', 'active');
        } else if (level === 'moderate') {
            activeBtn.classList.add('btn-warning', 'active');
        } else {
            activeBtn.classList.add('btn-light', 'active');
        }
    }

    if (level === 'critical') {
        currentFilteredStudents = currentRiskStudents.filter(s => Number(s.score) < 30);
    } else if (level === 'moderate') {
        currentFilteredStudents = currentRiskStudents.filter(s => Number(s.score) >= 30 && Number(s.score) < 40);
    } else {
        currentFilteredStudents = [...currentRiskStudents];
    }

    renderRiskTable(currentFilteredStudents, level);
}

function renderRiskTable(students, filterLevel = 'all') {
    const interventionMessages = {
        'critical': '🚨 URGENT: Immediate 1-on-1 consultation required',
        'moderate': '⚠️ WARNING: Early intervention recommended',
        'all': 'ℹ️ Students requiring support'
    };

    const tableHeader = `
        <tr>
            <th onclick="sortRiskTable('id')" style="cursor: pointer;">
                ID <i class="bi bi-arrow-down-up"></i>
            </th>
            <th onclick="sortRiskTable('score')" style="cursor: pointer;">
                Score <i class="bi bi-arrow-down-up"></i>
            </th>
            <th>Risk Level</th>
        </tr>`;

    const tableRows = students.length > 0 ? students
        .map(s => {
            const score = Number(s.score);
            const isCritical = score < 30;

            // Consistent colors: Red for Critical, Orange for Moderate
            const bgColor = isCritical ? '#f8d7da' : '#ffe5d0';
            const badgeColor = isCritical ? '#dc3545' : '#fd7e14';
            const riskLabel = isCritical ? 'CRITICAL' : 'MODERATE';

            return `
            <tr style="background-color: ${bgColor};">
                <td><strong>${s.id_student}</strong></td>
                <td><span class="badge" style="background-color: ${badgeColor};">${s.score}%</span></td>
                <td><span class="badge" style="background-color: ${badgeColor};">${riskLabel}</span></td>
            </tr>
        `;
        }).join("") :
        `<tr><td colspan="3" class="text-center text-muted py-3">
            <i class="bi bi-check-circle fs-3 text-success d-block mb-2"></i>
            No students in this category
        </td></tr>`;

    const alertColor = filterLevel === 'critical' ? '#dc3545' : (filterLevel === 'moderate' ? '#fd7e14' : '#0d6efd');
    const alertBg = filterLevel === 'critical' ? '#f8d7da' : (filterLevel === 'moderate' ? '#ffe5d0' : '#cfe2ff');

    const message = students.length > 0 ?
        `<div class="alert mb-2" style="background-color: ${alertBg}; border-color: ${alertColor}; color: ${alertColor};">
            ${interventionMessages[filterLevel]}
            <strong class="d-block mt-1">${students.length} student(s) found</strong>
        </div>` : '';

    document.getElementById("riskTable").innerHTML = message + tableHeader + tableRows;
}

function sortRiskTable(by) {
    if (by === "id") {
        currentFilteredStudents.sort((a, b) =>
            sortDirection.id === "asc"
                ? Number(a.id_student) - Number(b.id_student)
                : Number(b.id_student) - Number(a.id_student)
        );
        sortDirection.id = sortDirection.id === "asc" ? "desc" : "asc";
    } else if (by === "score") {
        currentFilteredStudents.sort((a, b) =>
            sortDirection.score === "asc"
                ? Number(a.score) - Number(b.score)
                : Number(b.score) - Number(a.score)
        );
        sortDirection.score = sortDirection.score === "asc" ? "desc" : "asc";
    }
    renderRiskTable(currentFilteredStudents, currentRiskFilter);
}

function createDrillDownModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title">
                        <i class="bi bi-zoom-in me-2"></i>${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    return modal;
}

// Make functions globally available
window.drillDownTotalStudents = drillDownTotalStudents;
window.drillDownClassScore = drillDownClassScore;
window.drillDownTopPerformers = drillDownTopPerformers;
window.drillDownAtRisk = drillDownAtRisk;  // ← ADD THIS LINE
window.filterRiskLevel = filterRiskLevel;
window.sortRiskTable = sortRiskTable;
window.exportModuleToExcel = exportModuleToExcel;
window.exportAttendanceReport = exportAttendanceReport;
window.viewTeachingLog = viewTeachingLog;
window.viewHighRiskStudents = viewHighRiskStudents;
window.loadLecturerData = loadLecturerData;

// ============================================
// ADMIN DASHBOARD - IMPROVED WITH 4C PRINCIPLES
// ============================================
let allStudentsData = [];
let allSubjectsData = [];
let currentPage = 1;
const studentsPerPage = 10;

let coursesData = [];

// Add this function to load courses.csv
async function loadCoursesData() {
    try {
        console.log('📚 Loading courses.csv...');
        const response = await fetch('courses.csv');

        if (!response.ok) {
            console.error('❌ Failed to fetch courses.csv:', response.status, response.statusText);
            return [];
        }

        const csvText = await response.text();
        console.log('✅ CSV loaded, length:', csvText.length);

        // Parse CSV - handle different line endings
        const lines = csvText.split(/\r?\n/);
        const headers = lines[0].split(',').map(h => h.trim());
        console.log('📋 Headers:', headers);

        coursesData = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
                const values = line.split(',').map(v => v.trim());
                return {
                    code_module: values[0],
                    code_presentation: values[1],
                    length: values[2] // ✅ This is the duration column
                };
            })
            .filter(course => course.code_module && course.code_presentation && course.length);

        console.log(`✅ Loaded ${coursesData.length} courses`);
        console.log('📊 Sample course:', coursesData[0]);
        return coursesData;
    } catch (error) {
        console.error("❌ Error loading courses.csv:", error);
        return [];
    }
}

function updateInsightCards(courseData) {
    console.log('🔍 === STARTING INSIGHT CARD ANALYSIS ===');
    console.log('Total courses received:', courseData.length);

    const highWithdrawalList = [];
    const highEngagementList = [];
    const atRiskList = [];
    const othersList = [];

    courseData.forEach(c => {
        if (c.withdrawalRate >= 30) {
            highWithdrawalList.push(c);
            console.log(`  🚨 HIGH WITHDRAWAL: ${c.module}-${c.presentation} = ${c.withdrawalRate}%`);
        }
        else if (c.passRate >= 70 && c.withdrawalRate < 20 && c.avgScore >= 70) {
            highEngagementList.push(c);
            console.log(`  🌟 HIGH ENGAGEMENT: ${c.module}-${c.presentation} - Pass:${c.passRate}%, Withdrawal:${c.withdrawalRate}%, Score:${c.avgScore}`);
        }
        else if (c.withdrawalRate < 30 && (c.passRate < 50 || c.avgScore < 55 || c.withdrawalRate >= 20)) {
            atRiskList.push(c);
            console.log(`  ⚠️ NEEDS ATTENTION: ${c.module}-${c.presentation} - Pass:${c.passRate}%, Score:${c.avgScore}, Withdrawal:${c.withdrawalRate}%`);
        }
        else {
            othersList.push(c);
            console.log(`  ✅ PERFORMING WELL: ${c.module}-${c.presentation} - Pass:${c.passRate}%, Score:${c.avgScore}, Withdrawal:${c.withdrawalRate}%`);
        }
    });

    const highWithdrawalCount = highWithdrawalList.length;
    const highEngagementCount = highEngagementList.length;
    const atRiskCount = atRiskList.length;
    const othersCount = othersList.length;

    console.log(`📊 === FINAL COUNTS ===`);
    console.log(`   High Withdrawal: ${highWithdrawalCount}`);
    console.log(`   High Engagement: ${highEngagementCount}`);
    console.log(`   Needs Attention: ${atRiskCount}`);
    console.log(`   Performing Well: ${othersCount}`);
    console.log(`   TOTAL: ${courseData.length}`);

    const calculatedTotal = highWithdrawalCount + highEngagementCount + atRiskCount + othersCount;
    if (calculatedTotal !== courseData.length) {
        console.error(`❌ MISMATCH! Calculated: ${calculatedTotal}, Expected: ${courseData.length}`);
    }

    // Update all 4 cards
    const highWithdrawalCard = document.getElementById('highWithdrawalCoursesCard');
    const highEngagementCard = document.getElementById('highEngagementCoursesCard');
    const atRiskCard = document.getElementById('atRiskCoursesCard');
    const performingWellCard = document.getElementById('performingWellCoursesCard');

    if (highWithdrawalCard) highWithdrawalCard.textContent = highWithdrawalCount;
    if (highEngagementCard) highEngagementCard.textContent = highEngagementCount;
    if (atRiskCard) atRiskCard.textContent = atRiskCount;
    if (performingWellCard) performingWellCard.textContent = othersCount;

    console.log('🔍 === INSIGHT CARD ANALYSIS COMPLETE ===');
}

async function loadAdminData() {
    try {
        // ✅ CRITICAL: Load courses data FIRST and WAIT for it
        coursesData = await loadCoursesData();
        console.log('📊 Courses loaded:', coursesData.length, 'courses');

        if (coursesData.length === 0) {
            console.error('❌ CRITICAL: No courses data loaded! Check courses.csv path');
        }

        const res = await fetch("/api/admin");
        const data = await res.json();
        console.log('📡 Admin API data received');

        if (!data.subjects && data.enrolments) {
            console.log('🔧 Generating subjects from enrollments with courses data...');
            allSubjectsData = generateSubjectsFromEnrolments(data.enrolments, coursesData);
            console.log('✅ Generated subjects:', allSubjectsData.length);
            console.log('📋 Sample subject:', allSubjectsData[0]);
        } else {
            allSubjectsData = data.subjects || [];
        }

        const outcomes = data.outcomes || {};
        const totalStudents = Object.values(outcomes).reduce((a, b) => a + b, 0);

        if (!data.students) {
            allStudentsData = generateAllStudents(outcomes);
        } else {
            allStudentsData = data.students;
        }

        const atRiskData = calculateAtRiskMetrics(data, allStudentsData);

        // ✅ GENERATE courseData ONCE with CONSISTENT random values
        const enrolments = data.enrolments || {};
        const courseData = Object.entries(enrolments).map(([course, count]) => {
            let parts = course.includes('_') ? course.split('_') : course.split('-');
            const module = parts[0] || 'Unknown';
            const presentation = parts[1] || 'Unknown';

            // Generate CONSISTENT percentages that add up to 100%
            const withdrawalRate = Math.floor(Math.random() * 36) + 5; // 5-40%
            const remaining = 100 - withdrawalRate;
            const passOfRemaining = Math.floor(Math.random() * 46) + 40; // 40-85%
            let passRate = Math.floor((remaining * passOfRemaining) / 100);
            let failRate = remaining - passRate;

            // Ensure they add up to exactly 100%
            const total = passRate + failRate + withdrawalRate;
            if (total !== 100) {
                passRate += (100 - total); // Adjust pass rate to make it exactly 100%
            }

            const avgScore = Math.floor(40 + (passRate * 0.8));

            return {
                module,
                presentation,
                enrollments: count,
                avgScore,
                passRate: parseFloat(passRate.toFixed(1)),
                failRate: parseFloat(failRate.toFixed(1)),
                withdrawalRate: parseFloat(withdrawalRate.toFixed(1))
            };
        });

        // ✅ Store courseData globally so it's consistent everywhere
        window.globalCourseData = courseData;

        // Render all sections with THE SAME courseData
        renderAdminSummary(data);
        renderAtRiskAlerts(atRiskData);
        updateInsightCards(courseData); // ✅ Use the same courseData
        renderEnrolmentChart(data.enrolments);
        renderOutcomeChart(data.outcomes);
        renderCoursePerformanceTable(data, courseData); // ✅ Pass the same courseData
        renderCapacityTable(allSubjectsData);
        renderSubjectsTable(allSubjectsData);
        renderDemandTable(allSubjectsData);
        renderGenderChart(data.gender);
        renderAgeChart(data.age);

        setupAdminFilters();
    } catch (error) {
        console.error("Error loading admin data:", error);
    }
}

// Toggle course details visibility
function toggleCourseDetails() {
    const insightsSection = document.getElementById('courseInsightsSection');
    const capacitySection = document.getElementById('capacity');
    const demandSection = document.getElementById('demand');

    // Toggle visibility
    if (insightsSection.style.display === 'none') {
        // Show sections with smooth animation
        insightsSection.style.display = 'block';
        capacitySection.style.display = 'block';
        demandSection.style.display = 'block';

        // Smooth scroll to insights
        setTimeout(() => {
            insightsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        console.log('✅ Course details sections shown');
    } else {
        // Hide sections
        insightsSection.style.display = 'none';
        capacitySection.style.display = 'none';
        demandSection.style.display = 'none';

        console.log('❌ Course details sections hidden');
    }
}

// Generate ALL students (not just 100)
function generateAllStudents(outcomes) {
    const students = [];
    let studentId = 10000;

    const outcomeTypes = [
        { type: 'Pass', count: outcomes.Pass || 0 },
        { type: 'Fail', count: outcomes.Fail || 0 },
        { type: 'Distinction', count: outcomes.Distinction || 0 },
        { type: 'Withdrawn', count: outcomes.Withdrawn || 0 }
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

    return students;
}

// Calculate at-risk metrics
function calculateAtRiskMetrics(data, students) {
    const outcomes = data.outcomes || {};
    const enrolments = data.enrolments || {};

    // Students with low scores (estimate: 64% of failing students)
    const lowScoreStudents = Math.floor((outcomes.Fail || 0) * 0.64);

    // Courses with high withdrawal rates (>30%)
    const totalEnrolments = Object.values(enrolments).reduce((a, b) => a + b, 0);
    const withdrawalRate = (outcomes.Withdrawn || 0) / totalEnrolments;
    const highWithdrawalCourses = Object.entries(enrolments).filter(([course, count]) => {
        return withdrawalRate > 0.3;
    }).length;

    // Low engagement students (estimate: 15% of total)
    const lowEngagementStudents = Math.floor(students.length * 0.15);

    return {
        lowScoreStudents,
        highWithdrawalCourses: Math.max(highWithdrawalCourses, Math.ceil(Object.keys(enrolments).length * 0.25)),
        lowEngagementStudents
    };
}

// Render at-risk alerts
function renderAtRiskAlerts(atRiskData) {
    const lowScoreEl = document.getElementById('lowScoreCount');
    const highWithdrawalEl = document.getElementById('highWithdrawalCount');
    const lowEngagementEl = document.getElementById('lowEngagementCount');

    if (lowScoreEl) lowScoreEl.textContent = atRiskData.lowScoreStudents.toLocaleString();
    if (highWithdrawalEl) highWithdrawalEl.textContent = atRiskData.highWithdrawalCourses;
    if (lowEngagementEl) lowEngagementEl.textContent = atRiskData.lowEngagementStudents.toLocaleString();
}

// ============================================
// ENHANCED COURSE PERFORMANCE TABLE
// ============================================

function renderCoursePerformanceTable(data, courseData) {
    const tbody = document.getElementById('performanceTableBody');
    if (!tbody) return;

    // ✅ FIXED: Use EXACT SAME categorization logic with else-if
    const categorizeAndSort = (courses) => {
        return courses.map(course => {
            let category, priority;

            // Category 1: High Withdrawal (≥30%) - HIGHEST PRIORITY
            if (course.withdrawalRate >= 30) {
                category = 'high-withdrawal';
                priority = 1;
            }
            // Category 2: High Engagement - Pass ≥70%, Withdrawal <20%, Score ≥70
            else if (course.passRate >= 70 && course.withdrawalRate < 20 && course.avgScore >= 70) {
                category = 'high-engagement';
                priority = 3;
            }
            // Category 3: Needs Attention - Withdrawal <30% BUT (Pass <50% OR Score <55 OR Withdrawal ≥20%)
            else if (course.withdrawalRate < 30 && (course.passRate < 50 || course.avgScore < 55 || course.withdrawalRate >= 20)) {
                category = 'at-risk';
                priority = 2;
            }
            // Category 4: Others (Performing Well)
            else {
                category = 'performing-well';
                priority = 4;
            }

            return { ...course, category, priority };
        }).sort((a, b) => {
            // Sort by priority first, then by withdrawal rate within same category
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.withdrawalRate - a.withdrawalRate;
        });
    };

    const sortedCourseData = categorizeAndSort(courseData);

    const html = sortedCourseData.map(course => {
        const scoreClass = course.avgScore >= 70 ? 'success' :
            course.avgScore >= 60 ? 'warning' : 'danger';
        const passRateClass = course.passRate >= 70 ? 'success' :
            course.passRate >= 60 ? 'warning' : 'danger';
        const withdrawalRateClass = course.withdrawalRate >= 30 ? 'danger' :
            course.withdrawalRate >= 20 ? 'warning' : 'success';

        // ✅ EXACT SAME categorization as updateInsightCards
        let statusBadge;
        if (course.category === 'high-withdrawal') {
            statusBadge = '<span class="status-badge status-risk fs-6" data-category="high-withdrawal">🚨 High Withdrawal</span>';
        } else if (course.category === 'high-engagement') {
            statusBadge = '<span class="status-badge status-excellent fs-6" data-category="high-engagement">🌟 High Engagement</span>';
        } else if (course.category === 'at-risk') {
            statusBadge = '<span class="status-badge status-monitor fs-6" data-category="at-risk">⚠️ Needs Attention</span>';
        } else {
            // Category: performing-well (Others)
            statusBadge = '<span class="status-badge fs-6" data-category="performing-well" style="background: #e3f2fd; color: #1976d2;">✅ Performing Well</span>';
        }

        return `
            <tr>
                <td style="width: 12%;"><strong>${course.module}</strong></td>
                <td style="width: 13%;"><span class="badge bg-secondary">${course.presentation}</span></td>
                <td class="text-end" style="width: 11%;"><strong>${course.enrollments.toLocaleString()}</strong></td>
                <td class="text-end" style="width: 11%;">
                    <strong class="text-${scoreClass}">${course.avgScore}<small class="text-muted">/100</small></strong>
                </td>
                <td style="width: 20%;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="flex-grow-1">
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar bg-${passRateClass}" style="width: ${course.passRate}%"></div>
                            </div>
                        </div>
                        <strong class="text-${passRateClass}" style="min-width: 55px; text-align: right;">${course.passRate}%</strong>
                    </div>
                    <small class="text-muted" style="font-size: 0.7rem;">
                        Pass: ${course.passRate}% | Fail: ${course.failRate}%
                    </small>
                </td>
                <td style="width: 20%;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="flex-grow-1">
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar bg-${withdrawalRateClass}" style="width: ${course.withdrawalRate}%"></div>
                            </div>
                        </div>
                        <strong class="text-${withdrawalRateClass}" style="min-width: 48px; text-align: right;">${course.withdrawalRate}%</strong>
                    </div>
                </td>
                <td class="text-center" style="width: 13%;">${statusBadge}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

// Scroll to section with filter highlighting
function scrollToSection(sectionId, filter) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Apply filter highlighting after scroll
        setTimeout(() => {
            highlightFilteredRows(filter);
        }, 800);
    }
}

function highlightFilteredRows(filter) {
    const tbody = document.getElementById('performanceTableBody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        row.classList.remove('highlight-row');

        if (!row.cells || row.cells.length < 7) return;

        const statusBadge = row.cells[6].querySelector('[data-category]');
        if (!statusBadge) return;

        const category = statusBadge.getAttribute('data-category');

        if (filter === 'high-withdrawal' && category === 'high-withdrawal') {
            row.classList.add('highlight-row');
        } else if (filter === 'high-engagement' && category === 'high-engagement') {
            row.classList.add('highlight-row');
        } else if (filter === 'at-risk' && category === 'at-risk') {
            row.classList.add('highlight-row');
        } else if (filter === 'performing-well' && category === 'performing-well') {
            row.classList.add('highlight-row');
        }
    });
}

// Render capacity analysis table
function renderCapacityTable(subjects) {
    const tbody = document.getElementById('capacityTableBody');
    if (!tbody) return;

    const html = subjects.map(subject => {
        // REAL CAPACITY LOGIC: Based on typical classroom/resource limits
        // Small courses: 50 students per section
        // Medium courses: 100 students per section  
        // Large courses: 200 students per section

        let maxCapacity;
        if (subject.enrolments <= 500) {
            // Small course: 50 students/section, allow up to 10 sections = 500 max
            maxCapacity = Math.ceil(subject.enrolments / 50) * 50 + 50; // Current sections + 1 buffer section
        } else if (subject.enrolments <= 1500) {
            // Medium course: 100 students/section
            maxCapacity = Math.ceil(subject.enrolments / 100) * 100 + 100;
        } else {
            // Large course: 200 students/section
            maxCapacity = Math.ceil(subject.enrolments / 200) * 200 + 200;
        }

        const availableSeats = maxCapacity - subject.enrolments;
        const utilizationPercent = ((subject.enrolments / maxCapacity) * 100).toFixed(0);

        const needsAction = utilizationPercent >= 85;
        const actionBadge = needsAction
            ? '<span class="badge bg-danger fs-6 px-3 py-2">⚠️ Open New Section</span>'
            : utilizationPercent >= 70
                ? '<span class="badge bg-warning fs-6 px-3 py-2">📊 Monitor</span>'
                : '<span class="badge bg-success fs-6 px-3 py-2">✅ Sufficient</span>';

        const utilizationClass = utilizationPercent >= 85 ? 'danger' :
            utilizationPercent >= 70 ? 'warning' : 'success';

        return `
                <tr class="${needsAction ? 'table-warning' : ''}">
                    <td>
                        <strong class="text-primary">${subject.code_module}</strong>
                        <br>
                        <small class="text-muted">${subject.code_presentation}</small>
                    </td>
                    <td><strong class="fs-6">${subject.enrolments.toLocaleString()}</strong></td>
                    <td><strong class="fs-6">${maxCapacity.toLocaleString()}</strong></td>
                    <td class="text-${utilizationClass}">
                        <strong class="fs-6">${availableSeats.toLocaleString()}</strong> seats
                    </td>
                    <td style="width: 200px;">
                        <div class="progress" style="height: 24px;">
                            <div class="progress-bar bg-${utilizationClass}" style="width: ${utilizationPercent}%">
                                <strong>${utilizationPercent}%</strong>
                            </div>
                        </div>
                    </td>
                    <td>${actionBadge}</td>
                </tr>
            `;
    }).join('');

    tbody.innerHTML = html;
}

// ============================================
// ENHANCED SUBJECTS CATALOG TABLE
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

    // Sort by module code
    subjects.sort((a, b) => a.code_module.localeCompare(b.code_module));

    const html = subjects.map(subject => {
        const semester = subject.code_presentation.includes('B') ?
            '<span class="badge bg-primary px-3 py-2">📅 February</span>' :
            '<span class="badge bg-warning text-dark px-3 py-2">📅 October</span>';

        // ✅ Duration from courses.csv (stored as 'length')
        const duration = subject.module_presentation_length || subject.length || 'N/A';
        const durationDisplay = duration !== 'N/A' ? `${duration} days` : 'N/A';

        // Status based on enrollment size
        let statusBadge;
        if (subject.enrolments > 1500) {
            statusBadge = '<span class="badge bg-success px-3 py-2">✅ Active - High</span>';
        } else if (subject.enrolments > 800) {
            statusBadge = '<span class="badge bg-info px-3 py-2">✅ Active - Normal</span>';
        } else if (subject.enrolments > 300) {
            statusBadge = '<span class="badge bg-warning px-3 py-2">⚠️ Active - Low</span>';
        } else {
            statusBadge = '<span class="badge bg-danger px-3 py-2">⚠️ Under Review</span>';
        }

        return `
                <tr>
                    <td>
                        <strong class="text-primary fs-6">${subject.code_module}</strong>
                        <br>
                        <small class="text-muted">${subject.code_presentation}</small>
                    </td>
                    <td>${semester}</td>
                    <td><strong>${durationDisplay}</strong></td>
                    <td><strong class="fs-6">${subject.enrolments.toLocaleString()}</strong> students</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
    }).join('');

    tbody.innerHTML = html;
}

// Render demand analysis table (separate from subjects catalog)
function renderDemandTable(subjects) {
    const tbody = document.getElementById("demandTableBody");
    if (!tbody) return;

    if (!subjects || subjects.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        No demand data available
                    </td>
                </tr>`;
        return;
    }

    const html = subjects.map(subject => {
        // Simulate enrollment trend (in real system, compare with previous semester)
        const trendRandom = Math.random();
        let trendBadge, trendIcon, forecast, demandLevel;

        if (trendRandom > 0.6) {
            // Growing (40% chance)
            const growthPercent = Math.floor(Math.random() * 20) + 5; // 5-25% growth
            trendBadge = `<span class="badge bg-success px-3 py-2">📈 Growing +${growthPercent}%</span>`;
            trendIcon = '📈';
            forecast = `Expected ${Math.floor(subject.enrolments * (1 + growthPercent / 100)).toLocaleString()} next semester`;
            demandLevel = '<span class="badge bg-success fs-6 px-3 py-2">🔥 High Demand</span>';
        } else if (trendRandom > 0.3) {
            // Stable (30% chance)
            trendBadge = '<span class="badge bg-info px-3 py-2">➡️ Stable ±3%</span>';
            trendIcon = '➡️';
            forecast = `Expected ${subject.enrolments.toLocaleString()} next semester`;
            demandLevel = '<span class="badge bg-info fs-6 px-3 py-2">📊 Steady</span>';
        } else {
            // Declining (30% chance)
            const declinePercent = Math.floor(Math.random() * 15) + 5; // 5-20% decline
            trendBadge = `<span class="badge bg-danger px-3 py-2">📉 Declining -${declinePercent}%</span>`;
            trendIcon = '📉';
            forecast = `Expected ${Math.floor(subject.enrolments * (1 - declinePercent / 100)).toLocaleString()} next semester`;
            demandLevel = '<span class="badge bg-warning text-dark fs-6 px-3 py-2">⚠️ Declining</span>';
        }

        return `
                <tr>
                    <td>
                        <strong class="text-primary fs-6">${subject.code_module}</strong>
                        <br>
                        <small class="text-muted">${subject.code_presentation}</small>
                    </td>
                    <td><strong class="fs-6">${subject.enrolments.toLocaleString()}</strong> students</td>
                    <td>${trendBadge}</td>
                    <td>${demandLevel}</td>
                    <td><small class="text-muted">${forecast}</small></td>
                </tr>
            `;
    }).join('');

    tbody.innerHTML = html;
}

function generateSubjectsFromEnrolments(enrolments, courses = []) {
    console.log('🔍 Generating subjects from enrollments...');
    console.log('📚 Courses available:', courses.length);

    // Create lookup map for quick access
    const courseLookup = {};
    courses.forEach(course => {
        const key = `${course.code_module}_${course.code_presentation}`;
        courseLookup[key] = course.length; // ✅ Use 'length' from courses.csv
    });

    console.log('🗺️ Course lookup keys:', Object.keys(courseLookup).slice(0, 5));
    console.log('📝 Enrollment keys:', Object.keys(enrolments).slice(0, 5));

    return Object.entries(enrolments).map(([key, count]) => {
        let parts = key.includes('_') ? key.split('_') : key.split('-');
        const module = parts[0] || 'Unknown';
        const presentation = parts[1] || 'Unknown';

        // Look up duration from courses data
        const lookupKey = `${module}_${presentation}`;
        const duration = courseLookup[lookupKey] || 'N/A';

        if (duration === 'N/A') {
            console.warn(`⚠️ No duration found for: ${lookupKey}`);
        }

        return {
            code_module: module,
            code_presentation: presentation,
            length: duration, // ✅ Store as 'length' to match courses.csv
            module_presentation_length: duration, // Keep for backward compatibility
            enrolments: count
        };
    });
}

function renderAdminSummary(data) {
    // Calculate total students from ALL outcomes
    const outcomes = data.outcomes || {};
    const totalStudents = Object.values(outcomes).reduce((a, b) => a + b, 0);
    const totalCourses = Object.keys(data.enrolments || {}).length;
    const totalEnrolments = Object.values(data.enrolments || {}).reduce((a, b) => a + b, 0);

    const totalCompleted = (outcomes.Pass || 0) + (outcomes.Fail || 0) + (outcomes.Distinction || 0);
    const passRate = totalCompleted > 0
        ? (((outcomes.Pass || 0) + (outcomes.Distinction || 0)) / totalCompleted * 100).toFixed(1)
        : 0;

    const totalStudentsEl = document.getElementById("totalStudentsCount");
    const totalCoursesEl = document.getElementById("totalCoursesCount");
    const totalEnrolmentsEl = document.getElementById("totalEnrolmentsCount");
    const passRateEl = document.getElementById("passRatePercent");

    if (totalStudentsEl) totalStudentsEl.textContent = totalStudents.toLocaleString();
    if (totalCoursesEl) totalCoursesEl.textContent = totalCourses;
    if (totalEnrolmentsEl) totalEnrolmentsEl.textContent = totalEnrolments.toLocaleString();
    if (passRateEl) passRateEl.textContent = passRate + "%";
}

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

    const studentsCountEl = document.getElementById("studentsCount");
    const currentPageEl = document.getElementById("currentPage");
    if (studentsCountEl) studentsCountEl.textContent = students.length;
    if (currentPageEl) currentPageEl.textContent = page;

    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");
    if (prevBtn) prevBtn.disabled = page === 1;
    if (nextBtn) nextBtn.disabled = endIndex >= students.length;
}

function setupAdminFilters() {
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

    const passCount = document.getElementById("passCount");
    const failCount = document.getElementById("failCount");
    const withdrawCount = document.getElementById("withdrawCount");
    const distCount = document.getElementById("distCount");
    if (passCount) passCount.textContent = (outcomes["Pass"] || 0).toLocaleString();
    if (failCount) failCount.textContent = (outcomes["Fail"] || 0).toLocaleString();
    if (withdrawCount) withdrawCount.textContent = (outcomes["Withdrawn"] || 0).toLocaleString();
    if (distCount) distCount.textContent = (outcomes["Distinction"] || 0).toLocaleString();
}

// ============================================
// AUTO-INITIALIZATION
// ============================================
if (document.getElementById("progressChart")) {
    loadStudentData("11391");
}

if (document.getElementById("classChart")) {
    populateModuleDropdown();
}

if (document.getElementById("enrolChart")) {
    loadAdminData();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString();
}

function calculatePercentage(value, total) {
    return total > 0 ? ((value / total) * 100).toFixed(1) : 0;
}

function getGradeClassification(score) {
    if (score >= 80) return { grade: 'Distinction', class: 'success' };
    if (score >= 60) return { grade: 'Merit', class: 'info' };
    if (score >= 40) return { grade: 'Pass', class: 'warning' };
    return { grade: 'Fail', class: 'danger' };
}

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

    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
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

    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(
            document.querySelectorAll('[data-bs-toggle="tooltip"]')
        );
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (typeof Chart !== 'undefined' && Chart.instances) {
            Object.values(Chart.instances).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }
    }, 250);
});

function printDashboard() {
    window.print();
}

function refreshDashboard() {
    if (document.getElementById("progressChart")) {
        showToast('Refreshing student data...', 'info');
        if (typeof loadStudentData === 'function') {
            loadStudentData("11391");
        }
    } else if (document.getElementById("classChart")) {
        const moduleCode = document.getElementById("module")?.value;
        showToast('Refreshing lecturer data...', 'info');
        if (typeof loadLecturerData === 'function') {
            loadLecturerData(moduleCode);
        }
    } else if (document.getElementById("enrolChart")) {
        showToast('Refreshing admin data...', 'info');
        loadAdminData();
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
}

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

if ('performance' in window) {
    window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`Page load time: ${pageLoadTime}ms`);
    });
}
/* ============================================
// ✨ ENHANCED INTERACTIVE FEATURES ✨
// ============================================

// Global variables for interactive features
let timelineData = [];
let currentTimelineFilter = 'all';

// 🎯 FEATURE 1: INTERACTIVE STUDY TIMELINE
function generateInteractiveTimeline(data) {
    timelineData = [];

    if (data.scores && data.scores.length > 0) {
        data.scores.forEach(score => {
            timelineData.push({
                type: 'assessment',
                date: score.date_submitted,
                title: `${score.assessment_type} Submitted`,
                module: score.code_module,
                score: score.score,
                icon: 'clipboard-check',
                details: `Score: ${score.score}% | ${score.score >= 40 ? 'Passed ✅' : 'Failed ❌'}`,
                color: score.score >= 70 ? '#2ecc71' : score.score >= 40 ? '#f39c12' : '#e74c3c'
            });
        });
    }

    if (data.activity && data.activity.length > 0) {
        data.activity.forEach(act => {
            if (act.sum_click > 50) {
                timelineData.push({
                    type: 'activity',
                    date: act.date,
                    title: 'High Engagement Day',
                    icon: 'mouse',
                    details: `${act.sum_click} VLE interactions`,
                    color: '#3498db'
                });
            }
        });
    }

    if (data.assessments && data.currentDay) {
        data.assessments.forEach(assessment => {
            if (assessment.date > data.currentDay) {
                const daysLeft = assessment.date - data.currentDay;
                timelineData.push({
                    type: 'deadline',
                    date: assessment.date,
                    title: `Upcoming ${assessment.assessment_type}`,
                    module: assessment.code_module,
                    icon: 'calendar-event',
                    details: `${daysLeft} days remaining`,
                    color: daysLeft < 7 ? '#e74c3c' : '#f39c12'
                });
            }
        });
    }

    if (data.scores && data.scores.length > 0) {
        data.scores.filter(s => s.score >= 80).forEach(score => {
            timelineData.push({
                type: 'achievement',
                date: score.date_submitted,
                title: '🎉 Achievement Unlocked!',
                module: score.code_module,
                icon: 'trophy',
                details: `High Score: ${score.score}% in ${score.assessment_type}`,
                color: '#9b59b6'
            });
        });
    }

    timelineData.sort((a, b) => a.date - b.date);

    renderInteractiveTimeline();
}

function renderInteractiveTimeline() {
    let container = document.getElementById('interactiveTimeline');

    if (!container) {
        const updatesSection = document.querySelector('#updatesFeed').closest('.col-12');
        const timelineSection = document.createElement('div');
        timelineSection.className = 'col-12 mt-4';
        timelineSection.innerHTML = `
            <div class="card">
                <div class="card-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <i class="bi bi-clock-history me-2"></i>
                    Interactive Study Timeline
                </div>
                <div class="card-body">
                    <div class="mb-3 position-relative">
                        <input type="text" id="timelineSearch" class="form-control" 
                               placeholder="🔍 Search timeline events..." 
                               onkeyup="filterTimelineBySearch()" 
                               style="padding-left: 40px; border-radius: 25px;">
                        <i class="bi bi-search position-absolute" style="left: 15px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                    </div>
                    
                    <div class="d-flex gap-2 mb-3 flex-wrap" id="timelineFilters">
                        <button class="btn btn-sm btn-outline-primary active" onclick="setTimelineFilter('all')">
                            <i class="bi bi-grid-3x3"></i> All
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="setTimelineFilter('assessment')">
                            <i class="bi bi-clipboard-check"></i> Assessments
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="setTimelineFilter('activity')">
                            <i class="bi bi-mouse"></i> Activities
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="setTimelineFilter('deadline')">
                            <i class="bi bi-calendar-event"></i> Deadlines
                        </button>
                        <button class="btn btn-sm btn-outline-purple" onclick="setTimelineFilter('achievement')">
                            <i class="bi bi-trophy"></i> Achievements
                        </button>
                    </div>
                    
                    <div id="interactiveTimeline" style="max-height: 600px; overflow-y: auto;"></div>
                </div>
            </div>
        `;

        if (updatesSection && updatesSection.nextElementSibling) {
            updatesSection.parentNode.insertBefore(timelineSection, updatesSection.nextElementSibling);
        } else if (updatesSection) {
            updatesSection.parentNode.appendChild(timelineSection);
        }

        container = document.getElementById('interactiveTimeline');
    }

    const filtered = currentTimelineFilter === 'all'
        ? timelineData
        : timelineData.filter(item => item.type === currentTimelineFilter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info text-center">
                <i class="bi bi-info-circle me-2"></i>
                No timeline events found
            </div>
        `;
        return;
    }

    const html = `
        <div class="timeline-wrapper position-relative" style="padding: 20px 0;">
            <div class="timeline-line position-absolute" 
                 style="left: 40px; top: 0; bottom: 0; width: 3px; background: linear-gradient(to bottom, #667eea, #764ba2);"></div>
            
            ${filtered.map((item, index) => `
                <div class="timeline-item position-relative mb-4 ps-5" 
                     data-type="${item.type}" 
                     style="padding-left: 80px; cursor: pointer; transition: all 0.3s ease;"
                     onclick="toggleTimelineDetails(${index})"
                     onmouseenter="this.style.backgroundColor='rgba(102, 126, 234, 0.05)'; this.style.paddingLeft='90px'; this.style.borderRadius='10px'"
                     onmouseleave="this.style.backgroundColor='transparent'; this.style.paddingLeft='80px'">
                    
                    <div class="position-absolute text-muted fw-bold" 
                         style="left: 0; top: 20px; font-size: 11px;">
                        Day ${item.date}
                    </div>
                    
                    <div class="timeline-dot position-absolute rounded-circle bg-white" 
                         style="left: 32px; top: 20px; width: 18px; height: 18px; 
                                border: 4px solid ${item.color}; z-index: 2;
                                transition: all 0.3s ease;">
                    </div>
                    
                    <div class="card border-0 shadow-sm">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="flex-grow-1">
                                    <h6 class="mb-1">
                                        <i class="bi bi-${item.icon} me-2" style="color: ${item.color}"></i>
                                        ${item.title}
                                    </h6>
                                    ${item.module ? `<span class="badge" style="background-color: ${getColorForModule(item.module)}">${item.module}</span>` : ''}
                                </div>
                                <i class="bi bi-chevron-down text-muted timeline-chevron-${index}" style="transition: transform 0.3s ease;"></i>
                            </div>
                            
                            <div class="timeline-details-${index} mt-2" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease;">
                                <hr class="my-2">
                                <p class="mb-0 text-muted small">${item.details}</p>
                                ${item.score ? `
                                    <div class="progress mt-2" style="height: 20px;">
                                        <div class="progress-bar" 
                                             style="width: ${item.score}%; background-color: ${item.color}">
                                            ${item.score}%
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
} */


function toggleTimelineDetails(index) {
    const details = document.querySelector(`.timeline-details-${index}`);
    const chevron = document.querySelector(`.timeline-chevron-${index}`);

    if (details.style.maxHeight === '0px' || !details.style.maxHeight) {
        details.style.maxHeight = '200px';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        details.style.maxHeight = '0';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
}

function setTimelineFilter(filter) {
    currentTimelineFilter = filter;

    document.querySelectorAll('#timelineFilters button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');

    renderInteractiveTimeline();
}

function filterTimelineBySearch() {
    const searchTerm = document.getElementById('timelineSearch').value.toLowerCase();
    const items = document.querySelectorAll('.timeline-item');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// 🎯 FEATURE 2: INTERACTIVE CHART CONTROLS
function addInteractiveChartControls() {
    const progressCard = document.querySelector('#progressChart')?.closest('.card');
    if (progressCard) {
        const header = progressCard.querySelector('.card-header');
        if (header && !header.querySelector('.chart-controls')) {
            const controls = document.createElement('div');
            controls.className = 'chart-controls d-inline-flex gap-2 ms-auto';
            controls.innerHTML = `
                <button class="btn btn-sm btn-light active" onclick="changeProgressChartType('line')" data-chart="line">
                    <i class="bi bi-graph-up"></i>
                </button>
                <button class="btn btn-sm btn-light" onclick="changeProgressChartType('bar')" data-chart="bar">
                    <i class="bi bi-bar-chart"></i>
                </button>
                <button class="btn btn-sm btn-light" onclick="changeProgressChartType('scatter')" data-chart="scatter">
                    <i class="bi bi-diagram-3"></i>
                </button>
            `;
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.appendChild(controls);
        }
    }

    const activityCard = document.querySelector('#activityChart')?.closest('.card');
    if (activityCard) {
        const header = activityCard.querySelector('.card-header');
        if (header && !header.querySelector('.chart-controls')) {
            const controls = document.createElement('div');
            controls.className = 'chart-controls d-inline-flex gap-2 ms-auto';
            controls.innerHTML = `
                <button class="btn btn-sm btn-light active" onclick="changeActivityChartType('bar')" data-chart="bar">
                    <i class="bi bi-bar-chart-fill"></i>
                </button>
                <button class="btn btn-sm btn-light" onclick="changeActivityChartType('line')" data-chart="line">
                    <i class="bi bi-graph-up"></i>
                </button>
            `;
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.appendChild(controls);
        }
    }
}

function changeProgressChartType(type) {
    if (!progressChartInstance) return;

    document.querySelectorAll('[onclick^="changeProgressChartType"]').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');

    progressChartInstance.config.type = type;

    if (type === 'scatter') {
        progressChartInstance.options.plugins.legend.display = true;
    }

    progressChartInstance.update('active');
}

function changeActivityChartType(type) {
    if (!activityChartInstance) return;

    document.querySelectorAll('[onclick^="changeActivityChartType"]').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');

    activityChartInstance.config.type = type;
    activityChartInstance.update('active');
}

// 7️⃣ INTERACTIVE PERFORMANCE CARDS (ENHANCED WITH DRILL-DOWN)
function makePerformanceCardsInteractive() {
    setTimeout(() => {
        const cards = document.querySelectorAll('#performanceSummary .card');

        cards.forEach((card, index) => {
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.3s ease';

            card.addEventListener('mouseenter', function () {
                this.style.transform = 'scale(1.05) translateY(-5px)';
                this.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
            });

            card.addEventListener('mouseleave', function () {
                this.style.transform = 'scale(1) translateY(0)';
                this.style.boxShadow = '';
            });

            // 🆕 DRILL-DOWN: Click to see details
            card.addEventListener('click', function () {
                const cardTitle = this.querySelector('small').textContent;
                const cardValue = this.querySelector('h3').textContent;

                // Show detailed breakdown based on which card was clicked
                showPerformanceDetails(index, cardTitle, cardValue);
            });
        });
    }, 1000);
}

// 🆕 DRILL-DOWN FUNCTION
// 🆕 ALTERNATIVE: Show details in expandable section (NO MODAL)
function showPerformanceDetails(cardIndex, title, value) {
    const data = window.studentData;
    if (!data || !data.scores) return;

    let detailsHTML = '';

    switch (cardIndex) {
        case 0: // Total Assessments
            detailsHTML = generateTotalAssessmentsDetails(data.scores);
            break;
        case 1: // Average Score
            detailsHTML = generateAverageScoreDetails(data.scores);
            break;
        case 2: // Passed Assessments
            detailsHTML = generatePassedAssessmentsDetails(data.scores);
            break;
        case 3: // Best Score
            detailsHTML = generateBestScoreDetails(data.scores);
            break;
    }

    // Show in expandable section instead of modal
    showDetailsExpanded(title, detailsHTML);
}

// Show details in an expandable card below performance summary
function showDetailsExpanded(title, content) {
    // Check if details section already exists
    let detailsSection = document.getElementById('performanceDetails');

    if (!detailsSection) {
        // Create new section after performance summary
        detailsSection = document.createElement('div');
        detailsSection.id = 'performanceDetails';
        detailsSection.className = 'mb-4';

        const performanceSummary = document.getElementById('overviewSection');
        performanceSummary.insertAdjacentElement('afterend', detailsSection);
    }

    // Populate with content
    detailsSection.innerHTML = `
        <div class="card border-primary" style="animation: slideDown 0.3s ease;">
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-zoom-in me-2"></i>${title} - Detailed View
                </h5>
                <button class="btn btn-sm btn-light" onclick="closePerformanceDetails()">
                    <i class="bi bi-x-lg"></i> Close
                </button>
            </div>
            <div class="card-body">
                ${content}
            </div>
        </div>
    `;

    // Scroll to details
    detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Close details section
function closePerformanceDetails() {
    const detailsSection = document.getElementById('performanceDetails');
    if (detailsSection) {
        detailsSection.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            detailsSection.remove();
        }, 300);
    }
}

// Generate details for each card type
function generateTotalAssessmentsDetails(scores) {
    const html = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th>#</th>
                        <th>Module</th>
                        <th>Assessment Type</th>
                        <th>Date</th>
                        <th>Score</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${scores.map((s, i) => {
        const statusClass = Number(s.score) >= 70 ? 'success' :
            Number(s.score) >= 40 ? 'warning' : 'danger';
        const statusText = Number(s.score) >= 70 ? 'Excellent' :
            Number(s.score) >= 40 ? 'Pass' : 'Fail';

        return `
                            <tr>
                                <td>${i + 1}</td>
                                <td><span class="badge" style="background: ${getColorForModule(s.code_module)}">${s.code_module}</span></td>
                                <td>${s.assessment_type || 'Assessment'}</td>
                                <td>Day ${s.date_submitted}</td>
                                <td><strong>${s.score}%</strong></td>
                                <td><span class="badge bg-${statusClass}">${statusText}</span></td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    return html;
}

function generateAverageScoreDetails(scores) {
    // Group by module
    const moduleGroups = {};
    scores.forEach(s => {
        if (!moduleGroups[s.code_module]) {
            moduleGroups[s.code_module] = [];
        }
        moduleGroups[s.code_module].push(Number(s.score));
    });

    const html = `
        <div class="row g-3">
            ${Object.entries(moduleGroups).map(([module, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const color = avg >= 70 ? 'success' : avg >= 40 ? 'warning' : 'danger';

        return `
                    <div class="col-md-6">
                        <div class="card border-${color}">
                            <div class="card-body">
                                <h5 style="color: ${getColorForModule(module)}">${module}</h5>
                                <div class="display-6 text-${color}">${avg.toFixed(1)}%</div>
                                <small class="text-muted">${scores.length} assessments</small>
                                <div class="progress mt-2" style="height: 10px;">
                                    <div class="progress-bar bg-${color}" style="width: ${avg}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
    return html;
}

function generatePassedAssessmentsDetails(scores) {
    const passed = scores.filter(s => Number(s.score) >= 40);
    const failed = scores.filter(s => Number(s.score) < 40);

    const html = `
        <div class="row g-3 mb-3">
            <div class="col-md-6">
                <div class="alert alert-success">
                    <h5><i class="bi bi-check-circle me-2"></i>Passed: ${passed.length}</h5>
                    <ul class="mb-0">
                        ${passed.slice(0, 5).map(s => `
                            <li>${s.code_module}: ${s.score}%</li>
                        `).join('')}
                        ${passed.length > 5 ? `<li class="text-muted">...and ${passed.length - 5} more</li>` : ''}
                    </ul>
                </div>
            </div>
            <div class="col-md-6">
                <div class="alert alert-danger">
                    <h5><i class="bi bi-x-circle me-2"></i>Failed: ${failed.length}</h5>
                    ${failed.length > 0 ? `
                        <ul class="mb-0">
                            ${failed.map(s => `
                                <li>${s.code_module}: ${s.score}%</li>
                            `).join('')}
                        </ul>
                    ` : '<p class="mb-0">No failed assessments! Great job!</p>'}
                </div>
            </div>
        </div>
    `;
    return html;
}

function generateBestScoreDetails(scores) {
    const sorted = [...scores].sort((a, b) => Number(b.score) - Number(a.score));
    const top5 = sorted.slice(0, 5);

    const html = `
        <div class="list-group">
            ${top5.map((s, i) => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-warning text-dark me-2">#${i + 1}</span>
                        <strong>${s.code_module}</strong>
                        <br>
                        <small class="text-muted">${s.assessment_type || 'Assessment'} - Day ${s.date_submitted}</small>
                    </div>
                    <div class="text-end">
                        <h4 class="mb-0 text-success">${s.score}%</h4>
                        ${i === 0 ? '<i class="bi bi-trophy-fill text-warning fs-3"></i>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    return html;
}

// Show details in a modal
function showDetailsModal(title, content) {
    // Remove any existing modal first
    const existingModal = document.getElementById('detailsModal');
    if (existingModal) {
        const existingInstance = bootstrap.Modal.getInstance(existingModal);
        if (existingInstance) {
            existingInstance.dispose();
        }
        existingModal.remove();
    }

    // Remove any leftover backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Create fresh modal
    const modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'detailsModalTitle');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="detailsModalTitle">
                        <i class="bi bi-info-circle me-2"></i>${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="detailsModalBody">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Show modal
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Clean up when hidden
    modal.addEventListener('hidden.bs.modal', function () {
        modalInstance.dispose();
        modal.remove();

        // Ensure body is clean
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // Remove any orphaned backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    });
} function showDetailsModal(title, content) {
    // Remove any existing modal first
    const existingModal = document.getElementById('detailsModal');
    if (existingModal) {
        const existingInstance = bootstrap.Modal.getInstance(existingModal);
        if (existingInstance) {
            existingInstance.dispose();
        }
        existingModal.remove();
    }

    // Remove any leftover backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Create fresh modal
    const modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'detailsModalTitle');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="detailsModalTitle">
                        <i class="bi bi-info-circle me-2"></i>${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="detailsModalBody">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Show modal
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Clean up when hidden
    modal.addEventListener('hidden.bs.modal', function () {
        modalInstance.dispose();
        modal.remove();

        // Ensure body is clean
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // Remove any orphaned backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    });
} function showDetailsModal(title, content) {
    // Remove any existing modal first
    const existingModal = document.getElementById('detailsModal');
    if (existingModal) {
        const existingInstance = bootstrap.Modal.getInstance(existingModal);
        if (existingInstance) {
            existingInstance.dispose();
        }
        existingModal.remove();
    }

    // Remove any leftover backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Create fresh modal
    const modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'detailsModalTitle');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="detailsModalTitle">
                        <i class="bi bi-info-circle me-2"></i>${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="detailsModalBody">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Show modal
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Clean up when hidden
    modal.addEventListener('hidden.bs.modal', function () {
        modalInstance.dispose();
        modal.remove();

        // Ensure body is clean
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // Remove any orphaned backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    });
}

// 🎯 FEATURE 4: INTERACTIVE MODULE PROGRESS
function makeModuleProgressInteractive() {
    const container = document.getElementById('progressBars');
    if (!container) return;

    const progressBars = container.querySelectorAll('.progress');

    progressBars.forEach((bar, index) => {
        bar.style.cursor = 'pointer';
        bar.style.transition = 'all 0.3s ease';

        bar.addEventListener('mouseenter', function () {
            this.style.height = '35px';
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        });

        bar.addEventListener('mouseleave', function () {
            this.style.height = '28px';
            this.style.boxShadow = '';
        });

        bar.addEventListener('click', function () {
            const moduleDiv = this.closest('.mb-3');
            const moduleName = moduleDiv.querySelector('strong').textContent;
            const moduleInfo = moduleDiv.querySelector('.text-muted').textContent;
            const avgScore = this.querySelector('.progress-bar strong').textContent;

            showToast(`${moduleName}: ${avgScore} | ${moduleInfo}`, 'primary');
        });
    });
}

// 🎯 FEATURE 5: ANIMATED PROGRESS BARS
function animateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-bar');

    progressBars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';

        setTimeout(() => {
            bar.style.transition = 'width 1s ease';
            bar.style.width = width;
        }, 100);
    });
}

// 🎯 FEATURE 6: CLICK-TO-EXPAND SECTIONS
function addExpandableFeatures() {
    const updatesContainer = document.getElementById('updatesFeed');
    if (updatesContainer) {
        const alerts = updatesContainer.querySelectorAll('.alert');
        alerts.forEach(alert => {
            alert.style.cursor = 'pointer';
            alert.addEventListener('click', function () {
                this.classList.toggle('expanded');
                const height = this.classList.contains('expanded') ? 'auto' : '';
                this.style.maxHeight = height;
            });
        });
    }
}

// ============================================
// ENHANCED INITIALIZATION
// ============================================
function initializeInteractiveFeatures(data) {
    setTimeout(() => {
        //generateInteractiveTimeline(data);
        addInteractiveChartControls();
        makePerformanceCardsInteractive();
        makeModuleProgressInteractive();
        animateProgressBars();
        addExpandableFeatures();

        console.log('✅ Interactive features initialized!');
    }, 500);
}