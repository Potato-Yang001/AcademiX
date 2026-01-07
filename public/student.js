// ============================================
// STUDENT DASHBOARD - COMPLETE SCRIPT
// ============================================
let progressChartInstance = null;
let activityChartInstance = null;
let deadlineChartInstance = null;
let performanceTrendChartInstance = null;
let assessmentBarChartInstance = null;
let engagementLineChartInstance = null;

// Navigation state
let currentModule = null;
let currentAssessment = null;

// Navigation function
function navigateTo(pageId) {
    document.querySelectorAll('.page-container').forEach(page => {
        page.classList.remove('active');
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function loadStudentData(studentId = "11391") {
    try {
        const res = await fetch(`/api/student/${studentId}`);
        const data = await res.json();

        if (!data.student) {
            alert("Student not found!");
            return;
        }

        // Store globally
        window.studentData = data;

        // Generate missing data
        if (!data.currentDay) {
            data.currentDay = calculateCurrentDay(data.scores);
        }
        if (!data.assessments && data.scores) {
            data.assessments = generateAssessmentsFromScores(data.scores);
        }

        // Render ONLY main dashboard (no more clutter!)
        renderMainDashboard();

    } catch (error) {
        console.error("Error loading student data:", error);
        alert("Error loading student data");
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

function renderMainDashboard() {
    const data = window.studentData;

    // Card 1: Overall Average
    const avgScore = data.scores.reduce((sum, s) => sum + Number(s.score), 0) / data.scores.length;
    document.getElementById('overallGPA').textContent = avgScore.toFixed(1) + '%';

    const statusBadge = document.getElementById('overallStatus');
    if (avgScore >= 80) {
        statusBadge.textContent = '🟢 Distinction';
        statusBadge.className = 'badge bg-success';
    } else if (avgScore >= 60) {
        statusBadge.textContent = '🟢 Merit';
        statusBadge.className = 'badge bg-success';
    } else if (avgScore >= 40) {
        statusBadge.textContent = '🟢 Pass';
        statusBadge.className = 'badge bg-success';
    } else {
        statusBadge.textContent = '🔴 At Risk';
        statusBadge.className = 'badge bg-danger';
    }

    // Card 2: Urgent Actions
    const urgentDeadlines = data.assessments.filter(a =>
        a.date > data.currentDay && (a.date - data.currentDay) < 7
    );
    document.getElementById('urgentCount').textContent = urgentDeadlines.length;

    // Card 3: At-Risk Modules
    const moduleScores = {};
    data.scores.forEach(s => {
        if (!moduleScores[s.code_module]) moduleScores[s.code_module] = [];
        moduleScores[s.code_module].push(Number(s.score));
    });

    const atRiskModules = Object.entries(moduleScores).filter(([mod, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return avg < 40;
    });
    document.getElementById('atRiskCount').textContent = atRiskModules.length;

    // Card 4: Study Streak
    if (data.activity && data.activity.length > 0) {
        const streak = calculateStreak(data.activity);
        document.getElementById('streakCount').textContent = streak.current;

        const streakBadge = document.getElementById('streakBadge');
        if (streak.current >= 7) {
            streakBadge.textContent = '🔥🔥🔥 Amazing!';
            streakBadge.className = 'badge bg-success';
        } else if (streak.current >= 3) {
            streakBadge.textContent = '🔥 Good!';
            streakBadge.className = 'badge bg-info';
        } else {
            streakBadge.textContent = '💤 Build it!';
            streakBadge.className = 'badge bg-warning';
        }
    }
}
function calculateStreak(activity) {
    if (!activity || activity.length === 0) return { current: 0, max: 0 };

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

    return { current: currentStreak, max: maxStreak };
}

// Card 1: Show Module Breakdown
function showModuleBreakdown() {
    const data = window.studentData;
    const moduleScores = {};

    data.scores.forEach(s => {
        if (!moduleScores[s.code_module]) {
            moduleScores[s.code_module] = {
                scores: [],
                code: s.code_module,
                presentation: s.code_presentation
            };
        }
        moduleScores[s.code_module].scores.push(Number(s.score));
    });

    document.getElementById('totalModules').textContent = Object.keys(moduleScores).length;

    // Render module list
    const html = Object.values(moduleScores).map(mod => {
        const avg = mod.scores.reduce((a, b) => a + b, 0) / mod.scores.length;
        let status, statusClass, icon;

        if (avg >= 60) {
            status = 'PASS';
            statusClass = 'pass';
            icon = '✅';
        } else if (avg >= 40) {
            status = 'RISK';
            statusClass = 'warning';
            icon = '⚠️';
        } else {
            status = 'FAIL';
            statusClass = 'fail';
            icon = '❌';
        }

        return `
            <div class="module-item ${statusClass}" onclick='selectModule(${JSON.stringify(mod)})'>
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-1">${icon} ${mod.code} - Module ${mod.code}</h5>
                        <small class="text-muted">${mod.presentation}</small>
                    </div>
                    <div class="text-end">
                        <h4 class="mb-0">${avg.toFixed(1)}%</h4>
                        <span class="badge bg-${statusClass === 'pass' ? 'success' : statusClass === 'warning' ? 'warning' : 'danger'}">${status}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('modulesList').innerHTML = html;

    // Render interactive performance trend chart
    renderPerformanceTrendChart(moduleScores);

    navigateTo('page-modules');
}

// ============================================
// INTERACTIVE PERFORMANCE TREND CHART
// ============================================
function renderPerformanceTrendChart(moduleScores) {
    const data = window.studentData;

    // Destroy existing chart
    if (performanceTrendChartInstance) {
        performanceTrendChartInstance.destroy();
    }

    const ctx = document.getElementById('performanceTrendChart');
    if (!ctx) return;

    // Prepare datasets for each module
    const datasets = Object.entries(moduleScores).map(([moduleCode, moduleData]) => {
        const moduleAssessments = data.scores
            .filter(s => s.code_module === moduleCode)
            .sort((a, b) => a.date_submitted - b.date_submitted)
            .map((s, idx) => ({
                x: Number(s.date_submitted),
                y: Number(s.score),
                assessment: `Assessment ${idx + 1}`,
                moduleCode: moduleCode,
                assessmentData: s
            }));

        const color = getColorForModule(moduleCode);

        return {
            label: moduleCode,
            data: moduleAssessments,
            borderColor: color,
            backgroundColor: color,
            borderWidth: 3,
            pointRadius: 8,
            pointHoverRadius: 12,
            tension: 0.3,
            fill: false
        };
    });

    performanceTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const element = elements[0];
                    const datasetIndex = element.datasetIndex;
                    const dataIndex = element.index;
                    const clickedData = datasets[datasetIndex].data[dataIndex];

                    // Show assessment detail
                    showAssessmentDetailFromChart(clickedData);
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 14, weight: 'bold' },
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    callbacks: {
                        title: (items) => {
                            const item = items[0];
                            return `${item.dataset.label} - ${item.raw.assessment}`;
                        },
                        label: (context) => {
                            return [
                                `Score: ${context.parsed.y}%`,
                                `Day: ${context.parsed.x}`,
                                '',
                                '👆 Click to view details'
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Days since course start',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Score (%)',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => value + '%'
                    }
                }
            }
        }
    });
}

function showAssessmentDetailFromChart(clickedData) {
    // Store the module context
    currentModule = {
        code: clickedData.moduleCode,
        scores: window.studentData.scores.filter(s => s.code_module === clickedData.moduleCode)
    };

    // Find assessment number
    const moduleScores = window.studentData.scores
        .filter(s => s.code_module === clickedData.moduleCode)
        .sort((a, b) => a.date_submitted - b.date_submitted);

    const assessmentNumber = moduleScores.findIndex(s =>
        s.date_submitted === clickedData.assessmentData.date_submitted
    ) + 1;

    // Show assessment detail page
    showAssessmentDetail(clickedData.assessmentData, assessmentNumber);
}

function selectModule(moduleData) {
    currentModule = moduleData;
    showModuleDetail(moduleData);
}

// Card 2: Show All Deadlines
function showAllDeadlines() {
    alert('Deadlines page - Coming in Part 5!');
    // We'll implement this in Part 5
}

// ============================================
// PAGE: AT-RISK MODULES
// ============================================
function showAtRiskModules() {
    const data = window.studentData;

    const moduleScores = {};
    data.scores.forEach(s => {
        if (!moduleScores[s.code_module]) {
            moduleScores[s.code_module] = [];
        }
        moduleScores[s.code_module].push(Number(s.score));
    });

    const atRiskModules = Object.entries(moduleScores)
        .filter(([mod, scores]) => {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            return avg < 60; // Show both failing and at-risk
        })
        .map(([mod, scores]) => ({
            code: mod,
            scores: scores,
            avg: scores.reduce((a, b) => a + b, 0) / scores.length
        }))
        .sort((a, b) => a.avg - b.avg); // Worst first

    // Create page if doesn't exist
    let atRiskPage = document.getElementById('page-atrisk');
    if (!atRiskPage) {
        const contentDiv = document.querySelector('.content');
        atRiskPage = document.createElement('div');
        atRiskPage.id = 'page-atrisk';
        atRiskPage.className = 'page-container';
        atRiskPage.innerHTML = `
            <button class="btn btn-light mb-3" onclick="navigateTo('page-main')">
                <i class="bi bi-arrow-left me-2"></i> Back to Dashboard
            </button>
            <div class="card">
                <div class="card-header bg-danger text-white">
                    <h4 class="mb-0">⚠️ At-Risk Modules</h4>
                </div>
                <div class="card-body" id="atRiskContent"></div>
            </div>
        `;
        contentDiv.appendChild(atRiskPage);
    }

    if (atRiskModules.length === 0) {
        document.getElementById('atRiskContent').innerHTML = `
            <div class="alert alert-success text-center">
                <i class="bi bi-check-circle fs-1"></i>
                <h4 class="mt-3">All Modules on Track!</h4>
                <p class="mb-0">You're performing well in all your modules. Keep up the great work!</p>
            </div>
        `;
        navigateTo('page-atrisk');
        return;
    }

    const content = `
        <div class="alert alert-warning">
            <strong><i class="bi bi-exclamation-triangle me-2"></i>Action Needed:</strong>
            You have ${atRiskModules.length} module${atRiskModules.length !== 1 ? 's' : ''} that need attention.
        </div>

        ${atRiskModules.map(mod => {
        const status = mod.avg < 40 ? 'danger' : 'warning';
        const icon = mod.avg < 40 ? '❌' : '⚠️';
        const failedCount = mod.scores.filter(s => s < 40).length;

        return `
                <div class="card mb-3 border-${status}">
                    <div class="card-header bg-${status} text-white">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">${icon} ${mod.code}</h5>
                            <h4 class="mb-0">${mod.avg.toFixed(1)}%</h4>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <p class="mb-1"><i class="bi bi-clipboard-data me-2"></i><strong>Assessments:</strong> ${mod.scores.length} completed</p>
                                <p class="mb-1"><i class="bi bi-x-circle me-2 text-danger"></i><strong>Failed:</strong> ${failedCount} assessment${failedCount !== 1 ? 's' : ''}</p>
                                <p class="mb-0"><i class="bi bi-graph-down me-2 text-${status}"></i><strong>Status:</strong> ${mod.avg < 40 ? 'Below Passing' : 'At Risk'}</p>
                            </div>
                            <div class="col-md-6">
                                <div class="progress" style="height: 30px;">
                                    <div class="progress-bar bg-${status}" style="width: ${mod.avg}%">
                                        ${mod.avg.toFixed(1)}%
                                    </div>
                                </div>
                                <small class="text-muted mt-1 d-block">
                                    ${mod.avg < 40
                ? `Need ${(40 - mod.avg).toFixed(1)}% to pass`
                : `${(60 - mod.avg).toFixed(1)}% from Merit`}
                                </small>
                            </div>
                        </div>
                        
                        <button class="btn btn-${status}" onclick='showRecoveryPlan("${mod.code}", ${mod.avg}, ${mod.scores.length})'>
                            <i class="bi bi-clipboard-check me-2"></i>
                            View Recovery Plan →
                        </button>
                    </div>
                </div>
            `;
    }).join('')}
    `;

    document.getElementById('atRiskContent').innerHTML = content;
    navigateTo('page-atrisk');
}

function showRecoveryPlan(moduleCode, currentAvg, completedAssessments) {
    // Create recovery page if doesn't exist
    let recoveryPage = document.getElementById('page-recovery');
    if (!recoveryPage) {
        const contentDiv = document.querySelector('.content');
        recoveryPage = document.createElement('div');
        recoveryPage.id = 'page-recovery';
        recoveryPage.className = 'page-container';
        recoveryPage.innerHTML = `
            <button class="btn btn-light mb-3" onclick="navigateTo('page-atrisk')">
                <i class="bi bi-arrow-left me-2"></i> Back to At-Risk Modules
            </button>
            <div class="card">
                <div class="card-header bg-success text-white">
                    <h4 class="mb-0" id="recoveryTitle"></h4>
                </div>
                <div class="card-body" id="recoveryContent"></div>
            </div>
        `;
        contentDiv.appendChild(recoveryPage);
    }

    document.getElementById('recoveryTitle').textContent =
        `🎯 Recovery Plan: ${moduleCode}`;

    const targetScore = 40;
    const remainingAssessments = 2; // Assume 2 remaining

    const content = `
        <div class="alert alert-info">
            <h5 class="mb-2"><i class="bi bi-info-circle me-2"></i>Goal</h5>
            <p class="mb-0">Raise your ${moduleCode} average from ${currentAvg.toFixed(1)}% to ${targetScore}% (Passing Grade)</p>
        </div>

        <div class="row mb-4">
            <div class="col-md-4 text-center">
                <div class="card bg-light">
                    <div class="card-body">
                        <h6 class="text-muted">Completed</h6>
                        <h2>${completedAssessments}</h2>
                        <small>assessments</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4 text-center">
                <div class="card bg-warning">
                    <div class="card-body">
                        <h6>Remaining</h6>
                        <h2>${remainingAssessments}</h2>
                        <small>assessments</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4 text-center">
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <h6>Score Needed</h6>
                        <h2>${Math.max(0, Math.round((targetScore * (completedAssessments + remainingAssessments) - currentAvg * completedAssessments) / remainingAssessments))}%</h2>
                        <small>on remaining</small>
                    </div>
                </div>
            </div>
        </div>

        <h5 class="mb-3">🧮 Recovery Simulator</h5>
        <div class="card bg-light mb-4">
            <div class="card-body">
                <p class="mb-2">What if you score this on remaining assessments:</p>
                <input type="range" class="form-range" min="0" max="100" value="60" 
                       id="recoveryScore" oninput="updateRecoveryCalculation(${currentAvg}, ${completedAssessments}, ${remainingAssessments})">
                <div class="text-center mb-2">
                    <span class="badge bg-primary" style="font-size: 1.5rem;" id="recoveryScoreDisplay">60%</span>
                </div>
                <div id="recoveryResult"></div>
            </div>
        </div>

        <h5 class="mb-3">✅ Immediate Actions</h5>
        <div class="list-group mb-4">
            <div class="list-group-item">
                <div class="d-flex align-items-start">
                    <div class="me-3">
                        <span class="badge bg-danger rounded-circle" style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">1</span>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">Book Emergency Tutor Session</h6>
                        <p class="mb-1 small text-muted">Get immediate help on your weakest topics</p>
                        <button class="btn btn-sm btn-danger" onclick="alert('Booking tutor...')">Book Now</button>
                    </div>
                </div>
            </div>
            <div class="list-group-item">
                <div class="d-flex align-items-start">
                    <div class="me-3">
                        <span class="badge bg-warning rounded-circle" style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">2</span>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">Review All Failed Assessments</h6>
                        <p class="mb-1 small text-muted">Understand where you went wrong</p>
                        <button class="btn btn-sm btn-warning" onclick="showModuleBreakdown()">View Assessments</button>
                    </div>
                </div>
            </div>
            <div class="list-group-item">
                <div class="d-flex align-items-start">
                    <div class="me-3">
                        <span class="badge bg-info rounded-circle" style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">3</span>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">Complete Practice Problems</h6>
                        <p class="mb-1 small text-muted">Build confidence with extra practice</p>
                        <button class="btn btn-sm btn-info" onclick="alert('Opening practice materials...')">Start Practice</button>
                    </div>
                </div>
            </div>
        </div>

        <h5 class="mb-3">📚 Study Resources</h5>
        <div class="row g-3">
            <div class="col-md-4">
                <div class="card">
                    <div class="card-body text-center">
                        <i class="bi bi-play-circle text-primary" style="font-size: 3rem;"></i>
                        <h6 class="mt-2">Lecture Recordings</h6>
                        <button class="btn btn-sm btn-outline-primary">Access</button>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card">
                    <div class="card-body text-center">
                        <i class="bi bi-file-text text-success" style="font-size: 3rem;"></i>
                        <h6 class="mt-2">Course Notes</h6>
                        <button class="btn btn-sm btn-outline-success">Download</button>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card">
                    <div class="card-body text-center">
                        <i class="bi bi-people text-info" style="font-size: 3rem;"></i>
                        <h6 class="mt-2">Study Group</h6>
                        <button class="btn btn-sm btn-outline-info">Join</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('recoveryContent').innerHTML = content;
    updateRecoveryCalculation(currentAvg, completedAssessments, remainingAssessments);
    navigateTo('page-recovery');
}

function updateRecoveryCalculation(currentAvg, completed, remaining) {
    const score = document.getElementById('recoveryScore')?.value || 60;
    const display = document.getElementById('recoveryScoreDisplay');
    const result = document.getElementById('recoveryResult');

    if (display) display.textContent = score + '%';
    if (!result) return;

    const newAvg = (currentAvg * completed + Number(score) * remaining) / (completed + remaining);
    const status = newAvg >= 60 ? 'success' : newAvg >= 40 ? 'warning' : 'danger';
    const statusText = newAvg >= 60 ? 'Merit!' : newAvg >= 40 ? 'Pass' : 'Still Failing';

    result.innerHTML = `
        <div class="alert alert-${status} mt-3">
            <div class="row text-center">
                <div class="col-6">
                    <h6 class="text-muted">Final Average</h6>
                    <h2>${newAvg.toFixed(1)}%</h2>
                </div>
                <div class="col-6">
                    <h6 class="text-muted">Status</h6>
                    <h2>${statusText}</h2>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// PAGE: STUDY STREAK PATTERN
// ============================================
function showStudyStreak() {
    const data = window.studentData;

    if (!data.activity || data.activity.length === 0) {
        alert('No activity data available');
        return;
    }

    const streak = calculateStreak(data.activity);

    // Calculate weekly activity
    const weeklyActivity = {};
    data.activity.forEach(a => {
        const week = Math.floor(Number(a.date) / 7) + 1;
        if (!weeklyActivity[week]) weeklyActivity[week] = 0;
        weeklyActivity[week] += Number(a.sum_click);
    });

    // Get last 7 days
    const sortedActivity = [...data.activity].sort((a, b) => Number(b.date) - Number(a.date));
    const last7Days = sortedActivity.slice(0, 7).reverse();

    // Create page if doesn't exist
    let streakPage = document.getElementById('page-streak');
    if (!streakPage) {
        const contentDiv = document.querySelector('.content');
        streakPage = document.createElement('div');
        streakPage.id = 'page-streak';
        streakPage.className = 'page-container';
        streakPage.innerHTML = `
            <button class="btn btn-light mb-3" onclick="navigateTo('page-main')">
                <i class="bi bi-arrow-left me-2"></i> Back to Dashboard
            </button>
            <div class="card">
                <div class="card-header bg-info text-white">
                    <h4 class="mb-0">🔥 Your Study Pattern</h4>
                </div>
                <div class="card-body" id="streakContent"></div>
            </div>
        `;
        contentDiv.appendChild(streakPage);
    }

    const activeDays = data.activity.length;
    const totalDays = Math.max(...data.activity.map(a => Number(a.date)));
    const consistency = (activeDays / totalDays * 100);

    let streakIcon, streakColor, message;
    if (streak.current >= 7) {
        streakIcon = '🔥🔥🔥';
        streakColor = 'success';
        message = 'Amazing! You\'re on fire! Keep this momentum going!';
    } else if (streak.current >= 3) {
        streakIcon = '🔥';
        streakColor = 'info';
        message = 'Good consistency! Try to maintain your streak!';
    } else {
        streakIcon = '💤';
        streakColor = 'warning';
        message = 'Let\'s build a longer study streak!';
    }

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const content = `
        <div class="text-center mb-5">
            <div style="font-size: 5rem;">${streakIcon}</div>
            <h2 class="mt-3 text-${streakColor}">Current Streak: ${streak.current} Days</h2>
            <p class="text-muted">Best Streak: ${streak.max} days</p>
        </div>

        <div 9:03 PMclass="row text-center mb-5">
<div class="col-4">
<div class="card bg-light">
<div class="card-body">
<h3 class="text-primary">${streak.max}</h3>
<small>Best Streak</small>
</div>
</div>
</div>
<div class="col-4">
<div class="card bg-light">
<div class="card-body">
<h3 class="text-success">${activeDays}</h3>
<small>Active Days</small>
</div>
</div>
</div>
<div class="col-4">
<div class="card bg-light">
<div class="card-body">
<h3 class="text-info">${consistency.toFixed(0)}%</h3>
<small>Consistency</small>
</div>
</div>
</div>
</div>
    <h5 class="mb-3">📅 Last 7 Days Activity</h5>
    <div class="row g-2 mb-4">
        ${last7Days.map((a, idx) => {
        const clicks = Number(a.sum_click);
        const height = Math.min((clicks / 100) * 100, 100);
        return `
                <div class="col text-center">
                    <div class="card" style="cursor: pointer;" onclick="alert('Day ${a.date}: ${clicks} clicks')">
                        <div class="card-body p-2">
                            <div class="mb-2" style="height: 100px; display: flex; align-items: flex-end; justify-content: center;">
                                <div style="width: 40px; height: ${height}px; background: linear-gradient(to top, #0d6efd, #0dcaf0); border-radius: 5px;"></div>
                            </div>
                            <small class="d-block"><strong>${days[idx % 7]}</strong></small>
                            <small class="text-muted">${clicks}</small>
                        </div>
                    </div>
                </div>
            `;
    }).join('')}
    </div>

    <div class="alert alert-${streakColor}">
        <i class="bi bi-lightbulb me-2"></i>
        <strong>${message}</strong>
    </div>

    <h5 class="mb-3">📊 Module Engagement</h5>
    ${Object.entries(groupActivityByModule(data)).map(([mod, clicks]) => {
        const color = clicks > 100 ? 'success' : clicks > 50 ? 'info' : 'warning';
        const percent = Math.min((clicks / 150) * 100, 100);
        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                    <span><strong>${mod}</strong></span>
                    <span class="text-${color}">${clicks} clicks/week</span>
                </div>
                <div class="progress" style="height: 25px;">
                    <div class="progress-bar bg-${color}" style="width: ${percent}%">
                        ${percent.toFixed(0)}%
                    </div>
                </div>
            </div>
        `;
    }).join('')}
`;

    document.getElementById('streakContent').innerHTML = content;
    navigateTo('page-streak');
}
function groupActivityByModule(data) {
    // Simplified - in real app, you'd match activity to modules
    const modules = [...new Set(data.scores.map(s => s.code_module))];
    const result = {};
    modules.forEach((mod, idx) => {
        result[mod] = Math.floor(Math.random() * 100) + 50; // Simulated
    });
    return result;
}

// ============================================
// PAGE: FULL PERFORMANCE REPORT
// ============================================
function showFullReport() {
    const data = window.studentData;

    // Create page if doesn't exist
    let reportPage = document.getElementById('page-full-report');
    if (!reportPage) {
        const contentDiv = document.querySelector('.content');
        reportPage = document.createElement('div');
        reportPage.id = 'page-full-report';
        reportPage.className = 'page-container';
        reportPage.innerHTML = `
            <button class="btn btn-light mb-3" onclick="navigateTo('page-main')">
                <i class="bi bi-arrow-left me-2"></i> Back to Dashboard
            </button>
            <div class="card">
                <div class="card-header bg-dark text-white">
                    <h4 class="mb-0">📊 Complete Performance Report</h4>
                </div>
                <div class="card-body" id="fullReportContent"></div>
            </div>
        `;
        contentDiv.appendChild(reportPage);
    }

    const avgScore = data.scores.reduce((sum, s) => sum + Number(s.score), 0) / data.scores.length;
    const passed = data.scores.filter(s => Number(s.score) >= 40).length;
    const failed = data.scores.length - passed;

    const moduleStats = {};
    data.scores.forEach(s => {
        if (!moduleStats[s.code_module]) {
            moduleStats[s.code_module] = [];
        }
        moduleStats[s.code_module].push(Number(s.score));
    });

    const content = `
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h2>${avgScore.toFixed(1)}%</h2>
                        <small>Overall Average</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h2>${passed}</h2>
                        <small>Passed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-danger text-white">
                    <div class="card-body text-center">
                        <h2>${failed}</h2>
                        <small>Failed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h2>${Object.keys(moduleStats).length}</h2>
                        <small>Modules</small>
                    </div>
                </div>
            </div>
        </div>

        <h5 class="mb-3">📚 Module Summary</h5>
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Module</th>
                        <th>Assessments</th>
                        <th>Average</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(moduleStats).map(([mod, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const status = avg >= 60 ? 'Pass' : avg >= 40 ? 'Pass' : 'Fail';
        const color = avg >= 60 ? 'success' : avg >= 40 ? 'warning' : 'danger';
        return `
                            <tr>
                                <td><strong>${mod}</strong></td>
                                <td>${scores.length}</td>
                                <td>${avg.toFixed(1)}%</td>
                                <td><span class="badge bg-${color}">${status}</span></td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="text-center mt-4">
            <button class="btn btn-primary" onclick="window.print()">
                <i class="bi bi-printer me-2"></i>
                Print Report
            </button>
        </div>
    `;

    document.getElementById('fullReportContent').innerHTML = content;
    navigateTo('page-full-report');
}


// ============================================
// PAGE 3: MODULE DETAIL
// ============================================
function showModuleDetail(moduleData) {
    const data = window.studentData;
    const moduleScores = data.scores
        .filter(s => s.code_module === moduleData.code)
        .sort((a, b) => a.date_submitted - b.date_submitted);

    const avg = moduleScores.reduce((sum, s) => sum + Number(s.score), 0) / moduleScores.length;

    // Update header
    document.getElementById('moduleDetailTitle').textContent =
        `📚 ${moduleData.code} - Module Details`;

    // Update stats
    document.getElementById('moduleAvg').textContent = avg.toFixed(1) + '%';
    document.getElementById('moduleAvg').className = avg >= 40 ? 'display-3 text-success' : 'display-3 text-danger';

    const status = avg >= 80 ? 'Distinction' : avg >= 60 ? 'Merit' : avg >= 40 ? 'Pass' : 'Fail';
    const statusClass = avg >= 40 ? 'text-success' : 'text-danger';
    document.getElementById('moduleStatus').innerHTML =
        `<span class="${statusClass}">${avg >= 40 ? '✅' : '❌'} ${status}</span>`;

    document.getElementById('moduleAssessmentCount').textContent =
        `${moduleScores.length} completed`;

    // Render Assessment Bar Chart (clickable)
    renderAssessmentBarChart(moduleScores, moduleData.code);

    // Render Engagement Line Chart (clickable)
    renderEngagementLineChart(moduleData.code);

    // Recommended Actions
    const recommendations = [];
    if (avg < 40) {
        recommendations.push(`
            <div class="alert alert-danger border-start border-5 border-danger">
                <i class="bi bi-person-video2 fs-4 me-2"></i>
                <strong>Urgent: Book Tutor Session</strong>
                <p class="mb-0 small">Your average is below passing grade. Get 1-on-1 help immediately.</p>
            </div>
        `);
    }
    if (avg < 60) {
        recommendations.push(`
            <div class="alert alert-warning border-start border-5 border-warning">
                <i class="bi bi-book fs-4 me-2"></i>
                <strong>Review Course Materials</strong>
                <p class="mb-0 small">Focus on weeks where you scored below 60%.</p>
            </div>
        `);
    } else {
        recommendations.push(`
            <div class="alert alert-success border-start border-5 border-success">
                <i class="bi bi-trophy fs-4 me-2"></i>
                <strong>Great Work!</strong>
                <p class="mb-0 small">Keep up the excellent performance!</p>
            </div>
        `);
    }

    document.getElementById('recommendedActions').innerHTML = recommendations.join('');

    navigateTo('page-module-detail');
}

// ============================================
// ASSESSMENT BAR CHART (Clickable)
// ============================================
function renderAssessmentBarChart(moduleScores, moduleCode) {
    if (assessmentBarChartInstance) {
        assessmentBarChartInstance.destroy();
    }

    const ctx = document.getElementById('assessmentBarChart');
    if (!ctx) return;

    const labels = moduleScores.map((_, idx) => `Assessment ${idx + 1}`);
    const scores = moduleScores.map(s => Number(s.score));
    const colors = scores.map(score =>
        score >= 60 ? '#198754' : score >= 40 ? '#ffc107' : '#dc3545'
    );

    assessmentBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score',
                data: scores,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const assessment = moduleScores[index];
                    showAssessmentDetail(assessment, index + 1);
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const score = context.parsed.y;
                            const status = score >= 60 ? '✅ Pass' : score >= 40 ? '⚠️ Pass' : '❌ Fail';
                            return [
                                `Score: ${score}%`,
                                `Status: ${status}`,
                                '',
                                '👆 Click for details'
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Score (%)',
                        font: { weight: 'bold' }
                    },
                    ticks: {
                        callback: (value) => value + '%'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Click any bar to see detailed breakdown',
                        font: { weight: 'bold', style: 'italic' },
                        color: '#0d6efd'
                    }
                }
            }
        }
    });
}

// ============================================
// ENGAGEMENT LINE CHART (Clickable)
// ============================================
function renderEngagementLineChart(moduleCode) {
    if (engagementLineChartInstance) {
        engagementLineChartInstance.destroy();
    }

    const ctx = document.getElementById('engagementLineChart');
    if (!ctx) return;

    const data = window.studentData;

    // Group activity by weeks (every 7 days)
    const weeklyActivity = {};
    if (data.activity) {
        data.activity.forEach(a => {
            const week = Math.floor(Number(a.date) / 7) + 1;
            if (!weeklyActivity[week]) weeklyActivity[week] = 0;
            weeklyActivity[week] += Number(a.sum_click);
        });
    }

    const weeks = Object.keys(weeklyActivity).sort((a, b) => a - b);
    const clicks = weeks.map(w => weeklyActivity[w]);

    engagementLineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: weeks.map(w => `Week ${w}`),
            datasets: [{
                label: 'VLE Clicks',
                data: clicks,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 10,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const week = weeks[index];
                    const clickCount = clicks[index];
                    showWeekDetail(week, clickCount);
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return [
                                `Clicks: ${context.parsed.y}`,
                                '',
                                '👆 Click to see weekly activity'
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Clicks',
                        font: { weight: 'bold' }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Click any point to see weekly details',
                        font: { weight: 'bold', style: 'italic' },
                        color: '#0d6efd'
                    }
                }
            }
        }
    });
}

function showWeekDetail(week, clickCount) {
    const avgClicks = 120; // You can calculate this from data
    const comparison = clickCount >= avgClicks ? 'above' : 'below';
    const color = clickCount >= avgClicks ? 'success' : 'warning';

    alert(`📊 Week ${week} Activity
    
Your clicks: ${clickCount}
Class average: ${avgClicks}

You are ${comparison} average!

${clickCount < avgClicks ? '💡 Tip: Try to increase engagement by accessing more course materials.' : '✅ Great job staying engaged!'}`);
}

// ============================================
// PAGE 4: ASSESSMENT DETAIL
// ============================================
function showAssessmentDetail(assessment, number) {
    currentAssessment = { ...assessment, number };

    const scoreClass = assessment.score >= 60 ? 'text-success' :
        assessment.score >= 40 ? 'text-warning' : 'text-danger';

    const statusIcon = assessment.score >= 60 ? '✅' :
        assessment.score >= 40 ? '⚠️' : '❌';

    document.getElementById('assessmentDetailTitle').textContent =
        `Assessment ${number} - ${assessment.code_module}`;

    // Generate topic breakdown (simulated data)
    const topics = generateTopicBreakdown(assessment.score);

    const content = `
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="text-center p-4 bg-light rounded">
                    <h6 class="text-muted mb-2">Your Score</h6>
                    <h1 class="display-1 ${scoreClass}">${assessment.score}%</h1>
                    <h4 class="mt-2">${statusIcon} ${assessment.score >= 60 ? 'Good Pass' : assessment.score >= 40 ? 'Pass' : 'Failed'}</h4>
                </div>
            </div>
            <div class="col-md-6">
                <div class="p-4 bg-light rounded">
                    <h6 class="text-muted mb-3">Submission Info</h6>
                    <p class="mb-2">
                        <i class="bi bi-calendar-check text-primary me-2"></i>
                        <strong>Submitted:</strong> Day ${assessment.date_submitted}
                    </p>
                    <p class="mb-2">
                        <i class="bi bi-book text-primary me-2"></i>
                        <strong>Module:</strong> ${assessment.code_module}
                    </p>
                    <p class="mb-2">
                        <i class="bi bi-graph-up text-primary me-2"></i>
                        <strong>Class Average:</strong> 68%
                    </p>
                    <p class="mb-0">
                        <i class="bi bi-award text-primary me-2"></i>
                        <strong>Your Ranking:</strong> ${assessment.score >= 80 ? 'Top 25%' : assessment.score >= 60 ? 'Top 50%' : 'Below Average'}
                    </p>
                </div>
            </div>
        </div>

        <div class="alert alert-info border-start border-5 border-info">
            <h5 class="mb-2"><i class="bi bi-info-circle me-2"></i>📝 What Happened?</h5>
            <ul class="mb-0">
                <li><strong>Submission:</strong> ${assessment.is_banked === 1 ? 'On time ✅' : 'Completed ✅'}</li>
                <li><strong>Estimated Time Spent:</strong> ${assessment.score >= 70 ? '45-60 minutes' : '15-30 minutes'} 
                    <small class="text-muted">(Class avg: 45 min)</small>
                </li>
                <li><strong>VLE Materials Accessed:</strong> ${assessment.score >= 70 ? '8/10 resources' : '2/10 resources'}</li>
            </ul>
        </div>

        <h4 class="mb-3 mt-4">🎯 Topic Breakdown</h4>
        <p class="text-muted mb-3">Click on any bar to see detailed question analysis</p>
        
        <div class="chart-container mb-4">
            <canvas id="topicBreakdownChart"></canvas>
        </div>

        <div id="topicDetailSection"></div>

        <h4 class="mb-3 mt-5">💡 How to Improve</h4>
        <div class="row g-3">
            <div class="col-md-4">
                <div class="card h-100 border-primary" style="cursor: pointer;" onclick="alert('Opening lecture materials...')">
                    <div class="card-body text-center">
                        <i class="bi bi-play-circle text-primary" style="font-size: 3rem;"></i>
                        <h5 class="mt-3">📖 Review Lectures</h5>
                        <p class="text-muted mb-0 small">Watch Week ${Math.floor(assessment.date_submitted / 7)} lectures again</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card h-100 border-info" style="cursor: pointer;" onclick="alert('Booking tutor session...')">
                    <div class="card-body text-center">
                        <i class="bi bi-person-video text-info" style="font-size: 3rem;"></i>
                        <h5 class="mt-3">🎓 Book Tutor</h5>
                        <p class="text-muted mb-0 small">Get 1-on-1 help on weak topics</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card h-100 border-success" style="cursor: pointer;" onclick="alert('Opening practice quiz...')">
                    <div class="card-body text-center">
                        <i class="bi bi-pencil-square text-success" style="font-size: 3rem;"></i>
                        <h5 class="mt-3">📝 Practice Quiz</h5>
                        <p class="text-muted mb-0 small">Test yourself on similar questions</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-4">
            <h4 class="mb-3">🧮 Grade Impact Calculator</h4>
            <div class="card bg-light">
                <div class="card-body">
                    <p class="mb-3">If you could retake this assessment, what score would you need?</p>
                    
                    <label class="form-label"><strong>Target Score:</strong></label>
                    <input type="range" class="form-range" min="0" max="100" value="${Math.min(assessment.score + 20, 100)}" 
                           id="retakeScore" oninput="updateRetakeCalculation()">
                    <div class="text-center mb-3">
                        <span class="badge bg-primary" style="font-size: 1.5rem;" id="retakeScoreDisplay">${Math.min(assessment.score + 20, 100)}%</span>
                    </div>
                    
                    <div id="retakeResult" class="alert alert-info"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('assessmentDetailContent').innerHTML = content;

    // Render topic breakdown chart
    renderTopicBreakdownChart(topics, assessment);

    // Initialize retake calculator
    updateRetakeCalculation();

    navigateTo('page-assessment-detail');
}

// Helper function to navigate back
function navigateToModuleDetail() {
    if (currentModule) {
        showModuleDetail(currentModule);
    }
}

// Generate simulated topic breakdown based on score
function generateTopicBreakdown(overallScore) {
    const topics = [
        'Basic Concepts',
        'Advanced Theory',
        'Practical Application'
    ];

    // Generate scores based on overall performance
    return topics.map(topic => {
        // Add some variance to make it realistic
        const variance = (Math.random() - 0.5) * 20;
        let score = Math.max(0, Math.min(100, overallScore + variance));
        return {
            topic: topic,
            score: Math.round(score),
            questions: Math.floor(Math.random() * 5) + 5 // 5-10 questions
        };
    });
}

// ============================================
// TOPIC BREAKDOWN CHART (Clickable Bars)
// ============================================
let topicBreakdownChartInstance = null;

function renderTopicBreakdownChart(topics, assessment) {
    if (topicBreakdownChartInstance) {
        topicBreakdownChartInstance.destroy();
    }

    const ctx = document.getElementById('topicBreakdownChart');
    if (!ctx) return;

    const labels = topics.map(t => t.topic);
    const scores = topics.map(t => t.score);
    const classAvg = topics.map(t => Math.min(t.score + 20, 95)); // Simulated class average

    const colors = scores.map(score =>
        score >= 60 ? '#198754' : score >= 40 ? '#ffc107' : '#dc3545'
    );

    topicBreakdownChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Your Score',
                    data: scores,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 2
                },
                {
                    label: 'Class Average',
                    data: classAvg,
                    backgroundColor: 'rgba(13, 110, 253, 0.3)',
                    borderColor: '#0d6efd',
                    borderWidth: 2,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const topic = topics[index];
                    showTopicDetail(topic);
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        afterLabel: () => {
                            return '\n👆 Click to see question breakdown';
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Score (%)',
                        font: { weight: 'bold' }
                    },
                    ticks: {
                        callback: (value) => value + '%'
                    }
                }
            }
        }
    });
}

function showTopicDetail(topic) {
    const detailSection = document.getElementById('topicDetailSection');

    const status = topic.score >= 60 ? 'success' : topic.score >= 40 ? 'warning' : 'danger';
    const icon = topic.score >= 60 ? '✅' : topic.score >= 40 ? '⚠️' : '❌';

    const correct = Math.round((topic.score / 100) * topic.questions);
    const incorrect = topic.questions - correct;

    detailSection.innerHTML = `
        <div class="alert alert-${status} border-start border-5 border-${status}">
            <h5 class="mb-3">${icon} ${topic.topic}: ${topic.score}% (${correct}/${topic.questions} correct)</h5>
            
            <div class="mb-3">
                <strong>Performance Analysis:</strong>
                <div class="progress mt-2" style="height: 25px;">
                    <div class="progress-bar bg-${status}" style="width: ${topic.score}%">
                        ${topic.score}%
                    </div>
                </div>
            </div>
            
            <p class="mb-2"><strong>Questions Breakdown:</strong></p>
            <ul class="mb-3">
                <li>✅ Correct: ${correct} questions</li>
                <li>❌ Incorrect: ${incorrect} questions</li>
                ${topic.score < 60 ? '<li>💡 <strong>Common mistake:</strong> Review fundamental concepts</li>' : ''}
            </ul>
            
            ${topic.score < 60 ? `
                <button class="btn btn-${status}" onclick="alert('Opening practice materials for ${topic.topic}...')">
                    <i class="bi bi-book me-2"></i>
                    Practice This Topic
                </button>
            ` : `
                <p class="text-success mb-0">
                    <i class="bi bi-check-circle me-2"></i>
                    Great work on this topic! Keep it up.
                </p>
            `}
        </div>
    `;

    // Scroll to show the detail
    detailSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================
// RETAKE CALCULATOR
// ============================================
function updateRetakeCalculation() {
    const retakeScore = document.getElementById('retakeScore')?.value;
    const retakeScoreDisplay = document.getElementById('retakeScoreDisplay');
    const retakeResult = document.getElementById('retakeResult');

    if (!retakeScore || !retakeResult) return;

    if (retakeScoreDisplay) {
        retakeScoreDisplay.textContent = retakeScore + '%';
    }

    const data = window.studentData;
    const currentAssessmentScore = currentAssessment.score;

    // Calculate what module average would be
    const moduleScores = data.scores.filter(s => s.code_module === currentAssessment.code_module);
    const currentAvg = moduleScores.reduce((sum, s) => sum + Number(s.score), 0) / moduleScores.length;

    // Calculate new average if this assessment score changed
    const newAvg = (currentAvg * moduleScores.length - currentAssessmentScore + Number(retakeScore)) / moduleScores.length;

    const improvement = newAvg - currentAvg;
    const color = improvement > 0 ? 'success' : 'secondary';

    retakeResult.innerHTML = `
        <div class="row text-center">
            <div class="col-4">
                <h6 class="text-muted">Current Module Avg</h6>
                <h3>${currentAvg.toFixed(1)}%</h3>
            </div>
            <div class="col-4">
                <h6 class="text-muted">With Retake</h6>
                <h3 class="text-${color}">${newAvg.toFixed(1)}%</h3>
            </div>
            <div class="col-4">
                <h6 class="text-muted">Change</h6>
                <h3 class="text-${color}">${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%</h3>
            </div>
        </div>
        <hr>
        <p class="mb-0 text-center">
            ${improvement > 0
            ? `<i class="bi bi-arrow-up-circle text-success me-2"></i>This would improve your ${currentAssessment.code_module} average!`
            : `<i class="bi bi-info-circle text-secondary me-2"></i>Current score is already optimal.`
        }
        </p>
    `;
}

// ============================================
// PAGE: ALL DEADLINES & TIMELINE
// ============================================
function showAllDeadlines() {
    const data = window.studentData;
    const currentDay = data.currentDay;

    const critical = data.assessments.filter(a =>
        a.date > currentDay && (a.date - currentDay) < 3
    ).sort((a, b) => a.date - b.date);

    const upcoming = data.assessments.filter(a =>
        a.date > currentDay && (a.date - currentDay) >= 3 && (a.date - currentDay) < 7
    ).sort((a, b) => a.date - b.date);

    const thisMonth = data.assessments.filter(a =>
        a.date > currentDay && (a.date - currentDay) >= 7 && (a.date - currentDay) < 30
    ).sort((a, b) => a.date - b.date);

    const renderDeadlineGroup = (list, title, colorClass) => {
        if (list.length === 0) return '';

        return `
            <div class="mb-4">
                <h5 class="mb-3">${title}</h5>
                ${list.map(a => {
            const daysLeft = a.date - currentDay;
            return `
                        <div class="alert alert-${colorClass} d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">
                                    <i class="bi bi-${a.assessment_type === 'Exam' ? 'clipboard-check' : 'file-text'} me-2"></i>
                                    ${a.assessment_type} - ${a.code_module}
                                </h6>
                                <small class="text-muted">${a.code_presentation} | Day ${a.date}</small>
                            </div>
                            <div class="text-end">
                                <h4 class="mb-1">${daysLeft} days</h4>
                                <button class="btn btn-sm btn-${colorClass}" onclick='showDeadlinePrep(${JSON.stringify(a)})'>
                                    Prepare →
                                </button>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    };

    // Create page content
    const pageContent = document.getElementById('page-deadlines');
    if (!pageContent) {
        // Create the page if it doesn't exist
        const contentDiv = document.querySelector('.content');
        const newPage = document.createElement('div');
        newPage.id = 'page-deadlines';
        newPage.className = 'page-container';
        newPage.innerHTML = `
            <button class="btn btn-light mb-3" onclick="navigateTo('page-main')">
                <i class="bi bi-arrow-left me-2"></i> Back to Dashboard
            </button>
            <div class="card">
                <div class="card-header bg-warning text-dark">
                    <h4 class="mb-0">📅 All Deadlines & Tasks</h4>
                </div>
                <div class="card-body" id="deadlinesContent"></div>
            </div>
        `;
        contentDiv.appendChild(newPage);
    }

    const content = `
        ${renderDeadlineGroup(critical, '🚨 CRITICAL (< 3 days)', 'danger')}
        ${renderDeadlineGroup(upcoming, '⚠️ UPCOMING (< 7 days)', 'warning')}
        ${renderDeadlineGroup(thisMonth, '📅 THIS MONTH', 'info')}
        
        ${critical.length === 0 && upcoming.length === 0 && thisMonth.length === 0 ? `
            <div class="alert alert-success text-center">
                <i class="bi bi-check-circle fs-1"></i>
                <h4 class="mt-3">All Clear!</h4>
                <p class="mb-0">No upcoming deadlines. Great job staying on top of your work!</p>
            </div>
        ` : ''}
        
        <h5 class="mt-5 mb-3">📊 Deadline Timeline</h5>
        <div class="position-relative" style="height: 100px; background: #f8f9fa; border-radius: 10px; padding: 20px;">
            <div class="d-flex justify-content-between align-items-center h-100">
                <div class="text-center">
                    <strong>Today</strong>
                    <div class="text-muted small">Day ${currentDay}</div>
                </div>
                ${[...critical, ...upcoming, ...thisMonth].slice(0, 5).map(a => {
        const daysLeft = a.date - currentDay;
        const position = Math.min((daysLeft / 30) * 100, 100);
        const color = daysLeft < 3 ? 'danger' : daysLeft < 7 ? 'warning' : 'info';
        return `
                        <div style="position: absolute; left: ${position}%;" class="text-center">
                            <div class="badge bg-${color} rounded-circle" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;"
                                 onclick='showDeadlinePrep(${JSON.stringify(a)})'>
                                ${daysLeft}
                            </div>
                            <small class="d-block mt-1">${a.code_module}</small>
                        </div>
                    `;
    }).join('')}
                <div class="text-center">
                    <strong>+30 days</strong>
                    <div class="text-muted small">Day ${currentDay + 30}</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('deadlinesContent').innerHTML = content;
    navigateTo('page-deadlines');
}

function showDeadlinePrep(assessment) {
    const data = window.studentData;
    const currentDay = data.currentDay;
    const daysLeft = assessment.date - currentDay;

    // Create deadline prep page if doesn't exist
    let prepPage = document.getElementById('page-deadline-prep');
    if (!prepPage) {
        const contentDiv = document.querySelector('.content');
        prepPage = document.createElement('div');
        prepPage.id = 'page-deadline-prep';
        prepPage.className = 'page-container';
        prepPage.innerHTML = `
            <button class="btn btn-light mb-3" onclick="navigateTo('page-deadlines')">
                <i class="bi bi-arrow-left me-2"></i> Back to Deadlines
            </button>
            <div class="card">
                <div class="card-header bg-primary text-white">
                    <h4 class="mb-0" id="deadlinePrepTitle"></h4>
                </div>
                <div class="card-body" id="deadlinePrepContent"></div>
            </div>
        `;
        contentDiv.appendChild(prepPage);
    }

    document.getElementById('deadlinePrepTitle').textContent =
        `🎯 ${assessment.assessment_type} Preparation - ${assessment.code_module}`;

    // Get module scores for calculator
    const moduleScores = data.scores.filter(s => s.code_module === assessment.code_module);
    const currentAvg = moduleScores.length > 0
        ? moduleScores.reduce((sum, s) => sum + Number(s.score), 0) / moduleScores.length
        : 0;

    const content = `
        <div class="alert alert-${daysLeft < 3 ? 'danger' : 'warning'} text-center">
            <h3 class="mb-0">Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} ${daysLeft < 3 ? '🔥' : '⏰'}</h3>
        </div>

        <div class="row mb-4">
            <div class="col-md-6">
                <h5 class="mb-3">📚 Topics to Study</h5>
                <div class="list-group">
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <span>Week ${Math.floor(assessment.date / 7) - 1} Materials</span>
                        <span class="badge bg-success">Ready</span>
                    </div>
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <span>Week ${Math.floor(assessment.date / 7)} Materials</span>
                        <span class="badge bg-warning">Review Needed</span>
                    </div>
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <span>Practice Problems</span>
                        <span class="badge bg-info">Available</span>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <h5 class="mb-3">🧮 Grade Impact Calculator</h5>
                <div class="card bg-light">
                    <div class="card-body">
                        <p class="mb-2"><strong>Current ${assessment.code_module} Average:</strong> ${currentAvg.toFixed(1)}%</p>
                        
                        <label class="form-label">Predicted Score:</label>
                        <input type="range" class="form-range" min="0" max="100" value="70" 
                               id="prepScore" oninput="updatePrepCalculation('${assessment.code_module}', ${currentAvg}, ${moduleScores.length})">
                        <div class="text-center mb-2">
                            <span class="badge bg-primary" style="font-size: 1.2rem;" id="prepScoreDisplay">70%</span>
                        </div>
                        
                        <div id="prepResult"></div>
                    </div>
                </div>
            </div>
        </div>

        <h5 class="mb-3">📅 Study Plan (${daysLeft} days)</h5>
        <div class="row g-3">
            ${Array.from({ length: Math.min(daysLeft, 3) }, (_, i) => {
        const day = i + 1;
        return `
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <strong>Day ${day}</strong>
                            </div>
                            <div class="card-body">
                                <ul class="mb-0">
                                    <li>Review Week ${Math.floor(assessment.date / 7) - 1} (2 hrs)</li>
                                    <li>Practice problems (1 hr)</li>
                                    <li>Review notes (1 hr)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>

        <div class="mt-4 text-center">
            <button class="btn btn-lg btn-primary" onclick="alert('Starting study session...')">
                <i class="bi bi-play-circle me-2"></i>
                Start Studying Now
            </button>
        </div>
    `;

    document.getElementById('deadlinePrepContent').innerHTML = content;
    updatePrepCalculation(assessment.code_module, currentAvg, moduleScores.length);
    navigateTo('page-deadline-prep');
}

function updatePrepCalculation(moduleCode, currentAvg, assessmentCount) {
    const score = document.getElementById('prepScore')?.value || 70;
    const display = document.getElementById('prepScoreDisplay');
    const result = document.getElementById('prepResult');

    if (display) display.textContent = score + '%';
    if (!result) return;

    const newAvg = (currentAvg * assessmentCount + Number(score)) / (assessmentCount + 1);
    const change = newAvg - currentAvg;
    const color = change > 0 ? 'success' : 'secondary';

    result.innerHTML = `
        <div class="alert alert-${color} mt-3 mb-0">
            <div class="text-center">
                <h6>Predicted New Average</h6>
                <h3 class="mb-0">${newAvg.toFixed(1)}%</h3>
                <small>${change >= 0 ? '+' : ''}${change.toFixed(1)}% change</small>
            </div>
        </div>
    `;
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
