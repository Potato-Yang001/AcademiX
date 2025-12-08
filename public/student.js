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
