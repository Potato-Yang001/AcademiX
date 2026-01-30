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
        let data = await res.json(); // ✅ Changed to 'let' so we can reassign

        if (!data.student) {
            alert("Student not found!");
            return;
        }

        // Generate missing data
        if (!data.currentDay) {
            data.currentDay = calculateCurrentDay(data.scores);
        }
        if (!data.assessments && data.scores) {
            data.assessments = generateAssessmentsFromScores(data.scores);
        }

        // ✅ MOVED INSIDE try block - ensure multiple modules BEFORE storing
        data = ensureMultipleModules(data);

        // Store globally AFTER ensuring multiple modules
        window.studentData = data;

        // Render ONLY main dashboard (no more clutter!)
        renderMainDashboard();

    } catch (error) {
        console.error("Error loading student data:", error);
        alert("Error loading student data");
    }
}

// ============================================
// ENSURE MULTIPLE MODULES FOR COMPARISON
// ============================================
function ensureMultipleModules(data) {
    if (!data.scores || data.scores.length === 0) return data;

    const modules = [...new Set(data.scores.map(s => s.code_module))];
    const currentDay = data.currentDay || 50;

    // If only 1 module, duplicate it as a second module
    if (modules.length === 1) {
        const originalModule = modules[0];
        const newModule = originalModule === 'AAA' ? 'BBB' : 'AAA';

        // ✅ Make the second module AT RISK (scores between 20-38%)
        const duplicatedScores = data.scores.map(s => ({
            ...s,
            code_module: newModule,
            // ✅ Set scores to be FAILING (20-38% range)
            score: Math.floor(Math.random() * 19) + 20 // Random between 20-38
        }));

        data.scores = [...data.scores, ...duplicatedScores];

        // Duplicate assessments if they exist
        if (data.assessments) {
            const duplicatedAssessments = data.assessments
                .filter(a => a.code_module === originalModule)
                .slice(0, 2) // ✅ Only create 2 assessments for BBB
                .map((a, index) => {
                    // ✅ FORCE specific deadlines
                    const daysUntilDeadline = index === 0 ? 2 : 5;

                    return {
                        ...a,
                        code_module: newModule,
                        date: currentDay + daysUntilDeadline,
                        assessment_type: index === 1 ? 'Exam' : 'TMA' // ✅ Second one is Exam
                    };
                });

            data.assessments = [...data.assessments, ...duplicatedAssessments];
        }
    }

    return data;
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

// 🚨 1. URGENT ACTIONS PANEL - SIMPLE CARD ON MAIN DASHBOARD
function renderUrgentActionsPanel(data) {
    const container = document.getElementById("urgentActions");
    if (!container) return;

    const currentDay = data.currentDay || 0;

    // ✅ Only check for urgent deadlines (< 14 days)
    const urgentItems = data.assessments
        ? data.assessments
            .filter(a => a.date > currentDay && (a.date - currentDay) < 14)
            .sort((a, b) => a.date - b.date)
        : [];

    if (urgentItems.length === 0) {
        container.innerHTML = `
            <div class="alert alert-success">
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong>All Clear!</strong> No urgent deadlines in the next 14 days.
            </div>
        `;
        return;
    }

    // ✅ SIMPLE card with just a summary - click to see full details
    const criticalCount = urgentItems.filter(a => (a.date - currentDay) < 3).length;

    const html = `
        <div class="alert alert-danger d-flex align-items-center" role="alert">
            <i class="bi bi-exclamation-triangle-fill fs-3 me-3"></i>
            <div class="flex-grow-1">
                <h5 class="mb-1">🚨 ${urgentItems.length} Urgent Action${urgentItems.length !== 1 ? 's' : ''} Required</h5>
                <p class="mb-2">
                    ${criticalCount > 0 ? `<strong>${criticalCount} critical</strong> (< 3 days) | ` : ''}
                    ${urgentItems.length - criticalCount} upcoming deadlines
                </p>
                <button class="btn btn-danger btn-sm" onclick="showUrgentActionsDetail()">
                    <i class="bi bi-arrow-right-circle me-1"></i>
                    View All Details →
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================
// RENDER GANTT CHART FOR DEADLINES
// ============================================
function renderGanttChart(deadlineItems, currentDay) {
    if (!deadlineItems || deadlineItems.length === 0) return '';

    // Calculate actual days left from adjusted dates
    deadlineItems = deadlineItems.map(item => ({
        ...item,
        daysLeft: item.deadline - currentDay
    }));

    // Cap maxDays at 14 for better visualization
    const maxDays = 14;
    const chartWidth = 100; // percentage

    const ganttHTML = `
        <div class="gantt-chart-container">
            <!-- Timeline Header -->
            <div class="d-flex justify-content-between align-items-center mb-3 px-3">
                <div>
                    <i class="bi bi-calendar-check me-2 text-success"></i>
                    <strong>Today</strong> <small class="text-muted">(Day ${currentDay})</small>
                </div>
                <div>
                    <i class="bi bi-calendar-x me-2 text-danger"></i>
                    <strong>+${maxDays} days</strong>
                </div>
            </div>

            <!-- Time Scale with Grid Lines -->
            <div class="position-relative mb-4" style="height: 60px; background: linear-gradient(90deg, #e8f5e9 0%, #fff3e0 50%, #ffebee 100%); border-radius: 10px; border: 2px solid #90caf9; padding: 15px;">
                <div class="d-flex justify-content-between align-items-center h-100 position-relative">
                    ${Array.from({ length: 5 }, (_, i) => {
        const day = Math.round((maxDays / 4) * i);
        const color = day <= 3 ? '#dc3545' : day <= 7 ? '#ffc107' : '#0dcaf0';
        return `
                            <div class="text-center position-relative">
                                <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 2px; height: 80px; background: ${i === 0 ? '#198754' : '#dee2e6'}; opacity: 0.5;"></div>
                                <span class="badge" style="background: ${i === 0 ? '#198754' : color}; position: relative; z-index: 2; font-size: 0.85rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    ${i === 0 ? '🟢 Now' : `+${day}d`}
                                </span>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>

            <!-- Gantt Bars -->
            <div class="gantt-bars">
                ${deadlineItems.map((item, index) => {
        // Calculate position based on maxDays scale, cap at 100%
        const position = Math.min((item.daysLeft / maxDays) * 100, 100);

        // Determine color and styling based on urgency
        let barColor, barBgGradient, priorityIcon;
        if (item.daysLeft < 3) {
            barColor = '#dc3545';
            barBgGradient = 'linear-gradient(90deg, rgba(220,53,69,0.15), rgba(220,53,69,0.4))';
            priorityIcon = '🔴';
        } else if (item.daysLeft < 7) {
            barColor = '#ffc107';
            barBgGradient = 'linear-gradient(90deg, rgba(255,193,7,0.15), rgba(255,193,7,0.4))';
            priorityIcon = '🟡';
        } else {
            barColor = '#0dcaf0';
            barBgGradient = 'linear-gradient(90deg, rgba(13,202,240,0.15), rgba(13,202,240,0.4))';
            priorityIcon = '🔵';
        }

        return `
                        <div class="gantt-bar-row mb-3 p-3 rounded shadow-sm" style="background: white; border-left: 5px solid ${barColor}; transition: all 0.3s ease;">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div class="flex-grow-1">
                                    <div class="d-flex align-items-center gap-2">
                                        <span style="font-size: 1.2rem;">${priorityIcon}</span>
                                        <strong class="text-dark">${item.title}</strong>
                                        <span class="badge bg-${item.color}" style="font-size: 0.75rem; padding: 0.35rem 0.6rem;">
                                            ${item.daysLeft} day${item.daysLeft !== 1 ? 's' : ''} left
                                        </span>
                                    </div>
                                    <small class="text-muted ms-4">${item.description}</small>
                                </div>
                                <div class="text-end">
                                    <small class="text-muted d-block">
                                        <i class="bi bi-hourglass-split me-1"></i>
                                        ${item.duration}d prep time
                                    </small>
                                    <small class="text-muted">
                                        <i class="bi bi-calendar-event me-1"></i>
                                        Due: Day ${item.date}
                                    </small>
                                </div>
                            </div>
                            
                            <!-- Progress Bar with Improved Visualization -->
                            <div class="position-relative" style="height: 40px; background: #f8f9fa; border-radius: 12px; overflow: visible; border: 1px solid #e9ecef;">
                                <!-- Time Progress Shaded Area -->
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${position}%; background: ${barBgGradient}; border-radius: 11px; transition: width 0.3s ease;"></div>
                                
                                <!-- Deadline Marker Triangle (Larger & More Visible) -->
                                <div style="position: absolute; left: ${position}%; top: -10px; width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-bottom: 15px solid ${barColor}; transform: translateX(-50%); z-index: 4; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));"></div>
                                
                                <!-- Deadline Vertical Line -->
                                <div style="position: absolute; left: ${position}%; top: 0; bottom: 0; width: 3px; background: ${barColor}; z-index: 3; transform: translateX(-50%); box-shadow: 0 0 6px ${barColor};"></div>
                                
                                <!-- Pulsing Dot at Deadline -->
                                <div style="position: absolute; left: ${position}%; top: 50%; width: 12px; height: 12px; background: ${barColor}; border-radius: 50%; transform: translate(-50%, -50%); z-index: 5; box-shadow: 0 0 0 0 ${barColor}; animation: pulse 2s infinite;"></div>
                                
                                <!-- Label Inside Bar -->
                                <div class="d-flex align-items-center justify-content-center h-100" style="position: relative; z-index: 2;">
                                    <span class="badge" style="background: ${barColor}; font-size: 0.9rem; padding: 0.5rem 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-weight: 600;">
                                        📅 Deadline: Day ${item.date} (${item.daysLeft}d from now)
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Progress Percentage -->
                            <div class="mt-2 text-end">
                                <small class="text-muted">
                                    <strong>${((item.daysLeft / maxDays) * 100).toFixed(0)}%</strong> of timeline remaining
                                </small>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>

            <!-- Legend -->
            <div class="mt-4 p-3 bg-white rounded border shadow-sm">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <small class="text-muted fw-bold d-block mb-2">
                            <i class="bi bi-info-circle me-1"></i>
                            Priority Levels:
                        </small>
                        <div class="d-flex gap-2 flex-wrap">
                            <span class="badge bg-danger" style="padding: 0.5rem 0.8rem;">🔴 Critical < 3d</span>
                            <span class="badge bg-warning text-dark" style="padding: 0.5rem 0.8rem;">🟡 High 3-7d</span>
                            <span class="badge bg-info" style="padding: 0.5rem 0.8rem;">🔵 Medium 7-14d</span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <small class="text-muted fw-bold d-block mb-2">
                            <i class="bi bi-question-circle me-1"></i>
                            How to Read:
                        </small>
                        <small class="text-muted d-block">
                            <i class="bi bi-caret-down-fill text-primary me-1"></i> Triangle = Deadline position
                        </small>
                        <small class="text-muted d-block">
                            <i class="bi bi-square-fill text-primary me-1" style="opacity: 0.4;"></i> Shaded area = Time passed
                        </small>
                        <small class="text-muted d-block">
                            <i class="bi bi-circle-fill text-primary me-1"></i> Pulsing dot = Urgent marker
                        </small>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes pulse {
                0% {
                    box-shadow: 0 0 0 0 ${deadlineItems.length > 0 && deadlineItems[0].daysLeft < 3 ? 'rgba(220,53,69,0.7)' : 'rgba(13,202,240,0.7)'};
                }
                50% {
                    box-shadow: 0 0 0 8px rgba(0,0,0,0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(0,0,0,0);
                }
            }
            
            .gantt-bar-row:hover {
                transform: translateX(5px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            }
        </style>
    `;

    return ganttHTML;
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

    if (!data || !data.scores || data.scores.length === 0) {
        console.error('No data available');
        return;
    }

    // Card 1: Overall Average
    const avgScore = data.scores.reduce((sum, s) => sum + Number(s.score), 0) / data.scores.length;
    const overallGPA = document.getElementById('overallGPA');
    const statusBadge = document.getElementById('overallStatus');

    if (overallGPA) {
        overallGPA.textContent = avgScore.toFixed(1) + '%';
    }

    if (statusBadge) {
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
    }

    // ✅ Card 2: Urgent Actions - SIMPLE SUMMARY ONLY
    const currentDay = data.currentDay || 0;
    const urgentDeadlines = data.assessments.filter(a =>
        a.date > currentDay && (a.date - currentDay) < 14 // Show 14 days
    );

    const urgentCount = document.getElementById('urgentCount');
    const urgentLabel = document.getElementById('urgentLabel');

    if (urgentCount) {
        urgentCount.textContent = urgentDeadlines.length;
    }

    if (urgentLabel) {
        const criticalCount = urgentDeadlines.filter(a => (a.date - currentDay) < 3).length;
        if (criticalCount > 0) {
            urgentLabel.textContent = `${criticalCount} Critical!`;
            urgentLabel.className = 'badge bg-danger mb-3';
        } else {
            urgentLabel.textContent = '< 14 days';
            urgentLabel.className = 'badge bg-warning text-dark mb-3';
        }
    }

    // ✅ Render the course overview
    renderCourseOverview();
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

    // Generate module list HTML
    const moduleListHTML = Object.values(moduleScores).map(mod => {
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

    // ✅ NEW: Update page content with toggle buttons
    const pageContent = document.getElementById('page-modules');
    if (pageContent) {
        const cardBody = pageContent.querySelector('.card-body');

        cardBody.innerHTML = `
            <!-- VIEW TOGGLE BUTTONS -->
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h5 class="mb-0">Your Enrolled Modules</h5>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-primary active" id="moduleListViewBtn" onclick="toggleModuleView('list')">
                        <i class="bi bi-list-ul me-2"></i>
                        List View
                    </button>
                    <button type="button" class="btn btn-outline-primary" id="moduleChartViewBtn" onclick="toggleModuleView('chart')">
                        <i class="bi bi-graph-up me-2"></i>
                        Chart View
                    </button>
                </div>
            </div>

            <!-- VIEW 1: MODULE LIST -->
            <div id="moduleListView">
                ${moduleListHTML}
            </div>

            <!-- VIEW 2: PERFORMANCE CHART -->
            <div id="moduleChartView" style="display: none;">
                <h5 class="mb-3">📊 Performance Trends (Click points for details)</h5>
                <div class="chart-container">
                    <canvas id="performanceTrendChart"></canvas>
                </div>
            </div>
        `;
    }

    // Render the chart (it will be hidden initially)
    renderPerformanceTrendChart(moduleScores);

    navigateTo('page-modules');
}

// ✅ NEW: Toggle function for Module views
function toggleModuleView(view) {
    const listView = document.getElementById('moduleListView');
    const chartView = document.getElementById('moduleChartView');
    const listBtn = document.getElementById('moduleListViewBtn');
    const chartBtn = document.getElementById('moduleChartViewBtn');

    if (view === 'list') {
        listView.style.display = 'block';
        chartView.style.display = 'none';
        listBtn.classList.add('active');
        listBtn.classList.remove('btn-outline-primary');
        listBtn.classList.add('btn-primary');
        chartBtn.classList.remove('active');
        chartBtn.classList.add('btn-outline-primary');
        chartBtn.classList.remove('btn-primary');
    } else {
        listView.style.display = 'none';
        chartView.style.display = 'block';
        chartBtn.classList.add('active');
        chartBtn.classList.remove('btn-outline-primary');
        chartBtn.classList.add('btn-primary');
        listBtn.classList.remove('active');
        listBtn.classList.add('btn-outline-primary');
        listBtn.classList.remove('btn-primary');
    }
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
// GENERATE QUESTION ANALYSIS (Pass/Fail)
// ============================================
function generateQuestionAnalysis(overallScore, moduleCode, assessmentNumber) {
    // Generate 10-15 questions based on score
    const totalQuestions = Math.floor(Math.random() * 6) + 10;
    const correctCount = Math.round((overallScore / 100) * totalQuestions);
    const incorrectCount = totalQuestions - correctCount;

    // ✅ MODULE-SPECIFIC QUESTION BANKS (same as before)
    const questionBanksByModule = {
        'AAA': [
            {
                topic: 'Algorithms',
                question: 'Which sorting algorithm has the best average-case time complexity?',
                options: ['A) Bubble Sort O(n²)', 'B) Merge Sort O(n log n)', 'C) Selection Sort O(n²)', 'D) Insertion Sort O(n²)'],
                correct: 'B) Merge Sort O(n log n)',
                hint: 'Compare the time complexities of different sorting algorithms.'
            },
            {
                topic: 'Data Structures',
                question: 'Which data structure uses LIFO (Last In, First Out) principle?',
                options: ['A) Queue', 'B) Stack', 'C) Array', 'D) Linked List'],
                correct: 'B) Stack',
                hint: 'Think of a stack of plates - you remove the last one you placed on top.'
            },
            {
                topic: 'Programming Fundamentals',
                question: 'What is recursion in programming?',
                options: ['A) A loop that never ends', 'B) A function that calls itself', 'C) Multiple functions calling each other', 'D) A type of array'],
                correct: 'B) A function that calls itself',
                hint: 'Recursion involves a function calling itself with modified parameters.'
            },
            {
                topic: 'Complexity Analysis',
                question: 'What is the time complexity of binary search on a sorted array?',
                options: ['A) O(n)', 'B) O(log n)', 'C) O(n²)', 'D) O(1)'],
                correct: 'B) O(log n)',
                hint: 'Binary search divides the search space in half each time.'
            },
            {
                topic: 'Programming Concepts',
                question: 'What is the output of: print(2 ** 3 ** 2)?',
                options: ['A) 64', 'B) 512', 'C) 256', 'D) 128'],
                correct: 'B) 512',
                hint: 'Exponentiation is right-associative: 2 ** (3 ** 2) = 2 ** 9 = 512.'
            },
            {
                topic: 'Object-Oriented Programming',
                question: 'In OOP, what does polymorphism allow you to do?',
                options: ['A) Hide data from users', 'B) Use a single interface for different data types', 'C) Create multiple classes', 'D) Delete objects'],
                correct: 'B) Use a single interface for different data types',
                hint: 'Polymorphism enables objects of different types to be treated uniformly.'
            },
            {
                topic: 'Software Design',
                question: 'Which design pattern ensures only one instance of a class exists?',
                options: ['A) Factory Pattern', 'B) Singleton Pattern', 'C) Observer Pattern', 'D) Strategy Pattern'],
                correct: 'B) Singleton Pattern',
                hint: 'This pattern controls object instantiation to ensure uniqueness.'
            },
            {
                topic: 'Programming Basics',
                question: 'What is a variable in programming?',
                options: ['A) A constant value', 'B) A container for storing data', 'C) A type of loop', 'D) A programming language'],
                correct: 'B) A container for storing data',
                hint: 'Variables store values that can change during execution.'
            },
            {
                topic: 'Algorithm Analysis',
                question: 'What is Big O notation used for?',
                options: ['A) Measuring code length', 'B) Describing algorithm efficiency', 'C) Counting variables', 'D) Naming functions'],
                correct: 'B) Describing algorithm efficiency',
                hint: 'Big O describes how performance scales with input size.'
            },
            {
                topic: 'OOP Principles',
                question: 'What is encapsulation in OOP?',
                options: ['A) Hiding implementation details', 'B) Creating multiple instances', 'C) Inheriting from parents', 'D) Overloading methods'],
                correct: 'A) Hiding implementation details',
                hint: 'Encapsulation bundles data and methods while restricting access.'
            },
            {
                topic: 'Software Development',
                question: 'What is an API?',
                options: ['A) A programming language', 'B) Application Programming Interface', 'C) Automated Program Instruction', 'D) Advanced Processing Interface'],
                correct: 'B) Application Programming Interface',
                hint: 'APIs allow different software applications to communicate.'
            },
            {
                topic: 'Programming Constructs',
                question: 'What is the purpose of a constructor?',
                options: ['A) To destroy objects', 'B) To initialize objects when created', 'C) To compare objects', 'D) To copy objects'],
                correct: 'B) To initialize objects when created',
                hint: 'Constructors run automatically when an object is instantiated.'
            },
            {
                topic: 'Code Quality',
                question: 'What is version control used for?',
                options: ['A) To track code changes', 'B) To delete old code', 'C) To compile programs', 'D) To encrypt data'],
                correct: 'A) To track code changes',
                hint: 'Tools like Git help manage code versions and collaboration.'
            },
            {
                topic: 'Development Tools',
                question: 'What does IDE stand for?',
                options: ['A) Integrated Development Environment', 'B) Internet Data Exchange', 'C) Internal Design Editor', 'D) Interactive Debug Engine'],
                correct: 'A) Integrated Development Environment',
                hint: 'IDEs provide tools for writing, testing, and debugging code.'
            },
            {
                topic: 'Software Methodology',
                question: 'Which is NOT an Agile principle?',
                options: ['A) Individuals over processes', 'B) Documentation over working software', 'C) Customer collaboration', 'D) Responding to change'],
                correct: 'B) Documentation over working software',
                hint: 'Agile values working software over comprehensive documentation.'
            }
        ],

        'BBB': [
            {
                topic: 'Database Design',
                question: 'What is the primary purpose of normalization in database design?',
                options: ['A) To increase redundancy', 'B) To eliminate redundancy and improve integrity', 'C) To make queries slower', 'D) To increase storage'],
                correct: 'B) To eliminate redundancy and improve integrity',
                hint: 'Normalization organizes data to reduce duplication.'
            },
            {
                topic: 'Database Theory',
                question: 'In a database, what does ACID stand for?',
                options: ['A) Atomicity, Consistency, Isolation, Durability', 'B) Access, Control, Integration, Design', 'C) Automatic, Controlled, Isolated, Distributed', 'D) Advanced, Consistent, Indexed, Durable'],
                correct: 'A) Atomicity, Consistency, Isolation, Durability',
                hint: 'ACID properties guarantee reliable database transactions.'
            },
            {
                topic: 'SQL Commands',
                question: 'Which SQL command removes all records without deleting the table structure?',
                options: ['A) DELETE', 'B) DROP', 'C) TRUNCATE', 'D) REMOVE'],
                correct: 'C) TRUNCATE',
                hint: 'This command efficiently removes all rows while keeping structure.'
            },
            {
                topic: 'Database Keys',
                question: 'What is a primary key in a relational database?',
                options: ['A) Can have duplicates', 'B) A unique identifier for each record', 'C) The first column', 'D) A foreign key reference'],
                correct: 'B) A unique identifier for each record',
                hint: 'Primary keys must be unique and cannot be NULL.'
            },
            {
                topic: 'Database Operations',
                question: 'What is a JOIN operation used for in SQL?',
                options: ['A) To combine rows from two or more tables', 'B) To delete records', 'C) To create new tables', 'D) To sort data'],
                correct: 'A) To combine rows from two or more tables',
                hint: 'JOINs merge related data from different tables.'
            },
            {
                topic: 'Data Relationships',
                question: 'What is a foreign key?',
                options: ['A) A unique key from another country', 'B) A field linking to primary key in another table', 'C) The first key in a table', 'D) A backup key'],
                correct: 'B) A field linking to primary key in another table',
                hint: 'Foreign keys establish relationships between tables.'
            },
            {
                topic: 'Database Indexing',
                question: 'What is the purpose of an index in a database?',
                options: ['A) To slow down queries', 'B) To speed up data retrieval', 'C) To delete data', 'D) To encrypt data'],
                correct: 'B) To speed up data retrieval',
                hint: 'Indexes work like a book index - faster lookups.'
            },
            {
                topic: 'Transaction Management',
                question: 'What does COMMIT do in a database transaction?',
                options: ['A) Cancels all changes', 'B) Saves all changes permanently', 'C) Creates a backup', 'D) Locks the database'],
                correct: 'B) Saves all changes permanently',
                hint: 'COMMIT makes all transaction changes permanent.'
            },
            {
                topic: 'Database Design',
                question: 'What is denormalization?',
                options: ['A) Removing all normalization', 'B) Adding redundancy for performance', 'C) Deleting data', 'D) Creating backups'],
                correct: 'B) Adding redundancy for performance',
                hint: 'Denormalization trades some redundancy for query speed.'
            },
            {
                topic: 'SQL Queries',
                question: 'Which SQL keyword is used to sort results?',
                options: ['A) SORT BY', 'B) ORDER BY', 'C) ARRANGE BY', 'D) ORGANIZE BY'],
                correct: 'B) ORDER BY',
                hint: 'This clause orders query results in ascending or descending order.'
            },
            {
                topic: 'Data Integrity',
                question: 'What is referential integrity?',
                options: ['A) Ensuring foreign keys reference valid records', 'B) Making backups', 'C) Encrypting data', 'D) Sorting tables'],
                correct: 'A) Ensuring foreign keys reference valid records',
                hint: 'Referential integrity maintains valid relationships between tables.'
            },
            {
                topic: 'Database Security',
                question: 'What is SQL injection?',
                options: ['A) A security vulnerability', 'B) A type of JOIN', 'C) A backup method', 'D) A sorting technique'],
                correct: 'A) A security vulnerability',
                hint: 'SQL injection exploits improper input validation.'
            },
            {
                topic: 'Query Optimization',
                question: 'What is a subquery in SQL?',
                options: ['A) A query within another query', 'B) A broken query', 'C) A fast query', 'D) A table name'],
                correct: 'A) A query within another query',
                hint: 'Subqueries are nested queries used in SELECT, WHERE, or FROM.'
            },
            {
                topic: 'Database Types',
                question: 'What is a NoSQL database?',
                options: ['A) A database that uses SQL', 'B) A non-relational database', 'C) A broken database', 'D) A spreadsheet'],
                correct: 'B) A non-relational database',
                hint: 'NoSQL databases store data in non-tabular formats.'
            },
            {
                topic: 'Data Aggregation',
                question: 'What does the SQL COUNT() function do?',
                options: ['A) Adds numbers', 'B) Counts the number of rows', 'C) Sorts data', 'D) Deletes records'],
                correct: 'B) Counts the number of rows',
                hint: 'COUNT() returns the number of rows matching criteria.'
            }
        ],

        'CCC': [
            {
                topic: 'Web Basics',
                question: 'What does HTTP stand for?',
                options: ['A) HyperText Transfer Protocol', 'B) High Transfer Text Protocol', 'C) HyperText Transmission Process', 'D) Home Tool Transfer Protocol'],
                correct: 'A) HyperText Transfer Protocol',
                hint: 'HTTP is the foundation of data communication on the Web.'
            },
            {
                topic: 'CSS Styling',
                question: 'In CSS, which property changes the background color?',
                options: ['A) color', 'B) bgcolor', 'C) background-color', 'D) bg-color'],
                correct: 'C) background-color',
                hint: 'CSS uses hyphenated property names for styling.'
            },
            {
                topic: 'HTML Structure',
                question: 'What is the purpose of the <head> tag in HTML?',
                options: ['A) Display main content', 'B) Contain metadata about the document', 'C) Create headers', 'D) Define footer'],
                correct: 'B) Contain metadata about the document',
                hint: 'The head section contains non-visible document information.'
            },
            {
                topic: 'HTTP Methods',
                question: 'Which HTTP method is used to send data to a server?',
                options: ['A) GET', 'B) POST', 'C) DELETE', 'D) FETCH'],
                correct: 'B) POST',
                hint: 'POST is commonly used for form submissions and creating resources.'
            },
            {
                topic: 'JavaScript Basics',
                question: 'What is the DOM in web development?',
                options: ['A) Document Object Model', 'B) Data Output Method', 'C) Digital Object Manager', 'D) Database Operation Mode'],
                correct: 'A) Document Object Model',
                hint: 'The DOM represents the HTML document as a tree structure.'
            },
            {
                topic: 'Web Security',
                question: 'What is HTTPS?',
                options: ['A) HTTP with security/encryption', 'B) High Transfer Protocol System', 'C) HTML Transfer Protocol Secure', 'D) Home Transfer Protocol Service'],
                correct: 'A) HTTP with security/encryption',
                hint: 'HTTPS uses SSL/TLS to encrypt data transmission.'
            },
            {
                topic: 'CSS Layout',
                question: 'What does CSS Flexbox do?',
                options: ['A) Makes pages flexible in size', 'B) Provides flexible layout model', 'C) Flexes images', 'D) Creates animations'],
                correct: 'B) Provides flexible layout model',
                hint: 'Flexbox helps arrange elements in responsive layouts.'
            },
            {
                topic: 'Web Performance',
                question: 'What is caching in web development?',
                options: ['A) Storing data temporarily for faster access', 'B) Deleting old files', 'C) Compressing images', 'D) Encrypting data'],
                correct: 'A) Storing data temporarily for faster access',
                hint: 'Caching reduces load times by storing frequently used data.'
            },
            {
                topic: 'Responsive Design',
                question: 'What are media queries used for in CSS?',
                options: ['A) Playing videos', 'B) Applying styles based on device characteristics', 'C) Loading images', 'D) Creating animations'],
                correct: 'B) Applying styles based on device characteristics',
                hint: 'Media queries enable responsive designs for different screens.'
            },
            {
                topic: 'JavaScript Events',
                question: 'What is an event listener in JavaScript?',
                options: ['A) A function that waits for events', 'B) A debugging tool', 'C) A variable type', 'D) An error handler'],
                correct: 'A) A function that waits for events',
                hint: 'Event listeners respond to user interactions like clicks.'
            },
            {
                topic: 'Web APIs',
                question: 'What is a RESTful API?',
                options: ['A) An architectural style for web services', 'B) A programming language', 'C) A database type', 'D) A web browser'],
                correct: 'A) An architectural style for web services',
                hint: 'REST uses HTTP methods for creating web services.'
            },
            {
                topic: 'HTML Forms',
                question: 'What is the purpose of the <form> tag?',
                options: ['A) To collect user input', 'B) To display images', 'C) To create tables', 'D) To add styles'],
                correct: 'A) To collect user input',
                hint: 'Forms gather data from users through input fields.'
            },
            {
                topic: 'Web Storage',
                question: 'What is localStorage in web browsers?',
                options: ['A) Client-side storage with no expiration', 'B) Server storage', 'C) Temporary memory', 'D) Cookie replacement'],
                correct: 'A) Client-side storage with no expiration',
                hint: 'localStorage persists data even after browser closes.'
            },
            {
                topic: 'CSS Selectors',
                question: 'What does the CSS selector "#main" target?',
                options: ['A) An element with id="main"', 'B) A class named main', 'C) All main tags', 'D) The first element'],
                correct: 'A) An element with id="main"',
                hint: 'The # symbol selects elements by their ID attribute.'
            },
            {
                topic: 'JavaScript Async',
                question: 'What is a Promise in JavaScript?',
                options: ['A) An object representing eventual completion of async operation', 'B) A guarantee of success', 'C) A type of loop', 'D) A variable declaration'],
                correct: 'A) An object representing eventual completion of async operation',
                hint: 'Promises handle asynchronous operations with then/catch.'
            }
        ],

        'DDD': [
            {
                topic: 'Statistics Basics',
                question: 'Given mean=50 and standard deviation=10, what percentage falls within one standard deviation?',
                options: ['A) 50%', 'B) 68%', 'C) 95%', 'D) 99.7%'],
                correct: 'B) 68%',
                hint: 'Recall the empirical rule (68-95-99.7 rule) for normal distributions.'
            },
            {
                topic: 'Machine Learning',
                question: 'In machine learning, what is overfitting?',
                options: ['A) Model performs well on training but poorly on new data', 'B) Model performs poorly on all data', 'C) Model is too simple', 'D) Model trains too quickly'],
                correct: 'A) Model performs well on training but poorly on new data',
                hint: 'Overfitting means learning training data too well, including noise.'
            },
            {
                topic: 'ML Evaluation',
                question: 'What is a confusion matrix used for?',
                options: ['A) To confuse the model', 'B) To evaluate classification performance', 'C) To create random predictions', 'D) To sort data'],
                correct: 'B) To evaluate classification performance',
                hint: 'Shows true/false positives and true/false negatives.'
            },
            {
                topic: 'Learning Types',
                question: 'What is the difference between supervised and unsupervised learning?',
                options: ['A) Supervised uses labeled data', 'B) Supervised is faster', 'C) Unsupervised is more accurate', 'D) No difference'],
                correct: 'A) Supervised uses labeled data',
                hint: 'Supervised learning trains on data with known outcomes.'
            },
            {
                topic: 'Data Analysis',
                question: 'What is the median of a dataset?',
                options: ['A) The average value', 'B) The middle value when sorted', 'C) The most frequent value', 'D) The range'],
                correct: 'B) The middle value when sorted',
                hint: 'Median is the center point of sorted data.'
            },
            {
                topic: 'Probability',
                question: 'What is the probability of getting heads in a fair coin toss?',
                options: ['A) 0.25', 'B) 0.5', 'C) 0.75', 'D) 1.0'],
                correct: 'B) 0.5',
                hint: 'A fair coin has equal chances for heads and tails.'
            },
            {
                topic: 'Data Visualization',
                question: 'What type of chart is best for showing trends over time?',
                options: ['A) Pie chart', 'B) Line chart', 'C) Bar chart', 'D) Scatter plot'],
                correct: 'B) Line chart',
                hint: 'Line charts connect data points to show progression.'
            },
            {
                topic: 'Statistical Measures',
                question: 'What does standard deviation measure?',
                options: ['A) Average value', 'B) Spread of data from mean', 'C) Most common value', 'D) Total sum'],
                correct: 'B) Spread of data from mean',
                hint: 'Standard deviation shows how dispersed data is.'
            },
            {
                topic: 'Correlation',
                question: 'What does a correlation coefficient of -1 indicate?',
                options: ['A) Perfect positive correlation', 'B) Perfect negative correlation', 'C) No correlation', 'D) Weak correlation'],
                correct: 'B) Perfect negative correlation',
                hint: 'Negative correlation means variables move in opposite directions.'
            },
            {
                topic: 'Hypothesis Testing',
                question: 'What is a p-value in statistics?',
                options: ['A) Probability of observing results if null hypothesis is true', 'B) The average', 'C) The median', 'D) The range'],
                correct: 'A) Probability of observing results if null hypothesis is true',
                hint: 'P-values help determine statistical significance.'
            },
            {
                topic: 'Data Cleaning',
                question: 'What is an outlier in data analysis?',
                options: ['A) Average data point', 'B) A data point significantly different from others', 'C) Missing data', 'D) Duplicate data'],
                correct: 'B) A data point significantly different from others',
                hint: 'Outliers are extreme values that deviate from the pattern.'
            },
            {
                topic: 'ML Algorithms',
                question: 'What is a decision tree?',
                options: ['A) A tree diagram for decisions', 'B) A machine learning algorithm using tree structure', 'C) A database structure', 'D) A sorting method'],
                correct: 'B) A machine learning algorithm using tree structure',
                hint: 'Decision trees make predictions through branching logic.'
            },
            {
                topic: 'Feature Engineering',
                question: 'What is feature scaling in machine learning?',
                options: ['A) Normalizing feature ranges', 'B) Adding more features', 'C) Removing features', 'D) Sorting features'],
                correct: 'A) Normalizing feature ranges',
                hint: 'Scaling adjusts features to similar ranges for better training.'
            },
            {
                topic: 'Data Sampling',
                question: 'What is cross-validation?',
                options: ['A) A technique to assess model performance', 'B) Deleting bad data', 'C) Adding more data', 'D) Encrypting data'],
                correct: 'A) A technique to assess model performance',
                hint: 'Cross-validation splits data to test model generalization.'
            },
            {
                topic: 'Neural Networks',
                question: 'What is a neural network?',
                options: ['A) A network of computers', 'B) A computing system inspired by biological brains', 'C) An internet protocol', 'D) A database type'],
                correct: 'B) A computing system inspired by biological brains',
                hint: 'Neural networks use interconnected nodes like neurons.'
            }
        ]
    };

    // ✅ Get questions for the specific module (with fallback to AAA)
    const moduleQuestions = questionBanksByModule[moduleCode] || questionBanksByModule['AAA'];

    // ✅ KEY FIX: Use assessment number to create unique shuffle seed
    const assessmentSeed = assessmentNumber || 1;

    // Create a copy and shuffle based on assessment number
    const shuffledBank = [...moduleQuestions].sort((a, b) => {
        // ✅ Use assessment number + question text to create deterministic but unique order
        const seedA = (a.question.charCodeAt(0) * assessmentSeed) % 100;
        const seedB = (b.question.charCodeAt(0) * assessmentSeed) % 100;
        return seedA - seedB + (Math.random() - 0.5);
    });

    // ✅ Select different questions based on assessment number
    const startIndex = (assessmentSeed - 1) * 5 % moduleQuestions.length;
    const selectedQuestions = shuffledBank.slice(startIndex, startIndex + totalQuestions);

    // If not enough questions from slice, wrap around
    if (selectedQuestions.length < totalQuestions) {
        const remaining = totalQuestions - selectedQuestions.length;
        selectedQuestions.push(...shuffledBank.slice(0, remaining));
    }

    const questions = [];

    // Generate correct answers
    for (let i = 0; i < correctCount; i++) {
        const q = selectedQuestions[i % selectedQuestions.length];
        questions.push({
            number: i + 1,
            title: q.question,
            topic: q.topic,
            correct: true,
            userAnswer: q.correct,
            correctAnswer: q.correct,
            hint: '',
            allOptions: q.options
        });
    }

    // Generate incorrect answers
    for (let i = correctCount; i < totalQuestions; i++) {
        const q = selectedQuestions[i % selectedQuestions.length];
        const wrongAnswer = q.options.filter(opt => opt !== q.correct)[Math.floor(Math.random() * 3)];

        questions.push({
            number: i + 1,
            title: q.question,
            topic: q.topic,
            correct: false,
            userAnswer: wrongAnswer,
            correctAnswer: q.correct,
            hint: q.hint,
            allOptions: q.options
        });
    }

    // Shuffle to mix correct/incorrect (using assessment number for uniqueness)
    questions.sort((a, b) => {
        return ((a.number * assessmentSeed) % 100) - ((b.number * assessmentSeed) % 100);
    });

    return {
        total: totalQuestions,
        correct: correctCount,
        incorrect: incorrectCount,
        questions: questions
    };
}

// ============================================
// SHOW ASSESSMENT DETAIL FROM CHART CLICK
// ============================================
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

function showAssessmentDetail(assessment, number) {
    currentAssessment = { ...assessment, number };

    const scoreClass = assessment.score >= 60 ? 'text-success' :
        assessment.score >= 40 ? 'text-warning' : 'text-danger';

    const statusIcon = assessment.score >= 60 ? '✅' :
        assessment.score >= 40 ? '⚠️' : '❌';

    document.getElementById('assessmentDetailTitle').textContent =
        `Assessment ${number} - ${assessment.code_module}`;

    // ✅ Generate question breakdown (pass/fail analysis)
    const questionAnalysis = generateQuestionAnalysis(assessment.score, assessment.code_module, number);

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

        <!-- ✅ NEW: QUESTION PASS/FAIL SUMMARY -->
        <div class="card mb-4 bg-light border-0">
            <div class="card-body">
                <h5 class="mb-3">
                    <i class="bi bi-list-check me-2"></i>
                    📝 Question Analysis
                </h5>
                
                <div class="row text-center mb-3">
                    <div class="col-4">
                        <div class="p-3 bg-white rounded shadow-sm">
                            <h2 class="mb-0 text-primary">${questionAnalysis.total}</h2>
                            <small class="text-muted">Total Questions</small>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="p-3 bg-white rounded shadow-sm">
                            <h2 class="mb-0 text-success">${questionAnalysis.correct}</h2>
                            <small class="text-muted">✅ Correct</small>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="p-3 bg-white rounded shadow-sm">
                            <h2 class="mb-0 text-danger">${questionAnalysis.incorrect}</h2>
                            <small class="text-muted">❌ Incorrect</small>
                        </div>
                    </div>
                </div>

                <div class="progress mb-3" style="height: 30px;">
                    <div class="progress-bar bg-success" style="width: ${(questionAnalysis.correct / questionAnalysis.total) * 100}%">
                        ${questionAnalysis.correct} Correct
                    </div>
                    <div class="progress-bar bg-danger" style="width: ${(questionAnalysis.incorrect / questionAnalysis.total) * 100}%">
                        ${questionAnalysis.incorrect} Wrong
                    </div>
                </div>

                <div class="alert alert-info mb-0">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>Performance:</strong> You answered ${((questionAnalysis.correct / questionAnalysis.total) * 100).toFixed(0)}% of questions correctly
                </div>
            </div>
        </div>

        <!-- ✅ DETAILED QUESTION BREAKDOWN (Click to expand) -->
        <h5 class="mb-3">
            <i class="bi bi-clipboard-data me-2"></i>
            🔍 Question-by-Question Breakdown
        </h5>
        <p class="text-muted mb-3">Click on any question to see details</p>

        <div class="accordion" id="questionsAccordion">
            ${questionAnalysis.questions.map((q, index) => {
        const bgClass = q.correct ? 'bg-success' : 'bg-danger';
        const icon = q.correct ? 'check-circle-fill' : 'x-circle-fill';

        return `
                    <div class="accordion-item mb-2">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed ${q.correct ? '' : 'text-danger'}" 
                                    type="button" 
                                    data-bs-toggle="collapse" 
                                    data-bs-target="#question${index}">
                                <span class="badge ${bgClass} me-3">Q${index + 1}</span>
                                <i class="bi bi-${icon} me-2"></i>
                                <strong>${q.title}</strong>
                                <span class="ms-auto me-3 badge ${bgClass}">${q.correct ? '✅ Correct' : '❌ Wrong'}</span>
                            </button>
                        </h2>
                        <div id="question${index}" class="accordion-collapse collapse" data-bs-parent="#questionsAccordion">
                            <div class="accordion-body">
                                <div class="row">
                                    <div class="col-md-8">
                                        <p class="mb-2"><strong>Your Answer:</strong> ${q.userAnswer}</p>
                                        ${!q.correct ? `<p class="mb-2 text-success"><strong>Correct Answer:</strong> ${q.correctAnswer}</p>` : ''}
                                        <p class="mb-2"><strong>Topic:</strong> ${q.topic}</p>
                                        ${!q.correct ? `
                                            <div class="alert alert-warning mt-3">
                                                <strong>💡 Tip:</strong> ${q.hint}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="col-md-4">
                                        <div class="card ${q.correct ? 'bg-success' : 'bg-danger'} text-white">
                                            <div class="card-body text-center">
                                                <i class="bi bi-${icon}" style="font-size: 3rem;"></i>
                                                <h5 class="mt-2">${q.correct ? 'Correct!' : 'Incorrect'}</h5>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>

        <!-- KEEP: How to Improve Section -->
        <h4 class="mb-3 mt-5">💡 How to Improve</h4>
        <div class="row g-3">
            <div class="col-md-12">
                <div class="card h-100 border-info" style="cursor: pointer;" onclick="bookTutorSession('${assessment.code_module}', ${assessment.number})">
                    <div class="card-body text-center">
                        <i class="bi bi-person-video text-info" style="font-size: 3rem;"></i>
                        <h5 class="mt-3">🎓 Book Tutor Session</h5>
                        <p class="text-muted mb-0">Get 1-on-1 help on topics you struggled with in this assessment</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('assessmentDetailContent').innerHTML = content;

    // Initialize retake calculator
    navigateTo('page-assessment-detail');
}

// Helper function to navigate back
function navigateToModuleDetail() {
    if (currentModule) {
        showModuleDetail(currentModule);
    }
}

// Generate simulated topic breakdown based on score
/*function generateTopicBreakdown(overallScore) {
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
} */

// ============================================
// TOPIC BREAKDOWN CHART (Clickable Bars)
// ============================================
//let topicBreakdownChartInstance = null;

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

/*function showTopicDetail(topic) {
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
} */


// ============================================
// SHOW COURSE COMPARISON PAGE
// ============================================
function showCourseComparison() {
    const data = window.studentData;
    const container = document.getElementById('courseComparisonContent');

    if (!container) return;

    // Group scores by module
    const moduleStats = {};
    data.scores.forEach(s => {
        const module = s.code_module;
        if (!moduleStats[module]) {
            moduleStats[module] = {
                code: module,
                presentation: s.code_presentation,
                scores: [],
                totalAssessments: 0,
                passedAssessments: 0,
                failedAssessments: 0
            };
        }

        const score = Number(s.score);
        moduleStats[module].scores.push(score);
        moduleStats[module].totalAssessments++;

        if (score >= 40) {
            moduleStats[module].passedAssessments++;
        } else {
            moduleStats[module].failedAssessments++;
        }
    });

    // Calculate statistics for each module
    Object.values(moduleStats).forEach(mod => {
        mod.average = mod.scores.reduce((a, b) => a + b, 0) / mod.scores.length;
        mod.highest = Math.max(...mod.scores);
        mod.lowest = Math.min(...mod.scores);
        mod.passRate = (mod.passedAssessments / mod.totalAssessments) * 100;

        // Simulate VLE engagement (clicks)
        mod.vleClicks = Math.floor(Math.random() * 200) + 100; // 100-300 clicks

        // Determine performance level
        if (mod.average >= 80) {
            mod.performance = 'excellent';
            mod.status = 'Distinction';
            mod.color = '#198754';
        } else if (mod.average >= 60) {
            mod.performance = 'good';
            mod.status = 'Merit';
            mod.color = '#0dcaf0';
        } else if (mod.average >= 40) {
            mod.performance = 'warning';
            mod.status = 'Pass';
            mod.color = '#ffc107';
        } else {
            mod.performance = 'danger';
            mod.status = 'At Risk';
            mod.color = '#dc3545';
        }
    });

    const modules = Object.values(moduleStats);

    if (modules.length < 2) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-info-circle me-2"></i>
                You need at least 2 modules enrolled to compare. Currently enrolled: ${modules.length}
            </div>
        `;
        navigateTo('page-course-comparison');
        return;
    }

    const html = `
        <!-- Comparison Summary Cards -->
        <div class="row g-4 mb-4">
            ${modules.map((mod, index) => `
                <div class="col-md-${12 / modules.length}">
                    <div class="card h-100 border-3" style="border-color: ${mod.color} !important;">
                        <div class="card-header text-white" style="background-color: ${mod.color};">
                            <h5 class="mb-0">${mod.code}</h5>
                            <small>${mod.presentation}</small>
                        </div>
                        <div class="card-body text-center">
                            <h1 class="display-3 mb-2" style="color: ${mod.color};">${mod.average.toFixed(1)}%</h1>
                            <span class="badge mb-3" style="background-color: ${mod.color};">${mod.status}</span>
                            
                            <hr>
                            
                            <div class="text-start">
                                <p class="mb-2">
                                    <i class="bi bi-clipboard-check me-2 text-primary"></i>
                                    <strong>Assessments:</strong> ${mod.totalAssessments}
                                </p>
                                <p class="mb-2">
                                    <i class="bi bi-check-circle me-2 text-success"></i>
                                    <strong>Passed:</strong> ${mod.passedAssessments}
                                </p>
                                <p class="mb-2">
                                    <i class="bi bi-x-circle me-2 text-danger"></i>
                                    <strong>Failed:</strong> ${mod.failedAssessments}
                                </p>
                                <p class="mb-2">
                                    <i class="bi bi-percent me-2 text-info"></i>
                                    <strong>Pass Rate:</strong> ${mod.passRate.toFixed(0)}%
                                </p>
                                <p class="mb-0">
                                    <i class="bi bi-mouse me-2 text-warning"></i>
                                    <strong>VLE Clicks:</strong> ${mod.vleClicks}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Detailed Comparison Table -->
        <div class="card mb-4">
            <div class="card-header">
                <h5 class="mb-0">
                    <i class="bi bi-table me-2"></i>
                    📋 Detailed Comparison
                </h5>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Metric</th>
                                ${modules.map(mod => `<th class="text-center">${mod.code}</th>`).join('')}
                                <th class="text-center">Winner</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Average Score -->
                            <tr>
                                <td><strong>Average Score</strong></td>
                                ${modules.map(mod => {
        const isBest = mod.average === Math.max(...modules.map(m => m.average));
        return `<td class="text-center ${isBest ? 'table-success' : ''}">
                                        <strong>${mod.average.toFixed(1)}%</strong>
                                        ${isBest ? '<i class="bi bi-trophy-fill text-warning ms-2"></i>' : ''}
                                    </td>`;
    }).join('')}
                                <td class="text-center">
                                    <span class="badge bg-success">
                                        ${modules.reduce((best, mod) => mod.average > best.average ? mod : best).code}
                                    </span>
                                </td>
                            </tr>
                            
                            <!-- Total Assessments -->
                            <tr>
                                <td><strong>Total Assessments</strong></td>
                                ${modules.map(mod => `<td class="text-center">${mod.totalAssessments}</td>`).join('')}
                                <td class="text-center">-</td>
                            </tr>
                            
                            <!-- Pass Rate -->
                            <tr>
                                <td><strong>Pass Rate</strong></td>
                                ${modules.map(mod => {
        const isBest = mod.passRate === Math.max(...modules.map(m => m.passRate));
        return `<td class="text-center ${isBest ? 'table-success' : ''}">
                                        <strong>${mod.passRate.toFixed(0)}%</strong>
                                        ${isBest ? '<i class="bi bi-trophy-fill text-warning ms-2"></i>' : ''}
                                    </td>`;
    }).join('')}
                                <td class="text-center">
                                    <span class="badge bg-success">
                                        ${modules.reduce((best, mod) => mod.passRate > best.passRate ? mod : best).code}
                                    </span>
                                </td>
                            </tr>
                            
                            <!-- Highest Score -->
                            <tr>
                                <td><strong>Highest Score</strong></td>
                                ${modules.map(mod => `<td class="text-center">${mod.highest}%</td>`).join('')}
                                <td class="text-center">
                                    <span class="badge bg-info">
                                        ${modules.reduce((best, mod) => mod.highest > best.highest ? mod : best).code}
                                    </span>
                                </td>
                            </tr>
                            
                            <!-- Lowest Score -->
                            <tr>
                                <td><strong>Lowest Score</strong></td>
                                ${modules.map(mod => `<td class="text-center">${mod.lowest}%</td>`).join('')}
                                <td class="text-center">-</td>
                            </tr>
                            
                            <!-- VLE Engagement -->
                            <tr>
                                <td><strong>VLE Clicks</strong></td>
                                ${modules.map(mod => {
        const isBest = mod.vleClicks === Math.max(...modules.map(m => m.vleClicks));
        return `<td class="text-center ${isBest ? 'table-success' : ''}">
                                        <strong>${mod.vleClicks}</strong>
                                        ${isBest ? '<i class="bi bi-trophy-fill text-warning ms-2"></i>' : ''}
                                    </td>`;
    }).join('')}
                                <td class="text-center">
                                    <span class="badge bg-success">
                                        ${modules.reduce((best, mod) => mod.vleClicks > best.vleClicks ? mod : best).code}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Visual Comparison Charts -->
        <div class="row g-4 mb-4">
            <!-- Chart 1: Average Score Comparison -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header">
                        <h6 class="mb-0">📊 Average Score Comparison</h6>
                    </div>
                    <div class="card-body">
                        <canvas id="comparisonAverageChart"></canvas>
                    </div>
                </div>
            </div>
            
            <!-- Chart 2: Pass Rate Comparison -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header">
                        <h6 class="mb-0">✅ Pass Rate Comparison</h6>
                    </div>
                    <div class="card-body">
                        <canvas id="comparisonPassRateChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- Chart 3: VLE Engagement Comparison -->
        <div class="card mb-4">
            <div class="card-header">
                <h6 class="mb-0">🖱️ VLE Engagement Comparison</h6>
            </div>
            <div class="card-body">
                <canvas id="comparisonEngagementChart"></canvas>
            </div>
        </div>

        <!-- Insights & Recommendations -->
        <div class="card">
            <div class="card-header bg-light">
                <h5 class="mb-0">
                    <i class="bi bi-lightbulb-fill me-2"></i>
                    💡 Insights & Recommendations
                </h5>
            </div>
            <div class="card-body">
                ${generateComparisonInsights(modules)}
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Render comparison charts
    renderComparisonCharts(modules);

    navigateTo('page-course-comparison');
}

// ============================================
// RENDER COMPARISON CHARTS
// ============================================
function renderComparisonCharts(modules) {
    // Chart 1: Average Score Bar Chart
    const avgCtx = document.getElementById('comparisonAverageChart');
    if (avgCtx) {
        new Chart(avgCtx, {
            type: 'bar',
            data: {
                labels: modules.map(m => m.code),
                datasets: [{
                    label: 'Average Score (%)',
                    data: modules.map(m => m.average),
                    backgroundColor: modules.map(m => m.color + '80'),
                    borderColor: modules.map(m => m.color),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Chart 2: Pass Rate Bar Chart
    const passCtx = document.getElementById('comparisonPassRateChart');
    if (passCtx) {
        new Chart(passCtx, {
            type: 'bar',
            data: {
                labels: modules.map(m => m.code),
                datasets: [{
                    label: 'Pass Rate (%)',
                    data: modules.map(m => m.passRate),
                    backgroundColor: modules.map(m => m.color + '80'),
                    borderColor: modules.map(m => m.color),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Chart 3: VLE Engagement Horizontal Bar
    const engageCtx = document.getElementById('comparisonEngagementChart');
    if (engageCtx) {
        new Chart(engageCtx, {
            type: 'bar',  // ✅ Use 'bar' with indexAxis: 'y'
            data: {
                labels: modules.map(m => m.code),
                datasets: [{
                    label: 'VLE Clicks',
                    data: modules.map(m => m.vleClicks),
                    backgroundColor: modules.map(m => m.color + '80'),
                    borderColor: modules.map(m => m.color),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',  // ✅ This makes it horizontal
                scales: {
                    x: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// ============================================
// GENERATE COMPARISON INSIGHTS
// ============================================
function generateComparisonInsights(modules) {
    const insights = [];

    const best = modules.reduce((best, mod) => mod.average > best.average ? mod : best);
    const worst = modules.reduce((worst, mod) => mod.average < worst.average ? mod : worst);

    insights.push(`
        <div class="alert alert-success">
            <i class="bi bi-trophy-fill me-2"></i>
            <strong>Best Performing:</strong> ${best.code} with ${best.average.toFixed(1)}% average. Keep up the excellent work!
        </div>
    `);

    if (worst.average < 40) {
        insights.push(`
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Needs Attention:</strong> ${worst.code} is below passing grade (${worst.average.toFixed(1)}%). 
                Consider booking tutoring support or reviewing lecture materials.
            </div>
        `);
    } else if (worst.average < 60) {
        insights.push(`
            <div class="alert alert-warning">
                <i class="bi bi-info-circle-fill me-2"></i>
                <strong>Room for Improvement:</strong> ${worst.code} could be improved (${worst.average.toFixed(1)}%). 
                Focus on practice problems and seek help if needed.
            </div>
        `);
    }

    const mostEngaged = modules.reduce((best, mod) => mod.vleClicks > best.vleClicks ? mod : best);
    insights.push(`
        <div class="alert alert-info">
            <i class="bi bi-mouse-fill me-2"></i>
            <strong>Most Engaged:</strong> You're most active in ${mostEngaged.code} with ${mostEngaged.vleClicks} VLE clicks. 
            Engagement often correlates with better performance!
        </div>
    `);

    return insights.join('');
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
            <div class="col-md-12">
                <h5 class="mb-3">📚 Topics to Study</h5>
                <div class="list-group">
                    <div class="list-group-item d-flex justify-content-between align-items-center" style="padding: 1.5rem; font-size: 1.1rem;">
                        <span>Week ${Math.floor(assessment.date / 7) - 1} Materials</span>
                        <span class="badge bg-success" style="font-size: 0.95rem; padding: 0.6rem 0.9rem;">Ready</span>
                    </div>
                    <div class="list-group-item d-flex justify-content-between align-items-center" style="padding: 1.5rem; font-size: 1.1rem;">
                        <span>Week ${Math.floor(assessment.date / 7)} Materials</span>
                        <span class="badge bg-warning" style="font-size: 0.95rem; padding: 0.6rem 0.9rem;">Review Needed</span>
                    </div>
                    <div class="list-group-item d-flex justify-content-between align-items-center" style="padding: 1.5rem; font-size: 1.1rem;">
                        <span>Practice Problems</span>
                        <span class="badge bg-info" style="font-size: 0.95rem; padding: 0.6rem 0.9rem;">Available</span>
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
    //updatePrepCalculation(assessment.code_module, currentAvg, moduleScores.length);
    navigateTo('page-deadline-prep');
}

// ============================================
// RENDER COURSE OVERVIEW WITH COMPARISON
// ============================================
function renderCourseOverview() {
    const data = window.studentData;
    const container = document.getElementById('courseOverviewContent');

    if (!container || !data.scores || data.scores.length === 0) {
        if (container) {
            container.innerHTML = '<p class="text-muted text-center p-4">No course data available</p>';
        }
        return;
    }

    // Group scores by module
    const moduleStats = {};
    data.scores.forEach(s => {
        const module = s.code_module;
        if (!moduleStats[module]) {
            moduleStats[module] = {
                code: module,
                presentation: s.code_presentation,
                scores: [],
                totalAssessments: 0,
                passedAssessments: 0,
                failedAssessments: 0
            };
        }

        const score = Number(s.score);
        moduleStats[module].scores.push(score);
        moduleStats[module].totalAssessments++;

        if (score >= 40) {
            moduleStats[module].passedAssessments++;
        } else {
            moduleStats[module].failedAssessments++;
        }
    });

    // Calculate averages and determine status
    Object.values(moduleStats).forEach(mod => {
        mod.average = mod.scores.reduce((a, b) => a + b, 0) / mod.scores.length;
        mod.highest = Math.max(...mod.scores);
        mod.lowest = Math.min(...mod.scores);

        // Determine performance level
        if (mod.average >= 80) {
            mod.performance = 'excellent';
            mod.status = 'Distinction';
            mod.icon = '🏆';
        } else if (mod.average >= 60) {
            mod.performance = 'good';
            mod.status = 'Merit';
            mod.icon = '⭐';
        } else if (mod.average >= 40) {
            mod.performance = 'warning';
            mod.status = 'Pass';
            mod.icon = '✅';
        } else {
            mod.performance = 'danger';
            mod.status = 'At Risk';
            mod.icon = '⚠️';
        }
    });

    const modules = Object.values(moduleStats);
    const totalCourses = modules.length;
    const goodCourses = modules.filter(m => m.average >= 60).length;

    // Update badge
    document.getElementById('totalCoursesBadge').textContent =
        `${totalCourses} Course${totalCourses !== 1 ? 's' : ''}`;

    // Render the overview
    const html = `
        <!-- Summary Stats -->
        <div class="row g-0 border-bottom">
            <div class="col-md-4 p-4 text-center border-end">
                <div class="metric-value text-primary">${totalCourses}</div>
                <small class="text-muted">Total Courses Enrolled</small>
            </div>
            <div class="col-md-4 p-4 text-center border-end">
                <div class="metric-value text-success">${goodCourses}</div>
                <small class="text-muted">Performing Well (≥60%)</small>
            </div>
            <div class="col-md-4 p-4 text-center">
                <div class="metric-value text-info">${modules.reduce((sum, m) => sum + m.totalAssessments, 0)}</div>
                <small class="text-muted">Total Assessments</small>
            </div>
        </div>

        <!-- Course Cards -->
        <div class="p-3">
            ${modules.map(mod => `
                <div class="course-card ${mod.performance} p-4 mb-3 rounded" 
                     onclick='showCourseDetail("${mod.code}")'>
                    <div class="row align-items-center">
                        <div class="col-md-3">
                            <div class="d-flex align-items-center">
                                <div class="me-3" style="font-size: 3rem;">${mod.icon}</div>
                                <div>
                                    <h5 class="mb-1">${mod.code}</h5>
                                    <small class="text-muted">${mod.presentation}</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-2 text-center">
                            <div class="comparison-metric">
                                <div class="metric-value text-${mod.performance}">
                                    ${mod.average.toFixed(1)}%
                                </div>
                                <small class="text-muted d-block">Average</small>
                            </div>
                        </div>
                        
                        <div class="col-md-2 text-center">
                            <div class="comparison-metric">
                                <div class="metric-value">${mod.totalAssessments}</div>
                                <small class="text-muted d-block">Assessments</small>
                            </div>
                        </div>
                        
                        <div class="col-md-2 text-center">
                            <div class="comparison-metric">
                                <div class="metric-value text-success">${mod.passedAssessments}</div>
                                <small class="text-muted d-block">Passed</small>
                            </div>
                        </div>
                        
                        <div class="col-md-3 text-center">
                            <span class="badge performance-badge bg-${mod.performance}">
                                ${mod.status}
                            </span>
                            <div class="mt-2">
                                <small class="text-muted">
                                    Range: ${mod.lowest}% - ${mod.highest}%
                                </small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="progress mt-3" style="height: 8px;">
                        <div class="progress-bar bg-${mod.performance}" 
                             style="width: ${mod.average}%"
                             role="progressbar">
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        ${totalCourses >= 2 ? `
            <!-- Comparison Button -->
            <div class="p-3 border-top bg-light text-center">
                <button class="btn btn-primary" onclick="showCourseComparison()">
                    <i class="bi bi-bar-chart me-2"></i>
                    Compare All Courses →
                </button>
            </div>
        ` : ''}
    `;

    container.innerHTML = html;
}

// ============================================
// SHOW URGENT ACTIONS DETAIL PAGE (Drill-In)
// ============================================
function showUrgentActionsDetail() {
    const data = window.studentData;
    const container = document.getElementById('urgentActionsDetailContent');

    if (!container) return;

    const currentDay = data.currentDay || 0;
    const urgentItems = [];

    // Collect urgent deadlines (< 14 days)
    if (data.assessments) {
        const urgent = data.assessments
            .filter(a => a.date > currentDay && (a.date - currentDay) < 14)
            .sort((a, b) => a.date - b.date);

        urgent.forEach(a => {
            const daysLeft = a.date - currentDay;
            const duration = a.assessment_type === 'Exam' ? 7 : 14;

            urgentItems.push({
                priority: daysLeft < 3 ? 'CRITICAL' : daysLeft < 7 ? 'HIGH' : 'MEDIUM',
                color: daysLeft < 3 ? 'danger' : daysLeft < 7 ? 'warning' : 'info',
                icon: 'clock-fill',
                title: `${a.assessment_type} - ${a.code_module}`,
                description: a.code_presentation,
                daysLeft: daysLeft,
                deadline: a.date,
                duration: duration,
                module: a.code_module,
                type: a.assessment_type
            });
        });
    }

    if (urgentItems.length === 0) {
        container.innerHTML = `
            <div class="p-5 text-center">
                <i class="bi bi-check-circle text-success" style="font-size: 5rem;"></i>
                <h3 class="mt-3">All Clear!</h3>
                <p class="text-muted">No urgent deadlines in the next 14 days. Great job staying on track!</p>
            </div>
        `;
        navigateTo('page-urgent-actions');
        return;
    }

    // ✅ NEW: TWO-VIEW TOGGLE SYSTEM
    const html = `
        <!-- VIEW TOGGLE BUTTONS -->
        <div class="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
                <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                ${urgentItems.length} Urgent Action${urgentItems.length !== 1 ? 's' : ''}
            </h5>
            <div class="btn-group" role="group">
                <button type="button" class="btn btn-primary active" id="urgentGanttViewBtn" onclick="toggleUrgentView('gantt')">
                    <i class="bi bi-bar-chart-line me-2"></i>
                    Gantt Chart
                </button>
                <button type="button" class="btn btn-outline-primary" id="urgentListViewBtn" onclick="toggleUrgentView('list')">
                    <i class="bi bi-list-task me-2"></i>
                    Action Items
                </button>
            </div>
        </div>

        <!-- VIEW 1: GANTT CHART -->
        <div id="urgentGanttView" class="p-4 bg-light">
            <h5 class="mb-3">
                📊 Deadline Timeline (Gantt Chart)
            </h5>
            ${renderGanttChart(urgentItems, currentDay)}
        </div>

        <!-- VIEW 2: ACTION ITEMS LIST -->
        <div id="urgentListView" class="p-4" style="display: none;">
            <h5 class="mb-3">
                <i class="bi bi-list-task me-2"></i>
                📋 Detailed Action Items (${urgentItems.length})
            </h5>
            ${urgentItems.map((item, index) => `
                <div class="card mb-3 border-${item.color}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <span class="badge bg-${item.color}">#${index + 1} ${item.priority}</span>
                                    <h6 class="mb-0">
                                        <i class="bi bi-${item.icon} text-${item.color} me-2"></i>
                                        ${item.title}
                                    </h6>
                                </div>
                                
                                <p class="text-muted mb-2 small">${item.description}</p>
                                
                                <div class="row g-2 mb-3">
                                    <div class="col-auto">
                                        <span class="badge bg-light text-dark">
                                            <i class="bi bi-calendar-event me-1"></i>
                                            <strong>${item.daysLeft} days left</strong>
                                        </span>
                                    </div>
                                    <div class="col-auto">
                                        <span class="badge bg-light text-dark">
                                            <i class="bi bi-hourglass-split me-1"></i>
                                            ${item.duration} days prep time
                                        </span>
                                    </div>
                                    <div class="col-auto">
                                        <span class="badge bg-light text-dark">
                                            <i class="bi bi-calendar-check me-1"></i>
                                            Due: Day ${item.deadline}
                                        </span>
                                    </div>
                                </div>
                                
                                <button class="btn btn-sm btn-${item.color}" 
                                        onclick='showDeadlinePrep(${JSON.stringify({
        code_module: item.module,
        assessment_type: item.type,
        date: item.deadline,
        code_presentation: item.description
    })})'>
                                    <i class="bi bi-arrow-right-circle me-1"></i>
                                    Prepare Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
    navigateTo('page-urgent-actions');
}

// ✅ NEW: Toggle function for Urgent Actions views
function toggleUrgentView(view) {
    const ganttView = document.getElementById('urgentGanttView');
    const listView = document.getElementById('urgentListView');
    const ganttBtn = document.getElementById('urgentGanttViewBtn');
    const listBtn = document.getElementById('urgentListViewBtn');

    if (view === 'gantt') {
        ganttView.style.display = 'block';
        listView.style.display = 'none';
        ganttBtn.classList.add('active');
        ganttBtn.classList.remove('btn-outline-primary');
        ganttBtn.classList.add('btn-primary');
        listBtn.classList.remove('active');
        listBtn.classList.add('btn-outline-primary');
        listBtn.classList.remove('btn-primary');
    } else {
        ganttView.style.display = 'none';
        listView.style.display = 'block';
        listBtn.classList.add('active');
        listBtn.classList.remove('btn-outline-primary');
        listBtn.classList.add('btn-primary');
        ganttBtn.classList.remove('active');
        ganttBtn.classList.add('btn-outline-primary');
        ganttBtn.classList.remove('btn-primary');
    }
}

// ============================================
// BOOK TUTOR SESSION VIA EMAIL
// ============================================
function bookTutorSession(moduleCode, assessmentNumber) {
    const data = window.studentData;
    const student = data.student;

    // Email details
    const lecturerEmail = 'lecturer@university.edu'; // You can customize this
    const subject = `Tutor Session Request - ${moduleCode} Assessment ${assessmentNumber}`;
    const body = `Dear Lecturer,

I would like to request a tutoring session for ${moduleCode}, specifically regarding Assessment ${assessmentNumber}.

Student Details:
- Student ID: ${student.id_student}
- Module: ${moduleCode}
- Assessment: Assessment ${assessmentNumber}
- Topics needing help: [Please specify the topics you struggled with]

Available times:
- [Please provide 2-3 time slots that work for you]

Thank you for your support.

Best regards,
Student ID: ${student.id_student}`;

    // Create mailto link
    const mailtoLink = `mailto:${lecturerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Open email client
    window.location.href = mailtoLink;
}

// ============================================
// SHOW INDIVIDUAL COURSE DETAIL
// ============================================
function showCourseDetail(moduleCode) {
    const data = window.studentData;
    const moduleData = {
        code: moduleCode,
        scores: data.scores.filter(s => s.code_module === moduleCode)
    };

    if (moduleData.scores.length > 0) {
        showModuleDetail(moduleData);
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
